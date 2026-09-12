/**
 * Body measurement cadence (#689). Pins three things about how the engine refreshes body geometry:
 *
 * 1. THE DEFAULT PATH IS UNCHANGED. `measure` unset, `measure: 'poll'`, and `measure: 'observe'` on a
 *    host WITHOUT `observeBodies` all produce the same per-frame fingerprint (readParticles + every
 *    body's centre/box/visibility + a sampled force) over a seeded run with mutating rect providers
 *    and a scrolling host — byte for byte.
 * 2. THE SCROLL COMPENSATION (#508/#509) HOLDS IN BOTH MODES. Between re-measures each body's cached
 *    centre follows the page scroll (`b.cy -= dScroll`), so a fixed-point force sample changes every
 *    frame through a scroll (no 6-frame plateaus) — and a CONTAINED host (#540) is never shifted.
 * 3. OBSERVE MODE SEMANTICS. A dirty-marked body is re-read on the next frame; a clean body keeps its
 *    compensated centre through the 6-frame cadence (no rect read); the 30-frame fallback re-reads
 *    everything; a custom-rect (programmatic) body stays on the poll cadence; rescan re-subscribes and
 *    destroy disconnects; the non-layout state on the cadence (engagement, reactive params) still
 *    refreshes for a clean body.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';
import type { FieldOptions } from './types.ts';

interface Box { x: number; y: number; w: number; h: number }

function virtualBody(id: string, attrs: Record<string, string>, box: Box, scroll: { y: number }) {
  let reads = 0;
  const el = {
    id,
    box,
    get reads() { return reads; },
    dataset: {} as Record<string, string>,
    getAttribute: (n: string) => attrs[n] ?? null,
    hasAttribute: (n: string) => n in attrs,
    dispatchEvent: () => true,
    removeAttribute: () => {},
    setAttribute: (n: string, v: string) => { attrs[n] = v; },
    style: { setProperty: () => {}, removeProperty: () => {} } as unknown as CSSStyleDeclaration,
    // like the real getBoundingClientRect: VIEWPORT space — the document-space box minus the page scroll
    getBoundingClientRect: () => {
      reads++;
      const left = box.x - box.w / 2;
      const top = box.y - box.h / 2 - scroll.y;
      return { left, top, right: left + box.w, bottom: top + box.h, width: box.w, height: box.h, x: left, y: top, toJSON: () => ({}) };
    },
  };
  return el;
}
type VBody = ReturnType<typeof virtualBody>;

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

interface Harness {
  host: FieldHost;
  step: (frames: number) => void;
  scroll: { y: number };
  /** the last observer subscription the engine made (observe hosts only). */
  observed: { els: Element[]; markDirty: (el: Element) => void; disconnected: boolean } | null;
  subscriptions: number;
}

function harness(bodyEls: VBody[], opts: { observe?: boolean; contained?: boolean } = {}, scroll: { y: number } = { y: 0 }): Harness {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null;
  let now = 0;
  const h: Harness = { host: null as unknown as FieldHost, step: () => {}, scroll, observed: null, subscriptions: 0 };
  h.host = {
    root: { querySelectorAll: (sel: string) => (sel.startsWith('[data-body]') ? bodyEls : []), querySelector: () => null } as unknown as ParentNode,
    viewport: () => (opts.contained ? { width: 1000, height: 800, dpr: 1, originX: 40, originY: 60 } : { width: 1000, height: 800, dpr: 1 }),
    scrollY: () => h.scroll.y,
    scrollHeight: () => 4000,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (fn) => { cb = fn as (now: number) => void; return 1; },
    cancelRaf: off,
    onResize: () => off, onScroll: () => off, onVisibility: () => off, onInput: () => off, onBodyEvent: () => off,
  };
  if (opts.observe) {
    h.host.observeBodies = (els, markDirty) => {
      h.subscriptions++;
      const sub = { els: [...els], markDirty, disconnected: false };
      h.observed = sub;
      return () => { sub.disconnected = true; };
    };
  }
  h.step = (frames) => { for (let i = 0; i < frames; i++) { now += 1000 / 60; const t = cb; cb = null; t?.(now); } };
  return h;
}

const makeBodies = (scroll: { y: number }): VBody[] => [
  virtualBody('a', { 'data-body': 'attract', 'data-strength': '2', 'data-range': '400' }, { x: 300, y: 300, w: 60, h: 60 }, scroll),
  virtualBody('b', { 'data-body': 'repel', 'data-strength': '1.5', 'data-range': '300' }, { x: 700, y: 500, w: 40, h: 40 }, scroll),
  virtualBody('c', { 'data-body': 'swirl', 'data-strength': '1', 'data-range': '350', 'data-spin': '1.2' }, { x: 500, y: 200, w: 80, h: 30 }, scroll),
];

