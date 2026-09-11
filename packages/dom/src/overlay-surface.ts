/**
 * Overlay surface ergonomics (#721) — the one place the front overlay canvas is created and placed.
 *
 * Field Surfaces draws overlay readings on a SECOND canvas in front of the page content: a fixed,
 * full-viewport, click-through, `aria-hidden` element the core engine draws onto. `<field-root>` and
 * the React binding used to inline the same `cssText` literal; this helper owns that placement so a
 * host that calls `createField` / `createBrowserField` directly gets the identical surface with one
 * call, and can vary the two things hosts actually tune — the blend mode and the stacking level.
 *
 * Sizing: the backing store is CORE's job. When the canvas is handed to `createField` as
 * `overlayCanvas` / `overlayCanvasProvider`, the engine sizes it on every resize, honouring `dprCap`
 * and the quality-tier DPR ceilings. So by default this helper leaves `canvas.width/height` alone —
 * a second writer would clear the surface and ignore those clamps. `autoSize` is the opt-in for a
 * standalone surface drawn by your own code.
 *
 * Visibility gating (`display:none` while no reading is active — the #405/#532 compositing perf
 * guard) stays with the host that knows the overlay state; it is deliberately not part of this helper.
 */

export interface OverlaySurfaceOptions {
  /** CSS `mix-blend-mode` for the surface. Default `'screen'` — today's overlay. */
  blend?: string;
  /** CSS `z-index` for the surface. Default `5` — today's overlay. */
  zIndex?: number | string;
  /** Where the canvas is appended. Default: the document's `<body>`. */
  parent?: Node;
  /** Stamp `data-field-overlay=""` so consumers can target the surface (e.g. a scroll-driven fade)
   *  without reaching into the element's internals. Default `true` — `<field-root>`'s behaviour. */
  marker?: boolean;
  /** Own the backing-store size (initial + on `window` resize, DPR-aware, capped by `dprCap`).
   *  Default `false`: when the canvas is bound to `createField`, core sizes it. Turn on only for a
   *  standalone surface you draw yourself. */
  autoSize?: boolean;
  /** DPR ceiling used when `autoSize` is on. Default `2` (core's `dprCap` default). */
  dprCap?: number;
}

export interface OverlaySurface {
  /** the placed canvas — pass it to `createField` as `overlayCanvas`, or draw on it yourself. */
  canvas: HTMLCanvasElement;
  /** re-run the DPR-aware backing-store size. No-op unless `autoSize` is on. */
  resize(): void;
  /** remove the canvas from the DOM and detach the resize listener. Idempotent. */
  destroy(): void;
}

/** The inline style of the overlay surface with the two tunables interpolated. With the defaults this
 *  is byte-identical to the literal `<field-root>` shipped before #721, so the `mix-blend-mode` perf
 *  lint (`lintCompositingPerf`) keeps recognising the surface from its inline style. */
export function overlaySurfaceCssText(blend = 'screen', zIndex: number | string = 5): string {
  return `position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:${zIndex};mix-blend-mode:${blend}`;
}

type ResizeWindow = Pick<Window, 'innerWidth' | 'innerHeight' | 'devicePixelRatio'> & {
  addEventListener?: Window['addEventListener'];
  removeEventListener?: Window['removeEventListener'];
};

/**
 * Create and place the front overlay surface: a fixed, full-viewport, click-through, `aria-hidden`
 * canvas appended to the document body (or `opts.parent`), marked `data-field-overlay`, with the
 * configured `mix-blend-mode` (default `screen`) and `z-index` (default `5`).
 *
 * `root` is the `Document` to create the canvas in (default `globalThis.document`). Throws when no
 * document is available — an SSR-safe caller guards on `typeof document` first (as `<field-root>` does).
 *
 * @example
 * ```ts
 * const surface = createOverlaySurface(document, { blend: 'multiply', zIndex: 20 });
 * const field = createBrowserField(canvas, { overlay: 'grid', overlayCanvas: surface.canvas });
 * // … later
 * field.destroy();
 * surface.destroy();
 * ```
 */
export function createOverlaySurface(root?: Document | null, opts: OverlaySurfaceOptions = {}): OverlaySurface {
  const doc = root ?? (globalThis as { document?: Document }).document;
  if (!doc) throw new Error('Fundamental: createOverlaySurface needs a document');
  const blend = opts.blend ?? 'screen';
  const zIndex = opts.zIndex ?? 5;
  const canvas = doc.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  // marked so a consumer can target the overlay surface without reaching into the element's internals —
  // it is the only canvas Fundamental adds to the light DOM.
  if (opts.marker !== false) canvas.setAttribute('data-field-overlay', '');
  canvas.style.cssText = overlaySurfaceCssText(blend, zIndex);
  const parent = opts.parent ?? doc.body;
  parent.appendChild(canvas);

  let win: ResizeWindow | undefined;
  let onResize: (() => void) | undefined;
  const dprCap = opts.dprCap && opts.dprCap > 0 ? opts.dprCap : 2;

  const resize = (): void => {
    if (!win) return;
    const w = win.innerWidth;
    const h = win.innerHeight;
    const dpr = Math.min(win.devicePixelRatio || 1, dprCap);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  };

  if (opts.autoSize) {
    win = (doc.defaultView ?? (globalThis as { window?: Window }).window) as ResizeWindow | undefined;
    if (win) {
      resize();
      onResize = resize;
      win.addEventListener?.('resize', onResize);
    }
  }

  let destroyed = false;
  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    if (win && onResize) win.removeEventListener?.('resize', onResize);
    onResize = undefined;
    canvas.remove();
  };

  return { canvas, resize, destroy };
}
