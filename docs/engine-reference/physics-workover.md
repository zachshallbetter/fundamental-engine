> **Status: as-built force-engine reference.**
> Accurate for force formulas, catalogs, and engine behavior. It does NOT define the full current Fundamental platform architecture — for that see [../canonical/platform-architecture.md](../canonical/platform-architecture.md) and [../canonical/system-contracts.md](../canonical/system-contracts.md).

# Physics Workover

Status: a multi-version physics roadmap (v0.3 through v0.6), partly shipped. The v0.3
queue has shipped — swirl `0.12`, the sink `--load` export, the global velocity cap, the
conformance safety sweep, the source-budget guard, the modifier contract + classified
parser, the `screen` modifier, the measured entropy/coherence/temperature metrics, and
the boundary-type table ([`forces-system.md`](forces-system.md) §20.11); the mode
system, medium, real `dt`, and transformation primitives remain (v0.4+). This is the
authority for the multi-version physics effort (v0.3 through v0.6). It sits under the
spec ([`forces-system.md`](forces-system.md)); where this doc and the spec disagree,
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
| 1. Canonical UI forces | attract, repel, swirl, stream, viscosity, jet, tether, wall, sink | designed, bounded, legible interface verbs (stable runtime tokens) |
| 2. Natural primitives | gravity, charge, magnetism, thermal, collide, diffuse, propagate, memory | physically coherent laws (`memory` is the metric exception — a persistence signal / decaying occupancy grid, `FORCE_KIND = metric`, truth-mode `semantic`, not a physical law) |
| 3. Material primitives | cohesion, pressure, link, crystallize, pigment, phase | matter-like behaviour |
| 4. Boundary and modifiers | wall, gate, spotlight, lens, shear, screen, sink-horizon, world-wrap, DOM-rect | shape edges, membranes, cones, horizons, shields |
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
- **`b.accreted`**: the sink captured-count field (`forces/index.ts:188`),
  with `capacity` and a conserved `supernova` release. (The `b.mass` to
  `b.accreted` rename is already done in TS.)
- **Class [S] source and sink budgeting**: a `source()` hook on the `Force`
  contract, an integrator source pass (`integrator.ts:194-199`), and a mortal
  `age` despawn sink (`integrator.ts:180-183`).
- **`env.neighbors`** (spatial hash) and **`env.grid`** (scalar grid: diffuse plus
  leapfrog wave) are both implemented services, not stubs.

Real gaps (the actual work of this workover). The v0.3 queue has since closed the
first seven — they are kept here, marked **Done**, as the record of what shipped:

