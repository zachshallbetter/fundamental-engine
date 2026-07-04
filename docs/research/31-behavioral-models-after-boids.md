# Substrate, Not Spectacle: Behavioral Models After Boids

> **Status: research draft (preprint, work in progress).** Paper 31 of the Fundamental family — a
> comparison/positioning paper, not an empirical study. It situates Fundamental's relational field
> runtime against Reynolds' 1987 distributed behavioral model ("Boids"). Claims verified against the
> codebase and canonical docs as of 2026-07-01 (re-verified after the 0.9.x substrate line; see §9 and
> Appendix A). See the [series index](README.md) and *the caveat
> canon* therein. This is a preprint draft, not canonical product documentation; where the code and a
> claim disagree, the code wins.

**Author:** Zach Shallbetter
**Series:** Fundamental Research Papers, Paper 31 (comparison / positioning)
**Primary comparand:** C. W. Reynolds, *Flocks, Herds, and Schools: A Distributed Behavioral Model*,
SIGGRAPH '87 `[reynolds1987]`.
**Working material:** [`docs/planning/boids-2026-comparison.md`](../planning/boids-2026-comparison.md)
(the per-axis verdict this paper formalizes).

---

## Abstract

In 1987 Craig Reynolds showed that the aggregate motion of flocks, herds, and schools need not be
scripted: it emerges when each agent ("boid") follows a few local steering rules. Boids has since
become the canonical distributed behavioral model in computer graphics. We revisit it from the
vantage of **Fundamental**, a platform-native relational field runtime for the DOM in which interface
elements become *bodies* in a shared physics field. Fundamental inherits Boids' vocabulary almost
verbatim — its `align`, `cohesion`, and separation forces are documented in code as "boids alignment"
and "boids cohesion" — and reproduces emergent flocking from local neighbor coupling. Yet it
**declines two of Boids' four defining mechanisms**: prioritized acceleration allocation (it sums
forces linearly instead) and predictive steer-to-avoid (its avoidance is overwhelmingly radial). We
argue this is not a deficiency but a different objective function, and we report the trade honestly,
per axis, including where Fundamental is genuinely *worse*.

We make three contributions. First, a **like-for-like comparison** of the two systems grounded in
source, distinguishing shared mechanism (local neighborhoods, the three rules, spatial-hash
neighbor lookup) from genuine divergence (arbitration, avoidance, force law, conservation).
Second, a **design-theoretic result**: in a behavioral runtime, *per-force explainability and
Reynolds-style prioritized arbitration are mutually exclusive*, because both hinge on whether forces
combine by linear superposition. Fundamental's diagnostics (`causality`, `prediction`) can replay any
motion as a sum of per-force contributions *only because* forces superpose — the same property that
admits the "fly northeast" cancellation Reynolds engineered against. Third, a **reframing**: Boids
generated motion as the deliverable; Fundamental's signals-first default (`render: 'none'`) runs the
full behavioral model while drawing nothing, so motion becomes one representation among many and the
model becomes a *computation and state substrate* consumed by headless renderers, accessibility
channels, and autonomous agents alike. We name this shift **substrate, not spectacle** and argue it
is the most consequential thing that happens to behavioral animation when it moves from 3D character
motion to semantic interface behavior. We are candid throughout about Fundamental's limitations,
foremost that — unlike Boids, which is validated by decades of use and zoological agreement — its
interface-level claims are not yet backed by controlled user studies.

---

## 1. Introduction

A flock of starlings is the standard demonstration that complex, coordinated motion can arise without
a choreographer. Reynolds' insight `[reynolds1987]` was to model the *member*, not the flock: give
each simulated bird a localized view of its neighbors and a few steering urges, and the flock falls
out of their interaction. The paper is foundational not only for its result but for its method — it
names *behavioral animation*, in which the animator becomes a "meta-animator" who designs behavior and
is then *surprised* by the motion it produces.

Fundamental is, on its face, a very different artifact: a runtime that lets DOM elements participate
in an invisible physics field so that a page's *meaning* — what is important, what relates to what,
what is contested, what is stale — becomes perceivable and inspectable, while the semantic HTML stays
the source of record. But the two systems are close cousins. Fundamental's substrate is a particle
system enriched with interaction, which is precisely how Reynolds defines a boid: "a slight
generalization of particle systems" in which dot-like particles gain orientation and, crucially,
*interaction with external state* `[reynolds1987]`. Fundamental's force catalog includes `align`,
`cohesion`, and separation forces whose in-source documentation literally reads "boids alignment" and
"boids cohesion" (`packages/core/src/contracts/passport.ts`). Its public explainer teaches emergence
with the three rules — *"face the same way as your neighbours, stay close, don't bump"* — and the
caption *"Three rules, and it flocks"* (`apps/site/src/pages/eli5.astro`).

