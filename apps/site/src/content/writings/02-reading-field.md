---
title: "Reading Field: Attention, Memory, and Relationship Awareness in Long-Form Web Documents"
description: "A field model for reading attention and document memory that preserves semantic HTML."
summary: "A field model for reading attention and document memory that preserves semantic HTML."
date: 2026-06-07
category: research
series: "Fundamental research"
order: 2
author: "Zach Shallbetter"
---

# Reading Field: Attention, Memory, and Relationship Awareness in Long-Form Web Documents

> **Status: research draft (preprint, work in progress).** Paper 2 of the Fundamental family — the
> reading / long-form document validator. Claims verified against the codebase and canonical docs as
> of 2026-06-07. See the [series index](/writings) and *the caveat canon* therein. This is a preprint
> draft, not canonical product documentation.

**Author:** Zach Shallbetter
**Series:** Fundamental Research Papers, Paper 2 of 8 (the reading / long-form document case study)
**Companion papers:** [Field Translation Runtime](/writings/01-field-translation-runtime) (the flagship
paradigm paper, whose vocabulary this paper assumes); [Evidence Fields](/writings/03-evidence-fields) (AI
trust and provenance). See the [series index](/writings).

---

## Abstract

Long-form web documents — reference articles, specifications, legal text, research papers — are
semantically rich but interactively flat. A reader scrolling through ten screens of prose has almost
no machine-supported sense of *where they are*, *what they have already read*, *which sections relate
to which*, or *where a citation leads*. The platform gives them a scrollbar and the browser history;
the document itself stays inert. We propose the **Reading Field**: a treatment in which the parts of
an ordinary document — its sections, its citations and cross-references, its table of contents, and
the reader's own attention — participate in a single measured field of memory and relation, while the
underlying markup remains plain, selectable, accessible, semantic HTML. Sections become *bodies*
whose proximity to the viewport centre produces an *attention* well; sustained attention (dwell)
deposits into a decaying *memory* field; the document's `href` and ARIA cross-references resolve into
a typed *relationship* graph; and the table of contents becomes a live memory-and-attention map. The
single claim of this paper is narrow and falsifiable: **long-form documents become easier to navigate
and orient within when sections, citations, references, and reader attention participate in a measured
field of memory and relation — without sacrificing semantic HTML.** We make two contributions: (1) a
field model for reading, expressed in the shared vocabulary of the flagship paper and grounded in the
*shipped* Reading Field demo at `/docs/reading-field`, which exercises all six scheduler phases —
across the four platform registries it needs (measurement, state, feedback, relationships); and (2) a
full, pre-registerable user-study design — research questions,
hypotheses, conditions (a plain semantic baseline, the full Reading Field, and the Reading Field under
reduced motion), materials, primary and secondary measures mapped to the project's own evaluation
targets, a power estimate, an analysis plan, and threats to validity. Honoring the family's caveat
canon, **no study has been run; every empirical statement here is a hypothesis or a design, never a
finding.**

---

## 1. Introduction

### 1.1 The problem: orientation in long documents

Reading a long document on a screen is a navigation problem wearing the costume of a reading problem.
A printed book gives the reader a thick, tangible sense of position: the wedge of pages in each hand,
the physical thumb in a remembered place, the dog-ear, the marginal note. A scrolled web document
gives almost none of this. The reader's *position* is a thin scrollbar thumb. Their *history* — what
they have already read versus merely scrolled past — is nowhere recorded. The *relationships* between
parts of the document (this section defines the term that section uses; this claim rests on that
citation) are present in the markup as `href`s and ARIA references but are not surfaced as anything a
reader can feel or follow. And a *citation* is, interactively, a dead-end: a superscript that, when
followed, drops the reader somewhere else with no thread back.

Concretely, four failures recur:

1. **"Where am I?"** Readers lose track of their position in the document's structure. The active
   table-of-contents entry, if one is highlighted at all, marks a scroll position, not a *reading*
   position — it cannot distinguish a section read carefully from one scrolled past in a second.
2. **Losing the thread.** After following a link, switching tabs, or returning the next day, the
   reader must reconstruct where they were and what they had covered. The document does not remember.
3. **Re-finding a seen section.** "I read something about X a few sections back" is a common, costly
   operation. The reader scrolls, hunts headings, and re-scans — an act of manual search over content
   they have already seen.
4. **Weak relationship awareness.** Which concepts depend on which? Which claim does this source
   support? The answer exists in the document's structure but is not legible; the reader builds a weak
   mental model of the document's relational shape, or none at all.

These are not failures of content. They are failures of *the interface to the content*: the document
is treated as a single long scroll surface rather than as a structured field a reader moves through
and remembers.

### 1.2 The Reading Field idea

The flagship paper (Paper 1) argues that an interface is not only a layout of components but **a
shared, inspectable field of meaning**, and that the way to realize this is reciprocal:
*elements bend the field; the field bends them back.* The Reading Field applies that thesis to the
single most ordinary kind of web page — an article — and to the single most ordinary reader activity
— reading it top to bottom.

The move is to treat the document's own parts as field participants. In the vocabulary of Paper 1
(§3): each **section** is a *body* — a registered origin of influence whose geometry is its bounding
rectangle. The reader's viewport is a probe; a section's proximity to the viewport centre, scaled by
how much of it is visible, is its **attention** — a continuous, momentary signal that rises as the
reader arrives and falls as they leave. Attention integrated over time deposits into a **memory**
field — the *memory field* primitive of Paper 1 (§8.4) — so a section the reader genuinely dwelled on
stays warm while a skimmed one does not. The document's cross-references resolve, through the
`RelationshipRegistry`, into a typed **relationship** graph: *a document is a tree, but meaning is a
graph,* and the graph is exactly the one the markup already implies. Finally, the table of contents
becomes a live **memory map** — each entry carrying the trace of how much of that section has been
read, and the current section marked from the live attention field rather than from a raw scroll
position.

