> **Status: as-built.**
> The design of the field-ui.com documentation and examples experience after the 2026-06
> rebuild — what it does, why each piece exists, and where it lives. The conceptual canon for
> the underlying pattern is [docs/canonical/field-ui-invisible-fields.md](canonical/field-ui-invisible-fields.md);
> the practices that produced it are [docs/engineering-practices.md](engineering-practices.md).

# The site experience

## Thesis

field-ui's documentation is its own best demo. A project whose pitch is "every element can
participate in an invisible measuring field" should not document that idea in inert pages —
the docs **run the system they describe**, measure their own integrity, and publish for both
human and agent readers. Every feature below is shipped, restrained (docs are for *reading* —
the field is felt, not loud), and pinned by the e2e suite.

## The docs shell (`apps/site/src/layouts/DocsLayout.astro` + `DocsRuntime.ts`)

- **Every docs page is an invisible field.** At runtime init, the page's `h2`/`h3` headings
  become bodies (`data-body="attract" data-feedback data-hot`) in both the persisted page
  engine and a scoped render-less recipe with the attention metric — zero field markup in
  content pages. A sidebar toggle (`docs field · on/off`, persisted, forced off under reduced
  motion) keeps it honest: off means plain docs.
- **The attention TOC.** The "On this page" rail reads each heading's live
  `--field-attention` — ink and weight follow where your attention actually is, while the
  classic scroll-spy stays as the discrete active marker. One rAF mirror loop, write-on-change.
- **Reference integrity, self-measured.** At init the runtime verifies every internal anchor
  on the page (fragments against real ids; routes against `DOCS_NAV` + `ROUTE_FAMILIES`) and
  renders a provenance chip in the TOC rail: `references · N/N resolve` (amber + enumeration
  when broken). The docs measure their own graph the way the examples measure their data —
  and the chip caught a real broken link on its first build.
- **Search.** Pagefind over `data-pagefind-body` (docs content only), built into
  `pnpm build`; a custom `<dialog>` UI on the design tokens (⌘K / Ctrl+K / `/`), lazy-loading
  the index, keyboard-walkable results, honest in dev ("search index builds with the site").

## The information architecture (`apps/site/src/lib/docs-nav.ts`)

Six groups, ordered as a learning path; every pre-rebuild route preserved:

```txt
Start here   -> overview, tutorial, the four guides
Concepts     -> concepts, natural fields, narrative, the reading field
Build        -> authoring, recipes, platform, performance, accessibility, troubleshooting
Reference    -> the ten api pages (stamped — see below)
Field studies-> the six studies + showcase, diagnostics, inspector, snapshots
Examples     -> the invisible-fields family (external ↗, from the roster module)
```

The docs index (`/docs`) renders this map *from* `DOCS_NAV` (it cannot drift from the
sidebar), gives the example family first-class billing from `invisible-fields.ts`, and the
index cards are themselves field bodies.

## Provenance everywhere

- **API stamps** (`src/components/ApiStamp.astro`): every headlined API symbol carries a
  build-time chip — `frozen · <pkg>` / `experimental` — derived from
  `scripts/api-surface.data.mjs`, the same file `pnpm check:api` gates. 28 stamps across 8
  pages; unknown names warn at build. The docs cannot claim a contract the freeze gate
  doesn't enforce.
- **See it live** (`src/components/SeeItLive.astro`): concept pages link the example whose
  roster hook genuinely demonstrates them (concepts → Evidence, natural-fields → Market,
  platform → Backlog, authoring → Calendar).

## Agent-first publishing

`apps/site/scripts/gen-llms.mjs` (runs in the build, byte-stable) writes:

- **`/llms.txt`** — the llmstxt.org index: the canonical architecture statement, then every
  docs route, every canon doc (GitHub blob links), and the twelve examples, one annotated
  line each.
- **`/llms-full.txt`** — the full canonical documentation concatenated (~195 KiB).

The agent consumption model is one of field-ui's founding documents; its own docs treating
agents as first-class readers is that model made literal. The `/docs` index links both.

## The examples (`/evidence` + `/evidence/<slug>`)

The twelve-page invisible-fields family is the applied tier of the documentation — real
data, live channels, provenance chips, each page's layout embodying its concept. Canon:
[field-ui-invisible-fields.md §7](canonical/field-ui-invisible-fields.md). The docs link
into it (sidebar Examples group, the index map, SeeItLive); the family's how-built sections
link back with CodeTabs.

## What keeps it true

The e2e suite (`apps/site/e2e/`, chromium + webkit + mobile, ~128 tests) pins all of it:
the shell's field behaviors and toggle, the integrity chip's count, search end-to-end on the
built index, the stamps' frozen/experimental honesty, the index map's group/roster sync, the
llms files' existence and shape — alongside the homepage, /eli5, and the whole example
family. The audit is permanent; see [engineering-practices.md](engineering-practices.md) §1.
