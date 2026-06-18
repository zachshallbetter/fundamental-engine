---
title: "Evidence Fields: Visualizing Support, Contradiction, Confidence, and Provenance in AI Interfaces"
description: "A field-based interaction model for evidence, confidence, contradiction, and provenance."
summary: "A field-based interaction model for evidence, confidence, contradiction, and provenance."
date: 2026-06-07
category: research
series: "Fundamental research"
order: 3
author: "Zach Shallbetter"
---

# Evidence Fields: Visualizing Support, Contradiction, Confidence, and Provenance in AI Interfaces

> **Status: research draft (preprint, work in progress).** Paper 3 of the Fundamental family — a domain
> validator for evidence and trust in AI interfaces. Claims verified against the codebase and
> canonical docs as of 2026-06-07. See the [series index](/writings) and *the caveat canon* therein.
> This is a preprint draft, not canonical product documentation.

**Author:** Zach Shallbetter
**Series:** Fundamental Research Papers, Paper 3 of 8
**Companion papers:** [Fundamental: A Field Translation Runtime for Relational DOM Interfaces](/writings/01-field-translation-runtime)
(flagship paradigm paper); [Reading Field](/writings/02-reading-field) (reading attention and document memory).
See the [series index](/writings).

---

## Abstract

AI assistants, retrieval systems, and other source-backed interfaces ask people to trust fluent
prose. The dominant trust primitives they offer — *inline citations* and a *confidence badge* — are
weak: a citation marks that *a* source was attached to *a* span, and a badge reports a scalar the
reader has no way to calibrate, but neither expresses the *relationships* that actually determine
whether a claim should be believed. Which source supports which claim? Where do two sources
contradict? Which sentence is unsupported entirely? How was this claim revised? These are relational
facts, and current interfaces flatten them into footnote markers and a single number.

We argue that AI interfaces need a **relational evidence model**, and we show that Fundamental — the
platform-native relational field runtime introduced in Paper 1 — can represent claims, sources,
support, contradiction, uncertainty, provenance, and revision as *inspectable field relationships*
rather than as decorations. In the **Evidence Field** model, claims are bodies; confidence is
priority (gravity / strength); a source that supports a claim binds to it (strong-interaction
binding, realized as a typed `supports` edge in the `RelationshipRegistry`); contradictory sources
*repel* and raise the entropy of the claim they touch (electromagnetic opposition); uncertainty is
the entropy metric; provenance is a memory trail; and a correction is a memory overwrite. Each
mapping is classified by *truth mode*, and almost all of them are *semantic truth* — meaning mapped
to a field metric — not physics.

We are deliberately more hedged than the flagship paper on two points. First, **Fundamental visualizes
evidence; it does not adjudicate it.** The runtime surfaces the support, contradiction, and
confidence that the *host* supplies; it has no fact-checking capability and makes no claim about
whether a source is correct. Second, although the Evidence Field *recipe* and the data-binding
mechanism (`bindData()`) that wires real claim/source records into the field both ship, and a
data-bound Evidence Field *study page* exists as an interactive demonstration, **no controlled
user-study results exist**. This paper therefore contributes a *model* and a *full study design*,
clearly labeled as design, not measured findings. The study's centerpiece is **trust calibration**
measured against ground truth (signal-detection *d′* and a calibration error), with an explicit
falsification path: a richer evidence display could *worsen* calibration by inducing over-trust, and
the design is built to detect exactly that.

---

## 1. Introduction

### 1.1 The problem: trust primitives in AI interfaces are weak

A modern AI answer is a paragraph of fluent text, occasionally annotated with superscript citation
markers and, sometimes, a confidence indicator. These two devices carry almost all of the
interface's burden of trust, and both are easy to ignore and structurally impoverished:

- **Inline citations** assert that a source was *attached to a span*. They do not say whether the
  source *supports* the span, *partially* supports it, is *about* it but neutral, or in fact
  *contradicts* a different span nearby. Citation markers are also easy to skip: a reader who trusts
  the prose has no reason to open them, and the marker looks identical whether the underlying source
  is a peer-reviewed study or an unrelated blog post.
- **Confidence badges** report a scalar — "high confidence," 0.82, three of five bars — that the
  reader cannot calibrate. A badge says nothing about *which* claims in the answer are confident and
  which are not, and a single number for a multi-claim answer is a category error: it averages over
  claims that may individually range from well-established to fabricated.

Crucially, neither primitive expresses *relationships*. The facts that matter for trust are
relational: *this* source supports *that* claim; *these two* sources contradict each other; *this*
sentence is unsupported by anything; *this* answer was revised after a correction. Inline citations
and badges encode none of this. The reader is left to reconstruct the evidence graph by hand, from
flat text, under exactly the conditions — speed, fluency, plausibility — that discourage them from
doing so.

### 1.2 Automation bias and over-trust of fluent output

The cost of weak trust primitives is not neutral. A large literature on **automation bias** and
over-reliance on automated decision aids documents that people tend to over-trust confident,
fluent system output and under-scrutinize it, particularly under time pressure
`[TODO: cite automation-bias / over-reliance]`. Large language models compound the risk: they
produce fluent, well-formed prose *independently* of whether the underlying claims are supported,
and studies of citation faithfulness in retrieval-augmented systems report that attached citations
frequently do not entail the claims they decorate `[TODO: cite citation-faithfulness / hallucination]`.
The interface, then, is being asked to communicate the *one thing the text itself cannot convey*:
where the prose is and is not anchored in evidence — and it does so with a footnote marker and a bar.

This is the gap the Evidence Field targets. The claim is narrow and we keep it narrow throughout:
AI and source-backed interfaces need a *relational* evidence model, and Fundamental can provide one in
which support, contradiction, confidence, and provenance are first-class, inspectable field
relationships rather than inline ornaments.

