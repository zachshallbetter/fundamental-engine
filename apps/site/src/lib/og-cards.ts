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
}

/** A curated page that gets a bespoke card. `path` is the live URL; `route` is the
 *  generated card segment (→ /og/<route>.png). */
export interface StaticOgCard extends OgCardProps {
  path: string;
  route: string;
}

export const STATIC_OG_CARDS: StaticOgCard[] = [
  { path: '/', route: 'home', eyebrow: 'Fundamental', title: 'A relational field runtime for interfaces' },
  { path: '/docs', route: 'docs', eyebrow: 'Documentation', title: 'Build with Fundamental' },
  { path: '/lab', route: 'lab', eyebrow: 'The Lab', title: 'Fire a particle into any force and watch the law hold' },
  { path: '/patterns', route: 'patterns', eyebrow: 'Patterns', title: 'Field patterns, ready to run' },
  { path: '/use-cases', route: 'use-cases', eyebrow: 'Use cases', title: 'What a relational field is for' },
  { path: '/writings', route: 'writings', eyebrow: 'Writings', title: 'The field model, in essays' },
];

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
