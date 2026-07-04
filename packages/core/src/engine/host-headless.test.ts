import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headlessHost } from './host-headless.ts';

test('headlessHost: abstract volume + resize', () => {
  const h = headlessHost({ width: 800, height: 600 });
  assert.deepEqual(h.viewport(), { width: 800, height: 600, dpr: 1 });
  h.resize(1920, 1080);
  assert.equal(h.viewport().width, 1920);
  assert.equal(h.viewport().height, 1080);
});

test('headlessHost: the loop is manual — raf stashes, tick fires (with optional explicit timestamp)', () => {
  const h = headlessHost({ width: 100, height: 100 });
  const frames: number[] = [];
  h.raf((t) => frames.push(t));
  assert.equal(frames.length, 0, 'nothing runs until tick()');
  h.tick();
  assert.equal(frames.length, 1, 'one frame per tick');
  h.raf((t) => frames.push(t)); // the engine re-schedules inside the frame; mimic that
  h.tick(1000);
  assert.equal(frames.length, 2);
  assert.equal(frames[1], 1000, 'an explicit timestamp is honoured');
});

test('headlessHost: no DOM — empty scan root, no-op subscriptions, createCanvas throws', () => {
  const h = headlessHost({ width: 100, height: 100 });
  assert.deepEqual([...h.root.querySelectorAll('[data-body]')], [], 'no [data-body] — bodies come via addBody');
  assert.equal(h.root.querySelector('#x'), null);
  assert.equal(h.scrollY(), 0);
  assert.equal(h.reducedMotion(), false);
  assert.equal(h.hidden(), false);
  assert.equal(typeof h.onResize(() => {}), 'function', 'subscriptions return an unsubscribe');
  assert.throws(() => h.createCanvas(), /does not render/, 'signals-only — no canvas');
});
