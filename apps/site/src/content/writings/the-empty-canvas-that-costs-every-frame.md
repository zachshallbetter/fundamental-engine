---
title: "The Empty Canvas That Costs Every Frame"
description: "A full-viewport mix-blend-mode canvas re-blends the entire screen every frame the layer below it animates — even when the canvas is empty and transparent. Here's the trap, and the one-line fix."
summary: "Why a transparent canvas tanked our framerate, and why the bottleneck was the compositor, not the particles."
date: 2026-06-26
category: feature
author: "Zach Shallbetter"
draft: true
---

# The Empty Canvas That Costs Every Frame

We had a homepage running at 120fps. Then it ran at 30fps. The diff that did it added nothing
visible to the screen.

That sentence is the whole story, but it took an embarrassing while to believe it. The field draws
particles, so the instinct was obvious: too many particles. We turned the density down. No change.
We turned it from 3 to 1. Same 30fps. We were optimizing the force math, the thing that *felt*
expensive, and the math was never the problem.

The problem was an empty canvas.

## The setup

Fundamental's [field](/writings/the-interface-is-a-field-not-a-screen) can draw on two surfaces.
There's the underlay — a canvas behind your content — and there's an overlay canvas in front, used
for effects that need to sit on top of the page. The overlay composites with `mix-blend-mode` so its
light adds to whatever it covers instead of painting a flat layer over it.

That overlay canvas was in the DOM. Full-viewport. `mix-blend-mode` set. And most of the time it was
drawing nothing — fully transparent, not a single particle on it.

A transparent canvas costs nothing, right? It's empty. There's nothing to paint.

That is true of the *canvas*. It is not true of the *compositor*.

## What mix-blend-mode actually asks for

`mix-blend-mode` is not a paint operation on one layer. It's an instruction to the GPU compositor
about how that layer combines with everything beneath it. "Take my pixels and blend them with the
pixels below using this function."

To honor that, the compositor has to have both layers available and has to run the blend. And it has
to re-run the blend **whenever the layers below change** — because the result depends on what's
underneath, and what's underneath just moved.

Here's the part that gets you: the blend function still runs when the top layer is empty. A
transparent pixel blended over a moving pixel is still a blend the compositor has to evaluate, per
pixel, per frame. The canvas being empty saves the canvas's own paint. It saves nothing on the
composite.

So you have a full-viewport mix-blend layer sitting over a field that animates every frame. Every
frame, the compositor re-blends the whole screen. The canvas is empty. The bill is for the entire
viewport.

At DPR 2 — a Retina display — that bill doubles, because every one of those re-blended pixels is
four physical pixels. Halving DPR roughly doubled our framerate. Hiding *either* full-viewport
canvas restored it. Two independent confirmations that the cost was compositing the viewport, not
computing the field.

## The fix is one line

Don't keep a mix-blend canvas in the render tree when it isn't drawing.

```js
// The overlay canvas only composites when there's actually something on it.
overlayCanvas.style.display = drawing ? '' : 'none';
```

`display: none` pulls the layer out of the compositing tree entirely. No layer, no blend, no
per-frame whole-screen tax. The moment you have something to draw, you flip it back in. The cost
exists only while it's earning its keep.

This is not the same as `opacity: 0` or `visibility: hidden`. Those keep the layer in the tree — it
still exists for the compositor, it still blends, you still pay. `display: none` is the one that
actually removes it. (#405, if you want the change in the history.)

## The counterintuitive part: drawing is cheap, blending is not

The lesson people take from "it was the canvas" is usually "canvases are expensive, draw less." That
is the wrong lesson, and it points you at the wrong optimizations.

A single additive `drawImage` or a textured quad is *cheap* on a real GPU. You can push a
surprising amount of geometry per frame and never feel it. The expensive thing here was never the
drawing. It was asking the compositor to re-blend a full-viewport layer against a moving background,
every frame, forever — whether or not anything was on that layer.

So the mental correction is: separate the cost of *painting a layer* from the cost of *compositing
it*. They are different budgets with different owners. Painting is your code calling into the canvas
API. Compositing is the GPU assembling layers into the final frame, and `mix-blend-mode` makes a
layer's compositing cost scale with the activity beneath it, not with its own content.

This is also why [the field is fill-rate-bound and not particle-bound](/writings/the-field-is-fill-rate-bound).
The force simulation — measuring bodies, resolving 36 forces, accumulating attention — runs fine. Bodies are only
re-measured every sixth frame, so the math isn't even running at full cadence. What pins the
framerate is pixels: how many the GPU has to touch and re-touch to assemble each frame. A
full-screen mix-blend re-blend touches all of them.

## The cost, stated plainly

This is GPU compositor behavior, and compositor behavior is not uniform. The blend cost depends on
the GPU, the driver, the browser's compositing strategy, and the display's DPR. What flattened our
Retina laptop may be a shrug on a desktop with a discrete card, and brutal on a thermally-throttled
phone.

And there is one trap that will lie to you while you [measure](/docs/performance): **headless rendering**. Playwright and
other headless runners rasterize in software. Software rasterization makes every fill and every
blend read dramatically worse than a real GPU would. A headless framerate number is useful for
catching a regression's *direction* — slower is slower — but it is not a verdict on the *magnitude*,
and it will absolutely talk you into killing a feature that runs fine on actual hardware.

So the honest version of this fix is: keep mix-blend layers out of the tree when idle, yes, that's
unambiguous. But the framerate cliff that motivated it should be confirmed on the hardware your users
actually have. Screenshot it, sample real rAF timing on a real GPU, and don't let a software
rasterizer cast the deciding vote.

The empty canvas taught us the rule we now reach for first: when the field is slow, look at the
canvas, the DPR, and the compositing tree before you touch a single line of the physics. The
bottleneck is almost never where the work *looks* like it is. It also taught us the cleaner default:
a field that [draws nothing by default](/writings/render-none-the-invisible-field) never pays this
tax at all — you opt into a render surface only when something is worth drawing.

## Related reading

- [The Field Is Fill-Rate-Bound](/writings/the-field-is-fill-rate-bound) — the broader war story this trap is one chapter of.
- [render: 'none' — The Invisible Field Is the Baseline](/writings/render-none-the-invisible-field) — drawing nothing is the cleanest way to never pay the composite.
- [The Interface is a Field, Not a Screen](/writings/the-interface-is-a-field-not-a-screen) — the manifesto that frames why the field exists at all.
- [Performance](/docs/performance) — the profiling guidance behind these numbers.
- [Diagnostics](/docs/diagnostics) — how to see what the field is actually doing each frame.
