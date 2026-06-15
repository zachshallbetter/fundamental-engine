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

import { createField } from '@fundamental-engine/core';
import type { AgentHandle, AgentSpec, AtomPayload, FieldHandle, FieldOptions, FlowOptions, HostViewport, ScalarGrid, ThreadLink, FieldEventType, FieldEventMap, BodySpec, BodyHandle } from '@fundamental-engine/core';
import { Group, Vector3 } from 'three';
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

const _v = new Vector3();

/** Options for `FieldLayer.addAgent(object3d, opts)` — an engine-stepped, mesh-bound agent. */
export interface MeshAgentOptions {
  /** top speed in field px/frame (default 80). */
  maxSpeed?: number;
  /** inertial mass — heavier agents accelerate less (default 1). */
  mass?: number;
  /** species tag, so tagged bodies (`affects`) and `hunt` act on it selectively. */
  species?: number;
  /** aim the object along its travel direction each frame (default true). */
  faceVelocity?: boolean;
  /** an optional world-y hover bob layered on the projected position. */
  hover?: { amp: number; freq: number };
}

/** Handle for a mesh agent added via `FieldLayer.addAgent(object3d, …)`. */
export interface MeshAgentHandle {
  /** the scene object the engine drives. */
  readonly object: Object3D;
  /** the underlying core agent (`particle`, `remove()`). */
  readonly agent: AgentHandle;
  /** retire the agent and stop driving the object. */
  remove(): void;
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
  /** the engine-stepped mesh agents — `layer.addAgent(...)`; all retired on `destroy()`. */
  private readonly agents: MeshAgentHandle[] = [];
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
  addBody(object: Object3D, spec: FieldBodySpec): FieldBody;
  addBody(spec: BodySpec): BodyHandle;
  addBody(a: Object3D | BodySpec, spec?: FieldBodySpec): FieldBody | BodyHandle {
    // the core FieldHandle form (a plain spec, no mesh): delegate straight to the engine.
    if (spec === undefined) return this.field.addBody(a as BodySpec);
    return this.bodies.add(a as Object3D, spec);
  }

  /**
   * Add an **agent**: a scene object the engine *moves*. The integrator steps it (it feels every
   * force the swarm feels — body forces and the particle-level `hunt`/`align`/`cohesion`) and drives
   * the object's position through the projection each frame; `maxSpeed` caps it, `faceVelocity` aims
   * it, `hover` adds a bob. Returns a handle (`object`, the core `agent`, `remove()`). The aligned,
   * engine-stepped successor to the self-integrating `FieldAgent` — the creatures primitive.
   *
   * The raw `addAgent(spec)` (the `FieldHandle` form) is also accepted for full-control callers.
   */
  addAgent(object: Object3D, opts?: MeshAgentOptions): MeshAgentHandle;
  addAgent(spec: AgentSpec): AgentHandle;
  addAgent(a: Object3D | AgentSpec, opts: MeshAgentOptions = {}): MeshAgentHandle | AgentHandle {
    if (!(a as { isObject3D?: boolean }).isObject3D) return this.field.addAgent(a as AgentSpec);
    const object = a as Object3D;
    object.getWorldPosition(_v);
    const start = this.projection.toField(_v);
    const face = opts.faceVelocity ?? true;
    const hover = opts.hover;
    const look = new Vector3();
    let n = 0;
    const agent = this.field.addAgent({
      x: start.x,
      y: start.y,
      species: opts.species,
      mass: opts.mass,
      maxSpeed: opts.maxSpeed ?? 80,
      report: (p) => {
        this.projection.toWorld(p.x, p.y, p.z ?? 0, 0, 0, object.position);
        if (hover) object.position.y += Math.sin(n++ * 0.1 * hover.freq) * hover.amp;
        if (face && p.vx * p.vx + p.vy * p.vy > 1e-3) {
          this.projection.toWorld(p.x + p.vx * 0.1, p.y + p.vy * 0.1, p.z ?? 0, 0, 0, look);
          look.y = object.position.y;
          object.lookAt(look);
        }
      },
    });
    const handle: MeshAgentHandle = {
      object,
      agent,
      remove: () => {
        agent.remove();
        const i = this.agents.indexOf(handle);
        if (i >= 0) this.agents.splice(i, 1);
      },
    };
    this.agents.push(handle);
    return handle;
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
  /** copy each live particle's stable id into a Uint32Array, parallel to readParticles. */
  readParticleIds(out: Uint32Array): number {
    return this.field.readParticleIds(out);
  }
  energy(): { kinetic: number; thermal: number; total: number; count: number } {
    return this.field.energy();
  }
  sample(x: number, y: number): { x: number; y: number } {
    return this.field.sample(x, y);
  }
  /** smooth density scalar ∈ [0,1] at `(x, y)` — pass `createFieldLayer({ heatmap: true })` to enable. */
  sampleScalar(x: number, y: number): number {
    return this.field.sampleScalar(x, y);
  }
  /** density gradient ∇ at `(x, y)` — up-density direction in field px; needs `{ heatmap: true }`, `{0,0}` when off. */
  sampleGradient(x: number, y: number): { x: number; y: number } {
    return this.field.sampleGradient(x, y);
  }
  /** open a named host-authorable scalar grid (deposit/sample/gradient/decay) in field px — a scent/wear/goal field. */
  grid(name: string): ScalarGrid {
    return this.field.grid(name);
  }
  /** subscribe to a discrete field event (absorb/release/settle); returns an unsubscribe fn. */
  on<K extends FieldEventType>(type: K, cb: (e: FieldEventMap[K]) => void): () => void {
    return this.field.on(type, cb);
  }
  scrollV(): number {
    return this.field.scrollV();
  }
  setBackground(mode: Parameters<FieldHandle['setBackground']>[0]): void {
    this.field.setBackground(mode);
  }

  /** stop the engine, release host listeners, retire agents, and free the swarm's GPU resources. */
  destroy(): void {
    for (const a of this.agents.slice()) a.remove();
    this.field.destroy();
    this.pool.dispose();
    this.bodies.clear(); // drop body↔mesh refs so a retained handle can't pin the registry
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
