# Explore — interactive recipe catalog & site interaction model

**Status:** BUILT & shipped on `feat/explore-page` — the catalog *became* `/recipes`
(it did not stay at `/explore`; the old tiny-card hub and the `/explore` route are
retired). All phases landed: nine-domain taxonomy, engine-powered filter bar,
expand-in-place detail overlay, two-tier substrate/overlay workbench (+ a reverse
dynamics toggle), constellation view, per-recipe "How it works", pointer steering,
token/metric definitions, highlighted code blocks site-wide, and the workbench unified
onto the `/recipes/[id]` pages. Verification gate green (typecheck · test · check:* ·
e2e chromium+webkit). This doc remains the reference for the site-wide interaction
patterns (§3, §14) — the next surfaces to adopt them.
**Scope:** The recipes catalog *and* the reusable interaction patterns it establishes
for the rest of fundamental-engine.com.
**Author/owner:** Zach Shallbetter.

> The recipes catalog should be a working demonstration of the exact problems it
> solves: discovery, relevance, attention, priority. The page is the pitch. The
> engine drives the page. This document is the prototype for a site-wide
> interaction language — most pages should eventually adopt these patterns.

---

## 1. Why this exists (the problem with `/recipes` today)

The current `/recipes` grid asks one card to be a demo *and* a spec sheet at once.
Each card carries: 3 header badges, a live particle preview, scaffold labels, a
use-case/field toggle, a runtime-tokens row, a metrics row, and a render row —
**eight information layers, times 64, over an ambient background field.** The result
reads as busy and tells a first-time visitor neither "is this for me?" nor "is this
real?" quickly.

Two root causes:

1. **Mixed taxonomies as the primary filter.** The filter bar offers *engine*
   categories (Gravity / Electromagnetic / Strong / Weak) and *maturity* categories
   (Core / Applied / Systems / Operational). Neither maps to how a developer arrives:
   they have a **problem** ("show which items matter", "show where the user is"), not a
   force in mind. The page is an engine-architecture view published as a user interface.
2. **No search, and metadata at browse time.** 64 items is past comfortable scanning
   without search. And tokens/metrics/render are *implementation* detail — noise while
   browsing, essential once you've chosen a recipe. They belong in the detail view.

---

## 2. Goals & non-goals

**Goals**
- A **solution finder**, not a catalog dump: "here's your answer," not "here are 64 things."
- The page itself is the most persuasive engine demo on the site — controls are fields.
- The expanded recipe view is the **best place on the site to understand a recipe** —
  better than the per-recipe doc page — because it exposes the engine's legibility layers
  (render modes, overlays, truth modes, live signals) interactively.
- Calm at rest, alive on interaction. At most ~2 live fields at any moment.
- Establish reusable patterns + components the rest of the site adopts over time.
- Progressive enhancement: a clean, semantic, no-JS catalog that links to recipe pages;
  the interactive workbench is an enhancement on top.

**Non-goals (for v1)**
- Replacing `/recipes` immediately — `/explore` ships alongside it, swaps in when better.
- Touching the frozen 64-recipe canon or the public API. The new taxonomy/metadata is
  **site-local** first; promotion into core is a later, separate decision.
- The constellation view (Phase 3) is optional and ships after the core experience.

---

## 3. The interaction model (the reusable, site-wide part)

These six patterns are the actual deliverable — `/explore` is the first place they land,
but they are meant to define how every page is built going forward.

1. **Signals-first by default.** Pages run the field invisibly (`render:'none'`, the
   0.9.x baseline). No ambient particle wallpaper competing for GPU and attention. You
   opt *into* drawing, locally, where it earns its place.
2. **Engine-as-control.** The UI that operates the page is itself made of bodies and a
   field: filter pills, the search input, eventually nav. Operating the catalog *is* a
   demonstration of the engine, before the visitor reads a single card.
3. **Progressive activation.** Visual intensity scales with interaction: static at rest →
   one preview on hover/focus → full render + overlays on expand. Nothing animates that
   you aren't currently looking at.
