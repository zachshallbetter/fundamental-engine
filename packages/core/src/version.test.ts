import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FIELD_VERSION } from './version.ts';

// Drift guard: FIELD_VERSION is the runtime version a consumer reads off the field; it MUST equal the
// published package version. This test fails the build if a release bumps package.json but not
// version.ts (or vice-versa), keeping the release bump the single source of truth.
test('FIELD_VERSION matches packages/core/package.json (no drift)', () => {
  const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  assert.equal(FIELD_VERSION, pkg.version, 'update FIELD_VERSION in packages/core/src/version.ts to match the release');
});
