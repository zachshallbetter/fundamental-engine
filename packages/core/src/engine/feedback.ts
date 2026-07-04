/**
 * Two-way density feedback (§8) — the field writes the density gathered on a body
 * back into its element as `--d`, so type can glow, grow, and gain weight where
 * matter collects (the sanctioned word treatment, §11 note). Pure math here; the
 * DOM writes live in the field loop.
 */

/** Eased target density for a body from its per-frame `count` (§8). */
export function feedbackTarget(count: number, on: boolean): number {
  const t = count / 20 + (on ? 0.45 : 0);
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Variable-font weight from density `d` ∈ [0,1] (§8). */
export function feedbackWeight(fmin: number, fmax: number, d: number): number {
  return Math.round(fmin + (fmax - fmin) * d);
}