Crucially, none of this replaces the document. The HTML stays semantic, selectable, translatable, and
accessible; the field is a *second layer* — orientation, relationship, and memory — laid over content
that loses nothing if the field never starts. This is the discipline of the live-examples plan: *here
is a page you already know; now watch what happens when its meaning becomes a field* — and the page
*remains readable with no field effects enabled.*

### 1.3 Contributions and scope

This paper contributes:

1. **A field model for reading** (§3): a precise account of how an ordinary semantic document becomes
   a Reading Field — sections as bodies, viewport-centre proximity as attention, dwell as memory
   deposit, cross-references as typed relationships, the table of contents as a memory map — stated in
   the shared vocabulary of Paper 1 and grounded in the shipped demo (§4).
2. **A full user-study design** (§5): research questions, hypotheses, conditions, materials, tasks,
   primary and secondary measures, a power estimate, a procedure, an analysis plan, threats to
   validity, and a pre-registration note — a protocol another lab could run.

The scope is deliberately narrow, per the family's *one-claim-per-paper* rule. This paper concerns
**reading and long-form documents only.** It does *not* re-explain the runtime architecture (deferred
to Paper 5), the reduced-motion conformance model (Paper 4 — we use reduced motion here as an
experimental *condition*, not as a contribution), recipe authoring (Paper 6), data binding (Paper 7),
or diagnostics (Paper 8). Where those systems are load-bearing for a claim, we cross-reference rather
than re-derive.

---

## 2. Background and related work

The Reading Field sits at the intersection of several literatures. We position Fundamental against each
and, following the family's convention, every external citation below uses a stable key assembled in
[`references.md`](/writings/references) (the *Reading on screen, navigation, and document orientation* section already reserves space
for them).

**Reading on screen.** A substantial literature compares reading on screens to reading on paper and
documents the orientation costs of scrolling — the loss of the spatial, kinesthetic cues that print
affords, and their effect on comprehension and the sense of position. The Reading Field is, in part,
an attempt to *re-supply* a spatial sense of place to a scrolled document.
[mangen2013; ackerman2011; clinton2019]

**Document navigation, orientation, and wayfinding.** Hypertext and document-UX research treats
"where am I / where can I go / where have I been" as the canonical wayfinding questions, and studies
table-of-contents design, fisheye and overview+detail navigation, and progress indicators as answers.
The Reading Field's table-of-contents-as-memory-map is a direct descendant of overview navigation, but
it is driven by *measured reading attention* rather than by scroll position alone.
[conklin1987; nielsen1990hypertext]
[furnas1986; shneiderman1996]

**Information scent.** Information-foraging theory frames navigation as following "scent" toward
likely-relevant content. A memory-and-attention-weighted table of contents can be read as making the
*already-foraged* terrain legible — marking trails the reader has worn — which is the reading-time
analogue of the *memory field* (worn paths attract attention) that Paper 1 inherits from stigmergy.
[pirolli1999]

**Citation and reference behavior.** How readers use citations, footnotes, and cross-references — when
they follow them, how often they return, and how reference structure affects comprehension — bears
directly on the citation-as-dead-end problem and on the relationship-awareness claim.
[jurgens2016; boyack2018]

**Memory of place.** Spatial memory for document location ("it was near the top of the right-hand
page") is well attested for paper and degraded for scrolled text. The Reading Field's *memory*
deposit is an explicit, externalized model of "I have been here," and the question of whether
externalizing it helps re-finding is one of this paper's central hypotheses (§5).
[mangen2013; ackerman2011]

**Attention and salience.** As in Paper 1 (§2), computational saliency models *where* the eye is
drawn; Fundamental instead treats attention as a *conserved, continuous field* over interface elements
— *"selection is a decision; attention is a field"* (Paper 1, §8.1). In the reading case, attention is
operationalized as viewport-centre proximity scaled by visibility, and its budgetary / conserved
character (emphasis as zero-sum across sections) is inherited from the flagship model. The relevant
HCI work on attention, distraction, and reading interruption frames the *perceived-distraction*
measure of §5.
[bailey2006; mark2008]

The distinguishing stance, across all of these, is the one Paper 1 makes general: Fundamental does not
add a navigation widget *beside* the document; it makes the document's own structure — sections,
references, table of contents — and the reader's own attention into measured participants in one
field, while keeping the semantic substrate intact and authoritative.

---

## 3. The Reading Field model

This section states how an ordinary document becomes a field. It reuses Paper 1's model wholesale and
specializes it to reading; the reader is referred to Paper 1 (§3, §5, §8) for the general loop,
scheduler, and primitives.

### 3.1 Sections as bodies; viewport proximity as an attention well

A section is a *body* in exactly the sense of Paper 1 (§3.1): a registered origin of influence whose
geometry is its bounding rectangle, measured once per frame in the scheduler's **read** phase by the
`MeasurementRegistry`. In the shipped demo, registration is literal —
`platform.measure.register(section, { role: 'section' })` — and every `<section data-field-body>` in
the article becomes a measured body.

A section radiates a **gravity-like priority** in the sense of the Natural Field Translation System
(Paper 1, §6.5): *gravity → priority*. But the *cause* that produces emphasis at reading time is the
reader's viewport. Let a section's measured centre be $c_y$, the viewport height $v_h$, and its
viewport centre $v_h/2$. The section's **attention** is

$$
A_i \;=\; \max\!\Big(0,\; 1 - \frac{|c_{y,i} - v_h/2|}{r\,v_h}\Big)\,\cdot\,\mathrm{vis}_i,
\qquad r \approx 0.55,
$$

where $\mathrm{vis}_i \in [0,1]$ is the fraction of the section currently visible. This is an
*attention well* centred on the viewport: a section pinned at the centre of the reader's screen, and
fully visible, attains $A_i \to 1$; a section drifting toward the edge, or partly scrolled off,
decays toward $0$. The form mirrors Paper 1's general attention definition
($\text{attention}_i = \text{density}_i \cdot \text{engagement}_i \cdot \text{relevance}_i \cdot
\text{visibility}_i$) specialized to the case where "engagement" is *being where the reader is
looking*. Under conserved-attention mode (Paper 1, §8.1), the well is zero-sum:
$\sum_i A_i = A_\text{total}$, so a section gaining the reader's attention *pulls* it off the others —
emphasis is transferred, not fabricated.

Attention is computed in the **compute** phase against the immutable measurement snapshot, never by
reading layout mid-write — the scheduler discipline of Paper 1 (§5) is what makes the well cheap to
maintain while the reader scrolls.

### 3.2 Dwell as memory deposit

Attention is momentary. **Memory** is its slow integral: the worn-trail primitive of Paper 1 (§8.4),
realized on a per-section scalar. Where attention rises and falls as the reader passes, memory only
accumulates, and decays slowly, so the document accrues *a memory of approach, not just a record of
clicks.* The deposit rule is the family's standard memory-field update,

$$
M_i(t + \mathrm{d}t) \;=\; M_i(t)\cdot\text{decay} \;+\; \text{deposit}_i(t),
$$

where the deposit is gated on *sustained* attention — only a section the reader actually dwells on
(attention above a threshold) deposits, and only a small increment per frame, so memory reflects
*reading*, not a glance. In the shipped demo this is the rule
`next = min(1, prev + (attention > 0.7 ? 0.006 : 0))`, an explicit, inspectable realization of the
gated deposit with a near-unity decay; a skimmed section never crosses the gate and so never warms.
Memory is classified, per Paper 1's truth-mode taxonomy (§6.3), as a *metric* with *semantic* truth —
a persistence signal, not a force — which keeps the vocabulary honest: nothing here pretends to be
physics.

The reading consequence is the one the introduction asked for: the document can answer *what have I
already read?* — distinguishing a carefully read section ($M_i$ high) from one scrolled past
($M_i \approx 0$) — and can carry that answer forward across interruptions, because memory is state,
not an event stream.

### 3.3 Citations and references as typed relationships

A document's cross-references are not decoration; they are *relationships with history* (Paper 1, §5;
canonical interaction model §7). The `RelationshipRegistry` reads them from the **native** signals the
markup already carries — `a[href^="#…"]`, `label[for]`, `aria-controls` / `-describedby` /
`-labelledby` / `-flowto`, and explicit `data-field-relation` / `data-field-target` — and resolves
them into one typed relationship graph mapped onto core `RelationshipAgent`s. In the shipped demo,
every in-page cross-reference is authored as, e.g.,
`<a href="#memory" data-field-relation="references" data-field-target="#memory">memory</a>`, and the
discover phase calls `platform.relationships.discover(article)` once to build the graph; the same
graph the topology overlay would draw.

