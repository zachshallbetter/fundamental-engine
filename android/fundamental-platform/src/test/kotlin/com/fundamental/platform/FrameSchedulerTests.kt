package com.fundamental.platform

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// Ported from FundamentalPlatformTests/FrameSchedulerTests.swift — the six-phase loop discipline.
class FrameSchedulerTests {

    @Test
    fun phasesRunInDiscoverReadComputeStateWriteRenderOrder() {
        val scheduler = FrameScheduler()
        val ran = ArrayList<Phase>()
        for (phase in Phase.entries) scheduler.on(phase) { ran.add(phase) }
        scheduler.runFrame()
        assertEquals(Phase.entries.toList(), ran)
    }

    @Test
    fun handlerFiresOncePerFrame() {
        val scheduler = FrameScheduler()
        var count = 0
        scheduler.on(Phase.READ) { count += 1 }
        scheduler.runFrame()
        assertEquals(1, count)
    }

    @Test
    fun outOfOrderUnsubscribeRemovesTheRightHandler() {
        val scheduler = FrameScheduler()
        var hits = ArrayList<Int>()
        val off1 = scheduler.on(Phase.READ) { hits.add(1) }
        val off2 = scheduler.on(Phase.READ) { hits.add(2) }
        scheduler.on(Phase.READ) { hits.add(3) }
        off2() // remove the MIDDLE handler
        scheduler.runFrame()
        assertEquals(listOf(1, 3), hits)
        hits = ArrayList()
        off1()
        scheduler.runFrame()
        assertEquals(listOf(3), hits)
    }

    @Test
    fun frameCounterIncrementsEachRunFrame() {
        val scheduler = FrameScheduler()
        scheduler.runFrame()
        scheduler.runFrame()
        assertEquals(2, scheduler.frame)
    }

    @Test
    fun readPhaseViolationRecordedInNonStrictMode() {
        val scheduler = FrameScheduler(strict = false)
        scheduler.on(Phase.WRITE) { scheduler.assertReadPhase("measure") }
        val report = scheduler.runFrame()
        assertEquals(1, report.violations.size)
        assertEquals("measure", report.violations[0].op)
    }

    @Test
    fun geometryReadDuringReadPhaseIsAllowed() {
        val scheduler = FrameScheduler(strict = false)
        scheduler.on(Phase.READ) { scheduler.assertReadPhase("measure") }
        val report = scheduler.runFrame()
        assertTrue(report.violations.isEmpty())
    }

    @Test
    fun unsubscribeRemovesHandler() {
        val scheduler = FrameScheduler()
        var count = 0
        val unsub = scheduler.on(Phase.COMPUTE) { count += 1 }
        scheduler.runFrame()
        unsub()
        scheduler.runFrame()
        assertEquals(1, count)
    }

    @Test
    fun phasesWithNoHandlersAreSkippedInRan() {
        val scheduler = FrameScheduler()
        scheduler.on(Phase.RENDER) { }
        val report = scheduler.runFrame()
        assertEquals(listOf(Phase.RENDER), report.ran)
    }
}
