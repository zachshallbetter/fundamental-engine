# forces-ui

**A reciprocal DOM-physics field.** Your page's elements are physical bodies in a
single particle field: they carry weight and exert force, and the field's local
density bends them back — glowing, growing, gaining weight where matter gathers.
Not a background effect; a medium your interface lives inside.

- **Zero runtime dependencies.** Pure TypeScript, one `<canvas>`, one `rAF` loop.
- **33 forces** — nine canonical verbs, eight natural primitives (gravity, charge,
  magnetism, thermal, collide, diffuse, propagate, memory), and sixteen designed
  extended forces (including SPH `pressure`, Verlet `link`, predator/prey `hunt`,
  shape-assembly `morph`, and the budgeted `spawn` source) — plus presets, conditions,
  formations, and six render modes (dots, trails, links, metaballs, voronoi, streamlines).
- **Reciprocal.** Two-way density feedback writes `--d` back onto your elements (driving
  material typography and self-laying-out layout); opt-in conserved attention and
  cross-boundary causality couple them.

→ Live manual, lab, and design system at **[forces-ui.com](https://forces-ui.com)**.

## Install

```sh
npm add forces-ui
```

Most apps want the [`@forces-ui/elements`](https://www.npmjs.com/package/@forces-ui/elements)
web component or the [`@forces-ui/react`](https://www.npmjs.com/package/@forces-ui/react)
adapter, which wrap this engine. Use the core directly when you own the canvas.

## Quick start

```ts
import { createField } from 'forces-ui';

const canvas = document.querySelector('canvas')!;
const field = createField(canvas, { accent: '#4da3ff' });

// any [data-body] element on the page becomes a force the field reacts to:
//   <a data-body="attract" data-strength="0.9" data-range="320" data-feedback>pull me</a>
// after adding bodies to the DOM, rescan:
field.scan();
```

## The model

- **Bodies** are declared in markup with `data-body="<force> <force>…"` (forces
  compose). Common attributes: `data-strength`, `data-range`, `data-color`,
  `data-when` (a condition gate), `data-feedback` (two-way density write-back).
- **The field** is one conserved pool of particles. It re-reads every body's
  rectangle each frame, so any layout change *is* a change to the force geometry.
- **Feedback** (`data-feedback`) samples the density gathered on a body and eases it
  into the element's `--d` custom property — drive weight, glow, and scale from it.

## The handle

`createField` returns a `FieldHandle`:

```ts
field.scan();                  // re-scan [data-body] after a DOM change
field.setAccent('#a78bfa');    // recolour the travelling accent
field.setPalette('heatmap');   // swap the accent colour template
field.setFormation('wells');   // switch the global formation
field.setAttention(true);      // conserved attention — one finite strength budget
field.setCausality(true);      // cross-boundary causality — density spills to neighbours
field.setRender('streamlines'); // draw the force field itself (diagnostic)
field.burst(x, y, '#fff');     // a one-shot shove + heat near a point
field.threads(list);           // glowing connectors between an engaged set
field.destroy();               // stop the loop, release listeners
```

Reduced motion is honoured (`prefers-reduced-motion` freezes the sim), and the loop
pauses when the tab is backgrounded.

## License

MIT © Zach Shallbetter
