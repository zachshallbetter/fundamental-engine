# Fundamental

**A platform-native relational field runtime.** Semantic structures, bodies, particles, relationships,
measurements, agents, metrics, projections, and feedback all participate in one shared field context.
Bodies bend the field; the field bends them back. The DOM is the first host, not the boundary of the
system — the same field model can run headlessly, in native views, across design systems, inside AI
tools, over data records, or through custom render surfaces.

[![Live demo: fundamental-engine.com](https://img.shields.io/badge/demo-fundamental--engine.com-4da3ff)](https://fundamental-engine.com)
[![npm](https://img.shields.io/npm/v/@fundamental-engine/core?label=npm&color=2dd4bf)](https://www.npmjs.com/package/@fundamental-engine/core)
[![npm provenance](https://img.shields.io/badge/npm-provenance-2dd4bf?logo=npm)](https://www.npmjs.com/package/@fundamental-engine/core#provenance)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![Core runtime dependencies: 0](https://img.shields.io/badge/core%20runtime%20deps-0-2dd4bf)
![TypeScript: strict](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Tests: 900+ passing](https://img.shields.io/badge/tests-900%2B%20passing-2dd4bf)
![API: frozen + additive](https://img.shields.io/badge/API-frozen%20%2B%20additive-4da3ff)

Mark any semantic object as a body and it can pull, push, swirl, bind, hold, emit, or respond to the
field around it. On the web, that object is usually a DOM element. In a headless, native, AI, data, or
tool runtime, it may be a record, node, task, claim, source, window, process, file, agent, or synthetic
body. Where the field gathers, it exposes state as metrics, events, projections, diagnostics, snapshots,
or host-native feedback.

A renderer-agnostic core (`@fundamental-engine/core`) computes the field. Host adapters bind that field
to real platforms: `@fundamental-engine/dom` binds it to the DOM through measurement, state, feedback,
relationships, visual bindings, overlays, and a frame scheduler; native and headless hosts bind the same
model to other surfaces. The interface, tool, agent, dataset, or workspace lives inside one medium
instead of sitting on top of an effect.

It is **native-platform-first, dependency-light, and framework-agnostic**: a custom element, a React
component, a plain function, a headless service, or a native host. The core ships with zero runtime
dependencies; framework and platform integrations are adapters, not requirements.

> **See it live.** The whole system runs over the engine at
> **[fundamental-engine.com](https://fundamental-engine.com)**, with a physics
> [Lab](https://fundamental-engine.com/lab) where you fire particles into a force and watch the math hold.

> **Now `@fundamental-engine`.** This project was `forces-ui`, then `field-ui`; it is now
> **Fundamental** — *fundamental forces acting across a field*. The engine's primitive is unchanged:
> `<field-root>`, `FieldHandle`, `createField`, and the `--field-*` CSS variables stay.

## The idea

Most visual effects are one-way: a render surface reacts to a cursor, a component, or a scene.
Fundamental is two-way, and it is bound to real host objects. It is a **host ⇄ field runtime** loop,
not DOM ⇄ canvas.

1. **Host objects to field.** A host adapter measures or supplies each body's position, identity, role,
   relationships, and state. The body exerts influence into the shared field.
2. **Field to host objects.** The field samples density, pressure, memory, confidence, relationships,
   and other metrics around each body. The host adapter writes that state back as CSS variables, native
   view state, callback data, events, diagnostics, snapshots, or agent-readable query results.

The field can draw particles, trails, streamlines, contours, heatmaps, links, and diagnostics. It can
also draw nothing. In signals-first mode, the field remains fully active but exposes itself only through
measurements, events, feedback channels, query results, snapshots, and host-native projections.

### On the web

On the web, the host adapter is `@fundamental-engine/dom`. It reads each body's
`getBoundingClientRect()` during the read phase and writes feedback through CSS variables (`--d`,
`--field-*`), attributes, events, overlays, and visual bindings. The geometry is re-read on a six-phase
scheduler:

```txt
discover → read → compute → state → write → render
```

That keeps invisible forces locked to visible boxes through scroll, resize, and reflow, and reads never
thrash against writes. Animating the DOM animates the simulation for free.

## Terminology lanes

Fundamental keeps its vocabulary separated so the system remains inspectable rather than magical.

| Lane | What it is |
|---|---|
| **Field Pattern** | the authored arrangement — concept AND API name (`FieldPattern`) are the same word |
| **Field Contract** | compiled executable plan |
| **Configuration** | ordinary settings / options only |
| **Matter** | participants / substance only |

A **Field Pattern** is an authored arrangement of semantic intent, dimensions, bodies, fields, forces,
relationships, metrics, diagnostics, projections, and accessibility equivalents — `FieldPattern`,
`compilePattern`, `applyPattern`, `FIELD_PATTERNS`, the pattern catalog, pattern validation, pattern
routes, and `check:recipes` (the gate's real name, unchanged). The old names (`FieldRecipe`,
`compileRecipe`, `applyRecipe`, `FIELD_RECIPES`) are kept as `@deprecated` aliases through `1.0`. A
**Field Contract** is the compiled executable plan. A **Configuration** is ordinary settings only
(render / host / engine / adapter). **Matter** is the participant lane: particles, bodies, records,
nodes, glyphs, agents, or other things that participate in the field.

## Quick start

> **Signals-first by default.** A field created without a `render` mode draws **nothing** — it runs the
> full simulation and writes its results as signals: the `--field-*` / `--d` CSS variables, capture and
> proximity events, query results, snapshots, and host feedback. That's the field as a *behavior layer*,
> the thing it's actually for. Opt into a visible surface with `render: 'dots'` (the particles),
> `'trails'`, `'streamlines'`, etc. The examples below pass `render: 'dots'` so you can see the field;
> drop it to drive your UI purely from the signals.
>
> **Window or component.** By default a field spans the window; pass `bounds` (vanilla) to scope it to a
> single element instead — `new FieldField({ render: 'dots', bounds: cardEl })`.

### Vanilla TypeScript — the default door

```ts
import { FieldField } from '@fundamental-engine/vanilla';

const field = new FieldField({ render: 'dots' });
field.setFormation('wells');
field.burst(window.innerWidth / 2, 200);
// field.scan(); field.destroy();
```

`setFormation()` controls the global field-shape mode (`ambient`, `wells`, `lanes`, `scatter`,
`accretion`). This is *not* the same as a **Field Pattern**, which is the authored conceptual
arrangement represented by `FieldPattern` — same word, different lane; a mode and a Pattern don't
collide because "formation" (bare word) now refers only to the modes.

`@fundamental-engine/vanilla` is the framework-free door and the recommended starting point: a typed
`FieldField` class, with `mountField()` and a host-bundled `createField()` re-exported, and no
custom-element registration. To run the engine on a `<canvas>` you control yourself, call
`createField(canvas, options)`.

**No build step?** Import straight from a CDN — no install at all:

```html
<script type="module">
  import { createField } from 'https://esm.sh/@fundamental-engine/vanilla';
  createField(document.querySelector('canvas'), { render: 'dots' });
</script>
```

### React

```tsx
import { FieldField } from '@fundamental-engine/react';

export default function Page() {
  return (
    <>
      <FieldField render="dots" density={1} />
      <h1 data-body="attract" data-strength="1.2" data-feedback>Mass</h1>
    </>
  );
}
```

Reach for `useFieldField(options)` when you want the field handle instead of the component. Both clean up
on unmount automatically — see the [lifecycle contract](docs/canonical/lifecycle-contract.md).

### Web component (any stack, or plain HTML)

```html
<script type="module">
  import '@fundamental-engine/elements';
</script>

<field-root render="dots"></field-root>

<h1 data-body="attract" data-strength="1.2" data-feedback>Mass</h1>
<button data-body="repel" data-range="240">Keep clear</button>
```

Drop `<field-root>` once. It scans the document for `[data-body]` and `[data-preset]` elements and turns
each into a body. The same markup works in Astro, Svelte, Vue, or static HTML with no change.
`render="dots"` draws the particles; **omit `render` and the field is signals-only** — it still drives
every `[data-body]` through the `--field-*` variables and events, it just doesn't paint a canvas.

## Author bodies in markup

A body is any element with a `data-body` attribute. The value is one or more force tokens, separated by
spaces. **There is no body element** — every element is a body via the attribute.

| Attribute | Purpose |
|---|---|
| `data-body` | one or more force tokens (`attract`, `swirl`, `sink attract`, …) |
| `data-strength` | force magnitude (default `1`) |
| `data-range` | influence radius in pixels |
| `data-spin` | rotation sign and strength (`swirl`, `charge`, `magnetism`) |
| `data-angle` | heading in degrees (`stream`, `jet`) |
| `data-when` | act only on a condition: `active`, `fast`, `slow`, `hot`, `cool`, `scrolling` |
| `data-feedback` | opt into the two-way write-back; sets `--d`, `--field-density`, and related feedback channels |
| `data-color` | accent color when the body is engaged |
| `data-absorb` / `data-max` | capture radius and capacity for `sink` |
| `data-preset` | expand a named composite (`blackhole`, `galaxy`, …) |
| `data-authority` | who owns the body's position: `anchored` (default), `kinematic`, `dynamic` *(experimental)* |

Engaging an element (hover, focus, tap) widens its range and amplifies its strength, so the field answers
interaction.

`--d` is the canonical raw live density channel; `--field-density` is the longer field-namespaced alias
(and may also appear in named-metric contexts). `--load` is the canonical sink/accretion fill channel;
`--mass` is a legacy alias of `--load`.

## Native ports

The DOM is the first host, not the only one. The engine is ported natively to other platforms, each
mirroring the same model — forces, Field Patterns, the body contract, the handle surface, and conformance —
and held to the JS core by a shared golden-conformance gate.

- **Swift (Apple platforms)** — a native Swift port in [`swift/`](swift/README.md), running on a
  Metal/SwiftUI host. See the [Swift guide](https://fundamental-engine.com/docs/guides/swift).
- **Kotlin (Android)** — a native Kotlin port in [`android/`](android/README.md) (core + platform + a
  Jetpack Compose host + the lab), at parity with Swift and JS. See the
  [Kotlin guide](https://fundamental-engine.com/docs/guides/kotlin).

The JS core remains the source of truth; engine/physics fixes land on every plane.

## Headless runtime

Fundamental can run **without the DOM, without Canvas, and without `requestAnimationFrame`**. A headless
host lets the same field model run in a service, test harness, native sidecar, AI agent, OS-level tool,
data engine, or research process. Bodies may be supplied programmatically and read through callbacks,
queries, snapshots, edges, metrics, and diagnostics.

```ts
import { createField, headlessHost } from '@fundamental-engine/core';

const host = headlessHost({ width: 1920, height: 1080 });
const field = createField(undefined, { host, render: 'none' });

const body = field.addBody({
  tokens: ['attract'],
  strength: 1.4,
  range: 300,
  data: { kind: 'claim', id: 'claim-1' },
  rect: () => ({ x: 100, y: 120, width: 240, height: 80 }),
  onFeedback: (channels) => {
    // density, load, lit, entropy, coherence, temperature...
  },
});

host.tick();
const edges = field.readEdges();
const snapshot = field.snapshot?.();
```

The headless mode is what lets Fundamental become more than an interface effect: it can operate over
records, claims, documents, tasks, files, services, windows, agents, and synthetic bodies.

## The handle

`createField` / `new FieldField` / `<field-root>` all return (or wrap) the same `FieldHandle` — the
imperative surface for driving and reading a live field.

**Drive it:** `setRender`, `setOverlay`, `setFormation`, `setAccent`, `setPalette`, `flowTo(x, y)`,
`clearFlow`, `burst`, `scan` / `rescan`, `destroy`. `setRender` and `setOverlay` control the two render
surfaces (underlay + overlay); `setFormation()` controls the global field-shape modes (`ambient`,
`wells`, `lanes`, `scatter`, `accretion`).

**Read it:** `particleCount()`, `readParticles(out)`, `readEdges()`, `scrollV()`, `version`, and the
experimental substrate reads `query(q?)`, `snapshot(opts?)`, `diff(a, b)`.

- `query(q?)` asks the field a structured, read-only question — a point, rect, or whole-field query that
  returns plain data about bodies, metrics, relationships, and per-force influence. It is the
  agent/tool-readable surface.
- `snapshot(opts?)` captures *what the field is doing* at a frame as a versioned, serializable
  `FieldSnapshot`.
- `diff(a, b)` compares two snapshots across bodies, relationships, metrics, Field Formations,
  projections, and events.

**Listen:** `on(type, cb)` returns an unsubscribe. Discrete events include `absorb`, `release`, `enter`,
`exit`, `met`. The event layer is thresholded and debounced — not a per-frame firehose by default.

**Theme it:** `theme` (`'warm'`, `'cool'`, `'mono'`), `gradientCool`, `gradientWarm`, `waveBaseline`.

**Adapt under load:** `setQualityTier(tier)` drops the effective DPR on a budget. The field is
fill-rate-bound, not particle-bound; `<field-root>` applies it automatically.

## What's in the box

**36 forces**, in three families.

- **Canonical interface forces (9):** `attract`, `repel`, `swirl`, `stream`, `viscosity`, `jet`,
  `tether`, `wall`, `sink`. Designed interface verbs with bounded, legible falloff.
- **Natural forces (8):** `gravity`, `charge`, `magnetism`, `thermal`, `collide`, `diffuse`, `propagate`,
  `memory`. Real field laws: softened inverse-square, Coulomb/Lorentz behavior, Langevin noise,
  diffusion, travelling waves, and sediment-like memory.
- **Designed-extended forces and modifiers (19):** `lens`, `gate`, `buoyancy`, `shear`, `crystallize`,
  `align`, `wind`, `cohesion`, `pressure`, `link`, `morph`, `hunt`, `spawn`, `resonate`, `spotlight`,
  `screen`, `pigment`, `fieldflow`, `warp`.

Forces also carry a four-field classification — gravity, electromagnetic, strong, weak — so the catalog
reads as a translation of the four fundamental fields into interface behavior. See
[`/docs/natural-fields`](https://fundamental-engine.com/docs/natural-fields).

**8 presets** compose primitives into cosmology with no new engine code: `blackhole`, `whitehole`,
`star`, `quasar`, `galaxy`, `nebula`, `tornado`, `fountain`.

**20 render modes (all shipped):** the matter/structure modes `dots`, `trails`, `links`, `streamlines`,
`metaballs`, `voronoi`, `field-lines`, `heatmap`, `knockout` (matter as negative space in a field
wash), `redshift` (Doppler + gravitational spectral tint), `blackbody` (energy on a thermal ramp),
`depth` (the z lane as 2.5D — parallax, occlusion, defocus); and the diagnostic modes
`force-vectors`, `contours`, `potential`, `energy`, `topology`, `inspector`, `causality`,
`prediction`. Live on [`/docs/diagnostics`](https://fundamental-engine.com/docs/diagnostics).

**Controlled flow.** `field.flowTo(x, y)` places a movable flow focus the field bends toward — it pulls
matter in and curves the streamlines; retarget it each frame to follow the pointer, an element, a path,
or a synthetic host object (`field.clearFlow()` to release).

**5 formations** bias the whole field at once: `ambient`, `wells`, `lanes`, `scatter`, `accretion`. These
are lightweight field-shape modes exposed by `setFormation()` — not Field Patterns (the authored,
composed arrangement); "formation" (bare word) refers only to these modes.

**Reciprocal write-back.** Density returns to participants through `--d` (canonical raw live density),
`--field-density` (the field-namespaced alias / named-metric form), `--load` (a sink's accretion fill;
`--mass` is a legacy alias), and `--lit` (cross-boundary spillover / threshold state). Richer behaviors
build on that loop:

- **Conserved attention.** One finite force budget across a page or host context. Engaging one body pulls
  force off the others.
- **Cross-boundary causality.** A saturated body spills density to its neighbours, weighted by nearness.
- **Material typography.** One density value drives weight, optical size, tracking, glow, and color.
- **Self-laying-out layout.** Nodes find equilibrium positions from anchor, mutual repulsion, and density
  pressure, then re-settle on resize.

## Field Patterns and data

A **Field Pattern** is an authored arrangement of semantic intent, dimensions, bodies, fields, forces,
relationships, metrics, diagnostics, projections, and accessibility equivalents. The concept and its API
name are the same word — `FieldPattern`, `compilePattern`, `applyPattern`, `FIELD_PATTERNS`, the pattern
catalog, pattern routes, pattern validation, and `check:recipes` (the gate's real name, unchanged). The
old names (`FieldRecipe`, `compileRecipe`, `applyRecipe`, `FIELD_RECIPES`) are kept as `@deprecated`
aliases through `1.0`.

A Field Pattern names an intent and composes existing tokens into behavior, with strict lanes:

> Concepts describe. Dimensions hold state. Fields structure. Relationships associate. Forces couple.
> Tokens execute. Metrics measure. Diagnostics explain. Conditions activate. Projections reveal.
> Field Patterns compose. FieldPattern represents. Field Contracts execute. **No word lives in two lanes.**

A Field Pattern validates, compiles, applies, can be inspected, and carries a reduced-motion output. It
adds **no** engine behavior. **64 Field Patterns across 4 tiers** (core / workflow / professional /
enterprise) ship in the catalog. The runtime is three calls:

```ts
import { patternById, compilePattern } from '@fundamental-engine/core';         // pure: pattern → plan (no DOM)
import { applyPattern, bindData } from '@fundamental-engine/dom';    // DOM: run it / bind data to it

const pattern  = patternById('reading-field')!;
const contract = compilePattern(pattern);           // pure: FieldPattern → Field Contract
const applied  = applyPattern(root, pattern);        // DOM: run it over a region
applied.inspect();                                  // { frame, measurements, relationships, lint }

bindData(listEl, tasks, (t) => ({                   // records → bodies; data drives the field
  id: t.id,
  body: { tokens: ['attract'], strength: 0.4 + t.priority },
  metrics: { priority: t.priority },
}), { pattern: 'priority-well' });
```

Browse and run all 64 patterns at the [pattern gallery](https://fundamental-engine.com/docs/patterns), pick apart a
compiled plan in the [inspector](https://fundamental-engine.com/docs/inspector), and see the three
surfaces wired together in the [starter app](apps/starter). The
[concept studies](https://fundamental-engine.com/docs/studies/reading-field) (Reading, Review, Search,
System Weather, Evidence) reinterpret familiar pages as data-driven fields, and stay legible with the
field off.

## Field Query, Snapshots, and Causal Replay

**Fundamental is readable. It is not a black box.**

### Field Query

`query(q?)` is the structured read surface — it lets tools, AI agents, tests, inspectors, and host
adapters ask the field what is happening. A query takes a location (`at`: a point, a `DOMRect`-shaped
rect, or omitted for the whole field), a `radius`, the sections to `include`, and an optional **lens**
that scopes the answer:

```ts
const reading = field.query({
  at: el.getBoundingClientRect(),                    // point {x,y} | DOMRect-shaped rect | omitted = whole field
  radius: 320,
  include: ['bodies', 'metrics', 'relationships', 'influences'],
  lens: { id: 'attention', metrics: ['attention', 'confidence', 'memory'], channels: ['linear'] },
});
```

A query can answer: *what is dense here? what is pulling attention? which bodies are influencing this one?
which relationships are active? which forces caused this state? which regions are unstable? what changed
since the last snapshot?* A `FieldLens` is **user-defined** — each clause (`metrics`, influence
`channels`, body `tokens`) is an allow-list, and the standalone `applyLens(result, lens)` is exported and
pure, so the same lens composes over any reading.

### Field Snapshot

A `FieldSnapshot` captures *what the field is doing* at a frame: bodies, positions, authority modes,
dimensions, relationships, metrics, active forces, influence attribution, projections, diagnostics,
events, time, and host metadata. A screenshot captures what something looked like; a Field Snapshot
captures what it was *doing*.

### Causal Replay

Causal Replay explains *how* a state happened — an ordered, typed account of the formations,
relationships, metrics, and forces that moved the field between two snapshots:

```txt
t0  Claim A gained attention
t1  Citation B increased support cohesion
t2  Contradiction C introduced charge separation
t3  confidence dropped
t4  the Evidence Field became unstable
```

This is the foundation for inspectable AI evidence, debugging, compliance, design-system governance,
observability, and agent reasoning.

## Projection and accessibility

A **projection** is how a host reveals field state. Projection is separate from coupling: a projection can
reveal a dimension without allowing that dimension to cause motion or mutation.

| Dimension | Projects to |
|---|---|
| density | motion, weight, contrast, outline, annotation |
| memory | trail, tint, sediment, history mark |
| confidence | stability, opacity, badge, topology, explanation |
| conflict | separation, charge, split border, warning annotation |
| depth | scale, blur, occlusion, layering |
| time | trail, decay, ghost, replay, sediment |

**Reduced motion does not remove meaning — it changes the projection.** A density that becomes movement,
orbit, flow, or pull under a motion projection becomes contrast, weight, outline, spacing, annotation,
order, sound, or haptic feedback under a reduced-motion one. **Accessibility is not fallback;
accessibility is alternate projection.** Every Field Pattern must carry an accessibility equivalent, and
projections can be auto-applied each write phase (`field.projections.bind`) — including the `agent-json`
surface, whose output is a serializable reading rather than a visual write.

## Inspect and verify

**The field is readable, not a black box.** The [inspector](https://fundamental-engine.com/docs/inspector)
reads the live platform each frame — the six-phase spine, registry counts, the typed relationship graph,
active formations, metrics, projections, and lint warnings — without mutating it.

**Per-force attribution.** A dimension-aware impulse accumulator captures every force's contribution
through one canonical path — **linear, thermal, and angular today, with temporal and semantic channels
reserved** — so the question *"which forces moved matter here, and by how much?"* has a structured answer
(`accumulateAt` → net Δv + per-force breakdown). The causality and prediction diagnostics read it; it is
the foundation for an inspectable, queryable substrate (see the
[critical-path plan](docs/planning/critical-path)).

**Body authority is explicit.** A body has one of three authority modes:

| Mode | Meaning |
|---|---|
| `anchored` | host geometry is authoritative; default for stable interface bodies |
| `kinematic` | the engine writes transform or host-native movement |
| `dynamic` | the engine owns position, velocity, and possibly mass *(experimental)* |

Anchored bodies keep UI and host layout coherent; kinematic bodies let the field move visible objects;
dynamic bodies are required for fully physical recoil and deeper simulation.

**Verified, not eyeballed.** A conformance framework fires known particles into each force and checks the
measured trajectory against the math. The same catalog drives the test suite and the visual Lab. The
repository carries **900+ deterministic tests** (core, platform, scheduler, lint, and the site) and a
global safety sweep that holds every force finite, bounded in velocity and heat, and conserved in count.
There is also a [performance suite](docs/engine-reference/performance.md) that measures the engine's
algorithmic cost and documents why the field is fill-rate-bound, not particle-bound. The
release-readiness gates are pinned too: a [lifecycle contract](docs/canonical/lifecycle-contract.md), a
[support matrix](docs/canonical/support-matrix.md), a contract-coverage guard, an API-surface guard, a
README truth guard, pattern-catalog validation, custom-elements-manifest validation, and internal-link
validation.

**The stable public surface is frozen; new surface is added additively.** `pnpm check:api` fails the build
if a stable export changes, `pnpm check:dist` verifies every package's entry points resolve, and
`pnpm check:readme` keeps these READMEs true to the code. New options and methods (including the
experimental substrate API — `query`/`snapshot`/`diff`/`replay`/`forAgent`/projections) may be **added**;
nothing stable is renamed or removed without a major. See [API stability](docs/canonical/api-stability.md) and the
[1.0 surface record](docs/planning/1.0-surface.md) for the full tiering.

## Packages

All seven publish to [npm](https://www.npmjs.com/org/fundamental-engine) under the `@fundamental-engine` scope, in lockstep, **with provenance**. (GitHub's "Packages" tab stays empty because that's the separate GitHub Packages registry — these live on npm.org.)

| Package | npm | What it is |
|---|---|---|
| [`@fundamental-engine/core`](packages/core) | [![npm](https://img.shields.io/npm/v/@fundamental-engine/core?label=&color=2dd4bf)](https://www.npmjs.com/package/@fundamental-engine/core) | renderer-agnostic field runtime: bodies, agents, forces, Field Patterns, Field Contracts, integrator, diagnostics, snapshots, query, conformance |
| [`@fundamental-engine/dom`](packages/dom) | [![npm](https://img.shields.io/npm/v/@fundamental-engine/dom?label=&color=2dd4bf)](https://www.npmjs.com/package/@fundamental-engine/dom) | web host adapter: `browserHost()`, the FrameScheduler, measurement / state / feedback / relationships / visual bindings / overlays, `applyPattern()` / `bindData()`, and `lintPlatform()` |
| [`@fundamental-engine/vanilla`](packages/vanilla) | [![npm](https://img.shields.io/npm/v/@fundamental-engine/vanilla?label=&color=2dd4bf)](https://www.npmjs.com/package/@fundamental-engine/vanilla) | framework-free web door: `FieldField`, `mountField()`, and a host-bundled `createField()`, no custom element |
| [`@fundamental-engine/elements`](packages/elements) | [![npm](https://img.shields.io/npm/v/@fundamental-engine/elements?label=&color=2dd4bf)](https://www.npmjs.com/package/@fundamental-engine/elements) | the `<field-root>` and `<field-cell>` custom elements (`<field-root>` is also registered as `<field-field>`) |
| [`@fundamental-engine/react`](packages/react) | [![npm](https://img.shields.io/npm/v/@fundamental-engine/react?label=&color=2dd4bf)](https://www.npmjs.com/package/@fundamental-engine/react) | the `<FieldField>` component and the `useFieldField()` hook |
| [`@fundamental-engine/three`](packages/three) | [![npm](https://img.shields.io/npm/v/@fundamental-engine/three?label=&color=2dd4bf)](https://www.npmjs.com/package/@fundamental-engine/three) | Three.js host and projection adapter: `createFieldLayer()`, `PlaneProjection`, `VolumeProjection`, `threeHost()`, `threeBackend()`; `three` is a peer dependency |
| [`@fundamental-engine/create`](packages/create) | [![npm](https://img.shields.io/npm/v/@fundamental-engine/create?label=&color=2dd4bf)](https://www.npmjs.com/package/@fundamental-engine/create) | project scaffolder — `npm create @fundamental-engine` generates a vanilla / React / web-component starter |

Install the specific package you need:

```bash
npm create @fundamental-engine     # scaffold a new project (fastest start)
npm i @fundamental-engine/vanilla   # the recommended door
npm i @fundamental-engine/react     # for React
npm i @fundamental-engine/elements  # the web component
npm i @fundamental-engine/core      # own the canvas / renderer-agnostic core
```

The `@fundamental-engine/kit` / `fundamental-engine` umbrella packages were **retired in 0.7.0**. The
dependency direction is strict and uniform:

```txt
elements → dom → core
react    → dom → core
vanilla  → dom → core
three    → core / host adapter
```

`@fundamental-engine/core` imports zero DOM; the browser host adapter lives in `@fundamental-engine/dom`.
See [`docs/canonical/platform-architecture.md`](docs/canonical/platform-architecture.md).

**Native ports.** The engine is also ported, language-for-language, beyond the web. The
[Swift package](swift/README.md) (`swift/`) covers iOS / macOS / visionOS; the
[Kotlin / Android port](android/README.md) (`android/`) covers Android and a desktop JVM. Each mirrors
the npm package layout (a pure renderer-agnostic core, the six-phase platform scheduler, a native host,
and a native lab) and ships the full 36-force surface, the `FieldHandle` API, and a FieldLab. Both are
held to the JS engine's force math by a single shared, machine-checked **cross-plane conformance
golden** — at `depth: 0` a ported field and a JS field produce the same motion
([`docs/canonical/testing-and-conformance.md`](docs/canonical/testing-and-conformance.md)).

## Availability

The packages are published to npm under the `@fundamental-engine` scope, **with provenance** (signed
Sigstore/SLSA build attestation). Most web projects want **`npm i @fundamental-engine/vanilla`** (the
host-bundled default door) or **`@fundamental-engine/react`** for React; `@fundamental-engine/elements`
and `@fundamental-engine/core` are there when you need them. No build step? Import from a CDN —
`import { createField } from 'https://esm.sh/@fundamental-engine/vanilla'`. Releases publish from CI on a
`vX.Y.Z` tag (see [`RELEASING.md`](RELEASING.md) / [`PUBLISHING.md`](PUBLISHING.md)). The stable public
surface is frozen, with new surface added additively; the support and versioning policy is in [`SUPPORT.md`](SUPPORT.md).

## Documentation

- **Field Manual** at [fundamental-engine.com](https://fundamental-engine.com): every concept running live
  over the engine.
- **Lab** at [fundamental-engine.com/lab](https://fundamental-engine.com/lab): fire particles into a
  force, watch the track, share the result through a URL.
- **Pattern gallery** at [fundamental-engine.com/docs/patterns](https://fundamental-engine.com/docs/patterns)
  and the **inspector** at [fundamental-engine.com/docs/inspector](https://fundamental-engine.com/docs/inspector).
- [`docs/README.md`](docs/README.md): the full documentation map.
- [`docs/canonical/api-stability.md`](docs/canonical/api-stability.md) ·
  [`docs/planning/1.0-surface.md`](docs/planning/1.0-surface.md): the frozen + additive surface and its tiering.
- [`docs/analysis/migration-0.x-to-1.0.md`](docs/analysis/migration-0.x-to-1.0.md): the 0.x → 1.0 upgrade checklist.
- [`docs/canonical/lifecycle-contract.md`](docs/canonical/lifecycle-contract.md) ·
  [`docs/canonical/support-matrix.md`](docs/canonical/support-matrix.md): the lifecycle, browser/DPR/
  reduced-motion/SSR support, and accessibility records.
- [`docs/engine-reference/forces-system.md`](docs/engine-reference/forces-system.md): the full engine specification.
- [`docs/engine-reference/forces-formulas.md`](docs/engine-reference/forces-formulas.md): per-force formulas and the attribute handbook.
- [`docs/engine-reference/performance.md`](docs/engine-reference/performance.md): the performance suite and the fill-rate-vs-particle-bound story.
- [`docs/canonical/dimensional-coupling.md`](docs/canonical/dimensional-coupling.md): dimensions, association, coupling, projections, body authority, and restoring collapsed dimensions.
- [`docs/canonical/authoring-and-recipes.md`](docs/canonical/authoring-and-recipes.md): FieldPattern, authoring levels, validation, and reduced-motion requirements.
- [`docs/planning/critical-path`](docs/planning/critical-path): Field Query, Field Snapshot, Causal Replay, the dimension-aware accumulator, body authority, the projection registry, and governance planning.

## Develop

Fundamental is a pnpm monorepo. Development needs Node 22 or newer, because the test runner executes
TypeScript directly.

```bash
pnpm install
pnpm -r typecheck   # tsc across packages
pnpm -r test        # node:test, no test framework
pnpm -r build       # the packages (tsc) and the site (Astro)
pnpm check:dist     # every package's entry points resolve and import cleanly
pnpm check:api      # the frozen public surface is intact (additive-only)
pnpm check:readme   # the READMEs stay true to the code (catalog counts, package names)
pnpm check:recipes  # the pattern catalog is well-formed
pnpm check:cem      # the custom-elements manifest is current
pnpm check:links    # internal doc links resolve
pnpm dev            # run the site locally
```

The build is `tsc`. There is no bundler; the library ships unbundled ESM. The site uses Astro as a
build-time tool and ships no runtime JavaScript by default.

## Design principles

- **The field reacts to real host objects.** A field responds to actual bodies — DOM elements, native
  views, records, nodes, claims, agents, tasks, files, windows, or synthetic bodies — not a decorative
  particle pool layered on top.
- **Host-agnostic by design.** The DOM is the first host, not the limit. The core computes field behavior
  over bodies, agents, relationships, metrics, and projections; host adapters decide how that state is
  measured, written, rendered, queried, or persisted.
- **Signals-first.** Rendering is optional. The field can run with no visible surface and still drive
  feedback, events, metrics, queries, snapshots, and host-native projections.
- **Nothing is created from nothing.** The default field conserves particle count. Sources and sinks
  break conservation only when explicitly budgeted.
- **Designed and natural, side by side.** Canonical forces stay bounded and legible for interface work;
  natural primitives carry real laws for cosmology and material systems. A composite picks the register
  it needs.
- **Core stays renderer-agnostic.** `@fundamental-engine/core` computes field behavior against plain data
  and touches no DOM globals; host adapters own host participation. Canvas is one render surface, not the
  whole system.
- **Lanes stay separate.** Concepts describe. Dimensions hold state. Fields structure. Relationships
  associate. Forces couple. Tokens execute. Metrics measure. Diagnostics explain. Conditions activate.
  Projections reveal. Field Patterns compose. FieldPattern represents. Field Contracts execute. No word
  lives in two lanes, and Field Patterns never invent engine behavior.
- **Accessibility is alternate projection.** Reduced motion removes motion, not meaning. Every
  motion-heavy behavior must have a semantic, static, or host-native equivalent.
- **Explainability is a feature.** Every visible behavior should be explainable through diagnostics,
  snapshots, query results, or causal replay.
- **Native-platform-first, dependency-light.** The core recreates what it needs on the platform and ships
  with zero runtime dependencies. Framework integrations are adapters, not requirements. Any new
  dependency has to justify itself as a real exception.
- **Framework-agnostic.** The body contract behaves the same in React, Svelte, Astro, Vue, plain HTML,
  native hosts, and headless runtimes.

## How to cite

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20989937.svg)](https://doi.org/10.5281/zenodo.20989937)

If you use this work, please cite it via its concept DOI (it always resolves to the latest release):

> Shallbetter, Z. (2026). *Fundamental* (Version 0.9.3) [Computer software].
> Zenodo. https://doi.org/10.5281/zenodo.20989937

<details>
<summary>BibTeX</summary>

```bibtex
@software{shallbetter_fundamental_engine,
  author    = {Shallbetter, Zachary},
  title     = {Fundamental},
  year      = {2026},
  publisher = {Zenodo},
  version   = {0.9.3},
  doi       = {10.5281/zenodo.20989937},
  url       = {https://doi.org/10.5281/zenodo.20989937}
}
```

</details>

A machine-readable [`CITATION.cff`](CITATION.cff) is also included. Update the version number after each
Zenodo release; the concept DOI stays the same.

## Contributing

Issues and pull requests are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow and
conventions, report anything sensitive through [`SECURITY.md`](SECURITY.md), and see
[`SUPPORT.md`](SUPPORT.md) for the support and versioning policy.

## Origins

Fundamental began as the homepage of [zachshallbetter.com](https://zachshallbetter.com) and outgrew it.
This repository is the engine, its specification, and the prototype it was refactored from.

## License

[MIT](LICENSE).
