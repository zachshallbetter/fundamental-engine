// The developer-portal navigation tree — the single source for the sidebar, prev/next,
// and the docs shell's reference-integrity check (DocsRuntime.ts).
//
// THE FIVE-SECTION SPINE (docs-refactor Phase 6, #1001 — plan §6):
//   Learn → Understand → Build → Reference → Platforms
// plus two trailing rails that leave the docs shell (Research / Frontier, Examples). The spine is
// task-shaped rather than module-shaped: a reader arrives at Learn, forms the model in Understand,
// looks up a task in Build, looks up a symbol in Reference, and checks their own plane in Platforms.
//
// Before this phase the tree was grouped by artifact (Start · Build · Cookbook · Reference ·
// Substrate · Assurance · Research · Field studies · Examples) and the same topic was split across
// several thin pages. Phase 6 merged the pages Phases 2 (#997) and 3 (#998) superseded and folded
// the concepts pages into one narrative. **Every retired URL redirects** — the map lives in
// `src/lib/docs-redirects.mjs`, and `docs-redirects.test.ts` fails the build if a route enumerated
// here has been retired, or a retired route lost its redirect.
//
// Items that leave the docs shell (the invisible-fields example family, the recipe gallery,
// canonical/planning docs on GitHub) are marked `external` and are excluded from DOCS_FLAT so
// prev/next never walks a reader out of the shell. Substrate/Research entries with no dedicated site
// page link the authoritative canonical or planning markdown on GitHub via GH_DOC() — the same blob
// pattern the site already uses for canon links. `ready: true` marks a page that exists; the sidebar
// renders only ready items (groups with none are hidden).

import { INVISIBLE_FIELDS } from './invisible-fields.ts';

// The GitHub blob base for linking authoritative markdown that has no site page yet — the
// same pattern platform.astro / the writings use for canon links.
const GH_BLOB = 'https://github.com/zachshallbetter/fundamental-engine/blob/main';
const GH_DOC = (path: string) => `${GH_BLOB}/${path}`;

export interface DocLink {
  href: string;
  label: string;
  ready?: boolean;
  /** leaves the docs shell (different layout) — rendered with ↗, excluded from prev/next. */
  external?: boolean;
}
export interface DocGroup {
  title: string;
  items: DocLink[];
  /** accent color for the group — the per-section wayfinding color (sidebar marker, search hits). */
  color?: string;
  /** a small mono glyph marking the group in the sidebar. */
  glyph?: string;
}

// The example family's flagship deep-links — pulled from the roster so it stays the
// single source of truth (names, hrefs). /evidence is the family's front door.
const FLAGSHIP_SLUGS = ['market', 'backlog', 'calendar'] as const;
const flagships: DocLink[] = INVISIBLE_FIELDS.filter((f) =>
  (FLAGSHIP_SLUGS as readonly string[]).includes(f.slug),
).map((f) => ({ href: f.href, label: f.name, ready: true, external: true }));

