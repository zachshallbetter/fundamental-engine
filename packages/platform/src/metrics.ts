/**
 * The platform metric library. Makes the metrics a recipe lists real enough to be written and
 * inspected — typed state values, not prose. The math here is PURE (node-testable); the per-frame
 * wiring onto a `FieldPlatform` lives in `apply-recipe.ts`.
 *
 * Honest about provenance:
 * - COMPUTED generically: attention / memory / recency (proximity + engagement + decay) and
 *   coherence / entropy / pressure / priority (from relationship resolution + age). Any of these may
 *   be overridden by a supplied value.
 * - SUPPLIED-ONLY: `confidence` and `risk` are external judgments the engine has no evidence for.
 *   They are present ONLY when the host supplies them (`data-field-<metric>` / recipe options / a
 *   domain model). Confidence is NEVER inferred from relationship presence — a citation is not
 *   certainty. Risk is NEVER defaulted to 0 — "no risk" is a claim, not a safe blank. (Relationship
 *   resolution is a separate signal, see `apply-recipe.ts`, not confidence.)
 * - GROUNDED by world time: a declared `data-field-at` timestamp GROUNDS the recency lane —
 *   recency becomes `freshness(at, now, halfLife)` (the core temporal kernel) instead of the
 *   interaction-inferred ease. See `groundedRecency` below; the wiring is `apply-recipe.ts`.
 */
import { freshness } from '@field-ui/core';

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

/** The lanes `computeMetrics` produces generically every frame (everything except the supplied-only pair). */
export const COMPUTED_METRICS = [
  'attention',
  'memory',
  'coherence',
  'entropy',
  'pressure',
  'recency',
  'priority',
] as const;
/** Metrics the engine NEVER invents — present ONLY when the host supplies them (`data-field-<m>`). */
export const SUPPLIED_ONLY_METRICS = ['confidence', 'risk'] as const;

/**
 * How a metric lane is produced:
 * - `computed`     — the generic pipeline writes it every frame (proximity/engagement/relations/age).
 * - `supplied-only`— confidence/risk; the engine has no evidence, so it's written ONLY when supplied.
 * - `designed`     — a semantic lane (signal, route-strength, sync, …) the HOST must supply via
 *                    `data-field-<m>` (or a domain model). With neither a supply nor a computed source
 *                    its `--field-<m>` is **inert** — declared but never written. This is the gap the
 *                    nav sweep hit (navigation-current's `signal`/`route-strength`); `lintInertFeedback`
 *                    surfaces it, the same way `lintSinkFeedback` catches a capturing-but-silent sink.
 */
export type MetricSupport = 'computed' | 'supplied-only' | 'designed';

/** Classify a metric name by how its `--field-<name>` lane is produced (see {@link MetricSupport}). */
export function classifyMetric(name: string): MetricSupport {
  if ((COMPUTED_METRICS as readonly string[]).includes(name)) return 'computed';
  if ((SUPPLIED_ONLY_METRICS as readonly string[]).includes(name)) return 'supplied-only';
  return 'designed';
}

/**
 * One frame of computed metrics: every lane is a number except `confidence` and `risk`, which are
 * present ONLY when the host supplies them (the engine never invents them — see `computeMetrics`).
 */
export type ComputedMetrics = Record<Exclude<MetricKind, 'confidence' | 'risk'>, number> & {
  confidence?: number;
  risk?: number;
};

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

// ── world time: the declared-timestamp ground for the recency lane ──────────────────────
// The metric pipeline runs on two clocks. WITHOUT a declared timestamp, recency is
// EXPERIENTIAL time — inferred from interaction (the eased computeMetrics behavior below,
// unchanged). WITH one, the element carries WORLD TIME (`data-field-at` — when the data
// itself last happened), and that declared timestamp GROUNDS the recency lane:
// recency = freshness(at, now, halfLife), the core temporal kernel's exponential newness.

/** The default half-life for a grounded recency lane: 7 days (override per element with `data-field-halflife`, in ms). */
export const DEFAULT_RECENCY_HALF_LIFE_MS = 7 * 86_400_000;

/** The slice of Element the derivation reads — structural, so this module stays DOM-free and node-testable. */
interface AttrReader {
  getAttribute(name: string): string | null;
}

/**
 * Parse a declared world timestamp (`data-field-at`): epoch milliseconds or an ISO 8601
 * string. Invalid or absent values read as absent (`undefined`) — never NaN.
 */
export function parseFieldAt(value: string | null): number | undefined {
  if (value == null || value.trim() === '') return undefined;
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  const t = Date.parse(value);
  return Number.isNaN(t) ? undefined : t;
}

/**
 * Derive the grounded recency for an element declaring `data-field-at` — `freshness(at, now,
 * halfLife)` with the half-life from `data-field-halflife` (ms, default 7 days). Returns
 * `undefined` when no valid timestamp is declared, so the caller falls through to the
 * interaction-inferred path. `nowMs` is the frame's wall-clock instant, sampled ONCE per
 * frame by the caller (`apply-recipe.ts`) — never per-element `Date.now()`.
 */
export function groundedRecency(el: AttrReader, nowMs: number): number | undefined {
  const at = parseFieldAt(el.getAttribute('data-field-at'));
  if (at == null) return undefined;
  const hl = Number(el.getAttribute('data-field-halflife'));
  return freshness(at, nowMs, Number.isFinite(hl) && hl > 0 ? hl : DEFAULT_RECENCY_HALF_LIFE_MS);
}

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
  // COMPUTED lanes only. `confidence` and `risk` are intentionally absent: the engine has no evidence
  // for a claim's truth or its danger, so they stay unset unless the host supplies them below. The old
  // `confidence: relTotal > 0 ? resolvedRatio : 0` meant "any citation ⇒ fully confident", and the old
  // `risk: 0` meant "everything is safe by default" — both the wrong default for a trust/ops surface.
  const computed: Partial<Record<MetricKind, number>> = {
    attention,
    memory,
    recency,
    coherence,
    entropy,
    pressure: clamp01(entropy * 0.6 + (1 - recency) * 0.4),
    priority: attention,
  };
  // supplied values win — these lanes (incl. confidence) are recipe/data-driven, not invented
  for (const k of METRIC_KINDS) {
    const s = inp.supplied[k];
    if (s != null && Number.isFinite(s)) computed[k] = clamp01(s);
  }
  return computed as ComputedMetrics;
}
