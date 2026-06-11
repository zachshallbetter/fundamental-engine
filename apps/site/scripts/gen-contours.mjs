/**
 * Contour typography (#257): convert text into glyph-outline SVG path data at build time.
 *
 * Parses the display face (the same self-hosted Bricolage Grotesque the site serves —
 * scripts/assets/bricolage-grotesque-variable.ttf, the variable font's default instance)
 * with opentype.js, lays out the text with kerning, and writes the combined outline path
 * to src/data/contours.json. The committed JSON is the build artifact: pages render it as
 * an aria-hidden SVG bound to its semantic source (`data-field-visual-for`), so the live
 * sink state mirrored onto it (--d / --load) drives the contour rings. Re-run when the
 * text set or the font changes:
 *
 *   node apps/site/scripts/gen-contours.mjs
 *
 * True offset contours (rings at a mathematically constant distance from the glyph
 * boundary) need polygon offsetting and stay out of scope — the rendered rings are
 * stacked strokes of the one outline, the documented practical form.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const here = dirname(fileURLToPath(import.meta.url));
const FONT = join(here, 'assets/bricolage-grotesque-variable.ttf');
const OUT = join(here, '../src/data/contours.json');

/** The text set pages may render as contour objects. Add a line, re-run, commit. */
const TEXTS = [{ id: 'contour', text: 'Contour', fontSize: 96 }];

const font = opentype.parse(readFileSync(FONT).buffer);

const entries = {};
for (const { id, text, fontSize } of TEXTS) {
  // baseline at ascender height so the path's bbox starts near y=0
  const ascent = (font.ascender / font.unitsPerEm) * fontSize;
  // Per-glyph layout instead of font.getPath: opentype.js's shaper rejects this font's
  // GSUB ccmp lookup format, and Latin display text needs no shaping — chars map to
  // glyphs one-to-one, with pair kerning applied by hand.
  const scale = fontSize / font.unitsPerEm;
  const path = new opentype.Path();
  let x = 0;
  let prev = null;
  for (const ch of text) {
    const glyph = font.charToGlyph(ch);
    if (prev) x += font.getKerningValue(prev, glyph) * scale;
    path.extend(glyph.getPath(x, ascent, fontSize));
    x += glyph.advanceWidth * scale;
    prev = glyph;
  }
  const box = path.getBoundingBox();
  const pad = 12; // breathing room so wide ring strokes don't clip
  entries[id] = {
    text,
    fontSize,
    viewBox: `${(box.x1 - pad).toFixed(1)} ${(box.y1 - pad).toFixed(1)} ${(box.x2 - box.x1 + pad * 2).toFixed(1)} ${(box.y2 - box.y1 + pad * 2).toFixed(1)}`,
    d: path.toPathData(2),
  };
}

writeFileSync(
  OUT,
  JSON.stringify({ font: 'Bricolage Grotesque (variable, default instance)', entries }, null, 2) + '\n',
);
console.log(`contours: ${Object.keys(entries).length} entr${Object.keys(entries).length === 1 ? 'y' : 'ies'} → src/data/contours.json`);