So the question is not whether Fundamental can do Boids — it can, and nearly for free (§7.2). The
interesting questions are: **where do the two systems agree, where do they diverge, and is
Fundamental's version better, worse, or something else?** This paper answers all three from source,
and uses the answer to surface a result about behavioral-model design (§6) and a reframing of what a
behavioral model is *for* in 2026 (§7).

We are explicit about register. This is a systems-and-theory comparison, not a user study.
Fundamental's empirical interface claims (orientation, trust, explainability) are the subject of other
papers in this family and remain hypotheses until studies run (§9). Boids, by contrast, is validated:
replicated widely, used in film and games for decades, and in agreement with reported statistics of
natural flocks `[reynolds1987]`. Any verdict in this paper respects that asymmetry.

## 2. Background: Boids and the behavioral-animation lineage

Reynolds' model has four mechanisms that matter for our comparison.

**(B1) Local perception.** Each boid reacts only to neighbors within a bounded zone of sensitivity;
the flocking *depends* on this locality. A central-force model, in which every member is pulled toward
a global centroid, produces the unnatural artifact of the whole flock converging in unison
`[reynolds1987]`. Locality is the feature, not a limitation.

**(B2) Three steering rules.** In decreasing precedence: *collision avoidance* (separation),
*velocity matching* (alignment), and *flock centering* (cohesion). Each produces a candidate
acceleration.

**(B3) Arbitration by prioritized acceleration allocation.** Reynolds is emphatic that the rules must
**not** be combined by weighted average: opposing urges cancel, the boid makes a tiny turn, and flies
into the obstacle — *"while 'fly north' or 'fly east' might be good ideas, it would be a bad idea to
combine them as 'fly northeast.'"* Instead a fixed acceleration budget is *parceled out by strict
priority*; the most urgent rule is satisfied first, and low-priority urges go unmet in a crisis. This
is the paper's sharpest engineering claim.

**(B4) Steer-to-avoid, not force fields.** For obstacle avoidance Reynolds compares two schemes and
prefers predictive *steer-to-avoid* — find the silhouette of the obstacle on the projected path and
aim past it — over a radial repulsion *force field*, which he calls inferior: hit head-on, a radial
field *"serves only to slow the [agent]... provides no side thrust at all. The worst reaction to an
impending collision is to fail to turn."*

Two further details recur below: boids conserve momentum by construction and bound speed by a max-speed
plus *max-acceleration truncation*; and the naive algorithm is O(N²), which Reynolds proposes to reduce
with spatial bucketing (a lattice of bins).

## 3. Two objective functions

The single most important framing move is to refuse a flat "better/worse." Boids and Fundamental
optimize different objectives, and most axes are incommensurable until the objective is fixed.

| | Boids (1987) | Fundamental (2026) |
|---|---|---|
| **Question** | How do agents move *believably* in 3D? | How does an interface's *meaning* become perceivable + inspectable? |
| **Substrate** | 3D space | semantic DOM (the field is a layer over real HTML) |
| **Influence** | one-directional (agents perceive the world) | **reciprocal** (bodies bend the field; the field bends them back) |
| **Agent role** | owns a **steering policy** (perceive → arbitrate → steer) | **consumes** an influence (the force owns the influence) |
| **Combination** | **prioritized allocation** under a per-agent budget | **linear superposition** (`v += F`), then clamp `\|v\| ≤ c` |
| **Output** | the motion *is* the product | motion is **one representation** (`render: 'none'` draws nothing) |
| **Validation** | decades; matches zoological statistics | **no user studies yet** |

Boids' objective is narrow and well-defined, which is exactly what lets it be *provably good at its
job*. Fundamental's is broad and semantic, which is what makes a flat comparison a category error. The
rest of the paper fixes the objective per axis.

## 4. Shared mechanism

Before the divergences, the agreements — which are substantial and, in two cases, exact.

