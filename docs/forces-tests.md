# Lab 

The Lab is a physics conformance instrument. Think of it like CERN. A particle goes in, we see what happens. If it does what we expect, it's good. If not, we fix it. Instead of just dropping particles and seeing what happens, we send a single particle into a force with known attributes and see what happens. We compare the actual behavior to the expected behavior and see if it matches. 

## Context

The Lab is a paint toy: drop `[data-body]` nodes and watch the shared field react.
It can't answer the question that actually matters for a physics engine: **send a
single particle into a force with known attributes — what is the expected behavior,
and did it occur?** We want a real instrument, backed by rigorous math.

The foundation is already strong: `forces.test.ts` / `natural.test.ts` /
`extended.test.ts` assert exact per-frame Δv per force with shared `body()`/`part()`/
`env()`/`near()` helpers; `integrator.bench.ts` already runs the engine headlessly
(store + env + `step()`). What's missing is (1) a **single declarative catalog** of
"expected behavior per force" and (2) a way to **see and operate** it.

The design: one headless **`runScenario()`** in core that builds its own particle(s)
+ body + env and runs the real engine deterministically, returning the trajectory.
A declarative **expectations** layer (invariants + exact-formula checks) defines
"appropriate reaction". The **same catalog + runner power both the test suite and the
new Lab "Verify" instrument** — so "did it happen?" is answered identically in code
and on screen. (Decisions: the Lab *becomes* Verify, paint tool retired; checks are
invariants + exact formula.)

## Architecture

A shared, framework-agnostic conformance layer in `forces-ui` core, consumed by both
`node:test` and the Lab page. No engine API changes (no particle inject/read needed —
the runner owns its own store).

```
Scenario     → force token(s) + body attrs + initial particle(s) + frames + seed
runScenario  → builds store/body/env, runs real step() N frames (real neighbors/grid),
               returns trajectory[frame][particle] (+ a single-apply exact Δv for class A)
Expectation  → { label, kind: 'invariant'|'exact', check(result) → {pass, measured, expected} }
EXPERIMENTS  → one ForceConformance { scenario, expectations[] } per force (the catalog)
```

## Phase A — Core conformance framework (one PR; the "formulas + tests" deliverable)

New `packages/core/src/conformance/`:

- **`types.ts`** — `Scenario`, `FrameState`, `ScenarioResult`, `Expectation`,
  `ForceConformance`. `class: 'A'|'B'|'C'|'modifier'` (single-particle / neighbours /
  grid / modifier) drives how the runner sets up.
