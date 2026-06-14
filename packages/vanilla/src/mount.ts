/**
 * `mountField` — the framework-free imperative mount (no custom element, no framework).
 *
 * Creates a fixed, full-viewport canvas behind the page, starts the engine on it, and
 * returns the `FieldHandle` (whose `destroy()` also removes the canvas it made). It is the
 * same engine the `<field-root>` custom element and the React `<FieldField>` wrap, for
 * plain scripts and imperative mounts: `const field = mountField(); field.scan()`.
 *
 * This is the canonical home of the imperative mount; `@fundamental-engine/elements` re-exports it.
 * For object-oriented ergonomics (and driving a canvas you own), see the `FieldField` class.
 */

import { FIELD_CANVAS_CSS, type FieldHandle, type FieldOptions } from '@fundamental-engine/core';
import { createBrowserField } from '@fundamental-engine/platform';

export interface MountOptions extends FieldOptions {
  /** where to append the canvas; defaults to `document.body`. */
  target?: HTMLElement;
}

/**
 * Throw a clear error when there is no DOM (server-side render or build step). The field is a
 * browser-only, client-side effect; construct it on the client (a `useEffect` / `onMount` /
 * "client only" boundary), never during SSR. Call before any `document`/`window` access.
 */
export function assertBrowser(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error(
      'Fundamental: the field runs in the browser only. Create it on the client (inside ' +
        'useEffect / onMount / a "client only" boundary), not during server-side rendering.'
    );
  }
}

/**
 * Create the fixed, full-viewport, decorative canvas the managed mounts run on. Internal —
 * shared by `mountField` and the `FieldField` class so the styling lives in one place.
 */
export function makeFieldCanvas(target: HTMLElement = document.body): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true'); // decorative field (§18 a11y)
  canvas.style.cssText = FIELD_CANVAS_CSS; // single source of truth (core/surface.ts)
  target.appendChild(canvas);
  return canvas;
}

/** Mount and start the field; returns the handle. `destroy()` also removes the canvas. */
export function mountField(opts: MountOptions = {}): FieldHandle {
  assertBrowser();
  const { target = document.body, ...fieldOpts } = opts;
  const canvas = makeFieldCanvas(target);
  const field = createBrowserField(canvas, fieldOpts);
  return {
    ...field,
    destroy: () => {
      field.destroy();
      canvas.remove();
    },
  };
}
