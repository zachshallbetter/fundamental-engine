import type { RGB } from '../math/math.ts';

/** Opacity of a particle↔particle link by separation (§20.6 links mode). */
export function linkAlpha(d: number, r: number, max = 0.12): number {
  if (d >= r) return 0;
  return (1 - d / r) * max;
}

// ── Metaballs (§20.6) — marching squares over a particle density field ──────────
//
// The field is sampled to a coarse scalar grid (each particle splats a smooth kernel
// onto nearby nodes); a single iso-contour of that grid is then traced cell-by-cell
// with marching squares, so a swarm renders as a single liquid skin instead of dots.
// The contour tracing is pure geometry — extracted here so it can be golden-tested.

/** A line segment in cell-local coordinates ([0,1]², origin top-left, +y down). */
export interface IsoSeg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * The fractional crossing of the iso level between two corner values `a → b`.
 * Linear interpolation `t = (iso − a)/(b − a)`, clamped to [0,1]; `0.5` if flat.
 */
export function isoCross(a: number, b: number, iso: number): number {
  if (a === b) return 0.5;
  const t = (iso - a) / (b - a);
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * Marching-squares contour for one cell (§20.6 metaballs). Given the densities at the
 * four corners — `tl, tr, br, bl` (clockwise from top-left) — and the iso `level`,
 * return the 0–2 line segments where the iso-contour crosses the cell's edges, in
 * cell-local [0,1]² coordinates. The two ambiguous saddle cases (5, 10) are resolved
 * the conventional way (two separate segments).
 */
const NO_SEGS: readonly IsoSeg[] = Object.freeze([]);
export function marchingCell(tl: number, tr: number, br: number, bl: number, level: number): readonly IsoSeg[] {
  // edge crossing points (only the ones a case uses are read)
  const T = { x: isoCross(tl, tr, level), y: 0 }; // top edge tl→tr
  const R = { x: 1, y: isoCross(tr, br, level) }; // right edge tr→br
  const B = { x: isoCross(bl, br, level), y: 1 }; // bottom edge bl→br
  const L = { x: 0, y: isoCross(tl, bl, level) }; // left edge tl→bl
  const seg = (a: { x: number; y: number }, b: { x: number; y: number }): IsoSeg => ({
    x1: a.x,
    y1: a.y,
    x2: b.x,
    y2: b.y,
  });
  // case index: one bit per corner above the level (tl=8, tr=4, br=2, bl=1)
  const c = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0);
  switch (c) {
    case 0:
    case 15:
      return NO_SEGS;
    case 1:
    case 14:
      return [seg(L, B)];
    case 2:
    case 13:
      return [seg(B, R)];
    case 3:
    case 12:
      return [seg(L, R)];
    case 4:
    case 11:
      return [seg(T, R)];
    case 6:
    case 9:
      return [seg(T, B)];
    case 7:
    case 8:
      return [seg(L, T)];
    case 5: // tr & bl above — saddle
      return [seg(L, T), seg(B, R)];
    case 10: // tl & br above — saddle
      return [seg(L, B), seg(T, R)];
    default:
      return NO_SEGS;
  }
}

/**
 * Splat one particle's smooth density kernel onto a scalar grid (additive). `grid` is a
 * row-major `cols × rows` Float array of node densities at world `(gx·step, gy·step)`;
 * each particle contributes `(1 − d/radius)²` to every node within `radius`. Returns the
 * peak single-node contribution it wrote (handy for tests). Pure — no rendering.
 */
export function splatDensity(
  grid: Float32Array,
  cols: number,
  rows: number,
  step: number,
  px: number,
  py: number,
  radius: number,
  weight = 1,
): void {
  if (radius <= 0) return;
  const gx0 = Math.max(0, Math.floor((px - radius) / step));
  const gx1 = Math.min(cols - 1, Math.ceil((px + radius) / step));
  const gy0 = Math.max(0, Math.floor((py - radius) / step));
  const gy1 = Math.min(rows - 1, Math.ceil((py + radius) / step));
  const r2 = radius * radius;
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const dx = gx * step - px;
      const dy = gy * step - py;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r2) continue;
      const f = 1 - Math.sqrt(d2) / radius;
      const idx = gy * cols + gx;
      grid[idx] = grid[idx]! + weight * f * f;
    }
  }
}

// ── Voronoi (§20.6) — nearest-site cells over the particle field ────────────────
//
// Each grid node is assigned the index of its nearest particle (its "owner"); cell
// walls are then the boundaries between adjacent nodes with different owners. The
// shattered-glass look without a full Delaunay triangulation. Both halves are pure
// and golden-tested; the renderer feeds owners from the spatial hash.

/** Index of the nearest site to `(x, y)`, or `-1` if `sites` is empty. */
export function nearestSite(x: number, y: number, sites: readonly { x: number; y: number }[]): number {
  let best = -1;
  let bestD2 = Infinity;
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i]!;
    const dx = s.x - x;
    const dy = s.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best;
}

