# Fundamental — performance

> **Status: reference.** This documents the **core performance suite** (`packages/core/bench/`) and how to
> read its numbers. It is the algorithmic half of the performance story; the fill-rate half is GPU-bound
> and measured on hardware (see [the fill-rate section](#the-other-half-fill-rate-is-gpu-bound) below).
> Run it yourself: `pnpm --filter @fundamental-engine/core bench`.

## The one thing to internalize

**The field is fill-rate-bound, not particle-bound.** When the homepage drops frames it is almost never
the particle math — it is canvas compositing at DPR 2, or a full-viewport `mix-blend-mode` layer the
compositor re-blends every frame (even when transparent). The 120→30fps regression that motivated this
note was *not* particle count — density 1 and density 3 measured the same fps; halving DPR doubled it.

So this suite deliberately splits the two concerns:

- **Algorithmic cost** — `step()`, `query()`, `snapshot()`, the accumulator. Pure Node, deterministic,
  no compositor. This is what the bench measures, and it is **not** where the homepage spends its frame.
- **Fill-rate / fps** — canvas draw, DPR, blend modes. GPU-bound, measured on real hardware. Headless
  software-rasterizes and reads *far* worse than a real GPU, so the bench does **not** report fps — a
  headless fill number would mislead you into killing a feature that is fine on a real machine.

## The suite

Four scenarios, all in `packages/core/bench/field-bench.ts`, driven by a hand-pumped headless host
(`harness.ts`) so frames advance deterministically. Timing is median + p95 of per-iteration wall-clock
after a warmup (a mean is dominated by GC/JIT outliers).

| # | Scenario | What it answers |
|---|----------|-----------------|
| 1 | Full-frame cost vs particle count (density sweep) | How does one `createField` frame scale with particles? |
| 2 | Accumulator overhead | What does the opt-in substrate capture path (`env.accum`) cost? |
| 3 | Read-API cost | How cheap are `query()` / `snapshot()` (+ `includeInfluences`)? |
| 4 | Body-measure cadence | Does re-measuring bodies every 6th frame cause per-6th-frame jank? |

## Reading the numbers

A representative run (Apple-class laptop, Node 25, **algorithmic / no-GPU** — your absolute numbers will
differ; the **shape** is the point):

**1. Full-frame cost scales sub-linearly with particle count.** A full simulation frame stays well under
1ms across the density sweep — against a 16.7ms/60fps budget, the compute headroom is enormous. This is
the evidence for "not particle-bound": the per-particle cost is ~0.6µs and the frame never approaches the
budget on math alone.

| density | particles | frame ms (med) | µs/1k particles |
|---------|-----------|----------------|-----------------|
| 1 | 200 | ~0.21 | ~1.0 |
| 2 | 390 | ~0.25 | ~0.65 |
| 3 | 576 | ~0.33 | ~0.57 |
| 4 | 748 | ~0.45 | ~0.60 |

**2. The accumulator is a ~10–15% step() tax, and it is opt-in.** With `env.accum` absent (the default)
the hot path is byte-identical to the pre-substrate engine — zero overhead. Turning capture on costs a
modest, bounded percentage on `step()`; you pay it only when a diagnostic / Field-Query probe needs
per-force attribution.

**3. `query()` and `snapshot()` are microsecond-cheap.** A global `query()` or a `snapshot()` is single-
digit microseconds; `snapshot({ includeInfluences: true })` is ~2–3× (it runs the accumulator per body).
Reading the field is effectively free relative to a frame — agents/tooling can poll it liberally.

**4. The 6th-frame re-measure does not jank.** Bodies are re-measured every 6th frame (`frameN % 6` in
`field.ts`); bucketing per-frame time by `frame mod 6` shows the buckets flat within noise (~4% spread).
The cadence does its job: re-measure cost is amortized below the per-frame particle work, so there is no
per-6th-frame spike. (This is also why layers driven by body positions only shift on that cadence — see
the performance notes in `CLAUDE.md`.)

## The other half: fill-rate is GPU-bound

These are **not** in the Node suite — they need a real GPU and are verified on hardware with a browser
(screenshot + sampled rAF fps), per the visual-verification discipline in `CLAUDE.md`:

- **fps across particle-count × density × DPR** — the real frame budget lives here, dominated by canvas
  compositing, not the math above.
- **The DPR2 / mix-blend trap** — a full-viewport `mix-blend-mode` canvas costs every frame the layer
  below animates, even when empty/transparent; keep such canvases `display:none` unless actively drawn
  (#405). Halving DPR roughly doubles fps.
- **Compute vs draw cadence** — expensive ambient grids (streamlines/`flow`, heatmap) resample on a
  cadence into a cache and draw from the cache every frame (#406/#407); the heaviest ambient layer is
  suppressed while `scrollV` is high.

**Caveat canon:** headless exaggerates fill — never kill a render feature on a headless fill number
alone; flag it and confirm on real hardware.

## Running it

```bash
pnpm --filter @fundamental-engine/core bench      # the full suite
node packages/core/bench/field-bench.ts           # equivalently
```

It is a plain Node program (TS stripped natively, Node ≥ 22) — no build step, no DOM, no flags. Add a
scenario by exporting another `() => string` table from `field-bench.ts` and logging it in `main()`.
