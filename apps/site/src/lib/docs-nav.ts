// The developer-portal navigation tree — the single source for the sidebar, prev/next,
// and the docs shell's reference-integrity check (DocsRuntime.ts).
//
// Grouping (reader's journey): Start → Build → Reference → Substrate → Assurance →
// Research/Frontier → Examples. The normal developer path (install → build → API) comes
// first; the substrate model is a first-class group, not the entrance. Every route that
// existed before the regroup is preserved — grouping only, no page moves. Items that leave
// the docs shell (the invisible-fields example family, the recipe gallery, canonical/planning
// docs on GitHub) are marked `external` and are excluded from DOCS_FLAT so prev/next never
// walks a reader out of the shell.
//
// Substrate/Research entries that have no dedicated site page yet link the authoritative
// canonical or planning markdown on GitHub via GH_DOC() — the same blob pattern the site
// already uses for canon links. `ready: true` marks a page that exists; the sidebar renders
// only ready items (groups with none are hidden), so the tree can describe the whole portal
// while it fills in.

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
    title: 'Start',
    color: '#4da3ff',
    glyph: '▸',
    items: [
      { href: '/docs', label: 'Overview', ready: true },
      { href: '/docs/getting-started', label: 'Getting started', ready: true },
      { href: '/docs/tutorial', label: 'Your first field', ready: true },
      { href: '/docs/reactive-component', label: 'A reactive component', ready: true },
      { href: '/docs/concepts', label: 'Concepts', ready: true },
      { href: '/docs/natural-fields', label: 'Natural fields', ready: true },
      { href: '/docs/narrative', label: 'Narrative walkthrough', ready: true },
    ],
  },
  {
    title: 'Build',
    color: '#2dd4bf',
    glyph: '▦',
    items: [
      { href: '/docs/guides/typescript', label: 'Vanilla / TypeScript', ready: true },
      { href: '/docs/guides/react', label: 'React', ready: true },
      { href: '/docs/guides/web-component', label: 'Web component', ready: true },
      { href: '/docs/guides/three', label: 'Three.js', ready: true },
      { href: '/docs/guides/swift', label: 'Swift (Apple platforms)', ready: true },
      { href: '/docs/guides/kotlin', label: 'Kotlin (Android)', ready: true },
      { href: '/docs/guides/core', label: 'Core engine', ready: true },
      { href: '/docs/authoring', label: 'Authoring across surfaces', ready: true },
      { href: '/docs/recipes', label: 'Recipe model', ready: true },
      { href: '/docs/field-channels', label: 'Data binding & channels', ready: true },
      { href: '/docs/implementations', label: 'Implementations', ready: true },
      { href: '/docs/contour-typography', label: 'Contour typography', ready: true },
      { href: '/docs/reading-field', label: 'Reading Field demo', ready: true },
      { href: '/docs/showcase', label: 'Showcase & examples', ready: true },
    ],
  },
  {
    title: 'Reference',
    color: '#ff9d5c',
    glyph: '§',
    items: [
      { href: '/docs/api', label: 'API overview', ready: true },
      { href: '/docs/api/options', label: 'createField / Options', ready: true },
      { href: '/docs/api/handle', label: 'FieldHandle', ready: true },
      { href: '/docs/api/attributes', label: 'Attributes', ready: true },
      { href: '/docs/api/metrics', label: 'Metrics', ready: true },
      { href: '/docs/api/types', label: 'Types', ready: true },
      { href: '/docs/api/forces', label: 'Forces', ready: true },
      { href: '/docs/api/presets', label: 'Presets', ready: true },
      { href: '/docs/api/catalog', label: 'Conditions & formations', ready: true },
      { href: '/docs/api/stability', label: 'API stability', ready: true },
      { href: '/docs/api/parity', label: 'Platform parity matrix', ready: true },
      { href: '/docs/api/utilities', label: 'Platform utilities', ready: true },
    ],
  },
  {
    title: 'Substrate',
    color: '#a78bfa',
    glyph: '◈',
    items: [
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
      { href: '/docs/platform', label: 'Host model & platform layer', ready: true },
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
      { href: '/docs/inspector', label: 'Inspector & agent JSON', ready: true },
      { href: '/docs/diagnostics', label: 'Diagnostic overlays', ready: true },
    ],
  },
  {
    title: 'Assurance',
    color: '#f472b6',
    glyph: '✦',
    items: [
      { href: '/docs/accessibility', label: 'Accessibility', ready: true },
      { href: '/docs/accessibility-preview', label: 'Accessibility preview', ready: true },
      { href: '/docs/performance', label: 'Performance', ready: true },
      { href: '/docs/snapshots', label: 'Testing & conformance', ready: true },
      { href: '/docs/troubleshooting', label: 'Troubleshooting', ready: true },
      { href: '/docs/support', label: 'Support & stability', ready: true },
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
    title: 'Field studies',
    color: '#c084fc',
    glyph: '❖',
    items: [
      { href: '/docs/studies/reading-field', label: 'Reading Field Study', ready: true },
      { href: '/docs/studies/review-field', label: 'Review Field Study', ready: true },
      { href: '/docs/studies/search-field', label: 'Search Field Study', ready: true },
      { href: '/docs/studies/system-weather', label: 'System Weather Study', ready: true },
      { href: '/docs/studies/evidence-field', label: 'Evidence Field Study', ready: true },
      { href: '/docs/studies/visual-binding', label: 'Visual Binding Study', ready: true },
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
  '/recipes',
  '/lab',
  '/writings',
];
