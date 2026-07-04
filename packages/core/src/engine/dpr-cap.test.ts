/**
 * `FieldOptions.dprCap` + `FieldHandle.setDprCap` — the backing-store DPR ceiling (#410). Pins: the
 * effective DPR is min(devicePixelRatio, dprCap); the default ceiling is 2; setDprCap re-sizes now.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

const noopCtx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D;
function trackedCanvas(): { canvas: HTMLCanvasElement; w: () => number } {
  const node = { width: 0, height: 0, style: {} as Record<string, string>,
    getContext: () => noopCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }) };
  return { canvas: node as unknown as HTMLCanvasElement, w: () => node.width };
}
function host(dpr: number): FieldHost {
  const off = (): void => {};
  return {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 800, dpr }),
    scrollY: () => 0, scrollHeight: () => 1000, reducedMotion: () => false, hidden: () => false,
    raf: () => 1, cancelRaf: off, createCanvas: () => trackedCanvas().canvas,
    onResize: () => off, onScroll: () => off, onVisibility: () => off, onInput: () => off, onBodyEvent: () => off,
  };
}

test('dprCap lowers the backing-store resolution (effective DPR = min(devicePixelRatio, dprCap))', () => {
  const { canvas, w } = trackedCanvas();
  const field = createField(canvas, { host: host(2), render: 'dots', dprCap: 1.5 });
  try {
    assert.equal(w(), Math.floor(1000 * 1.5), `1000px @ dprCap 1.5 → ${w()}`); // not the device 2×
  } finally { field.destroy(); }
});

test('setDprCap re-sizes the backing store immediately', () => {
  const { canvas, w } = trackedCanvas();
  const field = createField(canvas, { host: host(2), render: 'dots', dprCap: 1 });
  try {
    assert.equal(w(), 1000, 'starts at dpr 1');
    field.setDprCap(2);
    assert.equal(w(), 2000, 'raised to dpr 2 immediately');
  } finally { field.destroy(); }
});

test('the default ceiling is 2 (a 3× display caps at 2×)', () => {
  const { canvas, w } = trackedCanvas();
  const field = createField(canvas, { host: host(3), render: 'dots' });
  try {
    assert.equal(w(), 2000, `3× display → capped at 2× (${w()})`);
  } finally { field.destroy(); }
});

test('setQualityTier caps the effective DPR per tier and restores reversibly (#413)', () => {
  const { canvas, w } = trackedCanvas();
  const field = createField(canvas, { host: host(2), render: 'dots' }); // dprCap default 2 → 2000
  try {
    assert.equal(w(), 2000, 'tier 0: configured DPR (2×)');
    field.setQualityTier(1); assert.equal(w(), Math.floor(1000 * 1.5), 'tier 1 → 1.5×');
    field.setQualityTier(2); assert.equal(w(), Math.floor(1000 * 1.25), 'tier 2 → 1.25×');
    field.setQualityTier(3); assert.equal(w(), 1000, 'tier 3 → 1×');
    field.setQualityTier(0); assert.equal(w(), 2000, 'tier 0 restores full quality');
  } finally { field.destroy(); }
});
