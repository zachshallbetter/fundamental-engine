import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gravity,
  charge,
  magnetism,
  thermal,
  collide,
  diffuse,
  propagate,
  memory,
  thermalSigma,
  naturalForces,
} from './natural.ts';
import type { ScalarGrid } from '../core/types.ts';
import type { Body, Env, Particle } from '../core/types.ts';

const body = (o: Partial<Body> = {}): Body => ({
  el: {} as HTMLElement,
  tokens: [],
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
  cx: 0,
  cy: 0,
  hw: 0,
  hh: 0,
  on: false,
  vis: true,
  accreted: 0,
  count: 0,
  d: 0,
  ...o,
});

const part = (o: Partial<Particle> = {}): Particle => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  m: 1,
  heat: 0,
  size: 1,
  cap: null,
  ...o,
});

const env = (o: Partial<Env> = {}): Env => ({
  dx: 0,
  dy: 0,
  dist: 1,
  form: { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0 },
  W: 1000,
  H: 800,
  t: 0,
  frameN: 0,
  dt: 1,
  c: 12,
  G: 1,
  spark: () => {},
  supernova: () => {},
  spawn: () => {},
  neighbors: () => [],
  grid: () => ({ sample: () => 0, deposit: () => {}, gradient: () => ({ x: 0, y: 0 }) }),
  ...o,
});

const near = (a: number, b: number, tol = 1e-4): boolean => Math.abs(a - b) < tol;

test('natural primitives span §20.10 (gravity…memory)', () => {
  assert.deepEqual(
    naturalForces.map((f) => f.token),
    ['gravity', 'charge', 'magnetism', 'thermal', 'collide', 'diffuse', 'propagate', 'memory'],
  );
});

// a controllable grid stub: records deposits, returns a fixed gradient.
const fakeGrid = (grad: { x: number; y: number }, rec: number[][]): ScalarGrid => ({
  sample: () => 0,
  deposit: (x, y, a) => {
    rec.push([x, y, a]);
  },
  gradient: () => grad,
});

test('diffuse deposits a mark and follows the gradient up-slope (§20.10)', () => {
  const rec: number[][] = [];
  const p = part({ x: 10, y: 20 });
  diffuse.apply(
    body({ strength: 0.5, range: 300 }),
    p,
    env({ dist: 10, grid: () => fakeGrid({ x: 2, y: 0 }, rec) }),
  );
  assert.deepEqual(rec, [[10, 20, 0.5]]); // deposited at the particle
  assert.ok(near(p.vx, 1)); // grad.x·strength = 2·0.5
  assert.ok(near(p.vy, 0));
});

test('propagate injects at the source when engaged and rides the wavefront (§20.10)', () => {
  const rec: number[][] = [];
  const p = part({ x: 5, y: 5 });
  propagate.apply(
    body({ strength: 0.5, range: 300, on: true, cx: 100, cy: 50 }),
    p,
    env({ dist: 10, grid: () => fakeGrid({ x: 0, y: 3 }, rec) }),
  );
  assert.deepEqual(rec, [[100, 50, 0.5]]); // injected at the body centre
  assert.ok(near(p.vy, 1.5)); // grad.y·strength
});

test('propagate rides the front without injecting when idle', () => {
  const rec: number[][] = [];
  const p = part({ x: 5, y: 5 });
  propagate.apply(
    body({ strength: 0.5, range: 300, on: false }),
    p,
    env({ dist: 10, grid: () => fakeGrid({ x: 1, y: 0 }, rec) }),
  );
  assert.equal(rec.length, 0); // no injection when not engaged
  assert.ok(near(p.vx, 0.5)); // still rides the gradient
});

