/**
 * RC-6 contract coverage for the documented snapshot PROFILES (apps/site/src/lib/docs-api.ts
 * SNAPSHOT_PROFILES[]) — specifically the `bug-report` profile, which had no test naming it. These
 * pin its baseline and the "tightest wins" composition from `resolveSnapshotInclusion`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSnapshotInclusion } from './snapshot-policy.ts';

test("resolveSnapshotInclusion: the 'bug-report' profile is structural-only — relationships + influences, no particles, no data", () => {
  const r = resolveSnapshotInclusion({ profile: 'bug-report' });
  assert.equal(r.includeParticles, false, 'bug-report withholds the raw particle pool');
  assert.equal(r.includeData, false, 'bug-report withholds opaque body data — so a snapshot is safe to attach to an issue');
  assert.equal(r.includeRelationships, true, 'bug-report keeps structural relationships');
  assert.equal(r.includeInfluences, true, 'bug-report keeps per-body influences');
});

test("resolveSnapshotInclusion: an explicit flag can tighten the 'bug-report' profile but never widen it (tightest wins)", () => {
  // the profile sets a baseline; an explicit include* may only narrow it, never re-enable what it withholds.
  assert.equal(
    resolveSnapshotInclusion({ profile: 'bug-report', includeData: true }).includeData,
    false,
    'an explicit `true` cannot re-open data the profile excludes',
  );
  assert.equal(
    resolveSnapshotInclusion({ profile: 'bug-report', includeRelationships: false }).includeRelationships,
    false,
    'an explicit `false` tightens past the profile baseline',
  );
});
