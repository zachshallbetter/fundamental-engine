import { test } from 'node:test';
import assert from 'node:assert/strict';
import { energyDelta, reactionIntensity, sparkCount } from './reactions.ts';

test('energyDelta is the kinetic energy removed', () => {
  assert.equal(energyDelta(1, 2, 0), 2);   // ½·1·(4−0)
  assert.equal(energyDelta(2, 3, 1), 8);   // ½·2·(9−1)
});

test('reactionIntensity clamps to [0, iMax]', () => {
  assert.equal(reactionIntensity(1, 1, 2.4), 1);
  assert.equal(reactionIntensity(-5), 0);
  assert.equal(reactionIntensity(100, 1, 2.4), 2.4);
});

test('sparkCount is at least 3 and integer', () => {
  assert.equal(sparkCount(0, () => 0), 3);
  const n = sparkCount(2, () => 0.99);
  assert.ok(Number.isInteger(n) && n >= 3);
});
