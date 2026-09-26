/**
 * RETIRED DOCS ROUTES — the single source of truth for every URL Phase 6 moved.
 *
 * docs-refactor Phase 6 (#1001) consolidated the documentation onto the five-section spine. Phases 2
 * (#997) and 3 (#998) built the two consolidated reference pages but deliberately LEFT the pages they
 * superseded in place, cross-linked, so nothing broke mid-refactor; this phase finishes the job. The
 * acceptance criterion for that job is **no orphaned URLs**: a retired page is only allowed to
 * disappear if its URL still resolves.
 *
 * This file is that guarantee, in one place:
 *   · `astro.config.mjs` spreads `redirectMap()` into Astro's `redirects`, which emits a redirect stub
 *     at each old URL in the static build;
 *   · `docs-redirects.test.ts` (a `pnpm test` gate) asserts every entry still points at a page that
 *     exists, that no retired route has a page file shadowing its redirect, and that no source file
 *     still LINKS to a retired route;
 *   · `e2e/redirects.spec.ts` asserts the built site actually serves each one.
 *
 * So a future refactor cannot quietly re-orphan one of these, and cannot add a redirect that points
 * into the void. Add a route here when you retire one — never delete a page without an entry.
 *
 * `.mjs` rather than `.ts` on purpose: `astro.config.mjs` imports it directly, before any TS
 * toolchain is in play.
 */

/**
 * old route → where it went, and why it moved. `to` may carry a fragment; the redirect stub itself
 * lands the reader on the page (a meta-refresh drops the incoming fragment), so the fragment here is
 * the *authoring* target — what an in-repo link should be rewritten to.
 *
 * @type {Record<string, { to: string; why: string }>}
 */
export const RETIRED_ROUTES = {
  // ── the declarative half: merged into /docs/api/declarative (Phase 2, #997) ──────────────────
  '/docs/api/attributes': {
    to: '/docs/api/declarative#body-contract',
    why: 'the attribute table is the declarative reference\'s body contract, with a generated per-platform row per attribute',
  },
  '/docs/api/forces': {
    to: '/docs/api/declarative#forces',
    why: 'the force cards (law, glyph, live cell, example) moved onto the declarative reference beside their support rows',
  },
  '/docs/api/catalog': {
    to: '/docs/api/declarative#conditions',
    why: 'conditions, formations, render and overlay vocabularies are sections of the declarative reference; the palettes came with them',
  },
  '/docs/api/presets': {
    to: '/docs/api/declarative#presets',
    why: 'data-preset is part of the markup surface — the preset catalog is a section of the declarative reference',
  },
  '/docs/api/metrics': {
    to: '/docs/api/declarative#feedback',
    why: 'the --field-* metric lane joined the feedback channels, which is now the one canonical place the density story is told',
  },

  // ── the imperative half: merged into /docs/api/imperative (Phase 3, #998) ────────────────────
  '/docs/api/options': {
    to: '/docs/api/imperative#options',
    why: 'createField and every FieldOptions entry live on the imperative reference, each with a generated support row',
  },
  '/docs/api/handle': {
    to: '/docs/api/imperative#handle',
    why: 'the whole FieldHandle is on the imperative reference; the old page also carried a hand-typed parity claim the matrix disproved',
  },
  '/docs/api/types': {
    to: '/docs/api/imperative#types',
    why: 'the Force / Body / Particle / Env contracts are the code surface — they belong beside the API that returns them',
  },

  // ── one concepts narrative instead of three pages (plan §6.2) ────────────────────────────────
  '/docs/natural-fields': {
    to: '/docs/concepts#natural-fields',
    why: 'the four-field translation model is a chapter of the concepts narrative, not a page of its own',
  },
  '/docs/narrative': {
    to: '/docs/concepts#walkthrough',
    why: 'the layer-by-layer walkthrough is the concepts narrative demonstrating itself',
  },
};

/** The map Astro's `redirects` wants: `{ '/old': '/new' }`. */
export function redirectMap() {
  return Object.fromEntries(Object.entries(RETIRED_ROUTES).map(([from, r]) => [from, r.to]));
}

/** Every retired route, for a gate that wants to assert nothing links to one. */
export const RETIRED_PATHS = Object.keys(RETIRED_ROUTES);

/**
 * Redirects that predate Phase 6. Kept here so the sitemap filter and the redirect gate see the
 * WHOLE set of stubs the build emits, not just the ones this phase added.
 *
 * @type {Record<string, string>}
 */
export const LEGACY_REDIRECTS = {
  '/recipes': '/patterns',
  '/recipes/[id]': '/patterns/[id]',
  '/docs/recipes': '/docs/patterns',
  '/reference': '/',
  '/docs/guides/vanilla': '/docs/guides/core',
  '/research': '/writings',
  '/research/[...slug]': '/writings/[...slug]',
};
