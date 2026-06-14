/**
 * Integrator benchmark — measures the hot path: the per-frame body-force loop
 * (O(particles × bodies)) plus integration, friction, formation bias, and the
 * spatial-hash reindex. Run: `pnpm --filter Fundamental bench`.
 *
 * Prints avg ms/frame and throughput (particle·body interactions/sec) at a few
 * realistic scales. Deterministic-ish; warms up before timing.
 */

import { FieldStore } from '../src/core/field-store.ts';
import { step } from '../src/core/integrator.ts';
import { coreForces } from '../src/forces/index.ts';
import { naturalForces } from '../src/forces/natural.ts';
import { extendedForces } from '../src/forces/extended.ts';
import type { Body, Env, Particle, Formation } from '../src/core/types.ts';

const W = 1440;
const H = 900;

const forces = Object.fromEntries(
  [...coreForces, ...naturalForces, ...extendedForces].map((f) => [f.token, f]),
);

const AMBIENT: Formation = { driftX: 0, wander: 0.4, orbit: 0, spread: 0, conv: 0 };

function makeParticle(rnd: () => number): Particle {
  return {
    x: rnd() * W,
    y: rnd() * H,
    vx: (rnd() - 0.5) * 2,
    vy: (rnd() - 0.5) * 2,
    m: 1,
    heat: rnd(),
    size: 0.7 + rnd() * 1.8,
    cap: null,
    gx: rnd(),
    gy: rnd(),
  };
}

function makeBody(tokens: string[], cx: number, cy: number): Body {
  return {
    el: {} as HTMLElement,
    tokens,
    strength: 1,
    range: 300,
    absorbR: 64,
    capacity: 60,
    spin: 1,
    angle: 0,
    ux: 1,
    uy: 0,
    when: '',
    feedback: false,
    fmin: 0,
    fmax: 0,
    opsz: '',
    M: 1,
    cx,
    cy,
    hw: 40,
    hh: 16,
    on: false,
    vis: true,
    accreted: 0,
    count: 0,
    d: 0,
  };
}

const TOKENS = ['attract', 'repel', 'vortex', 'stream', 'drag', 'spring', 'gravity', 'wind'];

// a small deterministic PRNG so runs are comparable (no Math.random)
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

function env(): Env {
  const store = STORE;
  const e: Env = {
    dx: 0,
    dy: 0,
    dist: 1,
    form: { ...AMBIENT },
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
    grid: () => ({ sample: () => 0, deposit: () => {}, gradient: () => ({ x: 0, y: 0 }) }),
  };
  return e;
}

let STORE: FieldStore;

function run(label: string, nParticles: number, nBodies: number, frames: number) {
  const rnd = mulberry(1234);
  STORE = new FieldStore();
  for (let i = 0; i < nParticles; i++) STORE.add(makeParticle(rnd));
  const bodies: Body[] = [];
  for (let i = 0; i < nBodies; i++) {
    bodies.push(makeBody([TOKENS[i % TOKENS.length]!], rnd() * W, rnd() * H));
  }
  const e = env();
  const opts = { store: STORE, bodies, env: e, forces, conditions: {} };

  // warm up (let the JIT settle)
  for (let f = 0; f < 30; f++) {
    e.frameN = f;
    STORE.reindex();
    step(opts);
  }

  const t0 = performance.now();
  for (let f = 0; f < frames; f++) {
    e.frameN = f;
    STORE.reindex();
    step(opts);
  }
  const total = performance.now() - t0;
  const msPer = total / frames;
  const interactions = nParticles * nBodies;
  const fps = 1000 / msPer;
  const budget = ((msPer / 16.67) * 100).toFixed(1);
  console.log(
    `${label.padEnd(10)} ${String(nParticles).padStart(5)}p × ${String(nBodies).padStart(2)}b  ` +
      `${msPer.toFixed(3).padStart(8)} ms/frame  ${fps.toFixed(0).padStart(5)} fps  ` +
      `${(interactions / msPer / 1000).toFixed(1).padStart(7)}M int/s  ${budget.padStart(5)}% of 16.7ms`,
  );
}

console.log('\nFundamental · integrator benchmark (Node ' + process.version + ')\n');
console.log(
  'scale'.padEnd(10) + '  load             ms/frame      fps        throughput   frame budget',
);
console.log('─'.repeat(86));
run('light', 800, 3, 300);
run('typical', 2000, 6, 200);
run('heavy', 5000, 10, 120);
run('stress', 10000, 16, 60);
console.log('');
