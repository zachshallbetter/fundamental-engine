/**
 * browserHost — the default {@link FieldHost}, binding the renderer-agnostic core engine to the
 * browser (`window` / `document` / `requestAnimationFrame`). It lives in `@fundamental-engine/dom` (the DOM
 * participation layer), NOT in `Fundamental` — core imports zero DOM. `createField(canvas, opts)`
 * requires a host; pass `browserHost()` in the browser (or `createBrowserField` for the convenience),
 * or a custom host to drive the same engine from a headless renderer / a different document / a test.
 */
import type { FieldHost } from '@fundamental-engine/core';
import { prefersReducedMotion, pageHidden } from './env.ts';

const INPUT_EVENTS = ['pointerdown', 'wheel', 'keydown', 'touchstart'] as const;

/** Build a FieldHost backed by `window` / `document`. */
export function browserHost(): FieldHost {
  return {
    root: document,
    viewport: () => ({ width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 }),
    scrollY: () => window.scrollY || 0,
    scrollHeight: () => document.documentElement.scrollHeight,
    reducedMotion: () => prefersReducedMotion(),
    hidden: () => pageHidden(),
    raf: (cb) => requestAnimationFrame(cb),
    cancelRaf: (id) => cancelAnimationFrame(id),
    createCanvas: () => document.createElement('canvas'),
    onResize: (cb) => {
      window.addEventListener('resize', cb, { passive: true });
      return () => window.removeEventListener('resize', cb);
    },
    onScroll: (cb) => {
      window.addEventListener('scroll', cb, { passive: true });
      return () => window.removeEventListener('scroll', cb);
    },
    onVisibility: (cb) => {
      document.addEventListener('visibilitychange', cb);
      return () => document.removeEventListener('visibilitychange', cb);
    },
    onInput: (cb) => {
      for (const ev of INPUT_EVENTS) window.addEventListener(ev, cb, { passive: true });
      return () => {
        for (const ev of INPUT_EVENTS) window.removeEventListener(ev, cb);
      };
    },
    onBodyEvent: (type, cb) => {
      document.addEventListener(type, cb);
      return () => document.removeEventListener(type, cb);
    },
  };
}
