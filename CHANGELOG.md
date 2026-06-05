# Changelog

All notable changes are documented here, following
[Keep a Changelog](https://keepachangelog.com) and [SemVer](https://semver.org).
The packages are not yet published to npm; each release is cut as a git tag
(see [RELEASING.md](RELEASING.md)).

## [Unreleased]

The **physics workover** begins: a designed / natural / hybrid substrate that makes the
engine more physically coherent without losing the designed interface feel. The full plan
and an as-built audit live in [`docs/physics-workover.md`](docs/physics-workover.md); the
work ships across v0.3 to v0.6. (The audit's headline: first-class mass, softened
inverse-square gravity/charge, `b.accreted`, and class-[S] source/sink budgeting already
ship, so the work is the mode system, medium formalization, safety layer, `screen`,
metrics, and the transformation primitives, not re-building what exists.)

### Fixed

- **Canonical vortex swirls again (inward bias `0.6` → `0.12`).** Reverts the v0.2.0 bias:
  the spec (§6.8) and the catalog already specified `0.12`. Canonical `vortex` is a designed
  swirl verb — the tangential component dominates the inward one ~8×, so it holds shape — not
  a spiral drain. That binding belongs in a preset (`whirlpool` / `blackhole` / `accretion`).
  The conformance check moves from an exact inward spiral to **tangential dominance**; the Lab
  shows the first-frame Δv `(0.020, −0.171)` with `|Δvᵧ| > 4×|Δvₓ|` and a swirl track.

## [0.2.0] — 2026-06-04

### Added

- **Force-aware Lab controls.** The TUNE & REFIRE panel is driven by each force's
  catalog attributes — it shows only the knobs that matter for the selected force
  (shear exposes its flow angle, `vortex`/`charge`/`resonate` expose spin, class-[S]
  sources show just strength + angle), each with its symbol (S, d, σ, θ°), units,
  a live formula line, and a default-value tick on the track.
- **Quick-pick value bands.** Named quick-set chips under each control (strength:
  weak/default/strong/max; range: near/default/far; spin: ccw/off/cw; angle:
  0/45/90/180; vx/vy: 0/slow/fast; count: 1/8/24) — click a meaningful setting
  instead of guessing and dragging; the active band is highlighted.
- **Frontiers roadmap + backlog.** `docs/roadmap-frontiers.md` (implementation notes for
  the next frontiers — reciprocal input channels, a GPU backend, the compositor bridge,
  `bindData()`, finishing the cosmology, and render frontiers) and `BACKLOG.md` (the
  granular queue). All 33 forces re-verified via the Lab — every one reaches MATCH.
- **Seven more forces (33 total), spanning every input class.** `memory` (a worn-path
  occupancy field, [C]) and `pigment` (conserved colour transport, [E]); `pressure`
  (SPH density relaxation — incompressible even-fill, [B]); `link` (a Verlet distance
  constraint — ropes, cloth, soft structures, [B]); `hunt` (two-species predator/prey
  pursuit, [B]); `morph` (matter assembles into a mark/chart/logo — never words, §11; the
  new shape-assignment class [D]); and `spawn` (a budgeted source atom that *creates*
  matter, the new class [S]).
- **The source system (class [S]).** A `source(b, env)` hook on the `Force` contract
  (run once per body per frame, the dual of `modify`), plus an integrator source pass and
  an aging/despawn **sink** for mortal matter. Sources are budgeted by a per-particle
  lifespan and a hard pool ceiling, so they can't grow the field without bound. Adds the
  `fountain` preset (a continuous upward jet arcing home under gravity).
- **Two more render modes (six total)** — `metaballs` (a liquid iso-surface traced by
  marching squares) and `voronoi` (shattered-glass nearest-neighbour cells), alongside
  `dots` · `trails` · `links` · `streamlines`.
- **Closed-loop concepts on the Field Manual** — **material typography** (one density,
  `--d`, drives every type axis at once: weight, optical size, tracking, bloom, colour)
  and a **self-laying-out page** (`data-move="layout"` elements find equilibrium positions
  via anchor + mutual repulsion + density pressure, and re-settle on resize).
- **Conserved attention** (§2.4) — one finite strength budget across the page; engaging a
  body pulls force off the others. Opt-in via `FieldOptions.attention` /
  `FieldHandle.setAttention` / `<forces-field attention>`.
- **Cross-boundary causality** — density spills from a saturated body to its neighbours
  (`--lit` + `field:lit`/`field:dim` events). Opt-in via `causality`.
- **Physics conformance framework** (`forces-ui` `conformance/`) — `runScenario` + a
  declarative `EXPERIMENTS` catalog of per-force invariants and exact checks, shared by
  the test suite and the Lab. Fire a particle into a force, verify it reacts as the math
  predicts.
- **The Lab is a physics detector** — fire known particles into a force, watch the track,
  the field, and related particles, and see each conformance check pass frame-by-frame.
  Numeric tuning + presets, multi-particle firing, once/loop/unlocked playback, a
  timeline with a per-particle **speed waveform** and a marker at every test's pass-frame
  with a MATCH flag, a parameter-sweep plot (vary one input across its range, see the
  response curve), and actionable save (Export JSON / Copy report). Handles class-[S]
  sources that start with no test particle (drawing the emitted spray).
- **Composition + condition experiments** — `COMPOSITE_EXPERIMENTS` verifies that forces
  compose (`attract repel` cancel; `attract vortex` sums to a spiral) and gate on
  conditions (`data-when` runs through the real condition registry).
- **Developer portal** (`/docs`) — getting started, concepts, framework guides, a
  catalog-driven API reference, recipes, and performance/accessibility notes.
- **`docs/forces-tests.md`** — the testing & conformance reference.
- **Release engineering** — CI (typecheck · test · build on every PR), `CONTRIBUTING.md`,
  `RELEASING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and issue/PR templates.

### Fixed

- **Vortex binds its orbit into a whirlpool.** Its inward bias (0.12) was far too
  weak to provide centripetal binding, so particles gained tangential speed and
  drifted *outward* — a feeble swirl that read like gravity. Raising it to 0.6
  binds the orbit: matter circles ~1.2× while spiralling gently in, a real
  whirlpool (tangential still dominates ~1.7×). Driven by headless orbit-count
  sweeps; the conformance exact-Δv and the `attract vortex` composite are updated.
- **Drag's no-redirection check is velocity-relative.** It hardcoded Δvy = 0 —
  true only for horizontal motion — so tuning a test particle's vy flipped a
  correct drag to NO MATCH. Drag is `v −= v·k`, so Δv is anti-parallel to v at any
  velocity; the check now asserts no perpendicular component (cross ≈ 0).
- **The emitter Lab scenario fires from the nozzle**, so it demonstrates the jet
  (relaunched fast along the heading, receding from the body) instead of sitting
  in the feed zone, where it read as an attractor.
- **`collide` now conserves momentum in the trajectory.** It resolved only `p` and
  trusted `q`'s later turn, but the integrator processes particles sequentially, so `q`
  read `p`'s already-changed velocity — an order-dependent, non-conserving result. The
  pair is now resolved symmetrically in one pass (equal & opposite impulses), giving a
  proper equal-mass elastic bounce.
- **Conformance experiments tightened** — `thermal` isotropy is measured over a 150-body
  cloud (ratio ≈ 1, not a single noisy walk); `collide` is centred in positive space and
  approaches slowly so the bounce is clear (gap 20 → 31) and gains a velocity-reversal
  check; `wind` uses a stronger gust; the `gate` expectation wording is corrected
  ("reflected back along n").

### Changed

- **The site front door** — the Field Manual is now the home page (`/reference` redirects
  to `/`); client-side navigation keeps the field running continuously across pages.

### Performance

- Range-culled the integrator body-force loop (~2× at scale) and removed all
  `shadowBlur` from the render path; cached the per-frame `scrollHeight` read.

## 0.1.0 — the complete engine

The first feature-complete milestone: the full reciprocal-field engine, a
self-documenting site, and adapters for any stack. Every ROADMAP item is checked.

### Engine

- **26 forces** — the canonical nine (§6); seven **natural primitives** (`gravity`,
  `charge`, `magnetism`, `thermal`, `collide`, `diffuse`, `propagate`; §20.10); nine
  **designed-extended** forces and two **modifiers** (`lens`, `gate`, `buoyancy`,
  `shear`, `crystallize`, `align`, `wind`, `cohesion`, `resonate`, `spotlight`; §20.3).
- **Env services** — spatial-hash `neighbors`, the scalar `grid` (diffusion + leapfrog
  wave), the integrator **modifier pass**, and **first-class mass** (`a = F/m`).
- **Preset layer** (§20.9) — `blackhole`, `whitehole`, `star`, `quasar`, `galaxy`,
  `nebula`, `tornado`, guarded by a registry cross-check.
- **Full `FieldHandle` API** — `scan`/`setAccent`/`setFormation`/`threads`/`burst`/
  `setPalette`/`destroy`, proxied onto `<forces-field>`.
- **Colour templates** — `ours`, `heatmap`, `infrared`, `spectrum`.
- **§20.2 reconciliation** — a canonical colour for every registered force.

### Site (forces-ui.com)

- The engine-driven **home** page; **`/reference`** — the Field Manual, rendered from
  the catalog (pinned to the engine by a completeness test) with a playable demo;
  **`/lab`** — paint forces on the page, watch the single field react, share via URL.

### Adapters

- The `<forces-field>` **custom element**, the framework-free **`mountField()`**, and
  the **`@forces-ui/react`** `<ForcesField>` component + `useForcesField` hook.

### Quality

- **162 core tests**, every merge green-and-tested.
- **Zero runtime dependencies** in the engine; React is a peer dependency of the React
  adapter only.
