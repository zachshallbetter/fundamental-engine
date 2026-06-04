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
