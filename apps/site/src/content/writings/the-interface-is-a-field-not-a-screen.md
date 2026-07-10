---
title: "The Interface is a Field, Not a Screen"
description: "An interface is less a screen of components than a field of relationships — priority, polarity, binding, decay — and Fundamental makes that field runnable, inspectable, and measurable."
summary: "The manifesto: why an interface is a shared field of meaning, not a pile of components, and what it costs to make that field real."
date: 2026-06-26
category: feature
author: "Zach Shallbetter"
draft: false
---

# The Interface is a Field, Not a Screen

An interface is less a screen of components than a field of relationships — priority, polarity,
binding, decay — and Fundamental makes that field runnable, inspectable, and measurable.

Most software treats an interface as a collection of objects.

A button is a button. A card is a card. A tooltip is a tooltip. Each component owns some local
state, responds to a few events, and changes appearance when something happens. Hover. Focus.
Selected. Open. Disabled. Loading. Error.

That model has served the web for a long time. It gave us components, design systems, reusable
patterns, and an enormous ecosystem of frameworks. But it also gave us a narrow idea of what
interface behavior can be.

In most interfaces, relationships are implied but not felt. Attention is guessed at but not
modeled. Memory is reduced to visited links or recent items. Motion is added as a transition after
the fact. State is treated as a set of toggles. A component changes because its internal value
changed, not because the interface around it exerted meaning.

That is the paradigm Fundamental challenges.

Fundamental begins with a different assumption: an interface is not a pile of components. It is a
shared field of meaning.

Every document, application, dashboard, editor, form, and AI interface already contains invisible
forces. Some things matter more than others. Some things are related. Some things conflict. Some
things decay. Some things pull attention. Some things hold together. Some things become unstable.
Some things leave memory. Some things should flow from one place to another.

Today, we usually express those relationships through layout, color, hierarchy, state flags, and
occasional animation. Fundamental makes them explicit. It gives those invisible relationships a
runtime — not as decoration, as behavior.

## The old model: components with local state

Most modern UI architecture is component-local.

A component receives props. It stores state. It renders markup. It emits events. Styling responds
to classes, data attributes, pseudo-states, and design tokens.

This model is efficient, predictable, and familiar. But it is also limited. It is very good at
describing what a component *is*. It is much weaker at describing what a component *means in
relation to everything else*.

A form field can know it is invalid. But does the form know it is unstable?

A citation can link to a source. But does the interface know how strongly that source supports the
claim?

A dashboard card can show an alert. But does the page know that the entire system is heating up?

A search result can be ranked. But does the interface let relevance behave like gravity?

A section in a long article can be visible. But does the page remember where the reader paused,
skimmed, returned, and became oriented?

Most interfaces do not model those conditions. They approximate them through one-off logic. A
badge here. A red border there. A spinner. A toast. A motion effect. A class name. The result is
often functional, fragmented, and somewhat bland.

Fundamental proposes a different model. Instead of asking every component to invent its own
behavior, it creates a shared field context. DOM elements, particles, relationships, measurements,
metrics, events, visual layers, and user interactions can all participate in that context. The
interface becomes a medium.

## The new model: a relational field runtime

Fundamental is a platform-native relational field runtime; on the web, that means the DOM. The
phrase is precise.

*Platform-native* means it starts with the web platform: semantic HTML, CSS custom properties, DOM
events, Custom Elements, Shadow DOM, Canvas, SVG, observers, and progressive enhancement.

*Relational* means it cares about how things influence one another, not only what they are in
isolation.

*Field runtime* means the system runs a shared context where bodies emit influence, agents
respond, metrics accumulate, diagnostics explain, and feedback returns state to the DOM.

The traditional loop looks like this: state changes, the component re-renders, a class changes,
the style changes, an animation plays.

Fundamental changes the loop:

- DOM elements register as bodies
- the platform measures them
- the core computes field behavior
- agents respond to influence
- metrics accumulate
- feedback writes state back to the DOM
- render layers reveal invisible structure
- diagnostics explain what happened

This is the central break. The interface no longer behaves as disconnected elements with local
reactions. It behaves as a shared system with continuous, relational state.

