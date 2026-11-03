/**
 * Observer-driven measurement (#689) — the engine measures body GEOMETRY when a host reports that
 * something changed, instead of polling every body's rect on a fixed cadence forever.
 *
 * The claim being tested is a performance claim, so it is MEASURED (rect calls are counted), not
 * asserted. The three things that could go wrong are each pinned:
 *   · a host with no observation must behave exactly as before — not "close enough"
 *   · attribute reactivity must NOT slow down with the geometry pass
 *   · a body the engine cannot observe (a host-supplied `rect()`) must keep the pass hot
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import { hostCapabilities, defineHost } from './host.ts';
import type { BodyObserver, FieldHost } from './host.ts';

/** A DOM-scanned body whose box can be moved, and which counts every measurement of itself. */
function virtualBody(attrs: Record<string, string>, box: { x: number; y: number; w: number; h: number }) {
  const el = {
    reads: 0,
    box,
    dataset: {} as Record<string, string>,
    getAttribute: (n: string) => attrs[n] ?? null,
    hasAttribute: (n: string) => n in attrs,
    setAttr: (n: string, v: string) => void (attrs[n] = v),
    dispatchEvent: () => true,
    removeAttribute: () => {},
    setAttribute: () => {},
    style: { setProperty: () => {}, removeProperty: () => {}, getPropertyValue: () => '' } as unknown as CSSStyleDeclaration,
    getBoundingClientRect() {
      el.reads++;
      const { x, y, w, h } = el.box;
      return { left: x - w / 2, top: y - h / 2, right: x + w / 2, bottom: y + h / 2, width: w, height: h, x: x - w / 2, y: y - h / 2, toJSON: () => ({}) };
    },
  };
  return el;
}

interface Harness {
  host: FieldHost;
  step: (frames: number) => void;
  /** fire the host's observation callback, as a ResizeObserver/IntersectionObserver would. */
  report: () => void;
  observed: Set<unknown>;
  disconnects: number;
}

function drivableHost(bodyEls: unknown[], opts: { observe?: boolean } = {}): Harness {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null;
  let id = 0;
  let now = 0;
  const observed = new Set<unknown>();
  let notify: (() => void) | null = null;
  const h = { disconnects: 0 };
  const base: FieldHost = {
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
  if (opts.observe) {
    base.observeBodies = (fn): BodyObserver => {
      notify = () => fn([...observed] as Element[]);
      return {
        observe: (el) => void observed.add(el),
        unobserve: (el) => void observed.delete(el),
        disconnect: () => { h.disconnects++; observed.clear(); },
      };
    };
  }
  return {
    host: base,
    step: (frames) => { for (let i = 0; i < frames; i++) { now += 16; cb?.(now); } },
    report: () => notify?.(),
    observed,
    get disconnects() { return h.disconnects; },
  } as Harness;
}

const BODY = { 'data-body': 'attract', 'data-strength': '1', 'data-range': '300', 'data-feedback': '' };

// ── the capability read-out ─────────────────────────────────────────────────────────────────────

test('hostCapabilities reports bodyObservation, and defineHost does not fake it', () => {
  const minimal = { root: {} as ParentNode, viewport: () => ({ width: 1, height: 1, dpr: 1 }), raf: () => 1, cancelRaf: () => {} };
  assert.equal(hostCapabilities(defineHost(minimal)).bodyObservation, false);
  const observing = defineHost({ ...minimal, observeBodies: () => ({ observe: () => {}, unobserve: () => {}, disconnect: () => {} }) });
  assert.equal(hostCapabilities(observing).bodyObservation, true);
  // the distinction that matters: defineHost fills no-op defaults for every OTHER subscription, but
  // must leave this one absent. A no-op observer that never fires reads as "nothing ever changes",
  // and the engine would slow its safety cadence on a signal that does not exist.
  assert.equal(defineHost(minimal).observeBodies, undefined);
  assert.equal(typeof defineHost(minimal).onResize, 'function');
});

// ── the baseline must not move ──────────────────────────────────────────────────────────────────

test('a host with NO observation polls exactly as it always did — every 6th frame', () => {
  const el = virtualBody(BODY, { x: 500, y: 400, w: 40, h: 40 });
  const { host, step } = drivableHost([el]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    el.reads = 0;
    step(60);
    // 60 frames ⇒ ticks at 6,12,…,60 ⇒ 10 measures. Pinned exactly, because "roughly the same" is
    // how a silent behaviour change gets through.
    assert.equal(el.reads, 10, `one rect read per cadence tick: ${el.reads}`);
  } finally {
    field.destroy();
  }
});

test('a host with NO observation still sees a body that moved, within the cadence', () => {
  const el = virtualBody(BODY, { x: 500, y: 400, w: 40, h: 40 });
  const { host, step } = drivableHost([el]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    step(6);
    el.box = { x: 200, y: 200, w: 40, h: 40 };
    step(6);
    const b = field.query().bodies[0]!;
    assert.ok(b.rect && Math.abs(b.rect.x + b.rect.width / 2 - 200) < 1e-6, `picked the move up: ${JSON.stringify(b.rect)}`);
  } finally {
    field.destroy();
  }
});

// ── what observation buys ───────────────────────────────────────────────────────────────────────

test('with observation, an unreported page stops paying for layout every 6 frames', () => {
  const el = virtualBody(BODY, { x: 500, y: 400, w: 40, h: 40 });
  const { host, step } = drivableHost([el], { observe: true });
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    step(6); // let the initial dirty flag clear
    el.reads = 0;
    step(60);
    // the safety floor is 30 frames and the gate only runs on the 6-frame cadence, so a quiet page
    // measures at 30 and 60: 2 reads where the poll cost 10.
    assert.equal(el.reads, 2, `quiet page measures on the safety floor only: ${el.reads}`);
  } finally {
    field.destroy();
  }
});

