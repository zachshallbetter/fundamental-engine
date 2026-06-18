# Fundamental: What It Is

> Elements bend the field. The field bends them back.

> **Vocabulary note (concepts vs runtime tokens).** This is an explainer, so it uses concept
> language. Real runtime tokens are the 34 in the [forces catalog](../engine-reference/forces-system.md);
> concept words map to them — `spring→tether`, `vortex→swirl`, `drag→viscosity`, `emitter→spawn`,
> `reflect→wall`, `absorb→sink`, `phase`/`decay`→`morph`/`memory`. `mass` is a metric and `potential`
> a diagnostic, not tokens; `fuse`/`fission`/`warp` are not implemented. See the lane discipline in
> [authoring-and-recipes.md](../canonical/authoring-and-recipes.md) §5.

Most interface effects are local.

A component changes state. A class changes. A transition plays. A card lifts. A button glows. A panel slides in.

That model works, but it treats behavior as something each component owns by itself.

Fundamental starts from a different assumption:

```txt
An interface is a shared field of meaning.
```

The page is not placed on top of an animation. The page participates in a field.

Words, links, cards, controls, sections, citations, claims, sources, data records, visual layers, and user interactions can become field participants. They can pull, repel, bind, heat, cool, decay, remember, signal, and explain why they changed.

This is not a particle background.

This is a relational behavior runtime for the DOM.

## The one idea: reciprocity

The whole system is a reciprocal loop.

```txt
DOM -> field -> DOM
```

### DOM to field

An element can become a body.

A body can influence particles, relationships, overlays, metrics, and other agents.

```html
<a
  data-body="attract"
  data-strength="0.9"
  data-range="320"
  data-feedback
>
  Learn more
</a>
```

That link is still a link.

It remains semantic HTML. It can still be selected, focused, read by assistive technology, styled by CSS, and handled by the browser.

But it also participates in the field.

It can attract matter. It can gather density. It can receive feedback. It can become part of a larger relational system.

### Field to DOM

The field can write measured state back to the DOM.

```css
.card {
  opacity: calc(0.7 + var(--field-attention, 0) * 0.3);
  box-shadow: 0 0 calc(var(--field-density, 0) * 18px) currentColor;
}
```

When attention, density, memory, heat, or coherence accumulates around an element, that state becomes available to CSS, events, custom element state, diagnostics, and overlays.

The element does not merely receive decoration.

It receives measurable feedback from the field it helped shape.

## Why this is different

A normal animation system says:

```txt
When state changes, animate from A to B.
```

Fundamental says:

```txt
State exists inside a field.
Relationships create influence.
Agents respond.
Metrics accumulate.
Diagnostics explain.
Feedback returns to the DOM.
```

That is a different paradigm.

The question changes from:

```txt
What animation should this component play?
```

to:

```txt
Why is this element being emphasized?
What is pulling attention?
Which relationship is active?
What caused this state?
What should persist as memory?
What should decay?
What should bind?
What should flow?
```

Fundamental is not only about making interfaces move.

It is about making interface behavior caused, measurable, inspectable, accessible, and composable.

## Canvas is one surface, not the system

Earlier field prototypes were easy to describe as one canvas behind the page.

That is no longer enough.

Canvas is one render surface.

SVG overlays are one render surface.

DOM feedback is one render surface.

Diagnostics are one explanation surface.

The system is the shared field context that connects them.

The current architecture is:

```txt
Fundamental   host-driven, renderer-agnostic field engine
@fundamental-engine/dom   browser host, DOM participation, measurement, state, feedback,   relationships, visual bindings, overlays, scheduling, linting
@fundamental-engine/elements   native HTML and web component authoring
@fundamental-engine/react   React adapter over the same contracts
```

The core computes field behavior.

The platform binds that behavior to the DOM.

The elements package gives authors native HTML surfaces.

React adapts the same contracts.

The field is larger than the canvas.

## Anatomy of a body

A body is any participant the field can understand.

A body may be:

```txt
a DOM element
a custom element host
a text section
a card
a control
a citation
a data record
a relationship endpoint
a visual layer
a virtual body
```

The simplest authoring surface is still plain HTML:

