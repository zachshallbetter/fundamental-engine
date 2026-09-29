/**
 * The lazy overlay surface's two carried defects (Field Surfaces program, §6.1 C-24 + C-25) — the
 * ones that had to be fixed before any contained placement could be built on this path, because a
 * per-card field multiplies both.
 *
 * Neither was caught by the existing #676 pins in `option-seams.test.ts`: those assert WHEN the
 * provider is called against an overlay that is off or on, and both defects live on the axis the
 * pins do not vary — whether the field can draw at all, and at what DPR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';
import type { RenderBackend } from './render-backend.ts';

const noopCtx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D;

function fakeCanvas(opts: { context?: boolean } = {}): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    getContext: () => ((opts.context ?? true) ? noopCtx : null),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
  } as unknown as HTMLCanvasElement;
}

function fakeHost(dpr = 1): FieldHost {
  const off = (): void => {};
  return {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 800, height: 600, dpr }),
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

function recordingBackend(sizes: Array<[number, number, number]>): RenderBackend {
  return {
    size(w, h, dpr) { sizes.push([w, h, dpr]); },
    clear() {}, segments() {}, polyline() {}, rect() {}, text() {}, measureText() { return 0; },
  };
}

// ── C-24: no canvas for a surface that can never be painted ─────────────────────────────────────

test('C-24: a signals-only field never asks the provider for a canvas it could not draw to', () => {
  // The frame gate is `ctx && cfg.render !== 'none' && …`. A `render: 'none'` field has no context,
  // so a reading turned on there can never be painted — and on `<field-root>` the provider builds a
  // full-viewport `mix-blend-mode` layer, which would join the compositing tree to show nothing.
  let built = 0;
  const field = createField(fakeCanvas(), {
    host: fakeHost(),
    render: 'none',
    overlay: 'streamlines', // a reading IS requested, at boot
    overlayCanvasProvider: () => { built++; return fakeCanvas(); },
  });
  try {
    assert.equal(built, 0, 'no canvas is built for a field that cannot draw');
    field.setOverlay(['grid', 'force-vectors']); // and still not on a later request
    assert.equal(built, 0, 'still none — the field is still signals-only');
  } finally {
    field.destroy();
  }
});

test('C-24: leaving render "none" brings the surface up — the deferral is not a loss', () => {
  // This is what makes the fix a deferral rather than a behaviour removal: `setRender` acquires the
  // context and calls straight back into the surface path, so the reading the caller asked for at
  // boot appears the moment the field can actually draw it.
  let built = 0;
  const field = createField(fakeCanvas(), {
    host: fakeHost(),
    render: 'none',
    overlay: 'streamlines',
    overlayCanvasProvider: () => { built++; return fakeCanvas(); },
  });
  try {
    assert.equal(built, 0);
    field.setRender('dots');
    assert.equal(built, 1, 'the surface is built exactly once, on the frame the field gains a context');
    field.setOverlay('grid');
    assert.equal(built, 1, 'and reused after that — still idempotent (#676)');
  } finally {
    field.destroy();
  }
});

test('C-24 boundary: a DRAWING field with no context throws — the no-ctx path is only `render: "none"`', () => {
  // Worth pinning because it bounds the fix. `createField` refuses a drawing mode it cannot honour
  // rather than degrading to signals-only, so the only way to reach `ensureOverlaySurface` without a
  // context is the deliberate signals-only field above — not a broken canvas.
  assert.throws(
    () => createField(fakeCanvas({ context: false }), { host: fakeHost(), render: 'dots' }),
    /context unavailable/i,
  );
});

// ── C-25: one DPR ceiling, not two ──────────────────────────────────────────────────────────────
//
// Reaching this defect takes a narrower setup than the program's write-up implies, and two earlier
// drafts of these tests were vacuous before that was pinned down:
//
//   · an INJECTED `overlayBackend` is bound at construction, so `ensureOverlaySurface` returns at
//     its first line and the lazy sizing never runs at all;
//   · an EAGER `overlayCanvas` on a field that leaves `render: 'none'` is sized twice — the lazy
//     path first, then `sizeSurfaces` immediately after inside the same `setRender` call, which
//     overwrites the raw DPR with the capped one. So that path self-corrects.
//
// The live path is a field that ALREADY draws, given a lazy provider, when a reading is switched on:
// `setOverlay` resolves and sizes the surface and nothing follows it. Measured on the unfixed
// engine, an 800px viewport at host DPR 3 with `dprCap: 2` produced a 2400px backing store where
// the underlay had 1600 — and it stayed that way until the next resize.

/** Backing-store DPR the lazy path actually used, recovered from the real backend's own write. */
const backingDpr = (c: HTMLCanvasElement): number => (c as unknown as { width: number }).width / 800;

test('C-25: switching a reading on sizes the lazy surface at dprCap, not the raw host DPR', () => {
  const overlay = fakeCanvas();
  const field = createField(fakeCanvas(), {
    host: fakeHost(3),
    render: 'dots', // already drawing: nothing re-sizes after setOverlay
    dprCap: 2,
    overlayCanvasProvider: () => overlay,
  });
  try {
    field.setOverlay('grid');
    assert.equal(backingDpr(overlay), 2, `sized at dprCap 2, not the host's 3 (got ${backingDpr(overlay)})`);
  } finally {
    field.destroy();
  }
});

test('C-25: and at the quality tier ceiling, which can bind tighter than dprCap', () => {
  const overlay = fakeCanvas();
  const field = createField(fakeCanvas(), {
    host: fakeHost(3),
    render: 'dots',
    dprCap: 3, // deliberately NOT the binding constraint — the tier is
    overlayCanvasProvider: () => overlay,
  });
  try {
    field.setQualityTier(3); // TIER_DPR[3] === 1
    field.setOverlay('grid');
    assert.equal(backingDpr(overlay), 1, `the tier binds even when dprCap does not (got ${backingDpr(overlay)})`);
  } finally {
    field.destroy();
  }
});

test('C-25: the underlay and the overlay agree on the DPR, which is the property that matters', () => {
  // The two surfaces share a coordinate space, so they must agree about how many device pixels a CSS
  // pixel is worth. Two ceilings applied in one place and not the other is how they silently drift.
  const under = fakeCanvas();
  const overlay = fakeCanvas();
  const field = createField(under, {
    host: fakeHost(3),
    render: 'dots',
    dprCap: 2,
    overlayCanvasProvider: () => overlay,
  });
  try {
    field.setOverlay('grid');
    assert.equal(backingDpr(overlay), backingDpr(under), 'overlay DPR matches the underlay\'s');
  } finally {
    field.destroy();
  }
});

test('C-25: the resize path was already correct — the fix does not move it', () => {
  // `sizeSurfaces` has always applied both ceilings, and that is exactly why the defect was
  // survivable: any resize healed it. Pinned so a later change cannot regress the half that worked.
  const under = fakeCanvas();
  const overlay = fakeCanvas();
  const field = createField(under, { host: fakeHost(3), render: 'dots', dprCap: 2, overlayCanvas: overlay });
  try {
    field.setOverlay('grid');
    assert.equal(backingDpr(overlay), 2);
    assert.equal(backingDpr(under), 2);
  } finally {
    field.destroy();
  }
});
