/**
 * Negative results registry + evidence provenance.
 *
 * The negative registry exists because a regraded prediction erases the intuition behind it. These
 * assertions keep abandoned beliefs permanent, attributed, and honestly labelled as to whether they
 * were recorded when abandoned or reconstructed afterwards.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { negativeResults, negativeLedger, negativeResultProblems } from './negative-results.ts';
import { independenceOf, gradeProvenanceProblems } from './evidence.ts';
import { discoveries } from './discoveries.ts';
import { predictions } from './predictions.ts';
import { projectionClaims, projectionEvidenceProfile } from '../projection/evidence-profile.ts';

// ------------------------------------------------------------------------------ negative results

test('negative: the registry is auditable under its own rules', () => {
  assert.deepEqual(negativeResultProblems(), []);
  assert.equal(negativeLedger().auditable, true);
});

test('negative: every falsified hypothesis names what disproved it and why', () => {
  const falsified = negativeResults().filter((n) => n.status === 'falsified');
  assert.ok(falsified.length >= 3);
  for (const n of falsified) {
    assert.match(n.id, /^N-\d{3}$/);
    assert.ok(n.falsifiedBy, `${n.id} names its falsifier`);
    assert.ok(n.reason && n.reason.length > 40, `${n.id} records why, usefully`);
    // the hypothesis is stated as it was held, not softened into something obviously wrong
    assert.ok(!/obviously|naively|of course/i.test(n.hypothesis), `${n.id} is not retroactively strawmanned`);
  }
});

test('negative: N-001 records the intuition the FSM falsification destroyed', () => {
  const n = negativeResults().find((x) => x.id === 'N-001')!;
  assert.match(n.hypothesis, /specific to search/i);
  assert.equal(n.falsifiedBy, 'FiniteStateMachine');
  assert.equal(n.prediction, 'P-002', 'tied to the prediction whose component missed');
  // and the prediction it references really does record that miss
  const p = predictions().find((x) => x.id === 'P-002')!;
  assert.ok(p.components!.some((c) => !c.held), 'the prediction records the failed component');
});

test('negative: entries reconstructed after the fact are labelled as weaker', () => {
  const l = negativeLedger();
  assert.ok(l.reconstructed > 0, 'Stage-1 abandonments predate the registry');
  for (const n of negativeResults().filter((x) => x.reconstructed)) {
    assert.ok(n.reason && n.reason.length > 40, `${n.id} still carries its reasoning`);
  }
  // contemporaneous entries exist too — the registry is not purely retrospective
  assert.ok(negativeResults().some((n) => !n.reconstructed));
});

test('negative: pending hypotheses have no falsifier and are tied to a prediction', () => {
  const pending = negativeResults().filter((n) => n.status === 'pending');
  assert.ok(pending.length >= 2);
  for (const n of pending) assert.equal(n.falsifiedBy, undefined);
  assert.ok(pending.some((n) => n.id === 'N-002' && n.prediction === 'P-006'), 'the composition hypothesis is registered before it is tested');
});

test('negative: identifiers are dense — a deleted entry would show as a gap', () => {
  const ids = negativeResults().map((n) => n.id);
  ids.forEach((id, i) => assert.equal(id, `N-${String(i + 1).padStart(3, '0')}`));
});

// ------------------------------------------------------------------------------------ provenance

test('provenance: independence is a property of the source, not of confidence', () => {
  assert.equal(independenceOf('emerged-from-prior-mechanism'), 'high');
  assert.equal(independenceOf('revealed-by-independent-substrate'), 'high');
  assert.equal(independenceOf('independent-adversarial-test'), 'medium');
  assert.equal(independenceOf('fixture-against-same-implementation'), 'low');
  assert.equal(independenceOf('architectural-argument'), 'none');
});

test('provenance: maturity may not outrun provenance', () => {
  // the failure this rule exists to prevent
  assert.ok(gradeProvenanceProblems('experimentally-grounded', 'fixture-against-same-implementation')
    .some((p) => p.rule === 'grounded-requires-independence'));
  assert.ok(gradeProvenanceProblems('fixture-supported', 'architectural-argument')
    .some((p) => p.rule === 'fixture-requires-observation'));
  // and the opposite failure: understating what is actually known
  assert.ok(gradeProvenanceProblems('architectural-hypothesis', 'revealed-by-independent-substrate')
    .some((p) => p.rule === 'hypothesis-understates-evidence'));
  // legitimate pairings pass
  assert.deepEqual(gradeProvenanceProblems('experimentally-grounded', 'emerged-from-prior-mechanism'), []);
  assert.deepEqual(gradeProvenanceProblems('fixture-supported', 'fixture-against-same-implementation'), []);
});

test('provenance: every projection claim carries both dimensions, consistently', () => {
  const profile = projectionEvidenceProfile();
  assert.equal(profile.consistent, true, 'no claim is graded above what backs it');
  for (const c of projectionClaims()) {
    assert.ok(c.provenance, `${c.id} declares provenance`);
    assert.deepEqual(gradeProvenanceProblems(c.grade, c.provenance), [], `${c.id}`);
  }
});

test('provenance: only two projection claims rest on anything independent', () => {
  const p = projectionEvidenceProfile();
  assert.equal(p.independentlySupported, 2, 'both from the pre-existing Ω_sys evaluator');
  assert.equal(p.byIndependence.high, 2);
  assert.equal(p.byIndependence.medium, 0, 'no independent adversarial test exists yet — that is the next phase');
  assert.equal(p.byIndependence.low, 2);
  assert.equal(p.byIndependence.none, 4);
});

test('provenance: no discovery rests on an architectural argument', () => {
  for (const d of discoveries()) {
    assert.equal(independenceOf(d.provenance), 'high', `${d.id} — a discovery must be forced by a substrate, not argued`);
  }
});

test('provenance: the profile distinguishes claims that share a maturity grade', () => {
  // the point of the second dimension: two claims can be equally mature and unequally supported
  const grounded = projectionClaims().filter((c) => c.grade === 'experimentally-grounded');
  const fixtures = projectionClaims().filter((c) => c.grade === 'fixture-supported');
  assert.ok(grounded.every((c) => independenceOf(c.provenance) === 'high'));
  assert.ok(fixtures.every((c) => independenceOf(c.provenance) === 'low'));
  // if a fixture-supported claim ever gains an independent adversarial test, independence rises
  // without its maturity grade changing — which is exactly the distinction being drawn
  assert.equal(independenceOf('independent-adversarial-test'), 'medium');
});
