# field-ui for Swift

The reciprocal field engine — elements bend the field; the field's density bends them back —
as a native Swift package for **iOS**, **macOS**, and **visionOS**.

This is a port of the [field-ui](https://field-ui.com) JS engine, not a reinterpretation.
The package layout, the API surface, and the physics mirror the npm packages one-to-one;
where the two diverge it is a bug (or listed under [Parity](#parity) below).

## Packages

| Swift target      | npm equivalent       | What it is |
|-------------------|----------------------|------------|
| `FieldUICore`     | `@field-ui/core`     | The pure physics: particles, bodies, forces, the integrator, formations, reactions. Zero platform imports. |
| `FieldUIPlatform` | `@field-ui/platform` | The six-phase frame scheduler (`discover → read → compute → state → write → render`) and the registries (measurement, state, feedback, relationships, visual bindings, overlays). |
| `FieldUIVanilla`  | `@field-ui/vanilla`  | The universal imperative API: `FieldField`, `mountField`. One import, every Apple platform — the host (UIKit / AppKit / RealityKit) is selected internally at compile time. |
| `FieldUISwiftUI`  | `@field-ui/react`    | The declarative adapter: `FieldView`, `.fieldBody()`, `.fieldBurst()`, the `fieldHandle` environment value. |

Anything platform-specific lives in `FieldUIVanilla/Hosts/` as an internal implementation
detail. Consumers never import UIKit/AppKit/RealityKit through this API.

## Usage

### Vanilla (the universal imperative API)

```swift
import FieldUIVanilla

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
import FieldUISwiftUI

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

This mirrors the JS seam exactly: `browserHost()` is the one thing `@field-ui/platform`
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

Ported and tested:

- **The integrator** (`integrator.ts`, line-for-line): captured-matter drift, formation
  currents, shaped sources, the 2.56× range cull, feedback density + thermodynamic
  sampling, condition gates, the modifier contract (spotlight → screen → resonate),
  cross-body screen attenuation, conserved attention, first-class mass, the `c` velocity
  cap, friction/heat decay, wander, mortal age, toroidal wrap, the source pass.
- **The canonical nine** (§6): attract, jet, tether, wall, stream, repel, viscosity,
  swirl, sink.
- **Natural primitives** (§20.10): gravity, charge (shared softened inverse-square
  kernel, Plummer ε = 2GM/c²), magnetism (exact rotation — preserves |v| to FP
  precision), thermal (Box–Muller Langevin), collide (momentum-conserving) — plus their
  Stage B `field()` structure hooks (dipole, monopole, gravity well).
- **Formations** (§7): the five presets verbatim, eased transitions, accretion targeting.
- **Reactions + accretion** (§23, §6.9): burst impulses, conserved release, capture edges.
- **Feedback** (§8): `count → eased d`, the same `count/20 + engaged·0.45` target.
- **Vanilla surface** (§13): scan, formations, palette/accent, burst, flowTo*, seed/atomAt/
  focusAt, particleCount, energy, scrollV, setVisible, destroy.

Not yet ported (in rough priority order):

- Currents/waves (§2.3) — the ambient carrier motion behind everything
- Scalar grids (§20.1 [C]) — until then `diffuse`/`propagate`/`memory` no-op safely
- Overlay readings (streamlines, field-lines, heatmap, temperature/energy contours)
- Render modes beyond `dots` (trails, links, metaballs, voronoi)
- Sparks rendering (the engine fires `env.spark`; nothing draws it yet)
- The extended force set (§20.3) and warp pairing (§22.3)
- Recipes (the 64-recipe catalog → a Swift result-builder DSL)
- `flowTo` is accepted but inert (the flow-focus port is pending)
- SwiftUI `.fieldBody()` registers geometry but isn't wired into scan yet

## Building & testing

```sh
cd swift
swift build                  # macOS
swift test                   # 69 tests: unit + headless full-loop integration

# cross-platform checks
swift build --triple arm64-apple-ios17.0-simulator \
  --sdk $(xcrun --sdk iphonesimulator --show-sdk-path)
swift build --triple arm64-apple-xros1.0-simulator \
  --sdk $(xcrun --sdk xrsimulator --show-sdk-path)
```

The test suite runs the *whole* engine headlessly — `HeadlessFieldHost` drives frames
synchronously, so the integration tests assert real behavior: an `attract` body charges
up (`d` rises) from gathered matter, friction bleeds burst energy back out, a volumetric
field spreads matter through z while a flat one provably stays planar.
