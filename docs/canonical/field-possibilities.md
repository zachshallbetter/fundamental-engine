# Field Possibilities

> **Status: canonical / possibility space.**
> This document describes what Fundamental can become beyond the current implementation. It is not the
> source of truth for shipped behavior — that lives in the package code, conformance tests, and the
> other canonical docs. This document exists to keep the wider idea space coherent and to give the
> shipped use cases their conceptual grounding.
>
> **Relationship to use-cases.md.** [`use-cases.md`](use-cases.md) is the shipped, narrative tier —
> concrete UI problems and how the field solves them today. This document is the conceptual framework
> beneath it: conditions, formations, recipe families, natural field translations, matter primitives,
> temporal fields, and alternative output surfaces. When a section here has a concrete shipped
> implementation, it links to the relevant use-cases section. Sections §26–§36 are
> **`[frontier]`** — not yet shipped; they define the research and long-range possibility space.
>
> **Vocabulary note (concepts vs runtime tokens).** Possibility language here is not the engine token
> set. The 36 real runtime tokens live in the [forces catalog](../engine-reference/forces-system.md).
> Concept words map to them: `vortex→swirl`, `drag→viscosity`, `emitter→spawn`, `spring→tether`,
> `reflect→wall`, `absorb→sink`, `phase`/`decay`→`morph`/`memory`. `mass` is a metric, `potential` a
> diagnostic; `fuse`/`fission`/`warp`/`wormhole` are not yet implemented.

## 0. Purpose

Fundamental is not a particle background.

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

Fundamental introduces a different model:

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
Fundamental   host-driven, renderer-agnostic field engine
@fundamental-engine/dom   browser host, DOM participation, measurement, state, feedback,   relationships, visual bindings, overlays, scheduling, linting
@fundamental-engine/elements   native HTML and web component authoring
@fundamental-engine/react   React adapter over the same contracts
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

