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
> papers convert to LaTeX. This pass resolves the former citation backlog into real named
> sources, standards, or documentation. If a claim cannot be supported by a real source, the paper text
> must say so directly rather than inventing a reference. Papers cite by the `[key]` in brackets.

## Primary sources (this repository)

The papers treat the codebase and canonical docs as primary evidence, cited inline by path. Anchors:

- `[fundamental-site]` Fundamental public site and docs — <https://fundamental-engine.com>. Public product framing: renderer-agnostic relational field engine; DOM as first surface, not the only surface; packages under `@fundamental-engine/*`.
- `[fundamental-engine-repo]` Fundamental monorepo — `packages/core`, `packages/dom`, `packages/{elements,react,vanilla,three}` and related adapters.
- `[fundamental-engine-contracts]` `docs/canonical/system-contracts.md` — the hard contracts.
- `[fundamental-engine-platform]` `docs/canonical/platform-architecture.md` — scheduler + registries.
- `[fundamental-engine-natural]` `docs/canonical/natural-fields.md` — the four-field translation system.
- `[fundamental-engine-fieldtable]` `docs/canonical/fundamental-field-behavior-table.md` — field/force laws.
- `[fundamental-engine-interaction]` `docs/canonical/interaction-and-relationship-model.md` — agents, attention, reading, AI use cases.
- `[fundamental-engine-recipes]` `docs/canonical/authoring-and-recipes.md` — the pattern schema + 64-recipe gallery.
- `[fundamental-engine-forces]` `docs/engine-reference/forces-system.md` — the as-built engine spec.
- `[fundamental-engine-formulas]` `docs/engine-reference/forces-formulas.md` — per-force math.
- `[fundamental-engine-physics]` `docs/engine-reference/physics-workover.md` — the physics-correctness pass.

Key shipped-code anchors cited by the papers: `packages/core/src/engine/dom-boundary.test.ts` (empty
allowlist), `packages/core/src/engine/integrator.ts`, `packages/core/src/contracts/passport.ts`,
`packages/core/src/config/manual.ts`, `packages/dom/src/schedule.ts`, `packages/dom/src/metrics.ts`,
`packages/dom/src/bind-data.ts`, `packages/core/src/recipes/{catalog,schema}.ts`,
`apps/site/src/pages/docs/reading-field.astro`, `apps/site/src/pages/docs/studies/evidence-field.astro`.

## External literature and standards

### Force-directed layout, physical metaphors, and field coordination
- `[eades1984]` P. Eades, "A heuristic for graph drawing," *Congressus Numerantium*, 42, 149–160, 1984.
- `[fruchterman1991]` T. M. J. Fruchterman and E. M. Reingold, "Graph drawing by force-directed placement," *Software: Practice and Experience*, 21(11), 1129–1164, 1991. DOI: `10.1002/spe.4380211102`.
- `[bostock2011]` M. Bostock, V. Ogievetsky, and J. Heer, "D³: Data-Driven Documents," *IEEE Transactions on Visualization and Computer Graphics*, 17(12), 2301–2309, 2011. DOI: `10.1109/TVCG.2011.185`.
- `[d3force]` M. Bostock, "d3-force: Force-directed graph layout using velocity Verlet integration," D3 module documentation. <https://github.com/d3/d3-force>.
- `[grasse1959]` P.-P. Grassé, "La reconstruction du nid et les coordinations interindividuelles chez Bellicositermes natalensis et Cubitermes sp.; la théorie de la stigmergie," *Insectes Sociaux*, 6, 41–80, 1959. DOI: `10.1007/BF02223791`.
- `[dorigo2006]` M. Dorigo, M. Birattari, and T. Stützle, "Ant colony optimization," *IEEE Computational Intelligence Magazine*, 1(4), 28–39, 2006. DOI: `10.1109/MCI.2006.329691`.
- `[heer2010]` J. Heer, S. K. Card, and J. A. Landay, "Prefuse: A toolkit for interactive information visualization," in *Readings in Information Visualization*, Morgan Kaufmann, 2010; originally published in CHI 2005.