This is the foundation of *relationship awareness*. A citation ceases to be a dead-end superscript and
becomes an edge the field can pull along, light up, and remember: hovering or focusing a source can
light the claim it supports, and hovering a claim can reveal its source path (the *Citation Thread*
recipe of the live-examples plan). The `relation-target-missing` lint rule (Paper 1, §5.3) flags any
cross-reference whose target body is not registered, so the authored relational structure stays
consistent with what the runtime sees — a quiet data pathology surfaced rather than silently dropped.

The reading model here is deliberately conservative: the relationship *graph* is recovered from
structure the author already wrote. Richer relational semantics for source support, contradiction, and
confidence — *support as binding, contradiction as charge, correction as memory overwrite* — are the
subject of the Evidence Field (Paper 3) and are explicitly *out of scope* here. The Reading Field
claims only that making the document's existing reference graph legible, as relationships, aids
orientation and recall.

### 3.4 The table of contents as a memory-and-attention map

The table of contents is the document's natural overview surface, and in the Reading Field it is
driven by the field rather than by scroll position. Two signals flow into it, in the scheduler's
**render** phase (read-only over state):

- **The current section** is the table-of-contents entry whose section currently holds the highest
  attention $A_i$ — a *reading* position, not merely a scroll position, so it does not flicker on a
  fast scroll-through (the entry is chosen from the eased attention field, and the underlying
  `field:lit` state has hysteresis — see §3.6).
- **Each entry's memory** is its section's $M_i$, written as a custom property the entry's CSS reads,
  so the contents list *fills in* as the reader reads: a high-memory section's entry is brighter and
  carries a fuller rail than a skimmed one.

The result is a *memory map*: a glance at the table of contents answers *where am I* (the current
entry) and *what have I covered* (the brightness/fill of each entry) at once. In the shipped demo a
small status line additionally reports a derived *read* count — sections whose $M_i$ exceeds a
threshold — as a coarse "you have read N of M sections" signal. This is the live-examples plan's
*the table of contents becomes a memory and attention map,* made literal.

### 3.5 What writes back to the DOM

The reverse half of the loop (Paper 1, §8) surfaces through the `FeedbackRegistry`, which is the
*single writer* permitted to turn internal state into DOM-visible output, in the scheduler's **write**
phase. For the Reading Field the write-back is small and explicit. Per section:

- `--field-attention` — the live attention $A_i \in [0,1]$.
- `--field-memory` — the accumulated memory $M_i \in [0,1]$ (also written to the section's table-of-
  contents entry, so the contents list carries the same trace).
- A thresholded `field:lit` event when attention crosses an enter threshold (and `field:dim` on exit),
  with hysteresis (enter $\approx 0.7$, exit $\approx 0.45$) so the *current section* state is stable
  rather than chattering.

These are the *only* fields the reading treatment writes. (The family's general per-element density
variable `--field-density`, with `--load` and `--lit` for accretion and cross-boundary spill, is the
broader feedback vocabulary of Paper 1 §8; the Reading Field uses the attention/memory subset.) The
write is continuous and scalar, which is exactly what lets a *single* value parameterize typography
and rule weight in pure CSS — **material typography** in the sense of Paper 1 (§8.2): a section's
heading opacity tracks `--field-attention`, and a left rail's color tracks `--field-memory`,
*the field parameterizing the document rather than decorating it.* The **punctuation rule** of Paper 1
(§8.2) governs the reading case strictly: *words are bodies the field decorates; marks are where
matter assembles* — the Reading Field never assembles particles into letterforms or prose; it acts on
the type and the space around it.

