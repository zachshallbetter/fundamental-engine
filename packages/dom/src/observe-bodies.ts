/**
 * observeBodyGeometry — the DOM binding of the engine's `FieldHost.observeBodies` seam (#689). A
 * `ResizeObserver` reports box-size changes and an `IntersectionObserver` reports viewport-visibility
 * edges; both funnel into one `markDirty(el)` so the engine re-reads only THAT body's rect instead of
 * polling every body on its measure cadence (`measure: 'observe'`).
 *
 * What observers cannot see, and why the engine keeps a fallback poll: neither observer reports a
 * POSITION change — an ancestor's layout shift or a CSS transform moves a box without resizing it or
 * crossing a visibility threshold. The engine bounds that drift with a slower full re-read; this
 * module only supplies the cheap, precise signals. Feature-detected on the element's own window
 * (`ownerDocument.defaultView`, as `textBodies({ observe })` does) so it is SSR-safe; where neither
 * observer exists the returned disconnect is a no-op and nothing is ever marked. Hosts should omit
 * `observeBodies` entirely when {@link bodyObserversSupported} is false, so the engine degrades to
 * the default poll rather than waiting on marks that never come.
 */

export interface ObserveBodiesOptions {
  /** the IntersectionObserver root — `null` (default) for the viewport; a contained field passes its container. */
  root?: Element | null;
  /** IntersectionObserver `rootMargin`; defaults to `'15%'`, the engine's `H * 0.15` visibility margin. */
  rootMargin?: string;
  /** the window supplying the observer constructors; defaults to the elements' own
   *  (`ownerDocument.defaultView`, then the global). Injectable for tests / detached elements. */
  view?: ObserverView | null;
}

/** The observer constructors a window may expose — typed loosely so a test can inject fakes. */
export interface ObserverView {
  ResizeObserver?: typeof ResizeObserver;
  IntersectionObserver?: typeof IntersectionObserver;
}

/** The window an element belongs to (its `ownerDocument.defaultView`), falling back to the global. */
export function observerViewOf(els: readonly Element[]): ObserverView | null {
  const view = els[0]?.ownerDocument?.defaultView as ObserverView | null | undefined;
  if (view) return view;
  return typeof globalThis === 'undefined' ? null : (globalThis as ObserverView);
}

/**
 * Whether a runtime can dirty-mark body geometry: `ResizeObserver` is the load-bearing signal (size),
 * `IntersectionObserver` a refinement (visibility edges) — so RO alone counts as supported.
 */
export function bodyObserversSupported(view: ObserverView | null | undefined = typeof globalThis === 'undefined' ? null : (globalThis as ObserverView)): boolean {
  return typeof view?.ResizeObserver === 'function';
}

/**
 * Observe `els` for size + visibility changes, calling `markDirty(el)` for each element an observer
 * reports. Returns a disconnect that releases both observers (idempotent). With no observer available
 * on the elements' window this observes nothing and returns a no-op.
 */
export function observeBodyGeometry(
  els: readonly Element[],
  markDirty: (el: Element) => void,
  opts: ObserveBodiesOptions = {},
): () => void {
  const view = opts.view === undefined ? observerViewOf(els) : opts.view;
  const RO = view?.ResizeObserver;
  const IO = view?.IntersectionObserver;
  let ro: ResizeObserver | null = null;
  let io: IntersectionObserver | null = null;
  if (typeof RO === 'function') {
    ro = new RO((entries) => {
      for (const e of entries) markDirty(e.target);
    });
  }
  if (typeof IO === 'function') {
    io = new IO(
      (entries) => {
        for (const e of entries) markDirty(e.target);
      },
      { root: opts.root ?? null, rootMargin: opts.rootMargin ?? '15%', threshold: 0 },
    );
  }
  if (ro === null && io === null) return () => {};
  for (const el of els) {
    ro?.observe(el);
    io?.observe(el);
  }
  return () => {
    ro?.disconnect();
    io?.disconnect();
    ro = null;
    io = null;
  };
}
