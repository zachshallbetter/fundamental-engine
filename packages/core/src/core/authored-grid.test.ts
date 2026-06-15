/**
 * `FieldHandle.grid(name)` — the engine field-buffer primitive promoted to a host-authorable
 * surface. Pins: a host deposits into a named grid and reads it back (sample > 0 at the deposit,
 * gradient points toward it); `decay`/`clear` fade it; and the grid a same-named force writes
 * (`diffuse`) is readable through the same accessor. Driven through a frame-capturing host so the
 * per-frame grid step runs.
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

test('a host can author a named grid: deposit, sample, gradient, then decay/clear it', () => {
  const { host, step } = drivableHost([]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    const scent = field.grid('scent'); // a host field, independent of any force
    // empty grid reads zero everywhere
    assert.equal(scent.sample(500, 400), 0, 'empty grid → 0');

    // deposit a blob, let it diffuse a few frames
    for (let i = 0; i < 5; i++) scent.deposit(500, 400, 50);
    step(20);

    const atBlob = scent.sample(500, 400);
    const atCorner = scent.sample(40, 40);
    assert.ok(atBlob > 0, `the deposit reads back: ${atBlob.toFixed(3)}`);
    assert.ok(atBlob > atCorner, `denser at the deposit than the corner: ${atBlob.toFixed(3)} > ${atCorner.toFixed(3)}`);

    // gradient on the slope points back toward the deposit (forage-by-gradient on an authored field)
    const g = scent.gradient(560, 400);
    const towardBlob = g.x * (500 - 560) + g.y * (400 - 400);
    assert.ok(towardBlob > 0, `gradient points up-field toward the deposit: ${towardBlob.toExponential(2)}`);

    // the SAME handle reopens the same buffer (named identity), and clear() empties it
    assert.ok(field.grid('scent').sample(500, 400) > 0, 'grid("scent") reopens the same buffer');
    scent.clear();
    assert.equal(field.grid('scent').sample(500, 400), 0, 'clear() empties the grid');
  } finally {
    field.destroy();
  }
});

test('a host reads the grid a same-named force writes (diffuse)', () => {
  // a body running `diffuse` deposits into the 'diffuse' grid; the host can read that field.
  const trail = virtualBody({ 'data-body': 'diffuse', 'data-strength': '1.4', 'data-range': '600' }, {
    x: 500, y: 400, w: 40, h: 40,
  });
  const { host, step } = drivableHost([trail]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    step(200); // let the diffuse force lay + spread its mark
    const here = field.grid('diffuse').sample(500, 400);
    assert.ok(here > 0, `the force-written 'diffuse' grid is readable by the host: ${here.toExponential(2)}`);
  } finally {
    field.destroy();
  }
});
