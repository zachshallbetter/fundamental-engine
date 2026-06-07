# field-ui Documentation Index

## What field-ui is

```txt
field-ui is a platform-native relational field runtime for the DOM.
```

It lets semantic HTML, DOM elements, particles, relationships, measurements, visual layers, and user
interaction participate in one **shared field context**. Elements bend the field; the field bends them
back. The visible particle canvas is **one render surface**, not the whole system.

```txt
@field-ui/core      computes renderer-agnostic field, force, particle, metric, and diagnostic behavior.
@field-ui/platform  binds field behavior to the DOM: measurement, state, feedback, relationships,
                    visual bindings, overlays, linting, and scheduling.
@field-ui/elements  native web components and the [data-body] HTML authoring contract.
@field-ui/react     the React adapter over the same contracts.
@field-ui/vanilla   the FieldField class for plain TypeScript.
```

## Document statuses

Every document carries a status banner at the top. The four statuses:

- **canonical** — current source of truth for product, architecture, contracts, and public framing.
- **as-built reference** — historically/technically accurate engine record, narrower than the whole
  product.
- **legacy / superseded** — preserved for design history; not authoritative.
- **planning / roadmap** — forward-looking only; does not describe planned work as shipped.

The folders mirror the statuses: `canonical/`, `engine-reference/`, `planning-archive/`.

## canonical/ — current architecture, contracts, and product framing

| Document | Role |
|---|---|
| [`field-ui-definition-document.md`](canonical/field-ui-definition-document.md) | Canonical concept and operating model |
| [`field-ui-system-contracts.md`](canonical/field-ui-system-contracts.md) | Hard contracts for bodies, fields, forces, agents, events, feedback, recipes, accessibility, performance, conformance, and the platform |
| [`field-ui-platform-architecture.md`](canonical/field-ui-platform-architecture.md) | `@field-ui/platform`: the FrameScheduler, the six registries, `lintPlatform()`, the live runtime (Phase D) |
| [`fundamental-field-behavior-table.md`](canonical/fundamental-field-behavior-table.md) | Field/force laws, electromagnetic split, `fieldflow`, and truth modes |
| [`visualization-methods-taxonomy.md`](canonical/visualization-methods-taxonomy.md) | Render layers and diagnostics (all modes shipped: contours, potential, vectors, energy, topology, inspector, causality, prediction) |
| [`field-ui-interaction-and-relationship-model.md`](canonical/field-ui-interaction-and-relationship-model.md) | Agents beyond particles; the relationship model; Reading Field |
| [`field-ui-visual-language-and-geometry.md`](canonical/field-ui-visual-language-and-geometry.md) | Typography, color, shape, visual-semantic pairing, overlays, export |
| [`field-ui-authoring-and-recipes.md`](canonical/field-ui-authoring-and-recipes.md) | Authoring across native HTML / web component / React; intent compiler; recipe schema |
| [`field-ui-testing-and-conformance.md`](canonical/field-ui-testing-and-conformance.md) | Test matrix, conformance gates, force passports, platform + scheduler + lint tests |

## engine-reference/ — as-built force-engine record

These specify the force/field engine as it currently ships. They remain authoritative for force
formulas, catalogs, and engine behavior, but do **not** define the whole platform architecture (see
`canonical/` for that).

| Document | Role |
|---|---|
| [`forces-system.md`](engine-reference/forces-system.md) | The full engine specification (forces, formations, conditions, render modes, feedback) |
| [`forces-engine.md`](engine-reference/forces-engine.md) | Module map and pipeline stages |
| [`forces-formulas.md`](engine-reference/forces-formulas.md) | Exact per-force math |
| [`forces-tests.md`](engine-reference/forces-tests.md) | Force-engine conformance coverage |
| [`forces-fields-plan.md`](engine-reference/forces-fields-plan.md) | As-built field-line / heatmap record |
| [`physics-workover.md`](engine-reference/physics-workover.md) | Physics correctness pass |
| [`shadow-dom.md`](engine-reference/shadow-dom.md) | Shadow-DOM participation model (now owned by the platform) |

## planning-archive/ — design history & planning records

Preserved for design history and sequencing. Do not treat as current implementation without checking
the canonical docs and the code.

| Document | Role |
|---|---|
| [`field-ui-migration-plan.md`](planning-archive/field-ui-migration-plan.md) | The `force/` → `field-ui/` migration plan (complete; superseded by Phase D for runtime unification) |
| [`field-ui-worldclass-next-layer.md`](planning-archive/field-ui-worldclass-next-layer.md) | Next-layer plan (much now shipped — see canonical) |
| [`agent-handoff-fieldflow-visualization.md`](planning-archive/agent-handoff-fieldflow-visualization.md) | Implementation brief |
| [`forces-concept.md`](planning-archive/forces-concept.md) | North-star concept / vision |
| [`forces-possibilities.md`](planning-archive/forces-possibilities.md) | Design notes |
| [`forces-explainer.md`](planning-archive/forces-explainer.md) | Legacy single-canvas explainer |
| [`roadmap-frontiers.md`](planning-archive/roadmap-frontiers.md) | Frontier roadmap |
| [`docs-showcase-overhaul.md`](planning-archive/docs-showcase-overhaul.md) | Docs-surface planning record |

[`field-ui-brand-mark-field-fold.md`](field-ui-brand-mark-field-fold.md) is a standalone brand spec at
the docs root.

## Authority order

When documents conflict, prefer:

1. `canonical/field-ui-system-contracts.md` and `canonical/field-ui-platform-architecture.md` for implementation contracts.
2. `canonical/field-ui-definition-document.md` for conceptual definitions.
3. `canonical/fundamental-field-behavior-table.md` for field behavior.
4. `canonical/field-ui-testing-and-conformance.md` for validation and acceptance.
5. `engine-reference/*` for force formulas and engine internals.
6. `planning-archive/*` for history and intent only.

## Naming policy

Use `field-ui` for the project, packages, and docs. Use `field` for runtime concepts (field state,
field root, field body, field event, field metric). New code uses `--field-*` CSS variables and
`field:*` events; legacy aliases `--forces-*`, compact `--d`, and `forces:*` remain where
compatibility requires them.

## Core distinctions

### Field vs Force

```txt
field(b, x, y) = invisible structure
apply(b, p, env) = actual cause/effect
```

Field lines are not always particle paths.

### DOM ⇄ field runtime

The binding is **DOM ⇄ field runtime**, not DOM ⇄ canvas. Canvas is one render surface; SVG overlays
are another; CSS-variable + event feedback is another. The platform layer is the DOM participation
layer; the core engine is renderer-agnostic.

### Electromagnetic rule

```txt
Electric fields push. Magnetic fields bend. Fieldflow carries.
```

Do not make `magnetism.apply()` follow magnetic field lines. Use `fieldflow` for field-aligned
transport.

### Particle vs Agent

Particles are one kind of agent (`ParticleAgent`, `ElementAgent`, `RelationshipAgent`, `UserAgent`,
`LayoutAgent`, `DataAgent`, `EventAgent`).

### Visualization vs Physics

Visualization layers reveal state. They must not mutate physics unless explicitly declared as
feedback.
