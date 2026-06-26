> **Status: engine-reference.**
> This document maps everything the field runtime currently makes observable from outside the
> engine — organized by layer, with notes on how each surface is accessed. It also records the
> identified performance gaps and the `FieldPerf` design direction for closing them.
> Related: [forces-system.md §13](forces-system.md#13-public-field-api-fieldhandle),
> [forces-system.md §18](forces-system.md#18-accessibility-reduced-motion-performance),
> [api-stability.md](../canonical/api-stability.md).

# Field runtime observable surface

The runtime's observation channels fall into four access patterns:

| Pattern | Examples | When to use |
|---|---|---|
| **CSS variables** | `--field-density`, `--field-heat` | Reactive, no polling; drives CSS + style bindings |
| **DOM events** | `field:lit`, `field:captured` | Edge-triggered; hysteretic, debounced |
| **`state.observe()`** | platform state registry | Typed subscriptions; per-element |
| **Pull-based snapshots** | `energyReport()`, `inspectBudget()` | rAF-cadence reads in debug tools |

---

## Per-particle data

Each `Particle` in the pool carries:

| Field | Type | Description |
|---|---|---|
| `x`, `y` | `number` | Position in field space |
| `vx`, `vy` | `number` | Velocity |
| `m` | `number` | Inertial mass |
| `heat` | `number ∈ [0,1]` | Drives color, size, glow |
| `size` | `number` | Render-radius basis |
| `cap` | `Body \| null` | Sink capturing this particle |
| `age` | `number?` | Frames-to-live (mortal particles) |
| `charge` | `number?` | Signed charge |
| `species` | `number?` | Species tag for hunt forces |
| `color` | `string?` | Carried pigment (conserved transport) |
| `atom` | `AtomPayload?` | Seeded user data record |

`AtomPayload` is `{ weight?: number; [key: string]: unknown }` — arbitrary semantic fields
bound via `handle.seed()` and retrieved via `handle.atomAt(x, y)`.

> **Encapsulation:** `store.particles` (the live `Particle[]` pool) is not exposed on
> `FieldHandle`. Individual particle state is observable from outside through three channels:
> `atomAt` (nearest seeded record), the aggregate `energy()` snapshot, and — since 0.8.1 — the
> zero-copy wire-format read-out API (`readParticles`, `readParticleIds`,
> `readParticleChannels`; see "Wire-format read-out" below). Direct access to the live pool
> object still requires a custom `FieldHost`.

### Wire-format read-out

Since 0.8.1, `FieldHandle` exposes a zero-copy read-out of the live particle pool. The caller
allocates a typed array and the engine fills it in place — no per-frame garbage, suitable for
rAF-cadence reads, Worker transfer, and native sidecars.

```ts
handle.readParticles(out: Float32Array)              // packed records, PARTICLE_STRIDE floats each
handle.readParticleIds(out: Uint32Array)             // stable per-particle ids
handle.readParticleChannels(channels, out: Float32Array)  // selected channels only
```

`readParticles` packs each particle into `PARTICLE_STRIDE` floats; size `out` as at least
`particleCount() × PARTICLE_STRIDE`. `readParticleChannels` writes only the named channels,
in order, one stride-of-`channels.length` per particle — cheaper when you only need a subset.

The wire-format constants are exported from `@fundamental-engine/core`:

```ts
import { PARTICLE_STRIDE, PARTICLE_WIRE_VERSION } from '@fundamental-engine/core';
// PARTICLE_STRIDE = 5
// PARTICLE_WIRE_VERSION = 0
```

`PARTICLE_WIRE_VERSION` lets a consumer assert the layout it was compiled against still matches
the running engine before reading.

---

## Per-body / element metrics

Written to the DOM every frame as CSS custom properties (the `--field-*` family; the legacy
`--forces-*` CSS variables have been removed) and `data-field-{metric}` band attributes
(`low` / `mid` / `high`):

| Metric | CSS var | Description |
|---|---|---|
| `density` | `--field-density` | Gathered matter ∈ [0,1] |
| `attention` | `--field-attention` | Attention allocation ∈ [0,1] |
| `heat` | `--field-heat` | Thermal energy ∈ [0,1] |
| `entropy` | `--field-entropy` | Relationship conflict ∈ [0,1] |
| `coherence` | `--field-coherence` | Relationship resolution ∈ [0,1] |
| `memory` | `--field-memory` | Accumulated familiarity ∈ [0,1] |
| `pressure` | `--field-pressure` | Crowd/load ∈ [0,1] |
| `pull-x`, `pull-y` | `--field-pull-x/y` | Vector pull direction |
| `load` / `mass` | `--load`, `--mass` | Sink accretion fill ∈ [0,1] |
| `lit` | `--field-lit` | Cross-boundary lit signal ∈ [0,1] |
| `heatmap-density` | `--field-heatmap-density` | Heatmap cell density at this element's position |

These are written by `FeedbackRegistry` on the platform's write phase (or by the legacy engine
directly). They are readable without any JavaScript — a CSS rule like
`[data-body] { opacity: calc(0.4 + var(--field-density) * 0.6) }` is always live.

---

## DOM events

Dispatched on the `<field-root>` host element in both `field:*` and `forces:*` namespaces.
All are hysteretic — fired on edge crossings through configurable `enter`/`exit` thresholds
with debounce.

### Dispatched (live)

| Event | Trigger |
|---|---|
| `field:register-body` | A `[data-body]` element was scanned and registered |
| `field:unregister-body` | A body element was removed from the scan |
| `field:update-body` | A body's attributes changed |
| `field:lit` | A body crossed its `lit` enter threshold (another body's density spilled in) |
| `field:dim` | A body fell below its `lit` exit threshold |
| `field:captured` | A particle was claimed by a sink body |
| `field:released` | A particle was released from a sink |
| `field:relocated` | A docked element was moved by a force agent (§22.3) |

### Reserved (not yet dispatched)

`entered`, `exited`, `saturated`, `attention-shifted`, `relationship-strengthened`,
`memory-threshold`, `entropy-warning` — defined in contracts, not yet emitted.

---

## Platform state registry

`platform.state` — typed, per-element, subscribable:

```ts
state.observe(element, key, fn)   // subscribe to changes on a key
state.values(element)             // all state entries on an element
state.elements()                  // every element that holds state
```

Values are typed: `number | boolean | string | { x: number; y: number }` (Vector2).
The registry is the canonical channel for platform-layer state that isn't a CSS variable.

---

## Relationship graph

`platform.relationships` — each `FieldRelationship` exposes:

| Field | Type | Description |
|---|---|---|
| `strength` | `number ∈ [0,1]` | Current relationship strength |
| `tension` | `number` | Unresolved tension (divergent state) |
| `memory` | `number` | Accumulated familiarity |
| `active` | `boolean` | Whether the relationship is currently influencing |
| `direction` | `from-to \| to-from \| bidirectional` | Directional bias |
| `source` | `html \| aria \| data \| recipe \| runtime` | How the relationship was discovered |

---

## User agent state

`agents/user-agent.ts` tracks the pointer in field space:

| Field | Description |
|---|---|
| `px`, `py` | Pointer position in field coordinates |
| `vx`, `vy` | Pointer velocity |
| `focusId` | Currently focused element id |
| `selectionId` | Currently selected element id |
| `reducedMotion` | Whether `prefers-reduced-motion` is active |
| `scrollV` | Eased scroll speed: `(prev × 0.7) + (speed × 0.3)` per frame |

`scrollV` is used as a gate for the `scrolling` condition; it's observable in any force's
`when` clause. It is not exposed on `FieldHandle` — derivable externally from `window.scrollY`.

---

## Pull-based diagnostics

All of these are pure — they read state, they don't mutate physics.

### Energy accounting (`@fundamental-engine/core`)

```ts
import { energyReport, energyDrift } from '@fundamental-engine/core';
// or, without holding the particle array:
const { kinetic, thermal, total, count } = handle.energy();
```

`energyReport(particles)` takes the internal `Particle[]` directly; `handle.energy()` is the
externally accessible forward that doesn't require a particle reference.
`energyDrift(before, after)` gives fractional conservation drift between two total-energy
snapshots — used in regression tests.

### Performance budget (`@fundamental-engine/core`)

```ts
import { inspectBudget, withinBudget, DEFAULT_BUDGET } from '@fundamental-engine/core';

const findings = inspectBudget({
  particles: handle.particleCount(),
  bodies: document.querySelectorAll('[data-body]').length,
  localCells: document.querySelectorAll('field-cell').length,
});
// → BudgetFinding[] — each entry: { field, value, limit, over }
```

`DEFAULT_BUDGET` is `{ particles: 600, bodies: 80, localCells: 3, fieldLines: 256,
heatmapResolution: 6, dprCap: 2 }`. `inspectBudget` is partial-safe — supply only the
dimensions you can observe.

### Scene snapshot

```ts
import { captureSnapshot } from '@fundamental-engine/core';
```

`captureSnapshot(scenario)` runs a seeded `Scenario` through the pure engine and returns a
deterministic fingerprint `{ force, frames, seed, particleCount, meanSpeed, meanHeat }`. This
is a CI/regression tool, not a live-monitoring tool — it runs a fresh simulation, not the
running instance.

### System report

```ts
import { systemReport } from '@fundamental-engine/core';
const report = systemReport();
// → { forces, passports, contracts, recipes, agentTypes, conformanceExperiments,
//     forcesMissingPassport, forcesMissingConformance }
```

Aggregate counts for the registered force system. Loaded once; does not change at runtime.

### Force causality probes

```ts
import { causalityAt } from '@fundamental-engine/core';
const contributions = causalityAt(x, y);
// → CausalContribution[] — [{ token, dvx, dvy }, ...] ranked by |Δv|
```

Decomposes velocity at a point into per-force contributions. The `causality` overlay mode
renders this visually. Not for per-frame polling — intended for the overlay renderer and
one-shot inspector queries.

### Heatmap / density grid

`HeatmapGrid` (from `diagnostics/fields.ts`) and `ScalarGridData` (from
`diagnostics/potential.ts`) are `Float32Array`-backed grids sampling the field at configurable
resolution. These are the data behind the `heatmap`, `contours`, and `potential` overlay modes.
Not intended for external consumers — use the CSS variable `--field-heatmap-density` per body
instead.

---

## Platform extensions / render bridges

Beyond the engine's own observation channels, the platform layer adds bridges that relocate
where the field runs or renders.

### Off-main-thread render (`@fundamental-engine/dom`)

```ts
import { attachOffthreadRender } from '@fundamental-engine/dom';

const bridge = attachOffthreadRender(field, canvas);
// → OffthreadBridgeResult
```

The C3 off-main-thread render bridge (`packages/dom/src/worker/offthread-bridge.ts`) transfers
the canvas to a Worker via `OffscreenCanvas` so drawing runs off the main thread. It degrades
gracefully: when `OffscreenCanvas` is unavailable it returns `{ supported: false }` and the
caller keeps its on-thread render.

### Non-DOM observation (`@fundamental-engine/core`)

```ts
import { headlessHost } from '@fundamental-engine/core';

const host = headlessHost({ width: 1280, height: 720 });
```

`headlessHost` (re-exported from `./core/host-headless.ts`) is a reference `FieldHost` for
non-DOM environments — agents, native sidecars, and test harnesses. It provides a manual-tick
`raf` (you drive the loop) and a no-op scan root, so the full sim runs and is observable
(including via the wire-format read-out above) without a browser.

---

## Frame loop internals (not exposed)

The following are engine-internal and have no accessor on `FieldHandle`. They are documented
here so the gap is explicit:

| Observable | Source | External proxy |
|---|---|---|
| `env.frameN` | Frame counter, every tick | `platform.scheduler.frame` (platform-side count) |
| `env.t` | Elapsed seconds since boot | `performance.now()` offset |
| `env.dt` | Integration step — `1` normally, `0` under reduced-motion | `window.matchMedia('(prefers-reduced-motion: reduce)').matches` |
| `env.scrollV` | Eased scroll speed | Derivable from `window.scrollY` delta |
| `store.size` | Live particle count | **`handle.particleCount()`** — the accessor added for this |
| `store.particles[]` | Full particle pool | **`handle.energy()`** (aggregate summary) + **`handle.readParticles()` / `readParticleIds()` / `readParticleChannels()`** (zero-copy wire-format read-out, see below) |

There is no `frameDuration` measurement. The engine does not record how long a frame takes —
see the `FieldPerf` design direction below.

---

## `FieldPerf` — design direction (not yet implemented)

The runtime has no self-measurement of frame cost. This is the highest-priority observability
gap: `inspectBudget()` can tell you particle count is over limit, but can't tell you if that's
actually causing a frame-time problem.

The proposed surface — a `FieldPerf` object updated each frame alongside `Env`:

```ts
interface FieldPerf {
  frameDuration: number;      // ms, last frame total (sim + render combined)
  simDuration: number;        // ms, physics tick only
  renderDuration: number;     // ms, canvas draw only
  droppedFrames: number;      // cumulative count: frames where frameDuration > 1.5 × targetMs
  qualityTier: 0 | 1 | 2 | 3; // 0 = full quality, 3 = minimum viable
  cssWritesPerFrame: number;  // style mutations per frame (FeedbackRegistry writes)
  poolSize: number;           // current store.size
  poolHighWaterMark: number;  // max particles ever allocated in this session
}
```

Would be observable the same way `EnergyReport` is — pull-based via `handle.perf()`, with the
option to mirror key metrics as `--field-perf-*` CSS variables for CSS-driven debug overlays.

### Identified gaps in priority order

| Gap | Why it matters | Blocks |
|---|---|---|
| **Frame duration split** (`simDuration` / `renderDuration`) | Without it, you can't tell if the bottleneck is the physics tick or the canvas draw | Any meaningful perf regression story |
| **Adaptive quality governor** | Detect sustained budget overrun (e.g. 10 consecutive frames > 20 ms) and respond: reduce particle cap → simplify render mode → increase integration step → pause heatmap | Currently `prefers-reduced-motion` is the only lever, and it's binary |
| **Per-force timing** (`forceTimings: Map<token, avgMs>`) | With many bodies, hunt / metaball / shaped-source forces are meaningfully more expensive than others; no way to identify which `[data-body]` is expensive at runtime | Force author guidance; body-count tuning |
| **CSS write cost** (`cssWritesPerFrame`, `skippedElementUpdates`) | 80 bodies × 10 vars = 800 style mutations per frame; no metric for off-screen elements still receiving writes | FeedbackRegistry tuning |
| **Pool stability** (`poolHighWaterMark`, `particleAllocRate`) | The pool grows on demand with no shrink path; over a long session, no signal that it has stabilized | Session-length profiling |

The governor is the only one that changes runtime behavior rather than just observing it —
everything else is read-only instrumentation.
