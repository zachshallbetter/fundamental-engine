import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountXRay } from './x-ray.ts';
import type { FieldHandle } from '@fundamental-engine/core';

/**
 * A zero-dependency DOM stub — enough surface for mountXRay to build its panel, mount it against the
 * container's ownerDocument, tick once, and tear down. Crucially, `createTextNode` records its data
 * verbatim and NEVER parses markup, and elements track their children as real nodes — so a test can
 * assert that an `<img onerror=…>` hotkey lands as inert text, not a live element.
 */

interface StubNode {
  nodeType: number;
  tag?: string;
  data?: string; // text nodes
  children: StubNode[];
  style: Record<string, string> & { cssText: string };
  attrs: Record<string, string>;
  textContent: string;
  parent: StubNode | null;
  append(...nodes: StubNode[]): void;
  appendChild(n: StubNode): StubNode;
  replaceChildren(...nodes: StubNode[]): void;
  setAttribute(k: string, v: string): void;
  remove(): void;
}

function makeStyle(): Record<string, string> & { cssText: string } {
  return { cssText: '' } as Record<string, string> & { cssText: string };
}

function makeEl(doc: StubDoc, tag: string): StubNode {
  const node: StubNode = {
    nodeType: 1,
    tag,
    children: [],
    style: makeStyle(),
    attrs: {},
    textContent: '',
    parent: null,
    append(...nodes) {
      for (const n of nodes) { n.parent = node; node.children.push(n); }
    },
    appendChild(n) { n.parent = node; node.children.push(n); return n; },
    replaceChildren(...nodes) {
      node.children = [];
      for (const n of nodes) { n.parent = node; node.children.push(n); }
    },
    setAttribute(k, v) { node.attrs[k] = v; },
    remove() {
      if (node.parent) {
        const i = node.parent.children.indexOf(node);
        if (i >= 0) node.parent.children.splice(i, 1);
        node.parent = null;
      }
    },
  };
  void doc;
  return node;
}

interface StubDoc {
  body: StubNode;
  documentElement: StubNode;
  createElement(tag: string): StubNode;
  createTextNode(data: string): StubNode;
}

interface StubContainer {
  ownerDocument: StubDoc;
  listeners: Record<string, ((e: unknown) => void)[]>;
  addEventListener(type: string, fn: (e: unknown) => void): void;
  removeEventListener(type: string, fn: (e: unknown) => void): void;
  dispatch(type: string, e: unknown): void;
}

function makeDoc(): StubDoc {
  const doc = {} as StubDoc;
  doc.createElement = (tag: string) => makeEl(doc, tag);
  doc.createTextNode = (data: string): StubNode => ({
    nodeType: 3,
    data,
    children: [],
    style: makeStyle(),
    attrs: {},
    get textContent() { return this.data ?? ''; },
    set textContent(v: string) { this.data = v; },
    parent: null,
    append() {},
    appendChild(n: StubNode) { return n; },
    replaceChildren() {},
    setAttribute() {},
    remove() {},
  } as StubNode);
  doc.body = makeEl(doc, 'body');
  doc.documentElement = makeEl(doc, 'html');
  return doc;
}

function makeContainer(doc: StubDoc): StubContainer {
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  return {
    ownerDocument: doc,
    listeners,
    addEventListener(type, fn) { (listeners[type] ??= []).push(fn); },
    removeEventListener(type, fn) {
      const arr = listeners[type];
      if (arr) { const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1); }
    },
    dispatch(type, e) { for (const fn of listeners[type] ?? []) fn(e); },
  };
}

/** A minimal FieldHandle facade carrying only what x-ray reads. */
function makeField(): FieldHandle {
  return {
    particleCount: () => 42,
    energy: () => ({ kinetic: 1.5, thermal: 0.25, total: 1.75, count: 42 }),
    sample: (x: number, y: number) => ({ x: x * 0.1, y: y * 0.2 }),
  } as unknown as FieldHandle;
}

