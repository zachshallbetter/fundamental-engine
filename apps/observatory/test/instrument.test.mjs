/**
 * Instrument calibration — Phase O11.
 *
 * These tests are NOT about the runtime. They ask whether the instrument preserves the meaning of
 * evidence it cannot alter. Every fixture below is an INSTRUMENT-CALIBRATION FIXTURE: a hand-authored
 * input designed to make the renderer mislead. None of it is evidence about FCI, and none of it may be
 * cited as such.
 *
 *   node --test apps/observatory/test/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  operationsModel, predicatesModel, episodesModel, claimsModel,
  constructibility, representationProblems, EMPHASIS, STATUS_KINDS,
} from '../src/semantics.js';
import { TRANSFORMATIONS, REFUSED_TRANSFORMATIONS, transformationLedger, requiresDisclosure } from '../src/transformations.js';
import { InstrumentLog, INSTRUMENT_PREDICTIONS, measureFidelity, revisionCompatibility } from '../src/instrument.js';

const independenceOf = (p) => ({
  'emerged-from-prior-mechanism': 'high',
  'revealed-by-independent-substrate': 'high',
  'independent-adversarial-test': 'medium',
  'fixture-against-same-implementation': 'low',
  'architectural-argument': 'none',
}[p]);

/* ───────────────────────────────── adversarial instrument-calibration fixtures */

/** Same operation: HIDDEN under one projection, genuinely ABSENT from the world under another. */
const surfaceHidden = {
  identity: { id: 'editor' },
  operations: [
    { operation: 'publish', exposure: 'exposed', signaled: true },
    { operation: 'audit', exposure: 'hidden', signaled: false },
    { operation: 'teleport', exposure: 'unavailable', signaled: false },
  ],
};
const surfaceAuditor = {
  identity: { id: 'auditor' },
  operations: [
    { operation: 'publish', exposure: 'hidden', signaled: false },
    { operation: 'audit', exposure: 'exposed', signaled: true },
    { operation: 'teleport', exposure: 'unavailable', signaled: false },
  ],
};

/** Two claims at the SAME maturity, different independence — the pair that must not look equal. */
const claimsSameMaturity = [
  { id: 'a', claim: 'A', grade: 'fixture-supported', provenance: 'fixture-against-same-implementation' },
  { id: 'b', claim: 'B', grade: 'fixture-supported', provenance: 'independent-adversarial-test' },
  { id: 'c', claim: 'C', grade: 'experimentally-grounded', provenance: 'emerged-from-prior-mechanism' },
  { id: 'd', claim: 'D', grade: 'architectural-hypothesis', provenance: 'architectural-argument', prediction: 'PRED-X', wouldBeGroundedBy: 'a composition experiment' },
];

/** Two equally defensible segmentations over one trace. */
const detections = [
  {
    label: 'window 5', evidenceId: 'detection:0',
    contract: { recurrenceWindow: 5, minimumInfluence: 0.3, boundary: { participants: ['A', 'B'], start: 0, end: 30 } },
    result: { conditional: true, episodes: [{ participants: ['A', 'B'], basis: 'reciprocal' }] },
  },
  {
    label: 'window 25', evidenceId: 'detection:1',
    contract: { recurrenceWindow: 25, minimumInfluence: 0.3, boundary: { participants: ['A', 'B'], start: 0, end: 30 } },
    result: { conditional: true, episodes: [{ participants: ['A', 'B'], basis: 'recurrent' }] },
  },
];

const opportunityUnavailable = {
  operation: 'delete',
  evidence: {
    predicates: [
      { predicate: 'domain-valid', value: true, basis: 'in vocabulary' },
      { predicate: 'capable', value: false, basis: 'participant capabilities' },
      { predicate: 'permitted', value: false, basis: '0 valid grants' },
      { predicate: 'enabled', value: false, basis: 'preconditions' },
      { predicate: 'reachable', value: false, basis: 'reachable outcomes' },
      { predicate: 'exposed', value: false, basis: 'projection' },
    ],
  },
};

/* ──────────────────────────────────────────── R1 hidden ≠ unavailable */

