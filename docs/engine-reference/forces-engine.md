> **Status: as-built force-engine reference.**
> Accurate for force formulas, catalogs, and engine behavior. It does NOT define the full current field-ui platform architecture — for that see [../canonical/field-ui-platform-architecture.md](../canonical/field-ui-platform-architecture.md) and [../canonical/field-ui-system-contracts.md](../canonical/field-ui-system-contracts.md).

# The Forces Engine — Module Map

A comprehensive map of the `@field-ui/core` engine: every source module, what it owns,
the data-flow that ties them together, and the catalogs (forces, classes, services, render
modes, formations, conditions, presets) the engine ships. This is the *engineering* companion
to [`forces-system.md`](forces-system.md) (the spec) and the per-force catalog in
[`packages/core/src/config/manual.ts`](../packages/core/src/config/manual.ts).

Source root: `packages/core/src/`. The `@field-ui/core` package itself has zero runtime
dependencies (the wider field-ui system is native-platform-first, dependency-light, and
framework-agnostic). Section refs (§) point into [`forces-system.md`](forces-system.md).

**Scope note (Phase D).** As of Phase D, DOM participation — scanning, measurement, CSS
feedback writes, shadow-DOM registration, and relationships — is owned by `@field-ui/platform`,
which is the default runtime for `<field-root>`. This engine remains the **renderer + force
math**: it computes renderer-agnostic field behavior and draws the canvas render surface.
`core/field.ts` still simulates and renders the canvas, while the platform owns DOM
participation; the two are wired together by the platform's `FrameScheduler` (phases:
discover → read → compute → state → write → render). You can opt back to pure-legacy behavior
with `experimental-platform="off"` or `usePlatformRuntime(false)`. Canvas is one render
surface, not the whole system; the platform binds the engine into a shared field context across
bodies, agents, relationships, measurements, metrics, feedback, and render surfaces.

---

## 1. The frame pipeline

`createField` ([`core/field.ts`](../packages/core/src/core/field.ts)) mounts the sim against a
`<canvas>` and runs a `requestAnimationFrame` loop. One tick:

| # | Stage | Owner | What happens |
|---|---|---|---|
| 0 | **Scan** (once + on `rescan`) | `scanner.ts`, `shadow.ts` | `[data-body]` elements + registered shadow hosts → `Body[]` (tokens, attrs, rect provider). Presets expand into co-located virtual bodies. |
| 1 | **Measure** | `field.ts` + `scanner.ts` | each body's `getBoundingClientRect()` → `cx/cy/hw/hh` (viewport coords). |
| 2 | **Reindex** | `field-store.ts` + `spatial-hash.ts` | rebuild the neighbour index over the live particle pool. |
| 3 | **Attention / causality** | `attention.ts`, `causality.ts` | conserved per-body strength multipliers; density spillover between neighbours. |
| 4 | **Step** | `integrator.ts` | per free particle: body forces (§4) → formation bias (§7) → integrate + damp. Class [B]/[C] forces read neighbours/grids via `Env`. |
| 5 | **Grids** | `scalar-grid.ts` | advance class-[C] fields one step (`diffuse` heat eq., `wave` leapfrog). |
| 6 | **Reservoir / currents** | `reservoir.ts`, `currents.ts` | bound↔free exchange (wave-healing, tearing), carrier-wave flow. |
| 7 | **Feedback / heatmap** | `feedback.ts`, `heatmap.ts` | write `--field-density` (compact alias `--d`) + `--field-heatmap-density` back onto elements. Under the platform runtime, `FeedbackRegistry` owns these writes and auto-mirrors `--field-*` → `--forces-*` and `field:*` → `forces:*`. |
| 8 | **Agents / events** | `agents.ts`, `events.ts` | move DOM elements by transform offset; dispatch debounced CustomEvents. |
| 9 | **Render** | `field.ts`, `render-modes.ts`, `streamlines.ts`, `fieldlines.ts` | draw the chosen render mode + optional field-line / heatmap overlays. |

