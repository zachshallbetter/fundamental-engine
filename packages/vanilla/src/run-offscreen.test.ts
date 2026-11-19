/**
 * RC-6 contract coverage for the `runOffscreen` vanilla option (apps/site/src/lib/docs-api.ts OPTIONS[]),
 * which had no test naming it. `runOffscreen` is sugar over the contained host:
 *   createField(canvas, { bounds, runOffscreen }) → containerHost(bounds, { pauseOffscreen: !runOffscreen })
 * (packages/vanilla/src/create-field.ts). `pauseOffscreen` decides whether a contained field observes its
 * box with an IntersectionObserver so it can stop while scrolled out of view. These boot the real field
 * both ways and assert the mapping at that seam: pauseOffscreen observes the box, runOffscreen does not.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './index.ts';

interface IOStub {
  observed: unknown[];
}

/** Install the browser globals a CONTAINED field boots against (window + document + rAF + ResizeObserver
 *  + a capturing IntersectionObserver). No frame ever runs (rAF returns an id and never invokes). */
function withContainedDom<T>(fn: (io: IOStub, canvas: HTMLCanvasElement, bounds: HTMLElement) => T): T {
  const g = globalThis as Record<string, unknown>;
  const saved = {
    window: g.window,
    document: g.document,
    raf: g.requestAnimationFrame,
    caf: g.cancelAnimationFrame,
    RO: g.ResizeObserver,
    IO: g.IntersectionObserver,
  };
  const noop = (): void => {};
  const io: IOStub = { observed: [] };
  const canvas = {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    setAttribute: noop,
    getContext: () => ({ setTransform: noop, clearRect: noop, fillRect: noop }),
    remove: noop,
  } as unknown as HTMLCanvasElement;
  const boundsAttrs = new Map<string, string>();
  const bounds = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 200, right: 300, bottom: 200, x: 0, y: 0, toJSON: () => ({}) }),
    scrollTop: 0,
    scrollHeight: 200,
    querySelectorAll: () => [],
    querySelector: () => null,
    contains: () => false,
    addEventListener: noop,
    removeEventListener: noop,
    setAttribute: (n: string, v: string) => void boundsAttrs.set(n, v),
    removeAttribute: (n: string) => void boundsAttrs.delete(n),
    hasAttribute: (n: string) => boundsAttrs.has(n),
  } as unknown as HTMLElement;
  g.window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, scrollY: 0, addEventListener: noop, removeEventListener: noop };
  g.document = { body: { appendChild: noop }, documentElement: { scrollHeight: 2000 }, createElement: () => canvas, querySelectorAll: () => [], addEventListener: noop, removeEventListener: noop, hidden: false };
  g.requestAnimationFrame = () => 1;
  g.cancelAnimationFrame = noop;
  g.ResizeObserver = class {
    observe(): void {}
    disconnect(): void {}
  };
  g.IntersectionObserver = class {
    observe(t: unknown): void {
      io.observed.push(t);
    }
    disconnect(): void {}
  } as unknown;
  try {
    return fn(io, canvas, bounds);
  } finally {
    g.window = saved.window;
    g.document = saved.document;
    g.requestAnimationFrame = saved.raf;
    g.cancelAnimationFrame = saved.caf;
    g.ResizeObserver = saved.RO;
    g.IntersectionObserver = saved.IO;
  }
}

test('runOffscreen: omitted (default) ⇒ pauseOffscreen ⇒ the contained field observes its bounds so it can stop off-screen', () => {
  withContainedDom((io, canvas, bounds) => {
    const field = createField(canvas, { bounds, render: 'none' });
    assert.deepEqual(io.observed, [bounds], 'the bounds box is observed, so the engine can pause the field while it is scrolled away');
    field.destroy();
  });
});

test('runOffscreen: true ⇒ pauseOffscreen:false ⇒ nothing is observed, the field keeps running off-screen', () => {
  withContainedDom((io, canvas, bounds) => {
    const field = createField(canvas, { bounds, runOffscreen: true, render: 'none' });
    assert.deepEqual(io.observed, [], 'runOffscreen opts out of the IntersectionObserver gate — the loop runs regardless of the box position');
    field.destroy();
  });
});
