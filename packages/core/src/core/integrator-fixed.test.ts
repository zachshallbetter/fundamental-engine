import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FieldStore } from './field-store.ts';
import { step, makeAccumulator, FRICTION } from './integrator.ts';
import type { Body, Env, Particle, Force } from './types.ts';
import { attract } from '../forces/index.ts';

// Minimal harness (mirrors accumulator.test.ts / integrator.test.ts).
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

const makeBody = (over: Partial<Body> = {}): Body => ({
  el: null as unknown as HTMLElement,
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
  cx: 100,
  cy: 100,
  hw: 50,
  hh: 20,
  on: false,
  vis: true,
  accreted: 0,
  count: 0,
  d: 0,
  ...over,
});

const run = (p: Particle, bodies: Body[], forces: Record<string, Force>, env: Env): void => {
  const store = new FieldStore();
  store.add(p);
  step({ store, bodies, env, forces, conditions: {} });
};

test('fixed: at dt === 1 the fixed integrator is byte-identical to legacy (no force)', () => {
  const legacy = makeP({ vx: 2 });
  run(legacy, [], {}, makeEnv({ dt: 1 }));
  const fixed = makeP({ vx: 2 });
  run(fixed, [], {}, makeEnv({ dt: 1, integrator: 'fixed' }));
  assert.equal(fixed.vx, legacy.vx, 'vx identical at dt=1');
  assert.equal(fixed.x, legacy.x, 'x identical at dt=1');
  assert.equal(legacy.vx, 2 * FRICTION, 'sanity: one decay applied');
});

test('fixed: damping is frame-rate independent (one dt=2 step == two dt=1 steps)', () => {
  const coarse = makeP({ vx: 2 });
  run(coarse, [], {}, makeEnv({ dt: 2, integrator: 'fixed' }));

  const fine = makeP({ vx: 2 });
  run(fine, [], {}, makeEnv({ dt: 1, integrator: 'fixed' }));
  run(fine, [], {}, makeEnv({ dt: 1, integrator: 'fixed' }));

  assert.ok(Math.abs(coarse.vx - fine.vx) < 1e-12, `decay matches across rates: ${coarse.vx} vs ${fine.vx}`);
  assert.ok(Math.abs(coarse.vx - 2 * Math.pow(FRICTION, 2)) < 1e-12, 'vx == 2·FRICTION² after a dt=2 step');
});

test('fixed: legacy stays frame-rate *dependent* (the bug the fixed mode fixes)', () => {
  const legacy = makeP({ vx: 2 });
  run(legacy, [], {}, makeEnv({ dt: 2 })); // legacy
  // legacy damps once per frame regardless of dt — so a dt=2 step still applies a single FRICTION.
  assert.equal(legacy.vx, 2 * FRICTION, 'legacy applies one decay no matter the dt');
});

test('fixed: an additive force impulse scales with dt', () => {
  // attract Δvx at this geometry is 0.125 per unit dt (see accumulator.test.ts).
  const at1 = makeAccumulator();
  run(makeP(), [makeBody({ tokens: ['attract'], cx: 250, cy: 100 })], { attract }, makeEnv({ dt: 1, integrator: 'fixed', accum: at1 }));
  assert.ok(Math.abs(at1.linear.x - 0.125) < 1e-9, `dt=1 impulse ≈ 0.125, got ${at1.linear.x}`);

  const at2 = makeAccumulator();
  run(makeP(), [makeBody({ tokens: ['attract'], cx: 250, cy: 100 })], { attract }, makeEnv({ dt: 2, integrator: 'fixed', accum: at2 }));
  assert.ok(Math.abs(at2.linear.x - 0.25) < 1e-9, `dt=2 impulse ≈ 0.25 (2× dt=1), got ${at2.linear.x}`);
});
