# field-ui Definition Document

## Related Documents

| Document | Role |
|---|---|
| [`README.md`](./README.md) | Documentation map and authority order |
| [`field-ui-system-contracts.md`](./field-ui-system-contracts.md) | Canonical contracts |
| [`fundamental-field-behavior-table.md`](./fundamental-field-behavior-table.md) | Field laws and `fieldflow` |
| [`field-ui-interaction-and-relationship-model.md`](./field-ui-interaction-and-relationship-model.md) | Agents beyond particles |
| [`visualization-methods-taxonomy.md`](./visualization-methods-taxonomy.md) | Visualization and diagnostics |
| [`field-ui-authoring-and-recipes.md`](./field-ui-authoring-and-recipes.md) | Authoring and recipes |
| [`field-ui-testing-and-conformance.md`](./field-ui-testing-and-conformance.md) | Testing and conformance |

## 1. Definition

`field-ui` is an inspectable field language for interfaces.

It turns DOM elements, custom components, data records, relationships, events, users, and layout regions into participants inside a shared reciprocal field. Those participants can emit fields, apply forces, guide matter, receive density, write state back to the DOM, trigger events, form relationships, and expose their behavior through visualization, metrics, and tests.

Core principle:

```txt
Elements bend the field.
The field bends them back.
```

`field-ui` is not a particle background.

It is a relational behavior layer for the web.

## 2. Interface Physics

Interface physics is the use of spatial, temporal, and relational forces to express state, meaning, attention, and interaction in a user interface.

```txt
HTML = structure
CSS = presentation
JavaScript = behavior
field-ui = relational behavior
```

`field-ui` maps semantic state to physical behavior and physical behavior to visual styling.

```txt
Data becomes force.
Force becomes motion.
Motion becomes metric.
Metric becomes style.
Style becomes meaning.
```

## 3. Core Thesis

Traditional UI state is local.

```txt
hover / not hover
focused / not focused
selected / not selected
open / closed
```

`field-ui` state is spatial, relational, and reciprocal.

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

The interface becomes a shared context layer. Components no longer behave only in isolation. Attention can transfer. Relationships can pull. Memory can accumulate. Data can become physical.

## 4. Foundational Loop

```txt
DOM body
  -> emits field / applies force
  -> moves or influences agents
  -> accumulates density, heat, memory, entropy, attention
  -> writes metrics back to DOM
  -> changes element style, behavior, or state
  -> reshapes the field
```

This loop is the core product.

## 5. What Counts as a Body

A body is a registered interface object that can originate influence or participate in the field.

A body may be:

```txt
HTML element
custom element host
Shadow DOM component
React-rendered node
canvas-local virtual body
data record
layout region
event sink
mark or glyph
relationship node
```

A body must expose:

```txt
identity
geometry or geometry provider
force attributes or registered behavior
field target
write-back target
debug metadata
conformance path
```

Default:

```txt
body = element.getBoundingClientRect()
```

For Shadow DOM:

```txt
body = custom element host
```

Presentation can be private. Physics must be public, registered, measurable, and testable.

## 6. What Counts as an Agent

An agent is anything that can receive influence, hold state, change behavior, or affect another thing in the field.

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

Particles are only one class of field participant.

Users, elements, relationships, events, layout, and data can also be agents.

See [`field-ui-interaction-and-relationship-model.md`](./field-ui-interaction-and-relationship-model.md).

## 7. Field vs Force

Every field-like behavior must separate structure from cause.

```txt
field(b, x, y) = invisible structure
apply(b, p, env) = actual effect
```

`field()` is used for:

```txt
field-line rendering
streamline tracing
heatmaps
Lab probes
fieldflow transport
debug overlays
topology analysis
```

`apply()` is used for:

```txt
velocity changes
acceleration
curvature
capture
binding
emission
decay
state change
heat
```

A field line is not always a particle path.

## 8. Electromagnetic Rule

The electromagnetic layer must keep three behaviors separate.

```txt
Electric fields push.
Magnetic fields bend.
Fieldflow carries.
```

Expanded:

```txt
Electric fields push charged matter along or against field lines.
Magnetic fields bend moving charged matter across field lines.
Fieldflow transports matter along field geometry.
```

Do not make `magnetism.apply()` follow magnetic field lines. Use `fieldflow` for solar prominences, auroras, plasma ribbons, and field-aligned transport.

