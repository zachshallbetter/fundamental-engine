# Backlog

> **Source of truth has moved.** Active, dispatchable work now lives on the **RC1 board**
> ([user Project #24](https://github.com/users/zachshallbetter/projects/24), managed via the
> `github-projects` skill). This file is a manually-maintained historical queue and may lag `main` —
> verify any item against the board and `CHANGELOG.md` before acting on it.

The running, granular queue. Strategic context lives in
[`docs/planning-archive/roadmap-frontiers.md`](docs/planning-archive/roadmap-frontiers.md); shipped work moves to
[`CHANGELOG.md`](CHANGELOG.md).

Legend: `[ ]` planned · `[~]` in progress · `[x]` done (then moved to the changelog).

## Physics workover — designed / natural / hybrid substrate

The major current thrust. Full plan and as-built audit in
[`docs/engine-reference/physics-workover.md`](docs/engine-reference/physics-workover.md). Ships across v0.3 to v0.6.

**v0.3 — reconciliation, safety, boundary, metrics (the live queue):**

- [x] **Vortex to 0.12.** Reverted the #110 inward bias (`0.6` → `0.12`) to match the spec;
      the conformance check is now tangential dominance, preview-verified in the Lab. (#113)
- [x] **Absorber `--load`.** Exports the canonical `--load` (`accreted / capacity`), with
      `--mass` kept as a back-compat alias; fixed the stale `forces.config.ts` comment. (#115, #116)
- [x] **Velocity cap + safety invariants.** The integrator caps free-particle speed at `c`
      (12); a conformance safety sweep asserts no NaN / Infinity, finite position, bounded
      velocity + heat, and stable count (unless a budgeted [S] source runs). The `velocityCap`
      config knob is deferred to v0.4 (the mode system).
- [x] **Source-budget guard.** Dev-mode warn (`guardSourceBudget`, named element + missing
      attrs) + the safe default budget (`data-life="300"`, `data-cap="120"`) when an [S] force
      has none of `data-life` / `data-cap` / `data-budget` / `data-sink`; `spawn` clamps its
      rate to `cap/life`. Conformance pins the bounded count; the fountain preset declares
      its budget explicitly.
- [x] **Modifier contract + parser.** Tokens classify into `{modifiers, forces, sources}`
      (`classifyBodyTokens`, exported from `config/forces.config.ts`, filled onto
      `Body.classified`); modifiers evaluate in the formalized order
      `spotlight → screen → resonate → core`. Zero behavior change for existing pages;
      determinism + classification tests.
- [x] **`screen` modifier.** Attenuates OTHER bodies' forces inside its radius (quiet zones,
      text shielding): `clamp(1 − S·(1 − d/r)², min, 1)` in the integrator force pass;
      truth mode designed; passported + conformance scenario (`extraBodies`).
- [x] **Entropy + coherence metrics.** Measured, not forces; per-feedback-body local
      measurements (`core/thermo.ts`, accumulated in the existing density pass) exported as
      `--entropy` / `--coherence` / `--temperature` alongside `--d` through both feedback
      sinks. Formulas recorded in the workover doc (engine-measured vs the platform's
      inferred `--field-entropy` lanes — distinct signals).
- [x] **Boundary docs.** The boundary-type table (wall / membrane / cone / horizon / shield /
      portal / edge / content / shape / view) with truth modes + verified shipped status:
      `forces-system.md` §20.11.

**v0.4 — physical substrate:** `PhysicsMode` / `IntegratorMode` / `MediumMode`; real `dt` in
seconds + fixed-step accumulator; semi-implicit Euler with `dt`; `FRICTION` → `designed-damping`
medium; linear / quadratic / mixed drag; epsilon softening rules; frame-rate independence.
(First-class mass and softened gravity/charge already ship.)

**v0.5 — transformation:** `warp`, `wormhole`, `fuse`, `decay`, `fission`, `phase` (see Engine — forces below).

**v0.6 — scale + natural Lab:** velocity-Verlet, the natural-physics Lab preset, record/replay,
fuzzing, the CPU/GPU parity path, advanced overlays.

## Lab — the physics detector

- [~] **Quick-pick scenario tags + saved configs.** Value bands shipped (#107). Still want
      curated per-force scenario tags (e.g. collide → `head-on · glancing`) and save-and-tag
      custom configs with a note (`good · bad · edge`), kept in a list. (Force-aware controls
      and control definitions shipped in #106.)
- [ ] **Particle placement + seed.** Placement mode (`clone · fan · ring · scatter`) with a
      seed and a re-roll button; carry the seed in COPY LINK / EXPORT.
- [ ] **Direct manipulation.** Drag the particle start, drag a velocity arrow, drag the
      body in the chamber; editable initial `x,y`; click a particle to inspect its live
      `x,y,vx,vy,speed,heat` at the scrubbed frame.
- [ ] **Exploration.** A randomize ("surprise me") button; an A/B overlay (pin a ghost run,
      tune, compare); per-check "why" expansion + live gray-out of the exact-Δv check the
      moment a param is tuned.

## Engine — forces

- [ ] **`warp` `[A · paired]`** + a `Body.pair` field (scanner resolves `data-pair`); the
      `wormhole` preset then composes for free. (Physics workover v0.5.)
- [ ] **Transmutation** — `fuse` `[B]` (2 → 1, mass-conserving sink), `fission` / `decay`
      `[S]` (1 → 2, budgeted source). (Physics workover v0.5; conservation tests required.)

## Engine — reciprocal channels (input → physics)

- [ ] **Focus / a11y agent** (`core/focus.ts`) — focused element becomes the engaged body;
      tab order becomes a current. `FieldOptions.focus` / `data-focus`.
- [ ] **Pointer dynamics + throw** (`core/pointer.ts`) — cursor as a transient body; flung
      `data-move` bodies carry release velocity then settle.

## Adapters / data

- [ ] **`bindData()`** — map records → bodies with id-diffed add/remove/reorder (matter
      flows via the conserved lifecycle); a `useForcesData` React hook.

## Platform — extractions the examples earned

The invisible-fields family hand-rolled these; the usage is the spec (filed + on the RC1 board):

- [ ] **Platform FLIP helper** — twelve runtimes implement the same reflow; extract
      `withFlip()` (1D/2D, reduced-motion, settle cleanup). (#295)
- [ ] **`allocateAttention()`** — the inbox's exact conserved water-filling allocation
      belongs to the engine's attention concept, not site JS. (#296)
- [ ] **Signals-only field mode** — name what `setVisible(false)` does: sim + feedback
      with no render state allocated at all. (#297)
- [ ] **Canon docs: `data-active` engagement + data-provenance chips** — two proven
      patterns living only in how-built sections. (#298)
- [ ] **Mobile/touch QA pass** for the family (drag on touch, scroll-snap week view,
      mosaic at 3 columns). (#299)

## Site — invisible-field examples

The Evidence example's siblings: each takes a real dataset, makes its records bodies, and lets
the field's measurements come back as type and ink — no particle swarm. The roster lives in
`apps/site/src/lib/invisible-fields.ts` (the `/evidence` sidebar); snapshots regenerate with
`apps/site/scripts/snapshot-examples.mjs`; pages live at `/evidence/<slug>`.

- [x] **Evidence** — OpenAlex citations → gravitational mass; trust in the type. (`/evidence`)
- [x] **Inbox** — Stack Overflow's unanswered queue; urgency is mass; attention is one finite,
      conserved budget — pinning one ask literally dims the rest.
- [x] **Market** — CoinGecko top assets; market cap is mass; the day's move polarizes (charge);
      sparklines carry the lens color.
- [~] **Backlog** — this repo's own work items; activity is mass; refs bind; the shipping cycle
      is a sink with capacity (`data-max` → `--load`).
- [~] **Calendar** — Launch Library upcoming launches; imminence is gravity, recomputed live —
      the next launch pulls hardest.
- [~] **Threads** — a real HN discussion; replies are mass; tempo is heat; hover lights the
      binding chain.
- [~] **Dependencies** — the monorepo's real npm deps; downloads are mass; staleness decays;
      an advisory charges the graph (causality spill).
- [~] **Fleet** — GitHub's status page; involvement is mass; impact is heat; an incident
      accretes its updates (sink capture/release).
- [~] **Catalog** — Open Library sci-fi shelf; the Evidence trust math retargeted; shared
      subjects are the affinity.
- [~] **Library** — ListenBrainz top recordings; listens are mass; the queue is a real sink
      that accretes and releases.
- [~] **Memory** — Google-corpus word frequencies; the forgetting curve is decay; frequency
      anchors; review re-binds.
- [~] **Newsroom** — Wikipedia's most-read; pageviews are mass; the cycle's rise/fall polarizes.

## Render modes

- [ ] **`knockout`** — field visible only inside glyphs (§11-safe).
- [ ] **Depth** — per-particle `z` → parallax + blur + draw order (2.5D).
- [ ] **Flow-field LIC** — smoky vector render of the force field (a richer `streamlines`).

## Platform integration

- [ ] **Typed `--d`** via `CSS.registerProperty` (compositor-interpolable).
- [ ] **Scroll-driven formations** via `animation-timeline`.
- [ ] **Cross-document continuity** — serialize/restore the pool across hard navigations.
- [ ] **Anchored UI** — popovers tethered to moving bodies (CSS Anchor Positioning).

## Performance / scale

- [ ] **GPU `IntegratorBackend`** (`[A]` → `[B]` → `[C]`) with CPU/GPU parity tests. Opt-in;
      CPU stays default. (Flagship — see roadmap F2.)
- [ ] **Observer-driven measurement** — replace the every-6-frames `measureBodies` rect poll
      with `ResizeObserver` + `IntersectionObserver` dirty-marking.

## Tooling

- [ ] **Conformance as a public primitive** — document/package the `Scenario` /
      `Expectation` DSL + headless runner.
- [ ] **Property-based fuzzing** — random scenarios → assert no NaN / no energy blow-up.
- [ ] **Record / replay** — `(seed, attrs, input timeline)` → reproducible field; visual
      snapshot tests.
