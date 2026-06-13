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
 * Scope: the line + rect primitives — i.e. every field-structure overlay — render fully. Text
 * labels (the `data` reading's numeric chips) are not yet drawn; `measureText` is honored so the
 * plates size correctly, and label sprites are a tracked follow-up. The line overlays need no text.
 */

import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import type { RenderBackend, Stroke } from '@fundamental-engine/core';
import type { FieldProjection } from './project.ts';

const _v = new Vector3();

export interface ThreeBackendOptions {
  /** the 2D↔3D mapping (share the one your `FieldLayer` uses so overlay and swarm align). */
  projection: FieldProjection;
  /** world-space `z` the overlay draws at — put it just in front of a flat field (default 0.01). */
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

  const object = new Group();
  object.add(lines, rects);

  const metrics = metricsContext();

  /** map a CSS-pixel point to the overlay plane and push xyz onto `arr` (overlay owns its own z). */
  function pushPoint(arr: number[], x: number, y: number): void {
    projection.toWorld(x, y, 0, 0, 0, _v); // z/heat/size irrelevant — the overlay draws at a fixed plane
    arr.push(_v.x, _v.y, z);
  }
  /** premultiplied 0..1 rgb (additive compositing turns alpha into intensity). */
  function pushColor(arr: number[], r: number, g: number, b: number, a: number): void {
    arr.push((r / 255) * a, (g / 255) * a, (b / 255) * a);
  }

  function flush(): void {
    lineGeom.setAttribute('position', new Float32BufferAttribute(Float32Array.from(linePos), 3));
    lineGeom.setAttribute('color', new Float32BufferAttribute(Float32Array.from(lineCol), 3));
    lineGeom.setDrawRange(0, linePos.length / 3);
    rectGeom.setAttribute('position', new Float32BufferAttribute(Float32Array.from(rectPos), 3));
    rectGeom.setAttribute('color', new Float32BufferAttribute(Float32Array.from(rectCol), 3));
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
    text(): void {
      // label sprites are a tracked follow-up; the line overlays need no text, and the chip plate
      // (rect) still renders. measureText is honored so plate sizing stays correct.
    },
    measureText(value: string): number {
      if (metrics) {
        metrics.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
        return metrics.measureText(value).width;
      }
      return value.length * 6; // coarse fallback when no 2D context is available
    },
    dispose(): void {
      lineGeom.dispose();
      rectGeom.dispose();
      (lines.material as LineBasicMaterial).dispose();
      (rects.material as MeshBasicMaterial).dispose();
    },
  };
}
