/**
 * `FieldLayer` — the field as a Three.js object. It runs the engine headless (`render: 'none'`) on a
 * `threeHost`, owns a `ParticlePool`, and on every `tick()` syncs the live swarm onto a
 * `THREE.Points` you add to your scene via `layer.object`. It implements the full `FieldHandle`
 * surface (delegating to the wrapped engine), so `burst` / `flowTo` / `setFormation` / `seed` drive
 * the 3D layer exactly as they drive the DOM field.
 *
 * ```ts
 * const layer = createFieldLayer({ projection: new PlaneProjection({ relief: 2 }), accent: '#4da3ff' });
 * scene.add(layer.object);
 * // render loop:
 * layer.tick();                 // engine self-steps via rAF; tick() pulls the latest swarm
 * renderer.render(scene, camera);
 * ```
 *
 * The engine self-advances on the host's animation frame; `tick()` only reads the current state into
 * the geometry, so it is safe to call from any render loop at any cadence.
 */

import { createField } from '@field-ui/core';
import type { AtomPayload, FieldHandle, FieldOptions, FlowOptions, HostViewport, ThreadLink } from '@field-ui/core';
import { Group } from 'three';
import type { Object3D, WebGLRenderer } from 'three';
import { threeHost } from './host.ts';
import { PlaneProjection, VolumeProjection, type FieldProjection } from './project.ts';
import { ParticlePool, type ParticleStyle } from './particles.ts';
import { FieldBodyRegistry, type FieldBody, type FieldBodySpec } from './bodies.ts';

/** Three.js is browser-only; this stub satisfies the `createField` signature (never touched under
 *  `render: 'none'`, which acquires no 2D context). */
function stubCanvas(): HTMLCanvasElement {
  return typeof document !== 'undefined' ? document.createElement('canvas') : ({} as HTMLCanvasElement);
}

export interface FieldLayerOptions extends Omit<FieldOptions, 'host' | 'render'> {
  /** the 2D↔3D mapping; defaults to a centered `PlaneProjection`. */
  projection?: FieldProjection;
  /** a renderer to read the device-pixel ratio from (used when `dpr` is not given). */
  renderer?: WebGLRenderer;
  /** explicit device-pixel ratio override. */
  dpr?: number;
  /** `[data-body]` scan root; omit for a field with no DOM bodies. */
  root?: ParentNode;
  /** a canvas to satisfy the engine signature; one is created for you when omitted. */
  canvas?: HTMLCanvasElement;
  /** max particles the GPU buffers hold; defaults to ~1.25× the seeded pool. */
  capacity?: number;
  /** swarm appearance. */
  style?: ParticleStyle;
}

export class FieldLayer implements FieldHandle {
  /** add this to your scene; it holds the swarm `Points` (and future overlay objects). */
  readonly object: Group;
  /** the swarm pool — `pool.points`, `pool.size`, `pool.dispose()`. */
  readonly pool: ParticlePool;
  /** the active 2D↔3D mapping. */
  readonly projection: FieldProjection;
  /** the mesh-bodies registered on this field — `layer.addBody(...)` is the ergonomic entry. */
  readonly bodies: FieldBodyRegistry;
  private readonly field: FieldHandle;

  constructor(opts: FieldLayerOptions = {}) {
    // default the mapping to the field's shape: a real volume when `depth > 0`, else a flat plane.
    this.projection =
      opts.projection ?? (opts.depth && opts.depth > 0 ? new VolumeProjection({ depth: opts.depth }) : new PlaneProjection());
    this.bodies = new FieldBodyRegistry(this.projection);
    const resolveDpr = (): number =>
      opts.dpr ?? opts.renderer?.getPixelRatio() ?? (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1);
    const viewport = (): HostViewport => ({ ...this.projection.size(), dpr: resolveDpr() });
    // the host scans the body registry; mesh-bodies are added via layer.addBody(...)
    const host = threeHost({ viewport, root: this.bodies.root });

    const { projection, renderer, dpr, root, canvas, capacity, style, ...fieldOpts } = opts;
    void projection;
    void renderer;
    void dpr;
    void root;
    // route body feedback (density/load/lit) to the meshes instead of CSS custom properties
    this.field = createField(canvas ?? stubCanvas(), { ...fieldOpts, host, render: 'none', feedbackSink: this.bodies.sink });
    this.bodies.setOnChange(() => this.field.scan());

    const cap = Math.max(capacity ?? 0, Math.ceil(this.field.particleCount() * 1.25) + 64);
    this.pool = new ParticlePool({ capacity: cap, projection: this.projection, style });
    this.object = new Group();
    this.object.add(this.pool.points);
  }

