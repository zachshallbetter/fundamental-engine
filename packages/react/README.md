# @fundamental-engine/react

**The React adapter for [`@fundamental-engine/core`](../core)** — a reciprocal DOM-physics field as a React
component. Elements you mark with `data-body` become forces; the single background field reacts to
them, and its density reacts back. You author meaning in JSX (`data-*` in); the field returns
measurement (`--field-*` CSS variables out).

→ Live manual, Lab, and gallery at **[fundamental-engine.com](https://fundamental-engine.com)**.

## Install

```sh
npm i @fundamental-engine/react
```

React (17, 18, or 19) is a **peer dependency** — the core engine itself stays zero-dependency.

## Use

```tsx
import { FieldField } from '@fundamental-engine/react';

export function App() {
  return (
    <>
      <FieldField accent="#4da3ff" />
      <a data-body="attract" data-strength="0.9" data-range="320" data-feedback>
        pull me
      </a>
    </>
  );
}
```

`<FieldField>` mounts a fixed, full-viewport canvas behind your app and runs the engine on it — the
same field the `<field-root>` custom element and vanilla `mountField()` wrap. The field reacts to every
`[data-body]` element on the page (the *field-reacts* law), so the bodies do not need to be children of
`<FieldField>`.

## Props

`<FieldField>` accepts every [`FieldOptions`](../core) value plus React conveniences:

| Prop | Type | What it does |
|---|---|---|
| `accent` | `string` | base hue for the field (any CSS color) |
| `density` | `number` | particle density multiplier |
| `render` | `'dots' \| 'trails' \| 'links' \| 'metaballs' \| 'voronoi' \| 'streamlines'` | underlay render method |
| `palette` | `string \| string[]` | named palette (`ours`, `heatmap`, `infrared`, `spectrum`) or explicit colors |
| `waves` | `boolean` | enable wave propagation |
| `mass` | `boolean` | first-class mass in the integrator |
| `attention` | `boolean` | attention/importance weighting |
| `causality` | `boolean` | causal-trail visualization |
| `heatmap` | `boolean` | density heatmap diagnostic |
| `className` / `style` | — | applied to the managed `<canvas>` |
| `onReady` | `(field: FieldHandle) => void` | called once the engine is live |

```tsx
<FieldField
  render="streamlines"
  palette="infrared"
  onReady={(field) => field.setFormation('wells')}
/>
```

## Driving the field from code

`onReady` hands you the live `FieldHandle` — the full imperative surface:

```tsx
<FieldField onReady={(field) => {
  field.scan();                 // re-pick-up [data-body] elements after a render
  field.setFormation('wells');
  field.setRender('trails');
  field.burst(window.innerWidth / 2, 200);   // a one-off impulse
  field.flowTo(x, y);           // a movable focus the field bends toward
}} />
```

| Method | Use |
|---|---|
| `scan()` / `rescan()` | re-read `[data-body]` elements after the DOM changes |
| `setAccent(hex)` · `setPalette(p)` | recolor live |
| `setFormation(name)` | arrange particles into a named formation (e.g. `wells`) |
| `setRender(mode)` · `setOverlay(mode)` | change the underlay / overlay surface |
| `setAttention(on)` · `setCausality(on)` · `setHeatmap(on)` | toggle diagnostics |
| `burst(x, y, hex?)` · `flowTo(x, y)` · `clearFlow()` | impulses and a movable focus |
| `destroy()` | stop the loop and remove the managed canvas |

### The hook

For full control of the canvas element yourself, use `useFieldField()` instead of the component:

```tsx
const { canvasRef, fieldRef } = useFieldField({ accent: '#4da3ff' });
return <canvas ref={canvasRef} className="my-field" />;
// fieldRef.current is the FieldHandle once mounted
```

## Marking bodies — the `data-body` vocabulary

Any element on the page becomes a *body* by carrying `data-body`. The common attributes:

| Attribute | Meaning |
|---|---|
| `data-body="attract"` | the force token (`attract`, `gravity`, `charge`, `sink`, …) |
| `data-strength` | how hard it bends the field |
| `data-range` | radius of influence, in px |
| `data-feedback` | opt in to receiving `--field-*` variables back |
| `data-absorb` / `data-max` | for `sink` bodies: accretion load and capacity |

After rendering **new** bodies, call `field.scan()` (e.g. from `onReady` or via `fieldRef`) so the
engine picks them up.

## Server-side rendering (Next.js, Remix, Astro islands)

The field is a browser effect — the engine starts inside React effects, so `<FieldField>` is safe to
include in an app that server-renders, but it only comes alive on the client. In the Next.js App
Router, render it from a Client Component (`'use client'`).

## Recipes & data binding

To apply a named recipe or bind data to the field, use `applyRecipe()` / `bindData()` from
[`@fundamental-engine/dom`](../dom) against a ref'd container. Browse all 64 recipes at
[`/docs/gallery`](https://fundamental-engine.com/docs/gallery).

## Related

[`@fundamental-engine/core`](../core) · [`@fundamental-engine/dom`](../dom) · [`@fundamental-engine/elements`](../elements)
· [`@fundamental-engine/vanilla`](../vanilla) · the [documentation map](../../docs/README.md).

## License

MIT © Zach Shallbetter
