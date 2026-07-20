# Fundamental Documentation Index

## What Fundamental is

```txt
Fundamental is a platform-native relational field runtime for the DOM.
```

It lets semantic HTML, DOM elements, particles, relationships, measurements, visual layers, and user
interaction participate in one **shared field context**. Elements bend the field; the field bends them
back. The visible particle canvas is **one render surface**, not the whole system.

```txt
@fundamental-engine/core      computes renderer-agnostic field, force, particle, metric, recipe, and diagnostic behavior. The engine. (The unscoped `Fundamental` name is taken by an unrelated package.)
@fundamental-engine/dom       binds field behavior to the DOM: the browser host, measurement, state, feedback, relationships, visual bindings, overlays, recipes, data binding, lint, scheduling.
@fundamental-engine/elements  native web components and the [data-body] HTML authoring contract.
@fundamental-engine/react     the React adapter over the same contracts.
@fundamental-engine/vanilla   the FieldField class for plain TypeScript.
@fundamental-engine/three     a Three.js-based 3D renderer for the field system.
@fundamental-engine/create    scaffolds a new Fundamental field project.
```

## Document statuses

Every document carries a status banner at the top. The four statuses:

- **canonical** — current source of truth for product, architecture, contracts, and public framing.
- **as-built reference** — historically/technically accurate engine record, narrower than the whole
  product.
- **legacy / superseded** — preserved for design history; not authoritative.
- **planning / roadmap** — forward-looking only; does not describe planned work as shipped.

The folders mirror the statuses: `canonical/`, `engine-reference/`, `planning/` (active forward-looking
specs), and `planning-archive/` (frozen design history).

## canonical/ — current architecture, contracts, and product framing

| Document | Role |
|---|---|
| [`definition-document.md`](canonical/definition-document.md) | Canonical concept and operating model |
| [`system-contracts.md`](canonical/system-contracts.md) | Hard contracts for bodies, fields, forces, agents, events, feedback, recipes, accessibility, performance, conformance, and the platform |
| [`platform-architecture.md`](canonical/platform-architecture.md) | `@fundamental-engine/dom`: the FrameScheduler, the six registries, `lintPlatform()`, the live runtime (Phase D) |
| [`api-stability.md`](canonical/api-stability.md) | The frozen `0.x` public API surface, the experimental surface, and the compatibility rules — enforced by `pnpm check:api` |
| [`natural-fields.md`](canonical/natural-fields.md) | The Natural Field Translation System — the four fundamental fields translated into interface behavior |
| [`documentation-standards.md`](canonical/documentation-standards.md) | How Fundamental is described everywhere — the architecture statement, doctrine, status taxonomy, naming policy, and verify-against-code rule |
| [`fundamental-field-behavior-table.md`](canonical/fundamental-field-behavior-table.md) | Field/force laws, electromagnetic split, `fieldflow`, and truth modes |
| [`visualization-methods-taxonomy.md`](canonical/visualization-methods-taxonomy.md) | Render layers and diagnostics (all modes shipped: contours, potential, vectors, energy, topology, inspector, causality, prediction) |
| [`interaction-and-relationship-model.md`](canonical/interaction-and-relationship-model.md) | Agents beyond particles; the relationship model; Reading Field |
| [`agent-consumption-model.md`](canonical/agent-consumption-model.md) | The Field Agent Consumption Model: agents (particle/element/event/…), the influence-kind → consumer matrix with per-cell status, the Body Matter Interaction (sink/accretion) submodel, events, and text/vector semantics |
| [`visual-language-and-geometry.md`](canonical/visual-language-and-geometry.md) | Typography, color, shape, visual-semantic pairing, overlays, export |
| [`authoring-and-recipes.md`](canonical/authoring-and-recipes.md) | Authoring across native HTML / web component / React; intent compiler; recipe schema |
| [`testing-and-conformance.md`](canonical/testing-and-conformance.md) | Test matrix, conformance gates, force passports, platform + scheduler + lint tests |

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

## planning/ — active forward-looking specs

Current planning material. Forward-looking; does not describe planned work as shipped.

| Document | Role |
|---|---|
| [`fundamental-release-gate-spec.md`](planning/fundamental-release-gate-spec.md) | The RC/1.0 release-gate program — two gates (freezability + survivor), the source spec behind the RC issues (#316–334) |
| [`fundamental-three-integration.md`](planning/fundamental-three-integration.md) | Three.js renderer integration plan |
| [`world-substrate/`](planning/world-substrate/) | The Stage-1 world-substrate program — `PLAN.md` (status ledger), `experimental-protocol.md` (this program's instance of the method, with current numbers), `substrate-conformance-corpus.md` (pre-registration **and** results, appended unedited below it), plus the F1/G3/F2 findings records |


## method/ — how this program is allowed to change its own theory

Domain-neutral. Stated without reference to fields or substrates because it is meant to apply beyond
this repository; the world-substrate program is one instance of it.

| Document | Role |
|---|---|
| [`empirical-protocol.md`](method/empirical-protocol.md) | Frozen implementations, pre-registered predictions, measured contract churn, the discovery criterion, prediction grading, permanent negative results, evidence provenance — and an explicit section on what the protocol does **not** do |
| [`observatory.md`](method/observatory.md) | The inspection instrument: topology, why it cannot derive findings, and the O11 calibration record (transformation ledger, representation invariants, instrument fidelity) |


## Authority order

When documents conflict, prefer:

1. `canonical/system-contracts.md` and `canonical/platform-architecture.md` for implementation contracts.
2. `canonical/definition-document.md` for conceptual definitions.
3. `canonical/fundamental-field-behavior-table.md` for field behavior.
4. `canonical/testing-and-conformance.md` for validation and acceptance.
5. `engine-reference/*` for force formulas and engine internals.

## Naming policy

Use `Fundamental` for the project, packages, and docs. Use `field` for runtime concepts (field state,
field root, field body, field event, field metric). New code uses `--field-*` CSS variables and
`field:*` events; the compact `--d` CSS alias remains alongside `--field-density` as canonical dual
naming. (The legacy `--forces-*` CSS variables have been removed.)

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
