/**
 * og-cards.ts — the single source of truth for per-page Open Graph cards. Imported
 * by BOTH the /og/[...route].png endpoint (which renders the cards) and Base.astro
 * (which points og:image/twitter:image at the matching card), so the two can never
 * drift. Bespoke cards cover the curated top-level + evidence pages below and every
 * writing (added dynamically in the endpoint). Docs and pattern pages share their
 * section card (/og/docs.png, /og/patterns.png) — bespoke per-page cards for those
 * ~130 routes tripled the build time for little gain — and anything else falls back
 * to the static /og.jpg.
 */

export interface OgCardProps {
  /** small uppercase label above the title */
  eyebrow: string;
  /** the headline rendered on the card */
  title: string;
}

/** A page that gets a bespoke card. `path` is the live URL; `route` is the generated
 *  card segment (→ /og/<route>.png). */
export interface StaticOgCard extends OgCardProps {
  path: string;
  route: string;
}

/** Curated landing / section / top-level pages. Docs pages and patterns are added
 *  programmatically below — these are the hand-written headlines. */
export const STATIC_OG_CARDS: StaticOgCard[] = [
  { path: '/', route: 'home', eyebrow: 'Fundamental', title: 'A relational field runtime for interfaces' },
  { path: '/docs', route: 'docs', eyebrow: 'Documentation', title: 'Build with Fundamental' },
  { path: '/lab', route: 'lab', eyebrow: 'The Lab', title: 'Fire a particle into any force and watch the law hold' },
  { path: '/patterns', route: 'patterns', eyebrow: 'Patterns', title: 'Field patterns, ready to run' },
  { path: '/use-cases', route: 'use-cases', eyebrow: 'Use cases', title: 'What a relational field is for' },
  { path: '/writings', route: 'writings', eyebrow: 'Writings', title: 'The field model, in essays' },
  // top-level surfaces
  { path: '/demo', route: 'demo', eyebrow: 'Demo', title: 'The field, live in the browser' },
  { path: '/eli5', route: 'eli5', eyebrow: 'Explain it simply', title: 'Fundamental, in plain language' },
  { path: '/engine-tour', route: 'engine-tour', eyebrow: 'Engine tour', title: 'How the field runtime works, end to end' },
  { path: '/three', route: 'three', eyebrow: 'Three.js', title: 'The field in 3D with @fundamental-engine/three' },
  { path: '/examples', route: 'examples', eyebrow: 'Examples', title: 'Fundamental in working interfaces' },
  { path: '/changelog', route: 'changelog', eyebrow: 'Changelog', title: "What's shipped in Fundamental" },
  { path: '/ai-evidence', route: 'ai-evidence', eyebrow: 'AI evidence', title: 'Evidence fields for AI interfaces' },
  { path: '/relational-manga', route: 'relational-manga', eyebrow: 'Relational manga', title: 'The field model, drawn' },
  { path: '/relational-publications', route: 'relational-publications', eyebrow: 'Publications', title: 'The Fundamental research papers' },
  { path: '/pollinate', route: 'pollinate', eyebrow: 'Pollinate', title: 'Carry the field into your own work' },
  { path: '/rc', route: 'rc', eyebrow: 'Release candidate', title: 'The road to Fundamental 1.0' },
  // evidence surfaces (the live, self-measured data pages)
  { path: '/evidence', route: 'evidence', eyebrow: 'Evidence', title: 'The project, measured in the open' },
  { path: '/evidence/overview', route: 'evidence/overview', eyebrow: 'Evidence', title: 'Project overview, self-measured' },
  { path: '/evidence/backlog', route: 'evidence/backlog', eyebrow: 'Evidence', title: 'The backlog as a field' },
  { path: '/evidence/calendar', route: 'evidence/calendar', eyebrow: 'Evidence', title: 'The release calendar' },
  { path: '/evidence/catalog', route: 'evidence/catalog', eyebrow: 'Evidence', title: 'The pattern & force catalog' },
  { path: '/evidence/dependencies', route: 'evidence/dependencies', eyebrow: 'Evidence', title: 'Dependencies as a field' },
  { path: '/evidence/fleet', route: 'evidence/fleet', eyebrow: 'Evidence', title: 'The runtime fleet, live' },
  { path: '/evidence/inbox', route: 'evidence/inbox', eyebrow: 'Evidence', title: 'The inbox as a field' },
  { path: '/evidence/library', route: 'evidence/library', eyebrow: 'Evidence', title: 'The reference library' },
  { path: '/evidence/market', route: 'evidence/market', eyebrow: 'Evidence', title: 'The market as a field' },
  { path: '/evidence/memory', route: 'evidence/memory', eyebrow: 'Evidence', title: 'Interface memory, made visible' },
  { path: '/evidence/newsroom', route: 'evidence/newsroom', eyebrow: 'Evidence', title: 'The newsroom as a field' },
  { path: '/evidence/threads', route: 'evidence/threads', eyebrow: 'Evidence', title: 'Threads ranked by the field' },
];

/** Every bespoke card (minus writings, which the endpoint adds from the collection).
 *  Deduped by route so a path listed twice can't create duplicate static paths. */
export function allOgCards(): StaticOgCard[] {
  const seen = new Set<string>();
  const out: StaticOgCard[] = [];
  for (const c of STATIC_OG_CARDS) {
    if (seen.has(c.route)) continue;
    seen.add(c.route);
    out.push(c);
  }
  return out;
}

// path → card route, for the fast lookup in ogImageForPath (built once at module load).
const PATH_TO_ROUTE = new Map<string, string>(allOgCards().map((c) => [c.path, c.route]));

/**
 * Map a live pathname to its generated card URL (site-absolute), or null if the page
 * has no card at all (→ the static /og.jpg fallback in Base). Trailing slashes are
 * normalized. Writings are matched by shape; unlisted docs/patterns/evidence pages
 * fall back to their section card so a share always gets a relevant image.
 */
export function ogImageForPath(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const exact = PATH_TO_ROUTE.get(clean);
  if (exact) return `/og/${exact}.png`;
  const writing = clean.match(/^\/writings\/(.+)$/);
  if (writing) return `/og/writings/${writing[1]}.png`;
  // section fallbacks for any page not individually carded
  if (clean.startsWith('/docs/') || clean === '/docs') return '/og/docs.png';
  if (clean.startsWith('/patterns/') || clean === '/patterns') return '/og/patterns.png';
  if (clean.startsWith('/evidence/') || clean === '/evidence') return '/og/evidence.png';
  return null;
}
