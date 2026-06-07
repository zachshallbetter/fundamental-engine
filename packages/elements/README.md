# @forces-ui/elements

The **web-component keystone** for [forces-ui](../core) — a reciprocal DOM-physics field
that drops into any framework (or plain HTML) unchanged. "Every element is a body" is a
web-components-shaped idea.

→ Live at **[field-ui.com](https://field-ui.com)**.

## Install

> **Pre-release: not yet on npm.** Consume from the repository for now (see
> [`RELEASING.md`](../../RELEASING.md)). `npm add @forces-ui/elements` lands with the
> first published release.

## Use

Register the element, then mark up the field and your bodies:

```html
<script type="module">
  import '@forces-ui/elements';
</script>

<forces-field accent="#4da3ff"></forces-field>

<a data-body="attract" data-strength="0.9" data-range="320" data-feedback>pull me</a>
```

`<forces-field>` mounts a fixed, full-viewport canvas behind your page and runs the
engine on it. The field reacts to every `[data-body]` element on the page (the
field-reacts law). It's decorative, so it's marked `aria-hidden` automatically.

### Attributes

`accent` · `density` · `waves` · `render` (`dots` / `trails` / `links` /
`metaballs` / `voronoi` / `streamlines`) · `palette` (`ours` / `heatmap` / `infrared` / `spectrum`) ·
`attention` · `causality`.

### Methods (the `FieldHandle`, proxied onto the element)

```js
const field = document.querySelector('forces-field');
field.scan();                    // after adding [data-body] elements
field.setFormation('wells');
field.setAttention(true);
field.setRender('streamlines');
field.burst(x, y);
```

### Imperative mount

For a canvas you don't want declared in markup, `mountField(opts)` creates one,
starts the engine, and returns the handle (its `destroy()` also removes the canvas).

### Local cells

This package also ships `<forces-cell>` — a self-contained, container-sized field surface
for embedded demos (one force or formation inside a frame), separate from the page-wide
`<forces-field>`. It runs a deliberately simplified in-frame model, not the canonical
engine math.

## License

MIT © Zach Shallbetter
