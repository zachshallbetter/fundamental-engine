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

/** A named field event with its `field:*` name. */
export interface FieldEventName {
  field: string;
  /** the metric whose threshold crossing fires it (where applicable). */
  metric?: string;
}

/**
 * The named field-event catalog (system-contracts §9, shadow-dom §22, interaction §12). These are
 * the thresholded, debounced events the engine may dispatch — never per-frame by default.
 * `field:lit`/`dim` and the `*-body` lifecycle events are dispatched today; the rest are the agreed
 * names for agent/threshold events as they wire up.
 */
export const FIELD_EVENTS: Readonly<Record<string, FieldEventName>> = {
  // --- dispatched today (shipped) ---
  registerBody: { field: 'field:register-body' },
  unregisterBody: { field: 'field:unregister-body' },
  updateBody: { field: 'field:update-body' },
  lit: { field: 'field:lit', metric: 'density' },
  dim: { field: 'field:dim', metric: 'density' },
  // capture/release (§22.3): a sink fires field:captured on the rising edge of accreting and
  // field:released on supernova; docked elements fire them too. Edge-debounced (see field.ts).
  captured: { field: 'field:captured' },
  released: { field: 'field:released' },
  // relocate (§22.3): a [data-warp] element teleports its transform to its paired throat.
  relocated: { field: 'field:relocated' },
  // --- names reserved; NOT yet dispatched by the engine (planned agent-threshold events).
  //     See docs/canonical/agent-consumption-model.md (Events). ---
  entered: { field: 'field:entered', metric: 'density' },
  exited: { field: 'field:exited', metric: 'density' },
  saturated: { field: 'field:saturated', metric: 'accreted' },
  attentionShifted: { field: 'field:attention-shifted', metric: 'attention' },
  relationshipStrengthened: { field: 'field:relationship-strengthened', metric: 'strength' },
  memoryThreshold: { field: 'field:memory-threshold', metric: 'memory' },
  entropyWarning: { field: 'field:entropy-warning', metric: 'entropy' },
};

/** Map a metric to its conventional `field:*` event name for an edge. */
export function eventNamesFor(metric: string, edge: Exclude<ThresholdEdge, null>): { field: string } {
  // density → lit/dim; attention → attention-shifted; generic → entered/exited
  const verb =
    metric === 'density'
      ? edge === 'entered'
        ? 'lit'
        : 'dim'
      : edge === 'entered'
        ? 'entered'
        : 'exited';
  return { field: `field:${verb}` };
}
