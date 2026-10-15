/**
 * Unchanged-overlay skipping. The overlay readings are pure functions of field state, yet every frame
 * cleared and re-stroked the whole full-viewport overlay surface — at dpr 2 a ~3200×1600 raster pass
 * per frame for no visible change, enough to drop the hardware perf gate's `overlay=grid dprCap=2` row
 * from 60 to 30 fps on the runner. A frame whose draw calls equal the previous frame's now draws
 * nothing; anything that changes the picture, or could have wiped the surface, still redraws.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';
import type { RenderBackend } from './render-backend.ts';

const noopCtx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D;

function canvasWith(ctx: CanvasRenderingContext2D): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0 }),
  } as unknown as HTMLCanvasElement;
}

/** a 2d context that counts clears and strokes (everything else is a no-op). */
function countingCtx(): { ctx: CanvasRenderingContext2D; counts: { clears: number; strokes: number }; lost: { on: boolean } } {
  const counts = { clears: 0, strokes: 0 };
  const lost = { on: false };
  const ctx = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (k === 'clearRect') return () => void counts.clears++;
        if (k === 'stroke') return () => void counts.strokes++;
        if (k === 'isContextLost') return () => lost.on;
        if (k === 'measureText') return () => ({ width: 10 });
        return () => {};
      },
      set: () => true, // strokeStyle / lineWidth / lineCap assignments
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, counts, lost };
}

function rafHost(): { host: FieldHost; frames: (n: number) => void } {
  const pending = new Map<number, (t: number) => void>();
  let id = 0;
  let t = 0;
  const off = (): void => {};
  const host: FieldHost = {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 800, height: 600, dpr: 2 }),
    scrollY: () => 0,
    scrollHeight: () => 800,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (cb) => (pending.set(++id, cb), id),
    cancelRaf: (i) => void pending.delete(i),
    createCanvas: () => canvasWith(noopCtx),
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
  const frames = (n: number): void => {
    for (let i = 0; i < n; i++) {
      const cbs = [...pending.values()];
      pending.clear();
      t += 16.7;
      for (const cb of cbs) cb(t);
    }
  };
  return { host, frames };
}

function gridField() {
  const { host, frames } = rafHost();
  const overlay = countingCtx();
  const overlayCanvas = canvasWith(overlay.ctx);
  const field = createField(canvasWith(noopCtx), { host, render: 'dots', overlay: 'grid', overlayCanvas });
  // one static body so the grid has real curvature (a pure function of it)
  field.addBody({ tokens: ['attract'], strength: 1.2, range: 300, rect: () => ({ left: 360, top: 260, width: 80, height: 80 }) });
  return { field, frames, overlay, overlayCanvas };
}

test('a static overlay is drawn once, then skipped while nothing changes', () => {
  const { field, frames, overlay } = gridField();
  try {
    frames(3); // boot + the first frame with the body measured
    const base = { ...overlay.counts };
    assert.ok(base.strokes > 0, 'the grid was drawn');
    frames(30);
    assert.equal(overlay.counts.clears, base.clears, 'no clear while the grid is unchanged');
    assert.equal(overlay.counts.strokes, base.strokes, 'no re-stroke while the grid is unchanged');
  } finally {
    field.destroy();
  }
});

test('a change to the picture redraws (accent), then skipping resumes', () => {
  const { field, frames, overlay } = gridField();
  try {
    frames(3);
    const before = { ...overlay.counts };
    field.setAccent('#ff0000'); // snaps, then eases back to the scroll-driven journey colour
    frames(10);
    assert.ok(overlay.counts.clears > before.clears, 'the accent change redrew the overlay');
    frames(1200); // the eased accent converges to a fixed point (exponential ease, ~20 s of frames)
    const settled = { ...overlay.counts };
    frames(20);
    assert.equal(overlay.counts.clears, settled.clears, 'once the accent has settled, frames are skipped again');
  } finally {
    field.destroy();
  }
});

test('a surface resized or context lost under the engine is redrawn, not trusted', () => {
  const { field, frames, overlay, overlayCanvas } = gridField();
  try {
    frames(3);
    const a = overlay.counts.clears;
    (overlayCanvas as { width: number }).width = 1234; // another writer reset the backing store
    frames(1);
    assert.equal(overlay.counts.clears, a + 1, 'a resized surface is redrawn');
    frames(5);
    const b = overlay.counts.clears;
    assert.equal(b, a + 1, 'then skipped again');
    overlay.lost.on = true;
    frames(1);
    overlay.lost.on = false;
    frames(1);
    assert.ok(overlay.counts.clears > b, 'a lost-and-restored context is redrawn');
  } finally {
    field.destroy();
  }
});

test('an injected backend and a custom overlay still draw every frame', () => {
  {
    const { host, frames } = rafHost();
    let clears = 0;
    const backend: RenderBackend = {
      size() {},
      clear() { clears++; },
      segments() {},
      polyline() {},
      rect() {},
      text() {},
      measureText: () => 0,
    };
    const field = createField(canvasWith(noopCtx), { host, render: 'dots', overlay: 'grid', overlayCanvas: canvasWith(noopCtx), overlayBackend: backend });
    try {
      frames(3);
      const c = clears;
      frames(10);
      assert.equal(clears, c + 10, 'an injected backend (e.g. three, which finalizes on clear) is cleared every frame');
    } finally {
      field.destroy();
    }
  }
  {
    const { field, frames, overlay } = gridField();
    try {
      let calls = 0;
      field.registerOverlay('grid', () => void calls++);
      frames(3);
      const c = overlay.counts.clears;
      frames(10);
      assert.equal(overlay.counts.clears, c + 10, 'a stack with a custom overlay draws every frame');
      assert.ok(calls >= 10, 'and the custom overlay runs every frame');
    } finally {
      field.destroy();
    }
  }
});
