/**
 * The overlay surface's own gate — Field Surfaces lane S0.
 *
 * Two facts are pinned here, and they pull in opposite directions, which is why they live together:
 *
 * 1. **A reading is not matter** (§13.7 as amended — Field Surfaces Q-3). `render: 'none'` is the
 *    signals-only mode for MATTER. A field that declares an overlay reading draws it whatever the
 *    underlay mode is, because a reading lives on a different, host-owned canvas. The old behaviour
 *    — one `if` in the frame loop gating both surfaces — made the most-wanted case (readings over
 *    content the engine does not paint) a silent no-op on every host.
 *
 * 2. **The no-allocation guarantee survives intact for every field that declares no reading**, which
 *    is the default. No provider call, no context on the main canvas, backing store still 0×0.
 *
 * Plus the DPR ceiling (C-25): the lazily-resolved surface must obey `dprCap` and the quality tier,
 * not the raw host DPR — a full-viewport mix-blend layer at DPR 3 on a phone is exactly the fill
 * cost `dprCap` exists to stop.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';
import type { RenderBackend } from './render-backend.ts';

const noopCtx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D;

/** a canvas stub that counts context acquisitions — the #297 guarantee is observable through it. */
type CountingCanvas = HTMLCanvasElement & { getContextCalls: number };
function countingCanvas(): CountingCanvas {
  const node = {
    width: 0,
    height: 0,
    getContextCalls: 0,
    style: {} as Record<string, string>,
    getContext(): CanvasRenderingContext2D {
      node.getContextCalls++;
      return noopCtx;
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }),
  };
  return node as unknown as CountingCanvas;
}

/** a host whose rAF callback is captured, so frames are stepped by hand (no DOM, no timers). */
function steppableHost(dpr = 1): { host: FieldHost; tick: (n: number) => void } {
  const off = (): void => {};
  let frameCb: ((t: number) => void) | null = null;
  let t = 0;
  const host: FieldHost = {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 800, dpr }),
    scrollY: () => 0,
    scrollHeight: () => 1000,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (cb) => {
      frameCb = cb;
      return 1;
    },
    cancelRaf: off,
    createCanvas: () => countingCanvas(),
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
  const tick = (n: number): void => {
    for (let i = 0; i < n; i++) {
      t += 16;
      frameCb?.(t); // the engine re-requests raf each frame, reassigning frameCb to the next callback
    }
  };
  return { host, tick };
}

/** the primitives a reading can emit geometry through — `renderOverlay` picks per reading. */
const GEOMETRY = ['segments', 'polyline', 'rect', 'text'];
const drewGeometry = (calls: readonly string[]): boolean => calls.some((c) => GEOMETRY.includes(c));

/** a RenderBackend that records what the overlay dispatch asked it to do. */
function recordingBackend(): { backend: RenderBackend; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    backend: {
      size(w, h, dpr) { calls.push(`size:${w}x${h}@${dpr}`); },
      clear() { calls.push('clear'); },
      segments() { calls.push('segments'); },
      polyline() { calls.push('polyline'); },
      rect() { calls.push('rect'); },
      text() { calls.push('text'); },
      measureText() { return 0; },
    },
  };
}

// ── 1. a reading is not matter ───────────────────────────────────────────────────────────────────

test("render:'none' + a declared reading DRAWS the reading (§13.7 amended)", () => {
  const { host, tick } = steppableHost();
  const { backend, calls } = recordingBackend();
  const canvas = countingCanvas();
  const field = createField(canvas, { host, render: 'none', overlay: 'grid', overlayBackend: backend });
  try {
    tick(4);
    assert.ok(calls.includes('clear'), 'the overlay dispatch ran — the reading is drawn, not silently dropped');
    assert.ok(drewGeometry(calls), `the grid lattice actually emitted geometry (${calls.join(',')})`);
  } finally {
    field.destroy();
  }
});

test("render:'none' still never touches the MAIN canvas, reading or no reading", () => {
  const { host, tick } = steppableHost();
  const { backend } = recordingBackend();
  const canvas = countingCanvas();
  const field = createField(canvas, { host, render: 'none', overlay: 'grid', overlayBackend: backend });
  try {
    tick(4);
    // the surviving half of the #297 guarantee: matter is what 'none' withholds.
    assert.equal(canvas.getContextCalls, 0, "no 2d context is acquired for the underlay canvas");
    assert.equal(canvas.width, 0, 'the underlay backing store stays 0×0 — no pixel buffer');
    assert.equal(canvas.height, 0);
  } finally {
    field.destroy();
  }
});

test('a field that declares NO reading is unchanged — no provider call, no surface, no draw', () => {
  const { host, tick } = steppableHost();
  let providerCalls = 0;
  const canvas = countingCanvas();
  const field = createField(canvas, {
    host,
    render: 'none',
    overlayCanvasProvider: () => {
      providerCalls++;
      return countingCanvas();
    },
  });
  try {
    tick(8);
    assert.equal(providerCalls, 0, 'the default overlay:off path provisions nothing (#676)');
    assert.equal(canvas.getContextCalls, 0);
    assert.equal(canvas.width, 0);
  } finally {
    field.destroy();
  }
});

