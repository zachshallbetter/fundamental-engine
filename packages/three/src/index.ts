/**
 * `@field-ui/three` — the Three.js door to the reciprocal field.
 *
 * The same engine the `<field-root>` custom element and `@field-ui/{vanilla,react}` wrap, bound to a
 * WebGL scene instead of the DOM. Two paths, composable:
 *
 * 1. **Particle bridge** (`createFieldLayer`) — run the engine headless and render its swarm as a
 *    `THREE.Points` layer you add to your scene. The fast path to the field in 3D.
 * 2. **RenderBackend** (`threeBackend`) — implement the engine's structural drawing seam so the
 *    diagnostic overlays (streamlines, field-lines, grid, contours) draw as scene geometry. Inject
 *    via `createThreeField({ overlayBackend })`.
 *
 * `three` is a peer dependency — you bring your own version. The `FieldProjection` seam keeps the
 * coordinate model swappable: `PlaneProjection` ships now; a volumetric mode slots in later.
 *
 * ```ts
 * import { createFieldLayer, PlaneProjection } from '@field-ui/three';
 * const layer = createFieldLayer({ projection: new PlaneProjection({ relief: 2 }), accent: '#4da3ff' });
 * scene.add(layer.object);
 * // render loop: layer.tick(); renderer.render(scene, camera);
 * ```
 */

export { FieldLayer, createFieldLayer, createThreeField } from './layer.ts';
export type { FieldLayerOptions, ThreeFieldOptions } from './layer.ts';
export { threeHost } from './host.ts';
export type { ThreeHostOptions } from './host.ts';
export { threeBackend } from './backend.ts';
export type { ThreeBackend, ThreeBackendOptions } from './backend.ts';
export { ParticlePool } from './particles.ts';
export type { ParticlePoolOptions, ParticleStyle } from './particles.ts';
export { PlaneProjection, VolumeProjection } from './project.ts';
export type { FieldProjection, PlaneProjectionOptions, VolumeProjectionOptions } from './project.ts';
// Meshes as bodies — register an Object3D as a field body carrying a data record.
export { FieldBodyRegistry } from './bodies.ts';
export type { FieldBody, FieldBodySpec } from './bodies.ts';
// Native 3D field visuals — vector grids + streamline tubes from FieldHandle.sample().
export { vectorField, streamlineTubes, traceStreamline } from './samplers.ts';
export type { FieldSampler, FieldVisual, VectorFieldOptions, StreamlineTubesOptions } from './samplers.ts';

// Re-export the field samplers from core so a Three.js consumer building its own field visuals
// (3D streamline tubes, vector grids, density) has them without a second import.
export { forceAt, netField } from '@field-ui/core';
export type { FieldHandle, FieldOptions, Particle, Body } from '@field-ui/core';
