# field-ui Migration Plan

## Related Documents

| Document | Role |
|---|---|
| [`README.md`](./README.md) | Documentation map and authority order |
| [`field-ui-system-contracts.md`](./field-ui-system-contracts.md) | Contracts that must remain true during migration |
| [`field-ui-testing-and-conformance.md`](./field-ui-testing-and-conformance.md) | Migration validation and acceptance criteria |
| [`agent-handoff-fieldflow-visualization.md`](./agent-handoff-fieldflow-visualization.md) | Agent implementation handoff |

## Purpose

Move the current project from the existing `force/` directory into a cleaned, canonical `field-ui/` directory.

This is not a full rewrite.

The current work already contains the core reciprocal field engine, force registry, field hooks, field lines, heatmaps, fieldflow, Shadow DOM participation model, conformance tests, and roadmap direction. The migration should preserve that foundation while renaming, reorganizing, and expanding the system into a field-first interface physics framework.

Core change:

```txt
force / forces-ui = force-first reciprocal field engine
field-ui = field-first interface physics system
```

## Guiding Principle

```txt
This is a migration and cleanup, not a rewrite.
Preserve behavior first.
Rename and alias second.
Expand the field-ui model third.
```

## 1. Directory Migration

Move the working project from:

```txt
force/
```

to:

```txt
field-ui/
```

Recommended target structure:

```txt
field-ui/
  packages/
    core/
    react/
    web-components/
    docs/
    lab/
  apps/
    site/
    playground/
  docs/
    README.md
    field-ui-definition-document.md
    field-ui-system-contracts.md
    fundamental-field-behavior-table.md
    visualization-methods-taxonomy.md
    field-ui-interaction-and-relationship-model.md
    field-ui-visual-language-and-geometry.md
    field-ui-authoring-and-recipes.md
    field-ui-testing-and-conformance.md
    field-ui-worldclass-next-layer.md
    field-ui-migration-plan.md
    agent-handoff-fieldflow-visualization.md
  tests/
  examples/
  scripts/
```

The exact structure may adapt to the existing repository, but the cleaned project should separate:

```txt
engine
framework adapters
web components
site/lab
docs
tests
examples
scripts
```

## 2. Naming Policy

Use `field-ui` for:

```txt
directory
project name
package family
documentation set
public product name
```

Use singular `field` for runtime concepts:

```txt
field state
field root
field body
field event
field metric
field density
field heat
```

This avoids awkward runtime names such as `--fields-density`.

## 3. Rename and Alias Strategy

Do not break current behavior while renaming.

Add new names first. Keep old names as aliases until tests prove compatibility.

| Current | New | Compatibility |
|---|---|---|
| `force/` | `field-ui/` | hard directory move |
| `forces-ui` | `field-ui` | rename public framing |
| `@forces-ui/core` | `@field-ui/core` | alias old package if needed |
| `<forces-field>` | `<field-root>` or `<field-field>` | keep alias |
| `<forces-cell>` | `<field-cell>` | keep alias |
| `<forces-body>` | `<field-body>` | keep alias |
| `<forces-text>` | `<field-text>` | keep alias |
| `forces:register-body` | `field:register-body` | dispatch/listen to both during transition |
| `forces:unregister-body` | `field:unregister-body` | dispatch/listen to both |
| `forces:lit` | `field:lit` | dispatch/listen to both |
| `--forces-density` | `--field-density` | write both during transition |
| `--forces-heat` | `--field-heat` | write both |
| `--forces-entropy` | `--field-entropy` | write both |
| `--forces-coherence` | `--field-coherence` | write both |
| `--forces-attention` | `--field-attention` | write both |
| `data-body` | `data-body` | keep unchanged |
| `data-when` | `data-when` | keep unchanged |
| `data-feedback` | `data-feedback` | keep unchanged |
| `data-field-*` | `data-field-*` | keep and expand |

Do not rename `data-body`. A body participates in a field, so the name remains correct.

## 4. Compatibility Rule

```txt
The field-ui migration should add the new public surface before removing the old one.
Old forces-ui names should remain as aliases until tests prove the new names work across core, web components, React, docs, Lab, and examples.
```

Do not remove old names in the same pass that introduces new names.

## 5. Preserve Existing Core

Preserve:

```txt
reciprocal DOM-field loop
force registry
force tokens
field() hook
apply() hook
field lines
shaped fields
heatmaps
fieldflow
particles/elements/events as targets
Shadow DOM host registration
conformance-first tests
source/sink budgets
density write-back
Lab/conformance behavior
```

These are not being discarded. They are being reorganized under a stronger field-first system.

## 6. Promote the Field as Primary Abstraction

The current system is organized around force tokens and force behavior. The new system should make the field the primary concept.

Core contracts:

```txt
field(b, x, y) = invisible structure
apply(b, p, env) = actual cause/effect
feedback = field state written back to DOM
render = visual explanation of invisible state
```

A force may own a field.

A field may be visualized.

A field may be sampled.

A field may be used by `fieldflow`.

A field line is not always a particle path.

## 7. Keep Electromagnetism Correct

Required rule:

```txt
Electric fields push.
Magnetic fields bend.
Fieldflow carries.
```

Implementation distinction:

```txt
charge.apply() = F = qE
magnetism.apply() = F = q(v × B)
fieldflow.apply() = steer and accelerate along env.fieldAt()
```

Do not implement:

```txt
magnetism.apply() = follow magnetic field lines
```

That behavior belongs to `fieldflow`.

## 8. Elevate fieldflow

`fieldflow` already exists in the current work and should remain separate from magnetism.

In `field-ui`, treat `fieldflow` as a core transport primitive.

Definition:

```txt
fieldflow is field-aligned transport.
It does not define a fundamental field.
It reads existing field geometry and carries matter along it.
```

