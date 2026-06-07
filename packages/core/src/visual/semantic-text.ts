/**
 * Semantic-text fallback (visual-language §16, migration-plan §11). The visual layer may vectorize,
 * distort, or shader-render glyphs, but the semantic layer must stay real HTML text — SVG/Canvas
 * glyphs must never be the only source of meaning. These helpers check that an expressive element
 * carries accessible text and build the recommended pattern. Operate on a minimal node shape, so
 * they run without a DOM.
 */

/** The minimal node surface these checks need (a real Element satisfies it). */
export interface TextNodeLike {
  textContent: string | null;
  getAttribute(name: string): string | null;
  querySelector(selector: string): unknown;
}

/**
 * True when the element exposes accessible text: visible text content, an `aria-label`, or an
 * `.sr-only` child carrying the meaning. An expressive glyph that is `aria-hidden` with none of
 * these fails — the visual is decorative-only and the meaning is lost.
 */
export function hasAccessibleText(node: TextNodeLike): boolean {
  const text = (node.textContent ?? '').trim();
  if (text.length > 0) return true;
  if ((node.getAttribute('aria-label') ?? '').trim().length > 0) return true;
  return node.querySelector('.sr-only') != null;
}

/**
 * Build the recommended semantic-glyph pattern (migration-plan §11): a visually-hidden text span
 * carrying the meaning, plus an `aria-hidden` SVG carrying the expressive form. Returns an HTML
 * string the author can drop in.
 */
export function semanticGlyphMarkup(text: string, svgInner: string, tag = 'span'): string {
  const safe = text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!);
  return (
    `<${tag} class="field-glyph">` +
    `<span class="sr-only">${safe}</span>` +
    `<svg aria-hidden="true" focusable="false">${svgInner}</svg>` +
    `</${tag}>`
  );
}

/** The CSS for an `.sr-only` utility, if the consuming app doesn't already ship one. */
export const SR_ONLY_CSS =
  '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;' +
  'clip:rect(0,0,0,0);white-space:nowrap;border:0}';
