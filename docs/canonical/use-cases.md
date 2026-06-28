# Use Cases

> **How the field earns its place in real products.**
>
> These are not demos. Each use case describes a real UI problem, what the field does
> structurally to solve it, and what it enables that wasn't possible — or wasn't
> tractable — before. The `/use-cases` site page draws directly from this document.

The field is a **substrate, not wallpaper**. The use cases below are organized by
how they tend to land with different audiences. Start with §1 (universal UI patterns)
and §5 (invisible field) — those two sections carry the pitch. Everything else is
depth for specific domains.

---

## I. Universal UI Patterns

These apply to any product in any stack. They are the "oh, I get it" tier — the
examples that make the model click for someone who has never seen Fundamental before.

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
baseline.

**Why it's better:** traditional validation highlights a field and adds an error
message, but doesn't move attention spatially. The field applies physical pressure
toward the problem — more useful in long forms with many fields.

---

### Reading Weight

A long-form article where pull quotes and key terms carry mass. Particles cluster
near editorially heavy content. As the reader moves through the page, the field
re-orients to whatever high-mass elements are in the viewport. The "heaviest"
paragraph is objectively the one with the most body-dense region.

**What the field does:** `<blockquote>` and `<strong>` elements receive
`data-body="attract"` with varying `data-strength`. As they scroll into viewport,
their IntersectionObserver-driven engagement amplifies their pull. `--field-density`
can drive a subtle background warmth on key passages.

**Why it's better:** scroll-driven animations highlight content as it enters, then
stop. The field stays live — it responds to where the reader is, not just to whether
content has crossed a threshold.

---

### Completion Momentum

Multi-step flows — checkout, onboarding, wizard — where each completed step releases
its gravity and the next step's gravity increases. The user feels pulled forward
through the flow because they literally are. The submit button at the end of a long
form is the strongest body on the page.

**What the field does:** steps are registered bodies with strength 0 (neutral) until
active. The active step has strength 1; the next step has latent strength 0.4.
Completed steps drop to 0.1. The field topography always tilts toward what is coming.

**Why it's better:** progress bars tell you where you are. The field tells you where
to go.

---

## II. Data & Dashboards

The field as a live metric layer — a spatial representation of data that sits beneath
the visual one.

### Anomaly Field

A status dashboard where each service's body strength is proportional to its error
rate or latency percentile. A healthy service is a low-mass body. A spiking service
becomes a gravity well. Particles cluster there before any human has clicked anything.
The dashboard doesn't just display data; the field responds to it.

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

**What the field does:** `data-strength` is set from priority level. Overdue tickets
get an additional charge boost from `data-body="attract charge"`. The field density
surface reveals pressure pockets that the list sort doesn't.

**Why it's better:** sorting a list by priority changes the order. The field shows
you the pressure within the current order — useful when reordering isn't possible
(e.g., time-ordered queues).

---

### Live Data Streams

Real-time feeds where incoming events create field disturbances. A new message, a
stock tick, a sensor reading — each body momentarily increases its charge. The field
settles between events. In aggregate, a busy channel hums differently from a quiet
one without any explicit visualization.

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
Click and the subgraph lights up through density propagation.

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
is a gravity well. Scroll past and the field re-orients to whatever high-mass items
enter the viewport. Promoted items carry elevated mass from an explicit editorial
override — different truth mode (`designed`) from organic rating mass (`physical`),
so the distinction is structurally honest.

**What the field does:** `data-strength` is set server-side from product data. The
promoted item gets `data-truth="designed"` to distinguish editorial weight from user
signal. CSS responds to `--field-density` with a subtle card glow.

**Why it's better:** a "Sponsored" badge tells users an item is promoted. The field
shows you the genuine rating distribution spatially — you can feel where the community
consensus sits even before you read stars.

---

### Cart Magnetism

The cart indicator in a nav is a charged body. Add an item and its charge spikes —
particles briefly surge toward the cart, then settle. Remove an item and charge drops.
When the cart is empty it's neutral. The cart's field state IS the cart state, not a
copy of it.

**What the field does:** cart item count maps directly to `data-strength`. The cart
icon is `data-body="attract"`. On item add, `dispatchBodyThreshold` fires at strength
> 1.0 to trigger a confirmation animation driven by the field event, not a timeout.

**Why it's better:** the typical "item added" micro-interaction is a bespoke animation
triggered by a JavaScript event. The field makes the cart a persistent attractor
whose strength reflects inventory — the animation emerges from physics, not a
choreographed sequence.

---

### Inventory Urgency

"Only 3 left" — low stock makes a body's charge spike. The product isn't decorated
with a badge; the field responds to the data attribute. When stock hits zero, the
charge drops (the product is gone). Urgency is structural, not cosmetic.

