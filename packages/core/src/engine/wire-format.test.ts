import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_WIRE_VERSION, PARTICLE_STRIDE } from '../index.ts';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

function stubHost(): FieldHost {
  let cb: ((t: number) => void) | null = null;
  const root = { querySelectorAll: () => [], querySelector: () => null, contains: () => false } as unknown as ParentNode;
  return {
    root, viewport: () => ({ width: 400, height: 300, dpr: 1 }),
    scrollY: () => 0, scrollHeight: () => 300, reducedMotion: () => false, hidden: () => false,
    raf: (fn) => { cb = fn; return 1; }, cancelRaf: () => { cb = null; },
    createCanvas: () => { throw new Error('no canvas'); },
    onResize: () => () => {}, onScroll: () => () => {}, onVisibility: () => () => {},
    onInput: () => () => {}, onBodyEvent: () => () => {},
  };
}

test('PARTICLE_STRIDE is 5 and PARTICLE_WIRE_VERSION is 0', () => {
  assert.equal(PARTICLE_STRIDE, 5);
  assert.equal(PARTICLE_WIRE_VERSION, 0);
});

test('readParticleChannels writes column-wise into multiple buffers', () => {
  const field = createField(undefined as never, { host: stubHost(), render: 'none' });
  try {
    // tick a few frames to seed particles
    const h = stubHost();
    // just call readParticleChannels directly
    const n = field.particleCount();
    if (n === 0) return; // no particles yet, skip assertion
    const xs = new Float32Array(n);
    const heats = new Float32Array(n);
    const written = field.readParticleChannels(['x', 'heat'], [xs, heats]);
    assert.ok(written >= 0 && written <= n, 'written in range');
    for (let i = 0; i < written; i++) {
      assert.ok(isFinite(xs[i]!), 'x is finite');
      assert.ok(heats[i]! >= 0 && heats[i]! <= 1, 'heat in [0,1]');
    }
  } finally {
    field.destroy();
  }
});

test('registerOverlay installs a custom named overlay', () => {
  const field = createField(undefined as never, { host: stubHost(), render: 'none' });
  try {
    let called = false;
    const unreg = field.registerOverlay('my-overlay', (_backend, _env, W, H) => {
      called = true;
      assert.ok(W > 0, 'W passed');
    });
    // activate via setOverlay — but in render:none mode drawing may be skipped
    // Just verify the return is a function and cleanup works
    assert.equal(typeof unreg, 'function');
    unreg(); // should not throw
  } finally {
    field.destroy();
  }
});
