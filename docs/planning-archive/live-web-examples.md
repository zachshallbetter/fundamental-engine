# Live Web Examples — familiar-page concept studies

> Status: planning / proposal.
> A plan for "concept study" demos that reinterpret familiar page archetypes (article, PR, search,
> dashboard) as Fundamental surfaces. Not shipped behavior; the recipe names below all exist in the
> shipped 64-recipe catalog (`FIELD_RECIPES`). The first study, **Reading Field Study**, is built at
> `/examples` / the docs.

A reinterpretation of a familiar page would be one of the strongest demos because it makes the idea concrete immediately.

The best version is not “take a popular website and add particles.” That would make Fundamental look like an effect layer.

The better move is:

- Take a familiar page people already understand.
- Keep its semantic structure recognizable.
- Apply Fundamental as a relational behavior layer.
- Show how the page becomes more readable, inspectable, and alive without becoming less usable.

Why this works

A popular site already has familiar information architecture. Users know what a search page, product page, article page, profile page, dashboard, or inbox is supposed to do. If Fundamental improves one of those pages, the value becomes obvious because the comparison is immediate.

You are not asking people to understand a new demo world first. You are saying:

- Here is a page you already know.
- Now watch what happens when its meaning becomes a field.

That is a strong pitch.

The right kind of pages to reinterpret

I would avoid copying brand visuals exactly. Use “inspired by” layouts, generic content, and clearly label them as conceptual studies. The point is not to clone a site. The point is to show how Fundamental changes interface behavior.

The best targets are page types with rich relationships.

1. Search results page

Inspired by Google, Perplexity, Arc Search, Algolia, or docs search.

Field-ui treatment:
- Search relevance becomes gravity.
- Source confidence becomes coherence.
- Sponsored/low-confidence results carry friction or distance.
- Previously opened results retain memory.
- Related results form concept clusters.
- Contradictory results carry polarity.

Recipes:
- Search Relevance Field
- Priority Well
- Trust Gradient
- Source Constellation
- Memory Trace

Why it is strong: Search is already about invisible ranking. Fundamental makes ranking spatial, legible, and inspectable.

2. Wikipedia article page

Field-ui treatment:
- Sections accumulate reading memory.
- Citations become relationship threads.
- Definitions bind to terms.
- Related articles form a concept halo.
- The table of contents becomes a memory and attention map.
- Conflicting or weakly sourced claims become visible.

Recipes:
- Reading Field
- Citation Thread
- Context Halo
- Evidence Field
- Relation Lens

Why it is strong: Wikipedia is semantically rich but visually static. Fundamental can make the relationships visible without corrupting the article.

3. GitHub pull request page

Field-ui treatment:
- Changed files become bodies.
- Comments bind to affected code.
- Unresolved threads create tension.
- Approvals increase coherence.
- Failing checks add pressure.
- Reviewers emit presence fields.
- Merge readiness becomes a coherence field.

Recipes:
- Review Constellation
- Dependency Tension
- Consensus Well
- Change Shockwave
- Completion Release

Why it is strong: GitHub PRs already have relationships, status, review pressure, source change, and causality. Fundamental makes those forces legible.

4. Amazon product page

Field-ui treatment:
- Product title and buy box create gravity.
- Reviews form trust gradients.
- Specs cluster by relevance.
- Warnings or incompatibilities create resistance.
- Recommended products orbit by relationship strength.
- Price history or delivery urgency creates pressure.

Recipes:
- Priority Well
- Trust Gradient
- Group Magnet
- Risk Horizon
- Context Halo

Why it is strong: Product pages are dense and persuasive. Fundamental could make trust, relevance, and decision pressure more transparent.

5. Netflix / streaming detail page

Field-ui treatment:
- Active title becomes a gravity center.
- Similar titles form orbiting clusters.
- Mood, genre, actors, and watch history create relationship fields.
- Trailers and previews are signal paths.
- User hesitation reveals context instead of autoplay noise.

Recipes:
- Focus Orbit
- Concept Cluster
- Resonance Match
- Intent Magnet
- Memory Trace

Why it is strong: Recommendation systems already behave like hidden fields. Fundamental makes the recommendation field visible and controllable.

6. Notion / document editor page

Field-ui treatment:
- Blocks become semantic bodies.
- Related notes bind.
- Stale pages drift.
- Mentions and backlinks become active relationships.
- Selected blocks leave a wake.
- AI-generated blocks carry provenance.

Recipes:
- Semantic Gravity Map
- Provenance Trail
- Selection Wake
- Relationship Bond
- Staleness Drift

Why it is strong: Documents, notes, backlinks, AI blocks, and edits are inherently relational.

7. Gmail / inbox page

Field-ui treatment:
- Urgent threads create gravity.
- Stale messages drift.
- Important senders carry memory.
- Actionable emails create pressure.
- Resolved conversations release tension.
- Categories behave like field regions.

Recipes:
- Review Pressure
- Priority Tide
- Staleness Drift
- Completion Release
- Attention Weather

Why it is strong: Email is a pressure field already. Fundamental makes that pressure navigable.

8. Stripe dashboard / finance dashboard

Field-ui treatment:
- Revenue, disputes, failed payments, and anomalies create field weather.
- Risk forms horizons.
- Related metrics bind.
- Anomalies bloom locally.
- Healthy regions stay calm.

Recipes:
- Attention Weather
- Anomaly Bloom
- Risk Horizon
- Dependency Tension
- System Pulse

