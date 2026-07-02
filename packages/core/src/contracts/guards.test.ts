/**
 * Contract guards: each dev-mode guard fires its taxonomy error on a violation and stays quiet on
 * valid input — and the whole layer no-ops when checks are disabled (the production path).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Particle } from '../core/types.ts';
import {
  FieldUIError,
  setContractChecks,
  contractChecksEnabled,
  assertParticleFinite,
  assertBodyMeasurable,
  assertSourceBudgeted,
  assertFieldSource,
  assertStableEnergy,
  assertReducedMotionFallback,
  assertVisualizationPure,
  checkForceContract,
  devWarnNoOp,
  devWarnDeprecated,
  resetNoOpWarnings,
} from './guards.ts';
import { passportFor } from './passport.ts';

const particle = (over: Partial<Particle> = {}): Particle => ({
  x: 0, y: 0, vx: 0, vy: 0, m: 1, heat: 0, size: 1, cap: null, ...over,
});
const rect = (w: number, h: number): DOMRect =>
  ({ x: 0, y: 0, top: 0, left: 0, right: w, bottom: h, width: w, height: h } as DOMRect);

setContractChecks(true); // tests run with enforcement on

test('NAN_PARTICLE: throws on non-finite, passes on finite', () => {
  assert.doesNotThrow(() => assertParticleFinite(particle({ vx: 2, vy: -1 })));
  let caught: unknown;
  try {
    assertParticleFinite(particle({ x: NaN }));
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof FieldUIError, 'throws a FieldUIError');
  assert.equal((caught as FieldUIError).code, 'NAN_PARTICLE');
  assert.throws(() => assertParticleFinite(particle({ vy: Infinity })), /NAN_PARTICLE/);
});

test('SHADOW_BODY_UNMEASURABLE: throws on missing/zero rect, passes on a real one', () => {
  assert.doesNotThrow(() => assertBodyMeasurable(rect(100, 40)));
  assert.throws(() => assertBodyMeasurable(undefined), /SHADOW_BODY_UNMEASURABLE/);
  assert.throws(() => assertBodyMeasurable(rect(0, 0)), /SHADOW_BODY_UNMEASURABLE/);
});

test('UNBUDGETED_SOURCE: a source needs a budget; a non-source never trips', () => {
  const spawn = passportFor('spawn')!;
  assert.doesNotThrow(() => assertSourceBudgeted(spawn, { spawnRate: 4, maxParticles: 200, particleLife: 3 }));
  assert.throws(() => assertSourceBudgeted(spawn, undefined), /UNBUDGETED_SOURCE/);
  assert.throws(() => assertSourceBudgeted(spawn, { spawnRate: 4, maxParticles: 0, particleLife: 3 }), /UNBUDGETED_SOURCE/);
  // attract is not a source — no budget required, never throws
  assert.doesNotThrow(() => assertSourceBudgeted(passportFor('attract')!, undefined));
});

test('NO_FIELD_SOURCE: transport needs a field to follow', () => {
  assert.doesNotThrow(() => assertFieldSource({ x: 0.2, y: -0.1 }));
  assert.throws(() => assertFieldSource(null), /NO_FIELD_SOURCE/);
  assert.throws(() => assertFieldSource({ x: 0, y: 0 }), /NO_FIELD_SOURCE/);
});

test('UNSTABLE_ENERGY: trips above the ceiling', () => {
  assert.doesNotThrow(() => assertStableEnergy(10, 100));
  assert.throws(() => assertStableEnergy(250, 100), /UNSTABLE_ENERGY/);
  assert.throws(() => assertStableEnergy(Infinity, 100), /UNSTABLE_ENERGY/);
});

test('MISSING_REDUCED_MOTION: motion-dependent meaning needs a fallback', () => {
  assert.doesNotThrow(() => assertReducedMotionFallback(true));
  assert.throws(() => assertReducedMotionFallback(false), /MISSING_REDUCED_MOTION/);
});

test('VISUALIZATION_MUTATES_PHYSICS: a pure read returns; a mutating one trips', () => {
  let state = 5;
  const sig = () => String(state);
  assert.equal(assertVisualizationPure(sig, () => state * 2), 10); // pure: state unchanged
  assert.throws(() => assertVisualizationPure(sig, () => (state += 1)), /VISUALIZATION_MUTATES_PHYSICS/);
});

test('checkForceContract: passport.ownsField must match the live field()', () => {
  assert.doesNotThrow(() => checkForceContract({ token: 'magnetism', field: () => {} }, passportFor('magnetism')));
  assert.throws(() => checkForceContract({ token: 'magnetism' }, passportFor('magnetism')), /PASSPORT_VIOLATION/);
  assert.doesNotThrow(() => checkForceContract({ token: 'attract' }, passportFor('attract')));
});

test('guards no-op when checks are disabled (the production path)', () => {
  setContractChecks(false);
  assert.equal(contractChecksEnabled(), false);
  assert.doesNotThrow(() => assertParticleFinite(particle({ x: NaN })));
  assert.doesNotThrow(() => assertBodyMeasurable(undefined));
  setContractChecks(true); // restore for any later tests
});

test('devWarnNoOp: warns once per message in dev, deduped, and never throws (#543)', () => {
  const orig = console.warn;
  const seen: string[] = [];
  console.warn = (msg?: unknown) => void seen.push(String(msg));
  try {
    setContractChecks(true);
    resetNoOpWarnings();
    // first call for a message warns; a per-frame repeat is deduped to silence.
    devWarnNoOp('NOOP_NO_HEATMAP', 'sampleScalar() returned 0 because the heatmap layer is off.');
    devWarnNoOp('NOOP_NO_HEATMAP', 'sampleScalar() returned 0 because the heatmap layer is off.');
    assert.equal(seen.length, 1, 'deduped to one warning');
    assert.match(seen[0], /\[Fundamental:NOOP_NO_HEATMAP\]/);
    // a DIFFERENT message is its own warning.
    devWarnNoOp('NOOP_NO_HEATMAP', 'sampleGradient() returned { x: 0, y: 0 } because the heatmap layer is off.');
    assert.equal(seen.length, 2);
  } finally {
    console.warn = orig;
  }
});

test('devWarnNoOp: silent on the production path (checks disabled)', () => {
  const orig = console.warn;
  let count = 0;
  console.warn = () => void count++;
  try {
    setContractChecks(false);
    resetNoOpWarnings();
    devWarnNoOp('NOOP_NO_HEATMAP', 'should not appear in production.');
    assert.equal(count, 0, 'no warning when contract checks are off');
  } finally {
    console.warn = orig;
    setContractChecks(true); // restore for any later tests
  }
});

test('devWarnDeprecated: warns once per alias id in dev, deduped, canonical names silent (#709)', () => {
  const orig = console.warn;
  const seen: string[] = [];
  console.warn = (msg?: unknown) => void seen.push(String(msg));
  try {
    setContractChecks(true);
    resetNoOpWarnings();
    // the forces:* alias path fires the same id every frame → warned exactly once.
    devWarnDeprecated('forces:captured', "'forces:captured' is a migration alias, removed at 1.0.");
    devWarnDeprecated('forces:captured', "'forces:captured' is a migration alias, removed at 1.0.");
    assert.equal(seen.length, 1, 'deduped to one warning for the same alias');
    assert.match(seen[0], /\[Fundamental:DEPRECATED_ALIAS\]/);
    assert.match(seen[0], /removed at 1\.0/);
    // a DIFFERENT alias id gets its own single warning.
    devWarnDeprecated('forces:released', "'forces:released' is a migration alias, removed at 1.0.");
    assert.equal(seen.length, 2);
  } finally {
    console.warn = orig;
  }
});

test('devWarnDeprecated: silent on the production path (checks disabled)', () => {
  const orig = console.warn;
  let count = 0;
  console.warn = () => void count++;
  try {
    setContractChecks(false);
    resetNoOpWarnings();
    devWarnDeprecated('forces:captured', 'should not appear in production.');
    assert.equal(count, 0, 'no deprecation warning when contract checks are off (production)');
  } finally {
    console.warn = orig;
    setContractChecks(true); // restore for any later tests
  }
});
