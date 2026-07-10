> **Status: canonical.**
> Authoring levels, the intent compiler, the pattern schema, examples, and precedence rules. Current as of the platform-runtime phase (Phase D). See [platform-architecture.md](platform-architecture.md) and [system-contracts.md](system-contracts.md).

# Fundamental Authoring and Patterns

## Related Documents

| Document | Role |
|---|---|
| [`README.md`](./README.md) | Documentation map |
| [`definition-document.md`](definition-document.md) | Concept |
| [`system-contracts.md`](system-contracts.md) | Pattern contract |
| [`interaction-and-relationship-model.md`](interaction-and-relationship-model.md) | Interaction patterns |
| [`testing-and-conformance.md`](testing-and-conformance.md) | Pattern tests |

## Purpose

This document defines how authors use `Fundamental` on the web. `Fundamental` is a platform-native
relational field runtime: `@fundamental-engine/core` computes renderer-agnostic field behavior, and its
web host adapter `@fundamental-engine/dom` binds the field to the DOM (measurement, state, feedback,
relationships, visual bindings, overlays, scheduling, linting); the elements/React surfaces are how
authors declare bodies into that shared field context. Authors write the same `[data-body]` contract
regardless of surface.

The system supports three authoring levels:

| Level | User | API |
|---|---|---|
| Level 1 | designer | intents and presets |
| Level 2 | developer | `data-body`, render modes, patterns |
| Level 3 | engine author | custom `field()` / `apply()` / conformance |

## 1. Authoring Surfaces

| Surface | Use |
|---|---|
| HTML attributes | direct declarative authoring |
| Web Components | encapsulated field participation |
| React props | framework integration |
| Core API | engine-level control |
| Field Patterns | portable field programs (current API: `FieldPattern`) |
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
import { FieldField } from "@fundamental-engine/react";

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

All three forms emit identical `[data-body]` markup, drive the same `--d` feedback channel (its
expressive long form is `--field-density`), and are measured, fed back, and related to one another
through the same platform registries.

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
> scanner (`engine/scanner.ts`): an element with `data-intent` (and `data-intensity` / `data-risk`),
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

| Intent | Concept | Runtime tokens | Render / feedback | Notes |
|---|---|---|---|---|
| `draw-focus` | draw attention to a focus | `attract` | feedback (`--field-density`) | range 280 |
| `clear-space` | open a keep-clear region | `repel` | — | range 240; `screen` is not a token |
| `show-motion` | flow along a heading | `stream` | render: `trails` | `trails` is a render mode, not a token |
| `show-relationship` | link related things | `memory` | render: `links` | `links` is a render mode; `threads` is not a token |
| `contain-energy` | damp + bound a region | `viscosity`, `wall` | — | `drag`→`viscosity`, `reflect`→`wall`; `screen` is not a token |
| `ignite` | energize / heat | `thermal`, `fieldflow` | render: `heatmap`, `particles` | `heatmap` is a render mode, not a token |
| `stabilize` | calm + hold together | `viscosity`, `cohesion` | — | `drag`→`viscosity`; `coherence` is a metric, not a token |
| `warn` | warning / instability | `repel`, `thermal` | feedback | `entropy` is a metric, not a token |

The **Runtime tokens** column holds real, passported engine forces only. Render modes, metrics, and
human concepts live in their own columns and are never executed as forces: `screen`, `drag`,
`reflect`, and `threads` are not tokens; `entropy` and `coherence` are metrics; `trails`, `links`,
and `heatmap` are render modes. The machine-readable source of truth is `compileIntent` in
`packages/core/src/recipes/intent.ts`.

The compiler must be inspectable. Authors should be able to see the generated force tokens and render layers.

## 5. FieldPattern Schema

### Field Pattern vs. FieldPattern

A **Field Pattern** is the canonical concept: an authored arrangement of semantic intent, dimensions,
bodies, fields, forces, relationships, metrics, diagnostics, projections, and accessibility equivalents.

`FieldPattern` is the current API representation of a Field Pattern.

