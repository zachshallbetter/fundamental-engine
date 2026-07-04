# Fundamental Engine Core Review — Full Findings Report
## Scope
This report summarizes a static code review of `packages/core/src` and a follow-up factual validation of two claim sets about architecture patterns and alignment gaps.
No code changes were made during this review.

Reviewed focus areas:
- Core runtime orchestration and lifecycle
- Host/DOM boundary and portability seams
- Integrator behavior and simulation invariants
- Force registration/contracts and diagnostics surfaces
- Eventing, caching, allocation behavior, and teardown paths
- Documentation-vs-code alignment for key API/physics claims

## High-confidence strengths
### 1) Strong renderer/environment seam (host abstraction)
Core runtime is intentionally host-driven and avoids direct DOM-global coupling:
- `packages/core/src/engine/host.ts`
- `packages/core/src/engine/field.ts`
- `packages/core/src/engine/dom-boundary.test.ts`

The boundary test enforces that core source does not introduce forbidden DOM-global call sites.

### 2) Clear force architecture and extensibility
Core, natural, and extended force families are registered in one place and routed through a shared integrator path:
- `packages/core/src/engine/field.ts`
- `packages/core/src/forces/index.ts`
- `packages/core/src/forces/natural.ts`
- `packages/core/src/forces/extended.ts`
- `packages/core/src/engine/integrator.ts`

This structure makes token expansion straightforward while preserving centralized simulation control.

### 3) Rich read/diagnostic substrate
The codebase exposes query/snapshot/replay/energy-style observability hooks with clear read pathways and policy-aware shaping:
- `packages/core/src/engine/field.ts`
- `packages/core/src/engine/field-snapshot.ts`
- `packages/core/src/engine/query-lens.ts`
- `packages/core/src/diagnostics/*`

### 4) Accessibility/interaction parity implemented in runtime behavior
`[data-hot]` engagement includes pointer and keyboard-path parity via `focusin`/`focusout` alongside pointer events:
- `packages/core/src/engine/field.ts`

## Primary risks and misalignments
### 1) Determinism seam inconsistency
Most paths support injected RNG, but at least one natural-force path still uses global randomness directly, reducing strict deterministic guarantees:
- `packages/core/src/forces/natural.ts` (thermal random draw path)
- `packages/core/src/conformance/run.ts` (global `Math.random` monkey-patch workaround)

Impact:
- Replay/conformance behavior can depend on global-patch strategy rather than pure injected RNG.

### 2) `core/field.ts` is very large and multi-responsibility
`field.ts` combines lifecycle orchestration, rendering modes, overlay rendering, event coalescing, host wiring, feedback writeback, movement systems, and API façade surface.
This increases change risk and regression surface concentration.

Key location:
- `packages/core/src/engine/field.ts`

### 3) Spatial hash rebuild allocates per new bin
`SpatialHash.insert` creates `this.bins.set(k, [item])`; since index rebuild occurs each tick, this introduces recurring allocation pressure:
- `packages/core/src/engine/spatial-hash.ts`
- `packages/core/src/engine/field-store.ts` (`reindex` each frame)

### 4) Documentation drift in integrator/physics vocabulary
Code and docs are not fully synchronized on integrator names and medium/drag model types:
- Code: `packages/core/src/engine/types.ts` (`'legacy' | 'fixed' | 'velocity-verlet'`)
- Canonical doc: `docs/canonical/substrate-api.md` (older integrator listing)
- Physics workover doc: `docs/engine-reference/physics-workover.md` (draft `legacy-euler`, `semi-implicit-euler-dt`, `MediumMode`, `DragMode`, `MediumConfig` not implemented as runtime types)

### 5) Fixed integrator semantics are explicitly limited
Current fixed mode dt-scales decays but not force impulses, by design and documented in code comments:
- `packages/core/src/engine/integrator.ts`

Impact:
- Some user expectations of full frame-rate-independent impulse behavior in fixed mode are not currently met.

### 6) Contract/passport drift risk
There are areas where force capability metadata and implementation behavior can drift if not audited together:
- `packages/core/src/contracts/passport.ts`
- `packages/core/src/forces/extended.ts`

### 7) Headless seam uses typed-cast workaround
Headless record flow includes a synthetic canvas cast pattern that works pragmatically but is brittle as an API expression:
- `packages/core/src/record/record.ts`

## Core code findings (explicit addendum)
This section isolates findings that come directly from `packages/core/src` implementation behavior (excluding package metadata/distribution concerns).

