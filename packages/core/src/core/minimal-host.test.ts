/**
 * MinimalFieldHost — graceful degradation. Proves the engine runs against the SMALLEST host surface:
 * only `root`, `viewport()`, `raf()`, `cancelRaf()` — NO optional capabilities (no scroll, reduced-
 * motion, visibility, canvas, or any subscription). The field must still simulate + feed back per
 * frame; absent capabilities degrade to their safe defaults instead of throwing. This is the
 * "host conformance" floor: geometry + time is enough to run headless.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import { hostCapabilities, defineHost } from './host.ts';
import type { MinimalFieldHost, FieldHost } from './host.ts';

/** The four-member floor: geometry (root + viewport) and time (raf/cancelRaf). Nothing else. */
function minimalHost(width = 800, height = 600): MinimalFieldHost & { tick(t?: number): void } {
  let frame: ((t: number) => void) | null = null;
  let t = 0;
  const root = {
    querySelectorAll: () => [] as unknown as NodeListOf<Element>,
    querySelector: () => null,
    contains: () => false,
  } as unknown as ParentNode;
  return {
    root,
    viewport: () => ({ width, height, dpr: 1 }),
    raf: (cb) => {
      frame = cb;
      return 1;
    },
    cancelRaf: () => {
      frame = null;
    },
    tick(at) {
      t = at ?? t + 1000 / 60;
      const cb = frame;
      frame = null;
      cb?.(t);
    },
  };
}

test('a field runs against a MinimalFieldHost with zero optional capabilities', () => {
  const host = minimalHost();
  // render:'none' → the field never asks for a canvas; signals-first is the headless baseline.
  const field = createField(undefined, { host: host as FieldHost, render: 'none', waves: false });

  // add a programmatic body (no [data-body] DOM — the minimal host has an empty scan root) and a
  // stepped agent, then advance several frames. Nothing should throw despite the absent capabilities.
  field.addBody({ tokens: ['attract'], rect: () => ({ left: 380, top: 280, width: 40, height: 40 }) });
  const agent = field.addAgent({ x: 100, y: 100, report: () => {} });

  for (let i = 0; i < 10; i++) host.tick();

  // the agent is engine-stepped, so it counts toward the pool; the field is live.
  assert.ok(field.particleCount() >= 1, 'field simulates against the minimal host');
  agent.remove();
  field.destroy();
});

test('hostCapabilities reports the minimal host as geometry+time only', () => {
  const caps = hostCapabilities(minimalHost() as FieldHost);
  assert.equal(caps.geometry, true);
  assert.equal(caps.time, true);
  assert.equal(caps.scroll, false);
  assert.equal(caps.canvas, false);
  assert.equal(caps.reducedMotion, false);
  assert.equal(caps.visibility, false);
  assert.equal(caps.events, false);
  assert.equal(caps.bodyEvents, false);
});

test('defineHost fills no-op subscription defaults from a minimal host', () => {
  let resized = false;
  const host = defineHost({
    ...minimalHost(),
    // supply exactly one optional capability; the rest default to no-op unsubscribers.
    onResize: (cb) => {
      resized = true;
      cb();
      return () => {};
    },
  });
  // every subscription member is now callable (never undefined) and returns an unsubscribe.
  assert.equal(typeof host.onResize, 'function');
  assert.equal(typeof host.onScroll, 'function');
  assert.equal(typeof host.onVisibility, 'function');
  assert.equal(typeof host.onInput, 'function');
  assert.equal(typeof host.onBodyEvent, 'function');
  const off = host.onScroll!(() => {});
  assert.equal(typeof off, 'function');
  off();
  // the provided capability is preserved and wired through.
  host.onResize!(() => {});
  assert.equal(resized, true);

  const caps = hostCapabilities(host);
  assert.equal(caps.events, true, 'defineHost hosts always expose the subscription surface');
});
