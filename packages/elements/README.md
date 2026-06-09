# @field-ui/elements

**The web-component keystone for [field-ui](../core).** "Every element is a body" is a
web-components-shaped idea: drop one tag, mark up your bodies, and the field runs in any framework or
plain HTML, unchanged.

→ Live at **[field-ui.com](https://field-ui.com)**.

## Install

```sh
npm i @field-ui/elements
```

## Use

Import the package once to register the elements, then mark up the field and your bodies:

```html
<script type="module">
  import '@field-ui/elements';
</script>

<field-root accent="#4da3ff"></field-root>

<a data-body="attract" data-strength="0.9" data-range="320" data-feedback>pull me</a>
```

`<field-root>` mounts a fixed, full-viewport canvas behind your page and runs the engine on it. The
field reacts to every `[data-body]` element on the page (the field-reacts law). It is decorative, so it
is marked `aria-hidden` automatically. The deprecated `<forces-field>` tag still works as an alias.

### Attributes

`accent` · `density` · `waves` · `render` (`dots` / `trails` / `links` / `streamlines` / `metaballs` /
`voronoi`) · `palette` (`ours` / `heatmap` / `infrared` / `spectrum`) · `mass` · `attention` ·
`causality`. The engine ships 16 render modes in all (including `field-lines`, `heatmap`, and the
diagnostics); the others are reached through `setRender()` / the core, not this attribute.

### Methods (the `FieldHandle`, proxied onto the element)

```js
const field = document.querySelector('field-root');
field.scan();                    // after adding [data-body] elements
field.setFormation('wells');
field.setAttention(true);
field.setRender('streamlines');
field.flowTo(x, y);              // a movable flow focus the field bends toward
field.burst(x, y);
```

### Imperative mount

For a canvas you do not want declared in markup, `mountField(opts)` creates one, starts the engine, and
returns the handle (its `destroy()` also removes the canvas).

### Local cells

`<field-cell>` is a self-contained, container-sized field surface for embedded demos (one force or
formation inside a frame), separate from the page-wide `<field-root>`. It runs a deliberately
simplified in-frame model, not the canonical engine math. The deprecated `<forces-cell>` is its alias.

## Recipes

To apply a named recipe over your markup (or bind data to it) rather than wire bodies by hand, use
`applyRecipe()` / `bindData()` from [`@field-ui/platform`](../platform); browse all 64 recipes at
[`/docs/gallery`](https://field-ui.com/docs/gallery). The starter app in
[`apps/starter`](../../apps/starter) shows the declarative element, `applyRecipe`, and `bindData`
together.

## Related

[`field-ui`](../core) · [`@field-ui/platform`](../platform) · [`@field-ui/react`](../react) ·
[`@field-ui/vanilla`](../vanilla) · the [documentation map](../../docs/README.md).

## License

MIT © Zach Shallbetter
