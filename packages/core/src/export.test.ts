/**
 * Field export (C4). `segmentsToSvg` is pure, so it's tested directly; the canvas/download helpers
 * are thin DOM glue verified in the browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segmentsToSvg } from './export.ts';
import type { Segment } from './diagnostics/render.ts';

const segs: Segment[] = [
  { x1: 0, y1: 0, x2: 10, y2: 10 },
  { x1: 10.005, y1: 5, x2: 20, y2: 0 },
];

test('segmentsToSvg emits a valid standalone SVG with one line per segment', () => {
  const svg = segmentsToSvg(segs, 100, 80);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="100" height="80"/);
  assert.match(svg, /viewBox="0 0 100 80"/);
  assert.equal((svg.match(/<line /g) || []).length, 2);
  assert.match(svg, /<line x1="0" y1="0" x2="10" y2="10"\/>/);
  assert.match(svg, /x1="10.01"/, 'coordinates are rounded to 2dp');
  assert.match(svg, /<\/svg>$/);
});

test('segmentsToSvg honors stroke + background options', () => {
  const svg = segmentsToSvg(segs, 50, 50, { stroke: '#2dd4bf', strokeWidth: 2, background: '#000' });
  assert.match(svg, /<rect width="50" height="50" fill="#000"\/>/);
  assert.match(svg, /stroke="#2dd4bf" stroke-width="2"/);
});

test('segmentsToSvg with no segments is still a valid empty SVG', () => {
  const svg = segmentsToSvg([], 10, 10);
  assert.match(svg, /^<svg /);
  assert.equal((svg.match(/<line /g) || []).length, 0);
});
