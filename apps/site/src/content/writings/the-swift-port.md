---
title: "The Swift Port — One Field, Native and 3D"
description: "Fundamental runs natively on Apple platforms as a Swift package — a port of the JS engine, not a reinterpretation. The package layout, API, and physics mirror npm one-to-one, a golden test holds the two planes in lockstep, and in Swift the field is 3D-native."
summary: "How the field engine ports to Swift: package-for-package parity with npm, a cross-plane conformance gate, and a 3D-native core where depth is a real axis — plus an honest read on what's still preview."
date: 2026-06-26
category: feature
author: "Zach Shallbetter"
draft: true
---

# The Swift Port — One Field, Native and 3D

A port can mean two very different things. It can be a *reinterpretation* — someone reads the original,
likes the idea, and rebuilds it in the new language with their own choices. Or it can be a *port* in the
strict sense: the same system, the same shapes, the same numbers, expressed in a different syntax. The
two age very differently. A reinterpretation drifts — every release, the two implementations diverge a
little more, until "the Swift version" is its own product with its own bugs. A true port stays in
lockstep, because divergence is treated as a defect, not a dialect.

Fundamental's Swift port is the strict kind. The package layout, the public API, and the physics mirror
the npm packages one-to-one; where the two diverge, it is a bug or a listed parity gap. And there's a
test that enforces it.

## Package-for-package

The Swift side is the same four-layer architecture as the web, with each library the mirror of an npm
package:

| Swift library | npm equivalent | What it is |
|---|---|---|
| `FundamentalCore` | `@fundamental-engine/core` | The pure physics — particles, bodies, forces, the integrator, formations, reactions. Zero platform imports, exactly as core imports zero DOM. |
| `FundamentalPlatform` | `@fundamental-engine/dom` | The six-phase scheduler (`discover → read → compute → state → write → render`) and the registries. |
| `FundamentalVanilla` | `@fundamental-engine/vanilla` | The imperative API — `FieldField`, `mountField`. One import; the host (UIKit / AppKit / RealityKit) is chosen at compile time. |
| `FundamentalSwiftUI` | `@fundamental-engine/react` | The declarative adapter — `FieldView`, `.fieldBody()`, `.fieldBurst()`, the `fieldHandle` environment value. |

That `FundamentalCore` imports zero platform code is the same discipline that keeps the web core free of
the DOM ([one engine, four runtimes](/writings/one-engine-four-runtimes) is the architecture story). The
host is injected; the physics never reaches for a screen.

## `.fieldBody()` — the `data-body` of SwiftUI

On the web, any element becomes a body by adding a `data-body` attribute. In SwiftUI, any view becomes a
body with a modifier:

```swift
import FundamentalSwiftUI

struct ContentView: View {
  var body: some View {
    ZStack {
      FieldView(options: .init(accent: "#4da3ff", render: .dots))
      Text("pull me")
        .fieldBody(tokens: ["attract"], strength: 1.2, range: 150)
    }
  }
}
```

Same token vocabulary, same tuning, same reciprocal loop — the view exerts force on the matter around it,
and the field writes its density back. The declarative shell is different; the model underneath is
identical. (The how-to lives in the [Swift guide](/docs/guides/swift); this is the why.)

## The interesting part: in Swift, the field is 3D

The JS engine is 2D. Not by preference — by constraint: the DOM lays out in a plane and
`CanvasRenderingContext2D` draws in one. That constraint doesn't exist in Swift, so the port doesn't
inherit it. Every position, velocity, and force in `FundamentalCore` is a `SIMD3<Float>`.

That isn't a cosmetic upgrade; some of the physics is simply *more correct* in three dimensions.
Magnetism's Lorentz term is a rotation, and a rotation needs an axis — in 2D you fake it, in 3D it's
real. Orbits have a plane. Walls are boxes, not line segments. On visionOS the field runs volumetric:
a `RealityFieldHost` mounts it into a RealityKit entity hierarchy and depth is a genuine third axis, not
a projection trick.

```swift
// visionOS — the simulation runs in native 3D
let host = RealityFieldHost(root: rootEntity, width: 1.0, height: 0.6, depth: 0.4)
let field = FieldField(host: host)
```

So the web isn't the "full" version that Swift approximates. It's the *flattened* one. Swift is where the
model gets to be the dimensionality it always was underneath.

## What keeps the two honest

Parity claims are cheap; the gate is what makes them real. The 36-force catalog is **single-sourced** —
one definition generates both the JS and the Swift force tables — and a golden test asserts the two
planes agree force-for-force. The Swift macOS and iOS-Simulator builds run as CI gates. If a force
behaves differently in Swift than on the web, the build fails. (That cross-plane discipline is one of the
[gates on the road to 1.0](/writings/the-road-to-1-0).)

This is the difference between "we also have a Swift version" and "it's the same engine." The former is a
marketing line; the latter is a test you can fail.

## The honest status

The port is real and conformance-checked, but the web plane moves first — so the honest read is
**preview**:

- **Consumption is build-from-source.** The SwiftPM package name is `Fundamental`, in the repo's `swift/`
  directory; there's no published registry release yet, so you depend on a local checkout. The bundled
  **Field Lab** app (`swift run FieldLab`) is the fastest way to see it run.
- **It trails on the newest primitives.** The core force set, the scheduler and registries, formations,
  and the interactive scenes all ship and pass conformance. The most recent additions land on the web
  first and are ported behind it. Treat the surface as stable in shape, not yet frozen.
- **Apple platforms only**, by definition: iOS 17+, macOS 14+, visionOS 1+.

None of that is hidden — it's in the [implementations matrix](/docs/implementations) and the
[support policy](/docs/api/stability). A port that oversold its parity would be exactly the kind of
dishonest surface this project argues against. The claim here is narrow and testable: the same field,
native on Apple platforms, held in lockstep by a gate — and in three real dimensions.

## Related reading

- [One Engine, Four Runtimes](/writings/one-engine-four-runtimes) — the zero-host architecture the Swift port is one instance of.
- [The Road to 1.0](/writings/the-road-to-1-0) — where the JS ↔ Swift conformance gate sits among the 1.0 gates.
- [The Swift guide](/docs/guides/swift) — the how-to: install, packages, and the SwiftUI API.
- [Implementations](/docs/implementations) — the surface-by-surface status across web, native, and your own renderer.