export const DOCS_NAV: DocGroup[] = [
  {
    // 1 · LEARN — one guided path, in textbook order. Install → a first field → a reacting
    // component → the model. Each step is runnable and reference is always one click away.
    title: 'Learn',
    color: '#4da3ff',
    glyph: '▸',
    items: [
      { href: '/docs', label: 'Overview', ready: true },
      { href: '/docs/getting-started', label: 'Getting started', ready: true },
      { href: '/docs/tutorial', label: 'Your first field', ready: true },
      { href: '/docs/reactive-component', label: 'A reactive component', ready: true },
      { href: '/docs/concepts', label: 'Concepts — the field model', ready: true },
    ],
  },
  {
    // 2 · UNDERSTAND — the model and the substrate beneath it, then the studies that put the model
    // under load. The concepts narrative itself lives in Learn as the on-ramp's last step; these are
    // what it opens onto.
    title: 'Understand',
    color: '#a78bfa',
    glyph: '◈',
    items: [
      { href: '/docs/patterns', label: 'Pattern model', ready: true },
      { href: '/docs/platform', label: 'Host model & platform layer', ready: true },
      { href: '/docs/inspector', label: 'Inspector & agent JSON', ready: true },
      { href: '/docs/diagnostics', label: 'Diagnostic overlays', ready: true },
      {
        href: GH_DOC('docs/canonical/substrate-overview.md'),
        label: 'Substrate overview',
        ready: true,
        external: true,
      },
      {
        href: GH_DOC('docs/canonical/substrate-api.md'),
        label: 'Query / Snapshot / Replay',
        ready: true,
        external: true,
      },
      {
        href: GH_DOC('docs/canonical/coordinate-spaces.md'),
        label: 'Coordinate spaces',
        ready: true,
        external: true,
      },
      {
        href: GH_DOC('docs/canonical/body-lifecycle.md'),
        label: 'Body lifecycle',
        ready: true,
        external: true,
      },
      {
        href: GH_DOC('docs/canonical/agent-consumption-model.md'),
        label: 'Agent consumption model',
        ready: true,
        external: true,
      },
      {
        href: GH_DOC('docs/canonical/causality-and-truth.md'),
        label: 'Causality & truth',
        ready: true,
        external: true,
      },
      { href: '/docs/studies/reading-field', label: 'Study — Reading Field', ready: true },
      { href: '/docs/studies/review-field', label: 'Study — Review Field', ready: true },
      { href: '/docs/studies/search-field', label: 'Study — Search Field', ready: true },
      { href: '/docs/studies/system-weather', label: 'Study — System Weather', ready: true },
      { href: '/docs/studies/evidence-field', label: 'Study — Evidence Field', ready: true },
      { href: '/docs/studies/visual-binding', label: 'Study — Visual Binding', ready: true },
    ],
  },
  {
    // 3 · BUILD — lookup by task. The cookbook (Phase 5, #1000) is the spine of this section; the
    // authoring narrative, the channel and typography surfaces, and the assurance pages
    // (accessibility, performance, conformance, troubleshooting) are the rest of "what you do next".
    title: 'Build',
    color: '#2dd4bf',
    glyph: '▦',
    items: [
      { href: '/docs/cookbook', label: 'Patterns by task', ready: true },
      { href: '/docs/cookbook/signals-first', label: 'Signals-first fields', ready: true },
      { href: '/docs/cookbook/contained-fields', label: 'Contained fields', ready: true },
      { href: '/docs/cookbook/data-driven', label: 'Data-driven fields', ready: true },
      { href: '/docs/cookbook/reading-the-field', label: 'Reading & instrumenting', ready: true },
      { href: '/docs/cookbook/conditions-and-formations', label: 'Conditions & formations', ready: true },
      { href: '/docs/cookbook/workbench', label: 'The visualization workbench', ready: true },
      { href: '/docs/cookbook/performance-tuning', label: 'Performance tuning', ready: true },
      { href: '/docs/cookbook/interface-chrome', label: 'Chrome & accessibility', ready: true },
      { href: '/docs/cookbook/framework-interop', label: 'Framework interop', ready: true },
      { href: '/docs/authoring', label: 'Authoring across surfaces', ready: true },
      { href: '/docs/field-channels', label: 'Data binding & channels', ready: true },
      { href: '/docs/contour-typography', label: 'Contour typography', ready: true },
      { href: '/docs/reading-field', label: 'Reading Field demo', ready: true },
      { href: '/docs/showcase', label: 'Showcase & examples', ready: true },
      { href: '/docs/accessibility', label: 'Accessibility', ready: true },
      { href: '/docs/accessibility-preview', label: 'Accessibility preview', ready: true },
      { href: '/docs/performance', label: 'Performance', ready: true },
      { href: '/docs/snapshots', label: 'Testing & conformance', ready: true },
      { href: '/docs/troubleshooting', label: 'Troubleshooting', ready: true },
    ],
  },
  {
    // 4 · REFERENCE — one consolidated, generated, searchable surface. TWO pages carry the whole
    // API: what you write in markup, and what you reach from code. Everything that used to be a
    // thin per-topic page under /docs/api/ was merged into one of them by Phase 6 and redirects
    // there (see src/lib/docs-redirects.mjs). What remains beside them is genuinely separate: the
    // web-only utilities, the freeze contract, and the support policy.
    title: 'Reference',
    color: '#ff9d5c',
    glyph: '§',
    items: [
      { href: '/docs/api', label: 'API overview', ready: true },
      { href: '/docs/api/declarative', label: 'Declarative reference', ready: true },
      { href: '/docs/api/imperative', label: 'Imperative reference', ready: true },
      { href: '/docs/api/utilities', label: 'Platform utilities', ready: true },
      { href: '/docs/api/stability', label: 'API stability', ready: true },
      { href: '/docs/support', label: 'Support & stability', ready: true },
    ],
  },
  {
    // 5 · PLATFORMS — the honest per-platform story, anchored by the generated parity matrix. No
    // implied uniformity: each door documents its actual surface, and the matrix says what a plane
    // does not have.
    title: 'Platforms',
    color: '#facc15',
    glyph: '◆',
    items: [
      { href: '/docs/implementations', label: 'One engine, many surfaces', ready: true },
      { href: '/docs/guides/typescript', label: 'Vanilla / TypeScript', ready: true },
      { href: '/docs/guides/react', label: 'React', ready: true },
      { href: '/docs/guides/web-component', label: 'Web component', ready: true },
      { href: '/docs/guides/three', label: 'Three.js', ready: true },
      { href: '/docs/guides/swift', label: 'Swift (Apple platforms)', ready: true },
      { href: '/docs/guides/kotlin', label: 'Kotlin (Android)', ready: true },
      { href: '/docs/guides/core', label: 'Core engine', ready: true },
      { href: '/docs/api/parity', label: 'Platform parity matrix', ready: true },
    ],
  },
  {
    title: 'Research / Frontier',
    color: '#7dd3fc',
    glyph: '◐',
    items: [
      { href: '/writings', label: 'Papers', ready: true, external: true },
      {
        href: GH_DOC('docs/planning/field-protocol.md'),
        label: 'Field Protocol',
        ready: true,
        external: true,
      },
      {
        href: GH_DOC('docs/planning/field-bridge.md'),
        label: 'Field Bridge',
        ready: true,
        external: true,
      },
      {
        href: GH_DOC('docs/planning/materials-and-weather.md'),
        label: 'Materials & weather',
        ready: true,
        external: true,
      },
      {
        href: GH_DOC('docs/planning/field-os-frontier.md'),
        label: 'OS / AI / data frontier',
        ready: true,
        external: true,
      },
    ],
  },
  {
    title: 'Examples',
    color: '#5eead4',
    glyph: '◉',
    items: [
      { href: '/ai-evidence', label: 'AI Evidence', ready: true, external: true },
      { href: '/demo', label: 'Substrate Demo', ready: true, external: true },
      { href: '/evidence', label: 'Invisible Fields', ready: true, external: true },
      ...flagships,
      { href: '/patterns', label: 'Pattern gallery', ready: true, external: true },
    ],
  },
];

