/**
 * The platform metric library. Makes the metrics a recipe lists real enough to be written and
 * inspected — typed state values, not prose. The math here is PURE (node-testable); the per-frame
 * wiring onto a `FieldPlatform` lives in `apply-recipe.ts`.
 *
 * Honest about provenance:
 * - COMPUTED generically: attention / memory / recency (proximity + engagement + decay) and
 *   coherence / entropy / pressure / priority (from relationship resolution + age). `risk` is a 0
 *   placeholder until a real risk model exists. Any of these may be overridden by a supplied value.
 * - SUPPLIED-ONLY: `confidence` is an external judgment the engine has no evidence for. It is present
 *   ONLY when the host supplies it (`data-field-confidence` / recipe options / a domain trust model);
 *   it is NEVER inferred from relationship presence — a citation is not certainty, a source is not
 *   proof. Relationship resolution is a separate signal (see `apply-recipe.ts`), not confidence.
 */
export const METRIC_KINDS = [
  'attention',
  'memory',
  'coherence',
  'entropy',
  'pressure',
  'confidence',
  'risk',
  'recency',
  'priority',
] as const;
export type MetricKind = (typeof METRIC_KINDS)[number];

/**
 * One frame of computed metrics: every lane is a number except `confidence`, which is present ONLY
 * when the host supplies it (the engine never invents it — see `computeMetrics`).
 */
export type ComputedMetrics = Record<Exclude<MetricKind, 'confidence'>, number> & { confidence?: number };

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export interface MetricInputs {
  /** 0..1 — how centred the element is in the viewport (1 = at centre). */
  proximity: number;
  /** 0..1 — fraction of the element visible. */
  visible: number;
  /** hover / focus / active. */
  engaged: boolean;
  /** frames since the last compute (usually 1). */
  dtFrames: number;
  /** resolved relationships touching this element. */
  relResolved: number;
  /** total relationships touching this element. */
  relTotal: number;
  /** contradicting relationships touching this element. */
  relConflict: number;
  /** metric values supplied by the recipe/data (data-field-<metric>). */
  supplied: Partial<Record<MetricKind, number>>;
  /** prior frame's metric values. */
  prev: Partial<Record<MetricKind, number>>;
}

const prevOf = (inp: MetricInputs, k: MetricKind): number => inp.prev[k] ?? 0;

/** Compute one frame of metrics from inputs (pure). Supplied values override/add to computed ones. */
export function computeMetrics(inp: MetricInputs): ComputedMetrics {
  const dt = Math.max(1, inp.dtFrames);
  const attention = clamp01(inp.proximity * inp.visible * (inp.engaged ? 1.3 : 1));
  const memory = clamp01(prevOf(inp, 'memory') + (attention > 0.6 ? 0.006 * dt : -0.0008 * dt));
  const recency = inp.engaged || attention > 0.6 ? 1 : clamp01(prevOf(inp, 'recency') - 0.003 * dt);
  const resolvedRatio = inp.relTotal > 0 ? inp.relResolved / inp.relTotal : 0;
  const conflictRatio = inp.relTotal > 0 ? inp.relConflict / inp.relTotal : 0;
  const coherence = inp.relTotal > 0 ? clamp01(resolvedRatio - conflictRatio) : prevOf(inp, 'coherence');
  const entropy = inp.relTotal > 0 ? clamp01(conflictRatio + (1 - resolvedRatio) * 0.5) : prevOf(inp, 'entropy');
  // COMPUTED lanes (+ a `risk` placeholder). `confidence` is intentionally absent here: the engine
  // has no evidence for a claim's truth, so it stays unset unless the host supplies it below. The old
  // `confidence: relTotal > 0 ? resolvedRatio : 0` meant "any citation ⇒ fully confident" — exactly
  // the wrong default for an evidence/trust surface.
  const computed: Partial<Record<MetricKind, number>> = {
    attention,
    memory,
    recency,
    coherence,
    entropy,
    pressure: clamp01(entropy * 0.6 + (1 - recency) * 0.4),
    risk: 0,
    priority: attention,
  };
  // supplied values win — these lanes (incl. confidence) are recipe/data-driven, not invented
  for (const k of METRIC_KINDS) {
    const s = inp.supplied[k];
    if (s != null && Number.isFinite(s)) computed[k] = clamp01(s);
  }
  return computed as ComputedMetrics;
}
