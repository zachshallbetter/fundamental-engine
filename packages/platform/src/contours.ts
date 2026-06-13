/**
 * Contour typography (#257, #363) — glyph-outline generation for ANY font the author applies to a
 * body element. The Contour Sink tier of Body Matter Interaction: the element absorbs field matter,
 * the generated vector layer shows what that absorption means, the semantic text remains the source
 * of meaning.
 *
 * field-ui ships no font parser (the zero-dependency rule): the caller supplies the parsed font —
 * any object structurally matching `ContourFont`, which opentype.js's `Font` satisfies directly:
 *
 *   import { load } from 'opentype.js';
 *   import { contourSvgFor } from '@fundamental-engine/platform';
 *   const font = await load('/fonts/your-font.woff');   // WHATEVER face the element uses
 *   const handle = contourSvgFor(document.querySelector('#hero-title'), font, { rings: 3 });
 *   // → an aria-hidden SVG bound via data-field-visual-for, inserted after the element;
 *   //   the platform's state mirroring carries --d / --load onto it from the body.
 *
 * The same primitive runs in node for build-time generation (parse the font file, call
 * `contourPathData`, commit the output) — the site's gen-contours script is that usage.
 *
 * Layout is per-glyph with pair kerning, no shaping: correct for Latin-script display text, the
 * contour use case. Complex scripts (ligatures, contextual forms) need a real shaper and are out
 * of scope here.
 */

/** The minimal parsed-font surface this module needs — opentype.js `Font` satisfies it. */
export interface ContourGlyph {
  advanceWidth?: number;
  getPath(x: number, y: number, fontSize: number): { toPathData(decimals?: number): string };
}
export interface ContourFont {
  unitsPerEm: number;
  ascender: number;
  charToGlyph(char: string): ContourGlyph;
  getKerningValue(left: ContourGlyph, right: ContourGlyph): number;
}

export interface ContourPathOptions {
  /** path-data decimal places (default 2). */
  decimals?: number;
  /** padding around the bounding viewBox so wide ring strokes don't clip (px, default 12). */
  pad?: number;
}

export interface ContourPath {
  text: string;
  fontSize: number;
  viewBox: string;
  d: string;
}

/**
 * Lay `text` out in `font` at `fontSize` and return the combined glyph-outline path data plus a
 * padded viewBox. Pure — runs in the browser or node identically.
 */
export function contourPathData(font: ContourFont, text: string, fontSize: number, opts: ContourPathOptions = {}): ContourPath {
  const decimals = opts.decimals ?? 2;
  const pad = opts.pad ?? 12;
  const scale = fontSize / font.unitsPerEm;
  const ascent = font.ascender * scale; // baseline at ascender height → bbox starts near y=0
  const parts: string[] = [];
  let x = 0;
  let prev: ContourGlyph | null = null;
  // track the bounds ourselves so we don't depend on a Path#getBoundingBox implementation —
  // the em box is a safe, font-true envelope (exact ink bounds vary per glyph renderer).
  for (const ch of text) {
    const glyph = font.charToGlyph(ch);
    if (prev) x += font.getKerningValue(prev, glyph) * scale;
    parts.push(glyph.getPath(x, ascent, fontSize).toPathData(decimals));
    x += (glyph.advanceWidth ?? font.unitsPerEm / 2) * scale;
    prev = glyph;
  }
  // the em box (height = fontSize, baseline at ascent) is the font-true envelope; exact ink
  // bounds vary per glyph and aren't needed — pad absorbs over/undershoot.
  const viewBox = `${(-pad).toFixed(1)} ${(-pad).toFixed(1)} ${(x + pad * 2).toFixed(1)} ${(fontSize + pad * 2).toFixed(1)}`;
  return { text, fontSize, viewBox, d: parts.join('') };
}

export interface ContourSvgOptions extends ContourPathOptions {
  /** text to outline — defaults to the element's textContent, trimmed. */
  text?: string;
  /** layout size in px — defaults to the element's computed font-size, else 96. */
  fontSize?: number;
  /** how many stacked-stroke rings to emit (default 3, classed ring-1…ring-N, innermost first). */
  rings?: number;
  /** insert the SVG into the DOM after the element (default true); false returns it unattached. */
  attach?: boolean;
  /** document override (tests / detached trees); defaults to the element's ownerDocument. */
  doc?: Document;
}

export interface ContourSvgHandle {
  svg: SVGSVGElement;
  path: ContourPath;
  /** remove the SVG from the DOM. */
  remove(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Generate the bound vector representation for a body element from ITS OWN font: an `aria-hidden`
 * SVG of stacked-stroke contour rings, carrying `data-field-visual-for` back to the element so the
 * platform's state mirroring (Bound Visual Sink) drives it from the body's live `--d` / `--load`.
 * The element keeps its semantic text; if it has no id one is assigned (the binding needs a ref).
 */
export function contourSvgFor(el: HTMLElement, font: ContourFont, opts: ContourSvgOptions = {}): ContourSvgHandle {
  const doc = opts.doc ?? el.ownerDocument;
  const text = opts.text ?? (el.textContent ?? '').trim();
  let fontSize = opts.fontSize;
  if (fontSize === undefined) {
    const view = doc?.defaultView;
    const computed = view?.getComputedStyle ? parseFloat(view.getComputedStyle(el).fontSize) : NaN;
    fontSize = Number.isFinite(computed) && computed > 0 ? computed : 96;
  }
  const path = contourPathData(font, text, fontSize, opts);

  if (!el.id) el.id = `contour-${Math.abs(text.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7))}`;
  const svg = doc.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('viewBox', path.viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('data-field-visual-for', el.id);
  svg.setAttribute('data-field-visual-role', 'representation');
  const rings = Math.max(1, opts.rings ?? 3);
  for (let i = rings; i >= 1; i--) {
    const p = doc.createElementNS(SVG_NS, 'path');
    p.setAttribute('class', `ring ring-${i}`);
    p.setAttribute('d', path.d);
    p.setAttribute('fill', 'none');
    svg.appendChild(p);
  }
  if (opts.attach !== false) el.insertAdjacentElement('afterend', svg);
  return { svg, path, remove: () => svg.remove() };
}
