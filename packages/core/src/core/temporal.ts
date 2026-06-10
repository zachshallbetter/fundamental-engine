/**
 * Temporal kernels — WORLD TIME made computable.
 *
 * field-ui keeps three clocks:
 *
 *   1. **Simulation time** — `env.t` / `dt`, particle age: the integrator's clock.
 *   2. **Experiential time** — the platform metric pipeline's attention / memory / recency:
 *      eased integrals of interaction (`@field-ui/platform` `metrics.ts`).
 *   3. **World time** — timestamps carried by the data itself: a launch's T−0, an issue's
 *      `updatedAt`, a question's `askedAt`, a fact's last review.
 *
 * These kernels are clock 3. Each is a pure, deterministic map from world timestamps to a
 * `0..1` weight — zero DOM, zero state, and **no `Date.now()`**: the caller supplies `nowMs`
 * (the platform samples it once per frame; pages sample it once per tick). All arguments are
 * epoch/duration **milliseconds**; the day and hour constants the shapes were calibrated in
 * are exported explicitly. Degenerate inputs (NaN, ±Infinity, non-positive timescales) never
 * produce NaN — each kernel documents its safe value.
 *
 * The shapes are lifted, exactly, from the shipped example family (the extraction ratchet:
 * four hand-rolls → one primitive): `imminence` from the calendar page's 1 Hz clock,
 * `retention` from the memory page's forgetting curve, `freshness` as the canonical form of
 * the backlog/inbox recency lanes. `data-field-at` (see `@field-ui/platform`) feeds
 * `freshness` to ground the metric pipeline's recency lane in declared world time.
 */

/** One hour in milliseconds — `imminence`'s log-softening unit (the calendar shape is hour-calibrated). */
export const HOUR_MS = 3_600_000;

/** One day in milliseconds — `retention`'s τ defaults are day-calibrated (4 + a·56 days). */
export const DAY_MS = 86_400_000;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * How imminent a moment feels: `1` at (or past) the moment, log-ramping down to `0` at the
 * far edge of the horizon.
 *
 * The exact form, with `until = atMs − nowMs`:
 *
 *     imminence = clamp01( 1 − ln(until/HOUR_MS + 1) / ln(horizonMs/HOUR_MS + 1) )
 *
 * i.e. the calendar example's weight, `1 − ln(hoursUntil + 1) / ln(horizonHours + 1)`, with
 * hours generalized to milliseconds. The one-hour softening unit (`+1` in hour units) is part
 * of the shape: it keeps the ramp finite at `until = 0` and makes the last hours before the
 * moment the steepest part of the curve. Returns `1` for any `until ≤ 0` (the moment has
 * arrived — what a page does with a *passed* moment, e.g. the calendar's `0.08` floor for
 * passed/TBD launches, is page semantics layered on top). Monotonically non-increasing in
 * `until`; `0` at and beyond the horizon.
 *
 * Degenerate inputs: a non-finite `atMs`/`nowMs` returns `0`; a non-positive or non-finite
 * `horizonMs` returns `1` at/past the moment and `0` otherwise (no horizon, no ramp).
 */
export function imminence(atMs: number, nowMs: number, horizonMs: number): number {
  if (!Number.isFinite(atMs) || !Number.isFinite(nowMs)) return 0;
  const until = atMs - nowMs;
  if (until <= 0) return 1;
  if (!Number.isFinite(horizonMs) || horizonMs <= 0) return 0;
  return clamp01(1 - Math.log(until / HOUR_MS + 1) / Math.log(horizonMs / HOUR_MS + 1));
}

/**
 * Exponential newness decay — the backlog/inbox recency shape in its canonical form:
 *
 *     freshness = 2^(−since / halfLifeMs)    with since = nowMs − atMs
 *
 * `1` at the moment itself, **exactly `0.5` one half-life later**, `0.25` after two, → `0`
 * asymptotically. Future timestamps (`since < 0`) clamp to `1` — nothing is fresher than now.
 * Monotonically non-increasing in `since`.
 *
 * Naming: this lane reads positively — the complement is *staleness*, and it is deliberately
 * not exported: `staleness = 1 − freshness`. One word per lane.
 *
 * Degenerate inputs: a non-finite `atMs`/`nowMs` returns `0`; a non-positive or non-finite
 * `halfLifeMs` returns `1` at/before the moment and `0` after it (instant decay).
 */
