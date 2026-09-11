/**
 * Agent-read sample rate primitives (#915) — the pure helpers behind the fractional `budgets.agentRead`
 * band. The fnv1a32 known-answer vectors here are the CROSS-PLANE contract: the Kotlin
 * (`AgentPermissionsTests.kt`) and Swift (`SubstrateParityTests.swift`) mirrors assert the same numbers,
 * so a seed shared across planes selects the same subset.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentReadFraction, fnv1a32, sampleCount, sampleFraction, AGENT_VIEW_SEED_SPACE } from './agent-sampling.ts';

test('fnv1a32: known-answer vectors (cross-plane contract)', () => {
  // seed 0, frame 0, empty key → FNV-1a over the 4 zero frame bytes only.
  assert.equal(fnv1a32(0, 0, ''), 1268118805);
  assert.equal(fnv1a32(0, 0, 'a'), 1896965532);
  assert.equal(fnv1a32(7, 3, 'body-1'), 1815773647);
  // a full 32-bit seed and a negative frame (little-endian int32 bytes) — the wrap paths.
  assert.equal(fnv1a32(0xdeadbeef, -1, 'a->b:link'), 224943446);
  // multi-byte UTF-8 keys: 2-, 3- and 4-byte sequences hash their UTF-8 bytes, not code units.
  assert.equal(fnv1a32(1, 1, 'ü'), 2740257018);
  assert.equal(fnv1a32(2, 2, '€'), 2090569499);
  assert.equal(fnv1a32(3, 3, '😀'), 2755505528);
});

test('fnv1a32: sensitive to seed, frame and key; always a uint32', () => {
  const base = fnv1a32(7, 3, 'body-1');
  assert.notEqual(fnv1a32(8, 3, 'body-1'), base, 'seed changes the score');
  assert.notEqual(fnv1a32(7, 4, 'body-1'), base, 'frame changes the score');
  assert.notEqual(fnv1a32(7, 3, 'body-2'), base, 'key changes the score');
  for (const h of [base, fnv1a32(0xffffffff, 0x7fffffff, 'x'), fnv1a32(0, 0, '')]) {
    assert.ok(Number.isInteger(h) && h >= 0 && h < AGENT_VIEW_SEED_SPACE, `uint32 range: ${h}`);
  }
  // seeds beyond 32 bits are coerced to their low 32 bits (the engine only ever hands in a uint32).
  assert.equal(fnv1a32(AGENT_VIEW_SEED_SPACE + 7, 3, 'body-1'), base);
});

test('agentReadFraction: unset → 1; ≤0 / NaN → 0; clamped to [0, 1]', () => {
  assert.equal(agentReadFraction(undefined), 1);
  assert.equal(agentReadFraction({}), 1);
  assert.equal(agentReadFraction({ budgets: {} }), 1);
  assert.equal(agentReadFraction({ budgets: { agentRead: 0 } }), 0);
  assert.equal(agentReadFraction({ budgets: { agentRead: -0.5 } }), 0);
  assert.equal(agentReadFraction({ budgets: { agentRead: Number.NaN } }), 0, 'NaN closes (never opens)');
  assert.equal(agentReadFraction({ budgets: { agentRead: 0.25 } }), 0.25);
  assert.equal(agentReadFraction({ budgets: { agentRead: 1 } }), 1);
  assert.equal(agentReadFraction({ budgets: { agentRead: 1.5 } }), 1);
});

test('sampleCount: floor(fraction · n) with the boundaries pinned', () => {
  assert.equal(sampleCount(10, 0.5), 5);
  assert.equal(sampleCount(10, 0.99), 9, 'k = n - 1');
  assert.equal(sampleCount(10, 0.01), 0, 'k = 0 (a rate below one body yields none)');
  assert.equal(sampleCount(10, 1), 10, 'k = n');
  assert.equal(sampleCount(10, 1.5), 10);
  assert.equal(sampleCount(10, 0), 0);
  assert.equal(sampleCount(10, Number.NaN), 0);
  assert.equal(sampleCount(0, 0.5), 0);
  assert.equal(sampleCount(3, 0.34), 1);
});

test('sampleFraction: keeps floor(fraction · n) items in the ORIGINAL order, deterministically', () => {
  const items = Array.from({ length: 10 }, (_, i) => `body-${i}`);
  const id = (s: string): string => s;
  const a = sampleFraction(items, id, 0.5, 7, 3);
  assert.equal(a.length, 5);
  assert.deepEqual(a, ['body-0', 'body-4', 'body-5', 'body-6', 'body-7'], 'pinned subset for (seed 7, frame 3)');
  // original order is preserved: the kept items appear in their source order, not score order.
  const idx = a.map((s) => items.indexOf(s));
  assert.deepEqual(idx, [...idx].sort((x, y) => x - y));
  // same inputs → same output (pure); a different frame or seed re-rolls the subset.
  assert.deepEqual(sampleFraction(items, id, 0.5, 7, 3), a);
  assert.deepEqual(sampleFraction(items, id, 0.5, 7, 4), ['body-0', 'body-1', 'body-4', 'body-6', 'body-7'], 'pinned subset for (seed 7, frame 4)');
  assert.notDeepEqual(sampleFraction(items, id, 0.5, 8, 3), a);
  // boundaries: k = 0, k = n - 1, k = n (a copy, not the same array), fraction > 1 is full.
  assert.deepEqual(sampleFraction(items, id, 0.01, 7, 3), []);
  assert.equal(sampleFraction(items, id, 0.99, 7, 3).length, 9);
  const full = sampleFraction(items, id, 1, 7, 3);
  assert.deepEqual(full, items);
  assert.notEqual(full, items, 'a full sample is a copy');
  assert.deepEqual(sampleFraction(items, id, 1.5, 7, 3), items);
  assert.deepEqual(sampleFraction([], id, 0.5, 7, 3), []);
});

test('sampleFraction: keys drive selection — the same key set yields the same subset regardless of item shape', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  const asStrings = sampleFraction(ids, (s) => s, 0.5, 11, 2);
  const asObjects = sampleFraction(ids.map((id) => ({ id, payload: Math.random() })), (o) => o.id, 0.5, 11, 2);
  assert.deepEqual(asObjects.map((o) => o.id), asStrings);
  // a duplicated key ties on score; the tie breaks by original index so both survive or neither does
  // only as the count allows — and order is still the source order.
  const dup = sampleFraction(['x', 'x', 'y', 'z'], (s) => s, 0.5, 1, 1);
  assert.equal(dup.length, 2);
});
