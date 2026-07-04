> **Status: canonical.**
> The test matrix, conformance gates, force passports, and platform/scheduler/lint coverage. Current as of the platform-runtime phase (Phase D). See [platform-architecture.md](platform-architecture.md) and [system-contracts.md](system-contracts.md).

# Fundamental Testing and Conformance

## Related Documents

| Document | Role |
|---|---|
| [`README.md`](./README.md) | Documentation map |
| [`system-contracts.md`](system-contracts.md) | Contract requirements |
| [`fundamental-field-behavior-table.md`](fundamental-field-behavior-table.md) | Force law requirements |
| [`visualization-methods-taxonomy.md`](visualization-methods-taxonomy.md) | Visualization tests |
| [`authoring-and-recipes.md`](authoring-and-recipes.md) | Recipe tests |

## Purpose

Conformance makes the system credible.

Every force, field, visualization, source, sink, event, recipe, and agent behavior should declare what proves it works.

Core principle:

```txt
If it affects behavior, it needs conformance.
If it explains behavior, it needs truth-table classification.
```

## 1. Test Categories

```txt
force math tests
field geometry tests
field/apply separation tests
visualization side-effect tests
agent response tests
event threshold tests
accessibility tests
performance budget tests
snapshot regression tests
recipe conformance tests
Shadow DOM registration tests
reduced-motion tests
platform registry tests
scheduler phase-ordering tests
platform lint tests
diagnostic render-mode tests
DOM-boundary (renderer-agnostic core) tests
```

## 2. Force Passport Requirement

> **Implemented.** `ForcePassport` (`packages/core/src/contracts/passport.ts`) carries all of these
> fields — including `bestRenderModes` and `commonComposites` — and `conformanceTests(token)` derives
> the proof list from the live conformance catalog so it never drifts. `validatePassports()`
> cross-checks `family` / `klass` / `ownsField` against the registry + conformance.

Every force needs:

```txt
Token:
Category:
Truth mode:
Owns field():
Uses env.fieldAt():
Moves particles:
Does work:
Conserves speed:
Requires charge:
Requires velocity:
Affects neutral matter:
Can be visualized as field lines:
Can be visualized as force vectors:
Best render modes:
Conformance tests:
Common composites:
Design use:
Physics note:
```

## 3. Required Magnetism Tests

```txt
neutral particle ignored
still charged particle unchanged
moving charged particle curves
force perpendicular to velocity
speed preserved before damping
charge reversal flips curvature
spin reversal flips curvature
no effect beyond range
magnetism does no work in ideal mode
```

Rule:

```txt
magnetism.apply() must remain Lorentz behavior.
```

## 4. Required Fieldflow Tests

> **Implemented.** `packages/core/src/forces/fieldflow.test.ts` covers does-work, moves-neutral-
> matter, zero-field→no-motion, range-0-global, beyond-range-inert, and the speed-of-light cap; the
> scenario catalog adds "neutral matter follows a charge field line".

```txt
neutral matter moves
fieldflow does work
zero field produces no motion
charge field routes matter radially
magnetic field routes matter along loops
beyond range produces no effect
range 0 uses global field
net field superposition routes between bodies
```

Rule:

```txt
fieldflow carries matter along field geometry.
```

## 5. Field vs Apply Separation Tests

```txt
field lines trace field(), not apply()
force vectors reflect apply(), not field()
magnetism field lines differ from particle paths
fieldflow particle paths align with field lines
visualization does not alter physics
```

## 6. Visualization Tests

```txt
field line trace terminates correctly
streamlines respect vector field
force vectors use probes for velocity-dependent forces
heatmaps decay correctly
contours match scalar field levels
energy view does not mutate physics
debug overlays do not affect integration
prediction mode does not mutate live state
causality overlay matches force contribution
```

### Diagnostic render-mode coverage

All render modes ship and are exercised at `/docs/diagnostics`: dots, trails, links,
streamlines, metaballs, voronoi, field-lines, heatmap, force-vectors, contours, potential, energy,
topology, inspector, causality, and prediction. Canvas is one render surface among these; the field
runtime can drive any of them from the same shared field context. Each mode needs:

```txt
mode renders without throwing across the diagnostics gallery
mode reads field state but does not mutate physics
prediction / causality / inspector remain read-only over live state
mode degrades to a static or meaning-preserving form under reduced motion
mode respects its resolution / capping budget
```

## 7. Agent Tests

### ElementAgent

```txt
receives density
receives attention
writes CSS variables
dispatches thresholded events
does not directly mutate particles unless also body
respects reduced motion
```

