/**
 * createOverlaySurface (#721): the overlay canvas helper reproduces the surface `<field-root>` shipped
 * before it (byte-identical inline style, aria-hidden, data-field-overlay marker, appended to body),
 * exposes the two host tunables (blend / z-index), and only sizes the backing store when asked —
 * core owns sizing for a canvas bound to createField.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOverlaySurface, overlaySurfaceCssText } from './overlay-surface.ts';

const TODAY = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;mix-blend-mode:screen';

type FakeCanvas = {
  attrs: Record<string, string>;
  style: Record<string, string>;
  width: number;
  height: number;
  removed: number;
  setAttribute(k: string, v: string): void;
  remove(): void;
};

function fakeCanvas(): FakeCanvas {
  const c: FakeCanvas = {
    attrs: {},
    style: {},
    width: 0,
    height: 0,
    removed: 0,
    setAttribute(k, v) {
      c.attrs[k] = v;
    },
    remove() {
      c.removed++;
    },
  };
  return c;
}

function fakeDocument(defaultView?: unknown) {
  const appended: unknown[] = [];
  const doc = {
    createElement: () => fakeCanvas(),
    body: { appendChild: (el: unknown) => void appended.push(el) },
    defaultView,
  };
  return { doc: doc as unknown as Document, appended };
}

function fakeWindow(w: number, h: number, dpr: number) {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    innerWidth: w,
    innerHeight: h,
    devicePixelRatio: dpr,
    listeners,
    addEventListener: (type: string, fn: () => void) => void (listeners[type] ??= []).push(fn),
    removeEventListener: (type: string, fn: () => void) => {
      listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
    },
  };
}

test('defaults reproduce the previous <field-root> overlay canvas byte-for-byte', () => {
  const { doc, appended } = fakeDocument();
  const s = createOverlaySurface(doc);
  const c = s.canvas as unknown as FakeCanvas;
  assert.equal(c.style.cssText, TODAY, 'the exact inline style the element used to write');
  assert.equal(overlaySurfaceCssText(), TODAY, 'and the exported cssText builder agrees');
  assert.equal(c.attrs['aria-hidden'], 'true', 'aria-hidden');
  assert.equal(c.attrs['data-field-overlay'], '', 'marked data-field-overlay');
  assert.equal(appended.length, 1, 'appended to body exactly once');
  assert.equal(appended[0], c, 'and it is the returned canvas');
});

test('blend + zIndex interpolate into the inline style', () => {
  const { doc } = fakeDocument();
  const s = createOverlaySurface(doc, { blend: 'multiply', zIndex: 20 });
  const c = s.canvas as unknown as FakeCanvas;
  assert.equal(
    c.style.cssText,
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:20;mix-blend-mode:multiply',
  );
  const t = createOverlaySurface(doc, { zIndex: 'auto' });
  assert.match((t.canvas as unknown as FakeCanvas).style.cssText, /z-index:auto;/, 'a string z-index passes through');
});

test('marker:false omits data-field-overlay; parent overrides body', () => {
  const { doc, appended } = fakeDocument();
  const elsewhere: unknown[] = [];
  const parent = { appendChild: (el: unknown) => void elsewhere.push(el) } as unknown as Node;
  const s = createOverlaySurface(doc, { marker: false, parent });
  const c = s.canvas as unknown as FakeCanvas;
  assert.equal('data-field-overlay' in c.attrs, false, 'no marker');
  assert.equal(c.attrs['aria-hidden'], 'true', 'still aria-hidden');
  assert.equal(appended.length, 0, 'not appended to body');
  assert.equal(elsewhere.length, 1, 'appended to the given parent');
});

test('destroy removes the canvas once and is idempotent', () => {
  const { doc } = fakeDocument();
  const s = createOverlaySurface(doc);
  const c = s.canvas as unknown as FakeCanvas;
  s.destroy();
  s.destroy();
  assert.equal(c.removed, 1, 'remove() called exactly once');
});

test('autoSize is OFF by default — core owns the backing store of a bound canvas', () => {
  const win = fakeWindow(800, 600, 3);
  const { doc } = fakeDocument(win);
  const s = createOverlaySurface(doc);
  const c = s.canvas as unknown as FakeCanvas;
  assert.equal(c.width, 0, 'width untouched');
  assert.equal(c.height, 0, 'height untouched');
  assert.equal(c.style.width, undefined, 'no px width written');
  assert.equal(win.listeners.resize, undefined, 'no resize listener');
  s.resize();
  assert.equal(c.width, 0, 'resize() is a no-op without autoSize');
});

test('autoSize:true sizes DPR-aware under dprCap, follows window resize, and detaches on destroy', () => {
  const win = fakeWindow(800, 600, 3);
  const { doc } = fakeDocument(win);
  const s = createOverlaySurface(doc, { autoSize: true, dprCap: 2 });
  const c = s.canvas as unknown as FakeCanvas;
  assert.equal(c.width, 1600, 'dpr 3 capped to 2 → 800×2');
  assert.equal(c.height, 1200);
  assert.equal(c.style.width, '800px');
  assert.equal(c.style.height, '600px');
  assert.equal(win.listeners.resize?.length, 1, 'one resize listener');
  win.innerWidth = 400;
  win.innerHeight = 300;
  win.listeners.resize![0]!();
  assert.equal(c.width, 800, 'the captured resize handler re-sizes');
  assert.equal(c.height, 600);
  s.destroy();
  assert.equal(win.listeners.resize?.length, 0, 'listener detached on destroy');
  assert.equal(c.removed, 1);
});

test('autoSize falls back to globalThis.window when the document has no defaultView', () => {
  const win = fakeWindow(100, 50, 1);
  const prev = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = win;
  try {
    const { doc } = fakeDocument(undefined);
    const s = createOverlaySurface(doc, { autoSize: true });
    const c = s.canvas as unknown as FakeCanvas;
    assert.equal(c.width, 100);
    assert.equal(c.height, 50);
    s.destroy();
  } finally {
    (globalThis as { window?: unknown }).window = prev;
  }
});

test('root defaults to globalThis.document; no document at all throws', () => {
  const prev = (globalThis as { document?: unknown }).document;
  const { doc, appended } = fakeDocument();
  (globalThis as { document?: unknown }).document = doc;
  try {
    createOverlaySurface();
    assert.equal(appended.length, 1, 'created in the global document');
  } finally {
    (globalThis as { document?: unknown }).document = prev;
  }
  delete (globalThis as { document?: unknown }).document;
  try {
    assert.throws(() => createOverlaySurface(), /needs a document/);
  } finally {
    (globalThis as { document?: unknown }).document = prev;
  }
});
