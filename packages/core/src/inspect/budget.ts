/**
 * Performance budget inspector (system-contracts §15, testing §11). Compare live counts against a
 * PerformanceBudget and report every metric over its limit. Pure — the inspector reports; the
 * caller (or a dev overlay) decides what to do. Used to keep a scene within the §15 defaults.
 */
import type { PerformanceBudget } from '../contracts/types.ts';
import { DEFAULT_BUDGET } from '../contracts/types.ts';

export interface BudgetFinding {
  field: keyof PerformanceBudget;
  value: number;
  limit: number;
  over: number;
}

/** Report each live count that exceeds its budget (empty = within budget). */
export function inspectBudget(
  counts: Partial<PerformanceBudget>,
  budget: PerformanceBudget = DEFAULT_BUDGET,
): BudgetFinding[] {
  const out: BudgetFinding[] = [];
  for (const key of Object.keys(budget) as (keyof PerformanceBudget)[]) {
    const value = counts[key];
    if (value == null) continue;
    const limit = budget[key];
    if (value > limit) out.push({ field: key, value, limit, over: value - limit });
  }
  return out;
}

/** True when every provided count is within budget. */
export function withinBudget(counts: Partial<PerformanceBudget>, budget: PerformanceBudget = DEFAULT_BUDGET): boolean {
  return inspectBudget(counts, budget).length === 0;
}
