package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.FieldHost
import com.fundamental.core.engine.FieldProjection
import com.fundamental.core.engine.FieldVolume
import com.fundamental.core.engine.FlatProjection
import com.fundamental.core.runtime.FieldEvent
import com.fundamental.core.runtime.PARTICLE_STRIDE
import com.fundamental.core.runtime.createField
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.sqrt
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// Pause / resume (the Swift #605 mirror — PauseResumeTests.swift, test-for-test).
//
// The loop-lifecycle contract: `pause()` cancels the host-scheduled loop without touching simulation
// state, `resume()` restarts it, both are idempotent, and the host's visibility seam drives the same
// gate automatically (presentation-aware auto-pause). All through the FieldHost seam —
// HeadlessFieldHost stands in for the Choreographer hosts, so this runs on the plain JVM.

/**
 * The Kotlin mirror of the Swift tests' `HeadlessFieldHost`: manual frame delivery ([fire]) + a
 * test-settable presentation state delivered through [fireVisibility].
 */
private class HeadlessFieldHost : FieldHost {
    override val volume = FieldVolume(width = 375f, height = 812f)
    override val projection: FieldProjection = FlatProjection()
    override fun scanBodies(): List<Body> = emptyList()
    override fun worldBox(view: Any): Box? = null

    /** Presentation state — set by tests, delivered via [fireVisibility] (#605). */
    var hidden = false
    override val isHidden: Boolean get() = hidden

    /** How many times the engine (re)scheduled the loop — the pause/resume idempotency probe (#605). */
    var scheduleCount = 0
        private set
    var cancelCalled = false
        private set
    private var frameCallback: ((Double) -> Unit)? = null
    private val visibilityCallbacks = ArrayList<() -> Unit>()

    override fun scheduleFrame(callback: (Double) -> Unit): Any {
        frameCallback = callback
        scheduleCount += 1
        return Any()
    }

    override fun cancelFrame(token: Any) {
        cancelCalled = true
        frameCallback = null
    }

    override fun onVisibility(callback: () -> Unit): () -> Unit {
        visibilityCallbacks.add(callback)
        return { visibilityCallbacks.remove(callback) }
    }

    /** Drive one frame synchronously (timestamp in milliseconds — the contract's units). */
    fun fire(atMs: Double) {
        frameCallback?.invoke(atMs)
    }

    /** Deliver a visibility change to the engine (the seam the lifecycle events use). */
    fun fireVisibility() {
        visibilityCallbacks.toList().forEach { it() }
    }
}

class PauseResumeTests {

    @Test
    fun pauseStopsTicksResumeRestartsStateSurvives() {
        val host = HeadlessFieldHost()
        val field = createField(host, seed = 7L)
        var ticks = 0
        field.on(FieldEvent.TICK) { ticks++ }

        host.fire(0.0)
        assertEquals(1, ticks)

        field.pause()
        host.fire(1000.0 / 60) // the loop is cancelled — nothing to fire
        assertEquals(1, ticks)
        assertEquals(300, field.particleCount()) // simulation state retained, not torn down

        field.resume()
        host.fire(2000.0 / 60)
        assertEquals(2, ticks)
        field.destroy()
    }

    @Test
    fun doublePauseAndDoubleResumeAreNoOps() {
        val host = HeadlessFieldHost()
        val field = createField(host, seed = 7L)
        var ticks = 0
        field.on(FieldEvent.TICK) { ticks++ }
        assertEquals(1, host.scheduleCount) // the boot schedule

        field.pause()
        field.pause() // second pause: already stopped — no crash, still paused
        host.fire(0.0)
        assertEquals(0, ticks)

        field.resume()
        assertEquals(2, host.scheduleCount)
        field.resume() // second resume: already running — must NOT reschedule a second loop
        assertEquals(2, host.scheduleCount)
        host.fire(1000.0 / 60)
        assertEquals(1, ticks) // exactly one live loop
        field.destroy()
    }