See [`fundamental-field-behavior-table.md`](./fundamental-field-behavior-table.md).

## 9. Field Grammar

A `field-ui` scene is a sentence written in bodies, fields, forces, flows, metrics, renders, and feedback.

```txt
Body = where influence originates
Field = invisible structure
Force = how matter responds
Flow = how matter is transported
Metric = what the system measures
Render = how the invisible becomes visible
Feedback = how the field writes back to the DOM
```

Complete sentence:

```txt
Bodies emit fields.
Forces act on agents.
Flows transport matter along structure.
Metrics measure accumulation.
Renders reveal invisible state.
Feedback writes the field back into the interface.
```

## 10. Composition Laws

```txt
Fields superpose.
Forces accumulate.
Modifiers transform context.
Sources require budgets.
Metrics observe.
Renders do not mutate.
Feedback writes to DOM.
```

Execution order:

```txt
1. measure bodies
2. resolve conditions
3. build field context
4. apply modifiers
5. apply forces
6. apply transport
7. integrate particles
8. update scalar grids
9. sample metrics
10. write DOM feedback
11. render layers
```

## 11. Truth Modes

Every behavior should be classified by truth mode.

| Truth mode | Meaning | Examples |
|---|---|---|
| Physical truth | modeled after a real law | `gravity`, `charge`, `magnetism` |
| Designed truth | shaped for readable UI behavior | `attract`, `repel`, `spring` |
| Diagnostic truth | reveals internal state | force vectors, heatmaps, inspectors |
| Poetic truth | expressive composite from stable primitives | `blackhole`, `star`, `nebula` |
| Semantic truth | maps data/interface meaning into physics | attention, memory, relation fields |

This makes the project honest about which parts are physics, which are design, and which are expressive composites.

## 12. Visualization Grammar

Visualization is how the system explains itself.

```txt
Particles show matter.
Field lines show structure.
Force vectors show cause.
Trails show history.
Heatmaps show accumulation.
Contours show terrain.
Energy views show cost.
Topology shows relationships.
DOM state shows reciprocity.
```

See [`visualization-methods-taxonomy.md`](./visualization-methods-taxonomy.md).

## 13. Attention as a Field

Selection is a decision. Attention is a field.

Attention should be continuous before it becomes selected. It may be local, shared, or conserved.

```txt
Σ attention_i = A_total
```

When one element gains emphasis, others can surrender emphasis. This creates a spatial attention system rather than isolated hover states.

## 14. Relationships as Agents

A relationship is not only an edge. It is a physical constraint with history.

Relationships can:

```txt
pull
resist
decay
strengthen
route attention
carry memory
become paths
pulse with activity
```

See [`field-ui-interaction-and-relationship-model.md`](./field-ui-interaction-and-relationship-model.md).

## 15. Authoring Levels

| Level | User | API |
|---|---|---|
| Level 1 | designer | intents and presets |
| Level 2 | developer | `data-body`, render modes, recipes |
| Level 3 | engine author | custom `field()` / `apply()` / conformance |

See [`field-ui-authoring-and-recipes.md`](./field-ui-authoring-and-recipes.md).

## 16. World Model Diagram

```txt
DOM bodies
   -> field()
Field structure
   -> fieldflow / visualization
Agents
   -> density / metrics
Scalar grids
   -> sample
CSS variables + events
   -> DOM bodies
```

## 17. Design Philosophy

```txt
1. State should be spatial when relationships matter.
2. Motion should be caused, not decorative.
3. Visualizations should reveal truth, not invent it.
4. Field lines are structure, not always paths.
5. Attention is continuous before it is selected.
6. Relationships are active agents.
7. Meaning should survive reduced motion.
8. Every source needs a budget.
9. Every force needs a passport.
10. Every visible behavior should be explainable.
```

## 18. Final Definition

`field-ui` is an inspectable field language for interfaces.

It is built from:

```txt
bodies
agents
fields
forces
flows
metrics
renders
feedback
contracts
conformance
```

It is a way to make interface meaning physical, measurable, inspectable, and composable.

Final operating principle:

```txt
field() is structure.
apply() is cause.
fieldflow carries matter along structure.
agents respond to influence.
metrics measure accumulation.
renders reveal invisible state.
feedback returns the field to the DOM.
```
