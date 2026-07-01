# Fundamental — agent guide

**Fundamental** is a platform-native **relational field runtime**; the DOM is its first host, not its
boundary (the same core runs headlessly and in the Swift/Kotlin ports). On the web, every element can
become a *body* in an invisible physics field; bodies bend the field, and the field's local density bends
them back (reciprocity). It began as the homepage of zachshallbetter.com and outgrew it. Author/owner:
**Zach Shallbetter**. (Formerly `forces-ui`, then `field-ui` — a hard rename, no compat aliases remain.)

> The field is a **substrate, not wallpaper**: words, links, cards, controls become bodies. Semantic
> HTML stays the source of meaning; the field is a behavior + visualization layer on top.

## Monorepo layout (pnpm workspaces)

| Package | npm name | Role |
|---|---|---|
| `packages/core` | **`@fundamental-engine/core`** | The engine. **Imports ZERO DOM** (enforced by `core/dom-boundary.test.ts`, empty allowlist). Renderer-agnostic; all DOM access goes through an injected `FieldHost`. `createField(canvas, opts) → FieldHandle`. |
| `packages/dom` | `@fundamental-engine/dom` | Binds the engine to the DOM: `browserHost()`, six registries (measurement/state/feedback/relationships/visual-bindings/overlays), the six-phase `FrameScheduler`, `lintPlatform`, `bindData`. |
| `packages/elements` | `@fundamental-engine/elements` | The `<field-root>` custom element (the singleton page field) + `<field-cell>` (local demo pool). |
| `packages/react`, `packages/vanilla` | `@fundamental-engine/{react,vanilla}` | Authoring surfaces. |
| `packages/kit`, `packages/fundamental-engine` | — | **RETIRED (0.7.0).** Former umbrella meta-packages; no longer published — hollow stub dirs may remain as pnpm artifacts. Install the specific package(s) you use. |
| `apps/site` | `@fundamental-engine/site` | The Astro marketing/docs site (fundamental-engine.com). `/eli5` is a second, plain-language homepage. |
| `apps/starter` | — | Minimal starter app. |

**Strict dependency direction:** core ← platform ← {elements, react, vanilla}. Core never depends up.

**Two native ports, at parity** (mirror the npm packages 1:1, same dependency direction, both held to the
**shared cross-plane conformance golden** at `depth: 0`):
- **`swift/`** — `FundamentalCore` / `FundamentalPlatform` / `FundamentalSwiftUI` / `FundamentalVanilla`
  (UIKit-AppKit-RealityKit hosts). iOS / macOS / visionOS.
- **`android/`** — `:fundamental-core` / `:fundamental-platform` / `:fundamental-compose` (Jetpack Compose) /
  `:fundamental-android` (`View`/`Canvas`, the `UIKitFieldHost` mirror) / `:lab` (desktop FieldLab).
  Pure-Kotlin core + platform build on any JDK; host modules need the Android SDK (compileSdk 34, minSdk 24).
  Read **`android/README.md`** for the Kotlin port (the authoritative status + parity list).

## Where information lives

- **`docs/canonical/`** — the **authority**. Read these before changing concepts/terminology. Key ones:
  `definition-document.md` (operating model), `natural-fields.md` (the four Natural
  Fields), `agent-consumption-model.md` (the agent/consumer model), `fundamental-field-behavior-table.md`
  (truth modes + per-force table), `visualization-methods-taxonomy.md` (render/diagnostic methods +
  **Surfaces & Placement** — three placements: underlay/overlay/typographic), `invisible-fields.md`
  (the invisible/typographic pattern: two-field page architecture, live channels --d/--field-attention,
  data-hot + data-active engagement, data-field-relation edges, data-provenance chips),
  `platform-architecture.md`, `system-contracts.md`,
  `api-stability.md` (the freeze contract), `documentation-standards.md` (the status rule).
- **`docs/engine-reference/`** — deep engine spec: `forces-system.md` (the big one — forces, §22 agent
  consumers, §20 render/diagnostics), `shadow-dom.md`, `forces-tests.md`.
