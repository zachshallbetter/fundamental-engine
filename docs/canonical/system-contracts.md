> **Status: canonical.**
> Hard contracts for bodies, fields, forces, agents, events, feedback, recipes, accessibility, performance, conformance, and the platform. Current as of the platform-runtime phase (Phase D). See [platform-architecture.md](platform-architecture.md) and [system-contracts.md](system-contracts.md).

# Fundamental System Contracts

## Related Documents

| Document | Role |
|---|---|
| [`README.md`](./README.md) | Documentation map |
| [`definition-document.md`](definition-document.md) | Canonical definition |
| [`fundamental-field-behavior-table.md`](fundamental-field-behavior-table.md) | Field/force laws |
| [`interaction-and-relationship-model.md`](interaction-and-relationship-model.md) | Agent model |
| [`visualization-methods-taxonomy.md`](visualization-methods-taxonomy.md) | Render contracts |
| [`testing-and-conformance.md`](testing-and-conformance.md) | Test contracts |

## Purpose

Fundamental is a platform-native relational field runtime for the DOM. `Fundamental` computes renderer-agnostic field behavior; `@fundamental-engine/dom` binds it to the DOM (measurement, state, feedback, relationships, visual bindings, overlays, scheduling, linting); `elements`/`react` are authoring surfaces. The contracts below bind these layers together — a shared field context across bodies, agents, relationships, measurements, metrics, feedback, and render surfaces. Canvas is one render surface, not the whole system.

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

### 2.1 External field channels (`addField`)

A host may register its own scalar field as a named **channel** the engine samples on the same read
path as its built-in field functions:

```ts
addField(name: string, sampler: (x: number, y: number) => number): FieldChannelHandle
sampleField(name: string, x: number, y: number): number
```

This is the open **input** analog of the render surfaces (`setRender`/`setOverlay` are bundled *output*
layers; `addField` is an on-demand *input* channel) — the same shape as the `grid(name)` host-authorable
buffer, but for a field the host already owns (terrain height, soil moisture, a temperature map). A
channel sampler obeys the field-function contract above (side-effect free, stable for a fixed state); it
is **pull-based** — called on demand, never cached — so it must stay cheap. The `FieldChannelHandle`
swaps the sampler live or removes the channel. Reading a channel as a force *potential* is a separate,
opt-in coupling — `addField` is the read substrate, not yet a cause.

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

**The three metric-output lanes.** Not every `--field-*` variable flows automatically — the lane
that produces a variable determines whether it arrives at all:

- **Engine-computed** — written by core's feedback sink every frame, regardless of recipes or
  platform configuration: `--d` / `--field-density` (local particle density), `--load` / `--mass`
  (sink accretion fill), `--lit` (continuous engagement, paired with `field:lit` / `field:dim`
  hysteretic events), and the engine-measured thermodynamics `--entropy`, `--coherence`,
  `--temperature` (velocity alignment, agitation, heat — written to `data-feedback` bodies; these
  bare-named variables are distinct from the platform-inferred ones below).
- **Platform-computed** — written by `applyRecipe` / `computeMetrics` when a recipe runs its
  metric pipeline: `--field-attention`, `--field-memory`, `--field-coherence`, `--field-entropy`,
  `--field-pressure`, `--field-recency`, `--field-priority`. These flow every frame that the
  recipe pipeline ticks. `--field-confidence` and `--field-risk` are supplied-only — the engine
  never invents them; they appear only when the host supplies `data-field-confidence` /
  `data-field-risk`.
- **Data-supplied (designed)** — lanes a recipe declares but that neither the engine nor the
  platform metric pipeline computes. A recipe listing `signal`, `route-strength`, or any
  domain-specific metric must have the host supply `data-field-<metric>` (or a domain model) or
  the `--field-<metric>` lane stays **inert** — declared, bound, never written. The lint rule
  `lintInertFeedback` surfaces this gap: a binding to an inert designed lane is the same
  silent-contract class as a sink that captures but never reports.

Recipe authors must not expect a designed lane to flow unless the host provides the data. The
platform writes what it can compute; `classifyMetric(name)` returns `'computed'`,
`'supplied-only'`, or `'designed'` for any metric name.

Suggested CSS variables for the platform-computed lane (canonical `--field-*`; `--d` is the compact
alias for density). The legacy `--forces-*` CSS variables have been removed — only the `forces:*`
**event** aliases remain for backward compatibility (those still fire from the engine):