test('R1: hidden and unavailable never collapse — the same operation differs by projection', () => {
  const a = operationsModel(surfaceHidden, null, null);
  const b = operationsModel(surfaceAuditor, null, null);

  const pubA = a.items.find((i) => i.id === 'publish');
  const pubB = b.items.find((i) => i.id === 'publish');
  assert.equal(pubA.statusKind, 'exposed');
  assert.equal(pubB.statusKind, 'hidden', 'hidden under the auditor surface');

  const ghostA = a.items.find((i) => i.id === 'teleport');
  assert.equal(ghostA.statusKind, 'unavailable', 'not in the world at all');
  assert.notEqual(pubB.statusKind, ghostA.statusKind, 'hidden must not equal unavailable');

  assert.deepEqual(representationProblems(a), []);
  assert.deepEqual(representationProblems(b), []);
});

test('R1: a renderer that maps hidden onto unavailable is caught', () => {
  const m = operationsModel(surfaceAuditor, null, null);
  // simulate the defect: a view collapses hidden into the unavailable treatment
  m.items.find((i) => i.id === 'publish').rendersAs = 'unavailable';
  const problems = representationProblems(m);
  assert.ok(problems.some((p) => p.rule === 'R1-hidden-is-not-unavailable'), 'the collapse must be detected');
});

test('R2: no operation is ever dropped — absence would read as nonexistence', () => {
  const m = operationsModel(surfaceHidden, null, null);
  assert.equal(m.items.length, surfaceHidden.operations.length, 'every operation survives rendering');
  // and hiding by default is a refused transformation, not an option
  assert.ok(REFUSED_TRANSFORMATIONS.some((t) => /hiding unavailable operations/.test(t.name)));
});

test('R2: omission without an indicator is caught', () => {
  const m = operationsModel(surfaceHidden, null, null);
  m.omitted = 3;
  assert.ok(representationProblems(m).some((p) => p.rule === 'R2-omission-disclosed'));
  m.disclosures.push({ transformation: 'T-OBS-003', text: 'showing first 400; 3 omitted' });
  assert.deepEqual(representationProblems(m).filter((p) => p.rule === 'R2-omission-disclosed'), []);
});

/* ─────────────────────────────────────── R3 conditionality of episodes */

test('R3: a conditional grouping always travels with its detector parameters', () => {
  const m = episodesModel(detections, 0);
  assert.ok(m.conditional, 'the grouping is marked conditional');
  assert.equal(m.conditional.parameters.recurrenceWindow, 5);
  assert.equal(m.conditional.alternativesAvailable, 1, 'the alternative is not hidden');
  assert.deepEqual(representationProblems(m), []);
});

test('R3: a bare conditional grouping is caught', () => {
  const m = episodesModel(detections, 0);
  m.conditional.parameters = null;
  assert.ok(representationProblems(m).some((p) => p.rule === 'R3-conditional-carries-parameters'));
});

test('R3: the instrument-selected default is declared as a transformation', () => {
  const m = episodesModel(detections, 0);
  assert.equal(m.conditional.selectedByInstrument, true);
  assert.ok(m.transformations.includes('T-OBS-005'), 'defaulting is an instrument choice, not evidence');
  m.transformations = [];
  assert.ok(representationProblems(m).some((p) => p.rule === 'R3-default-selection-declared'));
});

/* ───────────────────────────── R4 maturity vs independence (the hard one) */

test('R4: two claims of equal maturity but different independence stay distinguishable', () => {
  const m = claimsModel(claimsSameMaturity, independenceOf);
  const a = m.items.find((i) => i.id === 'a');
  const b = m.items.find((i) => i.id === 'b');
  assert.equal(a.maturity, b.maturity, 'same maturity — this is the trap');
  assert.notEqual(a.independence, b.independence, 'independence differs and must remain visible');
  assert.equal(a.independence, 'low');
  assert.equal(b.independence, 'medium');
  // maturity and independence are separate channels, never fused into one score
  assert.ok(!('score' in a), 'no combined score may exist');
});

test('R4: each maturity level gets a distinct emphasis token', () => {
  const m = claimsModel(claimsSameMaturity, independenceOf);
  assert.deepEqual(representationProblems(m), []);
  const grades = [...new Set(claimsSameMaturity.map((c) => c.grade))];
  const tokens = new Set(grades.map((g) => EMPHASIS[g]));
  assert.equal(tokens.size, grades.length, 'a hypothesis must never share treatment with a grounded claim');
});

test('R4: reusing one emphasis across maturities is caught', () => {
  const m = claimsModel(claimsSameMaturity, independenceOf);
  m.items.find((i) => i.id === 'd').emphasis = 'grounded'; // hypothesis dressed as a finding
  assert.ok(representationProblems(m).some((p) => p.rule === 'R4-maturity-distinct'));
});

