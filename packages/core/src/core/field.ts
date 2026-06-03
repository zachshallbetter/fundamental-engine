/**
 * createField — the browser entry point (§13).
 *
 * Mounts the simulation against a `<canvas>`: builds the particle pool, scans
 * the document for `[data-body]` bodies, runs the rAF loop (measure → reindex →
 * step → render), and exposes the public `FieldHandle`. Pure glue — the testable
 * physics lives in field-store / integrator / scanner.
 *
 * Phase 1: a minimal particle renderer (dots, heat-tinted) so the field is
 * visibly alive. Forces are Phase 2; the Currents and full rendering are Phase 3.
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
import { healWaves, tearBoundNear, tearBoundByForces } from './reservoir.ts';
import { FORMATION_BY, PALETTE, ACCENT_JOURNEY, type FormationId } from '../config/forces.config.ts';
import { clamp, hexToRgb, particleRGB, rgbToHex, sampleStops, type RGB } from './math.ts';
import { registerCoreForces } from '../forces/index.ts';

// the Currents' cool baseline palette — a subset of the force palette (§24.4).
const WAVE_RGB = ['#4da3ff', '#2dd4bf', '#a78bfa'].map(hexToRgb);

export function createField(canvas: HTMLCanvasElement, opts: FieldOptions = {}): FieldHandle {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('forces-ui: 2D canvas context unavailable');

  const store = new FieldStore();
  const reg = createRegistry();
  registerCoreForces(reg); // the canonical nine (§6)
  const reduceMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const cfg = {
    accent: opts.accent ?? PALETTE[0] ?? '#4da3ff',
    density: opts.density && opts.density > 0 ? opts.density : 1,
  };

  let bodies: Body[] = [];
  let W = 0;
  let H = 0;
  let raf = 0;
  let frameN = 0;
  let formTarget: Formation = { ...FORMATION_BY.ambient.preset };
  let waves: Wave[] = [];
  let bound: BoundParticle[] = [];
  let boundTarget = 0;
  let boot = reduceMotion ? 1 : 0;
  const pull: WavePull = { x: 0, y: 0, k: 0 }; // the "spine" — waves bend to the engaged body
  const JOURNEY: RGB[] = ACCENT_JOURNEY.map(hexToRgb);
  let curAccent: RGB = hexToRgb(cfg.accent);
  let hoverAccent: string | null = null;
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
    spark: () => {}, // Phase 5 (§23)
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
    spawn: (p) => void store.add(newParticle(p)),
    neighbors: (p, r) => store.neighbors(p, r),
    grid: () => ({ sample: () => 0, deposit: () => {}, gradient: () => ({ x: 0, y: 0 }) }), // Phase C
  };

  function newParticle(seed: Partial<Particle> = {}): Particle {
    return {
      x: seed.x ?? Math.random() * W,
      y: seed.y ?? Math.random() * H,
      vx: seed.vx ?? (Math.random() - 0.5) * 0.25,
      vy: seed.vy ?? (Math.random() - 0.5) * 0.18,
      m: seed.m ?? 1,
      heat: seed.heat ?? 0,
      size: seed.size ?? 0.7 + Math.random() * 1.8,
      gx: seed.gx ?? Math.random(),
      gy: seed.gy ?? Math.random(),
      cap: null,
    };
  }

  function build(): void {
    store.clear();
    const n = Math.round(130 * cfg.density);
    for (let i = 0; i < n; i++) store.add(newParticle());
    waves = buildWaves(WAVE_RGB);
    bound = buildBound(waves.length, cfg.density, Math.random);
    boundTarget = bound.length;
  }

  function scan(): void {
    bodies = scanBodies(document);
    measureBodies(bodies, W, H);
    bindEngagement();
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
      };
      const leave = (): void => {
        el.dataset.active = '0';
        hoverAccent = null;
      };
      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointerleave', leave);
      el.addEventListener('focus', enter);
      el.addEventListener('blur', leave);
    });
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
      ctx!.lineWidth = 1.2;
      ctx!.shadowBlur = 11;
      ctx!.shadowColor = `rgba(${cr},${cg},${cb},0.9)`;
      ctx!.strokeStyle = `rgba(${cr},${cg},${cb},${(0.3 + w.depth * 0.22) * boot})`;
      ctx!.stroke();
    }
    ctx!.shadowBlur = 0;
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
        ctx!.shadowBlur = 8;
        ctx!.shadowColor = `rgba(${cr},${cg},${cb},0.9)`;
      }
      ctx!.fillStyle = `rgba(${cr},${cg},${cb},${tw * boot})`;
      ctx!.beginPath();
      ctx!.arc(x, y, p.size, 0, 6.28318);
      ctx!.fill();
      if (p.glow) ctx!.shadowBlur = 0;
      i++;
    }
    ctx!.globalCompositeOperation = 'source-over';
  }

  function render(): void {
    // opaque dark substrate (§2.5, darkness ≈ 0.97).
    ctx!.fillStyle = 'rgb(5,6,11)';
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
      const [r, g, b] = particleRGB(rs, h, acc);
      const size = p.size * (1 - 0.4 * rs) + h * 2;
      const alpha = clamp((0.5 - 0.3 * rs + h * 0.5) * boot, 0, 1);
      if (h > 0.2) {
        ctx!.shadowBlur = 12 * h;
        ctx!.shadowColor = `rgba(${r | 0},${g | 0},${b | 0},0.95)`;
      }
      ctx!.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${alpha})`;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, size, 0, 6.28318);
      ctx!.fill();
      if (h > 0.2) ctx!.shadowBlur = 0;
    }
    ctx!.globalCompositeOperation = 'source-over';
  }

  function frame(now: number): void {
    frameN++;
    env.t = (now - t0) / 1000;
    env.frameN = frameN;
    env.dt = reduceMotion ? 0 : 1;
    if (boot < 1) boot = Math.min(1, boot + 0.012);
    easeFormation(env.form, formTarget, 0.03); // glide between formations (§7)

    const scrollY = window.scrollY || 0;
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
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight || 1;
    const targetAcc = hoverAccent ? hexToRgb(hoverAccent) : sampleStops(JOURNEY, scrollY / maxScroll);
    curAccent = [
      curAccent[0] + (targetAcc[0] - curAccent[0]) * 0.08,
      curAccent[1] + (targetAcc[1] - curAccent[1]) * 0.08,
      curAccent[2] + (targetAcc[2] - curAccent[2]) * 0.08,
    ];
    cfg.accent = rgbToHex(curAccent);

    store.reindex();
    step({ store, bodies, env, forces: reg.forces, conditions: reg.conditions, waves });
    if (env.dt) {
      healWaves(store, bound, boundTarget, waves, W, H, env.t, Math.random);
      tearBoundByForces(bound, waves, bodies, W, H, env.t, (p) => void store.add(newParticle(p)));
    }
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
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('scroll', scrollHandler, { passive: true });
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
    setFormation,
    destroy: () => {
      cancelAnimationFrame(raf);
      clearInterval(idleTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', scrollHandler);
      for (const ev of inputEvents) window.removeEventListener(ev, markInput);
      store.clear();
    },
  };
}