4. **Expand-in-place over navigation.** Selecting an item grows it in place while the rest
   recedes (not unmount). The layout change *is* the demo — the field wakes up as the card
   expands. URL updates via `pushState`; back/forward and deep links work.
5. **Legibility layers as a teaching surface.** Render modes, diagnostic overlays, truth
   modes, and the live signal readout are exposed as controls so a visitor can *see the
   machinery*. This is how a skeptic converts.
6. **Truth-mode honesty.** Everything shown is real engine state — the numbers in the
   signal panel are the CSS variables the field is actually writing, not decoration.

---

## 4. Information architecture

Three states, one continuous surface (no full-page navigation between them):

```
BROWSE  ──hover──▶ (one card previews)        EXPAND ──▶ WORKBENCH (inside expanded card)
  │                                              ▲           render modes · overlays ·
  │  search + problem-domain filters             │           truth modes · live signals ·
  │  static cards, recede when filtered          │           scaffold bodies · code snippet
  └────────────────click a card──────────────────┘
                                                  └──▶ "Open full recipe →" (existing /recipes/<id>)

  CONSTELLATION (Phase 3) — toggle from the filter bar; force-directed catalog
```

**Browse.** Sticky engine-powered filter bar. A responsive grid of *static* cards (border
accent in the natural-field color, name, one-line description — nothing else). Non-matching
cards **recede** (`opacity ~0.15, scale ~0.94`) rather than disappear, so the grid keeps its
shape and the filter feels like a field reshaping, not a list re-rendering.

**Expand.** Click → the card grows to ~80% viewport via a FLIP/View-Transition animation;
siblings collapse to receded slivers. As it reaches full size the field wakes in the
recipe's *own* render mode. A metadata + workbench panel slides in.

**Workbench (§8).** Inside the expanded card: visualization controls + a live signal panel +
the scaffold bodies + a copy-paste snippet. The teaching surface.

---

## 5. Problem-domain taxonomy (the primary filter) — FINALIZED

**Nine** intent domains (multi-select; recipes legitimately span more than one) plus a separate
**Platform & Teaching** group for genuine engine-meta recipes. Mapped against the real 64 intents
in `catalog.ts`. Every recipe maps to ≥1 domain.

| Domain | id | "I need to…" |
|---|---|---|
| **Priority & Attention** | `priority` | show what matters / what's urgent |
| **Navigation & Wayfinding** | `navigation` | orient the user & guide them |
| **Relationships & Structure** | `relationships` | connect / cluster / show dependencies |
| **Evidence & Trust** | `evidence` | show support, provenance, confidence |
| **Conflict & Stability** | `conflict` | surface contradiction / instability |
| **Memory & Time** | `memory` | show recency, decay, transitions |
| **Flow & Process** | `flow` | multi-step / handoff / recovery / validation |
| **Presence & System Health** | `presence` | live activity, collaborators, status |
| **Safety & Governance** | `governance` | show what's protected / risky / scoped |

**Platform & Teaching** (not a problem domain; framed "understand/instrument the engine"):
`diagnostic-lens`, `field-tutorial`, `field-contract-preview`, `accessibility-equivalence`.

**Reclassification note:** of the 7 recipes with no `naturalField`, only those 4 are truly
platform/meta. The other 3 are real cross-field interaction recipes and map to problem domains:
`friction-gate` → governance, `scope-lens` → governance, `semantic-drag` → flow.

Natural field (Gravity/EM/Strong/Weak) and tier (Core/Applied/Systems/Operational) stay as
**secondary** filters — a disclosure for people who already know the system, not the front door.

### Full assignment (primary domain first)

