/**
 * og-cards.ts — the single source of truth for which pages get a generated Open
 * Graph card and what it says. Imported by BOTH the /og/[...route].png endpoint
 * (which renders the cards) and Base.astro (which points og:image/twitter:image
 * at the matching card), so the two can never drift. Writing articles are covered
 * dynamically from the content collection; the curated list below covers the key
 * marketing/landing pages. Anything not matched falls back to the static /og.jpg.
 */

export interface OgCardProps {
  /** small uppercase label above the title */
  eyebrow: string;
  /** the headline rendered on the card */
  title: string;
  /** 'hero' renders the homepage hero composition over a frame of the live field
   *  (src/lib/og-hero-field.ts) instead of the plain title card. */
  layout?: 'hero';
  /** the line under a hero headline (the homepage thesis). */
  line?: string;
}

/** A curated page that gets a bespoke card. `path` is the live URL; `route` is the
 *  generated card segment (→ /og/<route>.png). */
export interface StaticOgCard extends OgCardProps {
  path: string;
  route: string;
  /** og:image:alt for this card, when the card says something other than the page title. */
  alt?: string;
}

export const STATIC_OG_CARDS: StaticOgCard[] = [
  {
    path: '/',
    route: 'home',
    eyebrow: 'Fundamental',
    title: 'Elements have mass.',
    line: 'You can label everything urgent. You cannot make everything heavy.',
    layout: 'hero',
    alt: 'Elements have mass. You can label everything urgent. You cannot make everything heavy. Fundamental, a relational field runtime for interfaces.',
  },
  { path: '/docs', route: 'docs', eyebrow: 'Documentation', title: 'Build with Fundamental' },
  { path: '/lab', route: 'lab', eyebrow: 'The Lab', title: 'Fire a particle into any force and watch the law hold' },
  { path: '/patterns', route: 'patterns', eyebrow: 'Patterns', title: 'Field patterns, ready to run' },
  { path: '/use-cases', route: 'use-cases', eyebrow: 'Use cases', title: 'What a relational field is for' },
  { path: '/writings', route: 'writings', eyebrow: 'Writings', title: 'The field model, in essays' },
];

/** The og:image:alt a curated card declares, or null to fall back to the page title. */
export function ogImageAltForPath(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return STATIC_OG_CARDS.find((c) => c.path === clean)?.alt ?? null;
}

/**
 * Map a live pathname to its generated card URL (site-absolute path), or null if
 * the page has no bespoke card. Trailing slashes are normalized.
 */
export function ogImageForPath(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const stat = STATIC_OG_CARDS.find((c) => c.path === clean);
  if (stat) return `/og/${stat.route}.png`;
  const writing = clean.match(/^\/writings\/(.+)$/);
  if (writing) return `/og/writings/${writing[1]}.png`;
  return null;
}
