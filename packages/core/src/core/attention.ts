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

export interface AttnAllocItem {
  /** the item's competitive demand — any non-negative magnitude (a lens-weighted urgency, say). */
  urgency: number;
  /** pinned items sit outside the competition: each takes exactly `cap` off the top. */
  pinned?: boolean;
}

export interface AttnAllocOpts {
  /** per-item weight ceiling (default 1). */
  cap?: number;
}

/**
 * Conserved allocation (§2.4 — one finite budget): distribute `budget` across items
 * proportional to `urgency`, capping each weight at `cap` (default 1) and re-flowing
 * capped excess over the rest (water-filling). `pinned` items take exactly `cap` off
 * the top; the remaining budget water-fills over the unpinned by urgency.
 *
 * Invariant: Σ(returned) === budget (±ε) whenever budget ≤ items.length × cap and the
 * unpinned items carry any positive urgency. Zero/negative/non-finite urgencies get 0 —
 * the budget only flows where there is demand, so an all-zero unpinned set allocates
 * nothing (extracted as-is from the Inbox example, where this never starves anyone:
 * urgencies are blends of normalized signals). Past the ceiling (budget > N × cap)
 * every weight saturates at `cap`. Pure; deterministic; never NaN; never negative;
 * each weight ≤ cap. Each water-filling pass either finishes or caps at least one
 * item, so N passes always converge.
 */
export function allocateAttention(
  items: ReadonlyArray<AttnAllocItem>,
  budget: number,
  opts: AttnAllocOpts = {},
): number[] {
  const cap = opts.cap ?? 1;
  const n = items.length;
  const w = new Array<number>(n).fill(0);
  if (n === 0 || !(cap > 0)) return w;

  // pins first — each holds exactly `cap`, off the top of the budget.
  const u = new Array<number>(n).fill(0);
  let free: number[] = [];
  let pinnedCount = 0;
  for (let i = 0; i < n; i++) {
    const it = items[i]!;
    if (it.pinned) {
      w[i] = cap;
      pinnedCount++;
    } else {
      u[i] = Number.isFinite(it.urgency) && it.urgency > 0 ? it.urgency : 0;
      free.push(i);
    }
  }

  // water-fill the rest: scale urgencies so the round sums to the remaining budget,
  // saturate anything that would exceed `cap`, re-flow the freed budget over the rest.
  let rem = Math.max(0, budget - pinnedCount * cap);
  for (let pass = 0; pass < n && free.length && rem > 0; pass++) {
    const sum = free.reduce((s, i) => s + u[i]!, 0) || 1;
    const k = rem / sum;
    const still: number[] = [];
    let capped = 0;
    for (const i of free) {
      if (u[i]! * k >= cap) {
        w[i] = cap;
        capped++;
      } else still.push(i);
    }
    if (!capped) {
      for (const i of still) w[i] = u[i]! * k;
      break;
    }
    rem -= capped * cap; // provably ≥ 0: each capped share was ≥ cap of a round summing to rem
    free = still;
  }
  return w;
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
