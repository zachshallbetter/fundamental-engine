# Designed vs. Natural — the shortcut map

> **Status: canonical.**
> This document is the foundational statement of *why the engine is shaped the way it is.* Every engine
> concept stands in some relationship to what nature does: it either matches it, simplifies it the way
> real simulators do, deliberately departs from it, or invents something with no physical analog. The
> **departures are the source of the engine's flexibility** — a force unbound by a conservation law can
> be bounded, calm, composable, and cheap. This map names the relationship for each concept so the
> [truth-mode system](fundamental-field-behavior-table.md#truth-modes) (`physical` / `designed` /
> `hybrid` / `semantic` / `poetic`) has a rationale, not just a label. It is descriptive of the shipped
> engine; where it disagrees with the code, the code wins. The roadmap reading — which departures
> become opt-in *Faithful* modes — lives in
> [`../planning/substrate-architecture-frontier.md`](../planning/substrate-architecture-frontier.md). The
> composition rules — how dimensions, fields, forces, relationships, and Field Formations combine
> (orthogonal-by-default, association ≠ coupling), plus the five-question method for reading any force — live in
> [`dimensional-coupling.md`](dimensional-coupling.md).

## The four relationships

Not every concept is a shortcut. Each cell below is tagged with one of:

- **Faithful** — the engine does what nature does. This is where physics and good interface behavior
  happen to agree, and the engine gets physics' intuitive legibility for free.
- **Idealization** — a legitimate physical simplification that real simulators (N-body codes, molecular
  dynamics) also make: point masses, infinite-mass anchors, force softening, neighbor cutoffs, 2D.
- **Departure** — a deliberate, tuned break from physical law, for legibility, calm, or performance.
  **This column is the flexibility.**
- **No analog** — behavioral or semantic; nature has no such force. Pure interface invention.

## A. The dynamics core (the integration loop)

| Engine concept | What nature does | Relationship | What it buys |
|---|---|---|---|
| Force combination = linear sum | Superposition `F_net = ΣFᵢ` | **Faithful** | Correct by construction (why prioritized *allocation* would be the un-physical choice) |
| Integrator (default Explicit Euler, opt-in `fixed` / `velocity-verlet`) | Continuous ODE; symplectic/Hamiltonian flow | **Departure** (default) / **idealization/partial** (opt-in Verlet) | Euler is cheap and good enough; Verlet provides stable orbits |
| Friction = ×0.95 post-step | Dissipative forces (Coulomb/viscous/quadratic) → heat (2nd law) | **Departure** | An interface that always settles; no static-threshold bookkeeping |
| Velocity cap `|v|≤c` (12) | Relativistic limit; or terminal velocity from drag balance | **Departure** | A hard anti-blow-up rail; a non-physical clip |
| Mass = nominal 1 (opt-in `a=F/m`) | Inertia always: `a=F/m`, `m ∝ matter` | **Departure** (default) / **Faithful** (opt-in) | Authors tune `strength` directly without reasoning about mass |
| Recoil: absent by default, opt-in for dynamic bodies | Newton's 3rd law; momentum conserved | **Idealization** (default = infinite mass) / **partial** (opt-in) | Default: a body is a stable layout reference. A `data-authority="dynamic"` body recoils under the net field (shipped); own-emission reaction + inertial-mass ∝ area are the momentum frontier (#871) |
| dt tied to rAF; compute every 6th frame | Continuous time | **Departure** | Large perf win; couples physics to render cadence |

## B. The force laws

| Engine concept | What nature does | Relationship | What it buys |
|---|---|---|---|
| `attract`/`repel` bounded `(1−d/r)ⁿ` | Gravity/Coulomb unbounded `1/r²` | **Departure** | Finite range, no singularity — the flagship designed/natural split |
| `gravity` softened `−GM r̂/(r²+ε²)` | True `1/r²` (singular) | **Idealization** | Plummer softening — a standard N-body technique |
| `charge` signed `1/r²` | Coulomb's law | **Faithful** | Real polarity intuition |
| `magnetism` 2D Lorentz (out-of-plane B) | Full 3D `F=q(v×B)` | **Idealization** | Dimensional reduction to the canvas; speed-preserving |
| `collide` pairwise impulse + restitution | Elastic/inelastic collision | **Faithful** | Real momentum exchange — the one place recoil already lives |
| `thermal` random kicks | Langevin / Brownian (fluctuation-dissipation) | **Faithful** | Genuine stochastic dynamics |
| `pressure` SPH density relaxation | Fluid pressure / equation of state | **Faithful** (SPH is a real method) | Incompressible fill |
| `propagate` wave radiation push | Wave equation / radiation pressure | **Faithful-ish** | Real wavefront behavior |
| `viscosity` velocity damp | Viscous shear stress (Navier–Stokes) | **Departure** | A local "thickness" dial, not a stress tensor |
| `swirl` tangential + 0.12 inward | Vortex / angular momentum (fluid) | **Departure** | A designed *spin* that reads as intent |
| `tether`/`link` capped, damped spring | Hooke's law `F=−kx` | **Departure** | Bounded so it can't explode in a layout |
| `lens` velocity rotation, speed-preserved | Gravitational lensing (spacetime curvature) | **Departure** | "Bending" without GR — a path deflector |
| `wall` kinematic reflect ×0.85 | Rigid-boundary elastic collision | **Idealization** | A boundary with a restitution coefficient |
| `sink` capture (count-conserving) | Gravitational accretion / absorption | **Departure** | Accretion without losing the count invariant |
| `align` neighbor velocity match | — (flocking is biological) | **No analog** | Boids alignment as a verb |
| `hunt` predator/prey | Lotka–Volterra population dynamics | **No analog** (ecology math, not a force) | Behavioral pursuit/evasion |
| `diffuse` pheromone gradient | Fick's law / stigmergy | **Faithful-ish** (Fick) | Ant-trail emergence |
| `memory` decaying deposit grid | — (hysteresis/sediment, no fundamental force) | **No analog** (semantic) | The field *remembers* |
| `warp` teleport | — (wormholes speculative) | **No analog** (poetic) | An effect with no obligation to physics |

