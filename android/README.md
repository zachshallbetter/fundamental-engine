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

Planned (mirroring Swift's `FundamentalPlatform` / `FundamentalVanilla`):

| Module (planned)        | Mirrors                          | What it will be |
|-------------------------|----------------------------------|-----------------|
| `:fundamental-platform` | `@fundamental-engine/dom`        | The six-phase frame scheduler + registries. |
| `:fundamental-android`  | `@fundamental-engine/vanilla`    | The imperative `View`/`Canvas` host (mirror of `UIKitFieldHost`), for non-Compose apps. |

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
  focus), data atoms (`seed` / `atomAt`), open scalar channels (`addField` / `sampleField`), `energy`,
  `particleCount`, and `readParticles` (stride-5 wire format). JVM-tested.
- **The Jetpack Compose host** (`:fundamental-compose`) — `FieldView` (drives one frame per display
  frame via `withFrameNanos`, renders the pool on a Compose `Canvas`, tap-to-burst) and
  `Modifier.fieldBody(...)` (a composable becomes a body tracking its on-screen bounds), plus a
  runnable `:sample` app.
- **Render modes** — `RenderMode.DOTS` / `TRAILS` (a faded persistent buffer → comet trails) /
  `LINKS` (proximity line segments via the spatial hash → a constellation network) / `GLOW` (soft
  radial-gradient blobs). All four verified on-device. (Metaballs / voronoi / streamlines / heatmap
  overlays are follow-ups — they need the heatmap grid + marching-squares.)
- **FieldLab (desktop, `:lab`)** — a JVM Swing/Java2D **FieldLab** over the same engine: a sidebar (tour
  + the full 36-force catalog), a live canvas, and an inspector (formation / render mode / density /
  accent / live body sliders / live stats), plus a headless scene-tour PNG renderer + sim bench
  (`--args="render"` / `"bench"`). The Kotlin analog of `swift run FieldLab` — fast iteration and a
  CI-able visual render path, no emulator.
- **Verification** — the six deterministic canonical forces are held to the cross-plane golden
  (`GoldenConformanceTests`); every other force has behavioral/exact unit tests
  (`CoreForcesBehaviorTests`, `NaturalForcesTests`, `ExtendedForcesTests`); the integrator is driven
  headlessly (`EngineTests`) and gated by a deterministic `PerfRegressionTests` (1200 particles × 600
  frames: count conserved, all-finite, velocity/heat bounded); the driver has its own headless tests
  (`FieldControllerTests`). **55 core tests total**, and the Compose host + sample app build against the
  Android SDK and **run on-device** (verified on a Pixel 7 / API 35 emulator).

Not yet ported (follow-up PRs):

- The bound↔free reservoir, reactions/accretion sparks, attention/causality, recipes, carrier-wave
  building (`buildWaves`), and the `FieldHandle`'s remaining surface (relationship edges,
  `sampleScalar`/`sampleGradient`) — the rest of `FundamentalCore`.
- `:fundamental-platform` (the six-phase scheduler + registries) and a non-Compose `View`/`Canvas` host.

## Building & testing

```sh
cd android
./gradlew :fundamental-core:test       # engine + cross-plane conformance (55 tests; 120 golden cases)
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

Not yet (vs. the Swift FieldLab): the 8 overlay **readings**, the **recipe canon** + save/export, and
the Body-Matter-Interaction toggles (attention / causality / heatmap) — they follow as those engine
subsystems land (#654 / #652 / #647 / #649).

The pure `:fundamental-core` builds on any JDK (JVM-17 bytecode); the host modules need the Android SDK
(point Gradle at it via `local.properties` `sdk.dir=...` or `ANDROID_HOME`). compileSdk 34, minSdk 24,
build-tools 34.0.0, AGP 8.7, Kotlin 2.1, Compose BOM 2024.12. The committed Gradle wrapper is 8.13.
CI (`.github/workflows/android.yml`, JDK 17 + Android SDK) runs the core conformance test and assembles
the host modules; it re-runs whenever the shared golden changes.
