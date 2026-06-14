/**
 * createField — the browser entry point (§13).
 *
 * Mounts the simulation against a `<canvas>`: builds the particle pool, scans
 * the document for `[data-body]` bodies, runs the rAF loop (measure → reindex →
 * step → render), and exposes the public `FieldHandle`. Pure glue — the testable
 * physics lives in field-store / integrator / scanner.
 *
 * ── Renderer-agnostic (frontier) ──────────────────────────────────────────────────────
 * This engine touches NO DOM globals. Every environment touchpoint — viewport size, scroll, rAF,
 * reduced-motion, visibility, the scan root, and event wiring — goes through an injected
 * {@link FieldHost} (default `browserHost()`). The browser's `window`/`document` surface is isolated
 * in `browser-host.ts` (the one allowlisted DOM module, with `export.ts`). Pass `opts.host` to drive
 * the same engine from a different renderer/environment. Enforced by `dom-boundary.test.ts`.
 */

import type { AtomPayload, Body, Env, FieldHandle, FieldOptions, Formation, OverlayInput, OverlayMode, Particle } from './types.ts';
import { FieldStore } from './field-store.ts';
import { createRegistry } from './registry.ts';
import { step } from './integrator.ts';
import { scanBodies, measureBodies, bodyFromElement } from './scanner.ts';
import {
  ShadowRegistry,
  REGISTER_BODY,
  UNREGISTER_BODY,
  UPDATE_BODY,
  type RegisterBodyDetail,
} from './shadow.ts';
import { easeFormation } from './formations.ts';
import { Heatmap } from './heatmap.ts';
import {
  buildWaves,
  buildBound,
  waveYat,
  type Wave,
  type BoundParticle,
  type WavePull,
} from './currents.ts';
import { healWaves, tearBoundNear, tearBoundByForces, induceCharges } from './reservoir.ts';
import { FORMATION_BY, PALETTE, type FormationId } from '../config/forces.config.ts';
import { resolvePalette } from '../config/palettes.ts';
import { clamp, hexToRgb, particleRGB, rgbToHex, sampleStops, type RGB } from './math.ts';
import { feedbackTarget, feedbackWeight } from './feedback.ts';
import { defaultFeedbackSink } from './feedback-sink.ts';
import { thermoMetrics } from './thermo.ts';
import { attentionMuls } from './attention.ts';
import { spillover } from './causality.ts';
import { integrateOffset, anchorForce, elementMass, repelForce, densityPush, type ElementOffset } from './agents.ts';
import { releaseCaptured, sinkLoad, captureEdge, dischargeDisengaged } from './accretion.ts';
import { withinCapture, stepDock, dockTransform, type DockState } from './dock.ts';
import { parseEventBindings, triggerActive, type EventBinding } from './events.ts';
import { registerCoreForces } from '../forces/index.ts';
import { registerNaturalForces } from '../forces/natural.ts';
import { registerExtendedForces } from '../forces/extended.ts';
import { ScalarGridImpl } from './scalar-grid.ts';
import { sparkCount, burstImpulse } from './reactions.ts';
import { linkAlpha, marchingCell, splatDensity, nearestSite, voronoiWalls } from './render-modes.ts';
import { canvas2dBackend, type RenderBackend, type Stroke } from './render-backend.ts';
import { forceAt, netField } from './streamlines.ts';
import { traceFieldLines } from './fieldlines.ts';
import { fieldLineSeeds } from './fieldline-seeds.ts';
import { flowBias, makeFlowFocus, type FlowFocus, type FlowOptions } from './flow.ts';
import type { FieldHost } from './host.ts';
import { energyReport } from '../diagnostics/energy.ts';

// the Currents' cool baseline palette — a subset of the force palette (§24.4).
const WAVE_RGB = ['#4da3ff', '#2dd4bf', '#a78bfa'].map(hexToRgb);

