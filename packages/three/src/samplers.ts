/**
 * Native 3D field visuals — the field as geometry, not particles. Because the engine is queryable at
 * any point (`FieldHandle.sample`), you can build visuals the 2D canvas can't: an instanced arrow
 * **vector field** and **streamline tubes** that trace the flow through the scene. Both read the live
 * field on `update()`, mapped through the same `FieldProjection` the swarm and bodies use, so they
 * register exactly — the fixed `z` each visual takes is an OFFSET off the projected field plane, so a
 * `VolumeProjection` (centered or not) places them where the plane actually sits.
 *
 * Lifecycle discipline (the #921 pool model): both visuals are safe to `update()` every frame — the
 * arrow grid writes one persistent `InstancedMesh` in place, and the tubes reuse a pooled set of
 * `Mesh`es (hidden, not removed, when a line stalls), disposing only the `TubeGeometry` each retrace
 * replaces. Re-sampling runs on an `interval` cadence (the repo's compute-vs-draw doctrine: body
 * positions only change on the engine's measure cadence, so tracing more often buys nothing), while
 * the scene keeps drawing the cached geometry every frame. `dispose()` frees everything.
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
const _col = new Color();
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
  /** arrow color at low magnitude (default a field blue). */
  color?: string;
  /** arrow color at peak magnitude — each arrow lerps `color → hotColor` by its relative strength,
   *  so magnitude reads in hue as well as length (default white-hot). */
  hotColor?: string;
  /** world-z OFFSET off the projected field plane (default 0.02, just in front of it). */
  z?: number;
  /** re-sample the field every Nth `update()` call (default 1 — every call; the grid sweep is
   *  cheap). Raise it to put sampling on a cadence while the scene draws the cache every frame. */
  interval?: number;
}

export interface FieldVisual {
  /** add this to your scene. */
  readonly object: Group;
  /** re-sample the live field on the configured `interval` cadence and refresh the geometry —
   *  safe to call every frame (off-cadence calls return without touching the field). */
  update(): void;
  /** release GPU resources. */
  dispose(): void;
}

