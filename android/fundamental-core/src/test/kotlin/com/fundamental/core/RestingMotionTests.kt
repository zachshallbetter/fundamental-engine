package com.fundamental.core

import com.fundamental.core.engine.RESTING_FLOW_K
import com.fundamental.core.engine.RestingMotion
import com.fundamental.core.engine.RestingMotionMode
import com.fundamental.core.engine.restingFlow
import com.fundamental.core.runtime.FieldController
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

// The resting-motion floor (board #24 "resting liveliness") — the Kotlin mirror of
// packages/core/src/resting-motion-floor.test.ts. DECLARED, default OFF: an idle field with the ambient
// drift stilled settles to rest (the default step is unchanged — the golden stays byte-identical); the
// THERMAL and FLOW floors each keep it alive with nothing drawn; FLOW is divergence-free by construction;
// THERMAL draws through the seeded rng so a run reproduces.
class RestingMotionTests {

    private fun idle(seed: Long, resting: RestingMotion?): FieldController =
        FieldController(800f, 600f, 0f, particleCount = 200, seed = seed, ambientOrbit = 0f, ambientWander = 0f, restingMotion = resting)
            .also { it.setFormation("ambient") }

    private fun positions(c: FieldController): List<Pair<Float, Float>> = c.particles.map { it.position.x to it.position.y }

    /** mean per-frame displacement over `frames` frames (edge wraps excluded). */
    private fun meanStep(c: FieldController, frames: Int = 30): Float {
        var sum = 0f; var n = 0
        var prev = positions(c)
        repeat(frames) {
            c.tick()
            val cur = positions(c)
            for (i in cur.indices) {
                val dx = cur[i].first - prev[i].first; val dy = cur[i].second - prev[i].second
                if (abs(dx) > 50f || abs(dy) > 50f) continue
                sum += hypot(dx, dy); n++
            }
            prev = cur
        }
        return if (n == 0) 0f else sum / n
    }

    private fun settled(resting: RestingMotion?, seed: Long = 1): Float {
        val c = idle(seed, resting)
        repeat(240) { c.tick() } // let the seeded launch velocities decay (0.95^240 ≈ 4e-6)
        return meanStep(c)
    }

    @Test
    fun restingFlowIsDivergenceFreeByConstructionAndNotTrivial() {
        val rng = Random(42); val h = 1e-2f
        var maxDiv = 0f; var maxMag = 0f
        repeat(200) {
            val x = rng.nextFloat() * 800f; val y = rng.nextFloat() * 600f; val phase = rng.nextFloat() * 6.2832f
            val dvxdx = (restingFlow(x + h, y, phase).x - restingFlow(x - h, y, phase).x) / (2f * h)
            val dvydy = (restingFlow(x, y + h, phase).y - restingFlow(x, y - h, phase).y) / (2f * h)
            maxDiv = maxOf(maxDiv, abs(dvxdx + dvydy))
            val v = restingFlow(x, y, phase); maxMag = maxOf(maxMag, hypot(v.x, v.y))
        }
        assertTrue(maxDiv < 1e-3f, "∂vx/∂x + ∂vy/∂y should vanish everywhere (max $maxDiv; f32 finite differences)")
        assertTrue(maxMag > 0.5f, "the flow field is not the zero field")
        assertTrue(RESTING_FLOW_K > 0f)
    }

    @Test
    fun offIsReallyOffAnIdleFieldSettlesToRest() {
        val s = settled(null)
        assertTrue(s < 0.02f, "idle mean step should be ≈0 with the floor off, got $s")
    }

    @Test
    fun theThermalFloorKeepsAnIdleFieldAlive() {
        val s = settled(RestingMotion(RestingMotionMode.THERMAL))
        assertTrue(s > 0.08f, "thermal floor should lift the idle mean step well above rest, got $s")
    }

    @Test
    fun theFlowFloorKeepsAnIdleFieldAlive() {
        val s = settled(RestingMotion(RestingMotionMode.FLOW))
        assertTrue(s > 0.08f, "flow floor should lift the idle mean step well above rest, got $s")
    }

    @Test
    fun strengthZeroIsTheOffPathAndStrengthScalesTheFloor() {
        assertTrue(settled(RestingMotion(RestingMotionMode.THERMAL, 0f)) < 0.02f, "strength 0 is off")
        val one = settled(RestingMotion(RestingMotionMode.THERMAL, 1f)); val two = settled(RestingMotion(RestingMotionMode.THERMAL, 2f))
        assertTrue(two > one * 1.5f, "strength 2 moves matter more than strength 1 ($two vs $one)")
    }

    @Test
    fun thermalDrawsThroughTheSeededRngSoARunReproduces() {
        fun run(seed: Long): List<Pair<Float, Float>> { val c = idle(seed, RestingMotion(RestingMotionMode.THERMAL)); repeat(120) { c.tick() }; return positions(c) }
        assertEquals(run(7), run(7), "same seed → identical positions")
        assertNotEquals(run(7), run(8), "different seed → different positions")
    }
}