### RelationshipAgent

```txt
stores from/to bodies
renders relationship
transfers attention if configured
strengthens with use
decays over time
emits thresholded events
```

### UserAgent

```txt
pointer creates wake
focus creates accessible attention source
selection creates capture state
scroll creates current
reduced motion disables travel-heavy response
```

## 8. Event Tests

```txt
events are thresholded
events are debounced
events include useful detail payload
events do not fire every frame by default
events respect accessibility constraints
```

## 9. Source/Sink Tests

```txt
source has budget
source has max particles
source has particle life
source cannot create unbounded particles
sink has capacity
sink defines release behavior
sink emits saturation event
```

## 10. Accessibility Tests

> **Implemented.** A dedicated set in `packages/core/src/contracts/a11y.test.ts` covers the
> reduced-motion fallback (guard), meaning-without-motion (UserAgent keeps focus, drops travel;
> emission flattens), thresholded events (no per-frame spam), and color/glyph-not-sole-carrier (lint).

```txt
reduced motion fallback exists
meaning survives without motion
decorative fields can be hidden
interactive fields have labels
focus-visible works without pointer
field events do not spam assistive tech
```

## 11. Performance Tests

```txt
particle count stays within budget
body count stays within budget
field-line tracing is capped
heatmap resolution respects budget
debug overlays disabled in production preset
DPR is capped
local cells clean up observers and loops
```

## 12. Snapshot Regression

A snapshot should include:

```json
{
  "seed": 1234,
  "time": 4.2,
  "bodies": [],
  "agents": [],
  "particles": [],
  "metrics": {},
  "expected": {
    "particleCount": 600,
    "entropyRange": [0.1, 0.3],
    "energyDriftMax": 0.02
  }
}
```

Desired command:

```txt
forces test snapshot solar-prominence.json
```

## 13. Recipe Conformance

Every recipe should declare:

```txt
expected metrics
required forces
required render modes
accessibility behavior
performance budget
conformance scenario
```

Example:

```txt
Solar prominence:
- magnetism field lines visible
- fieldflow moves neutral matter along field
- magnetism alone does not move neutral matter
- heat remains bounded
- reduced mode shows static field lines
```

## 14. Lint Rules

> **Implemented.** All of these (including the `data-body="gravity attract"` duplicate-pull rule)
> ship in `packages/core/src/visual/lint.ts` (`runVisualLint`), with `info`/`warning`/`error`/`fatal`
> severities.

```txt
Warning: magnetism without charged or moving particles may appear inactive.
Warning: fieldflow has no field source nearby.
Warning: source force has no budget.
Warning: local cell particle count too high.
Warning: field lines enabled but no field() hooks exist.
Warning: data-body="gravity attract" may duplicate pull behavior.
Warning: reduced motion fallback missing.
```

Severity levels:

```txt
info
warning
error
fatal
```

## 15. Platform Tests

`@fundamental-engine/dom` binds the renderer-agnostic core to the DOM. As of the platform-runtime phase
(Phase D) it is the default runtime for `<field-root>`: the platform owns DOM participation
(measurement, feedback writes, shadow registration, relationships) while the legacy `engine/field.ts`
still simulates and renders the canvas. `createFieldPlatform(root)` wires the six registries onto the
scheduler. Each registry needs coverage:

```txt
MeasurementRegistry reads element geometry only in the read phase
StateRegistry tracks registered state and flags unregistered access
FeedbackRegistry writes CSS variables (--field-density primary) only in the write phase
FeedbackRegistry emits canonical field:* events (legacy --forces-* CSS vars removed)
RelationshipRegistry resolves from/to targets and reports missing targets
VisualBindingRegistry keeps decorative bindings hidden / non-orphaned
OverlayRegistry attaches overlays only where links exist
opting out (experimental-platform="off" / usePlatformRuntime(false)) restores pure-legacy behavior
```

### DOM-boundary (renderer-agnostic core)

`core/dom-boundary.test.ts` guards the boundary: core stays renderer-agnostic and only the allowlist
(`engine/field.ts`, `export.ts`) may touch DOM APIs.

```txt
core modules outside the allowlist reference no DOM globals
field behavior computes without a document present
canvas is treated as one render surface, not a core dependency
```

## 16. Scheduler Tests

The `FrameScheduler` runs explicit phases in a fixed order: discover -> read -> compute -> state ->
write -> render. Tests prove the ordering and the off-phase guard:

