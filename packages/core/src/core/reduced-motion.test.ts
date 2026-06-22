/**
 * Reduced-motion behavior (RC-5 / RC-8 — #322, #325): when the host reports
 * `reducedMotion() === true`, the engine freezes integration (`dt = 0`), skips the boot animation and
 * sparks, and quarter-rates draw. The observable contract: **particles do not travel**. The recipe /
 * emission layer is already pinned by `contracts/a11y.test.ts`; this pins the *engine* layer.
 *
 * Driven under `render: 'none'` with a minimal host whose `raf` captures the frame callback so we can
 * step frames by hand — no DOM, no canvas. Mirrors `read-particles.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

/** a stub host that captures the rAF callback so the test can step frames deterministically. */
function steppableHost(reducedMotion: boolean): { host: FieldHost; tick: (n: number) => void } {
  const off = (): void => {};
  let frameCb: ((t: number) => void) | null = null;
  let t = 0;
  const host: FieldHost = {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 800, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 1000,
    reducedMotion: () => reducedMotion,
    hidden: () => false,
    raf: (cb) => {
      frameCb = cb;
      return 1;
    },
    cancelRaf: off,
    createCanvas: () => ({}) as unknown as HTMLCanvasElement,
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

function snapshot(field: ReturnType<typeof createField>): Float32Array {
  const out = new Float32Array(field.particleCount() * 5);
  field.readParticles(out);
  return out;
}

function maxTravel(a: Float32Array, b: Float32Array): number {
  let m = 0;
  for (let i = 0; i < a.length; i += 5) {
    const dx = (b[i] ?? 0) - (a[i] ?? 0);
    const dy = (b[i + 1] ?? 0) - (a[i + 1] ?? 0);
    m = Math.max(m, Math.hypot(dx, dy));
  }
  return m;
}

test('reduced motion freezes particle travel (dt = 0)', () => {
  const { host, tick } = steppableHost(true);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    const before = snapshot(field);
    tick(30); // half a second of frames
    const after = snapshot(field);
    assert.equal(after.length, before.length, 'pool size is stable');
    assert.ok(maxTravel(before, after) < 1e-6, 'no particle moves under reduced motion');
  } finally {
    field.destroy();
  }
});

test('without reduced motion, particles do travel (proves the test is meaningful)', () => {
  const { host, tick } = steppableHost(false);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    const before = snapshot(field);
    tick(30);
    const after = snapshot(field);
    assert.ok(maxTravel(before, after) > 0, 'the field is animated when motion is allowed');
  } finally {
    field.destroy();
  }
});
