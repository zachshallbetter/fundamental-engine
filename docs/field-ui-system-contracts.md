# field-ui System Contracts

## Related Documents

| Document | Role |
|---|---|
| [`README.md`](./README.md) | Documentation map |
| [`field-ui-definition-document.md`](./field-ui-definition-document.md) | Canonical definition |
| [`fundamental-field-behavior-table.md`](./fundamental-field-behavior-table.md) | Field/force laws |
| [`field-ui-interaction-and-relationship-model.md`](./field-ui-interaction-and-relationship-model.md) | Agent model |
| [`visualization-methods-taxonomy.md`](./visualization-methods-taxonomy.md) | Render contracts |
| [`field-ui-testing-and-conformance.md`](./field-ui-testing-and-conformance.md) | Test contracts |

## Purpose

This document defines the hard contracts that bind the system together.

Contracts answer:

```txt
What must exist?
What may mutate state?
What must remain side-effect free?
What must be testable?
What must be inspectable?
```

## 1. Body Contract

A body is a registered origin of influence or field participation.

A body must expose:

```txt
id
element or virtual owner
geometry provider
field target
write-back target
force tokens or behavior registration
visibility state
debug metadata
lifecycle hooks
```

Required geometry:

```ts
type BodyGeometry = {
  cx: number
  cy: number
  hw: number
  hh: number
  rect: DOMRect
}
```

Default measurement:

```txt
element.getBoundingClientRect()
```

Shadow DOM rule:

```txt
Presentation may be private.
Physical participation must be public.
```

The default registered body is the custom element host.

## 2. Field Contract

A field is invisible structure.

```ts
type FieldFn = (body: Body, x: number, y: number, env: Env) => Vec2 | ScalarField | CompoundField | null
```

A field function must:

```txt
be side-effect free
return stable values for a fixed state
not mutate particles
not mutate bodies
be traceable for rendering when applicable
declare whether it is vector, scalar, or compound
```

Field functions may be used by:

```txt
field lines
streamlines
heatmaps
fieldflow
Lab probes
debug overlays
topology analysis
```

## 3. Force Contract

A force is cause.

```ts
type ApplyFn = (body: Body, particle: Particle, env: Env, dt: number) => void
```

A force may mutate:

```txt
particle velocity
particle heat
particle phase
particle capture state
particle identity
particle life
```

A force must declare:

```txt
whether it owns field()
whether it uses env.fieldAt()
whether it does work
whether it requires charge
whether it requires velocity
whether it affects neutral matter
whether it conserves speed
whether it creates or destroys matter
what conformance tests prove it
```

Every force needs a passport.

## 4. Transport Contract

A transport primitive moves matter along field geometry or routes influence through a structure.

`fieldflow` is the canonical transport primitive.

Rules:

```txt
Transport may do work.
Transport may use env.fieldAt().
Transport must not replace the physical law of another force.
Transport must declare whether it acts on neutral matter.
Transport must define behavior for zero field.
Transport must define range behavior.
```

Critical rule:

```txt
magnetism.apply() must remain Lorentz curvature.
fieldflow carries matter along magnetic geometry when needed.
```

## 5. Agent Contract

An agent is anything that can receive influence, hold state, change behavior, or affect another thing.

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

Every agent type must define:

```txt
identity
state
inputs
outputs
what influence it accepts
what metrics it emits
what visualizations apply
what events it can dispatch
what tests apply
```

## 6. ElementAgent Contract

An ElementAgent receives field metrics and writes DOM state.

Inputs:

```txt
density
attention
heat
entropy
coherence
memory
pressure
pull-x
pull-y
relationship strength
```

Outputs:

```txt
CSS variables
data attributes
thresholded events
debug metadata
```

Suggested CSS variables:

```css
--forces-density
--forces-attention
--forces-heat
--forces-entropy
--forces-coherence
--forces-memory
--forces-pressure
--forces-pull-x
--forces-pull-y
```

ElementAgents should not directly mutate particle state unless they are also registered bodies.

## 7. RelationshipAgent Contract

A RelationshipAgent represents an active connection.

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

A relationship may:

```txt
pull bodies
transfer attention
display tension
carry memory
strengthen or decay
emit threshold events
```

A relationship is not merely a rendered line.

## 8. UserAgent Contract

A UserAgent represents user input as field participation.

Inputs:

```txt
pointer position
pointer velocity
focus target
selection
scroll direction
interaction intent
memory trail
```

UserAgent behavior must respect:

```txt
reduced motion
keyboard accessibility
privacy
pointer absence
touch input
assistive technology
```

Focus must be a first-class field source.

## 9. Event Contract

Field events must be thresholded, debounced, and inspectable.

Allowed event types:

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

Rules:

```txt
No noisy per-frame DOM events by default.
Events must include useful detail payloads.
Events must be traceable to field metrics.
Events must respect accessibility.
```

## 10. Feedback Contract

Feedback writes field state back to DOM.

Feedback may mutate:

```txt
CSS variables
data-state attributes
ElementInternals state
controlled events
```

Feedback must not:

```txt
break readability
require motion for meaning
spam assistive tech
depend on inaccessible pointer-only behavior
```

## 11. Visualization Contract

Visualization layers reveal state.

They must not mutate physics unless explicitly declared as feedback.

| Visualization | Reads from | Mutates physics? |
|---|---|---:|
| Field lines | `field()` | no |
| Force vectors | `apply()` or probe | no |
| Trails | particle history | no |
| Heatmaps | scalar grids | optional |
| Energy | particle + field state | no |
| Topology | relationship agents | optional |
| DOM state | feedback variables | visually yes |

