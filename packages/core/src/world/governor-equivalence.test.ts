/**
 * G3.1/G3.2 — second-substrate adapter conformance + raw-vs-adapted equivalence tests.
 * Positive equivalence, truthful capability declaration, restore/replay (which the field CANNOT do),
 * failure projection, and negative fixtures proving the harness detects divergence — including a case
 * where final-state-only comparison would falsely pass.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostWorld } from './kernel.ts';
import { createWorldEnvelope } from './envelope.ts';
import { validateDynamicsContract } from './dynamics.ts';
import type { World } from './world.ts';
import { governorDynamics } from './adapters/governor-runtime.ts';
import {
  governorFixture,
  runRawGovernorPath,
  runAdaptedGovernorPath,
  compareGovernorTraces,
  compareGovernorFinalOnly,
  GOVERNOR_SNAPSHOT_FIDELITY,
  type GovernorSemanticStep,
} from './governor-equivalence.ts';

function world(): World {
  return { envelope: createWorldEnvelope('governor-world'), entities: [], relations: [], invariants: [], projections: [] };
}

/** 10 overruns >20ms escalates to tier 1; then clean frames begin recovery. */
const ESCALATING = [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 10, 10, 10];

function copy(trace: readonly GovernorSemanticStep[]): GovernorSemanticStep[] {
  return trace.map((s) => ({ ...s }));
}

test('G3.1 contract: the governor declares capabilities truthfully and is self-consistent', () => {
  const c = governorDynamics(world());
  assert.deepEqual(validateDynamicsContract(c), [], 'contract declarations must be self-consistent');
  assert.equal(c.executionKind, 'interpreted');
  assert.equal(c.determinism.classification, 'deterministic');
  assert.deepEqual(c.determinism.uncontrolledInputs, [], 'no clock, no RNG');
  // capabilities the FIELD cannot claim — the contrast that makes this a real second substrate
  assert.equal(c.capabilities.restore, true);
  assert.equal(c.capabilities.replay, true);
  assert.equal(c.capabilities.inspectInternalState, true);
  assert.equal(c.capabilities.declareTransitionLaw, true);
  assert.equal(c.capabilities.deterministicReplay, true);
});

test('G3.2 positive: raw ≡ adapted at every transition under declared conditions', () => {
  const fx = governorFixture(ESCALATING);
  const raw = runRawGovernorPath(fx);
  const adapted = runAdaptedGovernorPath(fx);
  const r = compareGovernorTraces(raw, adapted, fx);
  assert.equal(r.equivalent, true, `divergences: ${JSON.stringify(r.divergences.slice(0, 3))}`);
  assert.equal(r.transitionsCompared, ESCALATING.length + 1);
  // the escalation actually happened (otherwise the fixture proves nothing)
  assert.ok(raw.some((s) => s.tier === 1), 'fixture must exercise a tier escalation');
  // conditions are recorded, and inapplicable controls are declared, not silently claimed
  assert.equal(r.conditions.operationOrderControlled, true);
  assert.ok(r.conditions.notApplicable.includes('randomness'));
  assert.ok(r.conditions.notApplicable.includes('clock'));
});

test('G3.2 fidelity: snapshot is complete-restorable and restore actually reconstructs state', () => {
  assert.equal(GOVERNOR_SNAPSHOT_FIDELITY, 'complete-restorable');
  const w = world();
  const c = governorDynamics(w);
  const host = hostWorld(w, c);
  for (const d of ESCALATING) host.advance({ durationMs: d });
  const snap = host.readState();
  assert.ok(snap.ok);
  assert.equal(snap.value.restorable, true);

  // restore into a fresh contract and confirm the state matches exactly
  const restored = c.restore!(snap.value, { step: 0 });
  assert.ok(restored.ok);
  assert.equal(restored.value.governor.tier, snap.value.reading.metrics.tier);
  assert.equal(restored.value.governor.overrunStreak, snap.value.reading.metrics.overrunStreak);
  assert.equal(restored.value.governor.cleanStreak, snap.value.reading.metrics.cleanStreak);
});

test('G3.2 failure: invalid input is projected through the generic taxonomy, native cause retained', () => {
  const w = world();
  const host = hostWorld(w, governorDynamics(w));
  const bad = host.advance({ durationMs: Number.NaN });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.equal(bad.error.code, 'invalid-state', 'projected through the generic failure taxonomy');
    assert.ok(bad.error.cause !== undefined, 'native cause retained internally');
    assert.ok(!/QualityGovernor|GovernorState/.test(bad.error.message), 'no native type leaked into the message');
  }
  // raw and adapted agree about the failure at the same step
  const fx = governorFixture([30, Number.NaN, 30]);
  const r = compareGovernorTraces(runRawGovernorPath(fx), runAdaptedGovernorPath(fx), fx);
  assert.equal(r.equivalent, true, 'failure equivalence holds at the transition level');
});

