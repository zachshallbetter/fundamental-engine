# Changelog

All notable changes are documented here, following
[Keep a Changelog](https://keepachangelog.com) and [SemVer](https://semver.org).
The packages are published to npm under the `@field-ui` scope; each release is also cut as a
git tag (see [RELEASING.md](RELEASING.md)).

## [Unreleased]

The **physics workover** begins: a designed / natural / hybrid substrate that makes the
engine more physically coherent without losing the designed interface feel. The full plan
and an as-built audit live in [`docs/engine-reference/physics-workover.md`](docs/engine-reference/physics-workover.md); the
work ships across v0.3 to v0.6. (The audit's headline: first-class mass, softened
inverse-square gravity/charge, `b.accreted`, and class-[S] source/sink budgeting already
ship, so the work is the mode system, medium formalization, safety layer, `screen`,
metrics, and the transformation primitives, not re-building what exists.)

### Fixed

- The home manual's last two untraced stages now trace real engine runs: **`fieldflow`**
  pairs with a magnet on the live chip (it advects matter along the *net* field other
  forces radiate, so alone it had no lines to follow — the demo itself was a silent
  kinematic no-op, not just untraced) and **`warp`** wires its pair target headlessly the
  way the conformance experiment does, showing the conserved relocation from throat to
  pair. Both gained per-force demo-accuracy tests, and the e2e boot test dropped its
  `UNTRACEABLE` exception list — every chip-bearing stage must hold exactly one traced
  canvas.

## [0.2.3] — 2026-06-10

The cycle that built the **invisible-fields family** — twelve real-data example pages whose
render surface is the page's own type — and shipped the engine/platform capabilities the
family proved out. The pattern is canonical in
[`docs/canonical/field-ui-invisible-fields.md`](docs/canonical/field-ui-invisible-fields.md).

### Added

- **`FieldHandle.scrollV()`** — the engine's eased page-scroll velocity (the `scrolling`
  condition gate's EMA), mirrored to **`--field-scroll-v`** on `:root` by the platform write
  phase (deduped when unchanged). Experimental surface; px/frame, refresh-rate dependent.
- **`FieldHandle.setVisible(on)`** — element-level visibility hint: `false` skips all draw
  work while the simulation and feedback signals stay live. `<field-root>` wires it
  automatically from an IntersectionObserver. Under reduced motion the static scene redraws
  at quarter rate.
- **`render: 'none'`** — the signals-only engine mode (#297): created with `'none'`, a field
  never acquires a canvas context, never sizes a backing store, never allocates render
  scratch — it exists purely as signals (`--d`, `--load`, `--lit`, events, `scrollV`).
  `setRender` out of `'none'` acquires the context lazily.
- **`QualityGovernor`** + the **`field:quality-tier`** event — adaptive frame-budget tier
  detection (0–3, asymmetric escalation/recovery); the `<field-root>` runtime feeds it,
  skips discontinuity frames, resets on `visibilitychange`, and throttles its own platform
  tick at tiers 2–3 as the built-in consumer.
- **`FeedbackRegistry.cssWritesLastFrame()`** — the actual per-frame DOM write count
  (mirrored `--field-*`/`--forces-*` pairs count as 2), distinct from `boundVars().length`.
- **`PlatformRuntime.attachHandle(handle)`** — post-hoc wiring of the engine handle into the
  platform runtime (scroll-v writes + governor monitoring).
- **`withFlip()`** in `@field-ui/platform` (#295) — the FLIP reflow helper extracted from the
  example runtimes (1D/2D, exclude hook, reduced-motion guard).
- **`allocateAttention()`** in `@field-ui/core` (#296) — conserved water-filling allocation
  (Σw = budget exact, pins take the cap, capped excess re-flows), unit-tested for exactness.
- **The invisible-fields example family** at `/evidence/<slug>` — twelve pages over committed
  real-data snapshots (refreshed weekly by CI) with live in-browser upgrades, provenance
  chips, and per-page signature mechanics; pinned by a 62-test Playwright matrix
  (chromium · webkit · Pixel-7 touch).

### Fixed

- `[hidden]` on styled grid/flex elements is restated in author CSS (the UA default loses).
- Sparkline draw-ins use `pathLength="100"` keyframes ending dash-free (WebKit dash-precision
  artifacts at `pathLength="1"`).
- Touch drag on the backlog board arms by long-press (touch-action latches at gesture start).
- The dependencies snapshot reads publish dates from the full packument (`/latest` omits
  `time`).
- `threads`' depth variable renamed `--depth` (it collided with the engine's `--d` channel).

### Expanded the field-ui model (migration plan Phases 4–8)

On top of the migrated, stabilized base, the field-first model was built out — all engine-side,
pure, and node-tested, with no change to the preserved physics:

- **Contracts** (`core/contracts`): formal contract types, a validated `ForcePassport` for all 34
  forces, the Error-Taxonomy dev-mode guards, and an inspectable contracts catalog.
- **Agents** (`core/agents`): the FieldAgent model — element, relationship, user, layout, and data
  agents, plus a thresholded EventAgent (hysteretic, debounced) runtime.
- **Visual language** (`core/visual`): bounded metric→appearance mappings (typography, color,
  shape, emission), lint rules, and the semantic-text fallback.
- **Authoring & recipes** (`core/recipes`): the serializable SceneRecipe schema + validation, the
  intent compiler, the essential-recipe gallery, and Explain-This-Field / Field-Diff.
- **Inspection** (`core/inspect`): deterministic snapshot regression, a performance-budget
  inspector, and an aggregate system report.

The suite grew to 476 tests. App-level surfaces (Composer, Inspector UI) remain the frontier.

### Migrated to field-ui

The project moved from `forces-ui` to **field-ui** — a field-first framing where the field (the
invisible structure) is the primary abstraction. This is a rename + alias pass, **not** a rewrite:
no force formulas, integrator behavior, magnetism (Lorentz `F = q(v × B)`), fieldflow, render
math, heatmap math, force tokens, or `data-*` authoring changed. The migration plan is
`docs/field-ui-migration-plan.md` (since retired).

Every old public name keeps working as a compatibility alias during the transition:

- **Packages** renamed: `forces-ui` → `field-ui`, `@forces-ui/{elements,react,vanilla}` →
  `@field-ui/*`. Thin re-export alias packages keep the old specifiers resolving.
- **Events**: `field:register-body` / `field:unregister-body` / `field:update-body` are now
  dispatched and listened for alongside the `forces:*` names.
- **CSS variables**: `--field-density` / `--field-heatmap-density` are written alongside
  `--forces-density` / `--forces-heatmap-density` (same values).
- **Elements**: `<field-root>` / `<field-field>` / `<field-cell>` register alongside
  `<forces-field>` / `<forces-cell>`; React gains `FieldField` / `useFieldField`, vanilla gains a
  `FieldField` alias.

Aliases will be removed in a future major once docs, examples, and downstream code have moved.

### Added

- **`@forces-ui/vanilla` — a framework-free TypeScript wrapper.** A fourth package exposes the
  imperative API as a typed `ForcesField` class (it manages a canvas for you, or drives one you
  own) alongside `mountField()` and a re-exported `createField()` plus the catalog — with no
  custom-element registration and no framework dependency, so importing it has no side effects.
  `mountField` now lives here as its canonical home; `@forces-ui/elements` re-exports it, so
  existing `import { mountField } from '@forces-ui/elements'` is unchanged. The developer portal
  gains a **TypeScript** guide for it.
- **`waves` is now a real toggle.** `FieldOptions.waves` (and `<forces-field waves>` / the React
  `waves` prop) now actually gates the background Currents — default stays `true`, set `false`
  for the bare free-particle field. It was previously accepted but ignored.
- **`scrolling` `data-when` gate wired.** `data-when="scrolling"` now acts only while the page is
  actually scrolling: the engine eases a per-frame scroll speed into `env.scrollV` and the gate
  fires above `0.25`. It was cataloged but inert before (silently acting "always").
- **`mass` on the web component.** `<forces-field mass>` now opts into first-class mass (§21.3),
  matching the React adapter and the `ForcesField` class; the option was previously React-only.
- **SSR-safe imports + a browser-only guard.** Importing `@forces-ui/elements` no longer throws
  `HTMLElement is not defined` under server-side rendering (the custom-element base is guarded),
  and `new ForcesField()` / `mountField()` from `@forces-ui/vanilla` throw a clear "client only"
  error during SSR instead of a cryptic `document is not defined`. A new `pnpm check:dist` smoke
  check (in CI and the publish checklist) verifies every package's entry points import cleanly.
- **Global velocity cap + safety conformance sweep.** The integrator now clamps every free
  particle's speed to the unit system's `c` (12) each step, so no canonical force or
  composite can produce a runaway (the natural primitives already self-clamped; this makes
  it universal). A new conformance **safety sweep** runs every experiment and asserts the
  whole trajectory stays finite (no NaN/Infinity), positions finite, speed ≤ c, heat
  bounded, and the particle count stable unless a budgeted [S] source is active.

### Changed

- **BREAKING — six canonical force tokens renamed to functional terms.** `vortex → swirl`,
  `spring → tether`, `emitter → jet`, `drag → viscosity`, `reflect → wall`, and `absorb → sink`
  (the other three canonical forces — `attract`, `repel`, `stream` — keep their names). This is
  a **hard rename**: the old `data-body` values no longer resolve, so update markup to the new
  tokens. The capture-radius attribute stays `data-absorb` and the accretion CSS var stays
  `--load`; the per-force vars follow the tokens (`--f-swirl`, `--f-viscosity`, …). The engine,
  presets, the conformance catalog + full test suite, the Field Manual, the Lab, and every doc
  move together. (The wave-binding tear keys on a force *property*, not a token list, so it
  needed no change.)

### Fixed

- **`<forces-field>` reacts to live attribute changes, and `destroy()` cleans up fully.**
  Changing `accent` / `render` / `palette` / `attention` / `causality` on a mounted
  `<forces-field>` now applies immediately (and `density` / `waves` / `mass` rebuild the field);
  the `observedAttributes` were declared but inert before. `destroy()` / `disconnectedCallback`
  now also release the per-element `[data-hot]` engagement listeners, so repeated mount/destroy
  on the same DOM no longer leaks handlers.
- **First-class mass no longer corrupts velocity-replacing forces.** Under `mass: true` the
  integrator scaled the *whole* per-frame velocity change by `1/m`, breaking forces that *set*
  velocity rather than add to it: a `wall` bounce could drive matter through the wall, and a
  `jet` launched heavy matter far too slowly (`lens`/`gate` likewise). Mass is now applied
  per-force — additive forces scale by `1/m`, while velocity-replacing forces (newly flagged
  `kinematic`: `wall`, `jet`, `lens`, `gate`) set velocity outright. New conformance scenarios
  cover `m ≠ 1`, which the suite never exercised before.
- **Canonical vortex swirls again (inward bias `0.6` → `0.12`).** Reverts the v0.2.0 bias:
  the spec (§6.8) and the catalog already specified `0.12`. Canonical `vortex` is a designed
  swirl verb — the tangential component dominates the inward one ~8×, so it holds shape — not
  a spiral drain. That binding belongs in a preset (`whirlpool` / `blackhole` / `accretion`).
  The conformance check moves from an exact inward spiral to **tangential dominance**; the Lab
  shows the first-frame Δv `(0.020, −0.171)` with `|Δvᵧ| > 4×|Δvₓ|` and a swirl track.
- **Every force can disturb the resting field (not just seven canonical tokens).** The
  resting field rides on wave-bound matter, and a force only reaches a bound particle once
  it's torn loose. The tear pass had a hardcoded allowlist — `reflect`, `attract`, `absorb`,
  `emitter`, `repel`, `vortex`, `stream` — so every **natural primitive and extended force**
  (`gravity`, `charge`, `magnetism`, `thermal`, `collide`, `diffuse`, `propagate`, `memory`,
  `cohesion`, `pressure`, …, plus `drag` and `spring`) let the wave shimmer ride straight
  through, doing nothing. Tearing is now keyed on a force *property*, not a token list: any
  visible always/active body that carries a non-modifier, non-source token frees nearby bound
  matter with a gentle inward nudge, then the integrator's real `apply()` shapes it — so gentle
  forces read gently and strong ones strongly. (Modifiers `resonate`/`spotlight` and the pure
  source `spawn` correctly never tear.)
- **`charge` and `magnetism` now act on the live field (charge induction).** Both forces
  ignore neutral matter by contract — and every live particle starts neutral, so on the page
  they did nothing. A charge/magnetism body now **polarizes** the matter in its range: a
  neutral particle picks up a sign by which side of the body it sits on (a +/- domain split),
  induced once so matter carries its charge. Induction is a field-level pass (`induceCharges`)
  kept *outside* the integrator the conformance suite runs, so the force's golden contract
  ("ignores neutral matter") stays exactly true while the field gains charged matter to push.
- **Field Cell + React adapter caught up to the rename.** The Field Cell's poster engine
  still switched on `vortex`/`spring`, so the Lab's `swirl`/`tether` cells fell through to
  `attract`; renamed to `swirl`/`tether`. React `<ForcesField>` / `useForcesField` had
  silently dropped the `palette`, `attention`, and `causality` props; they are now forwarded.
  The elements package gained a `test` script so its cell-force tests run in CI.

### Documentation

- **Audit cleanup sweep.** Marked the four spec-only render modes (`knockout` / `heatmap` /
  `redshift` / `blackbody`) **planned** in the §20.6 table; documented `morph`'s `range` as its
  *recruitment radius* (distant matter isn't pulled into the form — use `data-range="0"` for the
  whole field); corrected the `presets.ts` note (`lens` / `buoyancy` / `spawn` ship now, not
  "deferred"); and fixed the ROADMAP scaffold line (`tsc` / `node:test`, not `tsup` / `vitest`).
- **Docs and the live manual reconciled to the workover.** The Field Manual's `vortex`
  panel now reads as a swirl — the inward bias surfaces as `+ 0.12` in its formula, with no
  "whirlpool" — and the `absorb` panel uses `accreted / capacity`. The formula handbook's
  `absorb` row, the testing guide (the new safety-sweep layer, the corrected class list, the
  test count), the spec's §20.10 (an as-built note on the global cap + safety sweep),
  the possibilities doc, and the README status (`v0.2.0`; packages not yet on npm) are all
  brought in line.
- **Repo-wide documentation audit.** Swept every doc against the shipped engine. Corrected
  stale tokens the rename missed (the explainer's `data-body` list, ROADMAP prose, the Field
  Cell example), the formula handbook's forward registry (`pheromone` → `diffuse`;
  `diffuse`/`memory` flagged as natural [C]; the spec-only `warp`/`wormhole` and the
  `supernova` event marked; the budgeted source named `spawn`), the test count (306),
  ROADMAP's force counts (33), the spec's runtime-field list (drops the removed `b.mass`), and
  stopped PUBLISHING / SECURITY / the package READMEs from implying the packages are on npm.

## [0.2.2] — 2026-06-09

Documentation and release-tooling pass — no engine code changed.

### Added
- **Provenance release workflow** (`.github/workflows/release.yml`): a tag-triggered CI publish that
  signs each package with npm provenance (a Sigstore build attestation) via GitHub OIDC. Provenance
  can only be produced from CI, so this becomes the path for all future releases.

### Changed
- Expanded the `@field-ui/react`, `@field-ui/elements`, and `@field-ui/vanilla` READMEs with full
  options/methods tables, the `data-body` attribute vocabulary, and framework/SSR notes.

## [0.2.1] — 2026-06-08

First npm release under the `@field-ui` scope.

### Changed
- **The core package is published as `@field-ui/core`** (was the unscoped `field-ui`). The unscoped
  name is unavailable on npm — an unrelated, active `fieldui` package trips the registry's
  name-similarity guard — so the engine ships under the org scope alongside the four adapters. All
  internal dependencies and `import … from 'field-ui'` specifiers now resolve to `@field-ui/core`;
  the public API surface is otherwise unchanged (the freeze gate still passes its 14 entries).

### Published
- `@field-ui/core`, `@field-ui/platform`, `@field-ui/elements`, `@field-ui/react`, and
  `@field-ui/vanilla` are live on npm. Install any layer directly (`npm i @field-ui/core`, etc.).
- `@field-ui/kit` (a meta-package that installs the whole suite) and `@field-ui/field-ui` (a thin
  alias for the kit) also published, for one-install consumption.

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
  occupancy field, [C]) and `pigment` (conserved color transport, [E]); `pressure`
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
  `--d`, drives every type axis at once: weight, optical size, tracking, bloom, color)
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
- **Color templates** — `ours`, `heatmap`, `infrared`, `spectrum`.
- **§20.2 reconciliation** — a canonical color for every registered force.

### Site (field-ui.com)

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
