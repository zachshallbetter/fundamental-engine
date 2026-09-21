/**
 * Pointer dynamics + throw (#666). The claim the whole design rests on is that a pointer is NOT a
 * flow focus — it has a velocity, and the velocity is what matters — so that is what most of these
 * measure: the same cursor, at the same place, moving and not moving, must do different things.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import {
  makePointer, trackPointer, agePointer, pointerWake, flingVelocity,
  POINTER_REFERENCE_SPEED, POINTER_MAX_SPEED, POINTER_IDLE_SECONDS, FLING_MAX_SPEED, FLING_REFERENCE_FPS,
} from './pointer.ts';
import { seededRng } from '../record/rng.ts';
import type { FieldHost } from './host.ts';

const MS = 1000 / 60;

function drivableHost(bodyEls: unknown[] = [], moverEls: unknown[] = []): { host: FieldHost; step: (n: number) => void } {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null;
  let id = 0;
  let now = 0;
  const host: FieldHost = {
    root: {
      querySelectorAll: (sel: string) =>
        sel.startsWith('[data-body]') ? bodyEls : sel.startsWith('[data-move]') ? moverEls : [],
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
  return { host, step: (n) => { for (let i = 0; i < n; i++) { now += MS; cb?.(now); } } };
}

// ── the tracker ─────────────────────────────────────────────────────────────────────────────────

test('velocity is px/second, smoothed, and a repeated sample never divides by zero', () => {
  const p = makePointer(0, 0);
  assert.equal(p.vx, 0, 'a pointer has no velocity until it has been somewhere else');

  trackPointer(p, 100, 0, 0.1); // 1000 px/s, first sample
  assert.ok(p.vx > 0 && p.vx < 1000, `smoothed toward 1000, not snapped to it: ${p.vx}`);
  const after1 = p.vx;
  trackPointer(p, 200, 0, 0.1); // same speed again — the estimate converges
  assert.ok(p.vx > after1, 'a sustained speed keeps converging upward');

  const before = { x: p.vx, y: p.vy };
  trackPointer(p, 260, 0, 0); // two events in the same millisecond
  assert.deepEqual({ x: p.vx, y: p.vy }, before, 'a zero interval leaves velocity untouched');
  assert.equal(p.x, 260, 'but the position still moves');
});

test('a teleport is clamped, not turned into an impulse nothing can absorb', () => {
  const p = makePointer(0, 0);
  trackPointer(p, 1e6, 0, 0.001); // a billion px/s — a tab-switch, a synthetic event
  // one smoothed sample of a clamped value, so the estimate is a fraction of the ceiling, and the
  // ceiling is what matters: the raw sample never reaches the field.
  assert.ok(p.vx <= POINTER_MAX_SPEED, `clamped: ${p.vx} <= ${POINTER_MAX_SPEED}`);
});

test('the wake is zero for a still cursor — this is the whole difference from a flow focus', () => {
  const still = makePointer(100, 100);
  assert.deepEqual(pointerWake(110, 100, still), { x: 0, y: 0 });

  const moving = makePointer(100, 100);
  moving.vx = POINTER_REFERENCE_SPEED;
  const w = pointerWake(110, 100, moving);
  assert.ok(w.x > 0 && w.y === 0, `matter beside a rightward flick is carried rightward: ${JSON.stringify(w)}`);
});

test('the wake falls off with distance, scales with speed, and stops at the radius', () => {
  const p = makePointer(0, 0, { radius: 100 });
  p.vx = POINTER_REFERENCE_SPEED;
  const near = pointerWake(10, 0, p).x;
  const far = pointerWake(90, 0, p).x;
  assert.ok(near > far && far > 0, `linear falloff: ${near} > ${far} > 0`);
  assert.deepEqual(pointerWake(100, 0, p), { x: 0, y: 0 }, 'nothing at the radius');
  assert.deepEqual(pointerWake(250, 0, p), { x: 0, y: 0 }, 'nothing past it');

  const slow = makePointer(0, 0, { radius: 100 });
  slow.vx = POINTER_REFERENCE_SPEED / 4;
  assert.ok(pointerWake(10, 0, slow).x < near / 3, 'a drift entrains far less than a flick');

  const fast = makePointer(0, 0, { radius: 100 });
  fast.vx = POINTER_REFERENCE_SPEED * 10;
  assert.ok(Math.abs(pointerWake(10, 0, fast).x - near) < 1e-12, 'and past the reference speed it saturates');
});

test('a pointer nobody reports any more fades its wake out instead of dragging matter forever', () => {
  const p = makePointer(0, 0);
  p.vx = POINTER_REFERENCE_SPEED;
  agePointer(p, POINTER_IDLE_SECONDS * 0.5);
  assert.equal(p.vx, POINTER_REFERENCE_SPEED, 'inside the grace window nothing decays');
  agePointer(p, POINTER_IDLE_SECONDS); // now past it
  assert.ok(p.vx > 0 && p.vx < POINTER_REFERENCE_SPEED, `decaying, not cut dead: ${p.vx}`);
  agePointer(p, POINTER_IDLE_SECONDS * 2);
  assert.equal(p.vx, 0, 'and it reaches exactly zero');
  assert.equal(p.x, 0, 'the POSITION survives — the cursor is still somewhere, it is just not moving');
});

// ── the throw ───────────────────────────────────────────────────────────────────────────────────

test('flingVelocity converts px/second to px/frame and clamps — the invisible bug', () => {
  // an unconverted value is 60x too large, which reads as "the throw is broken", not "wrong units".
  assert.deepEqual(flingVelocity(600, 0), { x: 10, y: 0 });
  assert.deepEqual(flingVelocity(0, -1200), { x: 0, y: -20 });
  assert.deepEqual(flingVelocity(600, 0, 30), { x: 20, y: 0 }, 'the reference rate is a parameter');

  const wild = flingVelocity(1e9, 0);
  assert.equal(wild.x, FLING_MAX_SPEED / FLING_REFERENCE_FPS, 'a bad sample cannot launch the element');
  assert.deepEqual(flingVelocity(NaN, 0), { x: 0, y: 0 }, 'NaN never reaches the integrator');
});

// ── the field ───────────────────────────────────────────────────────────────────────────────────

/** A DOM-scanned element the fake root will hand to the scanner. */
function virtualEl(attrs: Record<string, string>, box: { x: number; y: number; w: number; h: number }) {
  const style: Record<string, string> = {};
  return {
    attrs, box, style,
    dataset: {} as Record<string, string>,
    isConnected: true,
    getAttribute: (n: string) => attrs[n] ?? null,
    hasAttribute: (n: string) => n in attrs,
    setAttribute: () => {},
    removeAttribute: () => {},
    dispatchEvent: () => true,
    getBoundingClientRect() {
      const { x, y, w, h } = this.box;
      return { left: x - w / 2, top: y - h / 2, right: x + w / 2, bottom: y + h / 2, width: w, height: h, x: x - w / 2, y: y - h / 2, toJSON: () => ({}) };
    },
  };
}