### Core strengths
1. Host boundary is strongly implemented and test-enforced.
   - `packages/core/src/engine/host.ts`
   - `packages/core/src/engine/dom-boundary.test.ts`
   - `packages/core/src/engine/field.ts`
2. Event model is structured and de-duplicated per frame.
   - `packages/core/src/engine/events.ts`
   - `packages/core/src/engine/field.ts` (coalescer usage and flush)
3. Teardown behavior is careful and broad.
   - `packages/core/src/engine/field.ts` (`destroy` path for listeners, docks, emitted clones, store clear)
4. Cadenced scheduling is consistently applied to expensive work.
   - `packages/core/src/engine/field.ts` (measure/regrid cadence)
   - `packages/core/src/engine/integrator.ts` (`frameN % 40` wander kick)

### Core concerns
1. `core/field.ts` is a monolithic hotspot.
   - High coupling of simulation loop, rendering modes, overlay drawing, event orchestration, host wiring, and API surface in one file.
2. Determinism seam is not fully uniform.
   - RNG injection is present in many paths, but some behavior still depends on global-random pathways.
3. Spatial hash allocation churn remains in hot path.
   - `this.bins.set(k, [item])` in `packages/core/src/engine/spatial-hash.ts` with per-frame `reindex` in `packages/core/src/engine/field-store.ts`.
4. Integrator semantics are nuanced and easy to mis-assume.
   - `packages/core/src/engine/integrator.ts` explicitly documents that fixed mode currently dt-scales decays but not all force impulses.
5. Docs/runtime drift around integrator vocabulary and medium models increases cognitive load.
   - Runtime contracts in `packages/core/src/engine/types.ts` and behavior in `packages/core/src/engine/integrator.ts` diverge from some in-repo docs.

### Suggested core refactors (ranked)
1. Split `core/field.ts` by responsibility (loop, render, overlays, event wiring, lifecycle).
2. Standardize RNG pathway so all stochastic behavior is driven by injected RNG.
3. Reduce spatial-hash rebuild allocations (bin reuse/pooling strategy).
4. Add targeted integrator conformance tests that pin fixed vs verlet caveats.
5. Add doc-truth CI checks specifically for integrator/mode/type contract drift.

### Evidence index (core concerns)
1. `core/field.ts` concentration / central orchestration surface
   - `packages/core/src/engine/field.ts:315` (`createField requires opts.host` path in central constructor)
   - `packages/core/src/engine/field.ts:2459` (main frame loop cadence + orchestration)
   - `packages/core/src/engine/field.ts:430` (event coalescer wiring in same module)
   - `packages/core/src/engine/field.ts:3323` (destroy/lifecycle cleanup in same module)
2. Determinism seam inconsistency
   - `packages/core/src/forces/natural.ts:217` (`Math.random` usage in thermal pathway)
   - `packages/core/src/conformance/run.ts:235` (global `Math.random` patching in conformance harness)
   - `packages/core/src/engine/determinism.test.ts:74` (determinism assertions context)
3. Spatial hash allocation churn
   - `packages/core/src/engine/spatial-hash.ts:40` (`this.bins.set(k, [item])`)
   - `packages/core/src/engine/field-store.ts:43` (`reindex()` per-frame rebuild entrypoint)
4. Integrator semantics (fixed mode caveat)
   - `packages/core/src/engine/integrator.ts:158` (explicit note: fixed mode does not dt-scale all force impulses)
   - `packages/core/src/engine/integrator.ts:581` (dt-scaled decays/wander handling context in runtime path)
   - `packages/core/src/engine/types.ts:447` (`IntegratorMode` runtime type contract)
5. Docs/runtime vocabulary drift evidence
   - Runtime: `packages/core/src/engine/types.ts:447`
   - Docs: `docs/canonical/substrate-api.md:374`
   - Docs draft terms: `docs/engine-reference/physics-workover.md:202`

## Claim-validation results (from follow-up analysis)
### Set A (patterns + alignment gaps)
- DOM isolation enforcement claim: Accurate
- Cadence scheduling claim: Accurate
- Allocation minimization claim: Partially accurate (true in hot-loop scratch reuse, not universal)
- WeakMap caching claim: Partially accurate (present, but not all keys are DOM elements)
- Conserved particle quantities claim: Partially accurate (true for sink release semantics, not global due to sources/mortal aging)
- Integrator-mode docs drift claim: Accurate
- Unimplemented medium/drag model claim: Accurate
- Fixed-mode impulse scaling caveat claim: Accurate
- Lane separation (`absorb` in event bus) claim: Partially accurate (event naming lane, not force-token lane)
- Spatial-hash churn claim: Accurate