And in the current engine, that state runs whether or not anything is drawn. The defining shift in
0.8 is that [`render: 'none'` is the default](/writings/render-none-the-invisible-field): the field
measures, computes, accumulates metrics, and writes feedback back to the DOM while rendering
nothing at all unless you opt into a visual layer. The simulation is the product; the particles
are optional. A page can run a full field — priority, relationships, decay, the whole loop — and
surface it only as type, ink, and state, with no swarm on screen.

A component can still be a component. A button is still a button, a link is still a link, a
heading is still a heading. Semantic HTML remains the source of meaning. But now those elements
can also participate in fields. They can carry mass, polarity, memory, attention, heat, coherence,
entropy, pressure, relationships, and feedback. They can influence particles, overlays, visual
state, and one another. They can be inspected. They can explain why they are changing.

That is the shift: from interface as rendered screen to interface as explainable field.

## Why this is not just animation

Animation libraries answer an important question: how should something move from one state to
another?

Fundamental asks a different one: why should something move, brighten, bind, cool, decay, resist,
or attract in the first place?

Animation is usually applied after state changes. Fundamental makes behavior caused. Motion is not
a layer of polish; it is an expression of an underlying relationship. A card draws nearby
attention because it has priority. A source binds to a claim because it supports it. A route emits
a stream because it carries the user's path. A warning heats up because instability is
accumulating. A completed step releases pressure because a process has stabilized.

In a conventional interface, a designer adds a hover effect to a card because it feels responsive.
In Fundamental, a card becomes responsive because the user's attention field is approaching it. A
designer animates a success state because completion should feel satisfying. In Fundamental,
completion is modeled as a release of pressure and a transition into memory. The animation is not
the idea. The field is.

## Why this is not just a physics engine

Fundamental uses physics language, but it is not trying to turn web pages into literal physical
simulations.

A game physics engine simulates matter: rigid bodies, collisions, gravity, constraints, motion.
Fundamental translates meaning into field behavior, which is a different thing. A particle can
respond to gravity — but so can attention. A relationship can carry tension. A citation can carry
signal. A section can accumulate memory. A form can become coherent. A warning can decay. An AI
claim can be pulled toward or away from trust depending on its evidence.

The system is not simulating a world inside the interface; it is giving the interface itself a
physical grammar. That grammar is useful because interfaces already contain relationships that
feel field-like: priority pulls, contradiction repels, evidence supports, groups bind, state
decays, attention accumulates, signals propagate, memory fades. Fundamental makes those relations
explicit.

## The four natural fields as interface grammar

One of the strongest ideas in Fundamental is the Natural Field Translation System. It does not
treat "natural forces" as a flat list of effects. It starts from the four fundamental fields —
gravity, electromagnetic, strong, and weak — and translates each into interface behavior:

- **Gravity** becomes priority, convergence, hierarchy.
- **Electromagnetism** becomes polarity, signal, field lines, flow.
- **Strong interaction** becomes binding, cohesion, structure.
- **Weak interaction** becomes transformation, decay, release.

This is not a physics skin. It is a [compression system](/writings/your-design-system-already-has-four-forces).

Every interface has priority — some things matter more than others. That is gravity. Every
interface has polarity — some states agree, oppose, activate, contradict, or signal. That is
electromagnetic behavior. Every interface has binding — labels belong to inputs, citations to
sources, cards to groups, claims to evidence. That is strong interaction as an interface analogue.
And every interface has transformation — drafts become published, notifications expire, errors
resolve, data grows stale, attention fades. That is weak interaction as an interface analogue.

That is what makes the model unusually compact. Instead of inventing a new metaphor for every kind
of interface behavior, Fundamental says: priority, polarity, binding, and transformation already
exist in every interface; physics already gives us a language for those relations; Fundamental
translates that language into DOM behavior. That is why the approach feels close to inevitable.

The discipline that keeps it from collapsing is one line: **natural fields are not tokens; tokens
are translations.**

