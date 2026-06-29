# Documentation refactor — full plan (JS · Swift · Kotlin)

**Status:** Design — not started. Active plan.
**Goal:** Every user-facing API and capability, on every platform, documented — **correct, complete, current, and cross-platform-honest** — and *locked that way* by a gate so it cannot rot or contradict the engine again. No mysteries.
**Grounding:** Written from a five-front audit of the actual surface (JS imperative + declarative, current docs IA, Swift, Kotlin). The numbers and parity facts below are from code, not memory.

---

## 0. Premise correction (read this first)

The working premise was "the docs are missing more than they provide." **The audit does not support that.** The current docs are broad:

- **46 published doc pages** in a 5-group IA (Start · Concepts · Build · Reference · Field studies), with search, breadcrumbs, TOC, prev/next, and an internal-link integrity check.
- **Dedicated API reference pages already exist:** `/docs/api/{options, handle, attributes, forces, metrics, types, stability, presets, catalog}`.
- **`docs-api.ts` already enumerates ~124 API items** — 37 options, **44 FieldHandle methods**, 20 `data-*` attributes, 8 feedback vars, 7 render modes, 8 overlay readings.
- **Forces / presets / conditions tables are generated from the engine catalog** ("so they cannot drift").
- **Swift and Kotlin guide pages already exist.** 21 canonical authority docs + 9 engine-reference specs sit underneath.