### 3.6 Semantic HTML stays live

The load-bearing constraint, and the second half of the paper's claim — *without sacrificing semantic
HTML* — is that everything above is a *second layer*. The document is authored as ordinary semantic
markup: `<article>`, `<section>`, `<h2 id="…">`, `<p>`, `<a href="#…">`, `<nav>` for the table of
contents. The field attaches to that markup; it does not replace it. Consequently:

- **Selectable.** The text is real text; selection, find-in-page, copy, and reader modes work
  unchanged.
- **Accessible.** Headings, landmarks, and links keep their semantics; the field's write-back is CSS
  custom properties and *thresholded, debounced* events, not ARIA churn. Decorative layers, where any
  exist, are `aria-hidden`; meaning is never motion-only and never color-only (the accessibility
  invariants of Paper 1 §8.5, whose formal conformance model is Paper 4).
- **Translatable and crawlable.** The content is in the DOM as prose, so machine translation, search
  indexing, and assistive technology see the document, not a canvas.
- **Degrades to nothing.** If the field never starts — no JavaScript, an old browser, an error — the
  page is a perfectly ordinary, readable article. The field adds orientation, relationship, and
  memory; it removes nothing.

This is the property that distinguishes the Reading Field from a scroll-spy widget or a particle
overlay: the *meaning* lives in the semantic document and in measured field state, and *motion is one
representation of that state, not the meaning itself.*

---

## 4. Implementation status

Following the family's *verify-against-code* rule, we separate what is shipped from what is designed.

**Shipped.** The Reading Field demo is shipped and lives at `/docs/reading-field` (source:
`apps/site/src/pages/docs/reading-field.astro`). It is an ordinary content page — sections, headings,
in-page citations, a table of contents — wired to `createFieldPlatform` and exercising all six phases
of the `FrameScheduler` across the four registries it uses (measurement, state, feedback,
relationships):

- **discover** — citations resolve into the relationship graph
  (`platform.relationships.discover(article)`), via `RelationshipRegistry`.
- **read** — each `<section>` is a measured body (`MeasurementRegistry`,
  `platform.measure.register`).
- **compute** — viewport-centre proximity → attention, against the fresh measurement snapshot.
- **state** — attention folds into `StateRegistry`; the gated memory deposit accumulates.
- **write** — `--field-attention` / `--field-memory` flush via `FeedbackRegistry`; the thresholded
  `field:lit` / `field:dim` events fire with hysteresis.
- **render** — the table of contents reflects memory and the current section (read-only over state).

The page also honors reduced motion: under `prefers-reduced-motion` the CSS drops the easing, so
attention and memory *snap* instead of animating while still tracking — "the animation stops; the
meaning does not." The demo exposes a small verification surface
(`window.__readingField`: per-section attention/memory, relationship count, frame count, scheduler
violation count), consistent with the project's standard of making field behavior checkable. This
substantiates the model of §3 against running code; it does **not** substantiate any *user* claim.

**Not yet done.** The user study described in §5 **has not been run.** Per the caveat canon (item 6),
every empirical statement in this paper is a *design* or a *hypothesis*, never a measured outcome. The
richer reading recipes named in the planning material — *Citation Thread*, *Context Halo*, *Relation
Lens*, *Evidence Field* over a reading page — are recipe-authoring and evidence concerns deferred to
Papers 6 and 3; the Reading Field as studied here is the shipped attention/memory/relationship
treatment above.

---

## 5. A user-study design

This is the centerpiece of the paper: a full, pre-registerable protocol to test the claim. We design
it to the family's evaluation targets — *section relocation speed, reader orientation,
citation/source recall, concept-relationship recall, perceived distraction, reduced-motion
preference* — and frame the whole thing as a *plan*. No results are reported.

### 5.1 Research questions and hypotheses

The claim decomposes into testable questions. Let **Baseline** be a plain semantic document (no
field), **Field** be the full Reading Field, and **Field-RM** be the Reading Field under
`prefers-reduced-motion` (state without travel).

- **RQ1 (orientation / re-finding).** Does the Reading Field reduce the time and effort to re-find a
  previously seen section?
  - **H1.** Section-relocation time is *lower* under Field than Baseline.
  - **H1a.** Re-finding requires *fewer* navigational actions (scroll reversals, table-of-contents
    clicks, find-in-page invocations) under Field than Baseline.
- **RQ2 (sense of place).** Does the Reading Field improve the reader's sense of where they are?
  - **H2.** Readers place themselves in the document structure *more accurately* (and/or rate
    orientation confidence *higher*) under Field than Baseline.
- **RQ3 (citation / source recall).** Does surfacing the reference graph as relationships improve
  recall of which source supports which claim?
  - **H3.** Citation/source-recall accuracy is *higher* under Field than Baseline.
- **RQ4 (concept-relationship recall).** Does relationship awareness improve recall of how concepts in
  the document relate?
  - **H4.** Concept-relationship-recall accuracy is *higher* under Field than Baseline.
- **RQ5 (distraction).** Does the field cost the reader attention?
  - **H5 (non-inferiority / null-preferred).** Perceived distraction under Field is *not higher* than
    Baseline beyond a pre-specified margin; comprehension does not degrade.
- **RQ6 (reduced-motion equivalence and preference).** Does the motion carry the benefit, or does
  state alone suffice?
  - **H6.** The orientation/recall benefits of Field over Baseline are *preserved* under Field-RM
    (Field-RM $\approx$ Field $>$ Baseline on H1–H4), supporting the claim that *meaning is in state,
    not motion.* (The formal conformance model is Paper 4; here this is an empirical equivalence
    check.)
  - **H6a.** A non-trivial fraction of participants *prefer* Field-RM, and motion-sensitive
    participants prefer it more.

H1–H4 are the core support for the claim (*easier to navigate and orient*). H5 guards the second
clause from a hollow victory (a benefit purchased with distraction is not a benefit). H6 guards
against the benefit being a motion novelty rather than a field-of-state benefit, and connects to the
accessibility population.