**What the field does:** `data-strength` is derived from `max(0, 1 - (stock / max_stock))`.
Critically low stock triggers `data-body="attract charge"` — the attract pull is
urgency; the charge is the "electric" quality of scarcity. Both read from the same
inventory value.

---

### Comparison Pull

Side-by-side product comparison where the item with more "winning" attributes has
higher aggregate mass. The field tips the decision spatially. Users don't consciously
read the physics — they feel which option is heavier. The recommended tier pulls
noticeably harder than the others without a "BEST VALUE" banner.

**What the field does:** each comparison column's body strength is the sum of its
winning attribute scores, normalized. The field creates a spatial lean toward the
dominant option that precedes the user's conscious comparison.

---

## IV. Media & Content

### Playlist Gravity

The currently playing track is a dominant gravity well. Related tracks are attracted
bodies — they cluster in field space. Skip around and the field re-orients. The
densest region of the playlist is where you keep returning (play count = accumulated
mass; this is accretion in the Body Matter Interaction model).

**What the field does:** `data-absorb` on the current track; absorbed particle count
(via `--load`) represents accumulated play history. Related tracks carry `data-body="attract"`
with strength proportional to audio feature similarity. The field makes the playlist's
"shape" visible.

---

### Gallery Focus

A photo or project gallery where the featured piece has dominant mass. Hover
transitions are driven by the body's engagement state rather than `:hover` CSS. Other
gallery items dim not because of `:not(:hover)` tricks but because field density
elsewhere genuinely dropped.

**What the field does:** hover triggers `data-active` on the hovered item, amplifying
its pull. All gallery items are `[data-feedback]`; their `--d` values drop as density
concentrates at the active item. CSS maps `--d` to `opacity` or `filter: brightness`.

**Why it's better:** CSS-only gallery focus uses sibling selectors that break with
complex DOM structures. The field works across any nesting, any layout, any grid
order.

---

### Article Series / Content Topography

A collection of posts where each article's body strength is its view count or
normalized read time. On a category or archive page, the field creates a content
topography — dense regions are what readers go to, sparse regions are the underread
work. Editors see an editorial map, not a ranked table.

**What the field does:** view count maps to `data-strength`. The field's density
distribution over the article grid is a spatial representation of readership. High
`--field-density` on a card correlates with high traffic.

---

## V. The Invisible Field — Signals Only

> This is the architectural shift that most people miss.

Since 0.9.0, the field's default `render` mode is `'none'`. No canvas. No particles.
The full simulation runs and writes its results as CSS variables (`--field-density`,
`--d`, `--load`, `--field-attention`) to every `[data-feedback]` element. Your
existing CSS consumes them.

**The field is not a particle effect. It is a pressure system that drives your design
system.**

---

### Ambient Typography

Font weight, letter spacing, or color temperature driven by `--field-density`. Near
a high-mass heading, body text gets fractionally heavier. Near a low-mass region it
lightens. No canvas exists. The field is a semantic pressure gradient that your
typographic CSS responds to. A reader doesn't see physics — they see prose that
breathes.

**What the field does:** `--d` (the compact alias for `--field-density`) is written
to every `[data-feedback]` body each frame. CSS maps it: `font-weight: calc(400 + var(--d) * 200)`.
No JavaScript in the style path.

---

### Focus-Weight Accessibility

The focused element is the engaged body — the strongest local gravity source. Tab
traversal creates a moving gravity well. CSS on `[data-feedback]` elements responds
to `--d` with color, shadow, or scale changes driven by proximity to focus. You get
a spatially-aware focus ring system without a single `:focus-visible` rule doing the
layout work.

For reduced-motion users: the field still writes the CSS variables. Motion is one
consumer; color is another. Disable the particle canvas and the CSS color response
remains — the field continues to carry the semantic weight, now expressed purely
through hue and value rather than movement.

---

### State Without Animation

A toggle's state is a field charge flip. Checked: positive charge, surrounding
elements respond. Unchecked: neutral. The surrounding CSS reads `--d` and transitions.
No keyframes, no JavaScript class toggling, no transition timings to coordinate. The
field carries state into style directly.

A design system built on this pattern has one control surface: the field. Components
emit force; CSS consumes density. The coupling is the CSS variable, not a JavaScript
event listener.

---

### Semantic Content Structure

`<h1>` carries more mass than `<h2>` than `<p>`. The field encodes document
outline as spatial weight. The density distribution over a page IS the document
outline rendered as force. Screen readers consume the markup; the field renders the
same hierarchy as a physical pressure map. Both representations come from the same
HTML — the field is a second read of the semantics, not a separate layer.

---

## VI. Narrative & Immersive

### Scrollytelling