But **breadth of coverage is not the same as serving a developer well.** A reference that is broad, fragmented across 46+76 pages, dense, partly *wrong*, and platform-dishonest can still leave a reader lost. **The decision (owner's call) is a ground-up rebuild of the information architecture, voice, and structure** — not a patch. What the audit changes is *how* we do it safely: the existing breadth, the generated tables, the live-demo embedding, and the integrity check are assets to **carry forward**, and the **coverage gate + parity matrix + generation (§4–§5)** become the *guarantees* that the rebuilt surface is complete, correct, and honest — so an aggressive rebuild doesn't lose coverage or reintroduce drift. **Rebuild the surface; keep the spine.**

---

## 1. The four real problems

1. **Correctness — the docs are confidently *wrong* in places.** The exemplar (found this session): every density doc says *"`--field-density` is primary; prefer it; `--d` is the legacy alias"* — but `applyRecipe`'s density metric clobbers `--field-density` to 0 for any recipe with a density metric, so `var(--field-density)` reads 0 while the "legacy" `var(--d)` holds the real value. **Following the published guidance produces no glow.** One wrong core fact poisons trust in the whole set.
2. **Depth — broad reference, thin tutorials.** Most APIs have a reference entry but no worked example. The audit flagged: scalar grids, custom feedback sinks, agents outside Three.js, `addField` semantics, seeding/`atomAt`, condition/formation *authoring* (not just enumeration), custom hosts (`headlessHost`/`containerHost`), the observable/sampling surface, data-binding at scale, performance tuning.
3. **Currency — this session's capabilities aren't documented:** the two-tier substrate/overlay workbench, the `overlayCanvas` requirement (silent no-op without it), contained-field density behavior, reverse-dynamics, the signal-readout pattern, `RenderMode`-vs-`setRender` mode divergence.
4. **Cross-platform honesty — the guides imply uniformity that doesn't exist.** The three platforms have **materially different surfaces** (§3). Today's Swift/Kotlin guides read as "same thing, native syntax." They aren't.

**Structural root cause of re-rot:** nothing fails when a hand-authored doc drifts from the engine. The generated tables can't drift; the prose can, and does. **The fix is to make completeness and correctness a CI gate** (§4).

---

## 2. Principles

1. **Completeness is a gate, not an aspiration.** Enumerate every public symbol / attribute / token / feedback var / element attribute from the *sources of truth*; fail CI when any lacks a doc entry. (§4)
2. **Generate the enumerable; author the conceptual.** The reference layer is generated from source (already true for forces/presets/conditions — extend it to *everything* enumerable). Prose concepts/guides stay hand-written but are *correctness-checked*.
3. **Honest parity, not assumed parity.** Every API page carries a **per-platform support row** (JS · Swift · Kotlin) sourced from each port's actual surface + the conformance golden. A capability absent on a platform is a *documented* gap, not silence. (§5)
4. **Correctness-first.** A wrong doc is worse than a missing one. The correctness pass (§7) precedes the depth pass.
5. **Declarative-first IA.** Lead with the authoring surface (bodies, forces, feedback channels) — what most users touch — then imperative, then platform guides, then recipes, then generated reference.
6. **Status honesty** (existing rule): every page states shipped / experimental / frozen.

---

## 3. The surface to cover (from the audit) + the cross-platform reality

### The enumerable surface (per the inventories)
- **Declarative (JS/DOM):** ~40 `data-*` authoring attributes; the body contract; supplied metric lanes; relationships; presets; intents/roles.
- **Forces:** all **36** (9 canonical · 8 natural · 19 extended) — present on **all three** platforms.
- **Feedback CSS vars (JS):** `--d`/`--field-density`, `--field-heatmap-density`, `--load`/`--mass`, `--lit`, `--entropy`/`--coherence`/`--temperature`, the 9 `--field-<metric>` lanes — with the **engine-written vs host-supplied** split.
- **Imperative:** `createField` + **37 options**; **`FieldHandle` (44 methods)**; the 6 platform registries; the FrameScheduler; **14 lint rules**; utilities (`withFlip`, `allocateAttention`, `textBodies`, `threadOverlay`, `bindFieldNav`, `QualityGovernor`).
- **Surfaces:** vanilla, react (`FieldField` + `useFieldField` + `useForcesData`), elements (`<field-root>`/`<field-cell>`), three.
- **Render:** 8 modes + 9 overlay readings; **6 truth modes**; **6 condition gates**; **64 recipes**.

### The cross-platform parity reality (the centerpiece finding)
The ports are real but **diverge** — Swift is the high-water mark, Kotlin lags:

| Capability | JS (reference) | Swift | Kotlin |
|---|---|---|---|
| Declarative bodies | `data-body` DOM scan | `.fieldBody()` SwiftUI modifier | `Modifier.fieldBody` (no per-body feedback cb) |
| `FieldHandle` methods | **44** | ~full parity (protocol) | **~29** (render is host-side, not on handle) |
| `setRender`/`setOverlay` on handle | ✓ | ✓ | ✗ (RenderMode on `FieldView`) |
| Render modes | 8 | 6 (dots/trails/links/metaballs/voronoi/streamlines) | **4** (dots/trails/links/glow; metaballs/voronoi = follow-up) |
| Overlay readings | 9 | 9 | registry exists; host drawing partial |
| Feedback delivery | CSS vars on DOM | `onFeedback` callback (`FeedbackChannels`) | StateRegistry / callback |
| 36 forces | ✓ | ✓ | ✓ |
| 64 recipes (compile+validate) | ✓ | ✓ | ✓ |
| Platform (6 registries + scheduler) | ✓ | ✓ | ✓ |
| `applyRecipe`/`bindData`/`text-bodies` | ✓ | DOM-specific → SwiftUI idiom | DOM-specific → Compose idiom |
| 3D / volumetric | flat (+`depth`) | **Vec3-native, visionOS/RealityKit** | flat |
| Diagnostics/inspect UI, governor, agents | ✓ | not yet | not yet |

This table — *generated and verified*, not hand-waved — is the single most useful thing the refactor can add. It's what "all platforms, no mysteries" actually means.

---

## 4. The spine: a docs coverage + correctness gate (`check:docs`)

A new CI check (sibling to `check:api` / `check:readme` / `check:recipes`) that makes "no mysteries" **structural**:

1. **Enumerate** every documentable item from the sources of truth:
   - frozen + public symbols (`api-surface.data.mjs`, the `FieldHandle`/`FieldOptions` types),
   - every `data-*` attribute (the scanner),
   - every force token (the passport),
   - every feedback var (the feedback sink + metric system),
   - every `<field-root>`/`<field-cell>` attribute/method/event (the CEM `custom-elements.json`),
   - render/overlay/truth/condition vocabularies.
2. **Assert each has a doc entry** (a generated machine-checkable id ↔ doc-anchor map). **Fail CI on a gap** — a new force, option, or attribute can't merge undocumented.
3. **Correctness probes** for the highest-risk hand-authored claims: e.g., a test that *renders* the documented `--field-density` guidance and asserts it actually produces a non-zero value (it currently wouldn't — that's the bug). Where a doc makes a checkable claim, check it.
4. **Per-platform coverage:** the same enumeration runs against the Swift and Kotlin public surfaces (symbol lists) to keep the parity matrix (§5) honest and current.

This is the difference between "we documented everything once" and "it stays documented." It also turns the rest of the refactor into a *measurable* burndown (X% of the enumerated surface has a doc entry).

---

## 5. Cross-platform parity matrix (generated, honest)

- One generated matrix (the §3 table, exhaustive) sourced from: each platform's public-symbol enumeration + the **shared cross-plane conformance golden** (which already proves the ports match at `depth:0`).
- Every API/concept page carries a **support row** rendered from the matrix: `JS ✓ · Swift ✓ · Kotlin ✗ (imperative-only)` etc., with a link to the platform's idiom.
- Capabilities that are *idiom differences* (DOM scan vs `.fieldBody` vs `Modifier.fieldBody`) are shown as **equivalents**, not gaps; capabilities genuinely absent (Kotlin `setRender`, metaballs/voronoi) are shown as **gaps** with status.
- The matrix is part of `check:docs` — a port gaining/losing a symbol updates it or fails.

---

## 6. Information architecture — a ground-up rebuild

The current IA is **feature-/module-shaped** (Start · Concepts · Build · Reference · Field studies, 46 pages) and **fragments** the same topic across many thin pages (density alone is touched by ~6 pages, inconsistently). The rebuild is **task-shaped, platform-aware on every page, and consolidated** — fewer, deeper, canonical surfaces. Five sections, one spine:

1. **Learn** — a single guided path (textbook order), platform-tabbed throughout (JS · Swift · Kotlin):
   *Install & first field → Bodies & forces → The two-way loop (feedback) → Recipes → Going deeper.* Each step is runnable; reference is always one click away. This replaces the scattered "Getting started / Tutorial / guides/*" sprawl with one coherent on-ramp.
2. **Understand** — concepts as **one connected narrative**, not a page-per-idea pile: the field model · the four natural fields · truth modes · surfaces & visualization · reciprocity and the invisible field. Each page *demonstrates itself* (the field runs on the page).
3. **Build** — a task-oriented **cookbook**: invisible/signals-first fields, contained (component-scoped) fields, data-driven fields (`bindData`), the visualization workbench, navigation chrome, accessibility, performance tuning, custom hosts. Recipes, patterns, and worked examples — the depth layer the old docs lacked.
4. **Reference** — **one consolidated, generated, searchable surface** (replacing the 10 `/api/*` sub-pages): `createField` + options · the `FieldHandle` (every method) · the full body contract (every `data-*`) · the 36 forces · the feedback channels (corrected, canonical) · render/overlay/truth/condition vocab · the 64 recipes — **every entry carries its per-platform support row**. Plus stability/freeze and migration.
5. **Platforms** — the **honest per-platform story**: JS (vanilla/react/web-component/three), Swift (SwiftUI/UIKit/AppKit/visionOS), Kotlin (Compose/View/desktop lab) — each documenting its *actual* surface and idioms, anchored by the generated **parity matrix** (§5). No implied uniformity.

**Consolidation targets:** collapse density's ~6 scattered mentions into one canonical feedback-channels page; merge the 10 `/api/*` pages into one generated reference; fold the 6 "field studies" into the cookbook as worked patterns; one concepts narrative instead of ~8 concept pages.

## 6b. Voice & pedagogy (the "structure" half of the rebuild)

- **Concrete before abstract.** Every page opens with a runnable thing, then explains it — not the reverse.
- **The page is the proof.** Docs run the field they describe; the **signal readout** (from the explore work) makes the invisible loop visible *inline*. "Show, don't tell" is enforceable here because the engine is the subject.
- **One narrator, platform-aware.** A single consistent voice; platform differences live in tabs, not separate silos. Token-speak is always translated to plain language (the naming-lanes rule).
- **Progressive disclosure.** The Learn path is linear and shallow; Reference is exhaustive and flat; Build is lookup-by-task. A reader is never forced through depth they didn't ask for, nor blocked from it.
- **Status honesty on every page** (shipped / experimental / frozen) — existing rule, kept.

---

## 7. Correctness pass (do this first — it's the trust fix)

- **Fix the `--field-density` collision at the source** (engine, all planes): when the host doesn't supply `data-field-density`, the density metric falls back to the engine's gathered density, so `--field-density === --d` again and the documented guidance becomes *true*. Then correct every density doc to one consistent story. *(This is an engine bug, tracked separately; the docs can't be made correct without it.)*
- **`overlayCanvas`**: document the requirement prominently + add a dev-mode warn when `setOverlay` is called with no overlay backend (silent no-op today).
- **`RenderMode` vs `setRender`**: the type lists 8 (incl. field-lines/heatmap); `setRender` accepts a *different* 8 (field-lines is an overlay, heatmap is `setHeatmap`). Document the distinction; consider a type-level clarification.
- **Contained-field density**: document that particle count is `130 × density` regardless of `bounds` area, so small contained fields read low `--d` (raise `density`).
- **Audit sweep**: run the §4 correctness probes; fix every hand-authored claim that disagrees with the engine.

---

## 8. Depth / currency pass

Fill the audit's gap list with worked, runnable examples (the docs already embed live demos — reuse that): scalar grids, `feedbackSink`, agents (non-Three), `addField`, seeding/`atomAt`/`readParticleIds`, condition & formation *authoring*, custom hosts (`headlessHost`/`containerHost`), the unified "reading the field" sampling tutorial, `bindData` at scale, performance tuning (`dprCap`/`qualityTier`/density), framework interop (SSR/hydration/islands). Add this session's capabilities (workbench, contained fields, reverse, signal readout).

---

## 9. Phases (dispatchable; each measurable against `check:docs`)

- **Phase 0 — the gate + matrix generators.** Build `check:docs` (enumeration + coverage map + correctness probes) and the parity-matrix generator. This makes everything after it measurable and prevents regression *during* the refactor. Ships red (showing the current gap %), then the refactor burns it down.
- **Phase 1 — correctness pass** (§7) + the canonical feedback-vars reference. The trust fix. Blocks on the engine `--field-density` fix.
- **Phase 2 — declarative authoring** (body contract, forces, feedback channels) with per-platform support rows. The biggest surface.
- **Phase 3 — imperative API + sampling/observable** with parity rows; the registries/scheduler/lints (JS).
- **Phase 4 — platform guides rewritten honestly** (Swift, Kotlin) against §3, each linking the shared reference; the parity matrix page.
- **Phase 5 — patterns/cookbook + depth examples** (§8).
- **Phase 6 — IA refinement, redirects, status sweep, retire/merge stale pages.**

Each phase is board-dispatchable per surface; the gate's coverage % is the burndown metric. Cheap-model workers can fill generated-reference + example stubs; concept/correctness pages need review.

---

## 10. Anti-rot guarantees (the "stays fixed" part)

- `check:docs` fails CI on any undocumented public symbol/attribute/token/var/element-member — on **any** platform.
- The parity matrix regenerates from the conformance golden + symbol enumeration; a port drift fails the gate.
- Correctness probes assert the highest-risk claims against the running engine.
- Generated reference tables stay generated (extend the existing forces/presets/conditions generation to the full enumerable surface).

---

## 11. Risks / open questions

- **The engine `--field-density` fix is a prerequisite** for a correct density story and touches all three planes — sequence it before Phase 1's feedback-vars reference.
- **Parity matrix maintenance** depends on reliable per-port symbol enumeration; Swift/Kotlin don't have an `api-surface.data.mjs` equivalent yet — Phase 0 may need to add lightweight public-symbol extractors for the ports.
- **Scope discipline:** this is large. The gate makes it safe to ship incrementally (red → green) rather than as one big-bang rewrite; resist the urge to rewrite pages that are already correct.
- **Don't regress the strengths:** the generated forces tables, the 5-group IA, the integrity check, and the live-demo embedding all work — build on them.

---

## 12. File manifest (indicative)

| Area | Change |
|---|---|
| `scripts/check-docs.mjs` (new) | The coverage + correctness gate; enumerate sources of truth → assert doc entries; run correctness probes |
| `scripts/gen-parity-matrix.mjs` (new) | Generate the JS·Swift·Kotlin support matrix from symbol enumeration + conformance golden |
| `apps/site/src/lib/docs-api.ts` | Become (mostly) generated; the hand-maintained arrays move behind generators |
| `apps/site/src/pages/docs/**` | Correctness pass + per-platform support rows + new pages (workbench, patterns, parity matrix) |
| `docs/canonical/feedback-channels.md` (new/var-table) | The canonical, correct feedback-vars reference |
| `packages/core` + `swift/` + `android/` | The `--field-density` collision fix (separate all-planes PR) + per-port public-symbol extractors |
| `package.json` | `check:docs` added to the gate |
