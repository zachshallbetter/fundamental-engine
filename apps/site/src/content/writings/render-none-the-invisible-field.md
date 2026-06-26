---
title: "render: 'none' — The Invisible Field Is the Baseline"
description: "Fundamental ships invisible by default. The field runs the full simulation and writes its signals to the DOM while drawing nothing — you opt into pixels, you don't fall back from them."
summary: "Why the engine default is render: 'none', and why a signals-first field is a different thing than a particle background you turn down."
date: 2026-06-26
category: feature
author: "Zach Shallbetter"
draft: true
---

# render: 'none' — The Invisible Field Is the Baseline

Every visual system ships visible-first. The rich version is the default; the calm version is a
concession you bolt on afterward — a "reduced motion" media query, a "lite" theme, a setting buried
two menus deep. The most expressive experience is the one you have to walk back.

Fundamental inverts that. As of the signals-first change, the engine default is `render: 'none'`.
A field created without an explicit render mode runs the *entire* simulation and draws nothing at
all. You don't remove the visuals to get the calm version. You add them — `render: 'dots'` — to get
the loud one.

That sounds like a small default flip. It isn't. It's the difference between a decoration and a
computation layer, and it answers the one question the field paradigm always invites: *isn't this
just a fancy particle background?*

No. And here is the structural reason why.

## What `render: 'none'` actually does

A particle background that you turn off does nothing. It's idle. Its whole existence was the pixels.

A Fundamental field with `render: 'none'` is doing all of its work. Every frame, the engine runs the
full six-phase loop — `discover → read → compute → state → write → render` — across all six
registries. Bodies are measured. Forces resolve. Attention accumulates into memory. Relationships
are tracked. Density, heat, coherence, and pressure are computed for every body on the page.

Then it writes that state back to the DOM — `data-field-density`, `data-field-attention`,
`data-field-temperature`, and their matching CSS custom properties — and reaches the render phase,
where it draws nothing.

The behavior is entirely real. The drawing is just *a view of it that you declined to open.* The
field is not off. It is invisible.

```html
<!-- runs the full simulation, draws nothing, writes --field-* to every body -->
<field-root></field-root>

<!-- same simulation, now also drawn as particles -->
<field-root render="dots"></field-root>
```

A button still knows it's sitting in a gravity well. A section still accrues reading memory. A
heading still pulls. None of that needs a canvas. The canvas was never where the meaning lived.

## The turn: the field is a signals layer first

Once `render: 'none'` is the baseline, the mental model shifts. The field stops being "a thing on
the screen" and becomes **a function over the page that you can sample however you like.**

Particles are one sampler — the most legible one, which is why they dominate the demos. But CSS is a
sampler too: a rule that reads `--field-attention` responds to the field with zero pixels of canvas.
A data agent is a sampler. A server-side renderer is a sampler. They all read the same field state
the visual user sees animated, because the physics is the substrate and representation is a choice
sitting above it.

This is the inversion stated plainly: **the field computes meaning; drawing is one optional
projection of that meaning.** Visible-first systems get this backwards — they make the projection
the product and treat the meaning as a side effect of rendering it.

## What invisible-first buys you

**Accessibility by construction.** When the default draws nothing, there is nothing to fall back
*from*. The reduced-motion path isn't a second implementation bolted on late — it's the baseline,
and the visuals are the enhancement. The accessibility rule of the whole system — *no field behavior
may be the only source of meaning* — is far easier to keep when the meaning was never trapped in the
pixels to begin with.

**Performance you don't pay for what you don't draw.** A field is famously fill-rate-bound, not
particle-bound — the expensive part of a visible field is the full-viewport canvas compositing, not
the force math. `render: 'none'` simply doesn't have that cost. You can wire a page to the field —
attention, memory, relationships, live CSS response — with no canvas in the tree at all.

**Honest portability.** The logical extreme of signals-first is no DOM at all. The core imports zero
DOM (a boundary test enforces it with an empty allowlist), and `headlessHost()` runs the whole field
with no `document` present. Same state, no screen. Invisible-first isn't a setting on the way to the
"real" visual mode — it's the mode the architecture was already built around.

## The cost, stated plainly

A signals-first default has its own failure mode, and a system that hid its costs would be exactly
the kind of dishonest interface this whole project is meant to replace.

The trap is the **silent contract gap.** The engine faithfully writes `--load`, `--field-density`,
`--field-attention` onto every body, every frame. But nothing forces a CSS consumer to *read* them.
So a body can be reacting hard — its density swinging, its attention spiking — and look completely
inert, because no rule downstream consumes the variable. The field isn't broken; it's reacting
invisibly, which is precisely what you asked for and exactly what bites you when you didn't.

Visible-first systems don't have this problem, because the drawing is the feedback. Invisible-first
trades that automatic legibility for everything above — and the price is that you have to *close the
loop yourself*: when a body should visibly react, a CSS rule (or some sampler) has to actually
consume the signal. Linting catches one half of the gap. The discipline catches the other.

## Why it's the right default anyway

Because most interfaces that would benefit from a field don't want particles flying across them.
A long article wants its sections to know what's been read. A form wants to feel its own coherence.
A dashboard wants urgency to have weight. None of that is a light show. All of it is signal.

`render: 'none'` makes the common case — *use the field, don't perform it* — the path of least
resistance, and turns the spectacle into the deliberate, opt-in exception it should always have been.

The invisible field is the baseline. The pixels are the choice.
