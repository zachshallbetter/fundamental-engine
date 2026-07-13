# Boids in 2026 — comparison & verdict (working material)

> **Status: working notes.** Pre-writing material for a planned paper + article positioning Fundamental
> against Reynolds' *Flocks, Herds, and Schools: A Distributed Behavioral Model* (SIGGRAPH '87). This is
> **not** the paper. It captures the cross-corpus read (canonical + engine-reference + research family,
> done 2026-06-29) and the honest "better / worse / something else" verdict that must precede any public
> claim. Sources: `docs/canonical/*`, `docs/engine-reference/forces-system.md`, `docs/research/01-08`,
> and the engine code (`packages/core/src`). Cross-refs the runtime/host catalog in
> [`platforms-and-use-cases-frontier.md`](platforms-and-use-cases-frontier.md).

## The one-line verdict

**Neither better nor worse — a different objective function, with honest wins and honest losses where
the objectives overlap.** Boids is a *validated technique* for a *narrow* problem (believable autonomous
aggregate motion in 3D). Fundamental is an *unvalidated framework* for a *broader* problem (legible,
reciprocal, inspectable interface behavior tied to semantics). It inherits Boids' vocabulary, declines
two of Boids' four core mechanisms, and gains reciprocity + explainability in return.

Calling one "better" is a category error **unless you fix the objective first.** So this doc fixes the
objective per axis and reports the verdict honestly — including the axes where Fundamental is genuinely
*worse*.

## What each system is actually optimizing

| | Boids (1987) | Fundamental (2026) |
|---|---|---|
| **Question** | "How do agents move *believably* in 3D?" | "How does an interface's *meaning* become perceivable + inspectable?" |
| **Substrate** | 3D space | semantic DOM (the field is a layer over real HTML) |
| **Influence** | one-directional (agents perceive the world) | **reciprocal** (bodies bend the field; the field bends them back) |
| **Agent role** | owns a **steering policy** (perceive → arbitrate → steer) | **consumes** an influence (force owns the influence; agent owns a consumption rule) |
| **Combination** | **prioritized acceleration allocation** under a per-agent budget | **linear superposition** (`v += F`, summed Δv), then clamp `\|v\|≤c` |
| **Output** | the motion *is* the product | motion is **one representation**; `render:'none'` runs the full sim drawing nothing |
| **Validation** | 39 years, films/games, matches zoological statistics | **no user studies yet** (caveat 6, restated every paper) |

## Per-axis verdict — better / worse / something else

| Axis | Verdict | Why (honest) |
|---|---|---|
| **Arbitration robustness** | **Boids better** | Reynolds rejects averaging precisely because opposing urges cancel ("fly northeast"). Fundamental sums — and the `attract+friction` **clump bug is literally that failure mode**: opposing forces annihilate, friction (0.95) freezes the residue. Boids' priority-allocation is strictly better *at not paralyzing*. |
| **Obstacle avoidance** | **Boids better** (for navigation) | Boids' steer-to-avoid uses look-ahead + lateral thrust. Fundamental's avoidance is overwhelmingly **radial** (`repel`/`charge`/`pressure`/`cohesion`/`wall`); only `swirl`/`lens` add tangential thrust, and there is **no look-ahead**. A body hit head-on by `repel` only *brakes* — Reynolds' "no side thrust." (But UI semantics rarely needs obstacle navigation; this axis only bites if you import Boids' goal.) |
| **Empirical validation** | **Boids better, decisively** | Boids is proven. Fundamental's empirical claims are **designs and hypotheses** (Papers 2–3 are study *protocols*, no results). A 2026 paper must own this; pretending parity here would be dishonest. |
| **Force-law honesty** | **Fundamental better / novel** | Reynolds *picks* one law (switched spring→inverse-square). Fundamental **ships both registers and refuses to unify them** — bounded `(1−d/r)ⁿ` for designed verbs, softened inverse-square for `gravity`/`charge` — and makes the choice a first-class concept (truth modes; "`attract` is NOT gravity"). It encodes as a labeled lane the decision Reynolds made silently. |
| **Explainability** | **Fundamental — something Boids never attempted** | `causality` replays any motion as a sum of per-force Δv ("moved 0.61 from `attract`, 0.24 from `swirl`"). `prediction`/`ghostTrajectory` forward-integrates. Boids has none. **But this win is *enabled by* the very summation that loses the arbitration axis** — explainability and the clump are the same coin. |
| **Reciprocity & scope** | **Fundamental — a generalization** | Boids agents feel the world but don't change it. Fundamental bodies bend the field back, and "boid = particle + behavior" becomes "7 agent kinds consume one influence differently." More general — but generality isn't "better"; Boids' narrowness is *what makes it provably good at its one job.* |
| **The three flocking rules** | **Parity (vocabulary), divergence (mechanism)** | `align` (= "boids alignment" in its passport), `cohesion` ("boids cohesion"), separation (`pressure`/`repel`) all ship. `addAgent` vehicles feel them. But they're **summed, never prioritized** — Boids' rules with Boids' arbitration deliberately removed. |

