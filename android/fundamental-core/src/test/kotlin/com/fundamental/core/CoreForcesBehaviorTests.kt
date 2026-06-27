package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.Env
import com.fundamental.core.engine.Particle
import com.fundamental.core.engine.Registry
import com.fundamental.core.forces.JetForce
import com.fundamental.core.forces.SinkForce
import com.fundamental.core.forces.WallForce
import com.fundamental.core.math.Vec3
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

// Behavioral parity for the three canonical forces the cross-plane golden can't cover with a single
// apply — jet (RNG cone), wall (box reflection), sink (stateful capture). Mirrors how the Swift port
// verifies them (EngineTests/ParityTests) rather than via GoldenConformanceTests.
// `assertClose` lives in TestSupport.kt.

class CoreForcesBehaviorTests {

    @Test
    fun registryHasTheCanonicalNine() {
        val forces = Registry.standardForces()
        // canonical nine + natural eight + extended nineteen = the full 36-token surface.
        assertEquals(36, forces.size)
        for (token in listOf("attract", "jet", "tether", "wall", "stream", "repel", "viscosity", "swirl", "sink")) {
            assertTrue(forces.containsKey(token), "missing canonical force '$token'")
            assertEquals(token, forces[token]!!.token)
        }
    }

    @Test
    fun wallReflectsVelocityAndPushesOut() {
        // 100×100 flat box at the origin; a particle just inside the +x face moving outward.
        val body = Body(tokens = listOf("wall"), box = Box(center = Vec3.ZERO, halfExtents = Vec3(50f, 50f, 0f)))
        val p = Particle(position = Vec3(48f, 0f, 0f), velocity = Vec3(2f, 0f, 0f))
        WallForce().apply(body, p, Env())

        // least penetration is the x face → reflect x, snap to center.x + he.x + pad (= 56), damp 0.85.
        assertClose(56f, p.position.x, msg = "snapped outside +x face")
        assertClose(-1.7f, p.velocity.x, msg = "x velocity reflected and damped")
        assertClose(0f, p.velocity.y)
        assertClose(0.8f, p.heat, msg = "hard impact heats (min(0.85, speed*0.4))")
    }

    @Test
    fun wallIgnoresParticlesOutsideTheBox() {
        val body = Body(tokens = listOf("wall"), box = Box(center = Vec3.ZERO, halfExtents = Vec3(50f, 50f, 0f)))
        val p = Particle(position = Vec3(200f, 0f, 0f), velocity = Vec3(2f, 0f, 0f))
        WallForce().apply(body, p, Env())
        assertEquals(Vec3(200f, 0f, 0f), p.position)
        assertEquals(Vec3(2f, 0f, 0f), p.velocity)
    }

    @Test
    fun sinkCapturesConservesAndSupernovasAtCapacity() {
        var supernovaed = false
        val body = Body(tokens = listOf("sink"), absorbR = 64f, capacity = 3f)
        val env = Env().apply { dist = 10f; supernova = { supernovaed = true } }
        val sink = SinkForce()

        // three distinct in-range particles → three captures, count conserved on the body.
        repeat(3) {
            val p = Particle(position = Vec3.ZERO)
            sink.apply(body, p, env)
            assertSame(body, p.cap, "captured particle points at the sink")
        }
        assertEquals(3f, body.accreted)
        assertTrue(supernovaed, "supernova fires when accreted reaches capacity")
    }

    @Test
    fun sinkIgnoresAlreadyCapturedAndOutOfRange() {
        val body = Body(tokens = listOf("sink"), absorbR = 64f, capacity = 30f)
        val sink = SinkForce()

        // out of range (dist ≥ absorbR) → no capture.
        val far = Particle()
        sink.apply(body, far, Env().apply { dist = 100f })
        assertNull(far.cap)
        assertEquals(0f, body.accreted)

        // a second apply on an already-captured particle does not double-count.
        val p = Particle()
        val env = Env().apply { dist = 10f }
        sink.apply(body, p, env)
        sink.apply(body, p, env)
        assertEquals(1f, body.accreted)
    }

    @Test
    fun jetFeedDrawsMatterTowardTheNozzle() {
        // outside the nozzle (dist ≥ 24) → an inward pull along env.vector.
        val body = Body(tokens = listOf("jet"), strength = 1f, range = 300f)
        val p = Particle(position = Vec3(-100f, 0f, 0f))
        val env = Env().apply { vector = Vec3(100f, 0f, 0f); dist = 100f } // body is +x of the particle
        JetForce().apply(body, p, env)

        val f = (1f - 100f / 300f) * (1f - 100f / 300f) * (0.25f + 1f * 0.15f)
        assertClose(f, p.velocity.x, msg = "feed pull magnitude along the vector")
        assertTrue(p.velocity.x > 0f, "pulled toward the body (+x)")
    }

    @Test
    fun jetNozzleRelaunchesAtConstantSpeed() {
        // inside the nozzle (dist < 24) → velocity is replaced with a hot jet of fixed speed.
        // The RNG only rotates the heading, so the speed is deterministic (rotation preserves length).
        val body = Body(tokens = listOf("jet"), strength = 1f, range = 300f)
        val p = Particle(position = Vec3(0f, -10f, 0f), velocity = Vec3(1f, 1f, 0f))
        val env = Env().apply { vector = Vec3(0f, 10f, 0f); dist = 10f }
        JetForce().apply(body, p, env)

        val spd = 2.4f + 1f * 2.6f // 5.0
        assertClose(spd, p.velocity.length(), tol = 1e-3f, msg = "relaunch speed")
        assertClose(26f, (p.position - body.center).length(), msg = "relaunched at the nozzle radius")
        assertClose(0.9f, p.heat, msg = "jet is hot")
    }
}
