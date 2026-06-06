# Field lines, shaped sources, and heatmaps — implementation record

Status: **shipped** (as of 2026-06). This was the build plan for three connected additions
to the engine — shaped (extended) bodies, dipole field-line rendering, and heatmap field
buffers, plus the chargeable-body accumulator that ties them together — and all of it now
ships: `geometry.ts` (Stage A), the `Force.field()` hook with `magnetism`/`charge` dipole &
monopole fields and `fieldlines.ts` (Stage B), `data-shaped` sampling (Stage C), `heatmap.ts`
(the density layer, H1), and `fieldflow` (follow the field lines). The document is kept as the
**as-built design record** — the recorded decisions (D1–D5) are cited from the code (e.g.
`heatmap.ts` cites D5) — not as open work. The as-shipped surface lives in
[`forces-system.md`](forces-system.md) §20 and the catalog (`packages/core/src/config/manual.ts`).

The grounding facts below reference the current engine (commit at time of writing):
`Force`/`Env`/`Body` in `packages/core/src/core/types.ts`, the body-force loop in
`integrator.ts` (lines ~114–129 compute `dx/dy/dist` toward `b.cx/b.cy`), `writeFeedback`
and `forceAt` (the streamlines probe), and `ScalarGridImpl` (`scalar-grid.ts`, already
backing the `diffuse`/`propagate`/`memory` class-[C] forces).

## Recorded decisions

- **D1 — Magnetism integration.** Keep the exact-rotation form (`v ← rotate(v, θ)`), which
  preserves speed to float precision. The Lorentz-Euler form in the source spec accumulates
  speed as `sqrt(1+(qB)²)^N` and is treated as illustrative only. Adopt the spec's distance
  falloff so the curl is a localized, soft-edged field rather than a uniform hard-edged region.
- **D2 — How particles couple to the lines.** Electric (`charge`): force is along the field,
  so charged particles flow down the lines, + to −. Magnetic (`magnetism`): the dipole loops
  are a *visual of B's structure*, not a particle path. The force stays the perpendicular
  cyclotron response, so particles curve around the lines rather than following them. This
  matches the magnetism spec ("particles do not necessarily move along field lines").
- **D3 — Shaped sources land opt-in first.** Surface sampling restyles every attractor (a
  center blob becomes a halo around the element box), so it ships behind a body flag and
  becomes the default only after each demo is retuned.
- **D4 — Chargeable bodies, one quantity, lightweight-first.** `data-feedback` is promoted
  from "writes `--d`" to a material property: can this element hold charge. A chargeable body
  accumulates one scalar `Q` that both styles it (the existing DOM write-back) and sources its
  field (the pole strength in the dipole). Charge and density are the same number, not two
  channels. Start with a bounded `Q` (sampled, decays, saturates); wire it to true
  conservation against the particle pool later, as the continuous cousin of `sink`/accretion.
- **D5 — Heatmaps are a buffer + render + write-back layer, never a force.** The one heatmap
  that is also read by a force already exists and stays separate: `memory`.

## Architecture

The reciprocal loop gets one more turn of the wheel:

```
particles → heatmap / body charge Q → DOM (--d, --forces-heatmap-*) → field → particles
```

Three pillars, plus the accumulator threaded through:

1. **Shaped sources.** A body stops being the point `(cx, cy)`. Forces reference the
   element's rect (nearest surface point) and, for dipole forces, two poles derived from the
   rect and heading. Geometry we already measure (`hw, hh, ux, uy`) starts doing work.
2. **Dipole visual field + field-line render.** A per-force visual field (`B_visual`) draws
   the bar-magnet (N→S) and electric-dipole (+→−) line geometry. Distinct from the force.
3. **Heatmap field buffers.** A family of named `ScalarGrid` layers (density, heat, force,
   velocity, entropy, memory, attention), each rendered (glow / contour / debug-grid) and
   sampled back into DOM bodies as CSS variables.

## Shared engine primitives

- **`core/geometry.ts` (new).** Pure helpers: `nearestOnRect(px, py, body)`, `sdfRect(px, py,
  body)` (signed, negative inside), `polePair(body)` (two poles along `ux/uy` separated by the
  element extent, signed by `spin`), and `EPS = 1` for divide-by-zero guards. Fully golden-tested.