test('the cursor is a real body: query() reports it, and clearPointer takes it away', () => {
  const { host, step } = drivableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    assert.equal(field.query().bodies.length, 0);

    field.pointer(400, 300);
    step(2);
    const bodies = field.query().bodies;
    assert.equal(bodies.length, 1, 'the cursor participates like anything else');
    assert.equal(bodies[0]!.id, 'pointer', 'and it is identifiable');
    assert.ok(bodies[0]!.tokens.includes('repel'), `a finger pushes matter aside by default: ${bodies[0]!.tokens}`);

    // it is a real force, not a label: sampling to the right of the cursor pushes further right.
    const f = field.sample(430, 300);
    assert.ok(f.x > 0, `the cursor body repels: ${f.x.toExponential(2)}`);

    field.clearPointer();
    step(2);
    assert.equal(field.query().bodies.length, 0, 'and the field forgets it entirely');
  } finally {
    field.destroy();
  }
});

test('opts pick the cursor: attract gathers where repel pushes', () => {
  const { host, step } = drivableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    field.pointer(400, 300, { tokens: 'attract', bodyStrength: 2, bodyRange: 300 });
    step(2);
    const f = field.sample(430, 300);
    assert.ok(f.x < 0, `an attracting cursor pulls matter toward it: ${f.x.toExponential(2)}`);
  } finally {
    field.destroy();
  }
});

