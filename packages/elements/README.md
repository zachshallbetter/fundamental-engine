# @fundamental-engine/elements

**The web-component keystone for [`@fundamental-engine/core`](../core).** "Every element is a body" is a
web-components-shaped idea: drop one tag, mark up your bodies, and the field runs in any framework or
plain HTML, unchanged. Semantic HTML stays the source of meaning; the field is a behavior +
visualization layer on top.

→ Live manual, Lab, and gallery at **[fundamental-engine.com](https://fundamental-engine.com)**.

## Install

```sh
npm i @fundamental-engine/elements
```

## Use

Import the package once to register the elements, then mark up the field and your bodies:

```html
<script type="module">
  import '@fundamental-engine/elements';
</script>

<field-root accent="#4da3ff"></field-root>

<a data-body="attract" data-strength="0.9" data-range="320" data-feedback>pull me</a>
```

`<field-root>` mounts a fixed, full-viewport canvas behind your page and runs the engine on it. The
field reacts to every `[data-body]` element on the page (the *field-reacts* law). It is decorative, so
it is marked `aria-hidden` automatically. The deprecated `<forces-field>` tag still works as an alias.

## Marking bodies — the `data-body` vocabulary

Any element becomes a *body* by carrying `data-body`. The common attributes:

| Attribute | Meaning |
|---|---|
| `data-body="attract"` | the force token (`attract`, `gravity`, `charge`, `sink`, …) |
| `data-strength` | how hard it bends the field |
| `data-range` | radius of influence, in px |
| `data-feedback` | opt in to receiving `--field-*` variables back on the element |
| `data-absorb` / `data-max` | for `sink` bodies: accretion load and capacity |

Bodies that opt in with `data-feedback` get `--field-*` CSS custom properties written back onto them
each frame — style with them (`var(--field-density)`, etc.) to make content react to the field.

## `<field-root>` attributes

`accent` · `density` · `waves` · `render` (`dots` / `trails` / `links` / `streamlines` / `metaballs` /
`voronoi`) · `palette` (`ours` / `heatmap` / `infrared` / `spectrum`) · `mass` · `attention` ·
`causality`. The engine ships 16 render modes in all (including `field-lines`, `heatmap`, and the
diagnostics); the others are reached through `setRender()` / the core, not this attribute.

## Methods — the `FieldHandle`, proxied onto the element

Every `FieldHandle` method is available directly on the element:

```js
const field = document.querySelector('field-root');
field.scan();                    // after adding [data-body] elements
field.setFormation('wells');
field.setAttention(true);
field.setRender('streamlines');
field.setOverlay('field-lines'); // a second canvas in front of content
field.flowTo(x, y);              // a movable flow focus the field bends toward
field.burst(x, y);               // a one-off impulse
field.destroy();                 // stop the loop, remove the canvas
```

| Method | Use |
|---|---|
| `scan()` / `rescan()` | re-read `[data-body]` elements after the DOM changes |
| `setAccent(hex)` · `setPalette(p)` | recolor live |
| `setFormation(name)` | arrange particles into a named formation |
| `setRender(mode)` · `setOverlay(mode)` | underlay (behind content) / overlay (in front) |
| `setAttention(on)` · `setCausality(on)` · `setHeatmap(on)` | toggle diagnostics |
| `burst(x, y, hex?)` · `flowTo(x, y)` · `clearFlow()` | impulses and a movable focus |
| `threads(list)` | draw relationship threads between bodies |

### Imperative mount

For a canvas you do not want declared in markup, `mountField(opts)` creates one, starts the engine, and
returns the handle (its `destroy()` also removes the canvas).

```js
import { mountField } from '@fundamental-engine/elements';
const field = mountField({ render: 'trails', accent: '#2dd4bf' });
```

### Local cells

`<field-cell>` is a self-contained, container-sized field surface for embedded demos (one force or
formation inside a frame), separate from the page-wide `<field-root>`. It runs a deliberately
simplified in-frame model, not the canonical engine math. The deprecated `<forces-cell>` is its alias.

## Framework use

The custom elements work unchanged in React, Vue, Svelte, Solid, Angular, or plain HTML — register once
(`import '@fundamental-engine/elements'`) and write `<field-root>` in your markup. In React, prefer
[`@fundamental-engine/react`](../react) for typed props and a `FieldHandle` ref; reach for the element directly
when you want one field across a whole page regardless of framework.

## Recipes & data binding

To apply a named recipe over your markup (or bind data to it) rather than wire bodies by hand, use
`applyRecipe()` / `bindData()` from [`@fundamental-engine/platform`](../platform); browse all 64 recipes at
[`/docs/gallery`](https://fundamental-engine.com/docs/gallery). The starter app in
[`apps/starter`](../../apps/starter) shows the declarative element, `applyRecipe`, and `bindData`
together.

## Related

[`@fundamental-engine/core`](../core) · [`@fundamental-engine/platform`](../platform) · [`@fundamental-engine/react`](../react) ·
[`@fundamental-engine/vanilla`](../vanilla) · the [documentation map](../../docs/README.md).

## License

MIT © Zach Shallbetter
