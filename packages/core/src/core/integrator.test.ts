import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FieldStore } from './field-store.ts';
import { step, FRICTION, HEAT_DECAY } from './integrator.ts';
import type { Body, Env, Particle, Force } from './types.ts';
import { resonate, spotlight } from '../forces/extended.ts';
import { attract, jet, wall } from '../forces/index.ts';

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

const runBodies = (p: Particle, bodies: Body[], forces: Record<string, Force>, env: Env): void => {
  const store = new FieldStore();
  store.add(p);
  step({ store, bodies, env, forces, conditions: {} });
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
  const core = { cx: 500, cy: 0, tokens: ['sink'], vis: true, when: '' } as unknown as Body;
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

test('a frozen step (dt = 0, reduced motion) drains b.count instead of leaving it stale (#967)', () => {
  const store = new FieldStore();
  store.add(makeP({ x: 100, y: 100 })); // on the body centre → contributes density
  const body = {
    tokens: ['attract'], vis: true, when: '', on: false, feedback: true,
    cx: 100, cy: 100, range: 200, count: 0, d: 0,
  } as unknown as Body;
  // live tick: the body accumulates local density.
  step({ store, bodies: [body], env: makeEnv(), forces: {}, conditions: {} });
  assert.ok(body.count > 0, 'live step accumulates a non-zero count');
  const live = body.count;
  // motion freezes (reduced-motion / maxMotionBudget 0 → dt = 0). The integrator early-returns,
  // but the density bookkeeping must still drain: writeFeedback() runs every frame regardless, so a
  // stale count would keep `--d` elevated forever from a sim that is no longer running.
  step({ store, bodies: [body], env: makeEnv({ dt: 0 }), forces: {}, conditions: {} });
  assert.equal(body.count, 0, 'a dt=0 step re-zeros the count (does not hold the last live value)');
  assert.notEqual(live, body.count, 'the frozen count is not the stale live value');
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

// ── first-class mass (§21.3): additive forces scale by 1/m; kinematic forces don't ──

test('mass scales an additive force (attract) by 1/m', () => {
  // attract adds acceleration toward the body; a 4× heavier particle gains ¼ the velocity.
  const bodies = [makeBody({ tokens: ['attract'], cx: 300, cy: 100, range: 300, strength: 1 })];
  const light = makeP({ x: 100, y: 100, m: 1 });
  const heavy = makeP({ x: 100, y: 100, m: 4 });
  runBodies(light, bodies, { attract }, makeEnv());
  runBodies(heavy, bodies, { attract }, makeEnv());
  assert.ok(light.vx > 0 && heavy.vx > 0, 'both pulled toward the body at +x');
  assert.ok(Math.abs(heavy.vx - light.vx / 4) < 1e-12, `heavy ${heavy.vx} vs light/4 ${light.vx / 4}`);
});

test('mass leaves a kinematic relaunch (jet) at full speed regardless of m', () => {
  // jet relaunches matter at a fixed nozzle speed; inertia must not slow the launch.
  const bodies = [makeBody({ tokens: ['jet'], cx: 100, cy: 100, strength: 1 })];
  const light = makeP({ x: 100, y: 100, m: 1 });
  const heavy = makeP({ x: 100, y: 100, m: 4 });
  runBodies(light, bodies, { jet }, makeEnv());
  runBodies(heavy, bodies, { jet }, makeEnv());
  const sLight = Math.hypot(light.vx, light.vy);
  const sHeavy = Math.hypot(heavy.vx, heavy.vy);
  // nozzle speed (2.4 + 1·2.6 = 5) × friction 0.95 = 4.75, independent of mass and cone angle.
  assert.ok(Math.abs(sLight - sHeavy) < 1e-9, `light ${sLight} vs heavy ${sHeavy}`);
  assert.ok(sHeavy > 4.5, `heavy launched at ${sHeavy}; the old 1/m bug would give ~1.2`);
});

test('mass leaves a wall bounce a true reflection', () => {
  // a heavy particle driven into a wall must bounce back, not pass through (the old bug).
  const bodies = [makeBody({ tokens: ['wall'], range: 0, cx: 100, cy: 100, hw: 50, hh: 20 })];
  const heavy = makeP({ x: 145, y: 100, vx: 2, vy: 0, m: 4 });
  runBodies(heavy, bodies, { wall }, makeEnv());
  assert.ok(heavy.vx < 0, `vx ${heavy.vx} should reflect negative, not keep driving into the wall`);
  // reflect (−2 × 0.85 = −1.7) then friction × 0.95 = −1.615, mass-independent.
  assert.ok(Math.abs(heavy.vx - -1.615) < 1e-9, `vx ${heavy.vx}`);
});

// ── the `screen` modifier (workover v0.3): cross-body attenuation in the force pass ──

test('screen damps another body\'s force on matter inside its radius — and not outside', () => {
  // probe reads the effective strength, so the attenuation is measured exactly.
  const probe: Force = { token: 'probe', label: 'P', apply: (b, p) => void (p.vx += b.strength) };
  const screenBody = makeBody({ tokens: ['screen'], cx: 300, cy: 100, range: 200, strength: 1, screenMin: 0 });
  const wellNear = makeBody({ tokens: ['probe'], cx: 450, cy: 100, range: 600, strength: 1 });

  // inside the quiet zone (at the screen's core): factor = 1 − 1·1 = 0 → no force at all.
  const inside = makeP({ x: 300, y: 100, vx: 0 });
  runBodies(inside, [screenBody, wellNear], { probe }, makeEnv());
  assert.equal(inside.vx, 0, `inside the screen core the force must vanish (got ${inside.vx})`);

  // outside the radius (600px from the screen): untouched — plain probe strength × friction.
  const outside = makeP({ x: 900, y: 100, vx: 0 });
  const wellFar = makeBody({ tokens: ['probe'], cx: 1000, cy: 100, range: 600, strength: 1 });
  runBodies(outside, [screenBody, wellFar], { probe }, makeEnv());
  assert.ok(Math.abs(outside.vx - 1 * FRICTION) < 1e-12, `outside must be unattenuated (got ${outside.vx})`);
});

test('screen falloff is smooth toward the edge (no hard cliff) and data-screen-min clamps the floor', () => {
  const probe: Force = { token: 'probe', label: 'P', apply: (b, p) => void (p.vx += b.strength) };
  const mkRun = (px: number, screenMin: number): number => {
    const screenBody = makeBody({ tokens: ['screen'], cx: 300, cy: 100, range: 200, strength: 1, screenMin });
    const well = makeBody({ tokens: ['probe'], cx: px + 10, cy: 100, range: 600, strength: 1 });
    const p = makeP({ x: px, y: 100, vx: 0 });
    runBodies(p, [screenBody, well], { probe }, makeEnv());
    return p.vx / FRICTION; // the effective strength the probe felt
  };
  // monotonic recovery toward the edge: deeper in the zone = stronger attenuation.
  const at50 = mkRun(350, 0); // d = 50 → factor 1 − (0.75)² = 0.4375
  const at150 = mkRun(450, 0); // d = 150 → factor 1 − (0.25)² = 0.9375
  const at199 = mkRun(499, 0); // d = 199 → factor ≈ 1 (smooth approach, no cliff)
  assert.ok(Math.abs(at50 - 0.4375) < 1e-9, `factor at d=50: ${at50}`);
  assert.ok(Math.abs(at150 - 0.9375) < 1e-9, `factor at d=150: ${at150}`);
  assert.ok(at199 > 0.9999 && at199 <= 1, `factor at the edge approaches 1 smoothly: ${at199}`);
  // the min clamp holds at the core
  const clamped = mkRun(300, 0.25);
  assert.ok(Math.abs(clamped - 0.25) < 1e-9, `data-screen-min floors the factor: ${clamped}`);
});

test('a screen never attenuates its own siblings (it shields against OTHER bodies)', () => {
  const probe: Force = { token: 'probe', label: 'P', apply: (b, p) => void (p.vx += b.strength) };
  const screenWithProbe = makeBody({ tokens: ['screen', 'probe'], cx: 300, cy: 100, range: 200, strength: 1, screenMin: 0 });
  const p = makeP({ x: 300, y: 100, vx: 0 });
  runBodies(p, [screenWithProbe], { probe }, makeEnv());
  assert.ok(Math.abs(p.vx - 1 * FRICTION) < 1e-12, `own siblings stay at full strength (got ${p.vx})`);
});

// ── the modifier contract (workover v0.3): order-independent composition ──

test('modifier determinism: authored token order does not change the outcome', () => {
  const probe: Force = { token: 'probe', label: 'P', apply: (b, p) => void (p.vx += b.strength) };
  const runOrder = (tokens: string[]): number => {
    const body = makeBody({ tokens, cx: 200, cy: 100, range: 300, strength: 2, spin: 1, ux: 1, uy: 0 });
    const p = makeP({ x: 300, y: 100, vx: 0 }); // ahead of the heading → inside the cone
    runBodies(p, [body], { resonate, spotlight, probe }, makeEnv({ t: Math.PI / 6 })); // resonate ×2
    return p.vx;
  };
  const a = runOrder(['spotlight', 'resonate', 'probe']);
  const b = runOrder(['resonate', 'probe', 'spotlight']);
  const c = runOrder(['probe', 'spotlight', 'resonate']);
  assert.ok(a > 0, 'the cone admits the particle and resonate amplifies');
  assert.equal(a, b);
  assert.equal(b, c);
});

test('the parser-classified sets are honored; bodies built without them are memoized lazily', () => {
  // a body built raw (no classified field — the conformance/test path) still runs the
  // modifier pass correctly: the integrator memoizes classification on first touch.
  const body = makeBody({ tokens: ['resonate', 'probe'], cx: 200, cy: 100, range: 300, strength: 2, spin: 1 });
  assert.equal(body.classified, undefined);
  const probe: Force = { token: 'probe', label: 'P', apply: (b, p) => void (p.vx += b.strength) };
  const p = makeP({ x: 300, y: 100 });
  runBodies(p, [body], { resonate, probe }, makeEnv({ t: Math.PI / 6 }));
  assert.deepEqual(body.classified?.modifiers, ['resonate']);
  assert.deepEqual(body.classified?.forces, ['probe']);
});