The physics (steps 2–6) is pure and headless — the same code the conformance harness drives
([`conformance/run.ts`](../packages/core/src/conformance/run.ts)). `field.ts` is the only
browser/canvas glue.

Under the platform runtime (Phase D, the default for `<field-root>`), the DOM-facing stages —
scan (0), measure (1), feedback (7), shadow registration, and relationships — are owned by
`@field-ui/platform` and sequenced by its `FrameScheduler` (discover → read → compute → state →
write → render). The engine still drives the conserved physics (steps 2–6) and the render pass
(9). A `core/dom-boundary.test.ts` guard keeps `@field-ui/core` renderer-agnostic, allowlisting
only `core/field.ts` and `export.ts` to touch the DOM.

---

## 2. Module map

Path is relative to `packages/core/src/`. "Pure" = no DOM/canvas, unit-testable directly.

### Entry & orchestration

| Module | Key symbols | Purpose | Pure |
|---|---|---|---|
| `index.ts` | (re-exports) | Package entry — re-exports the whole public surface. | — |
| `core/field.ts` | `createField` | Browser entry (§13). Mounts canvas, scans bodies, runs the rAF loop (measure → reindex → step → render), exposes the `FieldHandle`. Pure glue. | no |
| `core/surface.ts` | `FIELD_CANVAS_STYLE`, `FIELD_CANVAS_CSS` | One source of truth for the fixed, click-through, behind-everything canvas styling every mount (vanilla / React / web component) uses. | yes |

### Core contracts & registry

| Module | Key symbols | Purpose | Pure |
|---|---|---|---|
| `core/types.ts` | `Particle`, `Body`, `Env`, `Force`, `Formation`, `Vec2`, `Token`, `AgentKind` | The contracts encoding the spec: data model (§3), force/agent registry (§4/§22), mass (§21), conditions (§5), formations (§7). | yes |
| `core/registry.ts` | `Registry`, `createRegistry` | The force + condition registry (§4). Engine owns the loop; forces/conditions register here. Seeds built-in conditions. | yes |
| `core/math.ts` | `clamp`, `lerp`, `dist`, `hexToRgb`, `RGB` | Small dependency-free math/colour helpers. | yes |

### Simulation core

| Module | Key symbols | Purpose | Pure |
|---|---|---|---|
| `core/integrator.ts` | `step`, `StepInput`, `FRICTION`, `HEAT_DECAY` | Advances the field one tick (§2.2/§7): body forces → formation bias → integrate + damp. Additive forces scaled by `1/m`; `kinematic` forces replace velocity. `dt=0` freezes (reduced motion, §18). | yes |
| `core/field-store.ts` | `FieldStore` | Owns the particle pool + spatial index (§20.1). add/remove, rebuild index per frame, answer `neighbors(p, r)`. Count is the conserved quantity (§2.4). | yes |
| `core/spatial-hash.ts` | `SpatialHash`, `Point` | Uniform-grid neighbour index — makes class-[B] forces O(n·k) not O(n²). Rebuilt each frame; `near(x, y, r)`. | yes |
| `core/scalar-grid.ts` | `ScalarGridImpl`, `GridMode` | Backing store for class-[C] forces: `diffuse` (heat eq. `∂φ/∂t=D∇²φ`) and `wave` (leapfrog `∂²φ/∂t²=c²∇²φ`). `deposit` / `gradient` / `step`. | yes |

### DOM bridge

These are the engine's DOM-facing helpers. Under the platform runtime (Phase D), `@field-ui/platform`
owns the live DOM participation — measurement (`MeasurementRegistry`), CSS feedback writes
(`FeedbackRegistry`), shadow-host registration, and relationships (`RelationshipRegistry`) — and
calls into these as needed via the `FrameScheduler`. The parsing/geometry below stays pure.