```html
<section
  data-body="gravity"
  data-strength="0.8"
  data-range="420"
  data-field-role="concept"
  data-feedback
>
  <h2>Natural Fields</h2>
  <p>Gravity becomes priority. Electromagnetism becomes signal.</p>
</section>
```

Common attributes:

| Attribute | Meaning |
|---|---|
| data-body | the behavior tokens the body participates in |
| data-strength | how strongly the body influences the field |
| data-range | how far the body reaches |
| data-feedback | enables field to DOM write-back |
| data-field-role | semantic field role, such as concept, source, claim, warning |
| data-field-relation | relationship type when the element connects to another |
| data-field-target | relationship target |
| data-intent | author intent used by recipes or runtime classification |

The authoring stays simple.

The system underneath can become sophisticated.

## Particles are only the lightest agents

Particles are useful because they make the field visible.

They show motion. They show density. They show flow. They make invisible structure easier to understand.

But particles are not the whole system.

In Fundamental, a particle is only the lightest kind of agent.

Other agents can include:

```txt
DOM elements
relationships
event sinks
currents
data records
focus
pointer motion
selection
scroll position
collaborator presence
```

A force or field influence can be consumed differently by different agents.

A particle may consume influence as velocity.

A DOM element may consume influence as feedback state, a transform offset, or a threshold event.

A relationship may consume influence as tension or signal.

An event sink may consume influence as a debounced field:* event.

That is how the field can move more than pixels.

It can move state.

## The field can drive behavior

A field participant can emit events when meaningful thresholds are crossed.

```html
<article
  data-body="attract"
  data-feedback
  data-on="dense:field:lit"
>
  ...
</article>
```

The field can dispatch meaningful events such as:

```txt
field:lit
field:dim
field:saturated
field:entered
field:exited
field:density-change
field:captured
field:released
field:threshold
field:recipe-warning
```

Continuous state belongs in metrics and CSS variables.

Discrete transitions belong in thresholded events.

The field should not spam the DOM. It should signal only when something meaningful happens.

## The Natural Field Translation System

The natural model is not a flat list of effects.

It starts from four fields:

```txt
Gravity
Electromagnetic
Strong
Weak
```

Translated into interface behavior:

```txt
Gravity becomes priority, convergence, hierarchy.
Electromagnetism becomes polarity, signal, field lines, flow.
Strong interaction becomes binding, cohesion, structure.
Weak interaction becomes transformation, decay, release.
```

This is the organizing model.

Every interface already has these four conditions.

Some things matter more. That is priority.

Some things agree, oppose, activate, or signal. That is polarity.

Some things belong together. That is binding.

Some things change, expire, resolve, or decay. That is transformation.

Fundamental gives those relations a runtime.

## Natural fields are not tokens

The engine exposes practical primitives.

Examples:

```txt
gravity
charge
magnetism
thermal
collide
diffuse
propagate
memory
cohesion
link
morph
fieldflow
```

(`morph` is the shipped transformation token; `phase`/`decay` are concept words for it.)

But these are not all fundamental forces.

They are translations, derived behaviors, material analogues, metrics, transports, or composites.

The distinction matters.

attract is not gravity. It is a designed UI well.

repel is not charge. It is a designed UI separation behavior.

charge and magnetism are electromagnetic expressions.

memory is a persistence metric.

fieldflow is transport along field structure.

The core electromagnetic rule is:

```txt
Electric fields push.
Magnetic fields bend.
Fieldflow carries.
```

That keeps the system honest.

Magnetism bends moving charged matter. It does not become field-line following.

If you want plasma-like motion along field lines, use fieldflow.

## Designed forces and natural translations

The system has both designed UI forces and natural-field translations.

Designed UI forces are interface verbs. They are bounded, legible, and stable.

Examples:

| Token | Meaning |
|---|---|
| attract | creates a readable pull |
| repel | creates pressure and separation |
| swirl | gathers motion into rotation |
| stream | reveals directional flow |
| viscosity | thickens the medium and slows motion |
| jet | launches or relaunches response |
| tether | creates rest length and structure |
| wall | defines boundary and surface |
| sink | captures, holds, and releases |

Natural translations are used when physical coherence helps the interface.

Examples:

| Token | Natural parent | Meaning |
|---|---|---|
| gravity | Gravity | priority, wells, convergence |
| charge | Electromagnetic | polarity and electric response |
| magnetism | Electromagnetic | curvature and no-work bending |
| cohesion | Strong | binding and local structure |
| morph | Weak | transformation and transition |
| memory | Metric | persistence and return |
| fieldflow | Transport | motion along field structure |

Both layers matter.

The designed layer makes interfaces readable.

The natural layer gives the system coherence.

## Nothing should appear from nowhere

One reason the field feels different from a decorative animation is conservation.

The default field should not constantly create visual matter from nothing.

Particles may be pulled, captured, released, heated, cooled, or reclaimed. Sources may spawn matter only when explicitly budgeted. Sinks may hold matter and release it later.

This makes motion feel like it came from somewhere.

When attention moves, it should feel transferred, not fabricated.

Conservation does not mean every interface must become a literal physics simulator. It means the field should preserve continuity, memory, and cause.

## Words remain words

Do not build essential words out of particles.

Text should remain real HTML text.

Words can receive:

```txt
weight
glow
color
density response
attention response
field bend
relationship highlights
engagement effects
```

But the semantic source remains text.

Particle assembly is better for simple marks:

```txt
periods
dots
dashes
icons
logo marks
chart points
map points
punctuation
```

Rule:

```txt
Words are semantic bodies the field decorates.
Marks are where matter may assemble.
```

If a visual layer turns text into SVG or Canvas geometry, the semantic text must remain available to assistive technology.

## Relationships become active material

The DOM is a tree.

Interfaces are graphs.

A heading relates to a section. A citation relates to a source. A label relates to an input. A claim relates to evidence. A warning relates to a field. A route relates to a destination.

Most interfaces represent relationships passively.

Fundamental can make them active.

A relationship can have:

```txt
strength
tension
memory
confidence
direction
source
active state
```

A relationship can pull, resist, decay, strengthen, route signal, carry memory, and appear in diagnostics.

Example:

```html
<a
  href="#source-1"
  data-field-relation="supports"
  data-field-target="#claim-1"
>
  Source
</a>
```

Now the source does more than link.

It can participate in an Evidence Field.

It can bind to a claim.

It can affect confidence.

It can appear in topology and causality diagnostics.

## Recipes turn the field into product patterns

A recipe is a portable field program.

It connects:

```txt
intent
natural-field translation
engine primitives
DOM bodies
relationships
metrics
feedback
diagnostics
accessibility equivalent
```

Examples:

### Priority Well

Natural field: Gravity

Use for search results, hero calls to action, active navigation, important dashboard cards.

The important element gains weight. Nearby matter and attention converge. Reduced motion can show the same priority through tone, border, weight, or ranking.

### Signal Path

Natural field: Electromagnetic

Use for citations, dependencies, route flows, onboarding steps, AI evidence.

A signal travels through declared relationships. Reduced motion can show a static path, numbered route, or persistent connector.

### Relationship Bond

Natural field: Strong

Use for cards and details, labels and inputs, citations and sources, related concepts.

Related elements hold together through visible or invisible bonds.

### Decay Notice

Natural field: Weak

Use for temporary states, stale data, completed actions, expiring notifications.

A state releases instead of disappearing abruptly.

### Reading Field

Natural fields: Gravity + Memory + Relationships

Use for long-form documents, tutorials, reports, legal documents, research pages.

Sections gain attention near the viewport center. Dwelled sections accumulate memory. Citations and related concepts become visible relationships.

### Evidence Field

Natural fields: Electromagnetic + Strong

Use for AI answers, research notes, legal claims, source-backed documents.

Claims become bodies. Sources bind to claims. Contradictions create charge. Verified claims gain coherence.

Recipes are how Fundamental becomes authorable.

They turn field theory into practical interface patterns.

## Diagnostics make the system trustworthy

The field should be able to explain itself.

It should answer:

```txt
Why is this moving?
Why is this emphasized?
Why are these connected?
What caused this warning?
What accumulated here?
Which source supports this claim?
Which recipe wrote this variable?
What happens in reduced motion?
```

Diagnostic surfaces can include:

```txt
field lines
potential energy contours
velocity vectors
force vectors
topology
causality
prediction
inspector
memory heatmap
relationship overlay
platform inspector
```

