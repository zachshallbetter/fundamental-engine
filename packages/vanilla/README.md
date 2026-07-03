# @fundamental-engine/vanilla

**The framework-free door to [`@fundamental-engine/core`](../core)** — a reciprocal DOM-physics field as a typed
`FieldField` class and the imperative `mountField()`. Elements you mark with `data-body` become forces;
the single background field reacts to them, and its density reacts back. No custom-element
registration, no framework dependency, no import side effects.

→ Live manual, Lab, and gallery at **[fundamental-engine.com](https://fundamental-engine.com)**.

## Install

```sh
npm i @fundamental-engine/vanilla
```

The only dependency is the zero-dependency core plus [`@fundamental-engine/dom`](../dom) (which supplies
the browser host). Reach for this from plain TypeScript, or any stack where you want to drive the field
by hand.
## Which API should I use?

- `new FieldField(opts)` — best default for app code. Class ergonomics + full `FieldHandle`, with managed canvas lifecycle.
- `mountField(opts)` — simplest imperative mount when you just want a handle quickly and don’t need a class instance.
- `createField(canvas, opts)` — lowest-level control. Use when you own the canvas, need contained mode (`bounds`), or provide a custom/headless host.

`createField` host resolution order is: `opts.host` → `opts.bounds` (contained host) → browser host.

## The class

```ts
import { FieldField } from '@fundamental-engine/vanilla';

const field = new FieldField({ accent: '#4da3ff', render: 'dots' });
field.setFormation('wells');
field.burst(window.innerWidth / 2, 200);
// field.scan();    // re-pick-up bodies after a DOM change
// field.destroy(); // stop the loop and remove the managed canvas
```

`new FieldField()` builds a fixed, full-viewport canvas behind your page and starts the engine on it.
It takes every `FieldOptions` value, implements the full `FieldHandle` surface, and exposes the
`canvas` it runs on — the same engine the `<field-root>` custom element and the React `<FieldField>`
wrap.

### Options (`FieldOptions`)

| Option | Type | Effect |
|---|---|---|
| `accent` | `string` | base hue (any CSS color) |
| `density` | `number` | particle density multiplier |
| `render` | `'dots' \| 'trails' \| 'links' \| 'metaballs' \| 'voronoi' \| 'streamlines'` | underlay render method |
| `palette` | `string \| string[]` | named palette (`ours` / `heatmap` / `infrared` / `spectrum`) or colors |
| `waves` | `boolean` | wave propagation |
| `mass` | `boolean` | first-class mass in the integrator |
| `attention` · `causality` · `heatmap` | `boolean` | diagnostics |
| `canvas` | `HTMLCanvasElement` | drive a canvas you own (the field won't create/remove one) |

### Methods (`FieldHandle`)

| Method | Use |
|---|---|
| `scan()` / `rescan()` | re-read `[data-body]` elements after the DOM changes |
| `setAccent(hex)` · `setPalette(p)` | recolor live |
| `setFormation(name)` | arrange particles into a named formation |
| `setRender(mode)` · `setOverlay(mode)` | underlay (behind content) / overlay (in front) |
| `setAttention(on)` · `setCausality(on)` · `setHeatmap(on)` | toggle diagnostics |
| `burst(x, y, hex?)` · `flowTo(x, y)` · `clearFlow()` | impulses and a movable focus |
| `threads(list)` | draw relationship threads between bodies |
| `destroy()` | stop the engine (and remove the managed canvas, if it created one) |

> **Client only.** The field is a browser effect: `new FieldField()` (and `mountField()`) touch
> `document` right away and throw a clear error during server-side rendering. In Next.js, Astro,
> SvelteKit, and similar, construct it on the client — inside `useEffect`, `onMount`, or a "client
> only" boundary.

Drive a `<canvas>` you own instead by passing it — then the field never creates or removes a canvas,
and `destroy()` only stops the engine:

```ts
const field = new FieldField({ canvas: myCanvas, density: 1.2 });
```

## The function

If you prefer a plain factory over a class, `mountField()` returns the bare `FieldHandle`:

```ts
import { mountField } from '@fundamental-engine/vanilla';

const field = mountField({ render: 'trails' });
// field.destroy() also removes the canvas it created.
```

To run the engine on a `<canvas>` with no managed wrapper at all, the host-bundled `createField` is
re-exported (this one supplies `browserHost()` for you, unlike the core primitive):

```ts
import { createField } from '@fundamental-engine/vanilla';

const field = createField(document.querySelector('canvas')!, { accent: '#2dd4bf' });
```

## Vendor / CDN (single file, no bundler)

The shipped dist is unbundled ESM with bare cross-package imports (`@fundamental-engine/dom`,
`@fundamental-engine/core`), so a plain `<script type="module">`, a `file://` page, or a vendored
copy can't resolve it without a bundler or an import map. For the **no build step** path the package
also ships two pre-bundled, fully self-contained single-file artifacts — no bare imports, nothing to
resolve:

- `dist/standalone.js` — bundled **ESM** (drop in with `<script type="module">`)
- `dist/standalone.global.js` — **IIFE** that exposes a `Fundamental` global (no module loader at all)

**Self-contained ESM** — copy `standalone.js` next to your HTML and import it directly:

```html
<canvas id="field"></canvas>
<script type="module">
  import { createField } from './standalone.js';
  createField(document.querySelector('#field'), { accent: '#4da3ff', render: 'dots' });
</script>
```

**IIFE global** — for pages that want zero module machinery:

```html
<canvas id="field"></canvas>
<script src="./standalone.global.js"></script>
<script>
  Fundamental.createField(document.querySelector('#field'), { render: 'dots' });
</script>
```

From a CDN it's the same files via the published package — e.g.
`https://esm.sh/@fundamental-engine/vanilla/standalone` (ESM) or
`https://unpkg.com/@fundamental-engine/vanilla/dist/standalone.global.js` (IIFE). Vendoring the file
locally needs no network at all, which is what the offline / CSP-restricted path wants.

The artifacts are produced by `pnpm --filter @fundamental-engine/vanilla build:standalone` (also run
as part of the package `build`) and size-checked in CI.

## Marking bodies — the `data-body` vocabulary

| Attribute | Meaning |
|---|---|
| `data-body="attract"` | the force token (`attract`, `gravity`, `charge`, `sink`, …) |
| `data-strength` | how hard it bends the field |
| `data-range` | radius of influence, in px |
| `data-feedback` | opt in to receiving `--field-*` variables back |
| `data-absorb` / `data-max` | for `sink` bodies: accretion load and capacity |

Call `field.scan()` after adding new `[data-body]` elements so the engine picks them up.

## Catalog

For building UI around the field (a force picker, a legend), the catalog data is re-exported so you
need no second install: `FORCES`, `FORMATIONS`, `CONDITIONS`, `PALETTE`.

```ts
import { FORCES, FORMATIONS } from '@fundamental-engine/vanilla';
```

## Recipes & data binding

To apply a named recipe over your markup or bind data to the field, use `applyRecipe()` / `bindData()`
from [`@fundamental-engine/dom`](../dom); browse all 64 recipes at
[`/docs/gallery`](https://fundamental-engine.com/docs/gallery).

## Related

[`@fundamental-engine/core`](../core) · [`@fundamental-engine/dom`](../dom) · [`@fundamental-engine/elements`](../elements)
· [`@fundamental-engine/react`](../react) · the [documentation map](../../docs/README.md).

## License

MIT © Zach Shallbetter
