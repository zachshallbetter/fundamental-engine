# Substrate-architecture frontier

> **Status: exploration / working notes.** A forward-looking map of the engine-internals we should
> begin rethinking as Fundamental shifts from *DOM decoration* to a *physical/behavioral substrate that
> renders to DOM*. Nothing here is shipped. Each layer has (or will have) a **draft brief on the RC1
> board** ([#24](https://github.com/users/zachshallbetter/projects/24), Status `Backlog`). Companion
> docs: the runtime/host axis in [`platforms-and-use-cases-frontier.md`](platforms-and-use-cases-frontier.md);
> the Boids verdict that surfaced momentum in [`boids-2026-comparison.md`](boids-2026-comparison.md) and
> research [Paper 31](../research/31-behavioral-models-after-boids.md). The canonical possibility space
> is [`../canonical/field-possibilities.md`](../canonical/field-possibilities.md) — §"What this unlocks"
> below maps each rethink to the frontier capabilities it makes buildable. The **critical-path specs**
> for the next substrate program — Field Pattern terminology, the Field Query API, Field Snapshot +
> Causal Replay, the dimension-aware accumulator + body-authority modes, and the Projection Registry +
> Governance — live in [`critical-path/`](critical-path/README.md) (each filed as an RC1 epic).

## The one inversion underneath all of it

Fundamental was architected as **cheap, calm DOM decoration** — a particle layer that reads geometry
off the page and writes CSS variables back. It is becoming a **physical/behavioral substrate that
happens to render to DOM.** Almost every rethink below is the same move:

> The physics core becomes **authoritative and plane-agnostic**; the DOM demotes from *"the loop's
> substrate"* to *"one I/O adapter."*

This is not a grab bag — it is a **dependency tree with momentum at the root.** Momentum (first-class
mass + Newtonian body recoil; see Paper 31 §9 and the board spike) cannot be done well without pulling
the integrator, the matter model, and the force interface into scope — which is good, because those are
the foundation a serious substrate needs anyway. **Momentum is the forcing function, not the feature.**

Two standing constraints shape every item:
- **Explainability must survive.** `causality`/`prediction` decompose motion into a *sum* of per-force
  Δv. Any change to combination or integration must preserve per-force attribution (Paper 31 §6).
- **Calm stays the default.** The damped, summed, unit-mass field is the right default for interface
  decoration. Every item here is **opt-in**, not a global flip.

---

## The layers — current assumption → why it strains → what to reconsider

### 1. The integrator (the floor) — *Component: Core engine*
- **Now:** explicit Euler (`v += F`, `x += v·dt`), a global `friction *= 0.95`, a hard clamp `|v| ≤ c`
  (c = 12, a magic constant).
- **Strain:** explicit Euler *injects* energy on stiff forces (`tether`/`link` oscillate and can blow
  up), and a hard velocity clip is non-physical — it silently destroys momentum exactly when you want
  to conserve it.
- **Reconsider:** a **symplectic / velocity-Verlet integrator** for the conservative regime (d3-force,
  which we already cite, uses velocity Verlet); a **fixed-timestep accumulator decoupled from rAF**
  ("fix your timestep" — physics independent of frame rate and the every-6th-frame cadence); replace the
  hard `c` clamp with **continuous drag**. This is the floor momentum sits on.

### 2. The matter model (the deepest class change) — *Component: Architecture*
- **Now:** two classes — `Body` (immovable source) and `Particle` (unit-mass consumer). Source-vs-consumer
  is baked into the type system.
- **Strain:** the moment bodies recoil, the distinction dissolves — a body is just heavy matter that also
  emits influence.
- **Reconsider:** **unify `Body` and `Particle` under one "matter" interface** with mass, velocity, and
  integrable state; a body becomes a particle that also owns a `field()`. The reciprocity thesis has
  implied this all along. Biggest blast radius → wants #3 done first.

### 3. The force interface (the cheapest enabling refactor) — *Component: Core engine*
- **Now:** `apply()` mutates particle velocity *directly*; some forces set velocity outright
  ("kinematic"). Force-generation and integration are conflated.
- **Strain:** this fights any mass model and any integrator swap — a force that writes `v` cannot be
  re-integrated as `F/m·dt`.
- **Reconsider:** forces **produce a force/impulse**; the integrator owns the velocity update.
  Separating cause from integration is the smallest change that unlocks #1 and #2, and it *preserves*
  per-force attribution (you still sum contributions, just one stage earlier). **Do this first.**

### 4. Combination → channels + a constraint solver — *Component: Core engine*
- **Now:** blind global summation (Paper 31's central tension; the clump).
- **Reconsider two things:** **force channels** — separate accumulators (steering / structural / thermal)
  combined by *different* rules, generalizing the modifier-class arbiter (the `screen` template) so some
  forces can be prioritized without a global rule; and a real **constraint solver (PBD/XPBD)** for rigid
  links and non-penetration instead of stiff springs the explicit integrator can't hold. Constraints are
  a *different loop* (iterative position projection), not a force.

### 5. Agents → a steering/controller class — *Component: Consumer DX & API*
- **Now:** agents **consume** influence; no steering policy (the consume-vs-steer inversion, Paper 31 §7.2).
- **Reconsider:** add a **steering/actuation influence kind** to the consumption matrix and a
  **controller-agent class** (perceive → decide → act). Once mass + reaction make agents embodied, a
  steering layer turns them into autonomous actors — the "agent substrate" frontier, now with a body to
  steer.

### 6. The loops → decouple sim / DOM / render (this *is* "past CSS-feedback") — *Component: Platform/DOM*
- **Now:** one rAF loop; bodies re-measured every 6th frame via `getBoundingClientRect`; reciprocity
  closes by writing a CSS var and re-reading layout next frame.
- **Strain:** the loop's *substrate is the browser's layout engine* — lossy, async, plane-specific.
- **Reconsider:** close reciprocity **inside the engine** (body state is a first-class engine quantity,
  not a DOM round-trip); make the DOM an **input/output adapter** on a throttled cadence; run **three
  decoupled rates** — fixed sim tick, throttled DOM sync, free render. Payoff: physics becomes
  *identical* across web / native / headless because it no longer needs the DOM to close its own loop.

### 7. Semantics → units + conservation contracts — *Component: Architecture*
- **Now:** mass nominal, `c` a magic 12, friction a dimensionless 0.95; the passport declares `doesWork`,
  `conservesSpeed`.
- **Strain:** momentum *exchange* is meaningless without consistent units — you can't balance a budget
  measured in nothing.
- **Reconsider:** a **nominal-but-coherent unit system**, and extend passports into a **conservation
  contract** (each force declares momentum/energy conservation) so the engine can *compose a closed-system
  mode* from only conservative forces. The truth-mode system is the right home.

### 8. Fields → a dynamical medium — *Component: Core engine*
- **Now:** grids (memory, heat, density) are passively-sampled scalar fields.
- **Reconsider:** fields as **first-class evolving media** — PDE-driven (`propagate`/wave and SPH
  `pressure` are seeds). The jump from "particles in a static force field" to "matter coupled to a
  continuous medium" (fluid, reaction-diffusion) is what makes the field a *substrate* rather than a
  lookup table.

---

## Ranked by leverage (and dependency order)

1. **Force-gen / integration split (#3)** — smallest change, unlocks everything physical, keeps explainability.
2. **Symplectic fixed-timestep integrator (#1)** — the floor momentum needs.
3. **Matter unification + first-class mass + recoil (#2 + momentum spike)** — the reciprocity payoff; biggest class change.
4. **Decouple sim from the DOM/render loop (#6)** — makes the substrate plane-agnostic; the literal "past CSS-feedback" move.
5. **Steering-agent class (#5)**, then **channels/constraints (#4)**, **units/conservation contracts (#7)**, **dynamical fields (#8)**.

`#3 → #1 → #2` is the critical path; momentum drags all three into scope, so doing momentum *properly* is the natural first project.

---

## Blast radius & sequencing (verified against code, 2026-06-29)

A seven-survey sweep of the codebase (JS core, Swift, Kotlin, diagnostics, contracts/recipes/docs, the
`dom` package, the test wall) establishes the real cost. Two corrections to the earlier framing:

- **First-class mass is already shipped and conformance-tested** — `FieldOptions.mass` (default `false`),
  `a = F/m` wired in `integrator.ts:53–57,220`, tested in `integrator.test.ts:198–286`, mirrored in Swift
  + Kotlin. `recoilImpulse` exists (`reactions.ts:29`) but is **never called in `integrator.ts`** for
  body-acting forces (only `collide` uses pairwise recoil). So the genuinely-new surface is: the
  **symplectic integrator (#1)**, **wiring recoil into body forces (#2)**, **mass default-flip +
  pattern recalibration**, and **closed-system conservation**. This is *wire-and-flip-and-add*, not
  greenfield. (`physics-workover.md:79–82` already documents mass as shipped — no status fix owed.)

### Two linchpin decisions gate the whole program

1. **The impulse-accumulator contract (gates #3).** `causality`, `prediction`/`ghostTrajectory`
   (`diagnostics/{probes,modes}.ts`), `streamlines.forceAt()`, dock movers (`field.ts:873`), **and the
   conformance harness** (`conformance/expectations.ts`) all read a force's effect by diffing
   `p.vx`/`p.vy` around `apply()`. Forces must therefore **add to an impulse accumulator the integrator
   owns** (not return an impulse — breaks the Δv-readers; not blind-mutate — blocks mass/recoil). This
   is the only design that preserves per-force explainability (Paper 31 §6, made mechanical).
   **Make the accumulator dimension-aware from the start** even if only `x/y(/z)` ship first — the shape
   should not assume all force contribution is `vx/vy`. Conceptually: `linear (x,y,z)` · `angular
   (θx,θy,θz)` · `thermal (heat)` · `temporal (delay/decay/phase)` · `semantic (attention/confidence/
   memory)`. This is the construction rule from [`../canonical/dimensional-coupling.md`](../canonical/dimensional-coupling.md)
   applied to the contract: don't paint orientation/time into a corner.
2. **Body-position authority (gates #2 recoil) — three modes, not a binary.** `MeasurementRegistry`
   re-derives a body's position from `getBoundingClientRect()` every frame (`measurement.ts:97`);
   overlays, `apply-recipe` proximity, feedback `--d`, and `visual-bindings` all assume body-position =
   DOM-rect. A recoiling body's physics position diverges from its rect → those read the wrong place.
   The decision is *which body-authority mode* a body declares (see
   [`../canonical/dimensional-coupling.md`](../canonical/dimensional-coupling.md) "Body-authority modes"):
   **Anchored** (DOM-rect authoritative; today's default — shipped), **Kinematic** (engine writes a
   transform; DOM follows — `data-move`, shipped), or **Dynamic** (engine owns position; DOM measurement
   initializes/constrains — future, required for physical recoil). The current system is not *wrong* —
   it is *Anchored mode*. **Recoil requires Dynamic mode** (or Kinematic-with-readback), so it is
   downstream of this decision — not part of the early foundation as first thought.

### Corrected order

```
#3  impulse-accumulator refactor   ← clean first PR: behaviorally identical (test wall stays green),
    (JS core; migrate diagnostics      moves no golden, flips no pattern, breaks no freeze, touches no DOM coupling
     + conformance to the accumulator)
        ↓
#1  opt-in symplectic integrator   ← behind a flag; default Euler path's tests untouched; keep
                                       ghostTrajectory in lockstep (it hardcodes Euler + m:1)
        ↓
[decide body-position authority]   ← the dom-survey gate; ties to #6
        ↓
#2  wire recoil into body forces   ← only safe after that decision; add new golden cases (golden
                                       doesn't cover recoil today) on all 3 planes in one PR
        ↓
mass default-flip → pattern recalibration lands in EXPERIMENTAL_PATTERNS (the 64 are locked)
```

### Blast-radius map (verdict per artifact)

| Artifact | Verdict |
|---|---|
| `integrator.ts` (+ Swift/Kotlin mirrors) | **Rewrite** loop → accumulator, opt-in Verlet, wire recoil; ×3 planes |
| 36 force `apply()` bodies (25 additive, 5 kinematic, modifiers) | **Update** to accumulator contract; ×3 planes |
| `diagnostics/{probes,modes}.ts`, `streamlines.ts`, `field.ts` movers | **Update** Δv extraction to read the accumulator |
| `conformance/{experiments,expectations}.ts` | **Add** recoil/closed-system cases (`momentumConserved` exists) |
| Cross-plane golden (`conformance-golden.json`) | **Regenerate** on 3 planes in one PR — but only *force-math* changes move it (samples single-`apply` Δv); pure integrator/recoil-wiring does not |
| 64 LOCKED `FIELD_PATTERNS` | **Can't retune in place** → mass-on variants go to `EXPERIMENTAL_PATTERNS` |
| `passport.ts` schema + 36 rows + `validatePassports` | **Additive** (`conservesMomentum`, `reactsOnSource`) |
| Freeze gate (`api-surface.data.mjs`, 14 entries) | **Untouched** — mass/momentum live on unfrozen `FieldOptions`/`FieldHandle`; additive-safe |
| `dom`: `measurement`/`overlays`/`apply-recipe`/`feedback`/`visual-bindings`/`thread-overlay` | **Review** — all assume body-position = DOM-rect; impacted only when recoil moves bodies |
| `dom`: `FrameScheduler`, `bindData`, `governor`, `flip`, `energy.ts`, `netField()` | **Safe** — no physics-position coupling |
| Docs: `system-contracts.md` §3 ("a force may mutate" widens to the *body* for recoil) | **Update** (contract widening, not a freeze break) |
| `feedback-channels.md` | **Additive** (`--momentum`?) — do **not** overload `--mass` (= `--load` accretion alias) |
| `check:recipes` / `check:golden` / `check:cem` (only if new element attr) | **Regenerate** to pass |
| Determinism / record-replay / `FRICTION`/`c` tests | Break only on *behavior* change → opt-in flag isolates them; new modes get their own determinism tests |

**The two true bottlenecks:** the LOCKED pattern catalog (recalibration → `EXPERIMENTAL_PATTERNS`) and the
cross-plane golden (JS + Swift + Android in lockstep, one PR). The clean root that touches neither is
**#3 as a behavior-preserving impulse-accumulator refactor.**

---

## What this unlocks (the concepts/features it enables)

The substrate work is not plumbing for its own sake — it makes buildable a large part of the **already-documented
frontier** in [`field-possibilities.md`](../canonical/field-possibilities.md) §26–36, and deepens several
shipped use cases. The mapping:

| Substrate rethink | Unlocks (field-possibilities / use-cases) |
|---|---|
| **Matter unification + mass + recoil** (#2, momentum) | §26 **matter primitives** (fluid / fabric / sand / light all need real matter dynamics); §VIII **Reciprocal UI** becomes *Newtonian*, not just CSS-feedback; §34 **field-as-authoring-primitive** ("you define physics, layout emerges" needs bodies that settle into equilibria) |
| **Symplectic integrator + constraints** (#1, #4) | §34 authoring (the field *solves the geometry* — needs stable convergence); fabric/fluid (§26); stable `tether`/`link` structures |
| **Dynamical fields / medium** (#8) | §26 fluid; §28 **time-based representations** (interference, cellular automata); §32 **accumulating memory** (semantic sediment = a field that *evolves*); §33 **temporal fields** |
| **Decouple sim from DOM loop** (#6) | §29 **alternative output surfaces** (sound / haptics / AR — need the sim independent of the DOM); §30 **field-as-machine-readable-layer** + field-query API (needs engine-authoritative state); §31 **social substrate** (shared fields across clients) |
| **Steering / controller agents** (#5) | §12 **input agents** with policy; §30 the field as an **agent communication protocol**; §35 **emergent semantics** |
| **Units + conservation contracts** (#7) | opt-in **closed-system mode**; §35 emergent semantics (attractor states / phase transitions are only meaningful under conservative dynamics) |
| **Force channels / arbitration** (#4) | richer §VIII **composed force personalities**; §35 emergent semantics; the explainability-safe path to Reynolds-style robustness (Paper 31 §6) |

Read the other direction: the frontier capabilities the project already wants (fluid matter, the field as
an agent-queryable semantic layer, authoring-by-physics, temporal fields, emergent semantics) are *gated*
on this substrate work. That is the argument for doing it.

## Missing: the collapsed dimensions, adjustments & expansions

The [designed-vs-natural map](../canonical/designed-vs-natural-map.md) reframes "what are we missing": every
**Departure** and **Idealization** is a *degree of freedom nature has that the engine collapsed* to stay
cheap, 2D, present-tense, and legible. "Missing" = the collapsed axes worth re-expanding. The deepest are
not forces — they are **dimensions of state**, and there are **three**, not two.

### Tier 1 — the three collapsed dimensions

- **3D space.** `z` is *optional / bolted-on*; 2D is the default because the DOM/canvas is. Native planes
  (Swift/visionOS) already run 3D-native, so this is "promote `z` to first-class," not greenfield. Unlocks
  depth-as-meaning, volumetric fields, §29 AR/spatial. *Gated on the integrator/mass foundation — 3D
  momentum is meaningless until momentum is.*
- **Time.** The field is **present-frame only**; `memory` grids accumulate (partial). Two sub-gaps:
  (a) **temporal fields** — time as a queryable axis (events at moments, causal chains, §33); and
  (b) **fixed timestep / proper time** — dt is welded to rAF + the every-6th-frame cadence (also adjustment
  #2 below). Unlocks timelines-as-fields, semantic sediment (§32), causal navigation.
- **Orientation / rotation** *(the non-obvious third — co-equal).* Matter is **point-like with no angular
  state**: no orientation, no angular velocity, no torque, no angular-momentum conservation. (`spin` is a
  *body* parameter for swirl/magnetism polarity — **not** rotation of matter; see adjustment #4.) Nature
  gives every body 6 DOF (3 translation + 3 rotation); we model 2–3 and drop rotation. For an *interface*
  engine this may outrank 3D — UI is full of rotation (dials, tumbling cards, orientation-as-meaning,
  torque from off-center forces).

**The insight: space, time, and orientation are the three axes the present model collapsed.** Each
re-expands as an opt-in *Faithful* mode, exactly like momentum.

### Tier 2 — enabling adjustments (cheap; they gate Tier 1)

| Adjust | Why it blocks |
|---|---|
| **Units / dimensional system** | `c=12`, `0.95`, px/frame are nominal — momentum *exchange* and energy accounting are meaningless without consistent units |
| **Fixed timestep** (decouple dt from rAF) | Prerequisite for Time and a stable integrator (also layer #1/#6) |
| **Coordinate-space / reference-frame rigor** | field-space vs pixel-space vs DOM-rect conversions are ad hoc; ties to the body-position-authority decision; 3D + frames need it clean |
| **De-overload `spin`** | `spin` currently means polarity/handedness for swirl/magnetism — real rotation needs its own state (lane-separation discipline) |

### Tier 3 — model expansions (frontier; after the foundation)

- **An equilibrium / relaxation solver** *(non-obvious, high value).* Today the engine only *simulates
  forward*. Authoring-by-physics (§34, "define forces, layout emerges") and headless layout need to **solve
  for the settled state directly** (d3-force does this via alpha-cooling). There is no energy-minimizer /
  relax-to-equilibrium mode — this is the missing piece that turns "a physics sim" into "a layout engine."
- **Distributions / uncertainty as first-class** — metrics are scalars; AI-evidence (§16) wants confidence
  as a *distribution*, not a number. The field can't represent uncertainty as a shape.
- **Constraints (PBD/XPBD)** and **fields-as-media (PDE)** — layers #4 and #8.
- **Matter phase / material identity** — fluid/fabric/sand (§26) need state beyond point particles.
- **Anisotropic / tensor fields** — every force is isotropic-radial or a simple dipole; no directional stress.

### Caveat

All of Tier 1 sits on the substrate foundation: 3D *momentum*, temporal *dynamics*, and rotational *recoil*
are meaningless until the `#3 → #1 → #2` foundation exists. The order does not change — but this tells us
what the foundation is *for*: it is the substrate that lets any collapsed axis (translation-momentum, then
orientation, then 3D, then time) be re-expanded as an opt-in Faithful mode.

## The headline frontier: restoring collapsed dimensions (not adding tokens)

> **Terminology.** The canonical term for an authored field arrangement is now **Field Pattern** (see
> the [Dimensional Coupling Doctrine](../canonical/dimensional-coupling.md)). The current API
> representation remains `FieldPattern`; no API rename is implied here.

The next frontier is **not another force token — it is restoring dimensions of state the interface
engine collapsed.** The [designed-vs-natural map](../canonical/designed-vs-natural-map.md) names three:
**depth (3D)**, **time**, and **orientation/rotation** (the sleeper — matter today has position +
velocity but no angular state, torque, or angular momentum). Each is built by the same rule from the
[Dimensional Coupling Doctrine](../canonical/dimensional-coupling.md): **add the axis, keep it orthogonal
by default, and name the coupling.**

- **Orientation** — add θ + angular velocity as their own lane; couple to translation *only* via an
  explicit `torque` (`τ = r × F`).
- **Time** — temporal coordinates + fields; time does not "push back" by default (independent evolution
  parameter); decay/memory/prediction/replay are explicit temporal kernels.
- **Depth** — promote `z` from optional lane to first-class state; `x/y` unchanged unless a depth-aware
  force/projection is enabled.

Two doctrine constraints carry into implementation: **cross-dimensional coupling must be passport-declared**
(`Couples dimensions: …`) so "why did this rotate?" is inspectable; and **every added dimension needs a
projection rule** (how its state renders to the 2D/present-tense DOM) — *separate* from coupling (you can
visualize a dimension without letting it affect another). All of Tier-1 dimensional work sits **on** the
foundation below — there is no 3D *momentum*, temporal *dynamics*, or rotational *recoil* until the
`#3 → #1 → #2` path exists.

## Relationship to the canon

This doc is the **engine-internals axis** of the possibility space. It complements:
- [`field-possibilities.md`](../canonical/field-possibilities.md) §26–36 — the *capability* frontier (what
  becomes possible); this doc is *how the engine has to change* to get there.
- [`platforms-and-use-cases-frontier.md`](platforms-and-use-cases-frontier.md) — the *host/runtime* axis
  (where the engine runs); #6 (decouple sim from DOM) is the shared seam.
- [`fundamental-field-behavior-table.md`](../canonical/fundamental-field-behavior-table.md) — where the
  per-force `field()`/`apply()` contract lives; #3 (force-gen split) and #7 (conservation contracts) edit
  that contract.

## Note on the paper

Research [Paper 31](../research/31-behavioral-models-after-boids.md) currently frames momentum and
arbitration as *limitations*. When this substrate work is scoped/landed, Paper 31 should be revised to
frame momentum as the **root of a substrate program**, not an isolated gap — deferred until the board
epics below are real. (Per the no-premature-claims rule, the paper is not edited ahead of the work.)
