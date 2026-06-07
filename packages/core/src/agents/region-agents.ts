/**
 * LayoutAgent and DataAgent (interaction-and-relationship-model) — the region-level and
 * record-level field participants. A LayoutAgent is a viewport region that aggregates the field
 * metrics under it (so a whole column or card can respond, not just leaf elements). A DataAgent is
 * a semantic record placed in the field, carrying a salience that decays unless reinforced.
 *
 * Pure aggregation/decay, node-testable. Rendering and DOM binding live in the field loop.
 */
import type { ElementMetrics } from './element-agent.ts';

// ── LayoutAgent ───────────────────────────────────────────────────────────────────────────────
export interface LayoutAgent {
  id: string;
  /** the region in field space. */
  rect: { x: number; y: number; w: number; h: number };
  /** aggregated metrics over the bodies inside the region. */
  metrics: ElementMetrics;
}

const inRect = (r: LayoutAgent['rect'], x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/**
 * Aggregate a metric across the bodies whose centre falls in the region (mean of the contained
 * values). Returns 0 for an empty region. Pure.
 */
export function aggregateMetric(
  region: LayoutAgent,
  bodies: readonly { cx: number; cy: number; value: number }[],
): number {
  let sum = 0;
  let n = 0;
  for (const b of bodies) {
    if (inRect(region.rect, b.cx, b.cy)) {
      sum += b.value;
      n++;
    }
  }
  return n === 0 ? 0 : sum / n;
}

// ── DataAgent ─────────────────────────────────────────────────────────────────────────────────
export interface DataAgent {
  id: string;
  /** arbitrary semantic fields of the record. */
  fields: Readonly<Record<string, unknown>>;
  /** attention/relevance ∈ [0,1] — decays unless reinforced. */
  salience: number;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Reinforce (matched a query / was viewed) or let salience decay. Pure. */
export function updateDataAgent(d: DataAgent, reinforced: boolean, dt: number, decay = 0.4, gain = 1.2): void {
  d.salience = clamp01(d.salience + (reinforced ? gain : -decay) * dt);
}
