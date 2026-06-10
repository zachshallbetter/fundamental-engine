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

// ── screenFactor (workover v0.3 — the `screen` quiet-zone math) ──────────────────────

test('screenFactor: quadratic falloff, smooth at the edge, clamped to [min, 1]', async () => {
  const { screenFactor } = await import('./math.ts');
  assert.equal(screenFactor(0, 200, 1), 0); // full cancellation at the core (S = 1)
  assert.ok(Math.abs(screenFactor(100, 200, 1) - 0.75) < 1e-12); // 1 − (0.5)²
  assert.ok(Math.abs(screenFactor(150, 200, 1) - 0.9375) < 1e-12); // 1 − (0.25)²
  assert.equal(screenFactor(200, 200, 1), 1); // exactly at the edge — continuous, no cliff
  assert.equal(screenFactor(500, 200, 1), 1); // outside — no effect
  assert.equal(screenFactor(0, 200, 0.5), 0.5); // strength scales the depth
  assert.equal(screenFactor(0, 200, 1, 0.3), 0.3); // data-screen-min floors the factor
  assert.equal(screenFactor(0, 200, 5), 0); // an over-strong screen still clamps at 0
});

test('screenFactor: zero/negative range is inert and produces no NaN', async () => {
  const { screenFactor } = await import('./math.ts');
  assert.equal(screenFactor(0, 0, 1), 1); // d = 0, range = 0 — the NaN trap, guarded
  assert.equal(screenFactor(50, 0, 1), 1);
  assert.equal(screenFactor(50, -10, 1), 1);
  assert.ok(Number.isFinite(screenFactor(0, 0, 1, 0.5)));
});