### 5.2 Conditions

Three conditions, all built from the *same* semantic document:

| Condition | Field | Motion | Purpose |
|---|---|---|---|
| **Baseline** | off (plain semantic HTML + an ordinary, scroll-position table of contents) | n/a | control / status quo |
| **Field** | full Reading Field | on (eased) | the treatment |
| **Field-RM** | full Reading Field | reduced (state snaps, no travel) | isolates motion from state |

Holding the document, content, typography, and layout fixed across conditions — only the field layer
and its motion vary — is what isolates the *field* as the manipulated variable and guards against
content or aesthetic confounds. The Baseline's table of contents highlights the section at the scroll
position (a standard scroll-spy), so the comparison is against a *fair* modern control, not a
table-of-contents-less straw man; the Field condition's table of contents differs only in being driven
by measured attention and carrying memory.

### 5.3 Design, counterbalancing, and materials

**Within- vs. between-subjects.** We propose a **within-subjects** design on condition: every
participant experiences all three conditions, each on a *different* document, so that
condition-vs-document confounds are broken by counterbalancing. Within-subjects maximizes power for a
likely-modest effect and lets each participant serve as their own control on reading speed and prior
knowledge; the cost is learning and carryover, addressed below. (A between-subjects design on
condition is the conservative fallback if carryover proves severe in piloting; it roughly triples the
required sample — see §5.6.)

**Counterbalancing.** With three conditions and three documents, condition×document assignment follows
a **3×3 Latin square**, with participants assigned round-robin across the squares, so that across the
sample each condition is paired with each document equally often and each ordinal position
(first/second/third) is balanced across conditions. This neutralizes both document-specific effects
and practice/fatigue order effects.

**Materials.** We construct **three** controlled long-form documents, matched on length (target
~2,500–3,500 words, ~7–9 sections), reading level, structural shape (sections, sub-sections, a table
of contents), and citation density (a matched number of in-text citations resolving to a source list,
plus a matched number of in-document cross-references between sections). Topics are chosen to be
*generic and low-prior-knowledge* (e.g., the history of an obscure-but-neutral technical topic) and
balanced for inherent interest, so prior familiarity does not advantage one document. Each document is
rendered identically across the three conditions; the only per-condition difference is the field
layer. Materials, including the exact relationship graph and the "ground-truth" answer keys for the
recall tasks, are fixed before data collection and included in the pre-registration.

**Participants.** We target fluent adult readers of the document language, recruited from a general
(non-specialist) pool via an online participant platform or a university subject pool, with a brief
reading-fluency screen and exclusion of participants already expert in the document topics (to
preserve the low-prior-knowledge assumption). We **over-recruit self-reported motion-sensitive
participants** for the reduced-motion analyses (H6/H6a; §5.8). Age, reading habits, and
assistive-technology use are recorded and reported. The sample is a convenience sample; conclusions
about the assistive-technology population are explicitly preliminary, with the formal accessibility
argument deferred to Paper 4 (§5.8).

### 5.4 Tasks and primary measures

Each participant, per document/condition, performs a **read phase** followed by a **task phase**. The
primary measures map one-to-one onto the family's evaluation targets.

