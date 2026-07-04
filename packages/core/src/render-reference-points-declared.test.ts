/**
 * Wallpaper Rule (#975) — four render reference points were a "gray debt": content-independent
 * constants painted into the draw path.
 *   1. the heat-vignette center   (W/2, H·0.4)          — `dots`/`depth` cool→warm tint
 *   2. the redshift observer      (W/2, H/2)            — `redshift` radial-velocity frame
 *   3. the depth camera focal     FOCAL = 480          — `depth` perspective recession
 *   4. the heatmap scroll fade    (1.15 - scrollY/H)/0.85 — a "content = first viewport" assumption
 *
 * The remedy is DECLARE — expose each as a documented, opt-in FieldOptions
 * (`heatCenter` / `redshiftObserver` / `depthFocal` / `heatmapFade`) whose DEFAULTS reproduce the
 * historical constants, so every render mode is byte-identical by default.
 *
 * This file both (a) satisfies the RC-6 contract-coverage guard (contract-coverage.test.ts scans
 * top-level src/*.test.ts non-recursively, so the four new option names must be referenced here) and
 * (b) PROVES the default is unchanged by capturing the exact 2D-context draw-call sequence a rendered
 * frame emits with the omitted defaults vs. the explicit historical values, asserting they match
 * byte-for-byte — then that a non-default value is observably different (the dial is real).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './engine/field.ts';
import type { FieldHost } from './engine/host.ts';
import type { FieldOptions } from './engine/types.ts';

// ── a canvas 2D context that RECORDS every draw call + property write into a string log ──────────
// Two frames whose logs match are pixel-identical; a difference in any coordinate, color, or alpha
// surfaces as a differing log line. This is the byte-identical proof for a render path.

function recordingCanvas(log?: string[]): { canvas: HTMLCanvasElement; log: string[] } {
  const out = log ?? [];
  const ctx = new Proxy(
    {},
    {
      get(_t, prop: string) {
        return (...args: unknown[]) => {
          out.push(`${prop}(${args.map((a) => (typeof a === 'number' ? a.toFixed(4) : String(a))).join(',')})`);
          return undefined;
        };
      },
      set(_t, prop: string, value: unknown) {
        out.push(`${prop}=${typeof value === 'number' ? (value as number).toFixed(4) : String(value)}`);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
  } as unknown as HTMLCanvasElement;
  return { canvas, log: out };
}

/** the heatmap offscreen buffer canvas — a functional-enough 2D context (createImageData/putImageData/
 *  createImageData return a real ImageData-like `{ data }`), width/height are real numbers. */