### 1.3 The Evidence Field idea

Fundamental's organizing principle (Paper 1, §3) is reciprocal: *elements bend the field; the field
bends them back.* Applied to evidence, the idea is this. Treat each **claim** in an answer as a
*body*. Treat each **source** as a body. Treat **support** as a binding relationship between a
source and a claim, and **contradiction** as an opposing one. Let the field then write back, onto
each claim, a continuous measure of how *coherent* (well-resolved, well-supported) or how
*uncertain* (conflicted, unsupported) it is — surfaced as CSS custom properties and thresholded
events that drive the claim's visual weight. An unsupported claim, bound to nothing, drifts and
reads as unstable; a claim ringed by mutually supporting sources reads as coherent; two sources that
contradict push apart and raise the local entropy of the claim between them. The evidence graph that
a reader would otherwise have to reconstruct from footnotes becomes a visible, inspectable field.

The decisive design constraint, repeated throughout this paper, is that **the field visualizes
evidence the host supplies; it does not establish truth.** The system has no oracle. Whether a
source actually supports a claim, and whether the claim is actually correct, are judgments the host
application (or its model, or its human authors) must make and feed in. Fundamental's contribution is
to make those supplied judgments *relational, legible, inspectable, and accessible* — not to make
them.

### 1.4 Contributions

This paper contributes:

1. **A relational evidence model** (§3): a mapping from evidence semantics — claim, source, support,
   contradiction, confidence, uncertainty, provenance, revision — onto Fundamental bodies,
   relationships, and metrics, grounded in the shipped Evidence Field recipe family and classified by
   truth mode. The model's honesty constraint (visualize, do not adjudicate) is made concrete by the
   code: the platform *derives* coherence and entropy from relationship resolution, while a claim's
   *confidence* is carried from the host — since #220 the engine computes **no** confidence fallback,
   so confidence is present only when supplied, and is never adjudicated.
2. **A full controlled user-study design** (§5): research questions, hypotheses, three conditions
   (a current-practice baseline, the Evidence Field, and a reduced-motion variant), a curated
   ground-truth corpus, tasks and measures keyed to the project's stated evaluation targets, a
   primary trust-calibration outcome (signal-detection *d′* plus a calibration error), a power
   estimate, an analysis plan, threats to validity, and a pre-registration commitment.
3. **An explicit falsification path** (§6): the prediction that a richer evidence display might
   *worsen* calibration through over-trust, and the specific way the design would detect it.

We defer the runtime architecture to Paper 5, the data-binding mechanics to Paper 7, the
reduced-motion conformance model to Paper 4, and diagnostics depth to Paper 8, cross-referencing
rather than re-explaining.

---

## 2. Background and related work

The Evidence Field sits at the intersection of several lines of work. We position it against each;
keys below correspond to entries to be assembled and verified in [`references.md`](/writings/references),
and every one is a placeholder, never a fabricated citation.

**Trust calibration in decision support.** Work on human–automation trust holds that the goal is not
maximal trust but *calibrated* trust — reliance that tracks the system's actual reliability — with
miscalibration taking two forms, over-trust and under-trust
`[TODO: cite trust-calibration / Lee-See trust-in-automation]`. This frames our primary dependent
variable: an evidence display is judged by whether it moves users toward calibration, not by whether
it raises confidence.

**Uncertainty visualization.** Visualizing uncertainty is hard: representations that *look*
authoritative can suppress appropriate doubt, and the encoding choice changes how much uncertainty
people perceive and act on `[TODO: cite uncertainty-visualization]`. The Evidence Field encodes
uncertainty as a continuous entropy metric written back to the claim — one such representation, and
it inherits these risks; §6 treats them as a falsification path, not a guarantee.

**Automation bias and over-reliance on AI.** People over-rely on confident automated output,
especially under load `[TODO: cite automation-bias / over-reliance]`; recent work on over-reliance
on LLM assistants asks whether explanations and confidence signals reduce or *increase* unwarranted
reliance, with mixed results `[TODO: cite over-reliance-on-LLMs]`. We take the mixed results
seriously: a relational display is not assumed to help.

**Source credibility and citation behavior.** Studies of credibility assessment and citation
inspection suggest attached references are frequently not opened and that credibility cues are often
heuristic rather than evidential `[TODO: cite source-credibility / citation-behavior]`. The Evidence
Field's premise is that making support *structural and visible*, rather than a marker the reader must
choose to open, could change this; the study tests it.

**LLM hallucination and citation faithfulness.** Retrieval-augmented generation attaches sources, but
evaluations report that a model's cited source frequently does not *entail* the sentence it is
attached to `[TODO: cite citation-faithfulness / attribution-evaluation]` — precisely the
relationship the Evidence Field externalizes: a "supports" edge can be *present but weak*, and a
contradiction can sit unmarked between two attached sources.

**Explanation usefulness and explainable AI.** Work on whether explanations *help* (vs. merely
satisfy) cautions that explanation can produce *illusory* understanding and that a plausible rationale
can raise trust without improving decisions `[TODO: cite explanation-usefulness / explainable-AI-evaluation]`.
We treat "explanation usefulness" as a measured construct in §5, not an assumed benefit.

**Position against the baseline.** Against the badge-and-citation baseline, Fundamental's stance is
*relational and inspectable*: evidence is a typed graph the reader can see and probe, not a per-span
marker plus a scalar. This inherits the flagship system's epistemic posture (truth modes, passports,
conformance; Paper 1, §6) and the explainability framing developed in Paper 8 — every visible
evidence behavior is traceable to a field cause. Whether the relational display measurably improves
*calibrated* trust over the baseline is the open empirical question this paper is designed to answer,
not to assert.

---

## 3. The Evidence Field model

