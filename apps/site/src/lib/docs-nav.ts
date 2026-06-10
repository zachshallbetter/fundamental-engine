// The developer-portal navigation tree — the single source for the sidebar, prev/next,
// and the docs shell's reference-integrity check (DocsRuntime.ts).
//
// Grouping (reader's journey): Start here → Concepts → Build → Reference → Field studies
// → Examples. Every route that existed before the regroup is preserved — grouping only,
// no page moves. The Examples group deep-links OUT of the docs shell (the invisible-fields
// example family + the recipe gallery); its items are marked `external` and are excluded
// from DOCS_FLAT so prev/next never walks a reader out of the shell.
//
// `ready: true` marks a page that exists; the sidebar renders only ready items (groups
// with none are hidden), so the tree can describe the whole portal while it fills in.

import { INVISIBLE_FIELDS } from './invisible-fields.ts';

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
}

// The example family's flagship deep-links — pulled from the roster so it stays the
// single source of truth (names, hrefs). /evidence is the family's front door.
const FLAGSHIP_SLUGS = ['market', 'backlog', 'calendar'] as const;
const flagships: DocLink[] = INVISIBLE_FIELDS.filter((f) =>
  (FLAGSHIP_SLUGS as readonly string[]).includes(f.slug),
).map((f) => ({ href: f.href, label: f.name, ready: true, external: true }));

export const DOCS_NAV: DocGroup[] = [
  {
    title: 'Start here',
    items: [
      { href: '/docs', label: 'Overview', ready: true },
      { href: '/docs/tutorial', label: 'Your first field', ready: true },
      { href: '/docs/guides/web-component', label: 'Web component', ready: true },
      { href: '/docs/guides/typescript', label: 'TypeScript', ready: true },
      { href: '/docs/guides/react', label: 'React', ready: true },
      { href: '/docs/guides/core', label: 'Core engine', ready: true },
    ],
  },
  {
    title: 'Concepts',
    items: [
      { href: '/docs/concepts', label: 'Concepts', ready: true },
      { href: '/docs/natural-fields', label: 'Natural fields', ready: true },
      { href: '/docs/narrative', label: 'Narrative walkthrough', ready: true },
      { href: '/docs/reading-field', label: 'Reading Field', ready: true },
    ],
  },
  {
    title: 'Build',
    items: [
      { href: '/docs/authoring', label: 'Authoring across surfaces', ready: true },
      { href: '/docs/recipes', label: 'Recipe model', ready: true },
      { href: '/docs/platform', label: 'Platform layer', ready: true },
      { href: '/docs/performance', label: 'Performance', ready: true },
      { href: '/docs/accessibility', label: 'Accessibility', ready: true },
      { href: '/docs/troubleshooting', label: 'Troubleshooting', ready: true },
    ],
  },
  {
    title: 'Reference',
    items: [
      { href: '/docs/api', label: 'Overview', ready: true },
      { href: '/docs/api/options', label: 'createField', ready: true },
      { href: '/docs/api/handle', label: 'FieldHandle', ready: true },
      { href: '/docs/api/attributes', label: 'Attributes', ready: true },
      { href: '/docs/api/metrics', label: 'Metrics', ready: true },
      { href: '/docs/api/types', label: 'Types', ready: true },
      { href: '/docs/api/stability', label: 'API stability', ready: true },
      { href: '/docs/api/forces', label: 'Forces', ready: true },
      { href: '/docs/api/presets', label: 'Presets', ready: true },
      { href: '/docs/api/catalog', label: 'Conditions & formations', ready: true },
    ],
  },
  {
    title: 'Field studies',
    items: [
      { href: '/docs/studies/reading-field', label: 'Reading Field Study', ready: true },
      { href: '/docs/studies/review-field', label: 'Review Field Study', ready: true },
      { href: '/docs/studies/search-field', label: 'Search Field Study', ready: true },
      { href: '/docs/studies/system-weather', label: 'System Weather Study', ready: true },
      { href: '/docs/studies/evidence-field', label: 'Evidence Field Study', ready: true },
      { href: '/docs/studies/visual-binding', label: 'Visual Binding Study', ready: true },
      { href: '/docs/showcase', label: 'Showcase', ready: true },
      { href: '/docs/diagnostics', label: 'Diagnostic overlays', ready: true },
      { href: '/docs/inspector', label: 'Inspector', ready: true },
      { href: '/docs/snapshots', label: 'Snapshot viewer', ready: true },
      { href: '/docs/accessibility-preview', label: 'Accessibility preview', ready: true },
    ],
  },
  {
    title: 'Examples',
    items: [
      { href: '/evidence', label: 'Evidence', ready: true, external: true },
      ...flagships,
      { href: '/recipes', label: 'Recipe gallery', ready: true, external: true },
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
 * Route families the docs may link into that are NOT enumerated by DOCS_NAV —
 * known-good prefixes for the docs shell's reference-integrity check. A site-internal
 * href resolves when its route is in DOCS_NAV (exact) or starts with one of these.
 */
export const ROUTE_FAMILIES: string[] = ['/evidence', '/recipes', '/lab', '/writings'];
