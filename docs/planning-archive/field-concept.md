# Fundamental: Complete Concept Document

> Status: vision and concept document.  
> This document defines the full conceptual arc of Fundamental: the paradigm, architecture, natural-field model, authoring model, participation layer, diagnostics, recipes, accessibility rules, performance principles, and long-range product direction.
>
> It is not the only source of implementation truth. Current shipped behavior is verified by package code, conformance tests, diagnostics, and canonical docs.
>
> Use this document as the north-star explanation of what Fundamental is and why it exists.
>
> **Vocabulary note (concepts vs runtime tokens).** This is a concept document, so the prose uses
> concept language freely. The strict runtime token set is the 34 forces in the
> [forces catalog](../engine-reference/forces-system.md). Where this doc names `spring`, `phase`,
> `decay`, `emitter`, `reflect`, `absorb`, `vortex`, `fuse`, `fission`, or `warp`, those are *concepts
> or proposed behavior*, not shipped tokens — they map to (or are realized by) real tokens:
> `spring→tether`, `phase`/`decay`→`morph`/`memory`, `emitter→spawn`, `reflect→wall`, `absorb→sink`,
> `vortex→swirl`. `mass` is a metric and `potential` is a diagnostic, not tokens. `fuse`/`fission`/
> `warp`/`wormhole` are unimplemented. Custom elements beyond `<field-root>` and `<field-cell>`
> (e.g. `<field-body>`, `<field-text>`, `<field-inspector>`) are proposed, not registered today.

## 1. Thesis

Fundamental is a platform-native relational field runtime for the DOM.

Elements bend the field.

The field bends them back.

The page is not placed on top of a particle background. The page participates in a shared field context. Words, links, cards, controls, components, sections, claims, sources, relationships, data records, and visual layers can become field participants.

Most interface systems treat behavior as local component state.

```txt
hover
focus
selected
open
disabled
loading
error
```

Fundamental treats interface behavior as relational field state.

```txt
near
related
remembered
charged
bound
unstable
coherent
saturated
cooling
decaying
flowing
```

That is the paradigm shift.

The interface is not only styled.

It participates.

## 2. What Fundamental is not

Fundamental is not a particle background.

It is not an animation library.

It is not a physics toy.

It is not a component framework.

It is not a replacement for semantic HTML.

Fundamental is a relational behavior runtime.

It gives interface meaning a field model.

The short version:

```txt
UI as isolated components with decorative transitions.
```

becomes:

```txt
UI as a shared, inspectable field of meaning.
```

## 3. The core idea

Every interface already contains invisible relations.

```txt
some things matter more
some things attract attention
some things oppose each other
some things belong together
some things become unstable
some things decay
some things need to flow
some things remember interaction
some things should release
some things should explain why they changed
```

Traditional UI expresses those relations through layout, color, type, class names, and one-off logic.

Fundamental makes them explicit.

It turns them into measurable, inspectable, accessible field behavior.

## 4. The current architecture

The current system is organized into packages and layers.

```txt
Fundamental   host-driven, renderer-agnostic field engine
@fundamental-engine/dom   browser host, DOM participation, measurement, state, feedback,   relationships, visual bindings, overlays, scheduling, linting
@fundamental-engine/elements   native HTML and web component authoring
@fundamental-engine/react   React adapter over the same contracts
site/docs/lab   proof surfaces, recipes, diagnostics, demos, and executable documentation
```

The core computes field behavior.

The platform binds field behavior to the DOM.

Elements expose native authoring.

React adapts the same contracts.

Canvas is one render surface, not the system.

SVG overlays are one render surface.

DOM feedback is one render surface.

Diagnostics are one explanation surface.

## 5. The reciprocal loop

The system has two directions.

### 5.1 DOM to field

An element can become a body.

```html
<a
  data-body="attract"
  data-strength="0.9"
  data-range="320"
  data-feedback
>
  mass
</a>
```

The element now participates in the field. It can pull, repel, swirl, stream, slow, jet, tether, deflect, bind, capture, emit, or shape matter.

But it remains semantic HTML.

The link is still a link.

The field behavior is layered onto meaning, not substituted for meaning.

### 5.2 Field to DOM

The field measures local state around a body.

