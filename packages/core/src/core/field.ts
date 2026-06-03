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
import { FORMATION_BY, PALETTE, type FormationId } from '../config/forces.config.ts';
import { clamp, hexToRgb } from './math.ts';
import { registerCoreForces } from '../forces/index.ts';

const COOL: readonly [number, number, number] = [200, 224, 255];

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
  }

  function scan(): void {
    bodies = scanBodies(document);
    measureBodies(bodies, W, H);
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

  function render(): void {
    ctx!.clearRect(0, 0, W, H);
    const [ar, ag, ab] = hexToRgb(cfg.accent);
    for (const p of store.particles) {
      const h = p.heat;
      const r = (COOL[0] + (ar - COOL[0]) * h) | 0;
      const g = (COOL[1] + (ag - COOL[1]) * h) | 0;
      const b = (COOL[2] + (ab - COOL[2]) * h) | 0;
      ctx!.fillStyle = `rgba(${r},${g},${b},${clamp(0.5 + h * 0.5, 0, 1)})`;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, p.size + h * 2, 0, 6.28318);
      ctx!.fill();
    }
  }

  function frame(now: number): void {
    frameN++;
    env.t = (now - t0) / 1000;
    env.frameN = frameN;
    env.dt = reduceMotion ? 0 : 1;
    easeFormation(env.form, formTarget, 0.03); // glide between formations (§7)
    if (bodies.length && frameN % 6 === 0) measureBodies(bodies, W, H);
    store.reindex();
    step({ store, bodies, env, forces: reg.forces, conditions: reg.conditions });
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
