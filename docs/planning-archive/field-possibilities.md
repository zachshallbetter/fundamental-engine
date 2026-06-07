# field-possibilities

> Status: planning / possibility space.  
> This document describes what field-ui can become beyond the current implementation. It is not the source of truth for shipped behavior.
>
> Current implementation truth lives in the package code, conformance tests, diagnostics, and canonical docs. This document exists to keep the wider idea space coherent.
>
> **Vocabulary note (concepts vs runtime tokens).** Possibility language here is not the engine token
> set. The 34 real runtime tokens live in the [forces catalog](../engine-reference/forces-system.md).
> Concept words map to them: `vortex→swirl`, `drag→viscosity`, `emitter→spawn`, `spring→tether`,
> `reflect→wall`, `absorb→sink`, `phase`/`decay`→`morph`/`memory`. `mass` is a metric, `potential` a
> diagnostic; `fuse`/`fission`/`warp`/`wormhole` are not implemented.

## 0. Purpose

field-ui is not a particle background.

It is a platform-native relational field runtime for the DOM.

The system lets semantic HTML, DOM elements, particles, relationships, measurements, metrics, feedback, visual layers, and user interaction participate in one shared field context.

The purpose of this document is to describe the possibility space opened by that model.

Not just:

```txt
What forces can we add?
```

But:

```txt
What new kinds of interfaces become possible when meaning has field behavior?
```

## 1. The paradigm shift

Most interface systems are organized around isolated component state.

```txt
component owns state
state changes class
class changes style
animation decorates transition
```

field-ui introduces a different model:

```txt
interface owns a shared field
bodies emit influence
agents respond
metrics accumulate
diagnostics explain
feedback returns state to the DOM
```

The possibility space begins there.

A button can still be a button.  
A heading can still be a heading.  
A citation can still be a citation.  
A form can still be semantic HTML.

But those elements can also participate in a field.

They can have priority, polarity, binding, transformation, memory, coherence, pressure, entropy, heat, attention, and relationship strength.

The interface becomes a shared, inspectable field of meaning.

## 2. Current doctrine

The current architecture should guide every possibility.

```txt
field-ui   host-driven, renderer-agnostic field engine
@field-ui/platform   browser host, DOM participation, measurement, state, feedback,   relationships, visual bindings, overlays, scheduling, linting
@field-ui/elements   native HTML and web component authoring
@field-ui/react   React adapter over the same contracts
```

Canvas is one render surface.

SVG overlays are one render surface.

DOM feedback is one render surface.

Diagnostics are one explanation surface.

The system is larger than the canvas.

## 3. The Natural Field Translation System

The old language of “natural primitives” is too flat for the current model.

The possibility space should start from the four natural fields:

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

This is the organizing frame.

Natural fields are conceptual.

Engine primitives are translations.

Canonical forces are designed verbs.

Derived behaviors are not additional fundamental forces.

Fieldflow is transport along field structure.

Diagnostics reveal invisible structure.

Recipes compose behavior into interface meaning.

Short version:

```txt
Natural fields are not tokens. Tokens are translations.
```

## 4. Designed forces and natural translations

The system should preserve the distinction between designed interface forces and natural translations.

Designed UI forces exist because interfaces need readable, bounded behavior.

Real designed tokens (shipped):

```txt
attract
repel
swirl
stream
viscosity
jet
tether
wall
sink
```

Concept words map onto them (a concept is not a token): `vortex→swirl`, `drag→viscosity`,
`spring→tether`, `reflect→wall`, `absorb→sink`, `emitter→spawn`.

These are interface verbs.

They are stable, legible, and composable.

Natural translations exist because some behaviors benefit from physical coherence.

Examples:

```txt
gravity
charge
magnetism
cohesion
morph
memory
propagate
fieldflow
```

These express the four natural fields or their derived effects. (`morph` is the shipped
transformation token; `phase`/`decay` are concept words for it.)

Important distinctions:

```txt
attract is not gravity
repel is not charge
charge and magnetism are electromagnetic expressions
fieldflow is not magnetism
fieldflow is transport
```

Preserve the electromagnetic rule:

```txt
Electric fields push.
Magnetic fields bend.
Fieldflow carries.
```

## 5. Possibility categories

The old possibilities document was mostly a force, formation, condition, and render menu.