The engine exposes a catalog of 36 forces — nine canonical, eight natural-field translations, and
nineteen extended — along with presets that compose them. Names like gravity, charge, magnetism,
thermal behavior, collision, diffusion, propagation, memory, cohesion, and link sit in that
catalog, but not all of them are first-class forces, and a few are not forces at all so much as
derived behaviors. They are translations. Gravity is both a natural field and an engine primitive.
Charge and magnetism are electromagnetic expressions. Thermal behavior is derived energy behavior.
Collision is contact mechanics. Diffusion is scalar transport. Memory is a persistence metric.
Cohesion and links are strong-field analogues. Decay is a weak-field analogue, and a phase change
is the behavior beneath it. `fieldflow` is transport along field structure — a derived steering
behavior, not a fundamental field — and `morph` is its cousin in the extended set. The point is
not the exact roster but the discipline: the catalog is a set of translations, and the four
natural fields underneath it are what stay fixed.

That keeps the system honest, and it preserves the critical distinction between designed interface
forces and physically coherent primitives. `attract` is a designed UI well, not literal gravity;
`repel` is a designed separation behavior, not literal charge. `charge` belongs to electromagnetic
behavior. `magnetism` bends moving charged matter. `fieldflow` carries matter along field
structure. The rule is simple: **electric fields push, magnetic fields bend, fieldflow carries.**

That clarity is not pedantry but leverage: it is what lets the system produce plasma-like,
solar-prominence behavior without corrupting magnetism into a field-line-following effect.
Magnetism stays honest: it bends. `fieldflow` handles transport. The durability of the system
lives in that kind of distinction.

## The DOM becomes reciprocal

Traditional DOM styling is mostly one-directional. The application sets state, the DOM reflects
it, CSS styles it, JavaScript listens for events and updates state again.

Fundamental makes the loop reciprocal. A DOM element can become a body. That body can emit a field
or apply force. The field can influence particles, overlays, relationships, and other bodies. The
system measures density, attention, memory, heat, entropy, coherence, or pressure, and those
metrics write back to the DOM as CSS variables, custom states, and thresholded events.

The element does not just receive styling. It participates. A heading can pull attention. A
section can accumulate reading memory. A citation can bind to a source. A card can heat up because
its data is volatile. A form can become coherent as its parts validate. A claim can become
unstable because its evidence conflicts.

The DOM becomes both semantic and active — and it does so without abandoning HTML. The semantic
layer remains the source of truth. Canvas, SVG, particles, overlays, and motion remain render
layers; they clarify meaning, they do not become the only source of it. That is one of the reasons
the system matters: it is expressive without abandoning accessibility.

## The platform layer: what the browser does not give us yet

The web already has the raw materials — HTML, CSS variables, DOM events, Custom Elements, Shadow
DOM, ResizeObserver, IntersectionObserver, MutationObserver, Canvas, SVG, animation APIs. What it
does not yet have are native primitives for the relational behavior Fundamental needs.

The DOM is a tree, but interfaces are graphs. Elements have geometry, but measuring them safely
across frames, transforms, scroll containers, and Shadow DOM boundaries is tedious. ARIA can
express some relationships, but it is not a general relationship graph. CSS custom properties can
carry state, but they are string-based and not a complete metric system. Canvas and SVG can render
visuals, but pairing those visuals back to semantic sources is still manual.

Fundamental fills that gap through a platform layer that owns the browser-facing reality:

- **MeasurementRegistry** snapshots DOM geometry.
- **StateRegistry** holds field metrics and semantic-adjacent state.
- **FeedbackRegistry** writes CSS variables, custom states, and thresholded events.
- **RelationshipRegistry** normalizes links, ARIA relationships, labels, controls, citations, and
  data-field relationships into one graph.
- **VisualBindingRegistry** keeps expressive visual layers tied to semantic sources.
- **OverlayRegistry** renders relationship lines, diagnostic layers, and field lines without
  making those visuals the only meaning.
- **FrameScheduler** keeps the lifecycle disciplined, in fixed phases: discover, read, compute,
  state, write, render.
- **lintPlatform()** reports the quiet failures — a relationship pointing at nothing, a visual
  with no semantic source, a measurement taken in the wrong phase.

That phase separation matters. DOM reads and writes create performance problems when they are
interleaved carelessly, so Fundamental treats measurement as a read-phase responsibility and
feedback as a write-phase responsibility. The result feels less like a library bolted onto the
page and more like the web platform grew the missing feature.

## The portable core

Fundamental also separates core behavior from browser reality. The core engine owns field math,
force behavior, particles, diagnostics, metrics, and conformance — and it does not know about
`window`, `document`, browser events, or DOM measurement. The platform provides the browser host.

