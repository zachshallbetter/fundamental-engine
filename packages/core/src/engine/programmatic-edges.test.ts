import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

// A minimal manual-tick headless host for the test (the shipped headlessHost is #600). raf stashes the
// frame; tick() fires it, so we drive the loop deterministically.
function tickHost(width: number, height: number): { host: FieldHost; tick: (t?: number) => void } {
  let frame: ((t: number) => void) | null = null;
  let t = 0;
  const root = {
    querySelectorAll: () => [],
    querySelector: () => null,
    contains: () => false,
  } as unknown as ParentNode;
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

test('addEdge: a relationship between two programmatic bodies strengthens while its source is salient', () => {
  const { host, tick } = tickHost(400, 300);
  const field = createField(undefined as never, { host, render: 'none' });

  // A = a strong attract source (it gathers matter → it becomes salient); B = the target it relates to.
  const a = field.addBody({
    tokens: ['attract'],
    strength: 1.6,
    range: 260,
    data: { entity: 'meeting' },
    rect: () => ({ left: 180, top: 130, width: 40, height: 40 }),
  });
  const b = field.addBody({
    tokens: ['attract'],
    strength: 0.2,
    range: 80,
    data: { entity: 'file' },
    rect: () => ({ left: 40, top: 40, width: 20, height: 20 }),
  });
  const edge = field.addEdge(a, b, { type: 'relates' });

  // it reads back immediately, keyed by the bodies' carried records.
  let edges = field.readEdges();
  assert.equal(edges.length, 1);
  assert.equal(edges[0]!.type, 'relates');
  assert.deepEqual(edges[0]!.from, { entity: 'meeting' });
  assert.deepEqual(edges[0]!.to, { entity: 'file' });
  const start = edges[0]!.strength;

  // drive frames: A gathers matter → A.d rises past the salience threshold → the edge goes active and
  // strengthens, and memory accumulates (the longitudinal warmth an agent reads).
  for (let i = 0; i < 240; i++) tick();
  edges = field.readEdges();
  assert.ok(edges[0]!.active, 'the edge went active as its source gathered matter');
  assert.ok(edges[0]!.strength > start, `strength rose while active (${start} → ${edges[0]!.strength})`);
  assert.ok(edges[0]!.memory > 0, 'memory accumulated — the relationship is "warm"');

  // live mutation + removal.
  edge.set({ strength: 0.1 });
  assert.equal(field.readEdges()[0]!.strength, 0.1, 'set() mutates strength live');
  edge.remove();
  assert.equal(field.readEdges().length, 0, 'remove() drops the edge');

  field.destroy();
});

test('addEdge: removing a body drops the edges that touched it', () => {
  const { host } = tickHost(300, 300);
  const field = createField(undefined as never, { host, render: 'none' });
  const a = field.addBody({ tokens: ['attract'], rect: () => ({ left: 10, top: 10, width: 10, height: 10 }) });
  const b = field.addBody({ tokens: ['attract'], rect: () => ({ left: 90, top: 90, width: 10, height: 10 }) });
  field.addEdge(a, b);
  assert.equal(field.readEdges().length, 1);
  a.remove();
  assert.equal(field.readEdges().length, 0, 'the edge is dropped when an endpoint body is removed');
  field.destroy();
});

test('addEdge: rejects handles that are not from this field', () => {
  const { host } = tickHost(200, 200);
  const field = createField(undefined as never, { host, render: 'none' });
  const a = field.addBody({ tokens: ['attract'], rect: () => ({ left: 0, top: 0, width: 10, height: 10 }) });
  const orphan = { data: null, channels: {}, set: () => {}, remove: () => {} };
  assert.throws(() => field.addEdge(a, orphan as never), /handles returned by addBody/);
  field.destroy();
});
