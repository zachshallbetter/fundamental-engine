/**
 * Conserved attention (§2.4 + possibilities Concept 2) — one finite *strength
 * budget* for the whole page. Engaging a body raises its demand and, because the
 * total is conserved, pulls allocation off every other body: the field physically
 * cannot emphasise two things at once. Navigation becomes moving force between
 * sections, not fading opacity.
 *
 * This is pure: it returns a per-body effective-strength multiplier the integrator
 * folds into each body's force. The model is feed-forward on *demand* (configured
 * strength × engagement), which gives it two properties worth keeping:
 *
 *   1. Rest-neutral — when nothing is engaged every multiplier is exactly 1, so a
 *      field that opts in is unchanged until something is actually engaged.
 *   2. Total-strength-conserving — Σ Sᵢ·mulᵢ = Σ Sᵢ (within the clamp). The budget
 *      is literally invariant frame to frame; a boost to one body is exactly the
 *      starvation of the others.
 *
 *   demandᵢ = 1 + β·onᵢ            (β = engagement multiplier)
 *   mulᵢ    = demandᵢ · (Σ Sⱼ / Σ Sⱼ·demandⱼ)
 *
 * The closed form drops out: the normaliser `k = ΣS / ΣM` is 1 when nothing is
 * engaged, < 1 once anything is, so idle bodies dim (·k) while engaged bodies gain
 * ((1+β)·k). A density-closed-loop variant (steer toward actual fill, §8) is a
 * possible refinement; this feed-forward form is chosen first for stability.
 */

export interface AttnInput {
  /** the body's configured force magnitude S. */
  strength: number;
  /** engaged (hover / focus / tap). */
  on: boolean;
}

export interface AttnOpts {
  /** engagement multiplier β — how much harder an engaged body competes (default 2). */
  beta?: number;
  /** clamp floor for the multiplier (default 0.25). */
  lo?: number;
  /** clamp ceiling for the multiplier (default 3). */
  hi?: number;
}

/**
 * The per-body effective-strength multipliers for one frame, index-aligned with
 * `bodies`. All 1 when nothing is engaged or the input is degenerate (empty /
 * non-positive total), so it is always safe to apply.
 */
export function attentionMuls(bodies: readonly AttnInput[], opts: AttnOpts = {}): number[] {
  const beta = opts.beta ?? 2;
  const lo = opts.lo ?? 0.25;
  const hi = opts.hi ?? 3;
  const n = bodies.length;
  const out = new Array<number>(n).fill(1);
  if (n === 0) return out;

  let sumS = 0;
  let sumM = 0;
  for (const b of bodies) {
    const s = b.strength > 0 ? b.strength : 0;
    sumS += s;
    sumM += s * (1 + (b.on ? beta : 0));
  }
  if (sumS <= 0 || sumM <= 0) return out; // nothing to allocate → leave neutral

  const k = sumS / sumM; // demand normaliser; exactly 1 when nothing is engaged
  for (let i = 0; i < n; i++) {
    const demand = 1 + (bodies[i]!.on ? beta : 0);
    let mul = demand * k;
    if (mul < lo) mul = lo;
    else if (mul > hi) mul = hi;
    out[i] = mul;
  }
  return out;
}
