package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.Particle
import com.fundamental.core.engine.SparkPool
import com.fundamental.core.engine.burstImpulse
import com.fundamental.core.engine.captureEdge
import com.fundamental.core.engine.energyDelta
import com.fundamental.core.engine.releaseCaptured
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.createField
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// Micro-reactions (§23): the energy/burst helpers, the spark pool (capped + decaying), accretion
// release (conserved), and the capture edge.

class ReactionsTests {

    @Test
    fun energyDeltaIsKineticLoss() {
        assertEquals(0.5f * 2f * (9f - 4f), energyDelta(2f, 3f, 2f), 1e-5f)
    }

    @Test
    fun burstImpulseFallsOffToZeroAtRadius() {
        val near = burstImpulse(Vec3(10f, 0f, 0f), 100f)
        assertTrue(near.dv.x > 0f && near.heat > 0f, "near the blast → outward kick + heat")
        val far = burstImpulse(Vec3(200f, 0f, 0f), 100f)
        assertEquals(Vec3.ZERO, far.dv, "outside the radius → inert")
    }

    @Test
    fun sparkPoolEmitsDecaysAndCaps() {
        val pool = SparkPool(rng = { 0.5f })
        pool.emit(Vec3.ZERO, power = 2f, color = "#ffffff")
        assertTrue(pool.count > 0, "emit creates sparks")
        repeat(30) { pool.update() } // life 1, −0.04/frame → gone by ~25 frames
        assertEquals(0, pool.count, "sparks fade and drop")
        // cap: flooding never exceeds the ceiling
        repeat(200) { pool.emit(Vec3.ZERO, power = 5f, color = null) }
        assertTrue(pool.count <= 280, "the pool is capped (was ${pool.count})")
    }

    @Test
    fun releaseCapturedEjectsConservedMatter() {
        val sink = Body(tokens = listOf("sink"), box = Box(center = Vec3(100f, 100f, 0f)))
        sink.absorbR = 40f
        sink.accreted = 3f
        val held = (0 until 3).map { Particle(position = Vec3(100f, 100f, 0f)).apply { cap = sink; age = 50f } }
        val released = releaseCaptured(held, sink)
        assertEquals(3, released.size, "all held matter is released")
        assertTrue(released.all { it.cap == null && it.age == null }, "released matter is freed + made immortal")
        assertTrue(released.all { (it.position - sink.center).length() > sink.absorbR }, "ejected past the absorb horizon")
        assertEquals(0f, sink.accreted, "the sink's load resets")
    }

    @Test
    fun captureEdgeFiresOnTransitions() {
        assertEquals(com.fundamental.core.engine.CaptureEvent.CAPTURED, captureEdge(false, true).fire)
        assertEquals(com.fundamental.core.engine.CaptureEvent.RELEASED, captureEdge(true, false).fire)
        assertEquals(null, captureEdge(true, true).fire)
    }

    @Test
    fun sparksEmitOnWallImpactThroughTheEngine() {
        val f = createField(400f, 400f, particleCount = 300, seed = 7)
        f.addBody(
            com.fundamental.core.runtime.BodySpec(tokens = listOf("wall"), rect = {
                Box(center = Vec3(200f, 200f, 0f), halfExtents = Vec3(90f, 90f, 0f))
            }),
        )
        f.flowTo(200f, 200f, strength = 3f, radius = 2000f) // drive matter into the wall
        repeat(40) { f.tick() }
        assertTrue(f.controller.sparks.count > 0, "wall impacts emit sparks via env.spark")
    }
}
