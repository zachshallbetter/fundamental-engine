/**
 * Field-line tracing (field-systems plan, Stage B2).
 *
 * A field line is a streamline of a vector field: start at a seed and step along the
 * normalized field direction, tracing the curve a compass needle would follow. Tracing a
 * dipole field (geometry.dipoleField over a body's two poles) draws the bar-magnet (N→S)
 * and electric-dipole (+→−) diagrams. Pure and engine-agnostic: it takes a `sample(x, y)`
 * field function, so it works over one force's `field()`, a sum of many, or any vector
 * field at all.
 */
import type { Vec2 } from './types.ts';

export interface Pt {
  x: number;
  y: number;
}

/** A point sampler for the vector field being traced. */
export type FieldSample = (x: number, y: number) => Vec2;

export interface FieldLineOpts {
  /** px advanced per integration step. */
  step?: number;
  /** max steps in each direction from the seed. */
  maxSteps?: number;
  /** stop when the field magnitude drops below this (the line has run out into calm). */
  minStrength?: number;
  /** viewport; stop when the line leaves it by more than a step. Omit for unbounded. */
  bounds?: { w: number; h: number };
  /** stop when the line returns within this of its seed (a closed loop). */
  loopDist?: number;
}

const DEFAULTS: Required<Omit<FieldLineOpts, 'bounds'>> = {
  step: 6,
  maxSteps: 400,
  // near-zero: field magnitudes span orders of magnitude across forces (magnetism ~0.15,
  // charge M ~80), so this stops only true dead zones (saddles) and NaN, not weak-but-live
  // field. Line length is bounded by maxSteps and bounds, not by an absolute threshold.
  minStrength: 1e-9,
  loopDist: 6,
};

/** Trace one direction (`dir = +1` downstream, `−1` upstream) from a seed. */
function traceOne(sample: FieldSample, sx: number, sy: number, dir: 1 | -1, o: Required<FieldLineOpts>): Pt[] {
  const pts: Pt[] = [{ x: sx, y: sy }];
  let x = sx;
  let y = sy;
  const m = o.step; // out-of-bounds margin
  for (let i = 0; i < o.maxSteps; i++) {
    const f = sample(x, y);
    const mag = Math.hypot(f.x, f.y);
    if (!(mag >= o.minStrength)) break; // below threshold or NaN → the line ends
    x += (f.x / mag) * o.step * dir;
    y += (f.y / mag) * o.step * dir;
    if (o.bounds && (x < -m || y < -m || x > o.bounds.w + m || y > o.bounds.h + m)) break;
    if (i > 4 && Math.hypot(x - sx, y - sy) < o.loopDist) {
      pts.push({ x, y }); // closed loop → snap shut and stop
      break;
    }
    pts.push({ x, y });
  }
  return pts;
}

/**
 * Trace a full field line through a seed: upstream reversed, then downstream, so the seed
 * sits mid-line. Returns one polyline; a degenerate (zero-field) seed yields a single point.
 */
export function traceFieldLine(sample: FieldSample, sx: number, sy: number, opts: FieldLineOpts = {}): Pt[] {
  const o: Required<FieldLineOpts> = { ...DEFAULTS, bounds: opts.bounds as { w: number; h: number }, ...opts };
  const back = traceOne(sample, sx, sy, -1, o);
  const fwd = traceOne(sample, sx, sy, 1, o);
  back.reverse();
  back.pop(); // drop the duplicated seed shared with fwd[0]
  return back.concat(fwd);
}

/** Trace a field line from each seed point. Empty/degenerate lines are dropped. */
export function traceFieldLines(sample: FieldSample, seeds: readonly Pt[], opts: FieldLineOpts = {}): Pt[][] {
  return seeds.map((s) => traceFieldLine(sample, s.x, s.y, opts)).filter((line) => line.length > 1);
}

