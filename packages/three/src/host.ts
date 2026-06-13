/**
 * `threeHost` — the `FieldHost` for a WebGL scene. The engine is renderer-agnostic: it reaches the
 * environment (viewport, animation frame, visibility, input) only through an injected host. This is
 * the host a Three.js embedding wires — close to `browserHost()`, but the field's viewport comes
 * from the projection (the field's own pixel space), not `window.innerWidth`, and page-scroll
 * coupling is off by default (a 3D field has no document scroll unless you opt in).
 *
 * `@fundamental-engine/three` is an authoring surface, so unlike `@fundamental-engine/core` it may touch the DOM — the
 * browser globals here are the same ones any Three.js app already depends on.
 */

import type { FieldHost, HostViewport } from '@fundamental-engine/core';

/** A scan root that exposes no `[data-body]` elements — the default for a synthetic / 3D field. */
const EMPTY_ROOT = {
  querySelectorAll: () => [] as unknown as NodeListOf<Element>,
  querySelector: () => null,
} as unknown as ParentNode;

export interface ThreeHostOptions {
  /** field-space viewport (CSS pixels) + device-pixel ratio. Wire this to your `FieldProjection`. */
  viewport: () => HostViewport;
  /** the subtree scanned for `[data-body]` bodies; omit for a field with no DOM bodies. */
  root?: ParentNode;
  /** opt page scroll into the field (drives `scrollV()` / the `scrolling` gate); default off. */
  scrollY?: () => number;
  /** total scrollable height when scroll is opted in; defaults to the viewport height. */
  scrollHeight?: () => number;
}

export function threeHost(opts: ThreeHostOptions): FieldHost {
  const root = opts.root ?? EMPTY_ROOT;
  const events = (root as Partial<EventTarget> & ParentNode).addEventListener
    ? (root as unknown as EventTarget)
    : typeof document !== 'undefined'
      ? document
      : null;

  return {
    root,
    viewport: opts.viewport,
    scrollY: opts.scrollY ?? (() => 0),
    scrollHeight: opts.scrollHeight ?? (() => Math.max(1, opts.viewport().height)),
    reducedMotion: () =>
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    hidden: () => typeof document !== 'undefined' && document.hidden,
    raf: (cb) => requestAnimationFrame(cb),
    cancelRaf: (id) => cancelAnimationFrame(id),
    createCanvas: () => document.createElement('canvas'),
    onResize: (cb) => {
      window.addEventListener('resize', cb, { passive: true });
      return () => window.removeEventListener('resize', cb);
    },
    // a 3D field is not coupled to document scroll by default — opt in via host options if wanted.
    onScroll: () => () => {},
    onVisibility: (cb) => {
      if (typeof document === 'undefined') return () => {};
      document.addEventListener('visibilitychange', cb);
      return () => document.removeEventListener('visibilitychange', cb);
    },
    onInput: (cb) => {
      const evs = ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart'];
      for (const e of evs) window.addEventListener(e, cb, { passive: true });
      return () => {
        for (const e of evs) window.removeEventListener(e, cb);
      };
    },
    onBodyEvent: (type, cb) => {
      if (!events) return () => {};
      events.addEventListener(type, cb);
      return () => events.removeEventListener(type, cb);
    },
  };
}
