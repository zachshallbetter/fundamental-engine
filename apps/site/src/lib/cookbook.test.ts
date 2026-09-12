/**
 * The cookbook's runnable examples, executed.
 *
 * Every headless example on /docs/cookbook lives in src/lib/cookbook/ as a real module. The pages
 * import each module TWICE: once as source (`?raw`, so the snippet a reader copies is literally the
 * file) and once as code, calling it at build time and printing what it returned. So a broken
 * example fails the site build, not a reader's afternoon.
 *
 * This test is the second line: it asserts each example's OUTPUT still means what its page says it
 * means. A snippet that runs but no longer demonstrates its point is the failure mode a cookbook
 * dies of, and these assertions are written against the claim, not the number.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runSignalsFirst } from './cookbook/signals-first.ts';
import { runCustomSink } from './cookbook/custom-sink.ts';
import { runScalarGrid } from './cookbook/scalar-grid.ts';
import { runChannels } from './cookbook/channels.ts';
import { runSeeding } from './cookbook/seeding.ts';
import { runAgent } from './cookbook/agents.ts';
import { runFormations } from './cookbook/formations.ts';
import { runTuning } from './cookbook/tuning.ts';
import { runReading } from './cookbook/reading.ts';

test('signals-first: a headless field runs the simulation and writes channels with no DOM', () => {
  const r = runSignalsFirst();
  assert.equal(r.frames, 60);
  assert.ok(r.particles > 0, 'the pool is populated');
  assert.ok(r.density > 0, 'the body gathered matter — the --d channel is live without any canvas');
});

test('custom sink: feedbackSink receives the same channels the CSS path would write', () => {
  const r = runCustomSink();
  assert.ok(r.writes > 0, 'the sink was invoked');
  assert.ok(r.channels.includes('density'), 'density is among the channels delivered');
  assert.ok(r.lastDensity >= 0);
});

test('scalar grid: deposit diffuses outward and the gradient points back to the source', () => {
  const r = runScalarGrid();
  assert.ok(r.atSource > 0, 'the deposit landed');
  assert.ok(r.nearby > 0, 'diffusion carried value outward');
  assert.ok(r.gradientPointsToSource, 'the up-slope direction points back at the source');
  assert.equal(r.afterDecay, 0, 'decay(1) clears the buffer');
});

test('channels: a registered sampler reads back, swaps live, and removes cleanly', () => {
  const r = runChannels();
  assert.ok(r.moisture > 0, 'the registered channel reads the sampler');
  assert.equal(r.unregistered, 0, 'an unregistered name is safe — it reads 0');
  assert.ok(r.afterSwap > r.moisture, 'set() swapped the sampler live');
  assert.equal(r.afterRemove, 0, 'remove() unregisters the channel');
});

test('seeding: records become matter with stable, unique ids that can be picked back up', () => {
  const r = runSeeding();
  assert.ok(r.particles > 0);
  assert.equal(r.idsRead, r.particles, 'one id per live particle');
  assert.ok(r.idsUnique, 'ids are identity, not position');
  assert.equal(r.foundLabel !== null, true, 'atomAt picked a seeded record back up');
  assert.ok(r.emptySpaceIsNull, 'empty space returns null rather than a nearest-anything guess');
});

test('agents: an engine-stepped agent moves under the field, with no Three.js involved', () => {
  const r = runAgent();
  assert.ok(r.reports > 0, 'report fired per frame');
  assert.ok(r.movedTowardAttractor, 'the field moved it — the position was integrated, not assigned');
});

test('formations: switching the global posture is observable in the matter itself', () => {
  const r = runFormations();
  assert.ok(r.available.includes('lanes') && r.available.includes('ambient'));
  assert.ok(r.lanesDriftsFaster, 'the lanes current carries matter horizontally; ambient rests');
});

test('tuning: the pool is 130 x density, and inspectBudget judges a config before it ships', () => {
  const r = runTuning();
  assert.equal(r.particlesAtDensity1, 130, 'the documented 130 x density rule, measured');
  assert.equal(r.particlesAtQuarter, 33, 'Math.round(130 * 0.25)');
  assert.ok(
    r.findings.some((f) => f.field === 'particles'),
    'an over-budget particle count is reported',
  );
  assert.equal(
    r.tierReadableBackOnJs,
    false,
    'setQualityTier is write-only on JS — the read-back property is a Swift/Kotlin-only surface',
  );
});

test('reading: snapshot -> tick -> snapshot -> diff accounts for what changed', () => {
  const r = runReading();
  assert.equal(r.bodies, 1, 'the query sees the body');
  assert.ok(r.forceBesideWell.x < 0, 'beside the well, the force points back toward it');
  assert.deepEqual(r.forceAtCentre, { x: 0, y: 0 }, 'at the exact centre the pull cancels');
  assert.deepEqual(r.forceBeyondRange, { x: 0, y: 0 }, 'past `range` there is nothing to feel');
  assert.ok(r.diffIsIdentified, 'the diff names the two snapshots it compared');
  assert.ok(r.metricChanges >= 0 && r.bodyChanges >= 0);
});
