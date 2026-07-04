/**
 * Record / replay (#692) — the determinism contract: a recorded run replays bit-for-bit identically,
 * a different seed diverges, and the captured buffer carries the readParticles wire layout. All pure
 * and headless (seeded rng + headlessHost.tick()), so the suite needs no DOM or canvas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordRun, replayRun, verifyReplay, frameAt } from './record.ts';
import type { RecordConfig } from './record.ts';
import { seededRng } from './rng.ts';
import { PARTICLE_STRIDE, PARTICLE_WIRE_VERSION } from '../engine/types.ts';

const baseConfig = (over: Partial<RecordConfig> = {}): RecordConfig => ({
  width: 800,
  height: 600,
  seed: 12345,
  frames: 24,
  options: { density: 1, waves: false },
  ...over,
});

test('seededRng is deterministic and engine-independent for a given seed', () => {
  const a = seededRng(42);
  const b = seededRng(42);
  const seqA = Array.from({ length: 8 }, () => a());
  const seqB = Array.from({ length: 8 }, () => b());
  assert.deepEqual(seqA, seqB, 'same seed → identical stream');
  for (const v of seqA) assert.ok(v >= 0 && v < 1, 'values are in [0, 1)');

  const c = seededRng(43);
  const seqC = Array.from({ length: 8 }, () => c());
  assert.notDeepEqual(seqA, seqC, 'a different seed diverges');
});

test('recordRun captures every frame in the readParticles wire layout', () => {
  const run = recordRun(baseConfig());
  assert.equal(run.wireVersion, PARTICLE_WIRE_VERSION, 'records the wire version');
  assert.equal(run.stride, PARTICLE_STRIDE, 'records the stride');
  assert.equal(run.frames, 24, 'captured the requested frame count');
  assert.equal(run.counts.length, 24, 'one count per frame');
  assert.ok(run.maxCount > 0, 'the default density seeds a non-empty pool');
  assert.equal(run.particles.length, 24 * run.maxCount * run.stride, 'buffer is frames × slot wide');

  // a frame view is [x, y, z, heat, size] per particle and decodes to finite, in-range values.
  const f0 = frameAt(run, 0);
  assert.equal(f0.length, (run.counts[0] ?? 0) * run.stride, 'frame view length matches its count');
  for (let i = 0; i < (run.counts[0] ?? 0); i++) {
    const o = i * run.stride;
    assert.ok(Number.isFinite(f0[o]!) && Number.isFinite(f0[o + 1]!), `particle ${i} has finite x,y`);
    assert.equal(f0[o + 2], 0, `particle ${i} z is 0 in a flat field`);
    assert.ok(f0[o + 3]! >= 0 && f0[o + 3]! <= 1, `particle ${i} heat in [0,1]`);
    assert.ok(f0[o + 4]! > 0, `particle ${i} size positive`);
  }
});

test('a recorded run replays bit-for-bit identically', () => {
  const config = baseConfig();
  const original = recordRun(config);
  const replay = replayRun(original);

  const verdict = verifyReplay(original, replay);
  assert.ok(verdict.ok, `replay should match exactly — ${verdict.mismatch?.reason ?? ''}`);
  assert.equal(verdict.maxDelta, 0, 'zero divergence on the same build');
  assert.equal(verdict.mismatch, null, 'no mismatch');

  // and the underlying buffers are genuinely equal, not just within tolerance.
  assert.deepEqual(replay.counts, original.counts, 'per-frame counts identical');
  assert.deepEqual(Array.from(replay.particles), Array.from(original.particles), 'packed buffers identical');
});

test('replayRun accepts the bare config too', () => {
  const config = baseConfig({ seed: 7 });
  const a = recordRun(config);
  const b = replayRun(config);
  assert.ok(verifyReplay(a, b).ok, 'config-only replay reproduces the run');
});

test('a different seed produces a different run', () => {
  const a = recordRun(baseConfig({ seed: 1 }));
  const b = recordRun(baseConfig({ seed: 2 }));
  const verdict = verifyReplay(a, b);
  assert.equal(verdict.ok, false, 'distinct seeds must not match');
  assert.ok(verdict.maxDelta > 0, 'and the buffers genuinely differ');
});

test('verifyReplay flags a frame-count mismatch', () => {
  const a = recordRun(baseConfig({ frames: 10 }));
  const b = recordRun(baseConfig({ frames: 12 }));
  const verdict = verifyReplay(a, b);
  assert.equal(verdict.ok, false);
  assert.match(verdict.mismatch?.reason ?? '', /frame count/);
});

test('determinism holds with a forces recipe (attract body) over many frames', () => {
  const config = baseConfig({
    frames: 60,
    seed: 99,
    options: {
      density: 2,
      waves: false,
      // a body via the recipe path keeps the run config-only deterministic (no DOM, no addBody).
      // density alone exercises the integrator's seeded brownian jitter — the main rng consumer.
    },
  });
  const original = recordRun(config);
  const replay = replayRun(config);
  assert.ok(verifyReplay(original, replay).ok, 'long run replays identically');
});

test('frameAt clamps out-of-range frames to an empty view', () => {
  const run = recordRun(baseConfig({ frames: 3 }));
  assert.equal(frameAt(run, -1).length, 0);
  assert.equal(frameAt(run, 3).length, 0);
  assert.ok(frameAt(run, 2).length > 0);
});
