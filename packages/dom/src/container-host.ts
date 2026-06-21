/**
 * containerHost — a {@link FieldHost} scoped to a single element instead of the window (#540). The
 * field, its bodies, and its canvas all live in the container's local coordinate space: `viewport()`
 * returns the element's size + its `left,top` as the field-space origin, `root` scans only inside the
 * element, and scroll/resize/input are observed on the element. This is the supported way to render a
 * CONTAINED, card-sized field — pass `bounds: el` to `createField`/`FieldField`, or wire it directly:
 * `createField(canvas, { host: containerHost(card) })`. The first concrete `FieldSurface` (#539).
 */
import type { FieldHost } from '@fundamental-engine/core';
import { prefersReducedMotion, pageHidden } from './env.ts';

const INPUT_EVENTS = ['pointerdown', 'wheel', 'keydown', 'touchstart'] as const;

/** Build a FieldHost scoped to `el` — a contained field in the element's local coordinate space. */
export function containerHost(el: HTMLElement): FieldHost {
  return {
    root: el,
    viewport: () => {
      const r = el.getBoundingClientRect();
      // originX/Y = the container's viewport position → bodies/threads/moves are measured
      // container-local (their window rects minus this origin); the canvas is drawn in the same space.
      return { width: r.width, height: r.height, dpr: window.devicePixelRatio || 1, originX: r.left, originY: r.top };
    },
    scrollY: () => el.scrollTop,
    scrollHeight: () => el.scrollHeight,
    reducedMotion: () => prefersReducedMotion(),
    hidden: () => pageHidden(),
    raf: (cb) => requestAnimationFrame(cb),
    cancelRaf: (id) => cancelAnimationFrame(id),
    createCanvas: () => document.createElement('canvas'),
    onResize: (cb) => {
      // a container can resize without the window doing so → ResizeObserver; window resize can still
      // move it (re-layout), so keep that too.
      const ro = new ResizeObserver(cb);
      ro.observe(el);
      window.addEventListener('resize', cb, { passive: true });
      return () => {
        ro.disconnect();
        window.removeEventListener('resize', cb);
      };
    },
    onScroll: (cb) => {
      // content scrolling INSIDE the container, plus page scroll (which moves the container in the
      // viewport → its origin shifts). The engine re-reads the origin each frame for a contained field.
      el.addEventListener('scroll', cb, { passive: true });
      window.addEventListener('scroll', cb, { passive: true });
      return () => {
        el.removeEventListener('scroll', cb);
        window.removeEventListener('scroll', cb);
      };
    },
    onVisibility: (cb) => {
      document.addEventListener('visibilitychange', cb);
      return () => document.removeEventListener('visibilitychange', cb);
    },
    onInput: (cb) => {
      // interaction within the container drives its field (not the whole window).
      for (const ev of INPUT_EVENTS) el.addEventListener(ev, cb, { passive: true });
      return () => {
        for (const ev of INPUT_EVENTS) el.removeEventListener(ev, cb);
      };
    },
    onBodyEvent: (type, cb) => {
      el.addEventListener(type, cb);
      return () => el.removeEventListener(type, cb);
    },
  };
}
