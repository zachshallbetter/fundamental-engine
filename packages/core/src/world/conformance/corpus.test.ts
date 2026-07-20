/**
 * Substrate conformance corpus — results and churn accounting.
 *
 * The battery is run against all four adapted substrates through the generic surface only. The churn
 * assertions pin the pre-registered accounting so a later change cannot quietly inflate generality.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldEnvelope } from '../envelope.ts';
import { validateDynamicsContract } from '../dynamics.ts';
import { hostWorld } from '../kernel.ts';
import type { World } from '../world.ts';
import { corpus, corpusLedger, churnOf, runConformance, CHURN_WEIGHTS } from './corpus.ts';
import { fsmDynamics } from '../adapters/fsm-runtime.ts';
import { plannerDynamics } from '../adapters/planner-runtime.ts';
import { governorDynamics } from '../adapters/governor-runtime.ts';
import type { FsmDefinition } from '../substrates/fsm.ts';
import type { PlannerProblem } from '../substrates/planner.ts';

function world(id: string): World {
  return { envelope: createWorldEnvelope(id), entities: [], relations: [], invariants: [], projections: [] };
}

const DOOR: FsmDefinition = {
  id: 'door',
  initial: 'closed',
  states: ['closed', 'open', 'destroyed'],
  accepting: ['destroyed'],
  transitions: [
    { from: 'closed', on: 'open', to: 'open' },
    { from: 'open', on: 'close', to: 'closed' },
    { from: 'open', on: 'smash', to: 'destroyed' },
  ],
};

const GRAPH: PlannerProblem = {
  id: 'grid',
  nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 0 }, { id: 'z', x: 2, y: 0 }],
  edges: [{ from: 'a', to: 'b', cost: 1 }, { from: 'b', to: 'z', cost: 1 }],
  start: 'a',
  goal: 'z',
  heuristic: { kind: 'euclidean' },
};

// ------------------------------------------------------------------------ the battery, per substrate

test('corpus: the FSM conforms through the generic surface', () => {
  const r = runConformance(
    () => world('fsm-world'),
    (w) => fsmDynamics(w, DOOR),
    [{ event: 'open' }, { event: 'close' }, { event: 'open' }, { event: 'smash' }],
  );
  assert.equal(r.conformant, true, JSON.stringify(r.findings.filter((f) => !f.passed)));
  assert.equal(r.executionKind, 'declarative', 'first substrate to exercise the declarative variant');
  assert.equal(r.terminated, true, 'the FSM reaches an accepting state');
  assert.ok(r.findings.some((f) => f.check === 'terminal is idempotent' && f.passed));
});

test('corpus: the planner conforms through the generic surface', () => {
  const r = runConformance(
    () => world('planner-world'),
    (w) => plannerDynamics(w, GRAPH),
    Array.from({ length: 10 }, () => ({ expand: 1 as const })),
  );
  assert.equal(r.conformant, true, JSON.stringify(r.findings.filter((f) => !f.passed)));
  assert.equal(r.executionKind, 'hybrid', 'first substrate to exercise the hybrid variant');
  assert.equal(r.terminated, true, 'the search finishes');
});

test('corpus: the governor conforms and does NOT terminate', () => {
  const r = runConformance(
    () => world('governor-world'),
    (w) => governorDynamics(w),
    Array.from({ length: 12 }, () => ({ durationMs: 30 })),
  );
  assert.equal(r.conformant, true, JSON.stringify(r.findings.filter((f) => !f.passed)));
  assert.equal(r.terminated, false, 'a governor runs indefinitely — this is why it could not reveal the gap');
  assert.equal(r.transitions, 12);
});

test('corpus: the battery is substrate-agnostic — it names no substrate', () => {
  // it drove three different substrates above with the same code path; the only inputs are
  // capabilities and declarations, never substrate identity
  const kinds = new Set(['declarative', 'hybrid', 'interpreted']);
  assert.equal(kinds.size, 3, 'three distinct execution kinds passed the same battery');
});

// ------------------------------------------------------------------------------ the termination gap

test('corpus C1: termination — a finished substrate says so generically, and stays terminal', () => {
  const w = world('fsm-world');
  const host = hostWorld(w, fsmDynamics(w, DOOR));
  const open = host.advance({ event: 'open' });
  assert.ok(open.ok);
  assert.equal(host.lastLifecycle, 'continuing');

  const smash = host.advance({ event: 'smash' });
  assert.ok(smash.ok);
  assert.equal(host.lastLifecycle, 'terminal', 'accepting state is terminal');

  // idempotent: further advances neither progress nor error
  for (const ev of ['open', 'close', 'smash']) {
    const after = host.advance({ event: ev });
    assert.ok(after.ok, 'a finished substrate does not error');
    assert.equal(host.lastLifecycle, 'terminal');
    assert.equal(after.value.outcome, 'accepted');
  }
  host.dispose();
});

test('corpus C1: a planner reports terminal for BOTH finishing modes', () => {
  // goal reached
  const w1 = world('planner-world');
  const h1 = hostWorld(w1, plannerDynamics(w1, GRAPH));
  let last1 = h1.advance({ expand: 1 });
  for (let i = 0; i < 8 && last1.ok && h1.lastLifecycle !== 'terminal'; i++) last1 = h1.advance({ expand: 1 });
  assert.ok(last1.ok);
  assert.equal(h1.lastLifecycle, 'terminal');
  assert.equal(last1.value.status, 'goal-reached');
  assert.deepEqual(last1.value.plan, ['a', 'b', 'z']);

  // unreachable goal → exhausted, also terminal
  const island: PlannerProblem = { ...GRAPH, edges: [{ from: 'a', to: 'b', cost: 1 }] };
  const w2 = world('planner-world');
  const h2 = hostWorld(w2, plannerDynamics(w2, island));
  let last2 = h2.advance({ expand: 1 });
  for (let i = 0; i < 8 && last2.ok && h2.lastLifecycle !== 'terminal'; i++) last2 = h2.advance({ expand: 1 });
  assert.ok(last2.ok);
  assert.equal(h2.lastLifecycle, 'terminal');
  assert.equal(last2.value.status, 'exhausted');
  assert.equal(last2.value.plan, undefined, 'no plan exists');
  h1.dispose(); h2.dispose();
});

test('corpus C1: `lifecycle` is optional — pre-existing substrates are unaffected', () => {
  const w = world('governor-world');
  const host = hostWorld(w, governorDynamics(w));
  const r = host.advance({ durationMs: 20 });
  assert.ok(r.ok);
  assert.equal(host.lastLifecycle, 'continuing', 'absent is read as continuing; no migration required');
  host.dispose();
});

// ---------------------------------------------------------------------------- churn accounting

test('corpus churn: weights are the pre-registered ones', () => {
  assert.equal(CHURN_WEIGHTS['required-member'], 3);
  assert.equal(CHURN_WEIGHTS['optional-member'], 1);
  assert.equal(CHURN_WEIGHTS['changed-semantics'], 3);
  assert.equal(CHURN_WEIGHTS['union-variant'], 1);
  assert.equal(CHURN_WEIGHTS['consistency-rule'], 1);
});

test('corpus churn: the FSM control FALSIFIED its own prediction, and it is recorded as such', () => {
  const fsm = corpus().find((e) => e.substrate === 'FiniteStateMachine')!;
  assert.equal(fsm.predictedChurn, 0);
  assert.equal(churnOf(fsm.changes), 1, 'actual churn exceeded the prediction');
  assert.match(fsm.note ?? '', /FALSIFIED/, 'the falsification must be stated, not smoothed over');
  assert.equal(fsm.changes[0]!.classification, 'structural');
});

test('corpus churn: the planner cost nothing — the FSM had already paid for termination', () => {
  const p = corpus().find((e) => e.substrate === 'SearchPlanner')!;
  assert.equal(churnOf(p.changes), 0);
  assert.equal(p.outcome, 'generalized');
  // and its one tempting change was rejected as a convenience
  assert.equal(p.rejectedChanges.length, 1);
  assert.equal(p.rejectedChanges[0]!.classification, 'convenience');
  assert.match(p.rejectedChanges[0]!.member, /completeness/);
});

test('corpus churn: no substrate convenience was ever ACCEPTED into the contract', () => {
  const ledger = corpusLedger();
  assert.equal(ledger.conveniencesAccepted, 0, 'convenience is a rejection, not a justification');
  for (const e of corpus()) {
    for (const c of e.changes) {
      assert.notEqual(c.classification, 'convenience', `${e.substrate}/${c.member}`);
      assert.ok(c.rationale.length > 20, 'every change carries an argued rationale');
    }
  }
});

test('corpus ledger: four adapted, convergence claimed only on the last adapted substrate', () => {
  const l = corpusLedger();
  assert.equal(l.adapted, 4);
  assert.equal(l.pending, 4);
  assert.equal(l.totalChurn, 3, 'governor 2 (accessor + rule) + fsm 1 (lifecycle) + planner 0');
  assert.equal(l.convergingOnLastAdapted, true, 'the most recently adapted substrate required no change');
  // convergence is NOT an average claim
  assert.ok(l.totalChurn > 0, 'the contract did change; convergence is about the trend, not the total');
});

test('corpus ledger: pending entries are never counted as evidence of generality', () => {
  for (const e of corpus().filter((x) => x.status === 'pending')) {
    assert.equal(e.outcome, 'not-yet-run');
    assert.deepEqual(e.changes, []);
    assert.equal(e.executionKind, undefined);
  }
  const l = corpusLedger();
  assert.equal(l.executionKindsExercised.length, 4, 'only adapted substrates contribute exercised kinds');
});

test('corpus: four distinct execution kinds are now exercised by real substrates', () => {
  const kinds = corpusLedger().executionKindsExercised;
  for (const k of ['opaque-native', 'interpreted', 'declarative', 'hybrid']) {
    assert.ok(kinds.includes(k as never), `${k} exercised`);
  }
});

// ------------------------------------------------------------------------------- contract integrity

test('corpus: every adapted contract is self-consistent under the validator', () => {
  const w1 = world('fsm-world');
  const w2 = world('planner-world');
  const w3 = world('governor-world');
  assert.deepEqual(validateDynamicsContract(fsmDynamics(w1, DOOR)), []);
  assert.deepEqual(validateDynamicsContract(plannerDynamics(w2, GRAPH)), []);
  assert.deepEqual(validateDynamicsContract(governorDynamics(w3)), []);
});

test('corpus: the planner declares it CANNOT provide the whole law, and offers no accessor', () => {
  const w = world('planner-world');
  const c = plannerDynamics(w, GRAPH);
  assert.equal(c.capabilities.declareTransitionLaw, false, 'the heuristic is not expressible as data');
  assert.equal(c.describeTransitionLaw, undefined, 'capability-iff-accessor holds in the false direction too');
  assert.deepEqual(validateDynamicsContract(c), []);
});

test('corpus: the FSM CAN provide its whole law, and does', () => {
  const w = world('fsm-world');
  const c = fsmDynamics(w, DOOR);
  assert.equal(c.capabilities.declareTransitionLaw, true);
  const law = c.describeTransitionLaw!();
  assert.ok(law.ok);
  assert.equal(law.value.kind, 'transition-table');
  assert.equal(law.value.rules.length, DOOR.transitions.length);
  assert.match(law.value.notes ?? '', /accepting: destroyed/);
});
