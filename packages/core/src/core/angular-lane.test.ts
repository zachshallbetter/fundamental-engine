import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FieldStore } from './field-store.ts';
import { step, FRICTION } from './integrator.ts';
import { accumulateAt } from '../diagnostics/probes.ts';
import type { Body, Env, Particle, Force } from './types.ts';

const makeEnv = (over: Partial<Env> = {}): Env => ({
  dx: 0, dy: 0, dist: 1, form: { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0 },
  W: 1000, H: 800, t: 0, frameN: 1, dt: 1, c: 12, G: 1,
  spark: () => {}, supernova: () => {}, spawn: () => {}, neighbors: () => [],
  grid: () => ({ sample: () => 0, deposit: () => {}, gradient: () => ({ x: 0, y: 0 }) }),
  ...over,
});
const makeP = (over: Partial<Particle> = {}): Particle => ({ x: 100, y: 100, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: null, ...over });
const makeBody = (over: Partial<Body> = {}): Body => ({
  el: null as unknown as HTMLElement, tokens: [], strength: 1, range: 300, absorbR: 64, capacity: 60,
  spin: 1, angle: 0, ux: 1, uy: 0, when: '', feedback: false, fmin: 0, fmax: 0, opsz: '', M: 1,
  cx: 100, cy: 100, hw: 50, hh: 20, on: false, vis: true, accreted: 0, count: 0, d: 0, ...over,
});

// a minimal torque-like force (test-only): imparts angular velocity (spin about z).
const torque: Force = { token: 'torque', apply: (_b, p) => { p.spin = (p.spin ?? 0) + 0.3; } } as Force;

test('angular: a torque-like force records an angular-channel contribution into acc.angular.z', () => {
  const acc = accumulateAt({ torque }, ['torque'], makeBody(), 100, 100);
  const ang = acc.attribution.find((a) => a.channel === 'angular' && a.force === 'torque');
  assert.ok(ang, 'angular attribution recorded');
  assert.ok(Math.abs((ang!.contribution as number) - 0.3) < 1e-9, 'Δspin captured');
  assert.ok(acc.angular && Math.abs(acc.angular.z - 0.3) < 1e-9, 'net spin in the z component of the angular lane');
  assert.equal(acc.angular!.x, 0);
});

test('angular: the integrator advances orient by spin and damps spin (only when spin is defined)', () => {
  const store = new FieldStore();
  const p = makeP({ spin: 0.5 }); // given angular velocity
  store.add(p);
  step({ store, bodies: [], env: makeEnv(), forces: {}, conditions: {} });
  assert.ok(Math.abs((p.orient ?? 0) - 0.5) < 1e-9, 'orient += spin·dt (0 + 0.5·1)');
  assert.ok(Math.abs(p.spin! - 0.5 * FRICTION) < 1e-9, 'spin damped by FRICTION');
});

test('angular: a spin-less particle stays inert — orient/spin untouched (behavior-preserving)', () => {
  const store = new FieldStore();
  const p = makeP({ vx: 1 });
  store.add(p);
  step({ store, bodies: [], env: makeEnv(), forces: {}, conditions: {} });
  assert.equal(p.spin, undefined, 'no spin introduced');
  assert.equal(p.orient, undefined, 'no orientation introduced');
});
