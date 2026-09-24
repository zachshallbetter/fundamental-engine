/**
 * NavGrid — obstacle-aware navigation and goal flow-fields (#439).
 *
 * Every force in this engine is **reactive**: it reads the local field and pushes. That is the right
 * model for matter, and the wrong one for an agent with somewhere to be. A reactive seeker walks into
 * the near side of a wall and stays there, because from where it stands the goal is *that way* — the
 * "rabbit stuck on the wrong side of the fence" that FieldKit worked around with barrier-avoidance
 * and stuck-repick. No local rule fixes it; the information needed (there is a way round, and it
 * starts by going the wrong way) is not local.
 *
 * So navigation is a separate subsystem, not another force:
 *
 * 1. an **occupancy grid** marks cells that cannot be entered — impassable, not merely repulsive;
 * 2. a **breadth-first sweep from the GOAL** fills every reachable cell with its distance to it;
 * 3. each cell's direction is the downhill step of that distance field.
 *
 * The sweep runs once per goal and serves every agent on the grid — that is what makes it a *flow
 * field* rather than a path. A thousand seekers cost one sweep, and none of them needs to know the
 * route; each reads the cell it is standing in.
 *
 * Pure and integer-deterministic: same dimensions, same obstacles, same goal, same grid on every
 * run and every plane.
 */
import type { Vec2 } from './types.ts';

/** Default cell size in field px. Small enough to fit a doorway, coarse enough that a full sweep of
 *  a 1920×1080 viewport is ~3.6k cells rather than two million. */
export const NAV_CELL = 24;

/** Distance value for a cell the sweep never reached — walled off, or outside the goal's region. */
export const NAV_UNREACHABLE = -1;

/** An axis-aligned impassable box, in field px. */
export interface NavObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NavGrid {
  /** cells across / down, and the size of one cell in px. */
  cols: number;
  rows: number;
  cell: number;
  /** `true` where the cell cannot be entered. Length `cols * rows`, row-major. */
  blocked: Uint8Array;
  /** steps to the goal, or {@link NAV_UNREACHABLE}. Filled by {@link navFlowField}. */
  dist: Int32Array;
  /** the goal cell index, or -1 when no goal has been set (or it fell inside an obstacle). */
  goal: number;
}

/**
 * Build an empty grid over `width × height` and mark every cell an obstacle touches.
 *
 * A cell is blocked if the obstacle overlaps it **at all**, which deliberately over-blocks by up to
 * a cell on each side: an agent has a body, and a route that grazes a wall by a pixel is a route it
 * cannot actually take. Under-blocking would produce paths that look right and stick.
 */
export function navGrid(width: number, height: number, obstacles: readonly NavObstacle[] = [], cell = NAV_CELL): NavGrid {
  const c = cell > 0 ? cell : NAV_CELL;
  const cols = Math.max(1, Math.ceil(width / c));
  const rows = Math.max(1, Math.ceil(height / c));
  const blocked = new Uint8Array(cols * rows);
  for (const o of obstacles) {
    if (!(o.width > 0) || !(o.height > 0)) continue;
    const x0 = Math.max(0, Math.floor(o.x / c));
    const y0 = Math.max(0, Math.floor(o.y / c));
    const x1 = Math.min(cols - 1, Math.ceil((o.x + o.width) / c) - 1);
    const y1 = Math.min(rows - 1, Math.ceil((o.y + o.height) / c) - 1);
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) blocked[gy * cols + gx] = 1;
  }
  return { cols, rows, cell: c, blocked, dist: new Int32Array(cols * rows).fill(NAV_UNREACHABLE), goal: -1 };
}

/** The cell index containing a point, or -1 when the point is off the grid. */
export function navCellAt(g: NavGrid, x: number, y: number): number {
  const gx = Math.floor(x / g.cell);
  const gy = Math.floor(y / g.cell);
  if (gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) return -1;
  return gy * g.cols + gx;
}

/**
 * Sweep outward from `(goalX, goalY)` and fill `dist` with each cell's distance to it, in steps.
 * Mutates and returns `g`.
 *
 * **Breadth-first, four-connected, from the goal.** Four-connected rather than eight because a
 * diagonal step between two blocked orthogonal neighbours squeezes through a seam no agent with a
 * body could pass — the corner-cutting bug that makes a flow field look correct and route into
 * geometry. Straight steps only means the paths are very slightly blockier and always takeable.
 *
 * A goal inside an obstacle leaves the field empty rather than seeding from a cell nothing can
 * reach: `goal` is set to -1 and every `navFlowAt` returns zero, so agents hold still instead of
 * drifting toward a destination that does not exist.
 */
