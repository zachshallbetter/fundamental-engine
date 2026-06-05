# Roadmap — Frontiers

Forward-looking implementation notes for the engine's next frontiers. Companion to
`ROADMAP.md` (the completed refactor) and `docs/forces-possibilities.md` (the design
menu). Each entry defines *how* it would be built — contract surface, work, verification,
effort — not just *what*. The running, granular queue lives in [`BACKLOG.md`](../BACKLOG.md).

Two principles hold throughout, unchanged from the rest of the project:

- **Verification.** Every new force gets a conformance experiment + golden test; every
  render mode gets a golden-tested pure core; dynamics are proven by deterministic tests
  and the Lab, never by watching the ambient field (a backgrounded tab pauses `rAF`).
- **No breaking changes.** Everything below is additive — new forces, render modes,
  helpers, adapters, and one optional backend seam. The `Force` contract and the `data-*`
  vocabulary stay stable.

> **Physics workover.** The current major thrust is the designed / natural / hybrid physics
> substrate, planned separately in [`physics-workover.md`](physics-workover.md) (with an
> as-built audit of what already ships). It is the source for v0.3 through v0.6; the
> frontiers below (a GPU backend, reciprocal channels, render modes) continue alongside it.

---

## F1 · More reciprocal channels (input → physics)

Today the only Canvas→DOM channel is the `--d` density write-back (density → type). The
seam with the most room is the **input** side, expressed through the §22 element-agent model.

- **Focus / accessibility as physics.** A `core/focus.ts` agent listens (capture phase)
  for `focusin`/`focusout`, maps the focused element to its body (or nearest `[data-body]`
  ancestor), sets `b.on` plus a transient strength boost, and pulses a `stream` along the
  vector from the previously focused body — tab order becomes a current. Opt-in via
  `FieldOptions.focus` / `data-focus`; respects reduced motion (lit state, no travel).
- **Pointer dynamics.** A `core/pointer.ts` agent tracks pointer velocity (finite
  difference) and exposes the cursor as a transient body, so a fast flick imparts momentum
  to nearby matter. Draggable bodies gain inertia: `updateMovers` carries the pointer's
  release velocity into the offset so the element *throws*, then settles on the existing
  anchor spring. Opt-in via `data-throw`.

**Verify:** synthetic focus/pointer events → assert engaged body + boost / velocity +
throw integration; site demos. **Effort:** S–M, no contract change.

## F2 · A compute backend (the scale frontier)

An optional GPU integrator for large particle counts, with identical force semantics.

- **Seam.** An `IntegratorBackend` interface with CPU (current) and GPU implementations;
  `FieldOptions.backend: 'cpu' | 'gpu' | 'auto'`, feature-detected. CPU stays the default.
- **Data.** The pool lives in structure-of-arrays GPU buffers; bodies in a storage buffer
  with a token bitmask. One compute pass per frame: per particle, loop bodies, dispatch
  the force kernels by bitmask, integrate, damp, wrap.
- **Forces.** Hand-port the canonical + natural kernels to a parallel compute-shader force
  library (class `[A]` first). Class `[B]` needs a GPU spatial grid (bin → gather); `[C]`
  needs GPU scalar grids. Designed JS forces stay CPU; document the GPU-capable subset.
- **Render.** Draw directly from the GPU buffers (a point/quad pass) — no readback, which
  is the real win.
- **Oracle.** The conformance suite validates the port: run identical scenarios on CPU and
  GPU and assert trajectories match within tolerance (a new `parity` expectation).

**Phasing:** (1) GPU `[A]` + direct renderer + parity tests → (2) GPU grid → `[B]` → (3)
GPU scalar grids → `[C]`, metaballs/voronoi on GPU. **Effort:** L (flagship). The
neighbour/grid path is the hard part; keep the whole backend opt-in.

## F3 · Compositor-native bridge

Make the DOM⇄Canvas bridge cheaper and smoother with platform features the original notes
predate. All additive and feature-detected.

- **Typed `--d`.** `CSS.registerProperty` for `--d` / `--lit` as `<number>` so they
  interpolate on the compositor and authors can write `transition: --d .2s`.
