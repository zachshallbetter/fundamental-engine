# field-ui Interaction and Relationship Model

## Related Documents

| Document | Role |
|---|---|
| [`README.md`](./README.md) | Documentation map |
| [`field-ui-definition-document.md`](./field-ui-definition-document.md) | Concept |
| [`field-ui-system-contracts.md`](./field-ui-system-contracts.md) | Agent contracts |
| [`field-ui-authoring-and-recipes.md`](./field-ui-authoring-and-recipes.md) | Recipes |
| [`visualization-methods-taxonomy.md`](./visualization-methods-taxonomy.md) | Relationship visualization |

## Purpose

This document expands `field-ui` beyond particles.

Particles are only one class of field participant. Users, elements, relationships, events, layouts, and data can also be agents.

Core expansion:

```txt
Bodies emit influence.
Agents respond to influence.
Metrics record the result.
The interface adapts.
```

## 1. Core Definition

An agent is anything that can receive influence, hold state, change behavior, or affect another thing in the field.

```txt
Agent = influence receiver + state holder + possible responder
```

A body is where influence originates.

A body can also be an agent.

## 2. Expanded Agent Model

```ts
type FieldAgent =
  | ParticleAgent
  | ElementAgent
  | RelationshipAgent
  | EventAgent
  | UserAgent
  | LayoutAgent
  | DataAgent;
```

| Agent type | Represents | Responds through |
|---|---|---|
| ParticleAgent | visual matter | velocity, heat, phase |
| ElementAgent | DOM element | CSS variables, transforms, events |
| RelationshipAgent | connection | tension, thickness, pulse, memory |
| EventAgent | behavior trigger | threshold event |
| UserAgent | pointer/focus/selection | wake, attention, memory |
| LayoutAgent | region/panel | spacing, grouping, ordering |
| DataAgent | semantic record | strength, category, state |

## 3. Shared Context Layer

Traditional UI state is local.

`field-ui` state is spatial, relational, and reciprocal.

Recommended positioning:

```txt
field-ui treats the interface as a shared context field, not a collection of isolated components.
```

## 4. Interaction as Continuity

Most UI interaction is binary.

`field-ui` can represent:

```txt
near
approaching
cooling
saturating
remembered
related
unstable
coherent
```

Recommended phrase:

```txt
field-ui gives interfaces a memory of approach, not just a record of clicks.
```

## 5. Attention as a Field

Attention is continuous before it is selected.

```txt
attention_i = density_i * engagement_i * relevance_i * visibility_i
```

Conserved attention mode:

```txt
Σ attention_i = A_total
```

Suggested DOM variables:

```css
--forces-attention
--forces-attention-share
--forces-attention-rank
--forces-related-attention
```

Key phrase:

```txt
Selection is a decision.
Attention is a field.
```

## 6. Attention vs Focus vs Selection

| State | Meaning | Field behavior |
|---|---|---|
| Attention | user is near or interested | density, glow, weak pull |
| Focus | user is actively navigating | accessible attention well |
| Selection | user has chosen | capture, lock, orbit |
| Memory | user has been here before | path trace, higher future gain |
| Relation | connected to what matters | secondary attention/thread |
| Confidence | system believes relevance | coherence |
| Priority | deserves emphasis | strength/rank |

## 7. RelationshipAgent

A relationship is not only an edge. It is a physical constraint with history.

```ts
type RelationshipAgent = {
  id: string
  from: BodyId
  to: BodyId
  type: string
  strength: number
  tension: number
  memory: number
  active: boolean
}
```

A relationship can:

```txt
pull
resist
decay
strengthen
route attention
carry memory
become a path
pulse with activity
```

Relationship types:

| Relationship | Physical behavior |
|---|---|
| parent/child | gravitational hierarchy |
| related content | elastic thread |
| dependency | directional tension |
| conflict | repulsion |
| sequence | stream/current |
| similarity | cohesion |
| history | memory path |
| active relation | pulsing field link |