Use it for:

```txt
solar prominences
aurora ribbons
plasma streams
guided matter
relationship currents
semantic flow
```

## 9. Expand the Agent Model

The current target model should become a formal `FieldAgent` model.

Recommended type:

```ts
type FieldAgent =
  | ParticleAgent
  | ElementAgent
  | RelationshipAgent
  | EventAgent
  | UserAgent
  | LayoutAgent
  | DataAgent
  | ContainerAgent
  | MediaAgent;
```

Build from the existing target model rather than replacing it.

## 10. Add the Visual Language Layer

Formalize a complete visual language layer covering:

```txt
fonts
color
hue
saturation
tone
alpha
shape
distance
pattern
emission
containers
materials
icons
media surfaces
visual semantics
accessibility fallback
```

Dependency rule:

```txt
Use fundamental platform APIs first.
Do not depend on external libraries for core behavior.
```

Preferred APIs:

```txt
HTML
CSS
SVG
Canvas 2D
Custom Elements
Shadow DOM
Pointer Events
Keyboard Events
Focus Events
ResizeObserver
IntersectionObserver
CSS Custom Properties
Web Animations API
requestAnimationFrame
```

## 11. Preserve Semantic Text

Rule:

```txt
The visual layer can be vectorized, distorted, animated, shader-rendered, or custom-rendered.
The semantic layer should remain real HTML text.
```

Recommended pattern:

```html
<h1 class="field-title">
  <span class="sr-only">The actual accessible heading text</span>
  <svg aria-hidden="true" focusable="false">
    <!-- expressive glyph paths -->
  </svg>
</h1>
```

Do not make SVG or Canvas glyphs the only source of meaning.

Do not modify or redistribute commercial font data unless the license permits it.

## 12. Formalize Contracts

Use contracts as the organizing structure:

```txt
Body Contract
Field Contract
Force Contract
Transport Contract
Agent Contract
ElementAgent Contract
RelationshipAgent Contract
UserAgent Contract
Event Contract
Feedback Contract
Visualization Contract
Visual Language Contract
Source/Sink Contract
Scene Recipe Contract
Accessibility Contract
Performance Contract
Conformance Contract
```

Each contract answers:

```txt
What must exist?
What may mutate state?
What must remain side-effect free?
What must be testable?
What must be inspectable?
```

## 13. Cleanup Policy

Cleanup is allowed for:

```txt
stale docs
duplicate specs
dead examples
broken links
inconsistent naming
orphaned demos
unused generated files
old package references after aliases exist
tests that no longer map to active contracts
hardcoded force/ paths
hardcoded forces-ui product strings
```

Cleanup is not allowed for:

```txt
force tokens
conformance tests
compatibility aliases
data-body authoring
field() / apply() behavior
fieldflow
Shadow DOM registration
density write-back
source/sink budgeting
magnetism behavior
integrator behavior
```

## 14. Do Not Touch Yet

Do not change during the initial directory migration:

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

First stabilize naming and structure. Deeper field-ui expansions can follow.

## 15. Alias Implementation Contract

During migration, old and new public names must both resolve to the same behavior.

CSS write-back should emit both:

```txt
--field-density
--forces-density
```

Events should support both:

```txt
field:register-body
forces:register-body
```

Component aliases should register the same body contract.

Aliases may be deprecated only after:

```txt
docs are updated
tests pass
examples use new names
migration notes identify the removal version
```

## 16. Migration Phases

### Phase 1: Move and Stabilize

```txt
copy force/ -> field-ui/
preserve tests
preserve current behavior
update package names where safe
add aliases
verify typecheck
verify tests
```

### Phase 2: Rename Public Surface

```txt
add field-ui naming
add field:* event aliases
add --field-* CSS variable aliases
add field component aliases
update docs references
keep old names working
```

### Phase 3: Refactor Documentation

```txt
install connected docs
make README the map
make migration plan authoritative for move
make system contracts authoritative for implementation
link field laws, visualization, interaction, visual language, authoring, testing
remove duplicate or stale documents
```

### Phase 4: Formalize Contracts

```txt
Body Contract
Field Contract
Force Contract
Agent Contract
Visualization Contract
Feedback Contract
Recipe Contract
Conformance Contract
Visual Language Contract
```

### Phase 5: Expand Agents

```txt
ElementAgent variables beyond density
RelationshipAgent
UserAgent
LayoutAgent
DataAgent
ContainerAgent
MediaAgent
thresholded EventAgent
```

### Phase 6: Visual Language

```txt
typography mapping
color mapping
shape mapping
distance/falloff mapping
pattern mapping
emission mapping
container roles
surface materials
semantic text fallback
visual lint rules
```

### Phase 7: Authoring and Recipes

```txt
SceneRecipe schema
VisualizationPreset schema
Intent compiler
Recipe Gallery
Composer
Explain This Field
Field Diff
```

### Phase 8: Testing and Productization

```txt
snapshot regression
accessibility preview
performance budget inspector
agent report
product surfaces
migration report
```

## 17. Migration Validation Checklist

Migration is complete when:

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

## 18. What Not to Do

Do not:

```txt
rebuild the engine from scratch
break data-body authoring
remove force tokens prematurely
make magnetism follow field lines
make visual layers mutate physics
make SVG/Canvas text the only semantic text
introduce runtime dependencies for core behavior
delete old names before aliases exist
ship unbudgeted sources
ship events that fire every frame by default
```

## 19. Final Agent Instruction

Your task is not to redesign the engine.

Your task is to move `force/` to `field-ui/`, update naming, preserve behavior, add compatibility aliases, clean stale docs, and verify the existing conformance suite.

Then and only then, begin the broader field-ui expansion work.