- **Done (#113).** Swirl inward bias reconciled `0.6` → `0.12` in code, the formulas
  reference, and the conformance check (now tangential dominance, not an exact inward spiral).
- **Done (#117).** A global velocity cap (`|v| ≤ c`, `c = 12`) plus a conformance safety
  sweep — no NaN/Infinity, finite position, bounded heat, and a stable count across every
  experiment.
- **Done (#115).** The sink exports `--load` (`accreted / capacity`), with `--mass`
  kept as a back-compat alias.
- **Done (v0.3 queue).** The source-budget guard: an [S] body with none of `data-life` /
  `data-cap` / `data-budget` / `data-sink` gets a dev-mode `console.warn` naming the
  element (the scanner's `guardSourceBudget`) and the safe default budget
  (`data-life="300"`, `data-cap="120"`); `spawn` clamps its rate to `cap / life`, so the
  body's live emission is bounded at ~cap. The `fountain` preset declares `life: 90`
  explicitly (its historical look, now an explicit budget). Conformance pins the bound.
- **Done (v0.3 queue).** The `screen` modifier — see §"`screen` modifier" below.
- **Done (v0.3 queue).** The modifier contract: tokens classify into
  `{modifiers, forces, sources}` (`classifyBodyTokens` in `config/forces.config.ts`,
  filled onto `Body.classified` by the parser) and modifiers evaluate in the formalized
  order `spotlight → screen → resonate` regardless of authoring or registration order.
- **Done (v0.3 queue).** Measured entropy / coherence / temperature — see §"Metrics"
  below for the as-built formulas. (The pre-existing `--coherence` CSS token from
  `cssTokens()` is a palette *color* on `:root`; the measured metric is a per-body
  number — see the naming note in §"Metrics".)
- `FRICTION = 0.95` is an unnamed global damping constant, not a medium mode.
- `dt` is frame-based (`0` or `1`), not seconds; no fixed-step accumulator.
- `viscosity` is linear only; no quadratic or mixed.
- No `PhysicsMode`, `IntegratorMode`, or `MediumMode` type system.
- No `phase` particle attribute (only "phase change" in the `crystallize` comment).
- No transformation primitives: `wormhole` (as a preset), `fuse`, `decay`, `fission`
  (`warp` itself shipped: conserved paired relocation, §22.3 of the spec).

## Phase 1 reconciliations

### Swirl to 0.12

Canonical swirl should primarily swirl and retain shape lightly. It is not a
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

### Sink accreted

`b.accreted` is the captured-particle count, not inertial mass. `p.m` is reserved
for inertial mass. Shipped (#115, #116): the `--load` CSS export (`accreted / capacity`,
with `--mass` kept as a back-compat alias), the corrected `forces.config.ts` comment, and
the spec/docs now state that sink tracks an accreted count.

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

**As built (v0.3):** the guard is `guardSourceBudget` in `core/scanner.ts`, run for
every parsed body (light-DOM scan, presets, shadow registration). The warn is gated by
the same dev flag as the contract guards (`contractChecksEnabled()`); the safe cap is
applied in production too — the safety net is not dev-only, only the noise is.
`data-life` flows onto each emission as its mortal `age`; `data-cap` clamps the
emission rate to `cap / life` per frame (a fractional accumulator carries sub-1/frame
budgets), so a body's live spawned population is bounded at ~cap independent of the
engine pool ceiling. An *authored* budget is never overridden — a body with only
`data-life` keeps its lifespan and an unclamped rate. `data-budget`/`data-sink`
presence satisfies the contract (their richer semantics — total-energy budgets, a named
reclaiming sink — are future work). The unbudgeted-source default changes behavior
deliberately: a bare `data-body="spawn"` now sustains ~120 longer-lived particles
instead of ~180 short-lived ones, and says so in the console.

## `screen` modifier (shipped, v0.3)

A boundary that creates quiet zones, shields text from noisy fields, and
attenuates the forces other bodies exert inside its radius.

```
falloff     = max(0, 1 - d / range)^2
screenFactor = clamp(1 - S * falloff, min, 1)
otherBodiesForce *= screenFactor
```

Attributes: `data-strength`, `data-range`, `data-screen-min`, `data-screen-mode`
(initial mode `local`; future `inside`/`outside`/`behind`).

**As built (v0.3):** truth mode designed; registered as the token `screen`
(`forces/extended.ts`, passported `klass: modifier`), with the pure math
(`screenFactor`) in `core/math.ts` and the attenuation applied in the integrator's
force pass — the only place per-particle, per-body forces compose. It is *cross-body*:
a screen damps OTHER bodies' forces on matter inside `data-range` and never its own
sibling tokens (the brief's "sibling forces" reads as *sibling bodies'* forces — the
shield semantics). `data-range="0"` is inert (screens are local, never global; also the
no-NaN-at-zero-range guarantee). Only `local` mode shipped; `data-screen-mode` parsing
is deferred with the other modes. Probe samplers (`forceAt`, the Lab frame-0 delta) read
raw forces — the integrator is the contract. Conformance: a two-attractor scenario
(`extraBodies`) pins attenuation inside vs. byte-exact non-effect outside; unit tests
pin the falloff curve, the min clamp, edge smoothness, and self-exclusion.

## Modifier contract (shipped, v0.3)

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

**As built (v0.3):** the classification is data exported from config
(`MODIFIER_ORDER`, `SOURCE_TOKENS`, `classifyBodyToken(s)` in
`config/forces.config.ts` — renderable by the Lab/docs, cross-checked against the
passports by a test). The parser fills `Body.classified` at parse time; bodies built
elsewhere (conformance, tests) are memoized lazily in the integrator. The integrator
evaluates a body's own modifiers in the contract order, then discovers custom
`modify()` hooks on its remaining tokens in authored order (so registry-extended
forces behave exactly as before); the cross-body `screen` factor composes between the
spotlight gate and the application multiplier. Unknown tokens classify as plain forces
— unchanged behavior. Today's modifiers compose commutatively (gates OR, strength
factors multiply), so formalizing the order changed **zero** behavior for existing
pages (the e2e suite is the harness); the order is pinned for future modifiers where
it will matter, and a determinism test asserts authored order cannot change outcomes.

## Metrics: entropy and coherence (shipped, v0.3)

Measured, never applied as forces (taxonomy layer 8).

The brief sketched a four-term field blend
(`0.35·velocityVariance + 0.25·heatVariance + 0.25·densityVariance +
0.15·spatialDispersion`, `coherence = 1 − normalizedEntropy`) but left every term's
scale open. The shipped definitions are the cheap, honest **local** versions —
measured per `data-feedback` body over the same `range/2` sample window that already
feeds the density count (no new O(particles × bodies) pass; the integrator accumulates
the sums in `Body.thermo` during the existing pass). The math is pure
(`core/thermo.ts`), unit-tested without an engine:

```
R           = |Σv| / Σ|v|                 // velocity alignment (mean resultant length)
entropy     = (1 − R) · min(1, s̄ / 1.5)   // direction dispersion, gated by agitation
coherence   = 1 − entropy                 // the brief's complement relation, exactly
temperature = ½·h̄ + ½·min(1, s̄² / 9)      // mean heat + normalized kinetic agitation
```

(`s̄` mean speed, `s̄²` mean squared speed, `h̄` mean heat; empty sample ⇒ entropy 0,
coherence 1, temperature 0 — a quiet region is cold and ordered.) The agitation gate
is what makes the expected directions honest: thermal randomizes directions at speed →
entropy up; drag stills the sample → entropy down (pure direction dispersion alone
would read damped chaos as disorder forever); align/cohesion raise R → coherence up.
Values are eased (the same 0.08 ease as `--d`) and exported through the ONE feedback
sink (#228) on both routes (the engine default sink and the platform's
`makeFeedbackSink`).

**Naming (read carefully — three near-collisions, all deliberate):**

- These engine-MEASURED thermodynamics write the **bare names** `--entropy`,
  `--coherence`, `--temperature` (with `--d`/`--field-density` as the density export),
  per this doc and the backlog.
- The platform's `--field-entropy` / `--field-coherence` (system-contracts §6 metric
  list) are **platform-inferred interaction metrics** — a different signal computed
  from interaction telemetry, not from particle state. The two families must not be
  cross-written.
- The `--coherence` set on `:root` by `cssTokens()` is a palette **color**
  (`#ffce6b`), unrelated to the metric. The measured value is element-scoped on
  `data-feedback` bodies, so it shadows the color only within those subtrees; no
  shipped CSS consumes `var(--coherence)` as a color today.

Used in Lab diagnostics, debug overlays, render states, reduced-motion behaviour, and
unstable-sim detection. Expected directions: thermal and burst raise entropy;
supernova spikes it; drag lowers velocity entropy; align and cohesion raise
coherence. (The brief's density-variance and spatial-dispersion terms — diffuse,
crystallize, pressure — belong to a future field-level entropy if a consumer earns
it; the shipped metric is deliberately local and velocity/heat-based.)

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

Boundary is a concept category, not a single force. The full boundary-type table —
each mechanism's behavior, truth mode, and verified shipped status — is canon in
[`forces-system.md`](forces-system.md) **§20.11** (shipped with the v0.3 queue); this
is the summary index:

| Boundary | Mechanism |
| --- | --- |
| Wall | wall |
| Membrane | gate |
| Cone | spotlight |
| Optical | lens |
| Shear layer | shear |
| Event horizon | sink, blackhole |
| Shield | screen |
| Portal | warp (+ data-pair) |
| World edge | toroidal wrap |
| Content | DOM rect |
| Shape | morph target geometry |
| View | off-screen visibility disabling |

## Conformance expansion

- **Global safety** (every force): no NaN, no Infinity, velocity ≤ `c` after
  integration, bounded heat, finite position, stable count unless [S] active.
- **Conservation**: non-source forces never change count; collide/link/fuse/fission
  conserve momentum within tolerance and mass where it exists; sink/supernova
  release exactly the accreted count.
- **Modifier determinism**: `spotlight screen resonate attract` behaves the same
  regardless of registration order.
- **Screen**: attenuates inside the radius, no effect outside, min clamp holds,
  composes with spotlight and resonate, no NaN at zero range.
- **Entropy**: thermal up, drag down (velocity), diffuse down (density variance),
  align up (coherence), crystallize down (spatial).
- **Swirl**: tangential dominates the inward component; swirls without immediate
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

1. **Audit and reconciliation**: swirl to 0.12; sink `--load`; global
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
viscosity/jet/swirl conformance fixes). The brief's batches shift up by one:

- **v0.3.0** — reconciliation, safety, boundary, metrics: swirl to 0.12, the
  `--load` export, velocity cap, source-budget guard, modifier contract,
  `screen`, entropy and coherence, boundary docs, safety conformance.
  **Shipped in full** — the queue items each carry conformance/unit tests; the
  as-built notes live inline in the sections above.
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
hack. Particle mass is first-class. Sink accretion is not confused with
inertial mass. `dt` is explicit and frame-rate-independent modes exist. Source and
sink forces cannot grow the pool without budget. `screen` provides boundary and
shielding behaviour. Entropy and coherence make field state measurable.
Transformation is handled by specific mechanisms. Conformance protects formulas,
behaviour, stability, conservation, and compatibility. The registry stays compact,
meaningful, and extensible.
