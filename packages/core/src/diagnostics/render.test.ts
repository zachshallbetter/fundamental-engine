/**
 * Diagnostic overlay rendering (C1) — the pure marching-squares contour extraction is tested
 * directly; the `draw*` helpers are thin Canvas 2D calls verified visually in the browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contourSegments } from './render.ts';
import { sampleScalarGrid, netPotentialAt } from './potential.ts';
import type { Body } from '../engine/types.ts';
import type { ScalarGridData } from './potential.ts';

const grid = (values: number[], cols: number, rows: number, res = 10): ScalarGridData => ({
  width: cols * res,
  height: rows * res,
  resolution: res,
  cols,
  rows,
  values: Float32Array.from(values),
  min: Math.min(...values),
  max: Math.max(...values),
});

test('contourSegments extracts isolines where a level crosses', () => {
  // left two columns 0, right column 1 → a vertical contour at level 0.5
  const g = grid([0, 0, 1, 0, 0, 1, 0, 0, 1], 3, 3);
  const segs = contourSegments(g, [0.5]);
  assert.ok(segs.length > 0, 'a crossing produces segments');
  // crossing between col1 (0) and col2 (1) at t=0.5 → x = (1 + 0.5) * 10 = 15
  for (const s of segs) assert.ok(Math.abs(s.x1 - 15) < 1e-6 && Math.abs(s.x2 - 15) < 1e-6);
});

test('contourSegments returns nothing for a flat grid (no crossing)', () => {
  const g = grid(new Array(9).fill(0.5), 3, 3);
  assert.equal(contourSegments(g, [0.7]).length, 0);
});

test('contourSegments(count) draws nested rings around a potential well', () => {
  const body = { cx: 100, cy: 100, M: 3000, strength: 1, range: 300, spin: 1 } as unknown as Body;
  const g = sampleScalarGrid((x, y) => netPotentialAt([body], x, y), 200, 200, 10);
  assert.ok(contourSegments(g, 6).length > 0, 'a radial well yields contour rings');
});