```css
--field-density
--field-attention
--field-heat
--field-entropy
--field-coherence
--field-memory
--field-pressure
--field-pull-x
--field-pull-y
```

One shipped **page-global** variable lives on `:root`, not on bodies: `--field-scroll-v`, the
engine's eased scroll velocity (px/frame), written by the platform write phase and deduped when
unchanged. The engine-measured thermodynamics `--entropy`, `--coherence`, and `--temperature`
are deliberately bare-named (distinct from the `--field-entropy` / `--field-coherence`
platform-inferred interaction metrics — the two families must not be cross-written). (`--coherence`
is additionally a palette *color* on `:root` via `cssTokens()` — the measured value is
element-scoped and numeric.) Formulas:
[`physics-workover.md`](../engine-reference/physics-workover.md) §"Metrics".

**Engagement inputs** are part of this contract. The engine wires hover/focus engagement on
`[data-hot]` elements at scan time (engaging one activates its body and gathers density — its
`--d` rises). The platform metric pipeline reads `engaged` as
`:hover | :focus | :focus-within | [data-active]` — setting `data-active` programmatically is
the sanctioned way to mark an element "in hand" (a dragged card, a just-changed status). See
[invisible-fields.md](invisible-fields.md) §3.

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

> **Implemented.** `FIELD_EVENTS` (`packages/core/src/agents/event-agent.ts`) names every event here
> with its `field:*` canonical + `forces:*` alias and source metric; the `Thresholder` runtime makes
> them hysteretic + debounced. `field:lit`/`dim` and the `*-body` lifecycle events dispatch today.

Field events must be thresholded, debounced, and inspectable.

Allowed event types (canonical `field:*`; each has a `forces:*` compat alias the FeedbackRegistry mirrors):