A data story where scrolling through sections changes which body is dominant. Chapter
one's hero is the gravity well for the first viewport. Scroll to chapter two and the
field transitions between focal points — no scroll-jacking, no IntersectionObserver
farm, no manual step management. The field reads what is present in the viewport and
responds.

**What the field does:** each chapter's key element is a `data-body` with high
strength. IntersectionObserver (already used by the engine's MeasurementRegistry)
drives engagement amplification. The field re-orients continuously as sections enter
and exit.

---

### Interactive Fiction

A branching narrative where choices carry accumulated attention weight. The option
the user has hovered longest has more mass. The option with higher narrative stakes
has stronger structural charge. The field is a memory of the user's attention during
the choice — their hesitation is visible in the density distribution before they
click.

---

### Museum / Exhibition

A digital archive or exhibition where artifacts carry historical weight: date range,
cultural significance, acquisition cost → body strength. Moving through the collection,
the field creates a topography of importance. Dense regions are canonical works.
Sparse regions are the periphery. No curatorial badge needed — the field expresses
the hierarchy that the curator encoded as data.

---

## VII. Productivity & Tools

### Kanban Physics

A kanban board where blocked or overdue cards accumulate urgency mass. The board's
field density distribution shows where bottlenecks are without a filter or sort.
Move a card to Done and its mass drops — you physically feel the pressure release.
The field is a burndown you experience rather than read.

---

### Document Co-presence

A collaborative document where each active cursor is a charged body. You feel where
collaborators are through field density. Dense regions are where people are working.
An idle cursor loses charge over time. The field carries presence information
spatially — not a list of avatars in a corner, but a live pressure map of collaboration.

---

### Code Review Gravity

A diff view where modified files have mass proportional to change size. The file tree's
field density shows where the bulk of the review is before opening anything. High-churn
files have higher charge. The field is a complexity map rendered in the same coordinate
space as the tree.

---

## VIII. Only Fundamental Can Do This

These are capabilities with no clean analogy in CSS, JavaScript event systems, or
existing animation libraries.

### Reciprocal UI

The DOM affects the field AND the field affects the DOM. The loop is closed. Most
"physics" UI is one-way — cursor moves, effect responds. Fundamental's two-way binding
means a button that has been hovered many times has accumulated interaction history
as field density. The UI responds to its own usage pattern. The interface has memory.

---

### Truth Mode Mixing

A pricing page where the recommended tier's mass is `designed` (deliberately elevated,
bounded by editorial choice) while user review scores drive `physical` mass (true
physics, potentially unbounded). Both operate in the same field. The spatial tension
between editorial intent and user signal is physically visible.

No other abstraction distinguishes between "we put this here" and "the data put this
here" as a typed, structural property of the body. The field makes the difference
legible.

---

### Composed Force Personalities

`data-preset="blackhole"` combines `attract + sink`. `data-body="attract charge warp"`
pulls, has polarity, and bends the space around it. These combinations produce
emergent field shapes that are impossible to replicate with CSS alone and laborious
to hand-code in JavaScript. The recipe system makes emergent physics declarative.

---

### Multi-Plane Fields

Three independent container fields on one page — one per section, none sharing
particles. Each section's field has its own density logic. Scroll to a section and
its field is live; the others are idle. `bounds: el` scopes a field to one DOM
subtree. Zero interference. The page is a grid of independent physics environments
whose boundaries are DOM elements.

---

## Appendix: Use Case × Engine Capability Matrix

| Use Case | Forces | Feedback | Relationships | Signals-only | Truth Mode |
|---|---|---|---|---|---|
| Weighted navigation | attract | ✓ | — | ✓ | designed |
| Error gravity | attract, charge | ✓ | — | ✓ | designed |
| Reading weight | attract | ✓ | — | ✓ | semantic |
| Anomaly field | gravity | ✓ | — | ✓ | physical |
| Urgency sorting | attract, charge | ✓ | — | ✓ | physical |
| Relationship graphs | attract | ✓ | ✓ | — | physical |
| Product gravity | gravity | ✓ | — | ✓ | hybrid |
| Cart magnetism | attract | ✓ | — | — | designed |
| Playlist gravity | sink | ✓ | attract | — | physical |
| Ambient typography | — | ✓ | — | ✓ | semantic |
| Focus-weight a11y | — | ✓ | — | ✓ | designed |
| Scrollytelling | gravity | ✓ | — | ✓ | designed |
| Kanban physics | attract, charge | ✓ | — | ✓ | physical |
| Reciprocal UI | any | ✓ | — | ✓ | hybrid |
| Multi-plane fields | any | ✓ | — | ✓ | any |

---

## Status

`draft: true` — this document is the source material for the `/use-cases` site page.
It is not yet linked from the site or from the docs index. Update status to `published`
when the site page ships and links back here.