/** An instanced grid of arrows showing the field direction + magnitude across the plane. */
export function vectorField(field: FieldSampler, opts: VectorFieldOptions): FieldVisual {
  const { projection, step = 64, maxLength = 0.4, color = '#7cc0ff', hotColor = '#ffffff', z = 0.02 } = opts;
  const every = Math.max(1, Math.round(opts.interval ?? 1));
  const { width, height } = projection.size();
  const cols = Math.max(1, Math.floor(width / step));
  const rows = Math.max(1, Math.floor(height / step));
  const count = cols * rows;

  // a cone pointing +X (so a Z-rotation aims it along the in-plane force direction)
  const geo = new ConeGeometry(0.16, 1, 6);
  geo.rotateZ(-Math.PI / 2);
  geo.translate(0.5, 0, 0);
  // the material stays white; each arrow's tint lives in its INSTANCE color (cold→hot by magnitude),
  // and instance colors multiply the material color.
  const material = new MeshBasicMaterial({ transparent: true, opacity: 0.85 });
  const mesh = new InstancedMesh(geo, material, count);
  mesh.frustumCulled = false;
  const cold = new Color(color);
  const hot = new Color(hotColor);

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
  let frame = 0;

  const resample = (): void => {
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
      _pos.z += z; // offset OFF the projected plane (not an absolute world z) so volumes register
      const rel = Math.sqrt(Math.hypot(vx[i]!, vy[i]!) / max); // sqrt compression so weak arrows read
      // field-y is down → world-y up, so the world direction is (vx, -vy)
      const angle = Math.atan2(-vy[i]!, vx[i]!);
      _quat.setFromAxisAngle(_zAxis, angle);
      const len = Math.max(0.0001, rel * maxLength);
      _scl.set(len, len, len);
      _mat.compose(_pos, _quat, _scl);
      mesh.setMatrixAt(i, _mat);
      mesh.setColorAt(i, _col.copy(cold).lerp(hot, Math.min(1, rel)));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  const update = (): void => {
    if (frame++ % every !== 0) return; // off-cadence: keep drawing the cached grid
    resample();
  };
  update(); // build at construction (consumes cadence frame 0)

  return {
    object: group,
    update,
    dispose: () => {
      geo.dispose();
      material.dispose();
      mesh.dispose(); // frees the instanceMatrix/instanceColor GPU attributes
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
  /** world-z OFFSET off the projected field plane (default 0.02). */
  z?: number;
  /** re-trace the field every Nth `update()` call (default 6 — the engine's measure cadence; body
   *  positions only change that often, so tracing per frame buys nothing). Set 1 to retrace on
   *  every call. Off-cadence calls keep drawing the cached tubes. */
  interval?: number;
}

/** Flow lines traced through the field, rendered as tubes — the field's structure as geometry.
 *  Tube meshes are POOLED: a retrace reuses each `Mesh` (swapping in the fresh `TubeGeometry` and
 *  disposing the one it replaces) and hides — never removes — the tail when fewer lines survive,
 *  so a steady field allocates no new scene objects. */
export function streamlineTubes(field: FieldSampler, opts: StreamlineTubesOptions): FieldVisual {
  const { projection, step = 120, maxSteps = 80, stepLen = 8, radius = 0.03, color = '#9fd4ff', z = 0.02 } = opts;
  const every = Math.max(1, Math.round(opts.interval ?? 6));
  const { width, height } = projection.size();
  const material = new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.7 });
  const group = new Group();

  // seeds are fixed for the visual's lifetime (the projection's size is too) — compute once.
  const seeds: { x: number; y: number }[] = opts.seeds ?? [];
  if (!opts.seeds) {
    for (let y = step / 2; y < height; y += step) for (let x = step / 2; x < width; x += step) seeds.push({ x, y });
  }

  // Mesh pool + cursor (the #921 sprite-pool model): retraces reuse the pooled meshes in order,
  // growing only when a retrace yields more lines than ever before; the unused tail is hidden.
  const pool: Mesh[] = [];
  let cursor = 0;
  const acquireTube = (geometry: TubeGeometry): void => {
    let mesh = pool[cursor];
    if (!mesh) {
      mesh = new Mesh(geometry, material);
      mesh.frustumCulled = false; // lines span the plane; skip per-tube bounds recompute
      pool[cursor] = mesh;
      group.add(mesh);
    } else {
      mesh.geometry.dispose(); // a TubeGeometry can't be rewritten in place — swap, free the old
      mesh.geometry = geometry;
      mesh.visible = true;
    }
    cursor++;
  };

  // persistent path scratch — the world-space Vector3s are reused across every line and retrace.
  // TubeGeometry BAKES the curve into vertices at construction, so mutating these afterwards only
  // touches `geometry.parameters.path` (serialization metadata, never re-read for rendering).
  const scratch: Vector3[] = [];
  const pathInto = (pts: { x: number; y: number }[]): Vector3[] => {
    while (scratch.length < pts.length) scratch.push(new Vector3());
    for (let i = 0; i < pts.length; i++) {
      projection.toWorld(pts[i]!.x, pts[i]!.y, 0, 0, 0, scratch[i]!);
      scratch[i]!.z += z; // offset OFF the projected plane (not an absolute world z)
    }
    return scratch.slice(0, pts.length); // a small per-line array of REUSED vectors
  };

  let frame = 0;
  const resample = (): void => {
    cursor = 0;
    for (const seed of seeds) {
      const pts = traceStreamline(field, seed, { width, height, maxSteps, stepLen });
      if (pts.length < 2) continue; // stalled seed — its pooled mesh (if any) is hidden below
      const path = pathInto(pts);
      acquireTube(new TubeGeometry(new CatmullRomCurve3(path), Math.max(1, path.length - 1), radius, 6, false));
    }
    // hide the tail the retrace didn't reach — pooled for the next retrace, not removed.
    for (let i = cursor; i < pool.length && pool[i]!.visible; i++) pool[i]!.visible = false;
  };
  const update = (): void => {
    if (frame++ % every !== 0) return; // off-cadence: the cached tubes keep drawing
    resample();
  };
  update(); // build at construction (consumes cadence frame 0)

  return {
    object: group,
    update,
    dispose: () => {
      for (const mesh of pool) mesh.geometry.dispose();
      material.dispose();
      group.clear();
      pool.length = 0;
    },
  };
}
