> **Status: planning / roadmap.**
> Forward-looking record. Items here may have shipped since — verify against the canonical docs ([../canonical/](../canonical/)) and the code before treating anything as current or as still-pending.

# field-ui World-Class Next Layer

## Related Documents

| Document | Role |
|---|---|
| [`README.md`](./README.md) | Documentation map |
| [`field-ui-definition-document.md`](../canonical/field-ui-definition-document.md) | Concept |
| [`field-ui-system-contracts.md`](../canonical/field-ui-system-contracts.md) | Contracts |
| [`field-ui-authoring-and-recipes.md`](../canonical/field-ui-authoring-and-recipes.md) | Authoring |
| [`field-ui-testing-and-conformance.md`](../canonical/field-ui-testing-and-conformance.md) | Tests |

## Purpose

This document captures next-layer systems that move `field-ui` from impressive engine to complete interface physics language. `field-ui` is a platform-native relational field runtime for the DOM: `@field-ui/core` computes renderer-agnostic field behavior, `@field-ui/platform` binds it to the DOM (measurement, state, feedback, relationships, visual bindings, overlays, scheduling, linting), and elements/react are authoring surfaces. Canvas is one render surface, not the whole system.

The baseline system defines:

```txt
bodies
agents
fields
forces
fieldflow
metrics
visualizations
feedback
conformance
```

This next layer adds:

```txt
authoring intelligence
production guardrails
accessibility
regression testing
semantic mapping
explainability
product surfaces
```

## Implemented

Much of this layer has since shipped. The platform runtime is now the default for `<field-root>`: `@field-ui/platform` ships the `FrameScheduler` (explicit phases: discover → read → compute → state → write → render) and six registries — `MeasurementRegistry`, `StateRegistry`, `FeedbackRegistry`, `RelationshipRegistry`, `VisualBindingRegistry`, `OverlayRegistry` — plus `lintPlatform()` and `createFieldPlatform(root)`. `@field-ui/core` stays renderer-agnostic; the platform owns DOM participation.

Shipped from the items below:

```txt
Field linting (§3) — platform lint rules over the scheduler
Semantic layers (§8) — semantic/layers.ts
Field state machine (§9) — semantic/states.ts
Field design tokens (§11) — visual/tokens.ts
Field roles (§12) — visual/tokens.ts + core/scanner.ts wiring
Diagnostics render modes (§10) — all modes live at /docs/diagnostics
Reading Field demo — exercises all six registries (/docs/reading-field)
Authoring across surfaces — native HTML / <field-root> / <FieldField> (/docs/authoring)
```

All render modes ship and are live at `/docs/diagnostics`: dots, trails, links, streamlines, metaballs, voronoi, field-lines, heatmap, force-vectors, contours, potential, energy, topology, inspector, causality, prediction. The remaining sections record genuine frontier work (intent compiler depth, error taxonomy, snapshot regression, narrative mode, explain/diff, the broader product surfaces) and forward-looking targets.

## 1. Truth Modes

Classify every behavior.

| Truth mode | Meaning | Examples |
|---|---|---|
| Physical truth | modeled after real law | `gravity`, `charge`, `magnetism` |
| Designed truth | legible UI behavior | `attract`, `repel`, `spring` |
| Diagnostic truth | reveals internal state | heatmaps, inspectors |
| Poetic truth | expressive composite | `blackhole`, `nebula` |
| Semantic truth | maps meaning into physics | attention, memory |

## 2. Field Intent Compiler

Authors describe intent.

```html
<forces-body data-intent="draw-focus" data-intensity="0.8"></forces-body>
```

Compiles to force tokens and render settings.

## 3. Field Linting

> **Implemented.** `lintPlatform()` runs platform lint rules over the scheduler:
> `relation-target-missing`, `state-unregistered`, `overlay-without-links`, `feedback-non-css-var`,
> `measurement-off-phase`, `visual-orphan`, `visual-not-hidden`.

Catch bad configurations.

```txt
magnetism without charged/moving particles
fieldflow with no field source
source with no budget
missing reduced-motion fallback
field-lines with no field() hooks
```

## 4. Accessibility Contract

```txt
Motion is optional.
Meaning is never motion-only.
Reduced motion swaps travel for state.
Interactive fields need labels.
```

## 5. Performance Budget

Expose budgets for:

```txt
particles
bodies
local cells
field lines
heatmap resolution
DPR
debug overlays
```

## 6. Error Taxonomy

Named errors:

```txt
NO_FIELD_SOURCE
UNBUDGETED_SOURCE
UNSTABLE_ENERGY
NAN_PARTICLE
SHADOW_BODY_UNMEASURABLE
MISSING_REDUCED_MOTION
VISUALIZATION_MUTATES_PHYSICS
```

## 7. Snapshot Regression

Exported scenes become tests.

```txt
forces test snapshot solar-prominence.json
```

