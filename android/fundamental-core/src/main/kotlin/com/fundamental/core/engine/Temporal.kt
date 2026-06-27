package com.fundamental.core.engine

import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.pow

// Temporal kernels — the Kotlin port of swift/Sources/FundamentalCore/Engine/Temporal.swift
// (temporal.ts) — WORLD TIME made computable.
//
// Fundamental keeps three clocks: simulation time (env.t/dt), experiential time (the
// platform metric pipeline), and world time — timestamps carried by the data itself.
// These kernels are clock 3: pure, deterministic maps from world timestamps to a 0..1
// weight. No Date() calls — the caller supplies nowMs. All arguments are epoch/duration
// milliseconds. Degenerate inputs never produce NaN.
//
// NOTE: like the Swift source, these run in Double — millisecond-epoch math needs the
// f64 range, deliberately distinct from the engine's f32 vector math.

/** One hour in milliseconds — `imminence`'s log-softening unit. */
const val HOUR_MS: Double = 3_600_000.0

/** One day in milliseconds — `retention`'s τ defaults are day-calibrated. */
const val DAY_MS: Double = 86_400_000.0

private fun clamp01(n: Double): Double = if (n < 0) 0.0 else if (n > 1) 1.0 else n

/**
 * How imminent a moment feels: 1 at (or past) the moment, log-ramping down to 0 at the
 * far edge of the horizon: `1 − ln(until/HOUR + 1) / ln(horizon/HOUR + 1)`. The one-hour
 * softening unit keeps the ramp finite at until = 0 and makes the last hours steepest.
 */
fun imminence(atMs: Double, nowMs: Double, horizonMs: Double): Double {
    if (!atMs.isFinite() || !nowMs.isFinite()) return 0.0
    val until = atMs - nowMs
    if (until <= 0) return 1.0
    if (!horizonMs.isFinite() || horizonMs <= 0) return 0.0
    return clamp01(1.0 - ln(until / HOUR_MS + 1.0) / ln(horizonMs / HOUR_MS + 1.0))
}

/**
 * Exponential newness decay — the recency shape in canonical form:
 * `freshness = 2^(−since / halfLife)` — 1 at the moment, exactly 0.5 one half-life
 * later. Future timestamps clamp to 1 — nothing is fresher than now.
 * (The complement is *staleness* = 1 − freshness, deliberately not exported.)
 */
fun freshness(atMs: Double, nowMs: Double, halfLifeMs: Double): Double {
    if (!atMs.isFinite() || !nowMs.isFinite()) return 0.0
    val since = nowMs - atMs
    if (since <= 0) return 1.0
    if (!halfLifeMs.isFinite() || halfLifeMs <= 0) return 0.0
    return 2.0.pow(-since / halfLifeMs)
}

/**
 * Ebbinghaus-shaped retention: `a · e^(−since / τ(a))` with τ(a) = tauBase + a·tauGrowth.
 * The stability term is the point: τ *grows* with anchor strength, so deeply anchored
 * facts decay slower. retention(a, 0) is exactly a; negative since clamps to 0.
 */
fun retention(
    anchor: Double,
    sinceMs: Double,
    tauBaseMs: Double = 4 * DAY_MS,
    tauGrowthMs: Double = 56 * DAY_MS,
): Double {
    val a = clamp01(if (anchor.isFinite()) anchor else 0.0)
    if (!sinceMs.isFinite()) return 0.0
    val since = kotlin.math.max(0.0, sinceMs)
    val tau = tauBaseMs + a * tauGrowthMs
    if (!tau.isFinite() || tau <= 0) return 0.0
    return a * exp(-since / tau)
}

/**
 * Cyclical phase: where nowMs sits inside a repeating period, ∈ [0, 1) — the wrap point
 * reads as 0, never 1. A true (sign-safe) modulo, so times before the offset wrap right.
 */
fun phase(nowMs: Double, periodMs: Double, offsetMs: Double = 0.0): Double {
    if (!nowMs.isFinite() || !offsetMs.isFinite()) return 0.0
    if (!periodMs.isFinite() || periodMs <= 0) return 0.0
    val m = (nowMs - offsetMs).rem(periodMs)
    val f = (if (m < 0) m + periodMs else m) / periodMs
    return if (f >= 1) 0.0 else f // float wrap guard: x + period can round to period
}