That state can become CSS, custom state, events, diagnostics, or overlay output.

Current primary naming:

```css
--field-density
--field-attention
--field-heat
--field-entropy
--field-memory
--field-coherence
--field-pressure
```

Compatibility aliases may exist:

```css
--forces-*
--d
```

New examples should use --field-*.

The field writes back to the DOM through the platform feedback layer.

A word can get heavier because density actually gathered around it.

A section can brighten because attention accumulated.

A relationship can strengthen because connected elements are active.

A warning can heat because instability is rising.

A completed state can cool because pressure released.

## 6. System invariants

Three invariants define the system.

### 6.1 Reciprocity

Elements affect the field.

The field affects elements.

Neither side is purely decorative.

A registered participant can:

```txt
source force
receive metrics
move as an agent
dispatch threshold events
bind to relationships
render overlays
expose diagnostics
```

### 6.2 Conservation

The default field should not create matter from nothing.

Particles may be:

```txt
bound to currents
free in the field
captured by sinks
released by events
reclaimed by healing behavior
spawned only through explicit budgeted sources
```

Source and sink behavior may break conservation only when explicitly budgeted.

Conservation is not only aesthetic. It makes the field feel coherent. When attention moves, it should feel transferred, not fabricated.

### 6.3 Synchronization

The visible interface and field geometry must stay aligned.

DOM elements are measured through the platform layer.

The core receives plain geometry and host services.

The platform owns browser reality:

```txt
viewport
scroll
visibility
events
measurement
feedback
relationships
visual bindings
visual bindings
overlays
```

The field should never drift away from the interface it describes.

## 7. The FieldHost principle

Fundamental is host-driven.

It should not import browser or DOM globals.

Core may compute field behavior, integrate particles, run diagnostics, and draw to a supplied surface. But browser reality belongs to the host.

Browser setup should look like this:

```ts
import { createField } from "Fundamental";
import { browserHost } from "@fundamental-engine/dom";

const field = createField(canvas, {
  host: browserHost()
});
```

@fundamental-engine/elements and adapters can hide this setup for normal authors.

Core remains portable.

Platform remains native.

## 8. The platform participation layer

The platform layer is the missing browser-adjacent substrate.

It provides the contracts the web platform does not yet fully provide natively.

### MeasurementRegistry

Owns frame-stable DOM geometry.

It measures bodies, roots, hosts, visual layers, and relationship endpoints.

Measurement happens during the read phase.

### StateRegistry

Owns field state and metrics.

Examples:

```txt
density
attention
heat
entropy
memory
coherence
pressure
relation-strength
```

### FeedbackRegistry

Writes measured state back to the DOM.

Outputs:

```txt
CSS custom properties
custom element states
thresholded CustomEvents
data attributes where useful
debug records
```

Continuous state should use CSS variables.

Discrete state should use thresholded events.

### RelationshipRegistry

Normalizes relationships from HTML, ARIA, data attributes, recipes, and runtime links.

Sources can include:

```txt
href="#id"
label[for]
aria-controls
aria-describedby
aria-labelledby
form ownership
figure / figcaption
details / summary
popover target
data-field-relation
runtime recipe relationships
data-bound graph edges
```

### VisualBindingRegistry

Binds expressive visual layers to semantic DOM sources.

Canvas, SVG, WebGL, vector typography, diagrams, and overlays must not become the only source of meaning.

### OverlayRegistry

Renders relationship lines, field lines, force vectors, debug rects, attention halos, heatmaps, and diagnostic surfaces.

Overlays reveal.

They do not define behavior.

### FrameScheduler

Coordinates the runtime phases.

```txt
discover
read
compute
state
write
render
```

This prevents measurement, simulation, feedback, and rendering from fighting each other.

### lintPlatform()

Provides guardrails.

It should catch:

```txt
visual layer without semantic source
interactive overlay without semantic equivalent
relationship target missing
field state used without registration
feedback writing accessibility state incorrectly
measurement requested outside read phase
recipe missing reduced-motion equivalent
```

## 9. The substrate

The field is built from particles, bodies, currents, agents, metrics, relationships, render surfaces, and feedback.

### 9.1 Particles

Particles are the lightest agents.

They carry visual and physical state.

A recommended particle model:

```ts
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heat: number;
  cap: Body | null;
  m: number;
  q: number;
  age: number;
  life?: number;
  species?: string;
  pigment?: Color;
  phase: number;
  coherence: number;
};
```

Particles are not the whole system.

They are one visible expression of the field.

### 9.2 Bodies

A body is a registered element, virtual element, data record, component host, or recipe participant.

A body may:

```txt
source force
receive feedback
participate in relationships
be measured
be inspected
act as an event host
serve as a visual binding source
```

Body geometry belongs to platform measurement.

Force behavior belongs to core.

### 9.3 Currents

Currents are background carrier lines of the field.

They are not decoration.

They can act as:

```txt
standing waveforms
reservoirs of bound matter
carriers of particle motion
ambient life sources
flow guides
healing paths
```

Particles may be bound to currents or free in the field.

A calm free particle near a current can heal back into the line.

This lets the field feel alive without constantly spawning new matter.

### 9.4 Agents

Particles are not the only agents.

Agents can include:

```txt
particle
DOM element
event sink
current
virtual body
component host
relationship
data record
user focus
pointer
selection
scroll position
```

A force produces influence at a location.

Each agent type consumes influence differently.

| Influence | Particle consumes as | Element consumes as | Event sink consumes as |
|---|---|---|---|
| impulse | velocity and heat | transform offset or feedback | none |
| constraint | position or velocity clamp | transform clamp | none |
| capture | cap = body | dock or collapse | event |
| relocate | position jump | reordering or teleport | none |
| emit | new particle | cloned element or visual state | none |
| trigger | heat or state | CSS variable or class | CustomEvent |

This turns the field into an interface substrate, not just a particle simulation.

## 10. Natural Field Translation System

The natural model is not a flat list of force tokens.

It starts from four fields:

```txt
Gravity
Electromagnetic
Strong
Weak
```

Translated into interface behavior:

```txt
Gravity -> priority, convergence, hierarchy
Electromagnetic -> polarity, signal, field lines, flow
Strong -> binding, cohesion, structure
Weak -> transformation, decay, release
```

Core doctrine:

```txt
Natural fields are conceptual.
Engine primitives are translations.
Canonical forces are designed verbs.
Derived behaviors are not additional fundamental forces.
Fieldflow is transport along field structure.
Diagnostics reveal invisible structure.
Recipes compose behavior into interface meaning.
```

Short version:

```txt
Natural fields are not tokens. Tokens are translations.
```

## 11. Gravity

Gravity is the field of priority, convergence, weight, and hierarchy.

In physics, gravity gathers mass, creates wells, and produces orbital structure.

In Fundamental, gravity translates into interface priority.

Use gravity for:

```txt
priority ranking
search relevance
centrality
importance
anchoring
orbit settling
attention wells
```

Engine expressions:

```txt
gravity
mass
potential
prediction
sink / blackhole-style composites where appropriate
```

Important distinction:

```txt
attract is not gravity.
```

attract is a designed UI well.

gravity is the natural-field translation.

## 12. Electromagnetic

Electromagnetic behavior is the field of polarity, signal, charge, radiation, field lines, and flow.

In physics, electric fields push charged matter and magnetic fields bend moving charged matter.

In Fundamental, electromagnetism translates into polarity, opposition, signal, routing, field lines, propagation, and guided flow.

Use electromagnetic behavior for:

```txt
polarity contrast
signal routing
state opposition
field lines
guided flow
transmission
activation
plasma-like motion
```

Engine expressions:

```txt
charge
magnetism
propagate
fieldflow
emitter
reflect
absorb
stream
```

Important distinctions:

```txt
repel is not charge.
charge and magnetism are electromagnetic expressions.
fieldflow is not magnetism.
fieldflow is transport.
```

Required rule:

```txt
Electric fields push.
Magnetic fields bend.
Fieldflow carries.
```

## 13. Strong

Strong interaction is the field of binding, cohesion, locality, and structure.

In physics, the strong interaction binds matter at tiny scales.

In Fundamental, strong behavior becomes the grammar of things that should stay together.

Use strong analogues for:

```txt
grouping
relationship strength
clusters
bonds
constraints
local structure
cohesion
lattices
material integrity
```

Engine expressions:

```txt
cohesion
link
tether
spring
crystallize
pressure
fuse if implemented
```

Strong behavior is useful for cards, labels, citations, source relationships, form groups, data clusters, dependency graphs, and knowledge maps.

## 14. Weak

Weak interaction is the field of transformation, decay, release, mutation, and state transition.

In physics, weak interaction enables decay and transformation.

In Fundamental, weak behavior becomes the grammar of change.

Use weak analogues for:

```txt
state change
release
decay
expiration
handoff
transformation
phase change
mutation
instability
```

Engine expressions:

```txt
phase
decay if implemented
fission if implemented
state transitions
memory decay
release
```

Weak behavior is useful for notifications, stale data, draft-to-published transitions, completion release, invalidation, risk, and recovery.

## 15. Canonical UI forces

Canonical forces are designed interface verbs.

They are intentionally bounded, legible, and stable.

They are not required to be literal physical laws.

| Force | Token | Meaning |
|---|---|---|
| Attract | attract | gives readable direction |
| Repel | repel | creates pressure and separation |
| Swirl | swirl | spins motion together |
| Stream | stream | reveals directional motion |
| Viscosity | viscosity | thickens the medium and bleeds momentum |
| Jet | jet | adapts and relaunches response |
| Tether | tether | gives structure and rest length |
| Wall | wall | defines surface and collision |
| Sink | sink | holds attention, then releases |

These should remain stable API tokens.

Canonical philosophy:

```txt
attract is not literal gravity.
repel is not literal Coulomb force.
```

They are UI-first behaviors.

The natural-field layer contains physically coherent translations where appropriate.

## 16. Engine primitive classification

Tokens should be classified by kind.

| Token or concept | Classification | Fundamental parent |
|---|---|---|
| gravity | direct engine primitive | Gravity |
| charge | electric engine primitive | Electromagnetic |
| magnetism | magnetic engine primitive | Electromagnetic |
| fieldflow | field-aligned transport | field-agnostic, often electromagnetic |
| propagate | wave or signal behavior | electromagnetic analogue or general wave behavior |
| thermal | derived energy behavior | derived thermodynamics |
| collide | contact mechanics | derived mechanics |
| diffuse | scalar transport behavior | derived field-buffer behavior |
| memory | persistence metric / occupancy field | interface/system metric |
| cohesion | binding/material analogue | Strong |
| link | bond or constraint analogue | Strong |
| tether | constraint analogue | Strong |
| spring | elastic bond analogue | Strong |
| crystallize | lattice/material order analogue | Strong |
| pressure | compression/material analogue | Strong or thermodynamic material behavior |
| phase | state transition | Weak/material transition analogue |
| decay | transformation/release if implemented | Weak |
| fission | split/release if implemented | Weak/strong nuclear analogue |
| fuse | merge/binding-energy behavior if implemented | Strong/nuclear composite |
| attract | designed UI force | not gravity |
| repel | designed UI force | not charge |
| sink | designed capture/accretion force | not a literal black hole unless used in a composite |

In this table, `spring`, `phase`, `decay`, `fission`, and `fuse` are **concept/planned** rows, not
shipped tokens: `spring` ships as `tether`, `phase`/`decay` as `morph`/`memory`, and
`fission`/`fuse` are unimplemented. Likewise `mass` is a metric and `potential` is a diagnostic
(see §11) — neither is a runtime token.

## 17. field() and apply()

Every force-like behavior should distinguish structure from cause.

```txt
field() = structure
apply() = cause
```

field() describes the field that can be rendered, probed, inspected, or followed.

apply() changes agents.

This distinction is essential for magnetism.

Electric fields push along field direction.

Magnetic fields reveal loop structure, but their force bends moving charged matter perpendicular to velocity.

fieldflow carries matter along field structure without corrupting magnetism.

```txt
Electric fields push.
Magnetic fields bend.
Fieldflow carries.
```

## 18. Formations

A formation is a global or scoped field arrangement.

Formations do not replace force tokens.

They bias the whole field.

Core formations:

| Formation | Feel |
|---|---|
| ambient | calm resting field |
| wells | matter pools into attention centers |
| lanes | directional bands |
| scatter | even dispersal |
| accretion | convergence toward sink bodies |
| reading | attention and memory over content |
| evidence | claims and sources bind or conflict |
| coherence | valid parts stabilize |
| conflict | contradictions separate and heat |
| presence | collaborators emit local attention |
| turbulence | active, noisy, unstable field |
| lattice | structured, crystalline layout |
| tide | slow global pressure shift |

Formations can map to:

```txt
sections
routes
view states
data modes
search modes
interaction states
recipes
```

## 19. Recipes

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

A recipe should answer:

```txt
What is this for?
What field relation does it translate?
Which primitives does it use?
Which bodies must exist?
Which relationships matter?
What metrics does it write?
What diagnostics explain it?
What happens in reduced motion?
```

Representative recipes:

```txt
Priority Well
Signal Path
Relationship Bond
Reading Field
Evidence Field
Coherence Field
Memory Trace
Guided Flow
Attention Weather
Citation Thread
Form Stability Field
Command Intent Field
Dependency Tension
Trust Gradient
Handoff Stream
Field Contract Preview
Presence Field
Consensus Well
Change Shockwave
Permission Boundary
System Pulse
```

Recipes are how the system becomes authorable.

They turn field theory into product patterns.

## 20. Data as field behavior

The field should become a renderer for data.

Data can map to:

```txt
category -> force or field kind
prominence -> strength
recency -> memory
relationships -> topology
confidence -> coherence
contradiction -> polarity
risk -> pressure
state -> phase
lifecycle -> capture/release
```

Possible API:

```ts
const binding = bindData(container, records, mapper, options);

binding.update(nextRecords);
binding.destroy();
```

Mapper:

```ts
record => ({
  id,
  body,
  role,
  strength,
  range,
  color,
  relationships,
  metrics,
  status
})
```

View-state examples:

```txt
search results -> relevance wells
grouped browse -> concept clusters
timeline -> lanes
opened item -> focus orbit
active graph -> relationship topology
system stress -> attention weather
AI answer -> evidence field
```

## 21. Relationships as active material

The DOM is a tree.

Interfaces are graphs.

Relationships should become first-class field participants.

Relationship sources include:

```txt
href="#id"
label[for]
aria-controls
aria-describedby
aria-labelledby
form ownership
figure / figcaption
details / summary
popover target
data-field-relation
runtime recipe relationships
data-bound graph edges
```

Relationship types can include:

```txt
supports
contradicts
defines
describes
controls
depends-on
part-of
references
owns
hands-off-to
blocks
conflicts-with
```

Relationships can have:

```txt
strength
tension
memory
active state
confidence
direction
source
status
```

A relationship is not just a line.

It can pull, resist, decay, strengthen, route signal, carry memory, and explain state.

## 22. Input agents

User input should be modeled as field participation, not only event triggers.

Candidate input agents:

```txt
FocusAgent
PointerAgent
KeyboardAgent
SelectionAgent
DwellAgent
ScrollAgent
PresenceAgent
IntentAgent
```

### FocusAgent

Focus becomes current.

Tab order can emit signal.

Reduced motion should use lit state without travel.

### PointerAgent

Pointer velocity can become temporary influence.

Fast movement can impart momentum if enabled.

### KeyboardAgent

Directional navigation can act as flow.

Shortcut targets can emit signal to affected regions.

### SelectionAgent

Selected text, cards, rows, or nodes become temporary bodies.

### DwellAgent

Dwell becomes attention and memory.

### PresenceAgent

A collaborator’s focus emits local signal and recency.

### IntentAgent

Likely next actions gain gravity from current context.

All input agents must be opt-in, inspectable, and reduced-motion safe.

## 23. Events as field output

The field can drive behavior, not just pixels.

Recommended primary event namespace:

```txt
field:*
```

Compatibility namespace:

```txt
forces:*
```

Examples:

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

Events should be thresholded, debounced, and meaningful.

Continuous state belongs in metrics and CSS variables.

Discrete transitions belong in events.

The field should not spam announcements.

## 24. Shadow DOM participation

Shadow DOM support lets encapsulated components participate in the same field without exposing fragile internals.

Core rule:

```txt
Presentation can be private. Physical participation must be public.
```

A component may hide its shadow tree.

If it participates in the field, it must expose:

```txt
registered host or body rect provider
force attributes or recipe contract
write-back target
semantic source where needed
```

