/**
 * `FieldHandle.readParticles(out)` — the render-agnostic swarm read-out. A renderer with no 2D
 * context (the `@field-ui/three` particle bridge) copies live particle state into its own typed
 * buffer each frame; this pins the contract: stride 4 `[x, y, heat, size]`, return = count written
 * = `min(particleCount(), floor(out.length / 4))`, zero mutation of the pool. Driven under
 * `render: 'none'` with a minimal host stub so the test needs no DOM or canvas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

/** The smallest host the engine will run on: a viewport + inert event seams, no DOM. */
function stubHost(): FieldHost {
  const off = (): void => {};
  return {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 800, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 1000,
    reducedMotion: () => false,
    hidden: () => false,
    raf: () => 0, // never auto-loops; resize() seeds the pool synchronously at construction
    cancelRaf: off,
    createCanvas: () => ({}) as unknown as HTMLCanvasElement,
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
}

test('readParticles fills [x,y,heat,size] for the whole live pool', () => {
  const field = createField({} as HTMLCanvasElement, { host: stubHost(), render: 'none' });
  try {
    const n = field.particleCount();
    assert.ok(n > 0, 'the default density seeds a non-empty pool');

    const out = new Float32Array(n * 4);
    const written = field.readParticles(out);
    assert.equal(written, n, 'returns the full count when the buffer fits');

    for (let i = 0; i < written; i++) {
      const [x, y, heat, size] = [out[i * 4]!, out[i * 4 + 1]!, out[i * 4 + 2]!, out[i * 4 + 3]!];
      assert.ok(Number.isFinite(x) && Number.isFinite(y), `particle ${i} has finite position`);
      assert.ok(heat >= 0 && heat <= 1, `particle ${i} heat in [0,1]`);
      assert.ok(size > 0, `particle ${i} has a positive size`);
    }
    // pool unchanged by the read
    assert.equal(field.particleCount(), n, 'readParticles does not mutate the pool');
  } finally {
    field.destroy();
  }
});

test('readParticles truncates to the buffer capacity and never overflows', () => {
  const field = createField({} as HTMLCanvasElement, { host: stubHost(), render: 'none' });
  try {
    const n = field.particleCount();
    assert.ok(n >= 2, 'need at least two particles to test truncation');

    // capacity for 2 particles only, plus a sentinel lane the call must not touch
    const out = new Float32Array(2 * 4 + 1);
    out[8] = 123.5; // sentinel just past the 2-particle region
    const written = field.readParticles(out);
    assert.equal(written, 2, 'writes only as many particles as the buffer holds (floor(len/4))');
    assert.equal(out[8], 123.5, 'does not write past floor(out.length / 4) particles');

    // an over-sized buffer still returns exactly the pool count
    const big = new Float32Array((n + 16) * 4);
    assert.equal(field.readParticles(big), n, 'over-sized buffer returns the live count');
  } finally {
    field.destroy();
  }
});
