import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_BOUNDARY_ATTR } from '@fundamental-engine/core';
import { containerHost } from './container-host.ts';

/** Stub the browser globals containerHost reads (it is browser code; this exercises the contract). */
function withWindow<T>(dpr: number, fn: () => T): T {
  const g = globalThis as { window?: unknown; ResizeObserver?: unknown };
  const prevWin = g.window;
  const prevRO = g.ResizeObserver;
  g.window = { devicePixelRatio: dpr, addEventListener() {}, removeEventListener() {} };
  g.ResizeObserver = class { observe() {} disconnect() {} };
  try {
    return fn();
  } finally {
    g.window = prevWin;
    g.ResizeObserver = prevRO;
  }
}

test('containerHost.viewport returns the container size + its left/top as the field-space origin (#540)', () => {
  withWindow(2, () => {
    const attrs = new Map<string, string>();
    const el = {
      getBoundingClientRect: () => ({ left: 200, top: 100, width: 360, height: 240 }),
      scrollTop: 12,
      scrollHeight: 800,
      addEventListener() {},
      removeEventListener() {},
      setAttribute: (n: string, v: string) => attrs.set(n, v),
      removeAttribute: (n: string) => attrs.delete(n),
      hasAttribute: (n: string) => attrs.has(n),
    } as unknown as HTMLElement;
    const host = containerHost(el);
    const vp = host.viewport();
    assert.equal(vp.width, 360);
    assert.equal(vp.height, 240);
    assert.equal(vp.dpr, 2);
    assert.equal(vp.originX, 200, 'origin tracks the container left → bodies measured container-local');
    assert.equal(vp.originY, 100, 'origin tracks the container top');
    assert.equal(host.root, el, 'scans within the container, not the document');
    assert.equal(host.scrollY(), 12, 'scroll is the container scroll, not window');
    assert.equal(host.scrollHeight(), 800);
  });
});

test('containerHost marks its bounds as a field boundary at attach; detach removes it (#980)', () => {
  withWindow(1, () => {
    const attrs = new Map<string, string>();
    const el = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
      addEventListener() {},
      removeEventListener() {},
      setAttribute: (n: string, v: string) => attrs.set(n, v),
      removeAttribute: (n: string) => attrs.delete(n),
      hasAttribute: (n: string) => attrs.has(n),
    } as unknown as HTMLElement;
    const host = containerHost(el);
    assert.ok(attrs.has(FIELD_BOUNDARY_ATTR), 'attach marks the bounds — outer scans skip its bodies');
    host.detach!();
    assert.ok(!attrs.has(FIELD_BOUNDARY_ATTR), 'destroy unmarks — the page field re-adopts on rescan');
    host.detach!(); // idempotent
    assert.ok(!attrs.has(FIELD_BOUNDARY_ATTR));
    containerHost(el); // re-attach after destroy re-marks
    assert.ok(attrs.has(FIELD_BOUNDARY_ATTR));
  });
});
