# Physics Workover

Status: planning and in progress. This is the authority for the multi-version
physics effort (v0.3 through v0.6). It sits under the spec
([`forces-system.md`](forces-system.md)); where this doc and the spec disagree,
the spec wins and this doc is corrected.

## Thesis

Elements bend the field. The field bends elements back.

This workover makes the engine more physically coherent where that adds depth,
without collapsing the designed interface feel into a literal simulator. The
target is a hybrid reciprocal field, not a physics engine:

- Canonical forces stay designed interface verbs (bounded, legible, damped).
- Natural primitives become physically coherent (real laws).
- Cosmology and material behaviour use the physical substrate.
- The homepage and default field keep their current feel.

## Core decision: layered physics, not a global rewrite

```ts
type PhysicsMode = 'designed' | 'natural' | 'hybrid';
```

- `designed`: today's UI-first behaviour. Bounded falloffs, stable damped motion.
  Best for the homepage and interface use.
- `natural`: physically coherent. First-class mass, real `dt` in seconds, softened
  inverse-square gravity and charge, physical drag, better conservation. For the
  Lab, cosmology, and experiments.
- `hybrid` (the default long-term target): canonical forces keep designed
  behaviour; natural primitives and cosmology use physical semantics; shared
  safety caps and diagnostics across both.

Recommended defaults: `physicsMode: 'hybrid'`, `integrator:
'semi-implicit-euler-dt'`, `medium: 'designed-damping'`. The initial compatibility
default stays visually equivalent to today.

### Non-negotiable: do not unify canonical `attract` with natural `gravity`

`attract` is a designed UI well: a bounded falloff with a hard range. `gravity` is
the softened inverse-square primitive. Keep both. Canonical forces are interface
verbs; natural primitives are physical laws. The same separation holds for
`repel` versus `charge`.

## Force layer taxonomy

Used throughout docs, implementation, Lab grouping, and tests.

| Layer | Members | Semantics |
| --- | --- | --- |
| 1. Canonical UI forces | attract, repel, vortex, stream, drag, emitter, spring, reflect, absorb | designed, bounded, legible interface verbs (stable runtime tokens) |
| 2. Natural primitives | gravity, charge, magnetism, thermal, collide, diffuse, propagate, memory | physically coherent laws |
| 3. Material primitives | cohesion, pressure, link, crystallize, pigment, phase | matter-like behaviour |
| 4. Boundary and modifiers | reflect, gate, spotlight, lens, shear, screen, absorb-horizon, world-wrap, DOM-rect | shape edges, membranes, cones, horizons, shields |
| 5. Transformation | morph, warp, fuse, fission, decay, spawn | change arrangement, location, identity, or count |
| 6. Composites and presets | blackhole, whitehole, wormhole, supernova, fountain, star, pulsar, whirlpool, shielded-chamber | built from primitives, never new engines |
| 7. Emergent behaviours | orbit, flock, demix, interfere, networks, phase-transitions, settling, accretion-disk, standing-waves | observed, not tokens (unless unavoidable) |
| 8. Metrics | density, heat, temperature, entropy, coherence, momentum, particle-count, accreted-count | measured, not applied |

## As-built audit (2026-06-04)

The brief was written against an earlier mental model. Much of the physical
substrate already ships. Do not re-implement these:

- **Softened inverse-square `gravity` and `charge`, one shared kernel.** Signed
  `p.charge` on the particle; neutral matter ignores charge fields.
  `forces/natural.ts`. (Brief Phase 4.1 to 4.3 are largely done.)
- **`magnetism`**: the 2D Lorentz force on charged, moving matter. `natural.ts`.
- **First-class inertial mass `p.m` with `a = F/m`.** The integrator captures the
  pre-force velocity and divides the force-induced delta by `p.m`
  (`core/integrator.ts:92-151`). A `mass` field option exists. The integrator
  header comment claiming this "arrives in Phase 6" is stale; it is already in.
- **`b.accreted`**: the absorber captured-count field (`forces/index.ts:188`),
  with `capacity` and a conserved `supernova` release. (The `b.mass` to
  `b.accreted` rename is already done in TS.)
- **Class [S] source and sink budgeting**: a `source()` hook on the `Force`
  contract, an integrator source pass (`integrator.ts:194-199`), and a mortal
  `age` despawn sink (`integrator.ts:180-183`).
- **`env.neighbors`** (spatial hash) and **`env.grid`** (scalar grid: diffuse plus
  leapfrog wave) are both implemented services, not stubs.