If a visualization mutates state, it must be reclassified as feedback or force behavior.

## 12. Source/Sink Contract

Any source or sink must be budgeted.

A source must define:

```txt
spawn rate
maximum particles
particle life
energy budget
cooldown
visibility behavior
reduced-motion behavior
```

A sink must define:

```txt
capacity
release behavior
destroy vs capture semantics
saturation threshold
events
```

No unbounded creation.

## 13. Scene Recipe Contract

A recipe is a portable scene or behavior definition.

Required fields:

```txt
name
intent
bodies
agents
forces
render layers
metrics
accessibility behavior
performance budget
expected conformance
notes
```

Recipes must be serializable and inspectable.

## 14. Accessibility Contract

```txt
Motion is optional.
Meaning is never motion-only.
Density feedback must not be required to read content.
Reduced motion swaps travel for state.
Field events should not spam assistive tech.
Decorative fields may be hidden.
Interactive fields need labels.
```

Reduced fallback examples:

| Full mode | Reduced mode |
|---|---|
| particles travel | particles freeze or fade |
| sparks | static highlight |
| fieldflow ribbons | static field lines |
| heat trails | soft wash |
| body motion | CSS state only |
| turbulence | contour snapshot |

## 15. Performance Contract

Every field should have a budget.

Suggested defaults:

```txt
Particles: 600 max default
Bodies: 80 max default
Local cells: 3 active max
Field-line traces: capped by viewport
Heatmap resolution: 4-8 px/cell
Debug overlays: disabled in production
DPR: capped at 2
```

Suggested type:

```ts
type FieldBudget = {
  particles: number
  bodies: number
  localCells: number
  fieldLines: number
  heatmapResolution: number
  dprCap: number
}
```

## 16. Conformance Contract

Every new force, render mode, agent type, source/sink, and recipe must define proof.

Proof may include:

```txt
golden math test
behavioral scenario
snapshot regression
accessibility test
performance budget test
side-effect test
event threshold test
reduced-motion test
```

Core rule:

```txt
If it affects behavior, it needs conformance.
If it explains behavior, it needs truth-table classification.
```

## 17. Error Taxonomy

Named errors:

| Error | Meaning |
|---|---|
| `NO_FIELD_SOURCE` | `fieldflow` has nothing to follow |
| `UNBUDGETED_SOURCE` | source lacks cap or life |
| `UNSTABLE_ENERGY` | energy grows beyond threshold |
| `NAN_PARTICLE` | invalid particle state |
| `SHADOW_BODY_UNMEASURABLE` | body has no valid rect |
| `MISSING_REDUCED_MOTION` | no accessible fallback |
| `VISUALIZATION_MUTATES_PHYSICS` | debug/render layer has side effects |

## 18. Agent Non-Negotiables

```txt
Never change magnetism.apply() to follow field lines.
Use fieldflow for field-aligned transport.
Visualization layers must not mutate physics unless declared.
Sources require budgets.
Every new force requires conformance.
Every field-like force should define field() if it can be visualized.
Every force doc needs a passport.
Every render mode needs a truth table entry.
Every source/sink must be budgeted.
Every Shadow DOM body must be registered, measurable, and testable.
Every visible behavior should be traceable to a field cause.
```


## 19. Visual Language Contract

The visual language system is defined in [`field-ui-visual-language-and-geometry.md`](./field-ui-visual-language-and-geometry.md).

Rules:

```txt
Visual form can become geometry.
Semantic meaning must remain accessible.
Field state can shape appearance.
Appearance must not corrupt the field.
Core implementation should use fundamental platform APIs without dependencies.
```

Every visual layer must declare:

```txt
source metrics
target properties
whether it mutates physics
whether it writes DOM state
reduced-motion behavior
accessibility fallback
performance cost
debug visibility
```

Typography rule:

```txt
The visual layer may be vectorized, distorted, animated, or custom-rendered.
The semantic layer should remain real HTML text.
```


## Migration and Alias Contract

During the `force/` to `field-ui/` migration, old and new public names must both resolve to the same behavior.

CSS write-back should emit both:

```txt
--field-density
--forces-density
--field-heat
--forces-heat
--field-entropy
--forces-entropy
--field-coherence
--forces-coherence
--field-attention
--forces-attention
```

Events should support both:

```txt
field:register-body
forces:register-body
field:unregister-body
forces:unregister-body
field:lit
forces:lit
```

Component aliases should register the same body contract.

Aliases may be deprecated only after:

```txt
docs are updated
tests pass
examples use new names
migration notes identify the removal version
```

Do not remove old names in the same pass that introduces new names.


## Visual Language Contract

The visual language system is defined in [`field-ui-visual-language-and-geometry.md`](./field-ui-visual-language-and-geometry.md).

Rules:

```txt
Visual form can become geometry.
Semantic meaning must remain accessible.
Field state can shape appearance.
Appearance must not corrupt the field.
Core implementation should use fundamental platform APIs without dependencies.
```

Every visual layer must declare:

```txt
source metrics
target properties
whether it mutates physics
whether it writes DOM state
reduced-motion behavior
accessibility fallback
performance cost
debug visibility
```

Typography rule:

```txt
The visual layer may be vectorized, distorted, animated, or custom-rendered.
The semantic layer should remain real HTML text.
```