### 3.1 The honesty constraint, stated first

Because every paragraph that follows discusses trust, we lead with the disclaimer and then never
relax it:

> **Fundamental visualizes evidence; it does not adjudicate it.** The runtime surfaces support,
> contradiction, confidence, and provenance *supplied by the host*. It performs no fact-checking,
> verifies no source, and asserts no claim's correctness. "Evidence" here names a set of inspectable
> relationships, not an automated judgment of truth.

This is not only rhetoric; it is enforced by the code. The platform metric library
(`packages/dom/src/metrics.ts`) is explicit about provenance: `coherence` and `entropy` are
*derived* from how relationships resolve (the ratio of resolved to total edges, minus the
conflicting ratio), but `confidence` is **supplied** by the host through `data-field-<metric>` and —
since #220 — has **no computed fallback at all**: the engine never infers confidence from relationship
presence (a citation is not certainty), so `--field-confidence` is written only when the host supplies
it. (`risk` and `priority` retain computed defaults; see the metric library.) A claim's
confidence enters the field because the application put it there. The field's job is to make the
*consequences* of that supplied evidence — which claims read coherent, which read contested — visible
and consistent.

### 3.2 The Natural Field Translation, applied to evidence

Paper 1 (§6.5) describes the Natural Field Translation System: Fundamental does not copy physics into
the interface, it *translates* the four fundamental fields into interface grammar — gravity →
priority, electromagnetism → polarity and signal, strong interaction → binding, weak interaction →
transformation. Evidence is a near-ideal domain for this translation, because an evidence graph
*already has* priority (confidence), polarity (support vs. contradiction), binding (a source backing
a claim), and transformation (revision and decay). The canonical natural-fields document already
files the Evidence Field under *electromagnetic + strong*
(`docs/canonical/natural-fields.md`), and the shipped recipe agrees.

The mapping, with each row's truth mode:

| Evidence semantics | Field representation | Engine vocabulary | Truth mode |
|---|---|---|---|
| Claim | a body | `[data-body]` element | Semantic |
| Confidence (of a claim) | priority / strength | gravity translation; `--field`-weight via strength | Semantic |
| Source | a body | `[data-body]` element | Semantic |
| Support (source → claim) | strong-interaction **binding** | `link`, `cohesion`; a typed `supports` edge | Semantic |
| Contradiction (source ↔ source / ↔ claim) | electromagnetic **opposition** | `charge` + `repel`; raises entropy | Semantic |
| Uncertainty | the **entropy** metric | `--field-entropy` (derived) | Semantic |
| Unsupported claim | unstable, bound to nothing → drift | low coherence; high entropy | Semantic |
| Provenance | a **memory trail** / path | `memory`; Citation Thread / Provenance Trail | Semantic |
| Correction / revision | **memory overwrite** | the memory-deposit update rule | Semantic |
| Verified claim | **coherence** | `--field-coherence` (derived) | Semantic |
| Active generation | stream / `fieldflow` | transport along structure | Semantic |

Almost every row is *semantic truth* (meaning → metric), by design. This matters for honesty: the
Evidence Field is not claiming to be physics. A "supports" edge does not obey a conservation law; it
is a translation of an editorial judgment into a field relationship so the field can render it
consistently. The one place a stricter register appears is contradiction, which borrows the
electromagnetic *polarity* idea — opposing charges push apart — but even there the discipline of
Paper 1's electromagnetic rule holds: **electric pushes, magnetic bends, fieldflow carries.**
Contradiction uses `charge`/`repel` to *push* conflicting bodies apart and to raise entropy; it does
*not* misuse `magnetism` (which bends moving charge and does no work) or `fieldflow` (transport along
structure). Keeping these lanes separate is what lets the model stay legible.

### 3.3 The shipped Evidence Field recipe

The Evidence Field is recipe #5 in the 64-recipe gallery and ships as a validated `FieldRecipe`
(`packages/core/src/recipes/catalog.ts`). Its definition, verbatim in substance:

```ts
export const EVIDENCE_FIELD: FieldRecipe = {
  id: 'evidence-field',
  name: 'Evidence Field',
  intent: 'show how sources support, weaken, or contradict a claim',
  naturalField: 'electromagnetic',           // electromagnetic (+ strong)
  primitives: ['charge', 'link', 'cohesion', 'repel'],
  bodies: [
    { body: 'charge',   strength: 0.9, range: 280, spin: 1 },
    { body: 'link',     strength: 0.7, range: 320 },
    { body: 'cohesion', strength: 0.6, range: 260, feedback: true },
    { body: 'repel',    strength: 0.5, range: 200 },
  ],
  relationships: [{ from: 'claim', to: 'source', type: 'supports', strength: 0.7 }],
  render: ['links', 'particles', 'heatmap'],
  metrics: ['coherence', 'entropy'],
  diagnostics: ['topology', 'causality', 'links'],
  accessibility: {
    reducedMotion: 'a static claim/source table with support and conflict badges',
    meaningWithoutMotion: 'each source is listed as supporting or contradicting, with a confidence label',
  },
  notes: 'Claims are bodies; supporting sources bind them (link + cohesion), contradictory sources ' +
         'repel and raise entropy (electromagnetic + strong). Strong evidence increases coherence.',
};
```

Every token here is real and passported (the recipe conformance gate, Paper 1 §7.3, rejects any
recipe whose primitives are not real passported tokens, whose render layers or diagnostics are not
real modes, or whose declared primitives drift from its body tokens). The four bodies translate the
evidence semantics directly: `charge` sets the support/contradiction polarity; `link` and `cohesion`
*bind* a supporting source to its claim (the strong-interaction translation); `repel` pushes a
contradicting source away and is what raises local entropy. The recipe's two declared `metrics` —
`coherence` and `entropy` — are exactly the two the platform *derives* from relationship resolution,
so the recipe's output is grounded in supplied edges, not invented. The `feedback: true` flag on
`cohesion` opts the binding into the reverse write-back (Paper 1, §8).

