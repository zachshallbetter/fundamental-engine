---
title: "Fundamental, explained to a developer"
description: "Not an animation library, not a particle background — a relational field runtime for interfaces. The conceptual shift, the lane model, field vs force, the Natural Fields, designed-vs-natural, dimensions and coupling, agents, signals-first feedback, and the practical developer rules."
summary: "The developer-tier companion to 'explained simply' — the mental model (concepts/tokens/metrics/diagnostics/patterns/projections), field() vs apply(), designed-vs-natural, association ≠ coupling, signals-first CSS feedback, and the minimal working mindset."
date: 2026-06-29
category: note
author: "Zach Shallbetter"
draft: false
---

# Fundamental, explained to a developer

Fundamental is not an animation library. It is not a particle background. It is not a canvas effect
behind the DOM.

Fundamental is a **relational field runtime for interfaces.**

Traditional UI development treats elements as isolated components. A button owns its hover state. A card
owns its selected state. A form field owns its error state. State changes classes, classes change
styles, and animation decorates the transition.

Fundamental changes the model:

```txt
interface owns a shared field
bodies emit influence
agents respond
metrics accumulate
diagnostics explain
feedback returns state to the DOM
```

The interface becomes a living context instead of a set of disconnected components. A heading, button,
citation, data point, error message, collaborator cursor, or product card can all participate in the
same field. They can attract attention, repel conflicting information, accumulate memory, expose
density, trigger events, or form relationships.

The project's own definition turns DOM elements, custom components, data records, relationships, events,
users, and layout regions into participants inside a shared field context. Particles are one participant
type, not the whole system.

That is the conceptual shift.

## The difference from normal UI

A normal UI says:

```txt
this element is hovered
this element is selected
this element is focused
this section is active
```

Fundamental says:

```txt
this region is dense
this element is gaining attention
this claim is contested
this source is strongly related
this path has memory
this section is cooling
this body is saturating
this relationship is strengthening
```

That is a different kind of state. It is not binary. It is spatial, relational, continuous,
inspectable, and composable.

A component system gives you **local** state. A field runtime gives you **contextual** state.

The important sentence is:

```txt
Elements bend the field.
The field bends them back.
```

That loop is the product.

## The core mental model

There are several lanes. Do not mix them.

```txt
Concepts describe.
Dimensions hold state.
Fields structure.
Relationships associate.
Forces couple.
Tokens execute.
Metrics measure.
Diagnostics explain.
Conditions activate.
Projections reveal.
Field Patterns compose.
FieldPattern represents.
Contracts execute.
No word lives in two lanes.
```

A new developer needs this more than anything else, because the language is powerful but easy to blur.

**Concepts** are human meaning — `priority`, `trust`, `risk`, `attention`, `confidence`, `memory`,
`evidence`, `support`, `conflict`. Concepts do not execute.

**Tokens** are actual engine behavior — `attract`, `gravity`, `charge`, `magnetism`, `fieldflow`,
`cohesion`, `sink`, `memory`, `wall`, `thermal`. Tokens execute. This is why `absorb` is not a token —
the token is `sink`. The docs explicitly warn that `attract` is not gravity, and that `absorb` is
concept language while `sink` is the runtime token.

**Metrics** expose measured state — `--d`, `--load`, `--field-attention`, `--field-trust`,
`--field-coherence`, entropy, temperature, memory, confidence. Metrics do not cause behavior by
themselves. They are readings.

**Diagnostics** explain what is happening — field lines, force vectors, causality, prediction, topology,
heatmap, contours, inspector. The behavior table says it cleanly: `field()` returns invisible
structure, while `apply()` causes change.

**Field Patterns** are authored arrangements of concepts, tokens, metrics, diagnostics,
projections, and accessibility equivalents — the concept and its API name are the same word.
Conceptually:

```txt
Field Pattern  = the authored field-native arrangement (concept AND API: FieldPattern)
Field Contract = compiled executable plan
Configuration  = ordinary settings/options only
Matter         = participants/substance only
```

That gives the idea weight without breaking the shipped API.

## The field/force split

Every field-like behavior separates structure from cause.

```txt
field(b, x, y) = invisible structure
apply(b, p, env) = actual effect
```

`field()` answers: *what is the shape of the invisible structure here?* `apply()` answers: *how does
matter or an agent respond to that structure?*

A magnetic field line is not automatically a particle path. Electric fields push. Magnetic fields bend.
Fieldflow carries. That distinction is canonical in the behavior table, and it is one of the most
important rules in the system.

## The Natural Fields model

Fundamental does not copy physics into the interface. It **translates** the compact grammar of physical
fields into interface behavior.

```txt
Gravity         -> priority, convergence, hierarchy
Electromagnetic -> polarity, signal, routing
Strong          -> binding, cohesion, structure
Weak            -> transformation, decay, release
```

