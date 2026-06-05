import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FieldStore } from './field-store.ts';
import { step, FRICTION, HEAT_DECAY } from './integrator.ts';
import type { Body, Env, Particle, Force } from './types.ts';
import { resonate, spotlight } from '../forces/extended.ts';

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

test('the velocity cap clamps a free particle to env.c before integrating (§20.10)', () => {
  const p = makeP({ x: 100, y: 100, vx: 1000, vy: -1000 }); // wildly over the cap
  run(p, makeEnv({ c: 12 }));
  const speed = Math.hypot(p.vx, p.vy);
  // clamped to 12, then damped by FRICTION → 12·0.95; far below the uncapped ~1342.
  assert.ok(speed <= 12 + 1e-9, `speed ${speed} exceeds the cap`);
  assert.ok(Math.abs(speed - 12 * FRICTION) < 1e-6, 'capped, then damped');
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
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

test('a feedback body accumulates local density into b.count (§8)', () => {
  const store = new FieldStore();
  store.add(makeP({ x: 100, y: 100 })); // on the body centre
  const body = {
    tokens: ['attract'], vis: true, when: '', on: false, feedback: true,
    cx: 100, cy: 100, range: 200, count: 0,
  } as unknown as Body;
  step({ store, bodies: [body], env: makeEnv(), forces: {}, conditions: {} });
  assert.ok(body.count > 0); // particle within range·0.5 contributed
});

test('modifier pass: resonate scales the sibling strength, then restores it (§20.3)', () => {
  let seen = -1;
  const probe: Force = { token: 'probe', label: 'P', apply: (b) => void (seen = b.strength) };
  const store = new FieldStore();
  store.add(makeP({ x: 100, y: 100 }));
  const body = {
    tokens: ['resonate', 'probe'], vis: true, when: '', on: false, feedback: false,
    strength: 2, spin: 1, range: 300, cx: 200, cy: 100, count: 0,
  } as unknown as Body;
  // env.t = π/6 → ω·t = π/2 → multiplier 1 + sin = 2, so probe sees 2·2 = 4
  step({ store, bodies: [body], env: makeEnv({ t: Math.PI / 6 }), forces: { resonate, probe }, conditions: {} });
  assert.ok(Math.abs(seen - 4) < 1e-6);
  assert.equal(body.strength, 2); // restored after the frame
});

test('modifier pass: spotlight gates siblings outside the heading cone (§20.3)', () => {
  let applied = false;
  const probe: Force = { token: 'probe', label: 'P', apply: () => void (applied = true) };
  const mkBody = () =>
    ({
      tokens: ['spotlight', 'probe'], vis: true, when: '', on: false, feedback: false,
      strength: 1, spin: 1, range: 300, ux: 1, uy: 0, cx: 200, cy: 100, count: 0,
    }) as unknown as Body;
  // particle ahead (+x of the body, along the heading) → inside the cone → applied
  const ahead = new FieldStore();
  ahead.add(makeP({ x: 300, y: 100 }));
  step({ store: ahead, bodies: [mkBody()], env: makeEnv(), forces: { spotlight, probe }, conditions: {} });
  assert.equal(applied, true);
  // particle behind the heading → gated → not applied
  applied = false;
  const behind = new FieldStore();
  behind.add(makeP({ x: 100, y: 100 }));
  step({ store: behind, bodies: [mkBody()], env: makeEnv(), forces: { spotlight, probe }, conditions: {} });
  assert.equal(applied, false);
});

test('first-class mass: body forces accelerate by a = F/m (§21.3)', () => {
  const push: Force = { token: 'push', label: 'P', apply: (_b, p) => void (p.vx += 4) };
  const mkBody = () =>
    ({
      tokens: ['push'], vis: true, when: '', on: false, feedback: false,
      strength: 1, range: 300, cx: 150, cy: 100, count: 0,
    }) as unknown as Body;
  const light = new FieldStore();
  const pL = makeP({ x: 100, y: 100, vx: 0, m: 1 });
  light.add(pL);
  step({ store: light, bodies: [mkBody()], env: makeEnv(), forces: { push }, conditions: {} });
  const heavy = new FieldStore();
  const pH = makeP({ x: 100, y: 100, vx: 0, m: 2 });
  heavy.add(pH);
  step({ store: heavy, bodies: [mkBody()], env: makeEnv(), forces: { push }, conditions: {} });
  assert.ok(pL.vx > 0); // unit mass takes the full kick
  assert.ok(Math.abs(pH.vx - pL.vx / 2) < 1e-9); // twice the mass → half the acceleration
});

test('mortal matter ages and despawns at its lifespan (the class-[S] sink)', () => {
  const store = new FieldStore();
  const mortal = makeP({ age: 2 }); // two ticks to live
  const immortal = makeP({}); // no age → the conserved base field
  store.add(mortal);
  store.add(immortal);
  step({ store, bodies: [], env: makeEnv(), forces: {}, conditions: {} });
  assert.equal(store.size, 2); // age 2 → 1, still alive
  assert.equal(mortal.age, 1);
  step({ store, bodies: [], env: makeEnv(), forces: {}, conditions: {} });
  assert.equal(store.size, 1); // age 1 → 0 → despawned
  assert.equal(store.particles[0], immortal); // the immortal base particle remains
});

test('the source pass runs a force.source() once per body per frame (class [S])', () => {
  const store = new FieldStore();
  store.add(makeP({})); // one existing particle — a source must NOT fire per-particle
  let calls = 0;
  const src: Force = {
    token: 'src',
    label: 'S',
    apply: () => {},
    source: (_b, e) => {
      calls++;
      e.spawn({ x: 0, y: 0 });
    },
  };
  const collected: Partial<Particle>[] = [];
  const body = { tokens: ['src'], vis: true, when: '', on: true, strength: 1, range: 300, cx: 0, cy: 0, count: 0 } as unknown as Body;
  step({ store, bodies: [body], env: makeEnv({ spawn: (p) => void collected.push(p) }), forces: { src }, conditions: {} });
  assert.equal(calls, 1); // once for the body, not once per particle
  assert.equal(collected.length, 1);
});
