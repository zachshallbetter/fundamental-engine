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
import { contourPathData } from '@fundamental-engine/dom';

const here = dirname(fileURLToPath(import.meta.url));
const FONT = join(here, 'assets/bricolage-grotesque-variable.ttf');
const OUT = join(here, '../src/data/contours.json');

/** The text set pages may render as contour objects. Add a line, re-run, commit. */
const TEXTS = [
  { id: 'contour', text: 'Contour', fontSize: 96 },
  { id: 'charge', text: 'Charge', fontSize: 96 },
];

const font = opentype.parse(readFileSync(FONT).buffer);

// The layout itself is the platform's font-agnostic primitive (contourPathData) — this
// script is just its build-time usage: parse THIS font file, lay out THIS text set, commit.
// Any font the author applies to a body works the same way; opentype.js's Font satisfies
// the ContourFont contract structurally.
const entries = {};
for (const { id, text, fontSize } of TEXTS) {
  entries[id] = contourPathData(font, text, fontSize);
}

writeFileSync(
  OUT,
  JSON.stringify({ font: 'Bricolage Grotesque (variable, default instance)', entries }, null, 2) + '\n',
);
console.log(`contours: ${Object.keys(entries).length} entr${Object.keys(entries).length === 1 ? 'y' : 'ies'} → src/data/contours.json`);
