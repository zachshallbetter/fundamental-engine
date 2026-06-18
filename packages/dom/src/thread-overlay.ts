/**
 * threadOverlay — the hover-thread SVG overlay extracted from the invisible-fields example
 * runtimes (the `wireThreads`/`centerIn` pattern in the Evidence page, adapted by the Backlog
 * board and the Dependencies spill). Three hand-rolled copies drew the same picture; this is
 * the common core: an absolutely-positioned, `aria-hidden`, pointer-events-none SVG prepended
 * into a host, with one cubic-bezier path per (from → target) edge and the family's `lit` /
 * `cited` class marks on the endpoints.
 *
 * GEOMETRY + CLASSES ONLY — no event wiring. The pages own hover semantics (pointerenter →
 * `draw`, pointerleave → `clear`), reveal pacing, and color choice; this primitive owns the
 * SVG lifecycle and the math.
 *
 * The CSS contract (what the three pages already style, unchanged):
 *   - the overlay carries `opts.className` (default `field-threads`; the example family passes
 *     `ev-threads`) — pages style `.<className> path { stroke: var(--thread, …); fill: none; }`.
 *   - `draw(…, { color })` sets the overlay's `--thread` custom property; omitting `color`
 *     removes it, so the page's `var(--thread, fallback)` fallback shows.
 *   - the hovered element gains `.lit`, each resolved target gains `.cited`; `clear()` removes
 *     both from everything this overlay marked.
 *   - inline geometry (position:absolute; inset:0; width/height:100%; pointer-events:none) is
 *     written on creation so the overlay covers the host before page CSS loads. The HOST must
 *     be a containing block (`position: relative` or similar) — that part stays page CSS.
 *
 * Coordinates are host-relative (the `centerIn` math): the viewBox is sized from the host's
 * current rect at each `draw`, and every path runs center-to-center through the family's
 * midpoint-y cubic — `M ax ay C ax my, bx my, bx by` with `my = (ay + by) / 2`.
 *
 * Geometry is sampled AT DRAW TIME and not observed afterwards: callers must re-draw (or
 * `clear()`) after layout changes — FLIP re-sorts, batch reveals, container resize. The
 * example pages clear on re-sort and re-draw on the next hover; that discipline is the
 * caller's.
 *
 * SSR-safe: construction touches no globals (the SVG is created lazily via
 * `host.ownerDocument` on first `draw`); `clear()`/`destroy()` are no-ops before that.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface ThreadOverlayOptions {
  /** class for the overlay SVG (default `field-threads`; the example family uses `ev-threads`). */
  className?: string;
}

export interface ThreadDrawOptions {
  /** value for the overlay's `--thread` custom property (the stroke channel pages style against). Omitted → the property is removed and the page's CSS fallback applies. */
  color?: string;
}

export interface ThreadOverlay {
  /**
   * Draw one thread per target: host-relative center-to-center cubic beziers from `from`,
   * marking `from` with `.lit` and each target with `.cited`. Replaces the previous draw
   * (paths and class marks). Reads layout — call outside the platform's write phase.
   */
  draw(from: HTMLElement, targets: readonly HTMLElement[], opts?: ThreadDrawOptions): void;
  /** Empty the overlay's paths and remove every `lit`/`cited` mark this overlay applied. */
  clear(): void;
  /** `clear()` + remove the SVG from the host. `clear()` is a no-op afterwards; a later `draw()` recreates the overlay. */
  destroy(): void;
}

/** An element's center in host-rect coordinates (the family's `centerIn`). */
function centerIn(el: HTMLElement, hostRect: DOMRect): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left - hostRect.left + r.width / 2, y: r.top - hostRect.top + r.height / 2 };
}

/**
 * Create (or adopt) a thread overlay on `host`. If a `svg.<className>` already exists in the
 * host it is reused — so a page that server-renders the overlay shell, or re-inits its
 * runtime, never stacks duplicates. Otherwise the SVG is created lazily on the first `draw`
 * and PREPENDED (the evidence pattern: threads paint under the host's content in DOM order).
 */
export function threadOverlay(host: HTMLElement, opts: ThreadOverlayOptions = {}): ThreadOverlay {
  const className = opts.className ?? 'field-threads';
  const selector = 'svg.' + className.trim().split(/\s+/).join('.');
  let svg: SVGSVGElement | null = null;
  const marked = new Set<HTMLElement>();

  const ensure = (): SVGSVGElement => {
    if (svg) return svg;
    svg = host.querySelector<SVGSVGElement>(selector);
    if (!svg) {
      svg = host.ownerDocument.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
      svg.setAttribute('class', className);
      svg.setAttribute('aria-hidden', 'true');
      // cover the host even before page CSS loads; the host supplies the containing block.
      svg.style.setProperty('position', 'absolute');
      svg.style.setProperty('inset', '0');
      svg.style.setProperty('width', '100%');
      svg.style.setProperty('height', '100%');
      svg.style.setProperty('pointer-events', 'none');
      host.prepend(svg);
    }
    return svg;
  };

  const unmark = (): void => {
    for (const el of marked) el.classList.remove('lit', 'cited');
    marked.clear();
  };

  const draw = (from: HTMLElement, targets: readonly HTMLElement[], drawOpts: ThreadDrawOptions = {}): void => {
    const overlay = ensure();
    unmark();
    const box = host.getBoundingClientRect();
    overlay.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    if (drawOpts.color != null && drawOpts.color !== '') overlay.style.setProperty('--thread', drawOpts.color);
    else overlay.style.removeProperty('--thread');
    const a = centerIn(from, box);
    from.classList.add('lit');
    marked.add(from);
    let d = '';
    for (const t of targets) {
      t.classList.add('cited');
      marked.add(t);
      const b = centerIn(t, box);
      const my = (a.y + b.y) / 2;
      d += `<path d="M${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}"/>`;
    }
    overlay.innerHTML = d;
  };

  const clear = (): void => {
    if (svg) svg.innerHTML = '';
    unmark();
  };

  const destroy = (): void => {
    clear();
    svg?.remove();
    svg = null;
  };

  return { draw, clear, destroy };
}
