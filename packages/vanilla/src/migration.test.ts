/**
 * field-ui migration: the vanilla `FieldField` alias (docs/planning-archive/field-ui-migration-plan.md §3) is the
 * same class as `ForcesField`, so existing imports and the field-first name resolve identically.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ForcesField, FieldField, mountField } from './index.ts';

test('FieldField is an alias of ForcesField', () => {
  assert.equal(FieldField, ForcesField);
});

test('mountField stays field-named and exported', () => {
  assert.equal(typeof mountField, 'function');
});
