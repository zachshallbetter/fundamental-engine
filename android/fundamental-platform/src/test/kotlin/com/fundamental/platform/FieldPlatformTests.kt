package com.fundamental.platform

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.FieldVolume
import com.fundamental.core.math.Vec3
import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

// The coordinator wiring: read → measure, write → flush, under the six-phase scheduler.
// TestHost lives in TestHosts.kt (shared with RegistriesTests).

class FieldPlatformTests {

    @Test
    fun tickRunsReadAndWriteAndMeasuresRegisteredBodies() {
        val host = TestHost(FieldVolume(400f, 300f, depth = 20f))
        val platform = FieldPlatform(host)
        val body = Body(tokens = listOf("attract"))
        body.box = Box(center = Vec3(200f, 150f, 10f), halfExtents = Vec3(20f, 20f, 10f))
        platform.measure.register(body)

        val report = platform.tick(now = 1.0)

        assertTrue(Phase.READ in report.ran && Phase.WRITE in report.ran, "read + write phases ran")
        assertTrue(report.violations.isEmpty(), "a clean tick has no phase violations")
        val m = platform.measure.measurement(body)
        assertNotNull(m, "the registered body was measured")
        assertTrue(m.isVisible, "a body fully inside the volume reads as visible (ratio > 0)")
    }

    @Test
    fun measuringOffTheReadPhaseRecordsAViolation() {
        val host = TestHost(FieldVolume(200f, 200f))
        val platform = FieldPlatform(host)
        // a stray measurement during the render phase is an off-phase geometry read.
        platform.on(Phase.RENDER) { ctx -> platform.measure.measure(now = ctx.now, volume = ctx.volume, host = host) }
        val report = platform.tick()
        assertTrue(report.violations.any { it.op == "measure" }, "off-phase measure is recorded as a violation")
    }
}