```txt
field:entered
field:exited
field:lit
field:dim
field:saturated
field:captured
field:released
field:attention-shifted
field:relationship-strengthened
field:memory-threshold
field:entropy-warning
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

> **Implemented.** Now a named entry in the `CONTRACTS` catalog (`contracts/index.ts`), enforced by
> the reduced-motion guard, the UserAgent travel-gating, and the a11y lint rules, with a dedicated
> test set (`contracts/a11y.test.ts`).

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

The visual language system is defined in [`visual-language-and-geometry.md`](visual-language-and-geometry.md).

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


## 20. Platform Contract

> **Implemented.** `@fundamental-engine/dom` ships `createFieldPlatform(root)` plus the six registries, the
> `FrameScheduler`, and `lintPlatform()`. The platform runtime is the default for `<field-root>`.

> **Kotlin/Android parity.** The native Kotlin port's `:fundamental-platform` module satisfies this same
> contract: a `FieldPlatform` over the six-phase `FrameScheduler` and the same six registries
> (`MeasurementRegistry`, `StateRegistry`, `FeedbackRegistry`, `RelationshipRegistry`,
> `VisualBindingRegistry`, `OverlayRegistry`), driven by an injected `FieldHost`. It is pure
> `kotlin("jvm")` (zero Android deps), so it computes field behavior with no view layer and is
> JVM-tested (`FrameSchedulerTests`, `FieldPlatformTests`). In active development on the Android port
> branch — not a published release.

`@fundamental-engine/dom` binds the renderer-agnostic field computed by `Fundamental` to the DOM. It owns DOM participation; core stays free of DOM side effects.

The platform must:

```txt
own measurement, state, feedback, relationships, visual bindings, and overlays
schedule all DOM reads and writes through explicit phases
register Shadow DOM bodies for physical participation
keep Fundamental renderer-agnostic (imports no DOM globals)
expose createFieldPlatform(root) to construct a runtime over a root
expose lintPlatform() to validate registry usage
```

Construction:

```txt
createFieldPlatform(root) -> a platform runtime bound to root
```

The platform must not move force-engine math into the DOM layer. Core computes field behavior; the platform observes and writes the DOM.

## 21. Registry Contract

> **Implemented.** Six registries ship in `@fundamental-engine/dom`: `MeasurementRegistry`,
> `StateRegistry`, `FeedbackRegistry`, `RelationshipRegistry`, `VisualBindingRegistry`,
> `OverlayRegistry`.

Each registry owns one concern and participates in the scheduler in its declared phase.

| Registry | Concern | Phase ownership |
|---|---|---|
| `MeasurementRegistry` | geometry/rects for bodies | read |
| `StateRegistry` | registered field/agent state | compute / state |
| `FeedbackRegistry` | CSS-variable and event write-back | write |
| `RelationshipRegistry` | active connections between bodies | compute |
| `VisualBindingRegistry` | binding field metrics to visual properties | write |
| `OverlayRegistry` | overlay/render-surface participation | render |

Registry rules:

```txt
A registry must declare which scheduler phase it runs in.
Measurement must read geometry only in the read phase.
Feedback must write only in the write phase.
The FeedbackRegistry emits field:* events with forces:* event aliases for compatibility (the legacy --forces-* CSS variables have been removed).
Relationship targets must resolve to registered bodies.
Visual bindings must target hidden, non-orphan elements.
Overlays must reference real links.
```

## 22. Scheduler Contract

> **Implemented.** `FrameScheduler` in `@fundamental-engine/dom` runs the explicit phase pipeline below.

The scheduler runs registries in a fixed phase order each frame. Reads never interleave with writes.

The six phases, in order:

```txt
discover  -> find participants (bodies, agents, relationships)
read      -> measure geometry; no writes allowed
compute   -> evaluate field/relationship state; side-effect free
state     -> reconcile registered state
write     -> emit CSS variables, data attributes, feedback, events
render    -> draw render surfaces and overlays  [caller-open; not wired by the platform]
```

The platform owns and wires discover through write. The render phase is caller-open — the
platform defines the slot and its read-only contract, but does not install a handler; the legacy
engine fills it by running the canvas simulate-and-render loop. The platform observes and feeds
back DOM state; it does not draw.

Scheduler rules:

```txt
No DOM writes during read or compute.
No geometry reads during write.
Every registry declares its phase and runs only in that phase.
The phase order is fixed; registries do not reorder it.
Render-phase handlers are caller-supplied; the platform wires none by default.
```

## 23. Platform-Lint Contract

> **Implemented.** `lintPlatform()` in `@fundamental-engine/dom` enforces the rules below.

Platform lint validates that registries are used correctly before behavior depends on them.

| Rule | Catches |
|---|---|
| `relation-target-missing` | a relationship points at an unregistered body |
| `state-unregistered` | state read or written without registration |
| `overlay-without-links` | an overlay with no real links to reference |
| `feedback-non-css-var` | feedback writing something other than a CSS variable |
| `measurement-off-phase` | geometry read outside the read phase |
| `visual-orphan` | a visual binding with no target |
| `visual-not-hidden` | a visual binding whose target is not hidden |

Lint must run against a constructed platform and report violations by rule name.

## 24. Phase D Runtime-Unification Note

> **Implemented (Phase D).** The platform runtime is the default for `<field-root>`.

In the platform-runtime phase the layers are unified as follows:

```txt
The platform runtime is the DEFAULT for <field-root>.
Fundamental is renderer-agnostic and imports no DOM globals (a legacy element write-back path still lives in core/field.ts, pending migration).
The platform owns DOM participation: measurement, feedback writes, shadow registration, relationships.
The legacy core path still simulates and renders the canvas surface.
The DOM boundary is guarded by a test allowlist; core must not reach into the DOM outside it.
```

Opting back to the pure-legacy path:

```txt
experimental-platform="off" on <field-root>
usePlatformRuntime(false)
```

The legacy path is quarantined, not removed: it remains the canvas simulate-and-render surface while the platform owns DOM participation.

## Migration and Alias Contract

The `forces-ui` → `field-ui` → `Fundamental` renames are complete. The current alias surface is
narrow: the canonical names are `--field-*` (CSS) and `field:*` (events).

CSS write-back emits the **canonical `--field-*` family only**. The legacy `--forces-*` CSS
variables have been **removed** (a body now reads `--field-density`, `--field-heat`, … and the
compact `--d`):

```txt
--field-density
--field-heat
--field-entropy
--field-coherence
--field-attention
```

Events still ship a `forces:*` compatibility alias alongside each canonical `field:*` event:

```txt
field:register-body     (alias: forces:register-body)
field:unregister-body   (alias: forces:unregister-body)
field:lit               (alias: forces:lit)
```

These event aliases remain for backward compatibility. Any future alias may be deprecated only
after:

```txt
docs are updated
tests pass
examples use new names
migration notes identify the removal version
```

Do not remove old names in the same pass that introduces new names.
