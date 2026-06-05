# forces-ui: Complete Concept Document

> **Status: vision document.** This is the north-star concept for forces-ui — the full arc,
> including parts not yet built. For what ships today, the contract is
> [`forces-system.md`](forces-system.md) and the live plan is
> [`physics-workover.md`](physics-workover.md) / [`BACKLOG.md`](../BACKLOG.md). Sections on the
> Shadow DOM model, field portals, the `<forces-text>` / `<forces-card>` component family, the
> `--forces-*` CSS namespace, `screen`, the transformation primitives, and the physics-mode
> system are **proposed design**, not shipped.

## 1. Thesis

forces-ui is a reciprocal interface field.

Elements bend the field. The field bends them back.

The page is not placed on top of a particle background. The page lives inside a shared physical field. Words, links, cards, marks, controls, and components can become bodies. Bodies exert force on particles. Particles gather around bodies. Local density writes back into the elements as weight, glow, color, movement, state, and behavior.

Most particle effects are wallpaper. forces-ui is a substrate.

The interface is not only styled. It participates.

## 2. The Core Loop

The system has two directions.

### Element to Field

An element becomes a body by declaring force attributes or registering itself with the field engine.

Example:

```html
<a
data-body="attract"
data-strength="0.9"
data-range="320"
data-color="#4da3ff"
data-feedback >
mass </a>
```

The element now affects particles. It may pull, repel, swirl, viscosity, wall, sink, emit, or otherwise shape motion.

### Field to Element

The field samples local particle density around each feedback-enabled body.

That density becomes CSS state.

```css
--d --forces-density --forces-heat --forces-entropy --forces-coherence --forces-accent --forces-accreted
```

The element consumes those variables.

```css
.liveword {
font-variation-settings: "wght" calc(300 + var(--forces-density, var(--d, 0)) * 500);
text-shadow: 0 0 calc(var(--forces-density, var(--d, 0)) * 14px) var(--forces-accent, var(--accent)); }
```

The word gets heavier because the field actually gathered around it.

## 3. System Invariants

Three invariants define the system.

### Reciprocity

Elements move matter. Matter moves elements.

Neither side is purely decorative.

A body can:
- source force into particles
- receive density from particles
- move as an element target
- dispatch events when field thresholds are crossed

### Conservation

The default field does not create matter from nothing.

Particles are:
- bound to currents
- detached into free particles
- captured by sink bodies
- released by supernova
- reclaimed by wave healing

The steady-state system should conserve particle count.

Source/sink forces may break conservation only when explicitly budgeted.

### Synchronization

The DOM and the canvas share one coordinate space.

Every registered body is measured through its viewport rectangle and mapped into the canvas.

```ts
const rect = element.getBoundingClientRect(); const canvasRect = canvas.getBoundingClientRect();
const cx = (rect.left - canvasRect.left + rect.width / 2) * dpr; const cy = (rect.top - canvasRect.top + rect.height / 2) * dpr; const hw = (rect.width / 2) * dpr; const hh = (rect.height / 2) * dpr;
```

The invisible force geometry stays locked to the visible interface.

## 4. The Substrate

The field is built from particles, bodies, currents, formations, density feedback, and a shared canvas.

### Canvas

The default surface is a single shared canvas mounted at the application root.

Do not create one canvas per component by default.

Use isolated canvases only for explicit local cells, demos, documentation examples, conformance views, or playgrounds.

### Particles

Particles carry physical and visual state.

Recommended particle model:

```ts
type Particle = {
x: number;
y: number;
vx: number;
vy: number;
heat: number;
cap: Body | null;
m: number;
q: number;
age: number;
life?: number;
species?: string;
pigment?: Color;
phase: number;
coherence: number; };
```

Minimum default:

```ts
m = 1; q = 0; age = 0; phase = 0; coherence = 0;
```

### Bodies

A body is a registered element or virtual element that can participate in the field.

A body may source force, receive density, be moved by forces, and emit events.

Recommended body model:

```ts
type Body = {
element: Element;
id: string;
tokens: string[];
strength: number;
range: number;
angle: number;
spin: number;
when: string;
cx: number;
cy: number;
hw: number;
hh: number;
on: boolean;
vis: boolean;
count: number;
d: number;
accreted: number;
capacity: number;
color?: string;
getRect?: () => DOMRect; };
```

Important naming rule:

```txt
p.m = inertial particle mass body.M = source mass for gravity-like laws body.accreted = captured-particle count body.capacity = saturation threshold --forces-accreted or --load = accreted / capacity
```

Do not use body.mass for accretion count.

## 5. Currents

Currents are the background carrier lines of the field.

They are not decoration. They are:
- standing waveforms
- reservoirs of bound matter
- carriers of particle motion
- agents that can bend toward engaged elements
- a source of ambient life

Particles may be bound to currents or free in the field.

A calm free particle near a current can heal back into the line.

This is what allows the field to feel alive without constantly spawning new matter.

## 6. Formations

A formation is a global field arrangement.

Formations do not replace force tokens. They bias the whole field.

Core formations:

| Formation | Feel |
|---|---|
| ambient | calm resting field |
| wells | matter pools into attractors |
| lanes | sideways directional bands |
| scatter | even dispersal |
| accretion | convergence toward sink bodies |

Formations can map to sections, view states, data modes, search modes, or interaction states.

Example IA mapping:

```txt
hero -> ambient work -> wells writing -> lanes practice -> scatter contact -> accretion
```

## 7. Canonical Forces

The canonical force set contains the nine UI verbs.

They are designed forces. They are not required to be literal real-world laws.

| Force | Token | Meaning |
|---|---|---|
| Attract | attract | gives direction |
| Repel | repel | creates pressure and separation |
| Swirl | swirl | spins motion together |
| Stream | stream | reveals directional motion |
| Viscosity | viscosity | adds constraint and viscosity |
| Jet | jet | adapts and relaunches response |
| Tether | tether | gives structure and rest length |
| Wall | wall | defines human surface and collision |
| Sink | sink | holds attention, then releases |

These are interface primitives.

They should remain stable API tokens.

### Canonical Force Philosophy

attract is not literal gravity.

repel is not literal Coulomb force.

They are bounded UI wells with predictable range and readable feel.

The natural physics layer contains the literal laws.

## 8. Natural Physics Primitives

Natural primitives are physically coherent force laws and field behaviors.

They are used for the Lab, cosmology, material systems, and physically rigorous modes.

Core natural primitives:

| Force | Token | Meaning |
|---|---|---|
| Gravity | gravity | softened inverse-square attraction |
| Charge | charge | signed softened inverse-square interaction |
| Magnetism | magnetism | Lorentz-style perpendicular curvature |
| Thermal | thermal | Brownian or Langevin agitation |
| Collide | collide | pairwise momentum exchange |
| Diffuse | diffuse | scalar field diffusion |
| Propagate | propagate | finite-speed wave propagation |
| Memory | memory | slow-decay occupancy field |

Natural laws should use first-class mass, real dt, softening, and conservation where appropriate.

## 9. Extended Force Vocabulary

The extended vocabulary should not become a thesaurus.

Every addition must fit one of these layers:

### Primitive

A real implemented force token.

### Modifier

A token that alters sibling forces.

Examples:
- spotlight
- resonate
- screen

### Condition

A data-when predicate controlling when a body acts.

### Formation

A global field bias.

### Composite

A named preset built from existing primitives.

### Emergent Behavior

A behavior that arises from forces and initial conditions.

### Metric

A measured property, not a force.

## 10. Designed Extended Forces

Extended designed and material forces include:

| Force | Token | Class | Purpose |
|---|---|---|---|
| Lens | lens | A | bends velocity without adding speed |
| Gate | gate | A | one-way membrane |
| Spotlight | spotlight | modifier | cone-gates sibling forces |
| Resonate | resonate | modifier | modulates strength over time |
| Wind | wind | A | curl-noise turbulence |
| Shear | shear | A | boundary layer slip |
| Buoyancy | buoyancy | A+E | hot/light particles rise |
| Align | align | A/B | coherent headings and flocking |
| Cohesion | cohesion | B | surface tension and droplets |
| Pressure | pressure | B | incompressible fill |
| Link | link | B | chains, ropes, cloth-like constraints |
| Hunt | hunt | B+E | predator/prey dynamics |
| Morph | morph | D | assemble into marks, logos, charts |
| Pigment | pigment | E | conserved color transport |
| Spawn | spawn | S | budgeted source |

