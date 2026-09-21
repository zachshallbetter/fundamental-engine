/**
 * browserHost — the default {@link FieldHost}, binding the renderer-agnostic core engine to the
 * browser (`window` / `document` / `requestAnimationFrame`). It lives in `@fundamental-engine/dom` (the DOM
 * participation layer), NOT in `Fundamental` — core imports zero DOM. `createField(canvas, opts)`
 * requires a host; pass `browserHost()` in the browser (or `createBrowserField` for the convenience),
 * or a custom host to drive the same engine from a headless renderer / a different document / a test.
 */
import type { BodyObserver, FieldHost } from '@fundamental-engine/core';
import { prefersReducedMotion, pageHidden } from './env.ts';
import { registerFieldProperties } from './register-properties.ts';

const INPUT_EVENTS = ['pointerdown', 'wheel', 'keydown', 'touchstart'] as const;

/**
 * How far past the viewport the IntersectionObserver still counts an element as "in play" (#689).
 * The engine's own visibility margin is `0.15 * viewportHeight`, and this must be WIDER than that:
 * IO is a dirty *signal*, not the measurement, so a body must be reported as changed strictly before
 * it can cross the engine's own boundary. Under-shooting here would let a body slip across that
 * boundary unobserved and wait for the safety cadence — visible as a body engaging a few frames late.
 */
const BODY_IO_MARGIN = '25%';

/**
 * Thresholds at both ends: `0` fires on the entering/leaving edge, `1` fires when a body becomes (or
 * stops being) wholly visible. Two entries, not a ramp — every extra threshold is another callback
 * during a scroll, and the callback's only job is to set one boolean.
 */
const BODY_IO_THRESHOLDS = [0, 1];

/**
 * ResizeObserver + IntersectionObserver over the body elements (#689) — the browser backing for
 * `FieldHost.observeBodies`. RO reports a body changing SIZE; IO reports one crossing the viewport
 * (which is also the cheapest way to notice scroll actually mattered to a given body). Neither
 * reports a body that merely MOVED, which is why the engine keeps a slow safety poll behind this.
 *
 * Both observers fire once per element on `observe()`, so the engine starts dirty and measures on its
 * first cadence tick — the same frame it would have anyway.
 *
 * Returns `undefined` when either constructor is missing (older browsers, some test DOMs). The
 * capability is optional by contract, so the engine simply keeps polling: a host that cannot observe
 * is the historical behaviour, not a broken one.
 */
function bodyObserverFactory(): FieldHost['observeBodies'] {
  if (typeof ResizeObserver !== 'function' || typeof IntersectionObserver !== 'function') return undefined;
  return (cb: (changed: readonly Element[]) => void): BodyObserver => {
    const ro = new ResizeObserver((entries) => cb(entries.map((e) => e.target)));
    const io = new IntersectionObserver((entries) => cb(entries.map((e) => e.target)), {
      rootMargin: BODY_IO_MARGIN,
      threshold: BODY_IO_THRESHOLDS,
    });
    return {
      observe: (el) => {
        ro.observe(el);
        io.observe(el);
      },
      unobserve: (el) => {
        ro.unobserve(el);
        io.unobserve(el);
      },
      disconnect: () => {
        ro.disconnect();
        io.disconnect();
      },
    };
  };
}

/** Build a FieldHost backed by `window` / `document`. */
export function browserHost(): FieldHost {
  // Register the field-density channels as typed, compositor-interpolable CSS properties once at
  // boot so consumers can transition/animate var(--field-density)/var(--d). No-op if unsupported.
  registerFieldProperties();
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
    onResize: (cb: () => void) => {
      window.addEventListener('resize', cb, { passive: true });
      return () => window.removeEventListener('resize', cb);
    },
    onScroll: (cb: () => void) => {
      window.addEventListener('scroll', cb, { passive: true });
      return () => window.removeEventListener('scroll', cb);
    },
    onVisibility: (cb: () => void) => {
      document.addEventListener('visibilitychange', cb);
      return () => document.removeEventListener('visibilitychange', cb);
    },
    onInput: (cb: () => void) => {
      for (const ev of INPUT_EVENTS) window.addEventListener(ev, cb, { passive: true });
      return () => {
        for (const ev of INPUT_EVENTS) window.removeEventListener(ev, cb);
      };
    },
    onBodyEvent: (type: string, cb: (e: Event) => void) => {
      document.addEventListener(type, cb);
      return () => document.removeEventListener(type, cb);
    },
    // omitted entirely (not a no-op) where the observers do not exist, so the engine can tell
    // "no observation" from "observation that never fires" (#689).
    observeBodies: bodyObserverFactory(),
  };
}
