package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Env
import com.fundamental.core.engine.GridMode
import com.fundamental.core.engine.Particle
import com.fundamental.core.engine.ScalarGrid
import com.fundamental.core.engine.ScalarGridImpl
import com.fundamental.core.forces.ReliefForce
import com.fundamental.core.math.Vec3
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

// Height-aware fields (#443) — the `relief` coupling and the HELD grid mode it reads.
// Mirrors the JS `height-fields.test.ts` and the Swift `ReliefTests`.

class ReliefTests {

    private fun heldOver(sampler: (Float, Float) -> Float): ScalarGridImpl =
        ScalarGridImpl(800f, 600f, GridMode.HELD).apply { fillFrom(sampler) }

    private fun reliefBody(strength: Float = 1f, spin: Float = 1f) =
        Body(tokens = listOf("relief"), range = 0f, strength = strength, spin = spin) // range 0 => global

    private fun env(potential: ((String) -> ScalarGrid?)? = null) =
        Env().apply { dist = 1f; this.potential = potential }

    @Test
    fun transportsMatterDownTheDeclaredPotential() {
        val phi = heldOver { x, _ -> 0.01f * x } // h rises with x => -grad(Phi) points in -x
        val p = Particle(position = Vec3(400f, 300f, 0f))
        ReliefForce().apply(reliefBody(), p, env { phi })
        assertTrue(p.velocity.x < 0f, "expected downhill (-x), got ${p.velocity.x}")
        assertTrue(abs(p.velocity.y) < 1e-6f, "a slope in x alone must not push in y")
        assertClose(-0.01f, p.velocity.x, tol = 5e-5f) // dv = -grad(Phi)*S*G
    }

    @Test
    fun spinBelowZeroClimbsInstead() {
        val phi = heldOver { x, _ -> 0.01f * x }
        val p = Particle(position = Vec3(400f, 300f, 0f))
        ReliefForce().apply(reliefBody(spin = -1f), p, env { phi })
        assertTrue(p.velocity.x > 0f, "expected uphill (+x) under spin < 0, got ${p.velocity.x}")
    }

    @Test
    fun isAPureNoOpWithoutAChannel() {
        // the default path — Env.potential is null, so registration cannot couple
        val p = Particle(position = Vec3(400f, 300f, 0f))
        ReliefForce().apply(reliefBody(), p, env())
        assertEquals(Vec3.ZERO, p.velocity)

        // the channel was never registered, or has been removed
        val q = Particle(position = Vec3(400f, 300f, 0f))
        ReliefForce().apply(reliefBody(), q, env { null })
        assertEquals(Vec3.ZERO, q.velocity)
    }

    @Test
    fun aHostileChannelCannotProduceNonFiniteOrSuperluminalVelocity() {
        // NaN is the real exposure: a NaN velocity slips a `speed > c` test, so it is clamped where
        // the untrusted value enters the engine (at the raster), not downstream.
        val p = Particle(position = Vec3(400f, 300f, 0f))
        ReliefForce().apply(reliefBody(), p, env { heldOver { x, _ -> if (x > 400f) Float.NaN else 0.01f * x } })
        assertTrue(p.velocity.x.isFinite() && p.velocity.y.isFinite(), "NaN reached the velocity")

        // a cliff has an unbounded gradient — which is why the c-cap ships with the force
        val q = Particle(position = Vec3(400f, 300f, 0f))
        ReliefForce().apply(reliefBody(strength = 1000f), q, env { heldOver { x, _ -> if (x > 400f) 1e9f else 0f } })
        assertTrue(q.velocity.length() <= 12f + 1e-4f, "speed ${q.velocity.length()} exceeded c")
    }

    @Test
    fun flatGroundProducesNoImpulse() {
        val p = Particle(position = Vec3(400f, 300f, 0f))
        ReliefForce().apply(reliefBody(), p, env { heldOver { _, _ -> 7f } })
        assertEquals(Vec3.ZERO, p.velocity)
    }

    @Test
    fun aHeldGridNeverSteps() {
        val held = ScalarGridImpl(320f, 320f, GridMode.HELD).apply { fillFrom { x, _ -> 0.01f * x } }
        val before = held.sample(Vec3(160f, 160f, 0f))
        repeat(200) { held.step() }
        assertEquals(before, held.sample(Vec3(160f, 160f, 0f)), "held cells moved under step()")

        // the control: the same raster in the DEFAULT mode does erode, so the test is not vacuous
        val diffusing = ScalarGridImpl(320f, 320f, GridMode.DIFFUSE).apply { fillFrom { x, _ -> 0.01f * x } }
        val d0 = diffusing.sample(Vec3(160f, 160f, 0f))
        repeat(200) { diffusing.step() }
        assertNotEquals(d0, diffusing.sample(Vec3(160f, 160f, 0f)), "the diffuse control did not erode")
    }

    @Test
    fun fillFromIsExactAtCellCentresAndClampsNonFinite() {
        val g = ScalarGridImpl(320f, 320f, GridMode.HELD)
        g.fillFrom { x, y -> if (x == 64f && y == 64f) Float.POSITIVE_INFINITY else x + y }
        assertClose(128f, g.sample(Vec3(96f, 32f, 0f)), tol = 1e-2f)
        assertTrue(g.sample(Vec3(64f, 64f, 0f)).isFinite(), "infinity survived the raster")
    }
}
