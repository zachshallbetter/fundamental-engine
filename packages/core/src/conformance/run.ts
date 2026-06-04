/**
 * The conformance runner — simulates a `Scenario` with the real engine, headless.
 *
 * Mirrors the integrator benchmark (FieldStore + Env + `step()`), with real
 * `neighbors` (class B) and a real `ScalarGridImpl` advanced each frame (class C).
 * RNG forces (thermal, emitter) are made deterministic by swapping `Math.random` for
 * a seeded PRNG during the run. Returns the full trajectory plus each particle's
 * frame-0 force delta (one direct `apply`, before friction) for exact/invariant checks.
 */
import type { Body, Env, ForceRegistry, Particle } from '../core/types.ts';
import { FieldStore } from '../core/field-store.ts';
import { step } from '../core/integrator.ts';
import { ScalarGridImpl } from '../core/scalar-grid.ts';
import { createRegistry } from '../core/registry.ts';
import { registerCoreForces } from '../forces/index.ts';
import { registerNaturalForces } from '../forces/natural.ts';
import { registerExtendedForces } from '../forces/extended.ts';
import { conditions } from '../core/conditions.ts';
import type { ApplyDelta, FrameState, Scenario, ScenarioResult } from './types.ts';

const W = 1200;
const H = 800;

/** A seeded PRNG (mulberry32) — same family the bench uses, for reproducible RNG runs. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The full force registry (canonical + natural + extended). */
export function allForces(): ForceRegistry {
  const reg = createRegistry();
  registerCoreForces(reg);
  registerNaturalForces(reg);
  registerExtendedForces(reg);
  return reg.forces;
}

/** A full `Body` from a scenario's partial attrs (the engine's default shape). */
export function resolveBody(s: Scenario): Body {
  const angle = s.body.angle ?? 0;
  return {
    el: {} as HTMLElement,
    tokens: s.tokens ?? [s.force],
    strength: 1,
    range: 300,
    absorbR: 64,
    capacity: 60,
    spin: 1,
    angle,
    ux: Math.cos(angle),
    uy: Math.sin(angle),
    when: '',
    feedback: false,
    fmin: 0,
    fmax: 0,
    opsz: '',
    M: 1,
    cx: 0,
    cy: 0,
    hw: 0,
    hh: 0,
    on: false,
    vis: true,
    accreted: 0,
    count: 0,
    d: 0,
    ...s.body,
    // keep ux/uy consistent if angle was overridden
    ...(s.body.angle != null ? { ux: Math.cos(s.body.angle), uy: Math.sin(s.body.angle) } : {}),
  };
}

function makeParticle(p: import('./types.ts').ScenarioParticle): Particle {
  return {
    x: p.x,
    y: p.y,
    vx: p.vx ?? 0,
    vy: p.vy ?? 0,
    m: 1,
    heat: p.heat ?? 0,
    size: p.size ?? 1,
    cap: null,
    ...(p.charge != null ? { charge: p.charge } : {}),
    ...(p.color != null ? { color: p.color } : {}),
  };
}

function makeEnv(store: FieldStore): Env {
  const grids = new Map<string, ScalarGridImpl>();
  return {
    dx: 0,
    dy: 0,
    dist: 1,
    form: { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0 },
    W,
    H,
    t: 0,
    frameN: 0,
    dt: 1,
    c: 12,
    G: 1,
    spark: () => {},
    supernova: () => {},
    spawn: () => {},
    neighbors: (p, r) => store.neighbors(p, r),
    grid: (name) => {
      let g = grids.get(name);
      if (!g) {
        const mode = name.startsWith('wave') ? 'wave' : name.startsWith('memory') ? 'memory' : 'diffuse';
        g = new ScalarGridImpl(W, H, mode);
        grids.set(name, g);
      }
      return g;
    },
    // expose the grid map so the runner can advance buffers each frame
    __grids: grids,
  } as Env & { __grids: Map<string, ScalarGridImpl> };
}

const snap = (p: Particle): FrameState => ({
  x: p.x,
  y: p.y,
  vx: p.vx,
  vy: p.vy,
  heat: p.heat,
  speed: Math.hypot(p.vx, p.vy),
});

/** Per-particle frame-0 force effect: one direct `apply` of the body's non-modifier
 *  tokens on a clone of each initial particle, with real neighbours from the store. */
function frameZeroDelta(s: Scenario, body: Body, forces: ForceRegistry, store: FieldStore): ApplyDelta[] {
  return s.particles.map((sp) => {
    const p = makeParticle(sp);
    const vx0 = p.vx;
    const vy0 = p.vy;
    const dx = body.cx - p.x;
    const dy = body.cy - p.y;
    const d = Math.hypot(dx, dy);
    // a transient env for the single apply (real neighbours, fresh grid)
    const env = makeEnv(store);
    env.dx = dx;
    env.dy = dy;
    env.dist = d < 1 ? 1 : d;
    for (const tok of body.tokens) {
      const f = forces[tok];
      if (f && !f.modify) f.apply(body, p, env);
    }
    return { dvx: p.vx - vx0, dvy: p.vy - vy0 };
  });
}

/** Simulate a scenario with the real engine; deterministic (RNG seeded if requested). */
export function runScenario(s: Scenario, forces: ForceRegistry = allForces()): ScenarioResult {
  const store = new FieldStore();
  for (const sp of s.particles) store.add(makeParticle(sp));
  const body = resolveBody(s);
  const env = makeEnv(store) as Env & { __grids: Map<string, ScalarGridImpl> };

  const origRandom = Math.random;
  if (s.seed != null) Math.random = mulberry(s.seed);
  try {
    // build the spatial index first so neighbour queries (class B) see the other
    // particles, then measure frame-0 deltas on pristine clones.
    store.reindex();
    const applyDelta = frameZeroDelta(s, body, forces, store);

    const trajectory: FrameState[][] = [store.particles.map(snap)];
    for (let f = 0; f < s.frames; f++) {
      env.frameN = f;
      env.t = f / 60;
      store.reindex();
      step({ store, bodies: [body], env, forces, conditions });
      if (env.dt) for (const g of env.__grids.values()) g.step();
      trajectory.push(store.particles.map(snap));
    }
    return { scenario: s, trajectory, applyDelta, body };
  } finally {
    Math.random = origRandom;
  }
}
