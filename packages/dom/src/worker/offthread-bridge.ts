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

  // Shared particle buffer — allocated once, grown if needed
  let buf = new Float32Array(1000 * PARTICLE_STRIDE);

  function tick() {
    raf = requestAnimationFrame(tick);
    if (pending) return; // worker still rendering previous frame

    const n = field.particleCount();
    if (n * PARTICLE_STRIDE > buf.length) buf = new Float32Array(n * PARTICLE_STRIDE * 2);
    field.readParticles(buf);

    pending = true;
    worker.postMessage({
      type: 'frame',
      particles: buf.slice(0, n * PARTICLE_STRIDE),
      count: n,
      W: canvas.width / dpr,
      H: canvas.height / dpr,
      dpr,
      frameN: frameN++,
    });
  }

  worker.addEventListener('message', () => { pending = false; });
  tick();

  return {
    supported: true,
    teardown: () => {
      if (raf != null) cancelAnimationFrame(raf);
      worker.terminate();
    },
  };
}
