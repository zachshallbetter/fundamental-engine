/**
 * `FieldAgent` — an `Object3D` that rides the field: the creatures primitive (#426). The swarm
 * bridge renders free matter; an agent is a *specific* scene object (a bee, a fish, a drone) that
 * samples the live field at its own position each frame, steers along the force, and writes its
 * world position through the shared `FieldProjection`.
 *
 * Agents are **consumers, not bodies** — they feel the field but exert nothing back unless you also
 * register them with `layer.addBody(...)`. The `sampler` is the small `FieldSampler` interface, so
 * an agent can follow a whole layer, a raw handle, or any custom blend (a wind-only stub, a scaled
 * mix). Pure math + `Object3D` writes: renderer-free and unit-testable.
 *
 * ```ts
 * const bee = new FieldAgent(beeMesh, { projection, sampler: layer, maxSpeed: 90 });
 * // render loop:
 * bee.update(dt);
 * ```
 */

import { Vector3 } from 'three';
import type { Object3D } from 'three';
import type { FieldProjection } from './project.ts';
import type { FieldSampler } from './samplers.ts';

const _w = new Vector3();

export interface FieldAgentOptions {
  /** the 2D↔3D mapping (share the layer's so agents and swarm agree). */
  projection: FieldProjection;
  /** what to follow — anything with `sample(x, y)`: a `FieldLayer`, a `FieldHandle`, a stub. */
  sampler: FieldSampler;
  /** top speed in field px/s (default 80). */
  maxSpeed?: number;
  /** acceleration along the sampled force, px/s² per unit force (default 240). */
  accel?: number;
  /** velocity damping per second — higher coasts to rest sooner in a dead field (default 1.4). */
  drag?: number;
  /** random wander acceleration in px/s² so agents don't railroad one streamline (default 0). */
  wander?: number;
  /** optional world-y hover bob layered on the projected position. */
  hover?: { amp: number; freq: number };
  /** orient the object along its travel direction each update (default true). */
  faceVelocity?: boolean;
  /** deterministic random source for `wander` (default `Math.random`). */
  rng?: () => number;
}

export class FieldAgent {
  /** the scene object this agent drives. */
  readonly object: Object3D;
  /** position in field pixels — read/write (set it to spawn or teleport). */
  fieldPosition: { x: number; y: number };
  /** velocity in field px/s (read/write). */
  velocity: { x: number; y: number };

  private readonly projection: FieldProjection;
  private readonly sampler: FieldSampler;
  private readonly maxSpeed: number;
  private readonly accel: number;
  private readonly drag: number;
  private readonly wander: number;
  private readonly hover?: { amp: number; freq: number };
  private readonly faceVelocity: boolean;
  private readonly rng: () => number;
  private t = 0;
  private readonly phase: number;
  private readonly look = new Vector3();

  constructor(object: Object3D, opts: FieldAgentOptions) {
    this.object = object;
    this.projection = opts.projection;
    this.sampler = opts.sampler;
    this.maxSpeed = opts.maxSpeed ?? 80;
    this.accel = opts.accel ?? 240;
    this.drag = opts.drag ?? 1.4;
    this.wander = opts.wander ?? 0;
    this.hover = opts.hover;
    this.faceVelocity = opts.faceVelocity ?? true;
    this.rng = opts.rng ?? Math.random;
    this.phase = this.rng() * Math.PI * 2;

    // spawn where the object currently sits (world → field); centre if it has no position yet
    object.getWorldPosition(_w);
    this.fieldPosition = this.projection.toField(_w);
    if (!Number.isFinite(this.fieldPosition.x) || !Number.isFinite(this.fieldPosition.y)) {
      const { width, height } = this.projection.size();
      this.fieldPosition = { x: width / 2, y: height / 2 };
    }
    this.velocity = { x: 0, y: 0 };
  }

  /** sample → steer → integrate → write the object's position. Call once per frame with dt in s. */
  update(dt: number): void {
    if (!(dt > 0)) return;
    this.t += dt;
    const p = this.fieldPosition;
    const v = this.velocity;

    const f = this.sampler.sample(p.x, p.y);
    v.x += f.x * this.accel * dt;
    v.y += f.y * this.accel * dt;
    if (this.wander > 0) {
      v.x += (this.rng() * 2 - 1) * this.wander * dt;
      v.y += (this.rng() * 2 - 1) * this.wander * dt;
    }
    // drag, then clamp to top speed
    const damp = Math.max(0, 1 - this.drag * dt);
    v.x *= damp;
    v.y *= damp;
    const speed = Math.hypot(v.x, v.y);
    if (speed > this.maxSpeed) {
      v.x = (v.x / speed) * this.maxSpeed;
      v.y = (v.y / speed) * this.maxSpeed;
    }
    p.x += v.x * dt;
    p.y += v.y * dt;

    // keep agents inside the field with a soft edge bounce
    const { width, height } = this.projection.size();
    if (p.x < 0) { p.x = 0; v.x = Math.abs(v.x); }
    if (p.y < 0) { p.y = 0; v.y = Math.abs(v.y); }
    if (p.x > width) { p.x = width; v.x = -Math.abs(v.x); }
    if (p.y > height) { p.y = height; v.y = -Math.abs(v.y); }

    this.projection.toWorld(p.x, p.y, 0, 0, 0, this.object.position);
    if (this.hover) this.object.position.y += Math.sin(this.t * this.hover.freq + this.phase) * this.hover.amp;
    if (this.faceVelocity && speed > 1e-3) {
      // look one step ahead along the travel direction, in world space
      this.projection.toWorld(p.x + v.x * 0.1, p.y + v.y * 0.1, 0, 0, 0, this.look);
      this.look.y = this.object.position.y;
      this.object.lookAt(this.look);
    }
  }
}
