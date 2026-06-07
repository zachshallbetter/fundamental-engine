/**
 * Heatmap-variant samplers (visualization-methods-taxonomy §5). The engine ships the density
 * heatmap; these are the per-particle samplers + a pure grid accumulator for the other documented
 * variants (heat, velocity). A heatmap is a scalar buffer — pick what each particle deposits.
 */
import type { Particle } from '../core/types.ts';

export type HeatmapKind = 'density' | 'heat' | 'velocity';

/** What each particle deposits, per heatmap kind. */
export const HEATMAP_SAMPLERS: Readonly<Record<HeatmapKind, (p: Particle) => number>> = {
  density: () => 1,
  heat: (p) => p.heat,
  velocity: (p) => Math.hypot(p.vx, p.vy),
};

export interface HeatmapGrid {
  cols: number;
  rows: number;
  resolution: number;
  values: Float32Array;
  /** running peak, for [0,1] normalization. */
  peak: number;
}

/**
 * Accumulate a per-particle scalar (chosen by `kind`) onto a coarse grid — a heatmap variant. Each
 * particle deposits into its cell; `peak` normalizes the render. Pure.
 */
export function accumulateHeatmap(
  particles: readonly Particle[],
  kind: HeatmapKind,
  width: number,
  height: number,
  resolution = 8,
): HeatmapGrid {
  const cols = Math.max(1, Math.ceil(width / resolution));
  const rows = Math.max(1, Math.ceil(height / resolution));
  const values = new Float32Array(cols * rows);
  const sample = HEATMAP_SAMPLERS[kind];
  let peak = 0;
  for (const p of particles) {
    if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height) continue;
    const c = Math.min(cols - 1, Math.floor(p.x / resolution));
    const r = Math.min(rows - 1, Math.floor(p.y / resolution));
    const i = r * cols + c;
    const v = (values[i] ?? 0) + sample(p);
    values[i] = v;
    if (v > peak) peak = v;
  }
  return { cols, rows, resolution, values, peak };
}
