---
layout: ../../layouts/ResearchLayout.astro
title: "References"
---

# References (running bibliography)

> Shared bibliography for the field-ui paper family. Markdown now; exported to `references.bib` when
> papers convert to LaTeX. Entries marked **[verify]** are real, well-known works but still need their
> exact bibliographic details (venue, year, pages, DOI/URL) confirmed before submission. Entries
> marked **[TODO: locate]** are topics for which a specific citation must still be found — do **not**
> ship a fabricated reference. Papers cite by the `[key]` in brackets.

## Primary sources (this repository)

The papers treat the codebase and canonical docs as primary evidence, cited inline by path. Anchors:

- `[fieldui-repo]` field-ui monorepo — `packages/core`, `packages/platform`, `packages/{elements,react,vanilla}`.
- `[fieldui-contracts]` `docs/canonical/field-ui-system-contracts.md` — the hard contracts.
- `[fieldui-platform]` `docs/canonical/field-ui-platform-architecture.md` — scheduler + registries.
- `[fieldui-natural]` `docs/canonical/field-ui-natural-fields.md` — the four-field translation system.
- `[fieldui-fieldtable]` `docs/canonical/fundamental-field-behavior-table.md` — field/force laws.
- `[fieldui-interaction]` `docs/canonical/field-ui-interaction-and-relationship-model.md` — agents, attention, reading, AI use cases.
- `[fieldui-recipes]` `docs/canonical/field-ui-authoring-and-recipes.md` — the recipe schema + 64-recipe gallery.
- `[fieldui-forces]` `docs/engine-reference/forces-system.md` — the as-built engine spec.
- `[fieldui-formulas]` `docs/engine-reference/forces-formulas.md` — per-force math.
- `[fieldui-physics]` `docs/engine-reference/physics-workover.md` — the physics-correctness pass.

Key shipped-code anchors cited by the papers: `packages/core/src/core/dom-boundary.test.ts` (empty
allowlist), `packages/core/src/core/integrator.ts`, `packages/core/src/contracts/passport.ts`,
`packages/core/src/config/manual.ts`, `packages/platform/src/schedule.ts`,
`packages/platform/src/metrics.ts`, `packages/platform/src/bind-data.ts`,
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
- `[reading-on-screen]` screen vs. paper reading; spatial/kinesthetic cues; comprehension and orientation. **[TODO: locate]** (candidates: Mangen et al.; Ackerman & Goldsmith.)
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
- `[csshoudini]` CSS Properties & Values API / `CSS.registerProperty` (Houdini). **[TODO: locate spec ref]**
- `[scrollanim]` Scroll-driven Animations; View Transitions API. **[TODO: locate spec refs]**
- `[webcomponents]` Custom Elements / Shadow DOM specifications. **[TODO: locate]**
- `[prefers-reduced-motion]` the `prefers-reduced-motion` media query (CSS Media Queries Level 5). **[TODO: locate spec ref]**

### Accessibility & reduced motion (Paper 4)
- `[wcag-motion]` WCAG 2.x motion / animation-from-interaction success criteria (disabling non-essential motion). **[TODO: locate]**
- `[vestibular-accessibility]` vestibular-disorder accessibility — motion as a barrier (nausea, dizziness, disorientation from large / parallax / unexpected motion). **[TODO: locate]**
- `[use-of-color]` "color is not the only means of conveying information" / redundant coding (the WCAG use-of-color principle this paper generalizes from color to motion). **[TODO: locate]**
- `[functional-vs-decorative-motion]` functional vs. decorative animation — motion that conveys causality / continuity / hierarchy vs. motion that does not. **[TODO: locate]**
- `[degraded-fallback-antipattern]` the degraded-fallback / dual-codebase-drift antipattern (separate, under-tested accessible paths diverging from the primary surface). **[TODO: locate]**
- `[non-inferiority]` non-inferiority trial design and margin selection (Papers 2–4 study designs). **[TODO: locate]**

### Explainability / provenance visualization (Paper 8)
- `[explainability-provenance]` explainability and provenance visualization in InfoVis / dev tools. **[TODO: locate]**