export function freshness(atMs: number, nowMs: number, halfLifeMs: number): number {
  if (!Number.isFinite(atMs) || !Number.isFinite(nowMs)) return 0;
  const since = nowMs - atMs;
  if (since <= 0) return 1;
  if (!Number.isFinite(halfLifeMs) || halfLifeMs <= 0) return 0;
  return Math.pow(2, -since / halfLifeMs);
}

/** Options for {@link retention} — the τ calibration, in milliseconds. */
export interface RetentionOptions {
  /** τ's base — the decay timescale of a zero-strength anchor. Default `4 * DAY_MS`. */
  tauBaseMs?: number;
  /** τ's growth with anchor strength — `τ(a) = tauBaseMs + a · tauGrowthMs`. Default `56 * DAY_MS`. */
  tauGrowthMs?: number;
}

/**
 * Ebbinghaus-shaped retention: how much of an anchored fact is still held after `sinceMs`.
 *
 * The exact form, lifted from the memory example's forgetting curve:
 *
 *     retention = a · e^(−since / τ(a))    with τ(a) = tauBaseMs + a · tauGrowthMs
 *
 * which is the memory page's `w = a · exp(−days / τ)` with `τ = 4 + a·56` **in day units**,
 * generalized to milliseconds with the day constant explicit (defaults `4 * DAY_MS` and
 * `56 * DAY_MS`). The stability term is the point: τ *grows* with anchor strength, so deeply
 * anchored facts decay slower — exponential decay alone forgets everything at one rate.
 * `anchor` is clamped to `0..1`; `retention(a, 0)` is exactly `a`; monotonically
 * non-increasing in `sinceMs` (negative `sinceMs` clamps to `0` — a future review holds full
 * strength, it doesn't overshoot).
 *
 * The shape is Ebbinghaus's; the default constants are the memory page's, tuned for
 * legibility, not fitted to recall data. Degenerate inputs: non-finite `anchor` reads as `0`;
 * non-finite `sinceMs` or a non-positive τ returns `0` (nothing held).
 */
export function retention(anchor: number, sinceMs: number, opts: RetentionOptions = {}): number {
  const a = clamp01(Number.isFinite(anchor) ? anchor : 0);
  if (!Number.isFinite(sinceMs)) return 0;
  const since = sinceMs < 0 ? 0 : sinceMs;
  const tau = (opts.tauBaseMs ?? 4 * DAY_MS) + a * (opts.tauGrowthMs ?? 56 * DAY_MS);
  if (!Number.isFinite(tau) || tau <= 0) return 0;
  return a * Math.exp(-since / tau);
}

/**
 * Cyclical phase: where `nowMs` sits inside a repeating period, as `0..1` (the result is in
 * `[0, 1)` — the wrap point reads as `0`, never `1`).
 *
 *     phase = ((nowMs − offsetMs) mod periodMs) / periodMs
 *
 * with a true (sign-safe) modulo, so times before the offset wrap correctly. `offsetMs`
 * anchors the cycle's zero — e.g. a local midnight for a day rhythm, a Monday 00:00 for a
 * week rhythm.
 *
 * Honesty note: this kernel ships for completeness of the world-time family (day/week
 * rhythms are the obvious fourth shape next to imminence, freshness, and retention), but
 * **no shipped page or pipeline consumes it yet** — it has no worked example.
 *
 * Degenerate inputs: a non-finite `nowMs`/`offsetMs` or a non-positive/non-finite `periodMs`
 * returns `0`.
 */
export function phase(nowMs: number, periodMs: number, offsetMs = 0): number {
  if (!Number.isFinite(nowMs) || !Number.isFinite(offsetMs)) return 0;
  if (!Number.isFinite(periodMs) || periodMs <= 0) return 0;
  const m = (nowMs - offsetMs) % periodMs;
  const f = (m < 0 ? m + periodMs : m) / periodMs;
  return f >= 1 ? 0 : f; // float wrap guard: x + period can round to period
}
