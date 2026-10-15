/**
 * QualityGovernor — detects sustained frame-budget overruns and emits a tier signal so the
 * caller can adapt render quality without a hard cutoff.
 *
 * Tier semantics (intentionally coarse — the governor detects, the caller responds):
 *   0 = full quality (default)
 *   1 = effects reduced  — caller should simplify overlay, drop heatmap, reduce particle draw
 *   2 = minimal          — caller should switch render to 'dots', cut particle cap in half
 *   3 = paused           — caller should suspend the field loop entirely
 *
 * Shipped consumer: the `<field-root>` platform runtime throttles its own tick cadence (the
 * measurement/feedback DOM work) to every 2nd frame at tier 2 and every 4th at tier 3, and
 * forwards each tier change to the engine via `handle.setQualityTier` (#413) — the engine then
 * caps the effective backing-store DPR and drops the heatmap at tier 2+ on its own levers,
 * reversibly. The `field:quality-tier` event still fires so embedders can layer further
 * responses (render simplification, particle caps) on top — those remain manual. Raw
 * `createField` wires NO governor: a consumer on that path constructs one and forwards
 * `feed()` results to `handle.setQualityTier` itself.
 *
 * Feed it rAF-to-rAF spacing (or better, measured work time). Callers should skip discontinuity
 * frames (tab switches, system sleep) and reset() on visibilitychange — the elements runtime does.
 *
 * Recovery is asymmetric: a tier escalation fires after N consecutive overrun frames;
 * recovery requires a longer run of clean frames to avoid thrashing at the boundary.
 *
 * Every threshold is a multiple of the frame budget — the display's refresh interval, not a fixed
 * 60 Hz. With the default 16.67 ms budget they are the original 20 / 33 / 50 ms; on a 30 Hz display
 * (iOS Low Power Mode, a throttled laptop) a steady 33 ms rAF spacing is on budget, not an overrun.
 * Pass the detected budget to the constructor or `setBudget()` — `createFieldPerf().snapshot().budgetMs`
 * measures it, and the `<field-root>` runtime wires exactly that.
 */

export type QualityTier = 0 | 1 | 2 | 3;

interface TierRule {
  readonly aboveMs: number;       // frame duration threshold at the default 60 Hz budget (scaled by budget)
  readonly streak: number;        // consecutive frames needed to escalate to this tier
  readonly tier: QualityTier;
}

/** The 60 Hz budget the thresholds were tuned against (and the default). */
const DEFAULT_BUDGET_MS = 16.67;

// tuned at 60 Hz; feed() scales each by budget / DEFAULT_BUDGET_MS (exactly 1 at the default).
const ESCALATE: readonly TierRule[] = [
  { aboveMs: 20, streak: 10, tier: 1 },
  { aboveMs: 33, streak:  5, tier: 2 },
  { aboveMs: 50, streak:  3, tier: 3 },
];

const RECOVER_STREAK = 30; // clean frames before dropping a tier

export class QualityGovernor {
  private _tier: QualityTier = 0;
  private overrunStreak = 0;
  private cleanStreak = 0;
  private budget: number;

  constructor(budgetMs = DEFAULT_BUDGET_MS) {
    this.budget = validBudget(budgetMs) ?? DEFAULT_BUDGET_MS;
  }

  get tier(): QualityTier { return this._tier; }

  /** The frame budget (ms) the thresholds scale from. */
  get budgetMs(): number { return this.budget; }

  /**
   * Re-base the thresholds on a measured frame budget (ms) — e.g. `createFieldPerf().snapshot().budgetMs`
   * once it is non-null. A non-finite or non-positive value is ignored. The current tier is kept; the
   * overrun/clean streaks restart, since they were counted against the old budget.
   */
  setBudget(budgetMs: number): void {
    const b = validBudget(budgetMs);
    if (b === undefined || b === this.budget) return;
    this.budget = b;
    this.overrunStreak = 0;
    this.cleanStreak = 0;
  }

  /**
   * Feed one frame duration (ms). Returns the new tier when it changes, `undefined` when stable.
   * Call once per rAF tick, after `platform.tick()` completes.
   */
  feed(durationMs: number): QualityTier | undefined {
    const overrun = durationMs > this.budget * 1.3;
    const scale = this.budget / DEFAULT_BUDGET_MS;

    if (overrun) {
      this.cleanStreak = 0;
      this.overrunStreak++;
      for (const rule of ESCALATE) {
        if (durationMs > rule.aboveMs * scale && this.overrunStreak >= rule.streak && this._tier < rule.tier) {
          this._tier = rule.tier;
          return this._tier;
        }
      }
    } else {
      this.overrunStreak = 0;
      if (this._tier > 0) {
        this.cleanStreak++;
        if (this.cleanStreak >= RECOVER_STREAK) {
          this.cleanStreak = 0;
          this._tier = Math.max(0, this._tier - 1) as QualityTier;
          return this._tier;
        }
      }
    }
    return undefined;
  }

  reset(): void {
    this._tier = 0;
    this.overrunStreak = 0;
    this.cleanStreak = 0;
  }
}

function validBudget(ms: number): number | undefined {
  return Number.isFinite(ms) && ms > 0 ? ms : undefined;
}
