/**
 * The experimental protocol itself, under test.
 *
 * These assertions are not about `DynamicsContract` — they are about whether the method that produces
 * it can be trusted: that discoveries name what forced them, that predictions cannot be graded
 * generously, that convenience is never accepted, and that unsupported claims are labelled as such.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoveries, discoveryLedger, discoveryById } from './discoveries.ts';
import { predictions, predictionAccuracy, gradingProblems } from './predictions.ts';
import { corpus, corpusLedger, churnOf } from './corpus.ts';
import { projectionClaims, projectionEvidenceProfile } from '../projection/evidence-profile.ts';

// ------------------------------------------------------------------------------------ discoveries

test('protocol: every discovery names the substrate that forced it and why it was invisible before', () => {
  const all = discoveries();
  assert.ok(all.length > 0);
  for (const d of all) {
    assert.match(d.id, /^D-\d{3}$/, 'permanent identifier');
    assert.ok(d.discoveredBy.length > 0, `${d.id} names a discovering substrate`);
    assert.ok(d.reason.length > 40, `${d.id} argues why the PRIOR contract was wrong`);
    assert.ok(d.invisibleBecause.length > 40, `${d.id} explains why no existing substrate could reveal it`);
    assert.ok(d.changes.length > 0, `${d.id} cost at least one change`);
  }
});

test('protocol: a discovery may only ever contain structural changes', () => {
  for (const d of discoveries()) {
    for (const c of d.changes) {
      assert.equal(c.classification, 'structural', `${d.id}/${c.member} — a discovery is not a convenience or a rewording`);
    }
  }
});

test('protocol: identifiers are dense and ordered — entries are never renumbered or removed', () => {
  const ids = discoveries().map((d) => d.id);
  assert.deepEqual(ids, [...ids].sort(), 'discovery order is registration order');
  ids.forEach((id, i) => assert.equal(id, `D-${String(i + 1).padStart(3, '0')}`, 'no gaps: a removed entry would show here'));
});

test('protocol: D-001 and D-002 record what was deliberately NOT generalized', () => {
  const d1 = discoveryById('D-001')!;
  const d2 = discoveryById('D-002')!;
  assert.match(d1.deliberatelyExcluded!.join(' '), /completeness/, 'the rejected convenience is attached to the discovery it tempted');
  assert.match(d2.deliberatelyExcluded!.join(' '), /goal-reached|exhausted/, 'the un-added richer split is recorded');
  assert.equal(discoveryLedger().exclusionsRecorded >= 3, true);
});

test('protocol: the two discoveries came from different substrates — neither from the field', () => {
  const l = discoveryLedger();
  assert.equal(l.count, 2);
  assert.equal(l.bySubstrate.QualityGovernor, 1);
  assert.equal(l.bySubstrate.FiniteStateMachine, 1);
  assert.equal(l.bySubstrate.FieldRuntime, undefined, 'the originating substrate has discovered nothing — as expected');
});

// ------------------------------------------------------------------------------------ predictions

test('protocol: the prediction registry is auditable under its own rules', () => {
  assert.deepEqual(gradingProblems(), [], 'grading discipline holds');
  assert.equal(predictionAccuracy().auditable, true);
});

test('protocol: partially-confirmed cannot be used as a slush bucket', () => {
  for (const p of predictions().filter((x) => x.grade === 'partially-confirmed')) {
    const comps = p.components ?? [];
    assert.ok(comps.length >= 2, 'requires >= 2 pre-declared components');
    const held = comps.filter((c) => c.held).length;
    assert.ok(held > 0 && held < comps.length, 'must be a genuine mix — all-hit is confirmed, all-miss is falsified');
  }
});

test('protocol: partial credit is NOT awarded in the accuracy figure', () => {
  const a = predictionAccuracy();
  // 3 graded: 1 confirmed, 1 partial, 1 falsified → accuracy counts ONLY the confirmed
  assert.equal(a.graded, 3);
  assert.equal(a.confirmed, 1);
  assert.equal(a.partiallyConfirmed, 1);
  assert.equal(a.falsified, 1);
  assert.ok(Math.abs(a.accuracy - 1 / 3) < 1e-9, 'a partial is not most of a hit');
});

test('protocol: falsifications are preserved with what they taught', () => {
  const falsified = predictions().filter((p) => p.grade === 'falsified');
  assert.ok(falsified.length > 0, 'a program with no falsifications is not being tested');
  for (const p of falsified) {
    assert.ok(p.lesson && p.lesson.length > 60, `${p.id} keeps its lesson`);
    assert.ok(p.outcome && p.outcome.length > 0);
  }
  // the surprise rate is tracked, not hidden
  assert.ok(predictionAccuracy().surpriseRate > 0, 'surprises are reported');
});

test('protocol: every graded prediction names the commit that registered it', () => {
  for (const p of predictions().filter((x) => x.grade !== 'pending')) {
    assert.match(p.registeredIn, /^[0-9a-f]{7,40}$/, `${p.id} — commit order is the real evidence, not the grade`);
  }
});

test('protocol: pending predictions exist for the phase that has not run', () => {
  const pending = predictions().filter((p) => p.grade === 'pending');
  assert.ok(pending.length >= 4);
  assert.ok(pending.some((p) => p.subject.startsWith('Projection')), 'the next phase is pre-registered before it starts');
  for (const p of pending) assert.equal(p.outcome, undefined, 'a pending prediction has no outcome yet');
});

// -------------------------------------------------------------------------------------- corpus

test('protocol: convenience is never accepted, and rejections are a floor not a total', () => {
  const l = corpusLedger();
  assert.equal(l.conveniencesAccepted, 0);
  assert.equal(l.structuralAccepted, 3, 'accessor + consistency rule + lifecycle');
  assert.equal(l.representationalAccepted, 0, 'no refinement so far merely re-expressed an existing concept');
  assert.equal(l.conveniencesRejected, 1, 'only rejections that were WRITTEN DOWN count');
});

test('protocol: accepted structural changes equal the discovery registry cost', () => {
  const fromCorpus = corpus()
    .filter((e) => e.status === 'adapted')
    .flatMap((e) => e.changes)
    .filter((c) => c.classification === 'structural').length;
  const fromDiscoveries = discoveries().reduce((n, d) => n + d.changes.length, 0);
  assert.equal(fromCorpus, fromDiscoveries, 'the two ledgers must not drift apart');
});

test('protocol: total churn is still 3 across four adapted substrates', () => {
  assert.equal(corpusLedger().totalChurn, 3);
  assert.equal(churnOf(corpus().find((e) => e.substrate === 'SearchPlanner')!.changes), 0);
});

// --------------------------------------------------------------------------- projection evidence

test('protocol: projection claims are graded honestly — most are not evidence yet', () => {
  const p = projectionEvidenceProfile();
  assert.equal(p.grounded, 2, 'only the two claims backed by the independently-built Ω_sys evaluator');
  assert.equal(p.fixtureSupported, 2);
  assert.equal(p.hypotheses, 4, 'four of the seven-ish claims are still architecture, not findings');
  assert.ok(p.groundedFraction < 0.4, 'projection is carrying more weight than its evidence supports');
});

test('protocol: every ungrounded projection claim names the experiment that would ground it', () => {
  assert.equal(projectionEvidenceProfile().allUngroundedHaveAPath, true);
  for (const c of projectionClaims().filter((x) => x.grade !== 'experimentally-grounded')) {
    assert.ok(c.wouldBeGroundedBy.length > 30, `${c.id} names a real experiment, not a gesture`);
  }
});

test('protocol: grounded claims rest on components built BEFORE the thing they support', () => {
  for (const c of projectionClaims().filter((x) => x.grade === 'experimentally-grounded')) {
    assert.match(c.basis, /F1\.6|F1\.8|independently/, `${c.id} — a fixture written alongside the design cannot ground it`);
  }
});

test('protocol: every architectural hypothesis is tied to a registered prediction', () => {
  const registered = new Set(predictions().map((p) => p.id));
  for (const c of projectionClaims().filter((x) => x.grade === 'architectural-hypothesis')) {
    assert.ok(c.prediction, `${c.id} must be pre-registered before its phase runs`);
    assert.ok(registered.has(c.prediction!), `${c.id} references a real prediction`);
  }
});