1. **Read phase.** The participant reads the document to answer a short orientation prompt ("read this
   so you could summarize it"), with no time pressure, to seed genuine attention and memory.

2. **Section-relocation task → section-relocation speed (primary, H1/H1a).** The participant is shown
   a short quoted snippet from a section they read and asked to navigate back to it. To keep the
   stopping rule **independent of the manipulation**, completion is the participant's own **"found it"
   key-press**, scored for correctness against the ground-truth section — *not* "the section enters and
   dwells in the viewport." That viewport-dwell criterion is itself the attention signal the Field
   condition surfaces (and the Field condition's live current-section highlight would let the reader
   *confirm* arrival), so it would make the measured time partly tautological with the treatment; a
   self-asserted "found it," identical across conditions, removes that confound. **Time to relocation**
   (prompt → correct "found it") is the primary timing measure; **navigational-action count** (scroll
   reversals, table-of-contents clicks, find-in-page uses) is the secondary effort measure; trials whose
   "found it" is incorrect are scored as errors and modeled separately. Several trials per document,
   targeting sections at varied positions.

3. **Placement task → reader orientation (primary, H2).** At **several pre-scheduled pauses** per
   document — not a single probe, which yields one noisy data point per condition and is badly
   underpowered — the document is hidden and the participant marks *where they are* on a blank schematic
   (a "you-are-here" placement) and rates orientation confidence on a Likert item. **Probe positions are
   fixed and counterbalanced across conditions** so that a probe landing mid-section versus at a
   boundary cannot confound the comparison, and the schematic is **normalized across documents** of
   differing section counts. **Placement error** (normalized distance from true position) and
   **confidence** are the orientation measures. Because hiding-then-placing also taps *reconstruction
   after interruption* (where a memory map could aid recall rather than online orientation), placement
   is read alongside the online relocation and confidence measures, not as a sole orientation index
   (§5.8).

4. **Citation/source-recall task → citation/source recall (primary, H3).** After reading, the
   participant is given claims from the document and asked which source supports each (matching, from
   the document's real source list). **Source-attribution accuracy.**

5. **Concept-relationship-recall task → concept-relationship recall (primary, H4).** The participant
   reconstructs the document's relationship graph: given the concept/section nodes, indicate which are
   related (and, optionally, how). Scored against the document's actual relationship graph (the one the
   `RelationshipRegistry` recovers). **Graph-edit-distance / F1 against ground truth.**

6. **Perceived-distraction & comprehension (primary for H5).** A short post-condition
   perceived-distraction scale, plus a brief comprehension quiz, to ensure any navigation/recall
   benefit is not bought with distraction or reduced understanding.

7. **Reduced-motion preference (primary for H6a).** After experiencing both Field and Field-RM,
   a forced-choice preference plus rationale; a screening item captures self-reported motion
   sensitivity / vestibular discomfort.

### 5.5 Secondary measures and the system as instrument

- **Workload.** NASA-TLX after each condition (overall and per-subscale), to characterize the cost of
  the navigation benefit.
- **Usability / subjective.** A standard post-task usability questionnaire and a few custom items on
  "sense of having read," trust, and aesthetic preference.
- **Revisit counts and reading paths.** Logged scroll/visit traces, to relate behavior to the
  self-reported measures.
- **The field's own dwell/memory heatmap as a process descriptor.** The system *already computes*
  per-section attention and memory (§3, exposed via `window.__readingField`). In the Field conditions
  we log $A_i(t)$ and $M_i(t)$ to characterize *how* attention and memory accumulated and to relate the
  field's trace to behavior. We are explicit about a circularity it cannot escape: because the field is
  also *displayed* in these conditions, a correlation between measured $M_i$ and re-finding speed is
  equally consistent with a trivial **display effect** (the highlight told the reader where to look) and
  therefore does **not** establish that the field's memory is a valid proxy for the *reader's* memory.
  Testing that proxy claim properly requires a condition in which the field is **computed but its memory
  cue is hidden** (state without the visible cue), so field-memory can predict behavior without the
  display confound; we include such a **field-computed/cue-hidden probe** as an optional fourth
  condition where budget allows, and otherwise hold this analysis to a strictly descriptive,
  exploratory role (§5.7) and drop the "valid proxy" framing.

### 5.6 Sample size and power (planning estimate)

*This is a planning estimate, stated with its assumptions, not a guarantee.* We deliberately do **not**
commit to a single effect size: we have no empirical anchor for this intervention. Instead we plan
against a **sensitivity table**, a cautious practice consistent with broader HCI concerns about how
usability effects are measured and reported [hornbaek2006]: for the primary within-subjects paired contrasts (Field vs. Baseline on H1–H4)
at power $\ge 0.80$, $\alpha = 0.05$ two-sided (paired-$t$ approximation, before multiplicity
correction):

| assumed $d_z$ | $n$ for 0.80 power |
|---:|---:|
| 0.20 (small) | ≈ 199 |
| 0.30 | ≈ 90 |
| 0.40 | ≈ 52 |
| 0.50 (medium) | ≈ 34 |

A crossed subject + document mixed-effects analysis (§5.7) typically *gains* power over the paired
$t$-test by modeling document variance explicitly, and a between-subjects fallback would need roughly
$3$–$4\times$ these counts (≈ that many per condition). The **pre-registered $n$ will be fixed from the
literature and a pilot before data collection** (§5.9) — but we flag an important limit honestly: a
small pilot ($n \approx 8$–$12$) calibrates the **materials matching and the within-/between-document
variance components, not the effect size** (a 10-person pilot yields a near-useless effect-size
confidence interval). The effect-size anchor must therefore come from prior work and/or a larger
calibration sample, not from this pilot; the pilot also screens for severe carryover that would force
the between-subjects fallback.

### 5.7 Analysis plan

- **Timing measures (section-relocation speed).** Linear **mixed-effects models** on
  (log-transformed) relocation time, with condition as a fixed effect and **crossed random effects for
  subject and document** (and a random effect for section/trial), which correctly partitions
  subject-, document-, and item-level variance and generalizes beyond the specific documents used.
  The same structure applies to navigational-action counts (generalized mixed model, count/Poisson
  family) and placement error.
- **Accuracy measures (citation/source recall, concept-relationship recall, comprehension).**
  Generalized (logistic) mixed-effects models for per-item correctness, with the same subject/document
  random-effect structure; for relationship recall, a graph-similarity score modeled likewise.
- **Likert / ordinal measures (orientation confidence, perceived distraction, usability, preference).**
  **Non-parametric** tests (Friedman across the three conditions with Wilcoxon signed-rank
  follow-ups) or cumulative-link mixed models; we do not treat single Likert items as interval.
- **Non-inferiority (H5).** A pre-specified equivalence/non-inferiority margin for perceived
  distraction and comprehension, tested with the appropriate one-sided / TOST procedure — *not* a
  failed superiority test reinterpreted as equivalence.
- **Reduced-motion equivalence (H6).** Tested as an equivalence claim (Field-RM vs. Field within the
  margin) *and* a superiority claim (Field-RM vs. Baseline), so "motion did not carry the benefit" is
  a positive result, not the mere absence of a difference.
- **Multiple comparisons.** The set of primary hypotheses is corrected (e.g., Holm–Bonferroni or a
  pre-registered hierarchy); secondary and exploratory analyses (including the dwell/memory-heatmap
  mechanism analysis of §5.5) are reported as exploratory and not used to claim confirmation.

### 5.8 Threats to validity

- **Learning / carryover.** Reading three documents in succession invites practice and fatigue
  effects; the Latin square balances order, and a between-subjects fallback is held in reserve.
  Sufficient inter-document breaks and distinct content reduce content carryover.
- **Novelty effect.** The field is unfamiliar; early enthusiasm may inflate subjective measures and
  short-term engagement. We mitigate with a familiarization document before measurement, by
  prioritizing *behavioral* primary measures (relocation time, placement error, recall accuracy) over
  self-report, and by noting that a single-session study cannot fully separate novelty from durable
  benefit (a limitation, §7).
- **Document-specific effects.** A benefit might ride on one document's quirks; the crossed
  document random effect and the Latin square are precisely the defense, and conclusions are framed to
  generalize over the document population, not the specific three.
- **Distraction confound.** A faster re-find could come *with* higher distraction; this is why H5 is a
  pre-specified non-inferiority test on distraction and comprehension, run alongside the
  superiority tests — the claim is *easier navigation without sacrificing the reading*, and both
  halves are measured.
- **Accessibility population.** A general-population sample under-represents motion-sensitive and
  assistive-technology users, for whom the reduced-motion path matters most. We over-recruit
  self-reported motion-sensitive participants for the H6/H6a analyses and treat conclusions about the
  accessibility population as preliminary, deferring the formal conformance argument to Paper 4. (A
  dedicated assistive-technology study is future work.)
- **Construct validity of the placement task.** "Where am I" placement is a proxy for orientation;
  we triangulate it with the confidence rating and the behavioral relocation measure rather than
  resting the orientation claim on one instrument.

### 5.9 Pre-registration

The study will be **pre-registered** before data collection: hypotheses (H1–H6a) with predicted
directions, the three conditions and the Latin-square assignment, the fixed materials and ground-truth
answer keys, the primary-vs-secondary measure split, the analysis models and random-effect structure,
the non-inferiority margins, the multiple-comparison correction, and the pilot-calibrated sample size.
The shipped demo and the analysis code are versioned; the materials and a deviations log are released
with the results, in the family's spirit of mechanical, checkable honesty.

---

## 6. Hypothesized outcomes

Framed strictly as predictions. **No results exist** (caveat canon, item 6); the following states
*what we expect* and *how each result would bear on the claim* — including how the claim could be
*refuted*.

- **If H1/H1a hold** (faster relocation, fewer actions under Field), the first half of the claim —
  *easier to navigate* — is supported for the most concrete navigation operation, re-finding a seen
  section. **If they fail** (no relocation benefit, or a cost), the claim is materially weakened: the
  central promised benefit did not appear.
- **If H2 holds** (better placement / higher orientation confidence under Field), the *orient within*
  half is supported: the memory map and live current-section actually improve sense of place. A null
  here, with H1 holding, would suggest the field speeds re-finding mechanically without improving the
  reader's *model* of the document — a narrower, still-interesting result we would report as such.
- **If H3/H4 hold** (better citation/source and concept-relationship recall under Field), the
  *relationship awareness* contribution is supported: surfacing the document's existing reference graph
  as relationships measurably helps. Nulls would indicate that *visible* relationships do not translate
  into *remembered* ones — bounding the claim to navigation/orientation and not relational memory.
- **If H5 holds** (distraction not higher, comprehension intact), the *without sacrificing* clause
  survives: the benefit is not bought with attention. **If distraction is higher or comprehension
  drops**, the claim is refuted in its strong form regardless of H1–H4 — a navigation aid that costs
  reading is not what is claimed.
- **If H6 holds** (Field-RM $\approx$ Field $>$ Baseline), the benefit is shown to live in *state*,
  not *motion* — consistent with the family's thesis that *motion is one representation of state, not
  the meaning itself* (and a precondition for the Paper 4 conformance argument). **If Field beats both
  Baseline and Field-RM**, the benefit depended on motion, which would weaken the accessibility story
  and reframe the contribution.
- **If H6a holds** (a real preference for reduced motion, stronger among motion-sensitive readers),
  the reduced-motion path is validated as a *first-class* mode rather than a degraded fallback.

The pattern that would *most strongly* support the paper's claim is: **H1–H4 positive, H5
non-inferior, H6 equivalence-positive** — easier navigation and orientation and relational recall,
without distraction, and with the benefit surviving the removal of motion.

---

## 7. Limitations

- **No study has been run.** This bears repeating as the governing limitation: §5–§6 are a design and
  a set of predictions. Until the study runs, the paper substantiates a *model* (verifiable against
  the shipped demo) and a *protocol*, not a measured benefit.
- **Novelty effect.** A single-session study cannot cleanly separate the appeal of a new, responsive
  document from a durable orientation benefit; a longitudinal or repeated-exposure study is needed to
  show the benefit persists past novelty.
- **The model rewards latent relational structure.** The Reading Field's relationship and memory-map
  value scales with how much *latent relational structure* a document already has — sections,
  cross-references, citations, a table of contents. On a short, flat, citation-free document the field
  has little to surface, and the overhead may not pay for itself (the general threat-to-framing of
  Paper 1 §10, specialized to reading). The study's matched, structure-rich materials are therefore a
  *favorable* case; generalization to thin documents is a separate question.
- **A reading-UX claim, not a physics claim.** The claim is about reading experience — orientation,
  re-finding, relational recall, distraction — *not* about physical fidelity. The memory update is a
  decaying-deposit metric, not a conserved physical quantity (the energy/momentum caveats of Paper 1
  §9.2 are not central here precisely because nothing in the Reading Field claims to be conserved
  physics; *memory* is a semantic-truth metric).
- **Population and ecological scope.** A controlled lab study with constructed documents trades
  ecological validity for control; field deployment on real reference content, with real
  prior-knowledge variance and real interruptions, is future work, as is a dedicated study with
  assistive-technology users.

---

## 8. Discussion

**What the field gives reading that a scroll-spy does not.** A scroll-spy highlights the section at
the current scroll position. The Reading Field highlights the section the reader is *attending to*
(viewport-centre attention with hysteresis), *remembers* what was read (the memory deposit), surfaces
the document's *relationship graph* (recovered from native markup), and turns the table of contents
into a *map of having-read* rather than a map of scroll position. The difference is the difference
between a position indicator and a *measured model of the reading*, and it is exactly the reciprocal
loop of Paper 1 applied to prose: the viewport reads the page, and the page reads the viewport back —
*state with hysteresis, not raw events.*

**Why semantic HTML is the point, not a constraint.** The easiest way to build an "orientation
overlay" would be to render the document into a bespoke reader canvas with its own navigation model.
The Reading Field deliberately refuses this. Keeping the document as semantic HTML — selectable,
accessible, translatable, crawlable, and degrading to a plain article — is what makes the second half
of the claim meaningful: the orientation benefit, *if it exists*, comes *for free on top of* a
document that loses nothing. This is also what makes the reduced-motion question (H6) coherent: because
meaning is in state and in the semantic document, motion can be removed without removing meaning, and
the study can *test* that rather than assert it.

**The system as its own instrument.** A small but distinctive feature of the design is that the field
already computes per-section memory, so the study can ask whether *machine-measured* memory predicts
*human* re-finding and recall (§5.5). If it does, the Reading Field is not only an aid to the reader
but a *measurement* of reading — a process signal that could, in principle, inform adaptive documents.
We flag this only as an exploratory direction; the present claim does not depend on it.

**Relation to the rest of the family.** The Reading Field is the family's *least speculative empirical
case* (README, "the best first three"): ordinary content, a shipped substrate, a narrow claim. It sets
up Paper 3 (Evidence Fields), which takes the relationship layer further — from "this reference exists"
to *support, contradiction, confidence, and provenance* — on the same substrate; and it supplies the
empirical setting in which Paper 4's reduced-motion conformance model can be *behaviorally* validated
(H6), not just asserted.

---

## 9. Conclusion

We have specialized the Fundamental paradigm to long-form reading and stated a single, falsifiable claim:
**a long-form document becomes easier to navigate and orient within when its sections, citations,
references, and the reader's attention participate in a measured field of memory and relation —
without sacrificing semantic HTML.** We gave a precise model — sections as bodies, viewport-centre
proximity as an attention well, dwell as a decaying memory deposit
($M(t+\mathrm{d}t) = M(t)\cdot\text{decay} + \text{deposit}$), native cross-references as a typed
relationship graph, and the table of contents as a memory-and-attention map — and grounded it in the
*shipped* Reading Field demo, which exercises all six scheduler phases (across four platform registries) while
writing only `--field-attention` and `--field-memory` back to a document that stays selectable,
accessible, translatable, and fully readable with the field off. We then designed a full,
pre-registerable user study — conditions (Baseline, Field, Field-RM), Latin-square-counterbalanced
materials, primary measures mapped to the project's evaluation targets (section-relocation speed,
reader orientation, citation/source recall, concept-relationship recall, perceived distraction,
reduced-motion preference), a mixed-effects analysis plan with crossed subject and document random
effects, a power estimate, and explicit threats to validity — and stated the predictions it would
test. Honoring the family's caveat canon, **no study has been run; everything empirical here is a
hypothesis or a design.** The next paper (Evidence Fields) carries the relationship layer into the
domain of AI trust and provenance; the reduced-motion equivalence the present study would
*behaviorally* probe is formalized as a conformance model in Paper 4.

