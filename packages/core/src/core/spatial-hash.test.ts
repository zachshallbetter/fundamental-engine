import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpatialHash } from './spatial-hash.ts';

type P = { x: number; y: number };

test('near returns points within the radius, excludes those outside', () => {
  const h = new SpatialHash<P>(50);
  const a = { x: 0, y: 0 };
  const b = { x: 30, y: 0 };
  const c = { x: 200, y: 0 };
  h.rebuild([a, b, c]);
  const near = h.near(0, 0, 40);
  assert.ok(near.includes(a));
  assert.ok(near.includes(b));
  assert.ok(!near.includes(c));
});

test('rebuild clears previous contents', () => {
  const h = new SpatialHash<P>(50);
  h.rebuild([{ x: 0, y: 0 }]);
  h.rebuild([{ x: 500, y: 500 }]);
  assert.equal(h.near(0, 0, 40).length, 0);
});

test('works across negative coordinates', () => {
  const h = new SpatialHash<P>(50);
  const a = { x: -120, y: -120 };
  h.rebuild([a, { x: 300, y: 300 }]);
  assert.deepEqual(h.near(-120, -120, 10), [a]);
});
