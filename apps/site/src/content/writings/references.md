---
title: "References"
description: "Running bibliography for the Fundamental research paper family."
summary: "The shared bibliography for the paper family."
date: 2026-06-07
category: research
series: "Fundamental research"
order: 99
author: "Zach Shallbetter"
---

# References (running bibliography)

> Shared bibliography for the Fundamental paper family. Markdown now; exported to `references.bib` when
> papers convert to LaTeX. Entries marked **[verify]** are real, well-known works but still need their
> exact bibliographic details (venue, year, pages, DOI/URL) confirmed before submission. Entries
> marked **[TODO: locate]** are topics for which a specific citation must still be found — do **not**
> ship a fabricated reference. Papers cite by the `[key]` in brackets.

## Primary sources (this repository)

The papers treat the codebase and canonical docs as primary evidence, cited inline by path. Anchors:

- `[fieldui-repo]` Fundamental monorepo — `packages/core`, `packages/dom`, `packages/{elements,react,vanilla}`.
- `[fieldui-contracts]` `docs/canonical/system-contracts.md` — the hard contracts.
- `[fieldui-platform]` `docs/canonical/platform-architecture.md` — scheduler + registries.
- `[fieldui-natural]` `docs/canonical/natural-fields.md` — the four-field translation system.
- `[fieldui-fieldtable]` `docs/canonical/fundamental-field-behavior-table.md` — field/force laws.
- `[fieldui-interaction]` `docs/canonical/interaction-and-relationship-model.md` — agents, attention, reading, AI use cases.
- `[fieldui-recipes]` `docs/canonical/authoring-and-recipes.md` — the recipe schema + 64-recipe gallery.
- `[fieldui-forces]` `docs/engine-reference/forces-system.md` — the as-built engine spec.
- `[fieldui-formulas]` `docs/engine-reference/forces-formulas.md` — per-force math.
- `[fieldui-physics]` `docs/engine-reference/physics-workover.md` — the physics-correctness pass.

Key shipped-code anchors cited by the papers: `packages/core/src/core/dom-boundary.test.ts` (empty
allowlist), `packages/core/src/core/integrator.ts`, `packages/core/src/contracts/passport.ts`,
`packages/core/src/config/manual.ts`, `packages/dom/src/schedule.ts`,
`packages/dom/src/metrics.ts`, `packages/dom/src/bind-data.ts`,
`packages/core/src/recipes/{catalog,schema}.ts`, `apps/site/src/pages/docs/reading-field.astro`,
`apps/site/src/pages/docs/studies/evidence-field.astro`.

## External literature (to assemble)

Grouped by the role each plays in the arguments. Keys are stable; classics are listed with
best-known details and a `[verify]` flag.

### Force-directed layout & physical metaphors in UI (Paper 1, Paper 5)
- `[eades1984]` P. Eades, "A heuristic for graph drawing," *Congressus Numerantium* 42, 1984. **[verify]**
- `[fruchterman1991]` T. M. J. Fruchterman, E. M. Reingold, "Graph drawing by force-directed placement," *Software: Practice and Experience* 21(11), 1991. **[verify]**
- `[bostock2011]` M. Bostock, V. Ogievetsky, J. Heer, "D³: Data-Driven Documents," *IEEE TVCG (InfoVis)* 17(12), 2011. **[verify]**
- `[d3force]` M. Bostock et al., "d3-force" force-simulation module. **[TODO: locate version/URL]**

### Stigmergy & field-based coordination (Paper 1, Paper 2 memory model)
- `[grasse1959]` P.-P. Grassé, stigmergy formulation, *Insectes Sociaux* 6, 1959. **[verify]**
- `[dorigo]` M. Dorigo, ant-colony / pheromone-field optimization. **[TODO: locate canonical ref]**

### Reading on screen, navigation, and document orientation (Paper 2)
> **These `[TODO: locate]` slots block submission of Papers 2/3/4.** Each names what is needed (and, where a strong candidate is already known, names it to verify). Do not fabricate a citation; confirm or replace each candidate before submission.

- `[reading-on-screen]` screen vs. paper reading; spatial/kinesthetic cues; comprehension and orientation. **[TODO: locate]** (candidates to verify: Mangen et al.; Ackerman & Goldsmith.)
- `[wayfinding-orientation]` "where am I / where can I go / where have I been" wayfinding in hypertext and long documents. **[TODO: locate]**
- `[toc-overview-navigation]` table-of-contents / overview+detail / fisheye / progress indicators. **[TODO: locate]** (candidate: Furnas, "Generalized fisheye views," CHI 1986 — **[verify]**.)
- `[information-scent]` P. Pirolli, S. Card, "Information foraging," *Psychological Review* 106(4), 1999. **[verify]**
- `[citation-reading-behavior]` citation / footnote / cross-reference reading and comprehension behavior. **[TODO: locate]**
- `[spatial-location-memory]` spatial/location memory for document position (paper vs. screen). **[TODO: locate]**
- `[attention-distraction-reading]` attention, distraction, and interruption while reading. **[TODO: locate]**

