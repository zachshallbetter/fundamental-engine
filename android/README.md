# Fundamental for Android

The reciprocal field engine — elements bend the field; the field's density bends them back —
as a native **Kotlin** library for Android.

This is a port of the [Fundamental](https://fundamental-engine.com) JS engine, not a
reinterpretation — the same approach as the [Swift port](../swift/README.md). The package layout,
the API surface, and the physics mirror the npm packages (and the Swift package) one-to-one; where
they diverge it is a bug.

> **Status: running on-device.** The pure-Kotlin core (full 36-force surface + integrator, held to the
> cross-plane conformance gate), the `FieldHandle` public API, a Jetpack Compose host, and a desktop
> FieldLab are all in place. See [Parity](#parity) for exactly what is and isn't ported yet.

## Packages

| Gradle module        | npm equivalent             | Swift equivalent     | What it is |
|----------------------|----------------------------|----------------------|------------|
| `:fundamental-core`  | `@fundamental-engine/core` | `FundamentalCore`    | The pure physics: particles, bodies, forces, the integrator, the runtime driver. **Zero Android deps** — plain `kotlin("jvm")`, so it builds on a cheap runner and runs the conformance test against the portable engine. |
| `:fundamental-compose` | `@fundamental-engine/react` | `FundamentalSwiftUI` | The declarative Jetpack Compose adapter: a `FieldView` composable + `Modifier.fieldBody()`. |
| `:sample`            | (the demos)                | `FieldLab`           | A minimal sample app — a live field with a centered `fieldBody` attractor; tap to burst. |

| `:fundamental-platform` | `@fundamental-engine/dom`    | `FundamentalPlatform`  | The six-phase frame scheduler (`discover→read→compute→state→write→render`) + the registries (measurement / state / feedback / relationship / visual-binding / overlay), driven through an injected [`FieldHost`](fundamental-core/src/main/kotlin/com/fundamental/core/engine/FieldHost.kt). **Zero Android deps** — pure `kotlin("jvm")`. |

| `:fundamental-android`  | `@fundamental-engine/vanilla` | `UIKitFieldHost`       | The imperative `View`/`Canvas` host for non-Compose apps: `FieldFieldView` (a custom `android.view.View` that owns a `FieldController`, drives it from the `Choreographer`, and draws the pool in `onDraw`) + `AndroidFieldHost` (the `FieldHost` impl — volume/visibility/reduced-motion, `Choreographer` frame loop, `worldBox` via `getLocationOnScreen`). |

## Usage

### View host (imperative)

```kotlin
// managed surface — mirrors Swift `FieldField(in:)`
val fieldView = FieldFieldView(context)       // owns the controller + the host-scheduled loop
fieldView.handle?.setFormation("wells")
fieldView.burst(200f, 300f)                   // or tap — the view handles it
fieldView.handle?.pause()                     // stop the Choreographer loop (state retained) —
fieldView.handle?.resume()                    //   e.g. around a covering dialog / fragment
// activity stop/start, view detach, and View.GONE auto-pause through the visibility seam.

// custom host — mirrors Swift `FieldField(host:)`
val field = createField(AndroidFieldHost(view))
field.pause(); field.resume()                 // sticky: a visibility resume never overrides it
```

### Compose

```kotlin
FieldView(accent = Color(0xFF4DA3FF)) {
    Text("hello", Modifier.fieldBody(tokens = listOf("attract"), strength = 1.2f))
}
// the tick loop follows the composition's lifecycle: ON_STOP cancels it, ON_START relaunches it.
```

## The conformance rule

The JS engine is 2D because the DOM and Canvas are; this port (like Swift) is **3D-native** — every
position, velocity, and force is a [`Vec3`](fundamental-core/src/main/kotlin/com/fundamental/core/math/Vec3.kt)
of `Float`. **Flat is the default, and flat is exact:** at z = 0 every formula reduces to the JS math
exactly — same falloffs, same constants, same behavior.

This is **machine-checked across planes** (#526). `pnpm gen:golden` (run from the repo root) fires the
canonical deterministic forces through the f64 JS engine and writes the frame-0 force deltas to
`swift/Tests/FundamentalCoreTests/Fixtures/conformance-golden.json` — **one** golden, shared by JS,
Swift, and Android. The Kotlin `GoldenConformanceTests` syncs that exact file onto its test classpath
and makes the f32 Kotlin engine reproduce every case within tolerance (`2e-4 + 1e-3·|dv|`). A
divergence is a Kotlin bug — fix the force, never loosen the tolerance.

## Parity

Ported and tested:

- **Core math + contracts** — `Vec3`, `Box`, `Particle`, `Body`, `Env`, `Formation`, `ScalarGrid`,
  the full `Force` interface (`apply`/`source`/`modify`/`field`), `ForceModification`, the canon
  `ForceColors`, and the standard `Registry`.
- **The full 36-force surface**, line-for-line from the Swift sources:
  - **Canonical nine** (§6) — `attract`, `jet`, `tether`, `wall`, `stream`, `repel`, `viscosity`,
    `swirl`, `sink`.
  - **Natural primitives** (§20.10) — `gravity`, `charge`, `magnetism`, `thermal`, `collide`,
    `diffuse`, `propagate`, `memory`.
  - **Designed extended set** (§20.3) — `lens`, `gate`, `buoyancy`, `shear`, `crystallize`, `align`,
    `wind`, `cohesion`, `pressure`, `link`, `hunt`, `morph`, `spawn`, `resonate`, `spotlight`,
    `screen`, `pigment`, `fieldflow`, `warp`.
- **The integrator** (`step`) — the per-tick loop, line-for-line from Swift: first-class mass (Δv ×
  1/m), the range cull, the modifier contract (spotlight → screen → resonate; gates OR, strengths
  multiply), cross-body `screen` attenuation, conserved-attention multiplier, the carrier-wave current
  (linear + circular), formation currents (drift / spread / convergence), the `c` velocity cap,
  friction/heat decay, wander, mortal aging, toroidal wrap, and the source pass.
- **Supporting subsystems** — real scalar grids (`ScalarGridImpl`: diffuse / wave / memory stepping),
  the `SpatialHash` + `FieldStore` neighbour index, carrier waves (`Currents`), `Geometry` (pole-pair
  dipoles, box SDF, `netField`), `Formations` (presets + easing + accretion target), the `when`
  condition gates, thermodynamics, weights, and temporal kernels. The `field()` structure hooks are
  complete (gravity/charge monopole, magnetism dipole).
- **The runtime driver** (`FieldController`) — the `createField`-equivalent loop: pool seeding, env
  service wiring (neighbours, spawn, scalar grids by name, sink supernova), formation easing, grid
  stepping, and `tick()`; plus `addBody`/`burst`/`setFormation`/`resize`. Pure Kotlin, JVM-testable.
- **The public `FieldHandle` API** (`createField`, the Kotlin `FieldField`) — programmatic bodies with
  live `BodyHandle`s (`set` / `remove` / `load` / `drain`), `burst`, `flowTo`/`clearFlow` (the Flow
  focus), data atoms (`seed` / `atomAt`), open scalar channels (`addField` / `sampleField`), the BMI
  toggles (`setAttention` / `setCausality` / `setHeatmap`) + `sampleScalar` / `sampleGradient`, the
  `sample(x, y)` force-probe (JS #816 — the net force vector a free particle would feel at a point, via
  the shared `forceAt` streamlines probe), `energy`, `particleCount`, and `readParticles` (stride-5 wire
  format). JVM-tested.
- **Loop lifecycle — `pause()` / `resume()` + presentation-aware auto-pause** (the Swift #605/#950
  mirror) — `FieldHandle.pause()` cancels the host-scheduled frame loop outright (simulation state fully
  retained); `resume()` restarts it. Both idempotent; an explicit pause is *sticky* — a host visibility
  resume never overrides it — and the controller re-bases its frame clock on resume so a long pause can
  never integrate as elapsed time (the first resumed frame runs at `dt = 1`). Two lanes (user + host)
  reconcile at a single `syncLoop()`, exactly as in `FieldEngine.swift`; a destroyed field can never be
  resurrected. The loop itself is the new host-scheduled seam: `createField(host)` /
  `FieldHandle.attach(host)` drives `tick()` through `FieldHost.scheduleFrame`/`cancelFrame` (a repeating
  display-sync loop, the `CADisplayLink` contract; `AndroidFieldHost` re-posts its one-shot
  `Choreographer` callback), and hosts that drive `tick()` directly get the same contract from the
  paused/destroyed guard on `tick()` itself. The hosts wire the seam automatically: `FieldFieldView`
  forwards window/view visibility (activity stop/start, detach, `View.GONE`) through
  `AndroidFieldHost.fireVisibility()` — plus an explicit `isPaused` host SPI, the `UIKitFieldHost`
  mirror, for presentations Android doesn't report — and the Compose `FieldView` cancels its
  `withFrameNanos` loop on lifecycle `ON_STOP` and relaunches it on `ON_START` with a fresh frame clock.
  JVM-tested at the host seam (`PauseResumeTests`, the Swift suite test-for-test).
- **Substrate READ API — `query()`** (JS #837 / critical-path 02) — `FieldHandle.query(q)` answers a
  structured, read-only question over the live field: bodies (identity + rect + tokens + metrics), the
  active formation, field-level metrics (`particles` / `bodies` / `meanDensity`), and relationships,
  scoped by a point/rect/global region and an `include` filter. The result (`FieldQueryResult`) mirrors
  the JS shape 1:1 so a reading serializes identically across planes. JVM-tested (`FieldQueryTests`).
  `projections` is now populated from the field's `ProjectionRegistry` (see below); `influences` / `lens`
  remain present-but-empty for now (the port has no impulse accumulator or lens lane yet).
- **Substrate READ API — `snapshot()`** (JS critical-path 03) — `FieldHandle.snapshot(opts)` captures the
  field's STATE at a frame — a portable, serializable `FieldSnapshot`: bodies (identity + rect + position +
  tokens + metrics), the active formation, field-level metrics (`particles` / `bodies` / `meanDensity`),
  and relationships. This is *what the field was doing* (the basis for `diff`/`replay`), DISTINCT from the
  perf-metrics `FieldPerfSnapshot`. Shape mirrors the JS `FieldSnapshot` 1:1. `createdAt` is the FIELD
  clock (`env.t`, deterministic — not wall time); `id` is `snap-<frame>-<seq>`; `version` is the port's
  `FIELD_VERSION`. Body `data` is WITHHELD by default (privacy-preserving) — included only when opted in
  (`includeData` / a permissive `profile`) AND the runtime `FieldPolicy` permits it; profiles/flags resolve
  TIGHTEST-wins. `projections` is now populated from the field's `ProjectionRegistry` (see below); `influences`
  remains present-but-empty (no accumulator yet). JVM-tested (`FieldSnapshotTests`).
- **Substrate READ API — `diff()`** (JS critical-path 03) — `FieldHandle.diff(a, b)` is a PURE comparison
  of two `FieldSnapshot`s (no live field access, no mutation) reporting what changed, by lane: `bodyChanges`
  (added / removed / changed — "changed" = any per-metric before/after differs), `relationshipChanges`
  (added / removed / changed by the `from`+`to`+`type` edge key, carrying `strength` / `active` deltas),
  `metricChanges` (field-level metric before/after), and `formationChanges` (activated / deactivated).
  The `FieldDiff` + `BodyChange` / `RelationshipChange` / `MetricChange` / `FormationChange` shapes mirror
  the JS `@fundamental-engine/core` 1:1. The standalone `diffFieldSnapshots(a, b)` is also exported. JVM-tested
  (`FieldDiffTests`).
- **Substrate READ API — `replay()`** (JS critical-path 03 phase 2) — `FieldHandle.replay(a, b, opts)`
  explains HOW the field changed between two snapshots: an ordered, narrated `CausalReplay` of `CausalReplayStep`s
  derived PURELY from the diff (no live field access, no mutation). Steps run in the canonical lane order —
  formations → relationships → body measurements (entered / left) → metric moves → forces — each stamped with
  `b`'s frame/time and carrying the structured before/after on `contribution`. `ReplayOptions.focus` scopes the
  replay to one body id. The `CausalReplay` / `CausalReplayStep` / `ReplayOptions` / `CausalCause` shapes mirror
  the JS `@fundamental-engine/core` 1:1; the standalone `replayFieldSnapshots(a, b, opts)` is also exported.
  The `force` lane is **empty-for-now**: it is derived from each snapshot's `influences`, which this port
  leaves empty (no impulse accumulator yet, same as `query`/`snapshot`/`diff`) — the lane's logic is mirrored
  field-for-field and comes alive unchanged once an accumulator lands; the structural lanes are fully live.
  JVM-tested (`CausalReplayTests`).
- **Substrate Projection Registry — `projections`** (JS critical-path 05) — `FieldHandle.projections` is the
  field's `ProjectionRegistry`: register named `FieldProjection`s that map field STATE into an output surface,
  read their metadata back through `query()` / `snapshot()`, and bind them to auto-apply once per write phase.
  GOVERNANCE (kept from the JS core): *a projection reveals state; it MAY NOT mutate the field* — no forces,
  no body/metric writes; enforced structurally (the registry only ever calls `apply(reading, target)`, never
  the field). The registry mechanism mirrors the JS `ProjectionRegistry` 1:1 — `register` (returns an
  unregister fn) / `unregister` / `get` / `list` (serializable `FieldProjectionInfo` metadata) / `apply` /
  `bind` (auto-apply each write phase, returns an unbind fn). **Surfaces (Option A):** this port implements
  the two PORTABLE surfaces — `agent-json` (`agentJsonProjection` / `agentJsonTarget`: serialize a reading for
  an agent/tool) and a generic host `callback` (`callbackProjection` / `callbackTarget`: a `(reading) -> Unit`
  a native view wires up). The web surfaces (`css` / `dom-attribute` / `svg`) are **web-first** — declared in
  the `FieldProjectionSurface` enum for metadata parity but implemented in `@fundamental-engine/dom`, not on the
  native plane. `query().projections` / `snapshot().projections` now report the registered projections'
  metadata (the empty-for-now lane is closed for projections). JVM-tested (`ProjectionRegistryTests`),
  including the JS "never mutates the field" guarantee (particle count identical with a projection registered,
  applied, and bound). Follow-up: the Swift projection registry (the other native plane).
- **The Jetpack Compose host** (`:fundamental-compose`) — `FieldView` (drives one frame per display
  frame via `withFrameNanos`, renders the pool on a Compose `Canvas`, tap-to-burst) and
  `Modifier.fieldBody(...)` (a composable becomes a body tracking its on-screen bounds), plus a
  runnable `:sample` app.
- **Render modes** — `RenderMode.DOTS` / `TRAILS` (a faded persistent buffer → comet trails) /
  `LINKS` (proximity line segments via the spatial hash → a constellation network) / `GLOW` (soft
  radial-gradient blobs), plus the **heatmap glow** underlay (from the density buffer). All verified
  on-device / in the lab. (Metaballs / voronoi matter modes are follow-ups — marching-squares / nearest-site.)
- **Carrier waves + the bound↔free reservoir** (§24 / §2.3 / §2.4, `Currents` + `Reservoir`) — the five
  layered standing currents (`buildWaves`) that free matter drifts along, the bound shimmer pool riding
  them (`buildBound`), the conserved `healWaves` (reclaim calm matter onto a line) / `tearBoundByForces`
  (rip it loose near a body) cycle — free + bound count is invariant — and `induceCharges` (a charge
  body polarizes nearby matter into +/- domains, so charge/magnetism act without manual seeding).
- **Reactions / sparks** (§23, `Reactions` + `SparkPool`) — the micro-reaction matter: `energyDelta`,
  `reactionIntensity`, `burstImpulse`, `captureEdge`, and the conserved sink-release (`releaseCaptured` —
  ejects held matter past the absorb horizon, made immortal). Forces emit sparks through `env.spark`
  (wall impacts, the sink supernova flash); the capped pool decays them; the host draws them.
- **Body-Matter-Interaction** (`Attention` / `Causality` / `Heatmap`) — the model's conserved truths,
  wired into the driver as toggles: **conserved attention** (one strength budget; engaging a body drains
  the others, Σ S·mul invariant), **cross-boundary causality** (saturated bodies spill density to
  neighbours, ΣΔ = 0, into a `lit` channel), and the **density heatmap** (a scalar buffer of where matter
  pools, sampled back via `sampleScalar`/`sampleGradient` and drawn as a glow). First-class mass already
  ships in the integrator.
- **Recipes** (`recipe` package) — the schema, validation, and the `compileRecipe` compiler, with the
  **locked 64-recipe canon** decoded from the shared `data/recipes.json` (4 tiers × 16, never
  hand-retyped). Every recipe validates against the standard registry in the tests, exactly as on Swift.
- **Overlay readings** (`overlay` package) — the field diagnostics, computed as plain `Segment`s any
  host can draw: `forceAt` probe → **streamlines** / **force-vectors**; `netField` traces → **field
  lines**; a displaced lattice → the **deformation grid**; and **marching-squares iso-contours** for
  **temperature** and **energy** from a particle-splatted scalar grid. Pure + JVM-tested.
- **FieldLab (desktop, `:lab`)** — a JVM Swing/Java2D **FieldLab** over the same engine: a sidebar (tour
  + the full 36-force catalog + the 64-recipe canon), a live canvas, and an inspector (formation / render mode / density /
  accent / live body sliders / **the Readings overlays** / **the Body-Matter-Interaction toggles** + heatmap glow + carrier waves / live stats), plus a headless scene-tour +
  overlay PNG renderer + sim bench (`--args="render"` / `"bench"`). The Kotlin analog of
  `swift run FieldLab` — fast iteration and a CI-able visual render path, no emulator.
- **Verification** — the six deterministic canonical forces are held to the cross-plane golden
  (`GoldenConformanceTests`); every other force has behavioral/exact unit tests
  (`CoreForcesBehaviorTests`, `NaturalForcesTests`, `ExtendedForcesTests`); the integrator is driven
  headlessly (`EngineTests`) and gated by a deterministic `PerfRegressionTests` (1200 particles × 600
  frames: count conserved, all-finite, velocity/heat bounded); the driver has its own headless tests
  (`FieldControllerTests`). **152 core tests total**, and the Compose host + sample app build against the
  Android SDK and **run on-device** (verified on a Pixel 7 / API 35 emulator).

Also ported:

- **`:fundamental-platform`** (mirror of Swift `FundamentalPlatform`) — the **six-phase `FrameScheduler`**
  (`discover→read→compute→state→write→render`, with the read-phase guard + violation recording), the
  **registries** (`MeasurementRegistry` with frame-stable geometry + visibility, `StateRegistry`,
  `FeedbackRegistry`, `RelationshipRegistry`, `VisualBindingRegistry`, `OverlayRegistry`), the
  **`FieldPlatform`** coordinator (wires `read→measure`, `write→flush`), and the `QualityGovernor` /
  `FieldPerf` budget governors. The platform seam — `FieldHost` / `FieldVolume` / `FieldProjection` —
  lives in core (Android-free). JVM-tested (`FrameSchedulerTests`, `FieldPlatformTests`).

- **`:fundamental-android`** (mirror of `UIKitFieldHost` / `@fundamental-engine/vanilla`) — the imperative
  non-Compose host: `FieldFieldView` (a custom `View` driving a `FieldController` from the `Choreographer`,
  rendering the pool in `onDraw`, tap-to-burst) + `AndroidFieldHost` (implements the core `FieldHost`).
  Builds against the Android SDK.

The core, both host modules (`:fundamental-platform`, `:fundamental-android`), the Compose host, and the
desktop FieldLab are all ported — including **`ParticleShape`** (dot / star / polygon / custom stamps,
wired into the lab) and the **visual-snapshot signature** (`Snapshotter` — a perceptual luminance/lit/
centroid fingerprint, gated for stability + structure). CI is **path-aware**: android/docs-only PRs skip
the JS e2e suite, and an advisory on-emulator smoke job runs the sample on a real device on pushes to
main. Remaining follow-ups are matter-render extras (metaballs / voronoi modes) and the declarative
`[data-body]` view scanner for the Android host.

## Building & testing

```sh
cd android
./gradlew :fundamental-core:test       # engine + cross-plane conformance (152 tests; 120 golden cases)
./gradlew :fundamental-compose:assembleDebug :sample:assembleDebug   # the Android host + sample app

# run the sample on a device/emulator
./gradlew :sample:installDebug
adb shell am start -n com.fundamental.sample/.MainActivity
```

### FieldLab (desktop) — no emulator

`:lab` is a JVM **FieldLab** over the **same** `:fundamental-core` engine, drawn with Java2D (built into
the JDK — no Android, no Compose-Multiplatform). It's the Kotlin analog of `swift run FieldLab`: a real
desktop app, instant iteration without an emulator. Like the Swift lab it has a **sidebar** (the tour +
the full 36-force catalog, grouped canonical / natural / extended), a **live canvas**, and an
**inspector** (formation, render mode, density, accent, live body strength/range/spin sliders, and live
stats — particles / kinetic / thermal / frame-ms). Each force opens a scene wired so it actually shows
(charge/magnetism get charged matter, hunt gets two species, wall/gate get a box, morph gets a target).

```sh
./gradlew :lab:run                       # the FieldLab window — pick a force in the sidebar, tune the inspector, click = burst
./gradlew :lab:run --args="render out/"  # headless: render the tour + catalog spread to PNGs (CI-able, no display)
./gradlew :lab:run --args="bench"        # headless: sim ms/frame per scene
```

At full FieldLab parity: the sidebar runs the tour + 36-force catalog + 64-recipe canon, **all eight**
overlay readings work (incl. `path` traces + per-body `data` rings), the three Body-Matter-Interaction
toggles (attention / causality / heatmap) + carrier waves, and **recipe save/export** round-trips a
scene back to the canon JSON shape (`RecipeExport`).

The pure `:fundamental-core` builds on any JDK (JVM-17 bytecode); the host modules need the Android SDK
(point Gradle at it via `local.properties` `sdk.dir=...` or `ANDROID_HOME`). compileSdk 34, minSdk 24,
build-tools 34.0.0, AGP 8.7, Kotlin 2.1, Compose BOM 2024.12. The committed Gradle wrapper is 8.13.
CI (`.github/workflows/android.yml`, JDK 17 + Android SDK) runs the core conformance test and assembles
the host modules; it re-runs whenever the shared golden changes.
