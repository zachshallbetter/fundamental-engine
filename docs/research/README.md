# Fundamental Research Papers — a paper family

> **Status: research drafts (preprints, work in progress).**
> These are technical-preprint drafts intended for arXiv-style release, not canonical product
> documentation. They describe the concepts behind Fundamental for an external research audience.
> Every factual claim is checked against the code and the canonical docs as of the date noted in
> each paper's header; where a behavior is aspirational or opt-in rather than shipped, the papers
> say so explicitly (see *The caveat canon* below). When the code and a paper disagree, the code
> wins — fix the paper.

This folder holds a **small family of focused papers** on the ideas behind
[Fundamental](../../README.md), a platform-native relational field runtime for the DOM. The family is
deliberately split: one flagship paper *names the paradigm*, and the supporting papers *validate one
specific claim each* (reading, evidence/trust, accessibility, runtime architecture, authoring, data
binding, diagnostics). The system has at least eight distinct research claims; combining them into a
single paper would weaken every argument.

## The unifying thesis

> Interfaces are not only layouts of components. They are **relational fields of meaning.**

- **Practical claim:** Fundamental makes those fields *executable, inspectable, accessible, and
  authorable* on top of semantic HTML.
- **Research claim:** a field-based model can improve *orientation, trust, explainability, and
  interaction coherence* in complex web interfaces *without replacing native platform semantics*.

The first paper names the paradigm. The rest prove it in specific interface domains.

## The paper family

| # | File | Working title | Primary contribution | Needs first | Venue |
|---|---|---|---|---|---|
| 1 | [`01-field-translation-runtime.md`](01-field-translation-runtime.md) | **Fundamental: A Field Translation Runtime for Relational DOM Interfaces** | A new interface paradigm: UI as a shared, inspectable field of meaning (+ model, architecture, taxonomy, NFTS, recipe runtime, accessibility, case studies). | recipe runtime, inspector, studies | HCI / interaction design / web systems / design tools |
| 2 | [`02-reading-field.md`](02-reading-field.md) | **Reading Field: Attention, Memory, and Relationship Awareness in Long-Form Web Documents** | A field-based model for reading attention and document memory that preserves semantic HTML. | Reading Field study | HCI / reading & document UX |
| 3 | [`03-evidence-fields.md`](03-evidence-fields.md) | **Evidence Fields: Visualizing Support, Contradiction, Confidence, and Provenance in AI Interfaces** | A field-based interaction model for evidence, confidence, contradiction, and provenance. | study page ships (`bindData()` + Evidence Field study page); controlled study not yet run | HCI / AI interfaces / trust |
| 4 | [`04-motion-equivalence.md`](04-motion-equivalence.md) | **Motion Is Not Meaning: Reduced-Motion Equivalence in Field-Based Interface Systems** | A conformance model for translating motion-heavy field behavior into static semantic equivalents. | a11y conformance | Accessibility / web standards |
| 5 | [`05-host-driven-runtime.md`](05-host-driven-runtime.md) | **A Host-Driven Field Runtime for Portable Interface Behavior** | A runtime architecture for field-based UI behavior that targets DOM, Canvas, SVG, WebGL, native, or headless — including the recipe runtime, force-passport, and conformance-gate methodology. | zero-DOM-globals core + platform runtime | Web systems / engineering |
| 6 | [`06-portable-field-recipes.md`](06-portable-field-recipes.md) | **Recipes as Portable Field Programs for Interface Behavior** | A structured authoring model for composing relational field behavior without corrupting runtime vocabulary. | executable recipes | Design systems / authoring tools |
| 7 | [`07-data-as-field-participants.md`](07-data-as-field-participants.md) | **Data as Field Participants: Binding Records, Relationships, and Metrics into Interface Fields** | A data-binding model for relational interface fields. | now writable — `bindData()` + study demos ship; eval still to run | Web systems / data UX |
| 8 | [`08-explainable-interface-behavior.md`](08-explainable-interface-behavior.md) | **Explainable Interface Behavior Through Field Diagnostics** | A diagnostic framework for explainable interaction behavior. | Platform Inspector | HCI / dev tools / explainability |

Shared assets:

- [`references.md`](references.md) — the running bibliography for the whole family (markdown now; exported to BibTeX when papers convert to LaTeX).
- *The caveat canon* (below) — the honest limitations every paper must respect.