| Recipe | Domains |
|---|---|
| priority-well | priority |
| focus-orbit | navigation, priority |
| search-relevance-field | priority, evidence |
| signal-path | relationships, flow |
| evidence-field | evidence, relationships |
| conflict-field | conflict |
| relationship-bond | relationships |
| concept-cluster | relationships |
| coherence-field | conflict, flow |
| reading-field | navigation, memory, priority |
| memory-trace | memory |
| decay-notice | memory |
| phase-shift | memory, flow |
| guided-flow | flow, navigation |
| diagnostic-lens | _Platform & Teaching_ |
| accessibility-equivalence | _Platform & Teaching_ |
| attention-weather | priority, presence |
| navigation-current | navigation |
| citation-thread | evidence, relationships |
| form-stability-field | flow, conflict |
| command-intent-field | navigation, priority |
| selection-wake | memory |
| availability-pressure | presence, priority |
| dependency-tension | relationships, conflict |
| staleness-drift | memory |
| trust-gradient | evidence |
| completion-release | memory, flow |
| group-magnet | relationships |
| error-pressure | conflict |
| handoff-stream | flow, presence |
| context-halo | priority, navigation |
| field-tutorial | _Platform & Teaching_ |
| semantic-gravity-map | priority, relationships |
| polarity-filter | conflict, relationships |
| source-constellation | evidence, relationships |
| drift-correction | conflict, navigation |
| resonance-match | priority, navigation |
| friction-gate | governance |
| boundary-field | governance, relationships |
| threshold-bloom | memory, priority |
| latency-ripple | presence, flow |
| provenance-trail | evidence, memory |
| review-pressure | priority, conflict |
| semantic-snap | relationships |
| ambient-tutor | navigation, memory |
| relation-lens | relationships |
| priority-tide | priority, memory |
| field-contract-preview | _Platform & Teaching_ |
| presence-field | presence |
| consensus-well | presence, conflict |
| disagreement-charge | conflict, presence |
| change-shockwave | flow, presence |
| permission-boundary | governance |
| risk-horizon | governance, priority |
| intent-magnet | navigation, priority |
| flow-checkpoint | flow |
| version-gravity | memory, presence |
| review-constellation | relationships, presence |
| anomaly-bloom | conflict, presence |
| scope-lens | governance |
| calibration-field | flow |
| semantic-drag | flow, relationships |
| recovery-path | flow, conflict |
| system-pulse | presence |

---

## 6. Data model

Recipe data is **three layers**, and they don't collapse into one store:

1. **Core TS catalog** (`packages/core/src/recipes/catalog.ts`) — the frozen 64. The engine's
   source of truth; feeds the Swift + Android ports; held by the freeze gate. **Stays in code.**
2. **Discovery/presentation metadata** (domains, solves, snippets, viz config) — *new*. This is
   the layer below, and the one a database could own.
3. **Dynamic features** a DB unlocks later — usage analytics, user-submitted recipes,
   search-as-API, favorites.

**The Neon option (context).** A full Neon (Postgres) implementation exists in the *separate*
`zachshallbetter.com` project — serverless via Vercel `/api/*`, seeded from markdown frontmatter,
schema applied via `psql`. It is currently **archived** there (seed script under `scripts/archive/`,
no live `api/` dir, `vercel.json` reduced to a redirect; the live path is static `content.json`).
It's a proven, revivable blueprint — not lost.

**Decision: TS source-of-truth, DB-ready shape, seed later.** Keep the taxonomy as versioned TS
in the FE repo so it ships with the recipes, runs in e2e, needs zero infra for a site build, and
works offline. *But* model it as a flat, DB-ready row shape so a seed script can push it into Neon
the moment dynamic features (analytics, contributions, search API) justify the infra. This does not
block the explore page on standing up a database, and does not paint us into a corner. The
zachshallbetter Neon setup is the blueprint for that seed.

One new file:

`apps/site/src/lib/recipe-taxonomy.ts` — keyed by recipe id (one row per recipe, DB-ready columns):

```ts
interface RecipeTaxonomy {
  domains: ProblemDomain[];      // §5 — drives the primary filter
  solves: string[];              // 2–4 concrete use cases ("task lists", "content feeds")
  primaryRender: RenderMode;     // the render the expanded view wakes into
  vizModes: RenderMode[];        // render modes offered in the workbench switcher
  overlays: OverlayMode[];       // diagnostic overlays this recipe supports
  truthModes: TruthMode[];       // lenses offered (often just one)
  signals: SignalKey[];          // which --field-* vars the live panel reads
  scaffoldId?: string;           // representative UI bodies (reuse recipe-scaffolds.ts)
  snippet: string;               // copy-paste HTML/CSS the recipe boils down to
}
```

