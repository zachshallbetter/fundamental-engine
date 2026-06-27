---
title: "The Kotlin Port — Conformance First"
description: "Fundamental is coming to Android as a native Kotlin library — and it landed gate-first: a deliberately small core built against one golden fixture shared by JS, Swift, and Kotlin, so every force is held to cross-plane parity from day one."
summary: "How the Android port is being built: a single shared golden across three planes, 'flat is exact' 3D-native math, a Jetpack Compose host with Modifier.fieldBody(), and an honest foundation-stage status."
date: 2026-06-26
category: feature
author: "Zach Shallbetter"
draft: true
---

# The Kotlin Port — Conformance First

> **Status: foundation, in review.** The Android port is not shipped — it lives in open PRs, building
> toward [Swift](/writings/the-swift-port) parity. This essay describes the foundation that's landing
> and the discipline behind it, not a released library.

Most ports are written and *then* verified. You rebuild the system in the new language, run it, eyeball
the output against the original, fix what looks wrong, and ship. The verification is a phase that comes
after the porting — which means for the whole porting phase, you're flying blind, and "looks right"
is doing a lot of load-bearing work.

The Android port inverts that. The very first slice isn't a feature — it's the **gate**. Before the
interesting work, there's a deliberately small pure-Kotlin core and a cross-plane conformance test, so
that every later force and host lands already held to parity. You don't port and then check. You build
the check, then port against it.

## One golden, three planes

Here's the mechanism. From the repo root, `pnpm gen:golden` fires the canonical deterministic forces
through the f64 JavaScript engine — the reference — at a fan of probe points and writes the frame-0
force deltas to a single fixture: `conformance-golden.json`. **One** golden. It is the shared source of
truth for JS, Swift, *and* Kotlin.

The Kotlin `GoldenConformanceTests` syncs that exact file onto its classpath and makes the f32 Kotlin
engine reproduce every case within a tight tolerance (`2e-4` absolute plus a small relative term — just
enough to absorb f32-vs-f64 rounding, not enough to hide a real formula divergence). The rule the test
enforces is blunt:

> A divergence means the ports have drifted. Fix the Kotlin force — never loosen the tolerance to hide it.

That single sentence is the whole philosophy. Three implementations of the same physics in three
languages can't quietly diverge, because one shared fixture fails the build the moment they do. "We also
have an Android version" is a marketing line; "the same engine, gated against the same golden as Swift"
is a test you can fail.

## Flat is exact

Like Swift, the Kotlin core is **3D-native**: every position, velocity, and force is a `Vec3` of `Float`.
The JS engine is 2D only because the DOM and Canvas are; the port doesn't inherit that limit. But the
parity gate needs the two to agree, and they do, because of one design choice:

**Flat is the default, and flat is exact.** At `z = 0`, every formula reduces to the JS math *exactly* —
same falloffs, same constants, same behavior. The third dimension is a strict superset, not a rewrite.
That's what lets a 2D reference golden validate a 3D engine: run the 3D math in the plane and it must
reproduce the 2D numbers to the bit-ish. Depth is then free to be real where it matters (magnetism's
rotation axis, orbit planes, box walls) without ever putting the flat case at risk.

## Package-for-package, again

The module layout mirrors npm and Swift one-to-one — the same architecture, a third time:

| Gradle module | npm | Swift | What it is |
|---|---|---|---|
| `:fundamental-core` | `@fundamental-engine/core` | `FundamentalCore` | The pure physics — particles, bodies, the 36 forces, the integrator, the runtime driver. **Zero Android deps** (plain `kotlin("jvm")`), so the conformance test runs on a cheap JVM runner. |
| `:fundamental-compose` | `@fundamental-engine/react` | `FundamentalSwiftUI` | The declarative Jetpack Compose adapter — a `FieldView` composable + `Modifier.fieldBody()`. |
| `:sample` | the demos | `FieldLab` | A minimal app — a live field with a centered attractor; tap to burst. |

Two more are planned, mirroring Swift's split: `:fundamental-platform` (the scheduler + registries, like
`@fundamental-engine/dom`) and `:fundamental-android` (an imperative `View`/`Canvas` host for non-Compose
apps, like `FundamentalVanilla`). The foundation is intentionally narrow so those land parity-gated too.

## `Modifier.fieldBody()` — the same body contract, in Compose

On the web a body is a `data-body` attribute; in SwiftUI it's `.fieldBody()`; in Compose it's a modifier:

```kotlin
import com.fundamental.compose.FieldView
import com.fundamental.compose.fieldBody

@Composable
fun Screen() {
  FieldView(accent = Color(0xFF4DA3FF)) {   // drives one frame per display frame, draws the pool on a Canvas
    Text(
      "pull me",
      modifier = Modifier.fieldBody(tokens = listOf("attract"), strength = 1.2f, range = 150f),
    )
  }
}
```

`FieldView` runs the field a frame per display frame via `withFrameNanos` and renders the particle pool
onto a Compose `Canvas`; any composable inside it becomes a body that tracks its on-screen bounds. Same
token vocabulary, same reciprocal loop as every other plane — the shell is Compose, the model underneath
is the one engine.

## What's actually ported

More than "foundation" might suggest, and all of it gated:

- **The full 36-force surface** — the canonical nine, the eight natural primitives, and the designed
  extended set — ported line-for-line from the Swift sources.
- **The integrator** — the per-tick loop with first-class mass, the modifier contract, cross-body
  `screen` attenuation, conserved attention, carrier-wave currents (linear + circular), formation
  currents, the velocity cap, friction/heat decay, aging, and toroidal wrap.
- **The subsystems** — real scalar grids (diffuse/wave/memory), the spatial-hash neighbour index,
  geometry (dipoles, box SDF), formations, condition gates, thermodynamics.
- **The runtime driver** (`FieldController`) — the `createField` equivalent: pool seeding, env wiring,
  `tick()`, `addBody`/`burst`/`setFormation`.
- **The Compose host** + a runnable sample.

## The honest status

It's a **foundation, in review** — three stacked PRs, not yet on `main`, not published to Maven. The
planned platform/vanilla modules aren't built. It's `f32` where JS is `f64` (the tolerance accounts for
it). And the "ported line-for-line from Swift" framing is the point: this is a *port*, downstream of the
web and the Swift plane, not an independent design.

But the thing that's true today, and testable, is the part that matters most: the Android engine
reproduces the same golden as JS and Swift, in the plane, force-for-force. The foundation was built
gate-first precisely so that claim never becomes aspirational. When the rest lands, it lands already
honest.

## Related reading

- [The Swift Port](/writings/the-swift-port) — the sibling native port; same discipline, Apple platforms.
- [One Engine, Four Runtimes](/writings/one-engine-four-runtimes) — the zero-host architecture; Android is the fifth, in progress.
- [The Road to 1.0](/writings/the-road-to-1-0) — where the cross-plane conformance gate sits among the 1.0 gates.
- [Implementations](/docs/implementations) — the surface-by-surface status (Android joins it when it lands).
