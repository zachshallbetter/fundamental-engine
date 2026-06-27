import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_VERSION } from './index.ts';
import { FIELD_VERSION as CORE_FIELD_VERSION } from '@fundamental-engine/core';

/**
 * The elements door must re-export FIELD_VERSION as a named export (#584). A missing named import
 * aborts the entire consuming ES module, so `import { FIELD_VERSION } from '@fundamental-engine/elements'`
 * has to resolve — and to the same string the element reports as `el.version`.
 */
test('elements re-exports FIELD_VERSION equal to core', () => {
  assert.equal(typeof FIELD_VERSION, 'string');
  assert.ok(FIELD_VERSION.length > 0);
  assert.equal(FIELD_VERSION, CORE_FIELD_VERSION);
});