test('G3.2 restore ⇒ replay: restoring mid-run and replaying reproduces the same tail', () => {
  const fx = governorFixture(ESCALATING);
  const full = runRawGovernorPath(fx);
  const w = world();
  const c = governorDynamics(w);
  const host = hostWorld(w, c);
  for (let i = 0; i < 5; i++) host.advance({ durationMs: ESCALATING[i]! });
  const mid = host.readState();
  assert.ok(mid.ok);
  // restoring mid-run reproduces the exact mid-run state (the field substrate cannot do this)
  const restoredMid = c.restore!(mid.value, { step: 0 });
  assert.ok(restoredMid.ok);
  assert.equal(restoredMid.value.governor.overrunStreak, full[5]!.overrunStreak);
  assert.equal(restoredMid.value.governor.tier, full[5]!.tier);
  const w2 = world();
  const c2 = governorDynamics(w2);
  const host2 = hostWorld(w2, c2);
  for (const d of ESCALATING) host2.advance({ durationMs: d });
  const rs = host2.readState();
  assert.ok(rs.ok);
  assert.equal(rs.value.reading.metrics.tier, full[full.length - 1]!.tier, 'deterministic replay reproduces the final tier');
});

test('G3.2 negative: altered operation ORDER diverges (streak state is order-dependent)', () => {
  // rule is `duration > 50`, so 60ms qualifies; 3 consecutive → tier 3
  const ordered = governorFixture([60, 60, 60, 10]);
  const shuffled = governorFixture([60, 10, 60, 60]); // streak broken → no escalation
  const a = runRawGovernorPath(ordered);
  const b = runRawGovernorPath(shuffled);
  assert.notEqual(a[a.length - 1]!.tier, b[b.length - 1]!.tier, 'order materially changes the outcome');
  const r = compareGovernorTraces(a, runAdaptedGovernorPath(shuffled), ordered);
  assert.equal(r.equivalent, false, 'the harness detects an order change');
});

test('G3.2 negative: the harness detects each divergence class', () => {
  const fx = governorFixture(ESCALATING);
  const raw = runRawGovernorPath(fx);
  const adapted = runAdaptedGovernorPath(fx);
  assert.equal(compareGovernorTraces(raw, adapted, fx).equivalent, true, 'baseline equivalent before mutation');

  // changed input value — a clean frame breaks the streak, so tier 1 is never reached
  const changedInput = runAdaptedGovernorPath(governorFixture([30, 30, 30, 30, 10, 30, 30, 30, 30, 30, 10, 10, 10]));
  assert.equal(compareGovernorTraces(raw, changedInput, fx).equivalent, false);

  // skipped transition
  const skipped = copy(adapted);
  skipped.splice(5, 1);
  assert.equal(compareGovernorTraces(raw, skipped, fx).equivalent, false);

  // changed failure result
  const failed = copy(adapted);
  failed[4] = { ...failed[4]!, failure: 'substrate-failure' };
  assert.ok(compareGovernorTraces(raw, failed, fx).divergences.some((d) => d.field === 'failure'));

  // reordered tier-change event
  const reordered = copy(adapted);
  const iChanged = reordered.findIndex((s) => s.changed);
  assert.ok(iChanged > 0, 'need a tier-change event');
  reordered[iChanged] = { ...reordered[iChanged]!, changed: false };
  reordered[iChanged - 1] = { ...reordered[iChanged - 1]!, changed: true };
  assert.ok(compareGovernorTraces(raw, reordered, fx).divergences.some((d) => d.field === 'changed(event)'));
});

test('G3.2 sensitivity: final-state-only would FALSE-PASS where per-transition catches it', () => {
  const fx = governorFixture(ESCALATING);
  const raw = runRawGovernorPath(fx);
  const adapted = runAdaptedGovernorPath(fx);
  // perturb a MID step only; the final step is left identical
  const midMutated = copy(adapted);
  const i = 3;
  midMutated[i] = { ...midMutated[i]!, overrunStreak: midMutated[i]!.overrunStreak + 7 };
  assert.equal(compareGovernorFinalOnly(raw, midMutated, fx), true, 'final-only FALSE-PASSES');
  assert.equal(compareGovernorTraces(raw, midMutated, fx).equivalent, false, 'per-transition CATCHES it');
});
