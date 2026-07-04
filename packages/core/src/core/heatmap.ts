/**
 * Heatmaps (field-systems plan, H1) — a scalar field buffer that reveals where field state
 * accumulates, rendered as a diagnostic/ambient layer and sampled back into DOM. NOT a force:
 * it measures, it does not push (docs/engine-reference/forces-fields-plan.md, D5).
 *
 * H1 ships the **density** layer: each frame every particle deposits into a coarse grid that
 * decays and lightly blurs, so the buffer tracks where matter currently gathers. Values are
 * normalized to [0, 1] by an eased running peak, so the glow render and the
 * `--field-heatmap-density` write-back are stable and resolution-independent. Built on the
 * existing class-[C] `ScalarGridImpl`, the same buffer the diffuse/wave/memory forces use.
 */
import { ScalarGridImpl } from './scalar-grid.ts';
import { clamp } from '../math/math.ts';
import type { Particle, Vec2 } from './types.ts';

const CELL = 24; // grid resolution in px — coarse, so the per-frame deposit + render is cheap
const DECAY = 0.12; // per-frame fade: high enough that the map tracks the CURRENT density
const BLUR = 0.22; // light diffusion, for a smooth glow rather than blocky cells

export class Heatmap {
  private grid: ScalarGridImpl;
  /** eased running peak, for flicker-free normalization. */
  private peak = 1e-3;
  /** grid resolution in px (the render samples on this lattice). */
  readonly cell = CELL;

  constructor(width: number, height: number) {
    this.grid = new ScalarGridImpl(Math.max(1, width), Math.max(1, height), 'diffuse', CELL);
  }

  resize(width: number, height: number): void {
    this.grid.resize(width, height);
  }

  /**
   * Zero every cell in the accumulation buffer and reset the peak tracker. Called by
   * `setHeatmap(false)` so that re-enabling starts with a clean slate rather than
   * carrying over stale density from a previous active period. Also the right call after
   * a hard field reset where continuity of the heat history would be misleading.
   */
  clear(): void {
    this.grid.clear();
    this.peak = 1e-3;
  }

  /** Deposit the current particle field, decay + blur, and track the peak. Call once a frame. */
  update(particles: readonly Particle[]): void {
    for (const p of particles) this.grid.deposit(p.x, p.y, 1);
    this.grid.stepDiffuse(BLUR, DECAY);
    const m = this.grid.max();
    // ease the peak up fast (so a sudden spike normalizes promptly) and down slowly (so the
    // map doesn't flare as the field empties); floored so we never divide by zero.
    const k = m > this.peak ? 0.25 : 0.03;
    this.peak += (Math.max(m, 1e-3) - this.peak) * k;
  }

  /** Normalized density ∈ [0, 1] at a point — for the glow render and DOM write-back. */
  norm(x: number, y: number): number {
    return clamp(this.grid.sample(x, y) / this.peak, 0, 1);
  }

  /** Gradient ∇ of the NORMALIZED density field at a point (points up-density), in 1/px — the
   *  analytic companion to {@link norm}. Stays non-degenerate at a source because the grid is
   *  diffused (a real slope where a nearest-body density would flatten to zero). Unnormalized by
   *  the [0,1] clamp so it keeps pointing uphill even at saturation; { x: 0, y: 0 } on an empty field. */
  gradient(x: number, y: number): Vec2 {
    if (this.peak <= 0) return { x: 0, y: 0 };
    const g = this.grid.gradient(x, y);
    return { x: g.x / this.peak, y: g.y / this.peak };
  }
}