Diagnostics are not extra polish.

They are part of the trust model.

A system this expressive must be inspectable.

## Accessibility is part of the contract

The field must never be the only source of meaning.

Canvas, SVG, particles, and overlays can reveal, clarify, and amplify. They cannot replace semantic HTML.

Reduced motion must preserve meaning.

Examples:

| Motion behavior | Reduced-motion equivalent |
|---|---|
| particle trail | static memory mark |
| fieldflow ribbon | path contour |
| orbit | grouped related items |
| heat bloom | tone, badge, or status rail |
| relationship pulse | persistent thread |
| prediction path | next-step marker |

Rules:

```txt
No field behavior may be the only source of meaning.
Visual layers need semantic sources.
Interactive overlays need semantic equivalents.
Motion-heavy recipes need reduced-motion behavior.
ARIA should describe real semantic state, not decorative density.
```

Accessibility is not a late audit.

It is a field contract.

## What you can build

### Type that has real weight

Headings can thicken, glow, or stabilize as attention accumulates.

The text remains semantic. The field changes how it feels.

### A reciprocal hero

A word, mark, or card can pull matter in, receive density, and respond back through typography, tone, or glow.

The behavior is a loop, not a decorative hover.

### Reading pages that remember

A long article can remember where the reader paused, skimmed, returned, or followed citations.

The table of contents can become a memory map.

### Evidence-aware AI interfaces

Claims, sources, contradictions, corrections, and confidence can become a visible field.

Unsupported claims can remain unstable. Verified claims can gain coherence. Contradictions can create charge.

### Forms that become coherent

A form can show stability instead of only errors.

Valid groups bind. Missing fields create pressure. Completed flows release.

### Dashboards with weather

Cards and metrics can show heat, pressure, density, urgency, and calm.

The dashboard becomes readable as a system, not a grid of isolated tiles.

### Relationship maps without graph clutter

Related concepts, citations, dependencies, controls, and examples can reveal themselves only when useful.

Relationships can exist as field behavior before they become visible lines.

### Collaboration with presence

Collaborators can become field participants.

Their focus emits signal. Their recent work leaves memory. Handoffs flow between people and tasks.

## Plain HTML first

The authoring surface should remain simple.

```html
<field-root>
  <section
    data-body="gravity"
    data-strength="0.8"
    data-feedback
  >
    Priority
  </section>

  <a
    href="#source"
    data-field-relation="supports"
    data-field-target="#claim"
  >
    Source
  </a>
</field-root>
```

Custom elements can make this cleaner.

```html
<field-root>
  <field-body data-body="attract" data-strength="0.9">
    Start
  </field-body>
</field-root>
```

Framework adapters should compile to the same contracts.

The DOM remains the source.

The field is the behavior layer.

## For developers

Use the host-driven core when you own the canvas or renderer.

```ts
import { createField } from "Fundamental";
import { browserHost } from "@fundamental-engine/dom";

const field = createField(canvas, {
  host: browserHost()
});
```

Use platform when you need DOM participation:

```txt
measurement
state
feedback
relationships
visual bindings
overlays
scheduler
linting
```

Use elements when you want native authoring.

Use React when you need framework integration.

The architecture is deliberately layered:

```txt
core = field engine
platform = DOM participation
elements = HTML authoring
react = adapter
docs/lab = proof surfaces
```

## The pitch

Fundamental gives interfaces a missing layer.

HTML gives structure.

CSS gives presentation.

JavaScript gives behavior.

Design systems give components and tokens.

Fundamental gives relational behavior.

It lets the interface describe:

```txt
priority
polarity
binding
transformation
memory
attention
coherence
entropy
pressure
signal
causality
```

That is the part most UI systems still fake with one-off state and decorative transitions.

Fundamental makes it part of the runtime.

The short version:

```txt
Four fields. Many expressions. One DOM runtime.
```

The sharper version:

```txt
Fundamental turns interface state into relational physics.
```

The most accurate version:

```txt
Fundamental turns semantic DOM, user attention, relationships, data, events, particles, visual layers, and feedback into a shared field runtime where behavior is caused, measurable, inspectable, accessible, and composable.
```

That is why it is different.

It does not add a feature to the existing UI paradigm.

It changes what an interface is allowed to be.