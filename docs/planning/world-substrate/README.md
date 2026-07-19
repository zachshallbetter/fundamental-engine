# The Computational-World Substrate — the next-leap program

> **Status: in progress (Stage 1 underway; public substrate NOT shipped).** A staged plan to evolve
> Fundamental from a relational field runtime into a governed computational-world substrate. The public
> substrate is not shipped and nothing here changes shipped behavior — but **F1.0–F1.2 exist
> experimentally** (internal, unexported, on `feat/world-kernel`): a version envelope, a generic `World`
> declaration, and an MVP `DynamicsContract`. M1.5 is ratified. Each stage is gated and reversible until
> its exit criteria are met. Read `docs/planning/critical-path/README.md` first — this program sits above
> it. The authoritative status ledger, itemized WBS, and decision gates are in [`PLAN.md`](PLAN.md) (v2.1).

## The leap in one sentence

**Define a world once, execute it through multiple substrates, project it into multiple forms, and
prove what each projection preserved, changed, exposed, or concealed.**

That is a larger category than "a physics engine for interfaces." It is not Unity, React, a graph
database, a workflow engine, or a visualization framework — and it is reachable from where the code
already is.

## Why now, and why not "more"

Two independent reviews converge on the same instruction:

- The external **CompInt determination** warns of *formal completeness without scientific compression*:
  "a successful Version 2 may be smaller … discover which parts are indispensable."
- The **next-leap direction** for Fundamental is *not* more forces, render modes, or host adapters. It
  is making the pieces already present — queries, snapshots, diffs, projections, relationships,
  diagnostics, causal replay — into **one coherent operating model**.

So this program has a hard discipline: **prove the world/projection/evidence spine before adding
breadth.** Every stage must earn the next. If a distinction cannot be measured, exposed, or compared,
it does not ship.

This is the executable half of the relationship recorded in the FCI alignment doc
(`docs/canonical/computational-interaction-alignment.md`, landing via the `docs/fci-alignment` branch):
FCI names the distinctions; this program makes the
bounded, system-relative subset of them executable and governed. **Fundamental owns the computational
facts — not belief, culture, strategy inference, or human meaning.**

## The new center

Today the **field** is the conceptual center:

```text
bodies + relationships + forces + dimensions → field state → host feedback + projection
```

The program moves the **declared world** to the center and demotes the field to *one very powerful
execution substrate inside it* (never an incidental visualization — see Stage guardrails):

```text
Declared World            entities · relations · dimensions · operations · transitions ·
                          authority · dynamics · invariants · history/provenance
     ↓ governed through
Execution Substrates      relational field · deterministic transitions · continuous sim ·
                          external services · participant policies
     ↓ exposed through
Projection Contracts      DOM · native UI · 3D/spatial · sound/haptics · agent-readable ·
                          data/API · headless
```

Three clean authoring levels result — **World → Execution → Projection** — so that not every concept
must become a body, force, or metric merely because those are the abstractions the field handles well.

## Terminology (canonical for this program)

Four neighboring words carry distinct, non-overlapping meanings here. No word lives in two lanes.

**World.** A *world* is the representation-independent declared totality from which every projection
derives: the complete, consistent configuration of entities, state, relations, operations, dynamics,
and invariants (the kernel `K`) at a point in its history, together with the participants and
environment it contains. "World" is used in the **possible-worlds sense** — a complete state of affairs
that observations are evaluated *at*, and that a projection accesses through an observation relation —
**not** the 3D-scene sense. A world is defined by what it contains and what may lawfully happen in it,
never by how it looks. A world is a running **instance**; its declared **type** is a `WorldContract`
(the serialization of `K`).

