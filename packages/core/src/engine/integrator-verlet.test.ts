/**
 * Velocity-Verlet integrator mode (#659) — the opt-in second-order scheme.
 *
 * Pins: (1) the default ('legacy') trajectory is untouched by the new code paths; (2) pure
 * drift (a = 0) reduces exactly to the legacy step; (3) the half-step average follows the
 * stored-acceleration equations (`x += v·dt + ½·a·dt²`, then `v += ½·(a + a′)·dt`) to the
 * digit; (4) a kinematic (velocity-REPLACING) force is treated as a discontinuity — never
 * averaged — and resets the stored acceleration; (5) the particle-count invariant holds over
 * a long forced run (the one strong invariant of the caveat canon).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FieldStore } from './field-store.ts';
import { step, FRICTION } from './integrator.ts';
import type { Body, Env, Force, Particle } from './types.ts';
import { attract } from '../forces/index.ts';

// Minimal harness (mirrors integrator-fixed.test.ts / accumulator.test.ts).
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

// the attract body used throughout: at (100,100) vs cx 250 the frame-0 Δvx is exactly 0.125
// (the same geometry integrator-fixed.test.ts / accumulator.test.ts pin).
const attractBody = () => makeBody({ tokens: ['attract'], cx: 250, cy: 100 });

test('verlet: pure drift (no forces, a = 0) reduces exactly to the legacy step', () => {
  const legacy = makeP({ vx: 2 });
  run(legacy, [], {}, makeEnv());
  const verlet = makeP({ vx: 2 });
  run(verlet, [], {}, makeEnv({ integrator: 'velocity-verlet' }));
  // Δv = 0 and a(t) = 0 ⇒ x += v·dt and v(t+dt) = v(t), then the same (dt = 1) decay.
  assert.equal(verlet.x, legacy.x, 'x identical with no acceleration');
  assert.equal(verlet.vx, legacy.vx, 'vx identical with no acceleration');
  assert.equal(legacy.x, 102, 'sanity: drift moved v·dt');
  assert.equal(legacy.vx, 2 * FRICTION, 'sanity: one decay applied');
});

test('verlet: default-mode trajectory is unchanged (the classic semi-implicit step, to the digit)', () => {
  // The golden regen is the cross-plane proof; this pins the same fact in-tree. Legacy order is
  // forces → x += v·dt → decay, so from rest under attract: vx = Δv, x += Δv·dt, vx *= FRICTION.
  const p = makeP();
  run(p, [attractBody()], { attract }, makeEnv());
  assert.equal(p.x, 100.125, 'legacy position: x += Δv·dt with Δv = 0.125');
  assert.equal(p.vx, 0.125 * FRICTION, 'legacy velocity: Δv then one decay');
});

test('verlet: the half-step average follows the stored-acceleration equations exactly', () => {
  // From rest with no stored acceleration: the position full-step is a no-op (v = a = 0), the
  // force pass lands Δv = 0.125 at the unmoved position, and the half-step average takes half:
  // v = v0 + ½(a·dt + Δv) = 0.0625, then the dt-scaled decay (dt = 1 ⇒ ·FRICTION). The pass's
  // Δv/dt is stored as a(t) for the next step.
  const p = makeP();
  run(p, [attractBody()], { attract }, makeEnv({ integrator: 'velocity-verlet' }));
  assert.equal(p.x, 100, 'step 1 position full-step is a no-op from rest');
  assert.equal(p.vx, 0.0625 * FRICTION, 'v(t+dt) = ½·Δv, then one decay');
  assert.equal(p.ax, 0.125, 'the pass Δv/dt is stored as a(t) for the next step');
  // Step 2: the position full-step now carries both lanes — x += v·dt + ½·a·dt².
  const v1 = p.vx;
  const env2 = makeEnv({ integrator: 'velocity-verlet', frameN: 2 });
  run(p, [attractBody()], { attract }, env2);
  const expectedX = 100 + v1 * 1 + 0.5 * 0.125 * 1 * 1;
  assert.ok(Math.abs(p.x - expectedX) < 1e-12, `step 2 x = x + v·dt + ½·a·dt² (${p.x} vs ${expectedX})`);
});

test('verlet: matter accelerates toward an attracting body; the trajectory is second-order (differs from legacy)', () => {
  const legacy = makeP();
  const verlet = makeP();
  for (let i = 1; i <= 5; i++) {
    run(legacy, [attractBody()], { attract }, makeEnv({ frameN: i }));
    run(verlet, [attractBody()], { attract }, makeEnv({ frameN: i, integrator: 'velocity-verlet' }));
  }
  assert.ok(legacy.x > 100 && verlet.x > 100, 'both schemes move toward the body');
  assert.ok(Number.isFinite(verlet.x) && Number.isFinite(verlet.vx), 'verlet stays finite');
  assert.notEqual(verlet.x, legacy.x, 'the second-order trajectory differs from semi-implicit Euler');
});

test('verlet: a kinematic (velocity-replacing) force is a discontinuity — never averaged', () => {
  // A kinematic force REPLACES velocity (a bounce/relaunch). Averaging it with v(t) would gut
  // the reflection (a head-on bounce would stall near 0) — the mode must let it stand and reset
  // the stored acceleration so the next position step doesn't extrapolate across the break.
  const relaunch: Force = {
    token: 'relaunch',
    label: 'Relaunch',
    kinematic: true,
    apply(_b, p) {
      p.vx = -5;
    },
  };
  const p = makeP({ vx: 2, ax: 0.4 }); // a stored acceleration that must be dropped
  run(p, [makeBody({ tokens: ['relaunch'] })], { relaunch }, makeEnv({ integrator: 'velocity-verlet' }));
  assert.equal(p.vx, -5 * FRICTION, 'the replaced velocity stands (only the decay applies)');
  assert.equal(p.ax, 0, 'the stored acceleration resets at the discontinuity');
});

test('verlet: the particle-count invariant holds over a long forced run', () => {
  const store = new FieldStore();
  for (let i = 0; i < 24; i++)
    store.add(makeP({ x: 40 * (i + 1), y: 60 + 25 * i, vx: (i % 5) - 2, vy: (i % 3) - 1 }));
  const before = store.particles.length;
  for (let i = 1; i <= 50; i++) {
    step({
      store,
      bodies: [attractBody()],
      env: makeEnv({ frameN: i, t: i / 60, integrator: 'velocity-verlet' }),
      forces: { attract },
      conditions: {},
    });
  }
  assert.equal(store.particles.length, before, 'no matter created or destroyed');
  for (const p of store.particles) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), 'positions stay finite');
    assert.ok(Number.isFinite(p.vx) && Number.isFinite(p.vy), 'velocities stay finite');
  }
});
