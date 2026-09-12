/**
 * Render-probe purity, end to end (#1155) — the public field read-out over a real `sink` body.
 *
 * THIS TEST LIVES IN ITS OWN FILE ON PURPOSE. The probe particle is MODULE-GLOBAL, and before the fix
 * its `cap` was never cleared: the first sample that landed inside any sink's `absorbR` left the probe
 * captured for the life of the process, after which `sink`'s own `if (p.cap || …) return` guard
 * short-circuited every later sample. A sibling test that touched a sink first would therefore MASK
 * this one — the bug hiding itself, which is the trap #1155 warns about. A separate file is a separate
 * process under `node --test`, so this probe starts clean.
 *
 * `FieldHandle.sample()` is the same `forceAt` probe the streamlines/overlay renderers walk (field.ts),
 * and the read-out `@fundamental-engine/three` consumes. No frame is stepped here, so the integrator
 * never runs and no real matter can be captured: any accretion the engine reports came from the probe.
 * Deterministic by construction — no clock, no rng, no frames.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

const W = 800;
const H = 600;
const GRID = 46; // field.ts's streamlines/flow grid pitch

const noopCtx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D;

function fakeCanvas(): HTMLCanvasElement {
  return {
    width: 0, height: 0, style: {} as Record<string, string>,
    getContext: () => noopCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0, toJSON: () => ({}) }),
  } as unknown as HTMLCanvasElement;
}

function virtualBody(attrs: Record<string, string>, r: { x: number; y: number; w: number; h: number }) {
  return {
    dataset: {} as Record<string, string>,
    getAttribute: (n: string) => attrs[n] ?? null,
    hasAttribute: (n: string) => n in attrs,
    dispatchEvent: () => true,
    removeAttribute: () => {},
    setAttribute: () => {},
    style: {} as Record<string, string>,
    getBoundingClientRect: () => ({
      left: r.x - r.w / 2, top: r.y - r.h / 2, right: r.x + r.w / 2, bottom: r.y + r.h / 2,
      width: r.w, height: r.h, x: r.x - r.w / 2, y: r.y - r.h / 2, toJSON: () => ({}),
    }),
  };
}

function stubHost(bodyEls: unknown[]): FieldHost {
  const off = (): void => {};
  return {
    root: {
      querySelectorAll: (sel: string) => (sel.startsWith('[data-body]') ? bodyEls : []),
      querySelector: () => null,
    } as unknown as ParentNode,
    viewport: () => ({ width: W, height: H, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => H,
    reducedMotion: () => false,
    hidden: () => false,
    raf: () => 0, // no frames are ever driven: nothing here may depend on the integrator running
    cancelRaf: off,
    createCanvas: fakeCanvas,
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
}

test('the public probe (FieldHandle.sample) reads the field without ever accreting into a real sink', () => {
  // `sink attract`: the attract leg gives the probe something to READ, so a zero reading cannot pass
  // this test vacuously; the sink leg is what used to capture the probe and bill a real body for it.
  const sinkEl = virtualBody(
    { 'data-body': 'sink attract', 'data-strength': '1.6', 'data-range': '900', 'data-absorb': '260', 'data-max': '4' },
    { x: W / 2, y: H / 2, w: 40, h: 40 },
  );
  const field = createField(fakeCanvas(), { host: stubHost([sinkEl]), render: 'streamlines', density: 1 });
  try {
    field.scan();
    const sinkReading = () => {
      const b = field.query().bodies.find((r) => r.tokens.includes('sink'));
      assert.ok(b, 'the sink body is in the field');
      return b;
    };
    assert.equal(sinkReading().metrics.load ?? 0, 0, 'the sink starts empty');

    // walk the streamlines grid five times over — the probe passes deep inside the absorb radius.
    let read = 0;
    for (let pass = 0; pass < 5; pass++) {
      for (let gx = GRID / 2; gx < W; gx += GRID) {
        for (let gy = GRID / 2; gy < H; gy += GRID) {
          const v = field.sample(gx, gy);
          if (Math.hypot(v.x, v.y) > 0) read++;
        }
      }
      const load = sinkReading().metrics.load ?? 0;
      assert.equal(load, 0, `pass ${pass}: reading the field filled a real sink (load = ${load})`);
    }
    assert.ok(read > 0, 'the probe really did read this body — the assertions above are not vacuous');
  } finally {
    field.destroy();
  }
});
