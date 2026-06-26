---
title: "The Interface is a Field, Not a Screen"
description: "An interface is less a screen of components than a field of relationships — priority, polarity, binding, decay — and Fundamental makes that field runnable, inspectable, and measurable."
summary: "The manifesto: why an interface is a shared field of meaning, not a pile of components, and what it costs to make that field real."
date: 2026-06-26
category: feature
author: "Zach Shallbetter"
draft: true
---

# The Interface is a Field, Not a Screen

An interface is less a screen of components than a field of relationships — priority, polarity,
binding, decay — and Fundamental makes that field runnable, inspectable, and measurable.

Most software treats an interface as a collection of objects. A button is a button. A card is a card.
A tooltip is a tooltip. Each component owns some local state, responds to a few events, and changes
appearance when something happens.

That model has served the web for a long time. It also gave us a narrow idea of what interface
behavior can be. In most interfaces, relationships are implied but not felt; attention is guessed at
but not modeled; memory is reduced to visited links; motion is added as a transition after the fact;
state is a set of toggles.

That is the paradigm Fundamental challenges: an interface is not a pile of components, it is a shared
field of meaning.

## The old model

Component-local state answers questions in isolation. It is good at "what is this thing" and bad at
"what is this thing *to everything else*."

- A form field knows it is invalid. But does the form know it is unstable?
- A citation links to a source. But does the interface know how *strongly* it supports the claim?
- A dashboard card shows an alert. But does the page know the system is heating up?
- A search result is ranked. But does relevance *behave* like gravity?
- A section is visible. But does the page remember where the reader paused?

Every document, application, dashboard, editor, form, and AI interface already contains invisible
forces — some things matter more, some are related, some conflict, some decay, some pull attention,
some hold together, some become unstable, some leave memory, some should flow. Today we express those
through layout, color, hierarchy, state flags, and the occasional animation. Fundamental makes them
explicit and gives them a runtime — not as decoration, as behavior.

## The new model: a relational field runtime

Fundamental is a *platform-native, relational, field runtime*. The loop changes shape: elements
register as **bodies**; the platform layer — `@fundamental-engine/dom` — **measures** them;
`@fundamental-engine/core` **computes** field behavior; agents **respond** to influence; metrics
**accumulate**; feedback **writes back** to the DOM; render layers **reveal** when you ask them to;
and diagnostics **explain**.

The interface stops being a static arrangement that you nudge with events. It becomes a field that is
continuously solved, every frame, with the DOM as both input and output.

## Why this is not just animation

Animation is applied *after* the fact — a transition runs because you told it to, on a property you
picked, for a duration you set. Field behavior is *caused.* A heading pulls because it has mass. A
section accrues memory because it was read. A card heats because the system around it is under
pressure. The motion, where there is motion, is a *consequence* of the behavior, not a costume worn
over it.

And drawing is now optional. As of the [signals-first change](/writings/render-none-the-invisible-field), the engine default is `render: 'none'`.
A field created without an explicit render mode runs the *entire* simulation — measures bodies,
resolves forces, accumulates attention, writes feedback to the DOM — and draws nothing. The invisible
field is the baseline. You opt *into* pixels (`render: 'dots'`); you don't fall back from them. If the
field still does all its work with the canvas turned off, then the field was never the animation. The
animation was one view of it.

## Why this is not just a physics engine

A physics engine simulates matter. Fundamental simulates *meaning*. It takes the relationships an
interface already implies and translates them into field behavior, giving the interface a physical
grammar it can be reasoned about in.

The translation is deliberate and it is lossy on purpose. **Natural fields are not tokens; tokens are
translations.** *Attract is not gravity* — `attract` is a designed UI well, a thing you build because
it is useful, not a law you discovered. Designed behavior and natural behavior are kept in separate
lanes on purpose.

## The four natural fields as interface grammar

The conceptual layer is a [compression system](/writings/your-design-system-already-has-four-forces) — four families that the whole catalog of runtime forces
translates down into:

- **Gravity → priority, convergence, hierarchy.** What matters pulls.
- **Electromagnetic → polarity, signal, flow.** Things attract, repel, and carry charge.
- **Strong → binding, cohesion, structure.** What belongs together holds together.
- **Weak → transformation, decay, release.** What is done lets go.

Stated as a grammar: *electric fields push, magnetic fields bend, fieldflow carries.* Those are
behaviors you can feel in an interface long before you can name the force underneath them.

Under that conceptual layer sits the real catalog: **36 forces — 9 canonical, 8 natural, 19
extended** — addressed through the body contract (`data-body="…"`). Words like *fieldflow* and *phase*
are concept language; they map onto derived behaviors the engine computes, not onto single tokens you
spell out one-to-one. The vocabulary is a translation surface, not a literal list.

## The DOM becomes reciprocal

This is the move that makes it native instead of an overlay. Bodies bend the field, and the field's
local density bends them back. Reciprocity. The DOM is not a passive stage the simulation plays on
top of — it is a participant. An element changes the field around it, and the field around it changes
the element.

## The platform layer

`@fundamental-engine/dom` is where meaning meets the DOM. It is organized as six registries, each
owning one kind of work: **Measurement** (where bodies are), **State** (what they are), **Feedback**
(what gets written back), **Relationship** (how they connect), **VisualBinding** (how state maps to
appearance), and **Overlay** (what gets drawn in front).

A `FrameScheduler` drives them through ordered phases — *discover → read → compute → state → write →
render* — so reads never tangle with writes and the frame stays coherent. `lintPlatform` checks that
the wiring is honest: bodies declared, feedback consumed, contracts intact.

