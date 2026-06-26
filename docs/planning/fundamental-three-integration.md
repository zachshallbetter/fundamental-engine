# `@fundamental-engine/three` — Three.js integration spec

> Status: **Shipped (main, v0.8.1).** An authoring-surface package `@fundamental-engine/three` with
> **both flat (`PlaneProjection`) and genuinely volumetric (`VolumeProjection`)** coordinate models,
> built on the optional z lane (#362), with the **particle bridge** as the first deliverable. Author:
> Zach Shallbetter. Home on the RC1 board (user project #24).

## Why this is tractable

The engine is already the hard part, and it's done:

1. **`@fundamental-engine/core` imports zero DOM** — all environment access goes through an injected
   `FieldHost` (`packages/core/src/core/host.ts`), enforced by `core/dom-boundary.test.ts`
   (empty allowlist). A Three.js binding is *another host*, not an engine fork.
2. **The field is query-based, not a baked texture.** Sample it anywhere, at any resolution:
   - `forceAt(bodies, forces, env, x, y) → {fx, fy}` (`packages/core/src/core/streamlines.ts:19`)
   - `netField(bodies, forces, x, y) → {x, y}` — structure-only (field-line tracing)
   - `env.grid(name).sample(x,y)` / `.gradient(x,y)` — scalar grids; `heatmap.norm(x,y)` — density
3. **Physics runs headless.** With `render: 'none'` the core never acquires a 2D context and never
   draws; it integrates particles and writes feedback only. Three.js owns all visuals.

Three.js apps run in a browser, so the host can still use real DOM APIs (`requestAnimationFrame`, a
throwaway `<canvas>`). "No DOM" is a *core* constraint, not a constraint on the consuming app.

## Two seams, both used

### A · RenderBackend (the sanctioned drawing seam — `RenderBackend`, #373)

The overlay surface draws exclusively through `RenderBackend`
(`size`/`clear`/`segments`/`polyline`/`rect`/`text`/`measureText`, CSS-pixel coords), injected via
the additive `createField({ overlayBackend })`. So an alternative surface renders the **diagnostic
overlays** (streamlines, field-lines, grid, contours, force arrows) with **zero core change**. This
is "the seam a WebGL/WebGPU surface implements later" — `threeBackend()` is that implementation.

Caveat: only the *overlay* routes through `RenderBackend` today. The **underlay matter modes** (dots'
radial gradients, metaballs, voronoi — the swarm) still draw on the raw 2D context and will grow the
contract additively in a later core slice. Until then, the swarm needs path B.

### B · Particle bridge (the swarm, via `readParticles`)

`FieldHandle.readParticles(out)` copies live particle state into a
caller-owned `Float32Array` (stride 5: `x, y, z, heat, size`), zero-alloc. The `z` is the engine's
**optional depth lane** (z-axis.md, #362) — `0` in a flat field, real depth when the field was created
with `depth > 0`. A renderer fills a `THREE.BufferAttribute` from it each frame. This is the fast path
to the *swarm* in 3D and the complement to path A until the underlay routes through `RenderBackend`.

## Package shape (mirrors `@fundamental-engine/vanilla`)

`packages/three` → `@fundamental-engine/three`, `three` as a **peer dependency**, depends only on
`@fundamental-engine/core` (not platform — its registries are DOM-flavored; the particle bridge doesn't need
them). Authoring-surface tier: `core ← three`, same level as vanilla/react.

```
src/
  index.ts        public surface
  project.ts      FieldProjection seam + PlaneProjection
  host.ts         threeHost(): FieldHost
  particles.ts    ParticlePool — THREE.Points synced from readParticles (pure write path)
  layer.ts        FieldLayer / createFieldLayer (particle bridge) + createThreeField
  backend.ts      threeBackend(): RenderBackend (line overlays)
```

## The coordinate seam: `FieldProjection` (flat plane or real volume)

```ts
interface FieldProjection {
  size(): { width: number; height: number };                          // feeds host.viewport()
  toWorld(x, y, z, heat, size, target?): THREE.Vector3;               // field point → world
  toField(p: THREE.Vector3): { x: number; y: number };               // world → field px
}
```

- **`PlaneProjection` (shipped):** field on the world XY plane (screen-y-down flipped to world-y-up);
  the engine `z` is ignored and `z` is lifted stylistically from `heat * relief`. For flat fields.
- **`VolumeProjection` (shipped):** maps the engine's **real depth lane** (`z ∈ [0, depth)`, the opt-in
  z axis from #362) onto a world depth range — a genuinely volumetric swarm. `createFieldLayer({ depth })`
  defaults to it automatically. Bodies stay on the `z = 0` page plane; matter drifts through the volume.

> The earlier "volumetric needs the engine extended to a z-component" framing was stale — the
> **optional z lane already landed (#362)**. The Three.js side just consumes it: stride-5
> `readParticles` carries `z`, and `VolumeProjection` maps it. The two projections share one interface,
> so `FieldLayer` / `threeBackend` don't change.

## Level A usage (shipped)

```ts
import { createFieldLayer, PlaneProjection } from '@fundamental-engine/three';
const layer = createFieldLayer({ projection: new PlaneProjection({ relief: 2 }), renderer, accent: '#4da3ff' });
scene.add(layer.object);
renderer.setAnimationLoop(() => { layer.tick(); renderer.render(scene, camera); });
```

The engine self-steps on the host's rAF; `layer.tick()` only reads the latest swarm into the
geometry, so it is safe from any render loop at any cadence. `FieldLayer` implements `FieldHandle`,
so `burst`/`flowTo`/`setFormation`/`seed` drive the 3D layer unchanged.

## What ships in `packages/three`

1. **core (additive):** `FieldHandle.readParticles(out)` — **stride 5 `[x, y, z, heat, size]`**,
   carrying the optional z lane (#362) — + impl + tests (incl. a `depth > 0` z-population check);
   mirrored through vanilla/elements; `RenderBackend`/`Stroke` exported from `@fundamental-engine/core`;
   freeze-gate entry; CEM regenerated.
2. `@fundamental-engine/three`: `PlaneProjection` + **`VolumeProjection`** (consumes the real z lane;
   `createFieldLayer({ depth })` selects it), `threeHost`, `ParticlePool`, `FieldLayer` /
   `createFieldLayer`, `threeBackend`, `createThreeField`; renderer-free tests (projection
   round-trips for both, particle write path); README + LICENSE.

## Next (file on board #24)

- **B-overlay polish:** label sprites for `threeBackend.text()` (the `data` reading's numeric chips;
  `measureText` already honored). Currently the line overlays render; chip plates draw unlabeled. (#391)
- **Native 3D visuals (partially shipped):** `vectorField` + `streamlineTubes` already ship in
  `samplers.ts` (built on `forceAt`/`netField`, re-exported); a density volume remains. (#392)
- **Underlay through `RenderBackend`:** when core's matter-mode slice lands (gradient/point
  primitives), the swarm can also route through `threeBackend`, retiring the separate bridge if
  desired.

## Verification gate

`pnpm typecheck · build · test · check:api · check:dist · check:readme · check:recipes`. The
package ships its own `node --test` suite. `check:cem` regenerates the elements manifest (the
`readParticles` accessor).