### Reading, navigation, attention, and document orientation
- `[mangen2013]` A. Mangen, B. R. Walgermo, and K. Brønnick, "Reading linear texts on paper versus computer screen: Effects on reading comprehension," *International Journal of Educational Research*, 58, 61–68, 2013. DOI: `10.1016/j.ijer.2012.12.002`.
- `[ackerman2011]` R. Ackerman and M. Goldsmith, "Metacognitive regulation of text learning: On screen versus on paper," *Journal of Experimental Psychology: Applied*, 17(1), 18–32, 2011. DOI: `10.1037/a0022086`.
- `[clinton2019]` V. Clinton, "Reading from paper compared to screens: A systematic review and meta-analysis," *Journal of Research in Reading*, 42(2), 288–325, 2019. DOI: `10.1111/1467-9817.12269`.
- `[conklin1987]` J. Conklin, "Hypertext: An introduction and survey," *Computer*, 20(9), 17–41, 1987. DOI: `10.1109/MC.1987.1663693`.
- `[nielsen1990hypertext]` J. Nielsen, *Hypertext and Hypermedia*, Academic Press, 1990.
- `[furnas1986]` G. W. Furnas, "Generalized fisheye views," in *Proceedings of CHI '86*, 16–23, 1986. DOI: `10.1145/22627.22342`.
- `[shneiderman1996]` B. Shneiderman, "The eyes have it: A task by data type taxonomy for information visualizations," in *Proceedings of IEEE Symposium on Visual Languages*, 336–343, 1996. DOI: `10.1109/VL.1996.545307`.
- `[pirolli1999]` P. Pirolli and S. K. Card, "Information foraging," *Psychological Review*, 106(4), 643–675, 1999. DOI: `10.1037/0033-295X.106.4.643`.
- `[jurgens2016]` D. Jurgens, S. Kumar, R. Hoover, D. McFarland, and D. Jurafsky, "Citation classification for behavioral analysis of a scientific field," arXiv:1609.00435, 2016.
- `[boyack2018]` K. W. Boyack, N. J. van Eck, G. Colavizza, and L. Waltman, "Characterizing in-text citations in scientific articles: A large-scale analysis," arXiv:1710.03094, 2017.
- `[itti1998]` L. Itti, C. Koch, and E. Niebur, "A model of saliency-based visual attention for rapid scene analysis," *IEEE Transactions on Pattern Analysis and Machine Intelligence*, 20(11), 1254–1259, 1998. DOI: `10.1109/34.730558`.
- `[bailey2006]` B. P. Bailey and J. A. Konstan, "On the need for attention-aware systems: Measuring effects of interruption on task performance, error rate, and affective state," *Computers in Human Behavior*, 22(4), 685–708, 2006. DOI: `10.1016/j.chb.2005.12.009`.
- `[mark2008]` G. Mark, D. Gudith, and U. Klocke, "The cost of interrupted work: More speed and stress," in *Proceedings of CHI '08*, 107–110, 2008. DOI: `10.1145/1357054.1357072`.
- `[hornbaek2006]` K. Hornbæk, "Current practice in measuring usability: Challenges to usability studies and research," *International Journal of Human-Computer Studies*, 64(2), 79–102, 2006. DOI: `10.1016/j.ijhcs.2005.06.002`.

