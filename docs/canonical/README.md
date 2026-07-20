> **Status: canonical.**
> The documentation map for `docs/canonical/` — one line per document and its role. These
> documents are the **authority**: read the relevant one before changing concepts, terminology,
> or contracts. The status rule and framing policy live in
> [documentation-standards.md](documentation-standards.md).

# Canonical documentation map

Fundamental is a platform-native relational field runtime. `@fundamental-engine/core` computes
renderer-agnostic field behavior; host adapters bind that field to concrete platforms. `@fundamental-engine/dom`
is the web host adapter (`elements`/`react` are authoring surfaces on top of it). The DOM is the first
host, not the boundary. Canvas is one render surface, not the whole system.

> Concepts describe. Dimensions hold state. Fields structure. Relationships associate. Forces couple.
> Tokens execute. Metrics measure. Diagnostics explain. Conditions activate. Lenses read.
> Projections reveal. Field Patterns compose. FieldPattern represents. Field Contracts execute.
> No word lives in two lanes.

| Document | Role |
|---|---|
| [`substrate-overview.md`](substrate-overview.md) | The one-page mental model — the substrate in five verbs (Declare → Influence → Read → Reveal → Govern); links out to the authoritative doc for each. Read first |
| [`definition-document.md`](definition-document.md) | The operating model — what Fundamental *is* ("substrate, not wallpaper") |
| [`documentation-standards.md`](documentation-standards.md) | How Fundamental is described everywhere: the architecture statement, the status taxonomy, the naming policy, the verify-against-code rule |
| [`natural-fields.md`](natural-fields.md) | The four Natural Fields (gravity→importance, electromagnetic→polarity, strong→binding, weak→transformation) — concepts, not tokens |
| [`fundamental-field-behavior-table.md`](fundamental-field-behavior-table.md) | The six truth modes + the per-force behavior table |
| [`designed-vs-natural-map.md`](designed-vs-natural-map.md) | Why the engine is shaped as it is — every concept tagged Faithful / Idealization / Departure / No-analog against what nature does; the Departures are the flexibility |
| [`dimensional-coupling.md`](dimensional-coupling.md) | The Dimensional Coupling Doctrine — dimensions are orthogonal by default; association ≠ coupling; forces are the only coupling mechanism; projections, body-authority modes (Anchored/Kinematic/Dynamic), Field Patterns, and the construction rule for restoring collapsed dimensions (depth/time/orientation) |
| [`system-contracts.md`](system-contracts.md) | The hard contracts: bodies, fields, forces, agents, events, feedback, patterns, accessibility, performance, conformance, platform |
| [`platform-architecture.md`](platform-architecture.md) | The platform layer: the six registries, the six-phase scheduler, the runtime (attachHandle, QualityGovernor), linting |
| [`host-model.md`](host-model.md) | The host model (the **Declare** verb): the `FieldHost` SPI, `MinimalFieldHost`, the capability ladder, and the host-conformance checklist — how any environment (DOM, headless, native, custom renderer) becomes a surface the field runs on |
| [`agent-consumption-model.md`](agent-consumption-model.md) | How consumers (particles, DOM elements, event sinks, visual layers) read one influence differently; Body Matter Interaction → Sink/Accretion |
| [`interaction-and-relationship-model.md`](interaction-and-relationship-model.md) | The agent model: element, relationship, user, layout, and data agents |
| [`body-lifecycle.md`](body-lifecycle.md) | The body lifecycle for non-DOM / programmatic bodies (declare → measure → participate → … → remove); DOM vs synthetic/data bodies; stable identity across the life |
| [`visualization-methods-taxonomy.md`](visualization-methods-taxonomy.md) | Render + diagnostic methods, and **Surfaces & Placement** (underlay / overlay / typographic) |
| [`invisible-fields.md`](invisible-fields.md) | The typographic (invisible) placement: two-field page architecture, live channels, engagement contracts, declared relationships, data provenance |
| [`feedback-channels.md`](feedback-channels.md) | The canonical, correct feedback-vars reference (the **Read** channel): engine-written vs host-supplied; `--d`/`--field-density` (consistent, not aliased), `--load`, `--lit`, the measured thermodynamics (`--entropy`/`--coherence`/`--temperature`), the nine `--field-<metric>` pattern lanes and their provenance |
| [`time.md`](time.md) | Time in the field: the three clocks (simulation / experiential / world), the five time senses, the temporal kernels, the `data-field-at` contract |
| [`visual-language-and-geometry.md`](visual-language-and-geometry.md) | The visual language layer: metric→appearance mappings and geometry |
| [`authoring-and-recipes.md`](authoring-and-recipes.md) | Authoring surfaces and the FieldPattern system |
| [`testing-and-conformance.md`](testing-and-conformance.md) | Test contracts and the conformance framework (the Lab-as-detector) |
| [`stability-and-convergence.md`](stability-and-convergence.md) | The force-directed failure canon, per-mechanism: what the field damps or side-steps (seeded RNG, friction, DOM-owned placement, plausibility-over-accuracy) vs what it owns (`dynamic`-body jitter, tuning brittleness) — and the arguments we deliberately do NOT make |
| [`api-stability.md`](api-stability.md) | The freeze contract: the frozen surface, the experimental surface, the 0.x compatibility rules |
| [`substrate-api.md`](substrate-api.md) | The shipped substrate read API (EXPERIMENTAL): `query` / `snapshot` / `diff` / `replay` / `projections` + governance lint, body authority + dynamic recoil, integrator modes, accumulator channels, first-class body identity |
| [`agent-safety-model.md`](agent-safety-model.md) | The **Govern** verb: the safety/governance model for agents reading a field — three invariants (agent-readable ≠ agent-writable; snapshots withhold opaque `body.data` by default; projections reveal, never mutate) linking outward to `substrate-api.md` (EXPERIMENTAL) |
| [`wallpaper-rule.md`](wallpaper-rule.md) | **"Substrate, not wallpaper" made operational** — the three-prong wallpaper test, the remedy order (derive → declare → demote → sugar; never deletion), the corollaries (injected-rng determinism, one writer per reading, proofs must be produced), and the per-plane guards |
| [`coordinate-spaces.md`](coordinate-spaces.md) | The five coordinate spaces (field / host / projection / screen / semantic) and their one-way conversions; semantic-not-spatial discipline for non-DOM hosts |
| [`causality-and-truth.md`](causality-and-truth.md) | The causality ladder (Observed → Attributed → Explained → Replayed → Predicted), the dimension / metric / channel / projection lock, and implementation-facing truth labels |
| [`deprecation-plan.md`](deprecation-plan.md) | The migration alias surface: each living alias, its deprecation status, and the proposed removal version (timings pending maintainer sign-off) |
| [`field-possibilities.md`](field-possibilities.md) | The full possibility space — what new kinds of interfaces become possible when meaning has field behavior (36 sections, from patterns and input agents to temporal fields, matter primitives, and the field as semantic medium) |
| [`use-cases.md`](use-cases.md) | Concrete use cases across eight domains — the product-level translation of the possibility space into real UI problems and solutions |
| [`computational-interaction-alignment.md`](computational-interaction-alignment.md) | How Fundamental relates to **Foundations of Computational Interaction (FCI)**, an external research framework: the concept mapping, the shared epistemic doctrines, and the bounded "neither proves the other" claim — plus why FCI vocabulary is deliberately **not** forced into the frozen API |

Deeper references live beside this directory: `docs/engine-reference/` (the engine spec —
`forces-system.md` is the big one), `docs/research/` (the paper family, with its caveat canon in
its own README), and `docs/planning-archive/` (frozen design history — do not cite as current).
Planned work lives on the RC1 board (user Project #24); shipped work is in `CHANGELOG.md` and per-version `docs/release-notes/`.