test('diffuse and propagate are inert beyond range', () => {
  const rec: number[][] = [];
  const dp = part({ vx: 0, vy: 0 });
  diffuse.apply(
    body({ strength: 1, range: 100 }),
    dp,
    env({ dist: 200, grid: () => fakeGrid({ x: 5, y: 5 }, rec) }),
  );
  assert.equal(dp.vx, 0);
  const pp = part({ vx: 0, vy: 0 });
  propagate.apply(
    body({ strength: 1, range: 100 }),
    pp,
    env({ dist: 200, grid: () => fakeGrid({ x: 5, y: 5 }, rec) }),
  );
  assert.equal(pp.vx, 0);
  assert.equal(rec.length, 0);
});

test('gravity pulls inward as a softened 1/d² law (§20.10)', () => {
  const p = part();
  // M=1, G=1, d=10 → ε=2/144 is sub-pixel, so f ≈ 1/d² = 0.01 toward the body.
  gravity.apply(body({ M: 1, range: 300 }), p, env({ dx: 10, dy: 0, dist: 10 }));
  assert.ok(near(p.vx, 0.01));
  assert.ok(near(p.vy, 0));
});

test('gravity is inert beyond the cutoff range', () => {
  const p = part();
  gravity.apply(body({ M: 1, range: 300 }), p, env({ dx: 350, dy: 0, dist: 350 }));
  assert.equal(p.vx, 0);
});

test('gravity clamps speed to c — the in-sim speed of light (§20.10)', () => {
  const p = part();
  // M=13 at d=1: f = 13/(1+ε²) ≈ 12.59 > c, so the result is capped at 12.
  gravity.apply(body({ M: 13, range: 300 }), p, env({ dx: 1, dy: 0, dist: 1 }));
  assert.ok(near(Math.hypot(p.vx, p.vy), 12));
  assert.ok(near(p.vx, 12));
});

test('charge: like signs repel (§20.3)', () => {
  const p = part({ charge: 1 });
  // σ=+1 body, q=+1 particle → outward (away from the body at dx=+10).
  charge.apply(body({ spin: 1, M: 1, range: 300 }), p, env({ dx: 10, dy: 0, dist: 10 }));
  assert.ok(near(p.vx, -0.01));
});

test('charge: opposite signs attract (§20.3)', () => {
  const p = part({ charge: -1 });
  // σ=+1 body, q=−1 particle → inward (toward the body).
  charge.apply(body({ spin: 1, M: 1, range: 300 }), p, env({ dx: 10, dy: 0, dist: 10 }));
  assert.ok(near(p.vx, 0.01));
});

test('charge: neutral matter is unaffected', () => {
  const p = part({ charge: 0 });
  charge.apply(body({ spin: 1, M: 1 }), p, env({ dx: 10, dy: 0, dist: 10 }));
  assert.equal(p.vx, 0);
  // a particle with no charge field at all is also inert
  const p2 = part();
  charge.apply(body({ spin: 1, M: 1 }), p2, env({ dx: 10, dy: 0, dist: 10 }));
  assert.equal(p2.vx, 0);
});

test('magnetism deflects a moving charge perpendicular (§20.10)', () => {
  const p = part({ vx: 1, vy: 0, charge: 1 });
  // q=+1, B=spin·strength=+0.5, v=+x → F = qB·(−v_y, v_x) = (0, 0.5): curls toward +y.
  magnetism.apply(body({ spin: 1, strength: 0.5, range: 300 }), p, env({ dx: 10, dy: 0, dist: 10 }));
  assert.ok(near(p.vx, 1));
  assert.ok(near(p.vy, 0.5));
});

test('magnetism does no work — impulse is perpendicular to velocity (§20.10)', () => {
  const before = { vx: 2, vy: 1 };
  const p = part({ ...before, charge: 1 });
  magnetism.apply(body({ spin: 1, strength: 1, range: 300 }), p, env({ dx: 5, dy: 0, dist: 5 }));
  const dvx = p.vx - before.vx;
  const dvy = p.vy - before.vy;
  assert.ok(near(dvx * before.vx + dvy * before.vy, 0)); // Δv ⟂ v → F·v = 0
});

