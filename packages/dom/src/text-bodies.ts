/**
 * textBodies — sample a text element's *rendered* geometry into boundary bodies the field flows
 * around and along (#257, first slice).
 *
 * The invisible-fields law holds: the field writes INTO type (words glow via `--d`), but matter
 * never FORMS words. This helper goes the other direction — it turns text into a BOUNDARY the
 * field acts against (`wall` bounces matter off the box, `shear` drags it along the line), never
 * a morph target. The homepage's hand-rolled "prominent text is a body" curation is the `box`
 * granularity of exactly this; `line` and `word` are the first real steps past the box
 * approximation.
 *
 * Geometry source — honest about what the platform can measure today: `document.createRange()`
 * over the element's text nodes + `Range.getClientRects()`, which yields the rendered line boxes
 * (`line`) or per-word fragment boxes (`word`). This is BOX geometry, not glyph contours — true
 * glyph-outline sampling (font path data / canvas rasterization) is the planned next slice of
 * #257 and will slot in as a finer granularity behind the same API.
 *
 * Why spans: engine bodies are *elements* (`data-body` is the body contract; the scanner measures
 * `getBoundingClientRect` per element). Emitting one absolutely-positioned, `aria-hidden`,
 * `pointer-events:none` span per box gives the field per-line/per-word geometry through the
 * existing contract — no new engine surface. Each span also declares the visual-binding pair
 * (`data-field-visual-for` → the source element, role `representation`), so a
 * `platform.visuals.scan()` binds and lints them like any authored representation.
 *
 * Lifecycle contract:
 * - `annotate()` is idempotent — re-calling disposes the previous span set first, then re-measures.
 * - The engine picks the spans up on its next scan: call `field.rescan()` (or re-run the platform
 *   scan) after `annotate()` and after disposing.
 * - Resize/reflow honesty: the spans are a static snapshot in page coordinates. By default callers
 *   re-call `annotate()` (and rescan) when the text reflows. Opt into `observe: true` to wire a
 *   debounced `ResizeObserver` on the source that re-measures the spans automatically on resize;
 *   the observer is torn down by the same disposer that removes the spans.
 * - Reduced motion is irrelevant here: this is geometry only; it animates nothing.
 * - SSR-safe: no module-top DOM access; everything reaches the DOM through the passed element's
 *   `ownerDocument`.
 */

export type TextBodiesGranularity = 'box' | 'line' | 'word';

export interface TextBodiesOptions {
  /**
   * How finely to sample the rendered text:
   * - `box` — the element's own bounding box (the homepage's current hand-rolled behavior, via API);
   * - `line` — one box per rendered line box (`Range.selectNodeContents` + `getClientRects`);
   * - `word` (default) — one box per word fragment, via a Range over each whitespace-delimited run.
   */
  granularity?: TextBodiesGranularity;
  /** The boundary force token the spans carry: `wall` (bounce off) or `shear` (flow along). Default `shear`. */
  body?: 'wall' | 'shear';
  /** `data-strength` written on each span. Default 1. */
  strength?: number;
  /**
   * Re-annotate automatically when the source resizes. When `true` (or a debounce in ms), `annotate()`
   * wires a debounced `ResizeObserver` on the source; each resize disposes the previous spans and
   * re-measures fresh boxes, so the boundary stays glued to the reflowed text. Off by default (the
   * spans remain a one-time snapshot). The observer is registered on the source's `ResizeObserver`
   * global; in environments without one (SSR / old runtimes) it's silently skipped. Cleaned up by the
   * disposer `annotate()` returns. Default debounce `100`ms when `observe: true`.
   */
  observe?: boolean | number;
}

export interface TextBodiesHandle {
  /** The boxes measured at creation time (viewport coordinates, zero-size fragments dropped). */
  boxes: DOMRect[];
  /**
   * Create the boundary spans (re-measuring fresh boxes) and return a disposer that removes them
   * (and, when `observe` is set, disconnects the ResizeObserver). Idempotent: calling again first
   * disposes the previous set.
   */
  annotate(): () => void;
}

/** module-scope id sequence for sources that lack an id (no DOM touched at module top). */
let idSeq = 0;

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/** Depth-first text nodes under `el` (own implementation — keeps the fake-DOM test surface tiny). */
function textNodesUnder(el: Node): Node[] {
  const out: Node[] = [];
  const walk = (n: Node): void => {
    for (const child of Array.from(n.childNodes)) {
      if (child.nodeType === TEXT_NODE) out.push(child);
      else if (child.nodeType === ELEMENT_NODE) walk(child);
    }
  };
  walk(el);
  return out;
}

const usable = (r: DOMRect): boolean => r.width > 0 && r.height > 0;