## 11. Recommended New Force: Screen

screen should be implemented as a modifier.

It attenuates sibling forces.

Purpose:
- quiet zones
- shields
- insulated text areas
- protected cards
- force-safe panels
- magnetic cages
- local field dampening

Formula:

```txt
falloff = max(0, 1 - d / range)^2 screenFactor = clamp(1 - strength * falloff, min, 1) siblingForce *= screenFactor
```

Example:

```html
<div
data-body="screen attract"
data-strength="0.7"
data-range="260"
data-screen-min="0.2" ></div>
```

Modifier order:

```txt
spotlight -> screen -> resonate -> core force
```

## 12. Transformation and Transmutation

Do not add a generic transform force.

Use specific transformation primitives.

| Token | Meaning |
|---|---|
| morph | changes arrangement |
| warp | changes location |
| fuse | merges particles |
| fission | splits particles |
| decay | transforms or emits over time |
| spawn | creates budgeted particles |

### Warp

A paired relocation primitive.

```txt
if d < throatR:
localOffset = (p.pos - A.center) * scale
p.pos = B.center + rotate(localOffset, deltaTheta)
p.vel = rotate(p.vel, deltaTheta) * velocityScale
p.heat = max(p.heat, 0.6)
```

Add a cooldown to prevent immediate ping-pong.

### Fuse

A many-to-one merge.

```txt
if particles are close, hot, and compatible:
newMass = ma + mb
newVelocity = (ma * va + mb * vb) / newMass
heat += releasedEnergy
remove one particle
```

Conserve mass and momentum.

### Fission

A one-to-many split.

Must conserve mass and momentum.

Must be budgeted.

### Decay

A time or instability-driven transformation.

Must be budgeted.

## 13. Composites

Composites are named presets built from primitives.

They should not duplicate engine code unless a primitive is truly missing.

| Composite | Built From | Status |
|---|---|---|
| blackhole | attract + swirl + sink + lens | shipped |
| whitehole | repel + stream | shipped |
| star | gravity + thermal | shipped (pressure/fuse are future) |
| fountain | spawn + gravity (continuous, budgeted) | shipped |
| supernova | sink release | shipped as the `env.supernova` event, not a `data-preset` |
| wormhole | attract + warp, paired | proposed (needs `warp`) |
| pulsar | star + resonate + spotlight/stream | proposed |
| whirlpool | stronger swirl + attract/viscosity | proposed |
| shielded-chamber | screen + wall/gate | proposed (needs `screen`) |

The shipped preset table also includes `quasar`, `galaxy`, `nebula`, and `tornado`
(see `config/presets.ts`). `blackhole` uses the designed `attract` well, **not** natural
`gravity` — only `star` and `fountain` reach for `gravity` (per the layered-physics rule:
do not unify `attract` with `gravity`).

A composite should be described as a recipe.

## 14. Physical Modes

The system should not globally convert into a strict simulator.

Use a mode system.

```ts
type PhysicsMode = "designed" | "natural" | "hybrid";
```

### Designed

The current UI field.

- bounded force falloffs
- readable interactions
- damped motion
- predictable ranges
- unit mass by default
- best for content surfaces

### Natural

Physically coherent behavior.

- first-class mass
- real dt in seconds
- softened inverse-square laws
- physical drag
- conservation where appropriate
- best for Lab and cosmology

### Hybrid

Recommended long-term default.

- canonical UI forces remain designed
- natural primitives use physical semantics
- shared safety caps
- shared metrics
- visual compatibility with the current site

## 15. Integrator Modes

Recommended modes:

```ts
type IntegratorMode =
| "legacy-euler"
| "semi-implicit-euler-dt"
| "velocity-verlet";
```

