/**
 * `threeBackend` — a `RenderBackend` (the engine's structural drawing seam, #373) that draws the
 * overlay readings as Three.js geometry instead of a 2D canvas. Inject it via
 * `createField({ overlayBackend })` (or `createThreeField`) and add `backend.object` to your scene.
 *
 * The engine describes WHAT to draw in CSS-pixel primitives; this backend owns HOW — mapping those
 * pixels through the `FieldProjection` onto an overlay plane and batching them into a `LineSegments`
 * (arrows, field-lines, grid, contours, traced paths) and a triangle `Mesh` (the data-chip plates).
 * Per-stroke alpha is premultiplied into the vertex color and composited additively, so magnitude
 * still reads. Geometry is rebuilt on each `clear()` (the engine clears once at the top of every
 * overlay frame), so the scene always shows the latest readings.
 *
 * Scope: the line + rect primitives — i.e. every field-structure overlay — render fully. The
 * `data` reading's numeric chip labels render as pooled `Sprite`s: each distinct label string
 * (color included) gets ONE `CanvasTexture`, cached and reused across frames; the sprite pool grows
 * on demand and unused sprites are hidden on `clear()`, so a steady overlay uploads no new textures.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DynamicDrawUsage,
  Group,
  LinearFilter,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import type { RenderBackend, Stroke } from '@fundamental-engine/core';
import type { FieldProjection } from './project.ts';

const _v = new Vector3();
const _v2 = new Vector3();

/** the chip label font — matches the Canvas 2D backend's CHIP_FONT so labels read identically. */
const CHIP_FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
/** CSS px height of the chip label box (the `10px` font + a little vertical breathing room). */
const LABEL_PX_HEIGHT = 13;
/** supersample factor for the label texture — crisp text without a huge atlas. */
const LABEL_SS = 3;

export interface ThreeBackendOptions {
  /** the 2D↔3D mapping (share the one your `FieldLayer` uses so overlay and swarm align). */
  projection: FieldProjection;
  /** world-z OFFSET off the projected field plane — the overlay sits just in front of wherever the
   *  projection places the field's `z = 0` plane (default 0.01). A `PlaneProjection` or an
   *  uncentered `VolumeProjection` puts that plane at world-z 0, so the offset reads as an absolute
   *  z there; a `VolumeProjection({ centerZ: true })` shifts the plane to `-depth/2 · depthScale`
   *  and the overlay follows it. */
  z?: number;
}

export interface ThreeBackend extends RenderBackend {
  /** add this to your scene to show the overlay readings. */
  readonly object: Group;
  /** release GPU resources. */
  dispose(): void;
}

/** A lazily-created 2D context purely for text metrics — never rendered to. */
function metricsContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  return document.createElement('canvas').getContext('2d');
}

