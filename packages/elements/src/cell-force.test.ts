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
test('out of reach → no force (except the uniform fields)', () => {
  assert.deepEqual(cellForce('attract', 500, 0, 200), { ax: 0, ay: 0 });
  assert.ok(cellForce('stream', 500, 0, 200).ax > 0);
  assert.ok(cellForce('buoyancy', 500, 0, 200).ay < 0); // uniform — acts out of reach too
});
test('gravity pulls inward, steeper than attract near the centre', () => {
  assert.ok(cellForce('gravity', 100, 0, 200).ax > 0); // toward the centre
  const near = cellForce('gravity', 40, 0, 200).ax;
  const far = cellForce('gravity', 160, 0, 200).ax;
  assert.ok(near > far); // 1/d² → much stronger close in
});
test('buoyancy is a steady lift (−y)', () => {
  assert.deepEqual(cellForce('buoyancy', 30, 50, 200), { ax: 0, ay: -0.12 });
});
test('spring pulls in past the shell and pushes out within it', () => {
  const rest = 200 * 0.45; // 90
  assert.ok(cellForce('spring', rest + 50, 0, 200).ax > 0); // beyond shell → inward
  assert.ok(cellForce('spring', rest - 50, 0, 200).ax < 0); // inside shell → outward
});
