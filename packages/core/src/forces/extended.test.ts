import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lens, gate, buoyancy, extendedForces } from './extended.ts';
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

test('extended forces expose lens + gate + buoyancy (§20.3)', () => {
  assert.deepEqual(
    extendedForces.map((f) => f.token),
    ['lens', 'gate', 'buoyancy'],
  );
});

test('lens rotates velocity by θ_max·(1−d/d_max)·sign (§20.3)', () => {
  const p = part({ vx: 1, vy: 0 });
  // θ_max=π/2, d=150, range=300 → θ = (π/2)·0.5 = π/4; rotate (1,0) → (√½, √½).
  lens.apply(body({ strength: Math.PI / 2, range: 300, spin: 1 }), p, env({ dist: 150 }));
  assert.ok(near(p.vx, Math.SQRT1_2));
  assert.ok(near(p.vy, Math.SQRT1_2));
});

test('lens preserves speed exactly (a path bend, no energy)', () => {
  const p = part({ vx: 2, vy: -1 });
  const speed0 = Math.hypot(p.vx, p.vy);
  lens.apply(body({ strength: 1.3, range: 300, spin: 1 }), p, env({ dist: 90 }));
  assert.ok(near(Math.hypot(p.vx, p.vy), speed0));
});

test('lens sign (spin) flips the bend direction', () => {
  const p = part({ vx: 1, vy: 0 });
  lens.apply(body({ strength: Math.PI / 2, range: 300, spin: -1 }), p, env({ dist: 150 }));
  assert.ok(near(p.vx, Math.SQRT1_2)); // θ = −π/4
  assert.ok(near(p.vy, -Math.SQRT1_2));
});

test('lens bend vanishes at the rim and is inert beyond range', () => {
  const atRim = part({ vx: 1, vy: 0 });
  lens.apply(body({ strength: Math.PI / 2, range: 300, spin: 1 }), atRim, env({ dist: 300 }));
  assert.ok(near(atRim.vx, 1)); // (1 − 300/300) = 0 → no rotation
  assert.ok(near(atRim.vy, 0));
  const beyond = part({ vx: 1, vy: 0 });
  lens.apply(body({ strength: Math.PI / 2, range: 300 }), beyond, env({ dist: 350 }));
  assert.equal(beyond.vx, 1);
  assert.equal(beyond.vy, 0);
});

// gate is box-sized (like reflect): cx/cy = 0, hw=50, hh=20; n from ux/uy.
const gateBody = (o: Partial<Body> = {}) => body({ hw: 50, hh: 20, ux: 1, uy: 0, ...o });

test('gate reflects a wrong-way crosser back along its heading (§20.3)', () => {
  const p = part({ x: 0, y: 0, vx: -1, vy: 0 }); // moving −x, against n = +x
  gate.apply(gateBody(), p, env());
  assert.ok(near(p.vx, 1)); // v·n was −1 → flipped to travel with n
  assert.ok(near(p.vy, 0));
});

test('gate passes right-way and tangential matter unchanged', () => {
  const along = part({ x: 0, y: 0, vx: 1, vy: 0 }); // with n
  gate.apply(gateBody(), along, env());
  assert.ok(near(along.vx, 1));
  const tangent = part({ x: 0, y: 0, vx: 0, vy: 1 }); // v·n = 0 (not < 0)
  gate.apply(gateBody(), tangent, env());
  assert.ok(near(tangent.vy, 1));
});

test('gate only acts on matter inside the element box', () => {
  const outside = part({ x: 100, y: 0, vx: -1, vy: 0 }); // |100| ≥ hw+pad
  gate.apply(gateBody(), outside, env());
  assert.equal(outside.vx, -1); // untouched
});

test('gate heading orients the membrane', () => {
  const p = part({ x: 0, y: 0, vx: 0, vy: -1 }); // against n = +y
  gate.apply(gateBody({ ux: 0, uy: 1 }), p, env());
  assert.ok(near(p.vy, 1)); // reflected to +y
});

test('buoyancy: a unit-size, cool particle is neutrally buoyant (§20.3)', () => {
  const p = part({ size: 1, heat: 0 }); // ρ_p = 1 = ρ_med
  buoyancy.apply(body({ strength: 2, range: 0 }), p, env());
  assert.equal(p.vy, 0);
});

test('buoyancy: hot/light matter rises (−y)', () => {
  const p = part({ size: 1, heat: 1 }); // ρ_p = 0.5 < ρ_med → lift
  buoyancy.apply(body({ strength: 2, range: 0 }), p, env());
  assert.ok(near(p.vy, -1)); // −(1 − 0.5)·2
});

test('buoyancy: dense matter settles (+y)', () => {
  const p = part({ size: 0.5, heat: 0 }); // ρ_p = 2 > ρ_med → sink
  buoyancy.apply(body({ strength: 2, range: 0 }), p, env());
  assert.ok(near(p.vy, 2)); // −(1 − 2)·2
});

test('buoyancy: range 0 is global, range>0 cuts off', () => {
  const global = part({ size: 1, heat: 1 });
  buoyancy.apply(body({ strength: 2, range: 0 }), global, env({ dist: 9999 }));
  assert.ok(near(global.vy, -1)); // still acts far away
  const ranged = part({ size: 1, heat: 1 });
  buoyancy.apply(body({ strength: 2, range: 100 }), ranged, env({ dist: 200 }));
  assert.equal(ranged.vy, 0); // beyond range → inert
});
