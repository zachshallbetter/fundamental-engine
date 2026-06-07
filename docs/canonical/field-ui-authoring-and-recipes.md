> **Status: canonical.**
> Authoring levels, the intent compiler, the recipe schema, examples, and precedence rules. Current as of the platform-runtime phase (Phase D). See [field-ui-platform-architecture.md](field-ui-platform-architecture.md) and [field-ui-system-contracts.md](field-ui-system-contracts.md).

# field-ui Authoring and Recipes

## Related Documents

| Document | Role |
|---|---|
| [`README.md`](./README.md) | Documentation map |
| [`field-ui-definition-document.md`](field-ui-definition-document.md) | Concept |
| [`field-ui-system-contracts.md`](field-ui-system-contracts.md) | Recipe contract |
| [`field-ui-interaction-and-relationship-model.md`](field-ui-interaction-and-relationship-model.md) | Interaction recipes |
| [`field-ui-testing-and-conformance.md`](field-ui-testing-and-conformance.md) | Recipe tests |

## Purpose

This document defines how authors use `field-ui`. `field-ui` is a platform-native relational field
runtime for the DOM: `@field-ui/core` computes renderer-agnostic field behavior, `@field-ui/platform`
binds it to the DOM (measurement, state, feedback, relationships, visual bindings, overlays,
scheduling, linting), and the elements/React surfaces are how authors declare bodies into that shared
field context. Authors write the same `[data-body]` contract regardless of surface.

The system supports three authoring levels:

| Level | User | API |
|---|---|---|
| Level 1 | designer | intents and presets |
| Level 2 | developer | `data-body`, render modes, recipes |
| Level 3 | engine author | custom `field()` / `apply()` / conformance |

## 1. Authoring Surfaces

| Surface | Use |
|---|---|
| HTML attributes | direct declarative authoring |
| Web Components | encapsulated field participation |
| React props | framework integration |
| Core API | engine-level control |
| Scene recipes | portable scene definitions |
| Composer | visual authoring and copy-code tool |
| Lab | executable spec and tuning |
| Inspector | debugging and reciprocity view |

### Authoring across surfaces (shipped)

The three authoring surfaces all compile to the same `[data-body]` contract, so a body authored in
native HTML, as a web component, or in React participates identically in the shared field context. See
the live walkthrough at `/docs/authoring`.

Native HTML — the platform runtime attaches to any element carrying `data-body`:

```html
<div data-body="attract" data-strength="0.8" data-range="280" data-feedback>
  Living headline
</div>
<style>
  [data-body] { color-mix(in oklch, currentColor, white calc(var(--field-density, 0) * 40%)); }
</style>
```

Web component — `<field-root>` wraps content and registers each `[data-body]` with the field; the
platform runtime is the default participation path:

```html
<field-root>
  <article data-body="attract" data-strength="0.8" data-range="280" data-feedback>
    Living headline
  </article>
</field-root>
```

React — `<FieldField>` renders the same contract; props map onto the same `data-*` tokens:

```tsx
import { FieldField } from "@field-ui/react";

function Headline() {
  return (
    <FieldField>
      <h1 data-body="attract" data-strength={0.8} data-range={280} data-feedback>
        Living headline
      </h1>
    </FieldField>
  );
}
```

All three forms emit identical `[data-body]` markup, drive the same `--field-density` feedback
variable, and are measured, fed back, and related to one another through the same platform registries.

## 2. Core Attributes

| Attribute | Purpose |
|---|---|
| `data-body` | force tokens |
| `data-intent` | high-level author intent |
| `data-field-role` | semantic role |
| `data-field-state` | current field state |
| `data-render` | render layers |
| `data-feedback` | enable DOM write-back |
| `data-field-source` | source field for transport |
| `data-scope` | local/global participation |
| `data-field` | explicit field target |
| `data-strength` | force intensity |
| `data-range` | effective radius |
| `data-when` | activation condition |

## 3. Precedence Rules

```txt
explicit force token beats intent defaults
component props beat inherited field state
local cell settings beat global settings
reduced motion overrides visual travel
accessibility overrides animation
lint warnings do not block unless severity is error
source budgets override spawn intensity
debug render layers do not mutate physics
```

## 4. Intent Compiler

> **Implemented + runtime-wired.** `compileIntent` (`packages/core/src/recipes/intent.ts`) and the
> scanner (`core/scanner.ts`): an element with `data-intent` (and `data-intensity` / `data-risk`),
> and no explicit `data-body`, becomes a body from the compiled tokens. Explicit `data-*` wins over
> intent defaults (precedence §3).

Authors may describe intent instead of raw tokens.

Example:

```html
<field-cell
  data-intent="draw-focus"
  data-intensity="0.8"
  data-risk="low"
></field-cell>
```

Compiled output:

```html
<field-cell
  data-body="attract screen"
  data-strength="0.8"
  data-range="280"
  data-feedback
></field-cell>
```

Intent presets:

| Intent | Compiles to |
|---|---|
| `draw-focus` | `attract + feedback` |
| `clear-space` | `repel + screen` |
| `show-motion` | `stream + trails` |
| `show-relationship` | `threads + memory` |
| `contain-energy` | `screen + drag + reflect` |
| `ignite` | `thermal + fieldflow + heatmap` |
| `stabilize` | `drag + cohesion + coherence` |
| `warn` | `repel + thermal + entropy` |

The compiler must be inspectable. Authors should be able to see the generated force tokens and render layers.

## 5. SceneRecipe Schema

A recipe is a portable scene or behavior definition.

