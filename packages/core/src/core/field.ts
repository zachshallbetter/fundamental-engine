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

import type { AtomPayload, Body, BodyHandle, Env, FeedbackChannels, FieldHandle, FieldOptions, Formation, OverlayInput, OverlayMode, Particle } from './types.ts';
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
  waveRAt,
  type Wave,
  type BoundParticle,
  type WavePull,
} from './currents.ts';
import { healWaves, tearBoundNear, tearBoundByForces, induceCharges } from './reservoir.ts';
import { FORMATION_BY, PALETTE, type FormationId } from '../config/forces.config.ts';
import { resolvePalette } from '../config/palettes.ts';
import { THEMES, DEFAULT_THEME } from '../config/themes.ts';
import { clamp, hexToRgb, particleRGBInto, rgbToHex, sampleStops, type RGB } from './math.ts';
import { feedbackTarget, feedbackWeight } from './feedback.ts';
import { defaultFeedbackSink } from './feedback-sink.ts';
import { thermoMetrics } from './thermo.ts';
import { attentionMuls } from './attention.ts';
import { updateRelationship, type RelationshipAgent } from '../agents/relationship.ts';
import { Thresholder } from '../agents/event-agent.ts';
import { spillover } from './causality.ts';
import { integrateOffset, anchorForce, elementMass, repelForce, densityPush, type ElementOffset } from './agents.ts';
import { releaseCaptured, sinkLoad, captureEdge, dischargeDisengaged } from './accretion.ts';
import { withinCapture, stepDock, dockTransform, type DockState } from './dock.ts';
import { FieldEventCoalescer, parseEventBindings, triggerActive, type EventBinding, type FieldEventMap, type FieldEventType } from './events.ts';
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
import { flowBiasInto, makeFlowFocus, type FlowFocus, type FlowOptions } from './flow.ts';
import type { FieldHost } from './host.ts';
import { devWarnNoOp } from '../contracts/guards.ts';
import { FIELD_VERSION } from '../version.ts';
import { energyReport } from '../diagnostics/energy.ts';

// Shared draw/integrate scratch — reused across the per-particle and per-cell hot loops so an
// active flow focus and the particle draw don't allocate a `{x,y}` / `[r,g,b]` each iteration.
// Safe to share module-wide: each field's frame runs synchronously, and every read consumes the
// scratch before the next write (no overlapping lifetimes, no cross-instance interleaving).
const _flowB = { x: 0, y: 0 };
const _rgb: RGB = [0, 0, 0];

