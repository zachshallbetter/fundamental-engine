/**
 * Line-integral convolution — the smoky vector render (#671).
 *
 * `streamlines` draws the force field as a lattice of arrows: exact, diagnostic, and legible one
 * vector at a time. LIC draws the same field as *texture* — you stop reading individual vectors and
 * start seeing the flow, the way iron filings show a magnet rather than listing its gradients.
 *
 * **This is not textbook LIC, and the difference is deliberate.** The real algorithm convolves a
 * white-noise image along the streamline through *every pixel*: on a 1920×1080 canvas that is ~2M
 * streamline integrations per frame, which this engine cannot spend. What it does instead is the
 * standard cheap cousin — integrate a few hundred short streamlines from a jittered lattice and
 * stroke each at an alpha taken from the noise field at its seed. The noise is what makes it read as
 * LIC rather than as thin streamlines: neighbouring hairs get unrelated brightness, so they band and
 * clump into smoke instead of combing into a grid.
 *
 * Pure here — the noise, the seeding and the alpha profile — so the texture is deterministic and
 * node-testable. The integration itself lives in the field loop, where the force field is.
 */
import type { Vec2 } from './types.ts';

/** Integration steps per hair. Longer hairs read as stronger flow but cost linearly. */
export const LIC_STEPS = 14;

/** Pixels advanced per integration step. `STEPS × STEP_PX` is a hair's full length (~70px). */
export const LIC_STEP_PX = 5;

/** Target spacing between seeds, in px, before jitter. Sets both density and cost. */
export const LIC_SEED_SPACING = 26;

/** Hard ceiling on seeds per frame, so a large viewport cannot uncap the cost. */
export const LIC_MAX_SEEDS = 1400;

/**
 * Hairs whose seed noise falls below this are not drawn at all. Culling the faintest third costs
 * nothing visually — they were under one alpha step — and buys back a third of the integrations.
 */
export const LIC_NOISE_FLOOR = 0.34;

/**
 * A 32-bit integer hash with a real avalanche (murmur3's finalizer). The avalanche is the whole
 * point: a plain multiply-xor hash leaves neighbouring lattice points correlated, and correlated
 * seeds comb the hairs into visible rows — the exact grid artefact the noise exists to break.
 */
function hash32(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ (seed | 0)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Deterministic value noise in `[0, 1)` at integer lattice coordinates. */
export function licNoise(x: number, y: number, seed = 0): number {
  return hash32(x, y, seed) / 4294967296;
}

/** One hair's origin and the brightness it inherited from the noise field. */
export interface LicSeed {
  x: number;
  y: number;
  /** noise at this seed ∈ [0,1) — the hair's base alpha, and what makes the texture band. */
  n: number;
}

/**
 * Seed a jittered lattice across `W × H`. Jitter comes from the same hash as the brightness, so the
 * whole texture is a pure function of `(W, H, spacing, seed)` — the same field renders identically
 * on every run and on every machine, which is what lets a seeded capture be compared at all.
 *
 * Seeds under {@link LIC_NOISE_FLOOR} are dropped here rather than at draw time, so the cost saved
 * is the integration, not just the stroke. Capped at {@link LIC_MAX_SEEDS}.
 */
export function licSeeds(W: number, H: number, spacing = LIC_SEED_SPACING, seed = 0): LicSeed[] {
  const out: LicSeed[] = [];
  if (!(W > 0) || !(H > 0) || !(spacing > 0)) return out;
  const cols = Math.ceil(W / spacing);
  const rows = Math.ceil(H / spacing);
  for (let i = 0; i < cols && out.length < LIC_MAX_SEEDS; i++) {
    for (let j = 0; j < rows && out.length < LIC_MAX_SEEDS; j++) {
      const n = licNoise(i, j, seed);
      if (n < LIC_NOISE_FLOOR) continue;
      // jitter from two further hashes, so a seed never sits exactly on the lattice
      const jx = licNoise(i, j, seed + 101);
      const jy = licNoise(i, j, seed + 211);
      out.push({ x: (i + jx) * spacing, y: (j + jy) * spacing, n });
    }
  }
  return out;
}

/**
 * Alpha for step `i` of a hair, given its seed brightness. Two factors:
 *
 * - the seed's own noise, remapped from `[floor, 1)` to `[0, 1]` so culling the floor does not also
 *   dim everything above it;
 * - a taper that fades both ends of the hair, so hairs dissolve into the field instead of ending in
 *   hard dashes — the single thing that most separates "smoke" from "short line segments".
 */
export function licAlpha(n: number, i: number, steps = LIC_STEPS): number {
  if (steps <= 1) return 0;
  const bright = (n - LIC_NOISE_FLOOR) / (1 - LIC_NOISE_FLOOR);
  if (i <= 0 || i >= steps - 1) return 0; // exactly zero at both ends: Math.sin(Math.PI) is 1.2e-16,
  // and a taper that only *nearly* reaches zero leaves a hair ending on a visible tick.
  const t = i / (steps - 1); // 0..1 along the hair
  const taper = Math.sin(Math.PI * t); // 0 at both ends, 1 in the middle
  const a = bright * taper;
  return a < 0 ? 0 : a > 1 ? 1 : a;
}

/**
 * One integration step: advance `(x, y)` by `stepPx` along the unit field direction. Returns the
 * new point and the unit direction actually used; a dead zone (no measurable force) returns
 * `moved: false` so the caller can end the hair rather than draw a straight artefact through it.
 */
export function licStep(
  x: number,
  y: number,
  fx: number,
  fy: number,
  stepPx = LIC_STEP_PX,
): { x: number; y: number; ux: number; uy: number; moved: boolean } {
  const mag = Math.hypot(fx, fy);
  if (!(mag > 1e-9)) return { x, y, ux: 0, uy: 0, moved: false };
  const ux = fx / mag;
  const uy = fy / mag;
  return { x: x + ux * stepPx, y: y + uy * stepPx, ux, uy, moved: true };
}

/** Allocating convenience over {@link licStep}, for callers that only want the displacement. */
export function licDirection(fx: number, fy: number): Vec2 {
  const mag = Math.hypot(fx, fy);
  return mag > 1e-9 ? { x: fx / mag, y: fy / mag } : { x: 0, y: 0 };
}
