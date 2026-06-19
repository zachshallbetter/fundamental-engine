/**
 * Phase D5 — the relationship-discovery throttle. The discovery itself is RelationshipRegistry's job
 * (tested in @fundamental-engine/dom); here we check the runtime only re-discovers on the throttle.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldDiscoverRelationships } from './platform-runtime.ts';

test('relationships re-discover on the throttle boundary, not every frame', () => {
  assert.equal(shouldDiscoverRelationships(0), true);
  assert.equal(shouldDiscoverRelationships(30), true);
  assert.equal(shouldDiscoverRelationships(60), true);
  assert.equal(shouldDiscoverRelationships(1), false);
  assert.equal(shouldDiscoverRelationships(15), false);
  assert.equal(shouldDiscoverRelationships(29), false);
});

test('the throttle interval is configurable', () => {
  assert.equal(shouldDiscoverRelationships(10, 10), true);
  assert.equal(shouldDiscoverRelationships(5, 10), false);
});
