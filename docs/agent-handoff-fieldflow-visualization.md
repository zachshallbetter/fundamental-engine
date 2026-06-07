# Agent Handoff: Connected field-ui Refactor

## Purpose

This brief tells an implementation agent how to treat the refactored document set.

Do not treat the files as separate idea dumps. Treat them as a connected specification.

Start with:

1. [`README.md`](./README.md)
2. [`field-ui-system-contracts.md`](./field-ui-system-contracts.md)
3. [`field-ui-definition-document.md`](./field-ui-definition-document.md)

Then use the domain-specific documents as needed.

## Authority Order

When instructions conflict:

```txt
1. field-ui-system-contracts.md
2. field-ui-definition-document.md
3. fundamental-field-behavior-table.md
4. field-ui-testing-and-conformance.md
5. this handoff
```

## Core Non-Negotiables

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

## Core Model

```txt
field(b, x, y) = invisible structure
apply(b, p, env) = actual cause/effect
```

A field line is not always a particle path.

## Electromagnetic Rule

```txt
Electric fields push.
Magnetic fields bend.
Fieldflow carries.
```

Required implementation distinction:

```txt
magnetism.field() = renderable magnetic structure
magnetism.apply() = Lorentz curvature, no work
fieldflow.apply() = field-aligned transport, does work
```

Do not implement:

```txt
magnetism.apply() = follow magnetic field lines
```

## Agent Model

Particles are only one class of participant.

Implement toward:

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

Prioritize:

```txt
1. ElementAgent responder variables beyond density
2. RelationshipAgent model
3. UserAgent model for pointer/focus/selection
4. Attention budget
5. Thresholded field events
6. Relationship heatmaps
```

## Visualization Model

Visualization layers reveal state.

They must not mutate physics unless explicitly declared as feedback.

Required layers:

```txt
field-lines
force-vectors
trails
heatmap
energy
topology
dom-state
causality
prediction
```

## Probe Modes

Add probes as Lab instruments.

```txt
neutral probe
positive charge probe
negative charge probe
still charged probe
fast probe
hot probe
massive probe
paired probes
probe sheet
```

## Force Passports

Every force must have:

```txt
Token:
Category:
Truth mode:
Owns field():
Uses env.fieldAt():
Moves particles:
Does work:
Conserves speed:
Requires charge:
Requires velocity:
Affects neutral matter:
Can be visualized as field lines:
Can be visualized as force vectors:
Best render modes:
Conformance tests:
Common composites:
Design use:
Physics note:
```

## Build Order

Implement in this order:

```txt
1. System contracts and type surfaces
2. Force passport metadata
3. Field/apply separation tests
4. Field lines from every field() hook
5. Probe modes
6. Force vectors through probes
7. Density/heat/attention heatmaps
8. Energy/conservation dashboard
9. ElementAgent responder variables
10. RelationshipAgent model
11. UserAgent model
12. Thresholded field events
13. Reciprocity Inspector
14. SceneRecipe schema
15. Authoring lint rules
16. Snapshot regression
17. Field intent compiler
18. Explain This Field
19. Field Diff
20. Product surfaces
```

## Required Lab Comparisons

| Scenario | Expected behavior |
|---|---|
| `charge` only | charged particles move along or opposite electric field |
| `magnetism` only | moving charged particles curve; speed mostly preserved |
| `fieldflow` only | neutral matter streams along rendered field |
| `magnetism + fieldflow` | particles follow magnetic geometry while also curving under Lorentz force |
| `charge + magnetism` | electromagnetic spiral/arc behavior |
| `charge + magnetism + fieldflow` | plasma-like routed flow with electric acceleration and magnetic curvature |

## Required Conformance Tests

### Magnetism

```txt
neutral particle ignored
still charged particle unchanged
moving charged particle curves
force perpendicular to velocity
speed preserved before damping
charge reversal flips curvature
spin reversal flips curvature
no effect beyond range
```

### Fieldflow

```txt
neutral matter moves
fieldflow does work
zero field produces no motion
charge field routes matter radially
magnetic field routes matter along loops
beyond range produces no effect
range 0 uses global field
net field superposition routes between bodies
```

### Visualization

```txt
field lines trace field(), not apply()
force vectors reflect apply(), not field()
magnetism field lines differ from particle paths
fieldflow particle paths align with field lines
heatmap values decay correctly
energy view does not mutate physics
debug overlays do not affect integration
```

### Agents

```txt
ElementAgent writes CSS variables
RelationshipAgent carries tension/memory
UserAgent focus works without pointer
events are thresholded/debounced
reduced motion fallback exists
```

## Final Agent Instruction

Keep the system honest:

```txt
field() is structure.
apply() is cause.
fieldflow carries matter along structure.
agents respond to influence.
metrics measure accumulation.
renders reveal invisible state.
feedback returns the field to the DOM.
```

Do not make every field line a path.

Do not make magnetism transport matter along magnetic loops.

Use `fieldflow` when the design wants field-aligned plasma, aurora, solar prominence, or routed matter.

Use visualization layers to explain, debug, and compose the field without corrupting the underlying force laws.

## Directory Migration Work Order

Move the project from:

```txt
force/
```

to:

```txt
field-ui/
```

This is not a rewrite.

Task order:

```txt
1. Copy/move force/ to field-ui/
2. Preserve current tests and behavior
3. Add field-ui naming
4. Add aliases for old field-ui names
5. Update package metadata where safe
6. Update docs and links
7. Clean stale docs and duplicate specs
8. Run typecheck
9. Run test suite
10. Verify Lab
11. Produce migration report
```

Do not change yet:

```txt
magnetism behavior
fieldflow behavior
force formulas
integrator behavior
conformance expectations
force token names
data-body authoring
render math
heatmap math
Shadow DOM event model
```

The immediate goal is a clean `field-ui/` project root with compatibility aliases and no behavior regressions.

## Migration-Specific Handoff

Your task is not to redesign the engine.

Your task is to move `force/` to `field-ui/`, update naming, preserve behavior, add compatibility aliases, clean stale docs, and verify the existing conformance suite.

Work order:

```txt
1. Copy or move force/ to field-ui/.
2. Preserve current behavior and tests.
3. Add field-ui naming.
4. Add field:* event aliases while keeping forces:*.
5. Add --field-* CSS variables while keeping --forces-*.
6. Add component aliases.
7. Update docs and examples.
8. Clean stale names only after aliases exist.
9. Run typecheck and tests.
10. Produce a migration report.
```

Do not change yet:

```txt
magnetism behavior
fieldflow behavior
force formulas
integrator behavior
conformance expectations
force token names
data-body authoring
render math
heatmap math
Shadow DOM event model
```

Non-negotiable:

```txt
This is a migration and cleanup, not a rewrite.
Preserve behavior first.
Rename and alias second.
Expand the field-ui model third.
```
