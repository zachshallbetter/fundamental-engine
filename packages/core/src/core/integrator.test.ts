import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FieldStore } from './field-store.ts';
import { step, FRICTION, HEAT_DECAY } from './integrator.ts';
import type { Body, Env, Particle } from './types.ts';

const makeEnv = (over: Partial<Env> = {}): Env => ({
  dx: 0,
  dy: 0,
  dist: 1,
  form: { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0 },
  W: 1000,
  H: 800,
  t: 0,
  frameN: 1,
  dt: 1,
  c: 12,
  G: 1,
  spark: () => {},
  supernova: () => {},
  spawn: () => {},
  neighbors: () => [],
  grid: () => ({ sample: () => 0, deposit: () => {}, gradient: () => ({ x: 0, y: 0 }) }),
  ...over,
});

const makeP = (over: Partial<Particle> = {}): Particle => ({
  x: 100,
  y: 100,
  vx: 0,
  vy: 0,
  m: 1,
  heat: 0,
  size: 1,
  cap: null,
  ...over,
});

const run = (p: Particle, env: Env): void => {
  const store = new FieldStore();
  store.add(p);
  step({ store, bodies: [], env, forces: {}, conditions: {} });
};

test('friction decays velocity each tick', () => {
  const p = makeP({ vx: 2, vy: 0 });
  run(p, makeEnv());
  assert.ok(Math.abs(p.vx - 2 * FRICTION) < 1e-9);
});

test('position advances by velocity before damping', () => {
  const p = makeP({ x: 100, y: 100, vx: 5, vy: -3 });
  run(p, makeEnv());
  assert.ok(Math.abs(p.x - 105) < 1e-9);
  assert.ok(Math.abs(p.y - 97) < 1e-9);
});

test('reduced motion (dt = 0) freezes the sim', () => {
  const p = makeP({ x: 100, vx: 5, heat: 1 });
  run(p, makeEnv({ dt: 0 }));
  assert.equal(p.x, 100);
  assert.equal(p.vx, 5);
  assert.equal(p.heat, 1);
});

test('heat decays toward zero', () => {
  const p = makeP({ heat: 1 });
  run(p, makeEnv());
  assert.ok(Math.abs(p.heat - HEAT_DECAY) < 1e-9);
});

test('driftX adds a lateral current', () => {
  const p = makeP({ vx: 0 });
  run(p, makeEnv({ form: { driftX: 1, wander: 0, orbit: 0, spread: 0, conv: 0 } }));
  assert.ok(p.vx > 0);
});

test('particles wrap at the edges (count conserved)', () => {
  const p = makeP({ x: 1015, y: 100, vx: 0 });
  run(p, makeEnv());
  assert.equal(p.x, -10); // W + EDGE = 1010 → wraps to -EDGE
});

test('spread pulls toward an even-scatter target (§7)', () => {
  const p = makeP({ x: 0, y: 100, vx: 0, gx: 0.5, gy: 0.5 });
  run(p, makeEnv({ form: { driftX: 0, wander: 0, orbit: 0, spread: 0.6, conv: 0 } }));
  assert.ok(p.vx > 0); // target tx ≈ 0.5·W = 500, to the right
});

test('conv converges toward the accretion node (§7)', () => {
  const store = new FieldStore();
  const p = store.add(makeP({ x: 0, y: 0, vx: 0 }));
  const core = { cx: 500, cy: 0, tokens: ['absorb'], vis: true, when: '' } as unknown as Body;
  step({
    store,
    bodies: [core],
    env: makeEnv({ form: { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0.6 } }),
    forces: {},
    conditions: {},
  });
  assert.ok(p.vx > 0); // pulled toward the core at +x
});
