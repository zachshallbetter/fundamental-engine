/**
 * `FieldHandle.setSurfaces(plan)` / `getSurfaces()` — one declarative verb for the whole surface
 * state (matter underlay + readings overlay + accumulation heatmap). Pins: it sets all three; the
 * plan is the full truth (an omitted key resets to its default); and `setSurfaces(getSurfaces())`
 * round-trips with no change.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

const noopCtx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D;
const makeCanvas = () => ({
  width: 0, height: 0, style: {} as Record<string, string>,
  getContext: () => noopCtx,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }),
}) as unknown as HTMLCanvasElement;

function host(): FieldHost {
  const off = (): void => {};
  return {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 800, dpr: 1 }),
    scrollY: () => 0, scrollHeight: () => 1000, reducedMotion: () => false, hidden: () => false,
    raf: () => 1, cancelRaf: off, createCanvas: () => makeCanvas(),
    onResize: () => off, onScroll: () => off, onVisibility: () => off, onInput: () => off, onBodyEvent: () => off,
  };
}

test('setSurfaces sets all three surfaces and getSurfaces reads them back', () => {
  const field = createField(makeCanvas(), { host: host(), render: 'dots' });
  try {
    field.setSurfaces({ underlay: 'links', overlay: ['grid', 'path'], heatmap: true });
    const s = field.getSurfaces();
    assert.equal(s.underlay, 'links', 'underlay set');
    assert.deepEqual(s.overlay, ['grid', 'path'], 'overlay stack set');
    assert.equal(s.heatmap, true, 'heatmap on');
  } finally {
    field.destroy();
  }
});

test('the plan is the full truth — an omitted key resets to its default', () => {
  const field = createField(makeCanvas(), { host: host(), render: 'dots' });
  try {
    field.setSurfaces({ underlay: 'trails', overlay: 'grid', heatmap: true });
    field.setSurfaces({}); // empty plan → everything back to defaults
    const d = field.getSurfaces();
    assert.equal(d.underlay, 'dots', 'underlay → default dots');
    assert.equal(d.overlay, 'off', 'overlay → default off');
    assert.equal(d.heatmap, false, 'heatmap → default off');
  } finally {
    field.destroy();
  }
});

test('setSurfaces(getSurfaces()) round-trips with no change (restorable)', () => {
  const field = createField(makeCanvas(), { host: host(), render: 'dots' });
  try {
    field.setSurfaces({ underlay: 'metaballs', overlay: ['temperature'], heatmap: true });
    const snapshot = field.getSurfaces();
    field.setSurfaces(snapshot);
    assert.deepEqual(field.getSurfaces(), snapshot, 'restoring a snapshot is a no-op');
  } finally {
    field.destroy();
  }
});