**The three rules ship, by name.** Velocity-matching is the `align` force, documented in its passport
as "neighbour velocity averaging (boids alignment)"; cohesion is `cohesion` ("boids cohesion");
separation is carried by `pressure`/`repel` and the integrator's per-particle spacing pass. These are
not loose analogies imposed after the fact; the source names Reynolds' rules directly
(`packages/core/src/contracts/passport.ts`, `packages/core/src/forces/extended.ts`).

**Locality is via neighborhood, and the neighborhood is spatially hashed.** Fundamental's
neighbor-coupling forces query `env.neighbors(p, r)`, backed by a `SpatialHash` (cell size 64, rebuilt
once per frame; `packages/core/src/engine/spatial-hash.ts`, `field-store.ts`). Reynolds' O(N²)→lattice
optimization (B1's perception, his §"Algorithmic Considerations") is therefore *already absorbed*:
Fundamental independently arrived at his spatial-partition answer, so the quadratic flocking cost he
warned about does not apply to its pairwise forces.

**Emergence is treated as emergent.** Fundamental's spec explicitly lists flocking among "behaviors
that *arise* from primitives + initial conditions, never coded as forces"
(`docs/engine-reference/forces-system.md` §20.1), and its public explainer stages it as "simple rules
→ a flock." This is Reynolds' meta-animator stance — author behavior, observe motion — applied to
interface semantics. Fundamental's slogan "concepts describe, tokens execute" is the same division of
labor, and it inherits the same risk: emergent results can look *wrong*, which is why the project's
engineering practice mandates visual verification of any field change.

So Fundamental is Boids' descendant on (B1) and (B2). The divergence is entirely in (B3) and (B4).

## 5. Divergence, per axis — better, worse, or something else

We fix the objective per axis and report the verdict, including the losses.

**Arbitration — Boids better.** Fundamental sums forces: the integrator walks each body's tokens and
accumulates every force's Δv onto one velocity, then applies friction (`FRICTION = 0.95`) and clamps
`|v| ≤ c` (`packages/core/src/engine/integrator.ts`). There is no priority and no per-agent budget. The
conformance suite states the contract plainly — `attract swirl` "composes to the **sum** of the parts"
(`docs/engine-reference/forces-tests.md`). This is precisely the weighted combination Reynolds
rejected, and its failure mode is observable: stacking `attract` against a radial `repel`/separation
makes bodies *clump and freeze*, because the opposing radial urges cancel under superposition and
friction bleeds the residue to zero. The clump is the "fly northeast" cancellation, in the field. On
this axis Reynolds' prioritized allocation is strictly better at *not paralyzing*.

**Avoidance — Boids better (for navigation).** Fundamental's avoidance is overwhelmingly **radial**:
`repel`, `charge`, `pressure`, `cohesion`'s short-range push, the `wall` reflector. Only `swirl`
(≈8× tangential to 0.12 inward) and `lens` (speed-preserving path rotation) add lateral thrust, and
**nothing looks ahead** — even `hunt` flees the *current* nearest position. A body driven head-on into
`repel` only decelerates: Reynolds' "no side thrust," exactly (B4). Tellingly, Fundamental's own
remedy for clumping is "use swirl-only deflectors" — a *tangential* fix — which independently
rediscovers the steer-to-avoid insight that radial fields cannot route, only brake. We name the
principle in the canon as *radial brakes, tangential routes*
(`docs/canonical/fundamental-field-behavior-table.md`). For obstacle *navigation*, Boids' predictive
lateral steering is better; but interface semantics rarely needs navigation, so this axis only bites
if Boids' goal is imported.

**Force law — Fundamental more honest.** Reynolds *picked* a law: he switched the attraction/repulsion
metric from a linear spring (bouncy, cartoony) to softened inverse-square (natural, better damped),
citing fish-school data. Fundamental ships **both registers and refuses to unify them**: designed
verbs (`attract`, `repel`) use a bounded `(1 − d/r)ⁿ` falloff that vanishes at range; the natural
primitives (`gravity`, `charge`) use softened inverse-square `F = GM·r̂/(d² + ε²)`. The difference is
labeled by a *truth mode*, with the canon rule "`attract` is NOT gravity"
(`docs/canonical/natural-fields.md`, `passport.ts`). Fundamental encodes as a first-class concept the
choice Reynolds made silently; on this axis it is the more expressive system.

**Conservation — different by design.** Boids conserves momentum by construction. Fundamental conserves
**particle count and nothing else** by design: mass is nominal by default (`v += F`, unit mass), energy
decays through friction and heat, momentum is conserved only pairwise in `collide`
(`docs/research` caveat canon; `forces-system.md` §21). It is a *driven, damped* field, not a closed
system. Neither is "better"; they promise different invariants.

**The three rules — parity in vocabulary, divergence in mechanism.** `align`, `cohesion`, and
separation all ship and an `addAgent` vehicle feels them (§7.2) — but they are summed, never
prioritized. Fundamental has Boids' rules with Boids' arbitration deliberately removed.

The honest scorecard: Boids is better at arbitration robustness and obstacle navigation and is
incomparably better *validated*; Fundamental is more honest about force law, conserves a different
(smaller, explicit) invariant set, and — as the next two sections argue — buys two things Boids never
attempted.

## 6. The central result: explainability and arbitration are mutually exclusive

Fundamental's signature is that the same state that *drives* a behavior can be *read back* to explain
it. The `causality` diagnostic fires a probe through each force's `apply()` and records the Δv each
token contributes, yielding statements like "this matter moved 0.61 because of `attract`, 0.24 because
of `swirl`, 0.15 because of `magnetism`"; `prediction`/`ghostTrajectory` forward-integrates by
"summing each (force, body) Δv per step" (`docs/research/08-explainable-interface-behavior.md`;
`forces-system.md` §20). This per-force attribution **works only because forces combine by linear
superposition.** Attribution is the decomposition of a sum into its addends; remove the sum and the
decomposition has no referent.

This yields a design-theoretic claim with teeth:

> **In a behavioral runtime, per-force explainability and Reynolds-style prioritized arbitration are
> mutually exclusive.** Prioritized allocation replaces the sum with a priority-ordered, budget-truncated
> selection in which low-priority forces contribute *zero* in a crisis. There is no longer a fixed
> linear combination to attribute, and "it moved 0.24 because of `swirl`" becomes ill-defined whenever
> the budget clips.

The two properties are the same coin. The clump bug (a cost) and the explainability story (a
differentiator) are *both* consequences of linear superposition. One cannot naively adopt Reynolds'
arbitration to fix the clump without forfeiting the attribution that makes the field inspectable.

This is not a counsel of despair. The contract-legal path that preserves attribution is a
**modifier-class force**. Fundamental already ships modifiers (`screen`, `spotlight`, `resonate`) that
*multiplicatively scale or gate* sibling forces in the integrator pass without breaking the sum — and
`causality` can still attribute the post-scaling Δv. A priority/budget arbiter built as a modifier
(scale competing forces by an urgency-derived gain rather than averaging them) is therefore the only
design that buys arbitration-like robustness while keeping the behavioral model explainable. We do not
claim to have built it; we claim the explainability constraint *determines its shape*. (Tracked as a
spike on the project's RC1 board.)

## 7. Substrate, not spectacle

### 7.1 The inversion

In 1987 the deliverable *was* the picture: a behavioral model existed to produce frames of motion.
Fundamental's default inverts this. Since the signals-first change, a field created without an explicit
render mode runs the **full simulation and writes its state** while **drawing nothing** (`render:
'none'`; `feat/signals-first-default`, canon `platform-architecture.md`). Motion — particles
travelling, glows, trails — is one *representation* of field state, selected above the physics, not
the physics itself. A headless renderer, a server-side pre-settle, an accessibility channel that maps
density to text, and an autonomous agent that probes the field all consume the **same** state with no
motion at all (`docs/research/01,04,05`).

Reynolds could not have framed a behavioral model this way, because in his setting rendering was the
point. In 2026 it is one surface among several. We call this **substrate, not spectacle**: the
behavioral model as a reusable computation-and-state layer, of which animation is an optional view.
This is, we argue, the single most consequential thing that happens to behavioral animation when it
moves from generating 3D character motion to expressing interface meaning — and it is the strongest
reason this comparison is a 2026 paper rather than a retrospective.

### 7.2 Boids, nearly for free — and the consume-vs-steer inversion

The substrate framing also resolves a practical question. Fundamental's `addAgent` creates "a particle
with a report hook" that "lives in the pool, so it feels every force the swarm feels: not only body
forces but the particle-level ones (`hunt`, `align`, `cohesion`) that act *between* particles," with
its own `maxSpeed` clamp and edge-bouncing (`forces-system.md` §22.8). An `addAgent` vehicle is thus
already exposed to all three flocking rules: a literal Reynolds flock is buildable from shipped parts,
with no new engine code.

But note *how* it flocks. The agent **consumes** a summed impulse; it does not run a steering policy.
This is the deep inversion: in Boids the **agent owns the steering** (perceive → arbitrate → steer); in
Fundamental the **force owns the influence and the agent owns a consumption rule** — "a force does not
'move particles'... whatever sits there decides how to consume it"
(`docs/canonical/agent-consumption-model.md`). Emergent flocking is therefore free, but *true* Boids
steering — an agent arbitrating its own competing urges — is exactly the capability the consumption
model omits by design. The frontier question is not "can Fundamental flock" (it can, emergently) but
"does it want agents that arbitrate," which is a different architectural commitment, not a feature.

A related observation: the look-ahead that steer-to-avoid (B4) needs *already exists* as a diagnostic —
`ghostTrajectory` forward-integrates each agent's path — but it is "decoupled from the physics" (a draw
pass). The raw material for predictive avoidance is computed and merely rendered; feeding it back into a
tangential steering force is cheaper than building prediction anew, though it introduces a
prediction↔force feedback loop that Reynolds sidesteps precisely *because* his steer-to-avoid is
priority-arbitrated rather than summed (§6). The pieces interlock.

## 8. Reciprocity as generalization

One axis remains, and it is where Fundamental is most clearly *not* a lesser Boids but a broader one.
Boids agents perceive the world but do not change it; influence is one-directional. Fundamental's
organizing principle is reciprocal: bodies bend the field and the field's local density bends them back,
and the loop closes through the DOM as feedback (CSS variables, thresholded events). "Boid = particle +
behavior" generalizes to "seven agent kinds consume one influence differently"
(`docs/canonical/agent-consumption-model.md`). The system is therefore a *reciprocal, multi-agent,
self-explaining* generalization of the 1987 model — with the explicit caveat that generality is not
superiority: Boids' narrowness is what makes it provably good at its one task, and Fundamental's breadth
is what leaves its interface claims still to be proven.

## 9. Limitations and honesty

Per the family's caveat canon (`docs/research/README.md`):

1. **Mass is nominal by default** (`v += F`); first-class inertia is opt-in.
2. **Energy is not conserved** (friction + heat decay, by design).
3. **Momentum is only partially conserved** (pairwise in `collide`; the ambient field is damped).
4. **Designed forces are not natural laws — deliberately** (bounded falloff vs inverse-square).
5. **Particle count is the one strong invariant.** Boids conserves momentum; Fundamental does not.
6. **No user-study results exist yet.** Every interface-level empirical claim is a hypothesis until a
   study runs. Boids' validation is decades deep; Fundamental's is not. No verdict in this paper
   should be read as claiming empirical parity.

Limitations 1 and 3 are the momentum gap, and the `0.9.x` substrate line has begun building its
*foundation* — per-force attribution through one canonical path (`applyAndRecord`), an opt-in
fixed-timestep integrator, and dynamic body-authority with recoil under the net field — without
disturbing the calm damped default. The limitations themselves still stand: mass is nominal and the
ambient field is damped, both by design. What remains genuinely unshipped is momentum *proper* — the
Newtonian own-emission reaction (a body recoiling from what it emits) and first-class mass — the subject
of the companion note *"The Bats Had Momentum."*

Specific to this comparison: the "clump" failure (§5) is described from the engine's behavior and the
project's own engineering notes, not from a controlled benchmark; a quantitative characterization of
when summation cancels (as a function of force geometry and friction) is future work. The
modifier-class arbiter (§6) is argued to be *possible and shape-determined*, not demonstrated.

## 10. Discussion

The comparison sharpens a general point about behavioral models: **the combination rule is a
load-bearing design decision, not an implementation detail.** Reynolds chose prioritized allocation and
got robustness at the cost of legibility (a boid cannot tell you why it turned, only that it did).
Fundamental chose superposition and got legibility at the cost of robustness (it can attribute every
motion, but opposing urges can cancel). Neither is free; the choice should be made deliberately and
named. Most particle and UI-animation systems make it by default — they sum — without acknowledging
that they have thereby inherited the "fly northeast" pathology and forfeited nothing they were tracking.
Fundamental at least makes the trade visible and recoverable (the modifier path).

The substrate reframing (§7) suggests a research program beyond this paper: if a behavioral model's
state is the product and motion is a view, then the interesting evaluation questions are not only "does
it look right" but "is the state legible, accessible, and useful to a non-visual consumer" — questions
the rest of this family takes up for interfaces specifically, and which a 2026 reading of Boids invites
for behavioral models generally.

## 11. Conclusion

Fundamental is best understood as a **reciprocal, explainable, semantic generalization** of the
distributed behavioral model Reynolds introduced in 1987. It inherits Boids' local-neighborhood
perception and its three steering rules — by name — and even absorbs its spatial-partitioning
performance lesson. It declines Boids' prioritized arbitration and its predictive steer-to-avoid, and
it pays for those omissions in exactly the failure modes Reynolds engineered against: cancellation
(the clump) and brake-don't-route avoidance (no side thrust). In return it gains two things Boids
never sought: per-force explainability — which we show is *not separable* from the superposition that
causes the clump — and a signals-first posture in which the behavioral model is a computation
substrate and motion is optional. Better, worse, or something else? On arbitration and obstacle
navigation, and on validation, Boids is better. On force-law honesty, reciprocity, and explainability,
Fundamental does something Boids did not attempt. The honest answer is *something else* — a behavioral
model repurposed from spectacle into substrate — and the disciplined way to read that answer is to
keep the asymmetry in validation in full view until the studies are run.

## Appendix A. Reproducibility and verification

Every claim above is checkable against source as of 2026-07-01 (re-verified after the `0.9.x` substrate
line; the paper's arbitration/explainability analysis is unchanged — the **default** is still linear
summation, and the additions below are opt-in):

- **Linear summation:** `packages/core/src/engine/integrator.ts` (token loop, `v += F`, `FRICTION = 0.95`,
  `|v| ≤ c`); `docs/engine-reference/forces-tests.md` (`attract swirl` = sum of parts).
- **Opt-in fixed-timestep integrator + per-force attribution (0.9.x):** `integrator.ts`
  (`applyAndRecord` — every force's contribution captured through one canonical path across five
  channels; `createField({ integrator: 'fixed' })`). Realizes "forces *produce* forces" without changing
  the default; the foundation the momentum limitations (§9.1, §9.3) sit on top of.
- **Body-authority modes + dynamic recoil (0.9.x):** `data-authority` / `Body.authority`; a `dynamic`
  body is engine-owned and recoils under the net field (`moveDynamicBodies`). Progress toward — not
  yet — the Newtonian own-emission reaction §9 names as unshipped.
- **No max-acceleration truncation:** the only clamp is on velocity (`c`), never on Δv — `integrator.ts`.
- **Boids rules in source, by name:** `packages/core/src/contracts/passport.ts` (`align` = "boids
  alignment", `cohesion` = "boids cohesion"); `packages/core/src/forces/extended.ts`.
- **Spatial-hash neighbors:** `packages/core/src/engine/spatial-hash.ts`, `field-store.ts` (cell size 64,
  per-frame rebuild).
- **Radial vs tangential avoidance:** `packages/core/src/forces/index.ts` (`repel`, `swirl`),
  `extended.ts` (`lens`); canon principle in `docs/canonical/fundamental-field-behavior-table.md`.
- **Explainability via superposition:** `docs/research/08-explainable-interface-behavior.md`;
  `forces-system.md` §20 (`causality`, `prediction`).
- **`addAgent` vehicle:** `forces-system.md` §22.8; agent-consumption model in
  `docs/canonical/agent-consumption-model.md`.
- **Signals-first / `render: 'none'`:** `docs/canonical/platform-architecture.md`; `docs/research/01,05`.
- **Truth modes / force-law dualism:** `packages/core/src/contracts/passport.ts`;
  `docs/canonical/natural-fields.md`.
- **Per-axis verdict (working notes):** `docs/planning/boids-2026-comparison.md`.

## Appendix B. Conversion notes (markdown → preprint)

This paper is comparison/positioning, not an empirical study; it has no user-study section by design
(§9). On conversion to LaTeX it joins the family bibliography (`references.md`); the Reynolds entry is
`[reynolds1987]`. Figures, if added, should be limited to (a) the per-axis verdict table (§5) and (b) a
schematic of summation vs. prioritized-allocation arbitration (§6) — the paper's two load-bearing
visuals.