### Legacy Euler

Compatibility mode.

```txt
v += forceDelta v *= damping x += v
```

### Semi-Implicit Euler With dt

Recommended first physical upgrade.

```txt
v += a * dt x += v * dt
```

### Velocity Verlet

Use for natural/cosmology mode.

```txt
x_next = x + v * dt + 0.5 * a * dt^2 a_next = F(x_next) / m v_next = v + 0.5 * (a + a_next) * dt
```

## 16. Medium and Damping

Global friction should be formalized as medium behavior.

Do not remove it outright.

```ts
type MediumMode =
| "designed-damping"
| "vacuum"
| "linear-drag"
| "quadratic-drag"
| "mixed-drag";
```

### Designed Damping

Preserves current feel.

```txt
v *= damping
```

### Vacuum

No global damping.

### Linear Drag

```txt
F_drag = -k * v
```

### Quadratic Drag

```txt
F_drag = -k * |v| * v
```

### Mixed Drag

```txt
F_drag = -k1 * v - k2 * |v| * v
```

## 17. Velocity Cap

Add a safety cap.

```ts
const speed = Math.hypot(p.vx, p.vy);
if (speed > velocityCap) {
const scale = velocityCap / speed;
p.vx *= scale;
p.vy *= scale; }
```

Use one symbolic constant:

```txt
c = velocityCap
```

Use c for:
- safety cap
- propagation semantics
- cosmology approximations
- source blast containment
- finite-speed field language

## 18. Softened Natural Laws

Natural inverse-square forces must be softened.

Never allow singularities.

```txt
F = G * source * target / (d^2 + epsilon^2)
```

Recommended:

```txt
epsilon = max(data-core, 2)
```

Apply to:
- gravity
- charge
- future inverse-square laws
- blackhole-like presets

Do not apply this rule to canonical attract or repel. They are designed wells.

## 19. Metrics

Metrics are measured properties. They are not forces.

Recommended field metrics:

| Metric | Meaning |
|---|---|
| density | local particle concentration |
| heat | local excitation |
| temperature | averaged heat or velocity agitation |
| entropy | disorder measurement |
| coherence | inverse disorder or heading alignment |
| momentum | aggregate motion |
| accreted | captured count ratio |
| phase | material state |

Entropy formula:

```txt
entropy =
velocityVariance * 0.35 +
heatVariance * 0.25 +
densityVariance * 0.25 +
spatialDispersion * 0.15
```

Coherence:

```txt
coherence = 1 - normalizedEntropy
```

Expected behavior:
- thermal increases entropy
- burst increases entropy
- supernova increases entropy sharply
- viscosity lowers velocity entropy
- diffuse lowers density variance
- align increases coherence
- crystallize lowers spatial entropy
- pressure lowers local density variance

## 20. Phase

Phase is a particle or region state.

Initial model:

```txt
0 = gas / free 0.5 = liquid / cohesive 1 = solid / crystallized
```

Affected by:
- thermal
- viscosity
- cohesion
- pressure
- crystallize
- diffuse
- propagate

Render mapping:
- gas: loose particles
- liquid: metaballs
- solid: lattice
- plasma or high heat: glow

## 21. Agent Model

Particles are not the only things forces can affect.

The system should generalize from particles to agents.

Agents:
- particle
- DOM element
- event sink
- current
- virtual body
- component host

A force produces influence at a location.

Each agent type consumes that influence differently.

| Influence | Particle consumes as | Element consumes as | Event sink consumes as |
|---|---|---|---|
| impulse | velocity and heat | transform offset | none |
| constraint | position/velocity clamp | transform clamp | none |
| capture | cap = body | dock/collapse | event |
| relocate | position jump | reordering/teleport | none |
| emit | new particle | cloned element | none |
| trigger | heat/state | class/CSS var | CustomEvent |

This makes the field more than a particle system. It becomes an interface physics substrate.

## 22. Events as Field Output

The field can drive behavior, not just pixels.

Recommended field events:

```txt
forces:lit forces:dim forces:saturated forces:supernova forces:entered forces:exited forces:density-change forces:captured forces:released
```