function bufferCanvas(): HTMLCanvasElement {
  let w = 0;
  let h = 0;
  const ctx = {
    createImageData: (cols: number, rows: number) => ({ data: new Uint8ClampedArray(cols * rows * 4), width: cols, height: rows }),
    putImageData: () => {},
  } as unknown as CanvasRenderingContext2D;
  return {
    get width() { return w; },
    set width(v: number) { w = v; },
    get height() { return h; },
    set height(v: number) { h = v; },
    style: {} as Record<string, string>,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
}

/** headless host that captures the rAF frame callback so a test can drive frames deterministically. */
function headlessHost(scrollY: number): { host: FieldHost; tick: () => void } {
  let frame: ((t: number) => void) | null = null;
  let t = 0;
  const off = (): void => {};
  const host: FieldHost = {
    root: { querySelectorAll: () => [], querySelector: () => null, contains: () => false } as unknown as ParentNode,
    viewport: () => ({ width: 800, height: 600, dpr: 1 }),
    scrollY: () => scrollY,
    scrollHeight: () => 3000,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (cb) => { frame = cb; return 1; },
    cancelRaf: () => { frame = null; },
    // the heatmap offscreen buffer needs a functional-enough 2D context (createImageData/putImageData);
    // its own draws aren't compared — only the main canvas' drawImage(hmCanvas, …) is.
    createCanvas: bufferCanvas,
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
  return { host, tick: () => { t += 1000 / 60; const cb = frame; frame = null; cb?.(t); } };
}

/** a tiny deterministic PRNG so two compared frames seed identical particles */
function seeded(s: number): () => number {
  let x = s >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 0x100000000;
  };
}

/** Render N frames in `mode` with `opts` and return the full recorded draw-call log. */
function runLog(mode: FieldOptions['render'], opts: FieldOptions, scrollY = 0, frames = 12): string[] {
  const log: string[] = [];
  const { host, tick } = headlessHost(scrollY);
  const { canvas } = recordingCanvas(log);
  const field = createField(canvas, { host, render: mode, rng: seeded(1234), now: () => 0, ...opts });
  try {
    for (let i = 0; i < frames; i++) tick();
  } finally {
    field.destroy();
  }
  return log;
}

// ── the historical constants the declared defaults must reproduce ────────────────────────────────

const HISTORICAL_HEAT_CENTER = { x: 0.5, y: 0.4 }; // was (W/2, H·0.4)
const HISTORICAL_OBSERVER = { x: 0.5, y: 0.5 }; // was (W/2, H/2)
const HISTORICAL_FOCAL = 480; // was FOCAL = 480
const HISTORICAL_FADE = { start: 0.3, span: 0.85 }; // was (1.15 - scrollY/H)/0.85

// ── byte-identical proof: omitted defaults == explicit historical values, per render mode ────────

for (const mode of ['dots', 'redshift', 'blackbody', 'depth'] as const) {
  test(`render '${mode}' is byte-identical: omitted reference points == explicit historical values`, () => {
    const viaDefault = runLog(mode, { depth: 200 });
    const viaExplicit = runLog(mode, {
      depth: 200,
      heatCenter: HISTORICAL_HEAT_CENTER,
      redshiftObserver: HISTORICAL_OBSERVER,
      depthFocal: HISTORICAL_FOCAL,
    });
    assert.ok(viaDefault.length > 0, `'${mode}' emitted draw calls`);
    assert.deepEqual(viaDefault, viaExplicit, `'${mode}' default frames reproduce the historical constants exactly`);
  });
}

test('heatmap glow is byte-identical: omitted heatmapFade == explicit historical curve', () => {
  const viaDefault = runLog('dots', { heatmap: true }, 300);
  const viaExplicit = runLog('dots', { heatmap: true, heatmapFade: HISTORICAL_FADE }, 300);
  assert.deepEqual(viaDefault, viaExplicit, 'the default heatmap scroll fade reproduces (1.15 - scrollY/H)/0.85 exactly');
});

// ── the dials are real: a non-default value is observably different ───────────────────────────────

test('heatCenter moves the dots vignette (the dial is real)', () => {
  assert.notDeepEqual(runLog('dots', {}), runLog('dots', { heatCenter: { x: 0.9, y: 0.9 } }));
});

test('redshiftObserver moves the redshift frame (the dial is real)', () => {
  assert.notDeepEqual(runLog('redshift', {}), runLog('redshift', { redshiftObserver: { x: 0.1, y: 0.1 } }));
});

test('depthFocal changes the depth projection (the dial is real)', () => {
  assert.notDeepEqual(runLog('depth', { depth: 200 }), runLog('depth', { depth: 200, depthFocal: 120 }));
});

test('heatmapFade with a large span keeps the glow where the default has faded (the dial is real)', () => {
  // scrolled past the historical window (~1200px ≈ 2 viewports) → the default fade is 0 (layer skipped);
  // a large span keeps it drawing, so the two frames must differ.
  assert.notDeepEqual(
    runLog('dots', { heatmap: true }, 1200),
    runLog('dots', { heatmap: true, heatmapFade: { start: 0.3, span: 100 } }, 1200),
  );
});

// ── wiring acceptance: createField accepts the declared options (names them for the RC-6 guard) ──

test('createField accepts heatCenter / redshiftObserver / depthFocal / heatmapFade (declared opts)', () => {
  for (const opts of [
    { heatCenter: { x: 0.5, y: 0.4 }, redshiftObserver: { x: 0.5, y: 0.5 }, depthFocal: 480, heatmapFade: { start: 0.3, span: 0.85 } },
    { heatCenter: { x: 0, y: 1 }, redshiftObserver: { x: 1, y: 0 }, depthFocal: 900, heatmapFade: { start: 0, span: 2 } },
    { depthFocal: -5, heatmapFade: { start: 0.3, span: -1 } }, // invalid → fall back to historical defaults
    {}, // omitted → historical defaults
  ] satisfies FieldOptions[]) {
    const { host } = headlessHost(0);
    const { canvas } = recordingCanvas();
    const field = createField(canvas, { host, render: 'none', ...opts });
    try {
      assert.ok(field, `field initialises with ${JSON.stringify(opts)}`);
    } finally {
      field.destroy();
    }
  }
});
