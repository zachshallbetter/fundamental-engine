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

import type { Body, Env, FieldHandle, FieldOptions, Particle } from './types.ts';
import { FieldStore } from './field-store.ts';
import { createRegistry } from './registry.ts';
import { step } from './integrator.ts';
import { scanBodies, measureBodies } from './scanner.ts';
import { FORMATION_BY, PALETTE, type FormationId } from '../config/forces.config.ts';
import { clamp, hexToRgb } from './math.ts';

const COOL: readonly [number, number, number] = [200, 224, 255];

export function createField(canvas: HTMLCanvasElement, opts: FieldOptions = {}): FieldHandle {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('forces-ui: 2D canvas context unavailable');

  const store = new FieldStore();
  const reg = createRegistry();
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
  const t0 = performance.now();

  const env: Env = {
    dx: 0,
    dy: 0,
    dist: 1,
    form: { ...FORMATION_BY.ambient.preset },
    W: 0,
    H: 0,
    t: 0,
    dt: reduceMotion ? 0 : 1,
    c: 12,
    G: 1,
    spark: () => {}, // Phase 5 (§23)
    supernova: () => {}, // Phase 2 (§6.9)
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
    env.dt = reduceMotion ? 0 : 1;
    if (bodies.length && frameN % 6 === 0) measureBodies(bodies, W, H);
    store.reindex();
    step({ store, bodies, env, forces: reg.forces, conditions: reg.conditions });
    render();
    raf = requestAnimationFrame(frame);
  }

  const onResize = (): void => resize();
  resize();
  window.addEventListener('resize', onResize, { passive: true });
  raf = requestAnimationFrame(frame);

  return {
    scan,
    rescan: scan,
    setAccent: (hex) => {
      cfg.accent = hex;
    },
    setFormation: (name) => {
      const f = FORMATION_BY[name as FormationId];
      if (f) env.form = { ...f.preset };
    },
    destroy: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      store.clear();
    },
  };
}