### Set B (“patterns we follow / break”)
- Inversion of control (DOM boundary): Partially accurate
  - Core is host-injected and DOM-agnostic.
  - Correction: core `createField` now requires `opts.host`; auto-host wiring occurs in vanilla wrappers.
- Cadenced execution: Accurate
- WeakMap caching for leaf elements: Partially accurate
- Keyboard/input parity: Accurate
- Safe teardown claim: Partially accurate
  - Teardown is robust for listeners, docks, and emitted clones.
  - It is not a blanket “clear every runtime style write on every body” guarantee.
- Reported breakages:
  - Spatial partition GC churn: Accurate
  - Naming lane discipline (`absorb` event type framing): Partially accurate
  - Docs-vs-feature drift: Accurate

## Prioritized recommendations
### Priority 1 (correctness + trust)
1. Unify RNG determinism end-to-end by removing remaining direct `Math.random` usage in force paths.
2. Reconcile integrator and medium model docs to shipped runtime truth (or ship the documented types if intended).
3. Add focused conformance tests for fixed/velocity-verlet expectations and documented caveats.

### Priority 2 (maintainability)
1. Split `core/field.ts` into narrower modules (runtime loop, overlay renderers, engagement/event wiring, teardown, API assembly).
2. Add targeted contract tests to keep passport metadata aligned with force implementations.

### Priority 3 (performance + ergonomics)
1. Reduce spatial-hash rebuild allocation churn (bin pooling/reuse or alternative structure).
2. Revisit headless record seam to avoid typed-canvas casting where possible.

## Overall assessment
The core architecture is strong at seams, extensibility, and runtime observability, with thoughtful attention to host abstraction and interaction parity.
Main concerns are concentrated in maintainability hotspots (`field.ts` size), determinism consistency, and documentation/runtime drift in advanced physics/integrator concepts.

## packages/dom review (added)
### Scope
Static review + deeper follow-up of `packages/dom/src`, including host adapters, platform registries/scheduler, lint/perf subsystems, recipe application path, and worker bridge.

### High-confidence strengths
1. Strong architectural separation from core (platform/DOM concerns stay in `@fundamental-engine/dom`).
   - `packages/dom/src/index.ts`
   - `packages/dom/src/platform.ts`
2. Clear frame-phase discipline with explicit read/write boundaries.
   - `packages/dom/src/schedule.ts`
   - `packages/dom/src/measurement.ts` (phase guard hook)
3. Registry lifecycle hygiene is actively designed (prune/unregister paths, cadence sweep).
   - `packages/dom/src/state.ts`
   - `packages/dom/src/feedback.ts`
   - `packages/dom/src/relationships.ts`
   - `packages/dom/src/overlays.ts`
   - `packages/dom/src/platform.ts`
4. Lint and perf tooling are substantive, not superficial.
   - `packages/dom/src/lint.ts`
   - `packages/dom/src/perf.ts`
5. Test suite depth is strong in core DOM-platform mechanics.
   - Full run: 159 tests passed, 0 failed (`cd packages/dom && node --test`).

### Deeper-pass concerns
1. Worker bridge pathing is build-sensitive.
   - `packages/dom/src/worker/offthread-bridge.ts` creates worker via `new URL('./render-worker.js', import.meta.url)`.
   - Source file is `render-worker.ts`; this is likely correct post-build but can be fragile across source-run/test/bundler contexts.
2. Offthread frame payload currently allocates per tick.
   - `packages/dom/src/worker/offthread-bridge.ts` posts `buf.slice(...)` each frame.
   - Existing `pending` guard helps, but this still introduces recurring allocation pressure in high-throughput cases.
3. `x-ray` uses weakly typed optional capability access.
   - `packages/dom/src/x-ray.ts` accesses `(field as any).sample` and `(field as any).energy`.
   - Functional, but reduces contract clarity and type safety.
4. `applyRecipe` has grown into a broad orchestration module.
   - Validation, compile, annotation, metric compute/state updates, reduced-motion rendering, field-driving, inspect and teardown are co-located.
   - `packages/dom/src/apply-recipe.ts`
5. Test coverage appears lighter for some adapter/runtime edges than for core registries.
   - No direct `browser-host` or `x-ray` test files were found in `packages/dom/src` (file-name scan).

### Evidence index (packages/dom)
1. Scheduler/read-write spine + phase guard
   - `packages/dom/src/schedule.ts:24`
   - `packages/dom/src/measurement.ts:62`
   - `packages/dom/src/platform.ts:55`
2. Lifecycle prune cadence
   - `packages/dom/src/platform.ts:69`