/**
 * The flat list of ready, in-shell pages in reading order — for prev/next.
 * External items (the Examples group) live in a different shell and are excluded.
 */
export const DOCS_FLAT: DocLink[] = DOCS_NAV.flatMap((g) =>
  g.items.filter((i) => i.ready && !i.external),
);

/**
 * The wayfinding color for a route — the color of the DOCS_NAV group that owns it (exact match,
 * then longest-prefix family match). Used to color-code search hits by section. Falls back to a
 * neutral gray for routes outside the docs tree.
 */
export function groupColorFor(href: string): string {
  const route = (href.split('#')[0]!.split('?')[0] || '/').replace(/\/$/, '') || '/';
  for (const g of DOCS_NAV)
    if (g.items.some((i) => (i.href.replace(/\/$/, '') || '/') === route)) return g.color ?? '#9aa7b4';
  let best: { len: number; color: string } | null = null;
  for (const g of DOCS_NAV)
    for (const i of g.items) {
      const base = i.href.replace(/\/$/, '');
      if (base && base !== '/' && route.startsWith(`${base}/`) && (!best || base.length > best.len))
        best = { len: base.length, color: g.color ?? '#9aa7b4' };
    }
  return best?.color ?? '#9aa7b4';
}

/**
 * Route families the docs may link into that are NOT enumerated by DOCS_NAV —
 * known-good prefixes for the docs shell's reference-integrity check. A site-internal
 * href resolves when its route is in DOCS_NAV (exact) or starts with one of these.
 */
export const ROUTE_FAMILIES: string[] = [
  '/evidence',
  '/ai-evidence',
  '/demo',
  '/patterns',
  '/lab',
  '/writings',
];