- `@fundamental-engine/core` computes field behavior.
- `@fundamental-engine/dom` binds field behavior to DOM participation.
- `@fundamental-engine/elements` exposes native HTML authoring.
- `@fundamental-engine/react` adapts the same contracts for React.
- `@fundamental-engine/vanilla` mounts a field in plain TS or JS, no framework.
- `@fundamental-engine/three` drives a particle swarm in a Three.js or WebGL scene.

This is what keeps Fundamental from being just another browser-only visual effect. The same core
ideas already run beyond the page: `@fundamental-engine/three` drives the field as a particle
swarm in a Three.js or WebGL scene, `headlessHost()` runs the full simulation with no `document`
at all, and the Swift and Kotlin ports run the same field natively — on Apple platforms with Metal
and SwiftUI, and on Android and the JVM with Jetpack Compose — each with its own Field Lab. The
DOM integration is native; the field model is portable. DOM, WebGL, headless, and the native ports
are [one engine, many runtimes](/writings/one-engine-four-runtimes). That combination is unusual —
and, importantly, it is no longer a promise but a shipped surface. Underneath, the core is
provably free of the browser: a boundary test passes with an empty allowlist, which means no core
file reaches for a DOM global, which means the engine computes with no document present at all.

## Recipes: the practical bridge

A system like this becomes useful when the theory turns into recipes. A recipe is not an example
animation. It is a reusable field program. It describes intent, the natural-field translation, the
engine primitives, the required bodies, the relationships, the metrics, the feedback, the
diagnostics, and — required, not optional — a reduced-motion equivalent.

- A **Priority Well** uses gravity. It makes important elements feel weighted — search results,
  dashboard alerts, hero calls to action, active navigation.
- A **Signal Path** uses electromagnetic behavior. It shows information flowing through citations,
  dependencies, routes, onboarding steps, or AI evidence.
- A **Relationship Bond** uses strong interaction. It keeps related elements connected: a label
  and an input, a citation and a footnote, a card and its detail panel, a claim and its source.
- A **Decay Notice** uses weak interaction. It lets stale, temporary, or completed states release
  gracefully instead of vanishing abruptly.
- A **Reading Field** uses gravity, memory, and relationships. It turns a scrollable page into a
  readable field: sections near the viewport center gain attention, dwelled sections accumulate
  memory, citations reveal relationships, the table of contents becomes a memory map.
- An **Evidence Field** uses electromagnetic and strong behavior. Claims become bodies, sources
  become supports, contradictions create repulsion or entropy, verified claims become coherent.
- A **Coherence Field** uses strong interaction and metrics. A form, workflow, or dataset becomes
  more stable as its parts align — invalid pieces create pressure or entropy instead of just
  throwing red borders at the user.

A **Field Contract Preview** lets designers and engineers inspect what a recipe will register,
measure, write, render, and announce before they enable it. The recipes are the bridge between
natural-field grammar and interface design — and the place the conceptual load is meant to
disappear behind a named intent.

## Example: a normal content page

A long article or documentation page is the best example, because it proves Fundamental is not
dependent on spectacle.

A normal page already has structure: headings, sections, paragraphs, citations, links, code
blocks, examples, a table of contents. Traditional interfaces treat most of that as static
content — maybe the current heading is highlighted, maybe a scroll progress bar appears.

Fundamental can treat the page as a Reading Field. The viewport center becomes an attention well.
Sections gain attention as the reader dwells. Read sections accumulate memory; skimmed sections
get less; returned-to sections strengthen. Citations bind to footnotes and sources. Related
concepts gain secondary emphasis. The table of contents becomes a field map instead of a static
list.

The page still feels like a page. No particles flying everywhere, no scroll-jacking, no dramatic
motion — the field exists to clarify reading, not to perform. In reduced-motion mode the same
behavior is expressed through static section rails, table-of-contents marks, relationship badges,
and citation highlighting. That is the point: an ordinary content page becomes more legible
without becoming less accessible. (You can read this one running live — it is the
[demo at /docs/reading-field](/docs/reading-field), an ordinary article wired to the field, not a
particle showcase.)

## Example: AI evidence