Real gaps (the actual work of this workover):

- Vortex inward bias is `0.6` in code and `forces-formulas.md` (shipped in #110),
  but the spec (`forces-system.md:374`) says `0.12`. Reconcile to `0.12`.
- No velocity cap anywhere. No NaN, Infinity, or finite-position guards.
- `FRICTION = 0.95` is an unnamed global damping constant, not a medium mode.
- `dt` is frame-based (`0` or `1`), not seconds; no fixed-step accumulator.
- `drag` is linear only; no quadratic or mixed.
- No `PhysicsMode`, `IntegratorMode`, or `MediumMode` type system.
- No `screen` modifier.
- Modifier order relies on token-iteration order, not a formalized contract.
- No entropy or coherence metrics (the `--coherence` CSS token is a palette
  colour, unrelated to a measured metric).
- No `phase` particle attribute (only "phase change" in the `crystallize` comment).
- No transformation primitives: `warp`, `wormhole`, `fuse`, `decay`, `fission`.
- Absorber CSS export is still `--mass` (`field.ts:509`); it should be
  `--accreted` with an optional `--mass` alias.

## Phase 1 reconciliations

### Vortex to 0.12

Canonical vortex should primarily swirl and retain shape lightly. It is not a
spiral drain. The stronger inward pull belongs in a preset (`whirlpool`,
`blackhole`, `accretion`).

```
f = (1 - d / r)^1.4 * S * 0.45
vx += (dy / d) * f * spin + (dx / d) * f * 0.12
vy += (-dx / d) * f * spin + (dy / d) * f * 0.12
heat = max(heat, (1 - d / r) * 0.6)   // unchanged
```

Patch: implementation, docs, formulas reference, conformance expected values. The
conformance check moves from an exact inward spiral to **tangential dominance**
(the swirl component exceeds the inward component by a wide margin).

### Absorber accreted

`b.accreted` is the captured-particle count, not inertial mass. `p.m` is reserved
for inertial mass. Remaining work: export `--accreted` CSS (keep `--mass` as a
temporary alias), fix the stale `forces.config.ts:146` comment, and confirm the
docs say absorb tracks an accreted count.

### Global safety invariants

Enforced at the integrator and conformance layer. Every force and composite must
keep: no NaN, no Infinity, finite position, bounded velocity (a hard cap),
bounded heat, and a stable particle count unless a budgeted [S] source is active.

## Type contracts to add

```ts
type IntegratorMode = 'legacy-euler' | 'semi-implicit-euler-dt' | 'velocity-verlet';
type MediumMode = 'designed-damping' | 'vacuum' | 'linear-drag' | 'quadratic-drag' | 'mixed-drag';
type DragMode = 'linear' | 'quadratic' | 'mixed';

type MediumConfig = {
  mode: MediumMode;
  damping: number;          // designed-damping multiplier (today's 0.95)
  density: number;
  linearCoefficient: number;
  quadraticCoefficient: number;
};

type ForceAccumulator = { fx: number; fy: number };  // physical-mode force path
```

Particle additions (keep existing names `m`, `charge`, `age`, `color`, `species`;
do not rename shipped fields):

```ts
phase: number;       // 0 gas/free · 0.5 liquid/cohesive · 1 solid/crystallized
coherence: number;   // per-particle order, for metrics
```

## Medium model

`FRICTION = 0.95` becomes the `designed-damping` medium mode, preserved exactly so
the homepage feel does not change. New modes layer in:

```
designed-damping : v *= damping
vacuum           : no global damping
linear-drag      : F = -k1 * v
quadratic-drag   : F = -k2 * |v| * v
mixed-drag       : F = -k1 * v - k2 * |v| * v
```

Real drag behaviour moves into `forces/medium` where appropriate. Keep the
designed-damping path available; do not break the homepage feel in one patch.

## Integrator modes

```
legacy-euler          : v += forceDelta; v *= damping; x += v   (today, frame-based)
semi-implicit-euler-dt: v += a * dt; x += v * dt                (first upgrade)
velocity-verlet       : half-step kick/drift                    (natural/cosmology)
```

Real `dt` in seconds with a fixed-step accumulator:

```
const FIXED_DT = 1 / 60;
frameTimeSec = min(frameTimeSec, 0.05);   // clamp the spiral of death
accumulator += frameTimeSec;
while (accumulator >= FIXED_DT) { step(FIXED_DT); accumulator -= FIXED_DT; }
```

Oscillators use seconds: `S(t) = S0 * (1 + sin(omega * timeSec + phase))`. Do not
mix milliseconds, frames, and seconds silently. Units in physical mode: position
px, velocity px/s, acceleration px/s², `dt` seconds.

### Velocity cap

A single safety concept `c = velocityCap`, reused for the safety clamp,
propagation, cosmology and lensing approximations, and source-blast containment.

```
speed = hypot(vx, vy);
if (speed > c) { vx *= c / speed; vy *= c / speed; }
```

Recommended `c = 720` px/s (physical) or `12` px/frame (legacy). It must never
produce NaN at zero velocity.

## Softened inverse-square

Already shipped as the shared `gravity`/`charge` kernel. This formalizes its
softening rule:

```
F = G * source * target / (d^2 + epsilon^2),   epsilon > 0
epsilon = max(data-core, 2)
epsilon = max(data-core, horizonRadius * 0.5, 2)   // blackhole/horizon presets
```

Applies to gravity, charge, and any future inverse-square primitive. Never to
canonical `attract`/`repel`, which stay bounded designed wells.

## Source and sink rules

Class [S] forces must be budgeted: `spawn`, `fountain`, source-style `supernova`,
and future `decay`/`fission`. Every [S] body defines at least one of `data-life`,
`data-cap`, `data-budget`, `data-sink`. Safe defaults `data-life="300"`,
`data-cap="120"`. A dev-mode guard warns and applies a safe cap when an [S] force
has no budget. Hard invariant: particle count may drift only while a registered,
budgeted [S] force is active. The source pass and age sink already exist; this
formalizes the guard and the defaults.

## `screen` modifier (new)

A boundary that creates quiet zones, shields text from noisy fields, and
attenuates sibling forces.

```
falloff     = max(0, 1 - d / range)^2
screenFactor = clamp(1 - S * falloff, min, 1)
siblingForce *= screenFactor
```

Attributes: `data-strength`, `data-range`, `data-screen-min`, `data-screen-mode`
(initial mode `local`; future `inside`/`outside`/`behind`).

## Modifier contract

Formalized execution, independent of registration order:

1. Body visibility and activity resolved.
2. Conditions gate the body.
3. Modifiers transform the force context, in order `spotlight -> screen -> resonate`.
4. Core forces apply.
5. Source and sink hooks run through the budget lifecycle.
6. Integrator applies `dt`, mass, damping/medium, heat decay, velocity cap, wrap.
7. Density and metrics write back to the DOM.

The parser classifies tokens into `{ modifiers, forces, sources }` rather than
relying on iteration order.

## Metrics: entropy and coherence (new)

Measured, never applied as forces.

```
entropy = 0.35 * velocityVariance + 0.25 * heatVariance
        + 0.25 * densityVariance + 0.15 * spatialDispersion
coherence = 1 - normalizedEntropy
```

Exposed as `--entropy`, `--coherence`, `--temperature`, `--density`. Used in Lab
diagnostics, debug overlays, render states, reduced-motion behaviour, and
unstable-sim detection. Expected directions: thermal and burst raise entropy;
supernova spikes it; drag lowers velocity entropy; diffuse lowers density
variance; align and cohesion raise coherence; crystallize and pressure lower
spatial entropy.

## Transformation layer (new)

Specific tokens, never a generic transform.

- `warp`: paired relocation through `data-pair`, preserving count, rotating
  velocity by `deltaTheta`, with an 8-frame cooldown to stop ping-pong.
- `fuse`: many-to-one merge under a distance, relative-speed, and heat threshold.
  Conserve mass and momentum; reduce count by one; release binding-energy heat.
- `decay`: age- or instability-driven split into two; budgeted; mass divided,
  momentum conserved.
- `fission`: triggered split from a large, hot particle; mass and momentum
  conserved; count increase budgeted.
- `wormhole`: a `warp` preset (paired throats).

## Boundaries and interfaces

Boundary is a concept category, not a single force.

| Boundary | Mechanism |
| --- | --- |
| Wall | reflect |
| Membrane | gate |
| Cone | spotlight |
| Optical | lens |
| Shear layer | shear |
| Event horizon | absorb, blackhole |
| Shield | screen |
| World edge | toroidal wrap |
| Content | DOM rect |
| Shape | morph target geometry |
| View | off-screen visibility disabling |

## Conformance expansion

- **Global safety** (every force): no NaN, no Infinity, velocity ≤ `c` after
  integration, bounded heat, finite position, stable count unless [S] active.
- **Conservation**: non-source forces never change count; collide/link/fuse/fission
  conserve momentum within tolerance and mass where it exists; absorb/supernova
  release exactly the accreted count.
- **Modifier determinism**: `spotlight screen resonate attract` behaves the same
  regardless of registration order.
- **Screen**: attenuates inside the radius, no effect outside, min clamp holds,
  composes with spotlight and resonate, no NaN at zero range.
- **Entropy**: thermal up, drag down (velocity), diffuse down (density variance),
  align up (coherence), crystallize down (spatial).
- **Vortex**: tangential dominates the inward component; swirls without immediate
  collapse; heat rises on engagement; no effect beyond range.
- **Source**: fountain reaches a steady count under cap and life; spawn, decay,
  fission respect budget.
- **Warp**: particle appears at the paired body; velocity preserved or rotated;
  count unchanged; cooldown prevents immediate return.
- **Physics modes**: designed matches today's golden behaviour within tolerance;
  natural uses mass in acceleration; hybrid preserves canonical feel; dt mode is
  frame-rate independent; the cap applies in all modes; vacuum does not globally
  damp.

## Implementation sequence

Ordering principle: reconcile, then measure, then guard, then abstract, then add
modes, then migrate natural primitives, then transform. Do not start by ripping
out the integrator. Preserve behaviour, add measurement, create compatibility
seams, then make physical behaviour opt-in and testable.

1. **Audit and reconciliation**: vortex to 0.12; absorber `--accreted`; global
   safety tests; velocity cap.
2. **Compatibility infrastructure**: `PhysicsMode`, `IntegratorMode`, `MediumMode`;
   the force-accumulation path behind a compatibility flag, with the legacy
   direct-mutation path intact until parity is proven.
3. **Time and medium**: fixed `dt` in seconds; semi-implicit Euler with `dt`;
   `FRICTION` formalized as `designed-damping`; vacuum and linear/quadratic/mixed
   drag; frame-rate independence tests.
4. **Natural primitive coherence**: extend the existing shared inverse-square
   kernel with the epsilon rules; route physical drag; keep canonical
   `attract`/`repel` bounded.
5. **Boundary and metrics**: `screen`; the modifier contract and parser; entropy
   and coherence; CSS metric exports; Lab and debug overlays.
6. **Transformation**: `warp`, `wormhole`, `fuse`, `decay`, `fission`, `phase`;
   source-budget and conservation tests.
7. **Advanced tooling**: record/replay, property-based fuzzing, CPU/GPU parity,
   debug views (force vectors, velocity, acceleration, density, entropy,
   coherence, source budgets, phase, screen attenuation).

## Version mapping

`v0.2.0` is already cut (force-aware Lab controls, quick-pick bands, and the
drag/emitter/vortex conformance fixes). The brief's batches shift up by one:

- **v0.3.0** — reconciliation, safety, boundary, metrics: vortex to 0.12, the
  `--accreted` export, velocity cap, source-budget guard, modifier contract,
  `screen`, entropy and coherence, boundary docs, safety conformance.
- **v0.4.0** — physical substrate: the mode type system, `dt` in seconds,
  semi-implicit Euler with `dt`, medium modes, linear and quadratic drag, the
  epsilon softening rules, frame-rate independence. (gravity and charge are
  already physical.)
- **v0.5.0** — transformation: `warp`, `wormhole`, `fuse`, `decay`, `fission`,
  `phase`, transformation docs, conservation tests.
- **v0.6.0** — scale and natural Lab: velocity-Verlet, the natural-physics Lab
  preset, record/replay, fuzzing, the CPU/GPU parity path, advanced overlays.

## Final target state

The designed UI feel stays intact. Canonical forces are not misrepresented as
literal physics. `attract` stays a bounded UI well; `gravity` is the true softened
inverse-square force; `charge` is its signed sibling. Drag supports linear and
quadratic behaviour. Global damping becomes an explicit medium, not an invisible
hack. Particle mass is first-class. Absorber accretion is not confused with
inertial mass. `dt` is explicit and frame-rate-independent modes exist. Source and
sink forces cannot grow the pool without budget. `screen` provides boundary and
shielding behaviour. Entropy and coherence make field state measurable.
Transformation is handled by specific mechanisms. Conformance protects formulas,
behaviour, stability, conservation, and compatibility. The registry stays compact,
meaningful, and extensible.