## 8. UserAgent

```ts
type UserAgent = {
  pointer?: Vec2
  focus?: Element
  selection?: Element[]
  velocity?: Vec2
  memoryTrail?: ScalarGrid
  intent?: "browse" | "search" | "read" | "drag" | "select"
}
```

User signals:

| Signal | Field behavior |
|---|---|
| pointer | moving attractor / wake |
| pointer velocity | stream direction |
| hover | local attention |
| focus | accessible attention |
| selection | capture |
| drag | constraint + wake |
| scroll | current |
| edit | heat deposit |
| correction | memory overwrite |
| return visit | memory amplification |

## 9. Interaction Grammar

```txt
hover = local attention
focus = accessible attention
press = compression
drag = constraint + wake
scroll = current
select = capture
release = emission
search = scatter then converge
navigate = stream
return = memory
```

## 10. Pointer, Focus, and Accessibility

The system must not be pointer-only.

Focus is a first-class field source.

| Interaction | Field behavior |
|---|---|
| `hover` | local activation |
| `focus` | accessible attention well |
| `focus-visible` | visible field activation |
| `active` | compression/capture |
| `selected` | stable orbit/lock |
| `visited` | memory trace |
| `disabled` | screen/low response |
| `invalid` | entropy/warning heat |
| `loading` | stream/vortex/fieldflow |
| `success` | release |
| `error` | repel/thermal/pulse |

Reduced-motion fallback:

```txt
focus creates state, not travel
```

## 11. User Movement as Memory

```txt
M(x, y, t + dt) = M(x, y, t) * decay + userInputDeposit
```

Use cases:

```txt
cursor wake
reading trail
visited content paths
search refinement path
workflow routes
desire paths
```

Suggested outputs:

```css
--forces-memory
--forces-path-use
--forces-user-wake
```

## 12. Events as Field Thresholds

Events:

```txt
forces:entered
forces:exited
forces:lit
forces:dim
forces:saturated
forces:captured
forces:released
forces:attention-shifted
forces:relationship-strengthened
forces:memory-threshold
forces:entropy-warning
```

Rule:

```txt
Field events should be thresholded, debounced, and inspectable.
```

## 13. ElementAgent Responders

Possible outputs:

```css
--forces-density
--forces-attention
--forces-pressure
--forces-coherence
--forces-entropy
--forces-memory
--forces-pull-x
--forces-pull-y
--forces-layout-shift
```

Example:

```css
.card {
  transform:
    translate(
      calc(var(--forces-pull-x, 0) * 12px),
      calc(var(--forces-pull-y, 0) * 12px)
    )
    scale(calc(1 + var(--forces-attention, 0) * 0.04));
}
```

## 14. LayoutAgent

Layout can respond to field conditions.

```txt
spacing opens under pressure
related items cluster
unrelated items drift apart
active region gains z-depth
search results settle into relevance wells
dense sections create screen zones
overloaded regions dampen motion
```

Use sparingly. Prefer reversible, inspectable behavior.

## 15. DataAgent

Data records can become field agents.

| Data property | Field mapping |
|---|---|
| importance | strength |
| category | force token / color |
| recency | heat |
| confidence | coherence |
| uncertainty | entropy |
| relation count | range |
| status | phase |
| user interest | memory |
| priority | attention share |

> **Implemented.** `SEMANTIC_LAYERS` + `semanticToMetrics()` in `packages/core/src/semantic/layers.ts`
> map each meaning to its field metric.

## 16. Relationship Heatmaps

| Heatmap | Meaning |
|---|---|
| attention | where the user is focused |
| relation | linked content clusters |
| path | repeated movement |
| conflict | opposing forces |
| workload | interface density |
| comprehension | repeated docs/examples attention |
| conversion | CTA attention concentration |

## 17. Interface Weather