AI interfaces need a better way to express uncertainty. A generated answer is not just text; it
contains claims, sources, confidence, contradictions, corrections, and risk. Traditional UI
represents those with citations, badges, warnings, and maybe a confidence score.

Fundamental can model the answer as an [Evidence Field](/evidence). Claims become bodies. Sources
bind to claims. Strong support increases coherence. Contradictions create repulsion or entropy.
Unsupported claims stay unstable. User corrections overwrite memory. Verified claims settle;
riskier claims heat up. Causality diagnostics can show which source or primitive drove the state.

The interface can answer questions a footnote marker cannot: why is this claim emphasized, which
source supports it, which contradicts it, what changed after the user corrected it, why is this
section unstable. That is a different kind of AI interface — not generated text with links
attached, but an inspectable field of evidence. (One honest limit, stated plainly: it visualizes
the evidence the host supplies. It does not adjudicate truth.)

## Example: forms and coherence

Most forms communicate problems through blunt signals — red borders, error messages, disabled
buttons.

Fundamental can model a form as a Coherence Field. Each field contributes to the stability of the
whole. Valid fields bind into structure. Missing fields create gaps. Contradictory fields create
entropy. High-risk actions add pressure. Completion releases that pressure and leaves memory.

The user does not need a form that shakes or flashes. They need a form that shows what is stable,
what is missing, what is blocking completion, and why. The submit button does not simply become
enabled; it becomes the point where coherence resolves. The interface gets calmer, not louder.

## Example: dashboards as weather

Dashboards overload users with numbers, cards, alerts, filters, and charts.

Fundamental can turn dashboard state into Attention Weather. Cards and metrics develop heat,
pressure, density, and gravity. Calm systems stay quiet. Volatile systems heat up. Critical items
gain gravitational priority. Related alerts bind. Stale data cools. Resolved issues decay into
memory.

The user reads the system like weather — calm, dense, turbulent, charged, stable, overloaded. That
is not decoration; it is a way to surface urgency and relation without making every card scream.

## Explainable interaction

The most important difference may be inspectability. Fundamental should be able to explain every
visible behavior. Why did this move? Why did this brighten? Why are these connected? Why is this
warning heating up? Why did the page calm down? Why did this source increase confidence?

The answer should trace to a field cause — a relationship, a measurement, a primitive, a metric,
a threshold, a recipe, a diagnostic. That is very different from most UI systems, where the honest
answer is usually "because a component added a class." Fundamental can expose topology, causality,
prediction, energy, potential, contours, velocity vectors, field lines, heatmaps, overlays, and
platform registry state. The system does not just behave. It can show why — and the diagnostics
that reveal it never feed back into the physics they depict, so looking at the field cannot
change it.

## Accessibility is not an afterthought

Because Fundamental is so visually expressive, accessibility has to be part of the architecture.
The rule is direct: **no field behavior may be the only source of meaning.**

Canvas and SVG layers are visual surfaces. They may clarify, amplify, and represent state, but
semantic HTML stays the source of meaning. Motion must have reduced-motion equivalents: particles
become static field lines, trails become memory marks, motion emphasis becomes outline or weight
or tone or contrast, relationship pulses become persistent threads, heat blooms become badges or
rails.

That is why the VisualBindingRegistry exists — to keep expressive visual layers tied to semantic
sources — and why linting matters: it can warn when a visual layer lacks a semantic source, or an
interactive overlay lacks an accessible equivalent. The goal is not to make interfaces more
animated. It is to make state more legible.

## Why now

The web platform is ready for this. We have semantic HTML, CSS variables, Custom Elements, Shadow
DOM, Canvas and SVG, observers, increasingly capable CSS, and enough runtime headroom to manage
measurement, feedback, and overlays responsibly.

And interfaces are becoming more relational at the same time. AI interfaces need evidence,
uncertainty, memory, correction, and confidence. Documentation needs orientation and concept
relationships. Dashboards need urgency and system state. Collaboration tools need presence,
handoff, and conflict. Editors need constraints and semantic snapping. Forms need coherence.
Search needs relevance and memory. The component-state model still matters, but it does not
describe any of that well. Fundamental fills the missing layer — it does not replace components,
it gives them a field to live inside.

## What it costs

