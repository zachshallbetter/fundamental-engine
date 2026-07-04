/**
 * Reactive body params (FieldKit gap #5): a body's hot force params (strength/range/angle/spin) are
 * re-read from its element on the measure cadence, so a live attribute change takes effect WITHOUT a
 * `rescan()`. Pins: mutating `data-strength` changes the felt field within a few frames, with no
 * scan() call; a preset/body without the attr is untouched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

function mutableBody(attrs: Record<string, string>, x: number, y: number) {
  return {
    attrs,
    dataset: {} as Record<string, string>,
    getAttribute: (n: string) => attrs[n] ?? null,
    hasAttribute: (n: string) => n in attrs,
    getBoundingClientRect: () => ({
      left: x - 20, top: y - 20, right: x + 20, bottom: y + 20, width: 40, height: 40,
      x: x - 20, y: y - 20, toJSON: () => ({}),
    }),
  };
}

function drivableHost(bodyEls: unknown[]): { host: FieldHost; step: (n: number) => void } {
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
    scrollY: () => 0, scrollHeight: () => 1000, reducedMotion: () => false, hidden: () => false,
    raf: (fn) => { cb = fn as (now: number) => void; return ++id; },
    cancelRaf: off, createCanvas: () => ({}) as unknown as HTMLCanvasElement,
    onResize: () => off, onScroll: () => off, onVisibility: () => off, onInput: () => off, onBodyEvent: () => off,
  };
  const step = (n: number): void => { for (let i = 0; i < n; i++) { now += 16; cb?.(now); } };
  return { host, step };
}

test('mutating data-strength changes the felt field with no rescan', () => {
  const body = mutableBody({ 'data-body': 'attract', 'data-strength': '0.5', 'data-range': '600' }, 500, 400);
  const { host, step } = drivableHost([body]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan(); // initial register + measure
    const before = Math.hypot(...Object.values(field.sample(500, 150)) as [number, number]);

    body.attrs['data-strength'] = '3.0'; // live tweak — NO scan() after this
    step(12); // a couple of measure cycles (every 6th frame)
    const after = Math.hypot(...Object.values(field.sample(500, 150)) as [number, number]);

    assert.ok(after > before * 1.5, `stronger pull after the live change: ${before.toFixed(3)} → ${after.toFixed(3)}`);
  } finally {
    field.destroy();
  }
});

test('a body without the attr keeps its value (reactivity only overrides present attrs)', () => {
  // no data-range on the element → range stays at the parsed default through measures
  const body = mutableBody({ 'data-body': 'attract', 'data-strength': '1' }, 500, 400);
  const { host, step } = drivableHost([body]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    const f1 = Math.hypot(...Object.values(field.sample(500, 250)) as [number, number]);
    step(12);
    const f2 = Math.hypot(...Object.values(field.sample(500, 250)) as [number, number]);
    assert.ok(Math.abs(f2 - f1) < 1e-6, 'untouched params are stable across measures');
  } finally {
    field.destroy();
  }
});
