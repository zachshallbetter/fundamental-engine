/**
 * F1.0 — World version envelope tests (PLAN F1.0 acceptance).
 * Verifies: every world carries the eight-field envelope; an incompatible load FAILS EXPLICITLY,
 * naming the field; there is no silent migration.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorldEnvelope,
  envelopeMismatches,
  isCompatibleEnvelope,
  assertCompatibleEnvelope,
  IncompatibleWorldVersion,
  WORLD_ENVELOPE_IDENTITY_FIELDS,
} from './envelope.ts';
import { FIELD_VERSION } from '../version.ts';

test('F1.0 envelope: stamps eight fields with defaults', () => {
  const e = createWorldEnvelope('w-1');
  assert.equal(e.worldInstance, 'w-1');
  assert.equal(e.implementation, `js@${FIELD_VERSION}`);
  assert.deepEqual(e.migrationChain, []);
  for (const f of WORLD_ENVELOPE_IDENTITY_FIELDS) {
    assert.equal(typeof e[f], 'string', `${f} should be a string identity`);
  }
});

test('F1.0 envelope: identical envelopes are compatible', () => {
  const a = createWorldEnvelope('w-1');
  const b = createWorldEnvelope('w-1');
  assert.equal(isCompatibleEnvelope(a, b), true);
  assert.deepEqual(envelopeMismatches(a, b), []);
  assert.doesNotThrow(() => assertCompatibleEnvelope(a, b));
});

test('F1.0 envelope: a differing identity field fails explicitly, naming the field (no silent migrate)', () => {
  const current = createWorldEnvelope('w-1');
  const loaded = createWorldEnvelope('w-1', { kernelSemantics: '0.2.0' });
  assert.equal(isCompatibleEnvelope(loaded, current), false);
  assert.throws(
    () => assertCompatibleEnvelope(loaded, current),
    (err: unknown) => {
      assert.ok(err instanceof IncompatibleWorldVersion);
      assert.equal(err.mismatches[0]?.field, 'kernelSemantics');
      assert.equal(err.mismatches[0]?.expected, '0.1.0');
      assert.equal(err.mismatches[0]?.actual, '0.2.0');
      return true;
    },
  );
});

test('F1.0 envelope: migrationChain difference is incompatible (no silent migration)', () => {
  const current = createWorldEnvelope('w-1', { migrationChain: ['0.1.0'] });
  const loaded = createWorldEnvelope('w-1', { migrationChain: ['0.1.0', '0.2.0'] });
  const m = envelopeMismatches(loaded, current);
  assert.equal(m.length, 1);
  assert.equal(m[0]?.field, 'migrationChain');
});

test('F1.0 envelope: multiple differing fields are all reported', () => {
  const current = createWorldEnvelope('w-1');
  const loaded = createWorldEnvelope('w-2', { worldSchema: '0.9.9', conformanceVector: '2.0.0' });
  const fields = envelopeMismatches(loaded, current).map((x) => x.field).sort();
  assert.deepEqual(fields, ['conformanceVector', 'worldInstance', 'worldSchema']);
});
