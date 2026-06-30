import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

// Manual-tick headless host (mirrors programmatic-edges.test.ts): raf stashes the frame, tick() fires it.
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
    raf: (cb) => {
      frame = cb;
      return 1;
    },
    cancelRaf: () => {
      frame = null;
    },
    createCanvas: () => {
      throw new Error('no canvas in this test');
    },
    onResize: () => () => {},
    onScroll: () => () => {},
    onVisibility: () => () => {},
    onInput: () => () => {},
    onBodyEvent: () => () => {},
  };
  return {
    host,
    tick: (at) => {
      t = at ?? t + 1000 / 60;
      const cb = frame;
      frame = null;
      cb?.(t);
    },
  };
}

// Two bodies: A at centre (200,150), B far away at (50,60).
function twoBodyField() {
  const { host, tick } = tickHost(400, 300);
  const field = createField(undefined as never, { host, render: 'none' });
  const a = field.addBody({ tokens: ['attract'], strength: 1, range: 260, data: { entity: 'A' }, rect: () => ({ left: 180, top: 130, width: 40, height: 40 }) });
  const b = field.addBody({ tokens: ['attract'], strength: 0.5, range: 80, data: { entity: 'B' }, rect: () => ({ left: 40, top: 50, width: 20, height: 20 }) });
  for (let i = 0; i < 20; i++) tick(); // settle a few frames so metrics/positions are live
  return { field, a, b };
}

test('query: global query returns every visible body + field metrics, headless', () => {
  const { field } = twoBodyField();
  const r = field.query();
  assert.equal(r.bodies.length, 2, 'both bodies seen');
  assert.equal(r.metrics.bodies, 2);
  assert.equal(r.metrics.particles, field.particleCount(), 'particle count reported');
  assert.equal(r.region, undefined, 'a global query has no region');
  assert.ok(r.frame >= 0 && typeof r.time === 'number');
  field.destroy();
});

test('query: a local point query keeps only bodies in range', () => {
  const { field } = twoBodyField();
  const r = field.query({ at: { x: 230, y: 150 }, radius: 100 });
  assert.equal(r.bodies.length, 1, 'only the near body (A) is in range');
  assert.equal(r.bodies[0]!.tokens[0], 'attract');
  assert.ok(r.region && r.region.width === 200, 'region resolved from point + radius');
  field.destroy();
});

test('query: influences attribute the in-range force at the query point', () => {
  const { field } = twoBodyField();
  const r = field.query({ at: { x: 230, y: 150 }, radius: 100, include: ['influences'] });
  const attract = r.influences.find((i) => i.force === 'attract');
  assert.ok(attract, 'attract influence attributed at the point');
  const c = attract!.contribution as { x: number; y: number };
  assert.ok(Math.hypot(c.x, c.y) > 0, 'a non-zero Δv contribution');
  field.destroy();
});

test('query: relationships carry stable ids that match the body readings', () => {
  const { field, a, b } = twoBodyField();
  field.addEdge(a, b, { type: 'relates' });
  const r = field.query();
  assert.equal(r.relationships.length, 1);
  const edge = r.relationships[0]!;
  assert.equal(edge.type, 'relates');
  const ids = new Set(r.bodies.map((x) => x.id));
  assert.ok(ids.has(edge.from) && ids.has(edge.to), 'edge endpoints reference the body readings by id');
  field.destroy();
});

test('query: a rect `at` (DOMRect-shaped) selects bodies whose centre is inside', () => {
  const { field } = twoBodyField();
  const r = field.query({ at: { x: 150, y: 100, width: 120, height: 120 } }); // covers A (200,150), not B (50,60)
  assert.equal(r.bodies.length, 1, 'only A is inside the rect');
  field.destroy();
});

test('query: is read-only — it does not mutate field state', () => {
  const { field } = twoBodyField();
  const before = field.particleCount();
  field.query({ at: { x: 200, y: 150 }, radius: 120, include: ['bodies', 'metrics', 'relationships', 'influences'] });
  assert.equal(field.particleCount(), before, 'particle count unchanged by a query');
  field.destroy();
});
