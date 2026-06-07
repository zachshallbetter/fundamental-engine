/**
 * browserHost — the default {@link FieldHost}, binding the engine to the browser (`window` /
 * `document` / `requestAnimationFrame`). This is the one core module that touches DOM globals at
 * runtime, isolated here on purpose: the engine in `field.ts` is renderer-agnostic and routes
 * everything through the host, so all of core's DOM surface is this small, explicit adapter. It is
 * the allowlisted exception in `dom-boundary.test.ts`. `createField` builds one of these by default;
 * pass `opts.host` to drive the same engine from a different environment.
 */
import type { FieldHost } from './host.ts';

const INPUT_EVENTS = ['pointerdown', 'wheel', 'keydown', 'touchstart'] as const;

/** Build a FieldHost backed by `window` / `document`. */
export function browserHost(): FieldHost {
  return {
    root: document,
    viewport: () => ({ width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 }),
    scrollY: () => window.scrollY || 0,
    scrollHeight: () => document.documentElement.scrollHeight,
    reducedMotion: () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    hidden: () => document.hidden,
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