| Module | Key symbols | Purpose | Pure |
|---|---|---|---|
| `core/scanner.ts` | `scanBodies`, `parseBodyParams`, `bodyFromElement`, `expandPreset` | `[data-body]`/`[data-preset]` → bodies (§2.1/§3.1). Parsing is pure; measurement is thin `getBoundingClientRect` glue (the platform's `MeasurementRegistry` owns when this runs in the scheduler's read phase). | parse: yes |
| `core/shadow.ts` | `FieldController`, `ShadowRegistry`, `REGISTER_BODY`/`UNREGISTER_BODY`/`UPDATE_BODY`, `RegisterBodyDetail` | Host-first shadow-DOM participation ([shadow-dom.md](shadow-dom.md)). Component dispatches a `composed` event; the engine registers the HOST (never the shadow tree). | registry: yes |
| `core/feedback.ts` | `feedbackTarget`, `feedbackWeight` | Two-way density feedback (§8): the field writes gathered density back as `--field-density` (compact alias `--d`; `--forces-density` is a legacy/compat alias) so type glows/grows where matter collects. Under the platform runtime, `FeedbackRegistry` owns the write phase. | yes |
| `core/agents.ts` | `integrateOffset`, `anchorForce`, `elementMass`, `repelForce`, `densityPush` | Element agents (§22.4): a force moves a DOM element by a transform offset with an anchor spring back to its layout slot. | yes |
| `core/events.ts` | `parseEventBindings`, `triggerActive`, `EventBinding` | Event agents (§22.5): a force/condition firing on a body dispatches a debounced rising-edge CustomEvent (`data-on="dense:field:lit"`). | yes |

### Forces

| Module | Key symbols | Purpose |
|---|---|---|
| `forces/index.ts` | `attract`, `repel`, `swirl`, `stream`, `viscosity`, `jet`, `tether`, `wall`, `sink`, `registerCoreForces` | The **canonical nine** (§6) — designed, finite-range, soft falloff. |
| `forces/natural.ts` | `gravity`, `charge`, `magnetism`, `thermal`, `collide`, `diffuse`, `propagate`, `memory`, `registerNaturalForces` | The **natural eight** (§20.10) — real laws (softened `1/d²`, Lorentz, Langevin). `gravity`/`charge` share one kernel. Also exports the `field()` hooks (dipole/monopole). |
| `forces/extended.ts` | `lens`, `gate`, `buoyancy`, `shear`, `crystallize`, `align`, `wind`, `cohesion`, `pressure`, `hunt`, `link`, `morph`, `spawn`, `resonate`, `spotlight`, `pigment`, `fieldflow`, `registerExtendedForces` | The **designed-extended seventeen** (§20.3) — opt-in enrichments across classes [A]–[E],[S]. |

### Field systems (the visual / structure field)

| Module | Key symbols | Purpose | Pure |
|---|---|---|---|
| `core/geometry.ts` | `nearestOnRect`, `sdfRect`, `dipoleField`, `polePair`, `Pole`, `Rect` | Shaped-source geometry (Stage A): nearest point on a body's box, signed distance, and the two dipole poles along its heading — so `magnetism`/`charge` act/draw as real N→S / +→− fields. | yes |
| `core/fieldlines.ts` | `traceFieldLine`, `traceFieldLines`, `FieldSample` | Field-line tracer (Stage B2): step along a normalized vector field from a seed. Engine-agnostic — takes any `sample(x, y)`. | yes |
| `core/streamlines.ts` | `forceAt`, `netField` | Vector-field probe (§20.6 diagnostic): `forceAt` = net push on a still test particle (mirrors the integrator cull); `netField` = superposition of every body's `field()` hook (drives `fieldflow` via `env.fieldAt`). | yes |
| `core/heatmap.ts` | `Heatmap` | Density heatmap layer (H1) — a class-[C] scalar buffer of where matter pools, drawn as a glow underlay and sampled back as `--field-heatmap-density`. **Measures, never pushes** — not a force. | yes |

### Field structure & exchange