Use "Field Pattern" when explaining the model. Use `FieldPattern`, `compileRecipe`, `applyRecipe`, and
`FIELD_RECIPES` when referring to the current TypeScript schema, compiler, validator, catalog, routes,
and API. Do not use "Configuration" for this concept — reserve configuration for ordinary
settings/options (render configuration, host configuration, engine configuration). Do not use "Matter"
for this concept — Matter is the participant/substance lane. Do not rename any API symbols.

> **Implemented.** `FieldPattern` (`packages/core/src/recipes/schema.ts`). A `FieldPattern` is the current
> API representation of a portable, serializable, inspectable Field Pattern — the reusable unit that
> connects the natural-field model,
> engine primitives, DOM authoring, platform feedback, diagnostics, and the accessibility fallback.
> `validateRecipe` enforces every reference against the engine catalog. (`SceneRecipe` is a deprecated
> alias of `FieldPattern`.)

```ts
type FieldPattern = {
  id: string                          // stable kebab-case id (e.g. "priority-well")
  name: string
  intent: string
  tier?: RecipeTier                   // core | applied | systems | operational
  naturalField?: "gravity" | "electromagnetic" | "strong" | "weak"
  translation?: string                // the field→interface translation phrase (concept lane)
  primitives: string[]                // the distinct body tokens, in first-seen order
  concepts?: string[]                 // product-language lane — describes; never executed
  metrics: string[]                   // signal names; --field-density is the one written today
  diagnostics: string[]               // render/diagnostic modes that reveal the behavior
  conditions?: string[]               // activation vocabulary — when the behavior applies
  bodies: BodyRecipe[]                // each body may carry `when` — the EXECUTABLE gate (data-when)
  relationships?: RelationshipRecipe[]  // compiled metadata only — used for the reduced-motion static display;
                                        // NOT registered as live edges into RelationshipRegistry
  render: RenderLayer[]               // compiled to a render PLAN; executes when applyRecipe gets a field
  accessibility: AccessibilityRecipe  // required: reducedMotion + meaningWithoutMotion
  status?: RecipeStatus               // implementation status
  budget?: Partial<PerformanceBudget>
  expected?: ExpectedMetrics
  notes?: string
}
```

The lanes stay separate: `primitives` (runtime tokens) execute, `concepts` / `translation` describe,
`metrics` measure, `diagnostics` explain, `conditions` activate. `validateRecipe` rejects a token that
appears in more than one lane.

`relationships` is **compiled metadata, not a live-graph registration**. `compileRecipe` preserves
the declared `from → to` pairs for one purpose only: populating the reduced-motion static display
(`applyRecipe` renders them as a `<p class="rs-rels">` list when `prefers-reduced-motion` is set).
The `RelationshipRegistry`'s live graph is built solely by `RelationshipRegistry.discover()`,
which reads native DOM signals — `a[href^="#"]`, `label[for]`, ARIA references, and
`data-field-relation` / `data-field-target` attributes. A pattern author who wants an edge in the
live graph must author it in HTML with `data-field-relation`, not in the pattern schema.

`validateRecipe` returns a problem for any unknown force token, unknown render layer, unknown
diagnostic mode, unknown fundamental field, an unknown per-body `when` condition id (an unregistered
gate would silently never pass — rejected instead), declared `primitives` that drift from the body
tokens, or a missing accessibility equivalent. A pattern can't reference anything the engine doesn't
have, and no pattern is motion-only.

