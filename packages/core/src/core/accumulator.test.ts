import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FieldStore } from './field-store.ts';
import { step, makeAccumulator, FRICTION } from './integrator.ts';
import type { Body, Env, Particle, Force } from './types.ts';
import { attract, swirl } from '../forces/index.ts';

// Minimal harness (mirrors integrator.test.ts).
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

const runOne = (p: Particle, bodies: Body[], forces: Record<string, Force>, env: Env): void => {
  const store = new FieldStore();
  store.add(p);
  step({ store, bodies, env, forces, conditions: {} });
};

test('accum: applyForce records per-force linear attribution (doc 04)', () => {
  // particle at (100,100), body 150px to the right, range 300, strength 1:
  // attract Δvx = (1 − 150/300)² · 1 · 0.5 = 0.125.
  const body = makeBody({ tokens: ['attract'], cx: 250, cy: 100 });
  const p = makeP({ x: 100, y: 100 });
  const env = makeEnv({ accum: makeAccumulator() });
  runOne(p, [body], { attract }, env);

  const attr = env.accum!.attribution.filter((a) => a.force === 'attract');
  assert.equal(attr.length, 1, 'exactly one attract contribution recorded');
  assert.equal(attr[0]!.channel, 'linear');
  const c = attr[0]!.contribution as { x: number; y: number; z: number };
  assert.ok(Math.abs(c.x - 0.125) < 1e-9, `attract Δvx ≈ 0.125, got ${c.x}`);
  assert.ok(Math.abs(env.accum!.linear.x - 0.125) < 1e-9, 'net linear.x ≈ 0.125');
});

test('accum: a composite records each force separately', () => {
  const body = makeBody({ tokens: ['attract', 'swirl'], cx: 250, cy: 100, spin: 1 });
  const env = makeEnv({ accum: makeAccumulator() });
  runOne(makeP(), [body], { attract, swirl }, env);
  const tokens = env.accum!.attribution.map((a) => a.force);
  assert.ok(tokens.includes('attract'), 'attract attributed');
  assert.ok(tokens.includes('swirl'), 'swirl attributed');
});

test('accum: is behavior-preserving — does not change motion', () => {
  const motion = (withAccum: boolean): Particle => {
    const body = makeBody({ tokens: ['attract', 'swirl'], cx: 250, cy: 100 });
    const p = makeP({ x: 100, y: 100 });
    runOne(p, [body], { attract, swirl }, makeEnv(withAccum ? { accum: makeAccumulator() } : {}));
    return p;
  };
  const withAcc = motion(true);
  const without = motion(false);
  assert.equal(withAcc.vx, without.vx, 'vx identical with/without accum');
  assert.equal(withAcc.vy, without.vy, 'vy identical with/without accum');
});

test('accum: the default hot path leaves the accumulator absent (zero overhead)', () => {
  const env = makeEnv();
  runOne(makeP({ vx: 2 }), [], {}, env);
  assert.equal(env.accum, undefined, 'no accumulator unless explicitly provided');
  // friction still applies on the default path, proving step() ran normally.
});

void FRICTION;
