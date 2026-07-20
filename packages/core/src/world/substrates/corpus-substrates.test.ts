/**
 * Conformance-corpus substrates, tested on their OWN domain terms — no `DynamicsContract` involved.
 *
 * These run before any adapter exists (corpus protocol: substrate-first, adapt-second). If a later
 * adapter is awkward, these tests pin the substrate's real semantics so the awkwardness is recorded as
 * a finding rather than removed by quietly editing the substrate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fireFsm, initialFsmState, isAccepting, isFsmState, type FsmDefinition } from './fsm.ts';
import {
  expandPlanner,
  initialPlannerState,
  extractPlan,
  isTerminal,
  isPlannerState,
  type PlannerProblem,
} from './planner.ts';

// ------------------------------------------------------------------------------------------- FSM

const DOOR: FsmDefinition = {
  id: 'door',
  initial: 'closed',
  states: ['closed', 'open', 'locked', 'destroyed'],
  accepting: ['destroyed'],
  transitions: [
    { from: 'closed', on: 'open', to: 'open' },
    { from: 'open', on: 'close', to: 'closed' },
    { from: 'closed', on: 'lock', to: 'locked', guard: { key: 'hasKey', equals: true } },
    { from: 'locked', on: 'unlock', to: 'closed', guard: { key: 'hasKey', equals: true } },
    { from: 'open', on: 'smash', to: 'destroyed', assign: { intact: false } },
  ],
  context: { hasKey: false, intact: true },
};

test('corpus/fsm: transitions, guards, and unknown events are distinguished', () => {
  let s = initialFsmState(DOOR);
  assert.equal(s.current, 'closed');

  const opened = fireFsm(DOOR, s, 'open');
  assert.equal(opened.outcome, 'transitioned');
  assert.equal(opened.state.current, 'open');
  s = opened.state;

  // an event this machine knows, but not from here
  assert.equal(fireFsm(DOOR, s, 'lock').outcome, 'no-transition');
  // an event the machine has never heard of
  assert.equal(fireFsm(DOOR, s, 'teleport').outcome, 'unknown-event');

  // guard blocks without the key
  const closed = fireFsm(DOOR, s, 'close').state;
  assert.equal(fireFsm(DOOR, closed, 'lock').outcome, 'guard-blocked');
  const withKey = { ...closed, context: { ...closed.context, hasKey: true } };
  assert.equal(fireFsm(DOOR, withKey, 'lock').outcome, 'transitioned');
});

test('corpus/fsm: an accepting state is DONE, not merely idle', () => {
  let s = initialFsmState(DOOR);
  s = fireFsm(DOOR, s, 'open').state;
  const smashed = fireFsm(DOOR, s, 'smash');
  assert.equal(smashed.state.current, 'destroyed');
  assert.equal(smashed.state.context.intact, false, 'assign applied');
  assert.equal(isAccepting(DOOR, smashed.state), true);

  // every further event is `accepted` — distinct from `no-transition`, which would still respond later
  for (const ev of ['open', 'close', 'lock', 'teleport']) {
    const after = fireFsm(DOOR, smashed.state, ev);
    assert.equal(after.outcome, 'accepted', `${ev} after acceptance`);
    assert.deepEqual(after.state, smashed.state, 'a finished machine does not move');
  }
});

test('corpus/fsm: state guard and determinism', () => {
  assert.equal(isFsmState(initialFsmState(DOOR)), true);
  assert.equal(isFsmState({ current: 1 }), false);
  const a = fireFsm(DOOR, initialFsmState(DOOR), 'open');
  const b = fireFsm(DOOR, initialFsmState(DOOR), 'open');
  assert.deepEqual(a.state, b.state);
});

// --------------------------------------------------------------------------------------- planner

const GRAPH: PlannerProblem = {
  id: 'grid',
  nodes: [
    { id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 0 }, { id: 'c', x: 2, y: 0 },
    { id: 'd', x: 1, y: 1 }, { id: 'z', x: 3, y: 0 },
  ],
  edges: [
    { from: 'a', to: 'b', cost: 1 },
    { from: 'a', to: 'd', cost: 4 },
    { from: 'b', to: 'c', cost: 1 },
    { from: 'd', to: 'z', cost: 1 },
    { from: 'c', to: 'z', cost: 1 },
  ],
  start: 'a',
  goal: 'z',
  heuristic: { kind: 'euclidean' },
};

function runToCompletion(problem: PlannerProblem, cap = 100) {
  let state = initialPlannerState(problem);
  let steps = 0;
  while (!isTerminal(state.status) && steps < cap) {
    state = expandPlanner(problem, state).state;
    steps++;
  }
  return { state, steps };
}

test('corpus/planner: finds the cheapest path and terminates', () => {
  const { state } = runToCompletion(GRAPH);
  assert.equal(state.status, 'goal-reached');
  assert.deepEqual(extractPlan(GRAPH, state), ['a', 'b', 'c', 'z'], 'cost 3 beats a→d→z at cost 5');
});

test('corpus/planner: an unreachable goal exhausts rather than looping', () => {
  const island: PlannerProblem = { ...GRAPH, edges: [{ from: 'a', to: 'b', cost: 1 }], goal: 'z' };
  const { state, steps } = runToCompletion(island);
  assert.equal(state.status, 'exhausted');
  assert.equal(extractPlan(island, state), undefined, 'no plan exists');
  assert.ok(steps < 100, 'terminated on its own');
});

test('corpus/planner: expanding a FINISHED search is neither progress nor an error', () => {
  const { state } = runToCompletion(GRAPH);
  const again = expandPlanner(GRAPH, state);
  assert.equal(again.status, 'goal-reached');
  assert.equal(again.expanded, undefined, 'nothing was expanded');
  assert.deepEqual(again.state, state, 'state is unchanged');
  assert.equal(again.state.expansions, state.expansions, 'the step counter does not advance');
});

test('corpus/planner: exact determinism — identical runs, tie-broken by node id', () => {
  const a = runToCompletion(GRAPH);
  const b = runToCompletion(GRAPH);
  assert.deepEqual(a.state, b.state);
  assert.equal(a.steps, b.steps);
  // ties break by name, not insertion order
  const flat: PlannerProblem = { ...GRAPH, heuristic: { kind: 'zero' } };
  assert.deepEqual(runToCompletion(flat).state.explored, runToCompletion(flat).state.explored);
});

test('corpus/planner: heuristic kinds differ in what they can be written down as', () => {
  // table and zero are data; euclidean is computed from coordinates
  const table = runToCompletion({ ...GRAPH, heuristic: { kind: 'table', values: { a: 3, b: 2, c: 1, d: 1, z: 0 } } });
  assert.equal(table.state.status, 'goal-reached');
  const zero = runToCompletion({ ...GRAPH, heuristic: { kind: 'zero' } });
  assert.equal(zero.state.status, 'goal-reached');
  // all three find the same optimal plan; they differ only in how much they explore
  for (const r of [table, zero]) assert.deepEqual(extractPlan(GRAPH, r.state), ['a', 'b', 'c', 'z']);
  assert.equal(isPlannerState(zero.state), true);
});