test('an observation pulls the cadence straight back to hot', () => {
  const el = virtualBody(BODY, { x: 500, y: 400, w: 40, h: 40 });
  const { host, step, report } = drivableHost([el], { observe: true });
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    step(6);
    el.reads = 0;
    step(6);
    assert.equal(el.reads, 0, 'nothing reported, nothing measured');

    el.box = { x: 120, y: 120, w: 40, h: 40 };
    report(); // the host says: this element changed
    step(6);
    assert.equal(el.reads, 1, 'reported ⇒ measured on the very next cadence tick');
    const b = field.query().bodies[0]!;
    assert.ok(b.rect && Math.abs(b.rect.x + b.rect.width / 2 - 120) < 1e-6, 'and the new box is live');
  } finally {
    field.destroy();
  }
});

test('an UNobservable move still self-corrects on the safety floor — the poll is slowed, not removed', () => {
  // This is the case ResizeObserver and IntersectionObserver both miss: a body that moved without
  // changing size or crossing the viewport. Nothing is reported, so nothing is measured for a while —
  // and then the floor catches it. Without the floor this move would never land.
  const el = virtualBody(BODY, { x: 500, y: 400, w: 40, h: 40 });
  const { host, step } = drivableHost([el], { observe: true });
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    step(6);
    el.box = { x: 460, y: 400, w: 40, h: 40 }; // moved 40px, nobody reported it
    step(12);
    const stale = field.query().bodies[0]!;
    assert.ok(stale.rect && Math.abs(stale.rect.x + stale.rect.width / 2 - 500) < 1e-6, 'still stale — no observer fired');
    step(30); // past the floor
    const fresh = field.query().bodies[0]!;
    assert.ok(fresh.rect && Math.abs(fresh.rect.x + fresh.rect.width / 2 - 460) < 1e-6, 'the safety cadence caught it');
  } finally {
    field.destroy();
  }
});

// ── what must NOT slow down ─────────────────────────────────────────────────────────────────────

test('attribute reactivity keeps its own clock: data-strength lands within a frame even while geometry sleeps', () => {
  // The whole design rests on this split. `BodyHandle.set` and live `data-*` edits are documented as
  // applying "within a frame on the measure cadence, with no rescan"; folding them into the geometry
  // pass would quietly turn that into half a second.
  const el = virtualBody({ ...BODY }, { x: 500, y: 400, w: 40, h: 40 });
  const { host, step } = drivableHost([el], { observe: true });
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    step(6);
    el.reads = 0;
    const before = field.sample(560, 400);
    el.setAttr('data-strength', '8'); // no rescan, no observation — an attribute edit
    step(6);
    const after = field.sample(560, 400);
    assert.equal(el.reads, 0, 'and it cost NO layout read — the attribute pass does not force layout');
    assert.ok(
      Math.abs(after.x) > Math.abs(before.x) * 2,
      `the stronger pull is live on the next tick: ${before.x.toExponential(2)} → ${after.x.toExponential(2)}`,
    );
  } finally {
    field.destroy();
  }
});

test('a body measured through a host-supplied rect() keeps the geometry pass hot', () => {
  // A programmatic body's `rect()` can return something new on any frame and no browser observer
  // will ever say so. One such body must hold the whole pass at the hot cadence — a Three.js mesh
  // lagging its own field by half a second is a much worse bug than the layout reads are a cost.
  const el = virtualBody(BODY, { x: 500, y: 400, w: 40, h: 40 });
  const { host, step } = drivableHost([el], { observe: true });
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    step(6);
    el.reads = 0;
    step(12);
    assert.equal(el.reads, 0, 'baseline: quiet, so nothing is measured');

    let mesh = { left: 100, top: 100, width: 10, height: 10 };
    field.addBody({ tokens: 'attract', strength: 1, range: 200, rect: () => mesh });
    el.reads = 0;
    step(12);
    assert.equal(el.reads, 2, 'one unobservable body puts every body back on the 6-frame cadence');

    mesh = { left: 700, top: 300, width: 10, height: 10 };
    step(6);
    const moved = field.query().bodies.find((b) => b.rect && Math.abs(b.rect.x - 700) < 1e-6);
    assert.ok(moved, 'and the mesh body tracks its provider without waiting on the floor');
  } finally {
    field.destroy();
  }
});

// ── lifecycle ───────────────────────────────────────────────────────────────────────────────────

test('observation tracks the body set across rescans, and disconnects on destroy', () => {
  const a = virtualBody(BODY, { x: 300, y: 300, w: 40, h: 40 });
  const b = virtualBody(BODY, { x: 600, y: 300, w: 40, h: 40 });
  const els: unknown[] = [a, b];
  const harness = drivableHost(els, { observe: true });
  const field = createField({} as HTMLCanvasElement, { host: harness.host, render: 'none' });
  field.scan();
  assert.equal(harness.observed.size, 2, 'both scanned bodies are observed');
  assert.ok(harness.observed.has(a) && harness.observed.has(b));

  els.pop(); // b leaves the DOM
  field.rescan();
  assert.equal(harness.observed.size, 1, 'a body that left the scan is unobserved');
  assert.ok(harness.observed.has(a) && !harness.observed.has(b));

  // a programmatic body is never handed to the observer — its element is a synthetic stub, and a
  // real ResizeObserver would throw on it.
  field.addBody({ tokens: 'attract', rect: () => ({ left: 0, top: 0, width: 4, height: 4 }) });
  field.rescan();
  assert.equal(harness.observed.size, 1, 'the programmatic body is not observed');

  field.destroy();
  assert.equal(harness.disconnects, 1, 'destroy disconnects exactly once');
  assert.equal(harness.observed.size, 0);
});