```txt
phases run in order: discover, read, compute, state, write, render
reads happen before writes within a frame (no read-after-write tearing)
work registered to a phase only runs in that phase
off-phase access is rejected (measurement-off-phase guard)
a missing or empty phase does not stall the frame loop
```

## 17. Platform Lint Tests

`lintPlatform()` reports platform-level violations with the same info/warning/error/fatal severities.
Each rule needs a positive and negative case:

```txt
relation-target-missing fires when a relationship references an unknown target
state-unregistered fires when state is read without registration
overlay-without-links fires for an overlay with no links
feedback-non-css-var fires when feedback writes something other than a CSS variable
measurement-off-phase fires when measurement runs outside the read phase
visual-orphan fires for a visual binding with no owner
visual-not-hidden fires when a decorative visual binding is not hidden
```

## 18. Reading Field Browser Verification

`/docs/reading-field` is a normal content page that exercises all six scheduler phases across four registries (measurement, state, feedback, relationships) in
the browser. It is the end-to-end check that the shared field context behaves on real content:

```txt
sections register as bodies
viewport proximity drives attention
attention accumulates as memory over dwell
the table of contents reflects current field state
citations register as relationships
reduced motion preserves meaning (state and structure survive without travel-heavy motion)
```

The authoring surfaces at `/docs/authoring` (native HTML, `<field-root>`, `<FieldField>`) are verified
to compile to the same `[data-body]` contract.

## 19. Acceptance Criteria

A feature is acceptable when:

```txt
it has a contract
it has a passport if force-like
it declares truth mode
it has tests
it has reduced-motion behavior if visual
it has performance budget impact
it has Inspector visibility
it has docs
it does not violate non-negotiables
```


## Migration Validation

The `force/` to `Fundamental/` migration is complete when:

```txt
project runs from Fundamental/
typecheck passes
test suite passes
Lab still runs
docs links resolve
examples use new naming
old public names still work as aliases
canonical CSS variables are --d/--field-* (legacy --forces-* removed)
canonical event names use field:* in docs/examples/tests
package metadata uses Fundamental
no hardcoded force/ path remains except migration notes
no accidental behavior changes occurred
magnetism tests still prove Lorentz behavior
fieldflow tests still prove field-aligned transport
```

Migration-specific test categories:

```txt
directory/path tests
package metadata tests
component alias tests
event alias tests
CSS variable alias tests
docs link tests
example compatibility tests
no behavior regression tests
```

Migration acceptance rule:

```txt
A rename is not complete until the old and new names both work.
```

## 20. Cross-plane parity (JS ↔ Swift ↔ Android)

The engine ships on three planes: the JS/TS core (`packages/core`), the Swift port (`swift/`), and the
Kotlin/Android port (`android/`, foundation stage). The **conformance rule** is that at `depth: 0` a
ported field and a JS field, given the same inputs, produce the same motion. Because the planes are
hand-ported, parity must be *verified*, not trusted — historically
it wasn't, and divergences (palette ramps #497, the scroll body-centre fix #509) surfaced as hand-fixed
one-offs. The **autonomous verification spine** makes parity machine-checked with no device or human in the
loop. It has three models, built on the JS conformance runner (`packages/core/src/conformance/`, seeded
**mulberry32** PRNG) and the Swift headless primitives (`Bench`, `Snapshotter`, `FieldPerf`,
`QualityGovernor`):

### Model 1 — numeric conformance · **Status: shipped (#526)**

The JS f64 engine emits **golden vectors**; every f32 port must reproduce them.

```txt
pnpm gen:golden            # JS fires the canonical forces at probe particles, writes frame-0
                           #   force deltas → swift/Tests/.../Fixtures/conformance-golden.json
swift test                 # GoldenConformanceTests: Swift reproduces every dv within tolerance
./gradlew :fundamental-core:test  # GoldenConformanceTests: Kotlin/Android reproduces every dv
pnpm check:golden          # CI gate (JS side): fail if the golden drifts from the JS math
swift-{linux,macos}.yml    # CI gate (Swift side): fail if a Swift force drifts from the golden
android.yml                # CI gate (Android side): fail if a Kotlin force drifts from the golden
```

- **One golden, every plane.** The fixture (`swift/Tests/.../Fixtures/conformance-golden.json`) is the
  single source of truth. Swift's test bundle carries it; the Android build's `syncGolden` Gradle task
  copies that exact file onto the Kotlin test classpath — so JS, Swift, and Android can never silently
  disagree, and a golden change re-checks all three (the `android.yml` paths trigger includes the fixture).
