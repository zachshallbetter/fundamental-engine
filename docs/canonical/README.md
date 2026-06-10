> **Status: canonical.**
> The documentation map for `docs/canonical/` — one line per document and its role. These
> documents are the **authority**: read the relevant one before changing concepts, terminology,
> or contracts. The status rule and framing policy live in
> [field-ui-documentation-standards.md](field-ui-documentation-standards.md).

# Canonical documentation map

field-ui is a platform-native relational field runtime for the DOM. `field-ui` (core) computes
renderer-agnostic field behavior; `@field-ui/platform` binds it to the DOM; `elements`/`react`
are authoring surfaces. Canvas is one render surface, not the whole system.

> Concepts describe. Tokens execute. Metrics measure. Diagnostics explain. Conditions activate.
> Recipes compose. No word lives in two lanes.

| Document | Role |
|---|---|
| [`field-ui-definition-document.md`](field-ui-definition-document.md) | The operating model — what field-ui *is* ("substrate, not wallpaper") |
| [`field-ui-documentation-standards.md`](field-ui-documentation-standards.md) | How field-ui is described everywhere: the architecture statement, the status taxonomy, the naming policy, the verify-against-code rule |
| [`field-ui-natural-fields.md`](field-ui-natural-fields.md) | The four Natural Fields (gravity→importance, electromagnetic→polarity, strong→binding, weak→transformation) — concepts, not tokens |
| [`fundamental-field-behavior-table.md`](fundamental-field-behavior-table.md) | The six truth modes + the per-force behavior table |
| [`field-ui-system-contracts.md`](field-ui-system-contracts.md) | The hard contracts: bodies, fields, forces, agents, events, feedback, recipes, accessibility, performance, conformance, platform |
| [`field-ui-platform-architecture.md`](field-ui-platform-architecture.md) | The platform layer: the six registries, the six-phase scheduler, the runtime (attachHandle, QualityGovernor), linting |
| [`field-ui-agent-consumption-model.md`](field-ui-agent-consumption-model.md) | How consumers (particles, DOM elements, event sinks, visual layers) read one influence differently; Body Matter Interaction → Sink/Accretion |
| [`field-ui-interaction-and-relationship-model.md`](field-ui-interaction-and-relationship-model.md) | The agent model: element, relationship, user, layout, and data agents |
| [`visualization-methods-taxonomy.md`](visualization-methods-taxonomy.md) | Render + diagnostic methods, and **Surfaces & Placement** (underlay / overlay / typographic) |
| [`field-ui-invisible-fields.md`](field-ui-invisible-fields.md) | The typographic (invisible) placement: two-field page architecture, live channels, engagement contracts, declared relationships, data provenance |
| [`field-ui-visual-language-and-geometry.md`](field-ui-visual-language-and-geometry.md) | The visual language layer: metric→appearance mappings and geometry |
| [`field-ui-authoring-and-recipes.md`](field-ui-authoring-and-recipes.md) | Authoring surfaces and the FieldRecipe system |
| [`field-ui-testing-and-conformance.md`](field-ui-testing-and-conformance.md) | Test contracts and the conformance framework (the Lab-as-detector) |
| [`field-ui-api-stability.md`](field-ui-api-stability.md) | The freeze contract: the frozen surface, the experimental surface, the 0.x compatibility rules |

Deeper references live beside this directory: `docs/engine-reference/` (the engine spec —
`forces-system.md` is the big one), `docs/research/` (the paper family, with its caveat canon in
its own README), and `docs/planning-archive/` (frozen history — do not cite as current).
Planned work lives in `ROADMAP.md` / `BACKLOG.md` at the repo root and on the RC1 board.
