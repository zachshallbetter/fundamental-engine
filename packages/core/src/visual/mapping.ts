/**
 * Visual mapping primitives (visual-language §1, §7). The visual language is, at root, a set of
 * pure functions from a field metric (0..1) to a visual property — a weight, a hue, a scale, a glow
 * radius. These are the building blocks: clamping, ranged interpolation with a response curve, and
 * the distance falloff that turns a body's reach into a 0..1 influence. Zero dependencies —
 * `clamp`/`lerp` are reused from the engine's math module so there is one source of truth.
 */
import { clamp, lerp } from '../core/math.ts';

export type Curve = 'linear' | 'ease-in' | 'ease-out' | 'ease' | 'exp';

/** Clamp to the unit interval [0,1]. */
export const clamp01 = (v: number): number => clamp(v, 0, 1);

/** Apply a response curve to a normalized input t ∈ [0,1]. */
export function curve(t: number, c: Curve = 'linear'): number {
  const x = clamp01(t);
  switch (c) {
    case 'ease-in':
      return x * x;
    case 'ease-out':
      return 1 - (1 - x) * (1 - x);
    case 'ease':
      return x * x * (3 - 2 * x); // smoothstep
    case 'exp':
      return x === 0 ? 0 : Math.pow(2, 10 * (x - 1));
    default:
      return x;
  }
}

/** Map a value from an input range to an output range through a response curve. */
export function mapRange(
  v: number,
  inLo: number,
  inHi: number,
  outLo: number,
  outHi: number,
  c: Curve = 'linear',
): number {
  if (inHi === inLo) return outLo;
  const t = curve((v - inLo) / (inHi - inLo), c);
  return lerp(outLo, outHi, t);
}

/**
 * Distance falloff (visual-language §7.2): a body's normalized influence at distance `d` within
 * `range`, 1 at the core easing to 0 at the rim. `power` shapes the edge (2 = soft, 1 = linear).
 */
export function falloff(d: number, range: number, power = 2): number {
  if (range <= 0 || d >= range) return 0;
  return Math.pow(1 - d / range, power);
}