/** A wall segment between two Voronoi cells, in grid-node units (×step at draw time). */
export interface GridSeg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// ── Knockout (§20.6 / #667) — figure-ground inversion: the field is the sheet ───────
//
// The knockout mode paints the field as a solid accent wash and draws matter as NEGATIVE
// space: each particle erases (`destination-out`) a feathered hole through everything
// beneath it, so the swarm reads as punched-out absence rather than glowing presence — the
// print-knockout treatment. §11-safe by construction: matter never assembles into
// letterforms. For the "field visible only inside letters" treatment the HOST clips the
// canvas to real type with a CSS mask/clip-path — the type stays type, the field shows
// through it.

/**
 * Radius of the hole a particle punches through the knockout wash (§20.6 knockout).
 * Scales with the particle's draw size, breathes with heat, and recedes with the depth
 * factor `zk` (exactly 1 in a flat field); floored at 2 px so matter always reads.
 */
export function knockoutHoleRadius(size: number, heat: number, zk = 1): number {
  const r = (size * 2.6 + heat * 2.5) * zk;
  return r < 2 ? 2 : r;
}

// ── Redshift (§20.6 / #668) — Doppler + gravitational spectral tint ─────────────────
//
// The dots geometry tinted by SPECTRAL SHIFT instead of the heat ramp: the Doppler term
// reads each particle's radial velocity against an observer at the viewport centre
// (receding reds, approaching blues, normalized by the unit system's velocity cap `env.c`),
// and the gravitational term reads proximity to body wells — light climbing out of a well
// loses energy, so a well only ever reddens. The §20.6 "relativistic accretion-disk" look.

/**
 * Signed radial velocity of a particle at `(px, py)` moving `(vx, vy)`, relative to an
 * observer at `(ox, oy)`: positive = receding, negative = approaching, 0 at the observer.
 */
export function radialVelocity(px: number, py: number, vx: number, vy: number, ox: number, oy: number): number {
  const dx = px - ox;
  const dy = py - oy;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return 0;
  return (dx * vx + dy * vy) / d;
}

/**
 * Doppler shift factor for a radial velocity `vr`, normalized by the unit system's
 * velocity cap `c` (§20.10): `vr / (0.35·c)` clamped to [−1, 1]. The 0.35 gain puts
 * typical field speeds (a few px/frame against c = 12) on a readable spectral scale.
 */
export function dopplerShift(vr: number, c: number): number {
  if (c <= 0) return 0;
  const s = vr / (0.35 * c);
  return s < -1 ? -1 : s > 1 ? 1 : s;
}

/**
 * Gravitational well weight at squared distance `d2` inside a body of squared range `r2`:
 * 1 at the core → 0 at the range edge (linear in distance), 0 outside or for no range.
 */
export function wellWeight(d2: number, r2: number): number {
  if (r2 <= 0 || d2 >= r2) return 0;
  return 1 - Math.sqrt(d2 / r2);
}

/**
 * The net spectral shift: the signed Doppler term plus the gravitational term (a well
 * only reddens — weighted 0.6 so a deep well reads without drowning motion), clamped to
 * [−1, 1]. −1 = full blueshift, 0 = at rest, +1 = full redshift.
 */
export function redshiftShift(doppler: number, well: number): number {
  const s = doppler + well * 0.6;
  return s < -1 ? -1 : s > 1 ? 1 : s;
}

const SHIFT_BLUE: RGB = [96, 160, 255]; // approaching
const SHIFT_REST: RGB = [226, 230, 240]; // at rest
const SHIFT_RED: RGB = [255, 72, 48]; // receding

/**
 * Spectral color for a shift ∈ [−1, 1]: blueshift → rest white → redshift, piecewise
 * linear through the rest point. Writes into a caller-owned `out` (zero allocation on
 * the draw path); returns `out`.
 */
export function redshiftRGBInto(out: RGB, s: number): RGB {
  const t = s < -1 ? -1 : s > 1 ? 1 : s;
  const from = t < 0 ? SHIFT_BLUE : SHIFT_REST;
  const to = t < 0 ? SHIFT_REST : SHIFT_RED;
  const k = t < 0 ? t + 1 : t;
  out[0] = from[0] + (to[0] - from[0]) * k;
  out[1] = from[1] + (to[1] - from[1]) * k;
  out[2] = from[2] + (to[2] - from[2]) * k;
  return out;
}

// ── Blackbody (§20.6 / #669) — energy on a thermal ramp ─────────────────────────────
//
// Each particle tinted by its ENERGY on a Planckian-ish ramp — near-black ember → deep
// red → orange → warm white → blue-white (≈1000 K → 10000 K) — with brightness rising
// with temperature, so cold matter barely glows and hot matter reads white. Energy =
// carried heat + kinetic (|v|² against a 0.3·c reference). Physics caveat canon applies:
// this is a *reading* of the designed unit system, not radiometry.