Default registered body:

```txt
custom element host
```

Registration should use composed custom events.

```ts
this.dispatchEvent(new CustomEvent("field:register-body", {
  bubbles: true,
  composed: true,
  detail: {
    element: this
  }
}));
```

Compatibility events may exist:

```txt
forces:register-body
forces:unregister-body
forces:update-body
```

The engine should not crawl shadow roots.

Closed roots must work through host registration or an explicit rect provider.

## 25. Field scopes and local cells

There are two main participation modes.

### Global participant

The component participates in the shared page field.

Use for:

```txt
text
cards
links
buttons
capability items
navigation
forms
interactive bodies
relationship endpoints
```

### Local simulation cell

The component owns an isolated field.

Use for:

```txt
docs
examples
Lab
views
Storybook blocks
conformance
visualization
article demos
playgrounds
recipe previews
```

Local cells should not accidentally fragment the global field.

They must be explicit.

A local cell should not affect the root field unless intentionally bridged.

## 26. Field portals

A body may target a specific field.

```html
<field-body data-field="hero-field" data-body="attract"></field-body>
```

Target model:

```ts
type FieldTarget = "nearest" | "root" | string;
```

Use cases:

```txt
modals affecting the root field
overlays participating in page physics
local demos joining the global field intentionally
app shell continuity
cross-section field continuity
cross-document transitions
```

## 27. Styling contract

The engine writes to the registered host through platform feedback.

Primary variables:

```css
--field-density
--field-attention
--field-heat
--field-entropy
--field-memory
--field-coherence
--field-pressure
```

Compatibility variables:

```css
--forces-*
--d
```

New docs and examples should use --field-*.

Inside Shadow DOM, use explicit names and fall back to compatibility aliases only where needed.

```css
:host {
  --density: var(--field-density, var(--forces-density, var(--d, 0)));
}
```

Recommended parts:

| Component | Parts |
|---|---|
| field-text | label, glow, mark |
| field-card | surface, content, aura, meter |
| field-cell | canvas, overlay, controls |
| field-body | body, icon, meter |
| field-inspector | panel, table, overlay, warning |

Use ::part() for controlled styling.

Do not expose fragile internals.

## 28. Words, marks, and typography

Words should remain real text.

Do not assemble essential text out of particles.

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

Marks may be particle targets:

```txt
period
dot
dash
brackets
logo
glyph
simple icon
chart mark
map point
punctuation
```

Rule:

```txt
Words are semantic bodies the field decorates.
Marks are where matter may assemble.
```

If text is vectorized, the semantic source must remain available through real HTML text or equivalent accessible text.

## 29. Authoring API

Plain HTML:

```html
<a
  data-body="sink attract"
  data-strength="0.8"
  data-range="340"
  data-feedback
>
  Contact
</a>
```

Relationship authoring:

```html
<a
  href="#source-1"
  data-field-relation="supports"
  data-field-target="#claim-1"
>
  Source
</a>
```

Custom element:

```html
<field-root>
  <field-body data-body="attract" data-strength="0.9">
    Mass
  </field-body>
</field-root>
```

Programmatic:

```ts
field.registerBody(element, {
  body: "attract",
  strength: 0.9,
  range: 320,
  feedback: true
});
```

Core plus platform:

```ts
import { createField } from "Fundamental";
import { browserHost } from "@fundamental-engine/dom";

const field = createField(canvas, {
  host: browserHost()
});
```

## 30. Visual language

Render surfaces should reveal field truth.

They should not invent behavior.

Possible render modes:

```txt
particles
trails
metaballs
links
streamlines
field lines
potential
energy
contours
velocity vectors
force vectors
topology
inspector
causality
prediction
depth
knockout
flow-field LIC
relationship ribbons
glyph interior fields
field shadows
volumetric density
```

Render doctrine:

```txt
Renders reveal. They do not define.
```

## 31. Diagnostics

Diagnostics are part of the trust model.

The system should be able to answer:

```txt
Why is this moving?
Why is this emphasized?
Why are these connected?
What caused this warning?
What accumulated here?
Which source supports this claim?
Which relationship is active?
Which recipe wrote this CSS variable?
```

Diagnostic surfaces:

