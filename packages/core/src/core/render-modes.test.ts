import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  linkAlpha,
  isoCross,
  marchingCell,
  splatDensity,
  nearestSite,
  voronoiWalls,
  knockoutHoleRadius,
  radialVelocity,
  dopplerShift,
  wellWeight,
  redshiftShift,
  redshiftRGBInto,
  blackbodyT,
  blackbodyRGBInto,
  depthScale,
  depthProject,
  depthAlpha,
  depthBlurRadius,
} from './render-modes.ts';

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

// ── knockout (§20.6 / #667) ─────────────────────────────────────────────────────────

test('knockoutHoleRadius scales with size, breathes with heat, recedes with zk', () => {
  assert.equal(knockoutHoleRadius(2, 0), 5.2); // 2·2.6
  assert.equal(knockoutHoleRadius(2, 1), 7.7); // + 2.5 heat term
  assert.equal(knockoutHoleRadius(2, 0, 0.5), 2.6); // depth recession halves it
  assert.equal(knockoutHoleRadius(0, 0), 2); // floored — matter always reads
  assert.equal(knockoutHoleRadius(0.1, 0, 0.5), 2); // recession can't push below the floor
});

// ── redshift (§20.6 / #668) ─────────────────────────────────────────────────────────

test('radialVelocity is signed: receding +, approaching −, 0 at the observer', () => {
  assert.equal(radialVelocity(10, 0, 3, 0, 0, 0), 3); // moving straight away
  assert.equal(radialVelocity(10, 0, -3, 0, 0, 0), -3); // moving straight in
  assert.equal(radialVelocity(10, 0, 0, 5, 0, 0), 0); // pure tangential → no shift
  assert.equal(radialVelocity(0, 0, 9, 9, 0, 0), 0); // at the observer itself
  assert.equal(radialVelocity(0, 10, 0, 2, 0, 0), 2); // +y away from an observer below
});

test('dopplerShift normalizes by 0.35·c and clamps to [-1, 1]', () => {
  assert.equal(dopplerShift(4.2, 12), 1); // 4.2 / (0.35·12) = 1 exactly
  assert.ok(Math.abs(dopplerShift(2.1, 12) - 0.5) < 1e-12); // half the reference speed
  assert.ok(Math.abs(dopplerShift(-2.1, 12) + 0.5) < 1e-12);
  assert.equal(dopplerShift(40, 12), 1); // clamp high
  assert.equal(dopplerShift(-40, 12), -1); // clamp low
  assert.equal(dopplerShift(5, 0), 0); // degenerate c → no shift
});

test('wellWeight is 1 at the core, 0 at the range edge and beyond', () => {
  assert.equal(wellWeight(0, 10000), 1);
  assert.equal(wellWeight(2500, 10000), 0.5); // d = r/2 → 1 − 0.5
  assert.equal(wellWeight(10000, 10000), 0);
  assert.equal(wellWeight(20000, 10000), 0);
  assert.equal(wellWeight(0, 0), 0); // no range → no well
});

test('redshiftShift adds the gravitational red at 0.6 weight and clamps', () => {
  assert.equal(redshiftShift(0.2, 0.5), 0.5); // 0.2 + 0.3
  assert.equal(redshiftShift(-0.5, 0), -0.5); // pure blueshift passes through
  assert.equal(redshiftShift(1, 1), 1); // clamp high
  assert.equal(redshiftShift(-0.6, 1), 0, 'a deep well cancels an equal blueshift'); // −0.6 + 0.6
});

test('redshiftRGBInto pins the spectral ends and midpoints', () => {
  assert.deepEqual(redshiftRGBInto([0, 0, 0], -1), [96, 160, 255]); // full blueshift
  assert.deepEqual(redshiftRGBInto([0, 0, 0], 0), [226, 230, 240]); // at rest
  assert.deepEqual(redshiftRGBInto([0, 0, 0], 1), [255, 72, 48]); // full redshift
  assert.deepEqual(redshiftRGBInto([0, 0, 0], 0.5), [240.5, 151, 144]); // halfway to red
  assert.deepEqual(redshiftRGBInto([0, 0, 0], -0.5), [161, 195, 247.5]); // halfway to blue
  assert.deepEqual(redshiftRGBInto([0, 0, 0], 9), [255, 72, 48]); // clamps like the shift
});

// ── blackbody (§20.6 / #669) ────────────────────────────────────────────────────────

test('blackbodyT sums heat and kinetic terms, saturating at 0.3·c', () => {
  assert.equal(blackbodyT(0, 0, 0, 12), 0); // cold and still
  assert.equal(blackbodyT(0, 0, 1, 12), 0.55); // pure heat
  assert.equal(blackbodyT(3.6, 0, 0, 12), 0.55); // |v| = 0.3·c exactly → kinetic saturates
  assert.equal(blackbodyT(30, 0, 1, 12), 1); // both maxed → clamp at 1
  assert.ok(Math.abs(blackbodyT(1.8, 0, 0, 12) - 0.1375) < 1e-12); // (v/vref)² = 0.25 → 0.55·0.25
  assert.equal(blackbodyT(5, 5, 0.5, 0), 0.275); // degenerate c → heat term only
});

test('blackbodyRGBInto pins the thermal ramp ends and an interior stop', () => {
  assert.deepEqual(blackbodyRGBInto([0, 0, 0], 0), [12, 2, 0]); // cold ember
  assert.deepEqual(blackbodyRGBInto([0, 0, 0], 1), [201, 218, 255]); // blue-white
  assert.deepEqual(blackbodyRGBInto([0, 0, 0], 0.4), [235, 100, 10]); // the orange stop exactly
  assert.deepEqual(blackbodyRGBInto([0, 0, 0], 0.5), [245, 140, 50]); // halfway orange → warm yellow
  assert.deepEqual(blackbodyRGBInto([0, 0, 0], -1), [12, 2, 0]); // clamps low
  assert.deepEqual(blackbodyRGBInto([0, 0, 0], 2), [201, 218, 255]); // clamps high
});

// ── depth (§20.6 / #670) ────────────────────────────────────────────────────────────

test('depthScale is 1 on the page plane and symmetric about it', () => {
  assert.equal(depthScale(0, 480), 1);
  assert.equal(depthScale(480, 480), 0.5); // one focal length in → half scale
  assert.equal(depthScale(-480, 480), 0.5); // depth is |z| (z-axis.md)
  assert.equal(depthScale(1440, 480), 0.25);
});

test('depthProject moves a point toward the centre by the scale', () => {
  assert.equal(depthProject(100, 50, 0.5), 75);
  assert.equal(depthProject(100, 50, 1), 100); // plane → identity
  assert.equal(depthProject(50, 50, 0.25), 50); // the centre is a fixed point
});

test('depthAlpha fades to the dots recession floor at the volume edge', () => {
  assert.equal(depthAlpha(0), 1);
  assert.equal(depthAlpha(1), 0.44999999999999996); // 1 − 0.55
  assert.equal(depthAlpha(2), 0.44999999999999996); // clamps
  assert.equal(depthAlpha(-1), 1); // clamps
});

test('depthBlurRadius grows linearly to 4.5 px at the volume edge', () => {
  assert.equal(depthBlurRadius(0), 0);
  assert.equal(depthBlurRadius(0.5), 2.25);
  assert.equal(depthBlurRadius(1), 4.5);
  assert.equal(depthBlurRadius(3), 4.5); // clamps
});