### Trust, evidence, uncertainty, and explainable AI
- `[lee2004]` J. D. Lee and K. A. See, "Trust in automation: Designing for appropriate reliance," *Human Factors*, 46(1), 50–80, 2004. DOI: `10.1518/hfes.46.1.50_30392`.
- `[parasuraman1997]` R. Parasuraman and V. Riley, "Humans and automation: Use, misuse, disuse, abuse," *Human Factors*, 39(2), 230–253, 1997. DOI: `10.1518/001872097778543886`.
- `[skitka1999]` L. J. Skitka, K. L. Mosier, and M. Burdick, "Does automation bias decision-making?" *International Journal of Human-Computer Studies*, 51(5), 991–1006, 1999. DOI: `10.1006/ijhc.1999.0252`.
- `[goddard2012]` K. Goddard, A. Roudsari, and J. C. Wyatt, "Automation bias: A systematic review of frequency, effect mediators, and mitigators," *Journal of the American Medical Informatics Association*, 19(1), 121–127, 2012. DOI: `10.1136/amiajnl-2011-000089`.
- `[hullman2019]` J. Hullman, X. Qiao, M. Correll, A. Kale, and M. Kay, "In pursuit of error: A survey of uncertainty visualization evaluation," *IEEE Transactions on Visualization and Computer Graphics*, 25(1), 903–913, 2019. DOI: `10.1109/TVCG.2018.2864889`.
- `[kale2019]` A. Kale, F. Nguyen, M. Kay, and J. Hullman, "Hypothetical outcome plots help untrained observers judge trends in ambiguous data," *IEEE Transactions on Visualization and Computer Graphics*, 25(1), 892–902, 2019. DOI: `10.1109/TVCG.2018.2864909`.
- `[fogg2003]` B. J. Fogg et al., "How do users evaluate the credibility of Web sites? A study with over 2,500 participants," in *Proceedings of DUX '03*, 2003. DOI: `10.1145/997078.997097`.
- `[hovland1951]` C. I. Hovland and W. Weiss, "The influence of source credibility on communication effectiveness," *Public Opinion Quarterly*, 15(4), 635–650, 1951. DOI: `10.1086/266350`.
- `[liu2023verifiability]` N. F. Liu, T. Zhang, and P. Liang, "Evaluating verifiability in generative search engines," arXiv:2304.09848, 2023.
- `[gao2023alce]` T. Gao, H. Yen, J. Yu, and D. Chen, "Enabling large language models to generate text with citations," arXiv:2305.14627, 2023.
- `[wallat2024faithfulness]` J. Wallat, M. Heuss, M. de Rijke, and A. Anand, "Correctness is not faithfulness in RAG attributions," arXiv:2412.18004, 2024.
- `[bansal2021]` G. Bansal, T. Wu, J. Zhou, R. Fok, B. Nushi, E. Kamar, M. T. Ribeiro, and D. S. Weld, "Does the whole exceed its parts? The effect of AI explanations on complementary team performance," in *Proceedings of CHI '21*, Article 81, 2021. DOI: `10.1145/3411764.3445717`.
- `[bucinca2021]` Z. Buçinca, M. B. Malaya, and K. Z. Gajos, "To trust or to think: Cognitive forcing functions can reduce overreliance on AI in AI-assisted decision-making," *Proceedings of the ACM on Human-Computer Interaction*, 5(CSCW1), Article 188, 2021. DOI: `10.1145/3449287`.
- `[kim2025llm]` S. S. Y. Kim, J. W. Vaughan, Q. V. Liao, T. Lombrozo, and O. Russakovsky, "Fostering appropriate reliance on large language models: The role of explanations, sources, and inconsistencies," arXiv:2502.08554, 2025.
- `[lim2009]` B. Y. Lim and A. K. Dey, "Assessing demand for intelligibility in context-aware applications," in *Proceedings of Ubicomp '09*, 195–204, 2009. DOI: `10.1145/1620545.1620576`.
- `[kulesza2013]` T. Kulesza, M. Burnett, W.-K. Wong, and S. Stumpf, "Principles of explanatory debugging to personalize interactive machine learning," in *Proceedings of IUI '15*, 126–137, 2015. DOI: `10.1145/2678025.2701399`.
- `[ragan2016]` E. D. Ragan, A. Endert, J. Sanyal, and J. Chen, "Characterizing provenance in visualization and data analysis: An organizational framework of provenance types and purposes," *IEEE Transactions on Visualization and Computer Graphics*, 22(1), 31–40, 2016. DOI: `10.1109/TVCG.2015.2467551`.
- `[abdul2018]` A. Abdul, J. Vermeulen, D. Wang, B. Y. Lim, and M. Kankanhalli, "Trends and trajectories for explainable, accountable and intelligible systems," in *Proceedings of CHI '18*, Article 582, 2018. DOI: `10.1145/3173574.3174156`.

