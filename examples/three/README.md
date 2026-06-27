# Fundamental × Three.js — particle field

A minimal, standalone app that renders a [Fundamental](https://fundamental-engine.com) field
as a `THREE.Points` swarm using [`@fundamental-engine/three`](https://www.npmjs.com/package/@fundamental-engine/three).

It depends on the **published** npm packages (`@fundamental-engine/three`, `three`) — not the
workspace — so it proves the real release works end to end. Copy this folder anywhere and it runs.

## What it shows

- `createFieldLayer(...)` runs the reciprocal field engine **headless** (`render: 'none'`) and
  exposes its particle pool as a `THREE.Points` object.
- You add `layer.object` to your own scene and call `layer.tick()` in the render loop — the engine
  self-steps; `tick()` pulls the latest swarm onto the geometry.
- `layer.addBody(...)` registers an attractor that bends the field; the swarm reciprocates.
- The HUD shows the live `layer.particleCount()`.

## Install & run

```sh
npm install
npm run dev      # http://localhost:5173
```

## Build

```sh
npm run build    # → dist/
npm run preview  # serve the build
```

## The core of it

```js
import * as THREE from 'three';
import { createFieldLayer, PlaneProjection } from '@fundamental-engine/three';

const layer = createFieldLayer({
  projection: new PlaneProjection({ relief: 2 }),
  renderer,                       // reads the device-pixel ratio
  style: { accent: '#4da3ff' },   // swarm colour
});
scene.add(layer.object);

renderer.setAnimationLoop(() => {
  layer.tick();                   // pull the latest swarm
  renderer.render(scene, camera);
});
```