- **Granularity is one apply, not a trajectory** — the ports are f32, JS is f64, so a single force
  application keeps drift sub-tolerance (`2e-4 + 1e-3·|dv|`) while still catching a wrong coefficient,
  missing leg, or sign flip. Integration over many frames diverges by design and is *not* asserted bit-wise.
- **A divergence is a port bug.** Fix the force; never loosen the tolerance to hide it.
- **Coverage:** the golden pins the canonical deterministic forces (attract, repel, swirl, stream,
  tether, viscosity) across all planes — Swift and Android both reproduce it. Each plane's *other*
  forces (RNG / stateful / neighbor / grid / field) are verified behaviorally on that plane (Swift's
  `ParityTests`/`EngineTests`; Android's `CoreForcesBehaviorTests`/`NaturalForcesTests`/
  `ExtendedForcesTests`, which port the full 36-force surface). The golden harness itself extends to the
  EM/grid/RNG/extended forces (RNG via the shared mulberry32 seed) and to short-trajectory + heat
  parity — follow-up coverage on the same fixture, ported per plane as it lands.

#### Kotlin/Android conformance (mirror of Swift)

The **Kotlin** engine is held to the **same** shared cross-plane golden as JS and Swift — not a
separate fixture. The Android build's `syncGolden` Gradle task copies `conformance-golden.json` onto
the Kotlin test classpath and `GoldenConformanceTests` reproduces every force delta within the same
tolerance (`2e-4 + 1e-3·|dv|`); a divergence is a Kotlin bug (fix the force, never loosen the
tolerance). Beyond the shared golden, the port carries its own per-plane coverage:

- **Unit / integration tests** — the full 36-force surface (`CoreForcesBehaviorTests`,
  `NaturalForcesTests`, `ExtendedForcesTests`), the integrator driven headlessly (`EngineTests`), the
  runtime driver (`FieldControllerTests`), and a deterministic `PerfRegressionTests` (1200 particles ×
  600 frames: count conserved, all-finite, velocity/heat bounded) — **85 core tests** — plus the
  platform module's scheduler/registry coverage (`FrameSchedulerTests`, `FieldPlatformTests`) — **10
  platform tests**.
- **Headless FieldLab render as a visual gate** — the desktop FieldLab (`:lab`, JVM Swing/Java2D over
  the same `:fundamental-core`) renders the scene tour + 36-force catalog to PNGs headlessly
  (`./gradlew :lab:run --args="render out/"`), the Kotlin analog of the Swift `Snapshotter` visual gate
  — a CI-able render path with no emulator.
- **CI gate** — `android.yml` (JDK 17 + Android SDK) runs the core conformance test and assembles the
  host modules; it re-runs whenever the shared golden changes.

### Model 2 — performance · **Status: shipped**

`Bench` splits per-frame sim/draw ms (headless, CoreGraphics) and `FieldPerf`/`QualityGovernor` compute
budget/median/fps/dropped + tier transitions deterministically. The model **gates on deterministic work**
— `PerfRegressionTests` runs a heavy 1200-particle field for 600 frames at core level (Linux-runnable) and
asserts particle-count conservation, finiteness (no NaN/Inf), and bounded velocity/heat — and **reports
wall-clock** (`swift run FieldLabSnapshots --bench`) for reasoning about a change. Wall-clock is
deliberately *not* a CI gate: the field is fill-rate-bound, headless software rasterization exaggerates
fill, and CI runners vary — inventing a wall-clock budget repeats the mistake #324 was blocked on. Real
frame-time budgets need on-hardware measurement (a maintainer task).

### Model 3 — visual snapshot · **Status: shipped**

