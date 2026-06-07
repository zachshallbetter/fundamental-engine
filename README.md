# field-ui

**A platform-native relational field runtime for the DOM.** Semantic HTML, DOM elements, particles,
relationships, measurements, and feedback all participate in one shared field context. Elements bend
the field; the field bends them back. The visible particle canvas is one render surface, not the
whole system.

[![Live demo: field-ui.com](https://img.shields.io/badge/demo-field--ui.com-4da3ff)](https://field-ui.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![Core runtime dependencies: 0](https://img.shields.io/badge/core%20runtime%20deps-0-2dd4bf)
![TypeScript: strict](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Tests: 560+ passing](https://img.shields.io/badge/tests-560%2B%20passing-2dd4bf)

Mark any element as a body with one attribute and it starts to pull, push, swirl, or hold the matter
around it. Where the field gathers, it writes that density back into the element as weight, glow, and
motion. A renderer-agnostic core (`@field-ui/core`) computes the field; a platform layer
(`@field-ui/platform`) binds it to the DOM through measurement, state, feedback, relationships,
visual bindings, overlays, and a frame scheduler. The interface lives inside one medium instead of
sitting on top of an effect.

It is **native-platform-first, dependency-light, and framework-agnostic** — a custom element, a React
component, or a plain function. The core ships with zero runtime dependencies; framework integrations
are adapters, not requirements.

> **See it live.** The whole system runs over the engine at **[field-ui.com](https://field-ui.com)**, with a physics [Lab](https://field-ui.com/lab) where you fire particles into a force and watch the math hold.

> **Renamed to `field-ui`.** This project was `forces-ui`; it is now **field-ui**, putting the field — the invisible structure — first. Every old public name still works as a compatibility alias during the transition: the `forces-ui` / `@forces-ui/*` packages, the `forces:*` events, the `--forces-*` CSS variables, and the `<forces-field>` / `<forces-cell>` elements all keep working alongside their `field-ui` / `field:*` / `--field-*` / `<field-root>` equivalents. See the [docs map](docs/README.md).

## The idea

Most particle backgrounds are one-way: the canvas reacts to the cursor. field-ui is two-way, and it is bound to your layout — a **DOM ⇄ field runtime** loop, not DOM ⇄ canvas.

1. **Elements to field.** The platform's MeasurementRegistry reads each body's `getBoundingClientRect()` once per frame (the read phase). The body exerts force on the matter near it.
2. **Field to elements.** The field samples density around each body; the FeedbackRegistry writes it back as CSS variables (`--field-density`, with the compact `--d` and `--forces-density` as legacy aliases) and thresholded events. Your CSS reads them to drive weight, size, colour, or position.

The geometry is re-read every frame on a six-phase scheduler (`discover → read → compute → state → write → render`), so the invisible forces stay locked to the visible boxes through scroll, resize, and reflow, and reads never thrash against writes. Animating the DOM animates the simulation for free.

## Quick start

### Web component (any stack, or plain HTML)

```html
<script type="module">
  import '@field-ui/elements';
</script>

<field-root></field-root>

<h1 data-body="attract" data-strength="1.2" data-feedback>Mass</h1>
<button data-body="repel" data-range="240">Keep clear</button>
```

Drop `<field-root>` once (the `<forces-field>` alias still works). It scans the document for `[data-body]` and `[data-preset]` elements and turns each into a body. The same markup works in Astro, Svelte, Vue, or static HTML with no change.

### React

```tsx
import { FieldField } from '@field-ui/react';

export default function Page() {
  return (
    <>
      <FieldField density={1} />
      <h1 data-body="attract" data-strength="1.2" data-feedback>Mass</h1>
    </>
  );
}
```

Reach for `useFieldField(options)` when you want the field handle instead of the component.

### Vanilla TypeScript

```ts
import { FieldField } from '@field-ui/vanilla';

const field = new FieldField({ render: 'dots' });
field.setFormation('wells');
field.burst(window.innerWidth / 2, 200);
// field.scan(); field.destroy();
```

`@field-ui/vanilla` is the framework-free door: a typed `FieldField` class, with `mountField()` and `createField()` re-exported, and no custom-element registration. To run the engine on a `<canvas>` you control yourself, call `createField(canvas, options)`.

## Author bodies in markup

A body is any element with a `data-body` attribute. The value is one or more force tokens, separated by spaces.

| Attribute | Purpose |
|---|---|
| `data-body` | one or more force tokens (`attract`, `swirl`, `sink attract`, …) |
| `data-strength` | force magnitude (default `1`) |
| `data-range` | influence radius in pixels |
| `data-spin` | rotation sign and strength (`swirl`, `charge`, `magnetism`) |
| `data-angle` | heading in degrees (`stream`, `jet`) |
| `data-when` | act only on a condition: `active`, `fast`, `slow`, `hot`, `cool` |
| `data-feedback` | opt into the two-way write-back (sets `--d` on the element) |
| `data-color` | accent colour when the body is engaged |
| `data-absorb` / `data-max` | capture radius and capacity for `sink` |
| `data-preset` | expand a named composite (`blackhole`, `galaxy`, …) |

Engaging an element (hover, focus, tap) widens its range and amplifies its strength, so the field answers interaction.

## What's in the box

**34 forces**, in three families.

- **Canonical (9):** `attract`, `repel`, `swirl`, `stream`, `viscosity`, `jet`, `tether`, `wall`, `sink`. Designed interface verbs with bounded, legible falloff.
- **Natural (8):** `gravity`, `charge`, `magnetism`, `thermal`, `collide`, `diffuse`, `propagate`, `memory`. Real field laws: softened inverse-square, Lorentz, Langevin, diffusion, travelling waves.
- **Designed-extended (16):** `lens`, `gate`, `buoyancy`, `shear`, `crystallize`, `align`, `wind`, `cohesion`, `pressure`, `link`, `morph`, `hunt`, `spawn`, the `resonate` and `spotlight` modifiers, and `pigment` colour transport.

**8 presets** compose those primitives into cosmology with no new engine code: `blackhole`, `whitehole`, `star`, `quasar`, `galaxy`, `nebula`, `tornado`, `fountain`.

**Render modes (all shipped):** the matter/structure modes `dots`, `trails`, `links`, `streamlines`, `metaballs`, `voronoi`, `field-lines`, `heatmap`; and the diagnostic modes `force-vectors`, `contours`, `potential`, `energy`, `topology`, `inspector`, `causality`, `prediction`. Live on [`/docs/diagnostics`](https://field-ui.com/docs/diagnostics).

**Controlled flow.** `field.flowTo(x, y)` places a movable flow focus the field bends toward — it pulls matter in and curves the streamlines; retarget it each frame to follow the pointer, an element, or a path (`field.clearFlow()` to release).

**5 formations** bias the whole field at once: `ambient`, `wells`, `lanes`, `scatter`, `accretion`.

**Reciprocal write-back.** Density returns to the elements through `--field-density` (local density; compact `--d` and `--forces-density` remain as aliases), `--load` (a sink's accretion fill), and `--lit` (cross-boundary spillover). Richer behaviors build on that loop:

- **Conserved attention.** One finite force budget across the page. Engaging a word pulls force off the others.
- **Cross-boundary causality.** A saturated body spills density to its neighbours, weighted by nearness.
- **Material typography.** One density value drives weight, optical size, tracking, glow, and colour at once.
- **Self-laying-out layout.** Nodes find equilibrium positions from anchor, mutual repulsion, and density pressure, then re-settle on resize.

**Verified, not eyeballed.** A conformance framework fires known particles into each force and checks the measured trajectory against the math. The same catalog drives the test suite and the visual Lab. The repository carries 560+ deterministic tests (core, platform, scheduler, lint, and the site) and a global safety sweep that holds every force finite, bounded in velocity and heat, and conserved in count.

## Packages

| Package | What it is |
|---|---|
| [`field-ui`](packages/core) | the renderer-agnostic engine: catalog, contracts, `FieldStore`, integrator, the force set, diagnostics, conformance |
| [`@field-ui/platform`](packages/platform) | DOM participation: the FrameScheduler and the six registries (measurement, state, feedback, relationships, visual bindings, overlays) + `lintPlatform()` |
| [`@field-ui/vanilla`](packages/vanilla) | the framework-free door: the `FieldField` class and `mountField()`, no custom element |
| [`@field-ui/elements`](packages/elements) | the `<field-root>` and `<field-cell>` custom elements (`<forces-field>` / `<forces-cell>` aliases too) |
| [`@field-ui/react`](packages/react) | the `<FieldField>` component and the `useFieldField()` hook |

The dependency direction is strict and uniform: `elements → platform → core`, `react → platform → core`,
`vanilla → platform → core`. `@field-ui/core` imports zero DOM (renderer-agnostic); the browser host
adapter lives in `@field-ui/platform`. See [`docs/canonical/field-ui-platform-architecture.md`](docs/canonical/field-ui-platform-architecture.md).

## Availability

The packages are pre-release and not yet published to npm. Each release is cut as a git tag (see [`RELEASING.md`](RELEASING.md)). To use field-ui today, consume it from this repository as a workspace dependency, a git install, or a local link. The public API shown above is stable; the `npm install` path arrives with the first published release.

## Documentation

- **Field Manual** at [field-ui.com](https://field-ui.com): every concept running live over the engine.
- **Lab** at [field-ui.com/lab](https://field-ui.com/lab): fire particles into a force, watch the track, share the result through a URL.
- [`docs/engine-reference/forces-system.md`](docs/engine-reference/forces-system.md): the full specification, the contract the engine implements.
- [`docs/engine-reference/forces-formulas.md`](docs/engine-reference/forces-formulas.md): per-force formulas and the attribute handbook.
- [`docs/engine-reference/forces-tests.md`](docs/engine-reference/forces-tests.md): the testing and physics-conformance guide.
- [`docs/planning-archive/field-concept.md`](docs/planning-archive/field-concept.md): the design vision and the full conceptual arc.

## Develop

field-ui is a pnpm monorepo. Development needs Node 22 or newer, because the test runner executes TypeScript directly.

```bash
pnpm install
pnpm -r typecheck   # tsc across packages
pnpm -r test        # node:test, no test framework
pnpm -r build       # core and elements (tsc), and the site (Astro)
pnpm dev            # run the site locally
```

The build is `tsc`. There is no bundler; the library ships unbundled ESM. The site uses Astro as a build-time tool and ships no runtime JavaScript by default.

## Design principles

- **The field reacts to real elements.** The single background field responds to actual `data-body` elements, not a decorative particle pool layered on top.
- **Nothing is created from nothing.** The default field conserves particle count. Sources and sinks break conservation only when they are explicitly budgeted.
- **Designed and natural, side by side.** Canonical forces stay bounded and legible for interface work. Natural primitives carry real laws for cosmology and material systems. A composite picks the register it needs.
- **Native-platform-first, dependency-light.** The core recreates what it needs on the platform and ships with zero runtime dependencies; the only development dependency is TypeScript. Framework integrations are adapters, not requirements. Any new dependency has to justify itself as a real exception.
- **Core stays renderer-agnostic.** `@field-ui/core` computes field behavior against plain data and touches no DOM globals (guarded by a boundary test); `@field-ui/platform` owns DOM participation. Canvas is one render surface, not the whole system.
- **Framework-agnostic.** The custom element makes "every element is a body" a portable primitive that behaves the same in React, Svelte, Astro, Vue, or plain HTML.

## Contributing

Issues and pull requests are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow and conventions, and report anything sensitive through [`SECURITY.md`](SECURITY.md).

## Origins

field-ui began as the homepage of [zachshallbetter.com](https://zachshallbetter.com) and outgrew it. This repository is the engine, its specification, and the prototype it was refactored from.

## License

[MIT](LICENSE).
