/**
 * createField — the browser entry point (§13).
 *
 * Mounts the simulation against a `<canvas>`: builds the particle pool, scans
 * the document for `[data-body]` bodies, runs the rAF loop (measure → reindex →
 * step → render), and exposes the public `FieldHandle`. Pure glue — the testable
 * physics lives in field-store / integrator / scanner.
 */

import type { Body, Env, FieldHandle, FieldOptions, Formation, Particle } from './types.ts';
import { FieldStore } from './field-store.ts';
import { createRegistry } from './registry.ts';
import { step } from './integrator.ts';
import { scanBodies, measureBodies } from './scanner.ts';
import { easeFormation } from './formations.ts';
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
import { attentionMuls } from './attention.ts';
import { spillover } from './causality.ts';
import { integrateOffset, anchorForce, elementMass, repelForce, densityPush, type ElementOffset } from './agents.ts';
import { parseEventBindings, triggerActive, type EventBinding } from './events.ts';
import { registerCoreForces } from '../forces/index.ts';
import { registerNaturalForces } from '../forces/natural.ts';
import { registerExtendedForces } from '../forces/extended.ts';
import { ScalarGridImpl } from './scalar-grid.ts';
import { sparkCount, burstImpulse } from './reactions.ts';
import { linkAlpha, marchingCell, splatDensity, nearestSite, voronoiWalls } from './render-modes.ts';
import { forceAt } from './streamlines.ts';

// the Currents' cool baseline palette — a subset of the force palette (§24.4).
const WAVE_RGB = ['#4da3ff', '#2dd4bf', '#a78bfa'].map(hexToRgb);

