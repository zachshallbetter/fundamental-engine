# Stability & convergence — what the field damps, and what it owns

> Fundamental is a **force** system, and force-based dynamics carry a well-documented canon of
> failure modes — non-determinism, local-minima trapping, oscillation, sensitivity to initial
> placement, and tuning brittleness. This document states, honestly and per-mechanism, which of
> those Fundamental **damps or side-steps by construction**, and which it **still owns**. The goal is
> not to claim immunity — it is to be the force system that names its own failure modes, points at
> the exact code that handles each, and tells you where the residual risk is.

The force-directed-layout literature is the right external mirror here: energy-minimization layouts
"[are] not deterministic," "the result varies depending on the initial state," "can get stuck in a
local minimum," and "some nodes … start oscillating around their balancing position"
([ForceAtlas2, Jacomy et al., PLoS ONE 2014](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0098679));
the reached energy "is only a local minimum … [which] can be considerably worse than a global
minimum … a low-quality drawing"
([force-directed graph drawing](https://en.wikipedia.org/wiki/Force-directed_graph_drawing)); and the
refinement phase "suffer[s] from high per-iteration costs for large graphs"
([arXiv:2412.20317](https://arxiv.org/pdf/2412.20317)). These are stable mathematical properties of
the method, not passing benchmarks. What follows is how Fundamental stands relative to each.

## What the field damps or side-steps by construction

### 1. Non-determinism → an injected, seeded PRNG

Force-directed layout is non-deterministic because it seeds from randomness and the trajectory depends
on it. Fundamental removes the stochastic source at the seam: every force that draws randomness
(`thermal`, `jet`, spawn scatter) reads `e.rng ?? Math.random`, and a field can be handed a **seeded
`Env.rng`** (a `mulberry32` PRNG — the same family the bench and the conformance runner use) instead
of the global `Math.random`. A seeded field replays bit-for-bit **within a plane**, with no global
monkey-patch (`packages/core/src/conformance/run.ts`). Determinism here is *engineered*, not assumed —
see [testing-and-conformance.md](./testing-and-conformance.md) for how the cross-plane golden compares
**physical properties within tolerance** (it does not, and cannot, assert bit-identical trajectories
across JS/Swift/Kotlin, because IEEE-754 does not mandate correctly-rounded transcendentals and the
forces traverse `sin`/`cos`/`log`/`pow`).

### 2. Oscillation and failure-to-settle → per-step velocity damping

An undamped spring/repulsion system rings. Fundamental damps every integration step: velocity is
multiplied by `FRICTION` (`0.95`) and carried heat by `HEAT_DECAY` (`0.972`) each step — applied as
`Math.pow(FRICTION, dt)` so the decay is frame-rate-independent (identical at the reference rate,
`dt === 1`). This is a dissipative thermostat: kinetic energy leaves the system continuously, so a
body driven toward a target settles rather than orbiting it forever. It does **not** eliminate
transient oscillation for an aggressively-tuned body (see *What the field owns*, below).

### 3. Local minima, initial-placement sensitivity, and global-layout quality → **the field does not lay out**

This is the load-bearing distinction, and it is why most of the force-directed failure canon simply
**does not apply** to the common case. A body's position is owned by its `authority`
([BodyAuthority](./dimensional-coupling.md); `packages/core/src/engine/types.ts`):

- **`anchored` (the default)** — the **DOM/host owns the position**. The field reads each body's
  measured box (`getBoundingClientRect`) and acts as a *behavior and feedback layer over an already
  good arrangement* that semantic HTML, flexbox/grid, or the native layout system produced. There is
  no layout to converge, no initial placement to be sensitive to, and no global energy minimum to
  land in a bad local copy of. The "low-quality drawing" problem is structurally absent.
- **`kinematic`** — the host moves the body; the engine reads it.
- **`dynamic`** — the engine owns position and velocity; the body integrates. **This is the only mode
  that is "laid out by forces," and it is the only place the force-directed convergence risks re-enter.**

So Fundamental gets the best of a good initial placement *for free* — the exact thing
[arXiv:2412.20317](https://arxiv.org/pdf/2412.20317) shows must otherwise be engineered to accelerate
convergence — precisely because it declines to be a layout engine.

### 4. Plausibility over accuracy → a deliberate, defensible integrator choice

Fundamental's integrator is not symplectic and does not conserve energy or momentum; particle
**count** is the one strong invariant (see the caveat canon in
[docs/research/README.md](../research/README.md) and [causality-and-truth.md](./causality-and-truth.md)).
This is standard real-time-graphics practice, not a defect: Dinev, Liu & Kavan state that in graphics
"we do not necessarily strive for accurate numerical solutions … but rather for physically plausible
results … the resulting motion needs to look right," and that energy-momentum-conserving methods "do
not always result in plausible simulations"
([Stabilizing Integrators for Real-Time Physics, ACM TOG 2018](http://www.tiantianliu.cn/papers/dinev18stabilizing/dinev18stabilizing.pdf)).
"Particle count is the invariant" is a *falsifiable, testable* honesty anchor — it is asserted in the
conformance suite, not merely claimed.

## What the field owns (the honest residual risk)

Naming what we damp is only credible if we also name what we do not.

- **`dynamic`-authority bodies inherit the convergence canon.** Any body the engine drives to a
  position can, with the wrong parameters, jitter, oscillate through a transient, or settle slowly.
  FRICTION damps this but does not remove it. If you drive layout with forces, you own force-directed
  behavior — including its transients.
- **Tuning brittleness is real.** `strength` / `range` / `spin` are authored per body, and the
  interactions are not always intuitive. The documented **attract+friction clump** failure (a
  persistent `attract`/`sink` body with no tangential component freezes matter into a static clump) is
  a concrete example: the mitigation is a swirl component (`data-spin >= 1.0`) *or* an ambient motion
  source, and it must be chosen deliberately. There is no auto-tuner.
- **Transient convergence cost.** Settling is more expensive than steady state; a page that spawns
  many `dynamic` bodies at once pays a transient. Performance claims must scope settling-vs-steady-state
  (see [performance.md](../engine-reference/performance.md)).
- **We do not detect swinging or adapt the timestep.** Unlike ForceAtlas2's swing-based adaptive speed,
  Fundamental relies on constant friction; there is no per-body instability detector. This is a
  deliberate simplicity choice, and a candidate area for future work.

## Arguments we deliberately do NOT make

To stay honest, these framings are **wrong** and are not used anywhere in Fundamental's docs or copy:

- **Not** "no fixed-timestep integrator can be symplectic *and* conserve energy *and* momentum, so our
  non-conservation is unavoidable." That impossibility argument is false; semi-implicit (symplectic)
  Euler exists and nearly conserves energy. We choose non-conservation for **plausibility**, not
  because we are forced to.
- **Not** "force-directed layout is cubic, O(n³)." Modern Barnes-Hut / multilevel methods are
  near-linearithmic; the cubic framing is outdated.
- **Not** any "unbounded-repulsion is a fatal flaw" framing borrowed from a specific competing force
  model — it does not describe Fundamental.

## See also

- [causality-and-truth.md](./causality-and-truth.md) — the truth modes and what a reading can honestly claim.
- [designed-vs-natural-map.md](./designed-vs-natural-map.md) — why *designed* forces are deliberately not physics.
- [testing-and-conformance.md](./testing-and-conformance.md) — the tolerance/property conformance model across planes.
- [wallpaper-rule.md](./wallpaper-rule.md) — real bodies + measured feedback, not painted decoration.
- [performance.md](../engine-reference/performance.md) — compute vs fill-rate, and how the numbers are measured.
- [docs/research/README.md](../research/README.md) — the caveat canon every paper respects.
