/**
 * The Lab's seeded "Surprise me" (#697) — deterministic from its seed, and every value it
 * emits is sane (in range, never a dead knob like strength 0 or spin 0). A stub catalog
 * stands in for the Lab's paramSpecs so this runs without the DOM.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, rollSurpriseSeed, surpriseFrom, SURPRISE_SEED_MAX, type SurpriseSpec } from './lab-surprise.ts';

const FORCES = ['attract', 'swirl', 'wall', 'sink', 'stream', 'viscosity'] as const;
// every key the draw knows, with the Lab's real ranges (see ATTR + paramSpecs in lab.astro)
const SPECS: Record<string, SurpriseSpec[]> = {
  attract: [
    { key: 'strength', def: 1, min: 0, max: 3, step: 0.03 },
    { key: 'range', def: 300, min: 50, max: 500, step: 5 },
    { key: 'vx', def: 0, min: -8, max: 8, step: 0.5 },
    { key: 'vy', def: 0, min: -8, max: 8, step: 0.5 },
    { key: 'count', def: 1, min: 1, max: 40, step: 1 },
  ],
  swirl: [
    { key: 'strength', def: 1, min: 0, max: 3, step: 0.03 },
    { key: 'range', def: 300, min: 50, max: 500, step: 5 },
    { key: 'spin', def: 1, min: -2, max: 2, step: 0.1 },
    { key: 'vx', def: 0, min: -8, max: 8, step: 0.5 },
    { key: 'vy', def: 0, min: -8, max: 8, step: 0.5 },
    { key: 'count', def: 1, min: 1, max: 40, step: 1 },
  ],
  wall: [
    { key: 'box', def: 40, min: 20, max: 120, step: 2 },
    { key: 'vx', def: 3, min: -8, max: 8, step: 0.5 },
    { key: 'vy', def: 0, min: -8, max: 8, step: 0.5 },
    { key: 'count', def: 1, min: 1, max: 40, step: 1 },
  ],
  sink: [
    { key: 'absorbR', def: 64, min: 24, max: 160, step: 2 },
    { key: 'vx', def: 0, min: -8, max: 8, step: 0.5 },
    { key: 'vy', def: 0, min: -8, max: 8, step: 0.5 },
    { key: 'count', def: 1, min: 1, max: 40, step: 1 },
  ],
  stream: [
    { key: 'strength', def: 1, min: 0, max: 3, step: 0.03 },
    { key: 'range', def: 300, min: 50, max: 500, step: 5 },
    { key: 'angle', def: 0, min: -180, max: 180, step: 5 },
    { key: 'mystery', def: 1, min: 0, max: 2, step: 0.1 }, // unknown key: must never be emitted
    { key: 'count', def: 1, min: 1, max: 40, step: 1 },
  ],
  viscosity: [
    { key: 'strength', def: 0.3, min: 0, max: 0.9, step: 0.009 },
    { key: 'range', def: 300, min: 50, max: 500, step: 5 },
    { key: 'vx', def: 5, min: -8, max: 8, step: 0.5 },
    { key: 'vy', def: 0, min: -8, max: 8, step: 0.5 },
  ],
};
const specsOf = (f: string) => SPECS[f] ?? [];

test('mulberry32 golden — the generator moved from lab.astro is unchanged', () => {
  const rng = mulberry32(7);
  const got = [rng(), rng(), rng()];
  // the first three draws of mulberry32(7), pinned so a future edit cannot silently change
  // the scatter layout or the surprise picks that seeds already encode
  const want = [0.08036041050218046, 0.4520734674297273, 0.6720181778073311];
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(got[i]! - want[i]!) < 1e-15, `draw ${i}: ${got[i]} ≠ ${want[i]}`);
});

test('rollSurpriseSeed stays inside [1, SURPRISE_SEED_MAX] at both ends of random()', () => {
  assert.equal(rollSurpriseSeed(() => 0), 1);
  assert.equal(rollSurpriseSeed(() => 0.999999), SURPRISE_SEED_MAX);
  assert.equal(rollSurpriseSeed(() => 1), SURPRISE_SEED_MAX); // a sloppy random() that returns 1 is still clamped
  for (let i = 0; i < 200; i++) {
    const s = rollSurpriseSeed();
    assert.ok(Number.isInteger(s) && s >= 1 && s <= SURPRISE_SEED_MAX, `seed ${s} out of range`);
  }
});

test('the same seed reproduces the same pick; different seeds spread over the forces', () => {
  for (const seed of [1, 42, 4242, 99999]) {
    assert.deepEqual(surpriseFrom(seed, FORCES, specsOf), surpriseFrom(seed, FORCES, specsOf));
  }
  const forces = new Set<string>();
  for (let seed = 1; seed <= 30; seed++) forces.add(surpriseFrom(seed, FORCES, specsOf).force);
  assert.ok(forces.size >= 2, `30 seeds landed on ${forces.size} force(s)`);
});

test('every emitted value is sane, in range, snapped, known, and different from its default', () => {
  const COUNTS = new Set([1, 6, 12, 24]);
  let emitted = 0;
  for (let seed = 1; seed <= 500; seed++) {
    const pick = surpriseFrom(seed, FORCES, specsOf);
    assert.ok((FORCES as readonly string[]).includes(pick.force), `seed ${seed}: unknown force ${pick.force}`);
    assert.equal(pick.seed, seed);
    const specs = specsOf(pick.force);
    for (const [key, v] of Object.entries(pick.overrides)) {
      emitted++;
      const sp = specs.find((s) => s.key === key);
      assert.ok(sp, `seed ${seed}: emitted an unknown key ${key}`);
      assert.notEqual(key, 'mystery', `seed ${seed}: an unknown knob was moved`);
      assert.ok(Number.isFinite(v), `seed ${seed}: ${key} is ${v}`);
      assert.ok(v >= sp!.min && v <= sp!.max, `seed ${seed}: ${key}=${v} outside [${sp!.min}, ${sp!.max}]`);
      assert.notEqual(v, sp!.def, `seed ${seed}: ${key} emitted at its default`);
      if (key === 'strength') assert.ok(v > 0, `seed ${seed}: strength ${v} is dead`);
      if (key === 'spin') assert.ok(v !== 0, `seed ${seed}: spin 0 is dead`);
      if (key === 'angle') assert.equal(v % 15, 0, `seed ${seed}: angle ${v} not on the 15° grid`);
      if (key === 'vx' || key === 'vy') assert.equal((v * 2) % 1, 0, `seed ${seed}: ${key}=${v} not on the 0.5 grid`);
      if (key === 'count') assert.ok(COUNTS.has(v), `seed ${seed}: count ${v} not in {1,6,12,24}`);
    }
  }
  assert.ok(emitted > 500, `500 seeds moved only ${emitted} knobs — the draw is too timid`);
});

test('an empty force list yields an empty pick rather than throwing', () => {
  assert.deepEqual(surpriseFrom(5, [], specsOf), { seed: 5, force: '', overrides: {} });
});
