/**
 * bindData diff tests — the deterministic record diff is pure and node-testable (the DOM binding is
 * verified in the browser).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffIds } from './bind-data.ts';

test('diffIds reports added / removed / kept', () => {
  const d = diffIds(['a', 'b', 'c'], ['b', 'c', 'd']);
  assert.deepEqual(d.added, ['d']);
  assert.deepEqual(d.removed.sort(), ['a']);
  assert.deepEqual(d.kept.sort(), ['b', 'c']);
});

test('diffIds is stable for identical sets (deterministic, no churn)', () => {
  const d = diffIds(['x', 'y'], ['x', 'y']);
  assert.deepEqual(d.added, []);
  assert.deepEqual(d.removed, []);
  assert.deepEqual(d.kept.sort(), ['x', 'y']);
});

test('diffIds handles empty → full and full → empty', () => {
  assert.deepEqual(diffIds([], ['a', 'b']).added.sort(), ['a', 'b']);
  assert.deepEqual(diffIds(['a', 'b'], []).removed.sort(), ['a', 'b']);
});