The new version should be broader.

The possibility categories are:

```txt
conditions
formations
recipes
relationships
input agents
data fields
render surfaces
diagnostics
accessibility equivalents
platform bridges
natural-field expansions
AI evidence fields
authoring tools
research artifacts
```

Each possibility should answer:

```txt
What relation does this reveal?
Which natural field does it translate?
Which engine primitives might express it?
Which platform registry owns it?
How is it inspected?
What is the reduced-motion equivalent?
```

## 6. Conditions

Conditions decide when a body, recipe, or relationship becomes active.

The older condition list remains useful, but it should be renamed into field-state language.

Possible conditions:

```txt
near
dense
sparse
aligned
aging
charged
species
dwell
pointer-fast
schedule
inview
focused
selected
related
trusted
conflicted
stale
unstable
coherent
thresholded
```

Examples:

### dwell

A section, card, or control becomes active after sustained attention.

Use for:

```txt
Reading Field
Ambient Tutor
Memory Trace
Context Halo
```

### related

A body acts only when the active element is related to it through the RelationshipRegistry.

Use for:

```txt
Citation Thread
Evidence Field
Relationship Bond
Relation Lens
```

### trusted

A claim, source, or result acts only when it passes a confidence or verification threshold.

Use for:

```txt
Trust Gradient
Evidence Field
Source Constellation
AI review surfaces
```

### stale

A document, data record, task, or notification acts when age or recency decay crosses a threshold.

Use for:

```txt
Staleness Drift
Review Pressure
Decay Notice
Priority Tide
```

### coherent

A workflow, form, or group acts when enough of its relationships stabilize.

Use for:

```txt
Coherence Field
Form Stability Field
Completion Release
Consensus Well
```

Conditions should not spam DOM events. Continuous state belongs in CSS variables and platform state. Discrete transitions belong in thresholded events.

## 7. Formations

A formation is a global or scoped field arrangement.

Formations do not replace force tokens. They bias the whole field.

Current and future formations can include:

```txt
ambient
wells
lanes
scatter
accretion
gravity
tide
lattice
flock
spiral
turbulence
pressure
shatter
magnetic
reading
evidence
coherence
conflict
presence
```

### reading

A formation for long-form content.

Sections gain attention near viewport center. Dwelled sections accumulate memory. Citations and related concepts become relationship paths.

Use for:

```txt
Reading Field
Field Tutorial
Natural Fields docs
research articles
legal documents
```

### evidence

A formation for claims, sources, and support.

Claims become bodies. Sources bind or repel. Contradictions add entropy. Verified claims gain coherence.

Use for:

```txt
Evidence Field
Trust Gradient
Source Constellation
Citation Thread
Provenance Trail
Conflict Field
Disagreement Charge
Risk Horizon
Field Contract Preview
```

### coherence

A formation for completion and stability.

Valid, aligned, or mutually supporting elements pull into a stable structure. Missing or contradictory elements add pressure.

Use for:

```txt
Form Stability Field
Coherence Field
Calibration Field
Consensus Well
```

### conflict

A formation for contradiction, incompatibility, and unresolved difference.

Opposing states separate, unstable zones heat, and unresolved conflict remains inspectable.

Use for:

```txt
Conflict Field
Disagreement Charge
Error Pressure
merge conflict UIs
```

### presence

A formation for collaborative systems.

Collaborators are not just avatars. They emit local attention, recency, and interaction signal.

Use for:

```txt
Presence Field
Review Constellation
Handoff Stream
Consensus Well
Disagreement Charge
Change Shockwave
Dependency Tension
Recovery Path
```

## 8. Recipes as the main possibility unit

The most important product frontier is not another force.

It is recipes.

A recipe is a portable field program.

It connects:

```txt
intent
natural field translation
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

Candidate recipe families:

```txt
Core interface fields
Reading, memory, accessibility
Product and workflow patterns
Trust, collaboration, inspection, teaching
Professional systems, safety, provenance, governance
Enterprise, collaborative, adaptive, operational fields
```

The recipe catalog should become a primary authoring surface.

## 9. The 64-recipe possibility map

The current recipe universe can be organized as:

```txt
1-16: Core interface and accessibility fields
17-32: Product, workflow, trust, collaboration
33-48: Professional systems, safety, provenance, governance
49-64: Enterprise, collaborative, adaptive, operational fields
```

Examples:

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
Navigation Current
Citation Thread
Form Stability Field
Command Intent Field
Dependency Tension
Trust Gradient
Handoff Stream
Semantic Gravity Map
Polarity Filter
Source Constellation
Boundary Field
Threshold Bloom
Latency Ripple
Provenance Trail
Relation Lens
Field Contract Preview
Presence Field
Consensus Well
Disagreement Charge
Change Shockwave
Permission Boundary
Risk Horizon
System Pulse
```