```ts
type SceneRecipe = {
  name: string
  intent: string
  bodies: BodyRecipe[]
  agents?: AgentRecipe[]
  relationships?: RelationshipRecipe[]
  render: VisualizationLayer[]
  metrics: string[]
  accessibility: AccessibilityRecipe
  budget: FieldBudget
  expected?: ExpectedMetrics
  notes?: string
}
```

Example:

```json
{
  "name": "Solar prominence",
  "intent": "field-aligned plasma stream",
  "bodies": [
    { "body": "magnetism", "strength": 1.2, "range": 420 },
    { "body": "fieldflow", "strength": 0.8, "range": 0 },
    { "body": "thermal", "strength": 0.2, "range": 320 }
  ],
  "render": ["particles", "field-lines", "trails", "heatmap"],
  "metrics": ["heat", "velocity", "entropy"],
  "notes": "Magnetism defines loops. Fieldflow carries matter along them."
}
```

## 6. Recipe Types

| Recipe | Purpose |
|---|---|
| `SceneRecipe` | full field scene |
| `ForceRecipe` | reusable force configuration |
| `InteractionRecipe` | behavior tied to user input |
| `VisualizationPreset` | render stack |
| `MaterialPreset` | feel/material behavior |
| `StatePreset` | field state configuration |

## 7. Essential Recipes

> **Implemented.** All nine ship as validated `SceneRecipe`s in
> `packages/core/src/recipes/gallery.ts` (`ESSENTIAL_RECIPES`).

### Living Headline

Intent:

```txt
Text receives density and becomes heavier/glowing as matter gathers.
```

Forces:

```txt
attract + feedback
```

Render:

```txt
particles + subtle field lines
```

### Attention Budget

Intent:

```txt
One element gains emphasis while others surrender attention.
```

Mechanics:

```txt
conserved attention scalar
attention heatmap
ElementAgent feedback
```

### Relationship Map

Intent:

```txt
Relationships act as physical constraints with memory.
```

Mechanics:

```txt
RelationshipAgent
threads
memory heatmap
attention transfer
```

### Solar Prominence

Intent:

```txt
Matter follows magnetic structure without corrupting magnetism.
```

Mechanics:

```txt
magnetism defines B field
fieldflow carries matter along B
thermal adds excitation
```

### Search Relevance Wells

Intent:

```txt
Search results arrange around relevance and uncertainty.
```

Mechanics:

```txt
relevance -> strength
uncertainty -> entropy
clicked result -> memory
exact match -> attract
excluded result -> repel
```

### Form Validation Field

Intent:

```txt
Form state becomes coherent or unstable.
```

Mechanics:

```txt
focused -> attract
valid -> coherence
invalid -> heat + entropy
submitting -> stream
success -> release
```

### Reading Memory Trail

Intent:

```txt
Long-form content remembers reading path.
```

Mechanics:

```txt
viewport center -> attention well
read paragraphs -> memory trail
citations -> threads
unresolved terms -> entropy
```

### Collaborative Presence

Intent:

```txt
Multiple users become subtle field participants.
```

Mechanics:

```txt
cursor -> wake
selection -> attention well
edit -> heat
conflict -> entropy
handoff -> stream
```

### AI Confidence Field

Intent:

```txt
AI state becomes spatial and inspectable.
```

Mechanics:

```txt
candidate answer -> attractor
uncertainty -> entropy
source support -> relationship tension
contradiction -> repulsion
verified claim -> coherence
active generation -> stream
```

## 8. Material Presets

Forces define behavior. Materials define feel.

| Material | Behavior |
|---|---|
| glass | lens + reflect + low drag |
| rubber | spring + damping |
| liquid | cohesion + pressure |
| plasma | fieldflow + thermal + trails |
| dust | diffuse + low mass |
| metal | magnetism + reflect |
| fabric | link + shear |
| paper | low motion + memory |
| stone | high mass + low response |
| smoke | diffuse + stream + entropy |

## 9. Field States

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

Example:

```json
{
  "searching": {
    "formation": "scatter",
    "render": ["particles", "memory"],
    "attention": "distributed"
  },
  "focused": {
    "formation": "wells",
    "render": ["particles", "density"],
    "attention": "conserved"
  }
}
```

## 10. Authoring Lint Rules

```txt
Warning: magnetism without charged or moving particles may appear inactive.
Warning: fieldflow has no field source nearby.
Warning: source force has no budget.
Warning: local cell particle count too high.
Warning: field lines enabled but no registered field() hooks exist.
Warning: data-body="gravity attract" may duplicate pull behavior.
Warning: reduced motion fallback missing.
```

## 11. Explain This Field

Every scene should be explainable.

Example:

```txt
This scene has one magnetic source defining loop geometry, one fieldflow transport layer carrying neutral matter along that geometry, and one thermal layer adding excitation. Particles follow the magnetic structure because of fieldflow, not magnetism. The active render stack is particles, field-lines, trails, and heatmap.
```

## 12. Field Diff

When parameters change, explain the difference.

Example:

```txt
Before: entropy 0.22, average speed 1.4, density center 0.61
After: entropy 0.37, average speed 2.1, density center 0.44
Change: stronger fieldflow increases velocity and lowers center density.
```

## 13. Implementation Priority

```txt
1. SceneRecipe schema
2. VisualizationPreset schema
3. ForceRecipe schema
4. Intent compiler
5. Authoring lint rules
6. Essential recipes
7. Material presets
8. Field state presets
9. Explain This Field output
10. Field Diff
```
