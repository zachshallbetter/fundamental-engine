/**
 * EventAgent — the Event Contract runtime (system-contracts §9). A field event must be
 * thresholded, debounced, and not fire every frame. The `Thresholder` turns a continuous metric
 * (density, attention, relationship strength…) into discrete `entered` / `exited` edges with
 * hysteresis (separate enter/exit levels) and a debounce window, so a body crossing a level emits
 * one clean event instead of a per-frame storm.
 */

export type ThresholdEdge = 'entered' | 'exited' | null;

export interface ThresholdConfig {
  /** value at or above which the agent becomes "lit" (fires `entered`). */
  enter: number;
  /** value at or below which it goes "dim" (fires `exited`). Should be ≤ enter for hysteresis. */
  exit: number;
  /** minimum ms between edge changes — debounce. */
  debounceMs: number;
}

/** A hysteretic, debounced edge detector over a single metric. */
export class Thresholder {
  private lit = false;
  private lastEdgeMs = -Infinity;
  private readonly cfg: ThresholdConfig;
  constructor(cfg: ThresholdConfig) {
    this.cfg = cfg;
  }

  /** Feed the current metric value and time; returns the edge crossed this tick, or null. */
  update(value: number, nowMs: number): ThresholdEdge {
    const settled = nowMs - this.lastEdgeMs >= this.cfg.debounceMs;
    if (!this.lit && value >= this.cfg.enter && settled) {
      this.lit = true;
      this.lastEdgeMs = nowMs;
      return 'entered';
    }
    if (this.lit && value <= this.cfg.exit && settled) {
      this.lit = false;
      this.lastEdgeMs = nowMs;
      return 'exited';
    }
    return null;
  }

  /** Whether the agent is currently above threshold. */
  get isLit(): boolean {
    return this.lit;
  }

  /** Reset to the dim state (e.g. on teardown). */
  reset(): void {
    this.lit = false;
    this.lastEdgeMs = -Infinity;
  }
}

/** Map a metric to its conventional `field:*` / `forces:*` event names for an edge. */
export function eventNamesFor(metric: string, edge: Exclude<ThresholdEdge, null>): {
  field: string;
  forces: string;
} {
  // density → lit/dim; attention → attention-shifted; generic → entered/exited
  const verb =
    metric === 'density'
      ? edge === 'entered'
        ? 'lit'
        : 'dim'
      : edge === 'entered'
        ? 'entered'
        : 'exited';
  return { field: `field:${verb}`, forces: `forces:${verb}` };
}
