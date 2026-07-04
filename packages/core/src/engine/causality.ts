/**
 * Cross-boundary causality (possibilities Concept 4) — density doesn't stop at a
 * body's edge. When a body saturates (its eased density `d` climbs past a
 * threshold, e.g. because it's engaged and gathering matter), the excess **spills
 * to its neighbours**, weighted by proximity, as a conserved transfer. Hover one
 * card and the ones beside it light up; the wiring between elements appears because
 * matter actually flows between them, not because it was hand-drawn (§10 threads,
 * made emergent).
 *
 * Pure: given each body's density and centre, returns the per-body **lit delta** —
 * how much density it receives from (or donates to) its neighbours this frame. The
 * caller adds it to `d` to get the body's `lit` signal, writes that to the element,
 * and fires a DOM event on threshold crossing.
 *
 *   excessᵢ = max(0, dᵢ − θ)
 *   wᵢⱼ     = max(0, 1 − dist(i,j)/falloff)        proximity weight, bounded (no 1/d blow-up)
 *   Φᵢⱼ     = κ · excessᵢ · wᵢⱼ / Σₖ wᵢₖ            i donates, j receives
 *   Δⱼ      = Σᵢ Φᵢⱼ − Σⱼ Φⱼₖ                       received − donated
 *
 * Conserved by construction: ΣΔ = 0 (every donation is exactly a reception).
 */

export interface SpillBody {
  /** eased density d ∈ [0,1] (§8). */
  d: number;
  cx: number;
  cy: number;
}

export interface SpillOpts {
  /** density above which a body spills its excess (default 0.55). */
  threshold?: number;
  /** fraction of the excess that flows out (default 0.6). */
  kappa?: number;
  /** proximity reach in px — past this, no transfer (default 320). */
  falloff?: number;
}

/** Per-body lit delta (received − donated), index-aligned with `bodies`. Sums to 0. */
export function spillover(bodies: readonly SpillBody[], opts: SpillOpts = {}): number[] {
  const threshold = opts.threshold ?? 0.55;
  const kappa = opts.kappa ?? 0.6;
  const falloff = opts.falloff ?? 320;
  const n = bodies.length;
  const delta = new Array<number>(n).fill(0);
  if (n < 2) return delta;

  const w = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const bi = bodies[i]!;
    const excess = bi.d - threshold;
    if (excess <= 0) continue;

    // proximity weights to every other body within reach
    let total = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) {
        w[j] = 0;
        continue;
      }
      const bj = bodies[j]!;
      const dist = Math.hypot(bi.cx - bj.cx, bi.cy - bj.cy);
      const ww = dist < falloff ? 1 - dist / falloff : 0;
      w[j] = ww;
      total += ww;
    }
    if (total <= 0) continue;

    const out = kappa * excess; // total density this body spills
    for (let j = 0; j < n; j++) {
      const wj = w[j]!;
      if (wj <= 0) continue;
      const phi = (out * wj) / total;
      delta[j]! += phi; // neighbour receives
      delta[i]! -= phi; // this body donates (conserved)
    }
  }
  return delta;
}