---

## Appendix A. Reproducibility

Every model claim in this paper is checkable against the repository as of the verification date.

- **The shipped Reading Field demo:** `/docs/reading-field`, source
  `apps/site/src/pages/docs/reading-field.astro` — sections as measured bodies, viewport-centre
  attention, gated memory deposit, native-cross-reference relationship discovery, table-of-contents
  memory map, thresholded `field:lit`/`field:dim` with hysteresis, reduced-motion handling, and the
  `window.__readingField` verification surface.
- **The platform registries (measurement, state, feedback, relationships) and the six-phase scheduler** the demo exercises:
  `packages/dom/src/schedule.ts`, `platform.ts`, `measurement.ts`, `state.ts`, `feedback.ts`,
  `relationships.ts`, `overlays.ts`, `lint.ts` (the `relation-target-missing` rule). The six-phase
  scheduler and six registries are documented in Paper 1 §5.
- **The renderer-agnostic core** that computes the field behavior, including the memory metric and the
  attention model, free of DOM dependencies: `packages/core/` (the empty-allowlist DOM-boundary test
  `packages/core/src/engine/dom-boundary.test.ts`; Paper 1 §4.2).
- **The Natural Field Translation classification** that places *gravity → priority* and *memory* as a
  metric: `packages/core/src/config/manual.ts`; `docs/canonical/natural-fields.md`.

