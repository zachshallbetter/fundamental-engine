# forces-ui

**A reciprocal DOM-physics field.** Every element on the page is a body in one particle field. Bodies bend the field; the field's local density bends the elements back.

[![Live demo: forces-ui.com](https://img.shields.io/badge/demo-forces--ui.com-4da3ff)](https://forces-ui.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![Runtime dependencies: 0](https://img.shields.io/badge/runtime%20deps-0-2dd4bf)
![TypeScript: strict](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Tests: 300+ passing](https://img.shields.io/badge/tests-300%2B%20passing-2dd4bf)

forces-ui renders a single particle field on a canvas behind your content. Mark any element as a body with one attribute and it starts to pull, push, swirl, or hold the matter around it. Where the field gathers, it writes that density back into the element as weight, glow, and motion. The interface lives inside one medium instead of sitting on top of an effect.

It is framework-agnostic (a custom element, a React component, or a plain function), written in TypeScript, and ships with zero runtime dependencies.

> **See it live.** The whole system runs over the engine at **[forces-ui.com](https://forces-ui.com)**, with a physics [Lab](https://forces-ui.com/lab) where you fire particles into a force and watch the math hold.

## The idea

Most particle backgrounds are one-way: the canvas reacts to the cursor. forces-ui is two-way, and it is bound to your layout.

1. **Elements to field.** A registry reads each body's `getBoundingClientRect()` every frame and maps it onto the canvas. The body exerts force on the particles near it.
2. **Field to elements.** The field samples particle density around each body and writes it to a CSS variable (`--d`). Your CSS reads `--d` to drive weight, size, colour, or position.

The geometry is re-read every frame, so the invisible forces stay locked to the visible boxes through scroll, resize, and reflow. Animating the DOM animates the simulation for free.

## Quick start

### Web component (any stack, or plain HTML)

```html
<script type="module">
  import '@forces-ui/elements';
</script>

<forces-field></forces-field>

<h1 data-body="attract" data-strength="1.2" data-feedback>Mass</h1>
<button data-body="repel" data-range="240">Keep clear</button>
```

Drop `<forces-field>` once. It scans the document for `[data-body]` and `[data-preset]` elements and turns each into a body. The same markup works in Astro, Svelte, Vue, or static HTML with no change.

### React

```tsx
import { ForcesField } from '@forces-ui/react';

export default function Page() {
  return (
    <>
      <ForcesField density={1} />
      <h1 data-body="attract" data-strength="1.2" data-feedback>Mass</h1>
    </>
  );
}
```

Reach for `useForcesField(options)` when you want the field handle instead of the component.

### Vanilla and imperative

```ts
import { mountField } from '@forces-ui/elements';

const field = mountField({ render: 'dots' });
field.setFormation('wells');
field.burst(window.innerWidth / 2, 200);
// field.scan(); field.destroy();
```

To run the engine on a `<canvas>` you control yourself, call `createField(canvas, options)` from `forces-ui`.

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

**33 forces**, in three families.

- **Canonical (9):** `attract`, `repel`, `swirl`, `stream`, `viscosity`, `jet`, `tether`, `wall`, `sink`. Designed interface verbs with bounded, legible falloff.
- **Natural (8):** `gravity`, `charge`, `magnetism`, `thermal`, `collide`, `diffuse`, `propagate`, `memory`. Real field laws: softened inverse-square, Lorentz, Langevin, diffusion, travelling waves.
- **Designed-extended (16):** `lens`, `gate`, `buoyancy`, `shear`, `crystallize`, `align`, `wind`, `cohesion`, `pressure`, `link`, `morph`, `hunt`, `spawn`, the `resonate` and `spotlight` modifiers, and `pigment` colour transport.

**8 presets** compose those primitives into cosmology with no new engine code: `blackhole`, `whitehole`, `star`, `quasar`, `galaxy`, `nebula`, `tornado`, `fountain`.

**6 render modes:** `dots`, `trails`, `links`, `streamlines`, `metaballs`, `voronoi`.

**5 formations** bias the whole field at once: `ambient`, `wells`, `lanes`, `scatter`, `accretion`.

**Reciprocal write-back.** Density returns to the elements through `--d` (local density), `--load` (a sink's accretion fill), and `--lit` (cross-boundary spillover). Richer behaviors build on that loop:

- **Conserved attention.** One finite force budget across the page. Engaging a word pulls force off the others.
- **Cross-boundary causality.** A saturated body spills density to its neighbours, weighted by nearness.
- **Material typography.** One density value drives weight, optical size, tracking, glow, and colour at once.
- **Self-laying-out layout.** Nodes find equilibrium positions from anchor, mutual repulsion, and density pressure, then re-settle on resize.

**Verified, not eyeballed.** A conformance framework fires known particles into each force and checks the measured trajectory against the math. The same catalog drives the test suite and the visual Lab. The repository carries 300+ deterministic tests and a global safety sweep that holds every force finite, bounded in velocity and heat, and conserved in count.

## Packages

| Package | What it is |
|---|---|
| [`forces-ui`](packages/core) | the engine: catalog, contracts, `FieldStore`, integrator, the force set, conformance |
| [`@forces-ui/elements`](packages/elements) | the `<forces-field>` and `<forces-cell>` custom elements, plus `mountField()` |
| [`@forces-ui/react`](packages/react) | the `<ForcesField>` component and the `useForcesField()` hook |

## Availability

The packages are pre-release and not yet published to npm. Each release is cut as a git tag (see [`RELEASING.md`](RELEASING.md)). To use forces-ui today, consume it from this repository as a workspace dependency, a git install, or a local link. The public API shown above is stable; the `npm install` path arrives with the first published release.

## Documentation

- **Field Manual** at [forces-ui.com](https://forces-ui.com): every concept running live over the engine.
- **Lab** at [forces-ui.com/lab](https://forces-ui.com/lab): fire particles into a force, watch the track, share the result through a URL.
- [`docs/forces-system.md`](docs/forces-system.md): the full specification, the contract the engine implements.
- [`docs/forces-formulas.md`](docs/forces-formulas.md): per-force formulas and the attribute handbook.
- [`docs/forces-tests.md`](docs/forces-tests.md): the testing and physics-conformance guide.
- [`docs/forces-concept.md`](docs/forces-concept.md): the design vision and the layered-physics model.

## Develop

forces-ui is a pnpm monorepo. Development needs Node 22 or newer, because the test runner executes TypeScript directly.

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
- **Zero runtime dependencies, by policy.** The engine recreates what it needs on the platform. The only development dependency is TypeScript. Any new dependency has to justify itself as a real exception.
- **Framework-agnostic.** The custom element makes "every element is a body" a portable primitive that behaves the same in React, Svelte, Astro, Vue, or plain HTML.

## Contributing

Issues and pull requests are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow and conventions, and report anything sensitive through [`SECURITY.md`](SECURITY.md).

## Origins

forces-ui began as the homepage of [zachshallbetter.com](https://zachshallbetter.com) and outgrew it. This repository is the engine, its specification, and the prototype it was refactored from.

## License

[MIT](LICENSE).