export function createField(canvas: HTMLCanvasElement, opts: FieldOptions = {}): FieldHandle {
  // Signals-only mode (`render: 'none'`, §13.7 / #297): the full simulation + feedback pipeline
  // runs, but the engine never acquires a 2d context, never sizes a canvas backing store (it stays
  // 0×0 — the allocation win), and never draws. The field exists purely as signals: `--d`, `--load`,
  // `--lit`, capture events, `scrollV()`. `ctx` stays null until `setRender` to a drawing mode
  // acquires it lazily (and sizes the store then) — so a field created with 'none' allocates no
  // render surface at all unless asked to draw.
  let ctx: CanvasRenderingContext2D | null = null;
  if ((opts.render ?? 'dots') !== 'none') {
    ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Fundamental: 2D canvas context unavailable');
  }

  // Field Surfaces: the optional OVERLAY surface, drawn in front of page content. Core only draws to
  // it (the caller owns the element + its fixed/pointer-events placement); its backing store is sized
  // in resize() to match the main canvas dpr. Keeps core DOM-free — the canvas is handed in.
  // Under `render: 'none'` it is never acquired either (the overlay never draws in that mode).
  const overlayCanvas = opts.overlayCanvas ?? null;
  let overlayCtx: CanvasRenderingContext2D | null = ctx ? (overlayCanvas?.getContext('2d') ?? null) : null;
  // The overlay draws exclusively through the RenderBackend contract (#373) — the structural
  // seam a WebGL/WebGPU surface implements later. Callers may inject one; the default wraps the
  // overlay's own 2d context.
  let overlayBackend: RenderBackend | null =
    opts.overlayBackend ?? (overlayCanvas && overlayCtx ? canvas2dBackend(overlayCanvas, overlayCtx) : null);

  const store = new FieldStore();
  const grids = new Map<string, ScalarGridImpl>(); // §20.1 class [C] field buffers, lazy
  const reg = createRegistry();
  registerCoreForces(reg); // the canonical nine (§6)
  registerNaturalForces(reg); // natural primitives: gravity + charge (§20.10), opt-in
  registerExtendedForces(reg); // designed extended forces: lens, … (§20.3), opt-in
  // the environment seam: all DOM access goes through this injected host — core imports zero DOM.
  // In the browser, pass `browserHost()` from @fundamental-engine/platform (or use createBrowserField); the
  // @fundamental-engine/{elements,react,vanilla} entry points wire it for you.
  if (!opts.host) {
    throw new Error(
      'field-ui: createField requires opts.host. Use @fundamental-engine/vanilla (createField/mountField) or ' +
        '@fundamental-engine/elements / @fundamental-engine/react, or pass browserHost() from @fundamental-engine/platform.',
    );
  }
  const host: FieldHost = opts.host;
  const teardowns: Array<() => void> = []; // host event unsubscribers, called on destroy
  const reduceMotion = host.reducedMotion();

  const cfg = {
    accent: opts.accent ?? resolvePalette(opts.palette)[0] ?? PALETTE[0] ?? '#4da3ff',
    density: opts.density && opts.density > 0 ? opts.density : 1,
    render: opts.render ?? 'dots',
    waves: opts.waves ?? true, // draw the background Currents (§24); opt-out for the bare field
    background: opts.background ?? 'opaque', // 'transparent' → clear to transparent, underlay over light content
    mass: opts.mass ?? false, // first-class mass (§21.3): m ∝ size when on
    attention: opts.attention ?? false, // conserved attention (§2.4), opt-in
    causality: opts.causality ?? false, // cross-boundary causality (Concept 4), opt-in
    heatmap: opts.heatmap ?? false, // density heatmap layer (field-systems H1), opt-in
    overlay: opts.overlay ?? 'off', // Field Surfaces: overlay-surface visualization mode, opt-in
    // optional z volume (z-axis.md): 0 — the default — is the flat field, byte-identical
    // to the 2D engine; > 0 opens a shallow depth the matter drifts through, opt-in.
    depth: opts.depth && opts.depth > 0 ? opts.depth : 0,
    // ONE write path (#228, Phase 5): every feedback write goes through a sink. The platform
    // supplies one (D3, FeedbackRegistry via <field-root>); without it the engine installs the
    // internal default sink, whose writes are byte-identical to the historical direct writes.
    feedbackSink: opts.feedbackSink ?? defaultFeedbackSink,
  };
  let heatmap: Heatmap | null = null; // lazily built once the viewport size is known

  let bodies: Body[] = [];
  let W = 0;
  let H = 0;
  // cached page scroll extent — reading scrollHeight forces a synchronous reflow, so
  // we cache it (refreshed on resize + sampled occasionally) rather than per frame.
  let maxScroll = 1;
  let lastScrollY = 0; // for the per-frame scroll speed that drives the `scrolling` gate (§5)
  // last variable-font weight written per element — changing fontVariationSettings
  // reflows the text, so we only write it when the rounded weight actually changes.
  const lastWeight = new WeakMap<HTMLElement, number>();
  let raf = 0;
  let frameN = 0;
  // element-level visibility (FieldHandle.setVisible): false skips draw work each frame while
  // the simulation + feedback signals stay live. Tab-level visibility is handled separately
  // (onVisibility stops the loop entirely).
  let canvasVisible = true;
  let formTarget: Formation = { ...FORMATION_BY.ambient.preset };
  let waves: Wave[] = [];
  let bound: BoundParticle[] = [];
  let boundTarget = 0;
  // the injected sources (#371): every random draw and wall-clock read in the engine flows
  // through these two, so a seeded rng + fixed clock make a run reproducible end to end.
  const rng = opts.rng ?? Math.random;
  const wallNow = opts.now ?? ((): number => performance.now());
  let boot = reduceMotion ? 1 : 0;
  let lastNow = NaN; // previous frame timestamp — drives the frame-rate-independent dt (#434)
  let mball: Float32Array | null = null; // scratch density grid for the metaballs render mode
  let vor: Int32Array | null = null; // scratch owner grid for the voronoi render mode
  // EMA (exponential moving average) of the per-frame peak magnitude for each arrow renderer.
  // Normalizing to the raw frame max caused the entire arrow field to rescale in one step when
  // maxMag shifted (body drag, animated strength, density ramp) — visible as a pulsing flash.
  // The EMA tracks the true level but smooths transients: fast to rise (alpha=0.3 on peaks above
  // the smoothed value), slow to fall (alpha=0.1 when the field weakens), so arrows converge
  // quickly when a strong body is added but don't snap back on a single quiet frame.
  // Each renderer keeps independent state so underlay and overlay don't cross-influence.
  let slMaxSmoothed = 0; // underlay streamlines
  let olMaxSmoothed = 0; // overlay arrows (streamlines / force-vectors / field-lines)
  // Cached force-field samples for the underlay streamlines / 'flow' arrows. The sampled field is
  // driven by body positions, which only update on the measureBodies cadence (every 6th frame), so
  // re-sampling the whole grid every frame is wasted work that surfaces as scroll jank. We resample
  // on a cadence and DRAW from this cache every frame (so the arrows never flicker or step).
  let slSamples: { gx: number; gy: number; ux: number; uy: number; mag: number }[] | null = null;
  let slQuiescent: { gx: number; gy: number }[] = [];
  // hard pool ceiling for class-[S] sources (§20.1) — generous above the ~130·density
  // base field so emission is never starved, but bounded so the sim can't grow forever.
  const spawnCeiling = Math.round(130 * cfg.density) * 4;
  const pull: WavePull = { x: 0, y: 0, k: 0 }; // the "spine" — waves bend to the engaged body
  let flow: FlowFocus | null = null; // a movable flow focus the field bends toward (field.flowTo)
  let focusP: Particle | null = null; // the hover-focused particle (field.focusAt): held still + lit
  let focusX = 0;
  let focusY = 0;
  let JOURNEY: RGB[] = resolvePalette(opts.palette).map(hexToRgb); // the accent journey (§9)
  let curAccent: RGB = hexToRgb(cfg.accent);
  let hoverAccent: string | null = null;
  let threadLinks: { a: Element; b: Element; c: RGB; seed: number }[] = [];
  let movers: {
    el: HTMLElement;
    o: ElementOffset;
    mEl: number;
    layout: boolean;
    /** opted into element capture via `data-dock` (§22.3). */
    dockable: boolean;
    /** collapse progress while docking/released. */
    dock: DockState;
    /** the sink body currently holding this element, or null. */
    docked: Body | null;
    /** opted into element relocate via `data-warp` (§22.3): teleport on entering a warp throat. */
    warpable: boolean;
    /** frames until this element may relocate again (anti-thrash cooldown). */
    warpCool: number;
  }[] = [];
  // element emit (§22.3): bodies that clone a decorative template into the DOM, budgeted by data-max.
  let emitters: { el: HTMLElement; tmpl: HTMLElement | null; cap: number; emitted: HTMLElement[] }[] = [];
  let sparks: { x: number; y: number; vx: number; vy: number; life: number; c: RGB }[] = [];
  let eventEls: { el: HTMLElement; body: Body | null; bindings: EventBinding[] }[] = [];
  let engaged: { el: HTMLElement; enter: () => void; leave: () => void }[] = []; // [data-hot] listeners, for teardown

  // shadow-DOM participation (docs/engine-reference/shadow-dom.md): encapsulated components dispatch composed
  // register/unregister/update events; the field registers the HOST and never inspects the
  // shadow tree. The events bubble (composed) to the document, so we listen there.
  const shadow = new ShadowRegistry();
  // Coalesce a burst of registration events (N components mounting at once) into ONE rescan on
  // the next microtask, instead of a full-document scan per event.
  let scanQueued = false;
  const scheduleScan = (): void => {
    if (scanQueued) return;
    scanQueued = true;
    queueMicrotask(() => {
      scanQueued = false;
      scan();
    });
  };
  // clear the field's CSS write-back when a still-connected host leaves the field, so it
  // doesn't keep a frozen `--d` glow (a removed light-DOM element is gone, so it needs no clear).
  const clearWriteback = (el: HTMLElement): void => {
    for (const v of ['--d', '--field-density', '--load', '--mass', '--entropy', '--coherence', '--temperature'])
      el.style.removeProperty(v);
  };
  const onRegister = (e: Event): void => {
    const d = (e as CustomEvent<RegisterBodyDetail>).detail;
    if (d?.element) {
      shadow.register(d);
      scheduleScan();
    }
  };
  const onUnregister = (e: Event): void => {
    const d = (e as CustomEvent<RegisterBodyDetail>).detail;
    if (d?.element) {
      shadow.unregister(d.element);
      clearWriteback(d.writeTarget ?? d.element);
      scheduleScan();
    }
  };
  const onUpdateBody = scheduleScan; // attrs/geometry changed → re-scan (coalesced)
  const probe: Particle = { x: 0, y: 0, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: null };
  const t0 = wallNow();

  const env: Env = {
    dx: 0,
    dy: 0,
    dz: 0,
    dist: 1,
    form: { ...FORMATION_BY.ambient.preset },
    W: 0,
    H: 0,
    D: cfg.depth, // the optional z volume (z-axis.md); 0 = the flat field
    t: 0,
    frameN: 0,
    dt: reduceMotion ? 0 : 1,
    c: 12,
    G: 1,
    scrollV: 0,
    rng,
    spark: (x, y, power, color) => spawnSpark(x, y, power, color),
    supernova: (b) => {
      // release exactly what was captured — radial, from the core (§6.9, accretion.ts). Held matter
      // is conserved: released particles stay in the pool. `releaseCaptured` resets b.accreted to 0.
      const released = releaseCaptured(store.particles, b, rng);
      const justReleased = new Set(released);
      // the blast shoves nearby *free* matter outward (but not the matter it just released).
      for (const q of store.particles) {
        if (justReleased.has(q)) continue;
        const dx = q.x - b.cx;
        const dy = q.y - b.cy;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 320) {
          const f = (1 - d / 320) * 4;
          q.vx += (dx / d) * f;
          q.vy += (dy / d) * f;
          q.heat = Math.max(q.heat, 0.8);
        }
      }
      // the blast also tears nearby bound matter off the Currents (§6.9, §2.4).
      tearBoundNear(bound, waves, b.cx, b.cy, 320, W, H, env.t, (p) => void store.add(newParticle(p)));
      // release docks any DOM elements this sink had captured (§22.3, element capture).
      undockFrom(b);
      // and fires field:released on the falling edge of accreting (capture/release events, §22.5).
      if (b.el.dataset.fxCap === '1') {
        b.el.dataset.fxCap = '0';
        fireCaptureEvent(b.el, 'released', { accreted: 0, load: 0 });
      }
    },
    // class-[S] sources emit through here, capped by a hard pool ceiling (the
    // conservation backstop, §20.1): even a source with no lifespan can't grow the
    // count without bound. The ceiling is generous above the base field so normal
    // emission is never starved.
    spawn: (p) => {
      if (store.size >= spawnCeiling) return;
      store.add(newParticle(p));
    },
    neighbors: (p, r) => store.neighbors(p, r),
    // scalar field-buffer service (§20.1 class [C]): created on demand, so a page
    // with no diffuse/propagate body allocates nothing. Grids named "wave…" use the
    // wave scheme; everything else diffuses.
    grid: (name) => {
      let g = grids.get(name);
      if (!g) {
        const mode = name.startsWith('wave') ? 'wave' : name.startsWith('memory') ? 'memory' : 'diffuse';
        g = new ScalarGridImpl(W, H, mode);
        grids.set(name, g);
      }
      return g;
    },
  };

  function spawnSpark(x: number, y: number, power: number, color?: string): void {
    if (reduceMotion || sparks.length > 260) return;
    const c: RGB = color ? hexToRgb(color) : [255, 122, 69]; // WARM default (§20.8)
    const n = sparkCount(power);
    for (let k = 0; k < n; k++) {
      const a = rng() * 6.28318;
      const s = 0.8 + rng() * (power > 0 ? power : 1) * 1.7;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c });
    }
  }

  function newParticle(seed: Partial<Particle> = {}): Particle {
    const size = seed.size ?? 0.7 + rng() * 1.8;
    return {
      x: seed.x ?? rng() * W,
      y: seed.y ?? rng() * H,
      vx: seed.vx ?? (rng() - 0.5) * 0.25,
      vy: seed.vy ?? (rng() - 0.5) * 0.18,
      // the optional z lane (z-axis.md): seeded through the volume in a depth > 0
      // field, pinned to the plane (0) in the flat default — through the injectable rng (#371).
      z: seed.z ?? (cfg.depth > 0 ? rng() * cfg.depth : 0),
      vz: seed.vz ?? (cfg.depth > 0 ? (rng() - 0.5) * 0.18 : 0),
      m: seed.m ?? (cfg.mass ? size : 1), // mass ∝ size when first-class mass is on
      heat: seed.heat ?? 0,
      size,
      gx: seed.gx ?? rng(),
      gy: seed.gy ?? rng(),
      gz: seed.gz ?? rng(),
      cap: null,
      ...(seed.age != null ? { age: seed.age } : {}), // mortal matter (a [S] source)
      ...(seed.color != null ? { color: seed.color } : {}),
      ...(seed.species != null ? { species: seed.species } : {}), // matter tagging (#444)
    };
  }

  // optional per-particle data records (FieldHandle.seed) — round-robined onto the base pool, with
  // each record's weight scaling that particle's mass + size. Re-applied on every build (resize/density).
  let seeded: readonly AtomPayload[] = [];
  function applySeed(): void {
    if (!seeded.length) return;
    const ps = store.particles;
    for (let i = 0; i < ps.length; i++) {
      const a = seeded[i % seeded.length]!;
      ps[i]!.atom = a;
      const w = typeof a.weight === 'number' ? Math.max(0, Math.min(1, a.weight)) : 0.5;
      ps[i]!.size *= 0.6 + w * 0.9; // richer record → bigger dot
      ps[i]!.m *= 0.6 + w * 1.2; // richer record → heavier (more central)
    }
  }

  function build(): void {
    store.clear();
    const n = Math.round(130 * cfg.density);
    for (let i = 0; i < n; i++) store.add(newParticle());
    applySeed();
    // the Currents (§24) are opt-out: with waves off, the field is just the free particles.
    waves = cfg.waves ? buildWaves(WAVE_RGB) : [];
    bound = cfg.waves ? buildBound(waves.length, cfg.density, rng) : [];
    boundTarget = bound.length;
  }

  function scan(): void {
    const scanned = scanBodies(host.root);
    // merge event-registered shadow-DOM hosts (deduped — a light-DOM host that also fires
    // a registration event is counted once). Registration is the canonical discovery path;
    // light-DOM scanning is the compatibility fallback (shadow-dom.md §16).
    if (shadow.size > 0) {
      const seen = new Set(scanned.map((b) => b.el));
      bodies = scanned.concat(shadow.bodies(bodyFromElement).filter((b) => !seen.has(b.el)));
    } else {
      bodies = scanned;
    }
    measureBodies(bodies, W, H);
    bindEngagement();
    // Reconcile movers: carry forward offset + dock state for elements that persist across
    // rescans (shadow-DOM re-register, Astro nav re-mounts, explicit rescan()). An element that
    // was docked under the old record but is absent from the new scan has already left the DOM;
    // nothing to restore (the isConnected guard in updateMovers already cleared its dock state).
    // An element that is present in both scans keeps its in-flight offset and dock progress so a
    // rescan during a live dock animation doesn't reset the element to its layout slot.
    const prevMovers = new Map(movers.map((mv) => [mv.el, mv]));
    movers = [...host.root.querySelectorAll('[data-move]')].map((node) => {
      const el = node as HTMLElement;
      const r = el.getBoundingClientRect();
      const seeded = Number.parseFloat(el.dataset.mass ?? '');
      const mEl = Number.isFinite(seeded) ? seeded : elementMass(r.width * r.height);
      // `data-move="layout"` opts into the self-laying-out forces (Concept 3): mutual
      // repulsion + density pressure. Plain `data-move` just drifts with the field.
      const layout = (el.dataset.move ?? '').trim() === 'layout';
      // `data-dock` opts into element capture (§22.3): the element docks when it falls into a sink.
      const dockable = el.hasAttribute('data-dock');
      // `data-warp` opts into element relocate (§22.3): teleport on entering a warp throat.
      const warpable = el.hasAttribute('data-warp');
      const prev = prevMovers.get(el);
      if (prev) {
        // Persist the in-flight state: the element was already known, keep its offset + dock
        // progress. Re-check dockable/warpable/layout in case attributes changed. mEl re-measured.
        return { el, o: prev.o, mEl, layout, dockable, dock: prev.dock, docked: prev.docked, warpable, warpCool: prev.warpCool };
      }
      return { el, o: { x: 0, y: 0, vx: 0, vy: 0 } as ElementOffset, mEl, layout, dockable, dock: { dock: 0 }, docked: null, warpable, warpCool: 0 };
    });
    eventEls = [...host.root.querySelectorAll('[data-on]')].map((node) => {
      const el = node as HTMLElement;
      return {
        el,
        body: bodies.find((b) => b.el === el) ?? null,
        bindings: parseEventBindings(el.dataset.on ?? ''),
      };
    });
    // resolve `warp` pairings (§22.3 relocate): a body's data-pair selector → the paired body, whose
    // live centre becomes the relocate target each frame (updateWarpTargets).
    for (const b of bodies) {
      if (!b.pair) continue;
      let target: Element | null = null;
      try {
        target = host.root.querySelector(b.pair);
      } catch {
        target = null; // invalid selector → unpaired, the force no-ops
      }
      b.pairBody = target ? bodies.find((o) => o.el === target) : undefined;
    }
    // element emit (§22.3): bodies with data-emit clone a referenced template, capped by data-max.
    // Reconcile across rescans: emitter elements that persist carry their existing clones forward
    // (cap × rescans accumulation is the regression from #260). Clones that have been disconnected
    // from the DOM (e.g. the emitter's subtree was replaced during an Astro nav) are pruned here
    // before re-use. Emitter elements that have left the DOM have their clones removed.
    const prevEmitters = new Map(emitters.map((em) => [em.el, em]));
    // clean up clones belonging to emitter elements that are no longer in the scan root.
    for (const [el, em] of prevEmitters) {
      if (!host.root.contains(el)) {
        for (const clone of em.emitted) clone.remove();
      }
    }
    emitters = [...host.root.querySelectorAll('[data-emit]')].map((node) => {
      const el = node as HTMLElement;
      const sel = el.dataset.emit ?? '';
      let tmpl: HTMLElement | null = null;
      try {
        tmpl = sel ? (host.root.querySelector(sel) as HTMLElement | null) : null;
      } catch {
        tmpl = null;
      }
      const cap = Math.max(0, Math.round(Number.parseFloat(el.dataset.max ?? '') || 8));
      const prev = prevEmitters.get(el);
      if (prev) {
        // Carry the existing clones forward, but prune any that were disconnected while the
        // emitter element itself persisted (partial subtree replacement). Cap may have changed.
        const live = prev.emitted.filter((c) => c.isConnected);
        // Remove clones that exceed the (possibly changed) cap.
        while (live.length > cap) live.pop()!.remove();
        return { el, tmpl, cap, emitted: live };
      }
      return { el, tmpl, cap, emitted: [] as HTMLElement[] };
    });
  }

  // refresh each warp body's relocate target from its paired body's live centre (§22.3 relocate).
  function updateWarpTargets(): void {
    for (const b of bodies) {
      if (b.pairBody) {
        // If the paired element has left the DOM, sever the warp link so the wormhole closes
        // rather than relocating matter to a ghost node. A later rescan re-resolves naturally
        // when (or if) the element returns. The isConnected check is cheap — only reached when
        // pairBody is set, so the common zero-pair case pays nothing.
        if (!b.pairBody.el.isConnected) {
          b.warpHas = false;
          b.pairBody = undefined;
          continue;
        }
        if (b.pairBody.vis) {
          b.warpX = b.pairBody.cx;
          b.warpY = b.pairBody.cy;
          b.warpHas = true;
        } else {
          b.warpHas = false;
        }
      } else if (b.pair) {
        b.warpHas = false;
      }
    }
  }

  // element emit (§22.3): clone the decorative template into the emit element, budgeted by cap. Clones
  // are aria-hidden + inert (decorative, not meaningful; focusable descendants must not reach tab
  // order) and id-stripped (no duplicate ids); removed on destroy.
  function updateEmitters(): void {
    if (emitters.length === 0 || env.frameN % 30 !== 0) return;
    for (const em of emitters) {
      if (!em.tmpl || em.emitted.length >= em.cap) continue;
      const clone = em.tmpl.cloneNode(true) as HTMLElement;
      clone.removeAttribute('id');
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('inert', '');
      clone.dataset.fieldEmitted = '';
      em.el.appendChild(clone);
      em.emitted.push(clone);
    }
  }

  function updateEvents(): void {
    if (eventEls.length === 0) return;
    for (const ev of eventEls) {
      const s = ev.body
        ? { d: ev.body.d, on: ev.body.on, accreted: ev.body.accreted }
        : { d: 0, on: ev.el.dataset.active === '1', accreted: 0 };
      for (const bind of ev.bindings) {
        const active = triggerActive(bind.trigger, s);
        if (active && !bind.armed) {
          bind.armed = true;
          ev.el.dispatchEvent(
            new CustomEvent(bind.event, {
              bubbles: true,
              detail: { trigger: bind.trigger, d: s.d, on: s.on, accreted: s.accreted },
            })
          );
        } else if (!active) {
          bind.armed = false;
        }
      }
    }
  }

  // dispatch a discrete field event on an element, with the forces:* alias (migration window).
  function fireCaptureEvent(el: HTMLElement, name: 'captured' | 'released' | 'relocated', detail: Record<string, unknown>): void {
    el.dispatchEvent(new CustomEvent('field:' + name, { bubbles: true, composed: true, detail }));
    el.dispatchEvent(new CustomEvent('forces:' + name, { bubbles: true, composed: true, detail }));
  }

  // capture/release events for sink BODIES (particle accretion): fire field:captured on the rising
  // edge of accreting and field:released on the falling edge (§22.5). Release is also fired directly
  // from supernova so a same-frame fill+release never drops it.
  function updateCaptureEvents(): void {
    for (const b of bodies) {
      if (!b.vis || b.tokens.indexOf('sink') < 0) continue;
      const armed = b.el.dataset.fxCap === '1';
      const edge = captureEdge(armed, b.accreted > 0);
      if (edge.fire === 'captured') {
        b.el.dataset.fxCap = '1';
        fireCaptureEvent(b.el, 'captured', { accreted: b.accreted, load: sinkLoad(b) });
      } else if (edge.fire === 'released') {
        b.el.dataset.fxCap = '0';
        fireCaptureEvent(b.el, 'released', { accreted: 0, load: 0 });
      }
    }
  }

  // release any DOM elements a sink had docked (§22.3) — restore their transform + a11y, fire
  // field:released. Called from supernova so element capture is conserved like particle capture.
  function undockFrom(b: Body): void {
    for (const mv of movers) {
      if (mv.docked !== b) continue;
      mv.docked = null;
      mv.dock.dock = 0;
      if (mv.el.getAttribute('aria-hidden') === 'true') mv.el.removeAttribute('aria-hidden');
      mv.el.removeAttribute('inert');
      mv.el.style.opacity = '';
      fireCaptureEvent(mv.el, 'released', {});
    }
  }

  function updateMovers(): void {
    if (movers.length === 0) return;
    // current screen centres (the rect already reflects each element's transform), so the
    // self-laying-out repulsion (Concept 3) sees where everything actually sits this frame.
    const centers = movers.map((mv) => {
      const r = mv.el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    for (let i = 0; i < movers.length; i++) {
      const mv = movers[i]!;
      // If this element has been removed from the DOM while docked, drop the dock reference so
      // the sink no longer believes it holds the element. Restore is moot for a detached node;
      // we just clear state so no per-frame work runs for it going forward. Consistent with how
      // the rescan reconciliation (scan()) drops stale bodies: absent nodes are simply gone.
      if (!mv.el.isConnected) {
        if (mv.docked) {
          mv.docked = null;
          mv.dock.dock = 0;
        }
        continue;
      }
      const cx = centers[i]!.x;
      const cy = centers[i]!.y;
      // docked: collapse toward the sink core and hold there, skipping force integration (§22.3).
      if (mv.docked) {
        const home = { x: cx - mv.o.x, y: cy - mv.o.y };
        mv.dock.dock = stepDock(mv.dock.dock, 1);
        const tf = dockTransform(home, mv.o, { x: mv.docked.cx, y: mv.docked.cy }, mv.dock.dock);
        mv.el.style.transform = `translate(${tf.tx.toFixed(2)}px, ${tf.ty.toFixed(2)}px) scale(${tf.scale.toFixed(3)})`;
        mv.el.style.opacity = tf.opacity.toFixed(3);
        if (mv.dock.dock >= 1 && mv.el.getAttribute('aria-hidden') !== 'true') {
          mv.el.setAttribute('aria-hidden', 'true');
          mv.el.setAttribute('inert', '');
        }
        continue;
      }
      probe.x = cx;
      probe.y = cy;
      probe.vx = 0;
      probe.vy = 0;
      probe.heat = 0;
      probe.cap = null;
      // probe the net field force at the element's centre (reuse the force modules)
      for (const b of bodies) {
        if (!b.vis || b.tokens.length === 0 || b.el === mv.el) continue;
        const dx = b.cx - cx;
        const dy = b.cy - cy;
        const d = Math.hypot(dx, dy);
        env.dx = dx;
        env.dy = dy;
        env.dist = d < 1 ? 1 : d;
        for (const tok of b.tokens) reg.forces[tok]?.apply(b, probe, env);
      }
      probe.cap = null; // never let a mover get captured
      const a = anchorForce(mv.o);
      let fx = probe.vx + a.x;
      let fy = probe.vy + a.y;
      // Concept 3 — self-laying-out: this element pushes off the others and drifts off
      // dense field regions, so a cluster spreads and re-settles (e.g. on resize).
      if (mv.layout) {
        const others = centers.filter((_, j) => j !== i);
        const rep = repelForce({ x: cx, y: cy }, others);
        const press = densityPush((sx, sy) => store.near(sx, sy, 40).length, cx, cy, 16, 6);
        fx += rep.x + press.x;
        fy += rep.y + press.y;
      }
      // the layout-slot centre (home), captured before integration mutates the offset.
      const home = { x: cx - mv.o.x, y: cy - mv.o.y };
      integrateOffset(mv.o, fx, fy, mv.mEl, 0.9);
      mv.el.style.transform = `translate(${mv.o.x.toFixed(2)}px, ${mv.o.y.toFixed(2)}px)`;
      // element capture (§22.3): a [data-dock] mover that lands inside a sink's radius docks. Test
      // against the post-integration centre (home + new offset); never let a body dock into itself.
      if (mv.dockable) {
        const here = { x: home.x + mv.o.x, y: home.y + mv.o.y };
        const sink = bodies.find(
          (b) => b.vis && b.el !== mv.el && b.tokens.indexOf('sink') >= 0 && withinCapture(here, b)
        );
        if (sink) {
          mv.docked = sink;
          fireCaptureEvent(mv.el, 'captured', { sink: sink.el });
        }
      }
      // element relocate (§22.3): a [data-warp] mover entering a warp throat teleports its offset so
      // its screen position jumps to the throat's pair. A cooldown prevents immediate re-triggering.
      if (mv.warpCool > 0) mv.warpCool -= 1;
      if (mv.warpable && mv.warpCool === 0) {
        const here = { x: home.x + mv.o.x, y: home.y + mv.o.y };
        const throat = bodies.find(
          (b) => b.vis && b.el !== mv.el && b.warpHas && b.tokens.indexOf('warp') >= 0 && withinCapture(here, b)
        );
        if (throat) {
          // place the element's centre at the paired throat: offset = pairCentre − home.
          mv.o.x = throat.warpX! - home.x;
          mv.o.y = throat.warpY! - home.y;
          mv.o.vx = 0;
          mv.o.vy = 0;
          mv.el.style.transform = `translate(${mv.o.x.toFixed(2)}px, ${mv.o.y.toFixed(2)}px)`;
          mv.warpCool = 45;
          fireCaptureEvent(mv.el, 'relocated', { from: throat.el });
        }
      }
    }
  }

  // engagement: hover/focus a [data-hot] element → it activates (b.on, lighting
  // the spine + on-state forces) and overrides the accent with its data-color (§9).
  function bindEngagement(): void {
    // Reconcile across rescans (mirrors the emitter prune above): a persistent field outlives the
    // [data-hot] elements swapped under it (Astro nav, dynamic content), so drop engagements whose
    // element has left the DOM — release their listeners + the strong ref the `engaged` array holds,
    // so a long-lived field can't accumulate detached nodes. New elements are bound below; the
    // `fxEngaged` guard keeps live ones from double-binding.
    if (engaged.length) {
      engaged = engaged.filter((e) => {
        if (e.el.isConnected) return true;
        e.el.removeEventListener('pointerenter', e.enter);
        e.el.removeEventListener('pointerleave', e.leave);
        e.el.removeEventListener('focus', e.enter);
        e.el.removeEventListener('blur', e.leave);
        delete e.el.dataset.fxEngaged;
        return false;
      });
    }
    host.root.querySelectorAll('[data-hot]').forEach((node) => {
      const el = node as HTMLElement;
      if (el.dataset.fxEngaged === '1') return;
      el.dataset.fxEngaged = '1';
      const enter = (): void => {
        el.dataset.active = '1';
        hoverAccent = el.dataset.color ?? null;
        const group = el.closest('[data-index][data-threads]');
        if (group) {
          const sibs = [...group.querySelectorAll('[data-hot]')].filter((s) => s !== el);
          setThreads(sibs.map((s) => ({ a: el, b: s, color: el.dataset.color ?? undefined })));
        }
      };
      const leave = (): void => {
        el.dataset.active = '0';
        hoverAccent = null;
        setThreads(null);
      };
      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointerleave', leave);
      el.addEventListener('focus', enter);
      el.addEventListener('blur', leave);
      engaged.push({ el, enter, leave });
    });
  }

  function setThreads(list: import('./types.ts').ThreadLink[] | null): void {
    threadLinks = (list ?? []).map((t) => ({
      a: t.a,
      b: t.b,
      c: hexToRgb(t.color ?? cfg.accent),
      seed: rng() * 6.28,
    }));
  }

  function drawThreads(): void {
    if (threadLinks.length === 0) return;
    const time = env.t;
    ctx!.globalCompositeOperation = 'lighter';
    for (const th of threadLinks) {
      const ra = th.a.getBoundingClientRect();
      const rb = th.b.getBoundingClientRect();
      const ax = ra.left + ra.width / 2;
      const ay = ra.top + ra.height / 2;
      const bx = rb.left + rb.width / 2;
      const by = rb.top + rb.height / 2;
      const [cr, cg, cb] = th.c;
      ctx!.strokeStyle = `rgba(${cr},${cg},${cb},0.22)`;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(ax, ay);
      ctx!.lineTo(bx, by);
      ctx!.stroke();
      for (let k = 0; k < 3; k++) {
        const tt = (time * 0.6 + th.seed + k / 3) % 1;
        const px = ax + (bx - ax) * tt;
        const py = ay + (by - ay) * tt;
        ctx!.fillStyle = `rgba(${cr},${cg},${cb},${(1 - tt) * 0.9})`;
        ctx!.beginPath();
        ctx!.arc(px, py, 2.2, 0, 6.28318);
        ctx!.fill();
      }
    }
    ctx!.globalCompositeOperation = 'source-over';
  }

  // Size the drawing surfaces' backing stores to the current W×H (dpr-scaled). Split out of
  // resize() so the lazy `setRender('none' → drawing)` path can run exactly this once. With no
  // context (a field created with `render: 'none'`, §13.7 / #297) it is a no-op: the canvas
  // backing store stays 0×0 while W/H — the simulation space — keep tracking the viewport.
  function sizeSurfaces(dprRaw: number): void {
    if (!ctx) return;
    const dpr = Math.min(dprRaw || 1, 2);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // size the overlay surface's backing store to match (same dpr transform → same CSS coords).
    overlayBackend?.size(W, H, dpr);
  }

  function resize(): void {
    const vp = host.viewport();
    W = vp.width;
    H = vp.height;
    sizeSurfaces(vp.dpr);
    env.W = W;
    env.H = H;
    maxScroll = host.scrollHeight() - H || 1;
    for (const g of grids.values()) g.resize(W, H); // keep field buffers viewport-sized
    if (cfg.heatmap) {
      if (!heatmap) heatmap = new Heatmap(W, H);
      else heatmap.resize(W, H);
    }
    build();
    scan();
  }

  function drawWaves(): void {
    const time = env.t;
    const STEP = 16;
    for (const w of waves) {
      const [cr, cg, cb] = w.color;
      ctx!.beginPath();
      ctx!.moveTo(0, waveYat(w, 0, time, H, 1, 1, pull));
      for (let x = 0; x <= W; x += STEP) ctx!.lineTo(x, waveYat(w, x, time, H, 1, 1, pull));
      ctx!.lineTo(W, H);
      ctx!.lineTo(0, H);
      ctx!.closePath();
      const ty = w.baseFrac * H + w.offsetY - w.amp;
      const grad = ctx!.createLinearGradient(0, ty, 0, ty + 320);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${(0.11 + w.depth * 0.05) * boot})`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx!.fillStyle = grad;
      ctx!.fill();
    }
    ctx!.globalCompositeOperation = 'lighter';
    for (const w of waves) {
      const [cr, cg, cb] = w.color;
      ctx!.beginPath();
      ctx!.moveTo(0, waveYat(w, 0, time, H, 1, 1, pull));
      for (let x = 0; x <= W; x += STEP) ctx!.lineTo(x, waveYat(w, x, time, H, 1, 1, pull));
      // glow via a wide faint underlay then a crisp line (both additive) — not
      // shadowBlur, which made each of the five long strokes cost several ×.
      ctx!.lineWidth = 5;
      ctx!.strokeStyle = `rgba(${cr},${cg},${cb},${(0.05 + w.depth * 0.04) * boot})`;
      ctx!.stroke();
      ctx!.lineWidth = 1.2;
      ctx!.strokeStyle = `rgba(${cr},${cg},${cb},${(0.3 + w.depth * 0.22) * boot})`;
      ctx!.stroke();
    }
    ctx!.globalCompositeOperation = 'source-over';
  }

  function drawBound(): void {
    ctx!.globalCompositeOperation = 'lighter';
    const time = env.t;
    let i = 0;
    for (const p of bound) {
      const w = waves[p.wi];
      if (!w) {
        i++;
        continue;
      }
      if (env.dt) {
        p.progress += p.speed;
        if (p.progress > 1) p.progress -= 1;
        else if (p.progress < 0) p.progress += 1;
      }
      const x = p.progress * W;
      const y = waveYat(w, x, time, H, 1, 1, pull) + p.phase * 32;
      const [cr, cg, cb] = w.color;
      const tw = p.glow ? 0.6 + 0.4 * Math.sin(time * 2.2 + i) : 0.85;
      if (p.glow) {
        // additive halo instead of shadowBlur (the canvas is composited 'lighter')
        ctx!.fillStyle = `rgba(${cr},${cg},${cb},${0.16 * tw * boot})`;
        ctx!.beginPath();
        ctx!.arc(x, y, p.size + 2.5, 0, 6.28318);
        ctx!.fill();
      }
      ctx!.fillStyle = `rgba(${cr},${cg},${cb},${tw * boot})`;
      ctx!.beginPath();
      ctx!.arc(x, y, p.size, 0, 6.28318);
      ctx!.fill();
      i++;
    }
    ctx!.globalCompositeOperation = 'source-over';
  }

  // conserved attention (§2.4): redistribute one finite strength budget across the
  // visible bodies by demand (strength × engagement). Rest-neutral and total-
  // conserving, so the live field is unchanged until a body is engaged. Runs before
  // step() so the integrator reads this frame's `attn`.
  function applyAttention(): void {
    if (!cfg.attention) return;
    for (const b of bodies) b.attn = 1;
    const vis = bodies.filter((b) => b.vis && b.tokens.length > 0);
    if (vis.length === 0) return;
    const muls = attentionMuls(vis);
    for (let i = 0; i < vis.length; i++) vis[i]!.attn = muls[i]!;
  }

  // cross-boundary causality (Concept 4): a saturated body's density spills to its
  // neighbours, so engaging one lights its siblings. Writes `--lit` and fires a
  // debounced field:lit / field:dim on each element as it crosses the threshold.
  function applyCausality(): void {
    if (!cfg.causality) return;
    const vis = bodies.filter((b) => b.vis && b.tokens.length > 0);
    if (vis.length === 0) return;
    if (vis.length === 1) {
      writeLit(vis[0]!, vis[0]!.d);
      return;
    }
    const delta = spillover(vis.map((b) => ({ d: b.d, cx: b.cx, cy: b.cy })));
    for (let i = 0; i < vis.length; i++) {
      writeLit(vis[i]!, clamp(vis[i]!.d + delta[i]!, 0, 1));
    }
  }

  function writeLit(b: Body, lit: number): void {
    // the lit channel goes through the sink (#228): the platform's writes --lit + fires
    // field:lit/dim with hysteresis via FeedbackRegistry (D3); the internal default sink writes
    // --lit and fires the same hysteretic events directly (byte-identical to the legacy path).
    cfg.feedbackSink(b.el, { lit });
  }

  function writeFeedback(): void {
    for (const b of bodies) {
      if (!b.feedback) continue;
      const target = feedbackTarget(b.count, b.on);
      b.d += (target - b.d) * 0.08;
      // write to the host, or a separate write target for shadow-DOM bodies (§11).
      const writeEl = b.writeTarget ?? b.el;

      // font-variation weight is a typographic render effect (not a CSS custom property), so it is
      // applied in-engine on both paths, idempotently via lastWeight.
      if (b.fmax) {
        const w = feedbackWeight(b.fmin, b.fmax, b.d);
        if (lastWeight.get(writeEl) !== w) {
          lastWeight.set(writeEl, w);
          writeEl.style.fontVariationSettings = `"wght" ${w}` + (b.opsz ? `, "opsz" ${b.opsz}` : '');
        }
      }

      // the heatmap's local density at the body (distinct from `--d`, the body's own gathered
      // density); the accretion load is the sink fill fraction ∈ [0,1].
      const heatmapDensity = heatmap ? heatmap.norm(b.cx, b.cy) : undefined;
      const load = b.tokens.indexOf('sink') >= 0 && b.capacity > 0 ? sinkLoad(b) : undefined;

      // measured thermodynamics (workover v0.3 §"Metrics"): entropy / coherence / temperature
      // from the local sample the integrator accumulated this frame (b.thermo — the same
      // range/2 window as the density count), eased like `d` so the signals stay calm.
      const t = thermoMetrics(b.thermo);
      const m = (b.metrics ??= { entropy: 0, coherence: 1, temperature: 0 });
      m.entropy += (t.entropy - m.entropy) * 0.08;
      m.coherence += (t.coherence - m.coherence) * 0.08;
      m.temperature += (t.temperature - m.temperature) * 0.08;

      // ONE write path (#228): the CSS-var channels always go to the sink — the platform's
      // FeedbackRegistry route (D3) when configured, otherwise the internal default sink
      // (feedback-sink.ts), which performs the same direct writes the engine always made:
      // `--d`/`--field-density`, `--field-heatmap-density`, `--load`/`--mass`,
      // plus the measured `--entropy`/`--coherence`/`--temperature`.
      cfg.feedbackSink(writeEl, {
        density: b.d,
        heatmapDensity,
        load,
        entropy: m.entropy,
        coherence: m.coherence,
        temperature: m.temperature,
      });
    }
  }

  function drawSparks(): void {
    if (sparks.length === 0) return;
    ctx!.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      if (!s) continue;
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.9;
      s.vy *= 0.9;
      s.life *= 0.85;
      if (s.life < 0.05) {
        sparks.splice(i, 1);
        continue;
      }
      const [r, g, b] = s.c;
      // additive halo + core (no shadowBlur) — sparks can burst in bulk on impact.
      ctx!.fillStyle = `rgba(${r},${g},${b},${0.18 * s.life})`;
      ctx!.beginPath();
      ctx!.arc(s.x, s.y, 2 + s.life * 4, 0, 6.28318);
      ctx!.fill();
      ctx!.fillStyle = `rgba(${r},${g},${b},${s.life})`;
      ctx!.beginPath();
      ctx!.arc(s.x, s.y, 0.6 + s.life * 1.5, 0, 6.28318);
      ctx!.fill();
    }
    ctx!.globalCompositeOperation = 'source-over';
  }

  // density heatmap (H1) — a 'glow' underlay. Rasterize the normalized field to a tiny
  // offscreen buffer (one texel per grid cell), then upscale it over the canvas with bilinear
  // smoothing: a smooth glow for the cost of a small image, no blocky per-cell blobs.
  let hmCanvas: HTMLCanvasElement | null = null;
  let hmCtx: CanvasRenderingContext2D | null = null;
  let hmImg: ImageData | null = null; // reused buffer — no per-frame allocation
  function drawHeatmap(): void {
    if (!heatmap) return;
    const cell = heatmap.cell;
    const cols = Math.max(1, Math.ceil(W / cell));
    const rows = Math.max(1, Math.ceil(H / cell));
    if (!hmCanvas) {
      hmCanvas = host.createCanvas();
      hmCtx = hmCanvas.getContext('2d');
    }
    if (!hmCtx) return;
    if (hmCanvas.width !== cols || hmCanvas.height !== rows) {
      hmCanvas.width = cols;
      hmCanvas.height = rows;
      hmImg = null; // dims changed → rebuild the buffer
    }
    // RECOMPUTE the density texel grid on a cadence, not every frame: the heatmap is a smooth,
    // slow-moving glow (and the field it samples only shifts on the measureBodies cadence), so a
    // ~20 Hz refresh is imperceptible — and it keeps the per-frame heatmap cost to just the upscale.
    if (hmImg === null || frameN % 3 === 0) {
      if (hmImg === null) hmImg = hmCtx.createImageData(cols, rows);
      const acc = hexToRgb(cfg.accent);
      const data = hmImg.data;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = heatmap.norm(c * cell + cell / 2, r * cell + cell / 2);
          const i = (r * cols + c) * 4;
          data[i] = acc[0];
          data[i + 1] = acc[1];
          data[i + 2] = acc[2];
          data[i + 3] = Math.round(clamp(v * 0.5 * boot, 0, 1) * 255);
        }
      }
      hmCtx.putImageData(hmImg, 0, 0);
    }
    ctx!.globalCompositeOperation = 'lighter';
    ctx!.imageSmoothingEnabled = true;
    ctx!.drawImage(hmCanvas, 0, 0, W, H); // bilinear upscale → smooth glow
    ctx!.globalCompositeOperation = 'source-over';
  }

  function render(): void {
    // substrate clear — 'trails' uses a faded clear so motion light-paints (§20.6).
    if (cfg.background === 'transparent') {
      // clear to TRANSPARENT so the underlay composites over light content without blanking it.
      if (cfg.render === 'trails') {
        // light-paint that fades to transparent (not to black): remove ~22% of existing alpha
        // each frame via destination-out, instead of laying an opaque near-black veil over it.
        ctx!.globalCompositeOperation = 'destination-out';
        ctx!.fillStyle = 'rgba(0,0,0,0.22)';
        ctx!.fillRect(0, 0, W, H);
        ctx!.globalCompositeOperation = 'source-over';
      } else {
        ctx!.clearRect(0, 0, W, H);
      }
    } else {
      if (cfg.render === 'trails') {
        ctx!.fillStyle = 'rgba(5,6,11,0.22)';
      } else {
        ctx!.fillStyle = 'rgb(5,6,11)';
      }
      ctx!.fillRect(0, 0, W, H);
    }
    drawWaves();
    // The heatmap is a full-viewport bilinear-upscale glow — the heaviest per-frame layer. It's
    // ambient density you read at rest, not detail you track mid-scroll, so suppress it while the
    // page is scrolling fast (eased env.scrollV). Scrolling never pays the heatmap's fill cost; the
    // glow returns the moment the page settles. (Body charge/glow is CSS --load, unaffected.)
    if (heatmap && (env.scrollV ?? 0) < 6) drawHeatmap();
    drawBound();

    // free particles — cool centre → warm edge, blended toward accent (§20.8).
    // metaballs (a molten iso-surface skin) and streamlines (the bare force field) REPLACE
    // the matter per §20.6, so suppress the dot swarm for those two; dots/trails/links/voronoi
    // keep it (their overlays read against the particles).
    const showMatter = cfg.render !== 'metaballs' && cfg.render !== 'streamlines';
    ctx!.globalCompositeOperation = 'lighter';
    const acc = hexToRgb(cfg.accent);
    const cx = W / 2;
    const cy = H * 0.4;
    const maxD = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) || 1;
    if (showMatter) for (const p of store.particles) {
      // captured matter is held in orbit by the sink — drawn dim and small (the accretion's orbital
      // work), distinct from the free swarm. It stays visible: the body gathers and holds a real
      // cloud, then the supernova flings it back out. (Conserved either way — see accretion.ts.)
      if (p.cap) {
        ctx!.fillStyle = `rgba(${acc[0]},${acc[1]},${acc[2]},${0.55 * boot})`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 1.3, 0, 6.28318);
        ctx!.fill();
        continue;
      }
      const d = Math.min(1, Math.hypot(p.x - cx, p.y - cy) / maxD);
      const rs = d * d;
      const h = p.heat;
      let [r, g, b] = particleRGB(rs, h, acc);
      if (p.color) {
        // carried pigment (§20.8): a stained particle reads mostly as its own tint.
        const [pr, pg, pb] = hexToRgb(p.color);
        r += (pr - r) * 0.75;
        g += (pg - g) * 0.75;
        b += (pb - b) * 0.75;
      }
      // depth recession (z-axis.md): in a depth > 0 field, matter deeper in the volume
      // draws smaller and fainter — the flat field's factor is exactly 1.
      const zk = cfg.depth > 0 ? 1 - Math.min(Math.abs(p.z ?? 0) / cfg.depth, 1) * 0.55 : 1;
      const size = (p.size * (1 - 0.4 * rs) + h * 2) * zk;
      const alpha = clamp((0.5 - 0.3 * rs + h * 0.5) * boot * zk, 0, 1);
      const cr = r | 0;
      const cg = g | 0;
      const cb = b | 0;
      // A single tight, faint bloom under the crisp core (additive, 'lighter' composite) — just
      // enough to soften the point into a star. NOT the old wide, heat-scaled halo (`size+3+6*h`):
      // near an accretion sink every particle heats to h≈1, so that halo bloomed the whole cluster
      // into big overlapping rings (the repeatedly-flagged "glow" — #434 follow-up). Heat now reads
      // only through the brighter, slightly larger core (the `+ h*2` size and `+ h*0.5` alpha above),
      // never a growing aura. Radius is fixed (size + ~1px), so points stay crisp at any heat.
      ctx!.fillStyle = `rgba(${cr},${cg},${cb},${0.12 * alpha})`;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, size + 1.2, 0, 6.28318);
      ctx!.fill();
      ctx!.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, size, 0, 6.28318);
      ctx!.fill();
    }
    drawSparks();
    drawThreads();
    ctx!.globalCompositeOperation = 'source-over';

    if (cfg.render === 'links') {
      ctx!.globalCompositeOperation = 'lighter';
      const acc = hexToRgb(cfg.accent);
      const R = 90;
      ctx!.lineWidth = 0.6;
      for (const p of store.particles) {
        if (p.cap) continue;
        for (const q of store.neighbors(p, R)) {
          // draw each undirected pair once
          if (q.x < p.x || (q.x === p.x && q.y < p.y)) continue;
          const a = linkAlpha(Math.hypot(q.x - p.x, q.y - p.y), R);
          if (a <= 0) continue;
          ctx!.strokeStyle = `rgba(${acc[0]},${acc[1]},${acc[2]},${a})`;
          ctx!.beginPath();
          ctx!.moveTo(p.x, p.y);
          ctx!.lineTo(q.x, q.y);
          ctx!.stroke();
        }
      }
      ctx!.globalCompositeOperation = 'source-over';
    }

    // metaballs: trace a single iso-contour of the particle density field, so the swarm
    // reads as one liquid skin rather than discrete dots (§20.6). Particles splat a smooth
    // kernel onto a coarse grid; marching squares walks the threshold cell by cell.
    if (cfg.render === 'metaballs') {
      const STEP = 16; // grid resolution (px)
      const RAD = 34; // kernel radius (px)
      const LEVEL = 0.9; // iso threshold → the blob skin
      const cols = Math.ceil(W / STEP) + 1;
      const rows = Math.ceil(H / STEP) + 1;
      if (!mball || mball.length !== cols * rows) mball = new Float32Array(cols * rows);
      else mball.fill(0);
      for (const p of store.particles) {
        if (p.cap) continue;
        splatDensity(mball, cols, rows, STEP, p.x, p.y, RAD, 1);
      }
      const acc = hexToRgb(cfg.accent);
      ctx!.globalCompositeOperation = 'lighter';
      ctx!.strokeStyle = `rgba(${acc[0]},${acc[1]},${acc[2]},${0.5 * boot})`;
      ctx!.lineWidth = 1.4;
      ctx!.lineCap = 'round';
      ctx!.beginPath();
      for (let gy = 0; gy < rows - 1; gy++) {
        for (let gx = 0; gx < cols - 1; gx++) {
          const tl = mball[gy * cols + gx]!;
          const tr = mball[gy * cols + gx + 1]!;
          const br = mball[(gy + 1) * cols + gx + 1]!;
          const bl = mball[(gy + 1) * cols + gx]!;
          const segs = marchingCell(tl, tr, br, bl, LEVEL);
          if (!segs.length) continue;
          const ox = gx * STEP;
          const oy = gy * STEP;
          for (const s of segs) {
            ctx!.moveTo(ox + s.x1 * STEP, oy + s.y1 * STEP);
            ctx!.lineTo(ox + s.x2 * STEP, oy + s.y2 * STEP);
          }
        }
      }
      ctx!.stroke();
      ctx!.globalCompositeOperation = 'source-over';
    }

    // voronoi: assign each grid node its nearest particle, then stroke the walls where
    // adjacent nodes belong to different cells — the shattered-glass look (§20.6).
    if (cfg.render === 'voronoi') {
      const STEP = 18; // grid resolution (px)
      const SEARCH = STEP * 3; // candidate radius for the nearest-site query
      const cols = Math.ceil(W / STEP) + 1;
      const rows = Math.ceil(H / STEP) + 1;
      if (!vor || vor.length !== cols * rows) vor = new Int32Array(cols * rows);
      // a stable owner id per particle (its index in the pool) so adjacent nodes compare.
      const parts = store.particles;
      const idOf = new Map<(typeof parts)[number], number>();
      for (let i = 0; i < parts.length; i++) idOf.set(parts[i]!, i);
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const nx = gx * STEP;
          const ny = gy * STEP;
          const cands = store.near(nx, ny, SEARCH);
          let owner = -1;
          if (cands.length) {
            const k = nearestSite(nx, ny, cands);
            if (k >= 0) owner = idOf.get(cands[k]!) ?? -1;
          }
          vor[gy * cols + gx] = owner;
        }
      }
      const acc = hexToRgb(cfg.accent);
      ctx!.globalCompositeOperation = 'lighter';
      ctx!.strokeStyle = `rgba(${acc[0]},${acc[1]},${acc[2]},${0.32 * boot})`;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      for (const s of voronoiWalls(vor, cols, rows)) {
        ctx!.moveTo(s.x1 * STEP, s.y1 * STEP);
        ctx!.lineTo(s.x2 * STEP, s.y2 * STEP);
      }
      ctx!.stroke();
      ctx!.globalCompositeOperation = 'source-over';
    }

    // streamlines: draw the force field itself — a grid of arrows along the net push a still test
    // particle would feel (§20.6 diagnostic). 'streamlines' draws them ALONE (showMatter suppressed
    // the dots above); 'flow' draws the SAME arrows additively over the dots already painted — the
    // particles plus the flow they ride, in this one underlay canvas (no second surface, no blend).
    if (cfg.render === 'streamlines' || cfg.render === 'flow') {
      const GRID = 46;
      const acc = hexToRgb(cfg.accent);
      ctx!.lineWidth = 1;
      ctx!.lineCap = 'round';
      // RESAMPLE the field on a cadence, not every frame. The arrows trace the body-induced force
      // field, which only changes when bodies are re-measured (every 6th frame) or a flow focus is
      // live — so a per-frame regrid (≈grid×bodies force evals) was wasted work that surfaced as
      // scroll choppiness. Resample every 3rd frame (or when the cache is empty, or while a flow
      // focus is animating); DRAW from the cache every frame so the arrows never flicker or step.
      if (slSamples === null || flow || frameN % 3 === 0) {
        // Sample the field on the grid, then scale arrows RELATIVE to the strongest sample, so a
        // weak field (a magnetic/electric dipole, magnitudes ~1e-5) reads as clearly as a strong
        // one (an attractor). Absolute scaling drowned the dipole below the visibility cutoff.
        const samples: { gx: number; gy: number; ux: number; uy: number; mag: number }[] = [];
        const quiescent: { gx: number; gy: number }[] = [];
        let frameMax = 0;
        for (let gx = GRID / 2; gx < W; gx += GRID) {
          for (let gy = GRID / 2; gy < H; gy += GRID) {
            let { fx, fy } = forceAt(bodies, reg.forces, env, gx, gy);
            // a live flow focus bends the rendered field lines toward the target (field.flowTo).
            if (flow) {
              const b = flowBias(gx, gy, flow, 0.04);
              fx += b.x;
              fy += b.y;
            }
            const mag = Math.hypot(fx, fy);
            // Skip only true dead zones / NaN (a tiny epsilon, not an absolute magnitude floor) —
            // a weak dipole's outer field is still a real pattern and must survive to be scaled.
            if (!(mag > 1e-9)) {
              quiescent.push({ gx, gy }); // quiescent → a faint dot, drawn from cache below
              continue;
            }
            samples.push({ gx, gy, ux: fx / mag, uy: fy / mag, mag });
            if (mag > frameMax) frameMax = mag;
          }
        }
        // Ease the normalization reference: rise quickly when the field strengthens, decay slowly
        // when it weakens — prevents a single strong frame from spiking the scale, and a single
        // quiet frame from collapsing it. Seed on first frame (slMaxSmoothed === 0).
        if (slMaxSmoothed === 0) slMaxSmoothed = frameMax;
        else slMaxSmoothed = frameMax > slMaxSmoothed
          ? slMaxSmoothed * 0.7 + frameMax * 0.3   // track rises promptly
          : slMaxSmoothed * 0.9 + frameMax * 0.1;  // decay slowly so quiet frames don't flash
        slSamples = samples;
        slQuiescent = quiescent;
      }
      // DRAW from the cache every frame (the canvas is cleared each frame, so quiescent dots and
      // arrows must both be re-laid even on the frames we don't resample).
      if (slQuiescent.length) {
        ctx!.fillStyle = `rgba(${acc[0]},${acc[1]},${acc[2]},0.05)`;
        for (const q of slQuiescent) ctx!.fillRect(q.gx - 0.5, q.gy - 0.5, 1, 1);
      }
      if (slMaxSmoothed > 0 && slSamples) {
        for (const s of slSamples) {
          const rel = Math.sqrt(s.mag / slMaxSmoothed); // sqrt compresses the range so weak vectors still read
          const len = GRID * 0.46 * (0.28 + 0.72 * rel);
          const ex = s.gx + s.ux * len;
          const ey = s.gy + s.uy * len;
          ctx!.strokeStyle = `rgba(${acc[0]},${acc[1]},${acc[2]},${clamp(0.1 + rel * 0.5, 0, 0.72)})`;
          ctx!.beginPath();
          ctx!.moveTo(s.gx, s.gy);
          ctx!.lineTo(ex, ey);
          const ah = 3.4;
          ctx!.moveTo(ex, ey);
          ctx!.lineTo(ex - s.ux * ah - s.uy * ah * 0.6, ey - s.uy * ah + s.ux * ah * 0.6);
          ctx!.moveTo(ex, ey);
          ctx!.lineTo(ex - s.ux * ah + s.uy * ah * 0.6, ey - s.uy * ah - s.ux * ah * 0.6);
          ctx!.stroke();
        }
      }
    }
  }

  // Field Surfaces — the overlay readings. `setOverlay` accepts one reading or an additive stack;
  // the stack is drawn in order onto the one front surface (cleared once per frame), so several
  // quantities — flow, deformation, heat, energy, traced paths, per-body measurements — compose over
  // any underlay matter mode. Every reading is a line/text diagnostic by design: the overlay sits in
  // front of page content and must reveal, never occlude (visualization-methods taxonomy, Surfaces &
  // Placement). All are tinted with the travelling accent, so setAccent recolors the overlay too.

  /** Normalize an OverlayInput to the drawable stack — `'off'` anywhere or an empty list = nothing. */
  function overlayStack(input: OverlayInput | undefined): OverlayMode[] {
    const list = input === undefined ? [] : Array.isArray(input) ? input : [input];
    return list.filter((m): m is Exclude<OverlayMode, 'off'> => m !== 'off');
  }

  // arrows along the sampled felt force field — `streamlines` (sqrt-compressed) and `force-vectors`
  // (absolute magnitude). `field-lines` no longer routes here: it traces the real field-structure
  // curves (drawOverlayFieldLines). The `structure` arm is retained for the backend contract but is
  // unused by the current dispatch (both arrow modes read the felt field).
  function drawOverlayArrows(out: RenderBackend, structure: boolean, absolute: boolean): void {
    const GRID = 44;
    const acc = hexToRgb(cfg.accent);
    const samples: { gx: number; gy: number; ux: number; uy: number; mag: number }[] = [];
    let frameMax = 0;
    for (let gx = GRID / 2; gx < W; gx += GRID) {
      for (let gy = GRID / 2; gy < H; gy += GRID) {
        let { fx, fy } = forceAt(bodies, reg.forces, env, gx, gy);
        if (flow) {
          const b = flowBias(gx, gy, flow, 0.04);
          fx += b.x;
          fy += b.y;
        }
        const mag = Math.hypot(fx, fy);
        if (!(mag > 1e-9)) continue; // skip dead zones / NaN
        samples.push({ gx, gy, ux: fx / mag, uy: fy / mag, mag });
        if (mag > frameMax) frameMax = mag;
      }
    }
    // Same EMA approach as the underlay streamlines (see slMaxSmoothed) — independent state so
    // the overlay scale never couples to the underlay's field strength.
    if (olMaxSmoothed === 0) olMaxSmoothed = frameMax;
    else olMaxSmoothed = frameMax > olMaxSmoothed
      ? olMaxSmoothed * 0.7 + frameMax * 0.3   // track rises promptly
      : olMaxSmoothed * 0.9 + frameMax * 0.1;  // decay slowly so quiet frames don't flash
    if (olMaxSmoothed <= 0) return;
    // one backend call per arrow: shaft + two head strokes packed as three segments. Alpha varies
    // per arrow (it encodes magnitude), so arrows can't share one batch without quantizing — the
    // call count matches the previous per-arrow beginPath/stroke exactly.
    const stroke: Stroke = { r: acc[0]!, g: acc[1]!, b: acc[2]!, alpha: 0, width: 1.2 };
    const seg = new Float64Array(12);
    for (const s of samples) {
      const rel = absolute ? clamp(s.mag / olMaxSmoothed, 0, 1) : Math.sqrt(s.mag / olMaxSmoothed);
      const len = GRID * 0.5 * (0.25 + 0.75 * rel);
      const ex = s.gx + s.ux * len;
      const ey = s.gy + s.uy * len;
      const ah = 3.6;
      seg[0] = s.gx; seg[1] = s.gy; seg[2] = ex; seg[3] = ey;
      seg[4] = ex; seg[5] = ey; seg[6] = ex - s.ux * ah - s.uy * ah * 0.6; seg[7] = ey - s.uy * ah + s.ux * ah * 0.6;
      seg[8] = ex; seg[9] = ey; seg[10] = ex - s.ux * ah + s.uy * ah * 0.6; seg[11] = ey - s.uy * ah - s.ux * ah * 0.6;
      stroke.alpha = clamp(0.12 + rel * 0.55, 0, 0.8);
      out.segments(seg, stroke);
    }
  }

  // `field-lines` — the field STRUCTURE traced as real curves. Each field-bearing body is seeded
  // by its own geometry (a dipole's perpendicular bisector for a magnet, a core ring for a
  // monopole charge/gravity well; fieldline-seeds.ts), then `traceFieldLines` follows the NET
  // field through every seed — so the bar-magnet loops, the radial spokes, and the linkage
  // between two bodies all emerge from the math, never drawn by hand. Bodies that radiate nothing
  // (attract/sink/…) get no seeds, so the diagram stays the real structure, not a starburst.
  function drawOverlayFieldLines(out: RenderBackend): void {
    const seeds = fieldLineSeeds(bodies);
    if (!seeds.length) return;
    const lines = traceFieldLines((x, y) => netField(bodies, reg.forces, x, y), seeds, {
      step: 6,
      maxSteps: 200,
      bounds: { w: W, h: H },
      loopDist: 8,
    });
    const acc = hexToRgb(cfg.accent);
    // one polyline per traced curve through the backend seam (#373) — same shared stroke style.
    const stroke: Stroke = { r: acc[0]!, g: acc[1]!, b: acc[2]!, alpha: 0.42, width: 1.1 };
    for (const line of lines) {
      if (line.length < 2) continue;
      const pts = new Float32Array(line.length * 2);
      for (let i = 0; i < line.length; i++) {
        pts[i * 2] = line[i]!.x;
        pts[i * 2 + 1] = line[i]!.y;
      }
      out.polyline(pts, stroke);
    }
  }

  // `grid` — a reference lattice whose vertices are displaced along the felt field; the page's
  // space itself made visible, bending where the field is strong. Reads deformation.
  function drawOverlayGrid(out: RenderBackend): void {
    const STEP = 56;
    const MAXD = 11; // px displacement at the strongest sample — legible, never chaotic
    const cols = Math.floor(W / STEP) + 2;
    const rows = Math.floor(H / STEP) + 2;
    const dx = new Float32Array(cols * rows);
    const dy = new Float32Array(cols * rows);
    let maxMag = 0;
    const mags = new Float32Array(cols * rows);
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const { fx, fy } = forceAt(bodies, reg.forces, env, gx * STEP, gy * STEP);
        const mag = Math.hypot(fx, fy);
        const i = gy * cols + gx;
        if (mag > 1e-9) {
          dx[i] = fx / mag;
          dy[i] = fy / mag;
          mags[i] = mag;
          if (mag > maxMag) maxMag = mag;
        }
      }
    }
    const acc = hexToRgb(cfg.accent);
    const stroke: Stroke = { r: acc[0]!, g: acc[1]!, b: acc[2]!, alpha: 0.16, width: 1 };
    const px = (gx: number, gy: number): [number, number] => {
      const i = gy * cols + gx;
      const rel = maxMag > 0 ? Math.sqrt(mags[i]! / maxMag) : 0;
      return [gx * STEP + dx[i]! * rel * MAXD, gy * STEP + dy[i]! * rel * MAXD];
    };
    const row: number[] = [];
    for (let gy = 0; gy < rows; gy++) {
      row.length = 0;
      for (let gx = 0; gx < cols; gx++) row.push(...px(gx, gy));
      out.polyline(row, stroke);
    }
    for (let gx = 0; gx < cols; gx++) {
      row.length = 0;
      for (let gy = 0; gy < rows; gy++) row.push(...px(gx, gy));
      out.polyline(row, stroke);
    }
  }

  // shared scalar-contour pass for `temperature` and `energy` — splat a per-particle scalar onto a
  // coarse grid, then trace marching-squares iso-lines at fractions of the frame's max. Contours,
  // not washes: the overlay must never paint area over content.
  let oscalar: Float32Array | null = null;
  function drawOverlayContours(out: RenderBackend, weigh: (p: Particle) => number, alphaBase: number): void {
    const STEP = 24;
    const RAD = 42;
    const cols = Math.ceil(W / STEP) + 1;
    const rows = Math.ceil(H / STEP) + 1;
    if (!oscalar || oscalar.length !== cols * rows) oscalar = new Float32Array(cols * rows);
    else oscalar.fill(0);
    let any = false;
    for (const p of store.particles) {
      if (p.cap) continue;
      const w = weigh(p);
      if (w <= 0) continue;
      any = true;
      splatDensity(oscalar, cols, rows, STEP, p.x, p.y, RAD, w);
    }
    if (!any) return;
    let max = 0;
    for (let i = 0; i < oscalar.length; i++) if (oscalar[i]! > max) max = oscalar[i]!;
    if (max <= 0) return;
    const acc = hexToRgb(cfg.accent);
    const LEVELS = [0.25, 0.5, 0.78]; // nested iso-rings: faint outer shell → bright core
    const packed: number[] = [];
    for (let li = 0; li < LEVELS.length; li++) {
      const level = LEVELS[li]! * max;
      packed.length = 0;
      for (let gy = 0; gy < rows - 1; gy++) {
        for (let gx = 0; gx < cols - 1; gx++) {
          const tl = oscalar[gy * cols + gx]!;
          const tr = oscalar[gy * cols + gx + 1]!;
          const br = oscalar[(gy + 1) * cols + gx + 1]!;
          const bl = oscalar[(gy + 1) * cols + gx]!;
          const segs = marchingCell(tl, tr, br, bl, level);
          if (!segs.length) continue;
          const ox = gx * STEP;
          const oy = gy * STEP;
          for (const sg of segs) packed.push(ox + sg.x1 * STEP, oy + sg.y1 * STEP, ox + sg.x2 * STEP, oy + sg.y2 * STEP);
        }
      }
      if (packed.length)
        out.segments(packed, {
          r: acc[0]!,
          g: acc[1]!,
          b: acc[2]!,
          alpha: alphaBase * (0.45 + 0.55 * (li / (LEVELS.length - 1))),
          width: 1 + li * 0.3,
        });
    }
  }

  // `path` — true streamlines: from a coarse lattice of seeds, integrate the felt field direction
  // step by step and draw each traced curve, fading toward the tail. Where `streamlines` shows the
  // instantaneous push per cell, `path` shows where that push CARRIES a probe over distance.
  function drawOverlayPaths(out: RenderBackend): void {
    const SEED = 104; // seed lattice spacing (px)
    const STEPPX = 9; // integration step (px)
    const STEPS = 24; // max steps per path
    const acc = hexToRgb(cfg.accent);
    const stroke: Stroke = { r: acc[0]!, g: acc[1]!, b: acc[2]!, alpha: 0, width: 1.1 };
    const seg = new Float64Array(4);
    for (let sx = SEED / 2; sx < W; sx += SEED) {
      for (let sy = SEED / 2; sy < H; sy += SEED) {
        let x = sx;
        let y = sy;
        for (let i = 0; i < STEPS; i++) {
          let { fx, fy } = forceAt(bodies, reg.forces, env, x, y);
          if (flow) {
            const b = flowBias(x, y, flow, 0.04);
            fx += b.x;
            fy += b.y;
          }
          const mag = Math.hypot(fx, fy);
          if (!(mag > 1e-9)) break; // dead zone — the path ends
          const nx = x + (fx / mag) * STEPPX;
          const ny = y + (fy / mag) * STEPPX;
          if (nx < 0 || ny < 0 || nx > W || ny > H) break;
          // per-step segment: the alpha fades toward the tail, so each step is its own stroke
          seg[0] = x; seg[1] = y; seg[2] = nx; seg[3] = ny;
          stroke.alpha = 0.34 * (1 - i / STEPS);
          out.segments(seg, stroke);
          x = nx;
          y = ny;
        }
      }
    }
  }

  // `data` — the measurement made legible: each measuring body's eased local density d ∈ [0,1]
  // (§8, the same number the platform mirrors to `--d`) printed beside the body. Feedback bodies
  // lead (they asked to be measured); non-feedback bodies are skipped — no reading, no chip.
  function drawOverlayData(out: RenderBackend): void {
    const acc = hexToRgb(cfg.accent);
    for (const b of bodies) {
      if (!b.vis || !b.feedback) continue;
      const label = `d ${b.d.toFixed(2)}`;
      const tx = b.cx + b.hw + 8;
      const ty = b.cy;
      out.rect(tx - 3, ty - 7, out.measureText(label) + 6, 14, acc[0]!, acc[1]!, acc[2]!, clamp(0.3 + b.d * 0.55, 0, 0.85));
      out.text(label, tx, ty + 0.5, 5, 6, 11, 0.92);
    }
  }

  function renderOverlay(out: RenderBackend, stack: readonly OverlayMode[]): void {
    out.clear();
    if (!stack.length || W === 0 || H === 0) return;
    for (const mode of stack) {
      if (mode === 'streamlines') drawOverlayArrows(out, false, false);
      else if (mode === 'force-vectors') drawOverlayArrows(out, false, true);
      else if (mode === 'field-lines') drawOverlayFieldLines(out);
      else if (mode === 'grid') drawOverlayGrid(out);
      else if (mode === 'temperature') drawOverlayContours(out, (p) => p.heat, 0.5);
      else if (mode === 'energy') drawOverlayContours(out, (p) => 0.5 * p.m * (p.vx * p.vx + p.vy * p.vy), 0.42);
      else if (mode === 'path') drawOverlayPaths(out);
      else if (mode === 'data') drawOverlayData(out);
    }
  }

  function frame(now: number): void {
    frameN++;
    env.t = (now - t0) / 1000;
    env.frameN = frameN;
    // Frame-rate-independent timestep (#434): dt is the real frame interval normalized to a
    // 60fps baseline (≈1 at 60fps, ≈0.5 at 120fps, ≈2 at 30fps), clamped so a long stall
    // (tab switch, GC pause) can't teleport matter. Previously dt was a flat 1 regardless of
    // FPS, so when the perf work lifted the homepage to 60–120fps the same per-frame physics
    // ran 2–4× faster on screen. Position alone is dt-scaled (forces/friction are per-frame by
    // design, §applyForce) — that's enough to make displacement-per-second FPS-independent.
    // Still 0 under reduce-motion: the integrator and the `if (env.dt)` gates read it as the
    // "is the field animating" flag, so it must stay falsy when still and >0 when moving.
    const dtRaw = Number.isFinite(lastNow) ? (now - lastNow) / 16.6667 : 1;
    lastNow = now;
    env.dt = reduceMotion ? 0 : clamp(dtRaw, 0.2, 2);
    if (boot < 1) boot = Math.min(1, boot + 0.012);
    easeFormation(env.form, formTarget, 0.03); // glide between formations (§7)

    const scrollY = host.scrollY();
    // eased page-scroll speed for the `scrolling` data-when gate (§5).
    env.scrollV = (env.scrollV ?? 0) * 0.7 + Math.abs(scrollY - lastScrollY) * 0.3;
    lastScrollY = scrollY;
    for (const w of waves) {
      const target = scrollY * (0.025 + w.depth * 0.08); // wave parallax (§24)
      w.offsetY += (target - w.offsetY) * 0.04;
    }
    if (bodies.length && frameN % 6 === 0) {
      measureBodies(bodies, W, H);
      // attention-gated discharge (#365): an engagement-gated sink releases on the falling
      // edge of engagement — the same conserved supernova ritual as saturation.
      dischargeDisengaged(bodies, env.supernova);
    }

    // spine: ease the wave-bend toward the flow focus (if set) or the engaged element (§24). A live
    // flow focus (field.flowTo) takes priority, so the streamline spine curves to the moving target.
    let engaged: Body | null = null;
    for (const b of bodies) {
      if (b.on && b.vis) {
        engaged = b;
        break;
      }
    }
    const spineTo = flow ?? engaged;
    pull.k += ((spineTo ? 1 : 0) - pull.k) * 0.07;
    if (spineTo) {
      const tx = flow ? flow.x : (engaged as Body).cx;
      const ty = flow ? flow.y : (engaged as Body).cy;
      pull.x = pull.x ? pull.x + (tx - pull.x) * 0.16 : tx;
      pull.y = pull.y ? pull.y + (ty - pull.y) * 0.16 : ty;
    }

    // accent journey (§9): scroll travels the palette; a hovered element overrides.
    // maxScroll is cached (scrollHeight forces a reflow); resample it twice a second.
    if (frameN % 30 === 0) maxScroll = host.scrollHeight() - H || 1;
    const targetAcc = hoverAccent ? hexToRgb(hoverAccent) : sampleStops(JOURNEY, scrollY / maxScroll);
    curAccent = [
      curAccent[0] + (targetAcc[0] - curAccent[0]) * 0.08,
      curAccent[1] + (targetAcc[1] - curAccent[1]) * 0.08,
      curAccent[2] + (targetAcc[2] - curAccent[2]) * 0.08,
    ];
    cfg.accent = rgbToHex(curAccent);

    store.reindex();
    applyAttention();
    if (env.dt) induceCharges(bodies, store.particles); // polarize neutral matter near charge/magnetism bodies (§20.10)
    // flow focus (field.flowTo): nudge free matter toward the moving target before integration, so
    // it visibly streams in. The streamline render bends toward it too (see drawField).
    if (flow && env.dt) {
      for (const p of store.particles) {
        if (p.cap) continue;
        const b = flowBias(p.x, p.y, flow, 0.6);
        p.vx += b.x;
        p.vy += b.y;
      }
    }
    updateWarpTargets(); // refresh warp relocate targets from paired bodies (§22.3) before the step
    step({ store, bodies, env, forces: reg.forces, conditions: reg.conditions, waves });
    // hover-focus (field.focusAt): hold the focused particle still and light it up — the dwell
    // affordance ("it stops and does something") before a click opens its record.
    if (focusP) {
      focusP.x = focusX;
      focusP.y = focusY;
      focusP.vx = 0;
      focusP.vy = 0;
      focusP.heat = Math.min(1, focusP.heat + 0.2);
    }
    if (env.dt) {
      for (const g of grids.values()) g.step(); // advance field buffers (§20.1 [C])
      if (heatmap) heatmap.update(store.particles); // density heatmap buffer (H1)
      healWaves(store, bound, boundTarget, waves, W, H, env.t, rng);
      tearBoundByForces(bound, waves, bodies, reg.forces, W, H, env.t, (p) => void store.add(newParticle(p)));
      updateMovers();
      updateEmitters(); // element emit (§22.3): clone decorative templates, budgeted by data-max
    }
    writeFeedback();
    applyCausality();
    updateEvents();
    updateCaptureEvents();
    // Draw only when there is a surface to draw to AND the canvas can be seen. Under the
    // signals-only mode (`render: 'none'`, §13.7 / #297) the engine never draws — neither the
    // underlay nor the overlay — and `ctx` may not even exist. Under reduced motion the scene is
    // static (dt = 0), so a quarter-rate redraw is visually identical at a quarter of the cost.
    if (ctx && cfg.render !== 'none' && canvasVisible && (!reduceMotion || frameN % 4 === 0)) {
      render();
      if (overlayBackend) {
        const stack = overlayStack(cfg.overlay);
        if (stack.length) renderOverlay(overlayBackend, stack);
      }
    }
    raf = host.raf(frame);
  }

  function setFormation(name: string): void {
    const f = FORMATION_BY[name as FormationId];
    if (f) formTarget = { ...f.preset };
  }

  // conductor (§7.1): as a section crosses mid-viewport, ease to its formation
  // (declare with `data-formation="wells"`); after ~6 s of no input, drift back
  // to calm `ambient`. Inert on pages with no `[data-formation]` sections.
  let activeForm = '';
  let lastInput = t0;
  function onScroll(): void {
    const mid = host.viewport().height * 0.5;
    let next = '';
    host.root.querySelectorAll('[data-formation]').forEach((node) => {
      const r = (node as HTMLElement).getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) next = (node as HTMLElement).dataset.formation ?? '';
    });
    if (next && next !== activeForm) {
      activeForm = next;
      setFormation(next);
    }
  }
  const markInput = (): void => void (lastInput = wallNow());
  const scrollHandler = (): void => {
    markInput();
    onScroll();
  };
  const idleTimer = setInterval(() => {
    if (wallNow() - lastInput > 6000 && activeForm !== 'ambient') {
      activeForm = 'ambient';
      setFormation('ambient');
    }
  }, 1200);

  const onResize = (): void => resize();
  resize();
  // pause all work while the tab is backgrounded — stop the loop and the idle timer,
  // resume cleanly when it returns (browsers throttle rAF in the background, but this
  // guarantees zero work and avoids drift on return).
  const onVisibility = (): void => {
    if (host.hidden()) {
      host.cancelRaf(raf);
      raf = 0;
    } else if (!raf) {
      raf = host.raf(frame);
    }
  };
  teardowns.push(host.onResize(onResize));
  teardowns.push(host.onScroll(scrollHandler));
  teardowns.push(host.onVisibility(onVisibility));
  teardowns.push(host.onInput(markInput));
  // shadow-DOM body events: forces:* + field:* aliases share the same idempotent handlers, so a body
  // registers under either namespace; the controller dispatches both, the engine listens to both.
  teardowns.push(host.onBodyEvent(REGISTER_BODY, onRegister as (e: Event) => void));
  teardowns.push(host.onBodyEvent(UNREGISTER_BODY, onUnregister as (e: Event) => void));
  teardowns.push(host.onBodyEvent(UPDATE_BODY, onUpdateBody as (e: Event) => void));
  onScroll();
  raf = host.raf(frame);

  return {
    scan,
    rescan: scan,
    setAccent: (hex) => {
      cfg.accent = hex;
      curAccent = hexToRgb(hex);
    },
    setPalette: (p) => {
      // swap the travelling-accent stops (§9) and snap the accent to the first.
      const stops = resolvePalette(p);
      JOURNEY = stops.map(hexToRgb);
      const first = stops[0];
      if (first) {
        cfg.accent = first;
        curAccent = hexToRgb(first);
      }
    },
    setFormation,
    setAttention: (on) => {
      cfg.attention = on;
      if (!on) for (const b of bodies) b.attn = 1; // release the budget → neutral
    },
    setCausality: (on) => {
      cfg.causality = on;
      if (!on)
        for (const b of bodies) {
          b.el.style.removeProperty('--lit');
          b.el.dataset.fxLit = '0';
        }
    },
    setRender: (mode) => {
      // Signals-only mode (§13.7 / #297). Switching FROM 'none' on a field created with
      // `render: 'none'` acquires the 2d context lazily and sizes the backing store NOW — the
      // first and only allocation. Switching TO 'none' at runtime just stops drawing from the
      // next frame: an already-acquired context and backing store are kept (the no-allocation
      // guarantee belongs to fields created with 'none'), and the last drawn frame stays on the
      // canvas — hide or clear it with CSS if it is on screen, exactly as with setVisible(false).
      if (mode !== 'none' && !ctx) {
        ctx = canvas.getContext('2d');
        if (!ctx) {
          // context acquisition can genuinely fail (lost GPU process, too many contexts) —
          // warn and stay signals-only rather than crash the live simulation.
          console.warn(`Fundamental: setRender('${mode}') could not acquire a 2d context; staying in render 'none'`);
          return;
        }
        if (overlayCanvas && !overlayCtx) {
          overlayCtx = overlayCanvas.getContext('2d');
          if (overlayCtx && !overlayBackend) overlayBackend = opts.overlayBackend ?? canvas2dBackend(overlayCanvas, overlayCtx);
        }
        sizeSurfaces(host.viewport().dpr); // the one deferred resize the lazy path needs
      }
      cfg.render = mode;
    },
    setOverlay: (mode) => {
      cfg.overlay = mode;
      if (!overlayStack(mode).length) overlayBackend?.clear(); // empty stack → clear the front surface
    },
    setHeatmap: (on) => {
      cfg.heatmap = on;
      if (on) {
        // Re-enabling always starts with a fresh buffer so mid-accumulation state from a prior
        // active period (or a paused field frozen mid-frame) never bleeds into the new session.
        if (!heatmap && W > 0) heatmap = new Heatmap(W, H);
      } else if (heatmap) {
        // Clear accumulated data before releasing the buffer — a paused field can hold a
        // non-zero grid that would persist visually if the buffer were recycled. Explicit clear
        // makes the exit symmetrical with the fresh-start re-enable above.
        heatmap.clear();
        heatmap = null;
        for (const b of bodies) {
          const el = b.writeTarget ?? b.el;
          el.style.removeProperty('--field-heatmap-density');
        }
      }
    },
    threads: setThreads,
    burst: (x, y, hex) => {
      // discrete one-shot: shove + heat nearby matter, optionally tint it (§11).
      const R = 160;
      for (const q of store.particles) {
        // the blast point sits on the page plane (z = 0): matter off-plane is shoved
        // deeper as well as outward — the 3D leg is 0 in a flat field (z-axis.md).
        const imp = burstImpulse(q.x - x, q.y - y, R, 6, q.z ?? 0);
        if (imp.heat === 0) continue;
        q.vx += imp.vx;
        q.vy += imp.vy;
        if (imp.vz) q.vz = (q.vz ?? 0) + imp.vz;
        q.heat = Math.max(q.heat, imp.heat);
        if (hex) q.color = hex; // carried pigment (§20.8)
      }
      // detach nearby bound matter so the shock is actually felt (§2.4, like supernova)
      tearBoundNear(bound, waves, x, y, R, W, H, env.t, (p) => void store.add(newParticle(p)));
      spawnSpark(x, y, 2, hex); // a visible pop at the blast point (§23)
    },
    flowTo: (x: number, y: number, opts?: FlowOptions) => {
      // place/move the flow focus; the frame loop eases the spine + pulls matter toward it, and the
      // streamline render bends to it. Called repeatedly (e.g. on pointermove) for dynamic targeting.
      flow = makeFlowFocus(x, y, opts);
    },
    clearFlow: () => {
      flow = null;
    },
    seed: (atoms) => {
      seeded = atoms;
      build(); // respawn fresh, then re-bind + re-scale (no compounding)
    },
    atomAt: (x, y) => {
      let best: AtomPayload | null = null;
      let bd = Infinity;
      // the pointer lives on the page plane: depth counts against pickability, so a
      // dot deep in the volume is harder to pick than one at the surface (z-axis.md).
      for (const p of store.near(x, y, 24)) {
        if (p.atom == null) continue;
        const d = (p.x - x) ** 2 + (p.y - y) ** 2 + (p.z ?? 0) ** 2;
        if (d < bd) {
          bd = d;
          best = p.atom;
        }
      }
      return best;
    },
    focusAt: (x, y) => {
      let best: Particle | null = null;
      let bd = Infinity;
      for (const p of store.near(x, y, 24)) {
        if (p.atom == null) continue;
        const d = (p.x - x) ** 2 + (p.y - y) ** 2 + (p.z ?? 0) ** 2;
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      focusP = best;
      if (best) {
        focusX = best.x;
        focusY = best.y;
        return best.atom ?? null;
      }
      return null;
    },
    clearFocus: () => {
      focusP = null;
    },
    particleCount: () => store.size,
    readParticles: (out) => {
      const ps = store.particles;
      const capN = Math.floor(out.length / 5); // stride 5
      let w = 0;
      for (let i = 0; i < ps.length && w < capN; i++) {
        const p = ps[i]!;
        if (p.report !== undefined) continue; // agents draw as their own object, not a swarm dot
        const o = w * 5;
        out[o] = p.x;
        out[o + 1] = p.y;
        out[o + 2] = p.z ?? 0; // optional z lane (z-axis.md); 0 in a flat field
        out[o + 3] = p.heat;
        out[o + 4] = p.size;
        w++;
      }
      return w;
    },
    addAgent: (spec) => {
      const p = newParticle({ x: spec.x, y: spec.y, z: spec.z, species: spec.species });
      p.vx = 0;
      p.vy = 0;
      if (spec.z === undefined && cfg.depth <= 0) p.z = 0;
      if (spec.mass !== undefined) p.m = spec.mass;
      p.maxSpeed = spec.maxSpeed;
      p.report = spec.report;
      store.add(p);
      return { particle: p, remove: () => store.remove(p) };
    },
    energy: () => energyReport(store.particles),
    sample: (x, y) => {
      const { fx, fy } = forceAt(bodies, reg.forces, env, x, y);
      return { x: fx, y: fy };
    },
    scrollV: () => env.scrollV ?? 0,
    setVisible: (on) => {
      canvasVisible = on;
    },
    setBackground: (mode) => {
      cfg.background = mode;
      // a one-time clear on the way INTO transparent wipes the last opaque substrate frame, so
      // the surface goes clear immediately rather than holding the old near-black until redrawn.
      if (mode === 'transparent' && ctx) ctx.clearRect(0, 0, W, H);
    },
    destroy: () => {
      host.cancelRaf(raf);
      clearInterval(idleTimer);
      for (const off of teardowns) off(); // release every host event subscription
      // release the per-element [data-hot] engagement listeners, so repeated create/destroy
      // on the same DOM doesn't accumulate handlers (§18 teardown).
      for (const e of engaged) {
        e.el.removeEventListener('pointerenter', e.enter);
        e.el.removeEventListener('pointerleave', e.leave);
        e.el.removeEventListener('focus', e.enter);
        e.el.removeEventListener('blur', e.leave);
        delete e.el.dataset.fxEngaged;
      }
      engaged = [];
      // restore any docked elements so teardown never leaves content collapsed / aria-hidden / inert.
      for (const mv of movers) {
        if (mv.docked || mv.dock.dock > 0) {
          mv.docked = null;
          mv.dock.dock = 0;
          mv.el.style.opacity = '';
          if (mv.el.getAttribute('aria-hidden') === 'true') mv.el.removeAttribute('aria-hidden');
          mv.el.removeAttribute('inert');
        }
      }
      // remove any DOM nodes emitted by element-emit bodies (§22.3), so teardown leaves no clones.
      for (const em of emitters) for (const clone of em.emitted) clone.remove();
      emitters = [];
      store.clear();
    },
  };
}