  /**
   * Register a scene object as a field body — it bends the field, the swarm responds, and feedback
   * (density/load/lit) flows back to it. The body carries `spec.data`, so a mesh can be a meaningful
   * agent (a bloom with its genome, a hive accruing honey), not just a force. Returns a handle whose
   * `.data`, `.channels`, and `.remove()` you use; the body tracks the mesh as it moves.
   */
  addBody(object: Object3D, spec: FieldBodySpec): FieldBody {
    return this.bodies.add(object, spec);
  }

  /** sync the swarm geometry from the engine's current particle state; returns the live count. */
  tick(): number {
    return this.pool.sync((out) => this.field.readParticles(out));
  }

  // ── FieldHandle surface (delegated to the wrapped engine) ───────────────────────────────────
  scan(): void {
    this.field.scan();
  }
  rescan(): void {
    this.field.rescan();
  }
  setAccent(hex: string): void {
    this.field.setAccent(hex);
  }
  setPalette(palette: string | readonly string[]): void {
    this.field.setPalette(palette);
  }
  setFormation(name: string): void {
    this.field.setFormation(name);
  }
  setAttention(on: boolean): void {
    this.field.setAttention(on);
  }
  setCausality(on: boolean): void {
    this.field.setCausality(on);
  }
  setHeatmap(on: boolean): void {
    this.field.setHeatmap(on);
  }
  setRender(mode: Parameters<FieldHandle['setRender']>[0]): void {
    this.field.setRender(mode);
  }
  setOverlay(mode: Parameters<FieldHandle['setOverlay']>[0]): void {
    this.field.setOverlay(mode);
  }
  setVisible(on: boolean): void {
    this.field.setVisible(on);
  }
  threads(list: ThreadLink[] | null): void {
    this.field.threads(list);
  }
  burst(x: number, y: number, hex?: string): void {
    this.field.burst(x, y, hex);
  }
  flowTo(x: number, y: number, flowOpts?: FlowOptions): void {
    this.field.flowTo(x, y, flowOpts);
  }
  clearFlow(): void {
    this.field.clearFlow();
  }
  seed(atoms: readonly AtomPayload[]): void {
    this.field.seed(atoms);
  }
  atomAt(x: number, y: number): AtomPayload | null {
    return this.field.atomAt(x, y);
  }
  focusAt(x: number, y: number): AtomPayload | null {
    return this.field.focusAt(x, y);
  }
  clearFocus(): void {
    this.field.clearFocus();
  }
  particleCount(): number {
    return this.field.particleCount();
  }
  readParticles(out: Float32Array): number {
    return this.field.readParticles(out);
  }
  energy(): { kinetic: number; thermal: number; total: number; count: number } {
    return this.field.energy();
  }
  sample(x: number, y: number): { x: number; y: number } {
    return this.field.sample(x, y);
  }
  scrollV(): number {
    return this.field.scrollV();
  }
  setBackground(mode: Parameters<FieldHandle['setBackground']>[0]): void {
    this.field.setBackground(mode);
  }

  /** stop the engine, release host listeners, and free the swarm's GPU resources. */
  destroy(): void {
    this.field.destroy();
    this.pool.dispose();
  }
}

/** Construct a `FieldLayer`. The ergonomic entry point — mirrors `mountField()` for Three.js. */
export function createFieldLayer(opts: FieldLayerOptions = {}): FieldLayer {
  return new FieldLayer(opts);
}

export interface ThreeFieldOptions extends Omit<FieldOptions, 'host'> {
  /** field-space viewport (CSS pixels) + dpr — wire to your `FieldProjection`. */
  viewport: () => HostViewport;
  /** `[data-body]` scan root; omit for a field with no DOM bodies. */
  root?: ParentNode;
  /** a canvas to satisfy the engine signature; one is created for you when omitted. */
  canvas?: HTMLCanvasElement;
}

/**
 * Lower-level builder: `createField` wired to a `threeHost`, returning the raw `FieldHandle` (no
 * pool, no scene object). Use this when you want the engine on a WebGL scene but will draw it
 * yourself — e.g. injecting `overlayBackend: threeBackend(...)` to render the diagnostic overlays,
 * or sampling `forceAt` / `netField` for your own field visuals. `createFieldLayer` is the
 * batteries-included path; this is the seam under it. (Parallels `createBrowserField`.)
 */
export function createThreeField(opts: ThreeFieldOptions): FieldHandle {
  const { viewport, root, canvas, ...fieldOpts } = opts;
  const host = threeHost({ viewport, root });
  return createField(canvas ?? stubCanvas(), { ...fieldOpts, host });
}