- **`run.ts`** — `runScenario(scenario, registry): ScenarioResult`. Mirrors
  `integrator.bench.ts`: a `FieldStore` seeded with the scenario particle(s), a full
  `Body` (reuse the test-helper default shape) from `scenario.body`, an `Env` with the
  **real** `store.neighbors` (class B) and a **real** `ScalarGridImpl` advanced each
  frame (class C, replicating `field.ts`'s grid `step()`); run `step()` for `frames`,
  capturing `{x,y,vx,vy,heat,speed}` per particle per frame. For RNG forces
  (`thermal`, `emitter`) temporarily swap `Math.random` for a seeded `mulberry(seed)`
  and restore (deterministic, reproducible). Also compute `applyDelta` — one direct
  `force.apply(b,p,env)` with hand-set `dx/dy/dist` — for exact class-A first-frame Δv.
- **`expectations.ts`** — a small library of reusable predicate builders:
  `movesToward(body)`, `movesAway`, `speedPreserved(tol)`, `speedDecreases`,
  `perpendicularToVelocity`, `momentumConserved(set)`, `exactDelta(dvx,dvy,tol)`,
  `staysInRange`, `noEffectBeyondRange`, `gatedOutsideCone`, `followsGradient`,
  `pathDeepens`, `isotropic`/`varianceApprox` (statistical, for thermal), etc. Each
  returns `{pass, measured, expected}` so the Lab can render the numbers.
- **`experiments.ts`** — `EXPERIMENTS: ForceConformance[]`, one per registered force
  (28) plus the two modifiers and a couple of composites/conditions. Each pairs a
  sensible default scenario with its invariants + exact checks. Representative:
  - `attract`: p at (150,0), body at origin, S=1 R=300 → *moves toward* + `exactDelta(0.125,0)`.
  - `drag`: p with v=(5,0) → *speed decreases*, *direction unchanged*, exact factor.
  - `lens`: moving p → *speed preserved*, *rotated by θ = θmax·(1−d/r)·spin*.
  - `magnetism`: moving charged p → *perpendicular to v*, *no work (speed preserved)*.
  - `collide` [B]: two approaching discs → *momentum conserved*, *they separate*.
  - `cohesion`/`align` [B]: 2+ particles → *push<r₀, pull mid-range* / *steers to mean heading*.
  - `diffuse`/`memory`/`propagate` [C]: real grid → *follows up-gradient* / *path deepens*.
  - `resonate`/`spotlight` (modifier): call `modify()` directly → *strength ~ 1+sin ωt* /
    *gate true outside cone, Δv inside*.
  - `thermal`: seeded, many samples → *isotropic*, *variance ≈ 2·S·(1−d/r)*, *mean ≈ 0*.
  - …gravity, charge, repel, vortex, spring, stream, emitter, reflect, absorb, gate,
    buoyancy, shear, crystallize, wind, pigment — each its experiment.
- **`conformance.test.ts`** — (1) completeness: every token in the force registry has
  an `EXPERIMENTS` entry (mirror `manual.test.ts`); (2) for each experiment,
  `runScenario` then assert **every** expectation `pass`. This is the systematic
  physics conformance suite. Existing golden tests stay (additive).
- Export the catalog + `runScenario` + expectation builders from
  `packages/core/src/index.ts`.

## Phase B — The Lab Verify instrument (one PR; "make the lab an actual lab")

Rewrite **`apps/site/src/pages/lab.astro`** as the instrument (retire the paint tool).
Imports `{ EXPERIMENTS, runScenario, registry }` from `forces-ui`, runs the sim
client-side, draws to its **own** dedicated `<canvas>` (the ambient `<forces-field>`
from `Base.astro` stays as decorative background; the experiment is independent).

- **Force picker** (left): the 28 forces grouped by family (reuse `MANUAL_FORCES` +
  glyphs); selecting one loads its experiment.
- **Experiment canvas** (centre): draws the body marker, the test particle(s) + their
  **actual** trajectory (path + current position), and the **expected** overlay (an
  arrow for expected initial Δv direction; a ghost/target where relevant). Play / pause
  / step / reset.
- **Readout panel** (right): editable scenario params (strength, range, spin/angle,
  initial vx/vy, distance, particle count for [B]/[C]) — *"we just change those
  parameters"*; and the **expectations checklist** — each invariant/exact check with
  ✓/✗, measured vs expected, and a headline **PASS / FAIL**. Editing a param re-runs
  `runScenario` live and re-evaluates.
- **Share** via URL hash (repurpose the existing hash serialization to encode force +
  params).
- New `apps/site/src/styles/lab.css` for the instrument; update the home/docs copy that
  describes the Lab ("place forces / share the field" → "verify any force's physics").

## Reuse (don't rebuild)

- `integrator.bench.ts` headless pattern (store + env + `step()`), the test-helper
  `body()`/`part()`/`env()` default shapes (`packages/core/src/forces/*.test.ts`), the
  `mulberry` PRNG (in the bench), `ScalarGridImpl` (`core/scalar-grid.ts`) + the grid
  `step()` loop from `core/field.ts`, `manual.test.ts`'s completeness pattern,
  `MANUAL_FORCES` + `force-glyphs.css` for the Lab picker.

## Verification

- `pnpm --filter forces-ui typecheck && test` green — the new `conformance.test.ts`
  asserts completeness (every force has an experiment) + every expectation passes; run
  twice (RNG forces are seeded, so it's deterministic). `pnpm -r build` green.
- Lab: preview via the "forces" config (port 4399) — pick several forces, confirm the
  canvas animates the trajectory and the checklist shows PASS with sane measured
  numbers; edit a param and watch it re-evaluate; check console-error clean. (Live-loop
  caveat: the instrument's own sim is synchronous/deterministic and re-runs on demand,
  so it's verifiable from a screenshot unlike the ambient rAF field.)
- Land Phase A, then Phase B, each as its own squash-merged PR; confirm Vercel READY.

## Open / deferred

- The retired paint tool could return later as a docs demo; not now.
- Multi-force composition + condition-gate (`data-when`) experiments: include a couple
  in the catalog now; exhaustive composition matrix is a later extension.
- A "sweep" view (vary a param across a range, plot the response curve) is a natural
  follow-on once the single-experiment instrument exists.