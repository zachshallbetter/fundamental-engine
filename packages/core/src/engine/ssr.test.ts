/**
 * SSR / hydration safety (RC-5 — #322): the engine must be importable and constructable on the server,
 * where there is no `document`/`window`. Core imports ZERO DOM (enforced by `dom-boundary.test.ts`); all
 * environment access goes through the injected `FieldHost`. This test pins the consequence: with the DOM
 * globals genuinely absent, the public entry imports and a field constructs + tears down on an injected
 * host — so a field created during render() never reaches for a DOM that isn't there.
 *
 * (The DOM-binding packages run their rendering client-side; this guards the core seam they all build on.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField } from './field.ts';
import type { FieldHost } from './host.ts';

function serverHost(): FieldHost {
  const off = (): void => {};
  return {
    root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
    viewport: () => ({ width: 1280, height: 800, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => 1280,
    reducedMotion: () => false,
    hidden: () => false,
    raf: () => 0,
    cancelRaf: off,
    createCanvas: () => ({}) as unknown as HTMLCanvasElement,
    onResize: () => off,
    onScroll: () => off,
    onVisibility: () => off,
    onInput: () => off,
    onBodyEvent: () => off,
  };
}

test('the runtime environment has no DOM globals (this IS a server-like context)', () => {
  assert.equal(typeof document, 'undefined', 'no document — server-like');
  assert.equal(typeof window, 'undefined', 'no window — server-like');
});

test('a field constructs, runs its API, and destroys on the server (no DOM touched)', () => {
  // render:'none' is the SSR-natural mode: no context, no backing store, pure signals.
  const field = createField({} as HTMLCanvasElement, { host: serverHost(), render: 'none' });
  assert.doesNotThrow(() => {
    field.particleCount();
    field.scan();
    field.scrollV();
    field.setVisible(false);
  }, 'the public surface is callable without a DOM');
  assert.doesNotThrow(() => field.destroy(), 'teardown needs no DOM either');
});
