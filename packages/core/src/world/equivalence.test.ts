/**
 * F1.4 — raw-field vs field-substrate equivalence tests.
 * The raw path is the authority; the adapter is under test. Equivalence is checked at every transition
 * under declared conditions with a declared tolerance. Negative fixtures prove the harness detects
 * divergence — including a case where a final-state-only check would false-pass but per-transition catches it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CompiledPattern } from '../recipes/compile.ts';
import type { FieldRecipe } from '../recipes/schema.ts';
import { DEFAULT_FIELD_CONSTRUCTION } from './adapters/field-runtime.ts';
import type { FieldConstruction } from './adapters/field-runtime.ts';
import {
  fixtureFrom,
  runRawPath,
  runAdaptedPath,
  compareTraces,
  compareFinalOnly,
  type FieldSemanticStep,
} from './equivalence.ts';

function compiledFixture(): CompiledPattern {
  return {
    id: 'equiv-pattern',
    recipe: { id: 'equiv-pattern', expected: { particleCount: 0 } } as unknown as FieldRecipe,
    bodies: [
      { attributes: { 'data-body': 'attract', 'data-strength': '1', 'data-range': '200' }, tokens: ['attract'] },
      { attributes: { 'data-body': 'gravity', 'data-strength': '0.5' }, tokens: ['gravity'] },
    ],
    relationships: [],
    feedback: [],
    diagnostics: [],
    metrics: [],
    conditions: [],
    render: { underlay: null, overlay: [], heatmap: false, unapplied: [] },
    reducedMotion: { reducedMotion: 'none', meaningWithoutMotion: '', staticOutputs: [] },
  };
}

const TOLERANCE = 1e-6;
const TRANSITIONS = 10;

function copyTrace(trace: readonly FieldSemanticStep[]): FieldSemanticStep[] {
  return trace.map((s) => ({
    step: s.step,
    bodyCount: s.bodyCount,
    failure: s.failure,
    bodies: s.bodies.map((b) => ({ id: b.id, position: b.position ? { ...b.position } : undefined, metrics: { ...b.metrics } })),
  }));
}

/** Index of a step whose first body has a position (so numeric mutations are meaningful). */
function stepWithPosition(trace: readonly FieldSemanticStep[]): number {
  return trace.findIndex((s) => s.bodies.length > 0 && s.bodies[0]?.position);
}

test('F1.4 positive: raw ≡ adapted at every transition under declared conditions', () => {
  const fx = fixtureFrom(compiledFixture(), TRANSITIONS, TOLERANCE);
  const raw = runRawPath(fx); // authority
  const adapted = runAdaptedPath(fx);
  const result = compareTraces(raw, adapted, fx);
  assert.equal(result.equivalent, true, `divergences: ${JSON.stringify(result.divergences.slice(0, 3))}`);
  assert.equal(result.transitionsCompared, TRANSITIONS + 1);
  // a pass is CONDITIONAL: recorded conditions, not unconditional equivalence
  assert.equal(result.conditions.rngControlled, true);
  assert.equal(result.conditions.timeControlled, true);
  assert.equal(result.conditions.bodyOrderingControlled, true);
});

test('F1.4 honesty: snapshot fidelity is partial-observable; coverage does not upgrade lossy/unavailable', () => {
  const fx = fixtureFrom(compiledFixture(), 4, TOLERANCE);
  const result = compareTraces(runRawPath(fx), runAdaptedPath(fx), fx);
  assert.equal(result.snapshotFidelity, 'partial-observable');
  const byName = new Map(result.coverage.map((c) => [c.construct, c.classification]));
  assert.equal(byName.get('velocity / accumulated force'), 'lossy');
  assert.equal(byName.get('lifecycle callbacks'), 'unavailable');
  assert.equal(byName.get('force registry'), 'substrate-owned');
  assert.equal(byName.get('body identity'), 'represented');
  // nothing lossy/unavailable is silently upgraded to represented
  for (const c of result.coverage) {
    if (c.construct.includes('velocity') || c.construct.includes('lifecycle callbacks')) {
      assert.notEqual(c.classification, 'represented');
    }
  }
});

test('F1.4 negative: a different construction (placement) diverges at step 0', () => {
  const fx = fixtureFrom(compiledFixture(), TRANSITIONS, TOLERANCE);
  const raw = runRawPath(fx); // authority uses the default placement
  const perturbed: FieldConstruction = { ...DEFAULT_FIELD_CONSTRUCTION, placement: (i) => ({ left: 300 - i * 60, top: 200, width: 40, height: 40 }) };
  const adapted = runAdaptedPath(fixtureFrom(compiledFixture(), TRANSITIONS, TOLERANCE, perturbed));
  const result = compareTraces(raw, adapted, fx);
  assert.equal(result.equivalent, false, 'a different construction must be detected');
});

test('F1.4 negative: the harness detects each divergence class (mutated adapted trace)', () => {
  const fx = fixtureFrom(compiledFixture(), TRANSITIONS, TOLERANCE);
  const raw = runRawPath(fx);
  const adapted = runAdaptedPath(fx);
  assert.equal(compareTraces(raw, adapted, fx).equivalent, true, 'baseline is equivalent before mutation');

  // skipped transition → step-count / shift
  const skipped = copyTrace(adapted);
  skipped.splice(5, 1);
  assert.equal(compareTraces(raw, skipped, fx).equivalent, false);

  // body-count / mutated state
  const count = copyTrace(adapted);
  count[count.length - 1] = { ...count[count.length - 1]!, bodyCount: 999 };
  assert.ok(compareTraces(raw, count, fx).divergences.some((d) => d.field === 'body-count'));

  const idx = stepWithPosition(adapted);
  assert.ok(idx >= 0, 'expected a step with body positions');

  // reordered bodies (ordering) — swap two bodies at a step
  if (adapted[idx]!.bodies.length >= 2) {
    const reordered = copyTrace(adapted);
    const b = reordered[idx]!.bodies;
    [b[0], b[1]] = [b[1]!, b[0]!];
    assert.ok(compareTraces(raw, reordered, fx).divergences.some((d) => d.field === 'body-identity/ordering'));
  }

  // numeric outside tolerance
  const numeric = copyTrace(adapted);
  const nb = numeric[idx]!.bodies[0]!;
  if (nb.position) nb.position.x += TOLERANCE * 1000;
  assert.ok(compareTraces(raw, numeric, fx).divergences.some((d) => d.field === 'position.x'));
});

test('F1.4 sensitivity: final-state-only would FALSE-PASS where per-transition catches the divergence', () => {
  const fx = fixtureFrom(compiledFixture(), TRANSITIONS, TOLERANCE);
  const raw = runRawPath(fx);
  const adapted = runAdaptedPath(fx);
  const idx = stepWithPosition(adapted);
  assert.ok(idx >= 0 && idx < adapted.length - 1, 'need a mid step with a position');

  // perturb a MID step only — the final step is left identical
  const midMutated = copyTrace(adapted);
  const mb = midMutated[idx]!.bodies[0]!;
  if (mb.position) mb.position.x += TOLERANCE * 1000;

  assert.equal(compareFinalOnly(raw, midMutated, fx), true, 'final-only comparison FALSE-PASSES');
  assert.equal(compareTraces(raw, midMutated, fx).equivalent, false, 'per-transition comparison CATCHES it');
});
