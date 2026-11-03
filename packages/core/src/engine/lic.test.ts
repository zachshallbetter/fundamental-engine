/**
 * LIC — the smoky vector render (#671).
 *
 * The visual claim ("it reads as flow, not as arrows") is not testable here, and the PR carries a
 * screenshot for it. What IS testable is everything the texture depends on, and every one of these
 * is a property whose failure looks like a rendering bug rather than an error:
 *
 *   · the noise must be UNIFORM, or the texture is patchy
 *   · neighbouring seeds must be UNCORRELATED, or the hairs comb into visible rows
 *   · the whole lattice must be DETERMINISTIC, or no two frames — or runs — agree
 *   · the alpha must taper to zero at both ends, or hairs end in hard dashes
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  licNoise, licSeeds, licAlpha, licStep, licDirection,
  LIC_STEPS, LIC_NOISE_FLOOR, LIC_MAX_SEEDS, LIC_SEED_SPACING,
} from './lic.ts';

test('the noise is uniform — a biased hash makes the texture patchy, not wrong-looking', () => {
  const bins = new Array(10).fill(0);
  for (let i = 0; i < 200; i++) for (let j = 0; j < 200; j++) bins[Math.min(9, Math.floor(licNoise(i, j) * 10))]++;
  const expected = 40000 / 10;
  for (const [k, count] of bins.entries())
    assert.ok(Math.abs(count - expected) / expected < 0.1, `decile ${k}: ${count} vs ~${expected}`);
});

test('neighbouring seeds are uncorrelated — correlation combs the hairs into rows', () => {
  // This is the property a hash without an avalanche step silently fails: the values stay in range
  // and look fine in isolation, and the render comes out looking like corduroy.
  const agree = (di: number, dj: number): number => {
    let same = 0;
    let total = 0;
    for (let i = 0; i < 200 - di; i++)
      for (let j = 0; j < 200 - dj; j++) {
        if ((licNoise(i, j) > 0.5) === (licNoise(i + di, j + dj) > 0.5)) same++;
        total++;
      }
    return same / total;
  };
  for (const [di, dj] of [[0, 1], [1, 0], [1, 1]] as const)
    assert.ok(Math.abs(agree(di, dj) - 0.5) < 0.02, `offset (${di},${dj}) agreement ${agree(di, dj)}`);
});

test('the lattice is deterministic, bounded, and re-seedable', () => {
  const a = licSeeds(1440, 900);
  assert.deepEqual(licSeeds(1440, 900), a, 'the same viewport gives the same texture, every run');
  assert.notDeepEqual(licSeeds(1440, 900, LIC_SEED_SPACING, 7), a, 'a different seed gives a different texture');
  assert.ok(a.length > 0 && a.length <= LIC_MAX_SEEDS, `${a.length} seeds, capped at ${LIC_MAX_SEEDS}`);
  assert.ok(a.every((s) => s.n >= LIC_NOISE_FLOOR), 'the faintest hairs are culled at seeding, not at draw');
  // a huge viewport must hit the cap rather than scaling the cost without limit
  assert.equal(licSeeds(20000, 20000).length, LIC_MAX_SEEDS, 'the cap binds on a large viewport');
  assert.deepEqual(licSeeds(0, 900), [], 'a zero dimension seeds nothing rather than throwing');
});

test('the alpha tapers to exactly zero at both ends — otherwise hairs end in hard dashes', () => {
  assert.equal(licAlpha(0.99, 0), 0, 'the first step is invisible');
  assert.equal(licAlpha(0.99, LIC_STEPS - 1, LIC_STEPS), 0, 'and so is the last');
  const mid = licAlpha(0.99, Math.floor(LIC_STEPS / 2), LIC_STEPS);
  assert.ok(mid > 0.9, `the middle carries the hair: ${mid}`);
  // brightness is remapped from the floor, so culling the floor does not dim what survives it
  assert.ok(licAlpha(LIC_NOISE_FLOOR, 7, LIC_STEPS) < 0.01, 'a hair exactly at the floor is invisible');
  assert.ok(licAlpha(0.999, 7, LIC_STEPS) > 0.9, 'and the brightest is nearly opaque');
  assert.ok(licAlpha(0.99, 5, 1) === 0, 'a degenerate hair contributes nothing rather than dividing by zero');
});

test('a step follows the field direction, and a dead zone ends the hair rather than faking one', () => {
  const s = licStep(100, 100, 3, 0, 10);
  assert.ok(s.moved);
  assert.ok(Math.abs(s.x - 110) < 1e-9 && Math.abs(s.y - 100) < 1e-9, 'advanced along +x by exactly the step');
  assert.ok(Math.abs(Math.hypot(s.ux, s.uy) - 1) < 1e-12, 'the direction is a unit vector');

  const dead = licStep(100, 100, 0, 0, 10);
  assert.equal(dead.moved, false, 'no force ⇒ no step');
  assert.deepEqual([dead.x, dead.y], [100, 100], 'and the point does not drift');

  // magnitude must not change the step LENGTH — LIC traces direction, and a magnitude-scaled step
  // would stretch hairs in strong regions into streaks that read as speed rather than shape.
  const weak = licStep(0, 0, 1e-6, 0, 10);
  const strong = licStep(0, 0, 1e6, 0, 10);
  assert.ok(Math.abs(weak.x - strong.x) < 1e-9, 'a weak field steps exactly as far as a strong one');

  assert.deepEqual(licDirection(0, 0), { x: 0, y: 0 }, 'a dead direction is zero, not NaN');
});