The Evidence Field does not stand alone. Five sibling recipes in the same family complete the
evidence vocabulary, all shipped and all validated:

| Recipe (shipped) | Natural field | What it shows | Primitives |
|---|---|---|---|
| **Evidence Field** | electromagnetic (+ strong) | support, contradiction, claim coherence | `charge`, `link`, `cohesion`, `repel` |
| **Trust Gradient** | electromagnetic | confidence, verification, unsupported claims | `charge`, `link`, `cohesion`, `memory` |
| **Source Constellation** | strong | sources clustering around claims/topics | `link`, `charge`, `gravity`, `memory`, `cohesion` |
| **Citation Thread** | electromagnetic | citations/footnotes/references as visible relationships | `link`, `fieldflow`, `charge`, `memory` |
| **Provenance Trail** | strong | origin + transformation history of content | `memory`, `link`, `morph`, `cohesion` |
| **Conflict Field** | weak (+ electromagnetic) | contradiction, uncertainty, unstable state | `charge`, `repel`, `morph`, `diffuse` |

Read together they belong to the canonical *Signal Path* theme — "citations, dependencies, evidence"
(`natural-fields.md`) — though at the token level the evidence recipes draw on `charge`,
`link`, `cohesion`, `repel`, `memory`, `morph`, and `diffuse` rather than the Signal Path triad
(`charge`/`propagate`/`fieldflow`) itself. Three are worth a
line. **Trust Gradient** is where confidence and the *unsupported-claim* surface live — its metrics
are `trust`, `confidence`, `coherence`, `entropy`, and its required reduced-motion form is "trust
badges with an evidence table and an unsupported-claim list." **Provenance Trail** carries `memory`
at strength 1.1 (the family's highest) because provenance *is* a persistence metric — the memory
trail of §3.2 — with `morph` carrying the transformation history (the weak-interaction translation).
**Conflict Field** isolates contradiction: opposing states `repel` and raise entropy, while `morph`
and `diffuse` carry the transformation pressure toward resolution or a decayed warning.

### 3.4 What writes back to the DOM

The reverse half of the loop — field → element — is where the model becomes legible to a reader
(Paper 1, §8). For evidence, the load-bearing write-backs are two derived scalars,
`--field-coherence` and `--field-entropy`, both of which are real platform output variables
(`packages/core/src/visual/tokens.ts`, `FIELD_OUTPUT_VARS`). The platform computes them per frame
from each claim's relationship neighborhood (`computeMetrics` in `packages/dom/src/metrics.ts`):

```
resolvedRatio = relResolved / relTotal
conflictRatio = relConflict / relTotal
coherence     = clamp01(resolvedRatio − conflictRatio)
entropy       = clamp01(conflictRatio + (1 − resolvedRatio) · 0.5)
```

Since #222, this resolution is **real**: `applyRecipe` counts `relResolved` as the edges whose
endpoints actually resolve and `relTotal` as resolved + declared-but-unresolved, so a citation
pointing at nothing lowers `resolvedRatio`, lowers coherence, and *raises* entropy (the
`(1 − resolvedRatio)` term is live, not dead code). The registry now tracks the unresolved declarations
rather than silently dropping them, and inspection can name each missing endpoint.

A claim with many resolved supporting edges and no contradictions reads as coherent (high
`--field-coherence`, low `--field-entropy`); a claim touched by contradictions reads as contested;
a claim with no edges at all stays low-coherence and inherits its prior entropy — the *unsupported*
case. Authors map these scalars to type weight, color, and a stability cue in pure CSS, exactly as
the flagship's "material typography" does for density. Crucially — and this is the honesty
constraint again, now mechanical — `confidence` is *not* in that derivation: it is supplied by the
host (`data-field-confidence`) and merely *carried*, never manufactured. The field can make a
supplied low-confidence claim *look* unstable; it cannot decide that the claim is false.

Thresholded events complete the write-back: a claim crossing into high entropy can emit an
`entropy-warning`-class event (the canonical event vocabulary includes `forces:entropy-warning`),
and a binding strengthening can emit a relationship event. These are debounced and inspectable, per
the interaction model. The relationship graph itself is owned by the **`RelationshipRegistry`**
(Paper 1, §5.2; `docs/canonical/interaction-and-relationship-model.md`, §7), which resolves
a `supports` or `contradicts` edge from native DOM signals (`href`, ARIA references,
`data-field-relation`) into a typed graph mapped onto core `RelationshipAgent`s, with a
`relation-target-missing` lint rule flagging any edge whose target is not a registered body.

---

## 4. Implementation status

A preprint earns trust by being precise about what is real. The verify-against-code rule (README)
governs here, and we apply it strictly — including where the codebase has moved *ahead* of earlier
planning notes.

**Shipped** (verifiable in the recipe catalog, the platform exports, and the tests as of 2026-06-07):

- The **Evidence Field recipe** and its five siblings (Trust Gradient, Source Constellation, Citation
  Thread, Provenance Trail, Conflict Field) ship as validated `FieldRecipe`s in
  `packages/core/src/recipes/catalog.ts`, gated by `validateRecipe`
  (`packages/core/src/recipes/schema.ts`).
- The **coherence/entropy metric derivation** and the supplied-vs-derived metric discipline ship in
  `packages/dom/src/metrics.ts`, with `--field-coherence` / `--field-entropy` as real output
  variables.
- **`bindData()`** — the data-binding mechanism that wires real claim/source records into the field —
  ships in `@fundamental-engine/dom` (`packages/dom/src/bind-data.ts`, with `apply-recipe.ts` and a
  test suite). Records become bodies, mapped metrics become state, and mapped relationships become
  graph edges, with deterministic id-diffed updates and decay-on-remove. (Its mechanics are the
  subject of Paper 7; we use it here only as the evidence wiring.)
- A **data-bound Evidence Field study page** exists as an interactive demonstration at
  `apps/site/src/pages/docs/studies/evidence-field.astro`: claims are records, each mapping to a body
  with `supports`/`contradicts` relationships to its sources; the `evidence-field` recipe turns those
  edges into coherence/entropy; flipping a source's polarity or adding/removing a claim updates the
  field deterministically; and a reduced-motion path is wired in.

**Not shipped, and the reason this paper is a design:** **no controlled user-study results exist.**
The study page is a *demonstration of the mechanism*, not an *experiment*. There is no curated
ground-truth corpus, no participant pool, no condition assignment, no measured trust calibration —
none of the apparatus §5 specifies. Caveat-canon item 6 holds in full: every empirical claim in this
paper is a *hypothesis* or a *design*, never a finding.

We flag a discrepancy honestly for the series lead. The roadmap archive
(`docs/planning-archive/roadmap-frontiers.md`, where data binding is frontier **R5** and AI evidence
fields are **R14**) framed `bindData()` and the Evidence Field study as *unbuilt*. The code has since advanced: `bindData()` and the data-bound study page both exist
(commits #210 and #213 in the repository history). The verify-against-code rule means the code wins,
so this paper reports the *mechanism and the demo as shipped* while holding firmly that the
*empirical study and its results do not exist*. The contribution remains a model plus a study
protocol; the demonstration strengthens the model's plausibility but is not evidence of user benefit.

---

## 5. A user-study design

This is the paper's centerpiece. We design a full controlled study to test whether the Evidence
Field improves *calibrated* trust in AI answers relative to current practice. It is a **design and a
protocol**; it has not been run.

### 5.1 Research questions and hypotheses

The motivating question, in the project's own words, is *"Does Evidence Field improve trust
calibration?"* (`docs/planning-archive/field-possibilities.md`). We refine it into five questions,
three of which map to an evaluation target the project already names (source-support recognition,
perceived distraction, accessibility preference), and two of which — contradiction detection and
unsupported-claim identification — extend that set:

- **RQ1 (support recognition).** Does the Evidence Field improve readers' accuracy at identifying
  *which source supports which claim*?
- **RQ2 (contradiction detection).** Does it improve detection of *contradictions* between sources?
- **RQ3 (unsupported-claim identification).** Does it improve identification of claims that are
  *unsupported by any source*?
- **RQ4 (trust calibration — primary).** Does it move readers' trust toward *calibration* with
  ground truth — i.e. raise discrimination between correct and incorrect claims (*d′*) and reduce
  calibration error — relative to the baseline?
- **RQ5 (confidence interpretation & explanation usefulness).** Does it improve readers'
  interpretation of supplied confidence, and do they rate the evidence display as *useful* for
  deciding whether to rely on the answer?

Directional hypotheses (predictions, restated as falsifiable in §6):

- **H1–H3.** Evidence Field > Baseline on support recognition, contradiction detection, and
  unsupported-claim identification.
- **H4 (primary).** Evidence Field improves calibration over Baseline: higher *d′*, lower calibration
  error (Brier score / expected calibration error, ECE).
- **H4′ (the danger hypothesis, pre-registered as a two-sided possibility).** The Evidence Field may
  *worsen* calibration via over-trust — a richer, authoritative-looking display could raise reliance
  on *incorrect* claims. We pre-register over-trust rate as a primary safety outcome, not a footnote.
- **H5.** The reduced-motion Evidence Field is *non-inferior* to the full Evidence Field on RQ1–RQ4
  (meaning survives without motion; Paper 4).

### 5.2 Conditions

A between-subjects (or counterbalanced within-subjects; see §5.6) comparison of three displays of the
*same* answers:

1. **Baseline — current practice.** The AI answer as prose with **inline citation markers and a
   confidence badge**. This is the honest state of the art, not a strawman: real citations the reader
   can open, and a per-answer confidence indicator.
2. **Evidence Field.** The same answer, same sources, rendered with the Evidence Field recipe family
   via `bindData()`: claims are bodies, support/contradiction are visible typed edges, coherence and
   entropy are written back per claim, and unsupported claims read unstable. Confidence is the *same
   supplied* value as the baseline — the only thing that changes is that evidence is *relational and
   visible* rather than a marker plus a number.
3. **Evidence Field, reduced motion.** The recipe's required static equivalent: the claim/source
   table with support and conflict badges, the unsupported-claim list, and confidence labels — no
   travel. This condition controls for the possibility that any benefit is a motion/novelty artifact
   and ties the study to the accessibility conformance claim of Paper 4.

All three render identical *content* and identical *supplied confidence*; they differ only in how
evidence relationships are expressed. This isolates the relational-display manipulation.

### 5.3 The corpus: AI answers with ground-truth annotations

The study requires a **curated corpus** of AI answers for which the evidence relationships are known,
because the dependent variables are scored against ground truth. Each answer is decomposed and
annotated by independent expert annotators (with inter-annotator agreement reported) along:

- **Claims** — the answer segmented into atomic, individually-verifiable claims.
- **Sources** — the source set attached to (or available for) the answer.
- **Support / contradiction labels** — for each (claim, source) pair: *supports*, *contradicts*, or
  *neutral/irrelevant*, with a strength.
- **Ground-truth claim status** — each claim labeled **correct**, **incorrect/hallucinated**, or
  **unsupported** (no source in the set entails it), established independently of the model's own
  citations.

The corpus is **balanced**: every answer contains a mix of well-supported-correct,
contradicted, and unsupported/hallucinated claims, so the tasks cannot be gamed by a constant
response. Item difficulty is piloted and items are stratified across difficulty. Domain coverage
spans at least three domains (e.g. a research-summary domain, a legal/policy-claim domain, and a
product-support domain) so that effects are not an artifact of one topic. The corpus, its annotation
guidelines, and agreement statistics are released with the pre-registration.

### 5.4 Tasks and measures

Tasks map directly to the project's evaluation targets (*source-support recognition*, *perceived
distraction*, *accessibility preference*; `field-possibilities.md` §20) and to the RQs:

| Task | Measures | Maps to |
|---|---|---|
| Match each claim to its supporting source(s) | **source-support recognition** accuracy (and *d′* over (claim, source) pairs) | RQ1 |
| Flag pairs of sources that contradict | **contradiction detection** — hit rate, false-alarm rate, *d′* | RQ2 |
| Mark claims unsupported by any source | **unsupported-claim identification** — hit/false-alarm, *d′* | RQ3 |
| Decide, per claim, whether to rely on it; rate confidence | **trust calibration** — *d′* (correct vs. incorrect), **Brier score / ECE** vs. ground truth; over-trust and under-trust rates | RQ4 (primary) |
| Interpret the supplied confidence; rate display usefulness | **confidence interpretation** accuracy; **explanation-usefulness** rating | RQ5 |

**Primary DV — trust calibration.** For each participant we collect, per claim, a reliance decision
and a subjective confidence. From these and the ground-truth claim status we compute:

- **Discrimination, *d′*** (signal-detection): treating "claim is correct" as signal and the
  reliance decision as the response, *d′* measures the reader's ability to *separate* correct from
  incorrect claims. Higher *d′* = better discrimination. We report criterion *c* alongside, because a
  display can shift *bias* (toward trusting everything) without improving discrimination — exactly the
  over-trust signature.
- **Calibration error** — the **Brier score** of probabilistic confidence against the binary
  correctness outcome, and **expected calibration error (ECE)** from a reliability binning. Lower =
  better-calibrated. We report a reliability diagram per condition.

**Secondary measures.** Over-trust rate (reliance on incorrect/unsupported claims) and under-trust
rate (rejection of correct, well-supported claims); decision time per claim; subjective workload
(a standard multi-dimensional workload instrument) `[TODO: cite workload-instrument, e.g. NASA-TLX]`;
perceived distraction; and an accessibility-preference item for the reduced-motion condition. Process
data — whether and when the reader opens a citation in baseline, or probes an edge / opens the
inspector in the Evidence Field — is logged to interpret the outcome measures.

### 5.5 Power and sample-size estimate (planning estimate)

A planning estimate only; the registered analysis fixes the final numbers. Treating the primary
contrast (Evidence Field vs. Baseline on calibration) as a between-groups comparison and targeting a
*medium* standardized effect (Cohen's *d* ≈ 0.5) at α = 0.05, two-sided, with 80% power, a standard
two-group calculation gives roughly **64 participants per condition** (≈ 128 for the two-condition
core contrast; ≈ 192 across all three conditions). A within-subjects design with counterbalancing
(§5.6) would reduce this materially by removing between-person variance, at the cost of carryover
risk. Because the *danger* hypothesis (H4′, over-trust) is a primary safety outcome and may be a
smaller effect, we will power for the *smaller* of the two primary effects and treat the per-condition
*n* as a floor, not a target. The number is a planning figure, not a result.

### 5.6 Procedure

After consent and a calibration warm-up (unrelated items, to familiarize participants with the
reliance-and-confidence response format), each participant works through a stratified sample of
corpus answers in their assigned condition, performing the §5.4 tasks per answer. A within-subjects
variant counterbalances condition order across answers (Latin square) and inserts a washout, to gain
power while guarding against carryover; the between-subjects variant avoids carryover entirely at the
cost of *n*. The reduced-motion condition is run under an enforced `prefers-reduced-motion` setting.
A short post-task interview (qualitative, on a subsample) probes *why* participants trusted or
distrusted specific claims, to interpret the calibration numbers. The full protocol, instruments, and
the corpus are deposited with the pre-registration before any data is collected.

### 5.7 Analysis plan

Confirmatory analyses are specified in advance and limited:

- **Primary.** Mixed-effects models with participant and item as crossed random effects: *d′* and
  calibration error (Brier/ECE) as outcomes, condition as the fixed effect, planned contrasts
  Evidence Field − Baseline (H4) and Evidence Field − reduced-motion (H5, an equivalence/non-
  inferiority test against a pre-registered margin).
- **Safety.** Over-trust rate as a primary outcome with the *same* model and an explicit pre-
  registered interpretation: a *significant increase* in over-trust under the Evidence Field, even
  with improved discrimination, is recorded as a partial failure (§6).
- **Secondary/exploratory.** Support recognition, contradiction detection, unsupported-claim
  identification, decision time, workload, distraction, accessibility preference; clearly labeled
  exploratory, with multiplicity control. Process-data analyses (citation opens, edge probes,
  inspector use) are exploratory mediators.

Effect sizes with confidence intervals are reported for every contrast; we do not treat *p* < .05 as
the finding. A reliability diagram per condition accompanies the calibration numbers.

### 5.8 Threats to validity

- **Automation bias / demand.** A novel, attractive display may induce participants to *perform*
  scrutiny or, worse, to over-rely; the reduced-motion condition, the over-trust safety outcome, and
  process logging are the guards.
- **Novelty effect.** First exposure to a field display could inflate (or depress) engagement; a
  warm-up, a within-subjects washout, and reporting of order effects address it.
- **Corpus bias.** Results may not generalize beyond the curated corpus; multi-domain coverage,
  difficulty stratification, released annotation guidelines, and reported inter-annotator agreement
  mitigate but do not eliminate this. The corpus's *construction* could itself favor the relational
  display (e.g. if contradictions are made unusually salient); annotation is therefore independent of
  the display design.
- **The richer-display-induces-over-trust risk — addressed directly.** This is the study's central
  threat and is elevated to a hypothesis (H4′) and a primary outcome, not buried. A display that
  makes evidence *look* thorough could raise reliance on *incorrect* claims. The design detects it
  through the *d′*/criterion decomposition (a bias shift without a discrimination gain is the
  over-trust signature) and through the explicit over-trust rate. If the Evidence Field raises
  confidence and reliance without raising discrimination, the study reports that as evidence *against*
  the system, not for it.
- **Construct validity of "calibration."** Reliance and confidence are imperfect proxies for trust;
  we triangulate with the qualitative interview and report both behavioral (reliance) and subjective
  (confidence) calibration separately.

### 5.9 Pre-registration

The hypotheses (including H4′), conditions, corpus, primary and secondary measures, the *d′* and
Brier/ECE operationalizations, the power floor, the analysis models, and the stopping rule are
**pre-registered** before data collection, on a public registry, with the corpus and analysis code
deposited. Deviations are reported as deviations. This is stated as a commitment of the design, not
as something already done.

---

## 6. Hypothesized outcomes

These are *predictions*. No data exists; nothing here is a finding.

**If the model's premise holds**, we would expect the Evidence Field to improve discrimination
(higher *d′*) and reduce calibration error (lower Brier/ECE) relative to the badge-and-citation
baseline, with the largest gains on **unsupported-claim identification** (the case the baseline
expresses worst — an unsupported claim looks identical to a supported one in plain prose) and on
**contradiction detection** (which the baseline does not express at all). We would expect the
reduced-motion condition to be non-inferior, supporting the Paper 4 claim that meaning is not
motion. We would expect process data to show readers *probing* the evidence graph (opening edges,
the inspector) more than they *open citations* in the baseline, and the explanation-usefulness rating
to favor the Evidence Field.

**The falsification case, stated as plainly as the success case.** The Evidence Field could
*worsen* calibration. The mechanism is over-trust: a relational display that *looks* authoritative
and thorough may raise readers' reliance on the answer wholesale — including on the incorrect and
unsupported claims it contains — even as it makes the supported ones easier to see. The
signal-detection decomposition is designed precisely to catch this: **over-trust appears as a shift
in criterion *c* (a bias toward reliance) without a corresponding gain in *d′* (discrimination).**
If the data show the Evidence Field raising confidence and reliance while *d′* is flat or lower and
the over-trust rate climbs, the honest conclusion is that the richer display *harmed* calibration,
and the paper would report that the relational evidence model, *as rendered*, fails its central
claim. A second failure mode is *no effect* — readers ignore the field as they ignore citations —
which the design also detects (null *d′* difference, unchanged over-trust). We commit in advance to
reporting either outcome. An inspectable trust display that quietly increases over-trust would be
worse than the baseline, and the study is built to say so.

---

## 7. Limitations

We restate the relevant caveat-canon items (README) and the model's specific limits.

1. **Visualization is not verification.** The Evidence Field surfaces the support, contradiction,
   and confidence *the host supplies*; it adjudicates nothing. A host that supplies wrong support
   labels will produce a confident, coherent-looking field around a false claim. The system's value
   is conditional on the quality of the supplied evidence, and the study's corpus is annotated
   *independently of the display* precisely so the evaluation is not circular.
2. **No user-study results exist** (caveat-canon item 6). The recipe family ships, `bindData()`
   ships, and a data-bound demonstration page ships — but the controlled study of §5 has not been
   run. Every empirical statement in this paper is a hypothesis or a design.
3. **The danger is real and unresolved.** The over-trust failure mode (§6) is not a hypothetical we
   can dismiss; the uncertainty-visualization and over-reliance literatures (§2) give concrete reason
   to expect that a richer display *can* hurt. Until the study is run, the model's benefit is
   genuinely open.
4. **Generalization across domains is unestablished.** Evidence semantics differ across research,
   legal, support, and journalistic contexts; the model is domain-agnostic by design, but its
   usefulness in any one domain is an empirical question the multi-domain corpus only begins to
   address.
5. **Semantic, not physical, truth** (caveat-canon item 4). The evidence mappings are *semantic*
   translations (meaning → metric), not physical laws; a "supports" edge is a rendered editorial
   judgment, and coherence/entropy are designed metrics, not conserved quantities. We keep the
   register explicit rather than dressing the model as physics.
6. **Scope.** Runtime architecture (Paper 5), data-binding mechanics (Paper 7), reduced-motion
   conformance (Paper 4), and diagnostics depth (Paper 8) are deferred; this paper validates one
   claim — that a relational evidence model is expressible and worth testing — and nothing more.

---

## 8. Discussion

The reason this matters is narrow and, we think, urgent: **the trust primitives shipping in AI
interfaces today are weak**, and they are weak in a *structural* way that more polish will not fix.
A confidence badge cannot express *which* claim is uncertain; an inline citation cannot express
*whether* the source supports the span or *contradicts* a neighbor; neither can show that a sentence
is supported by *nothing*. Those are relational facts, and a relational substrate is the natural
place to put them. Fundamental already has that substrate — typed relationships in the
`RelationshipRegistry`, derived coherence/entropy metrics, a reverse write-back, and a conformance
discipline that keeps the vocabulary honest — so the Evidence Field is less a new system than a
*reading* of an existing one onto the domain where weak trust primitives hurt most.

We are deliberately modest about what this buys. The Evidence Field is a *display*, and the central
risk of any trust display is that it manufactures confidence rather than calibrating it. We have
therefore refused to claim a benefit, designed the study so its primary outcome is *calibration* (not
confidence), elevated the over-trust failure mode to a primary safety outcome, and built the
signal-detection decomposition specifically to expose a display that increases reliance without
increasing discrimination. The honest summary is that Fundamental makes a relational evidence model
*expressible, inspectable, and accessible*, and that whether that model helps real readers make
better-calibrated trust judgments is an open empirical question with a real chance of a negative
answer — which is exactly why the study is worth running.

The discipline that makes the model trustworthy *as software* — the recipe conformance gate, the
truth-mode classification, the supplied-vs-derived metric boundary, the required reduced-motion
equivalent — is the same discipline that makes it trustworthy *as a research object*: every claim
about what the Evidence Field does is checkable against the catalog, the metric library, and the
relationship registry, not against prose.

---

## 9. Conclusion

AI and source-backed interfaces communicate trust through inline citations and confidence badges that
are easy to ignore and cannot express the relationships that actually govern belief: which source
supports which claim, where claims contradict, what is unsupported, how confident, and what the
provenance is. We presented the **Evidence Field**, a relational evidence model in which claims and
sources are bodies, support is binding, contradiction is electromagnetic opposition, uncertainty is
entropy, provenance is a memory trail, and revision is a memory overwrite — each classified by truth
mode, almost all of them semantic, and all of them *visualized, never adjudicated*. The Evidence
Field recipe and its five siblings ship and are conformance-validated; `bindData()` and a data-bound
demonstration page ship; **no controlled user-study results exist**. The contribution is therefore a
model and a full, pre-registerable study design whose primary outcome is *trust calibration* against
ground truth — and which is built, above all, to detect the failure case in which a richer evidence
display makes trust *worse* by inducing over-trust. Whether the model helps is the question; the
paper's job is to make that question answerable, honestly.

---

## Appendix A. Reproducibility

Every model claim in this paper is checkable against the repository.

- **The Evidence Field recipe family** (Evidence Field, Trust Gradient, Source Constellation,
  Citation Thread, Provenance Trail, Conflict Field): `packages/core/src/recipes/catalog.ts`.
- **Recipe schema and conformance gate** (`validateRecipe`, the strict primitives/render/diagnostic
  checks, the required accessibility equivalent): `packages/core/src/recipes/schema.ts`.
- **The metric library** — the supplied-vs-derived boundary, and the coherence/entropy derivation
  that grounds "visualize, don't adjudicate": `packages/dom/src/metrics.ts`.
- **Output variables** (`--field-coherence`, `--field-entropy` in `FIELD_OUTPUT_VARS`):
  `packages/core/src/visual/tokens.ts`.
- **The relationship graph** (`supports` / `contradicts` edges, native-signal resolution, the
  `relation-target-missing` lint): `packages/dom/src/relationships.ts`,
  `packages/dom/src/lint.ts`, and `docs/canonical/interaction-and-relationship-model.md`
  §7.
- **The data-binding mechanism** used to wire records into the field:
  `packages/dom/src/bind-data.ts` and `packages/dom/src/apply-recipe.ts`.
- **The data-bound Evidence Field study page** (demonstration, not experiment):
  `apps/site/src/pages/docs/studies/evidence-field.astro`.

Canonical design corroboration: `docs/canonical/natural-fields.md` (Evidence Field =
electromagnetic + strong; Signal Path = `charge`/`propagate`/`fieldflow`; the electromagnetic rule),
`docs/canonical/interaction-and-relationship-model.md` §26 (AI interface use cases) and §7
(`RelationshipAgent`), and `docs/canonical/authoring-and-recipes.md` §5 (the recipe schema).

## Appendix B. Conversion notes (markdown → preprint)

Notation is kept LaTeX-friendly (the *d′*, Brier, and ECE definitions and the coherence/entropy
formulas translate directly to inline and display math). Figures referenced in prose but not yet
drawn — the evidence-graph schematic (claims, sources, `supports`/`contradicts` edges; §3), the
field/metric write-back diagram (§3.4), the three study conditions side by side (§5.2), and a sample
reliability diagram with the *d′*/criterion decomposition annotated (§5.4) — are produced at
conversion time. External citations are all `[TODO: cite]` placeholders and must be resolved and
verified against [`references.md`](/writings/references) before submission; none is invented.

---

## Citations needed

External citation keys/topics referenced above, for the lead to merge into
[`references.md`](/writings/references) under the trust/evidence group (all currently `[TODO: cite]`, none
fabricated):

- `[trust-calibration]` — trust calibration in human–automation interaction; over-trust vs.
  under-trust; calibrated reliance (e.g. Lee & See, *trust in automation*).
- `[automation-bias]` — automation bias / over-reliance on automated decision aids, esp. under time
  pressure.
- `[over-reliance-on-LLMs]` — over-reliance on LLM assistants; whether confidence/explanation signals
  raise or reduce unwarranted reliance.
- `[uncertainty-visualization]` — uncertainty visualization; how encoding affects perceived and
  acted-on uncertainty.
- `[source-credibility]` — source credibility assessment and citation-inspection behavior (do readers
  open citations?).
- `[citation-faithfulness]` — citation faithfulness / attribution evaluation in retrieval-augmented
  generation (cited source not entailing the claim); LLM hallucination.
- `[explanation-usefulness]` — explanation usefulness / explainable-AI evaluation; illusory
  understanding; plausible rationales raising trust without improving decisions.
- `[signal-detection]` — signal-detection theory (*d′*, criterion *c*) as applied to discrimination
  in decision tasks.
- `[calibration-metrics]` — Brier score and expected calibration error (ECE) / reliability diagrams.
- `[workload-instrument]` — a validated subjective-workload instrument (e.g. NASA-TLX).
