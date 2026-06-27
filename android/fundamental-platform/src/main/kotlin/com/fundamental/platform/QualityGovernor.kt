package com.fundamental.platform

import kotlin.math.max

// MARK: - QualityGovernor (platform/governor.ts)
//
// Detects sustained frame-budget overruns and emits a tier signal so the caller can adapt
// render quality without a hard cutoff. The governor *detects*; the caller *responds*.
//
//   0 = full quality       2 = minimal  (caller: render → dots, halve the particle cap)
//   1 = effects reduced     3 = paused   (caller: suspend the field loop)
//
// Feed it frame durations (ms); escalation fires after N consecutive overrun frames, recovery
// requires a longer clean run (asymmetric, to avoid thrashing at the boundary). Skip
// discontinuity frames and `reset()` on background/foreground transitions.

enum class QualityTier(val rawValue: Int) {
    FULL(0), REDUCED(1), MINIMAL(2), PAUSED(3);

    companion object {
        fun fromRaw(rawValue: Int): QualityTier? = entries.firstOrNull { it.rawValue == rawValue }
    }
}

class QualityGovernor(budgetMs: Double = 16.67) {
    private data class TierRule(val aboveMs: Double, val streak: Int, val tier: QualityTier)

    companion object {
        private val escalate: List<TierRule> = listOf(
            TierRule(aboveMs = 20.0, streak = 10, tier = QualityTier.REDUCED),
            TierRule(aboveMs = 33.0, streak = 5, tier = QualityTier.MINIMAL),
            TierRule(aboveMs = 50.0, streak = 3, tier = QualityTier.PAUSED),
        )
        private const val recoverStreak = 30 // clean frames before dropping a tier
    }

    private var _tier: QualityTier = QualityTier.FULL
    private var overrunStreak = 0
    private var cleanStreak = 0
    private val budget: Double = budgetMs

    val tier: QualityTier get() = _tier

    /** Feed one frame duration (ms). Returns the new tier when it changes, `null` when stable. */
    fun feed(durationMs: Double): QualityTier? {
        val overrun = durationMs > budget * 1.3
        if (overrun) {
            cleanStreak = 0
            overrunStreak += 1
            for (rule in escalate) {
                if (durationMs > rule.aboveMs &&
                    overrunStreak >= rule.streak &&
                    _tier.rawValue < rule.tier.rawValue
                ) {
                    _tier = rule.tier
                    return _tier
                }
            }
        } else {
            overrunStreak = 0
            if (_tier.rawValue > 0) {
                cleanStreak += 1
                if (cleanStreak >= recoverStreak) {
                    cleanStreak = 0
                    _tier = QualityTier.fromRaw(max(0, _tier.rawValue - 1)) ?: QualityTier.FULL
                    return _tier
                }
            }
        }
        return null
    }

    fun reset() {
        _tier = QualityTier.FULL
        overrunStreak = 0
        cleanStreak = 0
    }
}