Everything the *card* already shows (name, description, natural field, tier, runtime tokens,
metrics, render stack) keeps coming from the existing recipe objects via `recipeById`. The
taxonomy file only adds the **intent layer + workbench config + use cases + snippet**.

If the taxonomy proves out, a follow-up can promote `domains`/`solves` into core recipe
metadata (additive, gated) so the native ports inherit it. Not now.

---

## 7. Field architecture (perf is the whole game here)

The page is **fill-rate-bound, not particle-bound** (canvas compositing at DPR2 dominates;
a full-viewport `mix-blend` canvas costs every frame even when empty). The current page runs
up to 6 card fields *plus* an ambient `field-root`. The new budget is radically tighter:

| Surface | Field | When | Cost |
|---|---|---|---|
| Page background | none (`render:'none'`) | always | ~0 draw |
| **Filter bar** | 1 tiny contained field (~16–24 particles, bodies = pills + search) | always on | cheap, the "engine is alive" signal |
| **Browse cards** | **no per-card fields.** One *shared* preview field re-targets its bounds to the hovered card | on `mouseenter`, idled on leave | cap = 1 |
| **Expanded card** | 1 workbench field in the recipe's render mode | while expanded (preview field paused) | cap = 1 |

**At any instant: the tiny filter field + at most one of {hover-preview, workbench}.** Idle
canvases are `display:none` (the DPR2/mix-blend trap), not just transparent. Compute cadence
stays decoupled from draw cadence (bodies re-measured on the 6th-frame cadence; expensive
grids resampled into a cache and drawn from cache).

**Single shared preview field** (not one-per-card) is the key call: it caps live previews at
one structurally, eliminates the IntersectionObserver mount/unmount churn of the current
design, and makes each hover feel intentional ("opening" a recipe).

---

## 8. The visualization workbench (the conversion moment)

Fundamental's differentiator: the field isn't just running, it's writing inspectable state in
multiple legibility layers. The expanded view turns that into an interactive teaching tool.
Each control answers a different developer question:

| Control | Answers | Mechanism |
|---|---|---|
| **Render switcher** — `dots · field-lines · streamlines · heatmap · links · metaballs · trails` | *What does it look like spatially?* | `field.setRender(mode)` (underlay) |
| **Overlay toggle** — `off · diagnostic · immersive` | *How does it work physically?* — force vectors, body radii, density contours | `field.setOverlay(mode)` |
| **Truth mode** (where >1) — `physical · designed · hybrid · diagnostic` | *Which lens am I seeing?* | recipe-dependent |
| **Live signal panel** | *What can my CSS hook into?* | rAF loop reading `--d`, `--field-attention`, `--field-density`, `particleCount()` off the feedback bodies |
| **Snippet** | *How little code is this?* | the recipe's HTML+CSS distilled, copy button |

The **live signal panel** is the centerpiece — styled like instrumentation (monospace,
field-green, live bars):

```
--d                0.87  ████████░░
--field-attention  0.64  ██████░░░░
--field-density    0.43  ████░░░░░░
particles          142
```

