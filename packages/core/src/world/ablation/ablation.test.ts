/**
 * F1.8 — kernel ablation tests. Every ablation must EXECUTE its probe (not assert a stored verdict), and
 * each element's minimal distinguishing fixture must actually distinguish. Includes negative fixtures:
 * ablations that must NOT report loss, so the harness cannot trivially "find" necessity everywhere.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runAblations,
  kernelComparison,
  relationsFromTransitions,
  operationsFromTransitions,
  K_ELEMENTS,
  K0_ELEMENTS,
} from './ablation.ts';
import type { AblationForm } from './ablation.ts';

test('F1.8 battery: all four ablation forms are exercised and every record is complete', () => {
  const records = runAblations();
  assert.ok(records.length >= 15, `expected a full battery, got ${records.length}`);
  const forms = new Set<AblationForm>(records.map((r) => r.form));
  for (const f of ['removal', 'collapse', 'substitution', 'reconstruction'] as AblationForm[]) {
    assert.ok(forms.has(f), `ablation form "${f}" must be exercised`);
  }
  for (const r of records) {
    assert.ok(r.hypothesis.length > 0, `${r.element}: hypothesis`);
    assert.ok(r.transformation.length > 0, `${r.element}: transformation`);
    assert.ok(r.fixture.length > 0, `${r.element}: fixture`);
    assert.ok(r.expectedDistinguishingCase.length > 0, `${r.element}: distinguishing case`);
    assert.ok(r.observed.length > 0, `${r.element}: observed`);
    assert.ok(r.evidence.length > 0, `${r.element}: evidence`);
    assert.ok(r.implication.length > 0, `${r.element}: implication`);
  }
});

test('F1.8-A Dynamics: declarative-only substitution is incomplete (non-substitutable)', () => {
  const r = runAblations().find((x) => x.element === 'Dynamics' && x.form === 'substitution')!;
  assert.equal(r.classification, 'non-substitutable');
  assert.match(r.observed, /unrepresentable/);
  // the observed string must report a real opaque count from the F1.5 corpus
  assert.ok(/covers \d+\/\d+/.test(r.observed));
});

test('F1.8-A DynamicsContract is an execution boundary, NOT promoted to a kernel primitive', () => {
  const r = runAblations().find((x) => x.element === 'DynamicsContract')!;
  assert.equal(r.classification, 'execution-boundary-only');
  const row = kernelComparison().find((x) => x.element === 'DynamicsContract')!;
  assert.equal(row.retainedInK0, false, 'the contract must not become an eighth kernel element');
});

test('F1.8-B Opportunity: derived-complete, and every lower input is necessary', () => {
  const records = runAblations();
  const recon = records.find((x) => x.element === 'Opportunity (Ω_sys)')!;
  assert.equal(recon.classification, 'derived-complete');
  for (const input of ['capability', 'authority', 'projection', 'reachability', 'history']) {
    const r = records.find((x) => x.element === `Ω_sys ← ${input}`)!;
    assert.equal(r.classification, 'necessary-component', `${input} must be necessary`);
    assert.match(r.observed, /changed=true/, `${input} removal must change the derivation`);
  }
  assert.equal(kernelComparison().find((x) => x.element.startsWith('Opportunity'))!.retainedInK0, false);
});

test('F1.8-C Interaction: derived-conditional; coupling vs shared cause is structural', () => {
  const records = runAblations();
  const recon = records.find((x) => x.element === 'Interaction episode')!;
  assert.equal(recon.classification, 'derived-conditional');
  const cvs = records.find((x) => x.element === 'Coupling vs shared cause')!;
  assert.equal(cvs.classification, 'non-substitutable');
  // shared cause must survive the MOST permissive thresholds without becoming an episode
  assert.match(cvs.observed, /shared-cause under the most permissive thresholds → 0 episode/);
  const win = records.find((x) => x.element === 'Episode ← recurrence window')!;
  assert.match(win.observed, /window=5 → 0 episode\(s\); window=∞ → 1/);
});

test('F1.8-D Relations: observed edges reconstruct, latent/typed semantics are LOST', () => {
  // the probe itself, executed directly
  const reconstructed = relationsFromTransitions([{ step: 1, from: 'A', to: 'C', operation: 'op', influence: 5 }]);
  assert.equal(reconstructed.length, 1);
  assert.ok(!reconstructed.some((r) => r.to === 'B'), 'latent A→B is not recoverable');
  assert.equal(reconstructed[0]?.type, 'observed-edge', 'declared relation type is not recoverable');

  const r = runAblations().find((x) => x.element === 'Relations')!;
  assert.equal(r.classification, 'collapsible-with-loss');
  assert.equal(kernelComparison().find((x) => x.element === 'Relations')!.retainedInK0, true);
});

test('F1.8-D Operations: latent (never-invoked) operations are not reconstructible', () => {
  const reconstructed = operationsFromTransitions([{ step: 1, from: 'A', to: 'B', operation: 'act', influence: 5 }]);
  assert.deepEqual(reconstructed, ['act']);
  assert.ok(!reconstructed.includes('latent'));
  const r = runAblations().find((x) => x.element === 'Operations')!;
  assert.equal(r.classification, 'non-substitutable');
});

test('F1.8-E Capability/Authority: collapse loses the diagnosis; the two stay independent', () => {
  const records = runAblations();
  const collapse = records.find((x) => x.element === 'Capability / Authority' && x.form === 'collapse')!;
  assert.equal(collapse.classification, 'collapsible-with-loss');
  assert.match(collapse.observed, /uncollapsed distinguishes=true/);
  assert.match(collapse.observed, /indistinguishable=true/);
  // neither becomes a kernel element
  assert.equal(kernelComparison().find((x) => x.element.startsWith('Capability'))!.retainedInK0, false);
});

test('F1.8-F Projection: materially changes the derivation over identical state (does not collapse)', () => {
  const r = runAblations().find((x) => x.element === 'Projection')!;
  assert.equal(r.classification, 'non-substitutable');
  assert.match(r.observed, /available true vs false/);
  assert.equal(kernelComparison().find((x) => x.element === 'Projection')!.retainedInK0, true);
});

test('F1.8-G Invariants: cannot be guards inside an opaque substrate (kernel-side)', () => {
  const r = runAblations().find((x) => x.element === 'Invariants')!;
  assert.equal(r.classification, 'necessary-component');
  assert.match(r.observed, /inspectInternalState=false/);
});

test('F1.8 negative fixture: the harness does NOT report loss where none occurs', () => {
  // invoked operations and observed edges ARE reconstructible — the harness must say so
  const ops = operationsFromTransitions([
    { step: 1, from: 'A', to: 'B', operation: 'act', influence: 5 },
    { step: 2, from: 'B', to: 'A', operation: 'ack', influence: 5 },
  ]);
  assert.deepEqual(ops, ['ack', 'act'], 'invoked operations reconstruct without loss');
  const edges = relationsFromTransitions([
    { step: 1, from: 'A', to: 'B', operation: 'op', influence: 5 },
    { step: 2, from: 'B', to: 'A', operation: 'op', influence: 5 },
  ]);
  assert.equal(edges.length, 2, 'both observed edges reconstruct');
  // and the records record the preserved behavior, not only the loss
  const rel = runAblations().find((x) => x.element === 'Relations')!;
  assert.ok(rel.preservedBehavior?.includes('observed interaction edges'));
});

test('F1.8 K vs K₀: every removed element names its replacing derivation; every retained one a counterexample', () => {
  const rows = kernelComparison();
  assert.equal(K_ELEMENTS.length, 7);
  assert.equal(K0_ELEMENTS.length, 4);
  for (const row of rows) {
    assert.ok(row.reason.length > 0, `${row.element}: reason`);
    assert.ok(row.derivationOrCounterexample.length > 0, `${row.element}: derivation/counterexample`);
    assert.ok(['high', 'medium', 'low'].includes(row.confidence));
    assert.ok(row.remainingUncertainty.length > 0, `${row.element}: uncertainty must be stated`);
  }
  // all seven K elements are retained in K₀ (as elements or typed structures inside X)
  for (const el of K_ELEMENTS) {
    const row = rows.find((r) => r.element === el);
    assert.ok(row, `${el} must be evaluated`);
    assert.equal(row!.retainedInK0, true, `${el} survives ablation`);
  }
  // the three candidate constructs are removed from K₀
  for (const el of ['Opportunity (Ω_sys)', 'Interaction episode', 'Capability / Authority', 'DynamicsContract']) {
    assert.equal(rows.find((r) => r.element === el)!.retainedInK0, false, `${el} is not a K₀ element`);
  }
});
