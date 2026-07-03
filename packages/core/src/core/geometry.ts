/**
 * Shaped-source geometry (field-systems plan, Stage A).
 *
 * A body is not a point. These pure helpers derive the geometry a shaped source needs
 * from the rect we already measure each frame: the nearest point on the element's box
 * (so matter shells the shape instead of collapsing to its centre), the signed distance
 * to the box (negative inside), and the two poles of a dipole laid along the body's
 * heading (so `magnetism`/`charge` can draw and act as real N→S / +→− fields).
 *
 * Nothing here touches particles or velocity. Stage B (the field-line render) and Stage C
 * (shaped force sampling) consume these; this stage is groundwork with golden tests.
 */
import type { Vec2 } from './types.ts';
import { clamp } from './math.ts';

/** Guard against divide-by-zero when sampling a field at a pole (1px, sub-pixel). */
export const EPS = 1;

/** An axis-aligned box: centre + half-extents. The force-facing subset of `Body`. */
export interface Rect {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
}

/** A box plus its heading and polarity — what `polePair` reads off a `Body`. */
export interface AxisRect extends Rect {
  /** unit heading (cos θ, sin θ) from `data-angle`. */
  ux: number;
  uy: number;
  /** polarity sign; which end carries the + / N pole. */
  spin: number;
}

/** One pole of a dipole: a position and a signed charge (±1). */
export interface Pole {
  x: number;
  y: number;
  q: number;
}

/**
 * The nearest point of the filled box to `(px, py)`. Outside the box this is the closest
 * boundary point; inside, it is the point itself (the box is solid, so distance is zero).
 * Shaped attract/gravity pull toward this instead of the centre, so matter gathers in a
 * shell around the element rather than a blob at its middle.
 */
export function nearestOnRect(px: number, py: number, r: Rect): Vec2 {
  return {
    x: clamp(px, r.cx - r.hw, r.cx + r.hw),
    y: clamp(py, r.cy - r.hh, r.cy + r.hh),
  };
}

/**
 * Signed distance from `(px, py)` to the box: negative inside, zero on the edge, positive
 * outside (the standard 2D box SDF). Falloffs key off this so the field references the
 * element's surface, not an arbitrary centre distance.
 */
export function sdfRect(px: number, py: number, r: Rect): number {
  const dx = Math.abs(px - r.cx) - r.hw;
  const dy = Math.abs(py - r.cy) - r.hh;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside;
}

/**
 * The two poles of the body's dipole, laid on its heading axis at the box edge. The `+`
 * (N) pole sits at the `+(ux, uy)` end, the `−` (S) pole at the other; `spin < 0` swaps
 * them. `reach` is the centre-to-edge distance along the heading (the ray/box exit), so a
 * wide element makes a long magnet and a tall one a short, fat magnet. Strength is applied
 * by the consumer (`field()`), not here — this returns geometry and polarity only.
 */
export function polePair(b: AxisRect): [Pole, Pole] {
  const tx = b.ux !== 0 ? b.hw / Math.abs(b.ux) : Infinity;
  const ty = b.uy !== 0 ? b.hh / Math.abs(b.uy) : Infinity;
  const reach = Math.min(tx, ty); // centre → box edge along the heading
  const ax = b.ux * reach;
  const ay = b.uy * reach;
  const s = b.spin < 0 ? -1 : 1;
  return [
    { x: b.cx + ax, y: b.cy + ay, q: s },
    { x: b.cx - ax, y: b.cy - ay, q: -s },
  ];
}

/**
 * The in-plane field of a set of poles at `(x, y)`: the superposition of each pole's
 * radial `q/d²` monopole field (away from `+`, toward `−`). For the two poles of a body
 * this is the classic dipole, whose streamlines are the bar-magnet (N→S) and
 * electric-dipole (+→−) field-line diagrams. `EPS` floors the distance at a pole so the
 * sample never divides by zero. Direction carries the geometry; magnitude (scaled by the
 * body's strength downstream) sets line density and the tracer's min-strength cutoff.
 */
export function dipoleField(poles: readonly Pole[], x: number, y: number): Vec2 {
  let fx = 0;
  let fy = 0;
  for (const p of poles) {
    const dx = x - p.x;
    const dy = y - p.y;
    const d = Math.max(EPS, Math.hypot(dx, dy));
    const k = p.q / (d * d); // radial monopole, 1/d² falloff
    fx += (dx / d) * k;
    fy += (dy / d) * k;
  }
  return { x: fx, y: fy };
}

/**
 * The radial monopole field of a single point charge at `(cx, cy)` sampled at `(x, y)`:
 * `E = sgn · s · r̂ / (d² + …)`, straight field lines OUT of a `+` source (`sign ≥ 0`) and
 * IN to a `−`. This is the one formula the electric-charge force radiates (`charge.field`
 * via `bodyMonopole`) AND the charge-stage field-line diagram traces — so the diagram is
 * the engine's real field, not a hand-rolled stand-in. `EPS` floors the distance at the
 * core so the sample never divides by zero.
 */
export function monopoleField(
  cx: number,
  cy: number,
  sign: number,
  s: number,
  x: number,
  y: number,
): Vec2 {
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.max(EPS, Math.hypot(dx, dy));
  const sgn = sign < 0 ? -1 : 1;
  const mag = (sgn * s) / (d * d); // 1/d², signed by polarity
  return { x: (dx / d) * mag, y: (dy / d) * mag };
}