```txt
Platform Inspector Field Contract Preview Diagnostic Lens Relation Lens Recipe Debugger Causality Overlay Prediction Overlay Topology View Memory Heatmap Energy View
```

Diagnostics are not only developer tools.

They are how the interface explains itself.

## 32. Accessibility

The field must respect accessibility constraints.

Rules:

```txt
No field behavior may be the only source of meaning.
Reduced motion freezes, simplifies, or substitutes motion.
Focus must remain a first-class input.
Decorative local fields may be aria-hidden.
Interactive cells need labels.
Field state should not spam announcements.
ARIA should describe real semantic state, not decorative density.
Keyboard focus can become a physical current, but reduced motion should use static state.
Canvas/SVG visual text must not be the only text source.
```

Examples:

```html
<field-cell aria-label="Interactive field simulation"></field-cell>
```

Decorative:

```html
<field-cell aria-hidden="true"></field-cell>
```

Reduced-motion equivalents:

| Motion behavior | Equivalent |
|---|---|
| particle trail | static memory mark |
| fieldflow ribbon | path contour |
| orbit | grouped related items |
| heat bloom | tone, rail, or badge |
| relationship pulse | persistent thread |
| prediction path | next-step marker |

Accessibility is not a late audit.

It is a field contract.

## 33. Performance

Performance rules:

```txt
use one root field by default
use local cells only when explicit
cap DPR
skip offscreen bodies
measure dirty bodies only where possible
use ResizeObserver for geometry changes
use IntersectionObserver for visibility
separate read and write phases
use CSS.registerProperty where useful
avoid crawling shadow roots
keep GPU backend opt-in
```

Antipattern:

```txt
one full-viewport canvas per component
```

Correct pattern:

```txt
one root field, explicit local cells only
```

## 34. Compositor bridge

Where supported, register typed CSS properties.

```css
@property --field-density {   syntax: "<number>";   inherits: true;   initial-value: 0; }
```

Candidate properties:

```txt
--field-density
--field-attention
--field-heat
--field-entropy
--field-memory
--field-coherence
--field-pressure
```

Use feature detection.

Do not require experimental platform support.

Fallbacks must work.

## 35. Conformance

The system must be verified by tests, not by watching the field.

Test layers:

```txt
golden unit tests
integrator tests
conformance scenarios
platform registry tests
recipe schema tests
accessibility lint tests
benchmarks
browser previews
future parity tests
```

Every force needs:

```txt
formula test where possible
behavioral scenario
no-effect-beyond-range check where relevant
conservation check where relevant
safety check
classification coverage
diagnostic mapping
```

Global invariants:

```txt
no NaN
no Infinity
velocity bounded
heat bounded
particle count stable unless a budgeted source is active
source/sink budget enforced
modifier order deterministic
relationship IDs stable
platform phases respected
core imports zero DOM globals
```

## 36. Recipe conformance

Every shipped recipe should define:

```txt
intent
natural-field translation
required bodies
relationships
metrics
feedback
diagnostics
reduced-motion equivalent
status
```

Required tests:

```txt
schema validity
all referenced tokens exist
all metrics have feedback definitions
all visual layers have semantic sources
all motion-heavy recipes have reduced-motion equivalents
all planned tokens are labeled honestly
```

## 37. Platform tests

Required platform tests:

```txt
MeasurementRegistry snapshots geometry
StateRegistry stores typed values
FeedbackRegistry writes --field-* variables
FeedbackRegistry threshold events debounce
RelationshipRegistry discovers native and data-field relationships
VisualBindingRegistry warns on missing semantic source
OverlayRegistry renders without owning relationships
FrameScheduler preserves phase order
lintPlatform catches missing contracts
browserHost owns DOM globals
core boundary remains clean
```

## 38. Shadow DOM tests

Required tests:

```txt
host custom element registers successfully
registration crosses shadow boundary
closed shadow root works through host registration
update event refreshes attributes
unregister removes body
disconnected hosts are pruned
getBoundingClientRect maps into root coordinates
local cell maps into local canvas
CSS variables written to host affect shadow CSS
local cell does not leak into root field
virtual body IDs remain stable
```

## 39. Physics tests

Required tests:

```txt
designed mode matches current golden behavior
natural mode uses a = F / m where enabled
hybrid mode preserves canonical UI feel
gravity uses softened inverse-square law
charge ignores neutral particles
magnetism preserves speed
fieldflow carries along field structure
viscosity reduces speed without redirection
quadratic drag affects high speed more than low speed
velocity cap works
source budget works
fuse conserves mass and momentum if shipped
fission conserves mass and momentum if shipped
warp preserves particle count and velocity semantics if shipped
```

## 40. Product surfaces

Key product surfaces:

```txt
docs site
Lab
Recipe Gallery
Platform Inspector
Narrative Reveal
Authoring examples
Field Contract Preview
```

The product should teach itself.

A user should be able to move from:

```txt
plain HTML
```

to:

```txt
field participant
```

to:

```txt
recipe
```

to:

```txt
diagnostics
```

to:

```txt
platform inspector
```

without leaving the documentation system.

## 41. Component model

Recommended custom elements:

| Element | Purpose |
|---|---|
| <field-root> | root shared field |
| <field-cell> | isolated local simulation |
| <field-body> | generic body |
| <field-text> | text body with density-driven type |
| <field-mark> | mark or punctuation target |
| <field-card> | structured content body |
| <field-lab> | interactive scenario runner |
| <field-debug> | diagnostics overlay |
| <field-inspector> | platform and runtime inspector |

Only `<field-root>` and `<field-cell>` are registered today (with the `<forces-field>` / `<forces-cell>`
aliases). The rest of this table is the **proposed** element set.

Default behavior:

```txt
custom element host
```

## 42. Debugging

Debug overlays should show:

```txt
body rect
token list
force class
scope
density
attention
heat
entropy
memory
coherence
pressure
accreted ratio
velocity
force vectors
relationship edges
source budget rect
source host or custom getter
field target
recipe source
feedback writes
scheduler phase
```

Shadow DOM bodies must be visible in debug overlays even when internals are private.

## 43. Roadmap

The current roadmap should prioritize coherence before spectacle.

Near-term priority:

```txt
1. Runtime platform unification
2. Platform Inspector
3. First-class Recipe System
4. Executable Recipe Gallery
5. Accessibility Conformance
```

Mid-term priority:

```txt
6. Data binding
7. Input agents
8. AI evidence fields
9. Multi-root and cross-document fields
10. Compositor-native bridge
```

Long-term frontier:

```txt
11. Natural physics completion
12. Advanced render modes
13. GPU compute backend
14. Visual authoring tools
15. DevTools extension
16. Research and release package
```

Do not add new spectacle before the system is explainable, inspectable, accessible, and authorable.

## 44. Research direction

Fundamental can become a research artifact.

Possible title:

```txt
Fundamental: A Field Translation Runtime for Relational DOM Interfaces
```

Claims to evaluate:

```txt
Does Reading Field improve orientation in long documents?
Does relationship visibility improve source recall?
Does Evidence Field improve trust calibration?
Does reduced-motion equivalence preserve meaning?
Does diagnostic visibility improve author trust?
Does field-based priority reduce alert fatigue?
```

Evaluation targets:

```txt
section relocation speed
concept relationship recall
source support recognition
perceived distraction
debuggability
authoring time
accessibility preference
```

## 45. Final architecture

The final architecture has five layers.

### The field engine

A host-driven, renderer-agnostic core that computes field behavior.

### The platform layer

A browser/DOM participation layer that owns measurement, state, feedback, relationships, visual bindings, overlays, scheduling, linting, and browser host services.

### The body system

A registry of elements, custom elements, virtual bodies, data records, relationships, and input agents that participate in the field.

### The recipe system

A portable authoring layer that turns field behavior into product patterns.

### The diagnostic system

An explanation layer that makes behavior inspectable, testable, accessible, and trustworthy.

## 46. Final principle

The field does not care whether a participant is plain HTML, Shadow DOM, React, a generated data record, a card, a word, a mark, a relationship, a user focus, or an event sink.

If it registers into the field, it participates.

Presentation can be private.

Physics must be registered, measurable, and testable.

Meaning can have weight.

Difference can have charge.

Relationships can bind.

State can decay.

Attention can leave memory.

Motion can have cause.

Interfaces can explain themselves.

Elements bend the field.

The field bends them back.