# Use Cases

> **How the field earns its place in real products.**
>
> These are not demos. Each use case describes a real UI problem, what the field does
> structurally to solve it, and what it enables that wasn't possible — or wasn't
> tractable — before.
>
> **Relationship to field-possibilities.md.** This document is the shipped, narrative
> tier — concrete UI problems and how the field solves them today. The conceptual
> framework beneath it (conditions, formations, recipe families, natural field
> translations, matter primitives, temporal fields, alternative output surfaces) lives
> in [`field-possibilities.md`](field-possibilities.md). When a use case references a
> condition, formation, or recipe name, that's where the definition lives. When a
> section in `field-possibilities.md` has a concrete shipped example, it links back here.
>
> The `/use-cases` site page is built from this document.

The field is a **substrate, not wallpaper**. The use cases below are organized by how
they tend to land with different audiences. Start with §I (universal UI patterns) and
§V (invisible field) — those two sections carry the pitch. The later sections are
depth for specific domains and emerging capabilities.

---

## I. Universal UI Patterns

These apply to any product in any stack. They are the "oh, I get it" tier — the
examples that make the model click for someone who has never seen Fundamental before.

→ *Conceptual grounding: [`field-possibilities.md §1`](field-possibilities.md#1-the-paradigm-shift) (the paradigm shift), §7 (formations), §8 (recipes as the main possibility unit).*

### Weighted Navigation

Links carry mass proportional to their semantic importance. Primary nav items pull
harder than secondary ones; the active section is a gravity well. As the user scrolls
a long page, the corresponding nav item draws field density toward it automatically —
no IntersectionObserver callback, no scroll-position arithmetic.

**What the field does:** each nav anchor is a `data-body="attract"` body; body
strength is set by editorial priority (`data-strength`). The current-section link
gains an amplified `data-active` state; the field reads engagement and redistributes
density. `--field-density` drives a CSS highlight on the active item.

**Why it's better:** the alternative is a bespoke scroll-spy: observe every section,
update active class on entry, handle edge cases for fast scrolls. The field collapses
that to a data attribute and a CSS variable binding.

---

### Attention Hierarchy

On any page with a primary CTA, that element is the dominant body. Everything else
carries lighter mass. Particles drift toward the action. Users don't consciously
notice the field — they notice their eye goes where it should.

**What the field does:** the CTA is `data-body="gravity" data-strength="1.5"`. The
headline is `data-body="attract" data-strength="0.8"`. Supporting copy is unregistered
or carries minimal mass. Density naturally accumulates at the CTA.

**Why it's better:** CSS z-index and size can express hierarchy visually but not
spatially. The field makes the CTA a genuine attractor — particles and user attention
follow the same gradient.

---

### Error Gravity

Form fields are neutral bodies until validation runs. An error state converts a
field's charge — the element becomes urgent, field density pulls toward it, and the
`--field-density` spike drives a CSS transition on the border or label. The user's
attention is physically redirected to the problem without a `focus()` call or
scroll-into-view.

**What the field does:** on validation failure, the field's body strength is elevated
programmatically (`field.setBodyStrength(el, 1.8)`). The error body competes for
density against other page bodies and wins. On resolution, strength returns to
baseline. The `coherent` condition (`field-possibilities.md §6`) can detect when all
required fields are valid and fire a completion event.

**Why it's better:** traditional validation highlights a field and adds an error
message, but doesn't move attention spatially. The field applies physical pressure
toward the problem — more useful in long forms with many fields.

---

### Reading Weight

A long-form article where pull quotes and key terms carry mass. Particles cluster
near editorially heavy content. As the reader moves through the page, the field
re-orients to whatever high-mass elements are in the viewport.

→ *Recipe: `Reading Field` — see [`field-possibilities.md §7`](field-possibilities.md#7-formations) (reading formation) and §24 (memory possibilities).*

**What the field does:** `<blockquote>` and `<strong>` elements receive
`data-body="attract"` with varying `data-strength`. As they scroll into viewport,
their engagement amplifies their pull. `--field-density` can drive a subtle background
warmth on key passages. Combine with the `dwell` condition
(`field-possibilities.md §6`) to accumulate memory at passages the reader revisits.

**Why it's better:** scroll-driven animations highlight content as it enters, then
stop. The field stays live — it responds to where the reader is, not just to whether
content has crossed a threshold.

---

### Completion Momentum

Multi-step flows — checkout, onboarding, wizard — where each completed step releases
its gravity and the next step's gravity increases. The submit button at the end of a
long form is the strongest body on the page.

→ *Recipe: `Guided Flow` — see [`field-possibilities.md §7`](field-possibilities.md#7-formations) (coherence formation) and §6 (coherent condition).*

**What the field does:** steps are registered bodies with strength 0 (neutral) until
active. The active step has strength 1; the next step has latent strength 0.4.
Completed steps drop to 0.1. The field topography always tilts toward what is coming.

**Why it's better:** progress bars tell you where you are. The field tells you where
to go.

---

## II. Data & Dashboards

The field as a live metric layer — a spatial representation of data that sits beneath
the visual one.

→ *Conceptual grounding: [`field-possibilities.md §10`](field-possibilities.md#10-data-bound-fields) (data-bound fields), §11 (relationship possibilities), §30 (the field as machine-readable semantic layer).*

### Anomaly Field

A status dashboard where each service's body strength is proportional to its error
rate or latency percentile. A healthy service is a low-mass body. A spiking service
becomes a gravity well. Particles cluster there before any human has clicked anything.

→ *Recipe: `System Pulse` — see [`field-possibilities.md §10`](field-possibilities.md#10-data-bound-fields) (data-bound fields: live data source → body strength mapper).*

**What the field does:** body strength is updated from a live data source on each
tick via `field.setBodyStrength(el, normalized_rate)`. The field's density
distribution acts as a heat signature across the dashboard. `--field-density` can
drive a visual overlay on the affected service tile.

**Why it's better:** you see the incident before you read the number. The field
creates spatial pre-attention — you know where to look before you consciously process
the dashboard.

---

### Urgency Sorting

Task lists, ticket queues, support queues — items with escalating urgency accumulate
mass. The field creates a second ordering layer that doesn't conflict with the
explicit DOM order. A P0 ticket buried in a long list pulls harder than the P2 at
the top.

→ *Conditions: `stale`, `thresholded` — see [`field-possibilities.md §6`](field-possibilities.md#6-conditions).*

**What the field does:** `data-strength` is set from priority level. Overdue tickets
get an additional charge boost from `data-body="attract charge"`. The field density
surface reveals pressure pockets that the list sort doesn't.

**Why it's better:** sorting a list by priority changes the order. The field shows
you the pressure within the current order — useful when reordering isn't possible
(e.g., time-ordered queues).

---

### Live Data Streams

Real-time feeds where incoming events create field disturbances. A new message, a
stock tick, a sensor reading — each body momentarily increases its charge. In
aggregate, a busy channel hums differently from a quiet one without any explicit
visualization.

→ *See [`field-possibilities.md §10`](field-possibilities.md#10-data-bound-fields) (data-bound fields: real-time event binding).*

**What the field does:** on each incoming event, the corresponding body's strength
spikes and decays over N frames via a tween on `data-strength`. The field's aggregate
density encodes channel activity as a physical texture the user perceives peripherally.

**Why it's better:** notification badges count. The field shows cadence — whether
activity is bursty or steady, dense or sparse — information a count can't carry.

---

### Relationship Graphs

Graph nodes whose edge weights map to field relationships. The field adds a
behavioral layer on top of an existing layout (d3-force, ELK, manual). Hover a node
and the field reveals strongly connected neighbors through how intensely they respond.

→ *Recipe: `Relation Lens` — see [`field-possibilities.md §11`](field-possibilities.md#11-relationship-possibilities) (relationship behaviors: support, dependency, evidence) and §30 (field queries API).*

**What the field does:** edge weights become `data-field-relation` values between
body pairs. The RelationshipRegistry propagates influence; strongly connected nodes
co-activate. `--field-density` drives neighbor highlight intensity.

**Why it's better:** traditional graph hover highlights adjacent nodes by class
toggle. The field propagates through the graph — second-degree connections also
respond, weighted by path strength. The topology becomes tactile.

---

## III. Commerce & Products

### Product Gravity

In a product grid, `rating × review_count` maps to body strength. The hero product
is a gravity well. Promoted items carry elevated mass from an explicit editorial
override — different truth mode (`designed`) from organic rating mass (`physical`),
so the distinction is structurally honest.

→ *See [`field-possibilities.md §4`](field-possibilities.md#4-designed-forces-and-natural-translations) (designed vs. natural translations) and §10 (data-bound fields).*

**What the field does:** `data-strength` is set server-side from product data. The
promoted item gets `data-truth="designed"` to distinguish editorial weight from user
signal. CSS responds to `--field-density` with a subtle card glow.

---

### Cart Magnetism

The cart indicator in a nav is a charged body. Add an item and its charge spikes —
particles briefly surge toward the cart, then settle. The cart's field state IS the
cart state, not a copy of it.

**What the field does:** cart item count maps directly to `data-strength`. The cart
icon is `data-body="attract"`. On item add, `dispatchBodyThreshold` fires at
strength > 1.0 to trigger a confirmation animation driven by the field event, not a
timeout.

---

### Inventory Urgency

"Only 3 left" — low stock makes a body's charge spike. When stock hits zero, the
charge drops. Urgency is structural, not cosmetic.

→ *Condition: `thresholded` — see [`field-possibilities.md §6`](field-possibilities.md#6-conditions).*

**What the field does:** `data-strength` is derived from
`max(0, 1 - (stock / max_stock))`. Critically low stock triggers
`data-body="attract charge"` — the attract pull is urgency; the charge is the
"electric" quality of scarcity.

---

### Comparison Pull

Side-by-side product comparison where the item with more "winning" attributes has
higher aggregate mass. The field tips the decision spatially. Users don't consciously
read the physics — they feel which option is heavier.

**What the field does:** each comparison column's body strength is the sum of its
winning attribute scores, normalized. The field creates a spatial lean toward the
dominant option that precedes the user's conscious comparison.

---

## IV. Media & Content

### Playlist Gravity

The currently playing track is a dominant gravity well. Related tracks are attracted
bodies. The densest region of the playlist is where you keep returning — play count
= accumulated mass; this is accretion in the Body Matter Interaction model.

→ *Recipe: `Memory Trace` — see [`field-possibilities.md §24`](field-possibilities.md#24-memory-possibilities) and §32 (the field as accumulating memory).*

**What the field does:** `data-absorb` on the current track; absorbed particle count
(via `--load`) represents accumulated play history. Related tracks carry
`data-body="attract"` with strength proportional to audio feature similarity.

---

### Gallery Focus

A photo or project gallery where the featured piece has dominant mass. Hover
transitions are driven by the body's engagement state rather than `:hover` CSS.

**What the field does:** hover triggers `data-active` on the hovered item, amplifying
its pull. All gallery items are `[data-feedback]`; their `--d` values drop as density
concentrates at the active item. CSS maps `--d` to `opacity` or `filter: brightness`.

---

### Article Series / Content Topography

A collection of posts where each article's body strength is its view count or
normalized read time. On a category page, the field creates a content topography.

→ *Formation: `reading` — see [`field-possibilities.md §7`](field-possibilities.md#7-formations).*

**What the field does:** view count maps to `data-strength`. The field's density
distribution over the article grid is a spatial representation of readership.

---

## V. The Invisible Field — Signals Only

> This is the architectural shift that most people miss.

Since the signals-first change (#538), the field's default `render` mode is `'none'`. No canvas. No particles.
The full simulation runs and writes its results as CSS variables (`--field-density`,
`--d`, `--load`, `--field-attention`) to every `[data-feedback]` element. Your
existing CSS consumes them.

→ *Architectural grounding: [`field-possibilities.md §13`](field-possibilities.md#13-render-possibilities) (render possibilities — signals-only is one mode among many) and §0 (purpose: "the system is larger than the canvas").*

**The field is not a particle effect. It is a pressure system that drives your design
system.**

---

### Ambient Typography

Font weight, letter spacing, or color temperature driven by `--field-density`. Near
a high-mass heading, body text gets fractionally heavier. No canvas exists. The field
is a semantic pressure gradient that your typographic CSS responds to.

**What the field does:** `--d` (the compact alias for `--field-density`) is written
to every `[data-feedback]` body each frame. CSS maps it:
`font-weight: calc(400 + var(--d) * 200)`. No JavaScript in the style path.

---

### Focus-Weight Accessibility

The focused element is the engaged body — the strongest local gravity source. Tab
traversal creates a moving gravity well. CSS on `[data-feedback]` elements responds
to `--d` with color, shadow, or scale changes driven by proximity to focus.

→ *See [`field-possibilities.md §15`](field-possibilities.md#15-accessibility-possibilities) for the full accessibility contract every recipe should define (motion, reduced-motion, keyboard, screen-reader equivalents).*

For reduced-motion users: the field still writes the CSS variables. Motion is one
consumer; color is another. Disable the particle canvas and the CSS color response
remains — the field continues to carry semantic weight through hue and value rather
than movement.

---

### State Without Animation

A toggle's state is a field charge flip. Checked: positive charge, surrounding
elements respond. Unchecked: neutral. No keyframes, no JavaScript class toggling,
no transition timings to coordinate. The field carries state into style directly.

---

### Semantic Content Structure

`<h1>` carries more mass than `<h2>` than `<p>`. The field encodes document
outline as spatial weight. Screen readers consume the markup; the field renders the
same hierarchy as a physical pressure map. Both come from the same HTML.

→ *See [`field-possibilities.md §36`](field-possibilities.md#36-the-projection-problem-frontier) (the projection problem: the field recovers semantic relationships the flat interface loses) and §1 (the paradigm shift).*

---

## VI. Narrative & Immersive

### Scrollytelling

A data story where scrolling through sections changes which body is dominant. No
scroll-jacking, no IntersectionObserver farm, no manual step management.

→ *Input agent: `ScrollAgent` — see [`field-possibilities.md §12`](field-possibilities.md#12-input-agents).*

**What the field does:** each chapter's key element is a `data-body` with high
strength. Engagement amplification re-orients the field continuously as sections
enter and exit.

---

### Interactive Fiction

A branching narrative where choices carry accumulated attention weight. The option
the user has hovered longest has more mass. The field is a memory of the user's
attention during the choice.

→ *Condition: `dwell` — [`field-possibilities.md §6`](field-possibilities.md#6-conditions). Memory: §24 and §32.*

---

### Museum / Exhibition

A digital archive where artifacts carry historical weight: date range, cultural
significance, acquisition cost → body strength. Moving through the collection, the
field creates a topography of importance.

→ *Recipe: `Semantic Gravity Map` — see [`field-possibilities.md §9`](field-possibilities.md#9-the-64-recipe-possibility-map) and §10 (data-bound fields).*

---

## VII. Productivity & Tools

### Kanban Physics

A kanban board where blocked or overdue cards accumulate urgency mass. The board's
field density distribution shows where bottlenecks are without a filter or sort.

→ *Formation: `pressure` — [`field-possibilities.md §7`](field-possibilities.md#7-formations). Conditions: `stale`, `thresholded` from §6. Boundary: §23 (Permission Boundary for column scope).*

---

### Document Co-presence

A collaborative document where each active cursor is a charged body. Dense regions
are where people are working. An idle cursor loses charge over time.

→ *Recipe: `Presence Field` — [`field-possibilities.md §17`](field-possibilities.md#17-collaboration-possibilities) and §31 (the field as social substrate). See also §XI below.*

---

### Code Review Gravity

A diff view where modified files have mass proportional to change size. The file
tree's field density shows where the bulk of the review is before opening anything.

→ *See [`field-possibilities.md §10`](field-possibilities.md#10-data-bound-fields) (data-bound fields) and §34 (the field as authoring primitive).*

---

## VIII. Only Fundamental Can Do This

These are capabilities with no clean analogy in CSS, JavaScript event systems, or
existing animation libraries.

### Reciprocal UI

The DOM affects the field AND the field affects the DOM. The loop is closed. Most
"physics" UI is one-way — cursor moves, effect responds. Fundamental's two-way
binding means a button that has been hovered many times has accumulated interaction
history as field density. The UI responds to its own usage pattern.

→ *Architectural grounding: [`field-possibilities.md §1`](field-possibilities.md#1-the-paradigm-shift) (feedback returns state to the DOM — closing the loop) and §32 (the field as accumulating memory).*

---

### Truth Mode Mixing

A pricing page where the recommended tier's mass is `designed` (deliberately elevated,
bounded by editorial choice) while user review scores drive `physical` mass (true
physics, potentially unbounded). Both operate in the same field. The spatial tension
between editorial intent and user signal is physically visible.

→ *See [`field-possibilities.md §4`](field-possibilities.md#4-designed-forces-and-natural-translations) (designed forces vs. natural translations) and §27 (interference patterns).*

---

### Composed Force Personalities

`data-preset="blackhole"` combines `attract + sink`. `data-body="attract charge warp"`
pulls, has polarity, and bends the space around it. These combinations produce
emergent field shapes that are impossible to replicate with CSS alone.

→ *See [`field-possibilities.md §8`](field-possibilities.md#8-recipes-as-the-main-possibility-unit) (recipes as the main possibility unit) and §35 (emergent semantics).*

---

### Multi-Plane Fields

Three independent container fields on one page — one per section, none sharing
particles. `bounds: el` scopes a field to one DOM subtree. Zero interference.

→ *See [`field-possibilities.md §22`](field-possibilities.md#22-field-cells-and-local-fields) (field cells and local fields) and §23 (boundary and container possibilities).*

---

## IX. Memory & Temporal Fields

The field currently exists in the present frame. Extending it backward (memory) and
forward (prediction) opens a distinct class of use cases.

→ *Conceptual grounding: [`field-possibilities.md §24`](field-possibilities.md#24-memory-possibilities) (memory possibilities), §32 (the field as accumulating memory), §33 (the field applied to time).*

### Reading History

A page that is warmer in the places a user has been. High-traffic corridors develop
lower resistance. Neglected regions cool. The page ages in a physically meaningful
way, shaped by how it has been inhabited — not as analytics (external, discrete,
after-the-fact) but as semantic sediment (local, continuous, immediately legible).

→ *Recipes: `Memory Trace`, `Reading Field`, `Staleness Drift` — [`field-possibilities.md §24`](field-possibilities.md#24-memory-possibilities).*

---

### Dwell-Driven Mastery

An educational or documentation surface where sections gain accumulated mass through
repeated attention. A concept the user has revisited five times is heavier than one
they skimmed. The field shows which ideas have been internalized and which still
carry unresolved weight.

→ *Condition: `dwell` — [`field-possibilities.md §6`](field-possibilities.md#6-conditions).*

---

### Interrupted Path Recovery

The user left mid-flow. The field has memory of where they were. When they return,
the uncompleted step is already the dominant body — attention is pulled there before
they consciously re-orient.

→ *Recipe: `Recovery Path` — [`field-possibilities.md §24`](field-possibilities.md#24-memory-possibilities).*

---

### Staleness Gradient

A dashboard or document where the recency of data or edits decays continuously.
Recently updated items are bright bodies; older items cool and lose charge. Staleness
is visible as field entropy — not a "last updated" timestamp, but a spatial warmth
gradient across the surface.

→ *Condition: `stale` — [`field-possibilities.md §6`](field-possibilities.md#6-conditions). Recipe: `Staleness Drift`.*

---

## X. AI & Evidence Fields

AI outputs contain claims, sources, confidence, uncertainty, contradiction, revision,
memory, and provenance. Field recipes can make these structural properties visible
without decorating them as badges or tooltips.

→ *Conceptual grounding: [`field-possibilities.md §16`](field-possibilities.md#16-ai-and-evidence-possibilities) ("one of the strongest product directions"). Formation: `evidence` — §7.*

### Evidence Field

Claims become bodies. Sources bind to them — strong sources pull closer, weak sources
orbit at distance. Contradictory sources repel. Verified claims gain coherence and
mass. Unverified claims remain unstable, visibly unsettled in the field.

→ *Recipe: `Evidence Field` — [`field-possibilities.md §7`](field-possibilities.md#7-formations) (evidence formation) and §9 (recipe catalog).*

**What the field does:** each claim is a `data-body` whose strength is its confidence
score. Each source is a related body with `data-field-relation` to the claim it
supports. Contradicting sources carry opposing charge. `--field-density` at the claim
body reflects aggregate support.

**Why it matters:** AI interfaces currently show confidence as a percentage or color
label. The field makes confidence spatial and relational — you see which claims are
well-supported, which are contested, and where the uncertainty lives before you read
a single number.

---

### Trust Gradient

A research or fact-check surface where the spatial distribution of field density
reflects source quality. High-authority sources are strong bodies. The gradient
across the page is the trust landscape.

→ *Condition: `trusted` — [`field-possibilities.md §6`](field-possibilities.md#6-conditions). Recipe: `Trust Gradient`.*

**What the field does:** source authority maps to `data-strength`. Sources with
corroborating claims form clusters — the field shows where consensus is dense and
where it's sparse.

---

### Provenance Trail

A generated document where each passage carries the origin of its content — which
source it came from, how confident the model was, whether it was checked. The field
makes provenance visible as a texture.

→ *Recipe: `Provenance Trail` — [`field-possibilities.md §16`](field-possibilities.md#16-ai-and-evidence-possibilities) and §9.*

**What the field does:** passages receive `data-truth` modes reflecting their
provenance (`physical` for empirically sourced, `poetic` for generated without a
specific source). CSS on `[data-feedback]` elements uses `--d` to express the
difference as a quality of presence, not a label.

---

### Conflict Field

A document or interface with contested information — two sources that contradict each
other, two recommendations that conflict. The field holds the contradiction in visible
tension rather than collapsing it into a resolved state.

→ *Formation: `conflict` — [`field-possibilities.md §7`](field-possibilities.md#7-formations). Recipes: `Conflict Field`, `Disagreement Charge`.*

**What the field does:** conflicting bodies carry opposing charge
(`data-body="charge"`). The field maintains charge separation between them. The
region between conflicting claims has measurable field tension. CSS can drive a
visible "contested zone" without any explicit boundary markup.

---

## XI. Collaboration & Shared Fields

Collaboration can move beyond cursors and avatars when multiple participants'
attention becomes field contributions that sum.

→ *Conceptual grounding: [`field-possibilities.md §17`](field-possibilities.md#17-collaboration-possibilities) (collaboration possibilities) and §31 (the field as social substrate — "collective semantic gravity").*

### Presence Field

Each active collaborator's focus is a charged body. A paragraph where three people
are reading simultaneously is demonstrably denser than one where nobody is. Departure
leaves a cooling Memory Trace.

→ *Recipe: `Presence Field` — [`field-possibilities.md §17`](field-possibilities.md#17-collaboration-possibilities) and §31.*

**What the field does:** each active cursor is registered as a transient
`data-body="attract"` at its current position. All collaborator bodies sum. Dense
regions reveal where attention is concentrated. An idle cursor loses charge over time.

---

### Consensus Well

A voting or review surface where agreement accumulates mass. Items with growing
consensus pull toward a stable gravity well. Items with persistent disagreement show
charge separation — two camps of opposing charge, visible as a split field topology.

→ *Recipes: `Consensus Well`, `Disagreement Charge` — [`field-possibilities.md §17`](field-possibilities.md#17-collaboration-possibilities).*

---

### Handoff Stream

In a collaborative workflow, ownership changes create directional field flow — the
field carries work from one contributor's domain to another. The handoff is visible
as current, not just as a status update.

→ *Recipes: `Handoff Stream`, `Dependency Tension` — [`field-possibilities.md §17`](field-possibilities.md#17-collaboration-possibilities).*

---

## Appendix: Use Case × Engine Capability Matrix

| Use Case | Forces | Feedback | Relationships | Signals-only | Truth Mode | Key Condition / Formation |
|---|---|---|---|---|---|---|
| Weighted navigation | attract | ✓ | — | ✓ | designed | inview |
| Error gravity | attract, charge | ✓ | — | ✓ | designed | coherent |
| Reading weight | attract | ✓ | — | ✓ | semantic | dwell, inview |
| Completion momentum | gravity, attract | ✓ | — | ✓ | designed | coherent |
| Anomaly field | gravity | ✓ | — | ✓ | physical | thresholded |
| Urgency sorting | attract, charge | ✓ | — | ✓ | physical | stale |
| Live data streams | attract | ✓ | — | ✓ | physical | thresholded |
| Relationship graphs | attract | ✓ | ✓ | — | physical | related |
| Product gravity | gravity | ✓ | — | ✓ | hybrid | — |
| Cart magnetism | attract | ✓ | — | — | designed | thresholded |
| Playlist gravity | sink | ✓ | attract | — | physical | dwell |
| Ambient typography | — | ✓ | — | ✓ | semantic | — |
| Focus-weight a11y | — | ✓ | — | ✓ | designed | focused |
| Scrollytelling | gravity | ✓ | — | ✓ | designed | inview |
| Kanban physics | attract, charge | ✓ | — | ✓ | physical | stale, pressure |
| Co-presence | attract | ✓ | — | ✓ | hybrid | — |
| Reading history | — | ✓ | — | ✓ | physical | dwell |
| Staleness gradient | — | ✓ | — | ✓ | physical | stale |
| Evidence field | attract, charge | ✓ | ✓ | ✓ | physical | trusted |
| Trust gradient | gravity | ✓ | ✓ | ✓ | hybrid | trusted |
| Conflict field | charge | ✓ | ✓ | ✓ | physical | conflicted |
| Consensus well | gravity, charge | ✓ | — | ✓ | physical | coherent |
| Reciprocal UI | any | ✓ | — | ✓ | hybrid | dwell |
| Multi-plane fields | any | ✓ | — | ✓ | any | — |

---

## Status

`draft: true` — source material for the `/use-cases` site page. Update status to
`published` when the site page ships and links back here. The site page should
present §I–§V as the main narrative (the pitch), §VI–§VIII as depth, and §IX–§XI
as the emerging capabilities tier.
