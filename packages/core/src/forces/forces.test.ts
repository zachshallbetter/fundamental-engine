import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  attract,
  repel,
  vortex,
  stream,
  drag,
  emitter,
  spring,
  reflect,
  absorb,
  coreForces,
} from './index.ts';
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

test('registry exposes the canonical nine', () => {
  assert.equal(coreForces.length, 9);
});

test('attract pulls toward the body (§6.1)', () => {
  const p = part();
  attract.apply(body({ range: 300, strength: 1 }), p, env({ dx: 150, dy: 0, dist: 150 }));
  assert.ok(near(p.vx, 0.125)); // (1−0.5)²·1·0.5
  assert.ok(near(p.vy, 0));
});

test('attract is inert beyond range', () => {
  const p = part();
  attract.apply(body({ range: 300 }), p, env({ dx: 350, dy: 0, dist: 350 }));
  assert.equal(p.vx, 0);
});

test('repel pushes away (§6.6)', () => {
  const p = part();
  repel.apply(body({ range: 300, strength: 1 }), p, env({ dx: 150, dy: 0, dist: 150 }));
  assert.ok(near(p.vx, -0.125));
});

test('vortex applies tangential force + slight inward (§6.8)', () => {
  const p = part();
  vortex.apply(body({ range: 320, strength: 1, spin: 1 }), p, env({ dx: 100, dy: 0, dist: 100 }));
  assert.ok(p.vy < 0); // tangential (clockwise for spin>0)
  assert.ok(p.vx > 0); // inward retention holds shape
  assert.ok(near(p.vy, -0.2663, 1e-2));
});

test('stream blows along the heading (§6.5)', () => {
  const p = part();
  stream.apply(body({ range: 340, strength: 1, ux: 1, uy: 0 }), p, env({ dx: 100, dy: 0, dist: 100 }));
  assert.ok(near(p.vx, 0.3408, 1e-2));
  assert.ok(near(p.vy, 0));
});

test('drag bleeds momentum without redirection (§6.7)', () => {
  const p = part({ vx: 10 });
  drag.apply(body({ range: 300, strength: 1 }), p, env({ dx: 150, dy: 0, dist: 150 }));
  assert.ok(near(p.vx, 9.4)); // 10·(1 − 0.5·0.12)
});

test('emitter feeds matter toward the nozzle (§6.2)', () => {
  const p = part();
  emitter.apply(body({ range: 300, strength: 1 }), p, env({ dx: 100, dy: 0, dist: 100 }));
  assert.ok(near(p.vx, 0.17778, 1e-3));
});

test('spring reels toward the rest shell (§6.3)', () => {
  const p = part();
  spring.apply(body({ range: 260, strength: 1 }), p, env({ dx: 200, dy: 0, dist: 200 }));
  assert.ok(near(p.vx, 0.78012, 1e-3)); // 44·0.018, then ·0.985
});

test('reflect bounces off the box and sparks hard hits (§6.4)', () => {
  let sparks = 0;
  const p = part({ x: 40, y: 0, vx: 2, vy: 0 });
  reflect.apply(
    body({ cx: 0, cy: 0, hw: 50, hh: 50 }),
    p,
    env({ spark: () => { sparks++; } })
  );
  assert.equal(p.x, 56); // pushed outside box+pad
  assert.ok(near(p.vx, -1.7)); // −v·0.85
  assert.ok(near(p.heat, 0.8)); // min(0.85, speed·0.4)
  assert.equal(sparks, 1);
});

test('reflect ignores particles outside the box', () => {
  const p = part({ x: 200, y: 0, vx: 2 });
  reflect.apply(body({ cx: 0, cy: 0, hw: 50, hh: 50 }), p, env());
  assert.equal(p.vx, 2);
});

test('absorb captures within radius, ignores beyond (§6.9)', () => {
  const b = body({ absorbR: 64, capacity: 60 });
  const p = part();
  absorb.apply(b, p, env({ dist: 50 }));
  assert.equal(p.cap, b);
  assert.equal(b.accreted, 1);
  const q = part();
  absorb.apply(b, q, env({ dist: 100 }));
  assert.equal(q.cap, null);
});

test('absorb supernovas at capacity (conserved release)', () => {
  let pops = 0;
  const b = body({ absorbR: 64, capacity: 1 });
  absorb.apply(b, part(), env({ dist: 50, supernova: () => { pops++; } }));
  assert.equal(pops, 1);
});
