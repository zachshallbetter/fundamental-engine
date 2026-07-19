/**
 * F1.1c — world kernel + FieldRuntime adapter tests.
 * Verifies: (1) structural equivalence — a CompiledPattern maps to a generic World faithfully, with
 * lawful evolution explicitly OMITTED; (2) the kernel executes an OPAQUE field-runtime DynamicsContract
 * without field knowledge; (3) the same kernel executes a NON-field contract identically (substrate-
 * agnostic). Evolution is never claimed declarative for the field substrate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CompiledPattern } from '../recipes/compile.ts';
import type { FieldRecipe } from '../recipes/schema.ts';
import { worldFromCompiledPattern, fieldRuntimeDynamics } from './adapters/field-runtime.ts';
import { hostWorld } from './kernel.ts';
import type { DynamicsContract } from './dynamics.ts';
import type { World, WorldStateSnapshot } from './world.ts';
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

test('F1.1c structural: CompiledPattern → World preserves identity/tokens/params/relations/invariants; omits evolution', () => {
  const { world, mapping } = worldFromCompiledPattern(fixture());
  assert.equal(world.entities.length, 2);
  assert.equal(world.entities[0]?.identity.id, 'body-0');
  assert.deepEqual([...world.entities[0]!.tokens], ['attract']);
  assert.equal(world.entities[0]?.params.strength, 1);
  assert.equal(world.entities[0]?.params.range, 200);
  assert.equal(world.relations.length, 1);
  assert.equal(world.relations[0]?.type, 'binds');
  assert.equal(world.invariants.length, 1);
  assert.equal(world.invariants[0]?.kind, 'count');
  // the finding, made explicit: lawful evolution is OMITTED, not hidden in adapter state.
  assert.ok(mapping.omitted.some((o) => o.includes('lawful evolution')), 'evolution must be declared omitted');
});

test('F1.1c contract: the kernel executes an OPAQUE field-runtime DynamicsContract without field knowledge', () => {
  const { world } = worldFromCompiledPattern(fixture());
  const dynamics = fieldRuntimeDynamics(world);
  assert.equal(dynamics.declarative, false, 'the field substrate must be labeled opaque, never declarative');
  assert.ok(dynamics.substrate.startsWith('field-runtime@'), 'substrate is identified, not understood');
  const host = hostWorld(world, dynamics);
  host.advance(6);
  const state = host.state();
  assert.equal(state.step, 6);
  assert.equal(state.entities.length, 2, 'both entities present in the opaque substrate snapshot');
  assert.equal(typeof state.metrics.bodies, 'number');
  host.dispose();
});

test('F1.1c substrate-agnostic: the same kernel executes a NON-field DynamicsContract identically', () => {
  let ticks = 0;
  const world: World = {
    envelope: createWorldEnvelope('counter-world'),
    entities: [],
    relations: [],
    invariants: [{ id: 'c', kind: 'count', spec: { metric: 'ticks', value: 3 } }],
    projections: [],
  };
  const counter: DynamicsContract = {
    id: 'counter',
    substrate: 'in-memory-counter@1',
    declarative: true,
    step(input) {
      ticks += input?.steps ?? 1;
    },
    snapshot(): WorldStateSnapshot {
      return { envelope: world.envelope, step: ticks, entities: [], metrics: { ticks } };
    },
  };
  const host = hostWorld(world, counter);
  host.advance(3);
  assert.equal(host.state().metrics.ticks, 3);
  const results = host.checkInvariants();
  assert.equal(results[0]?.held, true, 'the kernel checks invariants generically over ANY substrate snapshot');
});
