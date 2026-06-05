# Backlog

The running, granular queue. Strategic context lives in
[`docs/roadmap-frontiers.md`](docs/roadmap-frontiers.md); shipped work moves to
[`CHANGELOG.md`](CHANGELOG.md).

Legend: `[ ]` planned · `[~]` in progress · `[x]` done (then moved to the changelog).

## Lab — the physics detector

- [ ] **Force-aware controls.** Drive the tune panel off each force's real `attrs` from the
      catalog (angle, spin, r₀, ρ₀, species, targets, …) instead of a fixed
      strength/range/vx/vy set. (e.g. `shear` should expose `angle`, its defining knob.)
- [ ] **Control definitions.** Per-control symbol + units + a force-specific caption; a live
      formula line (from `MANUAL_FORCES.formula`) with the current values substituted; a
      default tick on each slider track.
- [ ] **Quick-pick presets/tags.** Per-control value bands (`weak · default · strong ·
      extreme`); curated per-force scenario tags (e.g. collide → `head-on · glancing`);
      save-and-tag custom configs with a note (`good · bad · edge`), kept in a list.
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
      `wormhole` preset then composes for free.
- [ ] **Transmutation** — `fuse` `[B]` (2 → 1, mass-conserving sink), `fission` / `decay`
      `[S]` (1 → 2, budgeted source).

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
