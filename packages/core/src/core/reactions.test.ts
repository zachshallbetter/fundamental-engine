import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  energyDelta,
  reactionIntensity,
  sparkCount,
  recoilImpulse,
  burstImpulse,
} from './reactions.ts';

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

test('recoilImpulse is equal-and-opposite, split by mass (§23.5)', () => {
  assert.deepEqual(recoilImpulse(10, -4, 1), { x: -10, y: 4 });
  assert.deepEqual(recoilImpulse(10, 0, 5), { x: -2, y: 0 }); // heavier → smaller
  assert.deepEqual(recoilImpulse(10, 0, 0), { x: -10, y: 0 }); // mass 0 → treated as 1
});

test('burstImpulse shoves radially outward, falling off to the rim (§11)', () => {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-4;
  const i = burstImpulse(80, 0, 160); // halfway out along +x
  assert.ok(near(i.vx, 3)); // (1 − 80/160)·6 = 3, directed +x
  assert.ok(near(i.vy, 0));
  assert.ok(near(i.heat, 0.45)); // (1 − 0.5)·0.9
});

test('burstImpulse is radial and inert beyond the radius', () => {
  const up = burstImpulse(0, 40, 160); // straight up
  assert.ok(up.vy > 0 && Math.abs(up.vx) < 1e-9);
  const out = burstImpulse(200, 0, 160); // past the rim
  assert.deepEqual(out, { vx: 0, vy: 0, vz: 0, heat: 0 }); // vz: the optional z lane (z-axis.md)
});