### Methods and instruments
- `[signal-detection]` D. M. Green and J. A. Swets, *Signal Detection Theory and Psychophysics*, Wiley, 1966.
- `[brier1950]` G. W. Brier, "Verification of forecasts expressed in terms of probability," *Monthly Weather Review*, 78(1), 1–3, 1950. DOI: `10.1175/1520-0493(1950)078<0001:VOFEIT>2.0.CO;2`.
- `[guo2017calibration]` C. Guo, G. Pleiss, Y. Sun, and K. Q. Weinberger, "On calibration of modern neural networks," in *Proceedings of ICML 2017*, 1321–1330, 2017.
- `[hart1988]` S. G. Hart and L. E. Staveland, "Development of NASA-TLX (Task Load Index): Results of empirical and theoretical research," in P. A. Hancock and N. Meshkati (eds.), *Human Mental Workload*, North-Holland, 139–183, 1988. DOI: `10.1016/S0166-4115(08)62386-9`.
- `[brooke1996]` J. Brooke, "SUS: A quick and dirty usability scale," in P. W. Jordan et al. (eds.), *Usability Evaluation in Industry*, Taylor & Francis, 189–194, 1996.
- `[baayen2008]` R. H. Baayen, D. J. Davidson, and D. M. Bates, "Mixed-effects modeling with crossed random effects for subjects and items," *Journal of Memory and Language*, 59(4), 390–412, 2008. DOI: `10.1016/j.jml.2007.12.005`.
- `[nosek2018]` B. A. Nosek, C. R. Ebersole, A. C. DeHaven, and D. T. Mellor, "The preregistration revolution," *Proceedings of the National Academy of Sciences*, 115(11), 2600–2606, 2018. DOI: `10.1073/pnas.1708274114`.
- `[piaggio2012]` G. Piaggio et al., "Reporting of noninferiority and equivalence randomized trials: Extension of the CONSORT 2010 statement," *JAMA*, 308(24), 2594–2604, 2012. DOI: `10.1001/jama.2012.87802`.

### Web platform, rendering, accessibility, and motion
- `[csshoudini]` W3C, "CSS Properties and Values API Level 1" (`CSS.registerProperty`; Houdini). <https://www.w3.org/TR/css-properties-values-api-1/>.
- `[scrollanim]` W3C, "Scroll-driven Animations" <https://www.w3.org/TR/scroll-animations-1/> and "CSS View Transitions Module Level 1" <https://www.w3.org/TR/css-view-transitions-1/>.
- `[webcomponents]` WHATWG, "HTML Standard" §4.13 Custom elements <https://html.spec.whatwg.org/multipage/custom-elements.html>; WHATWG, "DOM Standard" §Shadow trees <https://dom.spec.whatwg.org/#shadow-trees>.
- `[prefers-reduced-motion]` W3C, "Media Queries Level 5," `prefers-reduced-motion`. <https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion>.
- `[wcag-motion]` W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*, Success Criterion 2.3.3 Animation from Interactions. <https://www.w3.org/TR/WCAG22/#animation-from-interactions>.
- `[use-of-color]` W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*, Success Criterion 1.4.1 Use of Color. <https://www.w3.org/TR/WCAG22/#use-of-color>.
- `[vestibular-accessibility]` W3C WAI, "Designing for Web Accessibility: Provide controls for content that starts automatically" and motion-related guidance; see also vestibular-disorder discussion in WCAG 2.3.3 understanding documentation. <https://www.w3.org/WAI/tips/designing/> and <https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html>.
- `[frederick2013]` D. M. Frederick, J. L. Mohler, M. Vorvoreanu, and R. J. Glotzbach, "The effects of parallax scrolling on user experience in web design," *Journal of User Experience*, 8(2), 2013.
- `[baecker1990]` R. M. Baecker and I. Small, "Animation at the interface," in *The Art of Human-Computer Interface Design*, Addison-Wesley, 1990.
- `[material-design-motion]` Google, *Material Design: Motion*. <https://m3.material.io/styles/motion/overview>.