| Weather | Meaning | UI response |
|---|---|---|
| Calm | low entropy, low velocity | subtle particles |
| Focused | high attention, low entropy | clear emphasis |
| Turbulent | high entropy, high velocity | reduce motion/dampen |
| Dense | high concentration | open spacing/screen text |
| Charged | high heat/activity | highlight active state |
| Remembered | high memory | show paths/history |
| Critical | budget/energy threshold | reduce sources/warn |

## 18. Collaborative Fields

| User signal | Field behavior |
|---|---|
| cursor | moving attractor/wake |
| selection | attention well |
| edit | heat deposit |
| comment | anchored source |
| presence | aura |
| conflict | repulsion/entropy |
| agreement | coherence |
| handoff | stream |

## 19. Forms and Validation

| Form state | Field behavior |
|---|---|
| empty | low density |
| focused | attract |
| valid | coherence/glow |
| invalid | entropy/repel/heat |
| required | attention well |
| optional | lower strength |
| submitting | stream/fieldflow |
| success | release |
| error | thermal pulse |

## 20. Navigation as Current

| Navigation state | Field behavior |
|---|---|
| current page | attractor well |
| previous page | memory trail |
| next likely page | stream direction |
| related page | thread |
| breadcrumb | stable path |
| disabled route | screen |
| external link | emitter |

## 21. Search and Filtering

| Search signal | Field mapping |
|---|---|
| relevance | strength |
| exact match | attract |
| semantic match | cohesion |
| excluded result | repel |
| recent result | heat |
| clicked result | memory |
| category | formation |
| uncertainty | entropy |

Search can transition:

```txt
formation = scatter -> wells
```

## 22. Reading and Editorial Experiences

| Reading signal | Field behavior |
|---|---|
| viewport center | attention well |
| read paragraphs | memory trail |
| footnotes | threads |
| important terms | attractors |
| citations | link tension |
| unresolved concept | entropy |
| summary | coherence sink |

## 23. State Machines as Physical Scenes

Example:

```ts
type ButtonFieldState =
  | "idle"
  | "hovered"
  | "focused"
  | "pressed"
  | "loading"
  | "success"
  | "error"
```

| State | Field |
|---|---|
| idle | ambient |
| hovered | attract |
| focused | attract + feedback |
| pressed | absorb |
| loading | stream/vortex |
| success | release |
| error | repel + thermal |

> **Implemented.** `FieldState` + `FIELD_STATES` in `packages/core/src/semantic/states.ts`.

## 24. Interaction Materials

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

> **Implemented.** `INTERACTION_MATERIALS` + `materialBody()` in
> `packages/core/src/semantic/materials.ts`, composed from real force tokens.

## 25. Field Affordances

| Affordance | Field expression |
|---|---|
| clickable | weak attractor |
| draggable | spring/link response |
| related | thread or memory path |
| dangerous | heat/repel |
| completed | coherence |
| loading | stream |
| disabled | screened |
| selected | captured |
| recommended | attention well |
| historical | memory glow |

## 26. AI Interface Use Cases

| AI state | Field behavior |
|---|---|
| candidate answer | attractor |
| uncertainty | entropy |
| source support | relationship tension |
| contradiction | repulsion |
| user correction | memory overwrite |
| synthesis | cohesion |
| hallucination risk | instability/heat |
| verified claim | coherence |
| active generation | stream/fieldflow |

## 27. Explainable Interaction

The system should answer:

```txt
Why is this emphasized?
Why did this move?
Why are these connected?
Why did the page calm down?
Why did this warning appear?
```

Principle:

```txt
Every visible behavior should be traceable to a field cause.
```

## 28. Implementation Priority

```txt
1. Formal FieldAgent model
2. ElementAgent responder variables beyond density
3. RelationshipAgent model
4. Attention budget
5. UserAgent model for pointer/focus/selection
6. Thresholded field events
7. Relationship heatmaps
8. Navigation/search recipes
9. Form state recipes
10. Reading/editorial recipes
11. Collaborative presence experiments
12. AI state visualization recipes
```