**Patterns execute their declarations (#370).** `compileRecipe` derives an executable render plan from
`render` — one underlay matter mode (`particles` → `dots`), the additive overlay reading stack, and
the heatmap toggle; layers with no executable surface are NAMED in `plan.unapplied`, never silently
dropped. `applyRecipe(root, pattern, { field })` drives a live field with the plan (a `FieldHandle` or
`<field-root>` both satisfy the structural target) and releases the surfaces on `destroy()`;
`renderless` and reduced motion skip the drive. Per-body `when` compiles to `data-when` on the body —
the contour-charge pattern carries its own engagement gate this way. Without a `field` option, patterns
remain signals-only, exactly as before.

Example:

```json
{
  "id": "guided-flow",
  "name": "Guided Flow",
  "intent": "move particles or attention along field lines, relationships, or paths",
  "naturalField": "electromagnetic",
  "primitives": ["magnetism", "fieldflow", "stream", "propagate"],
  "bodies": [
    { "body": "magnetism", "strength": 1, "range": 420, "spin": 1 },
    { "body": "fieldflow", "strength": 0.8, "range": 0 },
    { "body": "stream", "strength": 0.6, "range": 320, "angle": 0 },
    { "body": "propagate", "strength": 0.5, "range": 300 }
  ],
  "render": ["streamlines", "field-lines", "trails", "particles"],
  "metrics": ["flow", "velocity", "density"],
  "diagnostics": ["field-lines", "force-vectors", "prediction"],
  "accessibility": {
    "reducedMotion": "a static path contour with a numbered route and direction markers",
    "meaningWithoutMotion": "the route is an ordered list of steps with direction labels"
  },
  "notes": "Magnetism bends, fieldflow carries — the recipe-level expression of field.flowTo()."
}
```

## 6. Pattern Types

| Pattern | Purpose |
|---|---|
| `FieldPattern` | full field program (bodies, render, metrics, diagnostics, a11y) |
| `ForceRecipe` | reusable force configuration |
| `InteractionRecipe` | behavior tied to user input |
| `VisualizationPreset` | render stack |
| `MaterialPreset` | feel/material behavior |
| `StatePreset` | field state configuration |

## 7. Field Patterns

> **Implemented.** All **sixty-four** ship as validated `FieldPattern`s in
> `packages/core/src/recipes/catalog.ts` (`FIELD_RECIPES`; `gallery.ts` re-exports it), grouped into four tiers (`RECIPE_TIERS`),
> live on [`/docs/gallery`](https://fundamental-engine.com/docs/gallery). They are the four-field translation
> model made practical — and classification/authoring artifacts only: they **compose existing
> primitives and add no new engine behavior**. Eight are the recommended first-release set
> (`FIRST_RELEASE_RECIPE_IDS`).

The four tiers (16 each): **Core — interface & accessibility** (1–16), **Applied — product, workflow &
collaboration** (17–32), **Systems — safety, provenance & governance** (33–48), **Operational —
multi-actor, adaptive & live** (49–64). The keys are a complexity ladder (`core` → `applied` →
`systems` → `operational`), not access tiers — nothing is gated.

### Pattern language vs engine vocabulary

Pattern **prose** is expressive; pattern **runtime fields** are strict. A pattern can say "completion
releases pressure and decays into memory," while its runtime fields stay
`primitives: [morph, memory, gravity]`. The conformance gate rejects any pattern whose primitives are
not real passported tokens, whose render layers / diagnostics are not real modes, or whose declared
primitives drift from the body tokens. Conceptual words map as follows (never invent a force token):

| Concept | Goes to | Real token / mode |
|---|---|---|
| `mass`, `risk`, `trust`, `confidence`, `priority`, `entropy` | `metrics` | — (free-form labels) |
| `potential`, `velocity vectors`, `relationship overlay`, `wavefront contours` | `diagnostics` | `potential`, `force-vectors`, `topology`, `contours` |
| `spring` | `primitives`/`bodies` | `tether` |
| `drag` / `friction` | `primitives`/`bodies` | `viscosity` |
| `reflect` | `primitives`/`bodies` | `wall` |
| `absorb` | `primitives`/`bodies` | `sink` |
| `threshold` | `primitives`/`bodies` | `gate` |
| `emitter` / `source` | `primitives`/`bodies` | `spawn` |
| `phase` / `transform` / `decay` | `primitives`/`bodies` | `morph` / `memory` |
| `orbit` | `primitives`/`bodies` | `magnetism` + `tether` (+ `gravity`) |

No new force tokens are added for patterns — only pattern records, conformance, mappings, and docs.

### Tier 1 — Core interface & accessibility (the first-release set is starred)

| # | Pattern | Natural field | Purpose |
|---|---|---|---|
| 1 | **Priority Well** ★ | gravity | make important elements feel naturally weighted without shouting |
| 2 | Focus Orbit | gravity (+ electromagnetic) | keep related options moving around the active item |
| 3 | Search Relevance Field | gravity | let results settle by relevance, confidence, and recency |
| 4 | **Signal Path** ★ | electromagnetic | show information flowing through citations, dependencies, routes |
| 5 | **Evidence Field** ★ | electromagnetic (+ strong) | show how sources support, weaken, or contradict a claim |
| 6 | Conflict Field | weak (+ electromagnetic) | make contradiction, uncertainty, and unstable state visible |
| 7 | **Relationship Bond** ★ | strong | keep related elements visually and behaviorally connected |
| 8 | Concept Cluster | strong | group related terms or sections without hard layout changes |
| 9 | **Coherence Field** ★ | strong | show whether a form, workflow, or dataset is becoming stable |
| 10 | **Reading Field** ★ | gravity (+ memory + relationships) | reveal attention, memory, and concept links in long content |
| 11 | **Memory Trace** ★ | weak | show where a user has been, paused, returned, or accumulated attention |
| 12 | Decay Notice | weak | let stale, temporary, or completed state fade gracefully |
| 13 | Phase Shift | weak | show a state transition (draft → published, pending → complete) |
| 14 | **Guided Flow** ★ | electromagnetic (+ transport) | move particles or attention along field lines, relationships, paths |
| 15 | Diagnostic Lens | diagnostic | reveal field lines, causality, prediction, topology, energy, overlays |
| 16 | Accessibility Equivalence | platform / semantic | convert motion-heavy behavior into static, semantic equivalents |

★ = the recommended first-release set: Priority Well, Signal Path, Relationship Bond, Reading Field,
Evidence Field, Coherence Field, Memory Trace, Guided Flow. Those eight explain the system quickly; the
full catalog gives the project its range.

### Tier 2 — Applied: product, workflow & collaboration (17–32)

Attention Weather (gravity), Navigation Current (EM), Citation Thread (EM), Form Stability Field
(strong), Command Intent Field (gravity), Selection Wake (weak), Availability Pressure (gravity),
Dependency Tension (strong), Staleness Drift (weak), Trust Gradient (EM), Completion Release (weak),
Group Magnet (strong), Error Pressure (weak), Handoff Stream (EM), Context Halo (gravity), Field
Tutorial (diagnostic).

### Tier 3 — Systems: safety, provenance & governance (33–48)

Semantic Gravity Map (gravity), Polarity Filter (EM), Source Constellation (strong), Drift Correction
(weak), Resonance Match (EM), Friction Gate (derived), Boundary Field (strong), Threshold Bloom (weak),
Latency Ripple (EM), Provenance Trail (strong), Review Pressure (gravity), Semantic Snap (strong),
Ambient Tutor (gravity), Relation Lens (strong), Priority Tide (gravity), Field Contract Preview
(platform).

### Tier 4 — Operational: multi-actor, adaptive & live (49–64)

Presence Field (EM), Consensus Well (gravity), Disagreement Charge (EM), Change Shockwave (EM),
Permission Boundary (strong), Risk Horizon (gravity), Intent Magnet (gravity), Flow Checkpoint
(strong), Version Gravity (gravity), Review Constellation (strong), Anomaly Bloom (weak), Scope Lens
(diagnostic), Calibration Field (gravity), Semantic Drag (derived), Recovery Path (weak), System Pulse
(EM).

Each pattern declares its natural field, primitives, bodies, render stack, metrics, diagnostics, and an
accessibility equivalent. See the executable cards (intent, primitives, diagnostics, reduced-motion
equivalent, copyable JSON) on the gallery page, and the per-recipe plain-language explanation from
`explainScene`.

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

This list records the build order, all of which has now shipped (file pointers below).

```txt
1. SceneRecipe schema — shipped (recipes/schema.ts; FieldPattern, SceneRecipe alias)
2. VisualizationPreset schema — shipped (visual/visualization.ts; VISUALIZATION_PRESETS)
3. ForceRecipe schema — shipped (recipes/schema.ts)
4. Intent compiler — shipped (recipes/intent.ts; compileIntent)
5. Authoring lint rules — shipped (visual/lint.ts)
6. Essential patterns — shipped (recipes/catalog.ts; 64 patterns, 8 first-release)
7. Material presets — shipped (semantic/materials.ts; INTERACTION_MATERIALS)
8. Field state presets — shipped (semantic/states.ts; FIELD_STATES)
9. Explain This Field output — shipped (explainScene)
10. Field Diff
```