This does not mean every token is literal physics. `gravity` is a natural primitive; `attract` is a
designed UI well. `charge` translates electromagnetic polarity; `repel` is a designed UI verb.
`fieldflow` is transport along existing field structure. The rule:

```txt
Natural fields are conceptual.
Engine primitives are translations.
Canonical forces are designed verbs.
Derived behaviors are not additional fundamental forces.
```

That is why the engine can be physically legible without being trapped by physical law.

## Designed vs. Natural: why this is powerful

Every engine concept relates to nature in one of four ways:

```txt
Faithful      the engine does what nature does
Idealization  the same simplifications real simulations use
Departure     a deliberate break from physical law, for legibility or performance
No analog     a semantic or behavioral invention
```

A physics engine is constrained by physical truth. A UI animation library is unconstrained but often
arbitrary. Fundamental sits between them:

```txt
It borrows physical truth where useful.
It idealizes where simulation needs stability.
It departs where interface law matters more.
It invents where interfaces need meaning physics does not have.
```

The most important sentence is:

```txt
The engine is free precisely where it departs from physics.
```

The designed-vs-natural map calls the departure column the flexibility: bounded falloffs, post-step
friction, velocity caps, immovable bodies, CSS feedback, optional rendering, and nominal units are
places where the engine refuses to be bound by physical law so it can be bound by interface law.

A normal physics engine cannot say: *this CTA has importance that behaves like a bounded gravity well
but stops at 280px.* Fundamental can — because `attract` is not gravity. It is an interface primitive
shaped like a useful, finite, legible version of attraction.

## Dimensions, association, and coupling

A **dimension** is an axis of state — `x/y` position, `z` depth, time, orientation, attention, memory,
confidence. A dimension may have fields, metrics, diagnostics, projections, and response laws. But
dimensions should be **orthogonal by default.** Adding time should not disturb `x/y` motion; adding
depth should not change attention; adding orientation should not create torque.

```txt
Dimensions are independent by default.
Fields superpose within a dimension.
Relationships associate state.
Forces couple state.
Cross-dimensional effects must be explicit.
```

This distinction matters:

```txt
Association is not coupling.
```

A relationship says *these things are related.* A force says *this thing changes that thing.* A citation
can be related to a claim without physically pulling anything. But an Evidence Field formation can
decide:

```txt
support relation     -> cohesion
contradiction relation -> charge separation
confidence metric    -> gravity strength
```