    @Test
    fun visibilitySeamAutoPausesWhileHiddenResumesOnReturn() {
        val host = HeadlessFieldHost()
        val field = createField(host, seed = 7L)
        var ticks = 0
        field.on(FieldEvent.TICK) { ticks++ }

        host.hidden = true
        host.fireVisibility() // activity stopped / view detached / isPaused SPI flipped
        host.fire(0.0)
        assertEquals(0, ticks) // the loop was cancelled, not just guard-skipped
        assertTrue(host.cancelCalled)

        host.hidden = false
        host.fireVisibility() // back on screen
        host.fire(1000.0 / 60)
        assertEquals(1, ticks)
        field.destroy()
    }

    @Test
    fun explicitPauseIsStickyAcrossAVisibilityResume() {
        val host = HeadlessFieldHost()
        val field = createField(host, seed = 7L)
        var ticks = 0
        field.on(FieldEvent.TICK) { ticks++ }

        field.pause()
        host.hidden = true
        host.fireVisibility()
        host.hidden = false
        host.fireVisibility() // host says visible again — but the caller's pause holds
        host.fire(0.0)
        assertEquals(0, ticks)

        field.resume() // only the explicit resume releases it
        host.fire(1000.0 / 60)
        assertEquals(1, ticks)
        field.destroy()
    }

    @Test
    fun noTimeJumpOnResume() {
        val host = HeadlessFieldHost()
        val field = createField(host, seed = 7L)
        field.burst(187f, 406f) // give matter real velocity
        host.fire(0.0)
        host.fire(1000.0 / 60)

        val n = field.particleCount()
        val before = FloatArray(n * PARTICLE_STRIDE)
        assertEquals(n, field.readParticles(before))

        field.pause()
        field.resume()
        host.fire(100_000.0) // a ~100 s wall-clock gap across the pause

        val after = FloatArray(n * PARTICLE_STRIDE)
        assertEquals(n, field.readParticles(after))
        // One resumed frame moves matter one frame's worth (dt re-based to 1), never 100 s worth.
        // Displacement is measured modulo the toroidal wrap so an edge crossing doesn't read as a jump.
        fun wrapped(d: Float, span: Float): Float = min(abs(d), span - abs(d))
        var maxDisplacement = 0f
        for (i in 0 until n) {
            val dx = wrapped(after[i * PARTICLE_STRIDE] - before[i * PARTICLE_STRIDE], 375f)
            val dy = wrapped(after[i * PARTICLE_STRIDE + 1] - before[i * PARTICLE_STRIDE + 1], 812f)
            maxDisplacement = maxOf(maxDisplacement, sqrt(dx * dx + dy * dy))
        }
        // env.c caps speed at 12 px/frame; dt = 1 on the resumed frame ⇒ ≲ 12 px + wander. A real
        // 100 s time-jump would integrate ~6000 dt-units and land far beyond any per-frame bound.
        assertTrue(maxDisplacement < 40f, "one resumed frame displaced matter $maxDisplacement px — a time-jump")
        field.destroy()
    }

    @Test
    fun attachWhileHiddenDoesNotScheduleAnIdleLoop() {
        // A field born hidden (surface not yet attached / off screen) must not burn display-sync
        // callbacks: attach() seeds the presentation lane from host.isHidden, so nothing schedules
        // until the first visibility resume.
        val host = HeadlessFieldHost()
        host.hidden = true
        val field = createField(host, seed = 7L)
        var ticks = 0
        field.on(FieldEvent.TICK) { ticks++ }
        assertEquals(0, host.scheduleCount)

        host.hidden = false
        host.fireVisibility() // the surface came on screen — NOW the loop starts
        assertEquals(1, host.scheduleCount)
        host.fire(0.0)
        assertEquals(1, ticks)
        field.destroy()
    }

    @Test
    fun resumeAfterDestroyStaysDead() {
        val host = HeadlessFieldHost()
        val field = createField(host, seed = 7L)
        assertEquals(1, host.scheduleCount)
        field.destroy()
        field.resume() // must not resurrect the loop on a torn-down field
        assertEquals(1, host.scheduleCount)
    }
}
