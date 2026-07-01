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
  const apiUrl = pathToFileURL(join(site, 'src/lib/docs-api.ts')).href;
  // The rosters + the data-driven API tables (docs-api.ts) + the engine's force catalog. The forces
  // come from @fundamental-engine/core (which imports ZERO DOM), loaded resiliently so a build that
  // hasn't compiled core yet still produces the rest of the corpus.
  const code = [
    `import { DOCS_NAV } from ${JSON.stringify(navUrl)};`,
    `import { INVISIBLE_FIELDS } from ${JSON.stringify(exUrl)};`,
    `import { OPTIONS, HANDLE, ATTRS, WRITEBACK, RENDER_MODES, OVERLAY_MODES, FIELD_ROOT_ATTRS } from ${JSON.stringify(apiUrl)};`,
    `let FORCES = [];`,
    `try { const core = await import('@fundamental-engine/core');`,
    `  FORCES = core.MANUAL_FORCES.map((f) => ({ family: f.family, token: f.token, label: f.label, formula: f.formula, attrs: f.attrs, desc: f.desc, ...core.classifyForce(f.token) })); } catch {}`,
    `process.stdout.write(JSON.stringify({ DOCS_NAV, INVISIBLE_FIELDS, OPTIONS, HANDLE, ATTRS, WRITEBACK, RENDER_MODES, OVERLAY_MODES, FIELD_ROOT_ATTRS, FORCES }));`,
  ].join('\n');
  const r = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', code],
    { encoding: 'utf8', cwd: site }, // cwd: site so the bare '@fundamental-engine/core' specifier resolves
  );
  if (r.status !== 0) throw new Error(`gen-llms: failed to load the TS rosters:\n${r.stderr}`);
  return JSON.parse(r.stdout);
}

const {
  DOCS_NAV,
  INVISIBLE_FIELDS: EXAMPLES,
  OPTIONS,
  HANDLE,
  ATTRS,
  WRITEBACK,
  RENDER_MODES,
  OVERLAY_MODES,
  FIELD_ROOT_ATTRS,
  FORCES,
} = loadRosters();

// ---------------------------------------------------------------------------
// Generic markdown-tree reader. Returns { rel (repo-relative path), src } per
// .md file, sorted, so section output is deterministic. Non-.md (images, .bib)
// are skipped. `docs/planning-archive` is a SEPARATE directory from
// `docs/planning` and is never read here — the archive is deliberately excluded.
// ---------------------------------------------------------------------------
function readMdTree(absDir, { recursive = false } = {}) {
  let entries;
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(absDir, e.name);
    if (e.isDirectory()) {
      if (recursive) out.push(...readMdTree(p, { recursive }));
      continue;
    }
    if (!e.name.endsWith('.md')) continue;
    out.push({ rel: p.slice(root.length + 1).replace(/\\/g, '/'), src: readFileSync(p, 'utf8') });
  }
  return out;
}

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
// Additional markdown corpora (concatenated whole into llms-full.txt):
//   engine reference — the deep as-built engine spec
//   research         — the arXiv-style paper family (the authoritative copies)
//   planning         — the frontier / forward-looking design docs (NOT the archive)
//   project files    — the repo-root knowledge files
// ---------------------------------------------------------------------------
const engineRef = readMdTree(join(root, 'docs/engine-reference'));
const research = readMdTree(join(root, 'docs/research'));
const planning = readMdTree(join(root, 'docs/planning'), { recursive: true });

const ROOT_FILES = ['README.md', 'CLAUDE.md', 'CHANGELOG.md'];
const rootDocs = ROOT_FILES.map((f) => {
  try {
    return { rel: f, src: readFileSync(join(root, f), 'utf8') };
  } catch {
    return null;
  }
}).filter(Boolean);

// Writings/essays — the site's long-form content. DEDUP: the numbered papers
// (01-…, references.md) are the SAME family as docs/research/, so exclude any
// writing whose basename also appears there; keep only the standalone essays.
const researchBasenames = new Set(research.map((r) => r.rel.split('/').pop()));
const writings = readMdTree(join(site, 'src/content/writings')).filter(
  (w) => !researchBasenames.has(w.rel.split('/').pop()),
);

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

