/**
 * G3 — second substrate: the quality-governor rule set (EXPERIMENTAL, internal).
 *
 * PROVENANCE (stated plainly): this is a faithful core-local re-expression of the **shipped**
 * `QualityGovernor` in `@fundamental-engine/dom` — same declared escalation table, same recovery
 * streak, same overrun test (`duration > budget × 1.3`), same asymmetric hysteresis. It is a port, not
 * the shipped module, because `core` must never import `dom` (strict dependency direction) and core's
 * package `exports` map is closed, so the shipped class is unreachable from here. The port exists so the
 * second substrate can be adapted to `DynamicsContract` **inside core**, alongside the field adapter,
 * without exporting any new public surface. Its limitation is recorded in the phase findings.
 *
 * Why this substrate: it contrasts with the field on every axis the contract measures —
 *   discrete threshold transitions (not continuous integration),
 *   history-dependent streak state with ASYMMETRIC hysteresis (escalate fast, recover slow),
 *   a transition law that is a DECLARED TABLE rather than opaque code,
 *   fully surfaced, fully restorable state,
 *   exact determinism with no clock and no RNG.
 *
 * Expressed as pure functions: state in → state out. No class, no hidden mutable capture.
 */

export type QualityTier = 0 | 1 | 2 | 3;

export interface GovernorRule {
  readonly aboveMs: number;
  readonly streak: number;
  readonly tier: QualityTier;
}

/** The declared transition law (mirrors the shipped ESCALATE table). */
export const ESCALATE_RULES: readonly GovernorRule[] = [
  { aboveMs: 20, streak: 10, tier: 1 },
  { aboveMs: 33, streak: 5, tier: 2 },
  { aboveMs: 50, streak: 3, tier: 3 },
];

/** Clean frames required before dropping one tier (asymmetric recovery). */
export const RECOVER_STREAK = 30;

export const DEFAULT_BUDGET_MS = 16.67;

export interface GovernorState {
  readonly tier: QualityTier;
  readonly overrunStreak: number;
  readonly cleanStreak: number;
  readonly budgetMs: number;
}

export function initialGovernorState(budgetMs: number = DEFAULT_BUDGET_MS): GovernorState {
  return { tier: 0, overrunStreak: 0, cleanStreak: 0, budgetMs };
}

export interface GovernorStep {
  readonly state: GovernorState;
  /** The new tier when it changed this step; `undefined` when stable. */
  readonly changed: QualityTier | undefined;
}

/** Structural check used by `restore` — a snapshot payload must be a real governor state. */
export function isGovernorState(v: unknown): v is GovernorState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    (s.tier === 0 || s.tier === 1 || s.tier === 2 || s.tier === 3) &&
    typeof s.overrunStreak === 'number' &&
    typeof s.cleanStreak === 'number' &&
    typeof s.budgetMs === 'number'
  );
}

/**
 * Advance one frame. Pure: returns the next state and whether the tier changed.
 * Mirrors the shipped governor exactly — escalation checks rules in order and takes the first that
 * both exceeds its threshold and has met its streak; recovery drops ONE tier after RECOVER_STREAK
 * clean frames.
 */
export function feedGovernor(state: GovernorState, durationMs: number): GovernorStep {
  const overrun = durationMs > state.budgetMs * 1.3;

  if (overrun) {
    const overrunStreak = state.overrunStreak + 1;
    for (const rule of ESCALATE_RULES) {
      if (durationMs > rule.aboveMs && overrunStreak >= rule.streak && state.tier < rule.tier) {
        return {
          state: { ...state, tier: rule.tier, overrunStreak, cleanStreak: 0 },
          changed: rule.tier,
        };
      }
    }
    return { state: { ...state, overrunStreak, cleanStreak: 0 }, changed: undefined };
  }

  if (state.tier > 0) {
    const cleanStreak = state.cleanStreak + 1;
    if (cleanStreak >= RECOVER_STREAK) {
      const tier = Math.max(0, state.tier - 1) as QualityTier;
      return { state: { ...state, tier, overrunStreak: 0, cleanStreak: 0 }, changed: tier };
    }
    return { state: { ...state, overrunStreak: 0, cleanStreak }, changed: undefined };
  }

  return { state: { ...state, overrunStreak: 0, cleanStreak: 0 }, changed: undefined };
}
