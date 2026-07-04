/**
 * Potential & scalar-field diagnostics (visualization-methods-taxonomy §6). The scalar potential a
 * body radiates (`Φ = -s / sqrt(d² + ε²)`), and a generic grid sampler that turns any scalar field
 * into a value grid for contour / potential / heatmap rendering. Pure; reads no live state.
 */
import type { Body } from '../engine/types.ts';

const EPS = 6; // softening, matches the engine's Plummer-style core

/**
 * The scalar potential of a body at a world point. `gravity` is an attractive well (Φ < 0, deeper
 * toward the mass); `charge` is signed by polarity. `s` defaults to the body's `M`.
 */
export function potentialAt(b: Body, x: number, y: number, kind: 'gravity' | 'charge' = 'gravity'): number {
  const dx = x - b.cx;
  const dy = y - b.cy;
  const d = Math.sqrt(dx * dx + dy * dy + EPS * EPS);
  const s = b.M || b.strength || 1;
  const sign = kind === 'charge' ? (b.spin < 0 ? -1 : 1) : -1; // gravity always attractive
  return (sign * s) / d;
}

/** The summed potential of many bodies at a point. */
export function netPotentialAt(bodies: readonly Body[], x: number, y: number, kind: 'gravity' | 'charge' = 'gravity'): number {
  let phi = 0;
  for (const b of bodies) phi += potentialAt(b, x, y, kind);
  return phi;
}

export interface ScalarGridData {
  width: number;
  height: number;
  /** cell size in px. */
  resolution: number;
  cols: number;
  rows: number;
  values: Float32Array;
  min: number;
  max: number;
}

/**
 * Sample any scalar field `f(x, y)` onto a grid — the data a contour/potential layer renders from
 * (e.g. marching squares over `values`). Pure.
 */
export function sampleScalarGrid(
  f: (x: number, y: number) => number,
  width: number,
  height: number,
  resolution = 16,
): ScalarGridData {
  const cols = Math.max(1, Math.ceil(width / resolution));
  const rows = Math.max(1, Math.ceil(height / resolution));
  const values = new Float32Array(cols * rows);
  let min = Infinity;
  let max = -Infinity;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = f(c * resolution, r * resolution);
      values[r * cols + c] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return { width, height, resolution, cols, rows, values, min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max };
}