| Module | Key symbols | Purpose | Pure |
|---|---|---|---|
| `core/currents.ts` | `buildWaves`, `buildBound`, `waveYat`, `Wave`, `WavePull` | Carrier waves (§24/§2.3): five standing waveforms — the resting structure that carries bound particles and biases free ones. | yes |
| `core/reservoir.ts` | `healWaves`, `tearBoundNear`, `tearBoundByForces`, `induceCharges` | Bound↔free exchange (§2.4): calm matter snaps onto wave lines (capped); disturbances tear it loose. `induceCharges` polarizes neutral matter near charge/magnetism. | yes |
| `core/formations.ts` | `easeFormation`, `accretionTarget` | Formation helpers (§7): a global per-particle bias; the active preset eases toward target so transitions glide. | yes |
| `core/conditions.ts` | `conditions`, `passes` | Built-in `data-when` gate predicates (§5): `active`, `fast`, `slow`, `hot`, `cool`, `scrolling`. | yes |
| `core/attention.ts` | `attentionMuls`, `AttnInput` | Conserved attention (§2.4): one finite strength budget for the page; engaging a body pulls allocation off the rest. Returns per-body multipliers. | yes |
| `core/causality.ts` | `spillover`, `SpillBody` | Cross-boundary causality: a saturated body spills excess density to neighbours (conserved), so wiring between elements emerges. | yes |
| `core/reactions.ts` | `reactionIntensity`, `sparkCount`, `burstImpulse`, `recoilImpulse` | Micro-reactions (§23): energy removed at an interaction is rendered as sparks/flash. | yes |
| `core/render-modes.ts` | `linkAlpha`, `marchingCell`, `splatDensity`, `nearestSite`, `isoCross` | Draw-pass helpers for the non-`dots` render modes (links, metaballs/marching squares, voronoi) and the diagnostics render modes (field-lines, heatmap, force-vectors, contours, potential, energy, topology, inspector, causality, prediction — see §6 and `/docs/diagnostics`). | yes |

### Catalog / configuration (single sources of truth)

| Module | Key symbols | Purpose |
|---|---|---|
| `config/forces.config.ts` | `FORCES`, `FORCE_BY`, `FORMATIONS`, `CONDITIONS`, `PALETTE`, `ACCENT_JOURNEY` | Canonical catalog — the designed nine + the five formations + six conditions, with identity colours. |
| `config/manual.ts` | `MANUAL_FORCES`, `MANUAL_PRESETS`, `MANUAL_CONDITIONS`, `FORCE_COLORS`/`SYMBOLS`/`SUMMARIES`/`EFFECTS`/`EXAMPLES` | The **Field Manual** — the complete public definition of all 34 forces (formula, attrs, copy, colour, symbol). A test pins it to the registry so it can't drift. |
| `config/presets.ts` | `PRESETS`, `PresetEntry` | The eight cosmology presets (§20.9) as named arrangements of co-located virtual bodies. |
| `config/palettes.ts` | `PALETTES`, `resolvePalette` | Accent/particle colour ramps (`ours`, `heatmap`, `infrared`, `spectrum`, …) for the scroll journey (§9). |
| `config/tokens.ts` | `cssTokens` | Design tokens (§25.2) — the force palette + coherence + ease as injectable CSS custom properties. |

### Conformance (the Lab as a detector)

| Module | Key symbols | Purpose |
|---|---|---|
| `conformance/types.ts` | `Scenario`, `Expectation`, `ScenarioResult`, `FrameState`, `ForceClass` | A `Scenario` fires a known particle into a known force; an `Expectation` is a predicate over the result. Same catalog drives tests + the Lab. |
| `conformance/run.ts` | `runScenario`, `allForces`, `resolveBody` | Headless simulator — real `FieldStore`+`Env`+`step()`, real neighbours/grids, seeded RNG. Returns the trajectory + frame-0 force delta. |
| `conformance/expectations.ts` | `movesToward`, `speedPreserved`, `momentumConserved`, `exactDelta`, … | Named checks: invariants (robust to tuning) + exact per-frame Δv (pins the spec formula). |
| `conformance/experiments.ts` | `EXPERIMENTS`, `COMPOSITE_EXPERIMENTS` | One experiment per registered force (34) + 3 composites — the single source of truth for `conformance.test.ts` and the Lab. |

---

## 3. The force catalog (34)

Source of truth: [`config/manual.ts`](../packages/core/src/config/manual.ts). Class = the
implementation tier (see §4). Attrs are `data-*` (without the prefix).

