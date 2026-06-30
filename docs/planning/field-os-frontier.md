# Field OS Frontier — field query, lenses, snapshots, causal replay, agents, materials, and field-native use cases

> **Status: exploration / planning.** Out-of-the-box ideas that treat the field as a *queryable,
> inspectable, replayable substrate* — a "field OS" — rather than only a render layer. These are kept in
> planning **deliberately**: the canonical docs stay tight (concepts, contracts, the
> [Dimensional Coupling Doctrine](../canonical/dimensional-coupling.md)); these ideas live here until they
> harden into contracts. Nothing here is shipped. Builds on the
> [field-possibilities](../canonical/field-possibilities.md) frontier (§26–§36), the
> [platforms/host frontier](platforms-and-use-cases-frontier.md), and the
> [substrate frontier](substrate-architecture-frontier.md).
>
> **Terminology:** an authored field arrangement is a **Field Formation** (current API representation:
> `FieldRecipe`); a relationship is an *association*, a force is a *coupling* (see the doctrine). No API
> rename is implied by anything here.

## The premise

The field is already a continuously-maintained spatial index of semantic state. Most of the value
explored below comes from *reading and re-running* that state, not from drawing it — which is why these
ride on the signals-first posture (`render: 'none'`) and the loop-decoupling work (engine-authoritative
state), not on the renderer.

## The buckets

### 1. Field query — the field as an agent-readable API
A programmatic read surface over the live field: *what is most important here, what is this related to,
what path of least resistance crosses this content, what is in conflict.* Builds on field-possibilities
§30 (the machine-readable semantic layer) and the shipped read primitives (`sample`, `sampleField`,
`readEdges`, `on`). Frontier piece: a stable `field.queryAt(x,y)` / `field.pathBetween(a,b)` /
`field.bondsFrom(el)` surface. Gated on engine-authoritative body state (substrate #6) so queries mean
the same thing headless and in-DOM.

### 2. Lenses — scoped, composable views of field state
A **lens** is a read-only, named projection over a region or a subset of bodies/relationships — e.g. an
"evidence lens," a "conflict lens," a "memory lens." Distinct from a Field Formation (which *authors*
behavior); a lens *reads and presents* it. Builds on the diagnostics surface (causality, topology) and
the Projection lane of the doctrine. Frontier piece: lenses as first-class, stackable, accessibility-aware
projections.

### 3. Snapshots — serialize and restore field state
Capture the full field state (bodies, metrics, grids, memory) to a serializable snapshot and restore it.
Builds on the existing deterministic record/replay (`record.ts`, seeded RNG) and the headless host.
Frontier piece: a stable snapshot format for SSR pre-settle (ship a settled field in HTML),
test fixtures, and "resume where the reader left off" (field-possibilities §32, accumulating memory).

### 4. Causal replay — re-run and explain history
Replay a recorded session and, at any frame, ask *why* — per-force attribution via `causality`, forward
projection via `prediction`. Builds on the explainability surface (which is welded to linear
superposition — see [Paper 31 §6](../research/31-behavioral-models-after-boids.md)) and record/replay.
Frontier piece: a scrubbable causal timeline ("this moved because of `attract` 0.61, `swirl` 0.24").

### 5. Agents — autonomous consumers that navigate the field
Steering/controller agents that probe the field (`sample`) and act on a policy, rather than only consuming
a summed impulse. Builds on `addAgent` and the consume-vs-steer distinction (substrate #5). Frontier piece:
a controller-agent class + a steering influence kind; the field as shared spatial memory multiple agents
navigate (field-possibilities §31, social substrate).

### 6. Materials — matter beyond point particles
Phase/material identity for matter: fluid that pools, fabric that sags under a heavy heading, sand that
piles where attention accretes (field-possibilities §26). Gated on the substrate foundation
(first-class mass, a conserving integrator, fields-as-medium) and on **projection rules** per material so
each stays accessible. Frontier piece: a material registry + per-material projection + reduced-motion
equivalents.

### 7. Field-native use cases — what the OS makes ordinary
The application tier the above unlocks, expressed as Field Formations: live knowledge graphs you can
*query*, documents that *remember and resume*, AI evidence surfaces you can *replay and audit*,
collaborative rooms whose attention is *visible weather*, timelines navigated as fields
(field-possibilities §33). These are use cases, not engine work — they belong in
[`use-cases.md`](../canonical/use-cases.md) once the primitives they need ship.

## Dependencies (what gates what)

| Bucket | Gated on |
|---|---|
| Field query, Snapshots, Causal replay | engine-authoritative state + loop decoupling (substrate #6), record/replay (shipped) |
| Lenses | the Projection lane + diagnostics (mostly shippable now) |
| Agents | steering-agent class (substrate #5) |
| Materials | the substrate foundation (mass, integrator, fields-as-medium) + per-material projection |
| Field-native use cases | the relevant primitives above |

## Doctrine guardrails (so these stay authorable, not magical)

- **Association ≠ coupling.** A lens or query *reads*; it never silently exerts force. Only a Field
  Formation turns association into coupling.
- **Dimensions orthogonal by default.** Time/depth/orientation that any of these add stay independent
  unless a named coupling connects them.
- **Reveal-never-mutate.** Lenses, queries, causal replay are read surfaces; they never feed back into
  `apply()`.
- **Projection is separate from coupling.** Making a dimension visible (a lens, a material's look) does
  not couple it to another.

## Status

All frontier. Capture-only — no board epics filed yet; promote a bucket to the RC1 board when it's scoped
to a dispatchable brief. The canonical docs should remain tight; this doc is the staging area.
