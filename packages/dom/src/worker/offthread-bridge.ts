/**
 * Creates a Worker-backed render bridge. Call attachOffthreadRender(field, canvas) to
 * transfer the canvas to the worker and drive it from field.readParticles() each frame.
 * Returns a teardown function.
 *
 * Requires OffscreenCanvas support (Chrome 69+, Firefox 105+). Falls back gracefully
 * (returns null) when not available, so callers can fall back to main-thread render.
 */
import type { FieldHandle } from '@fundamental-engine/core';

/** Particle buffer stride: [x, y, z, heat, size] per particle. */
const PARTICLE_STRIDE = 5;

export interface OffthreadBridgeResult {
  teardown: () => void;
  supported: boolean;
}

export function attachOffthreadRender(
  field: FieldHandle,
  canvas: HTMLCanvasElement,
  opts: { dpr?: number } = {}
): OffthreadBridgeResult {
  // Feature-detect OffscreenCanvas
  if (typeof OffscreenCanvas === 'undefined' || !canvas.transferControlToOffscreen) {
    return { teardown: () => {}, supported: false };
  }

  const dpr = opts.dpr ?? window.devicePixelRatio ?? 1;
  const offscreen = canvas.transferControlToOffscreen();

  const worker = new Worker(
    new URL('./render-worker.js', import.meta.url),
    { type: 'module' }
  );

  worker.postMessage({ type: 'init', canvas: offscreen }, [offscreen as unknown as Transferable]);

  let frameN = 0;
  let pending = false;
  let raf: number | null = null;

  // Double-buffered particle transfer (#991). Instead of `buf.slice(...)` allocating a fresh copy
  // every posted frame, we keep a small free-list of buffers and *transfer* ownership to the worker
  // (zero-copy). The worker posts the buffer back on 'done', where it re-enters the pool. A pool of
  // two lets frame N+1 fill one buffer while the worker still holds frame N's — but rendering is
  // gated on `pending` (one frame in flight), so at most one buffer is ever out on the worker.
  const pool: Float32Array[] = [
    new Float32Array(1000 * PARTICLE_STRIDE),
    new Float32Array(1000 * PARTICLE_STRIDE),
  ];

  function takeBuffer(minLen: number): Float32Array {
    // reuse a pooled buffer if one is large enough; else allocate (and let the small one drop).
    for (let i = 0; i < pool.length; i++) {
      if (pool[i]!.length >= minLen) return pool.splice(i, 1)[0]!;
    }
    return new Float32Array(minLen * 2);
  }

  function tick() {
    raf = requestAnimationFrame(tick);
    if (pending) return; // worker still rendering previous frame (its buffer is still out)

    const n = field.particleCount();
    const need = n * PARTICLE_STRIDE;
    const buf = takeBuffer(need);
    field.readParticles(buf);

    pending = true;
    // Transfer the underlying ArrayBuffer — zero-copy hand-off. The buffer is neutered on this side
    // until the worker returns it (below), which is safe because `pending` blocks the next fill.
    worker.postMessage(
      {
        type: 'frame',
        particles: buf,
        count: n,
        W: canvas.width / dpr,
        H: canvas.height / dpr,
        dpr,
        frameN: frameN++,
      },
      [buf.buffer]
    );
  }

  worker.addEventListener('message', (e: MessageEvent) => {
    // Reclaim the transferred buffer the worker sends back, and clear the in-flight gate.
    const returned = (e.data as { particles?: Float32Array })?.particles;
    if (returned instanceof Float32Array && pool.length < 2) pool.push(returned);
    pending = false;
  });
  tick();

  return {
    supported: true,
    teardown: () => {
      if (raf != null) cancelAnimationFrame(raf);
      worker.terminate();
    },
  };
}