/**
 * Normalized blackbody temperature ∈ [0, 1] from a particle's velocity and carried heat.
 * Kinetic term saturates at `|v| = 0.3·c` (a particle at a third of the velocity cap is
 * already white-hot); heat and kinetic each contribute up to 0.55 and the sum clamps.
 */
export function blackbodyT(vx: number, vy: number, heat: number, c: number): number {
  const vref = 0.3 * c;
  const k = vref > 0 ? (vx * vx + vy * vy) / (vref * vref) : 0;
  const t = 0.55 * heat + 0.55 * (k > 1 ? 1 : k);
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** The thermal ramp stops, evenly spaced over t ∈ [0, 1] (≈1000 K → 10000 K). */
const BLACKBODY_STOPS: readonly RGB[] = [
  [12, 2, 0], // cold ember, nearly black
  [130, 24, 2], // deep red
  [235, 100, 10], // orange
  [255, 180, 90], // warm yellow
  [255, 236, 200], // warm white
  [201, 218, 255], // blue-white
];

/**
 * Blackbody color for a normalized temperature t ∈ [0, 1] — piecewise linear through
 * `BLACKBODY_STOPS`. Writes into a caller-owned `out` (zero allocation on the draw
 * path); returns `out`.
 */
export function blackbodyRGBInto(out: RGB, t: number): RGB {
  const tt = t < 0 ? 0 : t > 1 ? 1 : t;
  const scaled = tt * (BLACKBODY_STOPS.length - 1);
  const i = Math.min(Math.floor(scaled), BLACKBODY_STOPS.length - 2);
  const k = scaled - i;
  const from = BLACKBODY_STOPS[i]!;
  const to = BLACKBODY_STOPS[i + 1]!;
  out[0] = from[0] + (to[0] - from[0]) * k;
  out[1] = from[1] + (to[1] - from[1]) * k;
  out[2] = from[2] + (to[2] - from[2]) * k;
  return out;
}

// ── Depth (§20.6 / #670) — the z lane made visible (2.5D) ───────────────────────────
//
// Particles are sorted far-to-near (painter's algorithm, source-over so near matter
// occludes far), projected toward the viewport centre by a perspective scale (motion
// parallax emerges as z integrates), and defocused with distance — a soft halo plus a
// faded core, the cheap draw-time stand-in for blur (no `ctx.filter`, which costs a
// composited surface per particle). The z lane is symmetric about the page plane
// (z-axis.md — depth is |z|), so both directions recede; in a flat field every factor
// is exactly 1.

/**
 * Perspective scale for a particle at depth `|z|` with focal length `focal` (px):
 * 1 on the page plane, shrinking toward 0 as matter recedes into the volume.
 */
export function depthScale(z: number, focal: number): number {
  const az = z < 0 ? -z : z;
  return focal / (focal + az);
}

/** Project one axis value toward the projection `center` by the perspective `scale`. */
export function depthProject(v: number, center: number, scale: number): number {
  return center + (v - center) * scale;
}

/**
 * Depth-of-field alpha factor for a normalized depth `zn = |z|/depth` ∈ [0, 1]:
 * 1 on the page plane → 0.45 at the volume edge (the dots-mode recession constant).
 */
export function depthAlpha(zn: number): number {
  const z = zn < 0 ? 0 : zn > 1 ? 1 : zn;
  return 1 - 0.55 * z;
}

/**
 * Defocus halo radius (px) for a normalized depth `zn = |z|/depth` ∈ [0, 1] — 0 on the
 * focal plane, up to 4.5 px of extra soft halo at the volume edge.
 */
export function depthBlurRadius(zn: number): number {
  const z = zn < 0 ? 0 : zn > 1 ? 1 : zn;
  return 4.5 * z;
}

/**
 * The Voronoi cell walls of an owner grid (row-major `cols × rows` of site indices).
 * A wall sits on the shared edge between any two orthogonally-adjacent nodes whose
 * owners differ (an unowned node is `-1`); coordinates are in node units, so the
 * vertical wall between columns `gx` and `gx+1` lies at `x = gx + 0.5`.
 */
export function voronoiWalls(owners: ArrayLike<number>, cols: number, rows: number): GridSeg[] {
  const walls: GridSeg[] = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const o = owners[gy * cols + gx]!;
      if (gx + 1 < cols && owners[gy * cols + gx + 1] !== o) {
        // vertical wall on the edge shared with the right neighbour
        walls.push({ x1: gx + 0.5, y1: gy - 0.5, x2: gx + 0.5, y2: gy + 0.5 });
      }
      if (gy + 1 < rows && owners[(gy + 1) * cols + gx] !== o) {
        // horizontal wall on the edge shared with the bottom neighbour
        walls.push({ x1: gx - 0.5, y1: gy + 0.5, x2: gx + 0.5, y2: gy + 0.5 });
      }
    }
  }
  return walls;
}
