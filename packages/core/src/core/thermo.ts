/**
 * Measured thermodynamics (physics workover v0.3 §"Metrics: entropy and coherence").
 *
 * Entropy, coherence, and temperature are METRICS — measured, never applied as forces
 * (taxonomy layer 8). The engine samples each `data-feedback` body's local neighborhood
 * during the existing density pass (the same `range/2` window that feeds `b.count`, so no
 * new O(particles × bodies) work), accumulates the sums in `b.thermo`, and this module
 * turns those sums into the three measurements exported through the feedback sink as
 * `--entropy` / `--coherence` / `--temperature` (alongside `--d`, the density).
 *
 * The as-built formulas (recorded in docs/engine-reference/physics-workover.md — the
 * brief's four-term sketch left scales open, so the shipped definitions are the cheap,
 * honest local versions):
 *
 *   R           = |Σv| / Σ|v|              — velocity alignment (mean resultant length ∈ [0,1])
 *   entropy     = (1 − R) · min(1, s̄ / 1.5) — direction dispersion, gated by agitation
 *                                             (a damped, near-still region is ORDERED, so
 *                                             drag lowers entropy; thermal raises it)
 *   coherence   = 1 − entropy               — the brief's complement relation, exactly
 *   temperature = ½·h̄ + ½·min(1, s̄²/9)      — half the engine's thermal channel (mean heat),
 *                                             half normalized kinetic agitation (reference
 *                                             speed 3 px/frame), clamped to [0,1]
 *
 * where s̄ = mean speed, s̄² = mean squared speed, h̄ = mean heat over the sample. An empty
 * sample (no matter in the window) reads as a quiet region: entropy 0, coherence 1,
 * temperature 0. All three are pure functions of the accumulator — deterministic and
 * unit-testable with no engine.
 */

/** Local thermodynamic accumulator sums (see `Body.thermo`): n samples, Σvx, Σvy, Σ|v|, Σ|v|², Σheat. */
export interface ThermoAcc {
  n: number;
  sx: number;
  sy: number;
  ss: number;
  ss2: number;
  sh: number;
}

/** Reference squared speed for temperature normalization — (3 px/frame)². */
export const TEMP_SPEED2_REF = 9;
/** Mean speed (px/frame) at which directional dispersion counts fully toward entropy. */
export const ENTROPY_AGITATION_REF = 1.5;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The three measured metrics from an accumulator (undefined/empty ⇒ a quiet region). */
export function thermoMetrics(a: ThermoAcc | undefined): {
  entropy: number;
  coherence: number;
  temperature: number;
} {
  if (!a || a.n === 0) return { entropy: 0, coherence: 1, temperature: 0 };
  const meanHeat = a.sh / a.n;
  const meanSpeed = a.ss / a.n;
  const meanSpeed2 = a.ss2 / a.n;
  const temperature = clamp01(0.5 * meanHeat + 0.5 * Math.min(1, meanSpeed2 / TEMP_SPEED2_REF));
  // velocity alignment R ∈ [0,1]: 1 = every sampled velocity points the same way; → 0 as the
  // directions disperse. A near-still sample (Σ|v| ≈ 0) is treated as fully ordered.
  const R = a.ss > 1e-9 ? Math.hypot(a.sx, a.sy) / a.ss : 1;
  const entropy = clamp01((1 - R) * Math.min(1, meanSpeed / ENTROPY_AGITATION_REF));
  return { entropy, coherence: 1 - entropy, temperature };
}
