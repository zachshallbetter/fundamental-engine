# Changelog

All notable changes are documented here, following
[Keep a Changelog](https://keepachangelog.com) and [SemVer](https://semver.org).
The packages are not yet published; everything below `Unreleased` is the first release
in progress (see [RELEASING.md](RELEASING.md)).

## [Unreleased]

### Added

- **Two more forces (28 total)** — `memory` (a worn-path occupancy field, class [C]) and
  `pigment` (conserved colour transport, [E]).
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
  timeline with a marker at every test's pass-frame and a MATCH flag, a parameter-sweep
  plot (vary one input across its range, see the response curve), and actionable save
  (Export JSON / Copy report).
- **Composition + condition experiments** — `COMPOSITE_EXPERIMENTS` verifies that forces
  compose (`attract repel` cancel; `attract vortex` sums to a spiral) and gate on
  conditions (`data-when` runs through the real condition registry).
- **Developer portal** (`/docs`) — getting started, concepts, framework guides, a
  catalog-driven API reference, recipes, and performance/accessibility notes.
- **`docs/forces-tests.md`** — the testing & conformance reference.
- **Release engineering** — CI (typecheck · test · build on every PR), `CONTRIBUTING.md`,
  `RELEASING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and issue/PR templates.

### Fixed

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
