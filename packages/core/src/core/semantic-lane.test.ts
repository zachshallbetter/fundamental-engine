import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAndRecord, makeAccumulator } from './integrator.ts';
import { attract } from '../forces/index.ts';
import type { Body, Env, Particle } from './types.ts';

const makeEnv = (over: Partial<Env> = {}): Env => ({
  dx: 0, dy: 0, dist: 1, form: { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0 },
  W: 1000, H: 800, t: 0, frameN: 1, dt: 1, c: 12, G: 1,
  spark: () => {}, supernova: () => {}, spawn: () => {}, neighbors: () => [],
  grid: () => ({ sample: () => 0, deposit: () => {}, gradient: () => ({ x: 0, y: 0 }) }),
  ...over,
});
const makeP = (over: Partial<Particle> = {}): Particle => ({ x: 200, y: 100, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: null, ...over });
const makeBody = (over: Partial<Body> = {}): Body => ({
  el: null as unknown as HTMLElement, tokens: ['attract'], strength: 2, range: 400, absorbR: 64, capacity: 60,
  spin: 1, angle: 0, ux: 1, uy: 0, when: '', feedback: false, fmin: 0, fmax: 0, opsz: '', M: 1,
  cx: 100, cy: 100, hw: 50, hh: 20, on: false, vis: true, accreted: 0, count: 0, d: 0, ...over,
});

test('semantic: an attention-active body annotates its force with the attn multiplier', () => {
  const acc = makeAccumulator();
  applyAndRecord(attract, makeBody({ attn: 0.4 }), makeP(), makeEnv({ accum: acc }));
  const sem = acc.attribution.find((a) => a.channel === 'semantic' && a.force === 'attract');
  assert.ok(sem, 'semantic attribution recorded');
  assert.ok(Math.abs((sem!.contribution as number) - 0.4) < 1e-9, 'attn multiplier captured');
  assert.ok(acc.semantic && Math.abs((acc.semantic.attention ?? 0) - 0.4) < 1e-9, 'attention in acc.semantic');
});

test('semantic: a neutral body (attn 1 / undefined) never engages the lane — byte-identical', () => {
  const accNeutral = makeAccumulator();
  applyAndRecord(attract, makeBody({ attn: 1 }), makeP(), makeEnv({ accum: accNeutral }));
  assert.equal(accNeutral.semantic, undefined, 'attn 1 ⇒ no semantic channel');

  const accNone = makeAccumulator();
  applyAndRecord(attract, makeBody(), makeP(), makeEnv({ accum: accNone })); // attn undefined
  assert.equal(accNone.semantic, undefined, 'attn undefined ⇒ no semantic channel');
  assert.ok(!accNone.attribution.some((a) => a.channel === 'semantic'), 'no semantic attribution');
});

test('semantic capture does not alter the motion (behavior-preserving)', () => {
  const withSem = makeP();
  const without = makeP();
  applyAndRecord(attract, makeBody({ attn: 0.5 }), withSem, makeEnv({ accum: makeAccumulator() }));
  applyAndRecord(attract, makeBody({ attn: 0.5 }), without, makeEnv()); // accum off
  assert.ok(Math.abs(withSem.vx - without.vx) < 1e-12 && Math.abs(withSem.vy - without.vy) < 1e-12, 'identical Δv with the accumulator on vs off');
});
