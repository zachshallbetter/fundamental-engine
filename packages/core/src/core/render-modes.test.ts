import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkAlpha, isoCross, marchingCell, splatDensity } from './render-modes.ts';

test('linkAlpha fades to zero at the radius', () => {
  assert.equal(linkAlpha(0, 90), 0.12);
  assert.equal(linkAlpha(90, 90), 0);
  assert.equal(linkAlpha(45, 90), 0.06);
  assert.equal(linkAlpha(200, 90), 0);
});

test('isoCross interpolates the crossing and clamps to the edge', () => {
  assert.equal(isoCross(0, 1, 0.5), 0.5); // halfway
  assert.equal(isoCross(0, 2, 0.5), 0.25); // a quarter up
  assert.equal(isoCross(1, 1, 0.5), 0.5); // flat → midpoint
  assert.equal(isoCross(0, 1, 2), 1); // above both → clamp high
  assert.equal(isoCross(0, 1, -1), 0); // below both → clamp low
});

test('marchingCell: empty and full cells trace nothing', () => {
  assert.deepEqual(marchingCell(0, 0, 0, 0, 0.5), []); // all below
  assert.deepEqual(marchingCell(1, 1, 1, 1, 0.5), []); // all above
});

test('marchingCell: a single hot corner cuts that corner off', () => {
  // only bottom-left above → contour crosses the left and bottom edges
  const bl = marchingCell(0, 0, 0, 1, 0.5);
  assert.equal(bl.length, 1);
  assert.deepEqual(bl[0], { x1: 0, y1: 0.5, x2: 0.5, y2: 1 }); // L(0,0.5) → B(0.5,1)
  // only top-left above → left and top edges
  const tl = marchingCell(1, 0, 0, 0, 0.5);
  assert.deepEqual(tl, [{ x1: 0, y1: 0.5, x2: 0.5, y2: 0 }]); // L → T
});

test('marchingCell: a half-split cell traces one straight crossing', () => {
  // left column hot (tl, bl) → a vertical-ish split across top and bottom edges
  const seg = marchingCell(1, 0, 0, 1, 0.5);
  assert.deepEqual(seg, [{ x1: 0.5, y1: 0, x2: 0.5, y2: 1 }]); // T(0.5,0) → B(0.5,1)
});

test('marchingCell: the saddle cases emit two segments', () => {
  assert.equal(marchingCell(0, 1, 0, 1, 0.5).length, 2); // tr & bl above (case 5)
  assert.equal(marchingCell(1, 0, 1, 0, 0.5).length, 2); // tl & br above (case 10)
});

test('splatDensity peaks at the particle and stays within its radius', () => {
  const cols = 5;
  const rows = 5;
  const step = 10;
  const grid = new Float32Array(cols * rows);
  // a particle on the node at (20, 20) → grid index (2,2)
  splatDensity(grid, cols, rows, step, 20, 20, 15);
  assert.ok(grid[2 * cols + 2] > 0.99, 'peak at the node it sits on (≈1)');
  assert.ok(grid[2 * cols + 3] > 0 && grid[2 * cols + 3] < grid[2 * cols + 2], 'falls off with distance');
  assert.equal(grid[0], 0, 'no contribution beyond the radius');
});
