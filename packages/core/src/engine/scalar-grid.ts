/**
 * A scalar field on a uniform grid — the backing store for field-buffer forces
 * (§20.1 class [C]): `diffuse` (heat/concentration, `∂φ/∂t = D∇²φ`) and `propagate`
 * (a travelling wave, `∂²φ/∂t² = c²∇²φ`). Particles `deposit` into it and read its
 * `gradient`; the engine advances it once per frame with `step()`.
 *
 * Two stepping modes, chosen at construction (the field picks by grid name):
 *  - `diffuse` — explicit heat equation with a decay term; D is clamped to the
 *    stable range for the forward scheme.
 *  - `wave`    — second-order leapfrog using a previous buffer; c² clamped for the
 *    CFL limit, with light damping.
 *
 * Pure (no DOM), so every operation is golden-tested.
 */

import type { ScalarGrid, Vec2 } from './types.ts';

export type GridMode = 'diffuse' | 'wave' | 'memory';

export class ScalarGridImpl implements ScalarGrid {
  readonly mode: GridMode;
  readonly cell: number;
  private W: number;
  private H: number;
  private cols: number;
  private rows: number;
  private cur: Float32Array;
  private nxt: Float32Array;
  private prev: Float32Array; // previous frame, for the wave scheme

  // NB: explicit field assignment, not constructor parameter properties — Node's
  // strip-only type-stripping (which runs node:test) rejects the latter.
  constructor(W: number, H: number, mode: GridMode = 'diffuse', cell = 32) {
    this.W = W;
    this.H = H;
    this.mode = mode;
    this.cell = cell;
    this.cols = Math.max(2, Math.ceil(W / cell) + 1);
    this.rows = Math.max(2, Math.ceil(H / cell) + 1);
    const n = this.cols * this.rows;
    this.cur = new Float32Array(n);
    this.nxt = new Float32Array(n);
    this.prev = new Float32Array(n);
  }

  private clampCol(ix: number): number {
    return ix < 0 ? 0 : ix >= this.cols ? this.cols - 1 : ix;
  }
  private clampRow(iy: number): number {
    return iy < 0 ? 0 : iy >= this.rows ? this.rows - 1 : iy;
  }
  /** the current value at a clamped (Neumann boundary) cell. */
  private at(ix: number, iy: number): number {
    return this.cur[this.clampRow(iy) * this.cols + this.clampCol(ix)]!;
  }

  /** bilinear sample of the field in pixel space. */
  sample(x: number, y: number): number {
    const gx = x / this.cell;
    const gy = y / this.cell;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = gx - ix;
    const fy = gy - iy;
    const top = this.at(ix, iy) * (1 - fx) + this.at(ix + 1, iy) * fx;
    const bot = this.at(ix, iy + 1) * (1 - fx) + this.at(ix + 1, iy + 1) * fx;
    return top * (1 - fy) + bot * fy;
  }

  /** add `amount` to the nearest cell. */
  deposit(x: number, y: number, amount: number): void {
    const ix = this.clampCol(Math.round(x / this.cell));
    const iy = this.clampRow(Math.round(y / this.cell));
    this.cur[iy * this.cols + ix]! += amount;
  }

  /** the current peak value across the field — for normalizing a heatmap to [0, 1]. */
  max(): number {
    let m = 0;
    for (let i = 0; i < this.cur.length; i++) if (this.cur[i]! > m) m = this.cur[i]!;
    return m;
  }

  /** central-difference gradient ∇φ in pixel space (points up-slope). */
  gradient(x: number, y: number): Vec2 {
    const h = this.cell;
    return {
      x: (this.sample(x + h, y) - this.sample(x - h, y)) / (2 * h),
      y: (this.sample(x, y + h) - this.sample(x, y - h)) / (2 * h),
    };
  }

  /** advance one frame in the grid's mode. */
  step(): void {
    if (this.mode === 'wave') this.stepWave();
    else if (this.mode === 'memory') this.stepDiffuse(0.03, 0.004); // barely blur, fade slowly
    else this.stepDiffuse();
  }

  /** explicit heat equation `φ' = (φ + D·∇²φ)·(1 − decay)` (§20.10). */
  stepDiffuse(D = 0.18, decay = 0.01): void {
    const Dc = D < 0 ? 0 : D > 0.24 ? 0.24 : D; // forward-scheme stability
    const keep = 1 - decay;
    const { cols, rows, cur, nxt } = this;
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const i = iy * cols + ix;
        const lap =
          this.at(ix - 1, iy) + this.at(ix + 1, iy) + this.at(ix, iy - 1) + this.at(ix, iy + 1) -
          4 * cur[i]!;
        nxt[i] = (cur[i]! + Dc * lap) * keep;
      }
    }
    this.cur = nxt;
    this.nxt = cur;
  }

  /** leapfrog wave `φ' = 2φ − φ_prev + c²·∇²φ`, lightly damped (§20.10). */
  stepWave(c2 = 0.25, damping = 0.002): void {
    const cc = c2 < 0 ? 0 : c2 > 0.5 ? 0.5 : c2; // CFL limit
    const keep = 1 - damping;
    const { cols, rows, cur, prev, nxt } = this;
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const i = iy * cols + ix;
        const lap =
          this.at(ix - 1, iy) + this.at(ix + 1, iy) + this.at(ix, iy - 1) + this.at(ix, iy + 1) -
          4 * cur[i]!;
        nxt[i] = (2 * cur[i]! - prev[i]! + cc * lap) * keep;
      }
    }
    // rotate buffers: prev ← cur, cur ← nxt, reuse old prev as next scratch
    this.prev = cur;
    this.cur = nxt;
    this.nxt = prev;
  }

  /** Fade every cell toward zero by `rate` ∈ [0,1] (`1` clears) — a host-authored decay on top of
   *  the grid's own per-frame mode stepping. Touches the current buffer only. */
  decay(rate: number): void {
    const k = rate <= 0 ? 1 : rate >= 1 ? 0 : 1 - rate;
    if (k === 1) return;
    for (let i = 0; i < this.cur.length; i++) this.cur[i]! *= k;
  }

  /** Zero every cell in all internal buffers (cur, nxt, prev). */
  clear(): void {
    this.cur.fill(0);
    this.nxt.fill(0);
    this.prev.fill(0);
  }

  /** resize to a new viewport, preserving nothing (rebuilds the buffers). */
  resize(W: number, H: number): void {
    if (W === this.W && H === this.H) return;
    this.W = W;
    this.H = H;
    this.cols = Math.max(2, Math.ceil(W / this.cell) + 1);
    this.rows = Math.max(2, Math.ceil(H / this.cell) + 1);
    const n = this.cols * this.rows;
    this.cur = new Float32Array(n);
    this.nxt = new Float32Array(n);
    this.prev = new Float32Array(n);
  }
}