**World vs model.** A *model* is the **type / theory** — the lawful structure a world instantiates
(CompInt's layer; the pairing with "Standard Model" is deliberate). A *world* is an **instance** — one
realization a model admits (Fundamental's layer). CompInt defines interaction *models*; Fundamental
executes candidate *worlds*. Never use "model" for a running instance or "world" for the theory: that
collapses the CompInt ↔ Fundamental distinction the whole program rests on. (Cf. *program* : *process*.)

**World vs environment.** An *environment* is a **part of** a world — the surrounding system that
participants act within and that mediates their coupling. The world is the superset: participants +
environment + relations + operations + invariants. `world ⊇ environment`.

**World vs field.** A *field* is **one execution substrate inside** a world — the continuous, relational
dynamics layer (influence, pressure, attention, confidence, conflict). Discrete transitions are the
other substrate. `world ⊇ field`; the field is how a world becomes relational and continuous, not the
world itself.

These are this program's working definitions; they promote to `docs/canonical/` only when a stage ships
the corresponding runtime surface (status rule, `documentation-standards.md`).

## Three classes of derivation

"Derived from the kernel" is not one thing. Constructs split by evidence standard, and the split governs
the whole program:

- **Runtime-derived** — computable from the world `K`: system-relative opportunity, reachability, enabled operations, permission, exposure, signaling, transition traces, candidate interaction episodes.
- **Contract-relative** — defined only against an explicit analytical contract (property family, transforms, tolerances, purpose): projection preservation, typed similarity, equivalence, invariance, comparison admissibility. Not properties of the runtime alone.
- **Empirically inferred** — *not* derivable by executing `K`: attributed behavior, human strategy, transfer, participant *belief* about opportunity, measurement claims, interpretation, experience. The runtime supplies evidence; it never asserts these as facts.

> The kernel produces world state, transitions, system-relative opportunity, candidate interaction
> episodes, and evidence. Contract-relative comparison and empirically inferred constructs are defined
> *over* those outputs but are not asserted by the runtime.

**The kernel is a hypothesis, not seven settled primitives.** Working form
`K = ⟨Entities, State, Relations, Operations, Dynamics, Projection, Invariants⟩`; a smaller competing
hypothesis to test against it is `K₀ = ⟨X, Θ, Π, V⟩` (configuration · lawful evolution+operations ·
projection/access · validity/invariants). **Authority and capability are typed constraints, not
primitives.** Which factorization survives ablation is a question the program answers, not an assumption
it makes — see [`PLAN.md`](PLAN.md) (rules R1a/R1b, R3; the four-ablation method).

## What already exists vs what is new

Grounding the leap in the real surface (verified against `scripts/api-surface.data.mjs` and
`docs/canonical/substrate-api.md`):

| Pillar | Already in code | New in this program |
|---|---|---|
| Declared arrangement | `FieldPattern` / `compilePattern` (frozen) | `WorldContract` **above** `FieldPattern` (ontology, operations, transitions, authority, invariants, versioning) |
| Projection | `ProjectionRegistry`, `setRender`/`setOverlay`, governance lint (experimental) | `ProjectionContract` as a **compilable, comparable** artifact declaring preserve/transform/omit/introduce/expose/signal/accessibility |
| Reading | `query()`, `sample*` (experimental) | **System-relative opportunity** `Ω_sys` (a predicate) → **Opportunity Graph** (horizon analysis). Participant *belief* `Ω̂` is empirical — out of the runtime |
| History | `snapshot()`/`diff()`/`replay()`, causality ladder (experimental) | **Transition evidence ledger**: per-transition provenance; causal claims are *typed* — the runtime reports only *execution-causal* within its substrate |
| Comparison | `diff(a,b)` (experimental) | **Typed `compare()`** with an *admissibility gate* → a profile (never a scalar), or an explicit *incomparable* result |
| Conformance | cross-plane golden (shipped, `depth:0`) | Expand golden to **world / operation / projection / opportunity** conformance |
| Governance | `FieldPolicy`, passports, truth modes, `forAgent` (mixed) | **Authority as a typed constraint** (`Permitted(participant, op, object, scope, state, time)`), not a primitive; kernel/policy/analysis separation |

The field remains the **differentiator**: it is the substrate for influence that is continuous,
cumulative, reciprocal, uncertain, pressure-like, and history-sensitive. Discrete world semantics say
*which transitions are valid*; the field says *how influence accumulates between them*. That hybrid is
hard to get from a workflow engine, graph DB, physics engine, or UI framework alone — it is the moat.

## The five stages (each irreversible only after its exit gate)

```text
Stage 1  Kernel (K) + version envelope
  entities, relations, operations, transitions, authority (typed constraint), invariants, and version
  identity ABOVE the field.
  EXIT: an existing Field Pattern hosts inside K under three equivalences (operational + structural +
  invariant), no field-specific escape hatch; system-relative opportunity + candidate interaction
  derive; the four-ablation report classifies each kernel element (primitive / index / syntax /
  explanation-only / reducible).
  Guardrail: no user-facing complexity yet; no kernel behavior change. Gated on a semantic freeze
  (M1.5): participant-admission, boundary-validity, and authority-encoding decided first.

Stage 2  Projection Compiler + Registry
  ProjectionContract becomes first-class, compilable, versioned. Every projection declares
  preserve/transform/omit/introduce, exposed operations, signifiers, accessibility equivalents.
  EXIT: reduced-motion and agent-readable projections VALIDATED against declared preservation claims.

Stage 3  Opportunity + Evidence runtime
  Operation enumeration (system-relative opportunity), world diffs, transition provenance, world replay.
  EXIT: an Opportunity Graph and an evidence ledger reconstruct a real decision end-to-end.

Stage 4  Typed conformance
  compare() returns typed profiles; the golden expands to world/operation/projection/opportunity.
  EXIT: Swift, Kotlin, and web pass the SAME world contract against declared invariance claims.

Stage 4.5  Adversarial world suite  (precedes the flagship — tests expressiveness, not porting)
  ≥4 worlds: deterministic workflow · async distributed · continuous embodied/simulated · institution
  with changing authority.
  EXIT: all four run on the JS reference with NO bespoke primitive and NO core exceptions; ≥1 passes
  cross-plane; failures + unsupported host-specific behavior declared.

Stage 5  Flagship world  (demonstrates a tested architecture, not defines it)
  One serious cross-platform application on the architecture: visual, native, conversational, headless
  — from one declared world.
  EXIT: a state change in one projection appears in all; a false-opportunity claim is caught live;
  reduced-motion preserves semantic state; a decision is snapshot + replayed; projections compare.
```

## Compression discipline (the CompInt lesson, applied to us)

Every proposed field on `WorldContract` / `ProjectionContract` must pass an **ablation test** before it
freezes: remove it and show measurable loss in reliability, exposure accuracy, comparison power, or
evidence completeness. A distinction that cannot be ablated into a measurable difference is demoted to
sugar or dropped. **A successful v-next may expose a smaller public surface than today, not a larger
one.** That is progress, not failure.

## Governed evolution (changing worlds, not only stable schemas)

The `WorldContract` needs version *identity* from day one (Stage 1) and governed *migration* later
(Stage 4): ontology/relation/operation migration, authority changes, projection compatibility, and
historical-state reinterpretation — so a snapshot from world v3 stays interpretable at world v7, and no
migration is silent. Without it, this is a sophisticated runtime for *declared* worlds; with it, it is
infrastructure for *living* worlds.

## Kernel / policy / analysis separation

```text
Kernel      world, state, relations, transitions, authority, projections, evidence  (deterministic, inspectable)
  ↕
Policy      rules, planners, AI participants, human input, automation                (propose; kernel decides)
  ↕
Analysis    prediction, behavioral inference, statistics, FCI research               (consumes; never embedded)
```

An AI participant may *propose* operations, request queries, or construct projections. The kernel
decides whether each is valid, permitted, enabled, and recorded. The runtime never becomes an opaque
agent framework, and psychological/behavioral interpretation stays outside it.

## What NOT to do

- Do **not** turn every FCI/CompInt contract into a Fundamental API.
- Do **not** put belief, culture, strategy inference, or human meaning inside the kernel.
- Do **not** build more conceptual breadth before the world/projection/evidence spine is proven.
- Do **not** let the 64-pattern force catalog remain the public explanation of the product.
- Do **not** position Fundamental as "physics for interfaces" — that is now only the easiest entry point.

## The description this program earns

Current (still true, undersells the target):
> A platform-native relational field runtime.

Target:
> Fundamental is a platform-native **computational-world substrate** that separates declared state,
> continuous influence, valid operations, governed projections, and causal evidence so one world can be
> executed, inspected, and experienced across different hosts.

The field is how the world becomes relational and continuous. Projection is how it becomes available.
Contracts are how its claims become governed. Replay is how its history becomes explainable.

The full program statement — precise about what the runtime asserts versus what CompInt's contracts
assert:

> Define a computational world once; execute it through compatible substrates; project it into
> participant-relative forms; record its transitions and constraints; and test which properties survive
> transformation. **Fundamental derives authoritative computational facts from the world model. CompInt
> defines the contracts and empirical methods by which those facts may support claims** about
> interaction, behavior, strategy, similarity, transfer, and measurement. The win condition is the
> smallest kernel that preserves explanatory, operational, and empirical value.

## Open decisions (require maintainer sign-off before the relevant stage starts)

1. **Stage 1 kernel commitment** — introducing `WorldContract` in `packages/core` is semver-relevant and
   touches all planes (JS/Swift/Kotlin). Confirm before writing type/host code.
2. **Public-surface policy** — whether new world/projection/opportunity APIs enter the frozen surface at
   graduation or stay EXPERIMENTAL like the current substrate API (`api-stability.md`).
3. **Field demotion framing** — how far to reframe public copy away from "physics for interfaces" (a
   product/branding call, parallel to the FCI site work).
4. **Scope of the flagship** — which real application becomes the Stage-5 world.
```