That is where association becomes coupling — the difference between a semantic graph and a field
runtime. (Full doctrine: [dimensional-coupling.md](https://github.com/zachshallbetter/fundamental-engine/blob/main/docs/canonical/dimensional-coupling.md).)

## Agents and consumers

A force does not merely "move particles." A force produces **influence at a location.** Whatever is
there consumes that influence according to its own type. Particles are only the lightest agents.

```txt
particle      consumes impulse as velocity
element       consumes density as CSS variables
relationship  consumes activity as strength or memory
data record   consumes salience
user / input  emits focus, pointer, selection
event sink    consumes a threshold crossing as a dispatched event
```

That is a major difference from ordinary animation systems. The field is not just drawing. It is
producing a shared signal that many kinds of things can consume.

## Feedback: how the field returns to the DOM

Fundamental's primary output is not the canvas. It is **CSS custom properties.** The engine writes
values onto elements during the write phase, and the page's CSS reads those values to produce visible
reactions. No polling, no event listeners, no separate state.

The most important variable is `--d` — the canonical raw live density reaction. (`--d` is reliable;
`--field-density` can be overwritten by Field Pattern metric output.)

```html
<article data-body="attract" data-feedback>
  Important content
</article>
```

```css
[data-feedback] {
  --d-amp: clamp(0, calc(var(--d, 0) * 12), 1);
  transform: translateY(calc(var(--d-amp) * -8px));
  opacity: calc(0.6 + var(--d-amp) * 0.4);
}
```

That is the platform-native trick. The engine does not need to own your DOM rendering. It writes
meaningful pressure into CSS. Your design system decides how to express it.

## Signals-first is the killer feature

The field does not need to render. The default render mode is `none`: no canvas, no particles, but the
full simulation still runs and writes CSS variables to `[data-feedback]` elements.

If a developer thinks this is a particle library, they will miss the point. The stronger framing:

```txt
Fundamental is a semantic pressure system. The DOM is the first host, not the boundary.
It can render nothing and still drive the interface.
```

A particle render is one projection. CSS variables are another. SVG overlays, typography, events, and
accessibility equivalents are others. The field is the behavior layer underneath all of them.

## Body Matter Interaction and `sink`

The `sink` model is the clearest example of how the whole system works. A sink body captures field
matter, holds it, exposes its load, and releases the same matter when saturated. `sink` is the only
capture token; `data-absorb` is the capture radius, `data-max` the capacity, and `--load` the fill
fraction.

```txt
The element absorbs field matter.
The visual layer shows what that absorption means.
The semantic text remains the source of meaning.
```

This is how text/vector binding should be explained:

```txt
Semantic HTML owns meaning.
The field body owns participation.
The visual layer owns expression.
The visual never becomes the body.
```

```html
<h1 id="title" data-body="sink attract" data-absorb="72" data-max="36" data-feedback>
  Contour Field
</h1>

<svg data-field-visual-for="title" data-field-visual-role="representation" aria-hidden="true" focusable="false">
  ...
</svg>
```

The `h1` is meaning. The field state is behavior. The SVG is expression.

## Body authority modes

Not every body is physically dynamic. There are three body-authority modes:

```txt
Anchored Body
  DOM rect is authoritative. The body is a stable source, boundary, or infinite-mass reference.

Kinematic Body
  The engine writes transforms. The DOM object moves visually, but motion is platform-mediated.

Dynamic Body
  The engine owns position, velocity, and possibly mass. DOM measurement initializes or constrains,
  but does not fully define state.
```

The current default is **Anchored Body** (`element.getBoundingClientRect()`). This is not a flaw — it is
what makes the system safe for real interfaces. A button should not recoil away from its layout by
default; a claim card should not drift out of the document just because it is semantically heavy.
Anchored bodies are correct for most UI. Dynamic bodies are for opt-in natural modes: recoil, momentum,
torque, physical conservation. Kinematic sits between: transform output without giving up DOM coherence.

## What changes for a developer

A normal developer writes `<button class="primary">Continue</button>` and then manages hover, focus,
scroll, validation, and state transitions manually. A Fundamental developer can write:

```html
<button data-body="attract" data-strength="1.2" data-range="280" data-feedback>
  Continue
</button>
```

Now the button participates in a shared field. It can gather density, affect nearby elements, expose
`--d`, trigger threshold events, and be understood by diagnostics.

```html
<!-- an error field -->
<label data-body="charge attract" data-strength="1.4" data-feedback>
  Email is required
</label>

<!-- a sink -->
<section data-body="sink attract" data-absorb="64" data-max="30" data-feedback>
  Evidence cluster
</section>

<!-- a relationship -->
<p id="claim" data-body="attract" data-feedback>The claim</p>
<cite data-field-relation="supports" data-field-target="#claim">Source</cite>
```

The relationship does not have to create force by itself. A Field Pattern decides whether `supports`
maps into cohesion, confidence, density, topology, or nothing visible.

## Why this changes things

Fundamental changes the **unit** of interface behavior — from `component state` to a **Field
Formation**. Behavior can emerge from relationships instead of being manually scripted. A navigation
weighted by section importance; a form that shows coherence as it completes; a research document where
evidence, contradiction, and confidence are spatial; a dashboard that reveals anomaly pressure before
anyone reads a number; a collaborative document that shows co-presence as density; an article that
accumulates memory where a reader lingers; a design system that reacts to semantic pressure without
rendering a single particle.

```txt
State becomes spatial.
Meaning becomes measurable.
Relationships become active.
Feedback becomes native CSS.
Diagnostics make cause visible.
Accessibility remains part of the contract.
```

That combination is rare.

## The horizon

The most important future work is not "add more forces." The horizon is **restoring collapsed
dimensions:**

```txt
3D / depth
time
orientation / rotation
```

The designed-vs-natural map calls out missing rotation, angular momentum, and torque as a collapsed
dimension. The roadmap reads:

```txt
First, stabilize the force contract.
Then, make integration more physically honest.
Then, decide body authority modes.
Then, wire opt-in recoil and momentum.
Then, restore dimensions: depth, time, orientation.
Then, add projection systems so those dimensions are visible and accessible.
```

Each restored dimension follows the same rule:

```txt
orthogonal by default
associated freely
coupled explicitly
projected accessibly
diagnosed inspectably
```

## The practical developer rules

```txt
1.  Do not treat Fundamental as a particle effect.
2.  Start with semantic HTML.
3.  Add data-body only where an element should participate in the field.
4.  Add data-feedback when the element should receive CSS variables.
5.  Use --d for raw live density.
6.  Use --load for sink fill.
7.  Use --field-<metric> for Field Pattern metrics.
8.  Keep relationships non-causal unless a Field Pattern maps them into force.
9.  Keep field() and apply() separate.
10. Diagnostics explain behavior; they do not mutate it.
11. Render surfaces are optional.
12. Accessibility is part of the behavior contract, not a fallback afterthought.
```

## The one-sentence version

```txt
Fundamental turns semantic interfaces into inspectable fields: dimensions hold state, fields describe
structure, forces create coupling, agents consume influence, metrics expose what changed, diagnostics
explain why, and projections make the invisible visible without replacing the DOM.
```

## The developer pitch

```txt
You are not wiring animations.
You are authoring a field of meaning.

The DOM remains semantic.
The field becomes behavioral.
CSS becomes the projection layer.
Diagnostics reveal cause.
Field Patterns decide how relationships become force.

That is why this is different.
```