- **Scroll-driven animation.** Drive formation/accent as registered properties bound to
  `animation-timeline: scroll()` / `view()` — the global bias follows scroll with no JS
  scroll listener. Ship as a helper + recipe.
- **Cross-document continuity.** Serialize the pool on `pagehide` and restore on
  `pageshow`, behind the cross-document View Transitions API, so the field appears
  continuous across hard navigations (not just SPA).
- **Anchored UI.** Tether popovers/tooltips to a moving `data-move` body via CSS Anchor
  Positioning (write the live rect as an anchor). Mostly a recipe + small helper.

**Effort:** S–M each.

## F4 · `bindData()` — the data thesis as an API

Turn "a renderer for data" into a real adapter.

- **API.** `bindData(container, records, mapper, opts)` where
  `mapper(record) → { id, force, strength, range, color, when }`. Diff by `id`: add →
  spawn matter at the new body; remove → release via the conserved accretion/supernova
  lifecycle (matter flows, never pops); reorder → bodies move and matter follows. Returns
  `{ update(records) }`. Framework-agnostic core + a thin `useForcesData` React hook.
- **Verify:** diff tests (add/remove/reorder → correct body set + matter events); a demo
  binding a sample dataset. **Effort:** M.

## F5 · Finish the physics

Complete the cosmology and the lifecycle.

- **`warp` `[A · paired]`** — a particle entering throat A teleports to its paired throat B
  preserving momentum. Adds one `Body.pair` field (the scanner resolves `data-pair="#b"`);
  conserved. **`wormhole`** then composes `attract+warp` ↔ `warp+repel` (a preset, zero new
  code).
- **Transmutation `fuse` / `fission` / `decay`** — `fuse` `[B]` merges two slow, hot, close
  particles into one (mass combines via first-class mass, energy → heat/spark; a sink);
  `fission` / `decay` `[S]` split one into two (budgeted via the spawn sink). These make
  "a star is `gravity ⇄ thermal` pressure with `fuse` in the core" literal.

**Verify:** experiments (warp: appears at B with the same velocity; fuse: 2 → 1, mass
conserved; decay: 1 → 2) + golden tests. **Effort:** M.

## F6 · The conformance framework as a tool

The Lab's "fire a known input, assert the reaction matches the math" is currently internal.
Generalize it.

- **Conformance as a public testing primitive** — document (or package) the
  `Scenario` / `Expectation` DSL + the headless runner so any particle/animation system can
  be tested the same way. Add **property-based fuzzing** (random bodies/particles → assert
  no NaN, no energy blow-up) to surface instability.
- **Record / replay** — the engine is deterministic under seeded RNG, so record
  `(seed, body attrs, input timeline)` → a replay that reproduces a field exactly. Enables
  visual-snapshot tests and shareable full sessions (extends the URL-hash sharing).

**Effort:** M, mostly packaging + a recorder + a fuzz generator.

## F7 · Render frontiers

Pure render-layer additions with golden-testable cores, like metaballs/voronoi.

- **`knockout`** — the field is visible only *inside* glyphs (composite the render against
  rendered text). §11-safe: the text is real; particles fill it, they do not spell it.
- **Depth** — a per-particle `z` drives parallax, blur, and draw order for a 2.5D field.
- **Flow-field LIC** — line-integral-convolution over the force field for a smoky vector
  render (a richer `streamlines`).

**Effort:** S–M each.

---

## Sequencing

| Stage | Theme | Contents |
|---|---|---|
| **v0.2** | Reciprocity & data (low risk, high differentiation) | F1 focus/pointer · F4 `bindData()` · F7 `knockout` · F3 typed `--d` + scroll timeline |
| **v0.3** | Finish the engine | F5 warp/wormhole + transmutation · F6 conformance-as-tool + record/replay + fuzz |
| **v0.4** | Scale (flagship) | F2 GPU backend `[A]` → `[B]` → `[C]`, with CPU/GPU parity tests |
| ongoing | Polish | F3 cross-document continuity + anchored UI · F7 depth / LIC |

The only genuinely new architecture is small and contained: a `Body.pair` field (warp),
the `IntegratorBackend` seam (GPU), and input-agent modules that extend the existing §22
target model. Everything else is additive.
