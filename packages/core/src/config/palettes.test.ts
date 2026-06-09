import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, PALETTE_NAMES, resolvePalette } from './palettes.ts';
import { ACCENT_JOURNEY } from './forces.config.ts';

test('the built-in palettes are ours/heatmap/infrared/spectrum', () => {
  assert.deepEqual([...PALETTE_NAMES], ['ours', 'heatmap', 'infrared', 'spectrum']);
  for (const n of PALETTE_NAMES) assert.ok((PALETTES[n]?.length ?? 0) >= 2, n);
});

test('every palette stop is a valid hex color', () => {
  for (const stops of Object.values(PALETTES)) {
    for (const c of stops) assert.match(c, /^#[0-9a-f]{6}$/i);
  }
});

test('ours mirrors the canonical accent journey', () => {
  assert.deepEqual(PALETTES.ours, ACCENT_JOURNEY);
});

test('resolvePalette: name → stops, array → as-is, unknown/empty → canonical', () => {
  assert.deepEqual(resolvePalette('spectrum'), PALETTES.spectrum);
  assert.deepEqual(resolvePalette(['#ffffff', '#000000']), ['#ffffff', '#000000']);
  assert.deepEqual(resolvePalette('not-a-palette'), ACCENT_JOURNEY);
  assert.deepEqual(resolvePalette([]), ACCENT_JOURNEY);
  assert.deepEqual(resolvePalette(undefined), ACCENT_JOURNEY);
});
