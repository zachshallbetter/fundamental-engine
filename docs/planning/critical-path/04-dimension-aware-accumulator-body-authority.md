# Dimension-Aware Accumulator + Body-Authority Modes

## Status

Proposed core-engine architecture. This is the critical path for stable momentum, recoil, torque, temporal effects, semantic force channels, and future restored dimensions.

## Purpose

Fundamental needs a cleaner separation between force generation and integration.

Today, many force `apply()` methods directly mutate velocity. That makes it difficult to introduce mass, recoil, symplectic integration, angular state, temporal effects, semantic channels, and explainable attribution cleanly.

The next foundation is:

```txt
forces produce contributions
accumulators collect contributions
integrators apply contributions
body-authority modes decide who owns position
```

## Core idea

A force should not directly own integration.

A force should contribute to an accumulator.

The integrator should decide how those contributions change state.

## Why dimension-aware from day one

Do not design the accumulator as only `vx/vy`.

That would preserve the current 2D particle assumption and make orientation, time, thermal state, and semantic pressure harder later.

The accumulator should be shaped for restored dimensions even if only linear x/y/z ships first.

Conceptual channels:

```txt
linear     x, y, z
angular    θx, θy, θz
thermal    heat
temporal   delay, decay, phase
semantic   attention, confidence, memory
```

## Proposed accumulator shape

```ts
type FieldImpulseAccumulator = {
  linear: Vec3;
  angular?: Vec3;
  thermal?: number;
  temporal?: TemporalContribution;
  semantic?: Record<string, number>;
  constraints?: ConstraintContribution[];
  attribution?: ForceAttribution[];
};

type TemporalContribution = {
  delay?: number;
  decay?: number;
  phase?: number;
};

type ForceAttribution = {
  force: string;
  source: string;
  target?: string;
  channel: "linear" | "angular" | "thermal" | "temporal" | "semantic" | "constraint";
  contribution: unknown;
  couplesDimensions?: string[];
};
```

## Force contract

Current conceptual model:

```ts
apply(body, particle, env) {
  particle.vx += fx;
  particle.vy += fy;
}
```

Proposed model:

```ts
apply(body, target, env) {
  env.accumulate.linear({ x: fx, y: fy, z: fz }, {
    force: "attract",
    source: body.id,
    target: target.id,
  });
}
```

Kinematic forces may still need special handling, but they should be explicit:

```ts
env.kinematic.setVelocity(target, nextVelocity, attribution);
```

or:

```ts
env.constraints.add(reflectionConstraint);
```

## Why this preserves explainability

Diagnostics and conformance currently care about per-force contribution.

The accumulator should preserve attribution instead of hiding it.

The answer to “why did this move?” should be structured:

```txt
attract contributed +0.42 linear x
charge contributed -0.18 linear y
viscosity contributed -0.09 damping
formation mapped confidence to gravity strength
```

## Coupling passport

Each force should declare whether it couples dimensions.

Examples:

```txt
none
x/y
x/y/z
translation → rotation
time → strength
memory → gravity
relation → charge
confidence → gravity
```

This makes causal explanations inspectable.

Example:

```txt
This body rotated because torque coupled translational force into angular velocity.
```

## Body-authority modes

The accumulator is only half of the problem. The runtime also needs to know who owns body position.

Three modes:

| Mode | Authority | Status / use |
|---|---|---|
| Anchored Body | DOM rect is authoritative. | Default. Safe for normal UI. Stable source, boundary, or infinite-mass reference. |
| Kinematic Body | Engine writes transform; DOM object moves visually. | Shipped pattern via transform-style behavior. Good for opt-in UI motion. |
| Dynamic Body | Engine owns position, velocity, and possibly mass. | Future. Required for physical recoil, torque, and conservation modes. |

## Anchored Body

Anchored bodies are measured from their host surface.

```txt
body position = DOM rect / host rect / provided geometry
```

Use for:

```txt
buttons
cards
inputs
headings
layout regions
stable attractors
boundaries
most design-system components
```

Anchored bodies may emit fields and receive feedback, but their physical position is not owned by the engine.

## Kinematic Body

Kinematic bodies are visually moved by the engine, usually via transform.

Use for:

```txt
field-reactive cards
movable chips
animated elements
drag targets
docked elements
warp/relocate projections
```

The engine writes output, but the DOM still remains the rendered object.

Kinematic mode is opt-in.

## Dynamic Body

Dynamic bodies are owned by the engine.

Use for:

```txt
recoil
momentum conservation
torque
physical layout solving
field-to-layout
agent bodies
native/headless simulations
```

Dynamic mode should not be the default for ordinary DOM UI. It is powerful but can disturb layout coherence.

## Why body authority gates recoil

Recoil means the source moves in response to force.

If the source position is re-measured from the DOM every frame, recoil is overwritten or becomes inconsistent.

So recoil requires either:

```txt
Dynamic Body
```

or:

```txt
Kinematic-with-readback
```

The clean future is Dynamic Body.

## Integration roadmap

### Step 1: behavior-preserving accumulator

Refactor force application so additive forces write into an accumulator.

No behavior change.

No golden changes unless force math changes.

Preserve attribution.

### Step 2: diagnostics read accumulator

Causality, prediction, force vectors, conformance, and streamlines should read the accumulator rather than diffing direct velocity mutation.

### Step 3: opt-in symplectic/fixed-timestep integrator

Add the better integrator behind a flag.

Keep default path stable.

### Step 4: body-authority modes — ✅ SHIPPED (declaration)

Introduce explicit authority declarations.

```ts
type BodyAuthority = "anchored" | "kinematic" | "dynamic";
```

Shipped (`@fundamental-engine/core`): `BodyAuthority` type + `Body.authority` / `BodySpec.authority` /
`data-authority`, reported in `query()`/`snapshot()` body readings. Default `anchored`; behavior-
preserving (a declaration — `dynamic` is inert until Step 5 wires physics).

### Step 5: dynamic bodies and recoil — ✅ SHIPPED (field-to-body coupling)

Wire body forces into reciprocal response only after authority modes exist.

Shipped (`@fundamental-engine/core`): an `authority: 'dynamic'` body's position is engine-owned —
each frame it integrates under the net field the other bodies create at its centre (`a = F/M`, damped +
speed-capped) and writes back to `cx`/`cy`, overriding the DOM rect. Opt-in; behavior-preserving for
anchored/kinematic. Refinement still open: literal momentum-recoil from a body's *own* emission (the
reaction to the impulses it imparts), torque, and conservation modes.

### Step 6: angular/temporal/semantic channels — 🟡 STARTED (thermal lane)

Introduce torque, time kernels, semantic pressure, and thermal/energy accounting as opt-in channels.

Shipped: the **thermal** lane — `applyAndRecord` captures each force's heat change into the
accumulator's `thermal` channel with `{ channel: 'thermal' }` attribution; surfaced via
`accumulateAt`/`query().influences` (`FieldInfluenceReading.channel`). Capture-only, behavior-
preserving. Shipped too: the **angular** lane — opt-in `Particle.orient`/`spin` (z-lane discipline, inert by default), Δspin captured into `acc.angular.z`, integrator advances `orient += spin·dt`. Still reserved: temporal (time kernels), semantic (attention/confidence/memory pressure).

## Interaction with Field Query and Replay

The accumulator should produce attribution records that can be consumed by:

```txt
Field Query
Field Snapshot
Causal Replay
Diagnostics
Conformance
Field Contracts
```

A query should be able to say:

```txt
this body moved because these channels contributed these values
```

Replay should be able to reconstruct:

```txt
force contribution → accumulator → integrator → state change → projection
```

## Interaction with Field Formations

A Field Formation may map semantic state into force parameters.

Example:

```txt
confidence metric → gravity strength
support relation → cohesion
contradiction relation → charge separation
```

The accumulator should record the runtime effect, but the attribution should also preserve the Formation responsible for the mapping.

## Risks

### Over-generalization

Do not build all channels at once.

Design the shape, ship linear first.

### Breaking diagnostics

Diagnostics must not lose per-force attribution.

Accumulator attribution is required.

### Dynamic bodies disturbing UI

Dynamic mode must be opt-in.

Anchored mode remains default.

### Kinematic special cases

Some existing forces may set or reflect velocity directly. These need explicit lanes:

```txt
additive impulse
kinematic override
constraint projection
capture/relocate
```

## Acceptance checklist

- Additive forces write to an accumulator.
- Integrator owns velocity/state update.
- Per-force attribution is preserved.
- Diagnostics and conformance can read accumulator contributions.
- Accumulator shape supports linear, angular, thermal, temporal, and semantic channels even if only linear ships first.
- BodyAuthority exists conceptually and in types.
- Anchored remains default.
- Kinematic remains opt-in.
- Dynamic is introduced as future/experimental before recoil depends on it.
- No recipe/API rename is required.
