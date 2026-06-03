/**
 * Micro-reactions (§23) — the energy removed at an interaction is rendered as a
 * reaction (sparks/flash). "Energy isn't lost — it's spent on spectacle." (§23.1)
 */

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
