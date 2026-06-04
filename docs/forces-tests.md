# Forces — Testing & Conformance

> How every force in the engine is verified to do what the math says. Companion to
> [`forces-system.md`](forces-system.md) (the spec). Section refs like §6 point there.

A physics engine is only as trustworthy as its proof that each force behaves. This
document is that proof, in two registers: the **unit math** (each force's exact
per-frame Δv) and the **behavior** (the invariants that define "reacts appropriately").
The behavioral layer is a single declarative catalog that drives both the test suite
and the **Lab detector** ([`/lab`](https://forces-ui.com/lab)) — so "did the expected
thing happen?" is answered identically in code and on screen.

The Lab is the human face of it: think of it like a particle collider. A known particle
goes into a known force; you watch its track, the surrounding field, and any related
particles; the measured behavior is checked against the prediction. If it matches, good.
If not, tune the attributes and fire again.

---

## The four layers

| Layer | File(s) | Asks | Style |
|---|---|---|---|
| **Golden unit tests** | `forces/forces.test.ts`, `forces/natural.test.ts`, `forces/extended.test.ts` | Is each force's per-frame math *exactly* the spec formula? | direct `apply(b,p,env)`, hand-built env, assert Δv |
| **Integrator tests** | `core/integrator.test.ts` | Does the loop *around* forces hold (friction, heat decay, edge wrap, the modifier pass, first-class mass, conserved-attention/causality)? | `step()` over a `FieldStore` |
| **Conformance suite** | `conformance/` | Fire a particle into a force — *did the expected behavior occur*? | `runScenario()` + declarative expectations |
| **Benchmark** | `bench/integrator.bench.ts` | How fast is the hot loop? (perf, not correctness) | timed `step()` at several scales |

How they relate:

- **Golden tests pin the coefficients.** They call a force's `apply()` directly with a
  hand-set `env` (`dx`, `dy`, `dist` precomputed) and assert the precise Δv. They catch a
  wrong constant even when the direction is right. Helpers `body()` / `part()` / `env()` /
  `near()` are shared across the three files.
- **The conformance suite pins the behavior.** It runs the *real* engine on a controlled
  scenario and checks named invariants (direction, speed change, conservation, …) plus an
  exact Δv where the formula is clean. It is the systematic, completeness-guarded layer,
  and it is the same catalog the Lab renders.
- **Integrator tests pin the surroundings** — the per-frame friction (`×0.95`), heat decay
  (`×0.972`), toroidal wrap, the `modify()` pass, and the opt-in systems.
- **The benchmark is not a correctness gate** — it tracks throughput so a regression is
  visible (`pnpm --filter forces-ui bench`).

Run everything with `pnpm --filter forces-ui test` (Node's built-in `node:test`, zero
test framework). RNG forces are seeded, so the suite is deterministic across runs.

---

## The conformance system

Lives in `packages/core/src/conformance/`, exported from the package so the Lab imports
the exact same code the tests run.

```
Scenario     a known particle (or particles) fired into a force with known attributes
runScenario  builds its own FieldStore + Body + Env, runs the real step() N frames,
             returns the trajectory + each particle's frame-0 force delta
Expectation  { label, kind: 'invariant'|'exact', check(result) → {pass, measured, expected} }
EXPERIMENTS  one ForceConformance { scenario, expectations[] } per registered force
```

### Scenario

```ts
interface Scenario {
  force: string;                 // the force under test
  tokens?: string[];             // body tokens (default [force]); modifiers pair, e.g. ['resonate','attract']
  family: 'canonical' | 'natural' | 'extended';
  klass: 'A' | 'B' | 'C' | 'modifier';
  body: Partial<Body>;           // strength, range, spin, angle, M, cx, cy, hw, hh, …
  particles: ScenarioParticle[]; // initial state(s); particles[0] is the tracked test particle
  frames: number;                // how long to simulate
  seed?: number;                 // for RNG forces (thermal, emitter) → reproducible
}
```

### The four classes

The class decides how `runScenario` wires the environment (§20.1):

- **`A` — body → particle.** Single particle, no services. 21 forces.
- **`B` — particle ↔ particle.** Needs `env.neighbors` (a real spatial hash). `collide`,
  `cohesion`, `pressure`, `hunt`, `align`.
- **`C` — field-buffer.** Needs `env.grid` (a real `ScalarGrid` advanced each frame).
  `diffuse`, `propagate`, `memory`.
- **`S` — source / sink.** `apply()` is a no-op; the work is in `source()`, run once per
  body per frame to *create* matter via `env.spawn`. Breaks conservation by design, so it
  self-budgets (a per-particle lifespan `age` + a hard pool ceiling). `spawn`.
- **`modifier`.** `apply()` is a no-op; the work is in `modify()`, which scales or gates
  sibling forces. `resonate`, `spotlight`.

### runScenario

Mirrors `integrator.bench.ts`: a `FieldStore` seeded with the scenario particle(s), a
full `Body` from `scenario.body`, an `Env` with **real** `store.neighbors` (class B) and a
**real** `ScalarGridImpl` stepped each frame (class C). It runs the real `step()` for
`frames`, capturing `{x, y, vx, vy, heat, speed}` per particle per frame. For RNG forces
it temporarily swaps `Math.random` for a seeded `mulberry(seed)` and restores it. It also
computes `applyDelta` — one direct `apply()` with hand-set `dx/dy/dist`, the pure
frame-0 force effect *before* friction — which the exact and direction/speed checks use
(the trajectory itself is friction-damped, so those checks read `applyDelta`, while
position checks read the trajectory).

### Expectation vocabulary

Reusable builders in `conformance/expectations.ts`. Each returns `{pass, measured,
expected}` so the Lab can show the numbers.

| Builder | Asserts |
|---|---|
| `movesToward()` / `movesAway()` | the frame-0 Δv points in / out along the body axis |
| `exactDelta(dvx, dvy, tol)` | the precise frame-0 Δv (the spec formula) |
| `speedPreserved(tol)` | `|v + Δv| ≈ |v|` — a rotation, no work |
| `speedReduced()` | speed bled off (drag) |
| `perpendicularToVelocity(tol)` | `Δv · v ≈ 0`, `Δv ≠ 0` (Lorentz, no work) |
| `momentumConserved(tol)` | `Σ Δv ≈ 0` across the particle set (elastic collision) |
| `separates()` | two particles end farther apart than they began |
| `approachesBody()` / `recedesFromBody()` | the track ends closer / farther over time |
| `noEffectBeyondRange()` | a probe past `~1.6× range` gets no Δv |
| `followsGradient(gx, gy)` | a `[C]` force deposits a mark and steers up the grid gradient |
| `gatesOutsideCone(in, out)` | a modifier gates siblings outside a heading cone, acts inside |
| `modulatesStrength()` | a modifier scales sibling strength `1 + sin(ωt)` |
| `unaffectedWhenNeutral()` | the force ignores charge-free matter (`charge`) |
| `adoptsTint()` | the particle takes on and carries the body tint (`pigment`) |

### Verdict

A force passes its experiment iff **every** expectation passes. `conformance.test.ts`
enforces two things: completeness (every registered force token has an experiment — the
same guard as `manual.test.ts`) and correctness (every expectation of every experiment
passes). In the Lab, the same per-expectation results render as a **MATCH / NO-MATCH**
verdict; tuning a parameter re-runs `runScenario` live. (Exact checks are pinned to each
experiment's default attributes, so once you tune they go *default-only* and drop out of
the verdict while the tuning-robust invariants keep proving the physics.)

---

## The catalog

Every registered force, with the experiment that verifies it. `d` is the
particle→body distance, `r` the range, `S` the strength, `û` the unit vector toward the
body. "Δv" is the frame-0 effect on a still particle unless a velocity is given.

### Canonical nine (§6)

| Force | Fired in | Expected behavior | Exact Δv | Law |
|---|---|---|---|---|
| `attract` | still p, 150px out, S 1, r 300 | pulled toward the body; falls with distance; nothing past range | `(0.125, 0)` | `f=(1−d/r)²·S·0.5` inward (§6.1) |
| `repel` | still p, 150px out, S 1, r 300 | pushed away; mirror of attract | `(−0.125, 0)` | same `f`, outward (§6.6) |
| `vortex` | still p, 150px out, spin +1 | mostly tangential swirl + a small inward retention | `(0.020, −0.171)` | `f=(1−d/r)^1.4·S·0.45`; tangential ±`spin`, +0.12 inward (§6.8) |
| `stream` | still p, heading +x | a steady current along the heading | `(0.233, 0)` | `f=(1−d/r)^1.1·S·0.5` along `(ux,uy)` (§6.5) |
| `drag` | p moving `vx=5` | speed bled off, no redirection | `(−0.3, 0)` | `v −= v·k`, `k=(1−d/r)(0.05+S·0.07)` (§6.7) |
| `emitter` | still p in the feed zone (d>24) | drawn toward the nozzle (inside it, relaunched as a hot jet) | `(0.1, 0)` | feed `f=(1−d/r)²(0.25+S·0.15)`; nozzle jet `spd=2.4+S·2.6` (§6.2) |
| `spring` | still p inside the rest shell (d 150 < rest 180) | pushed back out toward the rest radius, lightly damped | `(−0.532, 0)` | `v += û(d−rest)k`, `rest=r·0.6`, damp `×0.985` (§6.3) |
| `reflect` | p moving into the wall box | elastic bounce — velocity reverses, damped (`e≈0.85`) | reverses sign | axis-aligned wall on the element box (§6.4) |
| `absorb` | still p inside `absorbR` | captured (`accreted++`), then drifts to the core; releases at capacity | — | capture → supernova at `capacity` (§6.9) |

### Natural primitives (§20.10)

| Force | Fired in | Expected behavior | Class | Law |
|---|---|---|---|---|
| `gravity` | still p near `M=2000` | pulled inward; ends closer; nothing past range | A | softened `F=GM·û/(d²+ε²)`, `ε=2GM/c²` |
| `charge` | like-signed p (`q=+1`) by `spin +1` | like repels (opposite would attract); neutral matter unaffected | A | `s=−σ·q·GM`; same kernel as gravity |
| `magnetism` | moving charged p (`vx=5`, S 0.05) | curves ⟂ to velocity, doing no work — speed preserved | A | Lorentz `F=qB·(−v_y, v_x)` |
| `thermal` | p in a bath, seeded | agitated into motion; kicks isotropic (comparable spread on both axes) | A | Langevin `σ=√(2·S·(1−d/r))`, Box–Muller |
| `collide` | two approaching discs | momentum conserved across the pair; they separate after | B | elastic half-impulse along the contact normal, `e=S` |
| `diffuse` | p over a pheromone grid | deposits a mark and steers up the diffused gradient | C | `∂φ/∂t=D∇²φ`; follow `∇φ` |
| `propagate` | p near an engaged emitter | injects a shock (when engaged) and rides the wavefront | C | wave `∂²φ/∂t²=c²∇²φ` |
| `memory` | still p, 120px out | an attractive pull amplified by how worn the spot is | C | pull `×(1 + 0.5·M(x))`, slow-decay occupancy |

### Designed-extended (§20.3)

| Force | Fired in | Expected behavior | Class | Law |
|---|---|---|---|---|
| `lens` | moving p (`vx=5`), θmax 0.3 | path bent without adding energy — speed preserved, rotated by θ | A | `θ=θmax(1−d/r)·spin`, `v ← rotate(v,θ)` |
| `gate` | p crossing against the heading | the wrong-way crosser is reflected back along `n` | A | if `v·n<0`: `v −= 2(v·n)n` |
| `buoyancy` | hot, large p (light) | light matter rises (`−y`); dense settles | A | `v_y −= (ρ_med − ρ_p)g`, `ρ_p=base/(size(1+heat))` |
| `shear` | p offset ⟂ to the flow axis | dragged along the axis in proportion to its ⟂ offset | A | `v_∥ += S·(offset_⊥/r)(1−d/r)` |
| `crystallize` | cool p off a lattice node | snaps toward the nearest node and settles; melts when hot | A | `v += (node−p)·k`, damp `×0.9`, while `heat<0.5` |
| `align` | p among neighbours moving +y | steers toward the neighbour-mean heading, preserving speed | B | `v += (ĥ·|v| − v)·k`, `ĥ`=mean neighbour dir |
| `wind` | p in a global gust | a non-zero, divergence-free curl-noise push | A | `v += curl(ψ)·S`, `∇·curl ≡ 0` |
| `cohesion` | two particles at mid-range | mid-range neighbours draw together (surface tension); push when too close | B | push `d<r₀`, pull `r₀<d<r₁`, `r₀=r₁·0.5` |
| `pressure` | two overlapping particles | over-dense matter spreads apart to an even fill; momentum conserved | B | `ρ=Σ W(d,h)`, `v += −k·(ρ−ρ₀)·∇W`, `ρ₀=0.5` |
| `hunt` | a predator and a prey particle | the predator accelerates toward the prey; the prey flees; the pair migrates | B | predator `v += seek·S`, prey `v += flee·S`, by `species` |
| `spawn` | an engaged source, empty field | the pool grows as matter is emitted along the heading; mortal matter despawns | S | `source()` emits `round(S·2)`/frame, `age`-budgeted |
| `resonate` | modifier on `attract` | scales the sibling's strength as `1 + sin(ωt)` (ω=3) | modifier | `modify → {strength}` |
| `spotlight` | modifier on `stream` | gates the sibling outside a ~60° heading cone, lets it act inside | modifier | `modify → {gate}` when `û·heading < 0.5` |
| `pigment` | p overlapping a tinted body | adopts the body's tint and carries it away (conserved colour) | A | `c_p ← mix(c_p, tint)` on overlap (`d<0.6r`) |

### Composition & conditions

Forces aren't only verified one at a time — a body can carry several tokens (they
**compose**) and gate on a condition (`data-when`). A second catalog,
`COMPOSITE_EXPERIMENTS`, verifies those two mechanisms (run alongside the per-force
catalog by `conformance.test.ts`):

| Experiment | Fired in | Expected behavior |
|---|---|---|
| `attract repel` | equal attractor + repeller on one body | the two cancel — net Δv ≈ 0 |
| `attract vortex` | one body, both forces | composes to the **sum** of the parts — an inward pull *and* a tangential swirl (Δv ≈ (0.146, −0.171)) |
| `attract` + `data-when="fast"` | a fast and a slow particle | the gate lets the **fast** particle through (pulled toward the body) and **blocks** the slow one (left alone) |

Condition gating runs through the real condition registry (`active`, `fast`, `slow`,
`hot`, `cool`), so the trajectory reflects the gate frame by frame.

---

## Adding a force

1. Implement and register it (`forces/*.ts`), with a **golden test** pinning its exact
   per-frame math.
2. Add a **`ForceConformance`** entry to `conformance/experiments.ts`: a scenario that
   fires a representative particle into it, plus the invariants (and an `exactDelta` where
   the formula is clean) that define "appropriate reaction".
3. Document it in the catalog above (one row). The completeness guards fail until a force
   is covered in both the catalog of experiments **and** this document.
4. It appears in the Lab picker automatically (the picker is driven by `EXPERIMENTS`).

---

## Coverage & deferred

- **28 forces**, each with an experiment; the conformance suite is **30 `node:test`
  cases** (completeness + per-force), deterministic across runs, on top of the ~60 golden
  unit tests and the integrator suite. Total ≈ 220 core tests.
- **Deferred:** multi-force composition experiments (`data-body="attract repel"`),
  condition-gate (`data-when`) experiments, and a Lab "sweep" view (vary one parameter
  across a range and plot the response curve) are natural extensions once the
  single-experiment instrument is in hand.
