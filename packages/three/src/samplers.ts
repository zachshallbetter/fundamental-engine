/**
 * Native 3D field visuals — the field as geometry, not particles. Because the engine is queryable at
 * any point (`FieldHandle.sample`), you can build visuals the 2D canvas can't: an instanced arrow
 * **vector field** and **streamline tubes** that trace the flow through the scene. Both read the live
 * field each `update()`, mapped through the same `FieldProjection` the swarm and bodies use, so they
 * register exactly.
 *
 * The tracing/sampling core is pure (no WebGL) and unit-tested; only the geometry needs a renderer.
 */

import {
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  TubeGeometry,
  Vector3,
} from 'three';
import { traceFieldLine } from '@fundamental-engine/core';
import type { FieldProjection } from './project.ts';

/** Anything with the engine's `sample` — a `FieldLayer`, a `FieldHandle`, or a test stub. */
export interface FieldSampler {
  sample(x: number, y: number): { x: number; y: number };
}

const _pos = new Vector3();
const _quat = new Quaternion();
const _scl = new Vector3();
const _mat = new Matrix4();
const _zAxis = new Vector3(0, 0, 1);

/**
 * Trace one streamline from a seed, integrating the field direction. Pure (field-pixel space) —
 * returns the polyline of points it passes through. Stops at the viewport edge, a stall (near-zero
 * field), or `maxSteps`.
 */
export function traceStreamline(
  field: FieldSampler,
  seed: { x: number; y: number },
  opts: { width: number; height: number; maxSteps?: number; stepLen?: number; minMag?: number },
): { x: number; y: number }[] {
  const { width, height, maxSteps = 80, stepLen = 8 } = opts;
  // Delegate to the core tracer rather than re-walking the field forward-only: traceFieldLine is
  // bidirectional (the seed sits mid-line), closes loops, and carries a turn budget so a vortex
  // can't wind the whole step budget into one circle — the qualities the old local walk lacked.
  return traceFieldLine((x, y) => field.sample(x, y), seed.x, seed.y, {
    step: stepLen,
    maxSteps,
    bounds: { w: width, h: height },
  });
}

export interface VectorFieldOptions {
  /** the 2D↔3D mapping (share the layer's). */
  projection: FieldProjection;
  /** grid spacing in field pixels (default 64). */
  step?: number;
  /** longest arrow in world units, at the peak sampled magnitude (default 0.4). */
  maxLength?: number;
  /** arrow color (default a field blue). */
  color?: string;
  /** world-z the arrows sit at (default 0.02, just off the plane). */
  z?: number;
}

export interface FieldVisual {
  /** add this to your scene. */
  readonly object: Group;
  /** re-sample the live field and refresh the geometry — call when the field changed. */
  update(): void;
  /** release GPU resources. */
  dispose(): void;
}