### Runtime architecture, UI implementation, and testability
- `[retained-immediate-ui]` Microsoft Learn, "Retained Mode Versus Immediate Mode," Win32 documentation, 2018. <https://learn.microsoft.com/en-us/windows/win32/learnwin32/retained-mode-versus-immediate-mode>.
- `[cockburn2005]` A. Cockburn, "Hexagonal architecture," 2005. <https://alistair.cockburn.us/hexagonal-architecture/>.
- `[fastdom]` W. Wilson, "fastdom: Eliminates layout thrashing by batching DOM read/write operations," GitHub project documentation. <https://github.com/wilsonpage/fastdom>.
- `[webdev-layout-thrashing]` Google Chrome Developers, "Avoid large, complex layouts and layout thrashing." <https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing>.
- `[react-test-renderer]` React, "react-test-renderer" documentation. <https://react.dev/reference/react-test-renderer>.
- `[headless-ui]` Tailwind Labs, "Headless UI" documentation. <https://headlessui.com/>.
- `[meszaros2007]` G. Meszaros, *xUnit Test Patterns: Refactoring Test Code*, Addison-Wesley, 2007.
- `[chrome-devtools]` Google Chrome Developers, *Chrome DevTools* documentation. <https://developer.chrome.com/docs/devtools>.
- `[firefox-devtools]` MDN Web Docs, "Firefox Developer Tools." <https://developer.mozilla.org/en-US/docs/Tools>.

### Authoring systems, patterns, and design/programming abstractions
- `[w3c-design-tokens]` Design Tokens Community Group, "Design Tokens Format Module." <https://tr.designtokens.org/format/>.
- `[fowler2004presentation]` M. Fowler, "Presentation Model," 2004. <https://martinfowler.com/eaaDev/PresentationModel.html>.
- `[fowler2010dsl]` M. Fowler, *Domain-Specific Languages*, Addison-Wesley, 2010.
- `[react-docs-declarative]` React, "Describing the UI" and "Your UI as a tree." <https://react.dev/learn/describing-the-ui>.
- `[resnick2009scratch]` M. Resnick et al., "Scratch: Programming for all," *Communications of the ACM*, 52(11), 60–67, 2009. DOI: `10.1145/1592761.1592779`.
- `[myers1990garnet]` B. A. Myers et al., "Garnet: Comprehensive support for graphical, highly interactive user interfaces," *Computer*, 23(11), 71–85, 1990. DOI: `10.1109/2.60882`.

### Data binding, data joins, and list virtualization
- `[gossman2005]` J. Gossman, "Introduction to Model/View/ViewModel pattern for building WPF apps," Microsoft Developer Blog, 2005. <https://learn.microsoft.com/en-us/archive/blogs/johngossman/introduction-to-modelviewviewmodel-pattern-for-building-wpf-apps>.
- `[d3-selection-join]` D3, "Joining data" and `selection.join` documentation. <https://d3js.org/d3-selection/joining>.
- `[react-window]` B. Vaughn, "react-window," GitHub project documentation. <https://github.com/bvaughn/react-window>.
- `[react-virtualized]` B. Vaughn, "react-virtualized," GitHub project documentation. <https://github.com/bvaughn/react-virtualized>.

## Expansion draft note

Papers 09–30 reuse existing bibliography keys where possible. New external claims go through the same source-verification process before submission.

### Additional expansion anchors
- `[html-standard]` WHATWG, *HTML Standard*, living standard. <https://html.spec.whatwg.org/>.
- `[aria]` W3C, *Accessible Rich Internet Applications (WAI-ARIA) 1.2*. <https://www.w3.org/TR/wai-aria-1.2/>.
