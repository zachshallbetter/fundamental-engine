# The sites

Verified 2026-10-16.

## fundamental-engine.com — `apps/site` (this repo)

Astro, static output, deployed by Vercel on every merge to `main` (PRs get preview deployments; the
`vercel[bot]` comment links them). Build it with the packages: `pnpm build`, or
`pnpm --filter @fundamental-engine/site build` once `packages/*/dist` exist. To look at the built site,
serve `apps/site/dist` statically (`python3 -m http.server 4397 --bind 127.0.0.1 --directory apps/site/dist`).

**One version source.** `apps/site/src/lib/build-info.ts` exports the engine version (from
`@fundamental-engine/core/package.json`), the build commit (`VERCEL_GIT_COMMIT_SHA`, falling back to
`git rev-parse`) and the build date. The nav pill, the footer on every page, the changelog page and the
homepage JSON-LD all read it (`currentVersion()` in `src/lib/changelog.ts` delegates to it). Don't
reintroduce a second source.

**Generated outputs.** `apps/site/scripts/gen-llms.mjs` runs at site build and writes
`public/llms.txt` / `public/llms-full.txt` (ignored by git; they carry `Engine version … · commit … ·
generated …`). The sitemap carries `lastmod`. Counts on the homepage are derived from the catalog
(`MANUAL_FORCES`, `FIELD_PATTERNS`, `MANUAL_PRESETS`) — never type a count.

**Claims.** The site is held to the same no-inflation rule as the README. Before editing a claim, read
[`knowledge/engine-facts.md`](../knowledge/engine-facts.md). `apps/site/src/pages/use-cases.astro` and
`docs/canonical/use-cases.md` carry the same cases and must be edited together; the canonical doc's
Status note separates shipped mechanisms from proposals (`field-possibilities.md` §6). The link checker
covers markdown only — `.astro` hrefs are checked by building and crawling (the 2026-10-14 audit crawled
all 202 sitemap URLs and 242 internal links: all 200).

**Homepage order** (#1249) is a deliberate progression — interaction (hero, try-it) → behavior (inbox
proof) → relationships (what the field replaces) → computation (how it works, inspectable, counts) →
substrate (shipped, hosts, AI application, invisible fields) → install → explore. New sections go where
they fit that progression. `.lp:first-of-type::before` is the only order-dependent style.

**Open positioning decision:** the page title says "a physics engine for interfaces", the JSON-LD says
"a relational field runtime", `llms.txt` says "an inspectable relational substrate for software
behavior". Picking one is the maintainer's call.

**Dev server ports:** 4321 is often taken by the zachshallbetter.com dev server; start this site on
another port (`pnpm --filter @fundamental-engine/site dev -- --port 4322`).

## zachshallbetter.com — the portfolio (separate repo, `zachshallbetter/zachshallbetter`)

The maintainer's own site and the engine's main live demonstration.

- **It consumes the engine from npm, pinned to an exact version** (`@fundamental-engine/core`, `dom`,
  `vanilla` = `0.11.1`; no `link:`/`file:` entries). Pulling or rebuilding this repo changes nothing the
  site runs. An engine fix reaches it only after a published release **and** a version bump in the site
  repo. When bumping, grep the site for removed surface (0.9.3 removed `--mass`; the CSS fell back to 0
  and the build still passed).
- **Merging to its `main` deploys production** (Vercel). Work on a branch; the PR gets a preview.
- Its full `pnpm build` ends with `release:package`, which reads an external archive API; locally that
  step can fail with "Archive temporarily unavailable" after `astro build` has completed. The Vercel
  build runs it with credentials. `astro check` and `astro build` are the useful local checks.

### How the site integrates the engine (as of `d0b8eeb`; the integration landed in PR zachshallbetter/zachshallbetter#2)

- `src/scripts/field-runtime.ts` is the single owner of the field: one `FieldField` on a
  `transition:persist`ed `#field` canvas that survives Astro client-side navigation; it rescans on
  each page and is rebuilt only when the field profile changes. Page-scoped bindings register through
  `onFieldPage()`; the inspector diffs a `snapshot()` taken before each swap.
- Inspector **Readings** (`FieldHUD.astro`, `field-hud.ts`): overlays (streamlines, field lines, grid)
  and the heatmap, on a front canvas created lazily via `overlayCanvasProvider` +
  `createOverlaySurface`. State is module-level so it survives page swaps and field remounts.
- **x-ray on `?`**, re-mounted per page (the router swaps `<body>`).
- **Adaptive quality**: `QualityGovernor` + `createFieldPerf` (budget clamped to 30 Hz) →
  `setQualityTier` — `<field-root>` does this itself; a raw `FieldField` does not.
- **Workarounds to remove once a release containing the fix is pinned:**
  - x-ray private hotkey (`XRAY_KEY = '?​'` + a guarded `keydown` handler) and the per-page
    re-mount → fixed in the engine by #1250 (merged after 0.11.1; ships in the next release).
  - `astro:after-swap` rescan → **kept, deliberately** (`d0b8eeb`): 0.11.1 skips detached bodies but
    only drops them on its every-6th-frame re-measure, so the old page's bodies act from their last
    position for up to 5 frames; the rescan prunes them immediately. Removable if the engine prunes on
    detection instead of on the measure cadence.
  - live `matchMedia` check before `burst()` → still needed: the engine gates sparks on reduced motion
    only at boot (audit M7, open).
  - `src/scripts/interact.ts` calls `scan()` on every `resize`, so mobile URL-bar scrolling still costs a
    DOM rescan per event on the site even though the engine's own soft resize no longer does —
    candidate site-side fix (debounce, or skip height-only changes).