// Non-/docs site pages that carry authored knowledge (index, eli5, use-cases, the
// evidence example pages, lab, design, …). DEDUP: skip /docs (its own section),
// /writings and /recipes (their own sections/corpora), dynamic [ ] route
// templates (no literal content), 404, and changelog.astro (it renders CHANGELOG.md,
// which is included as a root file).
const pagesRoot = join(site, 'src/pages');
const otherPages = walkAstro(pagesRoot)
  .filter((p) => {
    const rel = p.slice(pagesRoot.length).replace(/\\/g, '/');
    if (rel.startsWith('/docs/') || rel.startsWith('/writings/') || rel.startsWith('/recipes/'))
      return false;
    if (rel.includes('[')) return false; // dynamic route templates
    if (/\/(404|changelog)\.astro$/.test(rel)) return false;
    return true;
  })
  .sort()
  .map((p) => {
    const src = readFileSync(p, 'utf8');
    const rel = p.slice(pagesRoot.length).replace(/\\/g, '/');
    const route = rel.replace(/\/index\.astro$/, '').replace(/\.astro$/, '') || '/';
    return { route, title: astroTitle(src, route), text: astroText(src) };
  })
  .filter((d) => d.text.length > 80);

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
// Data-driven API reference tables. The site's /docs/api/* pages render these
// from TS data at build time (src/lib/docs-api.ts + the engine's MANUAL_FORCES
// catalog), so the plain-text corpus never saw them. Reproduce them here as
// markdown tables so llms-full.txt is self-contained.
// ---------------------------------------------------------------------------
function mdTable(headers, rows) {
  const esc = (s) =>
    String(s ?? '')
      .replace(/\r?\n+/g, ' ')
      .replace(/\|/g, '\\|')
      .replace(/\s+/g, ' ')
      .trim();
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.map(esc).join(' | ')} |`).join('\n');
  return `${head}\n${sep}\n${body}`;
}
const apiTablesText = [
  `# API reference tables (data-driven)`,
  ``,
  `These are the tables the site's /docs/api pages generate at build time — from src/lib/docs-api.ts`,
  `and the engine's force catalog — reproduced here so the corpus is self-contained. They mirror the`,
  `frozen public surface (scripts/api-surface.data.mjs); if a symbol is not here, it does not exist.`,
  ``,
  `## createField(canvas, opts) — FieldOptions`,
  ``,
  mdTable(['Option', 'Type', 'Default', 'Description'], OPTIONS.map((o) => [o.name, o.type, o.def, o.desc])),
  ``,
  `## FieldHandle — runtime methods`,
  ``,
  mdTable(['Method', 'Description'], HANDLE.map((h) => [h.sig, h.desc])),
  ``,
  `## Body attributes (data-*)`,
  ``,
  mdTable(['Attribute', 'Type', 'Default', 'Description'], ATTRS.map((a) => [a.name, a.type, a.def ?? '', a.desc])),
  ``,
  `## Feedback / write-back CSS variables`,
  ``,
  mdTable(['Variable', 'Written on', 'Description'], WRITEBACK.map((w) => [w.name, w.on, w.desc])),
  ``,
  `## Render modes`,
  ``,
  mdTable(['Mode', 'Description'], RENDER_MODES.map((m) => [m.name, m.desc])),
  ``,
  `## Overlay modes`,
  ``,
  mdTable(['Mode', 'Description'], OVERLAY_MODES.map((m) => [m.name, m.desc])),
  ``,
  `## <field-root> attributes`,
  ``,
  mdTable(['Attribute', 'Maps to option', 'Description'], FIELD_ROOT_ATTRS.map((a) => [a.name, a.option, a.desc])),
  ``,
  `## Forces (${FORCES.length}) — the runtime token catalog`,
  ``,
  FORCES.length
    ? mdTable(
        ['Token', 'Family', 'Kind', 'Natural field', 'Attrs', 'Formula', 'Description'],
        FORCES.map((f) => [f.token, f.family, f.kind ?? '', f.field ?? '', (f.attrs || []).join(' '), f.formula, f.desc]),
      )
    : '_(force catalog unavailable — @fundamental-engine/core was not built at generation time)_',
].join('\n');

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
// section banner + body helpers
const banner = (title) => `${SEP}\n## ${title}\n${SEP}\n`;
const mdBody = (items, tag = 'FILE') =>
  items.map((m) => `${SEP}\nFILE: ${m.rel}\n${SEP}\n\n${m.src.trimEnd()}\n`).join('\n');
