/**
 * Doc completeness guard (the "hybrid" check) — the per-force catalog in
 * docs/forces-tests.md is hand-written, so this asserts it can't silently fall behind
 * the engine: every registered force must appear (backticked) in the document.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allForces } from './run.ts';

const docPath = fileURLToPath(new URL('../../../../docs/forces-tests.md', import.meta.url));
const doc = readFileSync(docPath, 'utf8');

test('forces-tests.md documents every registered force', () => {
  const missing = Object.keys(allForces()).filter((t) => !doc.includes('`' + t + '`'));
  assert.deepEqual(missing, [], `forces missing from docs/forces-tests.md: ${missing.join(', ')}`);
});
