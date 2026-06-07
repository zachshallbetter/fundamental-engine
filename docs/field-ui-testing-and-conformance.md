# field-ui Testing and Conformance

## Related Documents

| Document | Role |
|---|---|
| [`README.md`](./README.md) | Documentation map |
| [`field-ui-system-contracts.md`](./field-ui-system-contracts.md) | Contract requirements |
| [`fundamental-field-behavior-table.md`](./fundamental-field-behavior-table.md) | Force law requirements |
| [`visualization-methods-taxonomy.md`](./visualization-methods-taxonomy.md) | Visualization tests |
| [`field-ui-authoring-and-recipes.md`](./field-ui-authoring-and-recipes.md) | Recipe tests |

## Purpose

Conformance makes the system credible.

Every force, field, visualization, source, sink, event, recipe, and agent behavior should declare what proves it works.

Core principle:

```txt
If it affects behavior, it needs conformance.
If it explains behavior, it needs truth-table classification.
```

## 1. Test Categories

```txt
force math tests
field geometry tests
field/apply separation tests
visualization side-effect tests
agent response tests
event threshold tests
accessibility tests
performance budget tests
snapshot regression tests
recipe conformance tests
Shadow DOM registration tests
reduced-motion tests
```

## 2. Force Passport Requirement

> **Implemented.** `ForcePassport` (`packages/core/src/contracts/passport.ts`) carries all of these
> fields — including `bestRenderModes` and `commonComposites` — and `conformanceTests(token)` derives
> the proof list from the live conformance catalog so it never drifts. `validatePassports()`
> cross-checks `family` / `klass` / `ownsField` against the registry + conformance.

Every force needs:

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

## 3. Required Magnetism Tests

```txt
neutral particle ignored
still charged particle unchanged
moving charged particle curves
force perpendicular to velocity
speed preserved before damping
charge reversal flips curvature
spin reversal flips curvature
no effect beyond range
magnetism does no work in ideal mode
```

Rule:

```txt
magnetism.apply() must remain Lorentz behavior.
```

## 4. Required Fieldflow Tests

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

Rule:

```txt
fieldflow carries matter along field geometry.
```

## 5. Field vs Apply Separation Tests

```txt
field lines trace field(), not apply()
force vectors reflect apply(), not field()
magnetism field lines differ from particle paths
fieldflow particle paths align with field lines
visualization does not alter physics
```

## 6. Visualization Tests

```txt
field line trace terminates correctly
streamlines respect vector field
force vectors use probes for velocity-dependent forces
heatmaps decay correctly
contours match scalar field levels
energy view does not mutate physics
debug overlays do not affect integration
prediction mode does not mutate live state
causality overlay matches force contribution
```

## 7. Agent Tests

### ElementAgent

```txt
receives density
receives attention
writes CSS variables
dispatches thresholded events
does not directly mutate particles unless also body
respects reduced motion
```

### RelationshipAgent

```txt
stores from/to bodies
renders relationship
transfers attention if configured
strengthens with use
decays over time
emits thresholded events
```

### UserAgent

```txt
pointer creates wake
focus creates accessible attention source
selection creates capture state
scroll creates current
reduced motion disables travel-heavy response
```

## 8. Event Tests

```txt
events are thresholded
events are debounced
events include useful detail payload
events do not fire every frame by default
events respect accessibility constraints
```

## 9. Source/Sink Tests

```txt
source has budget
source has max particles
source has particle life
source cannot create unbounded particles
sink has capacity
sink defines release behavior
sink emits saturation event
```

## 10. Accessibility Tests

> **Implemented.** A dedicated set in `packages/core/src/contracts/a11y.test.ts` covers the
> reduced-motion fallback (guard), meaning-without-motion (UserAgent keeps focus, drops travel;
> emission flattens), thresholded events (no per-frame spam), and color/glyph-not-sole-carrier (lint).

```txt
reduced motion fallback exists
meaning survives without motion
decorative fields can be hidden
interactive fields have labels
focus-visible works without pointer
field events do not spam assistive tech
```

## 11. Performance Tests

```txt
particle count stays within budget
body count stays within budget
field-line tracing is capped
heatmap resolution respects budget
debug overlays disabled in production preset
DPR is capped
local cells clean up observers and loops
```

## 12. Snapshot Regression

A snapshot should include:

```json
{
  "seed": 1234,
  "time": 4.2,
  "bodies": [],
  "agents": [],
  "particles": [],
  "metrics": {},
  "expected": {
    "particleCount": 600,
    "entropyRange": [0.1, 0.3],
    "energyDriftMax": 0.02
  }
}
```

Desired command:

```txt
forces test snapshot solar-prominence.json
```

## 13. Recipe Conformance

Every recipe should declare:

```txt
expected metrics
required forces
required render modes
accessibility behavior
performance budget
conformance scenario
```

Example:

```txt
Solar prominence:
- magnetism field lines visible
- fieldflow moves neutral matter along field
- magnetism alone does not move neutral matter
- heat remains bounded
- reduced mode shows static field lines
```

## 14. Lint Rules

```txt
Warning: magnetism without charged or moving particles may appear inactive.
Warning: fieldflow has no field source nearby.
Warning: source force has no budget.
Warning: local cell particle count too high.
Warning: field lines enabled but no field() hooks exist.
Warning: data-body="gravity attract" may duplicate pull behavior.
Warning: reduced motion fallback missing.
```

Severity levels:

```txt
info
warning
error
fatal
```

## 15. Acceptance Criteria

A feature is acceptable when:

```txt
it has a contract
it has a passport if force-like
it declares truth mode
it has tests
it has reduced-motion behavior if visual
it has performance budget impact
it has Inspector visibility
it has docs
it does not violate non-negotiables
```


## Migration Validation

The `force/` to `field-ui/` migration is complete when:

```txt
project runs from field-ui/
typecheck passes
test suite passes
Lab still runs
docs links resolve
examples use new naming
old public names still work as aliases
CSS variables write both old and new names
events support old and new names
package metadata uses field-ui
no hardcoded force/ path remains except migration notes
no accidental behavior changes occurred
magnetism tests still prove Lorentz behavior
fieldflow tests still prove field-aligned transport
```

Migration-specific test categories:

```txt
directory/path tests
package metadata tests
component alias tests
event alias tests
CSS variable alias tests
docs link tests
example compatibility tests
no behavior regression tests
```

Migration acceptance rule:

```txt
A rename is not complete until the old and new names both work.
```
