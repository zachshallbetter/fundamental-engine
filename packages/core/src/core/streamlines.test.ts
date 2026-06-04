import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forceAt } from './streamlines.ts';
import { coreForces } from '../forces/index.ts';
import type { Body, Env } from './types.ts';

const forces = Object.fromEntries(coreForces.map((f) => [f.token, f]));

const env = (): Env => ({
  dx: 0, dy: 0, dist: 1,
  form: { driftX: 0, wander: 0, orbit: 0, spread: 0, conv: 0 },
  W: 800, H: 600, t: 0, frameN: 0, dt: 1, c: 12, G: 1,
  spark: () => {}, supernova: () => {}, spawn: () => {},
  neighbors: () => [], grid: () => ({ sample: () => 0, deposit: () => {}, gradient: () => ({ x: 0, y: 0 }) }),
});

const body = (token: string, cx: number, cy: number): Body => ({
  el: {} as HTMLElement, tokens: [token], strength: 1.5, range: 240, absorbR: 64, capacity: 60,
  spin: 1, angle: 0, ux: 1, uy: 0, when: '', feedback: false, fmin: 0, fmax: 0, opsz: '',
  M: 1, cx, cy, hw: 30, hh: 14, on: false, vis: true, accreted: 0, count: 0, d: 0, attn: 1,
});

test('attract: the field vector points toward the body', () => {
  const b = body('attract', 400, 300);
  const { fx, fy } = forceAt([b], forces, env(), 300, 300); // probe left of the body
  assert.ok(fx > 0, 'pushed rightward, toward the body');
  assert.ok(Math.abs(fy) < 1e-6, 'no vertical component on the axis');
});

test('repel: the field vector points away from the body', () => {
  const b = body('repel', 400, 300);
  const { fx } = forceAt([b], forces, env(), 300, 300); // probe left of the body
  assert.ok(fx < 0, 'pushed leftward, away from the body');
});

test('beyond range there is no field', () => {
  const b = body('attract', 400, 300);
  const { fx, fy } = forceAt([b], forces, env(), 400 - 1000, 300); // far outside range
  assert.equal(fx, 0);
  assert.equal(fy, 0);
});

test('an invisible or empty body contributes nothing', () => {
  const off = { ...body('attract', 400, 300), vis: false };
  const empty = { ...body('attract', 400, 300), tokens: [] };
  assert.deepEqual(forceAt([off], forces, env(), 300, 300), { fx: 0, fy: 0 });
  assert.deepEqual(forceAt([empty], forces, env(), 300, 300), { fx: 0, fy: 0 });
});

test('two bodies superpose', () => {
  const a = body('attract', 200, 300);
  const b = body('attract', 600, 300);
  const mid = forceAt([a, b], forces, env(), 400, 300); // exactly between → cancels horizontally
  assert.ok(Math.abs(mid.fx) < 1e-6, `symmetric pull cancels: ${mid.fx}`);
});
