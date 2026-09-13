/**
 * THE ORPHANED-URL GATE — docs-refactor Phase 6 (#1001).
 *
 * The acceptance criterion for retiring a docs page is that its URL still resolves. A 404 on a URL
 * that used to work is worse than the stale page it replaced: it breaks inbound links, search
 * results, and every article that ever cited it. This test is what makes that structural instead of
 * remembered.
 *
 * It asserts, against the real filesystem:
 *   1. every retired route has NO page file — a page left behind would shadow its own redirect;
 *   2. every redirect target is a page that EXISTS (and, when the target carries a fragment, that
 *      the fragment is a real `id` on that page);
 *   3. no redirect points at another redirect (no chains — a reader gets one hop, not two);
 *   4. no retired route is still enumerated in DOCS_NAV;
 *   5. nothing in the source tree still LINKS to a retired route.
 *
 * (5) is the one that rots in practice: a redirect keeps an old link working, so a stale link never
 * announces itself. Here it fails the build instead.
 *
 * Runs under `pnpm test` (which CI runs as its own gate), and is complemented by
 * `e2e/redirects.spec.ts`, which asserts the BUILT site actually serves each stub.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RETIRED_ROUTES, RETIRED_PATHS, LEGACY_REDIRECTS, redirectMap } from './docs-redirects.mjs';
import { DOCS_NAV } from './docs-nav.ts';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..'); // apps/site
const pagesDir = join(siteRoot, 'src/pages');

/** Candidate page files for a site route, in Astro's own resolution order. */
const pageFilesFor = (route: string): string[] => {
  const clean = route.split('#')[0]!.split('?')[0]!.replace(/\/$/, '') || '/';
  const rel = clean === '/' ? 'index' : clean.slice(1);
  return ['.astro', '.md', '.mdx', '.ts'].flatMap((ext) => [
    join(pagesDir, `${rel}${ext}`),
    join(pagesDir, rel, `index${ext}`),
  ]);
};
const pageFileFor = (route: string): string | undefined =>
  pageFilesFor(route).find((p) => existsSync(p));

test('every retired route has no page file left behind — the redirect is not shadowed', () => {
  for (const route of RETIRED_PATHS) {
    const shadow = pageFileFor(route);
    assert.equal(
      shadow,
      undefined,
      `${route} is declared retired in docs-redirects.mjs but ${shadow} still exists — a real page wins over its redirect, so the move never happened.`,
    );
  }
});

test('every redirect target is a page that exists', () => {
  // Phase 6's retirements AND the older renames — a legacy redirect that rotted is just as orphaned.
  const all = { ...LEGACY_REDIRECTS, ...redirectMap() };
  for (const [from, to] of Object.entries(all)) {
    if (from.includes('[')) continue; // dynamic-route pairs are checked by their static parent
    const file = pageFileFor(to);
    assert.ok(
      file,
      `${from} redirects to ${to}, which has no page file — the redirect lands on a 404, which is exactly what a redirect exists to prevent.`,
    );
  }
});

test('a redirect target that carries a fragment points at a real anchor on that page', () => {
  for (const [from, { to }] of Object.entries(RETIRED_ROUTES)) {
    const frag = to.split('#')[1];
    if (!frag) continue;
    const file = pageFileFor(to)!;
    const src = readFileSync(file, 'utf8');
    // literal ids only — a generated id (id={`force-${token}`}) is asserted by the page's own
    // build-time membership check, not here.
    assert.ok(
      src.includes(`id="${frag}"`),
      `${from} → ${to}: no id="${frag}" on ${file}. The section it was merged into was renamed or removed, so the reader lands on the right page at the wrong place.`,
    );
  }
});

test('no redirect points at another redirect — one hop, not a chain', () => {
  const retired = new Set(RETIRED_PATHS);
  for (const [from, { to }] of Object.entries(RETIRED_ROUTES)) {
    const target = to.split('#')[0];
    assert.ok(!retired.has(target!), `${from} redirects to ${to}, which is itself retired — chain the redirect to its final destination instead.`);
  }
});

test('no retired route is still enumerated in the docs navigation', () => {
  const retired = new Set(RETIRED_PATHS);
  for (const group of DOCS_NAV) {
    for (const item of group.items) {
      assert.ok(
        !retired.has(item.href.replace(/\/$/, '')),
        `DOCS_NAV still lists ${item.href} ("${group.title}" → "${item.label}"), which docs-redirects.mjs says is retired. The sidebar would walk readers into a redirect.`,
      );
    }
  }
});

test('nothing in the source tree still links to a retired route', () => {
  // Excluded on purpose:
  //   docs-redirects.*  — the map itself, and this test, name every retired route by definition;
  //   src/data/examples — committed dataset snapshots (a backlog item's TITLE mentions an old route;
  //                       it is example CONTENT, not a link the site renders).
  const SKIP = [
    join(siteRoot, 'src/lib/docs-redirects.mjs'),
    join(siteRoot, 'src/lib/docs-redirects.test.ts'),
    join(siteRoot, 'src/data/examples'),
  ];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (SKIP.some((s) => path === s || path.startsWith(`${s}/`))) continue;
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(astro|ts|tsx|mjs|js|md|json|css)$/.test(entry)) files.push(path);
    }
  };
  walk(join(siteRoot, 'src'));
  walk(join(siteRoot, 'e2e'));
  walk(join(siteRoot, 'scripts'));

  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const route of RETIRED_PATHS) {
      // the route as a URL: followed by a quote, a fragment, whitespace, ) or end — so
      // /docs/api/type does not match /docs/api/types and vice versa.
      const re = new RegExp(`${route.replace(/\//g, '\\/')}(?=["'#)\\s,]|$)`, 'gm');
      const hits = src.match(re);
      if (hits) offenders.push(`${file.slice(siteRoot.length + 1)} → ${route} (${hits.length}×)`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `These source files still link to a route that now only exists as a redirect. Point them at the destination in docs-redirects.mjs instead — a redirect is for the links you do not control:\n  ${offenders.join('\n  ')}`,
  );
});
