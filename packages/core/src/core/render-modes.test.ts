import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkAlpha, isoCross, marchingCell, splatDensity, nearestSite, voronoiWalls } from './render-modes.ts';

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

test('nearestSite picks the closest site, -1 when there are none', () => {
  const sites = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 100 },
  ];
  assert.equal(nearestSite(10, 5, sites), 0); // closest to the origin site
  assert.equal(nearestSite(90, 10, sites), 1); // closest to (100,0)
  assert.equal(nearestSite(5, 95, sites), 2); // closest to (0,100)
  assert.equal(nearestSite(0, 0, []), -1); // empty → no owner
});

test('voronoiWalls traces the boundary between differing owners only', () => {
  // a 2×1 grid split down the middle: owner 0 | owner 1
  const walls = voronoiWalls([0, 1], 2, 1);
  assert.equal(walls.length, 1);
  assert.deepEqual(walls[0], { x1: 0.5, y1: -0.5, x2: 0.5, y2: 0.5 }); // vertical wall at x=0.5
});

test('voronoiWalls draws nothing inside a single uniform cell', () => {
  assert.deepEqual(voronoiWalls([7, 7, 7, 7], 2, 2), []); // all one owner → no walls
});

test('voronoiWalls separates a 2×2 of four distinct owners (a cross of walls)', () => {
  // owners:  0 1
  //          2 3   → one vertical + one horizontal interior wall per shared edge
  const walls = voronoiWalls([0, 1, 2, 3], 2, 2);
  // top-left↔right (0|1), bottom-left↔right (2|3): 2 vertical;
  // top↔bottom on each column (0|2, 1|3): 2 horizontal → 4 walls total
  assert.equal(walls.length, 4);
});
