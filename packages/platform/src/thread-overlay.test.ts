/**
 * threadOverlay tests — the lifted wireThreads/centerIn geometry from the example family,
 * exercised with the repo's fake-element pattern (programmable getBoundingClientRect, recorded
 * attrs/styles/classes, a host that can prepend and query its children). Pins: overlay
 * creation/reuse, host-relative bezier math (the family's M/C midpoint-y shape), the --thread
 * color channel, lit/cited marks, clear/destroy, and SSR-safe construction.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { threadOverlay } from './thread-overlay.ts';

type Rect = { x: number; y: number; w: number; h: number };
const domRect = (r: Rect): DOMRect =>
  ({ left: r.x, top: r.y, width: r.w, height: r.h, right: r.x + r.w, bottom: r.y + r.h, x: r.x, y: r.y }) as DOMRect;

interface FakeNode {
  tagName: string;
  attrs: Record<string, string>;
  styles: Record<string, string>;
  classes: Set<string>;
  innerHTML: string;
  parent: FakeHost | null;
  rect: Rect;
  getBoundingClientRect(): DOMRect;
  setAttribute(k: string, v: string): void;
  getAttribute(k: string): string | null;
  classList: { add(...c: string[]): void; remove(...c: string[]): void; contains(c: string): boolean };
  style: { setProperty(k: string, v: string): void; removeProperty(k: string): void };
  remove(): void;
}

interface FakeHost extends FakeNode {
  children: FakeNode[];
  ownerDocument: { createElementNS(ns: string, tag: string): FakeNode };
  querySelector(sel: string): FakeNode | null;
  prepend(n: FakeNode): void;
}

function fakeNode(tag: string, rect: Rect = { x: 0, y: 0, w: 0, h: 0 }): FakeNode {
  const attrs: Record<string, string> = {};
  const styles: Record<string, string> = {};
  const classes = new Set<string>();
  const node: FakeNode = {
    tagName: tag,
    attrs,
    styles,
    classes,
    innerHTML: '',
    parent: null,
    rect,
    getBoundingClientRect: () => domRect(node.rect),
    setAttribute: (k, v) => void (attrs[k] = v),
    getAttribute: (k) => attrs[k] ?? null,
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      contains: (c) => classes.has(c),
    },
    style: {
      setProperty: (k, v) => void (styles[k] = v),
      removeProperty: (k) => void delete styles[k],
    },
    remove: () => {
      if (node.parent) {
        const i = node.parent.children.indexOf(node);
        if (i >= 0) node.parent.children.splice(i, 1);
        node.parent = null;
      }
    },
  };
  return node;
}

function fakeHost(rect: Rect): FakeHost {
  const host = fakeNode('section', rect) as FakeHost;
  host.children = [];
  host.ownerDocument = { createElementNS: (_ns, tag) => fakeNode(tag) };
  host.querySelector = (sel) => {
    const cls = sel.startsWith('svg.') ? sel.slice(4).split('.') : [];
    return host.children.find((c) => c.tagName === 'svg' && cls.every((x) => (c.attrs['class'] ?? '').split(/\s+/).includes(x))) ?? null;
  };
  host.prepend = (n) => {
    host.children.unshift(n);
    n.parent = host;
  };
  return host;
}

const asEl = (n: unknown) => n as HTMLElement;
const paths = (svg: FakeNode): string[] => [...svg.innerHTML.matchAll(/<path d="([^"]+)"\/>/g)].map((m) => m[1]!);

test('construction is lazy + SSR-safe; the first draw creates the prepended aria-hidden overlay', () => {
  const host = fakeHost({ x: 100, y: 50, w: 400, h: 300 });
  const overlay = threadOverlay(asEl(host));
  assert.equal(host.children.length, 0, 'no SVG until draw (construction touches nothing)');
  overlay.clear(); // no-ops before the SVG exists
  overlay.destroy();
  assert.equal(host.children.length, 0);

  const overlay2 = threadOverlay(asEl(host));
  overlay2.draw(asEl(fakeNode('article', { x: 120, y: 60, w: 40, h: 20 })), []);
  assert.equal(host.children.length, 1, 'created on first draw');
  const svg = host.children[0]!;
  assert.equal(svg.tagName, 'svg');
  assert.equal(svg.attrs['class'], 'field-threads', 'default class');
  assert.equal(svg.attrs['aria-hidden'], 'true');
  assert.equal(svg.styles['position'], 'absolute');
  assert.equal(svg.styles['inset'], '0');
  assert.equal(svg.styles['width'], '100%');
  assert.equal(svg.styles['height'], '100%');
  assert.equal(svg.styles['pointer-events'], 'none');
});

test('an existing svg with the class is reused (no stacking), incl. the family className', () => {
  const host = fakeHost({ x: 0, y: 0, w: 200, h: 200 });
  const existing = fakeNode('svg');
  existing.attrs['class'] = 'ev-threads';
  host.prepend(existing);

  const overlay = threadOverlay(asEl(host), { className: 'ev-threads' });
  overlay.draw(asEl(fakeNode('div', { x: 10, y: 10, w: 20, h: 20 })), []);
  assert.equal(host.children.length, 1, 'reused, not duplicated');
  assert.equal(host.children[0], existing);
});

test('draw: host-relative centers, viewBox from the host rect, the family midpoint-y cubic per target', () => {
  const host = fakeHost({ x: 100, y: 50, w: 400, h: 300 });
  const from = fakeNode('div', { x: 120, y: 60, w: 40, h: 20 }); // center → host-relative (40, 20)
  const t1 = fakeNode('div', { x: 300, y: 200, w: 20, h: 40 }); // center → (210, 170)
  const t2 = fakeNode('div', { x: 100, y: 250, w: 100, h: 100 }); // center → (50, 250)

  const overlay = threadOverlay(asEl(host));
  overlay.draw(asEl(from), [asEl(t1), asEl(t2)]);

  const svg = host.children[0]!;
  assert.equal(svg.attrs['viewBox'], '0 0 400 300', 'viewBox sized from the host rect');
  const d = paths(svg);
  assert.equal(d.length, 2, 'one path per target');
  // my = (20 + 170) / 2 = 95 ; (20 + 250) / 2 = 135
  assert.equal(d[0], 'M40 20 C 40 95, 210 95, 210 170');
  assert.equal(d[1], 'M40 20 C 40 135, 50 135, 50 250');
  assert.ok(from.classList.contains('lit'), 'from is lit');
  assert.ok(t1.classList.contains('cited') && t2.classList.contains('cited'), 'targets are cited');
  assert.ok(!from.classList.contains('cited'));
});

test('the --thread channel: set from draw color, removed when omitted', () => {
  const host = fakeHost({ x: 0, y: 0, w: 100, h: 100 });
  const from = fakeNode('div', { x: 0, y: 0, w: 10, h: 10 });
  const overlay = threadOverlay(asEl(host));

  overlay.draw(asEl(from), [], { color: 'oklch(70% 0.2 30)' });
  const svg = host.children[0]!;
  assert.equal(svg.styles['--thread'], 'oklch(70% 0.2 30)');

  overlay.draw(asEl(from), []);
  assert.ok(!('--thread' in svg.styles), 'omitted color removes the property (CSS fallback shows)');
});

test('a re-draw replaces the previous picture: old marks drop, paths re-render', () => {
  const host = fakeHost({ x: 0, y: 0, w: 100, h: 100 });
  const a = fakeNode('div', { x: 0, y: 0, w: 10, h: 10 });
  const b = fakeNode('div', { x: 20, y: 20, w: 10, h: 10 });
  const c = fakeNode('div', { x: 40, y: 40, w: 10, h: 10 });
  const overlay = threadOverlay(asEl(host));

  overlay.draw(asEl(a), [asEl(b)]);
  overlay.draw(asEl(b), [asEl(c)]);
  assert.ok(!a.classList.contains('lit'), 'previous from unmarked');
  assert.ok(!b.classList.contains('cited'), 'previous target unmarked');
  assert.ok(b.classList.contains('lit') && c.classList.contains('cited'));
  assert.equal(paths(host.children[0]!).length, 1, 'paths replaced, not accumulated');
});

test('clear empties paths and removes lit/cited; destroy also removes the SVG and goes inert', () => {
  const host = fakeHost({ x: 0, y: 0, w: 100, h: 100 });
  const from = fakeNode('div', { x: 0, y: 0, w: 10, h: 10 });
  const target = fakeNode('div', { x: 50, y: 50, w: 10, h: 10 });
  const overlay = threadOverlay(asEl(host));

  overlay.draw(asEl(from), [asEl(target)]);
  overlay.clear();
  const svg = host.children[0]!;
  assert.equal(svg.innerHTML, '', 'paths emptied');
  assert.ok(!from.classList.contains('lit') && !target.classList.contains('cited'), 'marks removed');

  overlay.draw(asEl(from), [asEl(target)]);
  overlay.destroy();
  assert.equal(host.children.length, 0, 'SVG removed from the host');
  assert.ok(!from.classList.contains('lit') && !target.classList.contains('cited'), 'destroy clears first');
  overlay.clear(); // inert afterwards — must not throw
});