export function threeBackend(opts: ThreeBackendOptions): ThreeBackend {
  const projection = opts.projection;
  const z = opts.z ?? 0.01;

  const linePos: number[] = [];
  const lineCol: number[] = [];
  const rectPos: number[] = [];
  const rectCol: number[] = [];

  const lineGeom = new BufferGeometry();
  const lines = new LineSegments(
    lineGeom,
    new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }),
  );
  lines.frustumCulled = false;

  const rectGeom = new BufferGeometry();
  const rects = new Mesh(
    rectGeom,
    new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }),
  );
  rects.frustumCulled = false;

  // label sprites live in their own group so the pool sits cleanly beside the line/rect meshes.
  const labelGroup = new Group();
  const object = new Group();
  object.add(lines, rects, labelGroup);

  const metrics = metricsContext();

  // Per-label `CanvasTexture` cache, keyed by the label string + its color. A chip's number/color is
  // stable frame-to-frame, so this bounds texture uploads to the set of distinct labels ever drawn —
  // no per-frame texture churn. Each entry also records the CSS-pixel width metric used to size the
  // sprite, so `text()` need not re-measure.
  interface LabelTex {
    texture: CanvasTexture;
    /** rendered width in CSS px (font metric), for the sprite's world scale. */
    widthPx: number;
  }
  const labelCache = new Map<string, LabelTex>();

  /** build (or fetch) the cached texture for `value` at the given color. */
  function labelTexture(value: string, r: number, g: number, b: number, a: number): LabelTex | null {
    if (typeof document === 'undefined') return null;
    const key = `${value}|${r},${g},${b},${a}`;
    const hit = labelCache.get(key);
    if (hit) return hit;

    if (metrics) metrics.font = CHIP_FONT;
    const widthPx = metrics ? metrics.measureText(value).width : value.length * 6;

    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(widthPx * LABEL_SS));
    cv.height = Math.max(1, Math.ceil(LABEL_PX_HEIGHT * LABEL_SS));
    const cx = cv.getContext('2d');
    if (!cx) return null;
    cx.scale(LABEL_SS, LABEL_SS);
    cx.font = CHIP_FONT;
    cx.textBaseline = 'middle';
    cx.textAlign = 'left';
    cx.fillStyle = `rgba(${r},${g},${b},${a})`;
    cx.fillText(value, 0, LABEL_PX_HEIGHT / 2);

    const texture = new CanvasTexture(cv);
    texture.minFilter = LinearFilter; // non-power-of-two atlas; no mipmaps
    texture.magFilter = LinearFilter;
    const entry: LabelTex = { texture, widthPx };
    labelCache.set(key, entry);
    return entry;
  }

  // Sprite pool: reused across frames. `clear()` parks the cursor at 0 and hides the tail; `text()`
  // advances it, growing the pool only when a frame needs more labels than before.
  const labelPool: Sprite[] = [];
  let labelCursor = 0;

  function acquireLabel(): Sprite {
    let sprite = labelPool[labelCursor];
    if (!sprite) {
      sprite = new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false }));
      sprite.frustumCulled = false;
      labelPool[labelCursor] = sprite;
      labelGroup.add(sprite);
    }
    labelCursor++;
    return sprite;
  }

  // persistent, growable GPU buffers — written in place each frame (DynamicDrawUsage) rather than
  // reallocating four Float32Arrays + four Float32BufferAttributes per overlay frame, which orphaned
  // the prior GPU buffers for the GC and forced a fresh upload every frame. Mirrors ParticlePool's
  // growth model: grow with headroom only when a frame needs more room, reuse otherwise.
  let linePosData: Float32Array = new Float32Array(0);
  let lineColData: Float32Array = new Float32Array(0);
  let rectPosData: Float32Array = new Float32Array(0);
  let rectColData: Float32Array = new Float32Array(0);

  function dynAttr(data: Float32Array): BufferAttribute {
    // BufferAttribute holds `data` BY REFERENCE, so the in-place writes below reach the GPU buffer.
    // (`Float32BufferAttribute` would silently COPY the array at construction — the attribute then
    // holds its own zeros and every later `data.set(...)` writes memory the GPU never sees.)
    const attr = new BufferAttribute(data, 3);
    attr.setUsage(DynamicDrawUsage);
    return attr;
  }
  lineGeom.setAttribute('position', dynAttr(linePosData));
  lineGeom.setAttribute('color', dynAttr(lineColData));
  rectGeom.setAttribute('position', dynAttr(rectPosData));
  rectGeom.setAttribute('color', dynAttr(rectColData));

  /** copy a frame's accumulator into its persistent GPU buffer, growing (with headroom) only when
   *  the frame needs more room than the buffer holds. Returns the buffer to keep (the same one in
   *  steady state). The stale tail beyond `src.length` is never drawn — setDrawRange bounds it. */
  function sync(geom: BufferGeometry, name: 'position' | 'color', src: number[], data: Float32Array): Float32Array {
    if (src.length > data.length) {
      data = new Float32Array(Math.ceil(src.length * 1.5)); // amortized grow; rare after warm-up
      geom.setAttribute(name, dynAttr(data));
    }
    data.set(src);
    (geom.getAttribute(name) as BufferAttribute).needsUpdate = true;
    return data;
  }

  /** map a CSS-pixel point to the overlay plane and push xyz onto `arr` (overlay owns its own z). */
  function pushPoint(arr: number[], x: number, y: number): void {
    projection.toWorld(x, y, 0, 0, 0, _v); // heat/size irrelevant; engine z = 0 → the field's page plane
    arr.push(_v.x, _v.y, _v.z + z); // offset OFF the projected plane (not an absolute world z) so volumes register
  }
  /** premultiplied 0..1 rgb (additive compositing turns alpha into intensity). */
  function pushColor(arr: number[], r: number, g: number, b: number, a: number): void {
    arr.push((r / 255) * a, (g / 255) * a, (b / 255) * a);
  }

  function flush(): void {
    linePosData = sync(lineGeom, 'position', linePos, linePosData);
    lineColData = sync(lineGeom, 'color', lineCol, lineColData);
    lineGeom.setDrawRange(0, linePos.length / 3);
    rectPosData = sync(rectGeom, 'position', rectPos, rectPosData);
    rectColData = sync(rectGeom, 'color', rectCol, rectColData);
    rectGeom.setDrawRange(0, rectPos.length / 3);
  }

  return {
    object,
    size(): void {
      // the projection owns the field→world transform; nothing to size on the GPU here.
    },
    clear(): void {
      // finalize the frame just drawn, then reset the accumulators for the next one.
      flush();
      linePos.length = 0;
      lineCol.length = 0;
      rectPos.length = 0;
      rectCol.length = 0;
      // hide any label sprites the previous frame used but this one won't, then rewind the cursor so
      // the next frame reuses them from the top (texture/material stay; only visibility toggles).
      for (let i = labelCursor; i < labelPool.length && labelPool[i]!.visible; i++) {
        labelPool[i]!.visible = false;
      }
      labelCursor = 0;
    },
    segments(packed: ArrayLike<number>, stroke: Stroke): void {
      for (let i = 0; i + 3 < packed.length; i += 4) {
        pushPoint(linePos, packed[i]!, packed[i + 1]!);
        pushPoint(linePos, packed[i + 2]!, packed[i + 3]!);
        pushColor(lineCol, stroke.r, stroke.g, stroke.b, stroke.alpha);
        pushColor(lineCol, stroke.r, stroke.g, stroke.b, stroke.alpha);
      }
    },
    polyline(points: ArrayLike<number>, stroke: Stroke): void {
      // expand the connected polyline into the disjoint-segment buffer (pairs of consecutive points)
      for (let i = 0; i + 3 < points.length; i += 2) {
        pushPoint(linePos, points[i]!, points[i + 1]!);
        pushPoint(linePos, points[i + 2]!, points[i + 3]!);
        pushColor(lineCol, stroke.r, stroke.g, stroke.b, stroke.alpha);
        pushColor(lineCol, stroke.r, stroke.g, stroke.b, stroke.alpha);
      }
    },
    rect(x: number, y: number, w: number, h: number, r: number, g: number, b: number, alpha: number): void {
      // two triangles (x,y)-(x+w,y+h); the data-chip plate
      const x2 = x + w;
      const y2 = y + h;
      pushPoint(rectPos, x, y);
      pushPoint(rectPos, x2, y);
      pushPoint(rectPos, x2, y2);
      pushPoint(rectPos, x, y);
      pushPoint(rectPos, x2, y2);
      pushPoint(rectPos, x, y2);
      for (let k = 0; k < 6; k++) pushColor(rectCol, r, g, b, alpha);
    },
    text(value: string, x: number, y: number, r: number, g: number, b: number, alpha: number): void {
      // the engine anchors the label at baseline-middle (x = left edge, y = vertical center).
      const entry = labelTexture(value, r, g, b, alpha);
      if (!entry) return; // no 2D context (headless without a document) — nothing to draw
      const sprite = acquireLabel();
      const mat = sprite.material as SpriteMaterial;
      if (mat.map !== entry.texture) {
        mat.map = entry.texture;
        mat.needsUpdate = true;
      }
      sprite.visible = true;

      // scale the sprite to the label's world size (CSS px → world via the projection's scale) and
      // position its CENTER — the engine's anchor is the left/middle, so nudge right by half a width.
      // Derive the field-px→world scale from the projection itself (no projection-type coupling):
      // project the label's left and right edges, and its top/bottom, and take the world deltas. This
      // stays correct for any FieldProjection, and sizes the sprite to the same footprint as the plate.
      projection.toWorld(x, y, 0, 0, 0, _v); // left edge, vertical center
      projection.toWorld(x + entry.widthPx, y, 0, 0, 0, _v2); // right edge
      const wWorld = _v.distanceTo(_v2);
      projection.toWorld(x, y - LABEL_PX_HEIGHT, 0, 0, 0, _v2); // one label-height up
      const hWorld = _v.distanceTo(_v2);
      sprite.scale.set(wWorld || 1e-4, hWorld || 1e-4, 1);
      // position the sprite's CENTER; the engine anchors at the left edge / vertical middle, so nudge
      // right by half the label width. z is the same offset off the projected plane as line/rect,
      // so labels register with their chip plates under any projection (centered volumes included).
      projection.toWorld(x + entry.widthPx / 2, y, 0, 0, 0, _v);
      sprite.position.set(_v.x, _v.y, _v.z + z);
    },
    measureText(value: string): number {
      if (metrics) {
        metrics.font = CHIP_FONT;
        return metrics.measureText(value).width;
      }
      return value.length * 6; // coarse fallback when no 2D context is available
    },
    dispose(): void {
      lineGeom.dispose();
      rectGeom.dispose();
      (lines.material as LineBasicMaterial).dispose();
      (rects.material as MeshBasicMaterial).dispose();
      for (const sprite of labelPool) (sprite.material as SpriteMaterial).dispose();
      for (const { texture } of labelCache.values()) texture.dispose();
      labelCache.clear();
      labelPool.length = 0;
    },
  };
}
