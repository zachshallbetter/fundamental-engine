/**
 * Shaped-source geometry — golden tests (field-systems plan, Stage A).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestOnRect, sdfRect, polePair, dipoleField, type AxisRect, type Pole } from './geometry.ts';

const near = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) <= eps;

// box centred at (100, 100), half-extents 50 × 20 → x∈[50,150], y∈[80,120]
const box = { cx: 100, cy: 100, hw: 50, hh: 20 };

test('nearestOnRect: a point to the left clamps onto the left edge', () => {
  const n = nearestOnRect(0, 100, box);
  assert.deepEqual(n, { x: 50, y: 100 });
});

test('nearestOnRect: a point past a corner clamps onto that corner', () => {
  const n = nearestOnRect(0, 0, box); // up-and-left of the box
  assert.deepEqual(n, { x: 50, y: 80 });
});

test('nearestOnRect: a point inside the box is its own nearest point', () => {
  const n = nearestOnRect(110, 105, box);
  assert.deepEqual(n, { x: 110, y: 105 });
});

// box centred at origin, half-extents 10 × 5
const sbox = { cx: 0, cy: 0, hw: 10, hh: 5 };

test('sdfRect: the centre is the inner radius, negative', () => {
  assert.ok(near(sdfRect(0, 0, sbox), -5)); // −min(hw, hh)
});

test('sdfRect: a point on the edge is zero', () => {
  assert.ok(near(sdfRect(10, 0, sbox), 0));
});

test('sdfRect: outside along an axis is the gap distance', () => {
  assert.ok(near(sdfRect(15, 0, sbox), 5));
});

test('sdfRect: outside past a corner is the diagonal distance', () => {
  assert.ok(near(sdfRect(13, 9, sbox), 5)); // dx=3, dy=4 → hypot = 5
});

test('sdfRect: inside near an edge is the negative gap', () => {
  assert.ok(near(sdfRect(8, 0, sbox), -2)); // 2px inside the right edge
});

// a wide bar: half-extents 60 × 10
const bar = (over: Partial<AxisRect> = {}): AxisRect => ({
  cx: 100,
  cy: 100,
  hw: 60,
  hh: 10,
  ux: 1,
  uy: 0,
  spin: 1,
  ...over,
});

test('polePair: a horizontal bar puts the poles at its short ends', () => {
  const [pos, neg] = polePair(bar());
  assert.deepEqual({ x: pos.x, y: pos.y, q: pos.q }, { x: 160, y: 100, q: 1 });
  assert.deepEqual({ x: neg.x, y: neg.y, q: neg.q }, { x: 40, y: 100, q: -1 });
});

test('polePair: spin < 0 swaps which end is north', () => {
  const [pos, neg] = polePair(bar({ spin: -1 }));
  assert.equal(pos.q, -1); // +(ux) end is now the − pole
  assert.equal(neg.q, 1);
  assert.ok(near(pos.x, 160) && near(neg.x, 40)); // positions unchanged
});

test('polePair: a vertical heading uses the vertical extent (short, fat magnet)', () => {
  const [pos, neg] = polePair(bar({ ux: 0, uy: 1 }));
  assert.ok(near(pos.x, 100) && near(pos.y, 110)); // reach = hh = 10
  assert.ok(near(neg.x, 100) && near(neg.y, 90));
});

test('polePair: a diagonal heading is limited by the nearest box edge', () => {
  const d = Math.SQRT1_2; // (cos 45°, sin 45°)
  const [pos, neg] = polePair(bar({ ux: d, uy: d })); // hw=60, hh=10 → vertical edge limits
  // reach = min(60/d, 10/d) = 10/d ≈ 14.14; offset = reach·(d, d) = (10, 10)
  assert.ok(near(pos.x, 110) && near(pos.y, 110));
  assert.ok(near(neg.x, 90) && near(neg.y, 90));
});

// a dipole on the x-axis: + pole left, − pole right
const dipole: Pole[] = [
  { x: -10, y: 0, q: 1 },
  { x: 10, y: 0, q: -1 },
];

test('dipoleField: at the midpoint the field points from + to −', () => {
  const f = dipoleField(dipole, 0, 0);
  assert.ok(f.x > 0); // toward the − pole (to the right)
  assert.ok(near(f.y, 0)); // symmetric, no vertical component
});

test('dipoleField: swapping polarity reverses the field', () => {
  const flipped: Pole[] = [
    { x: -10, y: 0, q: -1 },
    { x: 10, y: 0, q: 1 },
  ];
  const a = dipoleField(dipole, 0, 0);
  const b = dipoleField(flipped, 0, 0);
  assert.ok(near(a.x, -b.x) && near(a.y, -b.y));
});

test('dipoleField: the field weakens with distance', () => {
  const nearF = dipoleField(dipole, 0, 30);
  const farF = dipoleField(dipole, 0, 300);
  assert.ok(Math.hypot(nearF.x, nearF.y) > Math.hypot(farF.x, farF.y));
});

test('dipoleField: a pole sample is floored by EPS, never infinite', () => {
  const f = dipoleField(dipole, -10, 0); // exactly on the + pole
  assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y));
});