## 8. Semantic Layers

| Semantic layer | Field behavior |
|---|---|
| importance | strength / attention |
| confidence | coherence |
| uncertainty | entropy |
| urgency | heat |
| relationship | topology links |
| history | memory |
| status | phase |
| hierarchy | potential |
| interactivity | feedback gain |

> **Implemented.** `semantic/layers.ts` (`SEMANTIC_LAYERS`, `semanticToMetrics`).

## 9. Field State Machine

```ts
type FieldState =
  | "idle"
  | "focused"
  | "searching"
  | "navigating"
  | "reading"
  | "warning"
  | "critical"
  | "celebrating";
```

> **Implemented.** `FieldState` + `FIELD_STATES` in `semantic/states.ts` (incl. the control-level
> states from interaction §23).

## 10. Field Narrative Mode

> The underlying render surfaces all ship and are live at `/docs/diagnostics` (dots, trails, links,
> streamlines, metaballs, voronoi, field-lines, heatmap, force-vectors, contours, potential, energy,
> topology, inspector, causality, prediction). The progressive-reveal *narrative* sequencing over
> them remains frontier work.

Progressively reveal:

```txt
particles
bodies
field lines
forces
DOM feedback
heatmaps
topology
inspector
```

## 11. Field Design Tokens

> **Implemented** (field-first names) as `FIELD_DESIGN_TOKENS` + `fieldTokensCss()` in
> `packages/core/src/visual/tokens.ts`. `--field-*` names are primary; the `--forces-*` forms are
> legacy/compat aliases (the `FeedbackRegistry` auto-mirrors `--field-*` → `--forces-*`).

```css
:root {
  --field-motion-calm: 0.2;
  --field-motion-active: 0.8;
  --field-range-sm: 180px;
  --field-range-md: 320px;
  --field-range-lg: 520px;
  --field-density-soft: 0.25;
  --field-density-lit: 0.65;
  --field-entropy-warning: 0.72;
}
```

## 12. Field Roles

> **Implemented + runtime-wired.** `FIELD_ROLES` + `isFieldRole()` in `visual/tokens.ts`; the scanner
> (`core/scanner.ts`) maps a `data-field-role` (with no explicit `data-body`/`data-intent`) to a
> default token — anchor→tether, boundary→wall, sink→sink, source→jet; sensor/display are
> feedback-only responders.

```html
<div data-field-role="source"></div>
<div data-field-role="sink"></div>
<div data-field-role="anchor"></div>
<div data-field-role="boundary"></div>
<div data-field-role="sensor"></div>
<div data-field-role="display"></div>
```

## 13. Explain This Field

Generate a natural-language summary from scene state.

Example:

```txt
This scene has one magnetic source defining loop geometry, one fieldflow transport layer carrying neutral matter along that geometry, and one thermal layer adding excitation. Particles follow the magnetic structure because of fieldflow, not magnetism.
```

## 14. Field Diff

Explain parameter changes.

```txt
Before: entropy 0.22, average speed 1.4, density center 0.61
After: entropy 0.37, average speed 2.1, density center 0.44
Change: stronger fieldflow increases velocity and lowers center density.
```

## 15. Authoring Levels

| Level | User | API |
|---|---|---|
| 1 | designer | intents and presets |
| 2 | developer | `data-body`, render modes, recipes |
| 3 | engine author | custom `field()` / `apply()` / conformance |

## 16. Product Surfaces

> Several of these ship: the Inspector render mode is live at `/docs/diagnostics`, the Reading Field
> demo (`/docs/reading-field`) exercises all six registries on the scheduler, and authoring across
> native HTML / `<field-root>` / `<FieldField>` ships at `/docs/authoring`. Composer, Snapshot
> Viewer, Accessibility Preview, and Agent Report remain frontier surfaces.

| Surface | Purpose |
|---|---|
| Homepage | concept and product story |
| Docs | build path and contracts |
| Lab | executable spec and detector |
| Inspector | runtime debug and reciprocity |
| Composer | authoring tool |
| Recipe Gallery | copyable examples |
| Snapshot Viewer | replay and regression |
| Accessibility Preview | reduced-motion fallbacks |
| Agent Report | implementation-ready handoff |

## 17. Interaction and Relationship Expansion

Core premise:

```txt
Particles are only one class of field participant.
Users, elements, relationships, events, layout, and data can also be agents.
```

See [`field-ui-interaction-and-relationship-model.md`](../canonical/field-ui-interaction-and-relationship-model.md).

## 18. Implementation Priority

```txt
1. System contracts
2. Force passports
3. Visualization truth table
4. Probe modes
5. Agent model details
6. Authoring API and precedence
7. Recipe schema and examples
8. Conformance/test matrix
9. Accessibility contract
10. Performance budget
11. Product surface definitions
12. Composer/Lab/Inspector behavior
13. Positioning language
```