## The portable core

The core imports **zero DOM.** A boundary test enforces it with an empty allowlist — not a convention,
a gate. Every bit of DOM access goes through an injected host, so the engine that computes the field
does not know or care what it is running inside.

This used to be a promise. It now ships. `@fundamental-engine/three` renders the same field through
Three.js, and `headlessHost()` runs the whole simulation with no `document` present at all — same
state, no screen. Both landed in 0.8.1. DOM, WebGL, and headless are [three hosts over one engine](/writings/one-engine-four-runtimes).

The full lineup is one core and five adapters: `@fundamental-engine/core`, plus `dom`, `elements`,
`react`, `vanilla`, and `three`.

## Recipes as the practical bridge

Nobody wants to hand-tune 36 forces to make a paragraph remember it was read. Recipes are the bridge:
named, composed configurations that turn intent into field behavior. You reach for *Reading Field* or
*Attention Weather*, not for raw force coefficients. The catalog is the on-ramp; the forces are what
it rides on.

## Worked examples

**A normal content page as a [Reading Field](/docs/reading-field).** Sections gain mass by importance and accrue memory as
they are read. The reader feels a document that remembers them.

**AI evidence as an [Evidence Field](/evidence).** A claim and its citations are bound by strong-force cohesion
proportional to how well the source supports the claim. The interface stops merely *linking* to
evidence and starts *behaving* according to its strength.

**Forms as a Coherence Field.** A form is not a list of fields that are each valid or invalid — it is
a system with a coherence of its own. It can feel stable, or feel like it is coming apart, before any
single field flags an error.

**Dashboards as Attention Weather.** Urgency has weight. A heating subsystem pulls the eye through
gravity and pressure, not through a red badge you have to scan for. The page has weather, and you read
it the way you read a sky.

## Explainable interaction

Because behavior is *caused* by computed state, it can be *explained.* Diagnostics report why a body
moved, what it is bound to, where its attention went. The field is inspectable — you can ask it what
it is doing and get an answer grounded in state, not a guess about an animation.

## Accessibility is not an afterthought

The hard rule of the whole system: **no field behavior may be the only source of meaning.** Every
relationship the field expresses must also live in semantic HTML, ARIA, and text. The field is a
behavior-and-visualization layer on top of meaning that already stands on its own.

The signals-first default helps here by construction. When the baseline draws nothing, there is
nothing to fall back *from* — the calm, reduced-motion path is the default, and the pixels are the
enhancement.

## Why now

The web finally has the substrate for this — fast layout reads, custom properties as a live
write-back channel, custom elements to host a singleton page field, and enough rendering headroom to
run a real simulation per frame. The pieces that used to make this a research toy are now platform
primitives.

## What it costs

This is where an honest manifesto earns its keep.

- **It is more to learn.** A field grammar is a new mental model. "This card is a body with mass that
  heats under pressure" is not how most of us were taught to build UI.
- **It is more to run.** A field is [fill-rate-bound, not particle-bound](/writings/the-field-is-fill-rate-bound) — the expensive part of a
  *visible* field is full-viewport canvas compositing, not the force math. A full-viewport
  [`mix-blend-mode` canvas re-blends the whole screen](/writings/the-empty-canvas-that-costs-every-frame) every frame even when it is transparent. Keep
  such canvases out of the tree unless they are actively drawn. `render: 'none'` exists in part so you
  do not pay this cost by default.
- **It can be over-engineering.** Plenty of interfaces do not need a field. A settings page is fine as
  a settings page. Reach for this when relationships and attention genuinely carry the meaning, not
  reflexively.
- **Accessibility is more work, not less.** The "no behavior is the only source of meaning" rule is a
  standing tax. You pay it on every body, deliberately.
- **There is a [silent contract gap](/writings/the-silent-contract-gap).** The engine faithfully writes `--load`, `--field-*`, and `--d`
  onto bodies every frame — but nothing forces a CSS consumer to *read* them. A body can be reacting
  hard and look completely inert because no rule downstream consumes the variable. The field is not
  broken; it is reacting invisibly, which is exactly what you asked for and exactly what bites you.
  Linting catches one half of the gap; discipline catches the other.
- **It is early.** The packages ship — 0.8.1 is published on npm, and the
  [road to RC1](/writings/the-road-to-rc1) tracks what still gates 1.0. But this is a young paradigm
  with no user study behind it yet. The claims here are architectural, not the verdict of research.
  Treat them as a thesis being built in the open.

## What changes

When you stop seeing a screen of components and start seeing a field of relationships, the questions
change. Not "what does this button do" but "what is this button's mass, and what is it bound to, and
what happens to the page when attention moves to it." The interface becomes something you can reason
about as a system, measure as a field, and explain as behavior.

---

Four fields. Many expressions. One DOM runtime.

## Related reading

- [render: 'none' — The Invisible Field Is the Baseline](/writings/render-none-the-invisible-field) — where the invisible-forces idea becomes the engine default.
- [Your Design System Already Has Four Forces](/writings/your-design-system-already-has-four-forces) — the designer on-ramp to the four natural fields.
- [One Engine, Four Runtimes](/writings/one-engine-four-runtimes) — how a zero-DOM core ports to WebGL and headless.
- [The Field Translation Runtime](/writings/01-field-translation-runtime) — the formal paper behind this manifesto.
- [Evidence Fields](/writings/03-evidence-fields) — the AI-trust case where binding strength carries meaning.
- [Concepts](/docs/concepts) — the naming canon: concepts, tokens, metrics, diagnostics, recipes.
