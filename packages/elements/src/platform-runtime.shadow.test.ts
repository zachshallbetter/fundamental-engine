/**
 * Phase D4 — shadow-DOM hosts register for measurement via register/unregister event details, with
 * their custom getRect flowing into MeasurementRegistry. The DOM event wiring is thin glue
 * (browser-verified); the registration logic is pure and tested here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerShadowBody, unregisterShadowBody } from './platform-runtime.ts';
import { FIELD_BOUNDARY_ATTR, type RegisterBodyDetail } from '@fundamental-engine/core';

function fakeSink() {
  const map = new Map<Element, { role?: string; getRect?: () => DOMRect }>();
  return {
    map,
    has: (el: Element) => map.has(el),
    register: (el: Element, opts: { role?: string; getRect?: () => DOMRect } = {}) => void map.set(el, opts),
    unregister: (el: Element) => void map.delete(el),
  };
}

test('registerShadowBody registers the host with role shadow-body and its getRect', () => {
  const sink = fakeSink();
  const host = {} as HTMLElement;
  const getRect = () => ({}) as DOMRect;
  registerShadowBody(sink, { element: host, getRect } as RegisterBodyDetail);
  assert.ok(sink.has(host));
  assert.equal(sink.map.get(host)!.role, 'shadow-body');
  assert.equal(sink.map.get(host)!.getRect, getRect, 'custom rect provider carried through');
});

test('registerShadowBody with no getRect registers the host (measured by its box)', () => {
  const sink = fakeSink();
  const host = {} as HTMLElement;
  registerShadowBody(sink, { element: host } as RegisterBodyDetail);
  assert.ok(sink.has(host));
  assert.equal(sink.map.get(host)!.getRect, undefined);
});

test('unregisterShadowBody removes the host', () => {
  const sink = fakeSink();
  const host = {} as HTMLElement;
  registerShadowBody(sink, { element: host } as RegisterBodyDetail);
  unregisterShadowBody(sink, { element: host } as RegisterBodyDetail);
  assert.equal(sink.has(host), false);
});

test('a detail with no element is ignored (no throw)', () => {
  const sink = fakeSink();
  assert.doesNotThrow(() => registerShadowBody(sink, undefined));
  assert.doesNotThrow(() => unregisterShadowBody(sink, { } as RegisterBodyDetail));
  assert.equal(sink.map.size, 0);
});

// ── scoped participation (shadow-dom.md §17–§19, #681): the measurement lane applies the same
// ownership rule as the engine's ShadowRegistry, so a host the field does not simulate is not
// measured by it either. The runtime's scan root is `documentElement`, so that is the root here.

/** a fake documentElement + a contained card (marked boundary) + a host inside it. */
function fakeTree() {
  const doc = { nodeType: 9 } as unknown as Document;
  const html = { nodeType: 1, ownerDocument: doc, hasAttribute: () => false } as unknown as Element;
  (doc as unknown as { documentElement: Element }).documentElement = html;
  const card = {
    nodeType: 1, ownerDocument: doc,
    hasAttribute: (n: string) => n === FIELD_BOUNDARY_ATTR,
    matches: (sel: string) => sel === '#card',
  } as unknown as Element;
  const host = {
    closest: () => card, // the host's nearest enclosing boundary is the card
    getRootNode: () => doc,
  } as unknown as HTMLElement;
  return { html, card, host };
}

test('PIN: a detail without scope/field registers for measurement even when a root is passed (default unchanged)', () => {
  const sink = fakeSink();
  const { html, host } = fakeTree();
  registerShadowBody(sink, { element: host } as RegisterBodyDetail, html);
  assert.ok(sink.has(host), 'the page runtime measures it, as before');
});

test("scope 'nearest' inside a contained field: the page runtime does NOT measure the host", () => {
  const sink = fakeSink();
  const { html, card, host } = fakeTree();
  registerShadowBody(sink, { element: host, scope: 'nearest' } as RegisterBodyDetail, html);
  assert.equal(sink.has(host), false, 'the card field owns it — no second measurer');
  // a runtime rooted at the card would (the rule is symmetric with ShadowRegistry.bodies)
  registerShadowBody(sink, { element: host, scope: 'nearest' } as RegisterBodyDetail, card);
  assert.ok(sink.has(host));
});

test("field: 'root' portals a contained host INTO the page runtime's measurement; a selector targets the card", () => {
  const sink = fakeSink();
  const { html, card, host } = fakeTree();
  registerShadowBody(sink, { element: host, field: 'root' } as RegisterBodyDetail, html);
  assert.ok(sink.has(host), "'root' = the page field (documentElement root)");
  sink.unregister(host);
  registerShadowBody(sink, { element: host, field: '#card' } as RegisterBodyDetail, html);
  assert.equal(sink.has(host), false, 'a selector the page root does not match → not the page field');
  registerShadowBody(sink, { element: host, field: '#card' } as RegisterBodyDetail, card);
  assert.ok(sink.has(host));
});

test('no root (the pure helper called bare) never filters — backward compatible', () => {
  const sink = fakeSink();
  const { host } = fakeTree();
  registerShadowBody(sink, { element: host, scope: 'nearest', field: '#nowhere' } as RegisterBodyDetail);
  assert.ok(sink.has(host));
});