The corroborating canonical documents: `docs/canonical/interaction-and-relationship-model.md`
(§5 Attention as a Field, §7 RelationshipAgent + platform binding, §11 User Movement as Memory, §22
Reading and Editorial Experiences) and `docs/canonical/natural-fields.md` (the Reading Field
recipe = gravity + memory + relationships). The study materials, answer keys, analysis code, and
pre-registration are to be released with the study when it is run (§5.9).

## Appendix B. Conversion notes (markdown → preprint)

Notation is kept LaTeX-compatible (inline math and the memory-update and attention equations translate
directly). Figures referenced in prose but not yet drawn, to be produced at conversion time:

- **Figure 1** — the Reading Field at a glance: a document with sections as bodies, the viewport-centre
  attention well, and the table-of-contents memory map (§3).
- **Figure 2** — the attention-and-memory timeline for one section as the reader scrolls through it:
  $A_i(t)$ rising and falling, $M_i(t)$ accumulating past the dwell gate (§3.1–§3.2).
- **Figure 3** — the recovered relationship graph for a study document, overlaid on its table of
  contents (§3.3).
- **Figure 4** — the study design: three conditions × three documents Latin square, read-phase →
  task-phase flow, and the mapping of tasks to primary measures (§5.2–§5.4).

External citations in §2 have been located, verified, and merged
into [`references.md`](/writings/references) before submission — never fabricated (README convention; caveat
canon).

## Citation keys resolved

External citation keys/topics referenced in this paper have been assembled and verified into
`references.md`:

- Reading on screen — resolved by [mangen2013; ackerman2011; clinton2019] for screen/paper reading, spatial/kinesthetic cues, comprehension, and orientation (§2).
- Wayfinding and orientation — resolved by [conklin1987; nielsen1990hypertext] for hypertext orientation and wayfinding (§2).
- TOC / overview navigation — resolved by [furnas1986; shneiderman1996] for table-of-contents, overview/detail, fisheye navigation, and progress indicators (§2).
- Information scent — resolved by [pirolli1999] (§2).
- Citation and reference behavior — resolved by [jurgens2016; boyack2018] for citation, footnote, and cross-reference behavior (§2).
- Spatial/location memory — resolved by [mangen2013; ackerman2011] for spatial/location memory and paper-vs-screen cues (§2).
- Attention and distraction while reading — resolved by [bailey2006; mark2008] for attention, distraction, and interruption in interactive tasks (§2; underlies the perceived-distraction measure).

(These extend the `### Reading on screen, navigation, and document orientation` and *Attention, salience* groups in `references.md`. Per the caveat canon and the family naming/citation policy, any future additions must still be real, located, and verified before submission.)