## Recommended publication order

Do not start with all eight. Publish in this order; each paper assumes the vocabulary of the ones
before it:

1. **Field Translation Runtime** (paradigm)
2. **Reading Field** (clearest empirical case study)
3. **Evidence Fields** (connects to the most urgent current problem: trust in AI output)
4. Motion Equivalence (accessibility)
5. Host-Driven Runtime (systems architecture)
6. Portable Field Recipes (authoring)
7. Data as Field Participants (data binding)
8. Explainable Interface Behavior (diagnostics)

### The best first three

If only three are written, write **1, 2, 3**: paper 1 names the paradigm, paper 2 gives the clearest
and least speculative empirical case study, and paper 3 connects the system to the most urgent
current interface problem.

**Status: all eight papers are drafted in full.** Drafted is not evaluated: every empirical paper
(Reading Field, Evidence Field, Motion Equivalence, Data as Field Participants) ships as a
**pre-registerable study design with no results collected** (caveat canon item 6), never as findings.
Papers 1–3 have been through an **internal review pass — verification against the code, by the author
and review agents, not external peer review** — and revised. Remaining work is the same internal
review of Papers 4–8, resolving the `references.md` citation backlog, and the markdown→LaTeX
conversion — not first drafts.

## Development order (differs from publication order)

Implementation that should land before the dependent papers can be fully evidenced:

1. Recipe runtime — *shipped*
2. `bindData()` — *shipped* (#210), with the data-bound study pages (#213–#214)
3. Platform Inspector — *shipped* (#198)
4. Reading / Evidence / System Weather studies — demo pages ship; controlled studies not yet *run*
5. Paper package — in progress (this folder)

Where a paper's evidence depends on unbuilt implementation or an unrun study, the draft frames the
contribution as a *design and protocol*, not a measured result (see the caveat canon, item 6).

## The paper family map

| Paper | Primary contribution | Needs implementation first |
|---|---|---|
| Field Translation Runtime | Paradigm + architecture | recipe runtime, inspector, studies |
| Reading Field | Long-form document attention/memory | Reading Field study |
| Evidence Field | AI trust and provenance | study page ships (`bindData()` + Evidence Field study page); controlled study not yet run |
| Motion Equivalence | Accessibility model | a11y conformance |
| Host-Driven Runtime | Systems architecture | zero-DOM core + platform runtime |
| Portable Field Recipes | Authoring model | executable recipes |
| Data as Field Participants | Data-binding model | `bindData()` ships (#210); needs eval |
| Explainable Interface Behavior | Diagnostics/inspector model | Platform Inspector |

## The expansion family (09–30)

Twenty-two generalizing/companion preprints that lift the original eight-paper family into portable, falsifiable principles (drafts; same caveat canon applies — Paper 19 is an early draft).

| # | File | Title | Summary |
|---|---|---|---|
| 9 | [`09-field-interfaces-semantic-substrates.md`](09-field-interfaces-semantic-substrates.md) | **Field Interfaces as Semantic Substrates: A General Model for Relational UI State** | Paper 09 generalizes the eight-paper Fundamental family into one portable, falsifiable model of field interfaces as semantic substrates, with a four-term core model, design implications, and a multi-study evaluation plan. |
| 10 | [`10-conserved-attention-interface-systems.md`](10-conserved-attention-interface-systems.md) | **Conserved Attention in Interface Systems** | Paper 10 of the Fundamental expansion family generalizes the engine's budgeted-attention behavior into a portable, falsifiable interface principle: attention is a conserved resource that systems should expose rather than multiply. |
| 11 | [`11-semantic-degradation-paths.md`](11-semantic-degradation-paths.md) | **Semantic Degradation Paths for Accessible Interactive Systems** | Generalizes Fundamental's reduced-motion equivalence into a portable channel-equivalence principle — that the meaning carried by any expressive channel must remain available through an accessible alternate representation when that channel is removed — and sketches a conformance and evaluation plan. |
| 12 | [`12-evidence-graphs-ai-trust-calibration.md`](12-evidence-graphs-ai-trust-calibration.md) | **Evidence Graphs as User Interfaces for AI Trust Calibration** | Paper 12 of the Fundamental expansion family generalizes the Evidence Fields claim into a codebase-independent principle — evidence belongs in a claim-level graph of support, contradiction, uncertainty, and provenance — and offers a falsifiable model plus a four-study evaluation plan. |
| 13 | [`13-runtime-inspectable-interfaces.md`](13-runtime-inspectable-interfaces.md) | **Runtime-Inspectable Interfaces: Diagnostics as a First-Class UX Primitive** | Paper 13 lifts the diagnostics-and-inspectability claim out of the original Fundamental family and reframes it as a falsifiable, implementation-agnostic interface principle with an evaluation and conformance plan. |
| 14 | [`14-recipes-behavioral-design-tokens.md`](14-recipes-behavioral-design-tokens.md) | **Recipes as Behavioral Design Tokens** | Generalizes the Fundamental recipe model into a portable interface principle — behavioral design tokens: named, versioned, validated, inspectable behavior contracts with diagnostics and reduced-mode equivalents — framed as a falsifiable research model plus a four-study evaluation plan rather than a measured result. |
| 15 | [`15-data-binding-beyond-views.md`](15-data-binding-beyond-views.md) | **Data Binding Beyond Views: From Reactive Rendering to Relational Participation** | Argues that data binding should preserve the relationships, uncertainty, priority, lifecycle, and provenance of records as first-class, inspectable interface state rather than only synchronizing views with records. |
| 16 | [`16-semantic-canvas-problem.md`](16-semantic-canvas-problem.md) | **The Semantic Canvas Problem** | Generalizes the Fundamental papers' DOM-canonical thesis into a falsifiable, implementation-agnostic principle — expressive visual surfaces must never become the sole carrier of interface meaning — with a conformance and study plan. |
| 17 | [`17-interaction-truth-modes.md`](17-interaction-truth-modes.md) | **Interaction Truth Modes: A Taxonomy for Honest Interface Behavior** | Expansion Paper 17 generalizes Fundamental's truth-mode idea into a portable principle that interface behaviors need epistemic labels, defining a falsifiable participant/signal/binding/equivalence model and a four-study evaluation plan. |
| 18 | [`18-field-based-wayfinding-long-form-documents.md`](18-field-based-wayfinding-long-form-documents.md) | **Field-Based Wayfinding for Long-Form Documents** | Generalizes the Reading Field claim into a portable, falsifiable wayfinding model for long-form documents and sketches an evaluation plan that does not assume Fundamental is the only implementation. |
| 19 | [`19-contradiction-aware-interfaces.md`](19-contradiction-aware-interfaces.md) | **Contradiction-Aware Interfaces** | Generalizes the Fundamental evidence-field work into a portable, falsifiable model for interfaces that surface contradiction as first-class, queryable state instead of flattening conflict into a single answer, with a four-study evaluation plan. |
| 20 | [`20-non-perturbing-diagnostics.md`](20-non-perturbing-diagnostics.md) | **Non-Perturbing Diagnostics for Interactive Systems** | Paper 20 isolates one reusable claim from the first Fundamental family — that a diagnostic interface must be read-only, separable, and auditable — and states it as a falsifiable, portable systems principle with a conformance and study plan. |
| 21 | [`21-host-driven-ui-runtimes.md`](21-host-driven-ui-runtimes.md) | **Host-Driven UI Runtimes: Portability Through Environmental Injection** | Generalizes Fundamental's FieldHost boundary into a portable host-driven runtime pattern, arguing that isolating environment contact behind one explicit host interface is what makes a UI behavior core testable and portable across browser, headless, worker, native, and alternative render targets. |
| 22 | [`22-accessibility-conformance-expressive-interfaces.md`](22-accessibility-conformance-expressive-interfaces.md) | **Accessibility Conformance for Expressive Interfaces** | Generalizes Fundamental's reduced-motion work into a renderer-agnostic conformance contract — semantic source, redundant carrier, reduced-mode equivalent, preview, lint, and a non-inferiority study protocol — for making accessibility claims about expressive interfaces falsifiable. |
| 23 | [`23-relationship-registries-interface-primitive.md`](23-relationship-registries-interface-primitive.md) | **Relationship Registries as an Interface Primitive** | Paper 23 generalizes Fundamental's relationship-registry idea into a portable interface principle — relationships as first-class typed, queryable runtime state — with a four-term model (participant, signal, binding, equivalence), four falsification conditions, and a four-study evaluation plan. |
| 24 | [`24-interface-memory.md`](24-interface-memory.md) | **Interface Memory: Worn Paths, Dwell, and Returning Context** | An expansion position paper arguing that interfaces should treat accumulated meaningful attention (dwell, revisitation, reading trails, review context) as a first-class, inspectable memory substrate rather than an ornament, with a falsifiable model and a four-study evaluation plan. |
| 25 | [`25-semantic-motion.md`](25-semantic-motion.md) | **Semantic Motion: When Animation Carries Meaning** | Paper 25 of the Fundamental expansion family isolates the claim that semantic motion (carrying causality, continuity, hierarchy, origin, destination, relation, or state change) must be authored, tested, and degraded differently from decorative motion, and frames it as a falsifiable, reproducible interface-design model. |
| 26 | [`26-field-based-evaluation-methods.md`](26-field-based-evaluation-methods.md) | **Field-Based Evaluation Methods for Interactive Systems** | Paper 26 generalizes the Fundamental family's measurement approach into a portable, falsifiable framework for evaluating field-based interfaces beyond task completion and preference. |
| 27 | [`27-taxonomy-interface-participants.md`](27-taxonomy-interface-participants.md) | **A Taxonomy of Interface Participants** | Generalizes the Fundamental paper family into a falsifiable taxonomy of interface participants — defining participant, signal, binding, and equivalence — and a conformance/evaluation plan for treating relational meaning as a first-class substrate rather than an ornament. |
| 28 | [`28-layout-to-topology.md`](28-layout-to-topology.md) | **From Layout to Topology: Interfaces as Graphs of Meaning** | Paper 28 abstracts the Fundamental paper family's core insight into a renderer-agnostic interface principle that meaning relationships should be first-class, inspectable interface state rather than visual side effects, and proposes a four-term model (participant, signal, binding, equivalence) with an evaluation plan. |
| 29 | [`29-ai-interfaces-show-support-not-sources.md`](29-ai-interfaces-show-support-not-sources.md) | **AI Interfaces Should Show Support, Not Just Sources** | Expansion Paper 29 generalizes the Evidence Fields claim into a portable interface principle: showing that a source supports a specific claim, with a falsifiable participant/signal/binding/equivalence model and a four-study evaluation plan. |
| 30 | [`30-platform-native-expressive-systems.md`](30-platform-native-expressive-systems.md) | **Platform-Native Expressive Systems Without Replacing HTML** | Paper 30 of the Fundamental expansion family generalizes the first eight papers' core claim into a renderer-agnostic, falsifiable model for treating relational meaning as a first-class interface substrate over semantic HTML. |

## Comparison papers (31–)

Direct comparisons positioning Fundamental against a named prior system — a different kind from the
generalizing expansion family.

| # | File | Title | Summary |
|---|---|---|---|
| 31 | [`31-behavioral-models-after-boids.md`](31-behavioral-models-after-boids.md) | **Substrate, Not Spectacle: Behavioral Models After Boids** | A source-grounded comparison with Reynolds' *Boids* (1987): shared mechanism (local neighborhoods, the three rules by name, spatial-hash neighbors), the per-axis better/worse/something-else verdict, the explainability↔arbitration tradeoff, and behavioral models as computation substrate. Comparison/positioning, not an empirical study. |

## Conventions

- **Audience & register.** Technical-preprint (arXiv) voice: precise, citable, honest about
  limitations. Not peer-review-gated, so the papers may be comprehensive and opinionated, but every
  empirical-sounding claim is either backed by code, marked as a *plan*, or marked as a *limitation*.
- **One claim per paper.** Each supporting paper validates exactly one claim and defers everything
  else to the flagship or a sibling. Resist scope creep; cross-reference instead.
- **Format.** Drafted in GitHub-flavored markdown for fast iteration and diffing. Math is written in
  LaTeX-compatible notation so conversion to a LaTeX/PDF preprint is mechanical. Figures are
  described in prose + a `Figure N` caption; diagrams are produced at conversion time.
- **Citations to the implementation.** Because the substrate *is* the code, papers cite real files
  (e.g. `packages/core/src/core/integrator.ts`) as primary evidence. External literature lives in
  [`references.md`](references.md); unresolved claims must be phrased honestly until a real reference is
  located and verified — never fabricate one.
- **Naming.** Use `Fundamental` for the project; `--field-*` / `field:*` for the current CSS-variable
  and event families (the `forces:*` event aliases and the compact `--d` CSS alias are mentioned
  only as compatibility notes; the legacy `--forces-*` CSS variables have been removed). Use the
  canonical token names from `packages/core/src/config/manual.ts`.
- **Verify-against-code rule.** Before a paper states that something is *shipped*, it is checked
  against the force registry, the manual config, the render-mode catalog, the tests, and the package
  exports — mirroring the project's own documentation standard.

## The caveat canon

A credible preprint must state these plainly; they recur across the family and the docs are candid
about them. Each paper that touches the physics restates the relevant ones rather than glossing them.

1. **Mass is nominal by default.** The default integrator advances `v += F` (unit mass);
   "heavier particles swing wider" is aspirational. First-class inertial mass (`a = F/m`, `m ∝ size`)
   is **opt-in** (`FieldOptions.mass`). See `packages/core/src/core/integrator.ts`.
2. **Energy is intentionally not conserved.** Friction and heat decay keep the interface calm; the
   dissipated energy is *accounted for* and rendered as micro-reactions (sparks scaled to `ΔE`),
   not silently dropped.
3. **Momentum is only partially conserved.** Pairwise in `collide`; the ambient field is damped by
   design.
4. **Designed forces are not natural laws — deliberately.** `attract`/`repel` use bounded
   `(1 − d/r)ⁿ` falloff, *not* inverse-square; true softened inverse-square
   (`F = GM·r̂/(d²+ε²)`, Plummer softening) is reserved for the `gravity` primitive. The two
   registers are kept explicit (truth modes), not unified.
5. **Particle count is the strong invariant**, conserved except through explicitly budgeted
   sources/sinks (`spawn`, `sink`). Energy and momentum are not promised; count is.
6. **No user-study results exist yet.** Empirical claims in the family are framed as *designs* and
   *hypotheses* (Papers 2–3 and others), never as measured outcomes, until a study is actually run.

## Internal review

These papers have **not** been through external peer review, and nothing here should be read as if
they had. Once a paper (or the active best-first-three set) is drafted, it goes through an
**internal review pass — adversarial verification against the code, by the author and review
agents** — before it is considered ready: reviewers check the central claim, the soundness of the
study design, the honesty of the limitations, the accuracy of every code-grounded assertion, and
family coherence (no claim double-counted across papers). Reviewer
findings are folded back into the drafts before submission.

## Building a paper for submission

The drafts are self-contained markdown. A conversion script turns the whole family into LaTeX (and,
when a TeX engine is present, PDF):

```bash
pnpm gen:papers            # convert all papers → docs/research/build/{NN-…}.tex (+ .pdf)
node scripts/papers-to-latex.mjs --tex-only   # .tex only, skip the PDF step
node scripts/papers-to-latex.mjs 01 03        # only papers 01 and 03
```

`scripts/papers-to-latex.mjs` reads each `docs/research/NN-*.md` and emits a standalone, numbered,
TOC'd `.tex` via **pandoc**, then builds a `.pdf` with the first available TeX engine. Output lands in
`docs/research/build/`, which is **gitignored** — it is a build artifact, not checked-in content.

Requirements:

- **pandoc** is required (`pandoc --version`). Without it the script prints install instructions and exits.
- A **Unicode-native LaTeX engine** is needed for PDFs — the papers use glyphs like `⇄ → ⁿ`, which
  `pdflatex` cannot typeset. The script prefers `latexmk` driving `xelatex`/`lualatex`, then
  `tectonic`, then a raw `xelatex`/`lualatex`. With no engine it still writes every `.tex` and tells
  you how to install one.
  - macOS: `brew install pandoc` and `brew install --cask mactex-no-gui` (or `brew install tectonic`)
  - Debian/Ubuntu: `sudo apt-get install pandoc texlive-full`

The script only *converts* the existing markdown — it never authors paper content. Conversion notes
(notation kept LaTeX-friendly, figures produced from the prose descriptions) live at the bottom of
each paper. The `references.md` bibliography is exported to `references.bib` when citation keys are
resolved; the current pipeline cites inline and does not yet wire a `.bib`.
