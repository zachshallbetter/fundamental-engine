# field-ui World-Class Next Layer

## Related Documents

| Document | Role |
|---|---|
| [`README.md`](./README.md) | Documentation map |
| [`field-ui-definition-document.md`](./field-ui-definition-document.md) | Concept |
| [`field-ui-system-contracts.md`](./field-ui-system-contracts.md) | Contracts |
| [`field-ui-authoring-and-recipes.md`](./field-ui-authoring-and-recipes.md) | Authoring |
| [`field-ui-testing-and-conformance.md`](./field-ui-testing-and-conformance.md) | Tests |

## Purpose

This document captures next-layer systems that move `field-ui` from impressive engine to complete interface physics language.

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

## 10. Field Narrative Mode

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

```css
:root {
  --forces-motion-calm: 0.2;
  --forces-motion-active: 0.8;
  --forces-field-range-sm: 180px;
  --forces-field-range-md: 320px;
  --forces-field-range-lg: 520px;
  --forces-density-soft: 0.25;
  --forces-density-lit: 0.65;
  --forces-entropy-warning: 0.72;
}
```

## 12. Field Roles

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

See [`field-ui-interaction-and-relationship-model.md`](./field-ui-interaction-and-relationship-model.md).

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
