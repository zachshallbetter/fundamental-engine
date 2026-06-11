/**
 * `FieldProjection` — the 2D↔3D coordinate seam. The engine integrates in a flat, CSS-pixel field
 * space (`0..width`, `0..height`); a Three.js scene lives in 3D world units. Every renderer-facing
 * mapping goes through this one interface so the plane model ships now and a volumetric mode can
 * slot in later without changing `FieldLayer` or the backend.
 *
 * - `PlaneProjection` (here): the field stands up on a quad — pixels map to world units on a plane,
 *   `z` is lifted from per-particle `heat` for relief. The literal 2D field, in 3D.
 * - A future `VolumeProjection` implements the same interface with `z` as a real axis (it needs the
 *   engine's force math extended to a third component; out of scope for v1, but the seam absorbs it).
 */

import { Vector3 } from 'three';

export interface FieldProjection {
  /** the engine's field-space size in CSS pixels — feeds `FieldHost.viewport()`. */
  size(): { width: number; height: number };
  /** field pixel `(x, y)` + per-particle scalars → world position (writes `target` if given). */
  toWorld(x: number, y: number, heat: number, size: number, target?: Vector3): Vector3;
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

  toWorld(x: number, y: number, heat: number, _size: number, target = new Vector3()): Vector3 {
    const cx = this.center ? this.width / 2 : 0;
    const cy = this.center ? this.height / 2 : 0;
    return target.set(
      (x - cx) * this.scale,
      (cy - y) * this.scale, // screen-y is down; world-y is up
      heat * this.relief,
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
