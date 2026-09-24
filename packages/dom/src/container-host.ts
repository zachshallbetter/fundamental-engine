/**
 * containerHost — a {@link FieldHost} scoped to a single element instead of the window (#540). The
 * field, its bodies, and its canvas all live in the container's local coordinate space: `viewport()`
 * returns the element's size + its `left,top` as the field-space origin, `root` scans only inside the
 * element, and scroll/resize/input are observed on the element. This is the supported way to render a
 * CONTAINED, card-sized field — pass `bounds: el` to `createField`/`FieldField`, or wire it directly:
 * `createField(canvas, { host: containerHost(card) })`. The first concrete `FieldSurface` (#539).
 */
import { FIELD_BOUNDARY_ATTR, type FieldHost } from '@fundamental-engine/core';
import { prefersReducedMotion, pageHidden } from './env.ts';

const INPUT_EVENTS = ['pointerdown', 'wheel', 'keydown', 'touchstart'] as const;

/**
 * How far outside the viewport a contained field still counts as on-screen (#672 lane S2). A card
 * resumes slightly *before* it scrolls into view, so the first frame a reader sees is a running
 * field rather than a cold start.
 */
const CONTAINER_VISIBILITY_MARGIN = '20%';

/** Options for {@link containerHost}. */
export interface ContainerHostOptions {
  /**
   * Stop the field's frame loop entirely while the container is off-screen (default `true`).
   *
   * A contained field is scoped to one box, so when that box is out of view **nothing** it produces
   * has a consumer: its feedback variables are written to elements nobody can see, its events fire
   * for a card nobody is looking at. Without this, N cards on a page are N always-running rAF loops,
   * each doing a full simulation, measurement and feedback pass every frame.
   *
   * This is deliberately stronger than `<field-root>`'s own IntersectionObserver, which calls
   * `setVisible(false)` — and `setVisible` gates the DRAW and nothing else (it sets `canvasVisible`,
   * read only by the draw block; the simulation, measurement and feedback writes carry on). Draw-only
   * is the right answer for the page field: it is `position:fixed; inset:0`, so "not intersecting"
   * means hidden or zero-sized rather than scrolled away, and its signals — scroll velocity, feedback
   * vars, events — drive the whole page and must keep running. A contained field has neither property,
   * so it reports `hidden()` instead, which is the contract the engine answers by cancelling its rAF.
   *
   * Set `false` when a card's field must keep simulating off-screen — it is feeding a read-out
   * elsewhere on the page, or a `snapshot()` that must not have a gap. The host then reports only the
   * page's own visibility, exactly as it did before this option existed.
   */
  pauseOffscreen?: boolean;
}

/** Build a FieldHost scoped to `el` — a contained field in the element's local coordinate space. */
export function containerHost(el: HTMLElement, opts: ContainerHostOptions = {}): FieldHost {
  // Nearest-enclosing-field ownership (#980): mark the bounds element as a field boundary at
  // attach, so an OUTER field's scan (the page `<field-root>` scans `document`) skips the bodies
  // this contained field owns — two engines writing `--d` on the same elements is the per-frame
  // flicker this prevents. Idempotent (setting an already-set marker is a no-op; a re-attach after
  // destroy simply re-marks); `detach()` removes it so the outer field re-adopts on rescan.
  el.setAttribute(FIELD_BOUNDARY_ATTR, '');
  // Viewport gating for the contained field (C-4). `onScreen` starts TRUE so a host whose observer
  // never arrives — no `IntersectionObserver`, or `pauseOffscreen: false` — behaves exactly as
  // before: the field runs, and only the page's own visibility can pause it. The observer is created
  // inside `onVisibility`, because that subscription is what gives us a way to tell the engine.
  const gate = (opts.pauseOffscreen ?? true) && typeof IntersectionObserver !== 'undefined';
  let onScreen = true;
  return {
    root: el,
    detach: () => el.removeAttribute(FIELD_BOUNDARY_ATTR),
    viewport: () => {
      const r = el.getBoundingClientRect();
      // originX/Y = the container's viewport position → bodies/threads/moves are measured
      // container-local (their window rects minus this origin); the canvas is drawn in the same space.
      return { width: r.width, height: r.height, dpr: window.devicePixelRatio || 1, originX: r.left, originY: r.top };
    },
    scrollY: () => el.scrollTop,
    scrollHeight: () => el.scrollHeight,
    reducedMotion: () => prefersReducedMotion(),
    // A contained field is hidden when the PAGE is hidden or when its own box is out of view. The
    // engine's `hidden()` contract is "pause all work" — it cancels the rAF — which is the right
    // answer for a card nobody can see, and the reason this is `hidden()` rather than `setVisible()`.
    hidden: () => pageHidden() || !onScreen,
    raf: (cb: (t: number) => void) => requestAnimationFrame(cb),
    cancelRaf: (id: number) => cancelAnimationFrame(id),
    createCanvas: () => document.createElement('canvas'),
    onResize: (cb: () => void) => {
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
    onScroll: (cb: () => void) => {
      // content scrolling INSIDE the container, plus page scroll (which moves the container in the
      // viewport → its origin shifts). The engine re-reads the origin each frame for a contained field.
      el.addEventListener('scroll', cb, { passive: true });
      window.addEventListener('scroll', cb, { passive: true });
      return () => {
        el.removeEventListener('scroll', cb);
        window.removeEventListener('scroll', cb);
      };
    },
    onVisibility: (cb: () => void) => {
      document.addEventListener('visibilitychange', cb);
      // The element's own visibility, alongside the page's. IO delivers an initial entry on observe,
      // so `onScreen` is corrected within a frame of subscribing rather than waiting for a scroll.
      let io: IntersectionObserver | undefined;
      if (gate) {
        io = new IntersectionObserver(
          (entries) => {
            const next = entries.some((e) => e.isIntersecting);
            if (next === onScreen) return; // no edge, no work: IO fires on every threshold crossing
            onScreen = next;
            cb();
          },
          { rootMargin: CONTAINER_VISIBILITY_MARGIN },
        );
        io.observe(el);
      }
      return () => {
        document.removeEventListener('visibilitychange', cb);
        io?.disconnect();
        // A torn-down observer can never report again, so leave the gate OPEN rather than latched
        // shut — a host that is unsubscribed but still queried must not claim to be hidden forever.
        onScreen = true;
      };
    },
    onInput: (cb: () => void) => {
      // interaction within the container drives its field (not the whole window).
      for (const ev of INPUT_EVENTS) el.addEventListener(ev, cb, { passive: true });
      return () => {
        for (const ev of INPUT_EVENTS) el.removeEventListener(ev, cb);
      };
    },
    onBodyEvent: (type: string, cb: (e: Event) => void) => {
      el.addEventListener(type, cb);
      return () => el.removeEventListener(type, cb);
    },
  };
}