### Attention & salience (Paper 1, Papers 2–3)
- `[itti1998]` L. Itti, C. Koch, E. Niebur, "A model of saliency-based visual attention for rapid scene analysis," *IEEE PAMI* 20(11), 1998. **[verify]**
- `[attention-interruption]` attention economy / interruption / alert fatigue (for "conserved attention" and System Weather). **[TODO: locate]**

### Trust, evidence, and uncertainty in AI/decision interfaces (Paper 3)
- `[trust-calibration]` J. D. Lee, K. A. See, "Trust in automation: Designing for appropriate reliance," *Human Factors* 46(1), 2004. **[verify]**
- `[automation-bias]` automation bias / over-reliance on automated decision aids under time pressure. **[TODO: locate]** (candidates: Parasuraman & Riley 1997; Skitka et al. 1999 — **[verify]**.)
- `[over-reliance-on-LLMs]` over-reliance on LLM assistants; whether confidence/explanation signals raise or reduce unwarranted reliance. **[TODO: locate]**
- `[uncertainty-visualization]` uncertainty visualization and its effect on perceived/acted-on uncertainty. **[TODO: locate]** (candidate: Hullman et al. surveys — **[verify]**.)
- `[source-credibility]` source-credibility assessment and citation-inspection behavior. **[TODO: locate]**
- `[citation-faithfulness]` citation faithfulness / attribution in retrieval-augmented generation; LLM hallucination. **[TODO: locate]**
- `[explanation-usefulness]` explainable-AI evaluation; illusory understanding; plausible rationales raising trust without improving decisions. **[TODO: locate]**

### Methods & instruments (Papers 2–3 study designs)
- `[signal-detection]` D. M. Green, J. A. Swets, *Signal Detection Theory and Psychophysics*, Wiley, 1966 (for *d′*, criterion *c*). **[verify]**
- `[calibration-metrics]` G. W. Brier, "Verification of forecasts expressed in terms of probability," *Monthly Weather Review* 78(1), 1950 (Brier score); plus expected calibration error / reliability diagrams. **[verify]**
- `[workload-instrument]` S. G. Hart, L. E. Staveland, "Development of NASA-TLX," in *Human Mental Workload*, 1988. **[verify]**
- `[usability-sus]` J. Brooke, "SUS: A quick and dirty usability scale," 1996. **[verify]** (used if a usability measure is reported)
- `[mixed-effects]` mixed-effects modeling for repeated-measures HCI data (crossed random effects). **[TODO: locate]** (candidate: Baayen, Davidson & Bates 2008 — **[verify]**.)
- `[preregistration]` pre-registration / Registered Reports practice. **[TODO: locate]**

### Web platform & rendering substrate (Paper 1, Paper 5)
- `[csshoudini]` W3C, "CSS Properties and Values API Level 1" (`CSS.registerProperty`; Houdini), Working Draft. <https://www.w3.org/TR/css-properties-values-api-1/>
- `[scrollanim]` W3C, "Scroll-driven Animations" (<https://www.w3.org/TR/scroll-animations-1/>) and "CSS View Transitions Module Level 1" (<https://www.w3.org/TR/css-view-transitions-1/>), Working Drafts.
- `[webcomponents]` WHATWG, "HTML Standard" §4.13 Custom elements (<https://html.spec.whatwg.org/multipage/custom-elements.html>); WHATWG, "DOM Standard" §Shadow trees (<https://dom.spec.whatwg.org/#shadow-trees>). Living Standards.
- `[prefers-reduced-motion]` W3C, "Media Queries Level 5," the `prefers-reduced-motion` feature, Working Draft. <https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion>

### Accessibility & reduced motion (Paper 4)
- `[wcag-motion]` W3C, "Web Content Accessibility Guidelines (WCAG) 2.1," Success Criterion 2.3.3 Animation from Interactions. <https://www.w3.org/TR/WCAG21/#animation-from-interactions>
- `[vestibular-accessibility]` vestibular-disorder accessibility — motion as a barrier (nausea, dizziness, disorientation from large / parallax / unexpected motion). **[TODO: locate]**
- `[use-of-color]` W3C, "Web Content Accessibility Guidelines (WCAG) 2.1," Success Criterion 1.4.1 Use of Color — "color is not the only visual means of conveying information" (the principle this paper generalizes from color to motion). <https://www.w3.org/TR/WCAG21/#use-of-color>
- `[functional-vs-decorative-motion]` functional vs. decorative animation — motion that conveys causality / continuity / hierarchy vs. motion that does not. **[TODO: locate]**
- `[degraded-fallback-antipattern]` the degraded-fallback / dual-codebase-drift antipattern (separate, under-tested accessible paths diverging from the primary surface). **[TODO: locate]**
- `[non-inferiority]` non-inferiority trial design and margin selection (Papers 2–4 study designs). **[TODO: locate]**

### Explainability / provenance visualization (Paper 8)
- `[explainability-provenance]` explainability and provenance visualization in InfoVis / dev tools. **[TODO: locate]**
