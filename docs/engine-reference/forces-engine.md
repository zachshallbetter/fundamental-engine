> **Status: as-built engine + platform module map.**
> Accurate for the source tree, force catalog, classes, services, render modes, and the
> platform topology as of current `main`. For the authoritative *architecture* narrative see
> [../canonical/platform-architecture.md](../canonical/platform-architecture.md),
> [../canonical/system-contracts.md](../canonical/system-contracts.md), and
> [../canonical/agent-consumption-model.md](../canonical/agent-consumption-model.md).
> The per-force formulas live in [forces-formulas.md](forces-formulas.md) and the catalog in
> `packages/core/src/config/manual.ts` (pinned to the registry by a test).

# The Field-UI Engine — Module Map

A comprehensive map of the engine: every source module, what it owns, the data-flow that ties
them together, and the catalogs (forces, classes, services, render modes, formations,
conditions, presets, recipes) it ships.

Two packages do the engine work (three thin authoring surfaces — `@fundamental-engine/{elements,react,vanilla}`
— wrap them):

- **`@fundamental-engine/core`** — `packages/core/src/`. The renderer + force math + the conserved
  simulation, plus the contracts, diagnostics, recipes, semantic/visual layers, and inspection.
  **Zero runtime dependencies** and renderer-agnostic: the `core/dom-boundary.test.ts` guard keeps an
  **empty allowlist** — no file in core may reference a DOM global. `field.ts` reaches the page only
  through the injected `FieldHost`; `export.ts` serializes a caller-supplied canvas.
- **`@fundamental-engine/dom`** — `packages/dom/src/`. The DOM participation layer: native-first
  registries (measurement, state, feedback, relationship, visual-binding, overlay) sequenced by
  one `FrameScheduler`. **Strict dependency direction:** platform depends on core for contracts;
  core never depends on platform.

Section refs (§) point into [forces-system.md](forces-system.md) and the canonical docs.

---

## 1. The frame pipeline

`createField(canvas, opts)` (`core/field.ts`) needs a `FieldHost` (`core/host.ts`) — the seam
that abstracts every DOM-global (viewport, scroll, rAF, reduced-motion, scan root). In the
browser the host is `browserHost()` from `@fundamental-engine/dom` (or the `createBrowserField`
convenience). Under the platform runtime (Phase D, the default for `<field-root>`) the DOM-facing
work is owned by the platform and sequenced by its `FrameScheduler`'s six phases:

| Phase | Owner | What happens |
|---|---|---|
| **discover** | `scanner.ts`, `shadow.ts`, platform `relationships.ts` | `[data-body]`/`[data-preset]` elements + registered shadow hosts → `Body[]`; relationships normalized from HTML/ARIA into a typed graph. |
| **read** | platform `measurement.ts` | every registered element's box read **once** per frame → an immutable geometry snapshot (no layout thrash). |
| **compute** | `integrator.ts` (+ `attention.ts`, `causality.ts`, `scalar-grid.ts`, `reservoir.ts`, `currents.ts`) | the conserved physics: body forces → formation bias → integrate + damp; grids advance; bound↔free exchange. **Pure & headless** — the same code the conformance harness drives. |
| **state** | platform `state.ts`, `metrics.ts` | typed per-element channels (density, attention, lit, pull, heat, entropy, coherence…) held, separate from ARIA. |
| **write** | platform `feedback.ts` (core `feedback.ts` math) | state → DOM: `--field-*` CSS vars (compact alias `--d`; legacy `--forces-*` auto-mirrored) + thresholded, debounced `field:*` events (legacy `forces:*` mirrored). |
| **render** | `field.ts`, `render-modes.ts`, `diagnostics/`, platform `overlays.ts` | draw the chosen render mode + optional field-line / heatmap / overlay layers. |

Opt back to pure-legacy (engine owns its own rAF + DOM) with `experimental-platform="off"` /
`usePlatformRuntime(false)`. Canvas is one render surface, not the whole system.

---

## 2. Core module map (`packages/core/src/`)

"Pure" = no DOM/canvas, unit-testable directly.

### Entry & seam

