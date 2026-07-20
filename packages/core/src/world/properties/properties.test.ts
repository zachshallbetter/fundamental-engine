/**
 * F2 foundation — property classification fixtures, including the five required negative cases.
 *
 * Each negative fixture pins a specific way a validator could talk itself into a conclusion it has not
 * earned: settling an empirical claim from a unit test, generalizing one run into a model check,
 * demanding empirical evidence for a decidable claim, reaching past a projection into hidden state, or
 * discharging a claim with evidence the surface withholds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldEnvelope } from '../envelope.ts';
import { project, type ProjectionDefinition, type ProjectionSource } from '../projection/projection.ts';
import type { WorldStateSnapshot } from '../world.ts';
import {
  evaluateProperty,
  evaluateProjectionProperty,
  validatePropertyDeclaration,
  requiresParticipantInference,
  authorityFor,
  type PropertyDeclaration,
} from './properties.ts';

const PROV = { declaredBy: 'F2-foundation', declaredIn: 'properties.test.ts' };
const ENVELOPE = createWorldEnvelope('properties-world');

function decl(over: Partial<PropertyDeclaration> = {}): PropertyDeclaration {
  return {
    id: 'p', statement: 'entity count is 3', propertyClass: 'mechanically-decidable',
    requiredEvidence: ['declaration'], provenance: PROV, ...over,
  };
}

// ---------------------------------------------------------------- class → authority → reachable status

test('F2.F each class carries a distinct evaluation authority', () => {
  assert.equal(authorityFor('mechanically-decidable'), 'runtime');
  assert.equal(authorityFor('model-checkable'), 'model-checker');
  assert.equal(authorityFor('empirically-testable'), 'external-empirical');
});

test('F2.F a result always reports class, authority, required evidence, status, reason and provenance', () => {
  const r = evaluateProperty({ declaration: decl(), offered: [{ kind: 'declaration', id: 'd1' }], mechanicalVerdict: true });
  assert.equal(r.propertyClass, 'mechanically-decidable');
  assert.equal(r.evaluationAuthority, 'runtime');
  assert.deepEqual(r.requiredEvidence, ['declaration']);
  assert.equal(r.status, 'satisfied');
  assert.ok(r.reason.length > 0);
  assert.deepEqual(r.provenance, PROV);
});

test('F2.F a mechanically-decidable property can be violated, and says why', () => {
  const r = evaluateProperty({ declaration: decl(), offered: [{ kind: 'declaration', id: 'd1' }], mechanicalVerdict: false });
  assert.equal(r.status, 'violated');
  assert.match(r.reason, /refuted/);
});

test('F2.F absent a verdict, a decidable property is unresolved — not satisfied by default', () => {
  const r = evaluateProperty({ declaration: decl(), offered: [] });
  assert.equal(r.status, 'unresolved');
});

// ------------------------------------------------------------------------- negative fixture 1

test('F2.N1 an empirical claim cannot be marked satisfied by a deterministic unit test alone', () => {
  const empirical = decl({
    id: 'e1',
    statement: 'participants understand the publish control',
    propertyClass: 'empirically-testable',
    requiredEvidence: ['external-empirical-study'],
  });
  // offer the strongest INTERNAL evidence available — an exhaustive exploration and a passing run
  const r = evaluateProperty({
    declaration: empirical,
    offered: [
      { kind: 'observed-execution', id: 'unit-test-1' },
      { kind: 'exhaustive-exploration', id: 'full-space', coverage: '100%' },
    ],
    mechanicalVerdict: true, // even an explicit true verdict must not be honoured
  });
  assert.notEqual(r.status, 'satisfied', 'an empirical claim must NEVER be satisfied internally');
  assert.equal(r.status, 'insufficient-evidence');
  assert.equal(r.evaluationAuthority, 'external-empirical');
  assert.match(r.reason, /cannot be settled from runtime state/);
});

test('F2.N1b with a real study, the runtime defers by reference — it still does not conclude', () => {
  const empirical = decl({
    id: 'e2', statement: 'participants notice the moderation banner',
    propertyClass: 'empirically-testable', requiredEvidence: ['external-empirical-study'],
  });
  const r = evaluateProperty({
    declaration: empirical,
    offered: [{ kind: 'external-empirical-study', id: 'study-2026-03', detail: 'n=120' }],
  });
  assert.equal(r.status, 'unresolved', 'deferral is not a verdict');
  assert.equal(r.externalReference, 'study-2026-03');
  assert.match(r.reason, /external empirical authority/);
});

test('F2.N1c a belief-laden claim cannot be classed mechanical or model-checkable', () => {
  for (const term of ['believe', 'perceive', 'expect', 'usability', 'trust']) {
    assert.equal(requiresParticipantInference(`the user will ${term} the result`), true, term);
  }
  const misclassified = decl({ id: 'm1', statement: 'users trust the risk score', propertyClass: 'mechanically-decidable' });
  assert.ok(validatePropertyDeclaration(misclassified).some((p) => p.rule === 'participant-inference⇒empirical'));
  const r = evaluateProperty({ declaration: misclassified, offered: [], mechanicalVerdict: true });
  assert.equal(r.status, 'not-applicable', 'a misclassified claim is refused, not evaluated');
});

// ------------------------------------------------------------------------- negative fixture 2

test('F2.N2 a model-checkable claim cannot be reduced to one observed execution', () => {
  const mc = decl({
    id: 'mc1', statement: 'no reachable state has a negative tier',
    propertyClass: 'model-checkable', requiredEvidence: ['bounded-model-check'],
  });
  const one = evaluateProperty({
    declaration: mc,
    offered: [{ kind: 'observed-execution', id: 'run-1' }],
    mechanicalVerdict: true,
  });
  assert.notEqual(one.status, 'satisfied');
  assert.equal(one.status, 'insufficient-evidence');
  assert.match(one.reason, /cannot generalize/);

  // many runs are still not a model check
  const many = evaluateProperty({
    declaration: mc,
    offered: Array.from({ length: 500 }, (_, i) => ({ kind: 'observed-execution' as const, id: `run-${i}` })),
  });
  assert.equal(many.status, 'insufficient-evidence', '500 runs is still sampling, not checking');

  // a bounded check holds only within its bound
  const bounded = evaluateProperty({
    declaration: mc,
    offered: [{ kind: 'bounded-model-check', id: 'bmc', coverage: 'depth ≤ 12' }],
  });
  assert.equal(bounded.status, 'unresolved');
  assert.match(bounded.reason, /unresolved beyond it/);

  // only exhaustive exploration earns `satisfied`
  const exhaustive = evaluateProperty({
    declaration: mc,
    offered: [{ kind: 'exhaustive-exploration', id: 'full', coverage: 'all 4 tiers × 3 rules' }],
  });
  assert.equal(exhaustive.status, 'satisfied');
});

test('F2.N2b a model-checkable declaration requiring only observed executions is refused', () => {
  const bad = decl({ id: 'mc2', statement: 'always terminates', propertyClass: 'model-checkable', requiredEvidence: ['observed-execution'] });
  assert.ok(validatePropertyDeclaration(bad).some((p) => p.rule === 'model-check∦single-execution'));
});

// ------------------------------------------------------------------------- negative fixture 3

test('F2.N3 a mechanically-decidable claim does not require empirical evidence', () => {
  const mech = decl({ id: 'd1', statement: 'the world declares exactly 4 operations', requiredEvidence: ['declaration'] });
  assert.deepEqual(validatePropertyDeclaration(mech), [], 'a purely mechanical claim is a valid declaration');
  // it resolves with NO empirical evidence offered at all
  const r = evaluateProperty({ declaration: mech, offered: [{ kind: 'declaration', id: 'world-decl' }], mechanicalVerdict: true });
  assert.equal(r.status, 'satisfied');
  assert.equal(r.usedEvidence.every((e) => e.kind !== 'external-empirical-study'), true);
  // and demanding empirical evidence for it is a declaration error
  const overreach = decl({ id: 'd2', requiredEvidence: ['declaration', 'external-empirical-study'] });
  assert.ok(validatePropertyDeclaration(overreach).some((p) => p.rule === 'mechanical∦empirical-evidence'));
});

// --------------------------------------------------------- projection-relative fixtures 4 & 5

const SNAPSHOT: WorldStateSnapshot = {
  envelope: ENVELOPE, step: 1, entities: [],
  metrics: { drafts: 3, internalRiskScore: 91 },
};

const SOURCE: ProjectionSource = {
  envelope: ENVELOPE,
  operations: [{ id: 'publish', reversible: false, recoveryPaths: [] }],
  snapshot: SNAPSHOT,
  capabilities: ['publish'],
  authority: [{ operation: 'publish', scope: 'editor', authoritySource: 'policy' }],
  evidenceIds: ['ev-open', 'ev-secret'],
};

function surfaceFor(over: Partial<ProjectionDefinition> = {}) {
  const definition: ProjectionDefinition = {
    identity: { id: 'editor', version: '1' },
    sourceEnvelope: ENVELOPE,
    scope: { consumer: 'editor', kind: 'participant' },
    observation: { observable: ['drafts'], hidden: ['internalRiskScore'] },
    operations: { exposed: ['publish'], hidden: [], signaled: [] },
    evidence: { accessible: ['ev-open'], withheld: ['ev-secret'] },
    authority: { presented: ['publish'] },
    invariants: [],
    provenance: [],
    ...over,
  };
  return project(definition, SOURCE).surface;
}

test('F2.N4 projection-relative properties are evaluated against the surface, not hidden world state', () => {
  const surface = surfaceFor();
  // this claim is FALSE in the world (91 > 50) — but the surface cannot see it, so it must not be decided
  const hiddenClaim = decl({
    id: 'risk', statement: 'internalRiskScore <= 50',
    reads: ['internalRiskScore'], requiredEvidence: ['projection-surface'],
  });
  const r = evaluateProjectionProperty(hiddenClaim, surface, () => true);
  assert.equal(r.status, 'unresolved');
  assert.match(r.reason, /does not expose/);
  assert.notEqual(r.status, 'violated', 'the validator must not reach into hidden state to refute either');

  // a claim reading only surfaced state IS decidable
  const visible = decl({ id: 'drafts', statement: 'drafts <= 10', reads: ['drafts'], requiredEvidence: ['projection-surface'] });
  const ok = evaluateProjectionProperty(visible, surface, (o) => (o.drafts ?? 0) <= 10);
  assert.equal(ok.status, 'satisfied');
});

test('F2.N5 inaccessible evidence cannot satisfy a projection-relative claim', () => {
  const surface = surfaceFor();
  const needsSecret = decl({
    id: 'audit', statement: 'drafts <= 10',
    reads: ['drafts'], requiresEvidenceIds: ['ev-secret'], requiredEvidence: ['projection-surface'],
  });
  const r = evaluateProjectionProperty(needsSecret, surface, () => true);
  assert.equal(r.status, 'insufficient-evidence', 'withheld evidence cannot discharge the claim');
  assert.match(r.reason, /not accessible on this surface/);

  // the SAME claim resolves on a surface that grants access — the difference is the projection, not the world
  const open = surfaceFor({ identity: { id: 'compliance', version: '1' }, evidence: { accessible: ['ev-open', 'ev-secret'], withheld: [] } });
  const r2 = evaluateProjectionProperty(needsSecret, open, (o) => (o.drafts ?? 0) <= 10);
  assert.equal(r2.status, 'satisfied');
});

test('F2.F an empirical claim stays empirical even when made projection-relative', () => {
  const surface = surfaceFor();
  const e = decl({
    id: 'perceived', statement: 'the editor understands the draft count',
    propertyClass: 'empirically-testable', requiredEvidence: ['external-empirical-study'],
    reads: ['drafts'],
  });
  const r = evaluateProjectionProperty(e, surface, () => true);
  assert.notEqual(r.status, 'satisfied', 'surfacing the state does not make the belief claim decidable');
  assert.equal(r.status, 'insufficient-evidence');
});
