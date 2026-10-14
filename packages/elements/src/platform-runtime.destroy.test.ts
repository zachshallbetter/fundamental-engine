/**
 * startPlatformRuntime teardown (engine audit 2026-10-14, H1): the loop re-armed
 * `requestAnimationFrame(loop)` after `platform.tick` ran its phase subscribers, so a subscriber
 * that destroyed the runtime mid-frame left the loop running for good — destroy() could only cancel
 * the id of the frame already executing. Driven over a manual rAF queue + minimal DOM globals.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startPlatformRuntime } from './platform-runtime.ts';

test('destroy() from inside a platform phase handler stops the runtime loop', () => {
  const g = globalThis as Record<string, unknown>;
  const saved = ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'].map((k) => [k, g[k]] as const);
  const pending = new Map<number, (t: number) => void>();
  let id = 0;
  const doc = {
    addEventListener: () => {},
    removeEventListener: () => {},
    documentElement: { style: { setProperty: () => {} } },
  };
  g.window = { innerWidth: 800, innerHeight: 600 };
  g.document = doc;
  g.requestAnimationFrame = (cb: (t: number) => void) => (pending.set(++id, cb), id);
  g.cancelAnimationFrame = (i: number) => void pending.delete(i);
  try {
    const root = {
      ownerDocument: doc,
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0 }),
      getAttribute: () => null,
      hasAttribute: () => false,
      isConnected: true,
    } as unknown as Element;
    const runtime = startPlatformRuntime(root);
    let destroyedInFrame = false;
    runtime.platform.on('write', () => {
      if (!destroyedInFrame) {
        destroyedInFrame = true;
        runtime.destroy();
      }
    });
    for (let f = 1; f <= 10; f++) {
      const cbs = [...pending.values()];
      pending.clear();
      for (const cb of cbs) cb(f * 16);
    }
    assert.equal(destroyedInFrame, true, 'the phase handler ran');
    assert.equal(pending.size, 0, 'no frame is scheduled after an in-frame destroy');
  } finally {
    for (const [k, v] of saved) g[k] = v;
  }
});
