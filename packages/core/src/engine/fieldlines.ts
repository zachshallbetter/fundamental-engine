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
import { polePair, type AxisRect, type Pole } from '../math/geometry.ts';

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
  /**
   * Turning budget, in full revolutions: stop once the line's cumulative heading change
   * exceeds this. A line orbiting a pole that never passes back through its *seed* (so
   * `loopDist` can't close it) otherwise winds the same circle for the whole step budget
   * — hundreds of overlapping segments that waste the trace and, on renderers whose
   * antialiaser computes path self-intersections, explode stroke cost superlinearly
   * (measured at ~3 s/frame in the Swift CoreGraphics renderer before this guard).
   * `Infinity` (the default) preserves the unbounded behavior; renderers tracing dipole
   * fields should pass ~1.5 (one closed loop plus slack — a closed dipole line turns
   * exactly one revolution).
   */
  maxTurns?: number;
}

const DEFAULTS: Required<Omit<FieldLineOpts, 'bounds'>> = {
  step: 6,
  maxSteps: 400,
  // near-zero: field magnitudes span orders of magnitude across forces (magnetism ~0.15,
  // charge M ~80), so this stops only true dead zones (saddles) and NaN, not weak-but-live
  // field. Line length is bounded by maxSteps and bounds, not by an absolute threshold.
  minStrength: 1e-9,
  loopDist: 6,
  maxTurns: Infinity,
};

/** Trace one direction (`dir = +1` downstream, `−1` upstream) from a seed. */
function traceOne(sample: FieldSample, sx: number, sy: number, dir: 1 | -1, o: Required<FieldLineOpts>): Pt[] {
  const pts: Pt[] = [{ x: sx, y: sy }];
  let x = sx;
  let y = sy;
  const m = o.step; // out-of-bounds margin
  const turnBudget = o.maxTurns * 2 * Math.PI;
  let prevUx = 0;
  let prevUy = 0;
  let turned = 0;
  for (let i = 0; i < o.maxSteps; i++) {
    const f = sample(x, y);
    const mag = Math.hypot(f.x, f.y);
    if (!(mag >= o.minStrength)) break; // below threshold or NaN → the line ends
    const ux = (f.x / mag) * dir;
    const uy = (f.y / mag) * dir;
    if (Number.isFinite(turnBudget)) {
      if (prevUx !== 0 || prevUy !== 0) {
        const dot = Math.max(-1, Math.min(1, ux * prevUx + uy * prevUy));
        turned += Math.acos(dot);
        if (turned > turnBudget) break; // wound past the budget → an orbit, stop
      }
      prevUx = ux;
      prevUy = uy;
    }
    x += ux * o.step;
    y += uy * o.step;
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


// MARK: - Field-line seeds (extracted from apps/site field-probe `traceDipole`)
//
// WHERE to start tracing so the diagram is the correct STRUCTURE, not arbitrary rings.
// A field line is seeded by the body's own field geometry:
//
//   · DIPOLE (magnetism) — seeds along the perpendicular bisector of the heading axis:
//     the centre plus ring offsets either side. Each offset lies on a distinct nested
//     field line, so tracing both directions closes one clean N→S loop per seed: the
//     bar-magnet diagram.
//   · MONOPOLE (charge / gravity) — a tight ring around the core → radial spokes (out of
//     a + source, into a −; inward for gravity).
//
// Pure: the canonical home of the seeding algorithm, so every consumer (the site's force
// chips, the native renderers, any future bridge) shares one definition.

/** A body's field geometry, the input the seed generators read. */
export interface SeedBody {
  cx: number;
  cy: number;
  /** half-extents (the box that lays the dipole axis). */
  hw: number;
  hh: number;
  /** unit heading (cos θ, sin θ). */
  ux: number;
  uy: number;
  /** polarity sign (which end is the + / N pole). */
  spin: number;
  /** influence radius — the synthesized-dipole fallback keys off it. */
  range: number;
}

/** px below which the box gives no usable dipole axis (mirrors `bodyDipole`). */
const DIPOLE_MIN_SEP = 8;
/** synthesized-pole reach floor (covers point / range-0 bodies). */
const DIPOLE_MIN_REACH = 60;

/**
 * Dipole seeds: the centre plus `rings` offsets either side of the heading's
 * perpendicular bisector. Uses the same synthesized-pole fallback the field math
 * (`bodyDipole`) uses, so a near-point body still reads as a full dipole.
 */
export function dipoleSeeds(b: SeedBody, rings = 8): Pt[] {
  const axis: AxisRect = { cx: b.cx, cy: b.cy, hw: b.hw, hh: b.hh, ux: b.ux, uy: b.uy, spin: b.spin };
  let poles = polePair(axis);
  let sep = Math.hypot(poles[0].x - poles[1].x, poles[0].y - poles[1].y);
  if (sep < Math.max(b.range * 0.06, DIPOLE_MIN_SEP)) {
    const half = Math.max(b.range * 0.18, DIPOLE_MIN_REACH);
    const sgn = b.spin < 0 ? -1 : 1;
    poles = [
      { x: b.cx + b.ux * half, y: b.cy + b.uy * half, q: sgn },
      { x: b.cx - b.ux * half, y: b.cy - b.uy * half, q: -sgn },
    ] as [Pole, Pole];
    sep = Math.hypot(poles[0].x - poles[1].x, poles[0].y - poles[1].y);
  }
  // the unit perpendicular to the heading
  const perpx = -b.uy;
  const perpy = b.ux;
  const spacing = Math.max(sep * 0.13, 18);
  const seeds: Pt[] = [{ x: b.cx, y: b.cy }]; // the central axial line through both poles
  for (let i = 1; i <= rings; i++) {
    const off = i * spacing;
    seeds.push({ x: b.cx + perpx * off, y: b.cy + perpy * off });
    seeds.push({ x: b.cx - perpx * off, y: b.cy - perpy * off });
  }
  return seeds;
}

/** Monopole seeds: a tight ring close to the core → radial spokes. */
export function monopoleSeeds(b: SeedBody, count = 18): Pt[] {
  const r0 = Math.max(Math.min(b.hw, b.hh) * 0.8, 24);
  const seeds: Pt[] = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    seeds.push({ x: b.cx + Math.cos(a) * r0, y: b.cy + Math.sin(a) * r0 });
  }
  return seeds;
}