Why it is strong: Dashboards need calm, legible urgency. This is one of the most commercially persuasive demos.

The best first demo

The strongest first “popular page” reinterpretation is probably a Wikipedia-style article or a GitHub pull request.

A Wikipedia-style article proves the system can improve normal content without spectacle.

A GitHub pull request proves the system can handle real product complexity: relationships, status, review, causality, conflict, readiness, and collaboration.

If the goal is to convince designers, use Wikipedia/article.

If the goal is to convince engineers, use GitHub PR.

If the goal is to convince businesses, use dashboard or search.

Demo format

I would build it as a side-by-side or staged transformation.

Stage 1: Original structure

Show a familiar page layout using generic content.

Static article.
Normal table of contents.
Normal citations.
Normal cards.
Normal status badges.

Stage 2: Semantic registration

Show which elements become field bodies.
- sections
- headings
- citations
- sources
- claims
- buttons
- status badges
- comments
- cards

Stage 3: Field behavior

Turn on the field.
- attention gathers
- relationships bind
- memory accumulates
- conflict separates
- status heats
- completion releases

Stage 4: Diagnostics

Reveal why the page behaves that way.
- topology
- causality
- prediction
- memory heatmap
- relationship overlay
- field lines
- platform inspector

Stage 5: Reduced motion

Show the same meaning without motion.
- static rails
- badges
- relationship threads
- source tables
- memory marks
- coherence meters

This is important. It proves this is not eye candy.

Example: Wikipedia-style article

Imagine a page titled:

The History of Interface Systems

The page has:
- article sections
- footnotes
- related concepts
- definition callouts
- claims
- source list
- table of contents

Fundamental adds:
- **Reading Field**:
  - Current section gains attention.
  - Read sections accumulate memory.
  - TOC becomes a memory map.
- **Citation Thread**:
  - Hovering a source lights the claim it supports.
  - Hovering a claim reveals its source path.
- **Evidence Field**:
  - Weakly supported claims remain less coherent.
  - Conflicting sources create polarity.
- **Context Halo**:
  - Focused concepts reveal related terms nearby.
- **Relation Lens**:
  - The reader can temporarily reveal all links between concepts, sources, and sections.

The page remains readable with no JavaScript effects enabled. The field adds a second layer: orientation, relationship, memory, and trust.

Example: GitHub-style pull request

Generic page:
- PR title
- changed files
- checks
- review comments
- reviewers
- merge box
- timeline

Fundamental adds:
- **Review Constellation**: Reviewers, comments, and files bind into relationship clusters.
- **Dependency Tension**: Blocked files and unresolved comments create tension.
- **Change Shockwave**: A changed core file emits downstream impact.
- **Consensus Well**: Approvals increase merge coherence.
- **Completion Release**: When checks pass and comments resolve, pressure releases into a stable merge state.
- **Platform Inspector**: Shows which comments, checks, and files caused the current state.

This would be extremely compelling because developers already understand PR stress. Fundamental makes the invisible state of review visible.

Example: Search results

Generic search page:
- query input
- results
- filters
- source cards
- AI summary
- related searches

Fundamental adds:
- **Search Relevance Field**: High-confidence results form gravity wells.
- **Trust Gradient**: Verified sources increase coherence. Weak results remain unstable.
- **Polarity Filter**: Contradictory results separate.
- **Memory Trace**: Opened results retain memory. Ignored results cool.
- **Source Constellation**: Sources cluster around claims or topics.

This makes search feel less like a ranked list and more like an evidence landscape.

Why this would differentiate Fundamental

Most demos of UI technology show something new in a blank playground.

This would show a familiar interface becoming more meaningful.

That is much stronger.

The pitch becomes:

We are not asking people to adopt a strange new visual style.
We are showing that the interfaces they already use contain hidden fields.
Fundamental makes those fields visible, measurable, and usable.

Recommended “popular page studies” set

I would build five concept studies:

| Study | Inspired by | Shows |
|---|---|---|
| Reading Field | Wikipedia / long-form docs | attention, memory, citations |
| Review Field | GitHub PR | conflict, review, readiness |
| Search Field | Google / Perplexity | relevance, evidence, polarity |
| Trust Field | AI answer page | sources, confidence, contradiction |
| System Weather | Stripe / admin dashboard | urgency, risk, anomaly, calm |

Each should use generic branding and content.

Name them by behavior, not by copied website:

Reading Field Study
Review Field Study
Search Field Study
Evidence Field Study
System Weather Study

What the agent should build

A good implementation brief:

Create a set of Fundamental concept studies based on familiar page archetypes, without copying brand assets or proprietary UI.
Start with one study: Reading Field Study.
Requirements:
- Use semantic HTML first.
- Register headings, sections, citations, source cards, and TOC items as field participants.
- Apply recipes: Reading Field, Citation Thread, Evidence Field, Context Halo, Relation Lens.
- Include diagnostics toggles: topology, causality, memory heatmap, relationship overlay.
- Include reduced-motion mode.
- Include a “before / after / inspect” narrative.
- Do not make particles the main point. Use them only where they clarify the field.
- Make the page usable with motion disabled.

Then build Review Field Study next.

The big idea

A popular website reinterpretation would make the paradigm understandable.

The line is:

This is what happens when a familiar interface stops being a static layout and starts behaving like a field of meaning.

That is exactly the kind of demo that could make the system click.