The recipe set is the clearest way to make field-ui usable.

It turns field theory into product patterns.

## 10. Data-bound fields

A major possibility is turning records into field participants.

The field should be able to bind to arrays, graphs, search results, events, claims, files, tasks, calendar slots, or source documents.

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

Examples:

### Search results

High relevance becomes gravity. Recency becomes memory. Low confidence creates distance.

Recipe:

```txt
Search Relevance Field
```

### Claims and sources

Claims become bodies. Sources bind to claims. Contradictions repel or destabilize.

Recipe:

```txt
Evidence Field
Source Constellation
Trust Gradient
```

### Calendar blocks

Busy blocks create pressure. Available spaces remain low pressure. Deadlines create wells.

Recipe:

```txt
Availability Pressure
Risk Horizon
Priority Tide
```

### Review queues

Pending work develops review pressure. Resolved items cool and become memory.

Recipe:

```txt
Review Pressure
Completion Release
Review Constellation
```

## 11. Relationship possibilities

The DOM is a tree, but interfaces are graphs.

field-ui should continue moving toward relationship-native interface behavior.

Relationship sources:

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

Relationship behaviors:

```txt
support
contradiction
dependency
ownership
definition
example
control
description
evidence
sequence
handoff
grouping
conflict
```

Relationship diagnostics:

```txt
topology
causality
relationship overlay
source strength
tension
memory
active path
```

Possibility: relationships should become first-class interface material.

Not just lines. Not just graph edges.

They can pull, resist, decay, strengthen, route signal, carry memory, and explain state.

## 12. Input agents

User input should become part of the field.

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

## 13. Render possibilities

Render modes should not be treated as visual skins.

Each render mode should answer:

```txt
What invisible relation does this reveal?
```

Existing and possible render surfaces:

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
Renders reveal. They do not define behavior.
```

Canvas, SVG, and DOM overlays are surfaces.

Semantic HTML remains the source of meaning.

## 14. Diagnostic possibilities

Diagnostics are not developer-only extras.

They are part of the trust model.

A mature field-ui surface should be able to answer:

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
Platform Inspector
Field Contract Preview
Diagnostic Lens
Relation Lens
Recipe Debugger
Causality Overlay
Prediction Overlay
Topology View
Memory Heatmap
Energy View
```

The possibility is an interface that can explain itself.

## 15. Accessibility possibilities

Every field behavior must survive without motion.

Potential accessibility equivalents:

```txt
motion trail -> static memory mark
fieldflow ribbon -> path contour
particle bloom -> badge or outline
relationship pulse -> persistent thread
heat bloom -> tone and status rail
orbit -> grouped related items
prediction path -> next-step marker
conflict separation -> conflict list
```

The accessibility system should be recipe-aware.

Every shipped recipe should define:

```txt
semantic source
motion behavior
reduced-motion behavior
keyboard behavior
screen-reader source
visual binding requirement
```

Possibility: accessibility becomes a field contract, not a late audit.

## 16. AI and evidence possibilities

AI interfaces need field behavior more than most UI categories.

AI outputs contain:

```txt
claims
sources
confidence
uncertainty
contradiction
revision
memory
provenance
risk
```

Field recipes can make these visible:

```txt
Evidence Field
Trust Gradient
Source Constellation
Citation Thread
Provenance Trail
Conflict Field
Disagreement Charge
Risk Horizon
Field Contract Preview
```

Possible AI field behaviors:

```txt
unsupported claims remain unstable
verified claims gain coherence
contradictions create charge separation
source support creates binding
corrections overwrite memory
high-risk claims gain pressure
generated drafts show provenance
```

This is one of the strongest product directions.

## 17. Collaboration possibilities

Collaboration can move beyond cursors and avatars.

Recipes:

```txt
Presence Field
Review Constellation
Handoff Stream
Consensus Well
Disagreement Charge
Change Shockwave
Dependency Tension
Recovery Path
```

Possible behaviors:

```txt
collaborator focus emits signal
recent edits leave memory
reviewers bind to artifacts
open comments create tension
resolved comments cool
handoffs flow from source to target
consensus gains mass
disagreement remains inspectable
```

The interface can show not just who is present, but how presence changes the field.

## 18. Authoring possibilities

The system should eventually support visual authoring.

Candidate tools:

```txt
recipe editor
force card editor
relationship graph editor
diagnostic lens
parameter tuning panel
reduced-motion equivalent editor
field contract preview
copyable HTML / web component / React snippets
```

Authoring principle:

```txt
Designers should compose relational behavior without editing engine force code.
```

A recipe editor should make these visible:

```txt
bodies
natural field translation
primitives
relationships
metrics
feedback variables
diagnostics
accessibility equivalent
status
```

## 19. Platform possibilities

The web platform already gives field-ui the raw materials.

But field-ui also points toward missing platform primitives:

```txt
native relationship graph
typed element state channels
low-cost layout snapshots
coordinate-space conversion
visual-semantic pairing
thresholded state observers
connection rendering
reading state
attention state
field-aware DevTools
```

field-ui can implement these today as a platform-adjacent layer.

Long-term, it can also serve as a working argument for what the web platform itself could grow.

## 20. Research possibilities

field-ui can become a research artifact.

Possible research frame:

```txt
field-ui: A Field Translation Runtime for Relational DOM Interfaces
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

## 21. Product possibilities

Potential product surfaces:

```txt
docs site
recipe gallery
platform inspector
Lab
visual authoring tool
recipe contract preview
AI evidence viewer
reading-field article template
collaboration dashboard
design-system plugin
DevTools extension
```

The strongest near-term product arc:

```txt
1. Platform-backed runtime
2. Platform Inspector
3. Recipe system
4. Executable Recipe Gallery
5. Reading Field and Evidence Field demos
6. Accessibility conformance
```

Do not start by adding more spectacle.

Start by making the system coherent, inspectable, and authorable.

## 22. Field cells and local fields

The global field should remain the default.

But local cells are useful for demos, previews, recipe cards, educational blocks, and isolated experiments.

Local field cells should obey these rules:

```txt
local cells are explicit
local cells do not accidentally fragment the global field
local cells are paused when offscreen
local cells are low-particle by default
local cells are semantic-safe
local cells expose their purpose
```

Examples:

```html
<field-cell recipe="priority-well"></field-cell>
<field-cell force="vortex"></field-cell>
<field-cell diagnostic="field-lines"></field-cell>
```

The possibility is a documentation system where every concept can carry its own small executable field.

## 23. Boundary and container possibilities

Containers should be able to express scope.

Recipes:

```txt
Boundary Field
Permission Boundary
Scope Lens
Availability Pressure
Field Contract Preview
```

Container behaviors:

```txt
valid items enter cleanly
invalid items resist or reflect
protected regions become visible on approach
scope is inspectable before mutation
drop zones communicate meaning through field pressure
```

This is especially useful for editors, admin tools, design systems, and enterprise apps.

## 24. Memory possibilities

Memory is one of the most important non-visual field concepts.

Memory can describe:

```txt
where the user paused
what was read
what was visited
what was recently edited
which source was used
where an error happened
where a process was interrupted
which path recovered state
```

Recipes:

```txt
Memory Trace
Reading Field
Selection Wake
Staleness Drift
Provenance Trail
Recovery Path
Version Gravity
Ambient Tutor
```

Possibility: software can remember in a visible, local, respectful way without turning everything into analytics.

## 25. The final possibility

The old model:

```txt
UI as isolated components with decorative transitions.
```

The field-ui model:

```txt
UI as a shared, inspectable field of meaning.
```

The possibility is not just better animation.

It is a new interface layer.

A layer where:

```txt
priority has gravity
difference has polarity
relationships have binding
change has decay
attention has memory
trust has coherence
conflict has charge
state has pressure
motion has cause
visuals have semantic sources
behavior can explain itself
```

That is the point of field-ui.

Not a physics toy.

Not a background effect.

A field model for interface meaning.