# Fundamental for Swift

The reciprocal field engine — elements bend the field; the field's density bends them back —
as a native Swift package for **iOS**, **macOS**, and **visionOS**.

This is a port of the [Fundamental](https://fundamental-engine.com) JS engine, not a reinterpretation.
The package layout, the API surface, and the physics mirror the npm packages one-to-one;
where the two diverge it is a bug (or listed under [Parity](#parity) below). The sibling
[**Android / Kotlin** port](../android/README.md) takes the same approach and is held to the same
shared cross-plane conformance golden.

## Packages

| Swift target      | npm equivalent       | What it is |
|-------------------|----------------------|------------|
| `FundamentalCore`     | `@fundamental-engine/core`     | The pure physics: particles, bodies, forces, the integrator, formations, reactions. Zero platform imports. |
| `FundamentalPlatform` | `@fundamental-engine/dom` | The six-phase frame scheduler (`discover → read → compute → state → write → render`) and the registries (measurement, state, feedback, relationships, visual bindings, overlays). |
| `FundamentalVanilla`  | `@fundamental-engine/vanilla`  | The universal imperative API: `FieldField`, `mountField`. One import, every Apple platform — the host (UIKit / AppKit / RealityKit) is selected internally at compile time. |
| `FundamentalSwiftUI`  | `@fundamental-engine/react`    | The declarative adapter: `FieldView`, `.fieldBody()`, `.fieldBurst()`, the `fieldHandle` environment value. |

Anything platform-specific lives in `FundamentalVanilla/Hosts/` as an internal implementation
detail. Consumers never import UIKit/AppKit/RealityKit through this API.

## Usage

### Vanilla (the universal imperative API)

```swift
import FundamentalVanilla

// managed mount — mirrors `new FieldField()` / `mountField()`
let field = FieldField(in: myView)            // myView: UIView or NSView
field.scan()                                  // discover bodies in the view tree
field.setFormation("wells")
field.burst(x: 200, y: 300)                   // the JS-shaped call
field.burst(at: tap.location(in: myView))     // or a CGPoint from a gesture
// …
field.destroy()
```

```swift
// custom host — mirrors passing your own { canvas }
let field = FieldField(host: myHost, renderer: myRenderer)
```

### SwiftUI

```swift
import FundamentalSwiftUI

ZStack {
    FieldView(options: .init(accent: "#4da3ff", render: .dots))
    ContentView()
        .fieldBody(tokens: ["attract"], strength: 1.2, range: 150)
}
```

### visionOS (volumetric)

```swift
// any RealityKit Entity hierarchy can host the field; the simulation runs in
// native 3D — depth is a real axis, not a projection trick.
let host = RealityFieldHost(root: rootEntity, width: 1.0, height: 0.6, depth: 0.4)
let field = FieldField(host: host)
```

## The z axis

The engine is **3D-native**: every position, velocity, and force is a `SIMD3<Float>`.
The JS engine is 2D because the DOM and `CanvasRenderingContext2D` are; that constraint
doesn't exist here, and some of the physics is simply more correct in 3D — magnetism's
Lorentz rotation has a real axis, orbits have a plane, walls are boxes.

**Flat is the default, and flat is exact.** A mount with `depth: 0` (the default
everywhere) runs the whole simulation in the z = 0 plane, and every formula reduces to
the JS math exactly — same falloffs, same constants, same behavior. The conformance rule:
at z = 0, a Swift field and a JS field given the same inputs produce the same motion.

This is **machine-checked across planes** (#526): `pnpm gen:golden` fires the canonical
forces through the f64 JS engine and writes the frame-0 force deltas to
`Tests/FundamentalCoreTests/Fixtures/conformance-golden.json`; `GoldenConformanceTests`
then makes the f32 Swift engine reproduce every one within tolerance. The JS CI gate
(`pnpm check:golden`) fails if the golden drifts from the JS math; the Swift CI legs fail
if a Swift force drifts from the golden. A divergence is a Swift bug — fix the force, never
loosen the tolerance.

Three ways to open the third axis:

```swift
// 1. flat (default) — byte-equivalent to the JS field
let field = FieldField(in: myView)

// 2. a shallow volume behind a flat surface — matter drifts in z, rendered through a
//    perspective projection (size/opacity recede with depth). iOS/macOS.
let field = FieldField(in: myView, depth: 300)

// 3. fully volumetric — visionOS, real meters, no projection
let field = FieldField(host: RealityFieldHost(root: entity))
```

`depth` opens the *volume*, never changes the *math*: z-seeding, z-wander, toroidal
z-wrap, and 3D thermal kicks all key off `volume.depth > 0`, and the force laws are the
same equations either way. The same `burst(x:y:)` call works in all three — `z` defaults
to 0.

## Architecture

```
FieldHost (protocol)               ← the only per-platform code
 ├─ UIKitFieldHost     (internal)    CADisplayLink, UIView geometry
 ├─ AppKitFieldHost    (internal)    CVDisplayLink, NSView geometry
 ├─ RealityFieldHost   (internal)    Entity hierarchy, volumetric
 └─ your custom host   (public)      headless renderers, tests, new platforms

FieldEngine                        ← the createField loop: pool, env services,
                                     formation easing, step, feedback easing
FieldRenderer (protocol)           ← the render seam
 └─ CoreGraphicsFieldRenderer        the `dots` mode on a CALayer
```

This mirrors the JS seam exactly: `browserHost()` is the one thing `@fundamental-engine/dom`
swaps per environment, and `FieldHost` is its Swift counterpart. Everything above the
host — the integrator, the forces, the registries — is platform-free and identical
across all three OS targets.

Two deliberate representation choices (semantics over idiom):

- **`Particle` and `Env` are classes.** The JS engine mutates particles through neighbour
  lists (`collide` exchanges momentum with `q` directly) and mutates `env.dx/dy/dist` per
  body–particle pair in the hot loop. Reference semantics keep the port line-for-line;
  value types would have forced a different algorithm.
- **`Force.hasModify` replaces the JS `f.modify` existence check.** A Swift protocol
  default can't be distinguished from an implementation, so modifier forces declare it.

## Parity

Ported and tested — the full engine:

- **The integrator** (`integrator.ts`, line-for-line): captured-matter drift, the wave
  current (§2.3), formation currents, shaped sources, the 2.56× range cull, feedback
  density + thermodynamic sampling, condition gates, the modifier contract (spotlight →
  screen → resonate), cross-body screen attenuation, conserved attention, first-class
  mass, the `c` velocity cap, friction/heat decay, wander, mortal age, toroidal wrap,
  the source pass.
- **All 33 forces.** The canonical nine (§6: attract, jet, tether, wall, stream, repel,
  viscosity, swirl, sink); the natural primitives (§20.10: gravity, charge, magnetism,
  thermal, collide, diffuse, propagate, memory — the grid-backed three run against real
  scalar grids); the designed extended set (§20.3: lens, gate, buoyancy, shear,
  crystallize, align, wind, cohesion, pressure, link, hunt, morph, spawn, resonate,
  spotlight, screen, pigment, fieldflow, warp). Stage B `field()` structure hooks
  (dipole, monopole, gravity well) included.
- **Scalar grids** (`scalar-grid.ts`): the three stepping modes — diffuse (explicit heat
  equation), wave (leapfrog, CFL-clamped), memory (slow decay) — with bilinear sampling
  and central-difference gradients.
- **Currents** (§2.3/§24): the five carrier waves, the bound shimmer pool, wave pulls.
- **The bound↔free reservoir** (§2.4): wave-healing, tearing (burst/supernova/forces),
  charge induction — count conserved throughout.
- **Flow focus** (`flow.ts`): `flowTo`/`clearFlow` with linear-falloff pull, live.
- **Formations** (§7), **reactions + accretion** (§23/§6.9), **feedback** (§8),
  **conditions** (§5: active/fast/slow/hot/cool/scrolling).
- **Measured thermodynamics** (workover §"Metrics"): entropy/coherence/temperature from
  the accumulator sums, exported through the feedback sink.
- **Conserved attention** (§2.4): the rest-neutral, total-conserving multiplier model +
  the water-filling allocator. **Cross-boundary causality** (Concept 4): conserved
  density spillover → the `lit` channel.
- **Weights + temporal kernels** (`weights.ts`/`temporal.ts`): log-normalization, the
  weight→strength contract, imminence/freshness/retention/phase.
- **Overlay readings** (Field Surfaces): streamlines, force-vectors, field-lines
  (traced), grid (deformation), temperature/energy (iso-contours via marching squares),
  path, data — additive stacks on the render surface.
- **Render modes** (§20.6): dots, trails, links, metaballs (marching squares), voronoi
  (nearest-site walls), streamlines, none (signals-only) — plus waves, the bound
  shimmer, sparks (§23), and the heatmap glow (H1) on the CoreGraphics backend.
- **Recipes** (authoring §5): schema + validation + the compiler, with the locked
  64-recipe catalog embedded from the canonical `recipes.json` (4 tiers × 16, never
  hand-retyped) — every recipe validates against the standard registry in the tests.
- **Vanilla surface** (§13): the full FieldHandle.

Not yet ported (the platform-adjacent tranche — most is DOM-specific and maps to
different Swift idioms):

- `threads()` rendering (glowing connectors — the API is accepted, nothing draws yet)
- The platform package's DOM modules: apply-recipe (DOM application), bind-data,
  text-bodies, flip, export-dom — their Swift counterparts are view-tree concerns
- The frame governor + experiential metrics pipeline (`governor.ts`, `metrics.ts`)
- The agents directory (element/user/event agents — element-as-agent motion)
- Inspect/diagnostics tooling, the conformance harness, semantic/visual registries
- SwiftUI `.fieldBody()` is fully wired (registers as a programmatic body, tracks view geometry, and supports `onFeedback` callbacks)

## FieldLab — the showcase

The engine's pillars as live, interactive scenes, in a native macOS app:

```sh
cd swift
swift/Scripts/package-fieldlab.sh   # build + bundle dist/FieldLab.app + launch
```

- **The tour** — eight scenes, each one claim proven live: Mass, Magnetism, Attention,
  Causality, Volume, Source & Sink, Warp, Storm.
- **The force catalog** — all 36 registered forces as browsable scenes (canonical /
  natural / extended), each with its honest minimum pairing and a one-line physics blurb.
- **The canon** — the locked 64 recipes, compiled and runnable, with each recipe's
  lanes (tokens · metrics · reduced-motion meaning) shown from the canon data.
- Every sidebar entry carries its description from the data — scenes their claim,
  forces their physics, recipes their intent.
- The inspector exposes everything live: formation, all six matter modes, all eight
  overlay readings, accent, density, and a frame-time readout.
- Cards are real AppKit views that ARE bodies: hover engages, the feedback sink glows
  them with gathered density. Click = burst, drag = flow focus.

### Rendering: Metal + CoreGraphics hybrid

Managed mounts render through `HybridFieldRenderer` when a GPU exists: the hot
per-frame layers — matter (dots / trails / links), the carrier waves, the bound
shimmer, sparks — draw on a `CAMetalLayer` (soft-circle instances + line primitives,
4× MSAA, two pipelines, ≤4 draw calls, ~0.1 ms CPU encode), while the CoreGraphics
layer above keeps the diagnostic readings and the CG-only matter modes (metaballs /
voronoi / streamlines). `CoreGraphicsFieldRenderer` remains the complete single-layer
fallback — it draws everything when Metal is unavailable, and it's what the headless
snapshot and bench pipelines use deterministically.

Headless proof and performance:

```sh
swift run -c release FieldLabSnapshots /tmp/fieldlab   # render the tour to PNGs
swift run -c release FieldLabSnapshots --bench         # sim vs draw ms per configuration
```

## Building & testing

```sh
cd swift
swift build                  # macOS
swift test                   # 129 tests: unit + headless integration + cross-plane conformance + perf gate

# cross-platform checks
swift build --triple arm64-apple-ios17.0-simulator \
  --sdk $(xcrun --sdk iphonesimulator --show-sdk-path)
swift build --triple arm64-apple-xros1.0-simulator \
  --sdk $(xcrun --sdk xrsimulator --show-sdk-path)

# performance: measure (reported) vs gate (deterministic)
swift run -c release FieldLabSnapshots --bench   # sim/draw ms per scene/mode/reading — Bench.standardSweep
```

The test suite runs the *whole* engine headlessly — `HeadlessFieldHost` drives frames
synchronously, so the integration tests assert real behavior: an `attract` body charges
up (`d` rises) from gathered matter, friction bleeds burst energy back out, a volumetric
field spreads matter through z while a flat one provably stays planar.

**Performance has two halves.** `--bench` *measures* wall-clock (sim vs draw ms) for reasoning
about a change — reported, never CI-gated, because the field is fill-rate-bound and headless
rasterization exaggerates fill (real frame-time budgets need on-hardware measurement). What CI
*does* gate is the deterministic, machine-independent half: `PerfRegressionTests` runs a heavy
1200-particle field for 600 frames and asserts the work stays bounded — particle count conserved
(no leak / unbounded spawn), every value finite (no NaN/Inf blowup), velocity and heat in range.
That's the perf-bug class that actually ships — a runaway allocation or a divergent integrator —
caught without a clock. See [`docs/canonical/testing-and-conformance.md`](../docs/canonical/testing-and-conformance.md) §20.