## The deepest finding (the paper's spine)

**Explainability and arbitration are in direct conflict.** Fundamental's signature explainability
(`causality`, `prediction`) works *only because forces sum linearly*. Adopting Reynolds' prioritized
allocation would fix the clump **and destroy the per-force attribution that the explainability thesis
depends on.** You cannot naively have both.

The single contract-legal path that buys arbitration-like behavior *without* breaking attribution is a
**modifier-class force** (the `screen` template — multiplicatively scale siblings; `causality` can still
attribute Δv after scaling). This is not a workaround; it is the *only* design that preserves the thesis.

## The 2026-specific angle (why this is worth a paper now, not just a retrospective)

Boids was about **generating motion** — in 1987 the point *was* the picture. Fundamental's signals-first
default (`render:'none'`, #538) inverts this: **the behavioral model runs as a computation/state
substrate, and motion is optional.** A headless renderer, an a11y channel, or an autonomous agent
consumes the *same field state* with no motion at all. Reynolds could not have framed a behavioral model
this way in 1987 because rendering *was* the deliverable. In 2026 the picture is one representation among
many. That inversion — **behavioral animation as substrate, not spectacle** — is the strongest novel
thesis the comparison yields.

Secondary angles: reciprocity as a generalization of one-directional perception; the truth-mode dualism
as an answer to "which force law?"; explainable emergence ("why did it flock?") that Boids' black-box
emergence can't offer.

## Honest losses to state plainly in the paper (the caveat canon, applied)

1. Mass is nominal by default (`v += F`, unit mass); first-class inertia is opt-in.
2. Energy not conserved (friction/heat decay, by design).
3. Momentum only partially conserved (pairwise in `collide`; ambient field damped).
4. Designed forces are not natural laws — *deliberately* (bounded falloff vs inverse-square).
5. **Particle count is the one strong invariant.** Boids conserves momentum by construction; Fundamental does not.
6. **No user-study results exist yet.** Every empirical claim is a hypothesis until a study runs.

## Captured improvement items (tracked on RC1 board #24)

These fell out of the comparison and are filed as Backlog briefs:

- **`flock` experimental pattern / Lab demo** — `addAgent` + `align` + `cohesion` + separation. Nearly
  free; makes the `/eli5` "three rules and it flocks" promise literally runnable. (Pattern canon is
  locked → `EXPERIMENTAL_PATTERNS`, never the 64.)
- **Spike: arbitration as a modifier-class force** — Reynolds-style priority/budget that preserves
  per-force attribution. The only explainability-safe path.
- **Spike: `steer`/`avoid` force fed by `ghostTrajectory`** — the look-ahead already exists (diagnostic);
  feeding it back into a tangential force risks a prediction↔force feedback loop. Agent-navigation only.
- **Canon principle: "radial brakes, tangential routes"** — added to the field-behavior table; the
  `swirl`/`lens` deflector fix independently rediscovered Reynolds' "no side thrust" lesson.

## Resolved factual notes

- **Neighbor lookup is already binned.** `FieldStore.neighbors()` is backed by a `SpatialHash`
  (`packages/core/src/engine/spatial-hash.ts`, cellSize 64, rebuilt once per frame), not brute force. So
  **Reynolds' lattice-binning performance lesson is already absorbed** — the O(N²) flocking cost he
  warned about does not apply to Fundamental's pairwise forces. One fewer axis of difference; an
  unforced point in Fundamental's favor (it independently arrived at his spatial-partition answer).
