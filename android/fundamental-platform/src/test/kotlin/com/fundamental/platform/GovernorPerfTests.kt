package com.fundamental.platform

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

// Behavior coverage for the budget governors (QualityGovernor.kt + FieldPerf.kt) —
// ported from Swift's GovernorPerfTests.swift case-for-case.

class QualityGovernorTests {

    @Test
    fun escalatesToTier1After10SustainedOverrunFramesNotBefore() {
        val g = QualityGovernor()
        repeat(9) { assertNull(g.feed(25.0)) } // 25ms > 20, but streak < 10
        assertEquals(QualityTier.REDUCED, g.feed(25.0)) // the 10th trips it
        assertEquals(QualityTier.REDUCED, g.tier)
    }

    @Test
    fun aCleanFrameResetsTheOverrunStreak() {
        // Escalation needs CONSECUTIVE overruns.
        val g = QualityGovernor()
        repeat(9) { g.feed(25.0) }
        assertNull(g.feed(10.0)) // clean — streak resets
        repeat(9) { assertNull(g.feed(25.0)) }
        assertEquals(QualityTier.REDUCED, g.feed(25.0)) // needs a fresh run of 10
    }

    @Test
    fun recoveryIsAsymmetric30CleanFramesDropATier() {
        val g = QualityGovernor()
        repeat(10) { g.feed(25.0) }
        assertEquals(QualityTier.REDUCED, g.tier)
        repeat(29) { assertNull(g.feed(10.0)) } // not yet
        assertEquals(QualityTier.FULL, g.feed(10.0)) // the 30th recovers
    }

    @Test
    fun resetClearsTheTierAndStreaks() {
        val g = QualityGovernor()
        repeat(10) { g.feed(60.0) }
        g.reset()
        assertEquals(QualityTier.FULL, g.tier)
    }
}

class FieldPerfTests {

    @Test
    fun steady16msFramesReadBackAsFpsBudgetAndNothingDropped() {
        val p = FieldPerf(window = 180, budgetSeed = 30)
        var t = 0.0
        repeat(60) { p.feed(t); t += 16 }
        val s = p.snapshot()
        assertEquals(16.0, s.budgetMs)
        assertEquals(16.0, s.medianMs)
        assertEquals(63, s.fps) // round(1000/16) = 63
        assertEquals(0, s.dropped)
        assertEquals(59, s.frames) // 60 timestamps → 59 deltas
    }

    @Test
    fun aDiscontinuityGapOver500msIsIgnoredNotMeasured() {
        val p = FieldPerf()
        p.feed(0.0); p.feed(16.0) // one 16ms delta
        p.feed(2000.0) // a ~2s gap → skipped
        p.feed(2016.0) // resumes: another 16ms delta
        assertEquals(2, p.snapshot().frames) // the gap delta was not counted
    }

    @Test
    fun aDeltaPastBudgetTimes1Point5CountsAsDroppedOnceTheBudgetExists() {
        val p = FieldPerf(window = 180, budgetSeed = 5)
        var t = 0.0
        repeat(6) { p.feed(t); t += 16 } // 5 deltas seed budget = 16
        p.feed(t + 40) // a delta > 16 × 1.5 = 24 → dropped
        assertEquals(1, p.snapshot().dropped)
    }
}