`Snapshotter.signature` rasterizes a scene headlessly through the real engine + real renderer and reduces
the frame to a **coarse perceptual signature** — a downsampled luminance grid plus lit fraction and
centroid. A pixel-exact golden flakes (the engine's wander is unseeded; CoreGraphics rasterization differs
across machines), so the model gates **structure**: `VisualSnapshotTests` asserts every matter mode draws
coherent, bounded content in the right place (non-blank, not blown out, centroid on-canvas) and that the
coarse signature is **stable run-to-run** (observed Δ ≈ 0.004 against a 0.08 threshold — the precondition
for per-mode goldens, and the tripwire that would demand a seeded RNG seam if it ever broke). This is what
lets renderer-parity work (soft-glow particles #417, 3D streamline tubes / vector grid #392) be verified
without a device — the gap that previously forced those items to "needs human eyes." Each adds a signature
assertion on top of this base when it lands.

> **Why three models.** Numeric conformance proves the *math* matches; the perf model proves a change
> didn't regress *cost*; the snapshot model proves the *pixels* are right. Together they cover the parity
> surface that green unit tests on each plane, in isolation, cannot.

## Field testing levels

The sections above are the tests the suite *has*. This is the **ladder it grows toward** — the levels of
conformance a relational field substrate needs, from "does one force compute the right number" up to
"can an agent read the field without leaking what it shouldn't." Each rung has a one-line intent and an
honest note of where the suite **is** versus where it's **headed** — an unbuilt rung is named here so the
shape is legible, not so it can be claimed as shipped.

1. **Force conformance** — *does the force match expected math?* This is the shipped floor: the
   cross-plane golden (§20, Model 1) pins each canonical force to a JS-emitted delta and every plane
   reproduces it within tolerance. **Where it is:** shipped for the deterministic canonical forces; the
   RNG / stateful / neighbor / grid / field forces are still verified behaviorally per plane.

2. **Formation validation** — *does a [`FieldRecipe`](authoring-and-recipes.md) reference only known
   primitives, metrics, diagnostics, conditions, and projections?* A recipe is a composition of named
   lanes (§ "Concepts describe. Tokens execute…"); a formation is valid only if every name it invokes
   resolves to a registered token / metric / diagnostic / condition / projection. **Where it is:** recipe
   conformance (§13) declares the required forces and render modes today; a name-resolution gate across
   *all* lanes — including projections — is **headed**, not yet a standing check.

3. **Projection parity** — *does the reduced-motion / static / native projection preserve MEANING?* A
   [projection](substrate-api.md#projection-registry--fieldprojections-a-property) reveals state to an
   output surface and MUST declare a reduced-motion / static equivalent; parity asks that the equivalent
   carry the *same meaning*, not the same pixels. **Where it is:** reduced-motion fallbacks are tested
   for existence and meaning-survival (§10) and per-render-mode (§6); a projection-level parity assertion
   that a registered projection's static form is meaning-equivalent to its animated form is **headed**.

4. **Snapshot stability** — *same input → same snapshot?* A
   [snapshot](substrate-api.md#snapshot--diff--snapshotopts-fieldsnapshot--diffa-b-fielddiff) is a
   plain, serializable capture of what the field was doing, versioned by `FIELD_VERSION`. Stability means
   identical inputs serialize to an identical snapshot across runs (the seeded lanes) and across a
   serialize → deserialize round-trip. **Where it is:** the snapshot format ships and the visual model
   already asserts run-to-run signature stability (§20, Model 3); a dedicated same-input-same-snapshot
   regression over the serializable snapshot is **headed** and depends on the RNG seam noted in Model 3.

5. **Replay explanation** — *can the system explain a state transition?* [`replay()`](substrate-api.md)
   narrates *how* the field changed between two snapshots — an ordered sequence of causes derived purely
   from the diff. This rung is a *diagnostic* claim, not a physical one, and rides the
   [causality ladder](causality-and-truth.md#part-a--the-causality-ladder): a replay *explains*, it does
   not *re-run the sim*, so what it proves is bounded by how much the diff observes versus attributes.
   **Where it is:** the replay API ships and the ladder classifies its guarantees; a conformance test
   that a known transition yields the expected, correctly-classified explanation is **headed**.

6. **Host conformance** — *does an adapter provide the required host contract?* Every environment reaches
   the engine through an injected `FieldHost`
   ([platform-architecture.md](platform-architecture.md#the-host-seam--fieldhost-the-swappable-environment-spi)):
   a new host is valid only if it implements the whole contract (`root`, `viewport()`, the lifecycle
   hooks). This is the third parity category alongside numeric and visual — *does the seam hold*, not
   *does the math match*. **Where it is:** the host seam and its shipped implementations are specified,
   and the DOM-boundary test (§15) guards the core side of the seam; a reusable host-contract checklist a
   `MinimalFieldHost` fixture can be run against to certify any adapter is **headed**.

7. **Agent safety** — *do query / snapshot respect permission and redaction policy?* An agent reads the
   field through [`query()`](substrate-api.md#query--queryq-fieldqueryresult) and `snapshot()`, which are pure reads —
   reading can never mutate the field. Safety adds the next guarantee: that a *scoped* reader sees only
   what policy permits, with sensitive channels redacted. **Where it is: FRONTIER.** Read-only-ness is
   enforced today; permission and redaction scoping is **not yet built** — it is named here as the top of
   the ladder, not as a shipped gate.
