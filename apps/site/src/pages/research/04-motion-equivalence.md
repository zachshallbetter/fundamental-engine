---
layout: ../../layouts/ResearchLayout.astro
title: "Motion Is Not Meaning: Reduced-Motion Equivalence in Field-Based Interface Systems"
paper: 4
---

# Motion Is Not Meaning: Reduced-Motion Equivalence in Field-Based Interface Systems

> **Status: research draft (preprint, work in progress).** Paper 4 of the field-ui family — the
> accessibility validator. Claims verified against the codebase and canonical docs as of 2026-06-07.
> See the [series index](/research) and *the caveat canon* therein. This is a preprint draft, not
> canonical product documentation.

**Author:** Zach Shallbetter
**Series:** field-ui Research Papers, Paper 4 of 8 (accessibility / reduced-motion equivalence)
**Companion papers:** the flagship paradigm paper, [field-ui: A Field Translation Runtime for
Relational DOM Interfaces](/research/01-field-translation-runtime), establishes the model, the six-registry
platform, and the truth-mode vocabulary this paper assumes; see also [Reading Field](/research/02-reading-field)
(the empirical reading study), [Evidence Fields](/research/03-evidence-fields) (trust and provenance). See
the [series index](/research).

---

## Abstract

Interfaces that express meaning through motion present a dilemma. If motion is expressive enough to
be useful, it risks being inaccessible to readers who cannot or should not be exposed to it — readers
with vestibular disorders, readers who set `prefers-reduced-motion`, readers on assistive technology.
If motion is dialed back to be safe, it risks being dismissed as decoration that carried no meaning in
the first place. The usual escape — a separate "reduced" code path — drifts from the real interface
over time and is rarely tested against it.

This paper develops field-ui's resolution of that dilemma into a checkable property. The single claim
is: **expressive field behavior can remain accessible when motion is treated as one *representation*
of field state, not the *source* of meaning — and that equivalence can be made a testable conformance
property rather than a hand-waved fallback.** We give (a) a formal equivalence model that traces
meaning from a *semantic source* (live DOM text and state) through a *visual–semantic binding* to a
*motion behavior* and its *static equivalent*; (b) a conformance model that makes "motion is not
meaning" mechanically checkable through shipped lint rules, a recipe schema that makes a reduced-motion
fallback *required*, and a proposed automated equivalence harness; and (c) an evaluation plan that
tests whether the reduced surface is non-inferior to the full-motion surface on comprehension,
orientation, and recall. We are precise about what ships — the reduced-motion guard, the
travel-gating user agent, the accessibility lint, the recipe-required accessibility field, and the
accessibility preview — and what is proposed. We claim no empirical result; the study is a protocol.

---

## 1. Introduction

### 1.1 The double bind of expressive motion

Motion in an interface is rarely neutral. A transition that travels can show *where a thing came
from*; a pulse can show *what is active*; a flowing ribbon can show *which way a relationship points*.
field-ui leans into this: its reciprocal loop (Paper 1, §3) writes field state — attention, heat,
memory, relationship strength — back onto the DOM, and a natural way to render those continuous scalars
is through movement.

But movement is exactly the channel that the accessibility literature warns about. A non-trivial
population experiences motion as a barrier rather than an aid: vestibular disorders can make
large-scale or parallax motion nauseating or disorienting, and the platform exposes a first-class
signal — the `prefers-reduced-motion` media query — for readers who have asked the system to stop
moving. [TODO: cite prefers-reduced-motion / vestibular accessibility] An interface whose *meaning*
is encoded in motion fails these readers twice: it withholds the meaning *and* it cannot simply turn
the motion off without turning the meaning off with it.

The mirror-image failure is just as real. An interface that uses motion *only* decoratively — motion
that carries no state, that could be removed with no loss — invites the conclusion that the whole
expressive layer is decoration. For a system like field-ui, which asks designers to reason about
*cause* ("why is this emphasized? what is pulling attention?"), being read as a particle toy is an
existential risk, not a cosmetic one. The flagship paper names this directly as a threat to the
framing: "the risk of 'spectacle over meaning' is real" (Paper 1, §10).

### 1.2 The antipattern: the degraded second path

The conventional answer to "make it accessible" is a *fallback*: a second, simpler rendering that the
system shows when motion is unwelcome. The trouble with a fallback-as-second-path is structural. It is
authored separately, so it can encode *different* information from the primary surface; it is exercised
rarely, so it drifts; and because it is framed as a lesser experience, the meaning it must preserve is
treated as negotiable. A fallback that quietly drops a state the primary surface conveyed is not a
smaller version of the interface — it is a different, lossy one. The accessibility canon in this
project names the failure mode explicitly: `MISSING_REDUCED_MOTION`, "no accessible fallback"
(`packages/core/src/contracts/guards.ts`).

### 1.3 The field-ui stance: the same field, differently revealed