None of this is free, and a field that hides its own costs would be exactly the kind of dishonest
interface Fundamental is supposed to replace. So, plainly:

**It is more to learn.** A designer who just wants the important card to stand out now has a
richer vocabulary to hold — priority, polarity, binding, decay — and a heavier one than color and
spacing. The recipes exist to hide that load behind named intents. The load is still real.

**It is more to run.** Measuring every body every frame and writing state back to the DOM is work
the browser was not doing before. The scheduler separates reads from writes so it does not thrash
layout, and on desktop the overhead is small — the heaviest page, dozens of live fields at once,
holds the display's full refresh rate with no dropped frames. (When a visible field does get slow,
[the cost that bites is fill rate, not particle math](/writings/the-field-is-fill-rate-bound).)
That is desktop, though; a flat, simple interface still may not earn the cost, and a low-power
phone is the case left to measure.

**It can be over-engineering.** The model pays off where an interface has latent relational
structure — long documents, evidence, dashboards, graphs. On a login form with two fields, a field
is spectacle. The honest rule is to reach for it where relationships already exist and are going
unexpressed, not everywhere.

**Accessibility is more work, not less.** "No field behavior may be the only source of meaning" is
a promise that has to be kept for every behavior, every time — a reduced-motion equivalent for
each effect, a semantic source behind each visual. The architecture enforces it with linting, but
enforcement is a cost, not a gift.

**There is a [silent contract gap](/writings/the-silent-contract-gap).** The engine faithfully
writes `--load`, `--field-*`, and `--d` onto bodies every frame — but nothing forces a CSS rule to
read them. A body can be reacting hard and look completely inert because no rule downstream
consumes the variable. The field is not broken; it is reacting invisibly — which is exactly what
you asked for and exactly what bites you. Linting catches one half of the gap; discipline catches
the other.

**And the honest one: it is early.** The packages are published — 0.9.4 is live on npm, and the
[road to 1.0](/writings/the-road-to-1-0) tracks the release gates that still stand — but it is a
0.x preview, a substrate to build on, with no outside users yet. And there is no user study — the
claim that a reading field helps you orient, or that an evidence field calibrates trust rather
than manufacturing it, is a hypothesis with a protocol behind it, not a measured result.

What there is, in place of a study, is something you can check. The Reading Field runs on an
ordinary content page. The core is provably free of the browser. The diagnostics are live; you can
ask the running interface why it did what it did. The vaporware question is fair, and the answer
is not a promise — it is a thing you can open.

## What changes

So the model changes what people can work with.

Designers get more than color, type, layout, spacing, variants, and transitions; they can design
priority, polarity, binding, decay, flow, coherence, entropy, pressure, memory, signal, and
causality. Engineers get more than props, state, classes, and event handlers; they can implement
bodies, relationships, metrics, registries, feedback channels, diagnostics, and recipes. And users
get more than response. They get context — an interface that can be calmer because state no longer
has to be shouted, where relationships are visible without clutter, motion is meaningful because
it has cause, and attention is legible because it is modeled.

Four fields. Many expressions. One DOM runtime.

That is the whole claim, and it does not add a feature to the existing UI paradigm. It changes
what an interface is allowed to be.

## Related reading

- [Meaning Should Have Behavior](/writings/meaning-should-have-behavior) — the companion argument: conservation, accountability, and receipts.
- [render: 'none' — The Invisible Field Is the Baseline](/writings/render-none-the-invisible-field) — where the invisible-forces idea becomes the engine default.
- [Your Design System Already Has Four Forces](/writings/your-design-system-already-has-four-forces) — the designer on-ramp to the four natural fields.
- [One Engine, Four Runtimes](/writings/one-engine-four-runtimes) — how a zero-DOM core ports to WebGL, headless, and native.
- [The Empty Canvas That Costs Every Frame](/writings/the-empty-canvas-that-costs-every-frame) — the compositing trap behind the fill-rate rule.
- [The Field Translation Runtime](/writings/01-field-translation-runtime) — the formal paper behind this manifesto.
- [Evidence Fields](/writings/03-evidence-fields) — the AI-trust case where binding strength carries meaning.
- [Concepts](/docs/concepts) — the naming canon: concepts, tokens, metrics, diagnostics, recipes.
