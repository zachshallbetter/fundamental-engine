/**
 * `FieldProjection` — the 2D↔3D coordinate seam. The engine integrates in a flat, CSS-pixel field
 * space (`0..width`, `0..height`); a Three.js scene lives in 3D world units. Every renderer-facing
 * mapping goes through this one interface so the plane model ships now and a volumetric mode can
 * slot in later without changing `FieldLayer` or the backend.
 *
 * - `PlaneProjection`: the field stands up on a quad — pixels map to world units on a plane; the
 *   engine's `z` is ignored and `z` is instead lifted from per-particle `heat` for stylistic relief.
 *   The right choice for a flat (`depth`-less) field.
 * - `VolumeProjection`: maps the engine's real depth lane (`z ∈ [0, depth)`, the opt-in z axis from
 *   z-axis.md) onto a world depth range — a genuinely volumetric swarm. Use it when the field was
 *   created with `depth > 0`.
 *
 * Both implement one interface, so `FieldLayer` and `threeBackend` are unchanged by the choice.
 */

import { Vector3 } from 'three';

export interface FieldProjection {
  /** the engine's field-space size in CSS pixels — feeds `FieldHost.viewport()`. */
  size(): { width: number; height: number };
  /**
   * field point `(x, y, z)` + per-particle scalars → world position (writes `target` if given).
   * `z` is the engine's depth lane (always `0` in a flat field); a `PlaneProjection` ignores it.
   */
  toWorld(x: number, y: number, z: number, heat: number, size: number, target?: Vector3): Vector3;
  /** world position → field pixel, for projecting scene objects back onto the field (`z` ignored). */
  toField(p: Vector3): { x: number; y: number };
}

export interface PlaneProjectionOptions {
  /** field-space width in CSS pixels (default 1000). */
  width?: number;
  /** field-space height in CSS pixels (default 600). */
  height?: number;
  /** world units per field pixel (default 0.01 → a 1000px field is 10 world units wide). */
  scale?: number;
  /** world-space `z` lift at `heat === 1`; `0` keeps the field perfectly flat (default 0). */
  relief?: number;
  /** center the plane on the world origin (default true); when false, `(0,0)` field = origin. */
  center?: boolean;
}

/**
 * The field on a plane: `(x, y)` field pixels map onto the world XY plane (screen-`y`-down flipped
 * to world-`y`-up), with `z` lifted from `heat`. Allocation-free on the hot path — pass a reused
 * `target` Vector3 to `toWorld`.
 */
export class PlaneProjection implements FieldProjection {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly relief: number;
  readonly center: boolean;

  constructor(opts: PlaneProjectionOptions = {}) {
    this.width = opts.width ?? 1000;
    this.height = opts.height ?? 600;
    this.scale = opts.scale ?? 0.01;
    this.relief = opts.relief ?? 0;
    this.center = opts.center ?? true;
  }

  size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  toWorld(x: number, y: number, _z: number, heat: number, _size: number, target = new Vector3()): Vector3 {
    const cx = this.center ? this.width / 2 : 0;
    const cy = this.center ? this.height / 2 : 0;
    return target.set(
      (x - cx) * this.scale,
      (cy - y) * this.scale, // screen-y is down; world-y is up
      heat * this.relief, // engine z ignored; relief is a stylistic heat-lift for flat fields
    );
  }

  toField(p: Vector3): { x: number; y: number } {
    const cx = this.center ? this.width / 2 : 0;
    const cy = this.center ? this.height / 2 : 0;
    return {
      x: p.x / this.scale + cx,
      y: cy - p.y / this.scale,
    };
  }
}

export interface VolumeProjectionOptions {
  /** field-space width in CSS pixels (default 1000). */
  width?: number;
  /** field-space height in CSS pixels (default 600). */
  height?: number;
  /** world units per field pixel in x/y (default 0.01). */
  scale?: number;
  /** the engine `depth` (z-axis.md) this maps — match `FieldOptions.depth` (default 300). */
  depth?: number;
  /** world units per unit of engine z; defaults to `scale` (an isotropic volume). */
  depthScale?: number;
  /** center the field in x/y on the world origin (default true). */
  center?: boolean;
  /** center the volume in z too, so the page plane (`z = 0`) sits at world-z 0 and matter extends
   *  both ways; when false (default) the plane is at world-z 0 and depth extends toward +z. */
  centerZ?: boolean;
}

/**
 * The field as a volume: `(x, y)` map onto the world plane exactly as `PlaneProjection`, and the
 * engine's real depth lane `z ∈ [0, depth)` maps onto a world depth range — a genuinely 3D swarm.
 * Bodies (DOM elements) stay on the `z = 0` page plane; free matter drifts through the volume and is
 * pulled gently back toward the plane (the engine's behavior), so the cloud reads as depth + parallax
 * around the content rather than a slab.
 */
export class VolumeProjection implements FieldProjection {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly depth: number;
  readonly depthScale: number;
  readonly center: boolean;
  readonly centerZ: boolean;

  constructor(opts: VolumeProjectionOptions = {}) {
    this.width = opts.width ?? 1000;
    this.height = opts.height ?? 600;
    this.scale = opts.scale ?? 0.01;
    this.depth = opts.depth ?? 300;
    this.depthScale = opts.depthScale ?? this.scale;
    this.center = opts.center ?? true;
    this.centerZ = opts.centerZ ?? false;
  }

  size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  toWorld(x: number, y: number, z: number, _heat: number, _size: number, target = new Vector3()): Vector3 {
    const cx = this.center ? this.width / 2 : 0;
    const cy = this.center ? this.height / 2 : 0;
    const cz = this.centerZ ? this.depth / 2 : 0;
    return target.set((x - cx) * this.scale, (cy - y) * this.scale, (z - cz) * this.depthScale);
  }

  toField(p: Vector3): { x: number; y: number } {
    const cx = this.center ? this.width / 2 : 0;
    const cy = this.center ? this.height / 2 : 0;
    return {
      x: p.x / this.scale + cx,
      y: cy - p.y / this.scale,
    };
  }
}
