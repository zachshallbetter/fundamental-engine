# Codebase Conformance & Alignment Audit

This report details the findings from an exhaustive, line-by-line review of the engine core packages (`@fundamental-engine/core` and `@fundamental-engine/dom`) to verify compliance with the canonical documents, specifications, and naming conventions defined in the documentation corpus.

---

## 1. Concept vs. Code Discrepancies

These are areas where the codebase and the documentation specifications have drifted or directly contradict each other.

### 1.1 `IntegratorMode` Configuration Options
* **The Spec ([substrate-api.md](../../docs/canonical/substrate-api.md))**:
  ```typescript
  type IntegratorMode = 'legacy' | 'fixed';
  ```
* **The Code ([types.ts](../../packages/core/src/engine/types.ts#L447))**:
  ```typescript
  export type IntegratorMode = 'legacy' | 'fixed' | 'velocity-verlet';
  ```
* **The Draft ([physics-workover.md](../../docs/engine-reference/physics-workover.md))**:
  References `IntegratorMode = 'legacy-euler' | 'semi-implicit-euler-dt' | 'velocity-verlet'`.
* **Impact**: The documentation is internally inconsistent and fails to advertise the second-order `'velocity-verlet'` integration scheme implemented in the physics engine.

### 1.2 Unimplemented Fluid Drag & Medium Models
* **The Spec ([physics-workover.md](../../docs/engine-reference/physics-workover.md))**:
  Drafts complex medium and drag behaviors:
  ```typescript
  type MediumMode = 'designed-damping' | 'vacuum' | 'linear-drag' | 'quadratic-drag' | 'mixed-drag';
  type DragMode = 'linear' | 'quadratic' | 'mixed';
  type MediumConfig = { ... };
  ```
* **The Code**: There is no implementation of `MediumMode`, `DragMode`, or `MediumConfig` in `packages/core`. Damping remains hardcoded to `FRICTION = 0.95` inside [integrator.ts](../../packages/core/src/engine/integrator.ts#L40).
* **Impact**: The published reference documentation details API specifications that do not exist at runtime.

### 1.3 Fixed Mode Force Impulse $dt$-Scaling
* **The Spec**: Asserts that under the `'fixed'` integrator mode, force impulses and friction decays scale with $dt$ to make motion consistent across varying frame rates.
* **The Code ([integrator.ts:applyForce](../../packages/core/src/engine/integrator.ts#L157-L164))**:
  Explains that the engine **does not** scale force impulses in the integrator loop due to pairwise momentum constraints:
  ```typescript
  // NOTE (doc 04 §Step 3): the fixed-timestep integrator does NOT dt-scale force impulses here.
  // The single-particle capture trick (rescale p's Δv) is unsound for forces that also mutate a
  // neighbour in the same pass — collide/link apply an equal-and-opposite impulse to q...
  // Fixed mode currently corrects only the per-step decays.
  ```
* **Impact**: While decays (friction, thermal noise) are frame-rate independent in fixed mode, force impulses remain dependent on tick rate, creating a mismatch with documentation claims of frame-rate-independent simulation behavior.

### 1.4 Naming Discipline Violation: `'absorb'` Event vs. `'sink'` Token
* **The Spec ([common-mistakes.md](../../docs/canonical/common-mistakes.md))**:
  Enforces a strict lane discipline separating descriptive concepts from execution names:
  > `absorb` is concept language; the token is `sink`. Concepts describe, tokens execute — never mix them.
* **The Code ([events.ts](../../packages/core/src/engine/events.ts#L18))**:
  The discrete event bus still uses `'absorb'` as the event type key:
  ```typescript
  export interface FieldEventMap {
    absorb: { body: Body; count: number };
    release: { body: Body; count: number };
  }
  ```
  A similar naming spillover occurs in [states.ts](../../packages/core/src/semantic/states.ts#L35) where the `'pressed'` field state behavior describes the sink token as `'sink (absorb)'`.
* **Impact**: This introduces conceptual language directly into the execution/event layer, breaching naming lane boundary rules.

---

## 2. File-by-File Core System Analysis

### 2.1 Physics and Integrator: [integrator.ts](../../packages/core/src/engine/integrator.ts)
* **Mechanics**: Implements standard Verlet and Semi-Implicit Euler integration loops, handles boundary collisions (toroidal wrapping, screen borders), and decays kinetic energy and heat.
* **Review**: Correctly scales decay rates ($Math.pow(FRICTION, dt)$) and Langevin kicks ($Math.sqrt(dt)$) to support frame-rate independent metrics under the `fixed` step mode. However, as noted in §1.3, individual force impulses are not scaled by $dt$.

### 2.2 Domain Scanner & Preset Compiler: [scanner.ts](../../packages/core/src/engine/scanner.ts)
* **Mechanics**: Scans subtrees matching [BODY_SELECTOR](../../packages/core/src/engine/scanner.ts#L279), expands presets from [PRESETS](../../packages/core/src/config/presets.ts), and parses variables (`data-strength`, `data-range`, `data-spin`, `data-angle`).
* **Compliance**: Handled purely DOM-free using a `BodyAttrs` adapter interface. Correctly enforces the *Source Budget Contract* by warning on unbudgeted Class-[S] spawning bodies and falling back to safe limits.
* **Precedence Order**: Explicit element attributes override intent/role compiled configurations:
  ```typescript
  get: (name) => el.getAttribute('data-' + name) ?? defaults[name] ?? null
  ```

### 2.3 Conserved Attention Allocator: [attention.ts](../../packages/core/src/engine/attention.ts)
* **Mechanics**: Allocates attention budget among competing bodies using a water-filling algorithm in [allocateAttention](../../packages/core/src/engine/attention.ts#L70).
* **Compliance**: Perfectly matches the conserved-attention budget theorem ($\Sigma w_i = \text{budget}$). Supplying a pinned state correctly reserves `cap` space off the top, allocating remaining margins across active contenders.

### 2.4 Proximity Density Spillover: [causality.ts](../../packages/core/src/engine/causality.ts)
* **Mechanics**: Transports excess density ($d_i > \theta$) to nearby bodies via a Gaussian falloff calculation in [spillover](../../packages/core/src/engine/causality.ts#L40).
* **Compliance**: Strictly conserved ($\Sigma \Delta_i = 0$), preventing phantom density creation across borders.

### 2.5 Local Thermodynamics Metrics: [thermo.ts](../../packages/core/src/engine/thermo.ts)
* **Mechanics**: Transforms neighbor sample counts, speeds, and kinetic energies into macro indicators (`entropy`, `coherence`, `temperature`).
* **Compliance**: Bilinear velocity alignment $R = |\Sigma v| / \Sigma |v|$ maps direction dispersion accurately. Low-speed neighborhoods drop entropy, meaning order naturally emerges when motion freezes under `prefers-reduced-motion`.

### 2.6 Bound and Free Reservoirs: [reservoir.ts](../../packages/core/src/engine/reservoir.ts)
* **Mechanics**: Manages particle snapping ([healWaves](../../packages/core/src/engine/reservoir.ts#L19)) onto wave structures and tearing ([tearBoundByForces](../../packages/core/src/engine/reservoir.ts#L105)) them back into the free particle pool.
* **Compliance**: Conserves particle identity and count throughout snapping/tearing phases. [induceCharges](../../packages/core/src/engine/reservoir.ts#L214) seeds electric charges based on the entry hemisphere relative to the heading axis, unlocking charge/magnetism dynamics for neutral matter.

### 2.7 Shadow DOM Boundary Integration: [shadow.ts](../../packages/core/src/engine/shadow.ts)
* **Mechanics**: Integrates encapsulated web components using composed, bubbling DOM events ([field:register-body](../../packages/core/src/engine/shadow.ts#L17)).
* **Compliance**: Encapsulates component internal trees; registers only the custom host element, utilizing custom `getRect` callbacks for closed roots and directing CSS feedback writes to specified `writeTarget` elements.

### 2.8 Diagnostic Visualizations: [streamlines.ts](../../packages/core/src/engine/streamlines.ts) & [fieldlines.ts](../../packages/core/src/engine/fieldlines.ts)
* **Mechanics**: Generates net force vector arrows at grid points ([forceAt](../../packages/core/src/engine/streamlines.ts#L19)) and traces field paths from magnetic/charge dipole seeds ([traceFieldLine](../../packages/core/src/engine/fieldlines.ts#L99)).
* **Compliance**: Implements a `maxTurns` orbit limit to prevent infinite loops and excessive stroke drawing costs on overlapping paths.

### 2.9 Field Flow Transport: [flow.ts](../../packages/core/src/engine/flow.ts)
* **Mechanics**: Curves streamlines and pulls particles toward a transient focus point.
* **Compliance**: Optimization-safe; [flowBiasInto](../../packages/core/src/engine/flow.ts#L58) writes coordinates into a caller-owned scratchpad, avoiding allocating coordinate object structures in high-frequency hot loops.

### 2.10 Math and Colors: [math.ts](../../packages/core/src/math/math.ts)
* **Mechanics**: Implements hex parser, linear interpolation (lerp), pigment mixing, and HSL mapping helper formulas.
* **Compliance**: Reuses shared RGB arrays on hot rendering loops ([particleRGBInto](../../packages/core/src/math/math.ts#L39)) to keep allocation count zero.

### 2.11 Core Geometries: [geometry.ts](../../packages/core/src/math/geometry.ts)
* **Mechanics**: Calculates 2D bounding boxes and signed distance functions ([sdfRect](../../packages/core/src/math/geometry.ts#L61)) for bodies.
* **Compliance**: Correctly resolves dipole vectors and poles ([polePair](../../packages/core/src/math/geometry.ts#L76)) along the heading axis for non-point magnetic/charge sources.

### 2.12 Built-in Conditions: [conditions.ts](../../packages/core/src/engine/conditions.ts)
* **Mechanics**: Standard filters (`fast`, `slow`, `hot`, `cool`) that selectively gate particle movements.
* **Compliance**: Evaluates threshold velocities and temperature levels, allowing bodies to filter out neutral/dormant matter.

### 2.13 Registry Manager: [registry.ts](../../packages/core/src/engine/registry.ts)
* **Mechanics**: Exposes force and condition registration mappings.
* **Compliance**: Allows external extensions or modules to plug custom forces dynamically into the active engine.

### 2.14 Diagnostic Heatmaps: [heatmap.ts](../../packages/core/src/engine/heatmap.ts)
* **Mechanics**: Accumulates particle history and blurs paths using local diffusion steps.
* **Compliance**: Eases normalizer peak value dynamically to avoid division-by-zero or flash spikes when the field empties.

### 2.15 Core Forces catalog: [forces/index.ts](../../packages/core/src/forces/index.ts)
* **Mechanics**: Implements the 9 canonical forces (`attract`, `repel`, `swirl`, `stream`, `viscosity`, `jet`, `tether`, `wall`, `sink`).
* **Compliance**: Correctly reflects speeds kinematic-style for rigid boundaries (walls) and nozzles (jets), bypasses mass adjustments, and uses Box-Muller normal transforms for random tangential spreads.

### 2.16 Natural Force Laws: [forces/natural.ts](../../packages/core/src/forces/natural.ts)
* **Mechanics**: Softened gravity, Coulomb charge attraction/repulsion, and 2D cyclotron Lorentz magnetism deflection.
* **Compliance**: Leverages Schwarzschild radius as Plummer softening to prevent singular density divisions at core contacts.

### 2.17 Extended Forces: [forces/extended.ts](../../packages/core/src/forces/extended.ts)
* **Mechanics**: Employs lattices (crystallize), flocking heading averaging (align/cohesion), SPH pressure relaxations, teleports (warp), and filters (spotlight/screen).
* **Compliance**: Adheres strictly to performance boundaries; screen modifiers damp sibling velocities smoothly near texts without hard coordinate clipping.

### 2.18 Semantics Mappings: [semantic/layers.ts](../../packages/core/src/semantic/layers.ts), [materials.ts](../../packages/core/src/semantic/materials.ts) & [states.ts](../../packages/core/src/semantic/states.ts)
* **Mechanics**: Transforms conceptual layer urgency, importance, and fabric feel to concrete force vectors and render overlays.
* **Compliance**: Safely maps state boundaries without editing live parameters, ensuring pure configurations.

### 2.19 Visual Channels: [visual/channels.ts](../../packages/core/src/visual/channels.ts), [lint.ts](../../packages/core/src/visual/lint.ts), [semantic-text.ts](../../packages/core/src/visual/semantic-text.ts) & [visualization.ts](../../packages/core/src/visual/visualization.ts)
* **Mechanics**: Maps metrics to CSS values (optical scale, HSL color, variable font weights), performs accessibility audits, and verifies semantic screen-reader-only labels.
* **Compliance**: Ensures all color layers adhere to minimum lightness and desaturation boundaries to comply with contrast constraints.

### 2.20 Recipes & Intent Compiler: [recipes/schema.ts](../../packages/core/src/recipes/schema.ts) & [compile.ts](../../packages/core/src/recipes/compile.ts)
* **Mechanics**: Parses portable recipes into executable programs and builds layout and reduced-motion fallback options.
* **Compliance**: Gathers all metrics and diagnostics without silent failures or dropped targets.

### 2.21 Headless Record/Replay: [record/record.ts](../../packages/core/src/record/record.ts)
* **Mechanics**: Seeds RNG and clocks to capture deterministic, stride-packed particle trajectories.
* **Compliance**: Uses flat Float32Arrays for compact serialization, avoiding frame-by-frame object allocation during simulation runs.

### 2.22 System Guards & Passports: [contracts/guards.ts](../../packages/core/src/contracts/guards.ts) & [types.ts](../../packages/core/src/contracts/types.ts)
* **Mechanics**: Enforces non-negotiable assertions (finite particle coordinates, budgeted sources, pure visual layers, performance margins) at dev-time.
* **Compliance**: Checks are compiled out under production node environments ($process.env.NODE\_ENV === 'production'$), leaving production performance unaffected.

### 2.23 Configuration Layer: [config/](../../packages/core/src/config)

This directory serves as the centralized repository of color tokens, composite presets, mathematical references, and developer-facing documentation metadata.

#### 2.23.1 Canonical Force Definitions: [forces.config.ts](../../packages/core/src/config/forces.config.ts) & [tokens.ts](../../packages/core/src/config/tokens.ts)
* **Mechanics**: Declares the canonical nine forces (`attract`, `jet`, `tether`, `wall`, `stream`, `repel`, `viscosity`, `swirl`, `sink`), defining their hex identity colors, target disciplines (e.g. *Product strategy*), and default parameter attributes.
* **Token Exportation**: `cssTokens()` formats these definitions programmatically into standard CSS custom properties (e.g., `--f-attract`), ensuring that the browser stylesheet's visual cues remain synchronized with registry colors.

#### 2.23.2 Field Manual Registry: [manual.ts](../../packages/core/src/config/manual.ts)
* **Mechanics**: Houses the complete developer-facing catalog of all 36 forces across the three families (canonical, natural, extended). Each entry logs the periodic-table style abbreviation symbol (e.g., `At` for attract), mathematical formula descriptions, and calibration values (approximate $\Delta v$ velocity output at a $100\text{px}$ reference distance).
* **Drift Protection**: Validated by `manual.test.ts`, which asserts that every entry is matched by a registered force in the active engine core, preventing un-passported or dead configurations.

#### 2.23.3 Composite Presets: [presets.ts](../../packages/core/src/config/presets.ts)
* **Mechanics**: Defines named multi-body compositions (e.g., `blackhole`, `quasar`, `nebula`, `fountain`) that map multiple co-located primitives onto a single DOM element boundary.
* **Design Solution**: Solves parameter sharing restrictions (where a single element using `data-body` must share a uniform strength/range) by expanding into multiple virtual bodies, allowing independent limits for horizons (`sink.absorb = 42`) and attraction wells (`attract.range = 340`).
* **Source Budgeting Compliance**: Presets that spawn matter (such as `fountain` using `spawn`) explicitly declare their `life` (lifespan) and `cap` parameters, ensuring they pass the source budget contract validation automatically.

#### 2.23.4 Ambient Themes and Ramps: [themes.ts](../../packages/core/src/config/themes.ts) & [palettes.ts](../../packages/core/src/config/palettes.ts)
* **Mechanics**: Bundles the ambient particle heat gradient ends (`cool` and `warm` RGB colors) and background wave baseline layers into named presets (`warm`, `cool`, `mono`), allowing complete visual transitions without code changes.
* **Scroll Journey Accents**: Houses the custom traveling stops used to update elements dynamically as a reader scroll-progresses down the page.

---

## 3. Performance & Allocation Gaps

### 3.1 Spatial Hash Memory Allocations
* **The Issue**: [spatial-hash.ts:insert](../../packages/core/src/engine/spatial-hash.ts#L33) instantiates a new array literal whenever a grid cell/bin is empty:
  ```typescript
  const bin = this.bins.get(k);
  if (bin) bin.push(item);
  else this.bins.set(k, [item]); // Allocates array literal [item]
  ```
  Since the spatial index is entirely cleared and rebuilt every frame, this generates substantial garbage collection overhead, particularly when simulated particle counts are high.
* **Remedy**: Pre-allocate or pool cell arrays, or clear array lengths instead of discarding references.

### 3.2 Compositing Performance (The Mix-Blend Canvas Trap)
* **The Issue**: A full-viewport `mix-blend-mode` canvas forces the browser to re-composite the entire screen every frame, even when no drawings are on the canvas.
* **Compliance**: [lint.ts:lintCompositingPerf](../../packages/dom/src/lint.ts#L344) audits canvas inline styles and issues a warning if a full-viewport mix-blend canvas has an unsized backing store ($0 \times 0$) but remains visible. Setting `display: none` gates it out of the browser's compositing tree.


### 3.3 Benchmark Execution and Force Token Mismatches
* **The Issue**: [integrator.bench.ts](../../packages/core/bench/integrator.bench.ts#L71) declared a static list of force tokens to cycle through:
  ```typescript
  const TOKENS = ['attract', 'repel', 'vortex', 'stream', 'drag', 'spring', 'gravity', 'wind'];
  ```
  However, `'vortex'`, `'drag'`, and `'spring'` were non-canonical tokens that do not exist in the engine's force registry. As a result, the integrator silently skipped the force application steps for bodies carrying these tokens. The benchmark was executing a simulation where some bodies were effectively inactive, leading to skewed/artificially low execution times.
* **Remedy**: Corrected the benchmark tokens to their canonical equivalents:
  ```typescript
  const TOKENS = ['attract', 'repel', 'swirl', 'stream', 'viscosity', 'tether', 'gravity', 'wind'];
  ```
  This ensures that every body in the simulation executes its physical logic and accurately represents runtime workload.

---

## 4. In-depth Semantic Layer Analysis

The semantic layer bridges developer intent with the simulation engine, converting user interface concepts into physical forces. A line-by-line review of the modules in [packages/core/src/semantic](../../packages/core/src/semantic) reveals several structural constraints, design assumptions, and minor inconsistencies.

### 4.1 Silent Conceptual Metric Dropping
In [layers.ts](../../packages/core/src/semantic/layers.ts#L50), `semanticToMetrics` converts a semantic value into an `ElementMetrics` contribution:
```typescript
if (m.metric === 'phase' || m.metric === 'potential') return {};
```
* **Analysis**: Semantic layers like `status` (which maps to `'phase'`) and `hierarchy` (which maps to `'potential'`) are dropped silently, returning an empty object. Because these metrics are purely conceptual/visual and do not correspond to scalar variables in the physics loop, they do not participate in the core math.
* **Risk**: Consuming applications attempting to drive element states programmatically via these semantic channels will receive no metric output and no console warning, which could mask integration issues.

### 4.2 Overlapping Metric Destinations (Collision Risks)
Multiple semantic definitions write to the same physical metric channels:
* `importance` and `priority` both target `attention`.
* `urgency` and `recency` both target `heat`.
* `relationship` and `history` both target `memory`.
* **Analysis**: Since `semanticToMetrics` returns isolated metric update objects, if a developer attaches multiple attributes (e.g. `data-semantic-layer="urgency"` and `data-semantic-layer="recency"`) to a single element, they will conflict or overwrite depending on evaluation order. The engine does not provide a resolution strategy (such as max-value blending or sum-blending) for co-occurring layers writing to the same physical metric channel.

### 4.3 Material descriptive note discrepancies
The `note` fields in [materials.ts](../../packages/core/src/semantic/materials.ts#L30) deviate from the executable force tokens defined in their respective recipes:
* **Glass**: Mapped tokens are `['lens', 'wall']`, but the descriptive note lists `'lens + reflect + low drag'`. There is no force representing "drag" or "viscosity" included in the tokens list.
* **Rubber**: Mapped tokens are `['tether', 'viscosity']`, but the note lists `'spring + damping'`. These represent conceptual aliases for the physical tokens.
* **Smoke**: Mapped tokens are `['diffuse', 'stream']`, but the note lists `'diffuse + stream + entropy'`. The entropy component (usually supplied by the `thermal` force) is absent from the execution list.
* **Impact**: While minor, these discrepancies show a conceptual gap between the developer-facing descriptive comments and the actual forces loaded at runtime.

---

## 5. Security, Policy, & Meta-Contract Systems

A deep audit of the top-level test files and contract enforcement layers reveals how security, capability scoping, and test integrity are maintained, alongside minor legacy gaps in event dispatch mapping.

### 5.1 Scoped Agent Facades & Policy Bounds
The read-only surface exposed via `field.forAgent(options)` in [agent-permissions.test.ts](../../packages/core/src/agent-permissions.test.ts) isolates Software Agents from direct simulation mutations:
* **Facade Scoping**: Employs capability checking (`read:metrics`, `read:relationships`, etc.) to filter out ungranted segments of the query return and strips mutators (`addBody`, `burst`, `destroy`).
* **Tightest-Fit Rule**: Capability grants can only tighten, never widen, the boundaries defined by policies. For instance, setting `allowBodyDataInSnapshots: false` gates data access even if an agent has `read:body-data` capability.
* **Aggressive Hard Gate**: Setting `budgets.agentRead = 0` drops all agent metric readings to `{}` and falls back to a public minimal snapshot profile.

### 5.2 Contract-Level Coverage Guard Invariants
The meta-test in [contract-coverage.test.ts](../../packages/core/src/contract-coverage.test.ts) ensures options, metrics, and attribute coverage stay unified:
* **Docs-API Source of Truth**: Scans the Astro configuration source files to automatically sync the documented `data-*` body attributes list with active tests, catching document drift.
* **Recursive Attribute Scan**: Uses recursive directory walks for body attributes to respect layout-based tests (`forces/`, `core/`), while restricting options and handles to non-recursive scans.

### 5.3 Legacy Event Mappings in Thresholder Helper
In [event-agent.ts](../../packages/core/src/agents/event-agent.ts#L104), the `eventNamesFor` helper maps metrics and edge crossings to their `field:*` Custom Event names:
```typescript
const verb =
  metric === 'density'
    ? edge === 'entered' ? 'lit' : 'dim'
    : edge === 'entered' ? 'entered' : 'exited';
```
* **Discrepancy**: The helper fails to account for custom threshold events introduced in `#686` (`attention`, `entropy`, `memory`). When `metric === 'attention'` is passed, it falls back to the generic `field:entered` / `field:exited` instead of returning the correct canonical events (`field:attention-shifted` / `field:attention-settled`).
* **Verification Bug**: In [agents.test.ts](../../packages/core/src/agents/agents.test.ts#L40), the unit test asserts this wrong behavior as expected:
  ```typescript
  assert.deepEqual(eventNamesFor('attention', 'entered'), { field: 'field:entered' });
  ```
  While `field.ts` implements custom rising and falling threshold mappings in its internal event loop, the utility helper functions in the agents folder remain out of alignment.

---

## 6. File-by-File DOM System Analysis

A deep, line-by-line review of the DOM host participation layer (`packages/dom/src`) reveals how DOM integration, event scheduling, layout throttling, and performance adaptation are coordinated, along with potential performance and memory retention trade-offs.

### 6.1 Layout Throttling & Snapshot Lookup: [measurement.ts](../../packages/dom/src/measurement.ts)
* **Mechanics**: Implements the `MeasurementRegistry`, which reads and caches DOM element geometries once per frame in `measure()` via `getBoundingClientRect()`. 
* **Design Invariant**: Correctly shields layout reads by invoking the scheduler's phase guard:
  ```typescript
  this.guard?.('measure');
  ```
  Pruning is self-healing: elements disconnected from the document tree are deleted in-loop (`if (!el.isConnected) { this.entries.delete(el); continue; }`).
* **Performance Gap**: The snapshot coordinate lookup helper uses a linear array search:
  ```typescript
  for(element: Element): FieldMeasurement | undefined {
    return this.snapshot.find((m) => m.element === element);
  }
  ```
  When $M$ bodies in the core engine query their respective DOM measurements each frame, this results in an $O(M \times N)$ cost. While suitable for smaller contexts, it becomes a performance bottleneck for densly-populated lists or complex interactive sections.
* **Refinement**: Caching the snapshot array as an identity-keyed Map during the measurement phase would lower coordinate lookup cost to $O(1)$.

### 6.2 Strong-Reference Memory Traps: [feedback.ts](../../packages/dom/src/feedback.ts) & [state.ts](../../packages/dom/src/state.ts)
* **Mechanics**: Bind state values to CSS custom properties (`--d`, `--load`, etc.) and event thresholds.
* **Risk (Strong-Reference Leak)**: Both registries store DOM element keys inside regular `Map` instances (`bindings`, `direct`, `activity`, `store`, `listeners`) rather than `WeakMap` objects. If an element is removed from the DOM, it remains pinned in memory and cannot be garbage-collected until:
  1. The next `flush()` or `prune()` sweep runs and garbage-collects disconnected elements (`el.isConnected === false`).
  2. The element is manually unregistered.
* **Analysis**: While using iterable `Map`s is a conscious design choice to allow phase loops to iterate over all active bindings/states without relying on non-enumerable `WeakMap` keys, it creates a retention window. If a field's refresh loop is paused, throttled, or destroyed without unregistering, elements removed from the tree will leak in memory.

### 6.3 DOM Subtree Rescan Overheads: [relationships.ts](../../packages/dom/src/relationships.ts) & [visual-bindings.ts](../../packages/dom/src/visual-bindings.ts)
* **Mechanics**: Normalizes native DOM linkages (such as `a[href]`, `label[for]`, and `aria-controls`) and custom visual bindings.
* **Risk (Layout Scanning)**: Both `RelationshipRegistry.discover()` and `VisualBindingRegistry.scan()` execute a full `root.querySelectorAll(...)` query. While designed to run out-of-loop (on initialization, route transitions, or custom mutation events), the platform API does not guard against these methods being attached to high-frequency frame ticks (e.g. `discover` phase hooks), which would trigger substantial layout-traversal overhead.

### 6.4 Telemetry, Discontinuity, & Hysteresis: [governor.ts](../../packages/dom/src/governor.ts) & [perf.ts](../../packages/dom/src/perf.ts)
* **Mechanics**: Monitors frame timing anomalies and scales performance quality tiers accordingly.
* **Aesthetics & Invariants**: The `QualityGovernor` avoids performance flickering by utilizing asymmetric thresholds—requiring 10 consecutive overrun frames to escalate quality degradation, but 30 clean frames to recover.
* **Discontinuity Filtering**: `FieldPerf` establishes a strict `DISCONTINUITY_MS = 500` gap limit. Any frame delay exceeding 500 ms (e.g., from browser suspension, system sleep, or tab switching) is completely skipped. This guarantees that background pausing does not pollute performance statistics or trigger erroneous quality-tier scaling.

### 6.5 Assistive-Technology Static Analysis: [lint.ts](../../packages/dom/src/lint.ts)
* **Mechanics**: Parses active stylesheets dynamically to verify layout accessibility.
* **Compliance**: `lintReducedMotion` verifies that any element expressing independent motion is matched by an `@media (prefers-reduced-motion: reduce)` block in a stylesheet. It handles unreachable or cross-origin stylesheets gracefully via try/catch blocks on `sheet.cssRules`, preventing runtime crashes when third-party stylesheets are present.

## 7. File-by-File Elements & Vanilla System Analysis

An audit of the Custom Elements runtime (`packages/elements/src`) and the framework-free Vanilla JS adapter (`packages/vanilla/src`) reveals how high-level consumer interfaces, option forwarding structures, loop lifecycle throttling, and multi-host resolution are managed.

### 7.1 Centralized Option Forwarding & CEM Synchronization: [elements/src/index.ts](../../packages/elements/src/index.ts)
* **Mechanics**: Implements `<field-root>` and `<field-field>` custom elements. 
* **Design Invariant**: Establishes a static metadata table `OPTIONS` to map custom element attributes to the engine's option schema. This prevents key property forwarding drift (such as `depth` being missed during setup) by driving option mapping programmatically.
* **Observed Attributes constraint**: To support Custom Elements Manifest (CEM) static analysis, the element exposes a literal string array `observedAttributes`. A dedicated unit test (`option-attrs.test.ts`) verifies compile-time lockstep by matching the literal list against the keys of the `OPTIONS` table.
* **Infinite Recoil Protection**: Employs a boolean guard `this.reflecting` in custom element property setters to prevent infinite attribute reflection loops when updating properties programmatically.

### 7.2 Compositing Blends and Cadence Throttling: [elements/src/platform-runtime.ts](../../packages/elements/src/platform-runtime.ts)
* **Mechanics**: Manages the platform adapter loop and telemetry integrations.
* **Optimization (Compositing Opt-out)**: The z-indexed overlay canvas uses `mix-blend-mode: screen`. To prevent the browser from executing redundant whole-screen composite passes on empty visual layers, `syncOverlaySurface` toggles the overlay canvas's style to `display: none` whenever `overlay: off` is set.
* **Quality Tier Stride-Scaling**: The platform runtime adapts to performance degradation by dropping the tick rate of DOM measurement reads and feedback writes (to every 2nd frame at tier 2, and every 4th at tier 3). The core physics simulator continues executing at full rate, maintaining visual smoothness while lowering expensive DOM queries under load.
* **Registry Cleanups**: At destruction, the platform runtime calls `platform.visuals.setMirroring(false)` to disconnect all MutationObservers, releasing references and preventing memory leaks of detached DOM elements.

### 7.3 Multi-Host Resolution and Boundary Decoupling: [vanilla/src/create-field.ts](../../packages/vanilla/src/create-field.ts) & [field.ts](../../packages/vanilla/src/field.ts)
* **Mechanics**: Implements the framework-free `FieldField` wrapper class and the unified `createField()` factory function.
* **Decoupling**: Extends the `FieldHandle` interface via delegation rather than inheritance, ensuring that plain-JS consumers get a stable, identical API footprint.
* **Cascade Resolution**: The `createField()` factory implements a clean host resolution hierarchy:
  1. explicit `opts.host` (for headless/custom test hosts).
  2. `containerHost(opts.bounds)` (for card-sized contained DOM scopes).
  3. `browserHost()` (the default, window-scoped page host).
* **SSR Safety**: Utilizes `assertBrowser()` to trigger a clean, descriptive warning during server-side compilation (SSR) instead of cryptic browser-global crashes.

## 8. File-by-File React System Analysis

An audit of the React integration door (`packages/react/src`) reveals how React components, state-binding hooks, and declarative lifecycle scopes are mapped to the core engine and DOM platform runtime.

### 8.1 Declarative Component Lifecycle: [index.tsx](../../packages/react/src/index.tsx)
* **Mechanics**: Implements the `<FieldField>` wrapper component and `useFieldField()` hook.
* **Declarative Synchronization**: Triggers core field instantiation inside `useEffect` on canvas mount. Updates/recreates the field only when a declarative option (such as `accent`, `density`, `depth`, `integrator`, `palette`, `separation`) changes.
* **Seam Preservation**: Determinism and telemetry injection seams (`rng`, `now`, `feedbackSink`, `overlayBackend`) are excluded from the `useEffect` dependency array. This prevents the field from thrashing (destroying and recreating the canvas) if inline closures or object references are re-instantiated on each React render pass.
* **Overlay Canvas Lifecycle**: Lazily spawns the fixed overlay canvas (`mix-blend-mode: screen`) only if overlays are configured (`overlay !== 'off'`). Ensures clean garbage collection by removing the canvas element on hook teardown / unmount.

### 8.2 State-to-Field Binding: [index.tsx:useForcesData](../../packages/react/src/index.tsx#L176)
* **Mechanics**: Implements the `useForcesData()` hook, exposing a React interface for the DOM's `bindData()` API.
* **Diff Reconciliation**: Binds a React array of arbitrary records to field-space bodies. Added, updated, or deleted items undergo automatic diff-reconciliation via their unique IDs rather than resetting the field on state updates.
* **Closure Reference Safety**: References the mapper function and options through mutable React refs (`mapperRef`, `optionsRef`). This ensures that changes to parent closures do not trigger layout churn or redundant body creation.

## 9. File-by-File Three.js Integration Analysis

An audit of the Three.js integration door (`packages/three/src`) reveals how WebGL scene elements, instanced geometries, coordinate projection planes, and dynamic shader-based swarm rendering map to the core engine.

### 9.1 Coordinate Projection Planes: [project.ts](../../packages/three/src/project.ts)
* **Mechanics**: Implements the `FieldProjection` interface via `PlaneProjection` and `VolumeProjection`.
* **Flat Plane Projection**: Maps 2D CSS-pixel coordinates $(x, y)$ onto the world-space XY plane (flipping screen-$y$-down to world-$y$-up), utilizing particle `heat` as a volumetric height offset (relief) for flat fields.
* **Isotropic Volume Projection**: Maps the engine's 3D depth lane ($z \in [0, \text{depth})$) onto world depth ranges to construct true 3D particle clouds, centering the particles relative to the document page plane ($z = 0$) if configured.

### 9.2 GPU Particle Bridges and Materials: [particles.ts](../../packages/three/src/particles.ts) & [layer.ts](../../packages/three/src/layer.ts)
* **Mechanics**: Implements the GPU-optimized `ParticlePool` class.
* **Allocation-Free Synchronizations**: Prefers pre-allocating contiguous Float32 BufferAttributes for particle position, heat, and size to match the engine's `readParticles()` stride array, avoiding allocation thrashing on the frame loop.
* **Vertex Shaders**: Features an dynamic ShaderMaterial executing perspective sizing attenuation based on a custom `uFocal` length focal ratio.
* **Accent and Palette Synchronization**: Overrides `setAccent()` and `setPalette()` inside `FieldLayer` to resolve palette stops and dynamically set the `uAccent` uniform in the `ParticlePool` material. This ensures WebGL particles change color in sync with the core engine and overlay drawings instead of remaining static.

### 9.3 Virtual DOM Element Mapping: [bodies.ts](../../packages/three/src/bodies.ts)
* **Mechanics**: Implements the virtual DOM proxy adapter class `BodyImpl` (managed via `FieldBodyRegistry`).
* **DOM Interface Compliance**: Mapped as a virtual non-DOM element, implementing standard Element interfaces (`getAttribute`, `hasAttribute`, `getBoundingClientRect`).
* **Active Rect Projections**: Automatically evaluates its bounding rect coordinates each frame by mapping the linked mesh's world coordinate position back to 2D CSS-pixel space via `projection.toField()`, rendering mesh-based bodies reactive to physical and tactile forces.

### 9.4 Batch Render Overlays: [backend.ts](../../packages/three/src/backend.ts)
* **Mechanics**: Implements the `threeBackend` render backend.
* **Geometry Batching**: Aggregates segments and polyline paths into dynamic line segments and fills data-chip labels into instanced triangle meshes.
* **Canvas Texture Cache Bounds**: Caches canvas textures for text elements using a composite string-and-color key map. Employs a cache limit check (`labelCache.size > 256`) inside `clear()` to automatically purge and dispose of textures when custom overlays print high-precision, continuously changing text.

### 9.5 Cadence Visuals and Stepped Agents: [samplers.ts](../../packages/three/src/samplers.ts) & [agents.ts](../../packages/three/src/agents.ts)
* **Cadence Tracing**: Streamline tubes (`streamlineTubes`) and instanced arrow grids (`vectorField`) run field query samplers on configurable interval cadences (e.g. every 6th frame), aligning computation loops with body movement paces.
* **Stepped Agents**: Steered agents (`FieldAgent` and `MeshAgentHandle`) integrate forces and write positions back to the projected meshes, wrapping edge bounces.

## 10. Comprehensive Core Engine Code Run-Through & Conformance Audit

A comprehensive code audit of the core engine implementation (`packages/core/src/core`, `forces`, and `recipes`) identifies key design invariants, mathematical kernels, and integration lanes.

### 10.1 Physics Integration Schemes: [engine/integrator.ts](../../packages/core/src/engine/integrator.ts)
* **Verlet Scheme**: Opt-in `velocity-verlet` implements the stored-acceleration formulation. To handle discontinuous forces correctly, any kinematic force application resets stored acceleration and marks `kinTouch` to prevent invalid position extrapolations.
* **Massive Scaling**: Additive forces scale velocity changes by `inv = 1 / p.m`, while kinematic forces bypass mass scaling to reflect, rotate, or relaunch matter unconditionally.
* **Frictional Cadence**: Step friction (`FRICTION = 0.95`) and heat decay (`HEAT_DECAY = 0.972`) are applied out-of-scheme. Under `fixed` or `verlet` modes, decays are scaled exponentially by `dt` (`Math.pow(FRICTION, dt)`) to prevent simulation speed dependencies.

### 10.2 Natural Force Laws: [forces/natural.ts](../../packages/core/src/forces/natural.ts) & [math/geometry.ts](../../packages/core/src/math/geometry.ts)
* **Plummer Softening**: Monopole gravity and charges use Plummer softening based on the Schwarzschild radius $r_s = 2GM/c^2$ to bypass singularities ($d = 0$) at the core.
* **Dipole Synthesis**: Chargeable and magnetic bodies map dipole vectors along the heading if spatial dimension scales are too small ($d < 8\text{px}$), maintaining readable fields.

### 10.3 Log-Normalized Page Weights: [engine/weights.ts](../../packages/core/src/engine/weights.ts)
* **Heavy-Tailed Compression**: Compresses values via a log-normalization curve $\ln(x+1) / \ln(\text{max}+1)$ to avoid scaling extremes.
* **Engine Strength Mapping**: Maps weights onto attract-body forces using $0.4 + w \cdot 1.6$, capping strengths between $0.4$ (always active) and $2.0$.

### 10.4 Local Thermodynamics: [engine/thermo.ts](../../packages/core/src/engine/thermo.ts)
* **Alignment R-ratio**: Measures velocity alignment ($R \in [0,1]$) to evaluate direction dispersion.
* **Agitation-Gating**: Gates entropy by agitation to treat near-still states as highly ordered.

### 10.5 Compiler & Intent Execution: [recipes/compile.ts](../../packages/core/src/recipes/compile.ts) & [recipes/intent.ts](../../packages/core/src/recipes/intent.ts)
* **Lane-Decoupled Compilation**: Maps concept definitions, diagnostics, and conditions into separate evaluation layers, compiling only token attributes into element markup.
* **No-Silent-Caps Rule**: Named matter modes or overlays that cannot be applied under the current platform targets are reported in `unapplied` logs instead of being ignored.

---

## 11. File-by-File Diagnostics, Recording, and Security Audits

An audit of the diagnostics vectors (`packages/core/src/diagnostics`), recording runtime (`packages/core/src/record`), and permission enforcement layers (`packages/core/src/agent-permissions.test.ts` & `field-policy.test.ts`) details how vector exporting, deterministic playback, and policy/sandbox boundaries are structured.

### 11.1 Seeded Determinism and Replay Integrity: [record/rng.ts](../../packages/core/src/record/rng.ts) & [record/record.ts](../../packages/core/src/record/record.ts)
* **Mechanics**: Implements a zero-dependency 32-bit `mulberry32` generator (`seededRng`).
* **Design Invariant**: By enforcing integer-only operations and bypassing `Math.random()`, the generator ensures that simulation runs are platform-independent and reproduce bit-for-bit identically across client engines.
* **Compact Stride Buffer Allocation**: The recorder saves trajectories using flat, contiguous `Float32Array` buffers (recording each frame as `[x, y, vx, vy, age]`), eliminating frame-by-frame memory allocations and GC spikes during recording passes.

### 11.2 Security Facades and capability scoping: [agent-permissions.test.ts](../../packages/core/src/agent-permissions.test.ts) & [field-policy.test.ts](../../packages/core/src/field-policy.test.ts)
* **Design Invariant (Opaque Gating)**: The `field.forAgent(options)` interface provides a strict read-only wrapper facade for Software Agents, gating method access by capability permissions (`read:metrics`, `read:relationships`, `read:replay`). Mutation methods are fully omitted from the facade, ensuring that the runtime remains sandboxed.
* **Tightest-Fit Precedence**: Capability queries evaluate to the tightest intersection of permissions. If a global policy denies body data (`allowBodyDataInSnapshots: false`), data queries will return undefined even if the agent is granted `read:body-data`.
* **Zero-Limit Budget Hard Gate**: Setting `budgets.agentRead = 0` immediately drops metrics outputs to `{}` and forces snapshots to public profiles, safeguarding performance and data privacy under strict allocation limits.

### 11.3 Meta-Contract Validation: [contract-coverage.test.ts](../../packages/core/src/contract-coverage.test.ts)
* **Mechanics**: Implements a compile-time meta-test verifying unit coverage for all public configuration options, metrics, and DOM attributes.
* **Sync Assurance**: Direct-parses the Astro documentation rosters (`docs-api.ts`) and `types.ts` to construct a live roster of expected symbols, comparing it against the test files. This guarantees that new options or attributes cannot be checked in without accompanying unit test coverage.

### 11.4 Pure Diagnostics and Vector Serialization: [diagnostics/modes.ts](../../packages/core/src/diagnostics/modes.ts) & [export.ts](../../packages/core/src/export.ts)
* **ReadOnly Diagnostics**: Diagnostics modes (topology graphs, HUD HUDs, predictive trajectories) read parameters but never mutate core coordinates, preserving physical invariants.
* **Vector Precision**: The vector serializer (`segmentsToSvg`) rounds coordinates to two decimal places (`Math.round(n * 100) / 100`) to output compact standalone SVGs while maintaining subpixel spatial accuracy.

---

## 12. Custom Elements and Project Scaffolding CLI Audits

An audit of the custom elements runtime (`packages/elements`) and the project template generator CLI (`packages/create`) outlines element lifecycle compliance and template setup invariants.

### 12.1 Custom Element Lifecycles and Option Drift Guards: [elements/src/index.ts](../../packages/elements/src/index.ts) & [elements/src/option-attrs.test.ts](../../packages/elements/src/option-attrs.test.ts)
* **Observed Option Mapping**: Utilizes a static private `OPTIONS` mapping table to build the configuration forwarded to `createBrowserField()`. The literal `observedAttributes` array is tested against `OPTIONS` via reflection to guarantee that new features cannot be added to one list without the other.
* **Teardown Invariant**: The `disconnectedCallback()` removes the visibility IntersectionObserver, deletes the light-DOM overlay canvas, terminates the platform runtime, and cleans all element handles to `undefined` to guarantee subsequent mounts rebuild cleanly.
* **Signals-First Defaults**: Standardizes fallback rendering modes to `'none'` (no canvas, signals-only) for unrecognized or omitted attributes, ensuring client-side performance is preserved out-of-the-box.

### 12.2 Scaffolding Invariants and npm Packing Workarounds: [create/src/scaffold.ts](../../packages/create/src/scaffold.ts)
* **Placeholder Gitignores**: Since npm packaging automatically strips `.gitignore` files from published packages, templates include a `_gitignore` placeholder file. The scaffolding script (`scaffold()`) automatically renames it to `.gitignore` when copying templates.
* **Project Name Stamps**: Mutates the output `package.json` package name field to the target directory name, ensuring that template scripts are customized without manual intervention.

---

## 13. Recommendations & Actions

1. **Unify Integrator Mode Specs**:
   Update [substrate-api.md](../../docs/canonical/substrate-api.md) to document the `'velocity-verlet'` scheme and synchronize deprecated names inside [physics-workover.md](../../docs/engine-reference/physics-workover.md).
2. **Flag Planned Features**:
   Mark `MediumMode` and the drag physics configs in `physics-workover.md` as "Planned (RC1)" to make the docs platform-honest.
3. **Correct the `'absorb'` Event Name**:
   Standardize event names to `'sink'` or `'captured'` on the core event bus to restore naming lane discipline.
4. **Optimize Spatial Hash Buckets**:
   Refactor [spatial-hash.ts](../../packages/core/src/engine/spatial-hash.ts) to utilize an array pooling mechanism or flat index mappings, eliminating array allocations in the hot loop.
5. **Verify Benchmark Execution**:
   Continue executing Node performance suites ([field-bench.ts](../../packages/core/bench/field-bench.ts) and [integrator.bench.ts](../../packages/core/bench/integrator.bench.ts)) to catch regression costs early before releasing production builds.
6. **Harmonize Material Notes with Executable Tokens**:
   Standardize the `note` properties in [materials.ts](../../packages/core/src/semantic/materials.ts) to refer strictly to the canonical tokens (e.g. `'tether'` instead of `'spring'`, `'viscosity'` instead of `'damping'`) to prevent confusion.
7. **Add Developer Warnings for Silent Metric Drops**:
   Consider throwing a dev-mode warning via `devWarnNoOp` when mapping conceptual semantic layers (`status`, `hierarchy`) that return empty metrics, advising developers on correct configuration.
8. **Correct `eventNamesFor` Mappings**:
   Update [event-agent.ts:eventNamesFor](../../packages/core/src/agents/event-agent.ts#L104) to map metric types like `attention`, `entropy`, and `memory` to their proper canonical names (`field:attention-shifted`, `field:entropy-warning`, etc.) rather than fallback generics, and update [agents.test.ts](../../packages/core/src/agents/agents.test.ts#L40) accordingly.
9. **Cache Measurement Registry Snapshots**:
   Refactor `MeasurementRegistry.for()` to leverage an identity-keyed Map cached during the `measure()` step, converting lookup times from $O(N)$ linear scans to $O(1)$ constant-time operations.
10. **Establish Safeguards for Discovery and Scan Intervals**:
    Introduce internal checks or warning systems in `discover()` and `scan()` to warn if subtree traversal is invoked at high frequency (e.g., more than once every 60 frames) to prevent performance degradation from layout queries in frame loops.
11. **Standardize registry cleanup on frame pauses**:
    Update the `FieldPlatform` teardown or pause routines to perform an immediate, explicit `prune()` and `clear()` of states and bindings on all registries, ensuring removed elements are immediately freed from memory rather than relying on delayed loop steps.
12. **Centralize Custom Element Option Forwarding Validation**:
    Add an automated pre-publish script or build step checking that any future addition to `FieldOptions` is added to the `<field-root>` `OPTIONS` mapping table and `observedAttributes` literal array, maintaining lockstep synchronization automatically.
13. **Optimize Contained Canvas Re-creation in Vanilla Fields**:
    In [field.ts](../../packages/vanilla/src/field.ts), verify that when a vanilla instance is destroyed and rebuilt inside the same container bounds, the previously created canvas is fully unmounted and disposed of to prevent redundant overlay canvases piling up in the DOM.
14. **Enforce Facade Scoping Constraints programmatically**:
    Add a conformance checker verifying that any new method added to `FieldHandle` is explicitly reviewed for inclusion/exclusion inside the `forAgent` proxy sandbox, preventing unintended method exposure to Software Agents.
15. **Prevent Redundant React Component Mounting Re-creations**:
    Ensure that future options added to `FieldOptions` are added either to the `useEffect` dependency arrays of `FieldField`/`useFieldField` or specifically designated as static/once configuration parameters, preventing thrashing across renders.
16. **Guard Against Silent Particle Headroom Truncations in 3D Swarms**:
    Warn or raise defaults for `capacity` in `FieldLayerOptions` if initial seeded particle count is zero or extremely small, since spawning matter dynamically (using `spawn` forces) is clamped to this initial headroom size.