Events dispatch on the registered host.

Example:

```ts
host.dispatchEvent(new CustomEvent("forces:lit", {
bubbles: true,
composed: true,
detail: {
density: body.d,
heat: body.heat,
entropy: body.entropy
} }));
```

Use event thresholds carefully and debounce where necessary.

## 23. Shadow DOM Participation

> The full model — closed roots, `getRect` providers, virtual bodies, portals, SSR, and a
> `ForcesController` helper — is specified in [`shadow-dom.md`](shadow-dom.md). This is the
> summary. (Status: **proposed** — today the only custom elements are `<forces-field>` and
> `<forces-cell>`.)

Shadow DOM support means encapsulated components can participate in the same reciprocal field without exposing their internals.

Core rule:

Presentation can be private. Physical participation must be public.

A component may hide its shadow tree, but if it participates in the field it must expose:
- a registered element
- a rectangle
- force attributes
- a write-back target

Default registered body:

```txt
custom element host
```

Example:

```html
<forces-text
data-body="attract"
data-strength="0.9"
data-range="320"
data-feedback >
mass </forces-text>
```

The engine tracks <forces-text>, not its internal span.

## 24. Shadow DOM Registration

Use composed custom events.

```ts
this.dispatchEvent(new CustomEvent("forces:register-body", {
bubbles: true,
composed: true,
detail: {
element: this
} }));
```

Unregister:

```ts
this.dispatchEvent(new CustomEvent("forces:unregister-body", {
bubbles: true,
composed: true,
detail: {
element: this
} }));
```

Update:

```ts
this.dispatchEvent(new CustomEvent("forces:update-body", {
bubbles: true,
composed: true,
detail: {
element: this
} }));
```

The engine should not crawl shadow roots.

Closed shadow roots must work when the host is the body.

## 25. Shadow DOM Contract

Registration detail:

```ts
type ForcesRegisterBodyDetail = {
element: Element;
getRect?: () => DOMRect;
attrs?: Partial<ForcesBodyAttributes>;
scope?: "global" | "local";
field?: "nearest" | "root" | string; };
```

### Host Registration

Default.

Works with:
- open shadow roots
- closed shadow roots
- framework wrappers
- slotted content
- SSR upgrades

### Internal Body Registration

Allowed only when necessary.

Use a rect provider.

```ts
detail: {
element: this,
getRect: () => this.#internalBody.getBoundingClientRect() }
```

The engine writes state to the host unless a specific write target is declared.

## 26. Field Scopes

There are two participation modes.

### Global Participant

The component participates in the shared page field.

It does not create a local canvas.

Use for:
- text
- cards
- links
- buttons
- capability items
- navigation
- interactive bodies

### Local Simulation Cell

The component owns an isolated field.

Use for:
- docs
- Storybook
- Lab examples
- conformance visualization
- article demos
- playgrounds

Example:

```html
<forces-cell mode="local" formation="wells" density="0.8">
<forces-body data-body="attract" data-strength="1"></forces-body>
<forces-body data-body="repel" data-strength="1"></forces-body> </forces-cell>
```

A local cell should not affect the root field unless explicitly bridged.

## 27. Field Portals

A body may target a specific field.

```html
<forces-body data-field="hero-field" data-body="attract"></forces-body>
```

Target model:

```ts
type FieldTarget = "nearest" | "root" | string;
```

Use cases:
- modals affecting the root field
- overlays participating in page physics
- local demos joining global field intentionally
- app shell continuity
- cross-section field continuity

## 28. Styling Contract

The engine writes to the registered host.

> **Proposed namespace.** Today the engine emits `--d` (density), `--load` (accretion
> fraction), and `--lit` (causality). The explicit `--forces-*` names below are a proposed,
> collision-safe namespace — not yet written.

Minimum variables:

```css
--d --accent
```

Explicit variables:

```css
--forces-density --forces-accent --forces-heat --forces-entropy --forces-coherence --forces-accreted
```

Inside Shadow DOM, use explicit names and fall back to short names.

```css
:host {
--forces-density: var(--forces-density, var(--d, 0)); }
```