3. Worker bridge sensitivity and allocation behavior
   - `packages/dom/src/worker/offthread-bridge.ts:33` (worker URL to `render-worker.js`)
   - `packages/dom/src/worker/offthread-bridge.ts:57` (per-frame `buf.slice(...)`)
4. Weakly typed `x-ray` capability probes
   - `packages/dom/src/x-ray.ts:32`
   - `packages/dom/src/x-ray.ts:33`
5. `applyRecipe` orchestration concentration
   - `packages/dom/src/apply-recipe.ts:118`
   - `packages/dom/src/apply-recipe.ts:196`
   - `packages/dom/src/apply-recipe.ts:331`

### Suggested follow-ups (packages/dom)
1. Harden offthread worker URL strategy for source/build parity and toolchain portability.
2. Reduce per-frame worker payload allocation (transferable/ring-buffer approach).
3. Replace `x-ray` `any` probes with explicit optional-capability type guards.
4. Split `applyRecipe` into narrower modules (metrics pipeline, reduced-motion surface, field-drive, lifecycle).
5. Add focused tests for `browser-host` listener lifecycle and `x-ray` mount/teardown behavior.

## packages/elements review (added)
### Scope
Static review of `packages/elements/src` plus test/contract coverage inspection for `<field-root>`, platform-runtime integration, SSR pre-registration queue, and `<field-cell>` local demo runtime.

### High-confidence strengths
1. `<field-root>` has a broad, well-forwarded handle surface with explicit reflection/round-trip protections.
   - Option forwarding is centralized in one declarative table and pinned by drift-guard tests.
   - Imperative setters reflect to attributes with a reflection guard to avoid double-apply loops.
2. SSR/hydration ordering is handled explicitly via pre-registration buffering and replay.
   - Early body register/unregister events are captured before field listeners are live, then replayed after startup.
3. Platform-runtime path is structured and test-backed, not ad hoc.
   - Measurement sync, shadow body registration, feedback routing, and relationship discovery cadence are all isolated as pure helpers with focused tests.
4. Lifecycle hygiene is strong.
   - `disconnectedCallback` tears down observers, field handle, overlay surface, and runtime in one path.
   - Overlay canvas creation is lazy/idempotent and removed at teardown.
5. Coverage on critical integration contracts is strong.
   - Test suite includes surface forwarding, lifecycle teardown, option/observed-attr drift guards, platform-runtime branch behavior, feedback channel mapping, shadow registration, relationship cadence, and SSR queue semantics.
   - Package test run result: 77 passed, 0 failed.

### Deeper-pass concerns
1. `src/index.ts` is becoming a concentration point.
   - It owns attributes parsing, runtime branching, lifecycle, proxy API, reflection mechanics, overlay-surface management, and custom-element registration in one file.
2. Platform runtime is default-on while legacy engine remains active, increasing moving parts and potential coordination overhead.
   - Runtime starts alongside legacy field, runs its own scheduler/governor loop, and wires document-level shadow registration listeners.
3. Pre-registration queue correctness depends on module-global state and boot/teardown ordering.
   - The design is deliberate and tested, but global counters/flags (`activeFields`, `installed`) increase coupling risk if future lifecycle paths diverge.
4. `<field-cell>` intentionally diverges from core simulation guarantees.
   - It is a separate lightweight poster engine with local `Math.random` pool init and simplified force model; useful by design, but behavior is not comparable to core deterministic/replay expectations.

### Evidence index (packages/elements)
1. Centralized options + observed-attr drift control
   - `packages/elements/src/index.ts:73`
   - `packages/elements/src/index.ts:115`
   - `packages/elements/src/option-attrs.test.ts:15`
   - `packages/elements/src/option-attrs.test.ts:40`
2. Reflection guard + live attribute/imperative parity
   - `packages/elements/src/index.ts:337`
   - `packages/elements/src/index.ts:426`
   - `packages/elements/src/field-root-surface.test.ts:44`
   - `packages/elements/src/field-root-surface.test.ts:87`
3. Lifecycle teardown completeness
   - `packages/elements/src/index.ts:575`
   - `packages/elements/src/lifecycle.test.ts:27`
4. Lazy overlay surface lifecycle
   - `packages/elements/src/index.ts:637`
   - `packages/elements/src/index.ts:668`
   - `packages/elements/src/field-root-surface.test.ts:163`
5. Platform-runtime default path + runtime responsibilities
   - `packages/elements/src/platform-runtime.ts:83`
   - `packages/elements/src/platform-runtime.ts:113`
   - `packages/elements/src/platform-runtime.ts:180`
   - `packages/elements/src/platform-runtime.feedback.test.ts:36`
