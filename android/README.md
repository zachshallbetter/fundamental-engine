# Fundamental for Android

The reciprocal field engine — elements bend the field; the field's density bends them back —
as a native **Kotlin** library for Android.

This is a port of the [Fundamental](https://fundamental-engine.com) JS engine, not a
reinterpretation — the same approach as the [Swift port](../swift/README.md). The package layout,
the API surface, and the physics mirror the npm packages (and the Swift package) one-to-one; where
they diverge it is a bug.

> **Status: foundation.** This is the first slice — the pure-Kotlin core plus the cross-plane
> conformance gate. It is intentionally small so every later force/host PR is held to parity from
> day one. See [Parity](#parity) for exactly what is and isn't ported yet.

## Packages

| Gradle module      | npm equivalent             | Swift equivalent     | What it is |
|--------------------|----------------------------|----------------------|------------|
| `:fundamental-core`| `@fundamental-engine/core` | `FundamentalCore`    | The pure physics: particles, bodies, forces, the math. **Zero Android deps** — plain `kotlin("jvm")`, so it builds on a cheap CI runner and runs the conformance test against the portable engine. |

Planned (mirroring Swift's `FundamentalPlatform` / `FundamentalVanilla` / `FundamentalSwiftUI`):

| Module (planned)        | Mirrors                          | What it will be |
|-------------------------|----------------------------------|-----------------|
| `:fundamental-platform` | `@fundamental-engine/dom`        | The six-phase frame scheduler + registries. |
| `:fundamental-android`  | `@fundamental-engine/vanilla`    | The imperative API + a `View`/`Canvas` host (mirror of `UIKitFieldHost`). |
| `:fundamental-compose`  | `@fundamental-engine/react`      | The declarative adapter: a `FieldView` composable + `Modifier.fieldBody()`. |

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
- **Verification** — the six deterministic canonical forces are held to the cross-plane golden
  (`GoldenConformanceTests`); every other force is verified by behavioral/exact unit tests
  (`CoreForcesBehaviorTests`, `NaturalForcesTests`, `ExtendedForcesTests`) — closed-form ones against
  their exact formula, neighbor/RNG/grid/field ones against a constructed `Env`. This mirrors how the
  Swift port verifies the non-golden forces.

Not yet ported (follow-up PRs):

- The **visual `field()` structure hooks** for the dipole sources (magnetism's bar-magnet dipole;
  the renderable dipole/monopole fields) — they need the geometry pole-pair port and only matter once
  the integrator wires `env.fieldAt`. The monopole `field()` for `gravity`/`charge` is ported.
- The integrator, scalar grids (the real diffuse/wave/memory stepping behind `NoopGrid`), currents,
  the bound↔free reservoir, formations/reactions/feedback, conditions, thermodynamics, attention,
  recipes — the rest of `FundamentalCore`.
- `:fundamental-platform` (scheduler + registries), the Android hosts, the Compose adapter, and a
  sample app (the FieldLab equivalent).

## Building & testing

```sh
cd android
./gradlew :fundamental-core:test    # cross-plane conformance: 120 golden cases within tolerance
./gradlew :fundamental-core:build   # compile the pure core (no Android deps) + test
```

The Gradle wrapper is committed (Gradle 8.13). The build runs on JDK 17 in CI (`.github/workflows/android.yml`)
and targets JVM 17 bytecode regardless of the local JDK.
