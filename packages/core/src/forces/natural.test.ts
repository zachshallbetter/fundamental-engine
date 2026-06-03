import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gravity, charge, magnetism, thermal, thermalSigma, naturalForces } from './natural.ts';
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

test('natural primitives are gravity + charge + magnetism + thermal (§20.10)', () => {
  assert.deepEqual(
    naturalForces.map((f) => f.token),
    ['gravity', 'charge', 'magnetism', 'thermal'],
  );
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

test('gravity and charge share one kernel — same |f| for unit source (§20.10)', () => {
  const g = part();
  gravity.apply(body({ M: 1, range: 300 }), g, env({ dx: 10, dy: 0, dist: 10 }));
  const c = part({ charge: 1 });
  charge.apply(body({ spin: 1, M: 1, range: 300 }), c, env({ dx: 10, dy: 0, dist: 10 }));
  // identical magnitude, opposite direction (gravity attracts, like-charge repels)
  assert.ok(near(g.vx, -c.vx));
});
