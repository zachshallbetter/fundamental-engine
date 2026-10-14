/**
 * Lifecycle regressions from the 0.11.0 engine audit (2026-10-14):
 *
 *  H1 — destroy() called from inside a frame callback (an onFeedback, a bus listener) used to leave
 *       the rAF loop running for good: frame() re-armed `host.raf(frame)` AFTER the callbacks ran,
 *       while destroy() could only cancel the id of the frame already executing. scan() after
 *       destroy also re-bound [data-hot] listeners nothing would ever release.
 *  H2 — measureBodies had no isConnected guard: a body whose element was removed without a rescan
 *       measured as an all-zero rect (cx = cy = 0, vis = true), kept exerting force from the
 *       top-left corner, and the field kept the old node referenced until the next rescan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import { measureBodies } from './scanner.ts';
import { frameHarnessField, seededRng } from './frame-harness.ts';
import type { Body } from './types.ts';
import type { FieldHost } from './host.ts';

/** A host whose rAF queue is inspectable: `pending` is how many frames are scheduled. */
function queueHost() {
  const pending = new Map<number, (t: number) => void>();
  let id = 0;
  const host = {
    root: { querySelectorAll: () => [], querySelector: () => null, contains: () => false } as unknown as ParentNode,
    viewport: () => ({ width: 800, height: 600, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 600,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (cb: (t: number) => void) => {
      pending.set(++id, cb);
      return id;
    },
    cancelRaf: (i: number) => void pending.delete(i),
    createCanvas: () => {
      throw new Error('no canvas');
    },
  } satisfies FieldHost;
  const pump = (t: number): void => {
    const cbs = [...pending.values()];
    pending.clear();
    for (const cb of cbs) cb(t);
  };
  return { host, pump, pending: () => pending.size };
}

test('H1: destroy() from inside a frame callback stops the rAF loop', () => {
  const q = queueHost();
  let destroyed = false;
  let feedbackAfter = 0;
  const field = createField(undefined as unknown as HTMLCanvasElement, { host: q.host, render: 'none' });
  field.addBody({
    tokens: ['attract'],
    rect: () => ({ left: 300, top: 200, width: 100, height: 100 }),
    onFeedback: () => {
      if (!destroyed) {
        destroyed = true;
        field.destroy();
      } else feedbackAfter++;
    },
  });
  for (let f = 1; f <= 20; f++) q.pump(f * 16.67);
  assert.equal(destroyed, true, 'the feedback callback ran and destroyed the field');
  assert.equal(q.pending(), 0, 'no frame is scheduled after an in-frame destroy');
  assert.equal(feedbackAfter, 0, 'no feedback is delivered after destroy');
});

test('H1: a frame already queued when destroy() runs does nothing and does not re-arm', () => {
  // a host whose cancelRaf cannot reach the queued callback (e.g. it was dequeued for this tick)
  const q = queueHost();
  const field = createField(undefined as unknown as HTMLCanvasElement, {
    host: { ...q.host, cancelRaf: () => {} },
    render: 'none',
  });
  field.destroy();
  q.pump(16);
  assert.equal(q.pending(), 0);
});

test('H1: destroy() is idempotent', () => {
  const q = queueHost();
  let detaches = 0;
  const field = createField(undefined as unknown as HTMLCanvasElement, {
    host: { ...q.host, detach: () => void detaches++ },
    render: 'none',
  });
  field.destroy();
  field.destroy();
  q.pump(16);
  assert.equal(q.pending(), 0);
  assert.equal(detaches, 1, 'host.detach runs once');
});

test('H1: scan() after destroy() is a no-op (no [data-hot] listeners re-bound)', () => {
  const { harness, field } = frameHarnessField({ rng: seededRng() });
  const hot = harness.add({ attrs: { 'data-body': 'attract', 'data-hot': '' }, rect: { left: 100, top: 100, width: 50, height: 50 } });
  let adds = 0;
  (hot as unknown as { addEventListener: () => void }).addEventListener = () => void adds++;
  field.destroy();
  field.scan();
  field.rescan();
  assert.equal(adds, 0, 'no listeners bound after destroy');
  assert.equal(hot.dataset.fxEngaged, undefined);
});

function detachedBody(): Body {
  const el = {
    isConnected: false,
    dataset: {},
    getAttribute: () => null,
    hasAttribute: () => false,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
  };
  return { el, tokens: ['attract'], cx: 500, cy: 400, hw: 50, hh: 50, vis: true, on: false, params: {} } as unknown as Body;
}

test('H2: measureBodies skips a detached element instead of pinning it at the origin', () => {
  const b = detachedBody();
  const found = measureBodies([b], 1280, 800);
  assert.equal(found, true, 'reports that a detached body was found');
  assert.equal(b.vis, false, 'a detached body is invisible (exerts no force)');
  assert.equal(b.cx, 500, 'last live position kept, not the all-zero rect');
  assert.equal(b.cy, 400);
});

test('H2: a body with a custom rect provider is measured even without a connected element', () => {
  const b = detachedBody();
  b.rect = () => ({ left: 100, top: 100, width: 40, height: 40 }) as DOMRect;
  const found = measureBodies([b], 1280, 800);
  assert.equal(found, false);
  assert.equal(b.vis, true);
  assert.equal(b.cx, 120);
  assert.equal(b.cy, 120);
});

test('H2: the field prunes a body whose element left the DOM without a rescan', () => {
  const { harness, field } = frameHarnessField({ rng: seededRng() });
  const el = harness.add({ attrs: { 'data-body': 'attract' }, rect: { left: 300, top: 200, width: 80, height: 80 } });
  field.addBody({ tokens: ['attract'], rect: () => ({ left: 500, top: 300, width: 40, height: 40 }) });
  field.scan();
  harness.step(6);
  assert.equal(field.query().bodies.length, 2, 'DOM body + programmatic body');
  harness.remove(el); // isConnected = false, no rescan
  harness.step(6); // one measure cadence
  const after = field.query().bodies;
  assert.equal(after.length, 1, 'the detached DOM body is pruned; the rect-provider body survives');
  field.destroy();
});