→ *Shipped use cases: [use-cases.md §I](use-cases.md#i-universal-ui-patterns) (error gravity — `coherent`; reading weight — `dwell`; completion momentum — `coherent`), §II (urgency sorting — `stale`, `thresholded`; anomaly field — `thresholded`), §IX (staleness gradient — `stale`; dwell-driven mastery — `dwell`), §X (trust gradient — `trusted`; evidence field — `trusted`).*

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

→ *Shipped use cases: [use-cases.md §I](use-cases.md#i-universal-ui-patterns) (reading weight — `reading` formation; completion momentum — `coherence` formation), §IV (article topography — `reading` formation), §VII (kanban physics — `pressure` formation), §X (evidence field — `evidence` formation; conflict field — `conflict` formation), §XI (presence field — `presence` formation).*

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

→ *Shipped use cases: All concrete use cases in [use-cases.md](use-cases.md) map to named recipes — `Evidence Field`, `Trust Gradient`, `Presence Field`, `Memory Trace`, `Guided Flow`, `System Pulse`, `Relation Lens`, `Staleness Drift`, `Provenance Trail`, and more.*

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

The recipe set is the clearest way to make Fundamental usable.

It turns field theory into product patterns.

## 10. Data-bound fields

→ *Shipped use cases: [use-cases.md §II](use-cases.md#ii-data--dashboards) (anomaly field — `System Pulse` recipe; live data streams; relationship graphs) and §III (product gravity).*

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

→ *Shipped use cases: [use-cases.md §II](use-cases.md#ii-data--dashboards) (relationship graphs — `Relation Lens` recipe), §X (evidence field — source binding).*

The DOM is a tree, but interfaces are graphs.

Fundamental should continue moving toward relationship-native interface behavior.

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

A mature Fundamental surface should be able to answer:

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

→ *Shipped use cases: [use-cases.md §V](use-cases.md#v-the-invisible-field--signals-only) (focus-weight accessibility — the signals-only field is inherently reduced-motion safe; state without animation).*

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

→ *Shipped use cases: [use-cases.md §X](use-cases.md#x-ai--evidence-fields) (evidence field, trust gradient, provenance trail, conflict field) — "one of the strongest product directions."*

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

→ *Shipped use cases: [use-cases.md §XI](use-cases.md#xi-collaboration--shared-fields) (presence field, consensus well, handoff stream) and §VII (document co-presence).*

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

The web platform already gives Fundamental the raw materials.

But Fundamental also points toward missing platform primitives:

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

Fundamental can implement these today as a platform-adjacent layer.

Long-term, it can also serve as a working argument for what the web platform itself could grow.

The *runtime / host* expansion of this section — running the engine behind the `FieldHost` seam on
other languages, embedded targets, and the GPU, plus non-visual output surfaces — is catalogued in
[`../planning/platforms-and-use-cases-frontier.md`](../planning/platforms-and-use-cases-frontier.md)
(with dispatchable briefs on RC1 board #24).

## 20. Research possibilities

Fundamental can become a research artifact.

Possible research frame:

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

Longer-range product/runtime surfaces — new-language cores, headless/non-visual applications
(force-directed layout, embeddings clustering, agent steering), and new host platforms — are
catalogued in [`../planning/platforms-and-use-cases-frontier.md`](../planning/platforms-and-use-cases-frontier.md).

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

→ *Shipped use cases: [use-cases.md §IX](use-cases.md#ix-memory--temporal-fields) (reading history, dwell-driven mastery, interrupted path recovery, staleness gradient) and §IV (playlist gravity — accretion/`--load`).*

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

The Fundamental model:

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

That is the point of Fundamental.

Not a physics toy.

Not a background effect.

A field model for interface meaning.

## 26. Matter primitives beyond particles `[frontier]`

Particles are one way to sample the field.

They are not the only way.

The field is a continuous function over space. At any point there is a force vector, a density, a flow direction. Anything that can read a position and respond to a value can replace or augment particles.

Alternative matter primitives:

```txt
fluid       grid-based simulation (SPH or Eulerian); the field drives pressure and viscosity
fabric      a mesh of connected nodes; the field applies tension and compression across a surface
sand        granular matter that stacks, piles, and avalanches; bodies displace and settle
light       ray paths that bend through the field; strong bodies create gravitational lensing effects
```

### fluid

Instead of discrete particles, continuous fluid that pools, flows, and swirls around bodies.

Content sits in actual fluid.

The field drives viscosity, not just direction.

### fabric

A membrane of connected nodes.

Elements sit on a surface that physically deforms around heavy bodies.

Priority becomes visible as depression, not motion.

### sand

Granular matter that settles into heaps.

High-mass elements leave dunes.

Weak-field bodies erode.

Matter is displaced, not absorbed.

### light

Ray paths that curve through the field.

A strong gravity body bends light around it.

The field becomes visible through distortion of what is behind it, not through matter in front of it.

Each primitive answers a different question about the field.

Particles ask: where does matter flow?

Fluid asks: what is the pressure?

Fabric asks: how does the surface deform?

Sand asks: where does matter accumulate?

Light asks: how does the field distort what is already there?

## 27. Spatial representations beyond particles `[frontier]`

Render modes should not be limited to matter.

The field is a mathematical object. It has topology, gradients, equipotential surfaces, and flow lines.

These can be rendered directly without any particle simulation.

Possible spatial representations:

```txt
vector field glyphs      arrows at grid cells showing direction and magnitude; no particles
isosurfaces              equipotential contour lines around bodies; a topographic map of semantic weight
Voronoi territories      each body claims the nearest space, weighted by strength; living territory map
pure density heatmap     color encoding field intensity at every point; thermal imaging of semantic weight
interference patterns    multiple bodies emit waves; constructive interference becomes visible
streamline LIC           line integral convolution showing continuous flow structure
```

### vector field glyphs

The raw field topology made visible.

No particles. No simulation.

Just direction and magnitude at every cell.

Like wind maps, but for semantic space.

### isosurfaces

Bodies sit at the centers of concentric rings.

The field becomes a landscape.

Bodies are mountains and valleys.

Proximity and strength are visible as elevation, not position.

### Voronoi territories

The field becomes a living territory map.

Boundaries shift as bodies move or change strength.

Conflict becomes a visible contested boundary, not a separate visual layer.

Render doctrine still holds:

```txt
Renders reveal. They do not define behavior.
```

The topology of the field exists whether or not it is drawn.

## 28. Time-based representations `[frontier]`

The field currently exists in the present frame.

But time is a dimension of the field too.

Time-based render modes:

```txt
traces          accumulated particle paths; where matter has been, not where it is
history bloom   density of past positions; high-traffic corridors become bright lines
interference    wave emissions from multiple bodies; bands of constructive and destructive interference
cellular        each grid cell updates based on neighbors and local field value; bodies perturb the rules
decay maps      field intensity weighted by recency; recent influence is bright, old influence fades
```

### traces

Instead of where particles are now, show where they have been.

The field's history becomes visible as accumulated paths.

High-traffic corridors show up as bright lines.

Bodies that have moved leave contrails.

### interference

Multiple bodies emit waves.

Where waves constructively interfere, bright bands form.

Where they cancel, dark bands form.

The field becomes a diffraction pattern.

Semantically related bodies that emit in phase produce coherence.

Conflicting bodies produce visible destructive bands.

### cellular automata

Each cell of a grid updates based on its neighbors and the local field value.

The field drives the evolution rules.

Bodies are perturbations in the rules, not only force sources.

This is not a particle system.

It is a different class of emergence.

## 29. Alternative output surfaces `[frontier]`

The field does not have to be visual.

The field is a continuous function over space with vector values.

Any transducer that maps a value to a perceivable output can render the field.

Alternative output surfaces:

```txt
sound       field density maps to synthesis parameters; the field becomes audible
haptics     field intensity maps to vibration on mobile; the field is felt, not seen
typography  characters in the field deform based on local force; the words physically inhabit the field
AR / spatial  field extends into 3D space; physical objects become bodies; field bridges digital and physical
```

### sound

High-gravity zones produce low drones.

Electromagnetic regions create oscillating tones.

Weak-field zones produce release and silence.

The field becomes an ambient semantic soundscape.

This is not audio decoration.

It is a genuine accessibility and ambient awareness channel.

### haptics

Moving a finger through a strong-gravity region has physical resistance.

Crossing a boundary field creates a perceivable threshold.

The field is felt before it is seen.

### typography as matter

Characters are not glyphs on a grid.

They are matter in the field.

In a high-charge zone, characters spread.

In a gravity well, they compress.

The words physically inhabit the field.

This is not a CSS filter.

It is actual glyph-level deformation driven by field state.

### AR / spatial

The field extends into 3D space.

Physical objects tracked by the camera become bodies.

A real book on a desk creates a gravity well in the AR overlay.

The field bridges digital and physical.

Semantic relationships become visible in the room.

## 30. The field as machine-readable semantic layer `[frontier]`

Every element on the page has a position in pixel-space.

In a field page, every element also has a position in field-space.

Field-space encodes:

```txt
semantic weight
relational tension
dynamic state
flow direction
field density
influence range
```

This is a shared coordinate system that is spatially queryable and continuously maintained.

### The field as a communication protocol

Not between humans and UI.

Between agents.

An AI system, a service, or an autonomous process can query the field and understand the page without parsing the DOM.

Field queries:

```txt
What is the most important thing on this page right now?   find the deepest gravity well
What is this element most related to?                       follow the strong-force bonds from it
What path should I take through this content?              follow field flow at minimum resistance
What is in conflict here?                                   find regions of high charge separation
What is the current trust state of this claim?             read coherence at that body's position
```

This is not metadata.

It is not schema.org tags.

It is live, continuous, physics-based meaning that is always current because it is computed every frame.

### The field as a live knowledge graph

A database has an index.

A search engine has a vector space.

The field is a spatial index of semantic state — continuously maintained, instantly queryable.

Possible programmatic API:

```txt
field.queryAt(x, y)             → { density, direction, intensity, dominantBody }
field.pathBetween(a, b)         → minimum-resistance path through field space
field.dominantBody()            → body at the current global field minimum
field.bondsFrom(element)        → strong-force bonds from a given body
field.conflictsNear(element)    → charge separation and opposing domains
```

The field as infrastructure for entirely new kinds of interface intelligence.

## 31. The field as social substrate `[frontier]`

One field per page is a constraint, not a law.

### Shared fields

A shared field has multiple participants, each contributing bodies.

A collaborator's cursor is a body.

A collaborator's reading position is a body.

A selection is a body.

Everyone's presence creates field contributions that sum.

### Collective semantic gravity

What emerges is not cursor chat.

It is collective semantic gravity.

Where many people are reading, a gravity well forms.

Where attention flows, streamlines emerge.

A controversial paragraph shows electromagnetic polarity — people polarized into two charge domains, their competing attention visible in field topology.

You can see what a document means to a room of people.

Not as a click heatmap.

As a live field where meaning and attention are physics.

### Presence as field contribution

Collaborative behaviors:

```txt
collaborator focus emits signal
reading position creates local density
dwell time increases mass at that region
disagreement creates charge separation
consensus creates coherence and mass
departure leaves a cooling memory trace
```

This extends section 17 (collaboration possibilities) from cursors and avatars to field participants.

## 32. The field as accumulating memory `[frontier]`

The field currently exists only in the present frame.

Particles have no history.

But a field that accumulates — that remembers where attention has been, where matter has flowed, where bodies have moved — becomes a semantic sediment.

### Pages that deform under use

High-traffic corridors develop lower resistance.

Neglected regions gradually lose charge.

The page ages in a physically meaningful way, shaped by how it has been inhabited.

This is not analytics.

Analytics are external, discrete, and after-the-fact.

Semantic sediment is local, continuous, and immediately legible.

### Memory as field state

Memory behaviors:

```txt
frequently visited regions develop lower resistance
dwelled sections gain mass
neglected regions cool and lose charge
read paths leave visible traces
recovered paths return to warmth
interrupted paths show where attention broke
```

Bring a user back to a page and the field is already warm in the places they have been.

Cold in the places they have not.

The field is a map of prior attention.

Possibility: software can remember in a visible, local, respectful way without turning everything into analytics.

This extends section 24 (memory possibilities) from discrete markers to continuous field state.

## 33. The field applied to time `[frontier]`

The field currently spans 2D space.

But time is a dimension too.

### Temporal fields

A temporal field has bodies not just at positions but at moments.

An event has a position in time-space.

Related events are bound by strong force.

Causal chains follow field flow.

Concurrent events repel or attract based on semantic relationship.

### Navigating time as a field

A timeline is not a line.

It is a field over time.

Navigating it means following force gradients.

Zoom into a high-density region and you are zooming into a moment of high semantic activity.

Pull back and the field coarsens into epochs.

Temporal field behaviors:

```txt
causal chains form flow paths
concurrent events attract or repel based on semantic relationship
high-activity moments create gravity wells
long spans with few events become low-density sparse regions
corrections and revisions overwrite memory at a position in time
contested moments show charge separation
```

This is a genuinely different way to encode temporal relationships.

Proximity in time-space means something based on meaning, not calendar distance.

## 34. The field as authoring primitive `[frontier]`

Right now designers work in static space.

They arrange elements, define transitions, write rules.

The field inverts this.

You define the physics.

The layout emerges.

### Authoring relationships, not positions

Old model:

```txt
where should this go?
```

New model:

```txt
how should this relate?
```

You do not position a sidebar.

You give the main content high gravity and the sidebar moderate gravity.

They find their equilibrium.

You do not animate a menu opening.

You give it a charge that, when activated, repels its children into visible positions.

### Responsive as field response

Different viewport sizes produce different field configurations.

The same semantic forces produce different spatial equilibria at different scales.

Responsive design becomes field response.

The author writes the meaning relationships.

The field solves the geometry.

### Implications for design tooling

A field-native authoring tool would expose:

```txt
body mass and range sliders
natural field type selector
relationship graph editor
formation picker
equilibrium preview
accessibility equivalent preview
```

Not:

```txt
x position
y position
margin
padding
animation timing
```

This extends section 18 (authoring possibilities) from a recipe editor to a fully field-native design model.

## 35. Emergent semantics `[frontier]`

A simple field has a few bodies and produces simple dynamics.

A complex field — many bodies, many forces, feedback loops between field state and body behavior — can produce emergent semantic behavior.

Patterns that were not programmed.

Attractor states that correspond to meaningful configurations.

Phase transitions when a new body enters or leaves.

### What emergence looks like in a field

Possible emergent behaviors:

```txt
attractor states          the field settles into stable configurations around certain body arrangements
phase transitions         a new body tips the field into a different global organization
self-organizing structure bodies find equilibrium arrangements without explicit positioning rules
resonance                 bodies at compatible ranges and strengths amplify each other's effects
cascading release         a sink body reaching capacity triggers a chain of redistribution events
```

### Not artificial intelligence

Artificial intelligence encodes meaning in weights.

Emergent semantics is different.

It is a medium that organizes meaning through physics.

Structure arises from interaction, not from encoding.

Not artificial intelligence.

Not a simulation.

A field model where meaning has dynamics.

## 36. The projection problem `[frontier]`

Every interface ever built is a projection.

A flat map of a high-dimensional semantic space.

Menus are projections.

Search is a projection.

Feeds are projections.

### What projections lose

The projection loses information:

```txt
the relationship between the thing being read and the thing searched three days ago
the tension between two articles that contradict each other
the gravity of something important that has been avoided
the path that was most traveled and the path that was never taken
the coherence building across a form that is almost complete
the conflict that has been accumulating in a document over multiple edits
```

This information exists.

It is recoverable.

It is not stored anywhere visible.

### What the field recovers

The field is a substrate that makes this information perceptible.

Not inferable.

Perceptible.

```txt
priority becomes gravity
relationship becomes binding
conflict becomes charge separation
importance becomes convergence
change becomes decay and transformation
attention becomes density and memory
trust becomes coherence
risk becomes pressure
```

The field does not add new information.

It makes existing semantic structure visible as physics.

That is a different claim than most UI systems make.

Most systems claim to present information.

Fundamental claims to reveal the structure underneath it.

### The new medium

Every new medium recovered information that previous media lost.

Writing recovered speech across time.

Maps recovered spatial relationships across scale.

Photography recovered visual appearance across memory.

The field recovers semantic relationships across the interface surface.

Not a particle system.

Not a background effect.

Not a physics toy.

A medium for semantic structure — where meaning has forces, relationships have dynamics, and the interface can explain itself because it has physics.