- **`Force.field?(b, x, y): Vec2` (new optional hook in `types.ts`).** The visual/structure
  field at a point, with no particle. Pure. Used by the field-line renderer and the field-flow
  streamlines. Forces that omit it fall back to the `forceAt` probe.
- **`Env` shaped sampling.** `env.dx/dy/dist` already point at the center. In shaped mode the
  integrator recomputes them toward `nearestOnRect`, gated per body, so existing point-source
  behavior is unchanged unless a body opts in.
- **`Body` additions.** `q` (accumulated charge / `Q`), `chargeable` (from `data-feedback` or
  `data-charge`), and derived pole geometry. `tint`, `M`, `spin`, `strength`, `feedback`, `attn`,
  `accreted`, `capacity` already exist and feed the shaped field.

## Stage 0 — Magnetism falloff (ships first, ~10 lines)

- `forces/natural.ts` `magnetism`: `θ = q · spin · strength · falloff`, with
  `falloff = max(0, 1 − d/range)^n`, `n = 1` default. Keep the exact rotation.
- `config/manual.ts`: update the magnetism `formula` to show the falloff and the rotation.
- Conformance (`conformance/experiments.ts`, `forces/natural.test.ts`): the seven tests from
  the spec (neutral ignored, perpendicular-in-the-limit, speed preserved, charge reversal, spin
  reversal, no effect beyond range, moving-particle required). Speed preservation stays the
  strong check; add the missing range/zero-velocity cases.
- Gate: the existing 316 tests stay green.

## Stage A — Shaped-source geometry primitives

- Implement `core/geometry.ts` (above) with golden tests: nearest point on a box from inside,
  outside, and at the corners; signed distance sign flips across the edge; pole pair lies on the
  heading axis at the expected separation and flips with `spin`.
- No behavior change. This stage is pure groundwork the next stages consume.

## Stage B — Dipole visual field + field-line rendering (the visible milestone)

- Implement `Force.field()` for `magnetism` and `charge` as a two-pole superposition built from
  `polePair(body)`. Magnetic uses the bar-magnet dipole; electric uses the +/− dipole. `Q`
  (Stage C) scales pole strength; until then it reads `strength · M`.
- Field-line tracer (extend `streamlines.ts` or add `core/fieldlines.ts`): prefer `f.field()`
  when present, else `forceAt`. Seed around the poles, integrate the streamline forward and
  backward, and stop on loop closure, min strength, viewport exit, max steps, or line spacing
  (defaults from the spec: step 4–8px, maxSteps 200–600, minStrength 0.01, spacing 12–24px).
- This is why magnetism is currently invisible in the field-flow view: `forceAt` uses a
  zero-velocity, zero-charge probe, so `magnetism.apply` is a no-op there. `field()` fixes it
  without changing any force.
- Demo: render the N→S magnet loops and +→− electric lines over the `magnetism`/`charge`
  bodies on the examples page and in the Lab. The `field-probe` already draws a concentric-loop
  approximation; reconcile it to the dipole tracer.
- Risk: low. No force behavior changes in this stage.

## Stage C — Shaped force sampling + chargeable accumulator (opt-in)

- **Shaped sampling.** A body flag (`data-extent`, or `data-shaped`) makes the integrator
  compute `env.dx/dy/dist` toward `nearestOnRect` instead of the center (the change lands at
  `integrator.ts` ~line 116). `attract`/`gravity`/`repel` then gather matter into a shell around
  the element box instead of a blob at its center.
- **Electric flow.** `charge` reads `polePair` and pushes charged particles along the dipole
  field (force parallel to `B_visual`), so the right-hand diagram both renders and behaves.
- **Chargeable accumulator (`Q`).** Extend `writeFeedback` (`field.ts`): a chargeable body
  samples local field intensity over its rect each frame and accumulates `Q` with decay and a
  saturation ceiling (`Q' = Q·decay + deposit`, clamped). It writes `Q` to `--d` and a new
  `--forces-charge`, and can drive color (`tint`), weight, and mass. `field()` (Stage B) reads
  `Q` as the pole strength, closing the loop: a charged element radiates a stronger field.
- Per D4: lightweight and bounded now; pool-conservation later (tie to accretion bookkeeping).
- Tests: shell-formation invariant (matter settles off-center, around the box) for a shaped
  attractor; `Q` boundedness under a sustained field (no runaway); decay toward zero when the
  field is removed.