/** Measure the boxes for one granularity (viewport coordinates, straight off the live layout). */
function measureBoxes(el: HTMLElement, granularity: TextBodiesGranularity): DOMRect[] {
  if (granularity === 'box') {
    const r = el.getBoundingClientRect();
    return usable(r) ? [r] : [];
  }
  const doc = el.ownerDocument;
  const boxes: DOMRect[] = [];
  if (granularity === 'line') {
    const range = doc.createRange();
    range.selectNodeContents(el);
    for (const r of Array.from(range.getClientRects())) if (usable(r)) boxes.push(r);
    return boxes;
  }
  // word: one Range per whitespace-delimited run in each text node. A word that fragments
  // (wraps, spans styling boundaries) contributes one box per rendered fragment.
  for (const node of textNodesUnder(el)) {
    const text = node.textContent ?? '';
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const range = doc.createRange();
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      for (const r of Array.from(range.getClientRects())) if (usable(r)) boxes.push(r);
    }
  }
  return boxes;
}

/** The visual-binding ref for the source: its id, assigned if missing (the resolver takes bare ids). */
function ensureRef(el: HTMLElement): string {
  if (!el.id) el.id = `field-text-source-${++idSeq}`;
  return el.id;
}

/**
 * Sample `el`'s rendered text geometry into field boundary bodies.
 *
 * Returns the measured `boxes` and an `annotate()` that emits one boundary span per box —
 * `data-body` wall/shear + `data-strength`, `data-range` hugged to the box (max dimension, so a
 * word's influence stays near the word), `aria-hidden`, `pointer-events:none`, and the
 * `data-field-visual-for`/`data-field-visual-role="representation"` declaration pointing back at
 * `el`. Spans live in one absolutely-positioned container appended to `document.body` (page
 * coordinates), so the source's own layout is never disturbed. The engine's scanner registers
 * them on the next `rescan()`; the disposer removes the whole set.
 */
export function textBodies(el: HTMLElement, opts: TextBodiesOptions = {}): TextBodiesHandle {
  const granularity: TextBodiesGranularity = opts.granularity ?? 'word';
  const body = opts.body ?? 'shear';
  const strength = opts.strength ?? 1;
  const observe = opts.observe ?? false;
  const observeDelay = typeof observe === 'number' ? observe : 100;

  let disposeCurrent: (() => void) | null = null;

  /** Build one span set from a fresh measurement and return its remover. */
  const render = (): (() => void) => {
    const doc = el.ownerDocument;
    const view = doc.defaultView;
    const sx = view?.scrollX ?? 0;
    const sy = view?.scrollY ?? 0;
    const ref = ensureRef(el);

    const container = doc.createElement('div');
    container.setAttribute('data-text-bodies', '');
    container.setAttribute('aria-hidden', 'true');
    const cs = container.style;
    cs.setProperty('position', 'absolute');
    cs.setProperty('left', '0');
    cs.setProperty('top', '0');
    cs.setProperty('width', '0');
    cs.setProperty('height', '0');
    cs.setProperty('overflow', 'visible');
    cs.setProperty('pointer-events', 'none');

    for (const box of measureBoxes(el, granularity)) {
      const span = doc.createElement('span');
      span.setAttribute('data-body', body);
      span.setAttribute('data-strength', String(strength));
      // influence hugs the box: wall collides with the box itself; shear's gradient reaches
      // one box-max-dimension out, so a word steers matter near the word, not across the page.
      span.setAttribute('data-range', String(Math.ceil(Math.max(box.width, box.height))));
      span.setAttribute('data-field-visual-for', ref);
      span.setAttribute('data-field-visual-role', 'representation');
      span.setAttribute('aria-hidden', 'true');
      const ss = span.style;
      ss.setProperty('position', 'absolute');
      ss.setProperty('display', 'block');
      ss.setProperty('left', `${box.left + sx}px`);
      ss.setProperty('top', `${box.top + sy}px`);
      ss.setProperty('width', `${box.width}px`);
      ss.setProperty('height', `${box.height}px`);
      ss.setProperty('pointer-events', 'none');
      container.appendChild(span);
    }
    doc.body.appendChild(container);

    return () => container.parentNode?.removeChild(container);
  };

  const annotate = (): (() => void) => {
    disposeCurrent?.(); // idempotent: one live span set per handle

    let removeSpans = render();

    // Opt-in: re-measure on source resize, debounced, so the boundary tracks the reflowed text.
    // Skipped where ResizeObserver is unavailable (SSR / older runtimes) — the snapshot still stands.
    let ro: ResizeObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const RO = (el.ownerDocument.defaultView as { ResizeObserver?: typeof ResizeObserver } | null)
      ?.ResizeObserver;
    if (observe && typeof RO === 'function') {
      ro = new RO(() => {
        if (timer != null) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          removeSpans();
          removeSpans = render();
        }, observeDelay);
      });
      ro.observe(el);
    }

    const dispose = (): void => {
      if (timer != null) clearTimeout(timer);
      timer = null;
      ro?.disconnect();
      ro = null;
      removeSpans();
      if (disposeCurrent === dispose) disposeCurrent = null;
    };
    disposeCurrent = dispose;
    return dispose;
  };

  return { boxes: measureBoxes(el, granularity), annotate };
}
