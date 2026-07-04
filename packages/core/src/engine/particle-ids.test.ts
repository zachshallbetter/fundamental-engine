/**
 * `FieldHandle.readParticleIds(out)` — stable per-particle identity, parallel to `readParticles`.
 * Pins: every live particle has a unique non-zero id; ids are stable frame to frame (the same pool
 * particles keep their ids); and the id array lines up 1:1 with `readParticles`' stride-5 rows.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

function drivableHost(): { host: FieldHost; step: (frames: number) => void } {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null;
  let id = 0;
  let now = 0;
  const host: FieldHost = {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 600, height: 400, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 600,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (fn) => { cb = fn as (now: number) => void; return ++id; },
    cancelRaf: off,
    createCanvas: () => ({}) as unknown as HTMLCanvasElement,
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
  const step = (frames: number): void => { for (let i = 0; i < frames; i++) { now += 16; cb?.(now); } };
  return { host, step };
}

test('readParticleIds: unique, non-zero, stable across frames, and parallel to readParticles', () => {
  const { host, step } = drivableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', density: 0.4 });
  try {
    step(2); // let the pool fill
    const n = field.particleCount();
    assert.ok(n > 0, `the pool seeded particles: ${n}`);

    const ids = new Uint32Array(n);
    const wrote = field.readParticleIds(ids);
    const pos = new Float32Array(n * 5);
    const wrotePos = field.readParticles(pos);
    assert.equal(wrote, wrotePos, 'readParticleIds count lines up with readParticles');

    const set = new Set<number>();
    for (let i = 0; i < wrote; i++) {
      assert.ok(ids[i]! > 0, `id is non-zero: ${ids[i]}`);
      set.add(ids[i]!);
    }
    assert.equal(set.size, wrote, 'every id is unique');

    // identity is stable: the same particles keep their ids next frame
    step(1);
    const ids2 = new Uint32Array(field.particleCount());
    const wrote2 = field.readParticleIds(ids2);
    const set2 = new Set<number>();
    for (let i = 0; i < wrote2; i++) set2.add(ids2[i]!);
    let overlap = 0;
    for (const v of set) if (set2.has(v)) overlap++;
    assert.ok(overlap >= Math.floor(wrote * 0.9), `ids persist frame-to-frame: ${overlap}/${wrote} survived`);
  } finally {
    field.destroy();
  }
});