/* ──────────────────────────────────── R7/R8 collapse and disclosure */

test('R7: disagreeing sources must not be merged', () => {
  const m = claimsModel(claimsSameMaturity, independenceOf);
  m.mergedSources = [{ key: 'x', disagreed: true }];
  assert.ok(representationProblems(m).some((p) => p.rule === 'R7-no-collapse-on-disagreement'));
});

test('R8: every non-lossless transformation used is disclosed to the reviewer', () => {
  for (const m of [
    operationsModel(surfaceHidden, surfaceAuditor, 'auditor'),
    predicatesModel(opportunityUnavailable, 'ev-1'),
    episodesModel(detections, 0),
    claimsModel(claimsSameMaturity, independenceOf),
  ]) {
    assert.deepEqual(representationProblems(m).filter((p) => p.rule === 'R8-transformation-disclosed'), [], m.view);
  }
});

test('R8: an undisclosed interpretive transformation is caught', () => {
  const m = predicatesModel(opportunityUnavailable, 'ev-1');
  m.disclosures = [];
  assert.ok(representationProblems(m).some((p) => p.rule === 'R8-transformation-disclosed'));
});

/* ───────────────────────────── predicate salience (P-OBS-001's target) */

test('predicates: all conjuncts render at equal weight, in runtime order, unranked', () => {
  const m = predicatesModel(opportunityUnavailable, 'ev-1');
  assert.equal(m.items.length, 6);
  m.items.forEach((item, i) => assert.equal(item.order, i, 'runtime order preserved, not re-sorted'));
  const failed = m.items.filter((i) => !i.value);
  assert.equal(failed.length, 5, 'five failures — none may be presented as the cause');
  // severity ranking is a refused transformation
  assert.ok(REFUSED_TRANSFORMATIONS.some((t) => /severity ranking/.test(t.name)));
  // the disclosure says so explicitly
  assert.match(m.disclosures.find((d) => d.transformation === 'T-OBS-002').text, /does not rank/);
});

/* ──────────────────────────── refusal instead of a plausible drawing */

test('refusal: a view over insufficient evidence is declined, with a reason and a path', () => {
  const r = constructibility('d', claimsSameMaturity, independenceOf);
  assert.equal(r.constructible, false);
  assert.equal(r.statusKind, 'unsupported');
  assert.match(r.reason, /architectural hypothesis/);
  assert.match(r.availableEvidence, /independence: none/);
  assert.ok(r.wouldBeGroundedBy.length > 0, 'the reviewer is told what would resolve it');
  assert.equal(r.prediction, 'PRED-X', 'and which registered prediction tests it');
});

test('refusal: a grounded claim is constructible', () => {
  const r = constructibility('c', claimsSameMaturity, independenceOf);
  assert.equal(r.constructible, true);
  assert.equal(r.independence, 'high');
});

test('refusal: a missing claim renders as missing, not as false or empty', () => {
  const r = constructibility('nope', claimsSameMaturity, independenceOf);
  assert.equal(r.constructible, false);
  assert.equal(r.statusKind, 'missing', 'missing is its own status, distinct from unsupported');
});

/* ──────────────────────────────────────────── transformation ledger */

test('ledger: every non-lossless transformation states a mitigation shown to the reviewer', () => {
  const l = transformationLedger();
  assert.equal(l.allDisclosed, true);
  assert.ok(l.interpretive > 0, 'the instrument admits to interpretive choices rather than claiming none');
  for (const t of TRANSFORMATIONS.filter(requiresDisclosure)) {
    assert.ok(t.mitigation && t.mitigation.length > 20, `${t.id} states its mitigation`);
  }
});

test('ledger: every transformation names its input, output and evidential basis', () => {
  for (const t of TRANSFORMATIONS) {
    assert.ok(t.input && t.output && t.basis, `${t.id} is fully specified`);
    assert.ok(['lossless', 'lossy-disclosed', 'interpretive'].includes(t.classification), `${t.id} classified`);
    if (t.classification === 'interpretive') assert.ok(t.risk, `${t.id} names its risk`);
  }
});

test('ledger: refused transformations record WHY they are refused', () => {
  assert.ok(REFUSED_TRANSFORMATIONS.length >= 5);
  for (const t of REFUSED_TRANSFORMATIONS) {
    assert.equal(t.classification, 'unsupported');
    assert.ok(t.reason.length > 40, `${t.id} argues the refusal`);
  }
});

/* ──────────────────────────────────── instrument log stays separate */

