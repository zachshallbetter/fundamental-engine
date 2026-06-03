import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, hexToRgb, particleRGB, COOL, WARM } from './math.ts';

test('clamp bounds a value', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(99, 0, 10), 10);
});

test('lerp interpolates', () => {
  assert.equal(lerp(0, 10, 0.5), 5);
  assert.equal(lerp(0, 10, 0), 0);
  assert.equal(lerp(0, 10, 1), 10);
});

test('hexToRgb parses #rrggbb and #rgb', () => {
  assert.deepEqual(hexToRgb('#4da3ff'), [77, 163, 255]);
  assert.deepEqual(hexToRgb('#fff'), [255, 255, 255]);
  assert.deepEqual(hexToRgb('nonsense'), [77, 163, 255]);
});

test('particleRGB: cool centre, warm edge, accent on heat (§20.8)', () => {
  assert.deepEqual(particleRGB(0, 0, [10, 20, 30]), COOL); // centre, calm
  assert.deepEqual(particleRGB(1, 0, [10, 20, 30]), WARM); // edge, calm
  assert.deepEqual(particleRGB(0, 1, [10, 20, 30]), [10, 20, 30]); // hot → accent
});
