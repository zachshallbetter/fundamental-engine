/**
 * Element trigger class-toggle (#687, FACM): `data-class="dense:lit"` adds the class `lit` to the
 * element while the `dense` trigger holds (the body's gathered density > 0.6) and removes it when the
 * trigger releases — the declarative, no-JS counterpart of toggling a class inside a `data-on`
 * handler. This was the last still-planned FACM element-influence cell. The test drives a body dense
 * (class added) then disperses it (class removed), proving the toggle on BOTH edges. A virtual
 * element records its classList so we can assert what the engine added/removed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

function classList() {
  const set = new Set<string>();
  return {
    set,
    add: (c: string) => { set.add(c); },
    remove: (c: string) => { set.delete(c); },
    contains: (c: string) => set.has(c),
    toggle: (c: string) => (set.has(c) ? (set.delete(c), false) : (set.add(c), true)),
  };
}

function virtualEl(attrs: Record<string, string>, dataset: Record<string, string>, r: { x: number; y: number; w: number; h: number }) {
  const cl = classList();
  return {
    cl,
    dataset,
    classList: cl,
    getAttribute: (n: string) => attrs[n] ?? null,
    hasAttribute: (n: string) => n in attrs,
    dispatchEvent: () => true,
    removeAttribute: () => {},
    setAttribute: () => {},
    style: { setProperty: () => {}, removeProperty: () => {} } as unknown as CSSStyleDeclaration,
    getBoundingClientRect: () => ({
      left: r.x - r.w / 2, top: r.y - r.h / 2, right: r.x + r.w / 2, bottom: r.y + r.h / 2,
      width: r.w, height: r.h, x: r.x - r.w / 2, y: r.y - r.h / 2, toJSON: () => ({}),
    }),
  };
}

function drivableHost(bodyEls: unknown[], classOnlyEls: unknown[] = []): { host: FieldHost; step: (frames: number) => void } {
  const off = (): void => {};
  let cb: ((now: number) => void) | null = null;
  let id = 0;
  let now = 0;
  const host: FieldHost = {
    root: {
      querySelectorAll: (sel: string) => {
        if (sel.startsWith('[data-body]')) return bodyEls;
        if (sel.startsWith('[data-class]'))
          return [...bodyEls.filter((e) => (e as { dataset?: Record<string, string> }).dataset?.class != null), ...classOnlyEls];
        return [];
      },
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

test('data-class="dense:lit" adds the class once the body crosses into dense, idempotently', () => {
  // a feedback body that is its own attractor gathers a dense cloud (d > 0.6 → `dense` holds), which
  // the engine consumes by adding the `lit` class — the declarative element-trigger cell.
  const attrs: Record<string, string> = { 'data-body': 'attract', 'data-feedback': '', 'data-class': 'dense:lit', 'data-strength': '2.2', 'data-range': '900' };
  const dataset: Record<string, string> = { feedback: '', class: 'dense:lit' };
  const el = virtualEl(attrs, dataset, { x: 500, y: 400, w: 60, h: 60 });
  const { host, step } = drivableHost([el]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none', density: 2 });
  try {
    field.scan();
    assert.equal(el.cl.contains('lit'), false, 'no class before the field gathers any density');
    step(1500); // gather a dense cloud → `dense` trigger holds
    assert.equal(el.cl.contains('lit'), true, 'class `lit` added once the body crossed into dense');
    // hysteresis/idempotence: holding dense for more frames must not churn classList — the class set
    // is unchanged and still contains exactly `lit`.
    step(600);
    assert.equal(el.cl.set.size, 1, 'no extra classes accreted while the trigger stays held');
    assert.equal(el.cl.contains('lit'), true, 'class still present while dense');
  } finally {
    field.destroy();
  }
});

test('a class-only element (no body) toggles on its data-active engagement state', () => {
  // an element with data-class but no body reads its engagement from dataset.active (the `engaged`
  // trigger), mirroring how data-on falls back for non-body elements.
  const dataset: Record<string, string> = { class: 'engaged:open' };
  const el = virtualEl({ 'data-class': 'engaged:open' }, dataset, { x: 100, y: 100, w: 20, h: 20 });
  const { host, step } = drivableHost([], [el]);
  const field = createField({} as HTMLCanvasElement, { host, render: 'none' });
  try {
    field.scan();
    step(2);
    assert.equal(el.cl.contains('open'), false, 'not engaged → no class');
    dataset.active = '1'; // engagement turns on
    step(2);
    assert.equal(el.cl.contains('open'), true, 'class `open` added while engaged');
    dataset.active = '0';
    step(2);
    assert.equal(el.cl.contains('open'), false, 'class `open` removed when engagement ends');
  } finally {
    field.destroy();
  }
});