export function createField(canvas: HTMLCanvasElement, opts: FieldOptions = {}): FieldHandle {
  // Signals-only mode (`render: 'none'`, §13.7 / #297): the full simulation + feedback pipeline
  // runs, but the engine never acquires a 2d context, never sizes a canvas backing store (it stays
  // 0×0 — the allocation win), and never draws. The field exists purely as signals: `--d`, `--load`,
  // `--lit`, capture events, `scrollV()`. `ctx` stays null until `setRender` to a drawing mode
  // acquires it lazily (and sizes the store then) — so a field created with 'none' allocates no
  // render surface at all unless asked to draw.
  let ctx: CanvasRenderingContext2D | null = null;
  if ((opts.render ?? 'none') !== 'none') {
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
  let nextParticleId = 1; // monotonic stable particle identity (readParticleIds); never reused
  const grids = new Map<string, ScalarGridImpl>(); // §20.1 class [C] field buffers, lazy
  const reg = createRegistry();

  // host-agnostic discrete event bus (the read side): plain-data push for occurrences a non-DOM
  // host reacts to (a sink caught/released matter, the swarm settled) — no DOM, no polling. Cheap
  // when unused: detection passes guard on `busHas(type)` so zero listeners cost nothing.
  const busListeners = new Map<FieldEventType, Set<(e: never) => void>>();
  const busHas = (type: FieldEventType): boolean => (busListeners.get(type)?.size ?? 0) > 0;
  function busDeliver<K extends FieldEventType>(type: K, payload: FieldEventMap[K]): void {
    const set = busListeners.get(type);
    if (set) for (const cb of set) (cb as (e: FieldEventMap[K]) => void)(payload);
  }
  // Per-frame coalescing (#684, shadow-dom §31): a force/condition can cross the same edge more than
  // once within a single frame (multiple detection passes, a same-frame fill+release), which would
  // otherwise fire the bus repeatedly per tick. busEmit buffers occurrences during the frame; the
  // single flushBusEvents() at frame end delivers at most ONE event per (source, type) — last write
  // wins. Behaviour-preserving for listeners that just react to "it happened"; it removes intra-frame
  // duplicates only. detectProximityEvents/updateCaptureEvents already dedupe per *state transition*;
  // this layer additionally guarantees one delivery per frame regardless of how many passes ran.
  const busCoalescer = new FieldEventCoalescer();
  function busEmit<K extends FieldEventType>(type: K, payload: FieldEventMap[K]): void {
    if (!busHas(type)) return; // no listeners → don't even buffer
    busCoalescer.record(type, payload);
  }
  // Flush the frame's coalesced bus events to listeners — called once at the end of each frame.
  function flushBusEvents(): void {
    busCoalescer.flush(busDeliver);
  }
  const sinkPeak = new WeakMap<Body, number>(); // matter held at the rising edge, for the release count
  // #441 body-proximity events. Object-identity membership (survives rescan; removed bodies pruned).
  const insideOf = new Map<Body, Set<Body>>(); // enter/exit: bodies currently within a body's range
  const metWith = new Map<Body, Set<Body>>(); // met: bodies currently in box-contact (symmetric, deduped a<b)
  function detectProximityEvents(bs: Body[]): void {
    const wantEE = busHas('enter') || busHas('exit');
    const wantMet = busHas('met');
    if (!wantEE && !wantMet) return; // lazy: zero listeners → zero cost
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i]!;
      if (wantEE) {
        let inside = insideOf.get(a);
        if (!inside) insideOf.set(a, (inside = new Set()));
        const r2 = a.range * a.range;
        for (let j = 0; j < bs.length; j++) {
          if (i === j) continue;
          const o = bs[j]!;
          const dx = o.cx - a.cx, dy = o.cy - a.cy;
          const isIn = dx * dx + dy * dy < r2;
          if (isIn && !inside.has(o)) { inside.add(o); if (busHas('enter')) busEmit('enter', { body: a, other: o }); }
          else if (!isIn && inside.has(o)) { inside.delete(o); if (busHas('exit')) busEmit('exit', { body: a, other: o }); }
        }
      }
      if (wantMet) {
        let met = metWith.get(a);
        if (!met) metWith.set(a, (met = new Set()));
        for (let j = i + 1; j < bs.length; j++) {
          const b = bs[j]!;
          const touch = Math.abs(b.cx - a.cx) < a.hw + b.hw && Math.abs(b.cy - a.cy) < a.hh + b.hh;
          if (touch && !met.has(b)) { met.add(b); busEmit('met', { a, b }); }
          else if (!touch && met.has(b)) met.delete(b);
        }
      }
    }
    // prune tracking for bodies no longer present (rescan removed them) so they neither leak nor re-fire
    const present = new Set(bs);
    for (const m of [insideOf, metWith]) for (const k of m.keys()) if (!present.has(k)) m.delete(k);
  }
  const programmaticBodies: Body[] = []; // bodies added via addBody(); merged into `bodies` each scan
  // programmatic edges (addEdge): relationships between two addBody bodies, with no DOM. Each carries a
  // pure RelationshipAgent stepped every frame (strengthen-with-use / decay / memory). handleToBody lets
  // addEdge resolve the two bodies from the handles addBody returned.
  const handleToBody = new WeakMap<BodyHandle, Body>();
  interface ProgEdge { agent: RelationshipAgent; from: Body; to: Body; fromData: unknown; toData: unknown }
  const programmaticEdges: ProgEdge[] = [];
  let edgeSeq = 0;
  // Reserved agent-threshold events (§22.5, FIELD_EVENTS): per-body hysteretic edge detectors that
  // turn a continuous metric (sink load, density, attention, entropy) into one debounced `field:*`
  // CustomEvent on its rising edge — never per-frame. Lazy: a body gets a Thresholder for a metric
  // only the first frame it has a value to test, and the maps are pruned on rescan with the body.
  // Keyed body → metric-name → Thresholder; edges track relationship `memory` the same way.
  const bodyThresholds = new WeakMap<Body, Map<string, Thresholder>>();
  const edgeThresholds = new WeakMap<RelationshipAgent, Map<string, Thresholder>>();
  const fieldChannels = new Map<string, (x: number, y: number) => number>(); // addField() input channels
  // custom overlay functions registered via registerOverlay(); keyed by name, dispatched from renderOverlay()
  const customOverlays = new Map<string, (backend: RenderBackend, env: Env, W: number, H: number) => void>();
  // All 36 forces are registered on every field — there is no opt-in. Any of them activates per-body
  // through its `data-body` token (e.g. `data-body="lens crystallize"`); an unused force costs nothing.
  registerCoreForces(reg); // the canonical nine (§6)
  registerNaturalForces(reg); // 8 natural primitives: gravity, charge, magnetism, thermal, … (§20.10)
  registerExtendedForces(reg); // 19 designed extended forces: lens, crystallize, link, morph, … (§20.3)
  // the environment seam: all DOM access goes through this injected host — core imports zero DOM.
  // In the browser, pass `browserHost()` from @fundamental-engine/dom (or use createBrowserField); the
  // @fundamental-engine/{elements,react,vanilla} entry points wire it for you.
  if (!opts.host) {
    throw new Error(
      'Fundamental: createField requires opts.host. Use @fundamental-engine/vanilla (createField/mountField) or ' +
        '@fundamental-engine/elements / @fundamental-engine/react, or pass browserHost() from @fundamental-engine/dom.',
    );
  }
  const host: FieldHost = opts.host;
  const teardowns: Array<() => void> = []; // host event unsubscribers, called on destroy
  const reduceMotion = host.reducedMotion();

  // ambient theme (#529): a named preset for the heat ramp + wave baseline; `warm` (default) reproduces
  // the shipped palette. Individual lanes (gradientCool/gradientWarm/waveBaseline) override the preset.
  const theme = THEMES[opts.theme ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME]!;

  const cfg = {
    accent: opts.accent ?? resolvePalette(opts.palette)[0] ?? PALETTE[0] ?? '#4da3ff',
    density: opts.density && opts.density > 0 ? opts.density : 1,
    render: opts.render ?? 'none', // signals-first default (#538): a bare field runs the sim + feedback but draws nothing until asked. Pass render:'dots' for the particle surface.
    waves: opts.waves ?? true, // draw the background Currents (§24); opt-out for the bare field
    waveStyle: opts.waveStyle ?? 'linear',
    waveCenter: opts.waveCenter ?? null,
    background: opts.background ?? 'opaque', // 'transparent' → clear to transparent, underlay over light content
    mass: opts.mass ?? false, // first-class mass (§21.3): m ∝ size when on
    separation: opts.separation != null && opts.separation >= 0 ? opts.separation : 0,
    attention: opts.attention ?? false, // conserved attention (§2.4), opt-in
    causality: opts.causality ?? false, // cross-boundary causality (Concept 4), opt-in
    heatmap: opts.heatmap ?? false, // density heatmap layer (field-systems H1), opt-in
    overlay: opts.overlay ?? 'off', // Field Surfaces: overlay-surface visualization mode, opt-in
    // distortion multiplier for the `grid` overlay's lattice deflection (1 = calibrated default; 0 flat).
    gridWarp: opts.gridWarp != null && opts.gridWarp >= 0 ? opts.gridWarp : 1,
    // stroke opacity for the `grid` overlay lines. 0.16 = the calibrated faint diagnostic (default,
    // never overpowers content); raise it (≈0.5) to make the warped lattice a deliberate centerpiece.
    gridIntensity: opts.gridIntensity != null && opts.gridIntensity >= 0 ? Math.min(opts.gridIntensity, 1) : 0.16,
    // theme palette (#529): the heat-ramp ends + wave baseline, resolved from the preset + overrides.
    gradientCool: opts.gradientCool ? hexToRgb(opts.gradientCool) : theme.cool,
    gradientWarm: opts.gradientWarm ? hexToRgb(opts.gradientWarm) : theme.warm,
    waveBaseline: (opts.waveBaseline ?? theme.wave).map(hexToRgb),
    dprCap: opts.dprCap && opts.dprCap > 0 ? opts.dprCap : 2, // backing-store DPR ceiling (#410); the
    // dominant fill-rate lever — the ambient field is soft, so ~1.5 buys ~1.8× headroom on retina.
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
  // field-space origin from the host viewport (#540) — 0,0 for a window host, the container's
  // left/top for a contained host. measureBodies + the move/thread readouts subtract it.
  let originX = 0;
  let originY = 0;
  // a contained field (host viewport returns an origin): its bodies live in container-local space,
  // which is INVARIANT under page scroll (the container + its contents move together). So it refreshes
  // the origin each frame and skips the window-only per-frame scroll shift below.
  let contained = false;
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
  let resolvedWaveCenter: { x: number; y: number } | null = null;
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
  // Same cadence cache for the OVERLAY arrows (drawOverlayArrows) — the in-front Field-Surfaces
  // reading. Its grid is the same body-induced force field, so it had the same per-frame regrid
  // waste the underlay shed in #406; resample on the cadence, draw from this cache every frame.
  let olSamples: { gx: number; gy: number; ux: number; uy: number; mag: number }[] | null = null;
  // Tag-tint cache (#515): the parsed RGB + reach² of each coloured body, rebuilt only on the
  // measure cadence (colour/range change there, not per frame). The body ref is kept so the
  // per-particle loop reads cx/cy FRESH each frame — those are scroll-compensated every frame
  // (#508), so caching positions would re-introduce the swarm-pause-on-scroll lag for the tint.
  let tintCache: { b: Body; r2: number; rgb: RGB }[] | null = null;
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
  // element trigger class-toggle (§22.3, FACM #687): `data-class="dense:lit, captured:full"` adds a
  // class while a trigger holds and removes it when the trigger releases — the declarative, no-JS
  // counterpart of the `data-on` CustomEvent binding (same trigger vocabulary, parsed identically).
  let classEls: { el: HTMLElement; body: Body | null; bindings: EventBinding[] }[] = [];
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
      // saturation is the threshold transition for field:saturated (§22.5, FACM #686): the sink
      // reached its capacity this frame (that is what triggered the supernova). The force pass resets
      // accreted to 0 immediately, so the load metric is never observable at ≈1 after the fact — the
      // honest place to announce saturation is here, the moment it happens. field:released (below) is
      // the paired down-edge, so a consumer gets both ends of the cycle.
      fireThreshold(b.el, 'field:saturated', { peak: released.length });
      // and fires field:released on the falling edge of accreting (capture/release events, §22.5).
      if (b.el.dataset.fxCap === '1') {
        b.el.dataset.fxCap = '0';
        fireCaptureEvent(b.el, 'released', { accreted: 0, load: 0 });
        if (busHas('release')) busEmit('release', { body: b, count: released.length });
        sinkPeak.delete(b);
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
      id: seed.id ?? nextParticleId++,
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
    waves = cfg.waves ? buildWaves(cfg.waveBaseline) : [];
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
    // programmatic bodies (addBody) aren't discoverable by the scan — carry them across the rebuild.
    if (programmaticBodies.length > 0) bodies = bodies.concat(programmaticBodies);
    measureBodies(bodies, W, H, originX, originY);
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
    // element trigger class-toggle (§22.3, FACM #687): same trigger:value grammar as data-on, but the
    // value is a class name toggled on the element instead of an event name dispatched.
    classEls = [...host.root.querySelectorAll('[data-class]')].map((node) => {
      const el = node as HTMLElement;
      return {
        el,
        body: bodies.find((b) => b.el === el) ?? null,
        bindings: parseEventBindings(el.dataset.class ?? ''),
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

  // element trigger class-toggle (§22.3, FACM #687): the declarative element-trigger consumer. While a
  // trigger holds (the same dense/sparse/engaged/captured vocabulary data-on uses), add its class to
  // the element; remove it when the trigger releases. Idempotent via classList + the per-binding armed
  // flag, so a held trigger toggles exactly once. Opt-in by `data-class`, so it never touches existing
  // content — the no-JS counterpart of doing `el.classList.toggle()` inside a data-on handler.
  function updateClassToggles(): void {
    if (classEls.length === 0) return;
    for (const ce of classEls) {
      const s = ce.body
        ? { d: ce.body.d, on: ce.body.on, accreted: ce.body.accreted }
        : { d: 0, on: ce.el.dataset.active === '1', accreted: 0 };
      for (const bind of ce.bindings) {
        const active = triggerActive(bind.trigger, s);
        if (active && !bind.armed) {
          bind.armed = true;
          ce.el.classList.add(bind.event); // `event` carries the class name for a data-class binding
        } else if (!active && bind.armed) {
          bind.armed = false;
          ce.el.classList.remove(bind.event);
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
        if (busHas('absorb')) busEmit('absorb', { body: b, count: b.accreted });
        sinkPeak.set(b, b.accreted);
      } else if (edge.fire === 'released') {
        b.el.dataset.fxCap = '0';
        fireCaptureEvent(b.el, 'released', { accreted: 0, load: 0 });
        if (busHas('release')) busEmit('release', { body: b, count: sinkPeak.get(b) ?? 0 });
        sinkPeak.delete(b);
      }
    }
  }

  // Reserved agent-threshold events (§22.5): turn each body's continuous metrics into debounced,
  // hysteretic `field:*` CustomEvents on the element as it crosses a level. Mirrors the lit/dim
  // contract (rising edge fires once, falls re-arm), but routed through the shared Thresholder so the
  // enter/exit levels + debounce are uniform. Every event is paired (a "warning"/"shifted" rising
  // edge and an `*-cleared` falling edge) so a consumer can react both ways. Lazy & cheap: a body
  // only allocates a Thresholder for a metric the first frame that metric has a value to test, and
  // the per-frame loop is a few comparisons. `field:entered`/`field:exited` here are the body's own
  // density crossing (distinct from `field:lit`/`field:dim`, which carry the neighbour-spillover lit
  // channel). See FIELD_EVENTS in agents/event-agent.ts and docs/canonical/agent-consumption-model.md.
  // density / attention / entropy are continuous channels sampled per frame → hysteretic Thresholder.
  // saturation is a discrete transition (the sink hitting capacity), so field:saturated is fired from
  // the supernova callback above, not here (the load metric is reset to 0 before this loop runs).
  const THRESHOLD_EVENTS: { metric: string; enter: number; exit: number; rise: string; fall: string }[] = [
    { metric: 'density', enter: 0.6, exit: 0.2, rise: 'field:entered', fall: 'field:exited' },
    { metric: 'attention', enter: 1.5, exit: 1.1, rise: 'field:attention-shifted', fall: 'field:attention-settled' },
    { metric: 'entropy', enter: 0.7, exit: 0.4, rise: 'field:entropy-warning', fall: 'field:entropy-cleared' },
  ];
  const THRESHOLD_DEBOUNCE_MS = 120;
  function fireThreshold(el: HTMLElement, name: string, detail: Record<string, unknown>): void {
    el.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }
  function dispatchBodyThreshold(
    store: WeakMap<object, Map<string, Thresholder>>,
    key: object,
    el: HTMLElement,
    spec: { metric: string; enter: number; exit: number; rise: string; fall: string },
    value: number,
    now: number,
  ): void {
    let metrics = store.get(key);
    if (!metrics) store.set(key, (metrics = new Map()));
    let th = metrics.get(spec.metric);
    if (!th) metrics.set(spec.metric, (th = new Thresholder({ enter: spec.enter, exit: spec.exit, debounceMs: THRESHOLD_DEBOUNCE_MS })));
    const edge = th.update(value, now);
    if (edge === 'entered') fireThreshold(el, spec.rise, { metric: spec.metric, value });
    else if (edge === 'exited') fireThreshold(el, spec.fall, { metric: spec.metric, value });
  }
  function updateThresholdEvents(now: number): void {
    for (const b of bodies) {
      if (!b.vis || b.tokens.length === 0) continue;
      for (const spec of THRESHOLD_EVENTS) {
        let value: number | undefined;
        switch (spec.metric) {
          case 'density':
            value = b.d;
            break;
          case 'attention':
            // conserved-attention multiplier (1 = neutral); only meaningful while attention is on.
            if (cfg.attention) value = b.attn ?? 1;
            break;
          case 'entropy':
            value = b.metrics?.entropy;
            break;
        }
        if (value === undefined) continue;
        dispatchBodyThreshold(bodyThresholds, b, b.el, spec, value, now);
      }
    }
    // relationship memory (addEdge agents, §2.7): a remembered edge crosses its memory threshold.
    // The event dispatches on the source body's element so an app can react to "this relationship is
    // now durably remembered" / "…has faded". (For programmatic addBody bodies the element is the
    // internal synthetic stub; a DOM-backed edge surfaces it on a real node.)
    for (const e of programmaticEdges) {
      dispatchBodyThreshold(
        edgeThresholds,
        e.agent,
        e.from.el,
        { metric: 'memory', enter: 0.6, exit: 0.3, rise: 'field:memory-threshold', fall: 'field:memory-faded' },
        e.agent.memory,
        now,
      );
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
      return { x: r.left - originX + r.width / 2, y: r.top - originY + r.height / 2 }; // container-local (#540)
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
        // #530: pass the shared centers + this index instead of allocating `centers.filter(j !== i)`
        // every frame per mover (was O(movers²) arrays/frame on a self-laying-out cluster).
        const rep = repelForce({ x: cx, y: cy }, centers, i);
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
      const ax = ra.left - originX + ra.width / 2; // container-local (#540)
      const ay = ra.top - originY + ra.height / 2;
      const bx = rb.left - originX + rb.width / 2;
      const by = rb.top - originY + rb.height / 2;
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
  // adaptive quality tier (#413): the QualityGovernor's 0–3 signal, applied to the engine's own
  // levers. A tier caps the backing-store DPR (the dominant fill lever) and, at 2+, skips the heaviest
  // ambient layer (the heatmap glow). Reversible — tier 0 restores the configured quality. Driven by
  // `setQualityTier`; the platform runtime forwards the governor's tier.
  let qualityTier = 0;
  const TIER_DPR = [Infinity, 1.5, 1.25, 1]; // effective DPR ceiling per tier, capping cfg.dprCap further

  // backing store stays 0×0 while W/H — the simulation space — keep tracking the viewport.
  function sizeSurfaces(dprRaw: number): void {
    if (!ctx) return;
    const dpr = Math.min(dprRaw || 1, cfg.dprCap, TIER_DPR[qualityTier] ?? Infinity);
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
    originX = vp.originX ?? 0;
    originY = vp.originY ?? 0;
    contained = vp.originX != null || vp.originY != null;
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
    if (cfg.waveStyle === 'circular') {
      const c = resolvedWaveCenter || { x: W / 2, y: H / 2 };
      const maxRadius = Math.min(W, H) * 0.48;
      for (const w of waves) {
        const [cr, cg, cb] = w.color;
        ctx!.beginPath();
        const dTheta = 0.08;
        let first = true;
        for (let theta = 0; theta <= 2 * Math.PI + 0.01; theta += dTheta) {
          const r = waveRAt(w, theta, time, maxRadius);
          const x = c.x + Math.cos(theta) * r;
          const y = c.y + Math.sin(theta) * r;
          if (first) {
            ctx!.moveTo(x, y);
            first = false;
          } else {
            ctx!.lineTo(x, y);
          }
        }
        ctx!.closePath();

        const baseR = w.baseFrac * maxRadius + w.offsetY;
        const grad = ctx!.createRadialGradient(c.x, c.y, Math.max(0, baseR - w.amp), c.x, c.y, baseR + w.amp + 80);
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},${(0.08 + w.depth * 0.04) * boot})`);
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx!.fillStyle = grad;
        ctx!.fill();
      }

      ctx!.globalCompositeOperation = 'lighter';
      for (const w of waves) {
        const [cr, cg, cb] = w.color;
        ctx!.beginPath();
        const dTheta = 0.08;
        let first = true;
        for (let theta = 0; theta <= 2 * Math.PI + 0.01; theta += dTheta) {
          const r = waveRAt(w, theta, time, maxRadius);
          const x = c.x + Math.cos(theta) * r;
          const y = c.y + Math.sin(theta) * r;
          if (first) {
            ctx!.moveTo(x, y);
            first = false;
          } else {
            ctx!.lineTo(x, y);
          }
        }
        ctx!.closePath();
        ctx!.lineWidth = 5;
        ctx!.strokeStyle = `rgba(${cr},${cg},${cb},${(0.05 + w.depth * 0.04) * boot})`;
        ctx!.stroke();
        ctx!.lineWidth = 1.2;
        ctx!.strokeStyle = `rgba(${cr},${cg},${cb},${(0.3 + w.depth * 0.22) * boot})`;
        ctx!.stroke();
      }
      ctx!.globalCompositeOperation = 'source-over';
    } else {
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
        ctx!.lineWidth = 5;
        ctx!.strokeStyle = `rgba(${cr},${cg},${cb},${(0.05 + w.depth * 0.04) * boot})`;
        ctx!.stroke();
        ctx!.lineWidth = 1.2;
        ctx!.strokeStyle = `rgba(${cr},${cg},${cb},${(0.3 + w.depth * 0.22) * boot})`;
        ctx!.stroke();
      }
      ctx!.globalCompositeOperation = 'source-over';
    }
  }

  function drawBound(): void {
    ctx!.globalCompositeOperation = 'lighter';
    const time = env.t;
    let i = 0;
    if (cfg.waveStyle === 'circular') {
      const c = resolvedWaveCenter || { x: W / 2, y: H / 2 };
      const maxRadius = Math.min(W, H) * 0.48;
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
        const theta = p.progress * 2 * Math.PI;
        const r = waveRAt(w, theta, time, maxRadius) + p.phase * 32;
        const x = c.x + Math.cos(theta) * r;
        const y = c.y + Math.sin(theta) * r;
        const [cr, cg, cb] = w.color;
        const tw = p.glow ? 0.6 + 0.4 * Math.sin(time * 2.2 + i) : 0.85;
        if (p.glow) {
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
    } else {
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
      const channels = {
        density: b.d,
        heatmapDensity,
        load,
        entropy: m.entropy,
        coherence: m.coherence,
        temperature: m.temperature,
      };
      cfg.feedbackSink(writeEl, channels);
      // per-body feedback (addBody): demux this body's channels to its own callback.
      b.onFeedback?.(channels);
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
    // Fade the ambient glow out as the page scrolls past the hero (≈ the first viewport). Unlike the
    // earlier velocity-based suppression (which popped in/out and read as choppy), this is a smooth,
    // MONOTONIC function of scroll POSITION — full through the top of the page, gone by ~1.15 viewports
    // — so it never flickers; and below the hero the whole layer is skipped (the #409 at-rest upscale
    // cost the heatmap is otherwise paying every frame for a glow you can't focus on mid-page).
    const hmFade = H > 0 ? clamp((1.15 - lastScrollY / H) / 0.85, 0, 1) : 1;
    if (hmFade <= 0.01) return;
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
      const acc = curAccent; // #530: the cached live accent RGB (was hexToRgb(cfg.accent) — a per-frame parse)
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
    ctx!.globalAlpha = hmFade; // fade with scroll position (computed above)
    ctx!.drawImage(hmCanvas, 0, 0, W, H); // bilinear upscale → smooth glow
    ctx!.globalAlpha = 1;
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
    // The heatmap is a continuous ambient layer — NOT coupled to scroll. It draws every frame
    // whenever enabled. (An earlier scroll-suppression made it pop/fade out while scrolling, which
    // read as choppy; the perf intent is served instead by the compute throttle — the texel grid is
    // recomputed only every 3rd frame — so the per-frame cost is just the cached bilinear upscale.)
    if (heatmap && qualityTier < 2) drawHeatmap(); // #413: drop the heaviest ambient layer at tier 2+
    drawBound();

    // free particles — cool centre → warm edge, blended toward accent (§20.8).
    // metaballs (a molten iso-surface skin) and streamlines (the bare force field) REPLACE
    // the matter per §20.6, so suppress the dot swarm for those two; dots/trails/links/voronoi
    // keep it (their overlays read against the particles).
    const showMatter = cfg.render !== 'metaballs' && cfg.render !== 'streamlines';
    ctx!.globalCompositeOperation = 'lighter';
    const acc = curAccent; // #530: the cached live accent RGB (was hexToRgb(cfg.accent) — a per-frame parse)
    const cx = W / 2;
    const cy = H * 0.4;
    const maxD = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) || 1;
    // Tag-tint: every body carrying a colour stains the swarm toward its tint by proximity — a
    // pervasive, render-time companion to the overlap-only `pigment` force, so a particle near a
    // tagged body wears its tag's hue even on a sparse field. Few coloured bodies, precomputed once
    // here; nearest-strongest wins per particle so the hues don't muddy. Reach is a touch past the
    // force range so the colour reads before matter actually arrives.
    // Rebuild the RGB cache only on the measure cadence (every 6th frame) or first frame — hexToRgb is
    // the churn (#515). Positions are NOT cached: the loop below reads each body's live cx/cy.
    if (tintCache === null || frameN % 6 === 0) {
      tintCache = [];
      for (const tb of bodies) {
        if (!tb.tint) continue;
        const reach = (tb.range || 200) * 1.4;
        tintCache.push({ b: tb, r2: reach * reach, rgb: hexToRgb(tb.tint) });
      }
    }
    const tintBodies = tintCache;
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
      particleRGBInto(_rgb, rs, h, acc, cfg.gradientCool, cfg.gradientWarm);
      let r = _rgb[0];
      let g = _rgb[1];
      let b = _rgb[2];
      if (tintBodies.length) {
        let bw = 0;
        let brgb: RGB | null = null;
        for (const tb of tintBodies) {
          const dx = p.x - tb.b.cx; // live position — scroll-compensated every frame (#508)
          const dy = p.y - tb.b.cy;
          const dd2 = dx * dx + dy * dy;
          if (dd2 >= tb.r2) continue;
          const w = 1 - Math.sqrt(dd2 / tb.r2); // linear falloff, 1 at centre → 0 at reach
          if (w > bw) {
            bw = w;
            brgb = tb.rgb;
          }
        }
        if (brgb) {
          const k = bw * 0.7; // tint strength at the body centre
          r += (brgb[0] - r) * k;
          g += (brgb[1] - g) * k;
          b += (brgb[2] - b) * k;
        }
      }
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
      const acc = curAccent; // #530: the cached live accent RGB (was hexToRgb(cfg.accent) — a per-frame parse)
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
      const acc = curAccent; // #530: the cached live accent RGB (was hexToRgb(cfg.accent) — a per-frame parse)
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
      const acc = curAccent; // #530: the cached live accent RGB (was hexToRgb(cfg.accent) — a per-frame parse)
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
      const acc = curAccent; // #530: the cached live accent RGB (was hexToRgb(cfg.accent) — a per-frame parse)
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
              const b = flowBiasInto(_flowB, gx, gy, flow, 0.04);
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
    const acc = curAccent; // #530: the cached live accent RGB (was hexToRgb(cfg.accent) — a per-frame parse)
    // RESAMPLE the field on a cadence, not every frame (mirrors the underlay slSamples cache, #406).
    // The overlay grid is the same body-induced force field — it only shifts on the measure cadence
    // (every 6th frame) or while a flow focus animates — so a per-frame regrid (≈grid×bodies force
    // evals) was the same wasted work the underlay shed, surfacing as scroll jank when a Field-
    // Surfaces reading is live. Resample every 3rd frame (or empty cache / live flow); the EMA scale
    // updates with it. DRAW from the cache every frame below, so the arrows never flicker or step.
    if (olSamples === null || flow || frameN % 3 === 0) {
      const samples: { gx: number; gy: number; ux: number; uy: number; mag: number }[] = [];
      let frameMax = 0;
      for (let gx = GRID / 2; gx < W; gx += GRID) {
        for (let gy = GRID / 2; gy < H; gy += GRID) {
          let { fx, fy } = forceAt(bodies, reg.forces, env, gx, gy);
          if (flow) {
            const b = flowBiasInto(_flowB, gx, gy, flow, 0.04);
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
      // the overlay scale never couples to the underlay's field strength. Updated with the resample.
      if (olMaxSmoothed === 0) olMaxSmoothed = frameMax;
      else olMaxSmoothed = frameMax > olMaxSmoothed
        ? olMaxSmoothed * 0.7 + frameMax * 0.3   // track rises promptly
        : olMaxSmoothed * 0.9 + frameMax * 0.1;  // decay slowly so quiet frames don't flash
      olSamples = samples;
    }
    if (olMaxSmoothed <= 0) return;
    // one backend call per arrow: shaft + two head strokes packed as three segments. Alpha varies
    // per arrow (it encodes magnitude), so arrows can't share one batch without quantizing — the
    // call count matches the previous per-arrow beginPath/stroke exactly. `acc` is read every frame
    // (outside the resample) so a live setAccent recolors the cached arrows immediately.
    const stroke: Stroke = { r: acc[0]!, g: acc[1]!, b: acc[2]!, alpha: 0, width: 1.2 };
    const seg = new Float64Array(12);
    for (const s of olSamples!) {
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
    const acc = curAccent; // #530: the cached live accent RGB (was hexToRgb(cfg.accent) — a per-frame parse)
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
    const STEP = 48; // roomy cells so each mass can dimple the lattice into a deep, legible bowl; the
    // CLAMP below keeps even a deep bowl foldless (denser than the field-line default still reads fine).
    const MAXD = 22 * cfg.gridWarp; // px displacement the field asks for at the strongest sample; the
    // CLAMP below is what actually keeps it legible, so gridWarp drives how fast that ceiling is reached.
    const CLAMP = STEP * 0.46; // a vertex can move at most ~half a cell, so adjacent lines bend hard but
    // can NEVER cross — the displaced grid always reads as deep curved space, never a tangle.
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
    // Heatmap-coloured lattice: each segment is tinted by how hard the field warps it there — cool
    // accent where space is flat, through warm orange, to white-hot at the strongest deflection (the
    // mass wells). Opacity rises with the deflection too, so flat space is a faint base lattice and the
    // warped regions blaze — the spacetime-curvature image made literal. Consecutive same-band segments
    // are merged into one polyline, so the colouring costs a handful of extra strokes, not one per cell.
    // neon ramp: accent blue (flat space) → electric violet → neon magenta → hot neon pink (the wells).
    // curAccent (#530) is the cached accent RGB — the cool stop the warped regions heat away from.
    const HEAT: RGB[] = [curAccent, [120, 110, 255], [240, 70, 255], [255, 50, 130]];
    const BANDS = 8;
    const relAt = (i: number): number => (maxMag > 0 ? Math.sqrt(mags[i]! / maxMag) : 0);
    const bandAt = (i: number): number => Math.round(relAt(i) * BANDS);
    const strokeFor = (b: number): Stroke => {
      const rel = b / BANDS;
      const c = sampleStops(HEAT, rel);
      // cool flat space sits at ~30% of the configured intensity; the hottest cells reach it in full.
      return { r: c[0]!, g: c[1]!, b: c[2]!, alpha: Math.min(1, cfg.gridIntensity * (0.3 + 0.85 * rel)), width: rel > 0.55 ? 1.4 : 1 };
    };
    // Build the raw displacement vector per vertex (direction × normalized strength × throw), then box-
    // blur it once so neighbouring vertices move together — a rubber sheet dimpling, not per-vertex
    // jitter. Blurring the displacement (not the field) is what turns the knot at each mass into a smooth
    // bowl: the inward pull is averaged with its calmer neighbours, so nothing collapses to a point.
    const wx = new Float32Array(cols * rows);
    const wy = new Float32Array(cols * rows);
    for (let i = 0; i < cols * rows; i++) {
      const rel = relAt(i);
      wx[i] = dx[i]! * rel * MAXD;
      wy[i] = dy[i]! * rel * MAXD;
    }
    const bx = new Float32Array(cols * rows);
    const by = new Float32Array(cols * rows);
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        let sx = 0, sy = 0, n = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const x = gx + ox, y = gy + oy;
            if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
            const j = y * cols + x;
            sx += wx[j]!; sy += wy[j]!; n++;
          }
        }
        const i = gy * cols + gx;
        bx[i] = sx / n; by[i] = sy / n;
      }
    }
    const FADE = STEP * 1.5; // taper the warp to zero within ~1.5 cells of each viewport edge, so the
    // lattice always frames the screen instead of pulling away from the edges under a strong inward warp.
    const px = (gx: number, gy: number): [number, number] => {
      const i = gy * cols + gx;
      let ux = bx[i]!, uy = by[i]!;
      const m = Math.hypot(ux, uy);
      if (m > CLAMP) { ux = (ux / m) * CLAMP; uy = (uy / m) * CLAMP; } // half-cell ceiling: never fold.
      const px0 = gx * STEP, py0 = gy * STEP;
      const e = Math.min(px0, W - px0, py0, H - py0); // distance to the nearest viewport edge
      const k = e <= 0 ? 0 : e < FADE ? e / FADE : 1; // pin the boundary (k=0), ease to full warp inward
      return [px0 + ux * k, py0 + uy * k];
    };
    // Smooth the warped lines into curves: Catmull-Rom through the displaced vertices (the curve passes
    // through every original point, so the warp magnitude is preserved) — the lattice reads as bent
    // space, not faceted segments. Single-segment runs (n < 3) are already straight, returned as-is.
    const SUB = 4;
    const smooth = (p: number[]): number[] => {
      const n = p.length >> 1;
      if (n < 3) return p;
      const o: number[] = [p[0]!, p[1]!];
      for (let i = 0; i < n - 1; i++) {
        const a = (i > 0 ? i - 1 : 0) << 1;
        const b = i << 1;
        const c = (i + 1) << 1;
        const e = (i + 2 < n ? i + 2 : n - 1) << 1;
        const x0 = p[a]!, y0 = p[a + 1]!, x1 = p[b]!, y1 = p[b + 1]!, x2 = p[c]!, y2 = p[c + 1]!, x3 = p[e]!, y3 = p[e + 1]!;
        for (let s = 1; s <= SUB; s++) {
          const t = s / SUB, t2 = t * t, t3 = t2 * t;
          o.push(
            0.5 * (2 * x1 + (-x0 + x2) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (-x0 + 3 * x1 - 3 * x2 + x3) * t3),
            0.5 * (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (-y0 + 3 * y1 - 3 * y2 + y3) * t3),
          );
        }
      }
      return o;
    };
    // a segment is as hot as its hottest endpoint, so a line passing a well lights up across the well.
    const hSeg = (gy: number, gx: number): number => Math.max(bandAt(gy * cols + gx), bandAt(gy * cols + gx + 1));
    const vSeg = (gx: number, gy: number): number => Math.max(bandAt(gy * cols + gx), bandAt((gy + 1) * cols + gx));
    for (let gy = 0; gy < rows; gy++) {
      let band = hSeg(gy, 0);
      let pts: number[] = [...px(0, gy), ...px(1, gy)];
      for (let gx = 1; gx < cols - 1; gx++) {
        const sb = hSeg(gy, gx);
        if (sb === band) pts.push(...px(gx + 1, gy));
        else {
          out.polyline(smooth(pts), strokeFor(band));
          pts = [...px(gx, gy), ...px(gx + 1, gy)];
          band = sb;
        }
      }
      out.polyline(smooth(pts), strokeFor(band));
    }
    for (let gx = 0; gx < cols; gx++) {
      let band = vSeg(gx, 0);
      let pts: number[] = [...px(gx, 0), ...px(gx, 1)];
      for (let gy = 1; gy < rows - 1; gy++) {
        const sb = vSeg(gx, gy);
        if (sb === band) pts.push(...px(gx, gy + 1));
        else {
          out.polyline(smooth(pts), strokeFor(band));
          pts = [...px(gx, gy), ...px(gx, gy + 1)];
          band = sb;
        }
      }
      out.polyline(smooth(pts), strokeFor(band));
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
    const acc = curAccent; // #530: the cached live accent RGB (was hexToRgb(cfg.accent) — a per-frame parse)
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
    const acc = curAccent; // #530: the cached live accent RGB (was hexToRgb(cfg.accent) — a per-frame parse)
    const stroke: Stroke = { r: acc[0]!, g: acc[1]!, b: acc[2]!, alpha: 0, width: 1.1 };
    const seg = new Float64Array(4);
    for (let sx = SEED / 2; sx < W; sx += SEED) {
      for (let sy = SEED / 2; sy < H; sy += SEED) {
        let x = sx;
        let y = sy;
        for (let i = 0; i < STEPS; i++) {
          let { fx, fy } = forceAt(bodies, reg.forces, env, x, y);
          if (flow) {
            const b = flowBiasInto(_flowB, x, y, flow, 0.04);
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
    const acc = curAccent; // #530: the cached live accent RGB (was hexToRgb(cfg.accent) — a per-frame parse)
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
      // custom overlays registered via registerOverlay()
      const customFn = customOverlays.get(mode);
      if (customFn) customFn(out, env, W, H);
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

    // a contained field re-reads its origin each frame (the container's viewport position shifts as the
    // page scrolls); cheap — one getBoundingClientRect for the container, only when contained.
    if (contained) {
      const vp = host.viewport();
      originX = vp.originX ?? 0;
      originY = vp.originY ?? 0;
    }
    const scrollY = host.scrollY();
    const dScroll = scrollY - lastScrollY;
    // eased page-scroll speed for the `scrolling` data-when gate (§5).
    env.scrollV = (env.scrollV ?? 0) * 0.7 + Math.abs(dScroll) * 0.3;
    lastScrollY = scrollY;
    // Scroll-compensate the cached body centres between the every-6th-frame re-measures. The page
    // scrolls continuously under the fixed field, so each body's viewport position shifts every frame
    // even though getBoundingClientRect only runs on the measure cadence — without this the attractors
    // snap in 6-frame steps during scroll and the swarm reads as "pausing". Cheap and drift-free: the
    // elements don't move in the document between measures, so the only delta is scroll, and
    // measureBodies refreshes from the real rects on its own cadence. cy carries the shaped box too
    // (it is centred on cy ± hh). Window fields only: a contained field's local positions are
    // scroll-invariant (container + contents move together), so this shift would corrupt them (#540).
    if (dScroll !== 0 && !contained) for (const b of bodies) b.cy -= dScroll;
    for (const w of waves) {
      const target = scrollY * (0.025 + w.depth * 0.08); // wave parallax (§24)
      w.offsetY += (target - w.offsetY) * 0.04;
    }
    if (bodies.length && frameN % 6 === 0) {
      measureBodies(bodies, W, H, originX, originY);
      detectProximityEvents(bodies); // #441 enter/exit/met — on the measure cadence, lazy
      // attention-gated discharge (#365): an engagement-gated sink releases on the falling
      // edge of engagement — the same conserved supernova ritual as saturation.
      dischargeDisengaged(bodies, env.supernova);
    }
    // Step programmatic edges (addEdge): a relationship is "active" while its source body is salient
    // (gathering matter, d > 0.08) — it then strengthens + accumulates memory, and decays while idle.
    // env.dt is frame-normalized (≈1 at 60fps); the dynamics rates are per-second, so convert (÷60).
    if (programmaticEdges.length && env.dt) {
      const dtS = env.dt / 60;
      for (const e of programmaticEdges) updateRelationship(e.agent, e.from.d > 0.08, 0, dtS);
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
        const b = flowBiasInto(_flowB, p.x, p.y, flow, 0.6);
        p.vx += b.x;
        p.vy += b.y;
      }
    }
    if (cfg.waveStyle === 'circular') {
      if (cfg.waveCenter) {
        resolvedWaveCenter = typeof cfg.waveCenter === 'function' ? cfg.waveCenter() : cfg.waveCenter;
      } else {
        const star = bodies.find((b) => b.tokens.includes('star') || b.tokens.includes('vortex'));
        if (star) {
          resolvedWaveCenter = { x: star.cx, y: star.cy };
        } else {
          resolvedWaveCenter = { x: W / 2, y: H / 2 };
        }
      }
    } else {
      resolvedWaveCenter = null;
    }

    updateWarpTargets(); // refresh warp relocate targets from paired bodies (§22.3) before the step
    step({ store, bodies, env, forces: reg.forces, conditions: reg.conditions, waves, waveStyle: cfg.waveStyle, waveCenter: resolvedWaveCenter, separation: cfg.separation });
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
    updateClassToggles(); // element trigger class-toggle (§22.3, FACM #687): toggle data-class on crossings
    updateCaptureEvents();
    updateThresholdEvents(now); // reserved agent-threshold events (§22.5): debounced field:* on crossings
    flushBusEvents(); // #684: deliver the frame's coalesced discrete events — one per (source, type)
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
  // Never let this ambient idle-detection timer pin the host alive on its own: Node keeps the
  // process running while an un-unref'd interval is pending (browsers ignore unref). destroy()
  // still clears it for prompt teardown — this just guarantees a field that outlives its destroy()
  // (e.g. a headless test that forgets to tear down) can't hang process exit.
  (idleTimer as { unref?: () => void }).unref?.();

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

  const handle: FieldHandle = {
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
    setWaveStyle: (style) => {
      cfg.waveStyle = style;
    },
    setWaveCenter: (center) => {
      cfg.waveCenter = center;
    },
    setSeparation: (strength) => {
      cfg.separation = strength >= 0 ? strength : 0;
    },
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
    setDprCap: (cap) => {
      cfg.dprCap = cap > 0 ? cap : 2;
      if (ctx) sizeSurfaces(host.viewport().dpr); // re-size the backing store to the new ceiling now
    },
    setQualityTier: (tier) => {
      const next = Math.max(0, Math.min(3, Math.floor(tier || 0)));
      if (next === qualityTier) return;
      qualityTier = next;
      if (ctx) sizeSurfaces(host.viewport().dpr); // re-apply the tier's effective DPR ceiling now
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
    readParticleIds: (out) => {
      // parallel to readParticles (same pool order, same agent skip), so out[i] is the stable id of
      // the particle written at stride offset i*5 there — the host maps id → its own opaque payload.
      const ps = store.particles;
      let w = 0;
      for (let i = 0; i < ps.length && w < out.length; i++) {
        const p = ps[i]!;
        if (p.report !== undefined) continue; // agents excluded, exactly like readParticles
        out[w++] = p.id ?? 0;
      }
      return w;
    },
    readParticleChannels: (channels, out) => {
      const ps = store.particles;
      let written = 0;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]!;
        if ('report' in p && p.report !== undefined) continue;
        if (written >= Math.min(...out.map(b => b.length))) break;
        for (let ci = 0; ci < channels.length; ci++) {
          if (ci >= out.length) break;
          const ch = channels[ci]!;
          out[ci]![written] =
            ch === 'x' ? p.x : ch === 'y' ? p.y : ch === 'z' ? (p.z ?? 0) :
            ch === 'vx' ? p.vx : ch === 'vy' ? p.vy :
            ch === 'heat' ? p.heat : ch === 'size' ? p.size :
            ch === 'm' ? p.m : ch === 'id' ? (p.id ?? 0) :
            ch === 'age' ? (p.age ?? 0) : ch === 'charge' ? (p.charge ?? 0) : 0;
        }
        written++;
      }
      return written;
    },
    registerOverlay: (name, drawFn) => {
      customOverlays.set(name, drawFn);
      return () => { customOverlays.delete(name); };
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
    addBody: (spec) => {
      // A programmatic body has no DOM. A minimal rect-backed element answers the body contract the
      // measurer + reactive-param refresh read (getAttribute / dataset / getBoundingClientRect), so we
      // reuse the exact bodyFromElement path the scan uses — no fake document, no querySelectorAll root.
      const attrs: Record<string, string> = {
        'data-body': Array.isArray(spec.tokens) ? spec.tokens.join(' ') : String(spec.tokens),
      };
      if (spec.strength != null) attrs['data-strength'] = String(spec.strength);
      if (spec.range != null) attrs['data-range'] = String(spec.range);
      if (spec.spin != null) attrs['data-spin'] = String(spec.spin);
      if (spec.angle != null) attrs['data-angle'] = String(spec.angle);
      if (spec.color != null) attrs['data-color'] = spec.color;
      const toRect = (): DOMRect => {
        const r = spec.rect();
        return {
          left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height,
          width: r.width, height: r.height, x: r.left, y: r.top, toJSON: () => ({}),
        } as DOMRect;
      };
      const el = {
        tagName: 'DIV', id: '', className: '',
        dataset: spec.color != null ? { color: spec.color } : ({} as Record<string, string>),
        getAttribute: (n: string) => attrs[n] ?? null,
        hasAttribute: (n: string) => n in attrs,
        getBoundingClientRect: toRect,
        dispatchEvent: () => true,
        setAttribute: () => {},
        removeAttribute: () => {},
        // the feedback sink writes CSS vars here; a no-op style absorbs them (the value is delivered
        // to onFeedback / the handle's channels, not the DOM).
        style: { setProperty: () => {}, removeProperty: () => {}, getPropertyValue: () => '' } as unknown as CSSStyleDeclaration,
      } as unknown as HTMLElement;
      const body = bodyFromElement(el);
      body.rect = toRect;
      body.data = spec.data;
      body.feedback = true; // programmatic bodies always compute channels (the CSS write hits the
      // harmless stub element; the value flows to onFeedback + the handle's live channels).
      const channels: FeedbackChannels = {};
      body.onFeedback = (ch) => { Object.assign(channels, ch); spec.onFeedback?.(ch); };
      programmaticBodies.push(body);
      bodies = bodies.concat(body); // live this frame, before the next scan re-merges it
      measureBodies([body], W, H, originX, originY); // init cx/cy so the first sample/force is correct
      const handle: BodyHandle = {
        data: spec.data,
        get channels() { return channels; },
        set: (params) => {
          // mutate the attrs the synthetic element exposes; refreshBodyParams (measure cadence) picks
          // up strength/range/spin/angle next frame — the same reactive path DOM + three bodies use.
          if (params.strength != null) attrs['data-strength'] = String(params.strength);
          if (params.range != null) attrs['data-range'] = String(params.range);
          if (params.spin != null) attrs['data-spin'] = String(params.spin);
          if (params.angle != null) attrs['data-angle'] = String(params.angle);
          // color/tint isn't on the refresh path — set it directly (the scanner reads tint once).
          if (params.color != null) {
            attrs['data-color'] = params.color;
            (el.dataset as Record<string, string>).color = params.color;
            body.tint = params.color;
          }
        },
        remove: () => {
          const i = programmaticBodies.indexOf(body);
          if (i >= 0) programmaticBodies.splice(i, 1);
          bodies = bodies.filter((x) => x !== body);
          // drop any programmatic edges that touched this body (#601).
          for (let k = programmaticEdges.length - 1; k >= 0; k--) {
            const pe = programmaticEdges[k]!;
            if (pe.from === body || pe.to === body) programmaticEdges.splice(k, 1);
          }
        },
      };
      handleToBody.set(handle, body);
      return handle;
    },
    addEdge: (a, b, opts) => {
      // a relationship between two programmatic bodies (the addBody handles). No DOM — the edge keys on
      // the body identities; it feeds the same pure RelationshipAgent dynamics the DOM graph uses.
      const from = handleToBody.get(a);
      const to = handleToBody.get(b);
      if (!from || !to) throw new Error('addEdge: both arguments must be handles returned by addBody on this field.');
      const agent: RelationshipAgent = {
        id: `e${edgeSeq++}`,
        from: '', // body ids are internal; readEdges exposes the carried data instead
        to: '',
        type: opts?.type ?? 'related',
        strength: opts?.strength ?? 0.5,
        tension: 0,
        memory: 0,
        active: false,
      };
      const edge: ProgEdge = { agent, from, to, fromData: a.data, toData: b.data };
      programmaticEdges.push(edge);
      return {
        set: (params) => {
          if (params.strength != null) agent.strength = params.strength < 0 ? 0 : params.strength > 1 ? 1 : params.strength;
          if (params.type != null) agent.type = params.type;
        },
        remove: () => {
          const i = programmaticEdges.indexOf(edge);
          if (i >= 0) programmaticEdges.splice(i, 1);
        },
      };
    },
    readEdges: () =>
      programmaticEdges.map((e) => ({
        from: e.fromData,
        to: e.toData,
        type: e.agent.type,
        strength: e.agent.strength,
        memory: e.agent.memory,
        active: e.agent.active,
      })),
    addField: (name, sampler) => {
      fieldChannels.set(name, sampler);
      return {
        name,
        set: (next) => { fieldChannels.set(name, next); },
        remove: () => { fieldChannels.delete(name); },
      };
    },
    sampleField: (name, x, y) => {
      const s = fieldChannels.get(name);
      return s ? s(x, y) : 0;
    },
    energy: () => energyReport(store.particles),
    sample: (x, y) => {
      const { fx, fy } = forceAt(bodies, reg.forces, env, x, y);
      return { x: fx, y: fy };
    },
    sampleScalar: (x, y) => {
      if (heatmap) return heatmap.norm(x, y);
      devWarnNoOp('NOOP_NO_HEATMAP', 'sampleScalar() returned 0 because the heatmap layer is off — construct with { heatmap: true } or call setHeatmap(true).');
      return 0;
    },
    sampleGradient: (x, y) => {
      if (heatmap) return heatmap.gradient(x, y);
      devWarnNoOp('NOOP_NO_HEATMAP', 'sampleGradient() returned { x: 0, y: 0 } because the heatmap layer is off — construct with { heatmap: true } or call setHeatmap(true).');
      return { x: 0, y: 0 };
    },
    grid: (name) => env.grid(name),
    on: <K extends FieldEventType>(type: K, cb: (e: FieldEventMap[K]) => void) => {
      let set = busListeners.get(type);
      if (!set) { set = new Set(); busListeners.set(type, set); }
      set.add(cb as (e: never) => void);
      return () => void set!.delete(cb as (e: never) => void);
    },
    version: FIELD_VERSION,
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

  return handle;
}
