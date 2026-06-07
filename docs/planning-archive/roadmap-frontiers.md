# Roadmap Frontiers

> Status: planning / roadmap.  
> This document describes forward-looking implementation frontiers for field-ui. It is not the current implementation contract. Current source-of-truth behavior lives in the package code, conformance tests, and canonical docs.
>
> Use this document to plan future work, sequence frontier investments, and preserve the product thesis without confusing proposed work for shipped behavior.
>
> **Shipped since this roadmap was drafted.** Stage E and most of Stage F have landed:
> **R1 Runtime platform unification** (Phase D — the platform runtime is the `<field-root>` default),
> **R2 Platform Inspector** (`/docs/inspector` reads the live registries, [#198](https://github.com/zachshallbetter/field-ui/pull/198)),
> **R3 First-class recipe system** ([#197](https://github.com/zachshallbetter/field-ui/pull/197)/[#201](https://github.com/zachshallbetter/field-ui/pull/201) — `FieldRecipe`, the 64-recipe catalog),
> **R4 Executable Recipe Gallery** ([#199](https://github.com/zachshallbetter/field-ui/pull/199)/[#201](https://github.com/zachshallbetter/field-ui/pull/201)), and a vocabulary-lane taxonomy pass ([#200](https://github.com/zachshallbetter/field-ui/pull/200)–[#204](https://github.com/zachshallbetter/field-ui/pull/204)).
> The near-term priority below is therefore mostly **done**; the live frontier starts at **R5 (bindData)
> / R6 (input agents) / R7 (accessibility conformance) / R14 (AI evidence fields)**.

## 0. Purpose

field-ui has moved beyond a particle-field prototype.

The current architecture is:

```txt
field-ui   host-driven, renderer-agnostic field engine
@field-ui/platform   browser host, DOM participation, measurement, state, feedback,   relationships, visual bindings, overlays, scheduling, linting
@field-ui/elements   native HTML and web component authoring
@field-ui/react   React adapter over the same contracts
site/docs/lab   proof surfaces, recipes, diagnostics, demos, and executable documentation
```

This roadmap describes what comes after that architecture.

The central goal is not to add visual effects.

The goal is to make field-ui a complete relational behavior runtime for interfaces: portable, inspectable, accessible, data-driven, recipe-driven, and scalable.

## 1. Current doctrine

The following principles govern every frontier.

### 1.1 Core stays renderer-agnostic

field-ui must not import browser or DOM globals.

Core owns:

```txt
field math force behavior particle state diagnostics math conformance scenarios portable host contracts
```

Platform owns:

```txt
browserHost() DOM export helpers measurement state feedback relationships visual bindings overlays scheduler linting
```

The public browser setup should look like:

```ts
import { createField } from "field-ui";
import { browserHost } from "@field-ui/platform";

const field = createField(canvas, {
  host: browserHost()
});
```

Elements and adapters may hide this setup for users.

### 1.2 Canvas is one render surface

Do not describe field-ui as only:

```txt
one canvas
one particle field
a particle background
DOM <-> canvas binding
```

Use:

```txt
field-ui is a platform-native relational field runtime for the DOM.
```

Canvas is one render surface. SVG overlays, DOM feedback, diagnostics, and platform state are also render or feedback surfaces.

### 1.3 Natural fields are conceptual

The natural model is:

```txt
Gravity -> priority, convergence, hierarchy
Electromagnetic -> polarity, signal, field lines, flow
Strong -> binding, cohesion, structure
Weak -> transformation, decay, release
```

Engine primitives are translations.

Canonical UI forces remain designed verbs.

attract is not gravity.  
repel is not charge.  
fieldflow is transport.  

Preserve the electromagnetic rule:

```txt
Electric fields push.
Magnetic fields bend.
Fieldflow carries.
```

### 1.4 Verification is mandatory

Every frontier must define how it will be tested.

Required verification types:

```txt
unit tests
golden tests
conformance scenarios
browser previews where visual
reduced-motion checks where interactive
performance checks where runtime-sensitive
link/docs checks where documentation-facing
```

New behavior should not ship because it looks right. It ships when tests, diagnostics, and demos prove it.

### 1.5 Accessibility is not optional

No field behavior may be the only source of meaning.

Every motion-heavy recipe or render surface must have:

```txt
semantic source
visual-semantic binding
reduced-motion equivalent
inspectable state
```

## 2. Frontier map

The frontiers are grouped by product maturity, not only technical category.

| Frontier | Theme | Purpose | Status |
|---|---|---|---|
| R1 | Runtime unification | Make the production runtime fully platform-backed | ✅ shipped (Phase D) |
| R2 | Platform inspector | Make the runtime inspectable and trustworthy | ✅ shipped (#198) |
| R3 | Recipe system | Make behavior authorable and reusable | ✅ shipped (#197/#201) |
| R4 | Recipe gallery | Make the system teach itself | ✅ shipped (#199/#201) |
| R5 | Data binding | Turn records into field bodies and relationships | planned |
| R6 | Input agents | Make focus, pointer, keyboard, and selection part of the field | planned |
| R7 | Accessibility conformance | Make motion alternatives testable | partial (recipes carry reduced-motion) |
| R8 | Natural physics completion | Finish warp, transmutation, lifecycle, and conservation frontiers | planned |
| R9 | Conformance as a tool | Expose tests, replay, fuzzing, and scenario DSL | planned |
| R10 | Render frontiers | Add expressive, inspectable render surfaces | planned |
| R11 | Compositor-native bridge | Use modern platform features for smoother DOM feedback | planned |
| R12 | Compute backend | Add opt-in GPU scale while preserving CPU semantics | planned |
| R13 | Multi-root and cross-document fields | Support scopes, portals, and continuity | planned |
| R14 | AI evidence fields | Make trust, uncertainty, contradiction, and provenance inspectable | planned |
| R15 | Visual authoring tools | Let designers compose recipes without writing force code | planned |
| R16 | Research and release package | Convert the system into a publishable/releasable artifact | planned |

## R1. Runtime platform unification

### Goal

Make the production <field-root> runtime fully platform-backed.

The platform package already owns the correct browser-facing concepts. The next frontier is to ensure the live runtime uses those contracts by default.

### Work

```txt
<field-root> creates createFieldPlatform(root)
<field-root> creates browserHost()
<field-root> passes host into createField()
MeasurementRegistry owns body geometry
FeedbackRegistry owns CSS variables and threshold events
RelationshipRegistry owns semantic relationship discovery
VisualBindingRegistry owns visual-semantic bindings
OverlayRegistry owns relationship and diagnostic overlays
FrameScheduler owns phase order
```

### Acceptance criteria

```txt
field-root uses @field-ui/platform by default
legacy scanning path is removed or quarantined
data-body still works
data-intent still works
data-field-role still works
field:* and forces:* aliases still work where compatibility requires them
--field-* and --forces-* aliases still write where compatibility requires them
all particle behavior remains unchanged
```

### Verification

```txt
unit tests for field-root platform initialization
browser preview of homepage, Lab, diagnostics, Reading Field, authoring
phase-violation tests
Shadow DOM registration tests
feedback alias tests
reduced-motion checks
```

### Effort

Large. High value. Should be split into several PRs.

## R2. Platform Inspector

### Goal

Make the field runtime inspectable.

The inspector should answer:

```txt
What is registered?
What is measured?
Which relationships exist?
Which state values are active?
Which feedback variables were written?
Which overlays are enabled?
Which scheduler phase is running?
Which lint warnings exist?
Which recipe is active?
```

### Work

Create:

```txt
/docs/platform-inspector
```

Expose panels for:

```txt
FrameScheduler phases and timings
MeasurementRegistry bodies
StateRegistry values
FeedbackRegistry writes
RelationshipRegistry graph
VisualBindingRegistry bindings
OverlayRegistry overlays
lintPlatform warnings
host configuration
active recipe
contract
```

### Acceptance criteria

```txt
Inspector works on a normal content page
Inspector works on Lab/demo pages
Inspector shows live values without mutating runtime
Inspector has reduced-motion-safe display
```

### Verification

```txt
browser preview
registry state assertions
lint warning fixture
screenshot tests if available
```

### Effort

Medium.

## R3. First-class recipe system

### Goal

Make recipes the primary authoring unit.

A recipe is a portable field program, not just an example.

### Recipe contract (shipped)

The shipped `FieldRecipe` (`packages/core/src/recipes/schema.ts`) keeps the lanes separate —
`primitives` are strict runtime tokens; `concepts`/`conditions` are product language and activation
logic; `metrics`/`diagnostics` are measured state and inspection modes; `accessibility` is the
required reduced-motion equivalent:

```ts
type FieldRecipe = {
  id: string;
  name: string;
  intent: string;
  tier?: "core" | "workflow" | "professional" | "enterprise";
  naturalField?: "gravity" | "electromagnetic" | "strong" | "weak";
  translation?: string;
  primitives: string[];   // RUNTIME TOKENS — strict, passported, conformance-gated
  concepts?: string[];    // product language (orbit, spring, trust)
  metrics: string[];      // measured state
  diagnostics: string[];  // inspection / render modes
  conditions?: string[];  // activation logic (dwell, threshold, stale)
  bodies: BodyRecipe[];
  relationships?: RelationshipRecipe[];
  render: RenderLayer[];
  accessibility: { reducedMotion: string; meaningWithoutMotion: string };
  status?: "shipped" | "experimental" | "planned" | "conceptual";
};
```

### Initial recipe families

```txt
Core interface fields
Reading, memory, accessibility
Product and workflow patterns
Trust, collaboration, inspection, teaching
Professional systems, safety, provenance, governance
Enterprise, collaborative, adaptive, operational fields
```

### Acceptance criteria

```txt
64 recipe catalog exists as canonical data
recipes include semantic intent
recipes include diagnostics
recipes include reduced-motion equivalent
recipes can be rendered in docs
recipes can be previewed in Lab
```

### Verification

```txt
schema tests
catalog coverage tests
docs rendering tests
reduced-motion metadata tests
```

### Effort

Medium.

## R4. Executable Recipe Gallery

### Goal

Turn the gallery into an executable authoring surface.

Each recipe should show:

```txt
intent
natural-field translation
HTML example
web component example
React example
live preview
diagnostic view
reduced-motion equivalent
copyable JSON
```

### Work

Upgrade /docs/gallery into a real recipe browser.

Add filters:

```txt
Gravity
Electromagnetic
Strong
Weak
Derived
Transport
Metric
Diagnostic
Accessibility
Shipped
Experimental
Planned
```

### Acceptance criteria

```txt
recipes are data-driven
recipe preview uses production runtime
copyable examples stay in sync with schema
diagnostics are available per recipe
```

### Verification

```txt
site tests
browser preview
copy button smoke tests
recipe schema tests
```

### Effort

Medium.

## R5. bindData() as the data thesis

### Goal

Turn data records into field participants.

### API

```ts
const binding = bindData(container, records, mapper, options);

binding.update(nextRecords);
binding.destroy();
```

Mapper:

```ts
mapper(record) => {
  id,
  body,
  strength,
  range,
  color,
  role,
  relationships,
  metrics,
  status
}
```

### Behavior

```txt
add -> body appears and can receive matter
remove -> body releases or decays, never pops abruptly
update -> metrics and feedback change
reorder -> bodies move and matter follows
relationship change -> graph updates
```

### Adapters

```txt
core data adapter
platform DOM binding
React hook
vanilla helper
```

### Acceptance criteria

```txt
record diffing is deterministic
relationships update without duplication
removed records release or decay predictably
data-bound bodies can be inspected
```

### Verification

```txt
diff tests
relationship tests
visual demo
record/replay fixture
```

### Effort

Medium.

## R6. Input agents

### Goal

Make user input part of the field instead of only triggering local state.

### Agents

```txt
FocusAgent
PointerAgent
KeyboardAgent
SelectionAgent
DwellAgent
ScrollAgent
```

### FocusAgent

Focus becomes current.

Tab order can emit signal. Focused elements gain attention. Previously focused elements retain memory.

### PointerAgent

Pointer velocity becomes influence. A fast gesture can impart momentum. Drag release can become a physical throw when enabled.

### KeyboardAgent

Directional navigation can become flow. Shortcuts can emit signal to affected regions.

### SelectionAgent

Selected text, selected cards, selected nodes, and selected rows can become temporary bodies.

### DwellAgent

Dwell becomes attention and memory, not just analytics.

### Acceptance criteria

```txt
input agents are opt-in
agents respect reduced motion
agents can be inspected
agents do not spam DOM events
```

### Verification

```txt
synthetic input tests
reduced-motion tests
browser previews
phase discipline tests
```

### Effort

Small to medium per agent.

## R7. Accessibility conformance

### Goal

Make accessibility equivalence testable.

### Work

Create an accessibility recipe contract:

```ts
type AccessibilityEquivalent = {
  semanticSource: string;
  motionBehavior: string;
  reducedMotionBehavior: string;
  keyboardBehavior?: string;
  screenReaderSource?: string;
  visualBindingRequired: boolean;
};
```

Add lint rules for:

```txt
visual layer has no semantic source
interactive overlay has no semantic equivalent
motion recipe has no reduced-motion equivalent
Canvas/SVG text is the only text source
relationship overlay has no DOM relationship
```

### Acceptance criteria

```txt
every shipped recipe has an accessibility equivalent
Accessibility Preview can load recipes
lintPlatform catches missing equivalents
```

### Verification

```txt
lint tests
preview page
recipe metadata tests
manual keyboard checks
```

### Effort

Medium.

## R8. Natural physics completion

### Goal

Finish the remaining natural and cosmology frontiers without breaking canonical UI behavior.

### Work

```txt
warp
wormhole
composite
fuse
fission
decay
phase
lifecycle
expansion
first-class mass where needed
energy reaction budgets where dissipative
```

### Guardrails

```txt
do not turn attract into gravity
do not turn repel into charge
do not make magnetism field-following
fieldflow remains transport
status-label everything as shipped, experimental, planned, or conceptual
```

### Acceptance criteria

```txt
warp preserves velocity semantics
wormhole is compositional
fuse conserves mass/momentum within tolerance
fission/decay respect spawn/source budgets
star/supernova recipes have truthful implementation labels
```

### Verification

```txt
golden tests
conformance scenarios
mass/momentum checks
particle count budget checks
Lab demos
```

### Effort

Medium to large.

## R9. Conformance as a public tool

### Goal

Expose the conformance system as a reusable testing primitive.

### Work

```txt
document Scenario DSL
document Expectation DSL
extract headless runner
add property-based fuzzing
add record/replay
add visual snapshot hooks
add parity runner for CPU/GPU later
```

### API sketch

```ts
runScenario({
  seed,
  bodies,
  particles,
  frames,
  expectations
});
```

### Acceptance criteria

```txt
external package or documented API exists
examples cover forces, render modes, recipes
record/replay reproduces deterministic sessions
fuzzing catches NaN, Infinity, unstable velocity, count leaks
```

### Verification

```txt
self-hosting conformance tests
record/replay golden fixture
fuzz seed regression files
```

### Effort

Medium.

## R10. Render frontiers

### Goal

Add expressive render surfaces with golden-testable cores.

### Candidates

```txt
knockout
depth
flow-field LIC
glyph interior
field contour labels
relationship ribbons
field shadows
volumetric density
```

### Requirements

Each render mode must define:

```txt
what it reveals
what data it reads
whether it is decorative or semantic
reduced-motion equivalent
pure core if possible
visual preview
```

### Initial priority

```txt
knockout
depth
flow-field LIC
relationship ribbons
```

### Verification

```txt
pure render tests
browser previews
accessibility checks
visual-semantic binding checks
```

### Effort

Small to medium each.

## R11. Compositor-native bridge

### Goal

Use modern platform features to make feedback smoother and cheaper.

### Work

```txt
CSS.registerProperty for --field-density, --field-heat, --field-memory, --field-coherence
scroll-driven animation helpers
view-timeline recipes
CSS Anchor Positioning for attached overlays
View Transitions continuity where feature-detected
```

### Naming rule

Use primary current names:

```txt
--field-*
field:*
```

Compatibility aliases:

```txt
--forces-*
--d
forces:*
```

Do not make new docs primarily use --d.

### Acceptance criteria

```txt
feature-detected helpers
no hard dependency on experimental browser support
fallbacks work
authors can opt in per recipe
```

### Verification

```txt
unit tests for helper registration
browser preview in supporting browser
fallback preview in non-supporting path
```

### Effort

Small to medium.

## R12. Compute backend

### Goal

Add an optional GPU backend for scale without changing force semantics.

### Seam

```ts
type IntegratorBackend = {
  id: "cpu" | "gpu";
  supports(capability): boolean;
  step(state, bodies, forces, env): BackendStepResult;
};
```

### Backend options

```txt
cpu
default
gpu
opt-in
auto
feature-detected
```

### Phasing

```txt
Phase 1: class A body-to-particle forces
Phase 2: particle-neighbor forces with GPU spatial grid
Phase 3: scalar/vector grids
Phase 4: direct GPU renderer
Phase 5: CPU/GPU parity conformance
```

### Acceptance criteria

```txt
CPU stays default
GPU is opt-in
GPU subset is documented
parity tests exist
no readback in render path
```

### Verification

```txt
CPU/GPU parity tests
performance benchmark
fallback tests
Lab scale demo
```

### Effort

Large. Flagship frontier.

## R13. Multi-root and cross-document fields

### Goal

Support larger interface systems without assuming one page-wide field.

### Work

```txt
field scopes
local cells
portals
cross-root relationships
cross-document continuity
pagehide/pageshow pool serialization
view-transition bridge where feature-detected
iframe or embedded field bridges where safe
```

### Rules

```txt
global field remains default
local cells must not fragment semantics accidentally
cross-document continuity must be opt-in
privacy boundaries must be respected
```

### Verification

```txt
multi-root tests
local-cell isolation tests
portal relationship tests
pagehide/pageshow restore tests
```

### Effort

Medium to large.

## R14. AI evidence fields

### Goal

Make AI uncertainty, evidence, contradiction, and provenance inspectable.

### Recipes

```txt
Evidence Field
Trust Gradient
Conflict Field
Source Constellation
Provenance Trail
Citation Thread
Disagreement Charge Field
Contract Preview
```

### Work

```txt
claim body model
source relationship model
support/conflict polarity
confidence/coherence metrics
provenance memory
causality overlays
reduced-motion evidence tables
```

### Acceptance criteria

```txt
claims bind to sources
unsupported claims remain visibly distinct
contradictions are inspectable
confidence is not presented as certainty
semantic sources remain available without overlays
```

### Verification

```txt
fixture documents
source/claim relationship tests
reduced-motion preview
accessibility lint
```

### Effort

Medium.

## R15. Visual authoring tools

### Goal

Let designers compose field behavior without editing force code.

### Surfaces

```txt
recipe editor
force card editor
relationship graph editor
diagnostic lens
parameter tuning panel
reduced-motion equivalent editor
export JSON
```

### Work

```txt
schema-backed recipe authoring
live preview
lintPlatform integration
copyable code generation
design-token mapping
```

### Acceptance criteria

```txt
editor exports valid recipe JSON
invalid recipes surface lint warnings
generated HTML/web component/React examples work
reduced-motion equivalent is required for shipped recipes
```

### Verification

```txt
schema tests
round-trip tests
browser preview
accessibility checks
```

### Effort

Large.

## R16. Research and release package

### Goal

Prepare field-ui as both a public product and a research artifact.

### Research package

```txt
paper draft
architecture diagrams
Reading Field case study
Natural Field Translation System
accessibility rationale
diagnostic screenshots
performance notes
evaluation plan
```

### Product package

```txt
installation
quick start
core/platform/elements/react guides
recipe gallery
diagnostics
platform inspector
migration guide
browser support
examples
API stability notes
```

### Evaluation targets

```txt
reading orientation
section relocation speed
concept relationship recall
perceived distraction
reduced-motion preference
debuggability
authoring time
```

### Acceptance criteria

```txt
paper-ready case study exists
release docs are coherent
examples run from scratch
API surface is stable enough for preview release
```

### Effort

Medium.

## 3. Recommended sequencing

### Stage E: Runtime coherence

```txt
R1 runtime platform unification
R2 platform inspector foundation
docs/API boundary updates
```

Outcome:

```txt
One production runtime path.
Core portable.
Platform observable.
```

### Stage F: Product coherence

```txt
R3 recipe system
R4 executable recipe gallery
R7 accessibility conformance
R5 bindData()
```

Outcome:

```txt
The system becomes usable and teachable.
```

### Stage G: Trust and evidence

```txt
R14 AI evidence fields
R2 platform inspector expansion
R9 conformance as public tool
```

Outcome:

```txt
The system becomes inspectable and credible.
```

### Stage H: Advanced interaction

```txt
R6 input agents
R13 multi-root/cross-document fields
R11 compositor-native bridge
```

Outcome:

```txt
The field becomes a richer native interface layer.
```

### Stage I: Physics and render frontier

```txt
R8 natural physics completion
R10 render frontiers
R12 compute backend
```

Outcome:

```txt
The engine reaches scale, expressiveness, and physical depth.
```

### Stage J: Release and research

```txt
R16 research and release package
R15 visual authoring tools
```

Outcome:

```txt
The system becomes explainable, publishable, and adoptable.
```

## 4. Near-term priority

Do not start with GPU or new visual effects.

The next highest-leverage work is:

```txt
1. Runtime platform unification
2. Platform Inspector
3. First-class Recipe System
4. Executable Recipe Gallery
5. Accessibility Conformance
```

Reason:

```txt
field-ui does not need more spectacle first.
It needs coherence, authorability, inspectability, and trust.
```

## 5. Frontier governance

Every frontier PR must answer:

```txt
What does this change?
Which package owns it?
Does it affect core?
Does it affect platform?
Does it affect public authoring?
Is it shipped, experimental, planned, or conceptual?
How is it tested?
How is it inspected?
What is the reduced-motion equivalent?
What docs must change?
```

If a frontier cannot answer those questions, it is not ready.

## 6. Final principle

The roadmap should preserve the central transformation:

```txt
Old model: UI as isolated components with decorative transitions.
New model: UI as a shared, inspectable field of meaning.
```

Every frontier should strengthen that transformation.

If it only adds an effect, defer it.

If it makes the system more relational, explainable, accessible, portable, or authorable, prioritize it.
```

:::

I would replace the current roadmap-frontiers.md with this structure, then move any old F1-F7 details into the matching R-sections as implementation notes. The old roadmap was still useful, but it was organized around the earlier engine frontier. This version is organized around the current product architecture.