/** An instanced grid of arrows showing the field direction + magnitude across the plane. */
export function vectorField(field: FieldSampler, opts: VectorFieldOptions): FieldVisual {
  const { projection, step = 64, maxLength = 0.4, color = '#7cc0ff', z = 0.02 } = opts;
  const { width, height } = projection.size();
  const cols = Math.max(1, Math.floor(width / step));
  const rows = Math.max(1, Math.floor(height / step));
  const count = cols * rows;

  // a cone pointing +X (so a Z-rotation aims it along the in-plane force direction)
  const geo = new ConeGeometry(0.16, 1, 6);
  geo.rotateZ(-Math.PI / 2);
  geo.translate(0.5, 0, 0);
  const material = new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.85 });
  const mesh = new InstancedMesh(geo, material, count);
  mesh.frustumCulled = false;

  const group = new Group();
  group.add(mesh);

  // persistent per-cell sample scratch (reused every update — no per-call array allocation).
  // The grid position is recomputed from the flat index, so only the sampled vector is stored.
  const vx = new Float64Array(count);
  const vy = new Float64Array(count);
  // EMA-smoothed peak (the core "pulsing lesson", field.ts §streamlines): normalizing by the raw
  // per-frame max makes every arrow jitter as a transient (a dragged body, an animated strength)
  // shifts the peak frame to frame. Ease the peak up fast so a real spike normalizes promptly, and
  // down slowly so the field reads as a calm pulse rather than a flicker.
  let peak = 1e-6;

  const update = (): void => {
    let frameMax = 1e-6;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = field.sample((c + 0.5) * step, (r + 0.5) * step);
        const m = Math.hypot(v.x, v.y);
        if (m > frameMax) frameMax = m;
        const i = r * cols + c;
        vx[i] = v.x;
        vy[i] = v.y;
      }
    }
    peak += (frameMax - peak) * (frameMax > peak ? 0.5 : 0.05);
    const max = peak;
    for (let i = 0; i < count; i++) {
      const px = ((i % cols) + 0.5) * step;
      const py = (Math.floor(i / cols) + 0.5) * step;
      projection.toWorld(px, py, 0, 0, 0, _pos);
      _pos.z = z;
      const rel = Math.sqrt(Math.hypot(vx[i]!, vy[i]!) / max); // sqrt compression so weak arrows read
      // field-y is down → world-y up, so the world direction is (vx, -vy)
      const angle = Math.atan2(-vy[i]!, vx[i]!);
      _quat.setFromAxisAngle(_zAxis, angle);
      const len = Math.max(0.0001, rel * maxLength);
      _scl.set(len, len, len);
      _mat.compose(_pos, _quat, _scl);
      mesh.setMatrixAt(i, _mat);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update();

  return {
    object: group,
    update,
    dispose: () => {
      geo.dispose();
      material.dispose();
    },
  };
}

export interface StreamlineTubesOptions {
  /** the 2D↔3D mapping (share the layer's). */
  projection: FieldProjection;
  /** seed points in field pixels; omit for an auto grid at `step` spacing. */
  seeds?: { x: number; y: number }[];
  /** auto-seed grid spacing in field pixels when `seeds` is omitted (default 120). */
  step?: number;
  /** integration steps per line (default 80) and step length in field px (default 8). */
  maxSteps?: number;
  stepLen?: number;
  /** tube radius in world units (default 0.03). */
  radius?: number;
  /** tube color (default a field blue). */
  color?: string;
  /** world-z the tubes sit at (default 0.02). */
  z?: number;
}

/** Flow lines traced through the field, rendered as tubes — the field's structure as geometry. */
export function streamlineTubes(field: FieldSampler, opts: StreamlineTubesOptions): FieldVisual {
  const { projection, step = 120, maxSteps = 80, stepLen = 8, radius = 0.03, color = '#9fd4ff', z = 0.02 } = opts;
  const { width, height } = projection.size();
  const material = new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.7 });
  const group = new Group();

  const seedPoints = (): { x: number; y: number }[] => {
    if (opts.seeds) return opts.seeds;
    const out: { x: number; y: number }[] = [];
    for (let y = step / 2; y < height; y += step) for (let x = step / 2; x < width; x += step) out.push({ x, y });
    return out;
  };

  const update = (): void => {
    for (const child of group.children) (child as Mesh).geometry.dispose();
    group.clear();
    for (const seed of seedPoints()) {
      const pts = traceStreamline(field, seed, { width, height, maxSteps, stepLen });
      if (pts.length < 2) continue;
      const path = pts.map((p) => {
        const w = projection.toWorld(p.x, p.y, 0, 0, 0, new Vector3());
        w.z = z;
        return w;
      });
      const tube = new TubeGeometry(new CatmullRomCurve3(path), Math.max(1, path.length - 1), radius, 6, false);
      group.add(new Mesh(tube, material));
    }
  };
  update();

  return {
    object: group,
    update,
    dispose: () => {
      for (const child of group.children) (child as Mesh).geometry.dispose();
      group.clear();
      material.dispose();
    },
  };
}
