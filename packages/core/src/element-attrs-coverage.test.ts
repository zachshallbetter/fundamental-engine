/**
 * RC-6 contract coverage for the `data-formation` element-consumer attribute (apps/site/src/lib/docs-api.ts
 * ELEMENT_ATTRS[]), which had no test naming it. The conductor (engine/field.ts `onScroll`) scans
 * `host.root.querySelectorAll('[data-formation]')`, reads the `dataset.formation` of the section crossing
 * mid-viewport, and eases the field to that formation. This boots a field over a host whose root carries
 * one `data-formation="wells"` section at mid-viewport and asserts the conductor activates `wells`
 * (surfaced through `snapshot().formations`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './engine/field.ts';
import type { FieldHost } from './engine/host.ts';

const noopCtx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D;
function fakeCanvas(): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    getContext: () => noopCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
  } as unknown as HTMLCanvasElement;
}

// a `data-formation="wells"` section straddling the mid-viewport line (viewport height 600 → mid 300).
const wellsSection = {
  getBoundingClientRect: () => ({ top: 250, bottom: 350, left: 0, right: 800, width: 800, height: 100, x: 0, y: 250, toJSON: () => ({}) }),
  dataset: { formation: 'wells' },
} as unknown as HTMLElement;

function declaredFormationHost(): { host: FieldHost; fireScroll: () => void } {
  const off = (): void => {};
  let scrollCb: (() => void) | null = null;
  const host: FieldHost = {
    root: {
      querySelectorAll: (sel: string) => (sel === '[data-formation]' ? [wellsSection] : []),
      querySelector: () => null,
      contains: () => false,
    } as unknown as ParentNode,
    viewport: () => ({ width: 800, height: 600, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 1200,
    reducedMotion: () => false,
    hidden: () => false,
    raf: () => 1,
    cancelRaf: off,
    createCanvas: fakeCanvas,
    onResize: () => off,
    onScroll: (cb: () => void) => {
      scrollCb = cb;
      return off;
    },
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
  return { host, fireScroll: () => scrollCb?.() };
}

test('the conductor reads [data-formation] sections and activates the declared formation', () => {
  const { host, fireScroll } = declaredFormationHost();
  const field = createField(fakeCanvas(), { host, render: 'none' });
  fireScroll(); // a section carrying data-formation="wells" sits across mid-viewport
  const snap = field.snapshot();
  assert.ok(
    snap.formations.includes('wells'),
    `a data-formation="wells" section at mid-viewport should activate 'wells', got ${JSON.stringify(snap.formations)}`,
  );
  field.destroy();
});