test('magnetism: body spin flips the sense of curl', () => {
  const p = part({ vx: 1, vy: 0, charge: 1 });
  magnetism.apply(body({ spin: -1, strength: 0.5, range: 300 }), p, env({ dx: 10, dy: 0, dist: 10 }));
  assert.ok(near(p.vy, -0.5)); // opposite spin → curls toward −y
});

test('magnetism: neutral matter is unaffected', () => {
  const p = part({ vx: 1, vy: 0 });
  magnetism.apply(body({ spin: 1, strength: 1 }), p, env({ dx: 10, dy: 0, dist: 10 }));
  assert.equal(p.vy, 0);
});

test('magnetism is inert beyond the cutoff range', () => {
  const p = part({ vx: 1, vy: 0, charge: 1 });
  magnetism.apply(body({ spin: 1, strength: 1, range: 300 }), p, env({ dx: 350, dy: 0, dist: 350 }));
  assert.equal(p.vy, 0);
});

test('thermalSigma is the fluctuation–dissipation amplitude √(2T) (§20.10)', () => {
  assert.equal(thermalSigma(0), 0); // T=0 → frozen
  assert.ok(near(thermalSigma(0.5), 1)); // √(2·0.5) = 1
  assert.ok(near(thermalSigma(2), 2)); // √(2·2) = 2
  assert.equal(thermalSigma(-5), 0); // negative T floored — no imaginary kicks
});

test('thermal is frozen at zero temperature', () => {
  const p = part({ vx: 0.3, vy: -0.2 });
  thermal.apply(body({ strength: 0, range: 300 }), p, env({ dx: 10, dy: 0, dist: 10 }));
  assert.equal(p.vx, 0.3);
  assert.equal(p.vy, -0.2);
});

test('thermal is inert beyond the cutoff range', () => {
  const p = part();
  thermal.apply(body({ strength: 5, range: 300 }), p, env({ dx: 350, dy: 0, dist: 350 }));
  assert.equal(p.vx, 0);
  assert.equal(p.vy, 0);
});

test('thermal kicks are isotropic with the right variance (§20.10)', () => {
  // Sample many independent kicks; mean ≈ 0 and per-axis std ≈ σ. At d=1, range=300,
  // strength=2 → σ = √(2·2·(1−1/300)) ≈ 1.997. Bounds are loose enough to be robust.
  const N = 5000;
  let sx = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < N; i++) {
    const p = part();
    thermal.apply(body({ strength: 2, range: 300 }), p, env({ dx: 1, dy: 0, dist: 1 }));
    sx += p.vx;
    sxx += p.vx * p.vx;
    syy += p.vy * p.vy;
  }
  const meanX = sx / N;
  const stdX = Math.sqrt(sxx / N);
  const stdY = Math.sqrt(syy / N);
  assert.ok(Math.abs(meanX) < 0.2, `mean ${meanX}`); // centred
  assert.ok(stdX > 1.6 && stdX < 2.4, `stdX ${stdX}`); // ≈ σ ≈ 2
  assert.ok(stdY > 1.6 && stdY < 2.4, `stdY ${stdY}`); // isotropic
});

// collide uses env.neighbors — stub it to return a fixed partner q.
const withNeighbor = (q: Particle): Partial<Env> => ({ neighbors: () => [q] });

test('collide reverses a head-on approach elastically (e=1, §20.10)', () => {
  const q = part({ x: 3, y: 0, vx: -1, vy: 0, size: 2 });
  const p = part({ x: 0, y: 0, vx: 1, vy: 0, size: 2 }); // discs overlap (d=3 < 4)
  collide.apply(body({ strength: 1, range: 300 }), p, env({ dist: 10, ...withNeighbor(q) }));
  assert.ok(near(p.vx, -1)); // equal-mass elastic swap: p reverses (q updated symmetrically)
  assert.ok(near(p.vy, 0));
  assert.ok(near(q.vx, 1)); // q reversed too — the pair is resolved in one pass
});