6. Relationship cadence and shadow registration helpers
   - `packages/elements/src/platform-runtime.ts:62`
   - `packages/elements/src/platform-runtime.ts:121`
   - `packages/elements/src/platform-runtime.shadow.test.ts:25`
   - `packages/elements/src/platform-runtime.relationships.test.ts:10`
7. SSR pre-registration queue global-state design
   - `packages/elements/src/preregistration-queue.ts:77`
   - `packages/elements/src/preregistration-queue.ts:89`
   - `packages/elements/src/preregistration-queue.ts:107`
   - `packages/elements/src/preregistration-queue.test.ts:81`
8. `<field-cell>` independent demo runtime and simplified force model
   - `packages/elements/src/field-cell.ts:43`
   - `packages/elements/src/field-cell.ts:244`
   - `packages/elements/src/cell-force.ts:1`
   - `packages/elements/src/field-cell-budget.test.ts:60`

### Suggested follow-ups (packages/elements)
1. Split `src/index.ts` into narrower modules (attribute parsing/options, lifecycle/runtime boot, handle proxy surface, overlay surface utilities).
2. Add an integration test that exercises `start()` rebuild paths across multiple construction-time attribute changes to detect lifecycle/order regressions early.
3. Add explicit multi-instance tests for pre-registration queue + active field counting to lock down behavior when multiple `<field-root>` instances connect/disconnect in varying orders.
4. Define and document a clear boundary statement for `<field-cell>` vs core runtime guarantees (determinism/replay/physics parity) to avoid assumption drift.

## packages/vanilla review (added)
### Scope
Static review of `packages/vanilla` runtime/mount surfaces, host-resolution behavior, headless path, substrate API delegation, and packaging/build distribution seams.

### High-confidence strengths
1. Clean framework-free boundary with no side effects.
   - Package exports field/mount/create APIs without custom-element registration and marks `sideEffects: false`.
2. Host resolution is explicit and pragmatic.
   - `createField` resolves `host` in clear priority (`opts.host` → `bounds`/contained host → browser host), preserving a one-call API while enabling custom/contained modes.
3. `FieldField` strongly mirrors `FieldHandle`.
   - The class delegates a broad surface (query/snapshot/diff/replay/projections/policy/agents/bodies/edges/channels) while cleanly handling managed-vs-owned canvas lifecycle.
4. Browser/SSR guardrails are explicit.
   - `assertBrowser()` provides early failure with actionable messaging instead of cryptic server crashes.
5. Headless and substrate contracts are exercised directly in tests.
   - Coverage includes DOM-managed mount, signals-only mode, explicit host override, headless host ticking, substrate API delegation, projection registry operations, and version export consistency.
   - Package test run result: 53 passed, 0 failed.
6. Distribution ergonomics are strong for non-bundler consumers.
   - Standalone script emits bundled ESM and global IIFE artifacts for drop-in usage.

### Deeper-pass concerns
1. Delegation boilerplate is large and maintenance-sensitive.
   - `FieldField` manually forwards many methods; contract evolution can create drift risk if new `FieldHandle` members are added without synchronized forwarding/tests.
2. Test suite is primarily API-shape/does-not-throw oriented.
   - Good for surface stability, but lighter on behavior-level assertions for nuanced runtime outcomes in vanilla-specific flows.
3. `assertBrowser` is only used by managed mount/class paths.
   - Lower-level `createField` remains intentionally permissive for headless/custom hosts, but this split can be misunderstood by consumers expecting uniform browser-only behavior.

### Evidence index (packages/vanilla)
1. Side-effect-free package boundary and exports
   - `packages/vanilla/package.json:27`
   - `packages/vanilla/src/index.ts:13`
2. Host resolution priority (`host` → `bounds` → browser)
   - `packages/vanilla/src/create-field.ts:33`
   - `packages/vanilla/src/create-field.ts:35`
3. Class-level delegation and managed-canvas lifecycle
   - `packages/vanilla/src/field.ts:43`
   - `packages/vanilla/src/field.ts:49`
   - `packages/vanilla/src/field.ts:50`
   - `packages/vanilla/src/field.ts:250`
4. Browser guard and imperative mount lifecycle
   - `packages/vanilla/src/mount.ts:26`
   - `packages/vanilla/src/mount.ts:63`
   - `packages/vanilla/src/mount.ts:68`
5. Headless/non-visual support path
   - `packages/vanilla/src/headless.test.ts:9`
   - `packages/vanilla/src/headless.test.ts:45`
