import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyLens } from './query-lens.ts';
import { createField } from './field.ts';
import type { FieldQueryResult, FieldLens } from './types.ts';
import type { FieldHost } from './host.ts';

function tickHost(width = 800, height = 600): { host: FieldHost; tick: (t?: number) => void } {
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

const result = (): FieldQueryResult => ({
  query: {},
  frame: 1,
  time: 16,
  bodies: [
    { id: 'a', tokens: ['attract'], metrics: { density: 0.5, load: 0.2 }, dimensions: { entropy: 0.1, temperature: 0.3 } },
    { id: 'b', tokens: ['gravity', 'sink'], metrics: { density: 0.9, load: 0.7 }, dimensions: { entropy: 0.4, temperature: 0.8 } },
  ],
  metrics: { density: 0.7, attention: 0.6, temperature: 0.5 },
  relationships: [],
  influences: [
    { source: 'a', force: 'attract', channel: 'linear', contribution: { x: 1, y: 0 } },
    { source: 'b', force: 'gravity', channel: 'thermal', contribution: 0.2 },
    { source: 'b', force: 'sink', contribution: { x: 0, y: 1 } }, // no channel ⇒ counts as 'linear'
  ],
  projections: [],
});

test('lens with no clauses keeps everything but tags the result', () => {
  const out = applyLens(result(), { id: 'all' });
  assert.equal(out.lens, 'all');
  assert.deepEqual(Object.keys(out.metrics), ['density', 'attention', 'temperature']);
  assert.equal(out.bodies.length, 2);
  assert.equal(out.influences.length, 3);
});

test('metrics clause filters global metrics AND each body metrics/dimensions', () => {
  const lens: FieldLens = { id: 'thermal', metrics: ['density', 'temperature', 'entropy'] };
  const out = applyLens(result(), lens);
  assert.deepEqual(Object.keys(out.metrics).sort(), ['density', 'temperature']); // 'attention' dropped
  assert.deepEqual(Object.keys(out.bodies[0]!.metrics), ['density']); // 'load' dropped
  assert.deepEqual(Object.keys(out.bodies[0]!.dimensions).sort(), ['entropy', 'temperature']); // both in the lens set
});

test('channels clause filters influences; a missing channel counts as linear', () => {
  const linear = applyLens(result(), { id: 'lin', channels: ['linear'] });
  assert.equal(linear.influences.length, 2, 'attract(linear) + sink(no channel ⇒ linear)');
  assert.ok(linear.influences.every((i) => (i.channel ?? 'linear') === 'linear'));
  const thermal = applyLens(result(), { id: 'th', channels: ['thermal'] });
  assert.equal(thermal.influences.length, 1);
  assert.equal(thermal.influences[0]!.force, 'gravity');
});

test('tokens clause keeps only bodies carrying a listed token', () => {
  const out = applyLens(result(), { id: 'sinks', tokens: ['sink'] });
  assert.deepEqual(out.bodies.map((b) => b.id), ['b']);
});

test('field.query({ lens }) scopes the live answer and tags it', () => {
  const { host } = tickHost();
  const field = createField(undefined as never, { host, render: 'none' });
  field.addBody({ tokens: ['attract'], strength: 1, range: 300, data: { id: 'A' }, rect: () => ({ left: 380, top: 280, width: 40, height: 40 }) });
  const full = field.query();
  const lensed = field.query({ lens: { id: 'tokens-only', tokens: ['gravity'] } });
  assert.equal(lensed.lens, 'tokens-only');
  assert.ok(lensed.bodies.length <= full.bodies.length, 'lens never adds bodies');
  assert.equal(lensed.bodies.length, 0, 'no body carries gravity → all filtered out');
  field.destroy?.();
});

test('applyLens is pure — the input result is not mutated', () => {
  const r = result();
  const before = JSON.stringify(r);
  applyLens(r, { id: 'x', metrics: ['density'], channels: ['thermal'], tokens: ['sink'] });
  assert.equal(JSON.stringify(r), before, 'no mutation of the source result');
});