export function createField(canvas: HTMLCanvasElement, opts: FieldOptions = {}): FieldHandle {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('forces-ui: 2D canvas context unavailable');

  const store = new FieldStore();
  const grids = new Map<string, ScalarGridImpl>(); // §20.1 class [C] field buffers, lazy
  const reg = createRegistry();
  registerCoreForces(reg); // the canonical nine (§6)
  registerNaturalForces(reg); // natural primitives: gravity + charge (§20.10), opt-in
  registerExtendedForces(reg); // designed extended forces: lens, … (§20.3), opt-in
  const reduceMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const cfg = {
    accent: opts.accent ?? resolvePalette(opts.palette)[0] ?? PALETTE[0] ?? '#4da3ff',
    density: opts.density && opts.density > 0 ? opts.density : 1,
    render: opts.render ?? 'dots',
    waves: opts.waves ?? true, // draw the background Currents (§24); opt-out for the bare field
    mass: opts.mass ?? false, // first-class mass (§21.3): m ∝ size when on
    attention: opts.attention ?? false, // conserved attention (§2.4), opt-in
    causality: opts.causality ?? false, // cross-boundary causality (Concept 4), opt-in
  };

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
  let formTarget: Formation = { ...FORMATION_BY.ambient.preset };
  let waves: Wave[] = [];
  let bound: BoundParticle[] = [];
  let boundTarget = 0;
  let boot = reduceMotion ? 1 : 0;
  let mball: Float32Array | null = null; // scratch density grid for the metaballs render mode
  let vor: Int32Array | null = null; // scratch owner grid for the voronoi render mode
  // hard pool ceiling for class-[S] sources (§20.1) — generous above the ~130·density
  // base field so emission is never starved, but bounded so the sim can't grow forever.
  const spawnCeiling = Math.round(130 * cfg.density) * 4;
  const pull: WavePull = { x: 0, y: 0, k: 0 }; // the "spine" — waves bend to the engaged body
  let JOURNEY: RGB[] = resolvePalette(opts.palette).map(hexToRgb); // the accent journey (§9)
  let curAccent: RGB = hexToRgb(cfg.accent);
  let hoverAccent: string | null = null;
  let threadLinks: { a: Element; b: Element; c: RGB; seed: number }[] = [];
  let movers: { el: HTMLElement; o: ElementOffset; mEl: number; layout: boolean }[] = [];
  let sparks: { x: number; y: number; vx: number; vy: number; life: number; c: RGB }[] = [];
  let eventEls: { el: HTMLElement; body: Body | null; bindings: EventBinding[] }[] = [];
  let engaged: { el: HTMLElement; enter: () => void; leave: () => void }[] = []; // [data-hot] listeners, for teardown
  const probe: Particle = { x: 0, y: 0, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: null };
  const t0 = performance.now();

  const env: Env = {
    dx: 0,
    dy: 0,
    dist: 1,
    form: { ...FORMATION_BY.ambient.preset },
    W: 0,
    H: 0,
    t: 0,
    frameN: 0,
    dt: reduceMotion ? 0 : 1,
    c: 12,
    G: 1,
    scrollV: 0,
    spark: (x, y, power, color) => spawnSpark(x, y, power, color),
    supernova: (b) => {
      // release exactly what was captured — radial, from the core (§6.9).
      for (const q of store.particles) {
        if (q.cap === b) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 4 + Math.random() * 3;
          q.cap = null;
          q.x = b.cx;
          q.y = b.cy;
          q.vx = Math.cos(ang) * spd;
          q.vy = Math.sin(ang) * spd;
          q.heat = 1;
        } else {
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
      }
      // the blast also tears nearby bound matter off the Currents (§6.9, §2.4).
      tearBoundNear(bound, waves, b.cx, b.cy, 320, W, H, env.t, (p) => void store.add(newParticle(p)));
      b.accreted = 0;
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
      const a = Math.random() * 6.28318;
      const s = 0.8 + Math.random() * (power > 0 ? power : 1) * 1.7;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c });
    }
  }

  function newParticle(seed: Partial<Particle> = {}): Particle {
    const size = seed.size ?? 0.7 + Math.random() * 1.8;
    return {
      x: seed.x ?? Math.random() * W,
      y: seed.y ?? Math.random() * H,
      vx: seed.vx ?? (Math.random() - 0.5) * 0.25,
      vy: seed.vy ?? (Math.random() - 0.5) * 0.18,
      m: seed.m ?? (cfg.mass ? size : 1), // mass ∝ size when first-class mass is on
      heat: seed.heat ?? 0,
      size,
      gx: seed.gx ?? Math.random(),
      gy: seed.gy ?? Math.random(),
      cap: null,
      ...(seed.age != null ? { age: seed.age } : {}), // mortal matter (a [S] source)
      ...(seed.color != null ? { color: seed.color } : {}),
    };
  }

  function build(): void {
    store.clear();
    const n = Math.round(130 * cfg.density);
    for (let i = 0; i < n; i++) store.add(newParticle());
    // the Currents (§24) are opt-out: with waves off, the field is just the free particles.
    waves = cfg.waves ? buildWaves(WAVE_RGB) : [];
    bound = cfg.waves ? buildBound(waves.length, cfg.density, Math.random) : [];
    boundTarget = bound.length;
  }

  function scan(): void {
    bodies = scanBodies(document);
    measureBodies(bodies, W, H);
    bindEngagement();
    movers = [...document.querySelectorAll('[data-move]')].map((node) => {
      const el = node as HTMLElement;
      const r = el.getBoundingClientRect();
      const seeded = Number.parseFloat(el.dataset.mass ?? '');
      const mEl = Number.isFinite(seeded) ? seeded : elementMass(r.width * r.height);
      // `data-move="layout"` opts into the self-laying-out forces (Concept 3): mutual
      // repulsion + density pressure. Plain `data-move` just drifts with the field.
      const layout = (el.dataset.move ?? '').trim() === 'layout';
      return { el, o: { x: 0, y: 0, vx: 0, vy: 0 } as ElementOffset, mEl, layout };
    });
    eventEls = [...document.querySelectorAll('[data-on]')].map((node) => {
      const el = node as HTMLElement;
      return {
        el,
        body: bodies.find((b) => b.el === el) ?? null,
        bindings: parseEventBindings(el.dataset.on ?? ''),
      };
    });
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
      const cx = centers[i]!.x;
      const cy = centers[i]!.y;
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
      integrateOffset(mv.o, fx, fy, mv.mEl, 0.9);
      mv.el.style.transform = `translate(${mv.o.x.toFixed(2)}px, ${mv.o.y.toFixed(2)}px)`;
    }
  }

  // engagement: hover/focus a [data-hot] element → it activates (b.on, lighting
  // the spine + on-state forces) and overrides the accent with its data-color (§9).
  function bindEngagement(): void {
    document.querySelectorAll('[data-hot]').forEach((node) => {
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
      seed: Math.random() * 6.28,
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

  function resize(): void {
    W = window.innerWidth;
    H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    env.W = W;
    env.H = H;
    maxScroll = document.documentElement.scrollHeight - H || 1;
    for (const g of grids.values()) g.resize(W, H); // keep field buffers viewport-sized
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
    b.el.style.setProperty('--lit', lit.toFixed(3));
    const armed = b.el.dataset.fxLit === '1';
    if (lit > 0.5 && !armed) {
      b.el.dataset.fxLit = '1';
      b.el.dispatchEvent(new CustomEvent('field:lit', { detail: { value: lit } }));
    } else if (lit < 0.4 && armed) {
      b.el.dataset.fxLit = '0';
      b.el.dispatchEvent(new CustomEvent('field:dim', { detail: { value: lit } }));
    }
  }

  function writeFeedback(): void {
    for (const b of bodies) {
      if (!b.feedback) continue;
      const target = feedbackTarget(b.count, b.on);
      b.d += (target - b.d) * 0.08;
      b.el.style.setProperty('--d', b.d.toFixed(3));
      if (b.fmax) {
        const w = feedbackWeight(b.fmin, b.fmax, b.d);
        if (lastWeight.get(b.el) !== w) {
          lastWeight.set(b.el, w);
          b.el.style.fontVariationSettings = `"wght" ${w}` + (b.opsz ? `, "opsz" ${b.opsz}` : '');
        }
      }
      if (b.capacity > 0 && b.tokens.indexOf('sink') >= 0) {
        // accretion load ∈ [0,1] — the canonical author-facing var is `--load`; `--mass`
        // is kept as a back-compat alias (§21.2). This is the fill fraction, not the
        // captured count `b.accreted`.
        const load = clamp(b.accreted / b.capacity, 0, 1).toFixed(3);
        b.el.style.setProperty('--load', load);
        b.el.style.setProperty('--mass', load);
      }
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

  function render(): void {
    // substrate clear — 'trails' uses a faded clear so motion light-paints (§20.6).
    if (cfg.render === 'trails') {
      ctx!.fillStyle = 'rgba(5,6,11,0.22)';
    } else {
      ctx!.fillStyle = 'rgb(5,6,11)';
    }
    ctx!.fillRect(0, 0, W, H);
    drawWaves();
    drawBound();

    // free particles — cool centre → warm edge, blended toward accent (§20.8).
    ctx!.globalCompositeOperation = 'lighter';
    const acc = hexToRgb(cfg.accent);
    const cx = W / 2;
    const cy = H * 0.4;
    const maxD = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) || 1;
    for (const p of store.particles) {
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
      const size = p.size * (1 - 0.4 * rs) + h * 2;
      const alpha = clamp((0.5 - 0.3 * rs + h * 0.5) * boot, 0, 1);
      const cr = r | 0;
      const cg = g | 0;
      const cb = b | 0;
      // glow for hot matter via a cheap additive halo under the core (the canvas is
      // composited 'lighter'), not per-particle shadowBlur — the same look without the
      // 10×+ per-draw cost that spiked frames during interaction.
      if (h > 0.2) {
        ctx!.fillStyle = `rgba(${cr},${cg},${cb},${0.13 * h * boot})`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, size + 3 + 6 * h, 0, 6.28318);
        ctx!.fill();
      }
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

    // streamlines: draw the force field itself — a grid of arrows along the net
    // push a still test particle would feel (§20.6 diagnostic).
    if (cfg.render === 'streamlines') {
      const GRID = 46;
      const acc = hexToRgb(cfg.accent);
      ctx!.lineWidth = 1;
      ctx!.lineCap = 'round';
      for (let gx = GRID / 2; gx < W; gx += GRID) {
        for (let gy = GRID / 2; gy < H; gy += GRID) {
          const { fx, fy } = forceAt(bodies, reg.forces, env, gx, gy);
          const mag = Math.hypot(fx, fy);
          if (mag < 1e-4) {
            ctx!.fillStyle = `rgba(${acc[0]},${acc[1]},${acc[2]},0.05)`;
            ctx!.fillRect(gx - 0.5, gy - 0.5, 1, 1); // quiescent field → a faint dot
            continue;
          }
          const ux = fx / mag;
          const uy = fy / mag;
          const len = Math.min(GRID * 0.46, 6 + mag * 42);
          const ex = gx + ux * len;
          const ey = gy + uy * len;
          ctx!.strokeStyle = `rgba(${acc[0]},${acc[1]},${acc[2]},${clamp(0.12 + mag * 1.3, 0, 0.72)})`;
          ctx!.beginPath();
          ctx!.moveTo(gx, gy);
          ctx!.lineTo(ex, ey);
          const ah = 3.4;
          ctx!.moveTo(ex, ey);
          ctx!.lineTo(ex - ux * ah - uy * ah * 0.6, ey - uy * ah + ux * ah * 0.6);
          ctx!.moveTo(ex, ey);
          ctx!.lineTo(ex - ux * ah + uy * ah * 0.6, ey - uy * ah - ux * ah * 0.6);
          ctx!.stroke();
        }
      }
    }
  }

  function frame(now: number): void {
    frameN++;
    env.t = (now - t0) / 1000;
    env.frameN = frameN;
    env.dt = reduceMotion ? 0 : 1;
    if (boot < 1) boot = Math.min(1, boot + 0.012);
    easeFormation(env.form, formTarget, 0.03); // glide between formations (§7)

    const scrollY = window.scrollY || 0;
    // eased page-scroll speed for the `scrolling` data-when gate (§5).
    env.scrollV = (env.scrollV ?? 0) * 0.7 + Math.abs(scrollY - lastScrollY) * 0.3;
    lastScrollY = scrollY;
    for (const w of waves) {
      const target = scrollY * (0.025 + w.depth * 0.08); // wave parallax (§24)
      w.offsetY += (target - w.offsetY) * 0.04;
    }
    if (bodies.length && frameN % 6 === 0) measureBodies(bodies, W, H);

    // spine: ease the wave-bend toward the engaged element (§24).
    let engaged: Body | null = null;
    for (const b of bodies) {
      if (b.on && b.vis) {
        engaged = b;
        break;
      }
    }
    pull.k += ((engaged ? 1 : 0) - pull.k) * 0.07;
    if (engaged) {
      pull.x = pull.x ? pull.x + (engaged.cx - pull.x) * 0.16 : engaged.cx;
      pull.y = pull.y ? pull.y + (engaged.cy - pull.y) * 0.16 : engaged.cy;
    }

    // accent journey (§9): scroll travels the palette; a hovered element overrides.
    // maxScroll is cached (scrollHeight forces a reflow); resample it twice a second.
    if (frameN % 30 === 0) maxScroll = document.documentElement.scrollHeight - H || 1;
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
    step({ store, bodies, env, forces: reg.forces, conditions: reg.conditions, waves });
    if (env.dt) {
      for (const g of grids.values()) g.step(); // advance field buffers (§20.1 [C])
      healWaves(store, bound, boundTarget, waves, W, H, env.t, Math.random);
      tearBoundByForces(bound, waves, bodies, reg.forces, W, H, env.t, (p) => void store.add(newParticle(p)));
      updateMovers();
    }
    writeFeedback();
    applyCausality();
    updateEvents();
    render();
    raf = requestAnimationFrame(frame);
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
    const mid = window.innerHeight * 0.5;
    let next = '';
    document.querySelectorAll('[data-formation]').forEach((node) => {
      const r = (node as HTMLElement).getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) next = (node as HTMLElement).dataset.formation ?? '';
    });
    if (next && next !== activeForm) {
      activeForm = next;
      setFormation(next);
    }
  }
  const markInput = (): void => void (lastInput = performance.now());
  const scrollHandler = (): void => {
    markInput();
    onScroll();
  };
  const inputEvents = ['pointerdown', 'wheel', 'keydown', 'touchstart'];
  const idleTimer = setInterval(() => {
    if (performance.now() - lastInput > 6000 && activeForm !== 'ambient') {
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
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf) {
      raf = requestAnimationFrame(frame);
    }
  };
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('scroll', scrollHandler, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  for (const ev of inputEvents) window.addEventListener(ev, markInput, { passive: true });
  onScroll();
  raf = requestAnimationFrame(frame);

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
      cfg.render = mode;
    },
    threads: setThreads,
    burst: (x, y, hex) => {
      // discrete one-shot: shove + heat nearby matter, optionally tint it (§11).
      const R = 160;
      for (const q of store.particles) {
        const imp = burstImpulse(q.x - x, q.y - y, R);
        if (imp.heat === 0) continue;
        q.vx += imp.vx;
        q.vy += imp.vy;
        q.heat = Math.max(q.heat, imp.heat);
        if (hex) q.color = hex; // carried pigment (§20.8)
      }
      // detach nearby bound matter so the shock is actually felt (§2.4, like supernova)
      tearBoundNear(bound, waves, x, y, R, W, H, env.t, (p) => void store.add(newParticle(p)));
      spawnSpark(x, y, 2, hex); // a visible pop at the blast point (§23)
    },
    destroy: () => {
      cancelAnimationFrame(raf);
      clearInterval(idleTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', scrollHandler);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const ev of inputEvents) window.removeEventListener(ev, markInput);
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
      store.clear();
    },
  };
}
