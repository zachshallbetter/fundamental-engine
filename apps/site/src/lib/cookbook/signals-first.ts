// A SIGNALS-FIRST field: the full simulation, no drawing, no DOM.
//
// `render: 'none'` is the engine's default (#538): it runs the whole force pipeline and writes
// every feedback channel, but never acquires a canvas context. Paired with `headlessHost` — which
// binds the engine to nothing and hands the caller a manual `tick()` — the field becomes a pure
// signal substrate a Node service, an agent, or a test can read.
//
// This module RUNS at build time (the cookbook page imports and calls it) and under `node --test`.
import { createField, headlessHost, seededRng } from '@fundamental-engine/core';

export interface SignalsFirstResult {
  /** frames advanced by hand — no requestAnimationFrame is involved. */
  frames: number;
  /** the body's eased gathered density, the `--d` channel, after the run. */
  density: number;
  /** how many particles the pool holds (`130 × density`, rounded). */
  particles: number;
}

export function runSignalsFirst(): SignalsFirstResult {
  const host = headlessHost({ width: 1200, height: 800 });

  // The canvas argument predates the headless path: under `render: 'none'` the engine never
  // touches it (it acquires no 2D context and sizes no backing store), but the signature still
  // asks for one. The cast is the honest spelling until the type admits the headless case.
  const field = createField(undefined as unknown as HTMLCanvasElement, {
    host,
    render: 'none',
    density: 0.5,
    rng: seededRng(7), // a seeded source makes the run reproducible
  });

  // A body with no element: `rect()` is the position source, `onFeedback` the read-back.
  let density = 0;
  field.addBody({
    tokens: ['attract'],
    strength: 1,
    range: 260,
    rect: () => ({ left: 500, top: 350, width: 200, height: 100 }),
    onFeedback: (ch) => {
      density = ch.density ?? 0;
    },
  });

  const frames = 60;
  for (let i = 0; i < frames; i++) host.tick();

  const result: SignalsFirstResult = {
    frames,
    density: Number(density.toFixed(3)),
    particles: field.particleCount(),
  };
  field.destroy();
  return result;
}
