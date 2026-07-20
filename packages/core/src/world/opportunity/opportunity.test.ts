/**
 * F1.6 — system-relative opportunity `Ω_sys` tests. Positive all-pass, the ten negative fixtures, and
 * the invariants: capability ≠ permission, authoritySource required, envelope retained, predicate-level
 * evidence always present, and NO empirical fields (belief/confidence/…).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldEnvelope } from '../envelope.ts';
import { evaluateOpportunity } from './opportunity.ts';
import type { OpportunityContext, AuthorityGrant, OperationDecl } from './opportunity.ts';

function baseContext(overrides: Partial<OpportunityContext> = {}): OpportunityContext {
  const operations: OperationDecl[] = [{ id: 'act', reversible: true, recoveryPaths: [] }];
  return {
    world: { envelope: createWorldEnvelope('opp-world'), operations },
    participant: 'editor',
    state: { enabled: ['act'], reachableOutcomes: ['act'] },
    projection: { id: 'desktop', exposed: ['act'], signaled: ['act'] },
    history: [],
    capabilities: ['act'],
    authority: [{ operation: 'act', scope: 's', authoritySource: 'role:x' }],
    ...overrides,
  };
}

function hasFailure(result: ReturnType<typeof evaluateOpportunity>, predicate: string, reason?: string): boolean {
  return result.failedPredicates.some((f) => f.predicate === predicate && (reason === undefined || f.reason === reason));
}

test('F1.6 positive: an all-pass operation is available with predicate-level evidence + retained envelope', () => {
  const r = evaluateOpportunity(baseContext(), 'act');
  assert.equal(r.available, true);
  assert.deepEqual(r.failedPredicates, []);
  assert.equal(r.evidence.envelope.worldInstance, 'opp-world'); // envelope retained
  assert.equal(r.evidence.predicates.length, 8); // predicate-level evidence, never a bare boolean
});

test('F1.6 no empirical constructs: the result exposes no belief/confidence/interpretation/etc.', () => {
  const r = evaluateOpportunity(baseContext(), 'act');
  const banned = ['belief', 'believed', 'perceived', 'interpretation', 'expectation', 'confidence', 'experience', 'strategy'];
  for (const key of Object.keys(r)) {
    assert.ok(!banned.includes(key), `Ω_sys must not expose empirical field "${key}"`);
  }
});

test('F1.6 negative: capable-but-not-permitted (no authority)', () => {
  const r = evaluateOpportunity(baseContext({ authority: [] }), 'act');
  assert.equal(r.capable, true);
  assert.equal(r.permitted, false);
  assert.ok(hasFailure(r, 'permitted', 'no-authority'));
});

test('F1.6 negative: permitted-but-not-capable', () => {
  const r = evaluateOpportunity(baseContext({ capabilities: [] }), 'act');
  assert.equal(r.permitted, true);
  assert.equal(r.capable, false);
  assert.ok(hasFailure(r, 'capable', 'not-capable'));
});

test('F1.6 negative: enabled-but-unreachable', () => {
  const r = evaluateOpportunity(baseContext({ state: { enabled: ['act'], reachableOutcomes: [] } }), 'act');
  assert.equal(r.enabled, true);
  assert.equal(r.reachable, false);
  assert.ok(hasFailure(r, 'reachable', 'unreachable'));
});

test('F1.6 negative: reachable-but-not-exposed', () => {
  const r = evaluateOpportunity(baseContext({ projection: { id: 'desktop', exposed: [], signaled: [] } }), 'act');
  assert.equal(r.reachable, true);
  assert.equal(r.exposed, false);
  assert.ok(hasFailure(r, 'exposed', 'not-exposed'));
});

test('F1.6 negative: exposed-but-not-signaled', () => {
  const r = evaluateOpportunity(baseContext({ projection: { id: 'desktop', exposed: ['act'], signaled: [] } }), 'act');
  assert.equal(r.exposed, true);
  assert.equal(r.signaled, false);
  assert.ok(hasFailure(r, 'signaled', 'not-signaled'));
});

test('F1.6 negative: irreversible with no recovery path', () => {
  const ops: OperationDecl[] = [{ id: 'act', reversible: false, recoveryPaths: [] }];
  const r = evaluateOpportunity(baseContext({ world: { envelope: createWorldEnvelope('opp-world'), operations: ops } }), 'act');
  assert.equal(r.reversible, false);
  assert.deepEqual(r.recoveryPaths, []);
  assert.ok(hasFailure(r, 'reversible-or-recoverable', 'irreversible-no-recovery'));
});

test('F1.6 negative: projection changes the result', () => {
  const exposedR = evaluateOpportunity(baseContext({ projection: { id: 'a', exposed: ['act'], signaled: ['act'] } }), 'act');
  const hiddenR = evaluateOpportunity(baseContext({ projection: { id: 'b', exposed: [], signaled: [] } }), 'act');
  assert.notEqual(exposedR.exposed, hiddenR.exposed);
  assert.notEqual(exposedR.available, hiddenR.available);
});

test('F1.6 negative: history changes the result (precondition depends on prior operations)', () => {
  const enabledFromHistory = (history: readonly string[]) => (history.includes('unlock') ? ['act'] : []);
  const withUnlock = baseContext({ history: ['unlock'], state: { enabled: enabledFromHistory(['unlock']), reachableOutcomes: ['act'] } });
  const without = baseContext({ history: [], state: { enabled: enabledFromHistory([]), reachableOutcomes: ['act'] } });
  assert.equal(evaluateOpportunity(withUnlock, 'act').enabled, true);
  assert.equal(evaluateOpportunity(without, 'act').enabled, false);
});

test('F1.6 negative: unknown authority source is not a valid permission', () => {
  const grant: AuthorityGrant = { operation: 'act', scope: 's', authoritySource: 'unknown' };
  const r = evaluateOpportunity(baseContext({ authority: [grant] }), 'act');
  assert.equal(r.permitted, false);
  assert.ok(hasFailure(r, 'permitted', 'unknown-authority-source'));
});

test('F1.6 negative: unsupported operation', () => {
  const r = evaluateOpportunity(baseContext(), 'nope');
  assert.equal(r.domainValid, false);
  assert.ok(hasFailure(r, 'domain-valid', 'unsupported-operation'));
});