- **`docs/research/`** — an 8-paper arXiv-style family (markdown). `README.md` has the "caveat canon".
- **`docs/planning-archive/`** — historical design (`field-concept.md`, migration plan). Frozen; don't cite as current.
- **`docs/planning/critical-path/`** — the **substrate-architecture** program (the path to a true substrate, not
  just a runtime): `01` Field Formation terminology, `02` Field Query API, `03` Snapshot + Causal Replay,
  `04` dimension-aware accumulator + body-authority modes, `05` Projection Registry + governance. Sequenced;
  each step is its own reviewable core PR. **Shipped so far (doc 04 spine):** the opt-in `Env.accum`
  (`FieldImpulseAccumulator`) impulse accumulator captured centrally in `applyForce` via the single
  `applyAndRecord` path, plus `accumulateAt(registry, tokens, b, x, y)` (net + per-force attribution at a
  point) — the diagnostics (causality/prediction/force-vectors) read it, and it is the primitive the Field
  Query API builds on. Default engine behavior is unchanged (accumulator is opt-in). See `docs/planning/critical-path/README.md`.
- **Planned work** lives on the **RC1 board** (#24); **shipped work** is in `CHANGELOG.md` + per-version
  `docs/release-notes/`. (The historical `ROADMAP.md` / `BACKLOG.md` root docs were removed — the board and
  CHANGELOG supersede them.)
- **Issues & release board:** GitHub issues on `zachshallbetter/Fundamental` + the **RC1 board** ("RC1 - Production",
  user Project **#24**: https://github.com/users/zachshallbetter/projects/24). Manage it with the
  `github-projects` skill. Planned/deferred work is filed there (Status / Priority {P0-P2} / Size {XS-XL}).

## Core concepts (the naming canon — keep lanes separate)

> **Concepts describe. Tokens execute. Metrics measure. Diagnostics explain. Conditions activate.
> Recipes compose.** No word lives in two lanes.

- **Natural Fields** — the conceptual layer: **Gravity→importance, Electromagnetic→polarity/signal,
  Strong→binding, Weak→transformation**. *"Natural fields are not tokens; tokens are translations"*;
  *"attract is NOT gravity"* (attract = designed UI well). Don't call them "fundamental forces" in public copy.
- **Runtime tokens** — real, passported engine forces (`attract`, `gravity`, `charge`, `sink`, `cohesion`,
  `warp`, `screen`, …). **36 forces** (9 canonical + 8 natural + 19 extended). The body contract is `data-body="…"`.
- **Field Agent Consumption Model** — particles / DOM elements / event sinks / visual layers consume one
  *influence* differently. Submodel: **Body Matter Interaction** (a body absorbs/holds/releases matter);
  the shipped concrete case is **Sink / Accretion** (`sink` token, `data-absorb`, `data-max`, `--load`).
  `absorb` is concept language, **not** a token.
- **Six truth modes** (`packages/core/src/contracts/passport.ts`): physical, designed, **hybrid**,
  diagnostic, poetic, semantic.
- **Field Surfaces** (visualization placement): `setRender(mode)` = **underlay** (behind content);
  `setOverlay(mode)` = **overlay** (in front, via `<field-root>`'s second canvas); both = *immersive*.
  **The `render` default is now `'none'` (signals-first, #538):** a field created without an explicit
  render mode runs the full sim + feedback but draws nothing — the invisible field is the baseline, you
  opt *into* drawing (`render: 'dots'`). The homepage/starter pin `render="dots"`; `<field-cell>` is
  unaffected (own pool). Contained, component-scoped fields: `new FieldField({ bounds: el })` /
  `containerHost(el)` (#540). One door: vanilla `createField(canvas, opts)` resolves host →
  bounds → browserHost (#537). The host/environment SPI is `FieldHost` (NOT "surface" — that word is
  the viz-placement lane); see `docs/canonical/platform-architecture.md` (#539).

## Working conventions

- **Verification gate (run before declaring done / merging):** `pnpm typecheck` · `pnpm build` ·
  `pnpm test` · `pnpm check:api` · `pnpm check:dist` · `pnpm check:readme` · `pnpm check:recipes` ·
  `pnpm check:cem` · **`pnpm check:docs`** (CI enforces it with `DOCS_GATE_ENFORCE=1` — easy to miss
  locally; any new `FieldOptions` key / body `data-*` attr / `<field-root>` attr / handle method must
  get a `docs-api.ts` row in the matching table `OPTIONS[]`/`ATTRS[]`/`FIELD_ROOT_ATTRS[]`/`HANDLE[]`,
  or it fails). Site: `pnpm dev` (port 4399). (`check:cem` = the Custom Elements Manifest
  `packages/elements/custom-elements.json`, regenerated via `pnpm gen:cem`.)
  **Two CI gates that bite outside the local sweep:** (1) `pr-checks.yml` — **any PR touching a published
  `packages/*` must add a `## [Unreleased]` CHANGELOG bullet** (it reads the CHANGELOG *diff*), or the
  PR fails with "CHANGELOG entry for package changes". (2) the **RC-6 contract-coverage guard**
  (`packages/core/src/contract-coverage.test.ts`) requires every public `FieldOptions` key to be named
  in a test — but it scans **only top-level `src/*.test.ts`** (non-recursive), so a new option needs a
  reference in e.g. `separation-seam.test.ts`, NOT just a sub-test under `src/core/`.
- **Read the codex review before proposing merge.** The `chatgpt-codex-connector` bot posts a
  priority-tagged (P1/P2) review on every PR after it opens — treat reading + triaging it as a standing
  pre-merge gate. Verify each finding against the code (it's usually right; it has caught real
  correctness bugs), then fix or reply with a rationale; re-check after pushing fixes to a core diff.
  **E2E:** `pnpm --filter @fundamental-engine/site test:e2e` (Playwright, `apps/site/e2e/` — the
  invisible-fields invariants; needs the site built first; network-blocked, so pages hold their
  committed snapshots). CI (`.github/workflows/ci.yml`) runs build+test+checks on PRs to `main`;
  `e2e.yml` runs the Playwright suite on PRs touching `apps/site/**` or `packages/**`;
  `snapshots.yml` refreshes the example data snapshots weekly via PR.
- **Releasing / publishing:** packages publish to npm under `@fundamental-engine` **with provenance**, from CI —
  push a `vX.Y.Z` tag → `.github/workflows/release.yml` runs the gate and `pnpm --filter "@fundamental-engine/*"
  publish --provenance`. Provenance needs a **public** repo (it is) + the `NPM_TOKEN` secret (granular,
  2FA-bypass). Never raw `npm publish` (leaks `workspace:*`). **npm/tagged latest is `0.9.2`**
  (shipped 2026-07-01 user-initiated — see [[no-autonomous-releases]]). (`0.6.0` was cut prematurely and reverted — npm `0.6.0` is burned.) Seven packages publish (core, dom, platform, elements, react, vanilla, three). See
  `RELEASING.md` / `PUBLISHING.md`. Don't publish from a laptop unless CI is down (manual = no provenance).
  **Release checklist — two manual steps the version-bump command does NOT cover:**
  1. Update `FIELD_VERSION` in `packages/core/src/version.ts` to match the new version — `version.test.ts`
     enforces lockstep and CI fails (test #693) if they drift.
  2. After running `pnpm --filter "@fundamental-engine/*" exec npm version <bump> --no-git-tag-version`,
     revert `apps/site/package.json` and `apps/starter/package.json` — both match the `@fundamental-engine/*`
     filter but version independently and must not be bumped with the packages.
- **Public API: additive, freeze LIFTED for the substrate build-out (2026-07).** `scripts/api-surface.data.mjs`
  + `scripts/api-surface.ts` + `check:api` still gate the **stable baseline** (17 frozen entries — 16 in
  `api-surface.data.mjs` = 11 values + 3 types + 2 elements, plus the `[data-body]` contract), but new public
  surface may now be **added freely** (the experimental substrate API — `query`/`snapshot`/`policy`/`forAgent`/…).
  When you add, **FEED the gates** (update the baseline + `docs-api.ts` + CHANGELOG), don't disable them.
  Renaming/removing a *stable* symbol is still a breaking change. See `docs/canonical/api-stability.md`.
- **Status honesty** (`documentation-standards.md`): never call something *shipped* unless code
  confirms it. `main` moves fast — **verify a "planned" item hasn't already landed** before acting on it.
- **Physics caveat canon** (for any physics-touching doc/paper): nominal mass by default; energy/momentum
  not conserved by design; particle **count** is the one strong invariant; designed ≠ natural deliberately.
- **Parallel agents / worktrees:** multiple agents work this repo. To avoid collisions, do feature work in a
  git **worktree** off `origin/main`, push, open a PR, squash-merge. The literal `main`
  checkout drifts behind `origin/main` (nobody `git pull`s it) — `git fetch && git merge --ff-only origin/main`
  to refresh. Run `pnpm install` after a big pull (new deps land often).
- **Branch naming (PROJECT RULE):** branches are named for the **feature, fix, or project** —
  `feat/<thing>`, `fix/<thing>`, `docs/<thing>`, `refactor/<thing>`, `chore/<thing>` — NEVER
  auto-generated or tool-default names (no `claude/*`, no adjective-surname slugs, no agent/session
  identifiers). If a session starts you on an auto-named branch, rename it (`git branch -m`) or
  re-create the work on a properly named branch BEFORE pushing — branch names are public and
  permanent in PR records. The 2026-06-10 cleanup deleted the last of the old auto-named refs;
  do not reintroduce them.
- **Git:** keep commit messages and PR bodies in a normal human engineering voice — do **NOT** add
  `Co-Authored-By` / AI-attribution trailers or "generated by" footers, and keep agent/Claude references
  out of anything tracked (code, docs, commits, PRs). Don't commit/push unless asked, except on a feature branch.
- **Work intake (PROJECT RULE):** planned work lives on the **RC1 board** (user project #24,
  https://github.com/users/zachshallbetter/projects/24) — manage it with the `github-projects`
  skill. New work: create a draft/issue on the board with Status/Priority/Size, claim it before
  starting (assign + Status → In Progress), reference the issue in the PR (`Closes #N`), and move
  it to Done on merge. The orchestrating session coordinates; worker agents execute board items.
  Claim-layer env for this board's vocabulary (the skill's defaults differ):
  `export GP_STATUS_READY=Ready GP_STATUS_ACTIVE="In progress" GP_STATUS_REVIEW="In review"` —
  the board has the `Agent` text field; drafts hold the backlog and convert to real issues when
  work starts. Local board model artifacts (`.board_snapshot.*`) are gitignored.
  **Write items as dispatchable briefs** — file paths, line numbers, symptom + cause, acceptance
  check. Brief-quality is the bottleneck for cheap-model workers: a precise body can be handed to
  a sonnet worker verbatim; a vague one can't be dispatched at all. Worker PRs arm auto-merge at
  creation (`gh pr merge --auto --squash`); squash commits default to PR title/body (repo setting),
  so PR titles must be commit-grade. Coordinator reviews any core/engine diff before it lands.

## Engineering craft (hard-won — keep these)

- **Verify the finish line, not the start.** "Auto-merge armed" ≠ merged. Watch a PR until its state is
  actually `MERGED` (`gh pr view <n> --json state`) — a batch was once marked done after merely arming
  auto-merge, and the work never landed. Likewise verify "did X land / is this still true?" against
  **`origin/main`** (`git fetch` first), never the local `main`/worktree checkout — it drifts behind.
- **Visual changes need visual verification.** Green `typecheck`/`test`/e2e routinely pass through changes
  that are *wrong on screen* (faint glows, captured particles that should vanish, a 4× framerate
  regression). For anything the field renders, screenshot it and probe live state (`particleCount()`,
  `--load`, sampled rAF fps) before declaring done — assertions can't see "it looks off."
- **Verifying a worktree's site.** The Preview MCP anchors to the **main checkout**, not your worktree
  (`pnpm -C <worktree>` in launch.json does NOT redirect it). Run the worktree's own server
  (`pnpm --filter @fundamental-engine/site preview --port 4399`, after a build) and drive it with headless
  Playwright (`import { chromium } from '@playwright/test'`). The shell's default Node 18 breaks
  pnpm/corepack — prefix `PATH` with the Node-22 bin (`~/.nvm/versions/node/v22.*/bin`).
- **Parallel PRs collide on the CHANGELOG — and it cascades.** Two in-flight PRs both adding `## [Unreleased]` bullets will
  conflict on rebase — resolve **keep-both** (it's append-only markdown). Hand-resolve CODE conflicts with
  a brace check; never blind keep-both on code (it once dropped a closing `});`). With many in-flight PRs,
  the conflicts **cascade**: each PR that merges to main adds its `[Unreleased]` entries, immediately
  dirtying every other open branch. Fix pattern: after each merge, rebase the remaining branches one
  more time, adding the new entries to their `[Unreleased]` block (keep-both). `gh pr update-branch`
  does NOT work on a CHANGELOG conflict — only a manual rebase resolves it.
- **Engine fixes go to ALL planes, in their own PR.** A physics/render bug is fixed in the JS core AND the
  Swift port (`swift/`) and any other port, shipped as a focused fix PR — never bundled into feature work.
- **Recipe canon is locked.** The 64-recipe (4×16) `FIELD_RECIPES` catalog is frozen; new recipes go in
  `EXPERIMENTAL_RECIPES`, never the locked set.

### Performance: the field is fill-rate-bound, NOT particle-bound

- **Profile by isolation before optimizing — the bottleneck is never where you assume.** Homepage 120→30fps
  was not particle count (density 1 vs 3 = same fps); it was **canvas compositing at DPR 2** (halving DPR
  doubled fps; hiding *either* full-viewport canvas restored it). When the field is slow, look at
  canvas/DPR/compositing first, particle math last.
- **The DPR2 / mix-blend trap.** A full-viewport `mix-blend-mode` canvas costs every frame the layer below
  animates, **even when empty/transparent** — the compositor re-blends the whole screen. Keep such canvases
  out of the tree (`display:none`) unless actively drawn (#405). A single additive `drawImage`/quad is cheap
  on a real GPU; a full-screen mix-blend re-blend is not.
- **Separate compute cadence from draw cadence.** Bodies are re-measured only **every 6th frame**
  (`frameN % 6` in `field.ts`), so any layer driven by body positions changes that slowly. Resample
  expensive grids (streamlines/`flow`, heatmap) on a cadence into a cache and DRAW from the cache every
  frame — no flicker, ~3× less work (#406/#407). And suppress the heaviest ambient layer (heatmap) while
  `env.scrollV` is high — scrolling shouldn't pay for a glow you can't focus on mid-scroll.
- **Headless exaggerates fill.** Playwright/headless runs software rasterization, so `drawImage`/fill costs
  read far worse than a real GPU. Don't kill a feature on a headless fill number alone; flag it and confirm
  on real hardware.

### The recurring bug class: the silent contract gap

- The engine writes feedback vars (`--load`, `--field-*`, `--d`) onto `data-feedback` bodies, but nothing
  enforces that a CSS consumer reads them — so a body "isn't changing" when it's really changing invisibly
  (hit `.btn` and `.hero-mass` both this cycle, and the original `data-feedback` lint class). When a body
  should visibly react, confirm the CSS actually consumes the var. The `data-feedback` lint catches one
  half; extending it to the consumer side is tracked.

## Quick map for a new task

1. Concept/terminology question → `docs/canonical/`. Engine internals → `docs/engine-reference/forces-system.md`.
2. "What's planned / where does this belong?" → RC1 board #24 (planned); `CHANGELOG.md` + `docs/release-notes/` (shipped).
3. Adding to the public API → mirror an existing method through core→vanilla→elements→react, extend the
   freeze gate, add a test, document in `apps/site/src/lib/docs-api.ts` + the relevant canon doc.
4. Touching the example family (`apps/site/src/pages/evidence*`) → the pattern doc is
   `docs/canonical/invisible-fields.md`; data snapshots regenerate via
   `node apps/site/scripts/snapshot-examples.mjs`; live-refresh plumbing is `src/lib/live-data.ts`;
   the e2e suite (`apps/site/e2e/`) pins the invariants — run it after changes.
5. Always close with the verification gate above.