test('a MOVING cursor carries matter and a still one does not — measured on a real field', () => {
  // Two identical fields (same seed, same pinned clock, so they are comparable at all). One cursor
  // is dragged across the field; the other is parked at the end point. Same body, same forces, same
  // final position — only the motion differs.
  const run = (drag: boolean): number => {
    const { host, step } = drivableHost();
    const field = createField({} as HTMLCanvasElement, { host, render: 'none', rng: seededRng(5), now: () => 0 });
    try {
      field.scan();
      if (drag) {
        for (let i = 0; i <= 20; i++) { field.pointer(300 + i * 10, 400); step(1); }
      } else {
        for (let i = 0; i <= 20; i++) { field.pointer(500, 400); step(1); }
      }
      // net rightward drift of the matter the cursor passed through
      const out = new Float32Array(5 * 600);
      field.readParticles(out);
      let sum = 0;
      let n = 0;
      for (let i = 0; i < out.length; i += 5) {
        const x = out[i]!;
        const y = out[i + 1]!;
        if (x === 0 && y === 0) continue;
        if (Math.abs(y - 400) < 100 && x > 250 && x < 600) { sum += x; n++; }
      }
      return n ? sum / n : 0;
    } finally {
      field.destroy();
    }
  };
  const dragged = run(true);
  const parked = run(false);
  assert.ok(dragged > 0 && parked > 0, 'both runs found matter along the path');
  assert.ok(
    dragged > parked,
    `a dragged cursor leaves matter further along its travel than a parked one: ${dragged.toFixed(3)} vs ${parked.toFixed(3)}`,
  );
});

test('fling seeds a mover\'s offset velocity: it travels under its own momentum, then comes home', () => {
  const mover = virtualEl({ 'data-move': '' }, { x: 500, y: 400, w: 60, h: 40 });
  const { host, step } = drivableHost([], [mover]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    step(2);
    const tx = (): number => Number.parseFloat(/translate\(([-\d.]+)px/.exec(mover.style.transform ?? '')?.[1] ?? '0');
    assert.ok(Math.abs(tx()) < 0.01, `at rest in its layout slot: ${mover.style.transform}`);

    field.fling(mover as unknown as HTMLElement, 1800, 0); // a hard rightward throw
    step(1);
    const first = tx();
    assert.ok(first > 1, `the throw moves it immediately: ${first}px`);
    step(1);
    const second = tx();
    assert.ok(second > first, `and it keeps going under its own momentum: ${first} → ${second}`);

    step(300);
    const rest = tx();
    assert.ok(Math.abs(rest) < 1, `the anchor spring brings it home: settled at ${rest}px`);
  } finally {
    field.destroy();
  }
});

test('a throw is bounded by the mover contract, not by the velocity you hand it', () => {
  // A `[data-move]` element never wanders more than the element-offset integrator's 80px ceiling
  // from its layout slot, and a fling inherits that: this is a nudge with momentum, not a card
  // sailing across the page. Pinned because it is the first thing a caller will be surprised by.
  const run = (speed: number): number => {
    const mover = virtualEl({ 'data-move': '' }, { x: 500, y: 400, w: 60, h: 40 });
    const { host, step } = drivableHost([], [mover]);
    const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
    try {
      field.scan();
      step(2);
      field.fling(mover as unknown as HTMLElement, speed, 0);
      let peak = 0;
      for (let i = 0; i < 30; i++) {
        step(1);
        peak = Math.max(peak, Number.parseFloat(/translate\(([-\d.]+)px/.exec(mover.style.transform ?? '')?.[1] ?? '0'));
      }
      return peak;
    } finally {
      field.destroy();
    }
  };
  const gentle = run(300);
  const hard = run(1800);
  const absurd = run(100000);
  assert.ok(gentle < hard, `a harder throw does travel further: ${gentle.toFixed(1)} < ${hard.toFixed(1)}`);
  assert.ok(hard <= 80.0001 && absurd <= 80.0001, `but never past the 80px mover ceiling: ${hard}, ${absurd}`);
  assert.ok(Math.abs(hard - absurd) < 1e-9, 'past the ceiling, more velocity buys nothing at all');
});

test('fling on something that is not a mover on this field is a silent no-op', () => {
  const stranger = virtualEl({}, { x: 0, y: 0, w: 10, h: 10 });
  const { host, step } = drivableHost();
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    assert.doesNotThrow(() => field.fling(stranger as unknown as HTMLElement, 900, 900));
    step(2);
    assert.equal(stranger.style.transform ?? '', '', 'and it was not moved');
  } finally {
    field.destroy();
  }
});
