import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellForce } from './cell-force.ts';

test('attract pulls toward the centre', () => {
  const { ax } = cellForce('attract', 100, 0, 200); // centre is to +x
  assert.ok(ax > 0);
});
test('repel pushes away from the centre', () => {
  const { ax } = cellForce('repel', 100, 0, 200);
  assert.ok(ax < 0);
});
test('vortex is tangential (perpendicular to radial)', () => {
  const { ax, ay } = cellForce('vortex', 100, 0, 200); // radial is +x → tangential is ±y
  assert.ok(Math.abs(ax) < 1e-9 && ay > 0);
});
test('out of reach → no force (except stream)', () => {
  assert.deepEqual(cellForce('attract', 500, 0, 200), { ax: 0, ay: 0 });
  assert.ok(cellForce('stream', 500, 0, 200).ax > 0);
});
