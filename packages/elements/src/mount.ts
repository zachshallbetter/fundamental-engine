/**
 * The framework-free vanilla adapter (Phase 7) — mount the reciprocal field with a
 * single function call, no custom element required. Creates a fixed, full-viewport
 * canvas behind the page, starts the engine on it, and returns the `FieldHandle`
 * (whose `destroy()` also removes the canvas it made).
 *
 * It's the same engine `<forces-field>` wraps; this is for plain scripts and
 * imperative mounts (`const field = mountField(); field.scan()`).
 */

import { createField, type FieldHandle, type FieldOptions } from 'forces-ui';

export interface MountOptions extends FieldOptions {
  /** where to append the canvas; defaults to `document.body`. */
  target?: HTMLElement;
}

/** Mount and start the field; returns the handle. `destroy()` also removes the canvas. */
export function mountField(opts: MountOptions = {}): FieldHandle {
  const { target = document.body, ...fieldOpts } = opts;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true'); // decorative field (§18 a11y)
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block';
  target.appendChild(canvas);
  const field = createField(canvas, fieldOpts);
  return {
    ...field,
    destroy: () => {
      field.destroy();
      canvas.remove();
    },
  };
}
