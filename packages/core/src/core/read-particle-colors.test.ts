/**
 * `FieldHandle.readParticleColors(out)` — the carried pigment tint, parallel to readParticles.
 * Pins: uncolored matter reads white; a colored `burst` dyes nearby particles and that color reads
 * back as packed [r,g,b]; the count lines up with readParticles.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

function drivableHost(): { host: FieldHost; step: (n: number) => void } {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null; let id = 0; let now = 0;
  const host: FieldHost = {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 800, dpr: 1 }),
    scrollY: () => 0, scrollHeight: () => 1000, reducedMotion: () => false, hidden: () => false,
    raf: (fn) => { cb = fn as (now: number) => void; return ++id; }, cancelRaf: off,
    createCanvas: () => ({}) as unknown as HTMLCanvasElement,
    onResize: () => off, onScroll: () => off, onVisibility: () => off, onInput: () => off, onBodyEvent: () => off,
  };
  return { host, step: (n) => { for (let i = 0; i < n; i++) { now += 16; cb?.(now); } } };
}

test('readParticleColors: white by default, and a pigment burst dyes nearby matter red', () => {
  const { host, step } = drivableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', density: 1 });
  try {
    step(3); // fill the pool
    const n = field.particleCount();
    const colors = new Uint8Array(n * 3);

    // before any pigment: every particle is white
    const wrote = field.readParticleColors(colors);
    const ids = new Uint32Array(n);
    assert.equal(wrote, field.readParticleIds(ids), 'count lines up with readParticles/Ids');
    let allWhite = true;
    for (let i = 0; i < wrote * 3; i++) if (colors[i] !== 255) { allWhite = false; break; }
    assert.ok(allWhite, 'uncolored matter reads white');

    // dye nearby matter red and read it back
    field.burst(500, 400, '#ff0000');
    field.readParticleColors(colors);
    let reds = 0;
    for (let i = 0; i < wrote; i++) {
      if (colors[i * 3] === 255 && colors[i * 3 + 1] === 0 && colors[i * 3 + 2] === 0) reds++;
    }
    assert.ok(reds >= 1, `the burst dyed at least one particle red: ${reds}`);
  } finally {
    field.destroy();
  }
});