| Module | Key symbols | Purpose | Pure |
|---|---|---|---|
| `index.ts` / `export.ts` | (re-exports) / `segmentsToSvg`, `canvasToPng` | Package entry; field export serializers (SVG vector / PNG). | mixed |
| `core/field.ts` | `createField` | Mounts the canvas, runs the sim + render. The one DOM-touching engine module. | no |
| `core/host.ts` | `FieldHost`, `browserHost` (re-exported from platform) | The renderer/environment seam — every DOM-global goes through the injected host. | yes |
| `core/surface.ts` | `FIELD_CANVAS_STYLE` | One source of truth for the fixed, click-through canvas styling. | yes |

### Contracts & registry

| Module | Key symbols | Purpose |
|---|---|---|
| `core/types.ts` | `Particle`, `Body`, `Env`, `Force`, `Formation`, `Token`, `AgentKind` | The data model + force/agent contract (§3/§4/§22). |
| `core/registry.ts` | `Registry`, `createRegistry` | Force + condition registry; seeds built-in conditions. |
| `contracts/passport.ts` | `ForcePassport`, passports | Every force declares what it mutates, whether it does work / needs charge or velocity / touches neutral matter, and how it visualizes (system-contracts §3). |
| `contracts/guards.ts` | contract guards | Dev-mode runtime assertions: sources must be budgeted, visualizations must not mutate physics, particles stay finite (§17/§18). |
| `core/math.ts` | `clamp`, `lerp`, `hexToRgb`, `RGB` | Dependency-free math/color helpers. |

### Simulation core (all pure)

| Module | Key symbols | Purpose |
|---|---|---|
| `core/integrator.ts` | `step`, `FRICTION`, `HEAT_DECAY` | One tick: body forces → formation bias → integrate + damp. Additive forces ×`1/m`; `kinematic` forces replace velocity; `dt=0` freezes (reduced motion). |
| `core/field-store.ts` | `FieldStore` | Owns the particle pool + spatial index; count is the conserved quantity (§2.4). |
| `core/spatial-hash.ts` | `SpatialHash` | Uniform-grid neighbour index — class-[B] forces O(n·k) not O(n²). |
| `core/scalar-grid.ts` | `ScalarGridImpl` | Class-[C] backing store: `diffuse` (`∂φ/∂t=D∇²φ`) and `wave` (leapfrog) fields. |
| `core/accretion.ts` | accretion core | Pure sink submodel (§6.9): capture → hold (`cap=b`) → release exactly what was held. |

### Forces (registries)

| Module | Forces | Purpose |
|---|---|---|
| `forces/index.ts` | attract, repel, swirl, stream, viscosity, jet, tether, wall, sink | The **canonical nine** (§6) — designed, finite-range, soft falloff, class [A]. |
| `forces/natural.ts` | gravity, charge, magnetism, thermal, collide, diffuse, propagate, memory | The **natural eight** (§20.10) — real laws; `gravity`/`charge` share one kernel. Exports the `field()` hooks (dipole/monopole). |
| `forces/extended.ts` | lens, gate, buoyancy, shear, crystallize, align, wind, cohesion, pressure, hunt, link, morph, spawn, resonate, spotlight, pigment, fieldflow, **warp** | The **designed-extended eighteen** (§20.3) — opt-in enrichments across classes [A]–[E],[S]. |

### Field systems (visual / structure field)

| Module | Key symbols | Purpose |
|---|---|---|
| `core/geometry.ts` | `nearestOnRect`, `sdfRect`, `dipoleField`, `polePair` | Shaped-source geometry: nearest box point, signed distance, dipole poles — so `magnetism`/`charge` act/draw as real N→S / +→− fields. |
| `core/fieldlines.ts` | `traceFieldLine(s)` | Field-line tracer: step along any normalized `sample(x,y)` vector field. |
| `core/streamlines.ts` | `forceAt`, `netField` | Vector-field probe: net push on a still probe; `netField` = Σ of every body's `field()` (drives `fieldflow` via `env.fieldAt`). |
| `core/heatmap.ts` | `Heatmap` | Density scalar buffer drawn as a glow underlay, sampled back as `--field-heatmap-density`. Measures, never pushes. |
| `core/flow.ts` | `flowTo` | A movable *flow focus* the field bends toward (pull + curved streamlines), retargetable each frame (`field.flowTo()`). |
| `core/dock.ts` | dock decision | Element-level capture: a `[data-move][data-dock]` element inside a `sink`'s radius docks to the core (§22.3). |

