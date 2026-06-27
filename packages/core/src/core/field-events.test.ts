/**
 * `FieldHandle.on(type, cb)` — the host-agnostic discrete event bus. Pins: a `sink` body emits
 * `absorb` (with a positive count) as it captures matter and `release` on its falling edge; `on`
 * returns a working unsubscribe. Driven through a frame-capturing host so per-frame detection runs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

function virtualBody(attrs: Record<string, string>, r: { x: number; y: number; w: number; h: number }) {
  return {
    dataset: {} as Record<string, string>,
    getAttribute: (n: string) => attrs[n] ?? null,
    hasAttribute: (n: string) => n in attrs,
    dispatchEvent: () => true, // the sink's DOM capture event is a no-op here; we assert the bus
    removeAttribute: () => {},
    setAttribute: () => {},
    style: {} as Record<string, string>,
    getBoundingClientRect: () => ({
      left: r.x - r.w / 2, top: r.y - r.h / 2, right: r.x + r.w / 2, bottom: r.y + r.h / 2,
      width: r.w, height: r.h, x: r.x - r.w / 2, y: r.y - r.h / 2, toJSON: () => ({}),
    }),
  };
}

function drivableHost(bodyEls: unknown[]): { host: FieldHost; step: (frames: number) => void } {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null;
  let id = 0;
  let now = 0;
  const host: FieldHost = {
    root: {
      querySelectorAll: (sel: string) => (sel.startsWith('[data-body]') ? bodyEls : []),
      querySelector: () => null,
    } as unknown as ParentNode,
    viewport: () => ({ width: 1000, height: 800, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 1000,
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
  const step = (frames: number): void => {
    for (let i = 0; i < frames; i++) { now += 16; cb?.(now); }
  };
  return { host, step };
}

test('a sink emits absorb with a positive count, and on() returns a working unsubscribe', () => {
  const sink = virtualBody(
    { 'data-body': 'sink attract', 'data-strength': '1.6', 'data-range': '900', 'data-absorb': '120' },
    { x: 500, y: 400, w: 40, h: 40 },
  );
  const { host, step } = drivableHost([sink]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    let absorbs = 0;
    let lastCount = 0;
    const off = field.on('absorb', (e) => { absorbs++; lastCount = e.count; });
    field.scan();
    step(400); // pull matter in + capture it
    assert.ok(absorbs >= 1, `absorb fired as the sink captured matter: ${absorbs}`);
    assert.ok(lastCount > 0, `absorb carried a positive count: ${lastCount}`);

    off(); // unsubscribe
    const before = absorbs;
    step(400);
    assert.equal(absorbs, before, 'no more absorb events after unsubscribe');
  } finally {
    field.destroy();
  }
});

test('release fires when a saturated sink lets go (count carried from the captured peak)', () => {
  // a small-capacity sink saturates and supernovas, releasing what it held — the falling edge.
  const sink = virtualBody(
    { 'data-body': 'sink attract', 'data-strength': '1.8', 'data-range': '900', 'data-absorb': '140', 'data-max': '8' },
    { x: 500, y: 400, w: 40, h: 40 },
  );
  const { host, step } = drivableHost([sink]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    let releases = 0;
    field.on('release', () => { releases++; });
    field.scan();
    step(900); // capture to saturation → supernova → release
    assert.ok(releases >= 1, `release fired on the sink's falling edge: ${releases}`);
  } finally {
    field.destroy();
  }
});

test('bus events coalesce per frame: a saturating sink delivers one release per frame, never per pass (#684)', () => {
  // A small-capacity sink fills, saturates and supernovas repeatedly. The capture/release machinery
  // can raise `release` from more than one path within a single tick (supernova's falling edge +
  // updateCaptureEvents); the per-frame coalescing layer guarantees the bus delivers at most ONE
  // release per (body, type) per frame. Stepping ONE frame at a time lets us assert exactly that.
  const sink = virtualBody(
    { 'data-body': 'sink attract', 'data-strength': '1.8', 'data-range': '900', 'data-absorb': '140', 'data-max': '4' },
    { x: 500, y: 400, w: 40, h: 40 },
  );
  const { host, step } = drivableHost([sink]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    let perFrame = 0;
    let maxPerFrame = 0;
    let totalReleases = 0;
    field.on('release', () => { perFrame++; });
    field.scan();
    for (let i = 0; i < 900; i++) {
      perFrame = 0;
      step(1); // exactly one frame
      maxPerFrame = Math.max(maxPerFrame, perFrame);
      totalReleases += perFrame;
    }
    assert.ok(totalReleases >= 1, `release fired at least once over the run: ${totalReleases}`);
    assert.equal(maxPerFrame, 1, `at most one release delivered in any single frame: saw ${maxPerFrame}`);
  } finally {
    field.destroy();
  }
});

test('#684: a relational edge delivers once per frame and a standing relationship is not re-delivered', () => {
  // Exercise the coalescing flush on the proximity path: when a body crosses into range, exactly one
  // `enter` is delivered for that (source, other) on the crossing frame; while the relationship
  // stands across later frames it is NOT re-delivered each frame (membership is sticky), and the
  // per-frame flush adds no duplicates on top.
  const aPos = { x: 300, y: 400, w: 40, h: 40 };
  const bPos = { x: 950, y: 400, w: 40, h: 40 }; // far outside A's range to start
  const a = virtualBody({ 'data-body': 'attract', 'data-strength': '1', 'data-range': '240' }, aPos);
  const b = virtualBody({ 'data-body': 'attract', 'data-strength': '1', 'data-range': '240' }, bPos);
  const { host, step } = drivableHost([a, b]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    let enters = 0;
    field.on('enter', () => { enters++; });
    field.scan();
    step(12); // apart → no enter
    assert.equal(enters, 0, 'no enter while the bodies are apart');

    bPos.x = 360; // within A's 240 range (≈60px)
    enters = 0;
    step(6);
    assert.ok(enters >= 1, `enter delivered on the crossing frame: ${enters}`);

    // Hold the bodies inside range across many frames: detection re-runs every measure cadence, but
    // membership is sticky and the per-frame flush must not re-deliver the standing relationship.
    const settled = enters;
    step(60);
    assert.equal(enters, settled, 'a standing in-range relationship is not re-delivered each frame');
  } finally {
    field.destroy();
  }
});

test('enter/exit fire as a body crosses another body’s range; met fires on box contact (#441)', () => {
  const aPos = { x: 500, y: 400, w: 40, h: 40 };
  const bPos = { x: 950, y: 400, w: 40, h: 40 }; // starts far outside A's range
  const a = virtualBody({ 'data-body': 'attract', 'data-strength': '1', 'data-range': '240' }, aPos);
  const b = virtualBody({ 'data-body': 'attract', 'data-strength': '1', 'data-range': '240' }, bPos);
  const { host, step } = drivableHost([a, b]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    let enters = 0, exits = 0, mets = 0;
    field.on('enter', () => { enters++; });
    field.on('exit', () => { exits++; });
    field.on('met', () => { mets++; });
    field.scan();
    step(12); // at rest, ~450px apart → no proximity events
    assert.equal(enters, 0, 'no enter while the bodies are apart');

    bPos.x = 560; // within A's 240 range (≈60px), boxes still apart (60 > 40)
    step(12);
    assert.ok(enters >= 1, 'enter fired as B crossed into range');
    assert.equal(mets, 0, 'not met yet — boxes are still apart');

    bPos.x = 525; // boxes now touch (25 < hw+hw = 40)
    step(12);
    assert.ok(mets >= 1, 'met fired on box contact');

    bPos.x = 950; // back outside the range
    step(12);
    assert.ok(exits >= 1, 'exit fired as B left the range');
  } finally {
    field.destroy();
  }
});
