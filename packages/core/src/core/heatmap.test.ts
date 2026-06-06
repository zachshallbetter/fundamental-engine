/**
 * Density heatmap (field-systems plan, H1) — the scalar buffer tracks where matter pools,
 * normalizes to [0, 1], and fades as the field empties.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Heatmap } from './heatmap.ts';
import type { Particle } from './types.ts';

const p = (x: number, y: number): Particle => ({ x, y, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: null });

// a tight cluster near (200, 200); nothing near (600, 400)
const cluster = (): Particle[] => {
  const ps: Particle[] = [];
  for (let i = 0; i < 40; i++) ps.push(p(200 + (i % 7) * 4, 200 + Math.floor(i / 7) * 4));
  return ps;
};

test('reads higher where matter pools than where it is empty', () => {
  const hm = new Heatmap(800, 600);
  const ps = cluster();
  for (let f = 0; f < 30; f++) hm.update(ps); // let the buffer settle
  const hot = hm.norm(206, 206); // inside the cluster
  const cold = hm.norm(600, 400); // far away
  assert.ok(hot > 0.5, `cluster should read hot, got ${hot.toFixed(3)}`);
  assert.ok(cold < 0.1, `empty region should read cold, got ${cold.toFixed(3)}`);
});

test('normalized output stays within [0, 1]', () => {
  const hm = new Heatmap(800, 600);
  const ps = cluster();
  for (let f = 0; f < 50; f++) hm.update(ps);
  for (const [x, y] of [[206, 206], [600, 400], [0, 0], [799, 599]] as const) {
    const v = hm.norm(x, y);
    assert.ok(v >= 0 && v <= 1 && Number.isFinite(v), `norm(${x},${y}) = ${v} out of [0,1]`);
  }
});

test('fades toward zero once the matter leaves', () => {
  const hm = new Heatmap(800, 600);
  const ps = cluster();
  for (let f = 0; f < 30; f++) hm.update(ps);
  const before = hm.norm(206, 206);
  for (let f = 0; f < 60; f++) hm.update([]); // field empties — deposit nothing
  const after = hm.norm(206, 206);
  assert.ok(after < before * 0.5, `heat should fade: before ${before.toFixed(3)}, after ${after.toFixed(3)}`);
});

test('an empty field never divides by zero (peak floored)', () => {
  const hm = new Heatmap(400, 300);
  for (let f = 0; f < 10; f++) hm.update([]);
  const v = hm.norm(200, 150);
  assert.ok(Number.isFinite(v) && v >= 0, `empty-field sample must be finite, got ${v}`);
});
