/**
 * F1.3 — DynamicsContract + world kernel tests.
 * (1) structural equivalence (CompiledPattern → World; evolution omitted); (2) the kernel executes the
 * OPAQUE field-runtime contract via initialize/advance/snapshot without field knowledge; (3) the same
 * kernel executes a NON-field contract identically; (4) the contract consistency validator rejects
 * contradictory declarations, and the field contract is self-consistent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CompiledPattern } from '../recipes/compile.ts';
import type { FieldRecipe } from '../recipes/schema.ts';
import { worldFromCompiledPattern, fieldRuntimeDynamics } from './adapters/field-runtime.ts';
import { hostWorld } from './kernel.ts';
import { validateDynamicsContract } from './dynamics.ts';
import type { DynamicsCapabilities, DynamicsContract, DynamicsEvidence } from './dynamics.ts';
import type { World } from './world.ts';
import { createWorldEnvelope } from './envelope.ts';

function fixture(): CompiledPattern {
  return {
    id: 'test-pattern',
    recipe: { id: 'test-pattern', expected: { particleCount: 0 } } as unknown as FieldRecipe,
    bodies: [
      { attributes: { 'data-body': 'attract', 'data-strength': '1', 'data-range': '200' }, tokens: ['attract'] },
      { attributes: { 'data-body': 'gravity', 'data-strength': '0.5' }, tokens: ['gravity'] },
    ],
    relationships: [{ from: 'body-0', to: 'body-1', type: 'binds', strength: 0.8 }],
    feedback: [{ metric: 'attention', var: '--field-attention' }],
    diagnostics: [],
    metrics: ['attention'],
    conditions: [],
    render: { underlay: 'dots', overlay: [], heatmap: false, unapplied: [] },
    reducedMotion: { reducedMotion: 'none', meaningWithoutMotion: '', staticOutputs: [] },
  };
}

const EMPTY_EVIDENCE: DynamicsEvidence = {
  declaredInputs: [],
  substrateResponses: [],
  checkedInvariants: [],
  executionTrace: [],
  unresolvedInterpretations: [],
};

test('F1.3 structural: CompiledPattern → World preserves identity/tokens/params/relations/invariants; omits evolution', () => {
  const { world, mapping } = worldFromCompiledPattern(fixture());
  assert.equal(world.entities.length, 2);
  assert.equal(world.entities[0]?.identity.id, 'body-0');
  assert.deepEqual([...world.entities[0]!.tokens], ['attract']);
  assert.equal(world.entities[0]?.params.strength, 1);
  assert.equal(world.relations[0]?.type, 'binds');
  assert.equal(world.invariants[0]?.kind, 'count');
  assert.ok(mapping.omitted.some((o) => o.includes('lawful evolution')));
});

test('F1.3 contract: kernel executes the OPAQUE field-runtime contract; opaque-native, no over-claimed capabilities', () => {
  const { world } = worldFromCompiledPattern(fixture());
  const dynamics = fieldRuntimeDynamics(world);
  // executionKind carries the opaqueness claim — there is no `declarative` boolean.
  assert.equal(dynamics.executionKind, 'opaque-native');
  assert.equal(dynamics.capabilities.snapshot, true);
  assert.equal(dynamics.capabilities.restore, false, 'lossy snapshot must not imply restore');
  assert.equal(dynamics.capabilities.replay, false, 'no replay merely because snapshot exists');
  assert.equal(dynamics.capabilities.declareTransitionLaw, false, 'opaque-native cannot declare a transition law');
  assert.equal(dynamics.determinism.classification, 'conditionally-deterministic');

  const host = hostWorld(world, dynamics);
  assert.ok(host.initialized);
  const adv = host.advance({ steps: 6 });
  assert.ok(adv.ok);
  assert.equal(adv.value.steps, 6);
  // evidence never asserts interpretation — it records it as unresolved
  assert.equal(adv.evidence.unresolvedInterpretations[0]?.status, 'unresolved');

  const read = host.readState();
  assert.ok(read.ok);
  assert.equal(read.value.reading.entities.length, 2);
  assert.equal(read.value.restorable, false);
  host.dispose();
});

test('F1.3 substrate-agnostic: the same kernel executes a NON-field contract identically', () => {
  const world: World = {
    envelope: createWorldEnvelope('counter-world'),
    entities: [],
    relations: [],
    invariants: [{ id: 'c', kind: 'count', spec: { metric: 'ticks', value: 3 } }],
    projections: [],
  };
  const counter: DynamicsContract<{ n: number }, { steps?: number }, { steps: number }> = {
    identity: { id: 'counter', version: '1' },
    executionKind: 'interpreted',
    capabilities: {
      initialize: true, advance: true, snapshot: true, restore: true,
      replay: true, inspectInternalState: true, declareTransitionLaw: true, deterministicReplay: true,
    },
    determinism: { classification: 'deterministic', controlledInputs: ['steps'], uncontrolledInputs: [], requirements: [] },
    initialize: () => ({ ok: true, value: { n: 0 }, evidence: EMPTY_EVIDENCE }),
    advance: (state, input) => {
      const steps = input.steps ?? 1;
      return { ok: true, value: { state: { n: state.n + steps }, output: { steps } }, evidence: EMPTY_EVIDENCE };
    },
    snapshot: (state) => ({
      ok: true,
      value: { reading: { envelope: world.envelope, step: state.n, entities: [], metrics: { ticks: state.n } }, restorable: true, payload: { n: state.n } },
      evidence: EMPTY_EVIDENCE,
    }),
    restore: (snap) => ({ ok: true, value: { n: (snap.payload as { n: number }).n }, evidence: EMPTY_EVIDENCE }),
    // G3.3: claiming declareTransitionLaw now REQUIRES being able to produce the law.
    describeTransitionLaw: () => ({
      ok: true,
      value: { kind: 'increment', rules: [{ kind: 'advance', delta: 'steps', defaultSteps: 1 }] },
      evidence: EMPTY_EVIDENCE,
    }),
  };
  assert.deepEqual(validateDynamicsContract(counter), [], 'the counter contract is self-consistent');
  const host = hostWorld(world, counter);
  const adv = host.advance({ steps: 3 });
  assert.ok(adv.ok);
  const read = host.readState();
  assert.ok(read.ok);
  assert.equal(read.value.reading.metrics.ticks, 3);
  assert.equal(host.checkInvariants(read.value.reading)[0]?.held, true);
});

test('F1.3 negative: the validator rejects contradictory declarations', () => {
  const caps: DynamicsCapabilities = {
    initialize: true, advance: true, snapshot: true, restore: false,
    replay: false, inspectInternalState: false, declareTransitionLaw: false, deterministicReplay: false,
  };
  const det = { classification: 'conditionally-deterministic' as const, controlledInputs: [], uncontrolledInputs: [], requirements: [] };

  assert.ok(validateDynamicsContract({ executionKind: 'interpreted', capabilities: { ...caps, replay: false, deterministicReplay: true }, determinism: det })
    .some((p) => p.rule.includes('deterministicReplay')));
  assert.ok(validateDynamicsContract({ executionKind: 'opaque-native', capabilities: { ...caps, declareTransitionLaw: true }, determinism: det })
    .some((p) => p.rule.includes('opaque')));
  assert.ok(validateDynamicsContract({ executionKind: 'interpreted', capabilities: caps, determinism: { classification: 'deterministic', controlledInputs: [], uncontrolledInputs: ['clock'], requirements: [] } })
    .some((p) => p.rule.includes('uncontrolled')));
  assert.ok(validateDynamicsContract({ executionKind: 'interpreted', capabilities: { ...caps, snapshot: false, restore: true }, determinism: det })
    .some((p) => p.rule.includes('restore')));

  // the field contract itself is self-consistent
  const { world } = worldFromCompiledPattern(fixture());
  assert.deepEqual(validateDynamicsContract(fieldRuntimeDynamics(world)), []);
});