### Field structure & exchange (all pure)

| Module | Key symbols | Purpose |
|---|---|---|
| `core/currents.ts` | `buildWaves`, `buildBound`, `waveYat` | Five carrier waveforms — the resting structure that carries bound particles, biases free ones (§24). |
| `core/reservoir.ts` | `healWaves`, `tearBound*`, `induceCharges` | Bound↔free exchange (§2.4); `induceCharges` polarizes neutral matter near charge/magnetism. |
| `core/formations.ts` | `easeFormation`, `accretionTarget` | Global per-particle bias, eased toward target so transitions glide (§7). |
| `core/conditions.ts` | `conditions`, `passes` | `data-when` gate predicates: active, fast, slow, hot, cool, scrolling (§5). |
| `core/attention.ts` | `attentionMuls` | Conserved attention: one finite strength budget; engaging a body pulls allocation off the rest (§2.4). |
| `core/causality.ts` | `spillover` | Cross-boundary causality: a saturated body spills excess density to neighbours (conserved). |
| `core/reactions.ts` | `sparkCount`, `burstImpulse` | Micro-reactions: energy removed at an interaction → sparks/flash (§23). |
| `core/render-modes.ts` | `marchingCell`, `splatDensity`, `nearestSite`, `linkAlpha` | Draw-pass helpers for the non-`dots` base modes (links, metaballs, voronoi). |

### Agents (§22 — field participants beyond particles)

| Module | Agent | Purpose |
|---|---|---|
| `core/agents.ts` | element offset | `integrateOffset`/`anchorForce`/`elementMass` — a force moves a DOM element by a transform offset, anchor-sprung back to its slot (§22.4). |
| `agents/element-agent.ts` | `ElementAgent` | A DOM element that receives the full metric set (density, attention, heat, entropy, coherence, memory, pressure, pull) and writes DOM state. |
| `agents/relationship.ts` | `RelationshipAgent` | An active connection between two bodies — strength/tension/memory; strengthens with use, decays, transfers attention, emits events (§7). |
| `agents/user-agent.ts` | `UserAgent` | User input as participation: pointer = wake, focus = attention source, selection = capture, scroll = current (a11y-aware). |
| `agents/region-agents.ts` | `LayoutAgent`, `DataAgent` | Region-level (a column/card aggregates the metrics under it) and record-level (a semantic record with decaying salience) participants. |
| `core/events.ts` / `agents/event-agent.ts` | `EventAgent`, `Thresholder` | Thresholded, debounced, hysteresis edges (`entered`/`exited`) → discrete `field:*` events, not per-frame noise (§9). |

### Diagnostics (reveal state, never mutate physics)

| Module | Purpose |
|---|---|
| `diagnostics/probes.ts` | A force's *vector* at a point (Δv on a probe) + per-token causality breakdown of why motion happened. |
| `diagnostics/render.ts` | Draw force-vectors, contours (marching squares), potential, energy onto a 2D context. |
| `diagnostics/modes.ts` | The four debug/graph modes: topology, inspector, causality, prediction. |
| `diagnostics/fields.ts` / `potential.ts` / `energy.ts` | Heatmap-variant samplers; scalar potential `Φ = −s/√(d²+ε²)` + grid sampler; pure kinetic/thermal/total energy accounting. |

### Recipes (portable field programs — authoring §5/§7)

| Module | Purpose |
|---|---|
| `recipes/schema.ts` | `FieldRecipe` schema + validation + serialization — a portable, inspectable field program. |
| `recipes/compile.ts` | Compiles a validated recipe → a runtime plan (DOM counterpart is platform `applyRecipe`). |
| `recipes/intent.ts` | Intent compiler: author says "draw-focus" → concrete tokens/attrs/render layers. |
| `recipes/explain.ts` | "Explain this field" + "field diff" — plain-language strings built from the passports. |
| `recipes/catalog.ts` / `gallery.ts` | The **64 portable recipes** in four `RECIPE_TIERS`; each doubles as a worked example + conformance fixture. |