type Field = ReturnType<typeof createField>;
const rectOf = (field: Field, id: string) => field.query().bodies.find((b) => b.id === id)!.rect!;

/** The per-frame fingerprint of a seeded run: matter + every body's box + a sampled force. */
function fingerprint(measure: FieldOptions['measure'], observeHost: boolean, frames = 120): string {
  const scroll = { y: 0 };
  const els = makeBodies(scroll);
  const h = harness(els, { observe: observeHost }, scroll);
  const field = createField({} as HTMLCanvasElement, { host: h.host, render: 'none', rng: seeded(1234), now: () => 0, measure });
  const buf = new Float32Array(5 * 4000);
  const lines: string[] = [];
  try {
    for (let f = 1; f <= frames; f++) {
      h.scroll.y += f % 3 === 0 ? 4 : 1; // uneven page scroll
      if (f % 7 === 0) { els[0]!.box.x += 3; els[1]!.box.y -= 2; els[2]!.box.w += 1; } // document-space drift
      h.step(1);
      const n = field.readParticles(buf);
      let acc = '';
      for (let i = 0; i < n * 5; i++) acc += buf[i]!.toFixed(4) + ',';
      const bodies = field.query().bodies.map((b) => `${b.id}:${[b.rect!.x, b.rect!.y, b.rect!.width, b.rect!.height].map((v) => v.toFixed(3)).join('/')}`).join(' ');
      const s = field.sample(500, 400);
      lines.push(`f${f} n=${n} s=${s.x.toFixed(6)},${s.y.toFixed(6)} ${bodies} ${acc.length}:${hash(acc)}`);
    }
  } finally {
    field.destroy();
  }
  return lines.join('\n');
}
function hash(s: string): string { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }

// ── 1. the default path ─────────────────────────────────────────────────────────────────────

test('default-path pin: measure unset ≡ measure:"poll" ≡ measure:"observe" on a host without observeBodies (#689)', () => {
  const base = fingerprint(undefined, false);
  assert.ok(base.split('\n').length === 120 && base.includes('n='), 'the run produced a fingerprint');
  assert.equal(fingerprint('poll', false), base, "measure:'poll' is the unset path byte for byte");
  assert.equal(fingerprint('observe', false), base, "measure:'observe' degrades to the poll path when the host has no observeBodies");
  // and the seed is genuinely consulted (the fingerprint is not a constant)
  assert.equal(fingerprint(undefined, false), base, 'the run is reproducible');
});

test('the poll cadence reads every body rect exactly on frames ≡ 0 (mod 6) (#689 default unchanged)', () => {
  const scroll = { y: 0 };
  const els = makeBodies(scroll);
  const h = harness(els, {}, scroll);
  const field = createField({} as HTMLCanvasElement, { host: h.host, render: 'none', rng: seeded(1), now: () => 0 });
  try {
    const afterScan = els[0]!.reads; // the construction scan read once
    for (let f = 1; f <= 24; f++) {
      h.step(1);
      const expected = afterScan + Math.floor(f / 6);
      assert.equal(els[0]!.reads, expected, `frame ${f}: rect reads`);
    }
  } finally {
    field.destroy();
  }
});

// ── 2. the scroll compensation ──────────────────────────────────────────────────────────────

