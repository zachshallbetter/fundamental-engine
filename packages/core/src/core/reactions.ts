/**
 * Micro-reactions (§23) — the energy removed at an interaction is rendered as a
 * reaction (sparks/flash). "Energy isn't lost — it's spent on spectacle." (§23.1)
 */

import type { Vec2 } from './types.ts';

/** Kinetic energy removed at an interaction: ½·m·(|v_before|² − |v_after|²) (§23.2). */
export function energyDelta(m: number, vBefore: number, vAfter: number): number {
  return 0.5 * m * (vBefore * vBefore - vAfter * vAfter);
}

/** Reaction intensity from removed energy: clamp(k·ΔE, 0, iMax) (§23.2). */
export function reactionIntensity(dE: number, k = 1, iMax = 2.4): number {
  const i = k * dE;
  return i < 0 ? 0 : i > iMax ? iMax : i;
}

/** Spark count for a reaction of a given power (§23.3, the reflect exemplar). */
export function sparkCount(power: number, rand: () => number = Math.random): number {
  return 3 + Math.floor(rand() * (power > 0 ? power : 1) * 3);
}

/**
 * The recoil impulse on the *other* agent in a transfer — equal-and-opposite,
 * split by its mass: Δv = −Δp / m (§23.5). Used by `collide`/mover reactions
 * (Phase 6). A heavier agent barely budges.
 */
export function recoilImpulse(dpx: number, dpy: number, mOther: number): Vec2 {
  const m = mOther > 0 ? mOther : 1;
  // `+ 0` normalizes a signed-zero result (−0 → 0) so equal-and-opposite
  // impulses compare cleanly (deepStrictEqual treats −0 and 0 as distinct).
  return { x: -dpx / m + 0, y: -dpy / m + 0 };
}

/**
 * A discrete radial burst impulse (§11) — the velocity kick and heat a one-shot
 * `field.burst(x, y)` imparts to matter at offset `(dx, dy)` from the blast, falling
 * off linearly to nothing at radius `r`; outside `r` it's inert. Pure: the field's
 * `burst` glue applies this per particle and tears nearby bound matter loose.
 */
export function burstImpulse(
  dx: number,
  dy: number,
  r: number,
  power = 6,
): { vx: number; vy: number; heat: number } {
  const d = Math.hypot(dx, dy) || 1;
  if (d >= r) return { vx: 0, vy: 0, heat: 0 };
  const falloff = 1 - d / r;
  const f = falloff * power;
  return { vx: (dx / d) * f, vy: (dy / d) * f, heat: falloff * 0.9 };
}
