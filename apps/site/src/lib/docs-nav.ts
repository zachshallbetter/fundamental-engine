// The developer-portal navigation tree — the single source for the sidebar and
// prev/next. `ready: true` marks a page that exists; the sidebar renders only ready
// items (groups with none are hidden), so the tree can describe the whole portal
// while it fills in phase by phase.

export interface DocLink {
  href: string;
  label: string;
  ready?: boolean;
}
export interface DocGroup {
  title: string;
  items: DocLink[];
}

export const DOCS_NAV: DocGroup[] = [
  {
    title: 'Getting started',
    items: [
      { href: '/docs', label: 'Overview', ready: true },
      { href: '/docs/tutorial', label: 'Your first field', ready: true },
      { href: '/docs/concepts', label: 'Concepts', ready: true },
    ],
  },
  {
    title: 'Guides',
    items: [
      { href: '/docs/guides/web-component', label: 'Web component', ready: true },
      { href: '/docs/guides/typescript', label: 'TypeScript', ready: true },
      { href: '/docs/guides/react', label: 'React', ready: true },
      { href: '/docs/guides/core', label: 'Core engine', ready: true },
    ],
  },
  {
    title: 'API reference',
    items: [
      { href: '/docs/api', label: 'Overview', ready: true },
      { href: '/docs/api/options', label: 'createField', ready: true },
      { href: '/docs/api/handle', label: 'FieldHandle', ready: true },
      { href: '/docs/api/attributes', label: 'Attributes', ready: true },
      { href: '/docs/api/types', label: 'Types', ready: true },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { href: '/docs/api/forces', label: 'Forces', ready: true },
      { href: '/docs/api/presets', label: 'Presets', ready: true },
      { href: '/docs/api/catalog', label: 'Conditions & formations', ready: true },
    ],
  },
  {
    title: 'Resources',
    items: [
      { href: '/docs/recipes', label: 'Recipes', ready: true },
      { href: '/docs/gallery', label: 'Recipe gallery', ready: true },
      { href: '/docs/inspector', label: 'Inspector', ready: true },
      { href: '/docs/snapshots', label: 'Snapshot viewer', ready: true },
      { href: '/docs/diagnostics', label: 'Diagnostic overlays', ready: true },
      { href: '/docs/troubleshooting', label: 'Troubleshooting', ready: true },
      { href: '/docs/performance', label: 'Performance', ready: true },
      { href: '/docs/accessibility', label: 'Accessibility', ready: true },
    ],
  },
];

/** The flat list of ready pages in reading order — for prev/next. */
export const DOCS_FLAT: DocLink[] = DOCS_NAV.flatMap((g) => g.items.filter((i) => i.ready));