for (const observe of [false, true]) {
  test(`scroll compensation: the cached body centre follows every scrolled frame, no 6-frame plateaus (${observe ? 'observe' : 'poll'} mode, #508)`, () => {
    const scroll = { y: 0 };
    const els = makeBodies(scroll);
    const h = harness(els, { observe }, scroll);
    const field = createField({} as HTMLCanvasElement, { host: h.host, render: 'none', rng: seeded(5), now: () => 0, measure: observe ? 'observe' : undefined });
    try {
      let plateaus = 0;
      let prevY = rectOf(field, 'a').y;
      let prevSample = field.sample(300, 250).y;
      for (let f = 1; f <= 60; f++) {
        h.scroll.y += 3;
        h.step(1);
        const y = rectOf(field, 'a').y;
        // the DOM rect is document-fixed at box.y, so in viewport space it is box.y - scrollY: the
        // compensated cache must land there EVERY frame, not just on the measure cadence.
        assert.equal(y, els[0]!.box.y - els[0]!.box.h / 2 - h.scroll.y, `frame ${f}: viewport top tracks the scroll`);
        assert.equal(y, prevY - 3, `frame ${f}: moved by exactly dScroll`);
        const s = field.sample(300, 250).y;
        if (s === prevSample) plateaus++;
        prevY = y;
        prevSample = s;
      }
      assert.equal(plateaus, 0, 'the force at a fixed point changed on every scrolled frame (plateau fraction 0)');
    } finally {
      field.destroy();
    }
  });

  test(`scroll compensation: a CONTAINED host's bodies are never per-frame scroll-shifted (${observe ? 'observe' : 'poll'} mode, #540)`, () => {
    const scroll = { y: 0 };
    const els = makeBodies(scroll);
    const h = harness(els, { observe, contained: true }, scroll);
    const field = createField({} as HTMLCanvasElement, { host: h.host, render: 'none', rng: seeded(5), now: () => 0, measure: observe ? 'observe' : undefined });
    try {
      const localTop = (): number => els[0]!.box.y - els[0]!.box.h / 2 - h.scroll.y - 60; // viewport rect minus the container origin
      assert.equal(rectOf(field, 'a').y, localTop(), 'container-local: the origin is subtracted');
      let last = rectOf(field, 'a').y;
      for (let f = 1; f <= 30; f++) {
        h.scroll.y += 3; // the container's OWN scrollTop: the content moves inside a fixed container
        h.step(1);
        const y = rectOf(field, 'a').y;
        // the per-frame `b.cy -= dScroll` is a window-field compensation and must NOT touch a contained
        // field (#540): between reads the cache stands; on a cadence frame it snaps to the measured rect.
        // (identical in observe mode — a contained inner scroll forces the next cadence read, #689)
        if (f % 6 === 0) assert.equal(y, localTop(), `frame ${f}: re-read on the cadence`);
        else assert.equal(y, last, `frame ${f}: not shifted between reads`);
        last = y;
      }
    } finally {
      field.destroy();
    }
  });
}

// ── 3. observe mode ─────────────────────────────────────────────────────────────────────────

test('observe mode subscribes the DOM-backed bodies after scan, re-subscribes on rescan, disconnects on destroy', () => {
  const scroll = { y: 0 };
  const els = makeBodies(scroll);
  const h = harness(els, { observe: true }, scroll);
  const field = createField({} as HTMLCanvasElement, { host: h.host, render: 'none', rng: seeded(2), now: () => 0, measure: 'observe' });
  assert.equal(h.subscriptions, 1);
  assert.deepEqual(h.observed!.els, els, 'every scanned body element is observed');
  const first = h.observed!;
  // a programmatic body has a custom rect provider — no element to observe → excluded
  field.addBody({ tokens: ['attract'], strength: 1, range: 200, rect: () => ({ left: 10, top: 10, width: 10, height: 10 }) });
  field.rescan();
  assert.equal(h.subscriptions, 2, 'rescan re-subscribes');
  assert.ok(first.disconnected, 'the prior subscription was released first');
  assert.deepEqual(h.observed!.els, els, 'the programmatic body is not observed');
  field.destroy();
  assert.ok(h.observed!.disconnected, 'destroy disconnects');
});

test('observe mode: a dirty-marked body is re-read on the next frame; a clean body is not read on the cadence', () => {
  const scroll = { y: 0 };
  const els = makeBodies(scroll);
  const h = harness(els, { observe: true }, scroll);
  const field = createField({} as HTMLCanvasElement, { host: h.host, render: 'none', rng: seeded(3), now: () => 0, measure: 'observe' });
  try {
    const a = els[0]!;
    const b = els[1]!;
    const aReads = a.reads;
    const bReads = b.reads;
    h.step(12); // two cadence frames (6, 12), no fallback (30)
    assert.equal(a.reads, aReads, 'clean under observation: no rect read on the cadence');
    assert.equal(b.reads, bReads);
    // the element moves in the document (a layout shift) — until marked, the cache stands
    a.box.x += 50;
    h.step(1);
    assert.equal(rectOf(field, 'a').x, a.box.x - 50 - a.box.w / 2, 'unmarked: the cache is unchanged');
    h.observed!.markDirty(a as unknown as Element);
    assert.equal(a.reads, aReads, 'the mark itself does no layout read (read-phase discipline)');
    h.step(1);
    assert.equal(a.reads, aReads + 1, 'the dirty body was re-read on the very next frame');
    assert.equal(b.reads, bReads, 'the clean body was not');
    assert.equal(rectOf(field, 'a').x, a.box.x - a.box.w / 2, 'and its centre is fresh');
  } finally {
    field.destroy();
  }
});