export function navFlowField(g: NavGrid, goalX: number, goalY: number): NavGrid {
  g.dist.fill(NAV_UNREACHABLE);
  const start = navCellAt(g, goalX, goalY);
  g.goal = start >= 0 && !g.blocked[start] ? start : -1;
  if (g.goal < 0) return g;

  // A ring buffer sized to the grid: BFS enqueues each cell at most once, so it can never wrap.
  const queue = new Int32Array(g.cols * g.rows);
  let head = 0;
  let tail = 0;
  queue[tail++] = g.goal;
  g.dist[g.goal] = 0;

  while (head < tail) {
    const at = queue[head++]!;
    const d = g.dist[at]! + 1;
    const gx = at % g.cols;
    const gy = (at / g.cols) | 0;
    // west, east, north, south — bounds checked per axis so the row does not wrap around the edge
    if (gx > 0) { const n = at - 1; if (!g.blocked[n] && g.dist[n] === NAV_UNREACHABLE) { g.dist[n] = d; queue[tail++] = n; } }
    if (gx < g.cols - 1) { const n = at + 1; if (!g.blocked[n] && g.dist[n] === NAV_UNREACHABLE) { g.dist[n] = d; queue[tail++] = n; } }
    if (gy > 0) { const n = at - g.cols; if (!g.blocked[n] && g.dist[n] === NAV_UNREACHABLE) { g.dist[n] = d; queue[tail++] = n; } }
    if (gy < g.rows - 1) { const n = at + g.cols; if (!g.blocked[n] && g.dist[n] === NAV_UNREACHABLE) { g.dist[n] = d; queue[tail++] = n; } }
  }
  return g;
}

/**
 * The unit direction toward the goal at `(x, y)` — the downhill step of the distance field —
 * written into a caller-owned `out`.
 *
 * Zero when: there is no goal, the point is off the grid, the cell is blocked or unreachable, or the
 * cell IS the goal. Each of those is "stay put" rather than "go somewhere arbitrary", which matters
 * because an agent reading a garbage direction jitters rather than stops, and jitter reads as a bug.
 *
 * Diagonals are allowed HERE even though the sweep is four-connected: the direction is the sum of
 * every strictly-downhill neighbour, so an agent crossing open ground moves at an angle instead of
 * staircasing, while the distances it follows were only ever measured along passable straight steps.
 */
export function navFlowAtInto(out: Vec2, g: NavGrid, x: number, y: number): Vec2 {
  out.x = 0;
  out.y = 0;
  if (g.goal < 0) return out;
  const at = navCellAt(g, x, y);
  if (at < 0 || g.blocked[at] || g.dist[at] === NAV_UNREACHABLE || at === g.goal) return out;

  const here = g.dist[at]!;
  const gx = at % g.cols;
  const gy = (at / g.cols) | 0;
  let sx = 0;
  let sy = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = gx + dx;
      const ny = gy + dy;
      if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows) continue;
      const n = ny * g.cols + nx;
      if (g.blocked[n] || g.dist[n] === NAV_UNREACHABLE) continue;
      // STRICTLY downhill. Admitting level neighbours (`>` here) is not a correctness bug — every
      // route still arrives, and no cell becomes stuck — but it pulls the direction sideways along
      // plateaus, which are common in a BFS field. Measured against this exact code: 18% of
      // directions differ on open ground, 28% around a fence, 49% in a maze. No test in the suite
      // distinguishes the two, because both arrive; the justification is the invariant this keeps
      // and the loose form does not — every step lands on a cell strictly closer to the goal.
      if (g.dist[n]! >= here) continue;
      // No corner cutting, in the DIRECTION too (#439). The sweep is four-connected, so the
      // distances never squeeze a diagonal seam — but summing a diagonal neighbour can still aim a
      // step through the corner between two blocked orthogonals, and a body-having agent walks into
      // it. Measured: a walker clipped a fence at (253, 380) with this guard absent. A diagonal only
      // counts when both of its straight components are open, which is exactly the step an agent
      // could actually take.
      if (dx !== 0 && dy !== 0) {
        if (g.blocked[gy * g.cols + nx] || g.blocked[ny * g.cols + gx]) continue;
      }
      sx += dx;
      sy += dy;
    }
  }
  const mag = Math.hypot(sx, sy);
  if (!(mag > 0)) return out;
  out.x = sx / mag;
  out.y = sy / mag;
  return out;
}

/** Allocating convenience over {@link navFlowAtInto}. */
export function navFlowAt(g: NavGrid, x: number, y: number): Vec2 {
  return navFlowAtInto({ x: 0, y: 0 }, g, x, y);
}

/** Is `(x, y)` inside impassable geometry? The test a mover needs before committing to a step. */
export function navBlockedAt(g: NavGrid, x: number, y: number): boolean {
  const at = navCellAt(g, x, y);
  return at >= 0 && g.blocked[at] === 1;
}

/** Can the goal be reached from `(x, y)` at all? `false` for a sealed region — the honest answer to
 *  "why is my agent not moving", and the thing a consumer would otherwise diagnose as a stuck bug. */
export function navReachable(g: NavGrid, x: number, y: number): boolean {
  const at = navCellAt(g, x, y);
  return at >= 0 && g.dist[at] !== NAV_UNREACHABLE;
}