### Canonical nine — `forces/index.ts` (§6, all class [A])

| Token | Does | Key attrs |
|---|---|---|
| `attract` | soft gravity-like well (optional orbital swirl) | strength, range |
| `repel` | soft outward push — carves a void | strength, range |
| `swirl` | tangential swirl + light inward retention | strength, range, spin |
| `stream` | steady directional current along a heading | strength, range, angle |
| `viscosity` | thickens the medium — bleeds momentum | strength, range |
| `jet` | draws matter in, jets it out (kinematic) | strength, range, angle |
| `tether` | holds matter at a rest-length shell | strength, range |
| `wall` | axis-aligned elastic bounce, sparks (kinematic) | — |
| `sink` | captures matter, then releases it (supernova) | absorb, max |

### Natural eight — `forces/natural.ts` (§20.10)

| Token | Class | Does | Key attrs |
|---|---|---|---|
| `gravity` | A | true softened inverse-square `GM/d²`; `|v|≤c` | strength, range |
| `charge` | A | signed `1/d²` — like repels, opposite attracts; radiates a monopole `field()` | strength, range, spin |
| `magnetism` | A | Lorentz rotation (⟂ to v, no work); radiates a dipole `field()` | strength, range, spin |
| `thermal` | A | Langevin/Brownian agitation (`√(2T)·ξ`) | strength, range |
| `collide` | B | elastic hard-sphere pair collisions | strength, range |
| `diffuse` | C | pheromone field — deposit a mark, follow the gradient | strength, range |
| `propagate` | C | travelling wave — ride the expanding front | strength, range |
| `memory` | C | occupancy grid — worn paths pull harder | strength, range |

### Designed-extended seventeen — `forces/extended.ts` (§20.3)

| Token | Class | Does | Key attrs |
|---|---|---|---|
| `lens` | A | rotates velocity (preserves speed) — bends paths | strength, range, spin |
| `gate` | A | one-way membrane — reflects the reverse direction | angle |
| `buoyancy` | A+E | lift/sink by density (size·heat) | strength, range |
| `shear` | A | laminar velocity gradient | strength, range, angle |
| `crystallize` | A | snaps cool matter to a lattice; melts when hot | strength, range |
| `align` | A/B | steers to a heading (preserves speed) — flocking | strength, range, angle |
| `wind` | A | divergence-free curl-noise turbulence | strength, range |
| `cohesion` | B | short-range push + mid-range pull — surface tension | strength, range |
| `pressure` | B | SPH density relaxation — even fill | strength, range |
| `hunt` | B+E | two-species predator/prey pursuit | strength, range |
| `link` | B | Verlet distance constraint — ropes, chains, cloth | strength, range |
| `morph` | D | assembles matter into a mark/chart (never words, §11) | strength, target |
| `spawn` | S | source — emits budgeted matter along a heading | strength, angle |
| `resonate` | A (modifier) | pulses sibling forces with a time-varying strength | strength, spin |
| `spotlight` | A (modifier) | gates sibling forces to an angular cone | angle |
| `pigment` | E | conserved colour transport — a dye that mixes | range, color |
| `fieldflow` | A | follow the field lines — steer onto + stream down the net `field()` (range 0 ⇒ global `magnetic` formation) | strength, range |

---

## 4. Particle (agent) classes

The implementation tier each force needs from `Env` (§20.1 / §22). Most forces are class [A].

| Class | Needs | Examples |
|---|---|---|
| **[A]** single-particle | only the shared per-frame `Env` (dx/dy/dist) | the nine, gravity, charge, magnetism, thermal, lens, gate, buoyancy, shear, crystallize, wind, fieldflow |
| **[B]** neighbour-coupled | `env.neighbors(p, r)` (spatial hash) | collide, cohesion, pressure, link, hunt, align |
| **[C]** field-buffer | `env.grid(name)` (scalar grid) | diffuse, propagate, memory, (heatmap layer) |
| **[D]** targeted | a per-particle assignment/target | morph |
| **[E]** conserved-carry | a conserved per-particle quantity (colour, tint) | pigment, (buoyancy/hunt tint) |
| **[S]** source | `env.spawn()` (budgeted, breaks conservation by design) | spawn, (sink release) |

