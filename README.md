# Fundamental

**A platform-native relational field runtime for the DOM.** Semantic HTML, DOM elements, particles,
relationships, measurements, and feedback all participate in one shared field context. Elements bend
the field; the field bends them back. The visible particle canvas is one render surface, not the
whole system — and by default the field draws nothing at all.

[![Live demo: fundamental-engine.com](https://img.shields.io/badge/demo-fundamental--engine.com-4da3ff)](https://fundamental-engine.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![Core runtime dependencies: 0](https://img.shields.io/badge/core%20runtime%20deps-0-2dd4bf)
![TypeScript: strict](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Tests: 900+ passing](https://img.shields.io/badge/tests-900%2B%20passing-2dd4bf)
![API: frozen + additive](https://img.shields.io/badge/API-frozen%20%2B%20additive-4da3ff)

Mark any element as a body with one attribute and it starts to pull, push, swirl, or hold the matter
around it. Where the field gathers, it writes that density back into the element as weight, glow, and
motion. A renderer-agnostic core (`@fundamental-engine/core`) computes the field; a platform layer
(`@fundamental-engine/dom`) binds it to the DOM through measurement, state, feedback, relationships, visual
bindings, overlays, and a frame scheduler. The interface lives inside one medium instead of sitting on
top of an effect.

It is **native-platform-first, dependency-light, and framework-agnostic**: a custom element, a React
component, or a plain function. The core ships with zero runtime dependencies; framework integrations
are adapters, not requirements.

> **See it live.** The whole system runs over the engine at **[fundamental-engine.com](https://fundamental-engine.com)**, with a physics [Lab](https://fundamental-engine.com/lab) where you fire particles into a force and watch the math hold.

> **Now `@fundamental-engine`.** This project was `forces-ui`, then `field-ui`; it is now **Fundamental** — *fundamental forces acting across a field*. The engine's primitive is unchanged: `<field-root>`, `FieldHandle`, `createField`, and the `--field-*` CSS variables stay.

## The idea

Most particle backgrounds are one-way: the canvas reacts to the cursor. Fundamental is two-way, and it is bound to your layout. It is a **DOM ⇄ field runtime** loop, not DOM ⇄ canvas.

1. **Elements to field.** The platform's MeasurementRegistry reads each body's `getBoundingClientRect()` once per frame (the read phase). The body exerts force on the matter near it.
2. **Field to elements.** The field samples density around each body; the FeedbackRegistry writes it back as CSS variables (`--field-density`, with the compact `--d` as its alias) and thresholded events. Your CSS reads them to drive weight, size, color, or position.

The geometry is re-read every frame on a six-phase scheduler (`discover → read → compute → state → write → render`), so the invisible forces stay locked to the visible boxes through scroll, resize, and reflow, and reads never thrash against writes. Animating the DOM animates the simulation for free.

## Quick start

> **Signals-first by default.** A field created without a `render` mode draws **nothing** — it runs the
> full simulation and writes its results as signals: the `--field-*` / `--d` CSS variables, capture and
> proximity events, and `scrollV()`. That's the field as a *behavior layer*, the thing it's actually for.
> Opt into a visible surface with `render: 'dots'` (the particles), `'trails'`, `'streamlines'`, etc. The
> examples below pass `render: 'dots'` so you can see the field; drop it to drive your UI purely from the
> signals.
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

`@fundamental-engine/vanilla` is the framework-free door and the recommended starting point: a typed `FieldField` class, with `mountField()` and a host-bundled `createField()` re-exported, and no custom-element registration. To run the engine on a `<canvas>` you control yourself, call `createField(canvas, options)`.

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

Drop `<field-root>` once. It scans the document for `[data-body]` and `[data-preset]` elements and turns each into a body. The same markup works in Astro, Svelte, Vue, or static HTML with no change. `render="dots"` draws the particles; **omit `render` and the field is signals-only** — it still drives every `[data-body]` through the `--field-*` variables and events, it just doesn't paint a canvas.

## Author bodies in markup

A body is any element with a `data-body` attribute. The value is one or more force tokens, separated by spaces. **There is no body element** — every element is a body via the attribute.

| Attribute | Purpose |
|---|---|
| `data-body` | one or more force tokens (`attract`, `swirl`, `sink attract`, …) |
| `data-strength` | force magnitude (default `1`) |
| `data-range` | influence radius in pixels |
| `data-spin` | rotation sign and strength (`swirl`, `charge`, `magnetism`) |
| `data-angle` | heading in degrees (`stream`, `jet`) |
| `data-when` | act only on a condition: `active`, `fast`, `slow`, `hot`, `cool`, `scrolling` |
| `data-feedback` | opt into the two-way write-back (sets `--field-density` on the element) |
| `data-color` | accent color when the body is engaged |
| `data-absorb` / `data-max` | capture radius and capacity for `sink` |
| `data-preset` | expand a named composite (`blackhole`, `galaxy`, …) |

Engaging an element (hover, focus, tap) widens its range and amplifies its strength, so the field answers interaction.

## Native ports

The DOM is the first surface, not the only one. The engine is ported natively to other platforms,
each mirroring the same model (forces, recipes, the body contract) and held to the JS core by a shared
golden-conformance gate:

- **Swift (Apple platforms)** — a native Swift port in [`swift/`](swift/), running on a Metal/SwiftUI
  host. See the [Swift guide](https://fundamental-engine.com/docs/guides/swift).
- **Kotlin (Android)** — a native Kotlin port in [`android/`](android/) (core + platform + a Jetpack
  Compose host + the lab), at parity with Swift and JS. See the
  [Kotlin guide](https://fundamental-engine.com/docs/guides/kotlin).

The JS core remains the source of truth; engine/physics fixes land on every plane.

## The handle

`createField` / `new FieldField` / `<field-root>` all return (or wrap) the same `FieldHandle` — the
imperative surface for driving and reading a live field:

- **Drive it.** `setRender` / `setOverlay` (the two render *surfaces* — underlay + overlay), `setFormation`,
  `setAccent`, `setPalette`, `flowTo(x, y)` / `clearFlow`, `burst`, `scan` / `rescan`, `destroy`.
- **Read it.** `particleCount()`, `readParticles(out)` (the render-agnostic swarm read-out),
  `scrollV()`, `version` (which engine build this field is on — `FIELD_VERSION`).
- **Listen.** `on(type, cb)` returns an unsubscribe. Discrete events: `absorb` / `release` (a `sink`
  capturing matter) and the proximity triggers `enter` / `exit` / `met` (a body crossing another body's
  range — the gameplay "entered radius" signal).
- **Theme it.** `theme` (`'warm'` default, `'cool'`, `'mono'`) sets the heat ramp + wave baseline;
  `gradientCool` / `gradientWarm` / `waveBaseline` override individual lanes.
- **Adapt under load.** `setQualityTier(tier)` drops the effective DPR on a budget (the field is
  fill-rate-bound, not particle-bound); `<field-root>` applies it automatically.

## What's in the box

**36 forces**, in three families.

- **Canonical (9):** `attract`, `repel`, `swirl`, `stream`, `viscosity`, `jet`, `tether`, `wall`, `sink`. Designed interface verbs with bounded, legible falloff.
- **Natural (8):** `gravity`, `charge`, `magnetism`, `thermal`, `collide`, `diffuse`, `propagate`, `memory`. Real field laws: softened inverse-square, Lorentz, Langevin, diffusion, travelling waves.
- **Designed-extended (19):** `lens`, `gate`, `buoyancy`, `shear`, `crystallize`, `align`, `wind`, `cohesion`, `pressure`, `link`, `morph`, `hunt`, `spawn`, the `resonate`, `spotlight`, and `screen` modifiers, `pigment` color transport, field-line transport `fieldflow`, and wormhole relocate `warp`.

Forces also carry a four-field classification (gravity / electromagnetic / strong / weak), so the catalog reads as a translation of the four fundamental fields into interface behavior. See [`/docs/natural-fields`](https://fundamental-engine.com/docs/natural-fields).

**8 presets** compose those primitives into cosmology with no new engine code: `blackhole`, `whitehole`, `star`, `quasar`, `galaxy`, `nebula`, `tornado`, `fountain`.

**16 render modes (all shipped):** the matter/structure modes `dots`, `trails`, `links`, `streamlines`, `metaballs`, `voronoi`, `field-lines`, `heatmap`; and the diagnostic modes `force-vectors`, `contours`, `potential`, `energy`, `topology`, `inspector`, `causality`, `prediction`. Live on [`/docs/diagnostics`](https://fundamental-engine.com/docs/diagnostics).

**Controlled flow.** `field.flowTo(x, y)` places a movable flow focus the field bends toward — it pulls matter in and curves the streamlines; retarget it each frame to follow the pointer, an element, or a path (`field.clearFlow()` to release).

**5 formations** bias the whole field at once: `ambient`, `wells`, `lanes`, `scatter`, `accretion`.

**Reciprocal write-back.** Density returns to the elements through `--field-density` (local density; compact `--d` remains as its alias), `--load` (a sink's accretion fill), and `--lit` (cross-boundary spillover). Richer behaviors build on that loop:

- **Conserved attention.** One finite force budget across the page. Engaging a word pulls force off the others.
- **Cross-boundary causality.** A saturated body spills density to its neighbours, weighted by nearness.
- **Material typography.** One density value drives weight, optical size, tracking, glow, and color at once.
- **Self-laying-out layout.** Nodes find equilibrium positions from anchor, mutual repulsion, and density pressure, then re-settle on resize.

## Recipes and data

A **recipe** is a portable field program: it names an intent and composes existing tokens into behavior, with strict lanes (concepts describe, tokens execute, metrics measure, diagnostics explain, conditions activate). A recipe validates, compiles, applies, can be inspected, and carries a reduced-motion output. Recipes add **no** engine behavior.

**64 recipes across 4 tiers** (core / workflow / professional / enterprise) ship in the catalog. The runtime is three calls:

```ts
import { recipeById, compileRecipe } from '@fundamental-engine/core';            // pure: recipe → plan (no DOM)
import { applyRecipe, bindData } from '@fundamental-engine/dom';      // DOM: run it / bind data to it

const applied = applyRecipe(root, recipeById('reading-field')!); // run a recipe over a region
applied.inspect();                                               // { frame, measurements, relationships, lint }

bindData(listEl, tasks, (t) => ({                                // records → bodies; data drives the field
  id: t.id,
  body: { tokens: ['attract'], strength: 0.4 + t.priority },
  metrics: { priority: t.priority },
}), { recipe: 'priority-well' });
```

Browse and run all 64 at the [recipe gallery](https://fundamental-engine.com/docs/gallery), pick apart a compiled plan in the [inspector](https://fundamental-engine.com/docs/inspector), and see the three surfaces wired together in the [starter app](apps/starter). The [concept studies](https://fundamental-engine.com/docs/studies/reading-field) (Reading, Review, Search, System Weather, Evidence) reinterpret familiar pages as data-driven fields, and stay legible with the field off.

## Inspect and verify

**The field is readable, not a black box.** The [inspector](https://fundamental-engine.com/docs/inspector) reads the live platform each frame (the six-phase spine, registry counts, the typed relationship graph, and lint warnings) without mutating it.

**Per-force attribution.** A dimension-aware impulse accumulator captures every force's contribution to a particle through one canonical path, so the question *"which forces moved matter here, and by how much?"* has a structured answer (`accumulateAt` → net Δv + per-force breakdown). The causality and prediction diagnostics read it; it's the foundation for an inspectable, queryable substrate (see the [critical-path plan](docs/planning/critical-path)).

**Verified, not eyeballed.** A conformance framework fires known particles into each force and checks the measured trajectory against the math. The same catalog drives the test suite and the visual Lab. The repository carries **900+ deterministic tests** (core, platform, scheduler, lint, and the site) and a global safety sweep that holds every force finite, bounded in velocity and heat, and conserved in count. The release-readiness gates are pinned too: a [lifecycle contract](docs/canonical/lifecycle-contract.md) (create→register→measure→unmount, tested per surface), a [support matrix](docs/canonical/support-matrix.md) (browsers / DPR / reduced-motion / SSR, each row backed by a test), and a contract-coverage guard that fails CI if any public option or metric ships untested.

**The public surface is frozen and additive-only.** `pnpm check:api` fails the build if a stable export changes, `pnpm check:dist` verifies every package's entry points resolve, and `pnpm check:readme` keeps these READMEs true to the code. New options and methods may be **added**; nothing stable is renamed or removed without a major. See [API stability](docs/canonical/api-stability.md) and the [1.0 surface record](docs/planning/1.0-surface.md) for the full tiering.

## Packages

| Package | What it is |
|---|---|
| [`@fundamental-engine/core`](packages/core) | the renderer-agnostic engine: catalog, contracts, `FieldStore`, integrator, the force set, recipes (`compileRecipe`), diagnostics, conformance |
| [`@fundamental-engine/dom`](packages/dom) | DOM participation: `browserHost()`, the FrameScheduler, the six registries (measurement, state, feedback, relationships, visual bindings, overlays), `applyRecipe()` / `bindData()`, and `lintPlatform()` |
| [`@fundamental-engine/platform`](packages/platform) | **deprecated alias** of `@fundamental-engine/dom` — re-exports it (with a deprecation notice) so existing imports keep working; migrate to `dom` |
| [`@fundamental-engine/vanilla`](packages/vanilla) | the framework-free door: the `FieldField` class, `mountField()`, and a host-bundled `createField()`, no custom element |
| [`@fundamental-engine/elements`](packages/elements) | the `<field-root>` and `<field-cell>` custom elements (`<field-root>` is also registered as `<field-field>`) |
| [`@fundamental-engine/react`](packages/react) | the `<FieldField>` component and the `useFieldField()` hook |
| [`@fundamental-engine/three`](packages/three) | bind the engine to a Three.js scene: `createFieldLayer()` (the particle bridge → `THREE.Points`), `PlaneProjection` / `VolumeProjection`, `threeHost()`, `threeBackend()`. `three` is a peer dependency |

Install the specific package you need — `@fundamental-engine/vanilla` (the recommended door),
`@fundamental-engine/react`, `@fundamental-engine/elements`, or `@fundamental-engine/core`. (The
`@fundamental-engine/kit` / `fundamental-engine` umbrella packages were **retired in 0.7.0**.)

The dependency direction is strict and uniform: `elements → dom → core`, `react → dom → core`,
`vanilla → dom → core`. `@fundamental-engine/core` imports zero DOM (renderer-agnostic); the browser host
adapter lives in `@fundamental-engine/dom`. See [`docs/canonical/platform-architecture.md`](docs/canonical/platform-architecture.md).

**Native ports.** The engine is also ported, language-for-language, beyond the web — two of them, now at
parity. The [**Swift** package](swift/README.md) (`swift/`) covers iOS / macOS / visionOS; the
[**Kotlin / Android** port](android/README.md) (`android/`) covers Android and a desktop JVM. Each
mirrors the npm package layout (a pure renderer-agnostic core, the six-phase platform scheduler, and
native hosts — SwiftUI / UIKit-AppKit on Swift, Jetpack Compose / `View`-`Canvas` on Android) and ships
the full 36-force surface, the `FieldHandle` API, and a FieldLab. Both are held to the JS engine's force
math by a single shared, machine-checked **cross-plane conformance golden** — at `depth: 0` a ported
field and a JS field produce the same motion
([`docs/canonical/testing-and-conformance.md` §20](docs/canonical/testing-and-conformance.md)).

## Availability

The packages are published to npm under the `@fundamental-engine` scope, **with provenance** (signed Sigstore/SLSA build attestation). Most projects want **`npm i @fundamental-engine/vanilla`** (the host-bundled default door) or **`@fundamental-engine/react`** for React; `@fundamental-engine/elements` (web component) and `@fundamental-engine/core` (own the canvas) are there when you need them. No build step? Import from a CDN — `import { createField } from 'https://esm.sh/@fundamental-engine/vanilla'`. Releases publish from CI on a `vX.Y.Z` tag (see [`RELEASING.md`](RELEASING.md) / [`PUBLISHING.md`](PUBLISHING.md)). The public surface is frozen and additive-only; the support and versioning policy is in [`SUPPORT.md`](SUPPORT.md).

## Documentation

- **Field Manual** at [fundamental-engine.com](https://fundamental-engine.com): every concept running live over the engine.
- **Lab** at [fundamental-engine.com/lab](https://fundamental-engine.com/lab): fire particles into a force, watch the track, share the result through a URL.
- **Recipe gallery** at [fundamental-engine.com/docs/gallery](https://fundamental-engine.com/docs/gallery) and the **inspector** at [fundamental-engine.com/docs/inspector](https://fundamental-engine.com/docs/inspector).
- [`docs/README.md`](docs/README.md): the full documentation map (canonical architecture, engine reference, planning archive).
- [`docs/canonical/api-stability.md`](docs/canonical/api-stability.md) · [`docs/planning/1.0-surface.md`](docs/planning/1.0-surface.md): the frozen + additive surface and its tiering.
- [`docs/migration-0.x-to-1.0.md`](docs/migration-0.x-to-1.0.md): the 0.x → 1.0 upgrade checklist (the one behavior change, plus the all-additive rest).
- [`docs/canonical/lifecycle-contract.md`](docs/canonical/lifecycle-contract.md) · [`docs/canonical/support-matrix.md`](docs/canonical/support-matrix.md): the lifecycle, browser/DPR/reduced-motion/SSR support, and accessibility records.
- [`docs/engine-reference/forces-system.md`](docs/engine-reference/forces-system.md): the full engine specification.
- [`docs/engine-reference/forces-formulas.md`](docs/engine-reference/forces-formulas.md): per-force formulas and the attribute handbook.

## Develop

Fundamental is a pnpm monorepo. Development needs Node 22 or newer, because the test runner executes TypeScript directly.

```bash
pnpm install
pnpm -r typecheck   # tsc across packages
pnpm -r test        # node:test, no test framework
pnpm -r build       # the packages (tsc) and the site (Astro)
pnpm check:dist     # every package's entry points resolve and import cleanly
pnpm check:api      # the frozen public surface is intact (additive-only)
pnpm check:readme   # the READMEs stay true to the code (catalog counts, package names)
pnpm check:recipes  # the recipe catalog is well-formed
pnpm check:cem      # the custom-elements manifest is current
pnpm check:links    # internal doc links resolve
pnpm dev            # run the site locally
```

The build is `tsc`. There is no bundler; the library ships unbundled ESM. The site uses Astro as a build-time tool and ships no runtime JavaScript by default.

## Design principles

- **The field reacts to real elements.** The single background field responds to actual `data-body` elements, not a decorative particle pool layered on top.
- **Nothing is created from nothing.** The default field conserves particle count. Sources and sinks break conservation only when they are explicitly budgeted.
- **Designed and natural, side by side.** Canonical forces stay bounded and legible for interface work. Natural primitives carry real laws for cosmology and material systems. A composite picks the register it needs.
- **Native-platform-first, dependency-light.** The core recreates what it needs on the platform and ships with zero runtime dependencies; the only development dependency is TypeScript. Framework integrations are adapters, not requirements. Any new dependency has to justify itself as a real exception.
- **Core stays renderer-agnostic.** `@fundamental-engine/core` (core) computes field behavior against plain data and touches no DOM globals (guarded by a boundary test); `@fundamental-engine/dom` owns DOM participation. Canvas is one render surface, not the whole system.
- **Lanes stay separate.** Concepts describe, tokens execute, metrics measure, diagnostics explain, conditions activate, recipes compose. A word lives in exactly one lane, and recipes never invent engine behavior.
- **Framework-agnostic.** The custom element makes "every element is a body" a portable primitive that behaves the same in React, Svelte, Astro, Vue, or plain HTML.

## How to cite

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.XXXXXXX.svg)](https://doi.org/10.5281/zenodo.XXXXXXX)

If you use this work, please cite it via its concept DOI:

> Shallbetter, Z. (2026). *Fundamental* (Version 0.9.0) [Computer software].
> Zenodo. https://doi.org/10.5281/zenodo.XXXXXXX

<details>
<summary>BibTeX</summary>

```bibtex
@software{shallbetter_fundamental_engine,
  author    = {Shallbetter, Zachary},
  title     = {Fundamental},
  year      = {2026},
  publisher = {Zenodo},
  version   = {0.9.0},
  doi       = {10.5281/zenodo.XXXXXXX},
  url       = {https://doi.org/10.5281/zenodo.XXXXXXX}
}
```

</details>

A machine-readable [`CITATION.cff`](CITATION.cff) is also included. Update the DOI and version number after each Zenodo release.

## Contributing

Issues and pull requests are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow and conventions, report anything sensitive through [`SECURITY.md`](SECURITY.md), and see [`SUPPORT.md`](SUPPORT.md) for the support and versioning policy.

## Origins

Fundamental began as the homepage of [zachshallbetter.com](https://zachshallbetter.com) and outgrew it. This repository is the engine, its specification, and the prototype it was refactored from.

## License

[MIT](LICENSE).