6. Substrate API delegation coverage
   - `packages/vanilla/src/substrate-api.test.ts:98`
   - `packages/vanilla/src/substrate-api.test.ts:156`
   - `packages/vanilla/src/substrate-api.test.ts:197`
   - `packages/vanilla/src/substrate-api.test.ts:266`
7. Standalone build distribution outputs
   - `packages/vanilla/scripts/build-standalone.mjs:43`
   - `packages/vanilla/scripts/build-standalone.mjs:63`

### Suggested follow-ups (packages/vanilla)
1. Add a focused contract-sync test that compares `FieldField` method surface against `FieldHandle` keys to catch delegation drift automatically.
2. Expand behavior-level tests for vanilla-specific contained mode (`bounds`) and managed canvas positioning/cleanup interactions.
3. Document the browser-vs-headless split more prominently in `README.md` with explicit decision guidance (`FieldField`/`mountField` vs `createField` with custom/headless host).

## packages/create notes (added)
### Scope
Quick structural review of `packages/create` as the scaffolding CLI package.

### Current state
1. It is correctly wired as a CLI package.
   - `bin` points to `dist/index.js`.
   - Entry has a Node shebang and handles args + interactive prompts.
2. Template system and scaffold flow are present and coherent for vanilla/react/web-component starters.

### Suggested hardening follow-ups
1. Add CLI smoke coverage for non-interactive invocation paths (`dir`, `--template`) to reduce release risk.
2. Add explicit `--help`/`--version` handling for standard CLI UX consistency.
3. Expand scaffold edge-case tests for existing non-empty targets and error surfacing paths.

### Evidence index (packages/create)
1. CLI wiring and executable entry
   - `packages/create/package.json:19`
   - `packages/create/src/index.ts:1`
2. Argument parsing and interactive prompt flow
   - `packages/create/src/index.ts:10`
   - `packages/create/src/index.ts:22`

## llms-full content vs code alignment (first pass)
### Scope
Focused audit of high-impact claims in `apps/site/public/llms-full.txt` against current runtime code in `packages/core`, `packages/vanilla`, `packages/elements`, and `packages/create`.
This pass targets concrete executable claims from sampled sections (including `docs/canonical/common-mistakes.md` content embedded in `llms-full.txt`).

### Verdict summary
1. **Accurate** — Core `createField` requires an explicit host.
2. **Accurate** — Vanilla `createField` auto-resolves host (`host` → `bounds`/contained → browser).
3. **Accurate** — Default render mode is signals-first (`'none'`).
4. **Accurate** — Contained mode is a vanilla `bounds` path; `<field-root>` remains the singleton window-style element surface.
5. **Accurate** — Recipe catalog claims (64 recipes, 4 tiers, first-release set of 8) match code/tests.
6. **Mismatch** — `common-mistakes` currently says event bus is `field.on('absorb' | 'release' | 'settle', …)`; runtime event bus does **not** expose `settle`.
7. **Partially accurate phrasing** — “core and vanilla are the same `createField` function” is conceptually close but implementation-wise vanilla uses a wrapper that calls core with resolved host.

### Evidence index (alignment checks)
1. Core host requirement
   - `packages/core/src/engine/field.ts:323`
2. Vanilla host resolution wrapper
   - `packages/vanilla/src/create-field.ts:33`
   - `packages/vanilla/src/create-field.ts:35`
3. Signals-first render default
   - `packages/core/src/engine/field.ts:363`
4. `<field-root>` implementation + contained mode reference surface
   - `packages/elements/src/index.ts:729`
   - `packages/vanilla/src/create-field.ts:30`
5. Recipe catalog counts/tiers
   - `packages/core/src/recipes/recipes.test.ts:41`
   - `packages/core/src/recipes/recipes.test.ts:49`
   - `packages/core/src/recipes/catalog.ts:1518`
   - `packages/core/src/recipes/catalog.ts:1527`
6. Runtime event bus shape (no `settle`)
   - `packages/core/src/engine/events.ts:17`
   - `packages/core/src/engine/events.ts:21`
   - `packages/core/src/engine/events.ts:26`
   - `packages/core/src/engine/types.ts:1615`
7. Contradicting doc line in llms-full sample
   - `apps/site/public/llms-full.txt:1510`

### Recommended doc fixes in llms source set
1. Update the `common-mistakes` event-bus example to remove `settle` (or relabel it as planned/reserved if intentionally documented ahead of runtime).
2. Tighten wording around vanilla/core `createField` to “same door semantics, different exported function (vanilla wrapper over core primitive)” for implementation precision.
3. Run a targeted “docs-claim conformance” check over canonical docs for API symbol examples (`field.on(...)`, event names, option defaults) to catch executable-surface drift earlier.

