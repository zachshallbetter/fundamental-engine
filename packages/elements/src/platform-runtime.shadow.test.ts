/**
 * Phase D4 — shadow-DOM hosts register for measurement via register/unregister event details, with
 * their custom getRect flowing into MeasurementRegistry. The DOM event wiring is thin glue
 * (browser-verified); the registration logic is pure and tested here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerShadowBody, unregisterShadowBody } from './platform-runtime.ts';
import type { RegisterBodyDetail } from '@field-ui/core';

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
