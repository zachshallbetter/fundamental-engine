import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import { diffFieldSnapshots } from './field-snapshot.ts';
import { FIELD_VERSION } from '../version.ts';
import type { FieldHost } from './host.ts';
import type { FieldSnapshot } from './types.ts';

function tickHost(width: number, height: number): { host: FieldHost; tick: (t?: number) => void } {
  let frame: ((t: number) => void) | null = null;
  let t = 0;
  const root = { querySelectorAll: () => [], querySelector: () => null, contains: () => false } as unknown as ParentNode;
  const host: FieldHost = {
    root,
    viewport: () => ({ width, height, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => height,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (cb) => { frame = cb; return 1; },
    cancelRaf: () => { frame = null; },
    createCanvas: () => { throw new Error('no canvas'); },
    onResize: () => () => {},
    onScroll: () => () => {},
    onVisibility: () => () => {},
    onInput: () => () => {},
    onBodyEvent: () => () => {},
  };
  return { host, tick: (at) => { t = at ?? t + 1000 / 60; const cb = frame; frame = null; cb?.(t); } };
}

function field2() {
  const { host, tick } = tickHost(400, 300);
  const field = createField(undefined as never, { host, render: 'none' });
  const a = field.addBody({ tokens: ['attract'], strength: 1, range: 260, data: { entity: 'A' }, rect: () => ({ left: 180, top: 130, width: 40, height: 40 }) });
  const b = field.addBody({ tokens: ['attract'], strength: 0.5, range: 80, data: { entity: 'B' }, rect: () => ({ left: 40, top: 50, width: 20, height: 20 }) });
  for (let i = 0; i < 10; i++) tick();
  return { field, a, b, tick };
}

test('snapshot: captures bodies, relationships, formations, metrics, version (headless)', () => {
  const { field, a, b } = field2();
  field.addEdge(a, b, { type: 'relates' });
  const snap = field.snapshot();
  assert.equal(snap.version, FIELD_VERSION, 'snapshot carries the engine/format version');
  assert.deepEqual(snap.formations, ['ambient'], 'active formation captured');
  assert.equal(snap.bodies.length, 2);
  assert.ok(snap.bodies[0]!.position && snap.bodies[0]!.rect, 'bodies carry rect + position');
  assert.equal(snap.relationships.length, 1, 'relationship captured');
  assert.equal(snap.metrics.bodies, 2);
  assert.equal(snap.particles, undefined, 'particles excluded by default');
  assert.ok(typeof snap.id === 'string' && snap.id.startsWith('snap-'));
  field.destroy();
});

test('snapshot: includeParticles / includeData are opt-in', () => {
  const { field } = field2();
  const plain = field.snapshot();
  assert.equal(plain.bodies[0]!.data, undefined, 'data excluded by default');
  const full = field.snapshot({ includeParticles: true, includeData: true });
  assert.ok(Array.isArray(full.particles), 'particles included on request');
  assert.deepEqual(full.bodies.find((x) => x.id.length > 0)?.data ?? full.bodies[0]!.data, full.bodies[0]!.data);
  assert.ok(full.bodies.some((x) => x.data !== undefined), 'body data included on request');
  field.destroy();
});

test('diff: detects added bodies and formation activation between snapshots', () => {
  const { field, tick } = field2();
  const before = field.snapshot();
  field.setFormation('wells');
  field.addBody({ tokens: ['attract'], data: { entity: 'C' }, rect: () => ({ left: 300, top: 200, width: 20, height: 20 }) });
  for (let i = 0; i < 5; i++) tick();
  const after = field.snapshot();

  const d = field.diff(before, after);
  assert.equal(d.from, before.id);
  assert.equal(d.to, after.id);
  assert.ok(d.bodyChanges.some((c) => c.kind === 'added'), 'the new body shows as added');
  assert.ok(d.formationChanges.some((c) => c.id === 'wells' && c.kind === 'activated'), 'wells activated');
  assert.ok(d.formationChanges.some((c) => c.id === 'ambient' && c.kind === 'deactivated'), 'ambient deactivated');
  field.destroy();
});

test('diffFieldSnapshots: pure — body metric + relationship changes over two hand-built snapshots', () => {
  const a: FieldSnapshot = {
    id: 's1', createdAt: 0, frame: 1, version: 'x', formations: ['ambient'],
    bodies: [{ id: 'n1', tokens: ['attract'], metrics: { density: 0.2 }, dimensions: {} }],
    relationships: [{ from: 'n1', to: 'n2', type: 'relates', strength: 0.1, active: false, causal: false }],
    metrics: { particles: 100 },
  };
  const b: FieldSnapshot = {
    id: 's2', createdAt: 1, frame: 2, version: 'x', formations: ['ambient'],
    bodies: [{ id: 'n1', tokens: ['attract'], metrics: { density: 0.6 }, dimensions: {} }],
    relationships: [{ from: 'n1', to: 'n2', type: 'relates', strength: 0.4, active: true, causal: true }],
    metrics: { particles: 120 },
  };
  const d = diffFieldSnapshots(a, b);
  const body = d.bodyChanges.find((c) => c.id === 'n1');
  assert.equal(body?.kind, 'changed');
  assert.deepEqual(body?.metrics?.density, { from: 0.2, to: 0.6 });
  const rel = d.relationshipChanges[0]!;
  assert.deepEqual(rel.strength, { from: 0.1, to: 0.4 });
  assert.deepEqual(rel.active, { from: false, to: true });
  assert.deepEqual(d.metricChanges, [{ key: 'particles', from: 100, to: 120 }]);
});