## llms-full content vs code alignment (exhaustive pass addendum)
### Scope
Second pass focused on drift-prone executable claims in `apps/site/public/llms-full.txt`, prioritizing defaults, event alias behavior, and migration-compatibility statements that can be validated directly in runtime code.

### Additional verified findings
1. **Mismatch** — `llms-full` states “`waves` defaults off,” but current runtime default is `true`.
2. **Mismatch / internal doc contradiction** — multiple `llms-full` sections claim `field:*` → `forces:*` event aliases “still fire,” but runtime dispatch paths examined emit canonical `field:*` only, and no concrete `forces:*` event names are present in core/dom TS runtime code.
3. **Mismatch / internal doc contradiction** — one migration checklist section says CSS write-back emits both old and new names, while multiple other sections (and runtime code) state legacy `--forces-*` CSS variables are removed.
4. **Accurate** — `createField(canvas, opts)` requires `opts.host`.
5. **Accurate** — canonical runtime write-back still includes `--d` + `--field-density` and thresholded `field:lit`/`field:dim`.

### Evidence index (exhaustive addendum)
1. `waves` default mismatch
   - Claim: `apps/site/public/llms-full.txt:11556` (“`waves` defaults off”)
   - Runtime: `packages/core/src/engine/field.ts:376` (`waves: opts.waves ?? true`)
2. `forces:*` event-alias claim drift
   - Claims: `apps/site/public/llms-full.txt:6723`, `apps/site/public/llms-full.txt:7968`, `apps/site/public/llms-full.txt:8388`, `apps/site/public/llms-full.txt:8484`, `apps/site/public/llms-full.txt:8840`
   - Runtime dispatch examined: `packages/core/src/engine/feedback-sink.ts:62`, `packages/core/src/engine/feedback-sink.ts:65`, `packages/core/src/engine/field.ts:1041`, `packages/core/src/engine/field.ts:1060`, `packages/elements/src/platform-runtime.ts:160`
   - Repository-wide exact-name check over package TS sources found no concrete `forces:lit|dim|captured|released|relocated|register-body|unregister-body|update-body` event strings.
3. CSS migration contradiction
   - Contradicting claim: `apps/site/public/llms-full.txt:8928` (“CSS variables write both old and new names”)
   - Counterclaims in same corpus: `apps/site/public/llms-full.txt:7988`, `apps/site/public/llms-full.txt:8480`
   - Runtime write paths: `packages/core/src/engine/feedback-sink.ts:45` (writes `--d`, `--field-density`, `--field-heatmap-density`, `--load`, `--lit`, bare thermodynamics), `packages/elements/src/platform-runtime.ts:139`
4. Host requirement remains accurate
   - Claim: `apps/site/public/llms-full.txt:6688`
   - Runtime: `packages/core/src/engine/field.ts:323`

### Prioritized remediation for llms source set
1. Correct the `waves` default statement to match current runtime (`true`) or explicitly annotate version/branch context if documenting historical behavior.
2. Resolve the `forces:*` alias inconsistency by either:
   - updating docs to canonical `field:*`-only dispatch language, or
   - restoring explicit alias emission in runtime and adding regression tests.
3. Remove or version-gate any “write both old and new CSS names” statements; they conflict with current canonical “`--forces-*` removed” messaging and runtime behavior.
4. Add a docs conformance check that validates default values and concrete event-name literals against code for `field.ts`, `feedback-sink.ts`, and platform feedback wiring.

## End-to-end comprehensive non-generated code review (full-repo addendum)
### Scope
Comprehensive static review across tracked, non-built/non-generated code files, split by directory for full coverage (`android/**`, `apps/**`, `examples/**`, `packages/**`, `scripts/**`, `swift/**`, `Package.swift`), explicitly excluding generated/build output directories and generated site artifacts.

### Coverage summary
1. `packages/core` + `packages/dom`: 288 files / 40,319 lines reviewed.
2. `packages/elements` + `packages/react`: 28 tracked code/config files reviewed (after excluding non-code tracked artifacts in scope).
3. `packages/three` + `packages/vanilla` + `packages/create`: 63 files reviewed.
4. `android/**`: 104 files / 13,231 lines reviewed.
5. `swift/**` + `Package.swift`: 87 non-generated files / 17,145 lines reviewed (explicit generated-file exclusion applied).
6. `apps/**` + `examples/**` + `scripts/**`: 307 files / 70,579 lines reviewed (non-generated codefiles only).

