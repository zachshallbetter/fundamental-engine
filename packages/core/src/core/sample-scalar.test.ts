/**
 * `FieldHandle.sampleScalar(x, y)` — the smooth, diffused density scalar (the heatmap grid) external
 * foraging consumers read. Unlike a nearest-body readout it stays meaningful (non-flat gradient) at a
 * source. Pins: off → 0; on → matter gathered at an attract well reads denser at the well than in an
 * empty corner. Driven through a frame-capturing host so the per-frame heatmap deposit/diffuse runs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

function virtualBody(attrs: Record<string, string>, r: { x: number; y: number; w: number; h: number }) {
  return {
    dataset: {} as Record<string, string>,
    getAttribute: (n: string) => attrs[n] ?? null,
    hasAttribute: (n: string) => n in attrs,
    getBoundingClientRect: () => ({
      left: r.x - r.w / 2, top: r.y - r.h / 2, right: r.x + r.w / 2, bottom: r.y + r.h / 2,
      width: r.w, height: r.h, x: r.x - r.w / 2, y: r.y - r.h / 2, toJSON: () => ({}),
    }),
  };
}

/** A host that captures the rAF callback so the test can drive frames synchronously. */
function drivableHost(bodyEls: unknown[]): { host: FieldHost; step: (frames: number) => void } {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null;
  let id = 0;
  let now = 0;
  const host: FieldHost = {
    root: {
      querySelectorAll: (sel: string) => (sel.startsWith('[data-body]') ? bodyEls : []),
      querySelector: () => null,
    } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 800, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 1000,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (fn) => { cb = fn as (now: number) => void; return ++id; },
    cancelRaf: off,
    createCanvas: () => ({}) as unknown as HTMLCanvasElement,
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
  const step = (frames: number): void => {
    for (let i = 0; i < frames; i++) { now += 16; cb?.(now); }
  };
  return { host, step };
}

test('sampleScalar is 0 when the heatmap layer is off', () => {
  const { host } = drivableHost([]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    assert.equal(field.sampleScalar(500, 400), 0, 'no heatmap → 0');
  } finally {
    field.destroy();
  }
});

test('sampleScalar reads denser where matter has gathered (heatmap on, render none)', () => {
  const well = virtualBody({ 'data-body': 'attract', 'data-strength': '2.2', 'data-range': '800' }, {
    x: 500, y: 400, w: 40, h: 40,
  });
  const { host, step } = drivableHost([well]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', heatmap: true });
  try {
    field.scan(); // register + measure the attract well
    step(300); // let matter gather and the heatmap deposit + diffuse

    const atWell = field.sampleScalar(500, 400);
    const atCorner = field.sampleScalar(60, 60);
    assert.ok(atWell >= 0 && atWell <= 1, `normalized [0,1]: ${atWell}`);
    assert.ok(atWell > atCorner, `denser at the well than the corner: ${atWell.toFixed(3)} > ${atCorner.toFixed(3)}`);
    assert.ok(atWell > 0.2, `the well reads clearly dense: ${atWell.toFixed(3)}`);
  } finally {
    field.destroy();
  }
});

test('sampleGradient is { x: 0, y: 0 } when the heatmap layer is off', () => {
  const { host } = drivableHost([]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    assert.deepEqual(field.sampleGradient(500, 400), { x: 0, y: 0 }, 'no heatmap → zero gradient');
  } finally {
    field.destroy();
  }
});

test('sampleGradient points up-density toward a source and stays non-degenerate (the foraging cue)', () => {
  const well = virtualBody({ 'data-body': 'attract', 'data-strength': '2.2', 'data-range': '800' }, {
    x: 500, y: 400, w: 40, h: 40,
  });
  const { host, step } = drivableHost([well]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', heatmap: true });
  try {
    field.scan(); // register + measure the attract well
    step(300); // gather matter and accumulate + diffuse the heatmap

    // On the density slope to the RIGHT of the well, the gradient must (a) be non-zero — the
    // non-degeneracy a nearest-body density loses at a source — and (b) point back toward the
    // well (up-density). This is exactly the cue forage-by-gradient steers by.
    const g = field.sampleGradient(560, 400);
    const mag = Math.hypot(g.x, g.y);
    assert.ok(mag > 0, `gradient is non-degenerate on the slope: |∇|=${mag.toExponential(2)}`);
    const towardWell = g.x * (500 - 560) + g.y * (400 - 400); // dot with the direction to the well
    assert.ok(towardWell > 0, `points up-density toward the well: ∇·(toWell)=${towardWell.toExponential(2)}`);
  } finally {
    field.destroy();
  }
});
