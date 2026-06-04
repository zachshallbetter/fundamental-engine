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
      { href: '/docs/concepts', label: 'Concepts', ready: true },
    ],
  },
  {
    title: 'Guides',
    items: [
      { href: '/docs/guides/web-component', label: 'Web component' },
      { href: '/docs/guides/vanilla', label: 'Vanilla / core' },
      { href: '/docs/guides/react', label: 'React' },
    ],
  },
  {
    title: 'API reference',
    items: [
      { href: '/docs/api', label: 'Overview' },
      { href: '/docs/api/options', label: 'createField & options' },
      { href: '/docs/api/handle', label: 'FieldHandle' },
      { href: '/docs/api/attributes', label: 'data-* attributes' },
      { href: '/docs/api/forces', label: 'Forces' },
      { href: '/docs/api/presets', label: 'Presets' },
      { href: '/docs/api/conditions', label: 'Conditions' },
      { href: '/docs/api/formations', label: 'Formations' },
      { href: '/docs/api/render-modes', label: 'Render modes' },
      { href: '/docs/api/palettes', label: 'Palettes' },
      { href: '/docs/api/types', label: 'Types' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { href: '/docs/recipes', label: 'Recipes' },
      { href: '/docs/performance', label: 'Performance' },
      { href: '/docs/accessibility', label: 'Accessibility' },
    ],
  },
];

/** The flat list of ready pages in reading order — for prev/next. */
export const DOCS_FLAT: DocLink[] = DOCS_NAV.flatMap((g) => g.items.filter((i) => i.ready));