Recommended parts:

| Component | Parts |
|---|---|
| forces-text | label, glow, mark |
| forces-card | surface, content, aura, meter |
| forces-cell | canvas, overlay, controls |
| forces-body | body, icon, meter |

Use ::part() for controlled styling. Do not expose fragile internals.

## 29. Words and Marks

Words should remain real text.

Do not assemble words out of particles.

Words should receive:
- weight
- glow
- color
- density response
- field bend around the word
- engagement effects

Marks may be particle targets:
- period
- dot
- dash
- brackets
- logo glyph
- simple icon
- chart mark
- map point

Rule:

Words are bodies the field decorates. Punctuation and marks are where matter assembles.

## 30. Authoring API

Plain HTML:

```html
<a
data-body="sink attract"
data-strength="0.8"
data-range="340"
data-absorb="74"
data-max="44"
data-spin="1"
data-angle="0"
data-when="hot"
data-feedback
data-color="#ff9d5c" >
hi@example.com </a>
```

Custom element:

```html
<forces-text
data-body="attract"
data-strength="0.9"
data-range="320"
data-feedback >
mass </forces-text>
```

Programmatic:

```ts
field.registerBody(element, {
body: "attract",
strength: 0.9,
range: 320,
feedback: true });
```

Data binding:

```ts
bindData(container, records, record => ({
id: record.id,
force: record.categoryForce,
strength: record.prominence,
range: record.reach,
color: record.color,
when: record.state }));
```

## 31. Data as Physics

The field should become a renderer for data.

Map:
- category to force
- prominence to strength
- recency to heat
- relationships to threads
- state to condition
- density to typographic weight
- engagement to force amplification
- lifecycle to capture/release

This turns a dataset into a physical interface.

View-state examples:
- search results: scatter
- grouped browse: wells
- timeline: lanes
- opened item: accretion
- active graph: threads
- system stress: entropy visualization

## 32. Accessibility

The field must respect accessibility constraints.

Rules:
- Reduced motion freezes or simplifies motion.
- Focus must be supported as a first-class engagement input.
- Decorative local fields may be aria-hidden.
- Interactive cells need labels.
- Field state should not spam announcements.
- aria-pressed, aria-current, and similar states should only map to real interaction state, not decorative density.
- Keyboard focus can become a physical current, but reduced motion should use lit state without travel.

Example:

```html
<forces-cell aria-label="Interactive force simulation"></forces-cell>
```

Decorative:

```html
<forces-cell aria-hidden="true"></forces-cell>
```

## 33. Performance

Performance rules:
- Use one root canvas by default.
- Cap DPR, usually at 2.
- Skip offscreen bodies.
- Use dirty measurement where possible.
- Prefer ResizeObserver for geometry changes.
- Prefer IntersectionObserver for visibility.
- Use CSS.registerProperty for typed density variables.
- Use local cells sparingly and with low particle counts.
- Keep GPU backend opt-in.
- Avoid crawling shadow roots.

Antipattern:

```txt
one full-viewport canvas per component
```

Correct pattern:

```txt
one root field, explicit local cells only
```

## 34. Compositor Bridge

Register typed CSS properties:

```css
@property --forces-density {
syntax: "<number>";
inherits: true;
initial-value: 0; }
```

Also register:
- --forces-heat
- --forces-entropy
- --forces-coherence
- --forces-accreted
- --forces-lit

Use these for smoother interpolation and lower main-thread cost.

## 35. Conformance

The system must be verified by tests, not by watching the field.

Test layers:
- golden unit tests
- integrator tests
- conformance scenarios
- benchmarks
- visual Lab detector
- future parity tests

Every force needs:
- exact formula test where possible
- behavioral scenario
- no-effect-beyond-range check where relevant
- conservation check where relevant
- safety check

Global invariants:
- no NaN
- no Infinity
- velocity bounded
- heat bounded
- particle count stable unless a budgeted source is active
- source/sink budget enforced
- modifier order deterministic

## 36. Shadow DOM Tests

