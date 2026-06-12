import Foundation

// MARK: - Temporal kernels (temporal.ts) — WORLD TIME made computable
//
// field-ui keeps three clocks: simulation time (env.t/dt), experiential time (the
// platform metric pipeline), and world time — timestamps carried by the data itself.
// These kernels are clock 3: pure, deterministic maps from world timestamps to a 0..1
// weight. No Date() calls — the caller supplies nowMs. All arguments are epoch/duration
// milliseconds. Degenerate inputs never produce NaN.

/// One hour in milliseconds — `imminence`'s log-softening unit.
public let HOUR_MS: Double = 3_600_000
/// One day in milliseconds — `retention`'s τ defaults are day-calibrated.
public let DAY_MS: Double = 86_400_000

@inline(__always) private func clamp01(_ n: Double) -> Double { n < 0 ? 0 : n > 1 ? 1 : n }

/// How imminent a moment feels: 1 at (or past) the moment, log-ramping down to 0 at the
/// far edge of the horizon: `1 − ln(until/HOUR + 1) / ln(horizon/HOUR + 1)`. The one-hour
/// softening unit keeps the ramp finite at until = 0 and makes the last hours steepest.
public func imminence(atMs: Double, nowMs: Double, horizonMs: Double) -> Double {
    guard atMs.isFinite, nowMs.isFinite else { return 0 }
    let until = atMs - nowMs
    if until <= 0 { return 1 }
    guard horizonMs.isFinite, horizonMs > 0 else { return 0 }
    return clamp01(1 - log(until / HOUR_MS + 1) / log(horizonMs / HOUR_MS + 1))
}

/// Exponential newness decay — the recency shape in canonical form:
/// `freshness = 2^(−since / halfLife)` — 1 at the moment, exactly 0.5 one half-life
/// later. Future timestamps clamp to 1 — nothing is fresher than now.
/// (The complement is *staleness* = 1 − freshness, deliberately not exported.)
public func freshness(atMs: Double, nowMs: Double, halfLifeMs: Double) -> Double {
    guard atMs.isFinite, nowMs.isFinite else { return 0 }
    let since = nowMs - atMs
    if since <= 0 { return 1 }
    guard halfLifeMs.isFinite, halfLifeMs > 0 else { return 0 }
    return pow(2, -since / halfLifeMs)
}

/// Ebbinghaus-shaped retention: `a · e^(−since / τ(a))` with τ(a) = tauBase + a·tauGrowth.
/// The stability term is the point: τ *grows* with anchor strength, so deeply anchored
/// facts decay slower. retention(a, 0) is exactly a; negative since clamps to 0.
public func retention(anchor: Double, sinceMs: Double,
                      tauBaseMs: Double = 4 * DAY_MS, tauGrowthMs: Double = 56 * DAY_MS) -> Double {
    let a = clamp01(anchor.isFinite ? anchor : 0)
    guard sinceMs.isFinite else { return 0 }
    let since = Swift.max(0, sinceMs)
    let tau = tauBaseMs + a * tauGrowthMs
    guard tau.isFinite, tau > 0 else { return 0 }
    return a * exp(-since / tau)
}

/// Cyclical phase: where nowMs sits inside a repeating period, ∈ [0, 1) — the wrap point
/// reads as 0, never 1. A true (sign-safe) modulo, so times before the offset wrap right.
public func phase(nowMs: Double, periodMs: Double, offsetMs: Double = 0) -> Double {
    guard nowMs.isFinite, offsetMs.isFinite else { return 0 }
    guard periodMs.isFinite, periodMs > 0 else { return 0 }
    let m = (nowMs - offsetMs).truncatingRemainder(dividingBy: periodMs)
    let f = (m < 0 ? m + periodMs : m) / periodMs
    return f >= 1 ? 0 : f // float wrap guard: x + period can round to period
}