## Heatmap track (parallel) — Stages H1–H3

Reuses `ScalarGridImpl`. A heatmap manager in `field.ts` owns named grids, runs a deposit pass
per enabled layer, a render pass, and the DOM sample/write.

- **H1.** Density layer + `glow` raster render + `--forces-heatmap-density` write-back. Kernel
  default `K(d, r) = max(0, 1 − d²/r²)²`. Prove the full particles → grid → DOM → field loop on
  one example.
- **H2.** Attention layer (deposits `density · strength · visibility · engagement` around each
  body rect, ties to the conserved-attention demo) plus `contour` render (reuse the
  marching-squares routine already in `metaballs`) and `debug-grid` render.
- **H3.** Diagnostic layers (force magnitude, velocity, entropy) and the memory heatmap
  (render the existing memory grid). A Lab "Field Inspector" overlay.
- API: `heatmap="density heat memory"`, `heatmap-render="glow|contour|debug-grid"`,
  `heatmap-resolution="4"` on `<forces-field>`; a `HeatmapConfig`/`HeatmapLayer` type;
  matching `scanner.ts` + `packages/elements` attributes.
- CSS outputs: `--forces-heatmap-{density,heat,force,velocity,entropy,memory,attention}`.
- Performance: low-resolution grid (4–8px/cell), blur, upscale, composite. Debug-grid draws
  cells directly. Decay defaults: heat 0.94–0.985, memory 0.995–0.9995.

## Conformance and testing

- Magnetism: the seven spec tests (Stage 0).
- Geometry: nearest/SDF/pole golden tests (Stage A).
- `field()` hook: falloff with range, symmetry, and that summed multi-body fields cancel and
  reinforce as expected (Stage B).
- Shaped sampling: shell-formation invariant (Stage C).
- Charge `Q`: boundedness and decay (Stage C); conservation against the pool when that lands.
- Heatmap grids: deposit/sample/decay invariants; conservation where a layer claims it.
- The existing suite stays green at every stage; each stage adds its own tests.

## Catalog and docs

- `config/manual.ts`: magnetism formula (falloff + rotation), charge dipole/electric coupling
  note, the chargeable concept, new attributes. Magnetism icon is the field-loop (`⊙↷`), never
  a horseshoe.
- `docs/forces-system.md`: new sections for shaped sources, dipole field lines, body charge,
  and heatmaps as field buffers, in the §20 numbering.
- `docs/api/attributes` + `lib/docs-api.ts`: `data-extent`/`data-charge`, the `heatmap-*`
  attributes, and the `--forces-heatmap-*` outputs.

## Risks and sequencing

- Shell-gathering restyles every attractor: opt-in, retune per demo before defaulting (D3).
- Hot-loop cost (SDF + pole sample per particle × body): measure with `packages/core/bench`.
- Charge runaway: saturation + decay are mandatory, not optional (D4).
- Heatmap cost: low-res grid is mandatory.
- Verification limits: the headless preview does not run rAF and screenshots capture the field
  canvas blank, so live motion is verified through headless conformance and DOM assertions, not
  screenshots.

Build order: **Stage 0 → A → B → C → H1 → H2 → H3.** Stage B (dipole field lines) and Stage H1
(density heatmap) are the two demo-able milestones; ship a visible example at each.

## File touchpoints (index)

- `forces/natural.ts` — magnetism falloff, magnetism `field()`.
- `forces/index.ts` / `forces/extended.ts` — charge `field()`, electric flow.
- `core/geometry.ts` — new, shaped-source primitives.
- `core/types.ts` — `Force.field?`, `Body.q`/`chargeable`, any `Env` shaped fields.
- `core/integrator.ts` — shaped sampling at the body-force loop.
- `core/field.ts` — chargeable accumulator in `writeFeedback`, heatmap manager, render dispatch.
- `core/streamlines.ts` / `core/fieldlines.ts` — field-line tracer using `field()`.
- `core/scalar-grid.ts` — heatmap layers, blur/upscale helpers.
- `core/scanner.ts`, `packages/elements` — new attributes.
- `config/manual.ts`, `config/forces.config.ts` — catalog and render-mode entries.
- `conformance/*` — tests per stage.
- `apps/site` — demos (examples page, Lab); `docs/*` — spec and API updates.