A skeptic watching `--d` climb as particles cluster, then seeing
`box-shadow: calc(var(--d) * 14px)` drive the element's glow, understands the entire model
with no prose. A one-line annotation under the preview changes per render mode ("what you're
seeing now"), so cycling modes is self-explaining.

Recipe-specific payoffs: **Evidence Field** in `links` + diagnostic literally draws the
charge-attraction lines to verified sources and the repulsion to the conflicting one — the
physics *is* the explanation. **Conflict Field** in `heatmap` shows the tension band between
positions. **Memory Trace** in `trails` + signal panel shows `--field-recency` decaying live.

---

## 9. Component inventory (the reusable pattern library)

Build these as named, documented pieces — they are intended to be reused site-wide, not
one-offs for this page:

| Component | Role | Reuse target |
|---|---|---|
| `FilterField` | engine-powered filter/search bar (bodies = controls) | any filtered index: examples, writings, docs search |
| `RecipeCard` | static browse state + expand-in-place behavior | any card grid that should expand rather than navigate |
| `RecipeWorkbench` | render/overlay/truth switchers + signal panel + snippet | embeddable in any concept doc to make a field legible |
| `SignalReadout` | the live instrumentation panel, standalone | drop into any page to expose live field state |
| `VizModeSwitcher` | render-mode pill group bound to `setRender` | docs, homepage feature tiles |
| `ConstellationView` | force-directed catalog (Phase 3) | could power a site-wide "concept map" |

---

## 10. Phasing (each phase shippable, each item dispatchable)

**Phase 0 — Data & scaffolding**
- `recipe-taxonomy.ts`: map all 64 recipes to domains/solves/viz config/snippet. (Brief-quality
  matters — this is the content backbone.)
- New route `apps/site/src/pages/explore/[[...recipe]].astro` (optional rest param) that
  **server-renders the full semantic catalog** (64 `<article>`s, name+description+link to
  `/recipes/<id>`) so the page works with no JS and is SEO-complete.
- `explore.css` clean slate. "Explore" added to `SiteNav`.
- *Acceptance:* no-JS visit shows a clean, complete, linked catalog; Lighthouse SEO ≥ existing.

**Phase 1 — Browse + engine filter bar**
- `FilterField`: contained field, search input + 7 domain pills as bodies; active pill gains
  mass, bar is `data-feedback`.
- Client-side search (name+description+solves) and filter; non-matching cards recede.
- Single shared hover-preview field (§7).
- Secondary filters (natural field, tier) behind a disclosure.
- *Acceptance:* one live preview max on hover; filter bar field visibly responds; reduced-motion
  path renders static; e2e covers search + filter + recede.

**Phase 2a — Expand-in-place**
- FLIP/View-Transition expand to ~80% viewport; siblings recede; `pushState` URL; deep-link
  `/explore/<recipe>` opens expanded on load; back/forward works; Esc/`← Browse` collapses.
- Field wakes into `primaryRender` as the card reaches full size.
- *Acceptance:* deep link opens correct expanded card server-side then hydrates; no layout jump;
  preview field paused while expanded (field cap respected).

**Phase 2b — Visualization workbench**
- `RecipeWorkbench` + `SignalReadout`: render switcher, overlay toggle, truth-mode (where >1),
  live signal panel, per-mode annotation, scaffold bodies, copy-paste snippet.
- *Acceptance:* every offered render mode/overlay actually drives the canvas; signal numbers
  match `getComputedStyle` of the feedback bodies; copy button works; visual-snapshot per mode.

**Phase 3 — Constellation (optional)**
- Force-directed catalog view toggled from the filter bar; related recipes cluster; click a
  cluster to zoom; reuses the engine for layout.
- *Acceptance:* stable layout (no jitter), reduced-motion falls back to grid, perf within budget.

**Phase 4 — Promotion**
- Swap nav default from `/recipes` to `/explore` (or redirect); decide whether to promote
  `domains`/`solves` into core recipe metadata for the native ports.

---

## 11. Performance budget & guardrails

- **≤2 live fields ever** (filter + one preview-or-workbench). Verify with `particleCount()`
  and sampled rAF fps on real hardware, not just headless (headless software-rasterizes and
  exaggerates fill).
- Idle canvases `display:none`. No full-viewport `mix-blend` canvas on this page.
- Draw-from-cache for streamlines/heatmap; respect the 6th-frame measure cadence.
- Budget target: expanded workbench holds 60fps at DPR2 on the reference machine; document the
  on-hardware fact sheet (ties into the deferred perf-budget RC gate).

---

## 12. Accessibility & reduced motion

- `prefers-reduced-motion`: filter field renders nothing (signals only); cards static; expand
  still works but the field stays `render:'none'`, showing the recipe's `meaningWithoutMotion`
  static output and *settled* signal values. No particle motion.
- Full keyboard path: filter pills are real buttons; cards focusable; Enter expands; Esc
  collapses; focus trapped in the expanded view and restored on collapse.
- Each `data-feedback` body must have a CSS consumer that actually reads its `--` var (the
  recurring silent-contract-gap bug class) — assert in e2e where a body should visibly react.
- Color is never the only channel (natural-field accent is paired with the text label).

---

## 13. Testing & verification

- **e2e (Playwright, `apps/site/e2e/`):** search filters, domain filter recede, hover→single
  preview, expand→URL change, deep-link→expanded, Esc→collapse, reduced-motion static path.
- **Visual snapshots:** browse grid, one expanded card per render mode, the signal panel.
- **Perf probe:** assert ≤2 live fields, sample fps in the expanded view.
- **A11y:** keyboard walkthrough, reduced-motion, contrast.
- Full gate before merge: `typecheck · build · test · check:*`. Each phase its own PR on a
  `feat/explore-*` branch; coordinator reviews any core-touching diff (Phase 4 only).

---

## 14. How this generalizes to the whole site

The reason this is worth doing carefully: **`/explore` is the reference implementation for a
site-wide interaction language.** Once the patterns and components exist, they retrofit:

- **Homepage** — feature tiles become expand-in-place; the `SignalReadout` makes the hero
  field's invisible work legible on demand.
- **Docs / concept pages** — embed a `RecipeWorkbench`/`VizModeSwitcher` inline so any concept
  (truth modes, surfaces, a specific force) has a live, inspectable demo instead of a static gif.
- **Examples & writings indexes** — adopt `FilterField` (engine-powered search/filter) instead
  of conventional filter chips.
- **Global** — `render:'none'` baseline + progressive activation becomes the default posture:
  every page calm at rest, alive exactly where the user is looking. `SignalReadout` becomes the
  canonical way to show "the engine is really doing this," anywhere.

The throughline: **the site stops *describing* the engine and starts *being operated by* it.**

---

## 15. Risks & open questions

- **Astro is MPA; this is an island-heavy page.** The expand/URL/deep-link mechanics are a
  mini-SPA inside one route. Risk: hydration complexity, history edge cases. Mitigation:
  server-render the catalog fully (works without JS), keep the island additive, lean on the
  View Transitions API where supported with a FLIP fallback.
- **Taxonomy assignment is subjective.** Which domain(s) each recipe belongs to needs an
  editorial pass; getting it wrong undermines the "solution finder" promise.
- **Scaffold/snippet authoring for 64 recipes is real content work** — the bottleneck, not the
  code. Reuse `recipe-scaffolds.ts`; write snippets as the recipe's distilled essence.
- **Constellation jitter / layout stability** is the classic force-directed risk; keep it
  optional and behind reduced-motion.
- **Promotion to core** (Phase 4) touches frozen canon — defer until the taxonomy is settled.

---

## 16. File manifest

| File | Action |
|---|---|
| `apps/site/src/pages/explore/[[...recipe]].astro` | New — route + server-rendered semantic catalog |
| `apps/site/src/styles/explore.css` | New — clean-slate styles |
| `apps/site/src/lib/recipe-taxonomy.ts` | New — domains, solves, viz config, snippets (the content backbone) |
| `apps/site/src/lib/explore-page.ts` | New — browse/expand/search/filter state machine + history |
| `apps/site/src/lib/explore-filter-field.ts` | New — `FilterField` contained field |
| `apps/site/src/lib/recipe-workbench.ts` | New — `RecipeWorkbench` + `SignalReadout` + `VizModeSwitcher` |
| `apps/site/src/lib/recipe-scaffolds.ts` | Reuse — representative bodies for the expanded preview |
| `apps/site/src/components/SiteNav.astro` | Edit — add "Explore" |
| `apps/site/e2e/explore.spec.ts` | New — invariants per §13 |
| `packages/core/src/recipes/*` | Phase 4 only — optional promotion of `domains`/`solves` |
