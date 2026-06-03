import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, hexToRgb } from './math.ts';

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