test('collide ignores a separating pair', () => {
  const q = part({ x: 3, y: 0, vx: 1, vy: 0, size: 2 });
  const p = part({ x: 0, y: 0, vx: -1, vy: 0, size: 2 }); // moving apart
  collide.apply(body({ strength: 1, range: 300 }), p, env({ dist: 10, ...withNeighbor(q) }));
  assert.equal(p.vx, -1); // untouched
});

test('collide ignores partners out of contact', () => {
  const q = part({ x: 10, y: 0, vx: -1, vy: 0, size: 2 }); // d=10 > r_p+r_q=4
  const p = part({ x: 0, y: 0, vx: 1, vy: 0, size: 2 });
  collide.apply(body({ strength: 1, range: 300 }), p, env({ dist: 10, ...withNeighbor(q) }));
  assert.equal(p.vx, 1);
});

test('collide restitution e=0 is perfectly inelastic (half closing speed removed)', () => {
  const q = part({ x: 3, y: 0, vx: -1, vy: 0, size: 2 });
  const p = part({ x: 0, y: 0, vx: 1, vy: 0, size: 2 });
  collide.apply(body({ strength: 0, range: 300 }), p, env({ dist: 10, ...withNeighbor(q) }));
  assert.ok(near(p.vx, 0)); // (1+0)·0.5·relN, relN=−2 → p: 1 → 0 (moves with q)
});

test('collide is inert outside the body region', () => {
  const q = part({ x: 3, y: 0, vx: -1, vy: 0, size: 2 });
  const p = part({ x: 0, y: 0, vx: 1, vy: 0, size: 2 });
  collide.apply(body({ strength: 1, range: 100 }), p, env({ dist: 200, ...withNeighbor(q) }));
  assert.equal(p.vx, 1);
});

test('gravity and charge share one kernel — same |f| for unit source (§20.10)', () => {
  const g = part();
  gravity.apply(body({ M: 1, range: 300 }), g, env({ dx: 10, dy: 0, dist: 10 }));
  const c = part({ charge: 1 });
  charge.apply(body({ spin: 1, M: 1, range: 300 }), c, env({ dx: 10, dy: 0, dist: 10 }));
  // identical magnitude, opposite direction (gravity attracts, like-charge repels)
  assert.ok(near(g.vx, -c.vx));
});

// a memory-grid stub: records deposits, returns a fixed occupancy sample.
const memGrid = (sampleVal: number, rec: number[][]): ScalarGrid => ({
  sample: () => sampleVal,
  deposit: (x, y, a) => {
    rec.push([x, y, a]);
  },
  gradient: () => ({ x: 0, y: 0 }),
});

test('memory lays occupancy and pulls harder where the path is worn', () => {
  const recFresh: number[][] = [];
  const fresh = part({ x: 7, y: 3 });
  memory.apply(
    body({ strength: 1, range: 100 }),
    fresh,
    env({ dx: 10, dy: 0, dist: 10, grid: () => memGrid(0, recFresh) }),
  );
  const recWorn: number[][] = [];
  const worn = part({ x: 7, y: 3 });
  memory.apply(
    body({ strength: 1, range: 100 }),
    worn,
    env({ dx: 10, dy: 0, dist: 10, grid: () => memGrid(2, recWorn) }),
  );
  assert.deepEqual(recFresh, [[7, 3, 0.15]]); // occupancy laid at the particle
  assert.ok(worn.vx > fresh.vx, 'a more worn spot pulls harder');
  assert.ok(near(worn.vx, fresh.vx * 2), 'amp = 1 + 0.5·M → doubles at M = 2');
});

test('memory is inert beyond range', () => {
  const rec: number[][] = [];
  const p = part({ vx: 0, vy: 0 });
  memory.apply(
    body({ strength: 1, range: 100 }),
    p,
    env({ dx: 5, dy: 5, dist: 200, grid: () => memGrid(5, rec) }),
  );
  assert.equal(rec.length, 0); // no deposit out of range
  assert.ok(near(p.vx, 0));
});
