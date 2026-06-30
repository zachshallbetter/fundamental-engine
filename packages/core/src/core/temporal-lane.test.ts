import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAndRecord, makeAccumulator } from './integrator.ts';
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

// a test-only decay-like force: hastens a MORTAL particle's despawn by spending 2 frames of life.
const wither: Force = { token: 'wither', apply: (_b, p) => { if (p.age !== undefined) p.age -= 2; } } as Force;

test('temporal: a force that changes mortal age records a temporal/decay contribution', () => {
  const acc = makeAccumulator();
  const p = makeP({ age: 30 });
  applyAndRecord(wither, makeBody(), p, makeEnv({ accum: acc }));
  const tmp = acc.attribution.find((a) => a.channel === 'temporal' && a.force === 'wither');
  assert.ok(tmp, 'temporal attribution recorded');
  assert.ok(Math.abs((tmp!.contribution as number) - -2) < 1e-9, 'Δage captured (−2 frames of life)');
  assert.ok(acc.temporal && Math.abs((acc.temporal.decay ?? 0) - -2) < 1e-9, 'net Δage in temporal.decay');
  assert.equal(p.age, 28, 'the force still aged the particle (capture is read-only)');
});

test('temporal: an immortal particle (no age) never engages the lane — byte-identical', () => {
  const acc = makeAccumulator();
  const p = makeP(); // no age ⇒ immortal
  applyAndRecord(wither, makeBody(), p, makeEnv({ accum: acc }));
  assert.equal(acc.temporal, undefined, 'no temporal channel for immortal matter');
  assert.ok(!acc.attribution.some((a) => a.channel === 'temporal'), 'no temporal attribution');
  assert.equal(p.age, undefined, 'age stays undefined');
});

test('temporal capture does not alter the force outcome (behavior-preserving)', () => {
  const withAccum = makeP({ age: 30 });
  const withoutAccum = makeP({ age: 30 });
  applyAndRecord(wither, makeBody(), withAccum, makeEnv({ accum: makeAccumulator() }));
  applyAndRecord(wither, makeBody(), withoutAccum, makeEnv()); // accum undefined
  assert.equal(withAccum.age, withoutAccum.age, 'identical age whether or not the accumulator is on');
});