### Consolidated findings
#### Medium
1. Determinism drift risk in thermal force path:
   - `packages/core/src/forces/natural.ts:217`
   - `packages/core/src/forces/natural.ts:219`
   - `packages/core/src/forces/natural.ts:224`
   - `packages/core/src/forces/natural.ts:225`
   - Uses direct `Math.random()` in `thermal.apply`, bypassing injected RNG seam intended for reproducibility.
2. `x-ray` overlay HTML injection surface:
   - `packages/dom/src/x-ray.ts:34`
   - `packages/dom/src/x-ray.ts:40`
   - Unescaped interpolation into `innerHTML` can inject markup if `hotkey` is untrusted.
3. React hook lifecycle gap (`useForcesData`):
   - `packages/react/src/index.tsx:198`
   - `packages/react/src/index.tsx:199`
   - `packages/react/src/index.tsx:207`
   - If `containerRef.current` is null on first effect pass, binding init is skipped and never retried.
4. Android compose coordinate-space mismatch risk:
   - `android/fundamental-compose/src/main/kotlin/com/fundamental/compose/FieldView.kt:236`
   - `android/fundamental-compose/src/main/kotlin/com/fundamental/compose/FieldView.kt:253`
   - Comment says on-screen bounds, implementation uses `positionInParent()` which can drift in nested/scrolling contexts.
5. Swift strict-mode behavior mismatch:
   - `swift/Sources/FundamentalPlatform/FrameScheduler.swift:64`
   - `swift/Sources/FundamentalPlatform/FrameScheduler.swift:105`
   - Comment says strict mode “throws,” implementation hard-crashes with `fatalError`.
6. E2E harness inconsistency for offline determinism:
   - `apps/site/e2e/README.md:26`
   - `apps/site/e2e/recipes-explore.spec.ts:1`
   - `recipes-explore.spec.ts` imports Playwright directly instead of shared fixtures, bypassing documented network-block harness.

#### Low
1. Non-deterministic scaffold dependency pinning:
   - `packages/create/templates/react/package.json:12`
   - `packages/create/templates/web-component/package.json:12`
   - Template dependencies use `"latest"` rather than a bounded version/range.
2. Elements reverse drift guard is incomplete:
   - `packages/elements/src/option-attrs.test.ts:29`
   - `packages/elements/src/index.ts:102`
   - `packages/elements/src/index.ts:110`
   - Guarded key list omits additional forwarded options (e.g., `gridWarp`, `gridIntensity`, `theme`, `gradient*`, `waveBaseline`, `separation`).
3. Elements/runtime document scoping portability issue:
   - `packages/elements/src/platform-runtime.ts:225`
   - `packages/elements/src/platform-runtime.ts:266`
   - Visibility listener binds to global `document` instead of already-resolved owner document.
4. `x-ray` portability/type-safety debt:
   - `packages/dom/src/x-ray.ts:32`
   - `packages/dom/src/x-ray.ts:33`
   - `packages/dom/src/x-ray.ts:48`
   - `packages/dom/src/x-ray.ts:51`
   - Uses `any` casts for optional APIs and global document/body rather than container document.
5. Swift snapshot write result is ignored:
   - `swift/Sources/FieldLabKit/Snapshotter.swift:87`
   - `CGImageDestinationFinalize` return value is not checked.
6. Android platform TODO indicates contract drift risk:
   - `android/fundamental-platform/src/main/kotlin/com/fundamental/platform/MeasurementRegistry.kt:91`
   - `android/fundamental-platform/src/main/kotlin/com/fundamental/platform/MeasurementRegistry.kt:92`
   - `android/fundamental-android/src/main/kotlin/com/fundamental/android/AndroidFieldHost.kt:252`
   - Registry currently passes `Body` where Android host expects `View`.
7. Example/docs consistency drift (Next.js SSR guidance):
   - `examples/nextjs/app/components/FieldCanvas.tsx:9`
   - `examples/nextjs/app/page.tsx:3`
   - `examples/nextjs/package.json:5`
   - Mixed guidance around `dynamic(..., { ssr:false })`.

### No-high-severity defects found
Across reviewed scopes, no immediate high-severity crash/data-loss/security findings were identified beyond the medium-level issues listed.

### Prioritized follow-ups
1. Fix determinism seam (`thermal`) to use injected RNG path, then add deterministic regression coverage.
2. Replace `x-ray` `innerHTML` path with safe text-node rendering and container/owner-document-safe mounting.
3. Harden React/elements lifecycle behavior around late-mounted containers and owner-document visibility wiring.
4. Tighten drift guards (option-forwarding completeness; docs-vs-runtime checks for examples/templates).
5. Normalize scaffolding/versioning strategy to avoid `latest` template drift.
