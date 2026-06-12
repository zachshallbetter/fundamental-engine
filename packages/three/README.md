# @field-ui/three

**The Three.js door to [`@field-ui/core`](../core)** — run the reciprocal field engine headless and
render its swarm as a `THREE.Points` layer in your own WebGL scene. The same physics the
`<field-root>` element and `@field-ui/{vanilla,react}` wrap, bound to a 3D scene instead of the DOM.

→ Live manual, Lab, and gallery at **[field-ui.com](https://field-ui.com)**.

## Install

```sh
npm i @field-ui/three three
```

`three` is a **peer dependency** — you bring your own version (>= 0.150).

## The particle bridge

The engine runs in signals-only mode (`render: 'none'`) and exposes its particle pool through
`FieldHandle.readParticles()`. `FieldLayer` pulls that each frame and writes it onto a `THREE.Points`
geometry via a `FieldProjection`.

```ts
import * as THREE from 'three';
import { createFieldLayer, PlaneProjection } from '@field-ui/three';

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true });

const layer = createFieldLayer({
  projection: new PlaneProjection({ relief: 2 }), // the field on a plane, z lifted from heat
  renderer,                                       // reads the device-pixel ratio
  accent: '#4da3ff',
});
scene.add(layer.object);

renderer.setAnimationLoop(() => {
  layer.tick();                 // the engine self-steps; tick() pulls the latest swarm
  renderer.render(scene, camera);
});
```

`FieldLayer` implements the full `FieldHandle` surface, so `layer.burst()`, `layer.flowTo()`,
`layer.setFormation()`, and `layer.seed()` drive the 3D layer exactly as they drive the DOM field.

## Flat plane or real volume

`FieldProjection` maps the engine's CSS-pixel field space to 3D world space:

- **`PlaneProjection`** — the field on a quad; `z` is lifted stylistically from per-particle `heat`.
  The right choice for a flat field.
- **`VolumeProjection`** — maps the engine's real **depth lane** (`z ∈ [0, depth)`, the opt-in z axis)
  onto a world depth range, for a genuinely volumetric swarm.

Pass `depth` and the layer defaults to a `VolumeProjection` automatically — bodies stay on the page
plane (`z = 0`) while free matter drifts through the volume and is pulled gently back, reading as depth
and parallax around the content:

```ts
const layer = createFieldLayer({ depth: 300, renderer, accent: '#4da3ff' });
```

Both projections implement one interface, so `FieldLayer` and `threeBackend` are unchanged by the choice.

## RenderBackend (diagnostic overlays)

`threeBackend` implements the engine's structural drawing seam (`RenderBackend`), so the diagnostic
overlays — streamlines, field-lines, grid, contours, force-vector arrows — draw as scene geometry.
Inject it via the lower-level `createThreeField`:

```ts
import { createThreeField, threeBackend, PlaneProjection } from '@field-ui/three';

const projection = new PlaneProjection();
const overlay = threeBackend({ projection });
scene.add(overlay.object);

const field = createThreeField({
  viewport: () => ({ ...projection.size(), dpr: renderer.getPixelRatio() }),
  overlayBackend: overlay,
  overlay: 'streamlines',
});
```

The line overlays render fully; numeric label sprites (the `data` reading) are a tracked follow-up.

## Building your own field visuals

The package re-exports the engine's field samplers — `forceAt` and `netField` — so you can drive
your own 3D visuals (streamline tubes, vector grids, density volumes) from the live field without a
second import.

## License

MIT © Zach Shallbetter