## C. The matter model

| Engine concept | What nature does | Relationship | What it buys |
|---|---|---|---|
| Particle = point (optional z) | Matter has extent, shape | **Idealization** | Cheap; the classic point-mass abstraction |
| No rotation / angular momentum / torque (angular *lane* exists, no producer) | Rigid bodies spin; angular momentum conserved | **Departure** | Particles have an opt-in `orient`/`spin` lane the accumulator captures (#855), but no shipped force writes spin (a public `torque` is deferred) — so nothing tumbles in practice yet (the *collapsed dimension* is restorable) |
| Count = the one strong invariant | Conservation of mass / number | **Faithful-ish** | A guarantee the engine *can* keep, unlike energy/momentum |
| Body position = DOM rect, re-measured | Position is evolved state | **Departure** | The body stays locked to its element — keeps layout coherent (and what recoil collides with) |
| Body ≠ Particle (source vs consumer) | A body is just heavy matter | **Departure** (softening) | Lets an immovable emitter exist by default; a `data-authority="dynamic"` body already dissolves this (it moves under the field), and own-emission recoil (#871) closes the rest |

## D. Fields & representation

| Engine concept | What nature does | Relationship | What it buys |
|---|---|---|---|
| Scalar grids (memory/heat/density) | Continuous fields (PDEs) | **Idealization** | Discretization — every field sim does it |
| Neighbor cutoff radius (spatial hash) | Forces act at all distances | **Idealization** | O(N) not O(N²); screening/Debye length is even physically real |
| Reciprocity via CSS-feedback loop | Direct mutual force (3rd law) | **Departure** | The field talks to the DOM through *style*, not motion — the platform-native trick |
| Render optional / signals-first (`render:'none'`) | Phenomena are always "rendered" (physical) | **Departure** | Behavioral model as substrate, not spectacle — motion is one view |

## E. Conservation, units, space

| Engine concept | What nature does | Relationship | What it buys |
|---|---|---|---|
| Energy not conserved (driven-damped) | 1st law: conserved in closed systems | **Departure** | Calm — the field always relaxes; energy *accounted* as heat/sparks |
| Momentum partial (collide only) | Always conserved | **Departure** | Stable references |
| Nominal units (`c=12`, `0.95`, px/frame) | SI; dimensional consistency | **Departure** | No unit reasoning for authors; blocks meaningful momentum *exchange* until fixed |
| 2D default (z optional) | 3D + time | **Idealization** | The DOM/canvas is 2D; native planes prove 3D is possible when the surface allows |

## The thesis

Read the **Departure** column top to bottom — bounded falloffs, post-step friction, the velocity clip,
immovable bodies, the CSS-feedback loop, optional rendering, nominal units. **That column is the
flexibility.** Each is a place the engine refused to be bound by physical law so it could be bound by
*interface law* instead — legible, calm, composable, cheap, platform-native. A physics engine cannot
make a button's importance a bounded well that vanishes at 240px; Fundamental can, precisely because
`attract` is a *Departure*, not gravity.

- **Faithful** rows borrow physics' credibility and legibility for free (charge polarity, collisions,
  thermal jitter, superposition).
- **Idealizations** are ordinary simulation economics — the same ones real N-body codes make.
- **No-analog** rows (`memory`, `warp`, `align`, `hunt`) are pure interface invention wearing physics'
  clothing.

The truth-mode system is the engine being **honest about which column each force is in.** And the
substrate roadmap is, in one sentence: *move a few of the highest-value Departures into opt-in Faithful
versions* (a real integrator, real mass, real recoil) — **without losing the Departures that make this
an interface engine rather than a physics toy.** See
[`../planning/substrate-architecture-frontier.md`](../planning/substrate-architecture-frontier.md).
