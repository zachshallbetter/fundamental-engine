# field-ui Documentation Index

## Purpose

This document set defines `field-ui` as an inspectable field language for interfaces.

Core statement:

```txt
field-ui is an engine for interface physics.
```

Expanded:

```txt
DOM elements, users, relationships, events, layout regions, and data records can participate in a shared reciprocal field.

Bodies emit influence.
Agents respond to influence.
Metrics record the result.
The interface adapts.
```

## Canonical Principle

```txt
Elements bend the field.
The field bends them back.
```


## Document Map

Read in this order.

| Order | Document | Role |
|---:|---|---|
| 1 | [`field-ui-migration-plan.md`](./field-ui-migration-plan.md) | Immediate migration plan from `force/` to `field-ui/` |
| 2 | [`field-ui-system-contracts.md`](./field-ui-system-contracts.md) | Hard contracts for bodies, fields, forces, agents, events, feedback, recipes, accessibility, performance, and conformance |
| 3 | [`field-ui-definition-document.md`](./field-ui-definition-document.md) | Canonical concept and operating model |
| 4 | [`fundamental-field-behavior-table.md`](./fundamental-field-behavior-table.md) | Field/force laws, electromagnetic split, `fieldflow`, and truth modes |
| 5 | [`visualization-methods-taxonomy.md`](./visualization-methods-taxonomy.md) | Render layers, diagnostics, heatmaps, field lines, probes, energy, topology, and prediction |
| 6 | [`field-ui-interaction-and-relationship-model.md`](./field-ui-interaction-and-relationship-model.md) | Agents beyond particles: users, elements, relationships, events, layout, data, attention, and interaction grammar |
| 7 | [`field-ui-visual-language-and-geometry.md`](./field-ui-visual-language-and-geometry.md) | Typography, color, shape, distance, pattern, emission, containers, surfaces, and visual semantics |
| 8 | [`field-ui-authoring-and-recipes.md`](./field-ui-authoring-and-recipes.md) | Authoring levels, intent compiler, recipe schema, examples, and precedence rules |
| 9 | [`field-ui-testing-and-conformance.md`](./field-ui-testing-and-conformance.md) | Test matrix, conformance gates, force passports, snapshot regression, linting, and acceptance criteria |
| 10 | [`field-ui-worldclass-next-layer.md`](./field-ui-worldclass-next-layer.md) | Strategic next-layer systems and product maturity plan |
| 11 | [`agent-handoff-fieldflow-visualization.md`](./agent-handoff-fieldflow-visualization.md) | Implementation-ready brief for agents |

## Authority Order

When documents conflict, use this priority:

1. `field-ui-migration-plan.md` for migration, directory, naming, and compatibility decisions.
2. `field-ui-system-contracts.md` for implementation contracts.
3. `field-ui-definition-document.md` for conceptual definitions.
4. `fundamental-field-behavior-table.md` for physical and field behavior.
5. `field-ui-testing-and-conformance.md` for validation and acceptance.
6. `agent-handoff-fieldflow-visualization.md` for implementation sequencing.
7. Other supporting docs.

## Naming Policy

Use `field-ui` for the project, package, documentation, and target directory name.

Use `field` for runtime concepts:

```txt
field state
field root
field body
field event
field metric
field density
field heat
```

Use `--field-*` for CSS variables.

Use `field:*` for DOM events.

Keep existing `forces-*`, `--forces-*`, and `forces:*` names as compatibility aliases until migration tests prove the new names work across core, components, docs, Lab, and examples.

## Migration Principle

```txt
This is a migration and cleanup, not a rewrite.
Preserve behavior first.
Rename and alias second.
Expand the field-ui model third.
```


## Core Distinctions

### Field vs Force

```txt
field(b, x, y) = invisible structure
apply(b, p, env) = actual cause/effect
```

Field lines are not always particle paths.

### Electromagnetic Rule

```txt
Electric fields push.
Magnetic fields bend.
Fieldflow carries.
```

Do not make `magnetism.apply()` follow magnetic field lines. Use `fieldflow` for field-aligned transport.

### Particle vs Agent

Particles are only one kind of agent.

```txt
ParticleAgent = visual matter
ElementAgent = DOM responder
RelationshipAgent = active connection
UserAgent = pointer/focus/selection field participant
LayoutAgent = region-level responder
DataAgent = semantic record in the field
EventAgent = threshold trigger
```

### Visualization vs Physics

Visualization layers reveal state. They must not mutate physics unless explicitly declared as feedback.

## Legacy Reference (as-built engine, under the former `forces-ui` naming)

The documents below describe the engine **as it currently ships**. They predate the field-ui
rename and still use the legacy `forces-ui` / `--forces-*` / `forces:*` / `<forces-field>` names —
all of which keep working as aliases. Treat them as the authoritative behavior baseline until the
field-first docs above fully absorb them; do not delete them during the migration.

| Document | Role |
|---|---|
| [`forces-system.md`](./forces-system.md) | The full engine specification (forces, formations, conditions, render modes, feedback) |
| [`forces-engine.md`](./forces-engine.md) | Module map and pipeline stages |
| [`forces-formulas.md`](./forces-formulas.md) | Exact per-force math |
| [`forces-concept.md`](./forces-concept.md) | Conceptual model and authoring |
| [`forces-tests.md`](./forces-tests.md) | Conformance coverage |
| [`shadow-dom.md`](./shadow-dom.md) | Shadow-DOM participation model |
