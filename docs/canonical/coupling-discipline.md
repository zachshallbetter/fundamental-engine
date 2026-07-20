> **Status: canonical.**
> How to connect a system to the field **at scale** — the rung discipline, the sampling cadences, and
> when *not* to make something a body. Measurements live in
> [`../engine-reference/performance.md`](../engine-reference/performance.md); this document is the
> decision procedure that sits on top of them. Related:
> [`platform-architecture.md`](platform-architecture.md), [`system-contracts.md`](system-contracts.md).

# Coupling discipline

This is not theory. It was arrived at independently by two consumer projects — an ecological
simulation and an operational airspace tracker — that each hit the same wall and each converged on the
same rule. It is written down here because both had to discover it from scratch.

## The rule

> **Couple through the field, but at the lowest rung that achieves the effect.**

Adding or moving a body forces field work. Most things that *look* like they want to be bodies do not
need to be — they need to *read* the field, which is far cheaper. Reserve emission for the few
elements whose presence must change what everything else does.

---

## The three rungs

### Rung 1 — published global signals

One value computed once per frame and read by everything.

**Use when** the effect is uniform across the scene: a time-of-day term, a global wind vector, an
ambient pressure that shifts every actor's baseline.

**Cost:** one write, N cheap reads. This is nearly free and is the correct home for anything that does
not vary by position.

### Rung 2 — local sensing (sample and cache)

A moving agent asks the field what conditions are *at its own coordinates*, then interpolates between
samples.

**Use when** an actor must react to local conditions but need not change them — an aircraft reading
wind, a particle reading density, a cursor reading attention.

**Cost:** one sample per agent per *sampling interval*, not per frame. The interval is the whole point:
sample at 8Hz, cache, and interpolate on the render tick. The engine already does this internally —
body re-measurement runs on a **6-frame cadence**, and the quality governor stretches it to every 2nd
frame at tier 2 and every 4th at tier 3 under load.

**This is where most systems belong**, and where most systems mistakenly reach for rung 3.

### Rung 3 — persistent field emitters

A body that alters the field, changing how everything else behaves.

**Use when** the element's *presence* is the point: an attractor that pulls, a repulsor that deflects,
a sink that absorbs.

**Cost:** the highest, and it scales with count. Reconcile only when state actually changes — never
rebuild an emitter per frame because its position moved a subpixel.

---

## Choosing a rung

| The thing… | Rung | Why |
|---|---|---|
| affects everything uniformly | **1** | position-independent, so a body buys nothing |
| reacts to local conditions | **2** | reading is orders of magnitude cheaper than emitting |
| changes what others do | **3** | only emission propagates through the field |
| is a high-frequency data point | **none** | keep it in your own arrays — see below |

## When not to use the field at all

The field models **interface behaviour** — elements responding to each other in a composed layout.
It is not a general simulation substrate, and pushing high-frequency telemetry through it is a
category error rather than a performance bug.

If you have hundreds of moving data points whose motion is determined by *your* domain math — flight
paths, market ticks, sensor streams — keep them in plain arrays and render them directly to instanced
geometry. Couple to the field only where the two genuinely meet: an attractor at a destination, a
repulsor at a hazard, an attention term on selection.

**For WebGL scenes specifically**, [`@fundamental-engine/three`](../../packages/three) runs the engine
headless and renders its swarm as a `THREE.Points` layer, so field coupling and instanced telemetry
coexist without either passing through the DOM.

## What the field costs, measured

From [`performance.md`](../engine-reference/performance.md): the field is **fill-rate-bound, not
particle-bound**. Drawing dominates; the math has enormous headroom — body re-measurement amortizes to
roughly **1ms against a 16.7ms frame budget** across the density sweep, with no per-6th-frame spike.

The practical consequence: adding bodies is rarely what makes a scene slow. Drawing them is. Reach for
resolution and overdraw before you reach for body count.

## Reproducibility

Anything built on rungs 2 or 3 that must replay identically has to respect the runtime's determinism
envelope. Read it from the handle rather than inferring it:

```js
field.guarantees
// → { determinism: 'conditionally-deterministic',
//     controlledInputs:   ['injected-rng', 'clock'],
//     uncontrolledInputs: ['host-geometry', 'body-ordering'],
//     requirements: [...], crossPlaneTolerance: 1e-6 }
```

`host-geometry` being uncontrolled is the one that surprises people: a scene replayed at a different
viewport size is not guaranteed to reproduce. Pin geometry, inject the RNG, and hold `dt === 1` if
replay parity matters. Cross-plane agreement is a **tolerance**, never bit-equality.