### Semantic & visual language

| Module | Purpose |
|---|---|
| `semantic/layers.ts` | meaning→metric mapping (importance/confidence/urgency → the metric that expresses it). |
| `semantic/materials.ts` | Named compositions of real force tokens that define *feel* (validated against the passport registry). |
| `semantic/states.ts` | A named field-state set + the behavior each implies (state machines as physical scenes). |
| `visual/visualization.ts` | The visualization truth-table + render-mode catalog as inspectable data (what each mode reads, whether it mutates physics). |
| `visual/mapping.ts` / `channels.ts` | Pure metric(0..1)→visual-property functions (weight/hue/scale/glow) with accessibility caps; CSS string builders. |
| `visual/semantic-text.ts` / `lint.ts` | Keep expressive glyphs from being the only source of meaning; static scene-lint (magnetism w/o charge, fieldflow w/o a field, unbudgeted source, missing reduced-motion, color-only meaning). |

### Inspection & DOM bridge

| Module | Purpose |
|---|---|
| `inspect/snapshot.ts` | Deterministic seeded-scenario fingerprint (count + mean speed/heat) → catches accidental physics change (§12). |
| `inspect/report.ts` | Aggregates the whole model (contracts, passports, experiments, agents, recipes) + "is every force passported AND conformance-covered?". |
| `inspect/budget.ts` | Live counts vs a `PerformanceBudget`; reports every metric over its limit (§15). |
| `core/scanner.ts` | `[data-body]`/`[data-preset]` → bodies (parsing pure; measurement runs in the platform read-phase). |
| `core/shadow.ts` | `FieldController` / `ShadowRegistry` — host-first shadow-DOM registration (register the HOST, never the shadow tree). |
| `core/feedback.ts` | The density→`--field-density` write math (platform's `FeedbackRegistry` owns *when* it runs). |

### Catalog / config & conformance

| Module | Purpose |
|---|---|
| `config/manual.ts` | The **Field Manual** — complete public definition of all **36** forces (formula, attrs, copy, color, symbol). A test pins it to the registry. |
| `config/forces.config.ts` | Canonical nine + five formations + six conditions + identity colors. |
| `config/presets.ts` | The eight cosmology presets as co-located virtual bodies. |
| `config/palettes.ts` / `tokens.ts` | Accent/particle color ramps; design tokens as injectable CSS vars. |
| `conformance/{types,run,expectations,experiments}.ts` | Headless real-engine scenarios + named expectations; **36 `EXPERIMENTS` (one per force) + 3 `COMPOSITE_EXPERIMENTS`**. Source of truth shared by the tests and the Lab. |

---

## 3. The platform package (`@fundamental-engine/dom`)

Native-first registries; the participation surface Fundamental wishes the browser exposed. Depends
on core, never the reverse. Full architecture: [../canonical/platform-architecture.md](../canonical/platform-architecture.md).

| Module | Registry / role |
|---|---|
| `platform.ts` | `createFieldPlatform` — binds the registries to one shared `FrameScheduler`. |
| `schedule.ts` | `FrameScheduler` — the six ordered phases (discover → read → compute → state → write → render) so reads/writes never thrash layout. |
| `browser-host.ts` | `browserHost` / `createBrowserField` — the default `FieldHost` binding core to `window`/`document`/rAF. |
| `measurement.ts` | `MeasurementRegistry` — frame-stable geometry (read every box once per frame). |
| `state.ts` | `StateRegistry` — typed observable per-element channels, separate from ARIA. |
| `feedback.ts` | `FeedbackRegistry` — the write-phase: state → CSS vars + thresholded/debounced events. |
| `relationships.ts` | `RelationshipRegistry` — normalizes HTML/ARIA (`for`, `aria-controls`/`-describedby`/`-flowto`, `data-field-relation`) into one typed relationship graph. |
| `visual-bindings.ts` | `VisualBindingRegistry` — bind an expressive visual (SVG/Canvas/WebGL) to its semantic DOM source without double-exposing meaning (`data-field-visual-for` + `scan()`). |
| `overlays.ts` | `OverlayRegistry` — **Field Surfaces**: relationship lines, field lines, callouts, debug layers as render layers (`setOverlay` / `overlay="…"`). Reads registries; never mutates physics. |
| `bind-data.ts` | `bindData` — real application data as field participants (records→bodies, mapped metrics→state, relationships→edges; deterministic diff-by-id, decay-on-remove). |
| `apply-recipe.ts` | `applyRecipe` — the DOM counterpart to core's `compileRecipe` (registers bodies, binds metrics, installs reduced-motion output). |
| `metrics.ts` | The platform metric library (typed state values; pure math). |
| `export-dom.ts` / `lint.ts` | DOM download helpers (need `document`); platform guardrails (relation→missing id, visual duplicates text, state-without-registration). |

---

## 4. The force catalog (35)

Source of truth: `packages/core/src/config/manual.ts`. Class = implementation tier (§5).
Attrs are `data-*` (prefix dropped).

**Canonical nine** — `forces/index.ts` (§6, all class [A]): `attract`, `repel`, `swirl`,
`stream`, `viscosity`, `jet` (kinematic), `tether`, `wall` (kinematic), `sink`.

**Natural eight** — `forces/natural.ts` (§20.10):

| Token | Class | Does |
|---|---|---|
| `gravity` | A | true softened inverse-square `GM/d²`; `|v|≤c` |
| `charge` | A | signed `1/d²`; radiates a monopole `field()` |
| `magnetism` | A | Lorentz rotation (⟂v, no work); radiates a dipole `field()` |
| `thermal` | A | Langevin/Brownian agitation `√(2T)·ξ` |
| `collide` | B | elastic hard-sphere pair collisions |
| `diffuse` | C | pheromone field — deposit + follow the gradient |
| `propagate` | C | travelling wave — ride the expanding front |
| `memory` | C | occupancy grid — worn paths pull harder. *Classified as a semantic occupancy metric, not a physical force (#223).* |

**Designed-extended eighteen** — `forces/extended.ts` (§20.3):

| Token | Class | Does |
|---|---|---|
| `lens` | A | rotates velocity (preserves speed) — bends paths |
| `gate` | A | one-way membrane — reflects the reverse |
| `buoyancy` | A+E | lift/sink by density (size·heat) |
| `shear` | A | laminar velocity gradient |
| `crystallize` | A | snaps cool matter to a lattice; melts when hot |
| `align` | A/B | steers to a heading (preserves speed) — flocking |
| `wind` | A | divergence-free curl-noise turbulence |
| `cohesion` | B | short-range push + mid-range pull — surface tension |
| `pressure` | B | SPH density relaxation — even fill |
| `hunt` | B+E | two-species predator/prey pursuit |
| `link` | B | Verlet distance constraint — ropes/chains/cloth |
| `morph` | D | assembles matter into a mark/chart (never words, §11) |
| `spawn` | S | source — emits budgeted matter along a heading |
| `resonate` | A (mod) | pulses sibling forces `1 + sin(ωt)` |
| `spotlight` | A (mod) | gates sibling forces to an angular cone |
| `pigment` | E | conserved color transport — a dye that mixes |
| `fieldflow` | A | follow the field lines — steer onto + stream down the net `field()` (range 0 ⇒ global field-follow) |
| `warp` | A | relocates matter through a paired warp target (a portal): twist + scale, skips captured matter. Powers the `data-warp` element-relocate consumer. |

---

## 5. Particle (agent) classes

The tier each force needs from `Env` (§20.1/§22). Most forces are class [A].

| Class | Needs | Examples |
|---|---|---|
| **[A]** single-particle | the shared `Env` (dx/dy/dist) | the nine, gravity/charge/magnetism/thermal, lens, gate, buoyancy, shear, crystallize, wind, fieldflow, warp |
| **[B]** neighbour-coupled | `env.neighbors(p,r)` | collide, cohesion, pressure, link, hunt, align |
| **[C]** field-buffer | `env.grid(name)` | diffuse, propagate, memory, (heatmap) |
| **[D]** targeted | a per-particle target | morph |
| **[E]** conserved-carry | a conserved per-particle quantity | pigment, (buoyancy/hunt tint) |
| **[S]** source | `env.spawn()` (budgeted) | spawn, (sink release) |

---

## 6. The `Env` services

Shared per-frame environment (`core/types.ts`), filled by the engine: `dx/dy/dist`, `form`,
`t/frameN/dt`, `c/G`, `scrollV`, and services `spark`, `supernova`, `spawn`, `neighbors(p,r)`
(class B), `grid(name)` (class C), `fieldAt(x,y)` (net `field()` superposition — drives `fieldflow`).

---

## 7. Render modes, formations, conditions, presets

**Render modes** — one draw-pass swap, physics unchanged (§20.6); all shipped, live at
`/docs/diagnostics`.
- *Base:* `dots` (default), `trails`, `links`, `streamlines`, `metaballs`, `voronoi`.
- *Diagnostics:* `field-lines`, `heatmap`, `force-vectors`, `contours`, `potential`, `energy`,
  `topology`, `inspector`, `causality`, `prediction`.
- The density heatmap is also a separate glow *overlay layer* (`heatmap` option / `toggleHeatmap`).

**Formations** (5 — §7; biases `{driftX,wander,orbit,spread,conv}`): `ambient`, `wells`, `lanes`,
`scatter`, `accretion`. (The longer §20.5 list is spec-only.)

**Conditions** (6 — `data-when`): `active`, `fast`, `slow`, `hot`, `cool`, `scrolling`.

**Presets** (8 — `data-preset`): `blackhole`, `whitehole`, `star`, `quasar`, `galaxy`, `nebula`,
`tornado`, `fountain`.

---

## 8. Declarative surfaces (the author-facing contract)

| Attribute / API | What it does |
|---|---|
| `data-body` / `data-preset` | turn an element into a force source / preset composition |
| `data-strength` `data-range` `data-spin` `data-angle` `data-color` `data-feedback` `data-shaped` | force params + opt-in density write-back + shaped sampling |
| `data-when` | condition gate (§5) |
| `data-move` + `data-dock` / `data-warp` / `data-emit` | **element agent consumers**: a moved element docks into a sink, relocates through a warp, or emits clones |
| `field:captured` / `field:released` / `field:relocated` | dispatched agent events (legacy `forces:*` mirrored) |
| `data-field-relation` / ARIA (`for`, `aria-controls`, …) | relationships normalized into the typed graph |
| `data-field-visual-for` + `scan()` | declarative visual binding (an expressive visual ↔ its semantic source) |
| `setOverlay` / `overlay="…"` | Field Surfaces overlay layers over/under content |
| `field.flowTo(x,y)` | retarget the flow focus each frame |
| `bindData(...)` / `applyRecipe(...)` | data + portable recipes as field programs |

---

## 9. Key types (`core/types.ts`)

`Particle` (`x,y,vx,vy,m,heat,size`, optional `charge`/`age`/`cap`, plus warp fields), `Body`
(tokens + geometry + `strength/range/spin/M/d/on/shaped/attn` + warp params), `Env` (§6), `Force`
(`{token, apply, kinematic?, modify?, source?, field?, targets?}` + a `passport`), `Formation`.

---

## 10. Tests & conformance

- **Conformance**: 36 `EXPERIMENTS` (one per registered force) + 3 `COMPOSITE_EXPERIMENTS`,
  driven through the real engine and deterministic (seeded RNG). A **safety sweep** runs them all
  through global finite/bounded/conserved invariants (no NaN/Inf, `|v|≤c`, bounded heat, stable
  count). Snapshot regression (`inspect/snapshot.ts`) catches accidental physics drift.
- **Drift guards**: `config/manual.ts` is pinned to the registered force arrays; `forces-tests.md`
  must backtick every registered force; `core/dom-boundary.test.ts` keeps core renderer-agnostic;
  every force is checked to be both **passported** and **conformance-covered** (`inspect/report.ts`).
- Run `pnpm --filter @fundamental-engine/core test` (Node's built-in `node:test`, zero framework). Full write-up:
  [forces-tests.md](forces-tests.md) and [../canonical/testing-and-conformance.md](../canonical/testing-and-conformance.md).