field-ui takes a different stance, stated in the flagship as the overview this paper expands
(Paper 1, §8.5): **motion is one representation of state, not the meaning itself.** Under that stance,
reduced motion is not a degraded fallback path but *the same field differently revealed.* The
underlying field — attention, memory, relationship, heat — is computed identically whether or not
motion is allowed; what changes is only *how that computed state is rendered.* A particle's travel and
a frozen highlight are two renderings of one density value. Dropping the travel does not drop the
density; it changes the pen, not the number.

This reframe rests on a property the platform already enforces. Field state lives in CSS custom
properties and typed registries, not in pixel motion: the canonical accessibility preview puts it
plainly — under `prefers-reduced-motion: reduce` "the engine freezes the simulation (`dt = 0`) — but
the field's *state* still reads, because it lives in CSS variables, not in travel"
(`apps/site/src/pages/docs/accessibility-preview.astro`). The state is the thing; motion is one of
its skins.

### 1.4 Contributions

This paper contributes the accessibility model behind that stance:

1. **A formal equivalence model** (§3): a four-part chain — *semantic source → visual–semantic
   binding → motion behavior → static equivalent* — with a mapping table from each motion form to its
   static equivalent, and three invariants the chain must preserve (*meaning is never motion-only*;
   *color is never the sole carrier*; *state still tracks under reduced motion, only easing drops*).
2. **A conformance model** (§4) — the central contribution — that turns "motion is not meaning" from
   an aspiration into a checkable property, through shipped lint rules (`visual-orphan`,
   `visual-not-hidden`, `feedback-non-css-var`), a recipe schema that makes a reduced-motion fallback
   *required* (`accessibility.reducedMotion` / `meaningWithoutMotion`), a reduced-motion guard, a
   travel-gating user agent, and a *proposed* automated equivalence-conformance check, with a precise
   Implementation-status accounting of ships-versus-proposed.
3. **An evaluation plan** (§5): a non-inferiority study design that asks whether the reduced surface
   preserves meaning — comprehension, orientation, recall — across a full-motion, reduced-motion, and
   static-baseline condition, with a preference probe for motion-sensitive readers and a probe for any
   meaning a reader can get *only* from motion.

Scope discipline. This paper concerns accessibility and reduced-motion equivalence *only*. It assumes
the runtime architecture (deferred to Paper 5), the reading study (Paper 2), the evidence/trust model
(Paper 3), recipe authoring (Paper 6), and diagnostics (Paper 8), and cross-references rather than
re-explains them. Per the caveat canon (item 6), every empirical statement here is a hypothesis or a
design, never a finding.

---

## 2. Background and related work

**`prefers-reduced-motion` and platform motion signals.** The web platform exposes a user preference
for reduced motion as a CSS/JS media query, intended for readers for whom motion is a barrier rather
than an enhancement. field-ui reads it through an injected host capability —
`reducedMotion()` on the `FieldHost` interface, documented as "whether the user prefers reduced motion
(freezes the sim)" (`packages/core/src/core/host.ts`) and implemented in the browser host via
`matchMedia('(prefers-reduced-motion: reduce)')` (`packages/platform/src/browser-host.ts`). The
standard's framing — motion is a *preference dimension*, not a binary on/off of the interface — is the
seed of this paper's model. [TODO: cite prefers-reduced-motion media-query specification]

**WCAG motion guidance and vestibular accessibility.** Accessibility guidelines treat motion as a
hazard to be controllable and treat animation-from-interactions as something a user must be able to
disable without losing function. The motivating clinical reality is vestibular dysfunction, for which
motion — especially large, parallax, or unexpected motion — can induce nausea, dizziness, and
disorientation. The design obligation that follows is not "remove motion" but "ensure no information
or function is *lost* when motion is removed." [TODO: cite WCAG 2.x motion / animation-from-interaction
guidance] [TODO: cite vestibular-disorder accessibility literature]

**Color is not the only carrier of meaning.** A long-standing accessibility principle holds that color
must never be the sole means of conveying information, because color perception varies across readers.
field-ui generalizes the principle from color to *any single expressive channel* — color, glow, and
critically motion — and encodes it as a rule: "Color is not the only carrier of meaning. Motion is
optional. Reduced motion preserves state without travel" (visual-language §16; §5.2). We treat
"motion is not the only carrier" as the exact analogue of "color is not the only carrier," and apply
the same remedy: pair the expressive channel with a redundant, accessible one. [TODO: cite
color-is-not-the-only-means / redundant-coding guidance]

**Animation as information versus decoration.** A separate line of work distinguishes *functional*
animation (motion that communicates causality, continuity, or hierarchy) from *decorative* animation
(motion that does not). field-ui's truth-mode taxonomy (Paper 1, §6.3) gives this distinction teeth at
the level of *forces*; this paper extends it to the level of *rendering*, asking of each motion: does
it carry state that has no other carrier? If yes, the static equivalent must carry that state too; if
no, it may simply be removed. [TODO: cite functional-vs-decorative animation literature]

