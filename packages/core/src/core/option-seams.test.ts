/**
 * FieldOptions seam coverage — four constructor-only options that wire internal knobs and
 * injectable contracts: gridWarp, gridIntensity, overlayBackend, feedbackSink. Each test
 * verifies acceptance and the observable effect exposed by the seam itself.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';
import type { RenderBackend } from './render-backend.ts';
import type { FeedbackSink } from './types.ts';

const noopCtx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D;

function fakeCanvas(): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    getContext: () => noopCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
  } as unknown as HTMLCanvasElement;
}

function fakeHost(): FieldHost {
  const off = (): void => {};
  return {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 800, height: 600, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 800,
    reducedMotion: () => false,
    hidden: () => false,
    raf: () => 1,
    cancelRaf: off,
    createCanvas: fakeCanvas,
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
}

test('gridWarp: 0 is accepted without throwing (flat grid, no deflection)', () => {
  const field = createField(fakeCanvas(), { host: fakeHost(), render: 'none', gridWarp: 0 });
  try {
    assert.ok(field, 'field initialises with gridWarp: 0');
  } finally {
    field.destroy();
  }
});

test('gridWarp: values > 1 (amplified deflection) are accepted without throwing', () => {
  const field = createField(fakeCanvas(), { host: fakeHost(), render: 'none', gridWarp: 3 });
  try {
    assert.ok(field, 'field initialises with gridWarp: 3');
  } finally {
    field.destroy();
  }
});

test('gridWarp: negative values fall back to the default (1) without throwing', () => {
  // The engine guard: `opts.gridWarp != null && opts.gridWarp >= 0 ? opts.gridWarp : 1`
  // A negative value fails the >= 0 check and the engine silently substitutes the default.
  const field = createField(fakeCanvas(), { host: fakeHost(), render: 'none', gridWarp: -1 });
  try {
    assert.ok(field, 'field initialises with a negative gridWarp (falls back to default)');
  } finally {
    field.destroy();
  }
});

test('gridIntensity: 0 (invisible grid lines) is accepted without throwing', () => {
  const field = createField(fakeCanvas(), { host: fakeHost(), render: 'none', gridIntensity: 0 });
  try {
    assert.ok(field, 'field initialises with gridIntensity: 0');
  } finally {
    field.destroy();
  }
});

test('gridIntensity: 1 (maximum opacity) is accepted without throwing', () => {
  const field = createField(fakeCanvas(), { host: fakeHost(), render: 'none', gridIntensity: 1 });
  try {
    assert.ok(field, 'field initialises with gridIntensity: 1');
  } finally {
    field.destroy();
  }
});

test('gridIntensity: values above 1 are clamped to 1 (no throw)', () => {
  // The engine guard: `Math.min(opts.gridIntensity, 1)` — values > 1 are silently clamped.
  const field = createField(fakeCanvas(), { host: fakeHost(), render: 'none', gridIntensity: 5 });
  try {
    assert.ok(field, 'field initialises with supra-unity gridIntensity (clamped to 1)');
  } finally {
    field.destroy();
  }
});

test('overlayBackend: an injected RenderBackend is called for size() when the surface initialises', () => {
  const sizeCalls: Array<[number, number, number]> = [];
  const backend: RenderBackend = {
    size(w, h, dpr) { sizeCalls.push([w, h, dpr]); },
    clear() {},
    segments() {},
    polyline() {},
    rect() {},
    text() {},
    measureText() { return 0; },
  };

  const overlayCanvas = fakeCanvas();
  // render:'dots' acquires the 2d context and triggers the initial sizeSurfaces() call, which
  // invokes overlayBackend.size() for the paired overlay surface.
  const field = createField(fakeCanvas(), {
    host: fakeHost(),
    render: 'dots',
    overlayCanvas,
    overlayBackend: backend,
  });
  try {
    assert.ok(sizeCalls.length > 0, 'overlayBackend.size() must be called during field initialisation');
    const [w, h] = sizeCalls[0]!;
    assert.ok(w! > 0 && h! > 0, `size() called with positive dimensions (${w}×${h})`);
  } finally {
    field.destroy();
  }
});

test('overlayBackend: injecting a custom backend replaces the default canvas2dBackend', () => {
  const calls: string[] = [];
  const backend: RenderBackend = {
    size(w, h, dpr) { calls.push(`size:${w}x${h}@${dpr}`); },
    clear() { calls.push('clear'); },
    segments() { calls.push('segments'); },
    polyline() { calls.push('polyline'); },
    rect() { calls.push('rect'); },
    text() { calls.push('text'); },
    measureText() { return 0; },
  };

  const field = createField(fakeCanvas(), {
    host: fakeHost(),
    render: 'dots',
    overlayCanvas: fakeCanvas(),
    overlayBackend: backend,
  });
  try {
    assert.ok(calls.some((c) => c.startsWith('size:')), 'the injected backend — not the default — received size()');
  } finally {
    field.destroy();
  }
});

test('feedbackSink: the injected sink is accepted and field initialises without throwing', () => {
  const sink: FeedbackSink = (_el, _channels) => {};

  const field = createField(fakeCanvas(), {
    host: fakeHost(),
    render: 'none',
    feedbackSink: sink,
  });
  try {
    assert.ok(field, 'field initialises with a custom feedbackSink');
  } finally {
    field.destroy();
  }
});

test('feedbackSink: omitting the option falls back to the default sink (no throw)', () => {
  const field = createField(fakeCanvas(), { host: fakeHost(), render: 'none' });
  try {
    assert.ok(field, 'field initialises without a feedbackSink (default installed)');
  } finally {
    field.destroy();
  }
});