const pagesBodyOf = (items) =>
  items.map((d) => `${SEP}\nPAGE: ${d.route} — ${d.title}\n${SEP}\n\n${d.text.trimEnd()}\n`).join('\n');
const blockOf = (label, body) => `${SEP}\n${label}\n${SEP}\n\n${body.trimEnd()}\n`;

const fullHeader = `# Fundamental — full documentation corpus

Created by Zach Shallbetter (zachshallbetter.com).

Repository: https://github.com/zachshallbetter/fundamental-engine
Generated: ${DATE} by apps/site/scripts/gen-llms.mjs

Contents (in order):
  1. CANONICAL DOCUMENTS      docs/canonical/ — the authority on concepts, terminology, contracts (${canon.length})
  2. ENGINE REFERENCE         docs/engine-reference/ — the deep as-built engine spec (${engineRef.length})
  3. RESEARCH PAPERS          docs/research/ — the arXiv-style paper family (${research.length})
  4. PLANNING & FRONTIER      docs/planning/ — forward-looking design (the archive is excluded) (${planning.length})
  5. PROJECT FILES            README · CLAUDE · ROADMAP · BACKLOG · CHANGELOG (${rootDocs.length})
  6. API REFERENCE TABLES     the data-driven /docs/api tables (options, methods, attrs, forces)
  7. SITE DOCUMENTATION PAGES apps/site/src/pages/docs/ — authored prose (${docsPages.length})
  8. OTHER SITE PAGES         non-/docs pages that carry knowledge (${otherPages.length})
  9. WRITINGS & ESSAYS        the standalone essays (numbered papers dedup to §3) (${writings.length})
 10. FIELD RECIPES            the ${recipesData.count}-recipe catalog

The live site map is ${SITE_URL}/llms.txt.
`;

const full = [
  fullHeader,
  banner('CANONICAL DOCUMENTS'),
  mdBody(canon.map((c) => ({ rel: `docs/canonical/${c.file}`, src: c.src }))),
  banner('ENGINE REFERENCE'),
  mdBody(engineRef),
  banner('RESEARCH PAPERS'),
  mdBody(research),
  banner('PLANNING & FRONTIER'),
  mdBody(planning),
  banner('PROJECT FILES'),
  mdBody(rootDocs),
  banner('API REFERENCE TABLES'),
  blockOf('API: reference tables (data-driven)', apiTablesText),
  banner('SITE DOCUMENTATION PAGES'),
  pagesBodyOf(docsPages),
  banner('OTHER SITE PAGES'),
  pagesBodyOf(otherPages),
  banner('WRITINGS & ESSAYS'),
  mdBody(writings),
  banner('FIELD RECIPES'),
  blockOf('RECIPES: field-recipes (generated from data/recipes.json)', recipesText),
].join('\n');

// ---------------------------------------------------------------------------
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'llms.txt'), llms);
writeFileSync(join(outDir, 'llms-full.txt'), full);

console.log(
  `gen-llms: wrote llms.txt (${docsLines.length} docs, ${canonLines.length} canon, ${exampleLines.length} examples) ` +
    `and llms-full.txt (${(full.length / 1024).toFixed(0)} KiB): ${canon.length} canon + ${engineRef.length} engine-ref + ` +
    `${research.length} research + ${planning.length} planning + ${rootDocs.length} project files + ${FORCES.length} forces + ` +
    `${docsPages.length} docs pages + ${otherPages.length} other pages + ${writings.length} essays + ${recipesData.count} recipes`,
);
