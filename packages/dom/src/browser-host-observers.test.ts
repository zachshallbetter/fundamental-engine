/**
 * `browserHost().observeBodies` (#689) — the ResizeObserver + IntersectionObserver backing for
 * body-geometry observation. Core's own tests drive a FAKE observing host; these pin the real
 * browser wiring, which is the part that can only be wrong here: that BOTH observers are attached
 * (RO alone misses a body scrolling into view, IO alone misses one being resized in place), that the
 * IO margin is wider than the engine's own visibility margin, and that an environment without the
 * constructors reports NO capability rather than a broken one.
 *
 * browserHost is browser code; these stub the globals it reads, as container-host.test.ts does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostCapabilities } from '@fundamental-engine/core';
import { browserHost } from './browser-host.ts';

interface Rec { targets: unknown[]; opts?: unknown; disconnected: number; unobserved: unknown[] }

function withBrowser<T>(opts: { observers: boolean }, fn: (ro: Rec, io: Rec) => T): T {
  const g = globalThis as Record<string, unknown>;
  const saved = ['window', 'document', 'ResizeObserver', 'IntersectionObserver'].map((k) => [k, g[k]] as const);
  const ro: Rec = { targets: [], disconnected: 0, unobserved: [] };
  const io: Rec = { targets: [], disconnected: 0, unobserved: [] };
  g.window = { innerWidth: 1000, innerHeight: 800, devicePixelRatio: 1, scrollY: 0, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
  g.document = { documentElement: { scrollHeight: 2000 }, addEventListener() {}, removeEventListener() {}, createElement: () => ({}), visibilityState: 'visible' };
  const make = (rec: Rec) =>
    class {
      constructor(_cb: unknown, o?: unknown) { rec.opts = o; }
      observe(t: unknown) { rec.targets.push(t); }
      unobserve(t: unknown) { rec.unobserved.push(t); }
      disconnect() { rec.disconnected++; }
    };
  g.ResizeObserver = opts.observers ? make(ro) : undefined;
  g.IntersectionObserver = opts.observers ? make(io) : undefined;
  try {
    return fn(ro, io);
  } finally {
    for (const [k, v] of saved) { if (v === undefined) delete g[k]; else g[k] = v; }
  }
}

test('browserHost observes each body with BOTH a ResizeObserver and an IntersectionObserver', () => {
  withBrowser({ observers: true }, (ro, io) => {
    const host = browserHost();
    assert.equal(hostCapabilities(host).bodyObservation, true);
    const handle = host.observeBodies!(() => {});
    const el = { tag: 'a' } as unknown as Element;
    handle.observe(el);
    // both, and neither is redundant: RO alone never fires for a body scrolled into view, IO alone
    // never fires for a body resized in place.
    assert.deepEqual(ro.targets, [el], 'ResizeObserver watches the element');
    assert.deepEqual(io.targets, [el], 'IntersectionObserver watches it too');
    handle.unobserve(el);
    assert.deepEqual(ro.unobserved, [el]);
    assert.deepEqual(io.unobserved, [el]);
    handle.disconnect();
    assert.equal(ro.disconnected, 1);
    assert.equal(io.disconnected, 1);
  });
});

test("the IO margin is wider than the engine's own visibility margin, so nothing crosses unreported", () => {
  withBrowser({ observers: true }, (_ro, io) => {
    browserHost().observeBodies!(() => {});
    const o = io.opts as { rootMargin: string; threshold: number[] };
    const pct = Number.parseFloat(o.rootMargin);
    // measureBodyGeometry culls at 0.15 * viewportHeight. IO is only a dirty SIGNAL, so it has to
    // fire strictly before a body can cross that line — an equal margin would be a race.
    assert.ok(pct > 15, `IO margin ${o.rootMargin} must exceed the engine's 15% cull margin`);
    assert.deepEqual(o.threshold, [0, 1], 'both edges: entering/leaving, and wholly-visible');
  });
});

test('no observer constructors ⇒ the capability is absent, not broken', () => {
  withBrowser({ observers: false }, () => {
    const host = browserHost();
    assert.equal(host.observeBodies, undefined, 'omitted entirely — the engine keeps polling');
    assert.equal(hostCapabilities(host).bodyObservation, false);
  });
});
