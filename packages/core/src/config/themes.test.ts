import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, DEFAULT_THEME } from './themes.ts';
import { COOL, WARM, particleRGBInto, type RGB } from '../math/math.ts';

test('THEMES.warm (the default) reproduces the shipped heat ramp byte-for-byte (#529)', () => {
  assert.equal(DEFAULT_THEME, 'warm');
  assert.deepEqual(THEMES[DEFAULT_THEME]!.cool, COOL);
  assert.deepEqual(THEMES[DEFAULT_THEME]!.warm, WARM);
  assert.deepEqual(THEMES[DEFAULT_THEME]!.wave, ['#ff8a5c', '#f0628e', '#ffc46b']);
});

test('the heat-ramp ends are overridable — a custom warm changes the particle color', () => {
  const accent: RGB = [0, 0, 0];
  const def = particleRGBInto([0, 0, 0], 1, 0, accent); // rs=1, heat=0 → the warm end, default
  const custom = particleRGBInto([0, 0, 0], 1, 0, accent, COOL, [0, 255, 0]);
  assert.notDeepEqual(custom, def, 'a custom warm yields a different color');
  assert.deepEqual(custom, [0, 255, 0], 'rs=1, heat=0 lands exactly on the warm end');
});

test('cool + mono presets exist and differ from warm', () => {
  for (const t of ['cool', 'mono']) {
    assert.ok(THEMES[t], `${t} preset exists`);
    assert.notDeepEqual(THEMES[t]!.warm, THEMES.warm!.warm, `${t} differs from warm`);
  }
});
