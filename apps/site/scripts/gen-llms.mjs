#!/usr/bin/env node
/**
 * gen-llms.mjs — agent-first publishing for fundamental-engine.com.
 *
 * Generates two files into apps/site/public/ (committed; servable by `astro preview`):
 *
 *   /llms.txt       the llmstxt.org index: the canonical architecture statement, then the
 *                   docs routes (from src/lib/docs-nav.ts), the canonical documents (linked
 *                   to their GitHub blobs — they are not served on the site), and the
 *                   invisible-field examples (from src/lib/invisible-fields.ts).
 *   /llms-full.txt  every docs/canonical/*.md file concatenated, with a generated header
 *                   and a separator per file.
 *
 * Deterministic: output depends only on the sources plus a generation DATE (no timestamps),
 * so re-running on the same day is byte-stable. Run standalone:
 *
 *   node apps/site/scripts/gen-llms.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '..'); // apps/site
const root = resolve(site, '../..'); // repo root
const outDir = join(site, 'public');

const SITE_URL = 'https://fundamental-engine.com';
const CANON_BLOB = 'https://github.com/zachshallbetter/fundamental-engine/blob/main/docs/canonical';
const DATE = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Read the two TS rosters without a TS toolchain: a child `node` with type
// stripping imports the real modules (their types are erasable syntax) and
// prints the named exports as JSON. No regex extraction, no drift.
// ---------------------------------------------------------------------------
function loadRosters() {
  const navUrl = pathToFileURL(join(site, 'src/lib/docs-nav.ts')).href;
  const exUrl = pathToFileURL(join(site, 'src/lib/invisible-fields.ts')).href;
  const code = [
    `import { DOCS_NAV } from ${JSON.stringify(navUrl)};`,
    `import { INVISIBLE_FIELDS } from ${JSON.stringify(exUrl)};`,
    `process.stdout.write(JSON.stringify({ DOCS_NAV, INVISIBLE_FIELDS }));`,
  ].join('\n');
  const r = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', code],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) throw new Error(`gen-llms: failed to load the TS rosters:\n${r.stderr}`);
  return JSON.parse(r.stdout);
}

const { DOCS_NAV, INVISIBLE_FIELDS: EXAMPLES } = loadRosters();

// One-line descriptions per docs route (the nav tree carries labels only). Keyed by href so
// a nav reorganization cannot mispair them; an unknown route falls back to its label alone.
const DOC_DESC = {
  '/docs': 'the documentation map — install, the IA, the examples, and the agent endpoints',
  '/docs/tutorial': 'step-by-step: npm install to a glowing, reacting headline',
  '/docs/concepts': 'the mental model — bodies, the shared field context, reciprocity, the vocabulary lanes',
  '/docs/natural-fields': 'the Natural Field Translation System: gravity → priority, EM → polarity/signal, strong → binding, weak → transformation',
  '/docs/platform': 'the DOM participation layer — six registries on the six-phase frame scheduler, plus lintPlatform()',
  '/docs/narrative': 'one ordinary element revealed as a field participant, layer by layer',
  '/docs/reading-field': 'the flagship platform demo — a content page that measures attention and remembers it',
  '/docs/guides/web-component': 'the <field-root> element in any framework or plain HTML',
  '/docs/guides/typescript': 'the typed FieldField class from @fundamental-engine/vanilla — no framework, no custom-element registration',
  '/docs/guides/react': 'the <FieldField> component and the useFieldField hook',
  '/docs/guides/core': 'createField on a canvas you own, with an injected host',
  '/docs/api': 'the complete API surface, generated from the engine catalog',
  '/docs/api/options': 'createField(canvas, opts) and every FieldOptions field with types and defaults',
  '/docs/api/handle': 'the FieldHandle every entry point returns — all runtime methods',
  '/docs/api/attributes': 'every data-* attribute a body reads, plus the CSS variables the field writes back',
  '/docs/api/metrics': 'every --field-* custom property the field writes back — ranges, cadence, and when to use each',
  '/docs/api/types': 'the exported TypeScript contracts, core and platform',
  '/docs/api/stability': 'the frozen 0.x surface and compatibility rules — rendered from the same data CI enforces',
  '/docs/api/forces': 'all 36 forces: per-frame law, attributes read, and an example each',
  '/docs/api/presets': 'composites (blackhole, galaxy, tornado, …) that expand to primitive bodies',
  '/docs/api/catalog': 'conditions, global formation modes, render modes, and palettes — the orthogonal axes',
  '/docs/studies/reading-field': 'a long-form article reinterpreted as a field (attention + memory + citations)',
  '/docs/studies/review-field': 'a pull request as a field — file heat, reviewer constellation, comment binding',
  '/docs/studies/search-field': 'search results as a trust gradient with contradiction polarity',
  '/docs/studies/system-weather': 'a metrics dashboard as weather — heat, pressure, anomalies',
  '/docs/studies/evidence-field': 'claims, sources, and contradiction edges as a deterministic field',
  '/docs/studies/visual-binding': 'an expressive SVG bound to its semantic source via data-field-visual-for',
  '/docs/showcase': 'live examples driven by the real field, paired with copy-paste source',
  '/docs/recipes': 'the FieldRecipe model — tokens, concepts, metrics, diagnostics, and conditions in separate lanes',
  '/docs/authoring': 'three authoring surfaces, one [data-body] contract',
  '/recipes': 'the recipe gallery, applied live',
  '/docs/inspector': 'the live system report and --field-density readback panel',
  '/docs/snapshots': 'deterministic per-force fingerprints — the physics-drift regression baseline',
  '/docs/diagnostics': 'the diagnostic render overlays: contours, potential, topology, causality, prediction',
  '/docs/troubleshooting': 'common gotchas — rescan, reduced motion, canvas clicks, --d not updating',
  '/docs/performance': 'the scheduler, the integrator hot path, density, and backgrounded-tab behavior',
  '/docs/accessibility': 'decorative-by-default render layers, reduced motion without loss of meaning',
  '/docs/accessibility-preview': 'the animated field and its static fallback, side by side',
};

// ---------------------------------------------------------------------------
// Canonical docs: filename + H1 + a one-liner from the leading status blockquote.
// ---------------------------------------------------------------------------
const canonDir = join(root, 'docs/canonical');
const canonFiles = readdirSync(canonDir)
  .filter((f) => f.endsWith('.md'))
  .sort();

function canonMeta(file) {
  const src = readFileSync(join(canonDir, file), 'utf8');
  const lines = src.split('\n');
  const h1 = lines.find((l) => l.startsWith('# '))?.slice(2).trim() ?? file.replace(/\.md$/, '');
  // the leading blockquote (contiguous "> " lines at the top of the file)
  const quote = [];
  for (const l of lines) {
    if (l.startsWith('>')) quote.push(l.replace(/^>\s?/, ''));
    else if (quote.length) break;
    else if (l.trim() !== '') break;
  }
  const body = quote
    .join(' ')
    .replace(/\*\*Status:[^*]*\*\*\s*/, '') // drop the status marker
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // unlink markdown links
    .replace(/[`*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // first sentence, capped
  let desc = body.split(/(?<=\.)\s/)[0] ?? '';
  if (desc.length > 220) desc = `${desc.slice(0, 217).trimEnd()}…`;
  return { h1, desc, src };
}

const canon = canonFiles.map((f) => ({ file: f, ...canonMeta(f) }));

// ---------------------------------------------------------------------------
// Site docs pages (.astro): extract the authored prose, snippets, and headings.
// The generated catalog tables (forces/options/attrs) come from TS data at build
// time and are not literal in the source, so this captures the hand-written
// content, not the data-driven tables. Deterministic: sorted by route.
// ---------------------------------------------------------------------------
const docsPagesDir = join(site, 'src/pages/docs');
function walkAstro(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walkAstro(p));
    else if (e.name.endsWith('.astro')) out.push(p);
  }
  return out;
}
function astroText(src) {
  let s = src.replace(/^---[\s\S]*?\n---\n/, ''); // drop the frontmatter component script
  s = s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  for (let i = 0; i < 4; i++) s = s.replace(/\{[^{}]*\}/g, ' '); // strip JSX expressions (incl. light nesting)
  s = s.replace(/<[^>]+>/g, ' '); // strip tags
  s = s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  return s
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}
function astroTitle(src, route) {
  const m = src.match(/\btitle=\{?["'`]([^"'`]+)["'`]/);
  return m ? m[1] : route;
}
const docsPages = walkAstro(docsPagesDir)
  .sort()
  .map((p) => {
    const src = readFileSync(p, 'utf8');
    const route =
      '/docs' +
      p
        .slice(docsPagesDir.length)
        .replace(/\\/g, '/')
        .replace(/\/index\.astro$/, '')
        .replace(/\.astro$/, '');
    return { route, title: astroTitle(src, route), text: astroText(src) };
  })
  .filter((d) => d.text.length > 60);

// ---------------------------------------------------------------------------
// Field recipes: the shipped 64-recipe catalog (data/recipes.json, regenerated
// by `pnpm gen:recipes`). Emitted as a compact, agent-readable catalog.
// ---------------------------------------------------------------------------
const recipesData = JSON.parse(readFileSync(join(root, 'data/recipes.json'), 'utf8'));
const recipeTierBlocks = recipesData.tiers.map((t) => {
  const rows = t.recipeIds
    .map((id) => {
      const r = recipesData.recipes[id];
      if (!r) return null;
      const tokens = (r.primitives ?? []).join(' ');
      const metrics = (r.metrics ?? []).join(', ');
      return (
        `- **${r.name}** (\`${id}\`) — ${r.intent ?? ''}` +
        `${r.naturalField ? ` · natural field: ${r.naturalField}` : ''}` +
        `${tokens ? ` · tokens: \`${tokens}\`` : ''}` +
        `${metrics ? ` · metrics: ${metrics}` : ''}`
      );
    })
    .filter(Boolean);
  return `### ${t.label}\n\n${rows.join('\n')}`;
});
const recipesText =
  `# Field recipes\n\n` +
  `The ${recipesData.count} shipped FieldRecipes (the \`FIELD_RECIPES\` catalog; a FieldRecipe is the API\n` +
  `representation of a field configuration). Each composes runtime tokens, metrics, and diagnostics into\n` +
  `an interface pattern. The locked set is frozen; new recipes go in EXPERIMENTAL_RECIPES.\n\n` +
  recipeTierBlocks.join('\n\n');

// ---------------------------------------------------------------------------
// llms.txt
// ---------------------------------------------------------------------------
const line = (name, url, desc) => `- [${name}](${url})${desc ? `: ${desc}` : ''}`;

// in-shell docs routes only; the nav's external deep-links (the example family, the
// recipe gallery) are covered by the ## Examples section below
const docsLines = DOCS_NAV.flatMap((g) =>
  g.items
    .filter((i) => i.ready && !i.external)
    .map((i) =>
      line(
        `${g.title} — ${i.label}`,
        `${SITE_URL}${i.href}`,
        DOC_DESC[i.href] ?? '',
      ),
    ),
);

const canonLines = canon.map((c) => line(c.h1, `${CANON_BLOB}/${c.file}`, c.desc));

const exampleLines = EXAMPLES.map((e) => line(e.name, `${SITE_URL}${e.href}`, e.hook));

const llms = `# Fundamental

> Fundamental is a platform-native relational field runtime, created by Zach Shallbetter (zachshallbetter.com). The core (\`@fundamental-engine/core\`)
> computes renderer-agnostic field behavior; host adapters bind that field to real platforms.
> \`@fundamental-engine/dom\` is the web host adapter, binding field behavior to the DOM through
> measurement, state, feedback, relationships, visual bindings, overlays, linting, and scheduling
> (\`@fundamental-engine/elements\` and \`@fundamental-engine/react\` are authoring surfaces on top of it).
> Canvas is one render surface, not the whole system: a field is **signals-first** — by default it draws
> nothing and exposes structured signals, metrics, feedback, queries, snapshots, and projections.

Every element can become a body in an invisible physics field via the \`data-body\` attribute:
bodies bend the field, and the field's local density bends them back (reciprocity, returned as
the canonical \`--d\` density channel, whose expressive long form is \`--field-density\`). The public 0.x API surface is frozen and
additive-only, enforced in CI from \`scripts/api-surface.data.mjs\` — the docs' provenance stamps
render from the same file. Generated ${DATE} by apps/site/scripts/gen-llms.mjs.

## Start here — don't guess

The mental model is unusual, so confident wrong guesses are common. Before reaching for an API, know:

- **A field is a behavior layer, not a particle background.** It writes \`--field-*\` variables onto
  \`[data-body]\` elements; your CSS reads them. Particles are one optional render surface.
- **\`render\` defaults to \`'none'\` (signals-first).** A field draws nothing until you opt in
  (\`render: 'dots'\`). "Nothing showing" is the default, not a bug — the signals are already live.
- **There is one \`createField\`.** Core's requires \`opts.host\`; \`@fundamental-engine/vanilla\`'s is the
  same function with the browser host bundled (+ a \`bounds\` option for a contained field). Use vanilla.
- **Read the \`--field-*\` variables and the \`field.on(…)\` events** for state — not \`readParticles()\`.
- **The surface is small and frozen.** If an option or method is not in the docs / \`api-surface.data.mjs\`,
  it does not exist — do not invent it.

Full list with the corrections: [Common mistakes — don't guess](${CANON_BLOB}/common-mistakes.md).

## Docs

${docsLines.join('\n')}

## Canon

The canonical documents are the project's authority on concepts, terminology, and contracts.
They live in the repository, not on the site:

${canonLines.join('\n')}

## Examples

The invisible-field example family — twelve ordinary page types running as fields over real
data, with no particle swarm; each ships a committed data snapshot and upgrades itself to live
counts when its source is reachable:

${exampleLines.join('\n')}

## Optional

- [llms-full.txt](${SITE_URL}/llms-full.txt): the full corpus — every canonical document, the site documentation pages, and the recipe catalog, concatenated into one file
- [GitHub repository](https://github.com/zachshallbetter/fundamental-engine): the monorepo — core, platform, elements, react, vanilla, and this site
- [Writings](${SITE_URL}/writings): the eight-paper research family on the field model
- [The Lab](${SITE_URL}/lab): a physics detector — fire a particle into any force and verify its law
- [Design system](${SITE_URL}/design): tokens, the force palette, type, and glyphs
`;

// ---------------------------------------------------------------------------
// llms-full.txt
// ---------------------------------------------------------------------------
const SEP = '='.repeat(72);
const fullHeader = `# Fundamental — full documentation corpus

Created by Zach Shallbetter (zachshallbetter.com).

Source: docs/canonical/, the site documentation pages (apps/site/src/pages/docs/), and the
recipe catalog (data/recipes.json) in https://github.com/zachshallbetter/fundamental-engine
Generated: ${DATE} by apps/site/scripts/gen-llms.mjs
Canonical docs: ${canon.length} · documentation pages: ${docsPages.length} · recipes: ${recipesData.count}

Three sections, in order: (1) the project's CANONICAL documents — the authority on concepts,
terminology, and contracts; (2) the authored prose of the SITE DOCUMENTATION pages (the
data-driven catalog tables are generated at build time and are not reproduced here); (3) the
FIELD RECIPES catalog. The live site map is ${SITE_URL}/llms.txt.
`;

const canonBody = canon
  .map((c) => `${SEP}\nFILE: ${c.file}\n${SEP}\n\n${c.src.trimEnd()}\n`)
  .join('\n');

const pagesBody = docsPages
  .map((d) => `${SEP}\nPAGE: ${d.route} — ${d.title}\n${SEP}\n\n${d.text.trimEnd()}\n`)
  .join('\n');

const recipesBody = `${SEP}\nRECIPES: field-recipes (generated from data/recipes.json)\n${SEP}\n\n${recipesText.trimEnd()}\n`;

const full = `${fullHeader}\n${canonBody}\n${SEP}\n## SITE DOCUMENTATION PAGES\n${SEP}\n\n${pagesBody}\n${SEP}\n## FIELD RECIPES\n${SEP}\n\n${recipesBody}`;

// ---------------------------------------------------------------------------
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'llms.txt'), llms);
writeFileSync(join(outDir, 'llms-full.txt'), full);

console.log(
  `gen-llms: wrote llms.txt (${docsLines.length} docs, ${canonLines.length} canon, ${exampleLines.length} examples) ` +
    `and llms-full.txt (${canon.length} canon + ${docsPages.length} pages + ${recipesData.count} recipes, ${(full.length / 1024).toFixed(0)} KiB) to apps/site/public/`,
);