Required tests:
- host custom element registers successfully
- registration crosses shadow boundary
- closed shadow root works through host registration
- update event refreshes attributes
- unregister removes body
- disconnected hosts are pruned
- getBoundingClientRect() maps into root canvas
- local cell maps into local canvas
- CSS variables written to host affect shadow CSS
- local cell does not leak into root field
- virtual body IDs remain stable

## 37. Physics Tests

Required tests:
- designed mode matches current golden behavior
- natural mode uses a = F / m
- hybrid mode preserves canonical UI feel
- gravity uses softened inverse-square law
- charge ignores neutral particles
- magnetism preserves speed
- viscosity reduces speed without redirection
- quadratic drag affects high speed more than low speed
- velocity cap works
- source budget works
- fuse conserves mass and momentum
- fission conserves mass and momentum
- warp preserves particle count and velocity semantics

## 38. Roadmap

> **Status note.** This roadmap predates the physics workover and uses an earlier version
> numbering. The canonical, current plan is [`physics-workover.md`](physics-workover.md) and
> [`BACKLOG.md`](../BACKLOG.md): **v0.2.0** shipped the 33-force engine, and the "v0.2" items
> below (vortex→swirl reconciliation, `b.accreted`, the velocity cap, the safety sweep) shipped
> in the **v0.3** workover; the later phases map to v0.4–v0.6. Treat this as the conceptual arc,
> not the live schedule.

### v0.2: Reconciliation, Safety, Boundary

Ship:
- swirl formula reconciliation
- b.accreted rename
- velocity cap
- source budget guard
- modifier contract
- screen
- entropy/coherence metrics
- explicit CSS variables
- Shadow DOM host registration
- safety conformance tests

### v0.3: Physical Substrate

Ship:
- first-class mass
- dt seconds
- semi-implicit Euler with dt
- medium modes
- linear/quadratic drag
- softened inverse-square helper
- natural primitive coherence
- frame-rate independence tests

### v0.4: Transformation

Ship:
- warp
- wormhole
- fuse
- decay
- fission
- phase
- transformation docs
- conservation tests

### v0.5: Scale and Tooling

Ship:
- Velocity Verlet mode
- natural physics Lab preset
- record/replay
- property-based fuzzing
- CPU/GPU parity path
- debug overlays

### v0.6: Advanced Interface Substrate

Ship:
- field portals
- ElementInternals states
- advanced event sinks
- anchored UI bodies
- data binding API
- cross-document continuity
- render modes such as depth, knockout, and flow-field LIC

## 39. Component Model

Recommended custom elements:

| Element | Purpose |
|---|---|
| <forces-field> | root shared field |
| <forces-cell> | isolated local simulation |
| <forces-body> | generic body |
| <forces-text> | text body with density-driven type |
| <forces-mark> | mark/punctuation target |
| <forces-card> | structured content body |
| <forces-lab> | interactive scenario runner |
| <forces-debug> | diagnostics overlay |

Default behavior:

```txt
custom element host = registered body shadow internals = private presentation field state = CSS variables on host
```

## 40. Debugging

Debug overlays should show:
- body rect
- token list
- force class
- scope
- density
- heat
- entropy
- coherence
- accreted ratio
- velocity
- force vectors
- screen attenuation
- source budget
- rect source, host or custom getter
- field target, local or global

Shadow DOM bodies must be visible in debug overlays even when the root is closed.

## 41. Final Architecture

The final architecture has four layers.

### The Field

A shared physical substrate rendered through canvas.

### The Body System

A registry of elements, custom elements, virtual bodies, and data-bound records that source and receive field behavior.

### The Force System

A compact set of canonical, natural, material, boundary, transformation, and modifier tokens.

### The Participation Layer

A framework-neutral contract that lets light DOM, Shadow DOM, React, custom elements, and programmatic adapters register bodies into the same field.

## 42. Final Principle

The field does not care whether an element is plain HTML, Shadow DOM, React, a generated data record, a card, a word, a mark, or an event sink.

If it registers a body, it participates.

Presentation can be private.

Physics must be registered, measurable, and testable.

Elements bend the field.

The field bends them back.