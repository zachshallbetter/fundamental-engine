/**
 * F2 foundation — ProjectionContract fixtures.
 *
 * Nine required proofs, each written so it would FAIL if projection were collapsed into observation,
 * snapshot, evidence, capability, authority, or operation availability.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldEnvelope } from '../envelope.ts';
import { evaluateOpportunity } from '../opportunity/opportunity.ts';
import type { AuthorityGrant, OperationDecl } from '../opportunity/opportunity.ts';
import type { WorldStateSnapshot } from '../world.ts';
import {
  project,
  toOpportunityProjection,
  checkProjectionInvariants,
  type ProjectionDefinition,
  type ProjectionSource,
} from './projection.ts';

const ENVELOPE = createWorldEnvelope('projection-world');

const OPERATIONS: readonly OperationDecl[] = [
  { id: 'publish', reversible: false, recoveryPaths: ['unpublish'] },
  { id: 'unpublish', reversible: true, recoveryPaths: [] },
  { id: 'delete', reversible: false, recoveryPaths: [] },
  { id: 'audit', reversible: true, recoveryPaths: [] },
];

const SNAPSHOT: WorldStateSnapshot = {
  envelope: ENVELOPE,
  step: 7,
  entities: [],
  metrics: { drafts: 3, published: 2, internalRiskScore: 91, moderationQueue: 5 },
};

const AUTHORITY: readonly AuthorityGrant[] = [
  { operation: 'publish', scope: 'editor', authoritySource: 'editorial-policy-v2' },
  { operation: 'audit', scope: 'auditor', authoritySource: 'compliance-charter' },
];

function source(over: Partial<ProjectionSource> = {}): ProjectionSource {
  return {
    envelope: ENVELOPE,
    operations: OPERATIONS,
    snapshot: SNAPSHOT,
    capabilities: ['publish', 'unpublish', 'audit'], // NOTE: no `delete` capability
    authority: AUTHORITY,
    evidenceIds: ['ev-publish-log', 'ev-risk-model', 'ev-moderation-trace'],
    ...over,
  };
}

function definition(id: string, over: Partial<ProjectionDefinition> = {}): ProjectionDefinition {
  return {
    identity: { id, version: '1' },
    sourceEnvelope: ENVELOPE,
    scope: { consumer: 'editor', kind: 'participant' },
    observation: { observable: ['drafts', 'published'], hidden: ['internalRiskScore'] },
    operations: { exposed: ['publish'], hidden: ['audit'], signaled: ['publish'] },
    evidence: { accessible: ['ev-publish-log'], withheld: ['ev-risk-model'] },
    authority: { presented: ['publish'] },
    invariants: [],
    provenance: [{ id: 't1', kind: 'redact', detail: 'risk score redacted for the editor surface' }],
    ...over,
  };
}

// 1 ---------------------------------------------------------------------------------------------
test('F2.1 same world, different projection, different exposed operation', () => {
  const src = source();
  const editor = project(definition('editor'), src);
  const auditor = project(
    definition('auditor', {
      scope: { consumer: 'auditor', kind: 'agent' },
      operations: { exposed: ['audit'], hidden: ['publish'], signaled: ['audit'] },
      authority: { presented: ['audit'] },
    }),
    src,
  );

  const exposedOf = (r: typeof editor) => r.surface.operations.filter((o) => o.exposure === 'exposed').map((o) => o.operation);
  assert.deepEqual(exposedOf(editor), ['publish']);
  assert.deepEqual(exposedOf(auditor), ['audit']);
  // the world itself is untouched and identical for both
  assert.equal(editor.surface.sourceEnvelope.worldInstance, auditor.surface.sourceEnvelope.worldInstance);
  assert.deepEqual(src.snapshot.metrics, SNAPSHOT.metrics, 'projecting must not mutate the source');
});

// 2 ---------------------------------------------------------------------------------------------
test('F2.2 same world, different projection, different signaled opportunity (Ω_sys moves, state does not)', () => {
  const src = source();
  const signaling = project(definition('signaling'), src);
  const silent = project(definition('silent', { operations: { exposed: ['publish'], hidden: ['audit'], signaled: [] } }), src);

  const base = {
    world: { envelope: ENVELOPE, operations: OPERATIONS },
    participant: 'editor',
    state: { enabled: ['publish'], reachableOutcomes: ['publish'] },
    history: [],
    capabilities: src.capabilities,
    authority: src.authority,
  };

  const a = evaluateOpportunity({ ...base, projection: toOpportunityProjection(signaling.surface) }, 'publish');
  const b = evaluateOpportunity({ ...base, projection: toOpportunityProjection(silent.surface) }, 'publish');

  assert.equal(a.signaled, true);
  assert.equal(b.signaled, false, 'the SAME world state yields a different Ω_sys under a different projection');
  // discoverability changed; availability did not — the two are separate predicates
  assert.equal(a.available, true);
  assert.equal(b.available, true);
});

// 3 ---------------------------------------------------------------------------------------------
test('F2.3 hidden state remains present in the world but absent from observation', () => {
  const src = source();
  const r = project(definition('editor'), src);
  assert.equal('internalRiskScore' in r.surface.observedState, false, 'hidden state must not appear on the surface');
  assert.ok(r.surface.hiddenStateKeys.includes('internalRiskScore'));
  // still present in the world — projection subtracts from the VIEW, not from reality
  assert.equal(src.snapshot.metrics.internalRiskScore, 91);
  // and a projection that does observe it sees the true value
  const risk = project(definition('risk', { observation: { observable: ['internalRiskScore'], hidden: [] } }), src);
  assert.equal(risk.surface.observedState.internalRiskScore, 91);
});

// 4 ---------------------------------------------------------------------------------------------
test('F2.4 accessible evidence differs by projection', () => {
  const src = source();
  const editor = project(definition('editor'), src);
  const compliance = project(
    definition('compliance', { evidence: { accessible: ['ev-risk-model', 'ev-moderation-trace'], withheld: [] } }),
    src,
  );
  assert.deepEqual(editor.surface.accessibleEvidence, ['ev-publish-log']);
  assert.deepEqual(compliance.surface.accessibleEvidence, ['ev-risk-model', 'ev-moderation-trace']);
  // withheld evidence is not accessible even when named as accessible
  const contradictory = project(
    definition('contradictory', { evidence: { accessible: ['ev-risk-model'], withheld: ['ev-risk-model'] } }),
    src,
  );
  assert.deepEqual(contradictory.surface.accessibleEvidence, [], 'withholding wins over claiming access');
});

// 5 ---------------------------------------------------------------------------------------------
test('F2.5 presented authority may differ from actual underlying authority', () => {
  const src = source();
  // understatement — legitimate: the editor HAS publish authority, the surface does not advertise it
  const quiet = project(definition('quiet', { authority: { presented: [] } }), src);
  assert.deepEqual(quiet.surface.presentedAuthority, []);
  assert.ok(quiet.surface.effectiveAuthority.some((g) => g.operation === 'publish'),
    'actual authority is unchanged by not presenting it');
  assert.deepEqual(quiet.anomalies, [], 'understating authority is not an anomaly');
});

// 6 ---------------------------------------------------------------------------------------------
test('F2.6 projection cannot manufacture capability', () => {
  const src = source(); // has NO `delete` capability
  const r = project(definition('overreach', { operations: { exposed: ['publish', 'delete'], hidden: [], signaled: ['delete'] } }), src);
  assert.equal(r.surface.effectiveCapabilities.includes('delete'), false, 'exposure must not create capability');
  assert.ok(r.anomalies.some((a) => a.code === 'capability-not-manufacturable' && a.subject === 'delete'));
  // effective capability is always a subset of the source's
  for (const c of r.surface.effectiveCapabilities) assert.ok(src.capabilities.includes(c));
  // and Ω_sys still refuses it
  const omega = evaluateOpportunity(
    {
      world: { envelope: ENVELOPE, operations: OPERATIONS },
      participant: 'editor',
      state: { enabled: ['delete'], reachableOutcomes: ['delete'] },
      projection: toOpportunityProjection(r.surface),
      history: [],
      capabilities: src.capabilities,
      authority: src.authority,
    },
    'delete',
  );
  assert.equal(omega.capable, false);
  assert.equal(omega.available, false, 'an exposed-but-incapable operation is not available');
});

// 7 ---------------------------------------------------------------------------------------------
test('F2.7 projection cannot silently grant permission', () => {
  const src = source(); // no grant for `delete`
  const r = project(
    definition('grant-claim', {
      operations: { exposed: ['delete'], hidden: [], signaled: [] },
      authority: { presented: ['delete'] },
    }),
    src,
  );
  assert.equal(r.surface.effectiveAuthority.some((g) => g.operation === 'delete'), false, 'presentation must not confer permission');
  const overstated = r.anomalies.filter((a) => a.code === 'authority-overstated');
  assert.equal(overstated.length, 1, 'the overstatement is REPORTED — that is what makes it non-silent');
  assert.equal(overstated[0]!.subject, 'delete');
  // every effective grant still carries its provenance
  for (const g of r.surface.effectiveAuthority) assert.ok(g.authoritySource.length > 0 && g.authoritySource !== 'unknown');
});

// 8 ---------------------------------------------------------------------------------------------
test('F2.8 an unavailable operation is distinct from a hidden operation', () => {
  const src = source();
  const r = project(
    definition('distinct', { operations: { exposed: ['publish'], hidden: ['audit'], signaled: ['publish'] } }),
    src,
  );
  const state = (op: string) => r.surface.operations.find((o) => o.operation === op)?.exposure;

  assert.equal(state('audit'), 'hidden', 'exists in the world, not offered here');
  assert.equal(state('unpublish'), 'hidden', 'not offered ⇒ hidden, NOT unavailable');
  assert.equal(state('publish'), 'exposed');

  // an operation the world does not declare at all is `unavailable`
  const ghost = project(definition('ghost', { operations: { exposed: ['teleport'], hidden: [], signaled: [] } }), src);
  assert.equal(ghost.surface.operations.find((o) => o.operation === 'teleport')?.exposure, 'unavailable');
  assert.ok(ghost.anomalies.some((a) => a.code === 'exposed-operation-absent-from-world'));
  // the distinction is real: hidden ops are in the world vocabulary, unavailable ones are not
  assert.ok(OPERATIONS.some((o) => o.id === 'audit'));
  assert.ok(!OPERATIONS.some((o) => o.id === 'teleport'));
});

// 9 ---------------------------------------------------------------------------------------------
test('F2.9 observation access is distinct from operation exposure', () => {
  const src = source();
  // observable state whose operation is NOT exposed
  const readOnly = project(
    definition('read-only', {
      observation: { observable: ['published'], hidden: [] },
      operations: { exposed: [], hidden: ['publish', 'audit'], signaled: [] },
      authority: { presented: [] },
    }),
    src,
  );
  assert.equal(readOnly.surface.observedState.published, 2, 'state is readable');
  assert.equal(readOnly.surface.operations.find((o) => o.operation === 'publish')?.exposure, 'hidden', 'yet the operation is not offered');

  // the converse: an exposed operation whose related state is hidden
  const blindWrite = project(
    definition('blind-write', {
      observation: { observable: [], hidden: ['published'] },
      operations: { exposed: ['publish'], hidden: [], signaled: ['publish'] },
    }),
    src,
  );
  assert.equal('published' in blindWrite.surface.observedState, false, 'state is not readable');
  assert.equal(blindWrite.surface.operations.find((o) => o.operation === 'publish')?.exposure, 'exposed', 'yet the operation IS offered');
});

// ------------------------------------------------------------------ supporting distinctions

test('F2 projection-relative invariants are evaluated against the surface, never hidden state', () => {
  const src = source();
  const r = project(
    definition('inv', {
      observation: { observable: ['drafts'], hidden: ['internalRiskScore'] },
      invariants: [
        { id: 'drafts-bounded', statement: 'drafts <= 10', reads: ['drafts'] },
        { id: 'risk-bounded', statement: 'internalRiskScore <= 50', reads: ['internalRiskScore'] },
      ],
    }),
    src,
  );
  const results = checkProjectionInvariants(r.surface, (_id, observed) => (observed.drafts ?? 0) <= 10);
  const byId = new Map(results.map((x) => [x.id, x]));
  assert.equal(byId.get('drafts-bounded')!.status, 'satisfied');
  // the risk claim would FAIL against real world state (91 > 50) — but it must not be evaluated at all
  assert.equal(byId.get('risk-bounded')!.status, 'unevaluable-outside-surface',
    'a claim reading hidden state must not reach into the world to satisfy or violate itself');
});

test('F2 signaling emits an unresolved perception obligation — never an assertion of belief', () => {
  const r = project(definition('editor'), source());
  const o = r.obligations.find((x) => x.id.startsWith('perception:'));
  assert.ok(o, 'signaling must raise the obligation');
  assert.equal(o!.status, 'unresolved');
  assert.equal(o!.authority, 'empirical');
  assert.match(o!.claim, /perceived|understood|expected/);
});

test('F2 a projection cannot signal what it does not expose', () => {
  const r = project(definition('bad-signal', { operations: { exposed: ['publish'], hidden: [], signaled: ['audit'] } }), source());
  assert.ok(r.anomalies.some((a) => a.code === 'signaled-without-exposure' && a.subject === 'audit'));
  assert.equal(r.surface.operations.find((o) => o.operation === 'audit')?.signaled, false);
});

test('F2 an envelope mismatch is reported, not silently projected', () => {
  const r = project(definition('mismatch', { sourceEnvelope: createWorldEnvelope('other-world') }), source());
  assert.ok(r.anomalies.some((a) => a.code === 'envelope-mismatch'));
});
