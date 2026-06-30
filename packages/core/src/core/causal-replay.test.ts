import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replayFieldSnapshots } from './field-snapshot.ts';
import type { FieldSnapshot } from './types.ts';

const snap = (over: Partial<FieldSnapshot>): FieldSnapshot => ({
  id: 's', createdAt: 0, frame: 0, version: 'x', formations: ['ambient'], bodies: [], relationships: [], metrics: {}, ...over,
});

test('replay: narrates formation, relationship, body, and metric causes between two snapshots', () => {
  const a = snap({
    id: 's1', frame: 1, formations: ['ambient'],
    bodies: [{ id: 'n1', tokens: ['attract'], metrics: { density: 0.2 }, dimensions: {} }],
    relationships: [{ from: 'n1', to: 'n2', type: 'supports', strength: 0.1, active: false, causal: false }],
  });
  const b = snap({
    id: 's2', frame: 2, createdAt: 16, formations: ['wells'],
    bodies: [
      { id: 'n1', tokens: ['attract'], metrics: { density: 0.6 }, dimensions: {} },
      { id: 'n3', tokens: ['repel'], metrics: { density: 0.1 }, dimensions: {} },
    ],
    relationships: [{ from: 'n1', to: 'n2', type: 'supports', strength: 0.4, active: true, causal: true }],
  });

  const r = replayFieldSnapshots(a, b);
  assert.equal(r.from, 's1');
  assert.equal(r.to, 's2');
  const causes = r.steps.map((s) => s.cause);
  assert.ok(causes.includes('formation'), 'formation activation narrated');
  assert.ok(causes.includes('relationship'), 'relationship change narrated');
  assert.ok(causes.includes('measurement'), 'the new body (n3) narrated as a measurement');
  assert.ok(causes.includes('metric'), "n1's density change narrated as a metric");
  assert.ok(r.steps.every((s) => s.frame === 2 && s.time === 16), 'steps carry the target frame/time');
  // a sample description is human-readable
  assert.ok(r.steps.some((s) => /strengthened 0\.1→0\.4/.test(s.description)), `relationship described: ${r.steps.map((s) => s.description).join(' | ')}`);
});

test('replay: focus scopes the steps to one body', () => {
  const a = snap({
    id: 'a', bodies: [{ id: 'x', tokens: [], metrics: { density: 0.1 }, dimensions: {} }, { id: 'y', tokens: [], metrics: { density: 0.1 }, dimensions: {} }],
  });
  const b = snap({
    id: 'b', bodies: [{ id: 'x', tokens: [], metrics: { density: 0.5 }, dimensions: {} }, { id: 'y', tokens: [], metrics: { density: 0.9 }, dimensions: {} }],
  });
  const r = replayFieldSnapshots(a, b, { focus: 'x' });
  assert.equal(r.focus, 'x');
  assert.ok(r.steps.length > 0 && r.steps.every((s) => s.source === 'x'), 'only the focused body’s steps remain');
});

test('replay: no changes ⇒ no steps', () => {
  const a = snap({ id: 'a', bodies: [{ id: 'x', tokens: [], metrics: { density: 0.3 }, dimensions: {} }] });
  const b = snap({ id: 'b', bodies: [{ id: 'x', tokens: [], metrics: { density: 0.3 }, dimensions: {} }] });
  assert.equal(replayFieldSnapshots(a, b).steps.length, 0);
});
