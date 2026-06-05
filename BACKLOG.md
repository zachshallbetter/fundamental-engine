# Backlog

The running, granular queue. Strategic context lives in
[`docs/roadmap-frontiers.md`](docs/roadmap-frontiers.md); shipped work moves to
[`CHANGELOG.md`](CHANGELOG.md).

Legend: `[ ]` planned · `[~]` in progress · `[x]` done (then moved to the changelog).

## Physics workover — designed / natural / hybrid substrate

The major current thrust. Full plan and as-built audit in
[`docs/physics-workover.md`](docs/physics-workover.md). Ships across v0.3 to v0.6.

**v0.3 — reconciliation, safety, boundary, metrics (the live queue):**

- [x] **Vortex to 0.12.** Reverted the #110 inward bias (`0.6` → `0.12`) to match the spec;
      the conformance check is now tangential dominance, preview-verified in the Lab. (#113)
- [ ] **Absorber `--accreted`.** Export `--accreted` (keep `--mass` as a temporary alias);
      fix the stale `forces.config.ts` comment. (`b.accreted` already exists in TS.)
- [x] **Velocity cap + safety invariants.** The integrator caps free-particle speed at `c`
      (12); a conformance safety sweep asserts no NaN / Infinity, finite position, bounded
      velocity + heat, and stable count (unless a budgeted [S] source runs). The `velocityCap`
      config knob is deferred to v0.4 (the mode system).
- [ ] **Source-budget guard.** Dev-mode warn + safe cap when an [S] force has no
      `data-life` / `data-cap` / `data-budget` / `data-sink`.
- [ ] **Modifier contract + parser.** Classify tokens into `{modifiers, forces, sources}`;
      formalize order `spotlight → screen → resonate → core`.
- [ ] **`screen` modifier.** Attenuate sibling forces inside a radius (quiet zones, text shielding).
- [ ] **Entropy + coherence metrics.** Measured, not forces; exported as `--entropy` /
      `--coherence` / `--temperature` / `--density`.
- [ ] **Boundary docs.** The boundary-type table (wall / membrane / cone / horizon / shield / edge).

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
