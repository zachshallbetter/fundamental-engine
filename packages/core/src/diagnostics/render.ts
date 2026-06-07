/**
 * Diagnostic overlay rendering (visualization-methods-taxonomy §3, §6, §7, §11). Draws the pure
 * diagnostic data (force vectors, contours, potential, energy) onto a Canvas 2D context. The
 * marching-squares contour extraction is pure and testable; the `draw*` helpers are thin context
 * calls. These reveal state — they read, never mutate physics.
 */
import type { Body, Particle, Force } from '../core/types.ts';
import type { ScalarGridData } from './potential.ts';
import { sampleScalarGrid } from './potential.ts';
import { forceVectorAt, type Probe, PROBE_PRESETS } from './probes.ts';
import type { EnergyReport } from './energy.ts';

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Marching-squares isolines for one level over a scalar grid → line segments in pixel space. Pure.
 * (Saddle cells are split into two segments by edge order — good enough for diagnostic contours.)
 */
function levelSegments(grid: ScalarGridData, level: number): Segment[] {
  const { cols, rows, resolution: res, values } = grid;
  const at = (c: number, r: number): number => values[r * cols + c] ?? 0;
  const segs: Segment[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const tl = at(c, r);
      const tr = at(c + 1, r);
      const bl = at(c, r + 1);
      const br = at(c + 1, r + 1);
      const pts: { x: number; y: number }[] = [];
      const cross = (a: number, b: number) => (level - a) / (b - a);
      if (tl < level !== tr < level) pts.push({ x: (c + cross(tl, tr)) * res, y: r * res }); // top
      if (tr < level !== br < level) pts.push({ x: (c + 1) * res, y: (r + cross(tr, br)) * res }); // right
      if (bl < level !== br < level) pts.push({ x: (c + cross(bl, br)) * res, y: (r + 1) * res }); // bottom
      if (tl < level !== bl < level) pts.push({ x: c * res, y: (r + cross(tl, bl)) * res }); // left
      if (pts.length === 2) segs.push({ x1: pts[0]!.x, y1: pts[0]!.y, x2: pts[1]!.x, y2: pts[1]!.y });
      else if (pts.length === 4) {
        segs.push({ x1: pts[0]!.x, y1: pts[0]!.y, x2: pts[1]!.x, y2: pts[1]!.y });
        segs.push({ x1: pts[2]!.x, y1: pts[2]!.y, x2: pts[3]!.x, y2: pts[3]!.y });
      }
    }
  }
  return segs;
}

/** All isoline segments for a set of levels (evenly spaced if `levels` is a count). Pure. */
export function contourSegments(grid: ScalarGridData, levels: number[] | number = 8): Segment[] {
  const list =
    typeof levels === 'number'
      ? Array.from({ length: levels }, (_, i) => grid.min + ((i + 1) / (levels + 1)) * (grid.max - grid.min))
      : levels;
  return list.flatMap((l) => levelSegments(grid, l));
}

type Ctx = CanvasRenderingContext2D;

function arrow(ctx: Ctx, x: number, y: number, dx: number, dy: number, head = 4): void {
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  const a = Math.atan2(dy, dx);
  ctx.lineTo(x + dx - head * Math.cos(a - 0.4), y + dy - head * Math.sin(a - 0.4));
  ctx.moveTo(x + dx, y + dy);
  ctx.lineTo(x + dx - head * Math.cos(a + 0.4), y + dy - head * Math.sin(a + 0.4));
  ctx.stroke();
}

/** Draw contour isolines of a scalar grid. */
export function drawContours(ctx: Ctx, grid: ScalarGridData, opts: { levels?: number; color?: string } = {}): void {
  ctx.save();
  ctx.strokeStyle = opts.color ?? 'rgba(77,163,255,0.5)';
  ctx.lineWidth = 1;
  for (const s of contourSegments(grid, opts.levels ?? 8)) {
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw a body's potential field as soft shaded wells (normalized grid → alpha). */
export function drawPotential(ctx: Ctx, grid: ScalarGridData, opts: { color?: string } = {}): void {
  const span = grid.max - grid.min || 1;
  ctx.save();
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const n = ((grid.values[r * grid.cols + c] ?? 0) - grid.min) / span;
      ctx.fillStyle = (opts.color ?? 'rgba(77,163,255,A)').replace('A', (n * 0.5).toFixed(3));
      ctx.fillRect(c * grid.resolution, r * grid.resolution, grid.resolution, grid.resolution);
    }
  }
  ctx.restore();
}

/** Draw a force's vector field by probing it on a grid (viz §3 — uses a probe, §4). */
export function drawForceVectors(
  ctx: Ctx,
  force: Force,
  body: Body,
  W: number,
  H: number,
  opts: { spacing?: number; probe?: Probe; scale?: number; color?: string } = {},
): void {
  const spacing = opts.spacing ?? 36;
  const scale = opts.scale ?? 6;
  ctx.save();
  ctx.strokeStyle = opts.color ?? 'rgba(45,212,191,0.7)';
  ctx.lineWidth = 1;
  for (let y = spacing / 2; y < H; y += spacing) {
    for (let x = spacing / 2; x < W; x += spacing) {
      const v = forceVectorAt(force, body, x, y, opts.probe ?? PROBE_PRESETS.neutral!);
      arrow(ctx, x, y, v.x * scale, v.y * scale);
    }
  }
  ctx.restore();
}

/** Draw per-particle velocity vectors. */
export function drawVelocityVectors(ctx: Ctx, particles: readonly Particle[], opts: { scale?: number; color?: string } = {}): void {
  const scale = opts.scale ?? 3;
  ctx.save();
  ctx.strokeStyle = opts.color ?? 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  for (const p of particles) arrow(ctx, p.x, p.y, p.vx * scale, p.vy * scale);
  ctx.restore();
}

/** Draw a compact kinetic/thermal/total energy bar. */
export function drawEnergyBar(ctx: Ctx, report: EnergyReport, opts: { x?: number; y?: number; w?: number } = {}): void {
  const x = opts.x ?? 12;
  const y = opts.y ?? 12;
  const w = opts.w ?? 160;
  const total = report.total || 1;
  const rows: [string, number, string][] = [
    ['K', report.kinetic / total, '#4da3ff'],
    ['T', report.thermal / total, '#f0883e'],
  ];
  ctx.save();
  ctx.font = '11px ui-monospace, monospace';
  rows.forEach(([label, frac, color], i) => {
    const yy = y + i * 16;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(label, x, yy + 9);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x + 16, yy, w, 10);
    ctx.fillStyle = color;
    ctx.fillRect(x + 16, yy, w * Math.min(1, frac), 10);
  });
  ctx.restore();
}

export { sampleScalarGrid };
