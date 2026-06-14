# Fundamental

**The renderer-agnostic field engine.** `@fundamental-engine/core` computes the field: forces, particles, metrics,
recipes, diagnostics, and conformance, against plain data, with **zero runtime dependencies** and
**zero DOM**. Your page's elements become physical bodies in one shared field; they exert force, and
the field's local density bends them back. The visible canvas is one render surface, not the system.

This is the core. Most apps consume it through a thin adapter that wires the browser for you:
[`@fundamental-engine/elements`](../elements) (web component), [`@fundamental-engine/react`](../react), or
[`@fundamental-engine/vanilla`](../vanilla). Reach for the core directly when you own the render loop or target a
renderer other than the DOM canvas.

→ Live manual, Lab, and design system at **[fundamental-engine.com](https://fundamental-engine.com)**.

## Install

```sh
npm i @fundamental-engine/core
```

The browser host lives in [`@fundamental-engine/platform`](../platform); most apps reach for a thin adapter
([`@fundamental-engine/elements`](../elements), [`@fundamental-engine/react`](../react), [`@fundamental-engine/vanilla`](../vanilla))
instead of wiring the host themselves. The public surface is frozen for `0.x` (see
[API stability](../../docs/canonical/api-stability.md)).

## What's inside

- **36 forces** in three families: **9 canonical** verbs (`attract`, `repel`, `swirl`, `stream`,
  `viscosity`, `jet`, `tether`, `wall`, `sink`), **8 natural** primitives (`gravity`, `charge`,
  `magnetism`, `thermal`, `collide`, `diffuse`, `propagate`, `memory`), and **19 designed-extended**
  forces (`lens`, `gate`, `buoyancy`, `shear`, `crystallize`, `align`, `wind`, `cohesion`, `pressure`,
  `link`, `morph`, `hunt`, `spawn`, `resonate`, `spotlight`, the `screen` quiet zone, `pigment`,
  field-line transport `fieldflow`, and wormhole relocate `warp`).
- **8 presets** compose those primitives into cosmology with no new engine code (`blackhole`, `star`,
  `galaxy`, `tornado`, …), plus **5 formations** that bias the whole field and **6 condition** gates.
- **16 render modes**: matter/structure (`dots`, `trails`, `links`, `streamlines`, `metaballs`,
  `voronoi`, `field-lines`, `heatmap`) and diagnostics (`force-vectors`, `contours`, `potential`,
  `energy`, `topology`, `inspector`, `causality`, `prediction`).
- **64 recipes** across 4 tiers: a recipe is a portable field program. `compileRecipe()` lives here
  (pure, no DOM); `applyRecipe()` and `bindData()` are in [`@fundamental-engine/platform`](../platform).
- **A conformance framework** that fires known particles into each force and checks the measured
  trajectory against the math. The same catalog drives the tests and the visual Lab.

## Quick start

`createField` is renderer-agnostic, so it **requires a host** (a `FieldHost`: viewport, scroll, raf,
and a canvas). In the browser, the host comes from [`@fundamental-engine/platform`](../platform):

```ts
import { createField } from '@fundamental-engine/core';
import { browserHost } from '@fundamental-engine/platform';

const canvas = document.querySelector('canvas')!;
const field = createField(canvas, { host: browserHost(), accent: '#4da3ff' });

// Any [data-body] element on the page becomes a force the field reacts to:
//   <a data-body="attract" data-strength="0.9" data-range="320" data-feedback>pull me</a>
field.scan(); // re-scan [data-body] after a DOM change
```

If you do not want to wire the host yourself, [`@fundamental-engine/vanilla`](../vanilla) re-exports a
host-bundled `createField` (and a `FieldField` class), and [`@fundamental-engine/elements`](../elements) /
[`@fundamental-engine/react`](../react) wrap it as a custom element / component. `createField` called without a
host throws a clear error pointing you to those doors.

## The model

- **Bodies** are declared in markup with `data-body="<force> <force>…"` (forces compose). Common
  attributes: `data-strength`, `data-range`, `data-color`, `data-when` (a condition gate), and
  `data-feedback` (two-way density write-back).
- **The field** is one conserved pool of particles. It re-reads every body's rectangle each frame, so
  any layout change *is* a change to the force geometry.
- **Feedback** samples the density gathered on a body and eases it into the element's `--field-density`
  custom property (with `--d` and `--forces-density` as legacy aliases). Drive weight, glow, and scale
  from it.

## The handle

`createField` returns a `FieldHandle`:

```ts
field.scan();                   // re-scan [data-body] after a DOM change
field.setAccent('#a78bfa');     // recolor the travelling accent
field.setPalette('heatmap');    // swap the accent color template
field.setFormation('wells');    // switch the global formation
field.setAttention(true);       // conserved attention — one finite strength budget
field.setCausality(true);       // cross-boundary causality — density spills to neighbours
field.setRender('streamlines'); // draw the force field itself (a diagnostic mode)
field.flowTo(x, y);             // place a movable flow focus the field bends toward
field.burst(x, y, '#fff');      // a one-shot shove + heat near a point
field.destroy();                // stop the loop, release listeners
```

Reduced motion is honoured (`prefers-reduced-motion` freezes the sim), and the loop pauses when the tab
is backgrounded.

## Recipes

A recipe names an intent and composes existing tokens into behavior. It never adds engine behavior, and
its lanes stay separate: concepts describe, tokens execute, metrics measure, diagnostics explain,
conditions activate. `compileRecipe()` turns a `FieldRecipe` into a compiled plan with no DOM:

```ts
import { compileRecipe, recipeById } from '@fundamental-engine/core';

const plan = compileRecipe(recipeById('priority-well')!);
// → bodies, relationships, feedback, diagnostics, metrics, and a reduced-motion output.
```

`applyRecipe()` (run a recipe on a live DOM platform) and `bindData()` (records → bodies) are in
[`@fundamental-engine/platform`](../platform). Browse all 64 at [`/docs/gallery`](https://fundamental-engine.com/docs/gallery).

## Renderer-agnostic

The engine touches no DOM globals (a boundary test keeps the allowlist empty). Everything the browser
provides arrives through an injected `FieldHost`, so the same engine runs on a DOM canvas, an offscreen
canvas, a headless harness, or any renderer you implement. `browserHost()` (in
[`@fundamental-engine/platform`](../platform)) is the canonical DOM implementation of that contract.

## Related

[`@fundamental-engine/platform`](../platform) · [`@fundamental-engine/elements`](../elements) ·
[`@fundamental-engine/react`](../react) · [`@fundamental-engine/vanilla`](../vanilla) · the
[documentation map](../../docs/README.md).

## License

MIT © Zach Shallbetter
