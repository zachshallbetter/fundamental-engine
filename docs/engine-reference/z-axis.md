> **Status: as-built engine reference.**
> Documents the optional z lane shipped in `@fundamental-engine/core`. The flat field (the
> default) is the canonical engine described in [forces-system.md](forces-system.md);
> this document defines exactly what changes — and what provably does not — when a
> field opts into depth.

# The Optional Z Axis

The engine simulates an optional third axis. It is **opt-in, additive, and inert by
default**: no API requires a z value, no author has to think about it, and a field
created without `depth` behaves bit-for-bit like the 2D engine always has. The z
axis is a *lane*, not a re-architecture — the same code paths, with a third
component that multiplies away to nothing in the flat default.

## The contract

Two halves, both enforced by `core/z-axis.test.ts`:

1. **Flat is exact.** With `depth: 0` (the default), `p.z`/`p.vz` are 0 (or absent),
   `env.dz` is 0, and every z term in every formula multiplies away to nothing.
   Positions, velocities, energy, conditions, and impulses match the pre-z engine
   exactly — not approximately. A particle constructed without z fields and one
   constructed with `z: 0, vz: 0` integrate identically.
2. **The volume works.** With `depth: D > 0`, matter seeds through `z ∈ [0, D)`,
   drifts and wraps toroidally in z, and is pulled back toward the **page plane** —
   bodies are DOM elements, they live at `z = 0` always — by the same falloffs that
   pull matter across the plane. The `c` velocity cap bounds the full 3D speed.

> **Kotlin/Android parity.** The JS engine is 2D because the DOM and Canvas are, so z is an opt-in
> lane bolted on. The native Kotlin port (`android/`), like the Swift port, is instead **3D-native**:
> every position, velocity, and force is a `Vec3` of `Float`. The *contract is the same* — **flat is
> the default and flat is exact**: at z = 0 every formula reduces to the JS math (same falloffs, same
> constants), and that reduction is held to the shared cross-plane conformance golden. In active
> development on the Android port branch — not a published release.

## Authoring

```js
// flat (default) — the 2D engine, unchanged
const field = mountField();

// a shallow volume behind the page — matter drifts through 300px of depth,
// rendered as a size/alpha recession (deeper = smaller + fainter)
const field = mountField({ depth: 300 });
```

That is the entire authoring surface. `burst(x, y)`, `flowTo(x, y)`, `atomAt(x, y)`
and every other call keep their signatures — the pointer and the blast live on the
page plane, and their effects extend into the volume automatically (a burst shoves
deep matter deeper; a deep dot is harder to pick than a surface one).

## Data model

| Field | Type | Meaning |
|---|---|---|
| `Particle.z`, `Particle.vz` | `number?` | position/velocity along depth. Absent ⇒ 0. The integrator normalizes them to concrete numbers on first touch. |
| `Particle.gz` | `number?` | the z scatter fraction for the `spread` formation. |
| `Env.dz` | `number?` | z leg of the particle→body vector = `0 − p.z` (bodies sit on the plane). |
| `Env.D` | `number?` | the volume depth; `0`/absent = flat. |
| `FieldOptions.depth` | `number?` | the opt-in. Clamped to `≥ 0`. |

All optional on purpose: existing code constructing `Particle`/`Env` literals — the
conformance harness, tests, downstream consumers — keeps compiling and keeps its
exact behavior.

## What is z-aware, and how

**Distance is 3D everywhere.** The integrator's body delta, the range cull, the
spatial hash's `near()` filter (bins stay planar; the distance test is true 3D),
sink absorption, density/thermo sampling windows, `atomAt`/`focusAt` picking, and
kinetic energy all use `dx² + dy² + dz²`.

**Radial forces gain a z leg** — the same unit-vector component as x and y, so the
falloffs are spherical: `attract`, `repel` (outward), `swirl` (the inward retention
only — the swirl itself is *about* the z axis), `jet` (the feed; the nozzle relaunch
resets to the plane), `tether` (a spherical shell), `gravity`/`charge` (the shared
inverse-square kernel), `propagate` (the outward front ride), `memory`.

**Neighbour forces are truly 3D**: `collide` (spheres, not discs — the impulse acts
along the 3D contact normal), `cohesion`, `pressure`, `link`, `hunt`, `align` (the
mean heading sums unit velocities in 3D).

**Restoring behaviors return matter to the plane**: `morph`'s spring (targets are
marks on the page), captured-matter drift and accretion release (the sink core is on
the plane), `fieldflow`'s steer (the structure field is planar, so the steer damps
vz onto the in-plane line).

**Deliberately planar** (each is a 2D phenomenon by definition, identical at any z):
`stream` (the heading is `data-angle`, in-plane), `wall` (an infinite slab in z —
the DOM box has no depth, so the membrane bounds x/y at every depth),
`magnetism`/`lens` (rotations *about* the z axis: vz is the rotation invariant),
`gate` (a planar membrane), `buoyancy` (lift is −y), `shear`, `crystallize`, `wind`
(the curl noise is a 2D streamfunction), the wave currents (§2.3), the scalar grids
(§20.1 [C] — field buffers are a surface phenomenon; `diffuse` deposits/follows at
the particle's (x, y) regardless of depth), and the modifiers
(`resonate`/`spotlight`/`screen` — scalar gates and multipliers).

**Volume-gated extras** (run only when `D > 0`, so the flat path never pays them):
z seeding, the brownian wander's z kick, `thermal`'s third Gaussian leg, the
`spread` formation's z target, and the toroidal z wrap.

**Render**: the `dots` mode recedes with depth — size and alpha scale by
`1 − min(|z|/D, 1)·0.55`. The factor is exactly 1 in a flat field. Other render
modes and the overlay readings draw the (x, y) projection unchanged.

**Conditions**: `fast`/`slow` read the full 3D speed (`vz` is 0 when flat).

## Conservation and safety

- The z lane changes no conserved quantity's *accounting*: count is untouched,
  capture/release resets z to the core's plane, and `burstImpulse`/`releaseCaptured`
  keep their golden contracts (extended with `vz: 0` in the flat case).
- The global `c` cap (§20.10) bounds `|v|` in 3D, so depth cannot smuggle energy
  past the speed limit.
- A NaN z behaves like a NaN x: the conformance safety sweep is the catcher — no
  new guards were added, because the lane uses the same code paths.