---

## 5. The `Env` services

The shared per-frame environment handed to every force (`core/types.ts`), filled by the engine.

| Member | Type | Used by |
|---|---|---|
| `dx`, `dy`, `dist` | vector + distance, particle→body | every class-[A] force |
| `form` | the eased `Formation` | formation-aware forces (orbit, etc.) |
| `t`, `frameN`, `dt` | time / frame / step (0 = reduced motion) | time-varying terms (wind, resonate) |
| `c`, `G` | speed-of-light cap, gravitational constant (§20.10) | gravity, charge, clamps |
| `scrollV` | eased page-scroll speed | the `scrolling` condition |
| `spark(x,y,power,color?)` | micro-reaction | wall, impacts |
| `supernova(b)` | release captured matter | sink |
| `spawn(p)` | create a particle (pool-capped) | spawn, sources |
| `neighbors(p, r)` | spatial-hash query | class [B] |
| `grid(name)` | a named `ScalarGrid` | class [C] |
| `fieldAt(x, y)` | the net structure field (Σ `field()` hooks) | fieldflow |

---

## 6. Render modes, formations, conditions, presets

**Render modes** (one draw-pass swap, physics unchanged — §20.6). All modes are shipped and live
at `/docs/diagnostics`.

*Base modes:* `dots` (default, heat-tinted points), `trails` (long-exposure), `links` (particle
threads), `streamlines` (vector-field flow), `metaballs` (marching-squares iso-surface),
`voronoi` (nearest-site cells).

*Diagnostics modes:* `field-lines`, `heatmap`, `force-vectors`, `contours`, `potential`,
`energy`, `topology`, `inspector`, `causality`, `prediction`.

The **density heatmap** is also available as a separate glow *overlay layer* (`heatmap` option /
`toggleHeatmap`) layered under any base mode.

**Formations** (5 shipped — §7; global per-particle biases `{driftX, wander, orbit, spread,
conv}`): `ambient`, `wells`, `lanes`, `scatter`, `accretion`. (The larger list in
[`forces-system.md`](forces-system.md) §20.5 is spec-only.)

**Conditions** (6 — `data-when`, §5): `active`, `fast`, `slow`, `hot`, `cool`, `scrolling`.

**Presets** (8 — `data-preset`, §20.9; compositions of co-located virtual bodies):
`blackhole`, `whitehole`, `star`, `quasar`, `galaxy`, `nebula`, `tornado`, `fountain`.

---

## 7. Key types (`core/types.ts`)

| Type | What it is |
|---|---|
| `Particle` | a unit of matter: `x,y,vx,vy,m,heat,size`, optional `charge`, `age`, `cap` (captured-by body) |
| `Body` | a DOM element as a force source: `tokens`, geometry (`cx/cy/hw/hh`), `strength`, `range`, `spin`, `M`, `d` (eased density), `on` (engaged), `shaped`, `attn` |
| `Env` | the shared per-frame environment + services (see §5) |
| `Force` | `{ token, apply(b,p,env), kinematic?, modify?, source?, field?, targets? }` — the module contract (§4) |
| `Formation` | the global bias preset `{ driftX, wander, orbit, spread, conv }` |

---

## 8. Tests & conformance

- **362 tests**, every merge green. Golden per-force unit tests + the integrator suite +
  the conformance pass.
- **Conformance**: 34 `EXPERIMENTS` (one per registered force) + 3 `COMPOSITE_EXPERIMENTS`,
  driven through the real engine and deterministic. A **safety sweep** runs all 37 through
  global finite/bounded/conserved invariants (no NaN/Inf, `|v|≤c`, bounded heat, stable count).
- **Drift guards**: a test pins `manual.ts` to the registered force arrays (catalog can't fall
  out of sync); another asserts every registered force appears in
  [`forces-tests.md`](forces-tests.md). See [`forces-tests.md`](forces-tests.md) for the full
  conformance write-up.