test('observe mode: the 30-frame fallback re-reads every body, bounding un-observed drift', () => {
  const scroll = { y: 0 };
  const els = makeBodies(scroll);
  const h = harness(els, { observe: true }, scroll);
  const field = createField({} as HTMLCanvasElement, { host: h.host, render: 'none', rng: seeded(4), now: () => 0, measure: 'observe' });
  try {
    const reads = els.map((e) => e.reads);
    els[2]!.box.y += 40; // a transform-like move nobody reports
    h.step(29);
    assert.deepEqual(els.map((e) => e.reads), reads, 'frames 1–29: no reads');
    h.step(1);
    assert.deepEqual(els.map((e) => e.reads), reads.map((r) => r + 1), 'frame 30: every body re-read');
    assert.equal(rectOf(field, 'c').y, els[2]!.box.y - els[2]!.box.h / 2 - h.scroll.y, 'the drift was caught');
  } finally {
    field.destroy();
  }
});

test('observe mode: a custom-rect (programmatic) body stays on the poll cadence', () => {
  const h = harness([], { observe: true });
  const field = createField({} as HTMLCanvasElement, { host: h.host, render: 'none', rng: seeded(6), now: () => 0, measure: 'observe' });
  try {
    let reads = 0;
    const box = { left: 100, top: 100, width: 20, height: 20 };
    field.addBody({ identity: 'p', tokens: ['attract'], strength: 1, range: 200, rect: () => { reads++; return box; } });
    const afterAdd = reads; // addBody inits from the rect once
    h.step(5);
    assert.equal(reads, afterAdd, 'frames 1–5: not read');
    box.left = 400;
    h.step(1);
    assert.equal(reads, afterAdd + 1, 'frame 6: read on the cadence like the default path');
    assert.equal(rectOf(field, 'p').x, 400, 'the new position landed');
  } finally {
    field.destroy();
  }
});

test('observe mode: a clean body still refreshes engagement + reactive params on the cadence', () => {
  const scroll = { y: 0 };
  const els = makeBodies(scroll);
  const h = harness(els, { observe: true }, scroll);
  const field = createField({} as HTMLCanvasElement, { host: h.host, render: 'none', rng: seeded(7), now: () => 0, measure: 'observe' });
  try {
    const a = els[0]!;
    const reads = a.reads;
    const mag = (): number => Math.hypot(...(Object.values(field.sample(300, 150)) as [number, number]));
    const before = mag();
    assert.equal(field.query().bodies.find((b) => b.id === 'a')!.metrics.engaged, 0, 'not engaged before');
    a.dataset.active = '1'; // engagement — read on the cadence, not a layout read
    a.setAttribute('data-strength', '9'); // reactive param (reactive-params.test.ts) — likewise
    h.step(6); // one cadence frame; the body is clean under observation
    assert.equal(a.reads, reads, 'no rect read');
    assert.equal(field.query().bodies.find((b) => b.id === 'a')!.metrics.engaged, 1, 'engagement refreshed from the dataset');
    const after = mag();
    assert.ok(after > before * 1.5, `the reactive param refreshed: stronger pull ${before.toFixed(3)} → ${after.toFixed(3)}`);
  } finally {
    field.destroy();
  }
});

test('observe mode: a clean body that scrolls out of the viewport margin is marked not-visible from its cache', () => {
  const scroll = { y: 0 };
  const els = makeBodies(scroll);
  const h = harness(els, { observe: true }, scroll);
  const field = createField({} as HTMLCanvasElement, { host: h.host, render: 'none', rng: seeded(8), now: () => 0, measure: 'observe' });
  try {
    const ids = (): string[] => field.query().bodies.map((b) => b.id); // query() lists VISIBLE bodies only
    const reads = els[0]!.reads;
    assert.ok(ids().includes('a'), 'visible at rest');
    // body a sits at y=300 in the document; scroll it 600px up → viewport top −330, past the 15% margin (−120)
    h.scroll.y = 600;
    h.step(6);
    assert.equal(els[0]!.reads, reads, 'no rect read');
    assert.ok(!ids().includes('a'), 'the compensated cache carried it out of the margin → not visible');
    assert.ok(ids().includes('b'), 'body b (document y=500 → viewport −100, inside the margin) stays visible');
    // and back: the cache alone (still no read) brings it back into view on the next cadence frame
    h.scroll.y = 0;
    h.step(6);
    assert.equal(els[0]!.reads, reads, 'still no rect read');
    assert.ok(ids().includes('a'), 'visible again from the cache');
    assert.equal(rectOf(field, 'a').y, 300 - 30, 'and the centre is exact (the shift is drift-free)');
  } finally {
    field.destroy();
  }
});
