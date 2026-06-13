/**
 * The vanilla door exposes the field-first names only — the deprecated `Forces*` aliases were
 * removed with the forces-ui alias window.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as mod from './index.ts';

test('the deprecated Forces* aliases are gone', () => {
  assert.equal('ForcesField' in mod, false);
  assert.equal('ForcesFieldInit' in mod, false);
});

test('the field-first names stay exported', () => {
  assert.equal(typeof mod.FieldField, 'function');
  assert.equal(typeof mod.mountField, 'function');
});
