/**
 * The published determinism envelope must not drift from the runtime's internal declaration.
 *
 * The same fact is now stated twice: once on the public handle (`field.guarantees`, which consumers
 * build replay and shared-state features on) and once in the world-substrate adapter's
 * `DynamicsContract`. Two statements of one fact diverge unless something checks them.
 *
 * This exists because an external integrator concluded the runtime was byte-identical across
 * environments and wrote that into their architecture — a reasonable inference, since the real answer
 * lived only in an unexported module. Publishing it fixed the availability problem; this fixes the
 * drift problem that publishing creates.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldEnvelope } from '../world/envelope.ts';
import { fieldRuntimeDynamics } from '../world/adapters/field-runtime.ts';
import type { World } from '../world/world.ts';
import { createField } from './field.ts';
import { DEFAULT_FIELD_CONSTRUCTION } from '../world/adapters/field-runtime.ts';
import { headlessHost } from './host-headless.ts';

function emptyWorld(): World {
  return { envelope: createWorldEnvelope('guarantees'), entities: [], relations: [], invariants: [], projections: [] };
}

test('published guarantees match the runtime contract declaration', () => {
  const host = headlessHost({ width: 400, height: 300 });
  const field = createField(undefined as never, { host, render: 'none', rng: DEFAULT_FIELD_CONSTRUCTION.makeRng(), now: DEFAULT_FIELD_CONSTRUCTION.makeNow() });
  const contract = fieldRuntimeDynamics(emptyWorld());

  const published = field.guarantees;
  const declared = contract.determinism;

  assert.equal(published.determinism, declared.classification,
    'classification drifted between the public handle and the contract');
  assert.deepEqual([...published.controlledInputs].sort(), [...declared.controlledInputs].sort(),
    'controlled inputs drifted');
  assert.deepEqual([...published.uncontrolledInputs].sort(), [...declared.uncontrolledInputs].sort(),
    'uncontrolled inputs drifted');

  field.destroy();
});

test('the envelope states the conditions rather than implying them', () => {
  const host = headlessHost({ width: 400, height: 300 });
  const field = createField(undefined as never, { host, render: 'none', rng: DEFAULT_FIELD_CONSTRUCTION.makeRng(), now: DEFAULT_FIELD_CONSTRUCTION.makeNow() });
  const g = field.guarantees;

  // The classification is only honest if the conditions are enumerated.
  assert.equal(g.determinism, 'conditionally-deterministic');
  assert.ok(g.requirements.length > 0, 'a conditional guarantee with no stated conditions is not a guarantee');
  assert.ok(g.uncontrolledInputs.length > 0, 'conditional means something is uncontrolled — say which');

  // Cross-plane agreement is a tolerance, not bit-equality. This is the specific claim an
  // integrator got wrong, so it is asserted rather than left to prose.
  assert.ok(g.crossPlaneTolerance > 0, 'cross-plane parity is toleranced, never byte-identical');
  assert.ok(g.crossPlaneTolerance < 1e-3, 'tolerance should be tight enough to be meaningful');

  field.destroy();
});

test('host geometry is declared uncontrolled — the trap that caused the misreading', () => {
  const host = headlessHost({ width: 400, height: 300 });
  const field = createField(undefined as never, { host, render: 'none', rng: DEFAULT_FIELD_CONSTRUCTION.makeRng(), now: DEFAULT_FIELD_CONSTRUCTION.makeNow() });
  assert.ok(field.guarantees.uncontrolledInputs.includes('host-geometry'),
    'viewport-dependent behaviour must be visible to anyone designing replay');
  field.destroy();
});
