---
title: "The Field Was Never Particle-Bound — It Was Fill-Rate-Bound"
description: "A 120→30fps homepage regression that particle count couldn't explain — and the canvas-compositing bottleneck that did. Profile by isolation; suspect the compositor before the force math."
summary: "Why a slow field is almost never the particles, and the DPR2 / mix-blend trap that actually costs the frame."
date: 2026-06-26
category: feature
author: "Zach Shallbetter"
draft: false
---

# The Field Was Never Particle-Bound — It Was Fill-Rate-Bound

The homepage was running at 30fps. It had been running at 120. Nothing in the force math had
changed, the particle budget was the same, and the obvious suspect — too many particles — turned out
to be innocent.

Here is the test that broke the assumption. We dropped particle density from 3 to 1. A third of the
particles, a third of the integration work, a third of the per-particle draw calls. The frame rate
did not move. Thirty frames per second, before and after.

If the bottleneck were the particles, that should have been a *massive* win. It was nothing. Which
means the particles were never the problem.

## The thing that actually moved the needle

Two changes restored the frame rate, and neither touched a particle.

Halving the device pixel ratio **doubled** the fps. And hiding *either* full-viewport canvas — the
underlay or the overlay — restored it on its own.

That is the whole diagnosis in two facts. A field is **fill-rate-bound, not particle-bound.** The
cost that was eating the frame wasn't the force solver or the integration loop. It was the compositor
blending full-screen canvases at DPR 2 — four physical pixels per CSS pixel, across the entire
viewport, every frame. This is also the strongest case for [the invisible field as baseline](/writings/render-none-the-invisible-field): a field that draws nothing pays no fill cost at all.

Particle math scales with particle count. Compositing scales with *area times pixel density* — and
it doesn't care how many particles you drew into that area, or whether you drew any at all.

## The DPR2 / mix-blend trap

The sharpest version of this is the one that looks free and isn't — and it has [its own war story](/writings/the-empty-canvas-that-costs-every-frame).

A full-viewport `mix-blend-mode` canvas costs you every frame the layer beneath it animates — **even
when the canvas is empty and fully transparent.** Blend modes aren't a per-pixel-you-drew operation.
They're a compositing instruction: *re-blend this layer against everything under it.* So the GPU
re-composites the whole screen on every frame the page moves, whether the canvas has one particle in
it or none.

You can stare at that canvas in DevTools, see it's transparent, see it's "doing nothing," and it is
silently re-blending the entire viewport behind your back. The fix is blunt: keep such a canvas out
of the render tree — `display: none` — unless it is actively being drawn into (#405).

The counterintuitive part, for anyone who learned to fear draw calls: a single additive
`drawImage` or a textured quad is *cheap* on a real GPU. One full-screen `mix-blend` re-blend is not.
The number of things you draw matters far less than the area and the blend you ask the compositor to
re-evaluate.

## The lesson: profile by isolation, suspect the compositor first

The instinct when a field is slow is to optimize the force loop — spatial hashing, fewer neighbors,
a cheaper integrator. That instinct is almost always wrong, and the density test is why: if cutting
the particle count by two-thirds buys you nothing, the math was never the cost.

So profile by isolation, and isolate the *layers*, not the algorithm. The [performance guide](/docs/performance) treats this as the first principle, and the [diagnostics tools](/docs/diagnostics) let you watch the cost live:

- Halve the DPR. If the frame rate jumps, you're fill-bound — stop looking at the solver.
- Hide each full-viewport canvas in turn. If hiding one restores the frame, that layer's compositing
  is the cost.
- Only after the canvas/DPR/compositing layer is ruled out does it make sense to look at particle
  math.

Canvas, DPR, and compositing first. Particle math last. The bottleneck is never where the physics
makes you want to look.

## The cadence trick, and why it's safe

There's a second-order win hiding in the same idea, and it falls out of how the engine already keeps
its books.

Bodies are re-measured only **every sixth frame** (`frameN % 6` in `field.ts`). DOM measurement is
expensive and body geometry barely changes between frames, so the engine reads layout on a cadence
rather than every tick. The consequence: any layer *driven by body positions* — streamlines, a flow
field, a density heatmap — only changes meaningfully once every six frames anyway.

So computing those grids every frame is pure waste. Resample the expensive grid on a cadence into a
cache, and **draw from the cache every frame:**

```ts
// expensive: re-derive the flow grid only when bodies may have moved
if (frameN % SAMPLE_EVERY === 0) {
  flowCache = sampleStreamlines(bodies, env);
}

// cheap: composite the cached grid every frame — no flicker, no re-derive
drawCached(ctx, flowCache);
```

Separating *compute cadence* from *draw cadence* is the whole move. You keep a smooth 60/120fps
draw because you composite a cached image every frame; you stop paying to re-derive a grid that
hasn't changed (#406/#407). No flicker, a fraction of the work. And the heaviest ambient layer — the
heatmap — can be suppressed entirely while `env.scrollV` is high: scrolling shouldn't pay for a glow
you can't focus on mid-scroll.

## The cost, stated plainly

The honest caveat is about *where you measure.*

Headless browsers exaggerate fill. Playwright and other headless runs fall back to software
rasterization, so every `drawImage`, every fill, every blend reads far worse than it does on a real
GPU. A feature that's perfectly cheap on actual hardware can look like a frame-killer in a headless
profile, purely because the software rasterizer is paying in CPU for what a GPU does for nearly free.

So don't kill a feature on a headless fill number alone. A headless regression is a *flag*, not a
verdict — confirm it on real hardware before you rip anything out. The same rule that saved the
homepage (profile by isolation) has a partner: profile on the hardware your users actually run, and
treat the software-rasterized number as a worst case, not the truth.

The field was never particle-bound. It was fill-rate-bound the whole time — and the frame rate only
came back once we stopped optimizing the math and started looking at the pixels. That is part of [what the field costs](/writings/the-interface-is-a-field-not-a-screen): a behavior layer on the DOM you have to budget like any other.

## Related reading

- [The Empty Canvas That Costs Every Frame](/writings/the-empty-canvas-that-costs-every-frame) — the DPR2 / mix-blend trap in full, its sibling perf piece.
- [render: 'none' — The Invisible Field Is the Baseline](/writings/render-none-the-invisible-field) — no draw means no fill cost; the signals-first default.
- [The Interface is a Field, Not a Screen](/writings/the-interface-is-a-field-not-a-screen) — the manifesto, and why a behavior layer has a frame budget.
- [One Engine, Four Runtimes](/writings/one-engine-four-runtimes) — the zero-DOM core that pushes all pixel work through an injected host.
- [Performance](/docs/performance) — the profile-by-isolation guidance as docs.
- [Diagnostics](/docs/diagnostics) — inspect compositing and per-layer cost live.
