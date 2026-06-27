package com.fundamental.platform

import kotlin.math.max
import kotlin.math.roundToInt

// MARK: - FieldPerf (platform/perf.ts)
//
// The frame-duration *measurement* (the QualityGovernor turns sustained overruns into a tier;
// this is the meter). Feed it frame timestamps (ms); read fps / budget / percentiles / dropped.
// Pure and host-driven — no timer of its own.
//
//   - deltas: consecutive feed() differences in a rolling window (default 180).
//   - discontinuity: a gap > 500 ms (tab switch / sleep) is ignored entirely — timing resumes.
//   - budget: the median of the first `budgetSeed` (default 30) clean deltas.
//   - dropped: once the budget exists, a delta > budget × 1.5 increments it (cumulative).

data class FieldPerfSnapshot(
    var fps: Int? = null,
    var budgetMs: Double? = null,
    var medianMs: Double? = null,
    var p95Ms: Double? = null,
    var p99Ms: Double? = null,
    var dropped: Int = 0,
    var frames: Int = 0,
)

class FieldPerf(window: Int = 180, budgetSeed: Int = 30) {
    companion object {
        private const val discontinuityMs: Double = 500.0
    }

    private val windowSize: Int = max(1, window)
    private val seedSize: Int = max(1, budgetSeed)
    private var lastTs: Double? = null
    private var deltas: MutableList<Double> = mutableListOf()
    private var seed: MutableList<Double> = mutableListOf()
    private var budget: Double? = null
    private var dropped = 0
    private var frames = 0

    /** Nearest-rank-by-floor percentile on a sorted copy (the DataConsole's `pct`); `null` empty. */
    private fun pct(arr: List<Double>, p: Double): Double? {
        if (arr.isEmpty()) return null
        val s = arr.sorted()
        return s[((p / 100) * (s.count() - 1).toDouble()).toInt()]
    }

    /** Feed one frame timestamp (ms). Gaps > 500 ms are skipped (discontinuity). */
    fun feed(frameTs: Double) {
        val last = lastTs ?: run { lastTs = frameTs; return }
        val d = frameTs - last
        lastTs = frameTs
        if (d > discontinuityMs) return // discontinuity: resume, count nothing
        deltas.add(d)
        if (deltas.count() > windowSize) deltas.removeAt(0)
        frames += 1
        if (budget == null && seed.count() < seedSize) {
            seed.add(d)
            if (seed.count() == seedSize) budget = pct(seed, 50.0)
        }
        val b = budget
        if (b != null && d > b * 1.5) dropped += 1 // seed-completing delta is checked too
    }

    fun snapshot(): FieldPerfSnapshot {
        val medianMs = pct(deltas, 50.0)
        return FieldPerfSnapshot(
            fps = medianMs?.let { (1000 / it).roundToInt() },
            budgetMs = budget,
            medianMs = medianMs,
            p95Ms = pct(deltas, 95.0),
            p99Ms = pct(deltas, 99.0),
            dropped = dropped,
            frames = frames,
        )
    }

    fun reset() {
        lastTs = null
        deltas = mutableListOf()
        seed = mutableListOf()
        budget = null
        dropped = 0
        frames = 0
    }
}
