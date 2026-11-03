# Fundamental Engine audit — 2026-10-14

> **Status (2026-10-16):** a dated snapshot of the engine at `ecc215c5` (v0.11.0). Most high and
> medium findings were fixed and released in **0.11.1** — see [§6 Outcome](#6-outcome-2026-10-16) for
> what each finding became. For the current list of open work, read
> [`.agents/knowledge/open-work.md`](../../.agents/knowledge/open-work.md); for verified engine facts,
> [`.agents/knowledge/engine-facts.md`](../../.agents/knowledge/engine-facts.md). The scratch repro
> scripts named below were not retained; each confirmed defect that was fixed has a regression test in
> the repo instead (listed in §6).

- **Scope:** engine `main` @ `ecc215c5` (v0.11.0) and the zachshallbetter.com working tree.
- **Mode:** read-only on both repos.
- **Engine tree:** clean before and after. `check:golden` regenerated two fixture files; I restored them with `git checkout`.
- **Status labels:** **CONFIRMED** = reproduced (script or a run against `dist`) or verified line by line. **SUSPECTED** = code trace only.
- **Repro scripts and gate logs:** run from a local scratch area at the time (`zombie.test.mjs`, `phantom.mjs`, `resize.mjs`, `gov.mjs`, an esbuild tree-shake repro); not retained — the regression tests in §6 replace them.

## 1. Gates

| Gate | Result |
|---|---|
| `pnpm build` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm test` | ✅ 1,694 tests, 0 fail (core 1175, dom 184, elements 92, site 91, vanilla 54, three 50, observatory 27, react 21, create 9, scripts 6) |
| `check:api`, `check:docs`, `check:readme`, `check:recipes`, `check:packaging`, `check:dist`, `check:links`, `check:force-catalog`, `check:atoms`, `check:cem` | ✅ |
| `check:golden` | ❌ 3 values differ in the last ULP (e.g. `-0.14876575496341937` → `…934`). Cause: Node 26 locally, CI pins Node 22. This is the known env drift, not a code defect. |
| `check:contract-gap` | ⚠️ not run: the Playwright chromium-headless-shell binary isn't installed locally (env) |
| `publint`, all 7 packages | ✅ All good |
| Swift / Kotlin / Rust suites | not run (out of time budget). The parity counts below come from code reading. |

**Gate gap:** `check:readme` passed, but the README's headless code sample is type-invalid (finding D1), so README code blocks are not typechecked.

## 2. Issues, ranked by severity

### High

**H1. `destroy()` called inside a frame callback leaves the rAF loop running forever.** CONFIRMED (`zombie.test.mjs` fails)
- **Where:** `packages/core/src/engine/field.ts:2976`. `frame()` re-arms `raf = host.raf(frame)` after user callbacks have run. `destroy()` (`:3807`) cancels the id of the frame that is already running, and there is no `destroyed` flag.
- **Triggered by:** any teardown that runs from:
  - `onFeedback`
  - `field.on(...)` handlers (`flushBusEvents`)
  - `field:*` DOM event listeners
  - `registerOverlay` draw functions
- **Effect:** the dead field keeps simulating and writing `--d`. The repro got 19 `onFeedback` calls after `destroy()`.
- **Same pattern by code trace, SUSPECTED:**
  - `packages/elements/src/platform-runtime.ts:257-278`: a `field:quality-tier` listener that removes `<field-root>`.
  - `packages/dom/src/apply-recipe.ts:310-315`: the pattern drive loop.

**H2. Removed `[data-body]` elements keep acting as visible bodies at (0,0) and pin the old DOM in memory.** CONFIRMED (`phantom.mjs` + code)
- **Where:** `packages/core/src/engine/scanner.ts:423-433`. `measureBodies` has no `isConnected` guard. A detached element's rect is all zeros, so the body gets `cx=0, cy=0, vis=true`.
- **Nothing rescans automatically:** there is no MutationObserver and no view-transition hook in `packages/*/src`.
- **Effect:** with Astro `transition:persist` fields, every frame between the DOM swap and the app's `rescan()` applies force from the top-left corner and keeps the old subtree alive. Movers, emitters and engagements are already pruned via `isConnected`; only `bodies` isn't.
- **Site impact:** `field-runtime.ts` rescans on `astro:page-load`, not `astro:after-swap`, so it is exposed for that window. A site-side workaround was sent.

**H3. The `npm create @fundamental-engine` scaffolder installs 0.9.x, not 0.11.0.** CONFIRMED
- **Where:** `packages/create/templates/{vanilla,react,web-component}/package.json:12` pin `^0.9.2`. On 0.x, a caret range resolves to `>=0.9.2 <0.10.0`. The CLI (`packages/create/src/index.ts`) does not rewrite versions.
- **Effect:** every newly scaffolded starter gets an engine two minors old. Docs written for 0.11 (patterns API names, `query`/`snapshot`, `relief`) won't match what is installed.
- **Test gap:** `cli.test.ts:64` only asserts "bounded range", so the gate passes.

**H4. The README's flagship headless example silently yields an empty field.** CONFIRMED (run against `dist`)
- **Where:** `README.md:236` uses `rect: () => ({ x, y, width, height })`. The type (`types.ts:1102`) and the scanner (`scanner.ts:426`) use `left`/`top`.
- **Effect:** `left` and `top` come out `NaN`, so `vis=false`. After 60 ticks the result is `snapshot().bodies.length === 0`.

### Medium

**M1. "20 render modes (all shipped)" isn't what `render` accepts.** CONFIRMED
- **Claims:** `README.md:306`, `packages/core/README.md:36`, `packages/elements/README.md:53`.
- **Reality:** `FieldOptions.render` takes 11 drawing modes plus `none` (`types.ts:836-848`).
  - `field-lines` and `force-vectors` are overlays.
  - `heatmap` is `setHeatmap`.
  - `contours`, `potential`, `topology`, `inspector`, `causality` and `prediction` exist only as standalone `draw*()` helpers, and none of them has a test.
- **Effect:** `render: 'contours'` is a type error and nothing draws.

**M2. Stale force counts across shipped docs.** CONFIRMED
- **Code:** 37 forces everywhere (`MANUAL_FORCES`, the catalog, and the JS/Swift/Kotlin parity matrix).
- **Docs that say 36:**
  - `packages/core/README.md:28` (the npm README; also leaves out `relief`)
  - `android/README.md:280`
  - `apps/site/public/llms.txt:72,77`
  - `docs/canonical/support-matrix.md:34`
  - `docs/canonical/testing-and-conformance.md:524`
  - `apps/site/src/pages/docs/guides/kotlin.astro:110`
- **Wrong in another way:** `swift/README.md:163` says "All 33 forces" and then lists 36.

**M3. The Rust plane is understated, which is inflation in reverse.** CONFIRMED
- **Docs:** `README.md:211` ("28 of 37"), `rust/README.md` ("8 remain") and `rust/crates/fundamental-core/src/forces/mod.rs:3-7` all say 28.
- **Code:** `mod.rs` registers 36; only `relief` is deferred. CHANGELOG [0.10.2] is correct.

**M4. Every resize event rebuilds the whole swarm and rescans, with no debounce.** CONFIRMED (`resize.mjs`)
- **Where:** `field.ts:1615-1638`. A height-only resize keeps 0 of 130 particles and runs 8 `querySelectorAll` calls.
- **Effect:** on mobile, the URL bar showing and hiding resets the field mid-scroll. Separately, the `containerHost` ResizeObserver triggers an extra rebuild at boot.

**M5. Forced layout every frame on `<field-root>` and patterns: three rAF loops interleave writes and reads.** CONFIRMED by trace
- **Order within a frame:**
  1. The platform runtime measures every body and writes `--d`/`--field-*` (`platform-runtime.ts:180-183, 264`).
  2. The engine then reads layout in the same frame: `measureBodies` every 6th frame (`field.ts:2851`), `updateMovers` (`:1396`), and `drawThreads` (`:1566`).
  3. The `applyPattern` loop (`apply-recipe.ts:310`) adds a third pass of reads.
- **Extra cost:** O(bodies × relationships) filtering per frame (`apply-recipe.ts:225-232`).

**M6. The QualityGovernor's budget is hard-coded to 60 Hz.** CONFIRMED (`gov.mjs`)
- **Where:** `dom/src/governor.ts:35-39`.
- **Effect:** a steady 30 Hz display (e.g. iOS Low Power Mode) drops to tier 2 within 4 frames and never recovers. You get halved ticks, DPR 1.25 and no heatmap with no real overload. `perf.ts` already detects the true budget; the governor doesn't use it.

**M7. Reduced-motion gaps.** CONFIRMED by trace
- **What works:** `dt=0` follows the OS setting live (`dom/src/env.ts:44`).
- **Sparks:** gated on a boot-time capture (`field.ts:334, 923`). Turning reduced motion on after load still lets `burst()` spawn sparks.
- **Wall-clock animation:** `drawThreads`, `drawWaves` and `drawBound` animate from `env.t`, so they keep moving at about 15 fps under reduced motion.
- **`bindFieldNav`:** checks reduced motion only when it binds (`field-nav.ts:53`).
- **Allocation:** `prefersReducedMotion()` allocates a new `MediaQueryList` every frame.

**M8. Docs promise a reduced-motion projection the code doesn't implement.** CONFIRMED
- **Claim:** `README.md:438-440` says density "becomes contrast, weight, outline, … sound, or haptic".
- **What the code does:**
  - It freezes the field (`dt=0`).
  - `applyPattern` appends a static prose `<aside>` (`apply-recipe.ts:289-302`). That aside also lists declared pattern relationships, which aren't live, as if they were.
  - `'sound'` and `'haptic'` are enum members only (`types.ts:1482`).

**M9. The README overstates query, snapshot and replay.** CONFIRMED
- **Snapshot:** has no diagnostics, events or host metadata (`README.md:403` vs `types.ts:1405-1423`).
- **Causal Replay:**
  - The README shows a `t0…t4` timeline ending "became unstable" (`:411-418`).
  - `replayFieldSnapshots` diffs exactly 2 snapshots, gives every step the same frame and time, orders steps by lane, and has no notion of instability.
- **Query:**
  - It can't answer "which regions are unstable" or "what changed" (`:396`).
  - The lens example asks for `confidence` and `memory` metrics, which are never produced (`field.ts:575-583`).

**M10. `query()` and `snapshot()` relationships omit pattern and DOM relationships.** CONFIRMED (code)
- **Where:** they read only `programmaticEdges` (`field.ts:3626, 3684`).
- **Effect:** `applied.inspect().relationships > 0` while `field.query({include:['relationships']}).relationships` returns `[]`. This matters for a query()-based site inspector.

**M11. Pattern tier names are wrong in README and llms text.** CONFIRMED
- **Claim:** `README.md:349` lists "core / workflow / professional / enterprise", and `llms-full.txt` copies it.
- **Code:** the tiers are `core / applied / systems / operational`, 16 each (`catalog.ts:1519`).

**M12. Off-thread render bridge defects.** CONFIRMED by trace (`dom/src/worker/offthread-bridge.ts`)
- **No resize:** the OffscreenCanvas is never resized (`:78`), so output goes stale after a window resize.
- **Buffer pool:** above 1,000 particles the pool never fits, so a new `Float32Array` is allocated every frame (`:90`).
- **Silent freeze:** there is no worker `error` handler, so a worker error freezes rendering (`pending` stays true).

**M13. Under a bundler, `<field-cell>` is tree-shaken out and never registers.** CONFIRMED (esbuild)
- **Cause:** `packages/elements/package.json` sets `sideEffects: ["./dist/index.js"]`, but `customElements.define('field-cell')` runs at the top level of `dist/field-cell.js` (`src/field-cell.ts:319`). `index.js` reaches that file only through `export *`.
- **Repro:** bundling `import '@fundamental-engine/elements'` keeps `field-root`/`field-field` and drops `field-cell` (0 occurrences).

### Low–Medium

**L1. React wrappers.** CONFIRMED by trace
- **Rebuild on every render:** effect deps include the array or object props `palette`, `overlay` and `waveCenter` (`react/src/index.tsx:75-103, 124-153`). Passing them inline destroys and rebuilds the field on every render.
- **Dropped option:** `useFieldField` silently drops `restingMotion`.

**L2. `FrameScheduler.recorded` grows unbounded in non-strict mode.** CONFIRMED by trace
- **Where:** `dom/src/schedule.ts:114`. It adds one entry per frame for recurring off-phase reads, and nothing in production calls `clearViolations()`.

**L3. Only 10 of 37 forces carry the "four-field classification".** CONFIRMED
- **Claim:** the README presents it as a property of forces in general (`README.md:296`).
- **Code:** `FORCE_FIELD` has 10 entries.

**L4. The "no word lives in two lanes" rule is violated by the engine's own vocabulary.** CONFIRMED
- `lens`: a force token, the query `FieldLens`, and the "Lenses read" lane.
- `memory`: a force, a dimension, and an agent field.
- `gravity`: a force and a field class.
- The root README's lane list omits "Lenses read", which the canonical README includes.

### Low

- **L5. Deprecated recipe aliases are still used internally.** CONFIRMED
  - `FIELD_RECIPES` in `inspect/report.ts:12,40` and `catalog.ts:1561`.
  - `applyRecipe` in `dom/src/field-nav.ts:16,82`.
  - `compileRecipe` in `apply-recipe.ts:144`; its user-facing error says "applyRecipe: invalid recipe".
  - `gen-llms.mjs:322`.
  - The core npm README advertises `compileRecipe()`.
  - Tests cover `compileRecipe` but not `compilePattern` (0 tests), so removing the aliases at 1.0 drops that coverage.
- **L6. Exported but untested.**
  - Counts: core 87/391, dom 9/74 (`destroyPattern`, `bindFieldNav`, `driveRenderPlan`, `lintVisuals`, `scanRelationships`), vanilla 2/12, elements 1/14, three 2/15 (`createThreeField`, `netField`).
  - The site integration relies on `bindFieldNav` and `scanRelationships`.
- **L7. Stale docs and comments that describe `forces:*` events as live.**
  - `docs/planning/1.0-removal-checklist.md:24-35`
  - the comment at `field.ts:3046`
- **L8. Small background and per-event costs.**
  - The 1,200 ms `idleTimer` keeps running in hidden tabs, contrary to the comment at `field.ts:3023`.
  - The scroll handler runs `querySelectorAll('[data-formation]')` and rects on every scroll event.
  - There are per-frame allocations in `frame()`.
  - X-ray rebuilds its DOM on every rAF while open.
  - `scan()` after `destroy()` re-binds `[data-hot]` listeners that are never released.
  - `makeContainedCanvas` doesn't restore `position` on destroy.
- **L9. Stuck hover when a hovered `[data-hot]` element is removed.** SUSPECTED
  - `hoverAccent` and `threadLinks` keep pointing at a detached node, so threads draw to the corner.
- **L10. TODO/FIXME debt is negligible.** CONFIRMED
  - 2 markers total, both `TODO(parity)`.

### Verified accurate (no defect)
- 37 forces in a 9/8/20 split.
- 64 Field Patterns.
- `query`, `snapshot`, `diff`, `replay` and `applyLens`: exported, implemented and tested.
- 9 presets and 5 formations.
- `FIELD_VERSION` 0.11.0 in JS, Swift and Kotlin; Rust workspace at 0.11.0.
- All 7 npm packages at `latest` 0.11.0.
- Packages are ESM-only with correct `types`. No test files ship. publint is clean.
- `invisible-fields.md` honestly says pattern relationships are metadata.
- Teardown is correct for the dom host and container host, overlay surface, x-ray, textBodies, visual bindings and field-cell. The registries prune detached elements.

## 3. Capability map: engine 0.11.0 vs zachshallbetter.com

- **Site state:** the committed HEAD pins `vanilla ^0.9.3`. The working tree, edited by the integration session and not yet committed, pins `core`, `dom` and `vanilla` to `0.11.0`, and `node_modules` resolves 0.11.0.
- **Column key:** "WIP" = in that uncommitted work.
- **Full table:** kept with the integration notes at the time; the site's current integration is described in [`.agents/runbooks/sites.md`](../../.agents/runbooks/sites.md).

| Capability | Export / attr | Site today | Fits? | Placement |
|---|---|---|---|---|
| Mount | `FieldField`/`createField` (vanilla) | Yes. WIP: single owner `field-runtime.ts` | Yes | — |
| Canonical forces (9) | `data-body` tokens | attract, repel, sink, swirl | Yes | `tether`/`stream` card→case links, `wall` at article measure edges |
| Natural forces (8) | gravity, charge, magnetism, thermal, collide, diffuse, propagate, memory | gravity only | Yes | `memory` on read cards, `propagate` on /now |
| Extended forces (20) | lens, link, pigment, spotlight, shear, … | link, lens, pigment | Partly | `spotlight` on the current /work row; skip `morph`/`spawn` |
| Body attributes | `data-feedback/strength/range/color/absorb/spin/intent/field-role` | most used | Yes | `data-intent`/`data-field-role` on CTAs |
| Feedback CSS vars | `--d`, `--load`, `--coherence`, `--field-attention/memory/recency` | `--d`, `--load`. WIP: `field-integration.css` | Yes | — |
| `registerFieldProperties` | dom | No | Yes | Once in `field-runtime` so the vars transition |
| Formations, accent, burst, threads | handle | Yes | Yes | `setPalette` on theme toggle |
| `sample`/`sampleScalar`/`energy` | handle | `sample`, `energy` | Yes | `sampleScalar` gauge in the HUD |
| Overlays / render modes / heatmap / attention / causality | `setOverlay`, `setRender`, `setHeatmap`, `setAttention`, `setCausality` | Constructor flags only | **Yes** | HUD toggles (streamlines, force vectors) |
| x-ray | `mountXRay` (dom) | No | **Yes** | Site-wide on `?` |
| Snapshot / diff / replay | handle | WIP: `snapshot()` before swap; `diff` never called | **Yes** | HUD "what this navigation changed" |
| query / lens / edges | `query`, `applyLens`, `readEdges` | No | Yes | Inspector "bodies in view". Note M10: pattern relationships don't appear in it |
| Focus / attention | `focus`, `focusState`, `flowTo`, `allocateAttention`, `focus` event | No | **Yes** | `reading.ts` section focus; CTA `flowTo` contact |
| Patterns: core tier | `applyPattern` | WIP: reading-field, memory-trace | Yes | evidence-field on receipts, concept-cluster on /writing, decay-notice on /now |
| Patterns: applied tier | — | No | Partly | citation-thread on footnotes, availability-pressure, form-stability-field on /contact, staleness-drift on /work |
| Patterns: systems tier | — | No | Some | relation-lens on Related, source-constellation/provenance-trail on case evidence |
| Patterns: operational tier | — | No | Mostly no | system-pulse on the /now heartbeat |
| bindFieldNav / wayfinding | dom | WIP | Yes | — (untested in the engine, L6) |
| Relationships | `RelationshipRegistry`, `scanRelationships`, `data-field-relation` | WIP | Yes | — |
| bindData + withFlip | dom | No | **Yes** | /work records as bodies; filter/sort reflow |
| textBodies | dom | No | Yes | Hero headline, article H1 |
| contours | `contourSvgFor` | No | Sparingly | Fundamental case-study title |
| threadOverlay | dom | No | Yes | Accessible SVG relations, works with the canvas off |
| Events | `on('captured','met','enter','exit')` | No | Yes | `captured` on the contact sink → audio pluck |
| Governor / perf / policy | `QualityGovernor`, `createFieldPerf`, `setPolicy`, `setQualityTier` | `dprCap` only | Yes | Tie to the zs-field switch, mobile and reduced motion (mind M6) |
| Agents | `addAgent`, `forAgent`, projections | No | Partly | `forAgent` behind llms.txt; agent demo on the FE page |
| Offthread render | `attachOffthreadRender` | No | Not yet | Blocked by M12 |
| Export | `downloadCanvasPng`, `segmentsToSvg` | No | Yes | "Save this field" in the colophon |
| Lint | `lintPlatform`, `lintFeedbackReadsUnwritten` | No | Dev only | Smoke check |
| React / elements / three / Lab | — | No | No | Astro + vanilla; Habitat already shows three; the Lab lives on fundamental-engine.com |

**Sent to the integration session (2 messages):**
1. The unused-but-fitting list (x-ray, diff panel, overlay toggles, bindData + withFlip, focus/flowTo, textBodies, the extra patterns, threadOverlay, events, policy + governor).
2. The engine defects that hit its work, with site-side workarounds:
   - H2: also `scan()` on `astro:after-swap`
   - H1: defer `destroy()` out of field callbacks
   - M4: resize rebuild
   - M6, M7, M12
   - M13: don't use `<field-cell>`

## 4. Recommended fix order (proposals for Zach)
1. **H1 + H2 together** (one core PR):
   - a `destroyed` flag checked before re-arming rAF
   - an `isConnected` guard plus pruning in `measureBodies`
   - optionally, auto-rescan on `astro:after-swap` / a MutationObserver as opt-in
   - regression tests from `zombie.test.mjs` / `phantom.mjs`
2. **H3:** bump the scaffolder templates to `^0.11.0`, and make `cli.test.ts` assert template range == the package's own minor so it can't drift again.
3. **H4 + M1–M3, M8, M9, M11** (one docs-truth PR):
   - fix the headless example
   - restate render modes as 11 + overlays + helpers
   - 36→37 everywhere
   - Rust 28→36
   - tier names
   - the reduced-motion and replay claims
   - add a README code-block typecheck so H4 can't recur
4. **M4 + M6:** debounce or diff resize (skip the rebuild when only height changes by less than the URL-bar delta), and have the governor use `perf.ts`'s detected frame budget.
5. **M13:** add `./dist/field-cell.js` to `elements` `sideEffects`.
6. **M7, M10, M5, M12, L1:** next tier, in that order.
7. **L5/L6:** move internal callers to the Pattern names and point the tests at the canonical names before the 1.0 alias removal.

## 5. Extension: external review cross-check (2026-10-14)

Zach pasted an external "Comprehensive Architecture, Product, and Ecosystem Review". Its author says it is based on the README, docs and issues. It is not based on the code, and the author didn't run tests. I checked its concrete claims against the repo. The fix order in §4 stays the same; the items below extend it.

### Added findings (from the review, verified open on GitHub)

**X1. `reaction: true` is non-deterministic across repeated runs in one process.** High. Issue [#1207](https://github.com/zachshallbetter/fundamental-engine/issues/1207), open.
- **Repro:** six identical seeded runs (`mass` + `reaction`, two dynamic repel bodies, 400 steps) drift strictly monotonically, from 127.7947 to 127.8082.
- **Cause:** module-level `probe` / `probeEnv` / `noise` in `core/src/engine/streamlines.ts` outlive every field. The probe is reset field-by-field, but fields absent from its literal (`z`, `vz`, `charge`, `species`) persist.
- **Impact:** `reaction` is off by default, so nothing shipped is affected. It does undercut record/replay, Field Receipts and the golden-vector premise.
- **Gate gap:** the golden pins one force apply, not repeated whole runs.
- **Relation to this audit:** not covered in §2; it belongs in the same isolation family as H1.

**X2. The parity gate infers support from registration, not reachability.** High (process). Issue [#1176](https://github.com/zachshallbetter/fundamental-engine/issues/1176), open.
- **Example:** Kotlin `warp` was marked supported while `WarpForce.apply` always returned at its first guard, because nothing set its pairing state.
- **Scope:** it is the fourth defect of this shape (#1090 …).
- **Same class as this audit's declared-vs-reachable findings:** H4, M1, M8, M10, M13.

### Review claims that are wrong or unverified
- **"Rust has 28 of 37 forces":** stale. It repeats `README.md:211`. The code registers 36; only `relief` is deferred (M3).
- **"Indexed docs show 0.9.3":** unverified, and the review hedges it itself. I didn't confirm it either.
- **Its P1 "clean external consumer install":** already fails today. `npm create @fundamental-engine` installs 0.9.x (H3).

### What the review missed
The runtime defects H1, H2, M4 and M6, which need the code to find. Its "verify release gates cover the consumer experience" question is answered "no" by H3 and M13.

### Extended fix list (appended after §4; §4 order unchanged)
8. **X1 / #1207:** reconstruct the probe per sample, or reset it from a frozen template. Add an "N identical seeded runs in one process → byte-identical" conformance test. Until fixed, document `reaction` as non-deterministic.
9. **X2 / #1176:** extend `force-tokens` from "registered" to "reachable through the host API". Each port drives the force through its public host surface and asserts a non-zero effect.
10. **Conformance classes, longer term (review §3):** split force, simulation, isolation (X1, H1), observation, replay and cross-platform conformance into separate gates.
11. **Strategic items for Zach to judge, not defects:**
    - mid-tier mobile benchmarks covering whole-application overhead
    - one independent third-party integration
    - a stated support level per capability (declared → reachable → tested → conformant → validated)
    - version provenance on docs builds
    - keeping world-substrate work (#1111) parked

## 6. Outcome (2026-10-16)

| Finding | Result | Where | Regression guard |
|---|---|---|---|
| H1 in-frame `destroy()` leaves the loop running | fixed, 0.11.1 | #1238 | `core/src/engine/destroy-and-detach.test.ts`, `elements/src/platform-runtime.destroy.test.ts`, `dom/src/apply-recipe.test.ts` |
| H2 detached bodies act from (0,0) | fixed, 0.11.1 (pruned on the measure cadence; consumers that swap DOM still benefit from an immediate rescan) | #1238 | `destroy-and-detach.test.ts` |
| H3 scaffolder installs 0.9.x | fixed, 0.11.1 | #1239 | `create/src/cli.test.ts` range test |
| H4 README headless example builds an empty field | fixed | #1240 | `pnpm check:readme-code` |
| M1 "20 render modes" overstated | fixed (README, package READMEs, site) | #1240, #1248 | — |
| M2 stale force counts | fixed | #1240 | widened `catalog-counts-doc.test.ts` |
| M3 Rust plane understated | fixed (36/37; test-coverage wording corrected in #1242) | #1240, #1242 | — |
| M4 resize rebuilds the swarm | fixed for height-only changes within 160 px, 0.11.1 | #1241 | `core/src/engine/soft-resize.test.ts` |
| M5 interleaved rAF loops force layout | **open** | — | — |
| M6 governor hard-coded to 60 Hz | fixed, 0.11.1 (`setBudget` / `budgetMs`) | #1241 | `dom/src/governor.test.ts`, `elements/src/platform-runtime.governor.test.ts` |
| M7 reduced-motion gaps | **open** | — | — |
| M8 reduced-motion projection overclaimed | fixed (docs) | #1240 | — |
| M9 query/snapshot/replay overclaimed | fixed (docs) | #1240 | — |
| M10 query omits pattern/DOM relationships | **open** (now documented) | #1240 | — |
| M11 pattern tier names wrong | fixed | #1240 | — |
| M12 off-thread bridge defects | **open** | — | — |
| M13 `<field-cell>` tree-shaken | fixed, 0.11.1 | #1244 | `elements/src/side-effects.test.ts`, `check:consumer` |
| L1, L2, L4–L9 | **open** | — | — |
| L3 four-field classification overclaimed | fixed (README) | #1240 | — |
| X1 / #1207 `reaction` non-determinism | **open** (fix PR #1208 needs rebuilding after the history rewrite) | — | — |
| X2 / #1176 parity counts registration | **open** (#1175 needs rebuilding) | — | — |

Found after the audit, while fixing and verifying:

| Finding | Result | Where | Guard |
|---|---|---|---|
| `npm create @fundamental-engine` scaffolded nothing in every release 0.9.3–0.11.0 (bin run through npm's symlink never matched the entrypoint guard) | fixed, 0.11.1 | #1245 | symlink test in `cli.test.ts`; `check:consumer` (blocking at release) |
| React starter failed `tsc` (TS5097) | fixed, 0.11.1 | #1245 | `check:consumer` runs `tsc` on every template |
| No gate exercised the published consumer path | added `check:consumer` | #1246 | — |
| Overlay re-rastered unchanged frames (GPU perf gate flake on `overlay=grid dprCap=2`) | fixed, 0.11.1 | #1243 | `core/src/engine/overlay-skip.test.ts` |
| `mountXRay` hotkey fired while typing; panel stranded after an SPA `<body>` swap | fixed on `main`, unreleased | #1250 | `dom/src/x-ray.test.ts` |
| fundamental-engine.com claims the code doesn't back (getting-started signals example, use-cases APIs, homepage parity/freeze/a11y/perf wording) | fixed; footer/llms/sitemap provenance added | #1248, #1249 | — |

Released: **0.11.1** (2026-10-14, #1247, tag `v0.11.1`), verified by scaffolding, installing and building
from the public registry.