**The degraded-fallback antipattern.** Practitioner accounts of accessibility regressions repeatedly
describe a second, simplified path that diverges from the primary one and is under-tested. We position
field-ui against this directly: the contribution is not "field-ui has a reduced-motion fallback" — many
systems do — but that the fallback is *derived from the same state* and is *checkable against the
primary surface*, which is what a degraded second path is not. [TODO: cite accessibility
fallback-divergence / dual-codebase drift]

The distinguishing stance, as in the rest of the family, is *epistemic*: field-ui makes the
accessibility property auditable — a guard that throws, lint that warns, a schema field that is
required, a preview that renders the reduced surface — so the claim "meaning survives without motion"
can be checked rather than asserted.

---

## 3. The equivalence model

The model traces a single chain from meaning to its renderings and asks what must be invariant along
it. Read it as: *the meaning is fixed at the source; the renderings vary; the static rendering must
lose nothing the meaning depended on.*

```
semantic source  →  visual–semantic binding  →  motion behavior   (motion allowed)
                                              ↘  static equivalent (reduced motion)
```

### 3.1 Semantic source: live DOM is canonical

The meaning lives in the DOM, not in any rendering of it. A field-ui page is *ordinary semantic
HTML*: the Reading Field study is "an ordinary article — sections, headings, citations, a table of
contents" wired to the platform (Paper 1, §5.4). The accessibility canon makes the source's primacy a
rule: "Live semantic text remains in the DOM. Vectorized text must be paired with hidden or equivalent
semantic text. Canvas visuals require semantic DOM fallback" (visual-language §16). Field state that
is *derived* — attention, memory, relationship strength — is written back as CSS custom properties and
typed registry state, not as new prose; the prose a reader (or a screen reader) consumes is unchanged
by the field. The semantic source is what every other layer must preserve. It is canonical because it
is the layer a reader can always reach: through the accessibility tree, through reader mode, through
plain HTML with every visual layer stripped.

### 3.2 Visual–semantic binding: pair the expressive layer to its source

An expressive visual layer — an SVG overlay, a canvas render surface, a WebGL field — is bound to the
semantic element it represents through the platform's `VisualBindingRegistry`
(`packages/platform/src/visual-bindings.ts`). A binding declares a `visual`, an optional
`semanticSource`, and a `role` (`decorative | representation | debug | relationship | measurement`),
and carries an accessibility record: whether the visual is `aria-hidden`, whether its role *requires*
a semantic source, and whether it would expose duplicate semantics to assistive technology. The
registry encodes two rules in code, not prose:

- A visual whose role *represents* meaning (`representation`, `relationship`) **must** bind a semantic
  source; an orphan is an error.
- A visual that does *not* carry independent meaning **should** be `aria-hidden`, so screen readers do
  not read the decorative layer.

The canonical statement is the native primitive field-ui wishes existed: "this visual represents that
semantic element; don't double-expose it" (file header). The binding is the seam where the expressive
layer is *attached* to meaning rather than *substituting* for it — which is what lets the expressive
layer be freely transformed (including reduced to static) without endangering the meaning underneath.

### 3.3 Motion behavior and static equivalent

When motion is allowed, the bound visual renders field state as movement. When motion is not allowed,
the *same field state* renders as a static equivalent. The mapping is not improvised per page; it is a
fixed table in the Accessibility Contract (system-contracts §14), reproduced in the shipped
accessibility preview (`apps/site/src/pages/docs/accessibility-preview.astro`):

| Motion form (full mode) | Static equivalent (reduced mode) | State preserved |
|---|---|---|
| particles travel | particles freeze or fade | local density / occupancy |
| sparks | static highlight | a discrete event / threshold crossing |
| `fieldflow` ribbons | static field lines | relationship direction / routing |
| heat trails | soft wash | accumulated heat / activity |
| body motion | CSS state only | the body's own engaged/lit state |
| turbulence | contour snapshot | instantaneous field shape |

Each row is a *representation swap*, not an information drop: the right column is a different rendering
of the same scalar the left column animated. Travel becomes presence; a spark (a moment in time)
becomes a highlight (the same moment, held); a flowing ribbon (direction shown over time) becomes a
static field line (direction shown in space). The reduced render preset names this surface directly:
`reduced` = "static contours + DOM state" (visualization-methods-taxonomy §0), as distinct from the
animated presets (`beautiful`, `plasma`, `thermal`).

The emission channel shows the swap at the level of a single value. Under reduced motion, glow does
not pulse — it flattens to a static highlight: `emission()` maps heat to radius with linear (not
eased) interpolation and halves the alpha when `reducedMotion` is set, so a pulsing bloom becomes a
flat, bounded highlight (`packages/core/src/visual/channels.ts`). The state (heat) is identical; only
its rendering loses its temporal dimension.

### 3.4 Three invariants