test('instrument log: instrument events can never be mistaken for subject evidence', () => {
  const log = new InstrumentLog();
  log.record('experiment-loaded', { revision: 'abc123' });
  log.record('segmentation-changed', { from: 0, to: 1 });
  log.record('refusal-shown', { claim: 'd' });

  assert.equal(log.length, 3);
  for (const e of log.events) {
    assert.equal(e.layer, 'instrument', 'every event is labelled as the instrument layer');
    assert.match(e.id, /^I-\d{4}$/, 'the I- prefix cannot collide with a subject evidence id');
  }
  // a reviewer's path through the instrument is itself an episode — of the INSTRUMENT, not the subject
  assert.deepEqual(log.episode, ['experiment-loaded', 'segmentation-changed', 'refusal-shown']);
});

test('instrument log: the two traces remain distinguishable', () => {
  const log = new InstrumentLog();
  log.record('evidence-inspected', { evidenceId: 'projection:editor' });
  const subjectIds = ['projection:editor', 'detection:0', 'D-001'];
  for (const e of log.events) {
    assert.ok(!subjectIds.includes(e.id), 'no instrument id shadows a subject evidence id');
  }
});

/* ────────────────────────────────────────────── instrument predictions */

test('instrument predictions live apart from the FCI registry', () => {
  assert.ok(INSTRUMENT_PREDICTIONS.length >= 4);
  for (const p of INSTRUMENT_PREDICTIONS) {
    assert.match(p.id, /^P-OBS-\d{3}$/, 'a distinct namespace from FCI predictions');
    assert.ok(p.failureCondition.length > 20, `${p.id} states what would falsify it`);
    assert.ok(p.testableBy.length > 20, `${p.id} states how it could be tested`);
    assert.equal(p.status, 'pending', 'none has been tested — none may be reported as confirmed');
  }
});

test('instrument predictions are tied to the transformations they concern', () => {
  const ids = new Set([...TRANSFORMATIONS, ...REFUSED_TRANSFORMATIONS].map((t) => t.id));
  for (const p of INSTRUMENT_PREDICTIONS) {
    assert.ok(ids.has(p.relatedTransformation), `${p.id} references a real transformation`);
  }
});

/* ──────────────────────────────────────────────── fidelity measurement */

test('fidelity: measured honestly, and interpretation error is NOT presumed zero', () => {
  const bundle = {
    revision: { bundleSchema: 'observatory-bundle/1' },
    evidence: [{ id: 'ev-1' }, { id: 'projection:editor' }],
    runs: [{ transitions: [{ step: 0 }, { step: 1 }, { step: 2 }] }],
  };
  const models = [predicatesModel(opportunityUnavailable, 'ev-1'), operationsModel(surfaceHidden, null, null)];
  const f = measureFidelity(bundle, models);

  assert.equal(f.transformationDisclosure, 1, 'every lossy/interpretive transformation is disclosed');
  assert.equal(f.semanticDistinctionPreserved, true);
  assert.equal(f.replayFidelityExact, true);
  assert.equal(f.statusKindsTracked, STATUS_KINDS.length);

  // the one that must never be faked
  assert.equal(f.interpretationError.measured, false);
  assert.equal(f.interpretationError.value, null, 'unmeasured is not zero');
  assert.match(f.interpretationError.reason, /review tasks/);
});

test('fidelity: trace completeness falls when an item cites evidence that is not present', () => {
  const bundle = {
    revision: { bundleSchema: 'observatory-bundle/1' },
    evidence: [{ id: 'ev-1' }],
    runs: [],
  };
  const dangling = predicatesModel(opportunityUnavailable, 'missing-node');
  assert.equal(measureFidelity(bundle, [dangling]).traceCompleteness, 0, 'the instrument does not flatter itself');
  assert.equal(measureFidelity(bundle, [predicatesModel(opportunityUnavailable, 'ev-1')]).traceCompleteness, 1);
});

test('revision fidelity: a foreign schema is refused, not reinterpreted with present-day semantics', () => {
  const current = { revision: { bundleSchema: 'observatory-bundle/1' } };
  assert.equal(revisionCompatibility(current, current).compatible, true);
  const older = { revision: { bundleSchema: 'observatory-bundle/0' } };
  const r = revisionCompatibility(current, older);
  assert.equal(r.compatible, false);
  assert.match(r.reason, /cannot be rendered with/);
  assert.equal(revisionCompatibility(current, {}).compatible, false);
});
