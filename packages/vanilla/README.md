# @field-ui/vanilla

The framework-free TypeScript wrapper for [field-ui](../core) — a reciprocal DOM-physics
field as a typed `FieldField` class and the imperative `mountField()`. Elements you mark
with `data-body` become forces; the single background field reacts to them, and its density
reacts back.

→ Live at **[field-ui.com](https://field-ui.com)**.

> **Pre-release: not yet on npm.** Consume from the repository for now (see
> [`RELEASING.md`](../../RELEASING.md)).

This is the same engine the `<forces-field>` custom element and the React `<FieldField>`
wrap, with **no custom-element registration** and **no framework dependency** — importing
this package has no side effects. Reach for it from plain TypeScript, or any stack where you
want to drive the field by hand. The only dependency is the zero-dependency core.

## The class

```ts
import { FieldField } from '@field-ui/vanilla';

const field = new FieldField({ accent: '#4da3ff', render: 'dots' });
field.setFormation('wells');
field.burst(window.innerWidth / 2, 200);
// field.scan();   // re-pick-up bodies after a DOM change
// field.destroy(); // stop the loop and remove the managed canvas
```

`new FieldField()` builds a fixed, full-viewport canvas behind your page and starts the
engine on it. It takes every `FieldOptions` value (`accent`, `density`, `waves`, `render`,
`palette`, `mass`, `attention`, `causality`), implements the full `FieldHandle` surface, and
exposes the `canvas` it runs on.

> **Client only.** The field is a browser effect: `new FieldField()` (and `mountField()`)
> touch `document` right away and throw a clear error during server-side rendering. In
> Next.js, Astro, SvelteKit, and similar, construct it on the client — inside `useEffect`,
> `onMount`, or a "client only" boundary.

Drive a `<canvas>` you own instead by passing it — then the field never creates or removes a
canvas, and `destroy()` only stops the engine:

```ts
const field = new FieldField({ canvas: myCanvas, density: 1.2 });
```

## The function

If you prefer a plain factory over a class, `mountField()` returns the bare `FieldHandle`:

```ts
import { mountField } from '@field-ui/vanilla';

const field = mountField({ render: 'trails' });
// field.destroy() also removes the canvas it created.
```

To run the engine on a `<canvas>` with no managed wrapper at all, the core `createField`
is re-exported too:

```ts
import { createField } from '@field-ui/vanilla';

const field = createField(document.querySelector('canvas')!, { accent: '#2dd4bf' });
```

The field reacts to `[data-body]` elements anywhere on the page (the field-reacts law) — after
rendering new bodies, call `field.scan()` so the engine picks them up.

## Catalog

For building UI around the field (a force picker, a legend), the catalog data is re-exported
so you need no second install: `FORCES`, `FORMATIONS`, `CONDITIONS`, `PALETTE`.
