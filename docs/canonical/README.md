> **Status: canonical.**
> The documentation map for `docs/canonical/` — one line per document and its role. These
> documents are the **authority**: read the relevant one before changing concepts, terminology,
> or contracts. The status rule and framing policy live in
> [documentation-standards.md](documentation-standards.md).

# Canonical documentation map

Fundamental is a platform-native relational field runtime for the DOM. `Fundamental` (core) computes
renderer-agnostic field behavior; `@fundamental-engine/dom` binds it to the DOM; `elements`/`react`
are authoring surfaces. Canvas is one render surface, not the whole system.

> Concepts describe. Dimensions hold state. Fields structure. Relationships associate. Forces couple.
> Tokens execute. Metrics measure. Diagnostics explain. Conditions activate. Projections reveal.
> Formations compose. FieldRecipe represents. Contracts execute. No word lives in two lanes.

| Document | Role |
|---|---|
| [`definition-document.md`](definition-document.md) | The operating model — what Fundamental *is* ("substrate, not wallpaper") |
| [`documentation-standards.md`](documentation-standards.md) | How Fundamental is described everywhere: the architecture statement, the status taxonomy, the naming policy, the verify-against-code rule |
| [`natural-fields.md`](natural-fields.md) | The four Natural Fields (gravity→importance, electromagnetic→polarity, strong→binding, weak→transformation) — concepts, not tokens |
| [`fundamental-field-behavior-table.md`](fundamental-field-behavior-table.md) | The six truth modes + the per-force behavior table |
| [`designed-vs-natural-map.md`](designed-vs-natural-map.md) | Why the engine is shaped as it is — every concept tagged Faithful / Idealization / Departure / No-analog against what nature does; the Departures are the flexibility |
| [`dimensional-coupling.md`](dimensional-coupling.md) | The Dimensional Coupling Doctrine — dimensions are orthogonal by default; association ≠ coupling; forces are the only coupling mechanism; projections, body-authority modes (Anchored/Kinematic/Dynamic), Field Formations, and the construction rule for restoring collapsed dimensions (depth/time/orientation) |
| [`system-contracts.md`](system-contracts.md) | The hard contracts: bodies, fields, forces, agents, events, feedback, recipes, accessibility, performance, conformance, platform |
| [`platform-architecture.md`](platform-architecture.md) | The platform layer: the six registries, the six-phase scheduler, the runtime (attachHandle, QualityGovernor), linting |
| [`agent-consumption-model.md`](agent-consumption-model.md) | How consumers (particles, DOM elements, event sinks, visual layers) read one influence differently; Body Matter Interaction → Sink/Accretion |
| [`interaction-and-relationship-model.md`](interaction-and-relationship-model.md) | The agent model: element, relationship, user, layout, and data agents |
| [`visualization-methods-taxonomy.md`](visualization-methods-taxonomy.md) | Render + diagnostic methods, and **Surfaces & Placement** (underlay / overlay / typographic) |
| [`invisible-fields.md`](invisible-fields.md) | The typographic (invisible) placement: two-field page architecture, live channels, engagement contracts, declared relationships, data provenance |
| [`time.md`](time.md) | Time in the field: the three clocks (simulation / experiential / world), the temporal kernels, the `data-field-at` contract |
| [`visual-language-and-geometry.md`](visual-language-and-geometry.md) | The visual language layer: metric→appearance mappings and geometry |
| [`authoring-and-recipes.md`](authoring-and-recipes.md) | Authoring surfaces and the FieldRecipe system |
| [`testing-and-conformance.md`](testing-and-conformance.md) | Test contracts and the conformance framework (the Lab-as-detector) |
| [`api-stability.md`](api-stability.md) | The freeze contract: the frozen surface, the experimental surface, the 0.x compatibility rules |
| [`deprecation-plan.md`](deprecation-plan.md) | The migration alias surface: each living alias, its deprecation status, and the proposed removal version (timings pending maintainer sign-off) |
| [`field-possibilities.md`](field-possibilities.md) | The full possibility space — what new kinds of interfaces become possible when meaning has field behavior (36 sections, from recipes and input agents to temporal fields, matter primitives, and the field as semantic medium) |
| [`use-cases.md`](use-cases.md) | Concrete use cases across eight domains — the product-level translation of the possibility space into real UI problems and solutions |

Deeper references live beside this directory: `docs/engine-reference/` (the engine spec —
`forces-system.md` is the big one), `docs/research/` (the paper family, with its caveat canon in
its own README), and `docs/planning-archive/` (frozen design history — do not cite as current).
Planned work lives in `ROADMAP.md` / `BACKLOG.md` at the repo root and on the RC1 board.