The chain is disciplined by three invariants, each restated from the accessibility canon and each
enforced somewhere in code (§4):

1. **Meaning is never motion-only.** Every motion that carries state has a static equivalent that
   carries the same state. The contract states it twice — "Motion is optional. Meaning is never
   motion-only" (system-contracts §14) — and the recipe schema makes the equivalent *mandatory* (§4.2).
   This is the load-bearing invariant; the other two are its corollaries for specific channels.
2. **Color is never the sole carrier of meaning.** State that a reader must perceive is encoded
   redundantly — outline, icon, text, layout, or tone — not in hue alone (visual-language §5.2). The
   reduced surface, having dropped motion, must not then lean on color as a single replacement
   channel; that would trade one inaccessible monopoly for another.
3. **State still tracks under reduced motion; only easing drops.** The field keeps computing. The
   shipped Reading Field path is the canonical demonstration: under `prefers-reduced-motion` the CSS
   drops the transitions (`transition: none`) while the JavaScript still computes attention and writes
   `--field-attention`, so "the values simply snap instead of easing"
   (`apps/site/src/pages/docs/reading-field.astro`; the page's own copy: "The animation stops; the
   meaning does not. Attention and memory still track, the current section is still marked, the rails
   still fill"). Reduced motion removes the *interpolation between states*, not the states.

### 3.5 Grounding: the shipped accessible surfaces

The model is not purely normative; two shipped surfaces instantiate it. The **accessibility preview**
(`apps/site/src/pages/docs/accessibility-preview.astro`) renders any composition as its reduced
surface side-by-side with the motion-on surface, with the full→reduced mapping table; its headline
reads its "lit" state from a single `--d` scalar that drives weight, color, and glow, with motion as a
purely decorative pulse that both the OS setting and an in-page toggle disable — leaving the lit state
fully readable. The **Reading Field** (`/docs/reading-field`, invariant 3 above) is the real-content
instance. The flagship lists both as shipped (Paper 1, §9.1); they are the existence proofs that the
chain of §3.1–§3.4 can be authored on real pages, not only specified.

---

## 4. The conformance model

The central contribution is not the equivalence chain — equivalence chains can be drawn for any
fallback — but making the chain *checkable*. This section gives the mechanisms that turn "motion is not
meaning" into a property a tool can fail. Three are shipped (lint, schema, guard); one is proposed
(the automated equivalence harness); the preview is the human-in-the-loop verifier that ties them
together.

### 4.1 Shipped: the accessibility lint rules

The platform's `lintPlatform()` (`packages/platform/src/lint.ts`) aggregates pure, read-only rules
over the registries; three of them are accessibility seams. Lint *reads — it never mutates state,
physics, or the DOM* (file header), so running it is side-effect free.

- **`visual-orphan`.** A visual binding whose role represents meaning but has no semantic source. This
  catches the precise failure where an expressive layer *becomes* the carrier of meaning instead of
  *representing* a carrier — exactly the condition under which reducing or hiding the visual would lose
  meaning. Surfaced from `VisualBindingRegistry.lint()` as `orphan-representation` (severity *error*)
  and mapped to `visual-orphan` in `lintVisuals()`.
- **`visual-not-hidden`.** A decorative or non-representational visual that is not `aria-hidden`. This
  catches the inverse failure: a layer with no independent meaning that nonetheless exposes itself to
  assistive technology, doubling what the screen reader reads. Severity *warning*.
- **`feedback-non-css-var`.** A feedback binding that writes ARIA or attributes instead of a `--field-*`
  custom property. Severity *error*. This rule is an accessibility rule in disguise: it enforces that
  field *state* is written to CSS variables (a presentational channel) and never masquerades as
  *accessibility state* — "state must not write ARIA/attributes" (`lintFeedbackVars`). Keeping field
  density out of the accessibility tree is what stops the field from spamming assistive technology with
  per-frame churn, which the contract forbids ("Field events should not spam assistive tech",
  system-contracts §14). The single-writer discipline — only the `FeedbackRegistry` turns state into
  DOM-visible output (Paper 1, §5.2) — is what makes this rule sufficient.

These rules are listed in the Platform-Lint Contract, marked **Implemented** (system-contracts §23),
and surface alongside the structural rules (`relation-target-missing`, `state-unregistered`,
`overlay-without-links`, `measurement-off-phase`). Their accessibility role is the §16 visual-language
rule made operational (visual-language §18.1).

### 4.2 Shipped: the recipe schema makes a fallback required

A field recipe — the portable, serializable unit of field behavior (Paper 1, §7.3; developed in
Paper 6) — cannot validate without declaring its reduced-motion equivalence. The schema
(`packages/core/src/recipes/schema.ts`) makes `accessibility` a non-optional field of `FieldRecipe`,
with the comment that states the policy: "the reduced-motion + meaning-without-motion equivalent —
required: no recipe is motion-only." The field's shape is two required strings:

```ts
interface AccessibilityRecipe {
  /** what replaces motion under prefers-reduced-motion. */
  reducedMotion: string;
  /** how meaning survives without color/motion. */
  meaningWithoutMotion: string;
}
```

and the validator enforces both:

```ts
if (!r.accessibility || !r.accessibility.reducedMotion || !r.accessibility.meaningWithoutMotion)
  problems.push({ path: 'accessibility',
    issue: 'reducedMotion + meaningWithoutMotion are required (no recipe is motion-only)' });
```

This is the antipattern of §1.2 inverted at the authoring layer. A second, drifting fallback path is
*possible* in a system where the fallback is optional; here it is structurally impossible to ship a
valid recipe that has not said, in words, what replaces its motion and how its meaning survives without
color or motion. The declaration is *prose* today (a human sentence), which is a real limitation we
return to in §6 — the schema requires that the author *answer the question*, not yet that a machine
*verify the answer*.

### 4.3 Shipped: the reduced-motion guard and the travel-gating user agent

Two further mechanisms enforce the invariants at runtime rather than at authoring time.

The **reduced-motion guard** (`packages/core/src/contracts/guards.ts`) is the assertion form of
invariant 1. `assertReducedMotionFallback(hasFallback)` throws a `MISSING_REDUCED_MOTION` error —
"motion-dependent meaning needs a reduced-motion fallback" — when a motion-dependent surface has no
fallback declared. The named error is in the project's error taxonomy as "no accessible fallback"
(system-contracts §17). The accessibility test set asserts the guard both ways: it *does not throw* with
a fallback and *throws* without one (`packages/core/src/contracts/a11y.test.ts`).

The **travel-gating user agent** (`packages/core/src/agents/user-agent.ts`) is invariant 3 at the
level of the input source. The user agent projects a field source from pointer, focus, and selection.
Under reduced motion, the *moving* part of that source — the pointer "wake" — is dropped, while the
*static, accessible* part — a focused element's attention well — remains:

```ts
wake: !u.reducedMotion && moving ? { x: u.px!, y: u.py!, vx: u.vx, vy: u.vy } : null,
focus: u.focusId,   // present even under reduced motion
```

This is the code form of the interaction model's rule "focus creates state, not travel"
(interaction-and-relationship-model §10): the reduced surface keeps the accessible attention well that
focus creates and drops the travel that pointer motion creates. The a11y test verifies it directly —
"no travel under reduced motion" yet "accessible focus source remains"
(`packages/core/src/contracts/a11y.test.ts`). The same test confirms the emission flattening of §3.3
(reduced-motion alpha strictly below motion-on alpha) and that color/glyph are not sole carriers (the
core visual lint raises `color-only-meaning` and `glyph-only-text`, `packages/core/src/visual/lint.ts`).

Taken together: the Accessibility Contract is a *named, published* contract in the `CONTRACTS` catalog,
"enforced by the reduced-motion guard, the UserAgent travel-gating, and the a11y lint rules, with a
dedicated test set" (system-contracts §14). The accessibility property is, in the family's sense,
*auditable* — it is checked by running tests, not by trusting prose.

### 4.4 Proposed: an automated equivalence-conformance check

What ships verifies *components* of equivalence — a fallback is declared, a representation has a
source, glow flattens, focus survives. What does not yet ship is a single automated check that the
*meaning-bearing state of a whole composition is present and readable with motion disabled.* We propose
it, framed as a design, not a result.

The proposed **equivalence-conformance check** would, given a composition and its visual bindings:

1. Render the composition twice — full motion and reduced motion (`reducedMotion: true`), reusing the
   path the recipe applier already exposes (`applyRecipe(..., { reducedMotion })`,
   `packages/platform/src/apply-recipe.ts`; exercised by `FieldLoopDemo.astro`).
2. Enumerate the meaning-bearing state for each measured body — the `StateRegistry` values written
   back as `--field-*` variables, plus the typed relationships — in *both* renders.
3. Assert *state equivalence*: every meaning-bearing value present under full motion is present, and
   reads to the same threshold class, under reduced motion. Travel and easing may differ; the state
   keys and their thresholded values may not.
4. Assert *carrier redundancy*: each state a reader must perceive is exposed through at least one
   non-motion, non-color-only channel (text, outline, icon, layout, tone) — the lint rules of §4.1
   composed into a single per-composition assertion.
5. Assert *no orphaned meaning*: no `visual-orphan`, and every `representation` visual still resolves to
   live semantic text after the visual layer is hidden.

The check would slot into the conformance methodology the family already uses for forces (Paper 5) and
the project's Conformance Contract, which already lists a "reduced-motion test" among required proofs
(system-contracts §16). Its output is a pass/fail plus the list of states that failed to survive — a
*diagnostic*, which is where it hands off to Paper 8. We claim only the design here; the harness is not
built.

### 4.5 Implementation status

To be precise, in the family's house style:

**Shipped** (verifiable in the registries, the schema, the contracts catalog, and the tests):

- The accessibility lint rules `visual-orphan`, `visual-not-hidden`, `feedback-non-css-var` in
  `lintPlatform()` (`packages/platform/src/lint.ts`, `visual-bindings.ts`), and the core visual-lint
  rules `color-only-meaning`, `glyph-only-text`, `missing-reduced-motion`
  (`packages/core/src/visual/lint.ts`).
- The recipe schema's **required** `accessibility.reducedMotion` and `accessibility.meaningWithoutMotion`
  fields and their validation (`packages/core/src/recipes/schema.ts`).
- The reduced-motion guard `assertReducedMotionFallback` / `MISSING_REDUCED_MOTION`
  (`packages/core/src/contracts/guards.ts`) and the travel-gating user agent
  (`packages/core/src/agents/user-agent.ts`), both with the a11y test set
  (`packages/core/src/contracts/a11y.test.ts`).
- The `reducedMotion()` host capability that freezes the simulation
  (`packages/core/src/core/host.ts`, `packages/platform/src/browser-host.ts`).
- The accessibility preview (`apps/site/src/pages/docs/accessibility-preview.astro`), the reduced-motion
  path of the Reading Field (`apps/site/src/pages/docs/reading-field.astro`), and the static narrative
  collapse (visualization-methods-taxonomy §13: under `prefers-reduced-motion` the narrative "collapses
  to a static preview that still names each layer and shows its current state").
- The `reduced` render preset ("static contours + DOM state", visualization-methods-taxonomy §0).

**Proposed** (a design in this paper, not shipped): the automated equivalence-conformance harness of
§4.4 — a single check that the *whole* meaning-bearing state of a composition survives motion being
disabled. The recipe schema currently requires the author to *state* the equivalence in prose; the
harness would *verify* it.

---

## 5. Evaluation plan

The conformance model of §4 can verify that meaning-bearing state is *present* under reduced motion.
It cannot verify that a *human* perceives the reduced surface as equivalent — that the meaning survives
in the reader, not only in the registry. That is an empirical question, and this section is its
protocol. Per the caveat canon (item 6), it reports **no results**; it is a plan.

The project's evaluable claim is stated plainly: *Does reduced-motion equivalence preserve meaning?*
This is a lighter study than the reading and evidence studies (Papers 2–3), because its dependent
variable is narrower: not "does the field help?" but "does the reduced surface lose anything the full
surface conveyed?"

### 5.1 Design and conditions

A between- or mixed-subjects design with three conditions over the same content (a Reading Field
article and an Evidence Field panel, so the claim is tested on both a reading and a trust surface):

- **C1 — full-motion field:** the composition as authored, motion allowed.
- **C2 — reduced-motion field:** the *same* composition under `prefers-reduced-motion` — the static
  equivalents of §3.3, the field still computing.
- **C3 — static baseline:** the semantic HTML with the field layer absent entirely (no visual–semantic
  binding, no reduced equivalent) — the floor against which both field surfaces are measured.

C2 is the surface under test; C1 is the full expressive surface it must not fall below; C3 isolates how
much of any effect is the field at all versus the prose.

### 5.2 Primary test: non-inferiority

The core test is **non-inferiority of C2 relative to C1** on meaning-preservation measures. The
hypothesis is *not* that reduced motion is *better* — it is that reduced motion is *not worse* on the
meaning the interface is supposed to convey:

- **Comprehension:** accuracy on questions about content and structure (what does this section say;
  which claim does this source support).
- **Orientation:** "where am I / where have I been" — can the reader locate the current section and
  recall which regions they have visited (the memory field, rendered statically under C2).
- **Recall:** delayed recall of content and of relationships (which claim was contradicted, which
  section was emphasized).

Non-inferiority requires a pre-registered margin: C2 is accepted as preserving meaning if its mean on
each measure is within margin $\delta$ of C1 (one-sided test against the inferiority bound, not a
two-sided test for a null difference). The margin and sample size are set a priori from a pilot; we do
not state numbers here because no pilot has run.

### 5.3 Secondary measures

- **Preference among motion-sensitive readers.** Among participants who self-report motion sensitivity
  or who run with reduced motion enabled, *preference* and *self-reported comfort/symptoms* for C1
  versus C2. The hypothesis is a comfort advantage for C2 with no comprehension cost — the whole point
  of the equivalence.
- **Motion-only meaning probe.** A targeted probe for any state a reader can extract *only* from
  motion: items answerable in C1 but not C2 would falsify the equivalence claim for that state and
  identify a static equivalent that is doing too little. This is the most important secondary measure,
  because it is the one that can *break* the central claim; a clean equivalence predicts no
  C1-exclusive items.
- **Task time and effort,** as a calibration that any C2 comfort gain is not bought with a hidden
  comprehension or speed penalty.

### 5.4 What a result would and would not show

A non-inferiority result on §5.2 plus a null motion-only-probe (§5.3) would support the claim that
*this composition's* reduced surface preserves meaning. It would *not* establish equivalence for
arbitrary compositions — that depends on the authored static equivalent (§6) — and it would not, on its
own, separate the field's contribution from the prose's (which is why C3 is included). As throughout
the family, the study is designed to be *falsifiable*: a C1-exclusive item, or a C2 comprehension
deficit beyond $\delta$, is a result that would send the static equivalents back to authoring.

---

## 6. Limitations

We state the model's limits plainly, as the caveat canon requires.

**Equivalence is only as good as the authored static equivalent.** The model guarantees that an
author must *declare* a static equivalent and that the platform will *render* one; it does not
guarantee that the declared equivalent actually captures the state the motion conveyed. A lazy
equivalent — "particles freeze" with no thought to *which* state the travel encoded — passes the
schema's required-field check and the orphan lint, yet may strand meaning. The schema requires an
answer; it does not grade it. This is the gap the §5.3 motion-only probe and the §4.4 harness are
designed to expose, and it is why the conformance model and the study are *complementary*, not
redundant.

**The conformance harness checks presence, not perceived equivalence.** Even fully built, the proposed
§4.4 check verifies that meaning-bearing *state* is present and readable with motion disabled — a
necessary condition. It cannot verify that a human reads the static surface as *meaning the same
thing*. Presence of a `--field-attention` value is not the same as a reader perceiving emphasis.
Perceived equivalence is exactly what §5 must measure; no static analysis substitutes for it.

**Prose declarations are weakly checkable.** Today's `meaningWithoutMotion` is a human sentence. It
makes the author answer the right question and documents the intent, but a machine cannot yet check
that the sentence is *true of the rendered surface*. Tightening it toward a structured, checkable
declaration (state keys preserved, redundant carriers named) is future work and a precondition for
fully automating §4.4.

**Generalization.** The model is developed and grounded on the surfaces field-ui ships well — long
documents, evidence panels, dashboards (Paper 1, §8.6) — where state is relational and has natural
static renderings (contours, highlights, field lines). On surfaces whose meaning is *intrinsically*
temporal (a genuine animation of a process unfolding over time), "freeze the motion, keep the state"
may have no faithful static equivalent, and the honest answer is a static *summary* plus the temporal
content offered through another accessible channel, not a claim of equivalence. The model bounds where
equivalence is achievable; it does not assert it everywhere.

---

## 7. Discussion

**Why this matters for field-ui.** The two failure modes of §1.1 are the two ways an expressive field
system dies: dismissed as decorative, or rejected as inaccessible. Treating motion as one
representation of state defuses both at once. Because the static equivalent renders the *same*
computed field, the motion is demonstrably *not* decoration — removing it provably loses nothing the
state did not, and the conformance model is what makes "provably" literal. And because the reduced
surface is the same field differently revealed rather than a separate, lesser path, it does not drift:
there is one source of meaning, rendered two ways, with tooling that checks the renderings agree.

**Why the principle generalizes.** The move here — *motion is a representation of state, not the source
of meaning* — is not specific to fields. Any interface that animates can ask of each motion: what state
does this travel encode, and what is its static rendering? Systems that can answer get a reduced-motion
mode for free (it is the static rendering of the same state) and a conformance story for free (the two
renderings must agree on the state). Systems that *cannot* answer have learned something important:
their motion was decoration, or worse, their motion was the *only* carrier of a meaning that should
have had a redundant channel all along. The accessibility canon's "color is not the only carrier"
becomes, generalized, *no single channel is the only carrier* — and motion is just the channel the
literature warns about most.

**Relationship to the rest of the family.** The conformance posture here is the same as the flagship's
truth modes and passports (Paper 1, §6) and the recipe conformance gate (Paper 6): make the honest
boundary mechanical rather than rhetorical. Accessibility is, in this view, not a separate concern
bolted onto the runtime but another property the runtime is built to make *checkable* — the same
discipline, pointed at reduced motion.

---

## 8. Conclusion

Motion-rich interfaces face a real double bind: expressive enough to matter is expressive enough to
exclude, yet safe enough to include can look like decoration that never mattered. field-ui's stance —
*motion is one representation of state, not the source of meaning* — dissolves the bind by making
reduced motion the same field differently revealed: the field keeps computing, only the easing drops,
and every travelling effect has a static equivalent that renders the same state. The contribution of
this paper is to make that equivalence a *testable conformance property* rather than a hand-waved
fallback. The shipped mechanisms — the `visual-orphan` / `visual-not-hidden` / `feedback-non-css-var`
lint rules, the recipe schema's required reduced-motion-and-meaning-without-motion fields, the
reduced-motion guard, the travel-gating user agent, and the accessibility preview — already enforce the
components of equivalence; the proposed equivalence-conformance harness would check the whole. We have
been explicit that this verifies *presence* of meaning-bearing state, not human-*perceived* equivalence,
which is why the evaluation plan asks, as a falsifiable non-inferiority study, whether the reduced
surface preserves meaning for real readers. Motion can be expressive without being load-bearing — and a
field system can prove it.

---

## Appendix A. Reproducibility

Every accessibility claim in this paper is checkable against the repository. The load-bearing anchors:

- **Lint rules:** `packages/platform/src/lint.ts` (`lintVisuals`, `lintFeedbackVars`,
  `lintPlatform`), `packages/platform/src/visual-bindings.ts` (`VisualBindingRegistry.lint()`,
  `orphan-representation` / `visual-not-hidden`), `packages/platform/src/overlays.ts`,
  `packages/core/src/visual/lint.ts` (`color-only-meaning`, `glyph-only-text`,
  `missing-reduced-motion`).
- **Recipe-schema accessibility field:** `packages/core/src/recipes/schema.ts` (`AccessibilityRecipe`,
  the required `accessibility` field on `FieldRecipe`, and the validator clause forbidding a
  motion-only recipe).
- **Reduced-motion guard, travel-gating, host capability:**
  `packages/core/src/contracts/guards.ts` (`assertReducedMotionFallback`, `MISSING_REDUCED_MOTION`),
  `packages/core/src/agents/user-agent.ts` (`userFieldSource` wake-gating),
  `packages/core/src/visual/channels.ts` (`emission` reduced-motion flattening),
  `packages/core/src/core/host.ts` / `packages/platform/src/browser-host.ts` (`reducedMotion()`),
  `packages/core/src/contracts/index.ts` (Accessibility Contract in `CONTRACTS`).
- **Tests:** `packages/core/src/contracts/a11y.test.ts` (fallback required; meaning survives without
  motion; color/glyph not sole carriers; events thresholded; contract published).
- **Accessibility preview and reduced-motion demo paths:**
  `apps/site/src/pages/docs/accessibility-preview.astro` (side-by-side + mapping table),
  `apps/site/src/pages/docs/reading-field.astro` (state-tracks / easing-drops path),
  `apps/site/src/components/FieldLoopDemo.astro` (`applyRecipe(..., { reducedMotion })`),
  `apps/site/src/pages/docs/accessibility.astro`.

The canonical design documents corroborate the framing: the Accessibility Contract, Feedback Contract,
Visualization Contract, Visual Language Contract, and Platform-Lint Contract
(`docs/canonical/field-ui-system-contracts.md` §§10, 11, 14, 19, 23); the Accessibility and Semantic
Layer, the color accessibility rules, the Visual Contracts, and the Visual Binding/Overlay registries +
Accessibility Preview (`docs/canonical/field-ui-visual-language-and-geometry.md` §§5.2, 16, 18, 18.1,
18.2); the `reduced` preset and narrative-reveal collapse
(`docs/canonical/visualization-methods-taxonomy.md` §0, §13); and "focus creates state, not travel"
(`docs/canonical/field-ui-interaction-and-relationship-model.md` §10).

## Appendix B. Conversion notes (markdown → preprint)

Notation is kept LaTeX-compatible (the non-inferiority margin $\delta$ and the inline math translate
directly). Figures referenced in prose but not yet drawn — the equivalence chain (§3, semantic source →
binding → motion / static equivalent), the motion→static mapping table rendered as a figure (§3.3), and
the three-condition study design (§5.1) — are produced at conversion time. External citations marked
`[TODO: cite]` and the `[key]` placeholders in [`references.md`](/research/references) must be resolved and
verified before submission — never fabricated.

## Citations needed

External references this paper relies on, to be located and verified (none fabricated; cite by `[key]`
once resolved). The existing family key `[prefers-reduced-motion]` in
[`references.md`](/research/references) covers several of these and should be split as the topics are located:

- `[prefers-reduced-motion]` — the `prefers-reduced-motion` media-query specification (CSS Media
  Queries Level 5 / platform docs). *(existing family key; **[TODO: locate]**)*
- WCAG 2.x motion / animation-from-interaction guidance (the success criteria governing
  motion-from-interaction and disabling non-essential animation). **[TODO: cite]**
- Vestibular-disorder accessibility literature (clinical and HCI accounts of motion as a barrier:
  nausea, dizziness, disorientation from large/parallax/unexpected motion). **[TODO: cite]**
- "Color is not the only means of conveying information" / redundant-coding guidance (the WCAG
  use-of-color principle this paper generalizes from color to motion). **[TODO: cite]**
- Functional-versus-decorative animation in interface design (motion that communicates causality,
  continuity, or hierarchy versus motion that does not). **[TODO: cite]**
- The degraded-fallback / dual-codebase-drift antipattern in accessibility practice (separate,
  under-tested accessible paths diverging from the primary surface). **[TODO: cite]**
- Non-inferiority trial design and margin selection (the statistical framing of §5.2, for the
  evaluation methodology). **[TODO: cite]**
