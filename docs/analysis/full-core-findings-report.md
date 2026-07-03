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
- `packages/core/src/core/host.ts`
- `packages/core/src/core/field.ts`
- `packages/core/src/core/dom-boundary.test.ts`

The boundary test enforces that core source does not introduce forbidden DOM-global call sites.

### 2) Clear force architecture and extensibility
Core, natural, and extended force families are registered in one place and routed through a shared integrator path:
- `packages/core/src/core/field.ts`
- `packages/core/src/forces/index.ts`
- `packages/core/src/forces/natural.ts`
- `packages/core/src/forces/extended.ts`
- `packages/core/src/core/integrator.ts`

This structure makes token expansion straightforward while preserving centralized simulation control.

### 3) Rich read/diagnostic substrate
The codebase exposes query/snapshot/replay/energy-style observability hooks with clear read pathways and policy-aware shaping:
- `packages/core/src/core/field.ts`
- `packages/core/src/core/field-snapshot.ts`
- `packages/core/src/core/query-lens.ts`
- `packages/core/src/diagnostics/*`

### 4) Accessibility/interaction parity implemented in runtime behavior
`[data-hot]` engagement includes pointer and keyboard-path parity via `focusin`/`focusout` alongside pointer events:
- `packages/core/src/core/field.ts`

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
- `packages/core/src/core/field.ts`

### 3) Spatial hash rebuild allocates per new bin
`SpatialHash.insert` creates `this.bins.set(k, [item])`; since index rebuild occurs each tick, this introduces recurring allocation pressure:
- `packages/core/src/core/spatial-hash.ts`
- `packages/core/src/core/field-store.ts` (`reindex` each frame)

### 4) Documentation drift in integrator/physics vocabulary
Code and docs are not fully synchronized on integrator names and medium/drag model types:
- Code: `packages/core/src/core/types.ts` (`'legacy' | 'fixed' | 'velocity-verlet'`)
- Canonical doc: `docs/canonical/substrate-api.md` (older integrator listing)
- Physics workover doc: `docs/engine-reference/physics-workover.md` (draft `legacy-euler`, `semi-implicit-euler-dt`, `MediumMode`, `DragMode`, `MediumConfig` not implemented as runtime types)

### 5) Fixed integrator semantics are explicitly limited
Current fixed mode dt-scales decays but not force impulses, by design and documented in code comments:
- `packages/core/src/core/integrator.ts`

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
   - `packages/core/src/core/host.ts`
   - `packages/core/src/core/dom-boundary.test.ts`
   - `packages/core/src/core/field.ts`
2. Event model is structured and de-duplicated per frame.
   - `packages/core/src/core/events.ts`
   - `packages/core/src/core/field.ts` (coalescer usage and flush)
3. Teardown behavior is careful and broad.
   - `packages/core/src/core/field.ts` (`destroy` path for listeners, docks, emitted clones, store clear)
4. Cadenced scheduling is consistently applied to expensive work.
   - `packages/core/src/core/field.ts` (measure/regrid cadence)
   - `packages/core/src/core/integrator.ts` (`frameN % 40` wander kick)

### Core concerns
1. `core/field.ts` is a monolithic hotspot.
   - High coupling of simulation loop, rendering modes, overlay drawing, event orchestration, host wiring, and API surface in one file.
2. Determinism seam is not fully uniform.
   - RNG injection is present in many paths, but some behavior still depends on global-random pathways.
3. Spatial hash allocation churn remains in hot path.
   - `this.bins.set(k, [item])` in `packages/core/src/core/spatial-hash.ts` with per-frame `reindex` in `packages/core/src/core/field-store.ts`.
4. Integrator semantics are nuanced and easy to mis-assume.
   - `packages/core/src/core/integrator.ts` explicitly documents that fixed mode currently dt-scales decays but not all force impulses.
5. Docs/runtime drift around integrator vocabulary and medium models increases cognitive load.
   - Runtime contracts in `packages/core/src/core/types.ts` and behavior in `packages/core/src/core/integrator.ts` diverge from some in-repo docs.

### Suggested core refactors (ranked)
1. Split `core/field.ts` by responsibility (loop, render, overlays, event wiring, lifecycle).
2. Standardize RNG pathway so all stochastic behavior is driven by injected RNG.
3. Reduce spatial-hash rebuild allocations (bin reuse/pooling strategy).
4. Add targeted integrator conformance tests that pin fixed vs verlet caveats.
5. Add doc-truth CI checks specifically for integrator/mode/type contract drift.

### Evidence index (core concerns)
1. `core/field.ts` concentration / central orchestration surface
   - `packages/core/src/core/field.ts:315` (`createField requires opts.host` path in central constructor)
   - `packages/core/src/core/field.ts:2459` (main frame loop cadence + orchestration)
   - `packages/core/src/core/field.ts:430` (event coalescer wiring in same module)
   - `packages/core/src/core/field.ts:3323` (destroy/lifecycle cleanup in same module)
2. Determinism seam inconsistency
   - `packages/core/src/forces/natural.ts:217` (`Math.random` usage in thermal pathway)
   - `packages/core/src/conformance/run.ts:235` (global `Math.random` patching in conformance harness)
   - `packages/core/src/core/determinism.test.ts:74` (determinism assertions context)
3. Spatial hash allocation churn
   - `packages/core/src/core/spatial-hash.ts:40` (`this.bins.set(k, [item])`)
   - `packages/core/src/core/field-store.ts:43` (`reindex()` per-frame rebuild entrypoint)
4. Integrator semantics (fixed mode caveat)
   - `packages/core/src/core/integrator.ts:158` (explicit note: fixed mode does not dt-scale all force impulses)
   - `packages/core/src/core/integrator.ts:581` (dt-scaled decays/wander handling context in runtime path)
   - `packages/core/src/core/types.ts:447` (`IntegratorMode` runtime type contract)
5. Docs/runtime vocabulary drift evidence
   - Runtime: `packages/core/src/core/types.ts:447`
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