// ── 2. C-24: the provider no longer hands out a canvas nothing can draw to ───────────────────────

test('C-24: a signals-only field resolves its provider AND can draw to what it gets back', () => {
  const { host, tick } = steppableHost();
  let providerCalls = 0;
  const overlay = countingCanvas();
  const field = createField(countingCanvas(), {
    host,
    render: 'none',
    overlay: 'grid',
    overlayCanvasProvider: () => {
      providerCalls++;
      return overlay;
    },
  });
  try {
    assert.equal(providerCalls, 1, 'an initial reading resolves the surface once at boot');
    assert.ok(overlay.getContextCalls > 0, 'the overlay canvas got a context — previously it never did');
    assert.equal(overlay.width, 1000, 'and a real backing store, sized to the viewport');
    tick(4);
  } finally {
    field.destroy();
  }
});

test('C-24: a later setOverlay on a signals-only field resolves the surface too', () => {
  const { host, tick } = steppableHost();
  let providerCalls = 0;
  const overlay = countingCanvas();
  const field = createField(countingCanvas(), {
    host,
    render: 'none',
    overlayCanvasProvider: () => {
      providerCalls++;
      return overlay;
    },
  });
  try {
    assert.equal(providerCalls, 0, 'nothing before the first reading');
    field.setOverlay('grid');
    assert.equal(providerCalls, 1, 'the first non-off setOverlay resolves it, exactly as with a drawing underlay');
    assert.ok(overlay.width > 0, 'sized on resolution, not only on the next resize');
    tick(4);
    field.setOverlay('off');
    field.setOverlay('path');
    assert.equal(providerCalls, 1, 'off→on never re-provisions (the #676 pin still holds)');
  } finally {
    field.destroy();
  }
});

// ── 3. C-25: the lazy surface obeys the DPR ceilings ─────────────────────────────────────────────

test('C-25: the lazily-resolved overlay surface honours dprCap, not the raw host DPR', () => {
  const { host } = steppableHost(3); // a DPR-3 phone
  const overlay = countingCanvas();
  const field = createField(countingCanvas(), {
    host,
    render: 'dots',
    dprCap: 1.5,
    overlayCanvasProvider: () => overlay,
  });
  try {
    field.setOverlay('grid');
    assert.equal(overlay.width, Math.floor(1000 * 1.5), `capped at dprCap 1.5, not the device 3× (${overlay.width})`);
    assert.equal(overlay.height, Math.floor(800 * 1.5));
  } finally {
    field.destroy();
  }
});

test("C-25: …and the quality tier's ceiling, on a signals-only field", () => {
  const { host } = steppableHost(3);
  const overlay = countingCanvas();
  const field = createField(countingCanvas(), {
    host,
    render: 'none',
    overlayCanvasProvider: () => overlay,
  });
  try {
    field.setQualityTier(3); // tier 3 → effective DPR ceiling 1
    field.setOverlay('grid');
    assert.equal(overlay.width, 1000, `tier 3 pins the surface at 1× (${overlay.width})`);
  } finally {
    field.destroy();
  }
});

test('C-25: setDprCap re-sizes a signals-only field’s overlay surface immediately', () => {
  const { host } = steppableHost(3);
  const overlay = countingCanvas();
  const field = createField(countingCanvas(), {
    host,
    render: 'none',
    overlay: 'grid',
    dprCap: 1,
    overlayCanvasProvider: () => overlay,
  });
  try {
    assert.equal(overlay.width, 1000, 'starts at dpr 1');
    field.setDprCap(2);
    assert.equal(overlay.width, 2000, 'raised to dpr 2 now — the setter used to be gated on the underlay ctx');
  } finally {
    field.destroy();
  }
});

// ── 4. the gates the overlay still shares with the underlay ──────────────────────────────────────

test('setVisible(false) still skips the reading — relaxing the render gate did not widen that one', () => {
  const { host, tick } = steppableHost();
  const { backend, calls } = recordingBackend();
  const field = createField(countingCanvas(), { host, render: 'none', overlay: 'grid', overlayBackend: backend });
  try {
    field.setVisible(false);
    calls.length = 0;
    tick(8);
    assert.ok(!calls.includes('clear'), 'an element-invisible field draws no reading');
    field.setVisible(true);
    tick(4);
    assert.ok(calls.includes('clear'), 'and resumes when it becomes visible again');
  } finally {
    field.destroy();
  }
});

test("setOverlay('off') stops the draw on a signals-only field", () => {
  const { host, tick } = steppableHost();
  const { backend, calls } = recordingBackend();
  const field = createField(countingCanvas(), { host, render: 'none', overlay: 'grid', overlayBackend: backend });
  try {
    tick(4);
    assert.ok(drewGeometry(calls), 'drawing while the reading is on');
    field.setOverlay('off');
    calls.length = 0;
    tick(8);
    assert.ok(!drewGeometry(calls), 'an empty stack emits no geometry');
  } finally {
    field.destroy();
  }
});