// Drive one rAF tick synchronously so tick()'s body renders without a real event loop.
function withStubRaf(fn: () => void): void {
  const g = globalThis as {
    requestAnimationFrame?: unknown;
    cancelAnimationFrame?: unknown;
  };
  const prevReq = g.requestAnimationFrame;
  const prevCancel = g.cancelAnimationFrame;
  // Fire the callback exactly once (return id 1), then no-op — enough to render, no runaway loop.
  let fired = false;
  g.requestAnimationFrame = ((cb: (t: number) => void) => {
    if (!fired) { fired = true; cb(0); }
    return 1;
  }) as unknown;
  g.cancelAnimationFrame = (() => {}) as unknown;
  try { fn(); } finally {
    g.requestAnimationFrame = prevReq;
    g.cancelAnimationFrame = prevCancel;
  }
}

/** Recursively collect every element tag under a node. */
function tagsOf(node: StubNode): string[] {
  const out: string[] = [];
  for (const c of node.children) {
    if (c.nodeType === 1 && c.tag) out.push(c.tag);
    out.push(...tagsOf(c));
  }
  return out;
}

/** Concatenate the visible text under a node: text-node data, plus any element's `.textContent`
 *  set directly (a leaf `<b>` whose value was assigned via textContent has no child text node). */
function textOf(node: StubNode): string {
  if (node.nodeType === 3) return node.data ?? '';
  let s = '';
  if (node.children.length === 0) s += node.textContent ?? '';
  for (const c of node.children) s += textOf(c);
  return s;
}

test('mountXRay mounts the panel against the container ownerDocument, not global document', () => {
  const doc = makeDoc();
  const container = makeContainer(doc);
  const field = makeField();

  withStubRaf(() => {
    const teardown = mountXRay(field, container as unknown as ParentNode & EventTarget, { hotkey: 'x' });
    // no panel until the hotkey opens it
    assert.equal(doc.body.children.length, 0);
    container.dispatch('keydown', { key: 'x' });
    // one panel, on the container's own document body
    assert.equal(doc.body.children.length, 1);
    assert.equal(doc.body.children[0].attrs['data-field-xray'], '');
    // readout rendered the typed values
    const panel = doc.body.children[0];
    assert.match(textOf(panel), /particles 42/);
    assert.match(textOf(panel), /kinetic 1\.500/);
    assert.match(textOf(panel), /press x to close/);

    // teardown removes the panel and detaches listeners
    teardown();
    assert.equal(doc.body.children.length, 0);
    assert.equal(container.listeners['keydown'].length, 0);
    assert.equal(container.listeners['mousemove'].length, 0);
  });
});

test('a hotkey that looks like markup renders INERT — no element is injected (injection proof)', () => {
  const doc = makeDoc();
  const container = makeContainer(doc);
  const field = makeField();
  const evil = '<img src=x onerror=alert(1)>';

  withStubRaf(() => {
    const teardown = mountXRay(field, container as unknown as ParentNode & EventTarget, { hotkey: evil });
    container.dispatch('keydown', { key: evil });
    const panel = doc.body.children[0];

    // The malicious hotkey must appear as literal TEXT in the hint line…
    assert.ok(textOf(panel).includes(evil), 'hotkey must be rendered as literal text');
    // …and must NOT have created an <img> (or any injected) element anywhere in the panel.
    const tags = tagsOf(panel);
    assert.ok(!tags.includes('img'), `no <img> element may be injected; got tags: ${tags.join(',')}`);

    teardown();
  });
});

test('mountXRay tolerates a reduced field facade without sample/energy', () => {
  const doc = makeDoc();
  const container = makeContainer(doc);
  const field = { particleCount: () => 7 } as unknown as FieldHandle;

  withStubRaf(() => {
    const teardown = mountXRay(field, container as unknown as ParentNode & EventTarget, { hotkey: '?' });
    container.dispatch('keydown', { key: '?' });
    const panel = doc.body.children[0];
    assert.match(textOf(panel), /particles 7/);
    // no energy/force lines when the facade lacks those methods
    assert.ok(!textOf(panel).includes('kinetic'));
    assert.ok(!textOf(panel).includes('force @ cursor'));
    teardown();
  });
});
