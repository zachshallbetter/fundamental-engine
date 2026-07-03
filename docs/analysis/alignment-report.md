# Codebase Conformance & Alignment Audit

This report details the findings from an exhaustive, line-by-line review of the engine core packages (`@fundamental-engine/core` and `@fundamental-engine/dom`) to verify compliance with the canonical documents, specifications, and naming conventions defined in the documentation corpus.

---

## 1. Concept vs. Code Discrepancies

These are areas where the codebase and the documentation specifications have drifted or directly contradict each other.

### 1.1 `IntegratorMode` Configuration Options
* **The Spec ([substrate-api.md](file:///Users/zachshallbetter/Projects/fundamental-engine/docs/canonical/substrate-api.md#L374))**:
  ```typescript
  type IntegratorMode = 'legacy' | 'fixed';
  ```
* **The Code ([types.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/types.ts#L447))**:
  ```typescript
  export type IntegratorMode = 'legacy' | 'fixed' | 'velocity-verlet';
  ```
* **The Draft ([physics-workover.md](file:///Users/zachshallbetter/Projects/fundamental-engine/docs/engine-reference/physics-workover.md))**:
  References `IntegratorMode = 'legacy-euler' | 'semi-implicit-euler-dt' | 'velocity-verlet'`.
* **Impact**: The documentation is internally inconsistent and fails to advertise the second-order `'velocity-verlet'` integration scheme implemented in the physics engine.

### 1.2 Unimplemented Fluid Drag & Medium Models
* **The Spec ([physics-workover.md](file:///Users/zachshallbetter/Projects/fundamental-engine/docs/engine-reference/physics-workover.md))**:
  Drafts complex medium and drag behaviors:
  ```typescript
  type MediumMode = 'designed-damping' | 'vacuum' | 'linear-drag' | 'quadratic-drag' | 'mixed-drag';
  type DragMode = 'linear' | 'quadratic' | 'mixed';
  type MediumConfig = { ... };
  ```
* **The Code**: There is no implementation of `MediumMode`, `DragMode`, or `MediumConfig` in `packages/core`. Damping remains hardcoded to `FRICTION = 0.95` inside [integrator.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/integrator.ts#L40).
* **Impact**: The published reference documentation details API specifications that do not exist at runtime.

### 1.3 Fixed Mode Force Impulse $dt$-Scaling
* **The Spec**: Asserts that under the `'fixed'` integrator mode, force impulses and friction decays scale with $dt$ to make motion consistent across varying frame rates.
* **The Code ([integrator.ts:applyForce](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/integrator.ts#L157-L164))**:
  Explains that the engine **does not** scale force impulses in the integrator loop due to pairwise momentum constraints:
  ```typescript
  // NOTE (doc 04 §Step 3): the fixed-timestep integrator does NOT dt-scale force impulses here.
  // The single-particle capture trick (rescale p's Δv) is unsound for forces that also mutate a
  // neighbour in the same pass — collide/link apply an equal-and-opposite impulse to q...
  // Fixed mode currently corrects only the per-step decays.
  ```
* **Impact**: While decays (friction, thermal noise) are frame-rate independent in fixed mode, force impulses remain dependent on tick rate, creating a mismatch with documentation claims of frame-rate-independent simulation behavior.

### 1.4 Naming Discipline Violation: `'absorb'` Event vs. `'sink'` Token
* **The Spec ([common-mistakes.md](file:///Users/zachshallbetter/Projects/fundamental-engine/docs/canonical/common-mistakes.md#L51))**:
  Enforces a strict lane discipline separating descriptive concepts from execution names:
  > `absorb` is concept language; the token is `sink`. Concepts describe, tokens execute — never mix them.
* **The Code ([events.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/events.ts#L18))**:
  The discrete event bus still uses `'absorb'` as the event type key:
  ```typescript
  export interface FieldEventMap {
    absorb: { body: Body; count: number };
    release: { body: Body; count: number };
  }
  ```
  A similar naming spillover occurs in [states.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/semantic/states.ts#L35) where the `'pressed'` field state behavior describes the sink token as `'sink (absorb)'`.
* **Impact**: This introduces conceptual language directly into the execution/event layer, breaching naming lane boundary rules.

---

## 2. File-by-File Core System Analysis

### 2.1 Physics and Integrator: [integrator.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/integrator.ts)
* **Mechanics**: Implements standard Verlet and Semi-Implicit Euler integration loops, handles boundary collisions (toroidal wrapping, screen borders), and decays kinetic energy and heat.
* **Review**: Correctly scales decay rates ($Math.pow(FRICTION, dt)$) and Langevin kicks ($Math.sqrt(dt)$) to support frame-rate independent metrics under the `fixed` step mode. However, as noted in §1.3, individual force impulses are not scaled by $dt$.

### 2.2 Domain Scanner & Preset Compiler: [scanner.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/scanner.ts)
* **Mechanics**: Scans subtrees matching [BODY_SELECTOR](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/scanner.ts#L279), expands presets from [PRESETS](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/config/presets.ts), and parses variables (`data-strength`, `data-range`, `data-spin`, `data-angle`).
* **Compliance**: Handled purely DOM-free using a `BodyAttrs` adapter interface. Correctly enforces the *Source Budget Contract* by warning on unbudgeted Class-[S] spawning bodies and falling back to safe limits.
* **Precedence Order**: Explicit element attributes override intent/role compiled configurations:
  ```typescript
  get: (name) => el.getAttribute('data-' + name) ?? defaults[name] ?? null
  ```

### 2.3 Conserved Attention Allocator: [attention.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/attention.ts)
* **Mechanics**: Allocates attention budget among competing bodies using a water-filling algorithm in [allocateAttention](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/attention.ts#L70).
* **Compliance**: Perfectly matches the conserved-attention budget theorem ($\Sigma w_i = \text{budget}$). Supplying a pinned state correctly reserves `cap` space off the top, allocating remaining margins across active contenders.

### 2.4 Proximity Density Spillover: [causality.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/causality.ts)
* **Mechanics**: Transports excess density ($d_i > \theta$) to nearby bodies via a Gaussian falloff calculation in [spillover](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/causality.ts#L40).
* **Compliance**: Strictly conserved ($\Sigma \Delta_i = 0$), preventing phantom density creation across borders.

### 2.5 Local Thermodynamics Metrics: [thermo.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/thermo.ts)
* **Mechanics**: Transforms neighbor sample counts, speeds, and kinetic energies into macro indicators (`entropy`, `coherence`, `temperature`).
* **Compliance**: Bilinear velocity alignment $R = |\Sigma v| / \Sigma |v|$ maps direction dispersion accurately. Low-speed neighborhoods drop entropy, meaning order naturally emerges when motion freezes under `prefers-reduced-motion`.

### 2.6 Bound and Free Reservoirs: [reservoir.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/reservoir.ts)
* **Mechanics**: Manages particle snapping ([healWaves](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/reservoir.ts#L19)) onto wave structures and tearing ([tearBoundByForces](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/reservoir.ts#L105)) them back into the free particle pool.
* **Compliance**: Conserves particle identity and count throughout snapping/tearing phases. [induceCharges](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/reservoir.ts#L214) seeds electric charges based on the entry hemisphere relative to the heading axis, unlocking charge/magnetism dynamics for neutral matter.

### 2.7 Shadow DOM Boundary Integration: [shadow.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/shadow.ts)
* **Mechanics**: Integrates encapsulated web components using composed, bubbling DOM events ([field:register-body](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/shadow.ts#L17)).
* **Compliance**: Encapsulates component internal trees; registers only the custom host element, utilizing custom `getRect` callbacks for closed roots and directing CSS feedback writes to specified `writeTarget` elements.

### 2.8 Diagnostic Visualizations: [streamlines.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/streamlines.ts) & [fieldlines.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/fieldlines.ts)
* **Mechanics**: Generates net force vector arrows at grid points ([forceAt](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/streamlines.ts#L19)) and traces field paths from magnetic/charge dipole seeds ([traceFieldLine](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/fieldlines.ts#L99)).
* **Compliance**: Implements a `maxTurns` orbit limit to prevent infinite loops and excessive stroke drawing costs on overlapping paths.

### 2.9 Field Flow Transport: [flow.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/flow.ts)
* **Mechanics**: Curves streamlines and pulls particles toward a transient focus point.
* **Compliance**: Optimization-safe; [flowBiasInto](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/flow.ts#L58) writes coordinates into a caller-owned scratchpad, avoiding allocating coordinate object structures in high-frequency hot loops.

### 2.10 Math and Colors: [math.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/math.ts)
* **Mechanics**: Implements hex parser, linear interpolation (lerp), pigment mixing, and HSL mapping helper formulas.
* **Compliance**: Reuses shared RGB arrays on hot rendering loops ([particleRGBInto](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/math.ts#L39)) to keep allocation count zero.

### 2.11 Core Geometries: [geometry.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/geometry.ts)
* **Mechanics**: Calculates 2D bounding boxes and signed distance functions ([sdfRect](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/geometry.ts#L61)) for bodies.
* **Compliance**: Correctly resolves dipole vectors and poles ([polePair](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/geometry.ts#L76)) along the heading axis for non-point magnetic/charge sources.

### 2.12 Built-in Conditions: [conditions.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/conditions.ts)
* **Mechanics**: Standard filters (`fast`, `slow`, `hot`, `cool`) that selectively gate particle movements.
* **Compliance**: Evaluates threshold velocities and temperature levels, allowing bodies to filter out neutral/dormant matter.

### 2.13 Registry Manager: [registry.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/registry.ts)
* **Mechanics**: Exposes force and condition registration mappings.
* **Compliance**: Allows external extensions or modules to plug custom forces dynamically into the active engine.

### 2.14 Diagnostic Heatmaps: [heatmap.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/heatmap.ts)
* **Mechanics**: Accumulates particle history and blurs paths using local diffusion steps.
* **Compliance**: Eases normalizer peak value dynamically to avoid division-by-zero or flash spikes when the field empties.

### 2.15 Core Forces catalog: [forces/index.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/forces/index.ts)
* **Mechanics**: Implements the 9 canonical forces (`attract`, `repel`, `swirl`, `stream`, `viscosity`, `jet`, `tether`, `wall`, `sink`).
* **Compliance**: Correctly reflects speeds kinematic-style for rigid boundaries (walls) and nozzles (jets), bypasses mass adjustments, and uses Box-Muller normal transforms for random tangential spreads.

### 2.16 Natural Force Laws: [forces/natural.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/forces/natural.ts)
* **Mechanics**: Softened gravity, Coulomb charge attraction/repulsion, and 2D cyclotron Lorentz magnetism deflection.
* **Compliance**: Leverages Schwarzschild radius as Plummer softening to prevent singular density divisions at core contacts.

### 2.17 Extended Forces: [forces/extended.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/forces/extended.ts)
* **Mechanics**: Employs lattices (crystallize), flocking heading averaging (align/cohesion), SPH pressure relaxations, teleports (warp), and filters (spotlight/screen).
* **Compliance**: Adheres strictly to performance boundaries; screen modifiers damp sibling velocities smoothly near texts without hard coordinate clipping.

### 2.18 Semantics Mappings: [semantic/layers.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/semantic/layers.ts), [materials.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/semantic/materials.ts) & [states.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/semantic/states.ts)
* **Mechanics**: Transforms conceptual layer urgency, importance, and fabric feel to concrete force vectors and render overlays.
* **Compliance**: Safely maps state boundaries without editing live parameters, ensuring pure configurations.

### 2.19 Visual Channels: [visual/channels.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/visual/channels.ts), [lint.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/visual/lint.ts), [semantic-text.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/visual/semantic-text.ts) & [visualization.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/visual/visualization.ts)
* **Mechanics**: Maps metrics to CSS values (optical scale, HSL color, variable font weights), performs accessibility audits, and verifies semantic screen-reader-only labels.
* **Compliance**: Ensures all color layers adhere to minimum lightness and desaturation boundaries to comply with contrast constraints.

### 2.20 Recipes & Intent Compiler: [recipes/schema.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/recipes/schema.ts) & [compile.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/recipes/compile.ts)
* **Mechanics**: Parses portable recipes into executable programs and builds layout and reduced-motion fallback options.
* **Compliance**: Gathers all metrics and diagnostics without silent failures or dropped targets.

### 2.21 Headless Record/Replay: [record/record.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/record/record.ts)
* **Mechanics**: Seeds RNG and clocks to capture deterministic, stride-packed particle trajectories.
* **Compliance**: Uses flat Float32Arrays for compact serialization, avoiding frame-by-frame object allocation during simulation runs.

### 2.22 System Guards & Passports: [contracts/guards.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/contracts/guards.ts) & [types.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/contracts/types.ts)
* **Mechanics**: Enforces non-negotiable assertions (finite particle coordinates, budgeted sources, pure visual layers, performance margins) at dev-time.
* **Compliance**: Checks are compiled out under production node environments ($process.env.NODE\_ENV === 'production'$), leaving production performance unaffected.

### 2.23 Configuration Layer: [config/](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/config)
* **Files**: [forces.config.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/config/forces.config.ts), [manual.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/config/manual.ts), [presets.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/config/presets.ts), [palettes.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/config/palettes.ts), [themes.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/config/themes.ts), [tokens.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/config/tokens.ts)
* **Mechanics**: Houses the canonical definitions, design custom properties, named preset compositions (blackhole, galaxy, whitehole), scroll journey bias vectors, color themes (warm, cool, mono), and public-facing reference copy.
* **Compliance**: Strictly verified by unit tests (`manual.test.ts`, `forces.config.test.ts`), which guarantee exact 1-to-1 correspondences between registry entries, symbols, colors, and passports. Presets explicitly declare lifespans and capacities to pass the source budget contracts.

---

## 3. Performance & Allocation Gaps

### 3.1 Spatial Hash Memory Allocations
* **The Issue**: [spatial-hash.ts:insert](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/spatial-hash.ts#L33) instantiates a new array literal whenever a grid cell/bin is empty:
  ```typescript
  const bin = this.bins.get(k);
  if (bin) bin.push(item);
  else this.bins.set(k, [item]); // Allocates array literal [item]
  ```
  Since the spatial index is entirely cleared and rebuilt every frame, this generates substantial garbage collection overhead, particularly when simulated particle counts are high.
* **Remedy**: Pre-allocate or pool cell arrays, or clear array lengths instead of discarding references.

### 3.2 Compositing Performance (The Mix-Blend Canvas Trap)
* **The Issue**: A full-viewport `mix-blend-mode` canvas forces the browser to re-composite the entire screen every frame, even when no drawings are on the canvas.
* **Compliance**: [lint.ts:lintCompositingPerf](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/dom/src/lint.ts#L344) audits canvas inline styles and issues a warning if a full-viewport mix-blend canvas has an unsized backing store ($0 \times 0$) but remains visible. Setting `display: none` gates it out of the browser's compositing tree.


### 3.3 Benchmark Execution and Force Token Mismatches
* **The Issue**: [integrator.bench.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/bench/integrator.bench.ts#L71) declared a static list of force tokens to cycle through:
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

The semantic layer bridges developer intent with the simulation engine, converting user interface concepts into physical forces. A line-by-line review of the modules in [packages/core/src/semantic](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/semantic) reveals several structural constraints, design assumptions, and minor inconsistencies.

### 4.1 Silent Conceptual Metric Dropping
In [layers.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/semantic/layers.ts#L50), `semanticToMetrics` converts a semantic value into an `ElementMetrics` contribution:
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
The `note` fields in [materials.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/semantic/materials.ts#L30) deviate from the executable force tokens defined in their respective recipes:
* **Glass**: Mapped tokens are `['lens', 'wall']`, but the descriptive note lists `'lens + reflect + low drag'`. There is no force representing "drag" or "viscosity" included in the tokens list.
* **Rubber**: Mapped tokens are `['tether', 'viscosity']`, but the note lists `'spring + damping'`. These represent conceptual aliases for the physical tokens.
* **Smoke**: Mapped tokens are `['diffuse', 'stream']`, but the note lists `'diffuse + stream + entropy'`. The entropy component (usually supplied by the `thermal` force) is absent from the execution list.
* **Impact**: While minor, these discrepancies show a conceptual gap between the developer-facing descriptive comments and the actual forces loaded at runtime.

---

## 5. Security, Policy, & Meta-Contract Systems

A deep audit of the top-level test files and contract enforcement layers reveals how security, capability scoping, and test integrity are maintained, alongside minor legacy gaps in event dispatch mapping.

### 5.1 Scoped Agent Facades & Policy Bounds
The read-only surface exposed via `field.forAgent(options)` in [agent-permissions.test.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/agent-permissions.test.ts) isolates Software Agents from direct simulation mutations:
* **Facade Scoping**: Employs capability checking (`read:metrics`, `read:relationships`, etc.) to filter out ungranted segments of the query return and strips mutators (`addBody`, `burst`, `destroy`).
* **Tightest-Fit Rule**: Capability grants can only tighten, never widen, the boundaries defined by policies. For instance, setting `allowBodyDataInSnapshots: false` gates data access even if an agent has `read:body-data` capability.
* **Aggressive Hard Gate**: Setting `budgets.agentRead = 0` drops all agent metric readings to `{}` and falls back to a public minimal snapshot profile.

### 5.2 Contract-Level Coverage Guard Invariants
The meta-test in [contract-coverage.test.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/contract-coverage.test.ts) ensures options, metrics, and attribute coverage stay unified:
* **Docs-API Source of Truth**: Scans the Astro configuration source files to automatically sync the documented `data-*` body attributes list with active tests, catching document drift.
* **Recursive Attribute Scan**: Uses recursive directory walks for body attributes to respect layout-based tests (`forces/`, `core/`), while restricting options and handles to non-recursive scans.

### 5.3 Legacy Event Mappings in Thresholder Helper
In [event-agent.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/agents/event-agent.ts#L104), the `eventNamesFor` helper maps metrics and edge crossings to their `field:*` Custom Event names:
```typescript
const verb =
  metric === 'density'
    ? edge === 'entered' ? 'lit' : 'dim'
    : edge === 'entered' ? 'entered' : 'exited';
```
* **Discrepancy**: The helper fails to account for custom threshold events introduced in `#686` (`attention`, `entropy`, `memory`). When `metric === 'attention'` is passed, it falls back to the generic `field:entered` / `field:exited` instead of returning the correct canonical events (`field:attention-shifted` / `field:attention-settled`).
* **Verification Bug**: In [agents.test.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/agents/agents.test.ts#L40), the unit test asserts this wrong behavior as expected:
  ```typescript
  assert.deepEqual(eventNamesFor('attention', 'entered'), { field: 'field:entered' });
  ```
  While `field.ts` implements custom rising and falling threshold mappings in its internal event loop, the utility helper functions in the agents folder remain out of alignment.

---

## 6. Recommendations & Actions

1. **Unify Integrator Mode Specs**:
   Update [substrate-api.md](file:///Users/zachshallbetter/Projects/fundamental-engine/docs/canonical/substrate-api.md) to document the `'velocity-verlet'` scheme and synchronize deprecated names inside [physics-workover.md](file:///Users/zachshallbetter/Projects/fundamental-engine/docs/engine-reference/physics-workover.md).
2. **Flag Planned Features**:
   Mark `MediumMode` and the drag physics configs in `physics-workover.md` as "Planned (RC1)" to make the docs platform-honest.
3. **Correct the `'absorb'` Event Name**:
   Standardize event names to `'sink'` or `'captured'` on the core event bus to restore naming lane discipline.
4. **Optimize Spatial Hash Buckets**:
   Refactor [spatial-hash.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/core/spatial-hash.ts) to utilize an array pooling mechanism or flat index mappings, eliminating array allocations in the hot loop.
5. **Verify Benchmark Execution**:
   Continue executing Node performance suites ([field-bench.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/bench/field-bench.ts) and [integrator.bench.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/bench/integrator.bench.ts)) to catch regression costs early before releasing production builds.
6. **Harmonize Material Notes with Executable Tokens**:
   Standardize the `note` properties in [materials.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/semantic/materials.ts) to refer strictly to the canonical tokens (e.g. `'tether'` instead of `'spring'`, `'viscosity'` instead of `'damping'`) to prevent confusion.
7. **Add Developer Warnings for Silent Metric Drops**:
   Consider throwing a dev-mode warning via `devWarnNoOp` when mapping conceptual semantic layers (`status`, `hierarchy`) that return empty metrics, advising developers on correct configuration.
8. **Correct `eventNamesFor` Mappings**:
   Update [event-agent.ts:eventNamesFor](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/agents/event-agent.ts#L104) to map metric types like `attention`, `entropy`, and `memory` to their proper canonical names (`field:attention-shifted`, `field:entropy-warning`, etc.) rather than fallback generics, and update [agents.test.ts](file:///Users/zachshallbetter/Projects/fundamental-engine/packages/core/src/agents/agents.test.ts#L40) accordingly.


