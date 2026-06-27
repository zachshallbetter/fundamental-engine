package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Env
import com.fundamental.core.engine.Particle
import com.fundamental.core.forces.ChargeForce
import com.fundamental.core.forces.CollideForce
import com.fundamental.core.forces.DiffuseForce
import com.fundamental.core.forces.GravityForce
import com.fundamental.core.forces.MagnetismForce
import com.fundamental.core.forces.MemoryForce
import com.fundamental.core.forces.PropagateForce
import com.fundamental.core.forces.ThermalForce
import com.fundamental.core.math.Vec3
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// Natural primitives (§20.10). gravity/charge/magnetism are deterministic → checked against the exact
// formula; thermal (RNG), collide (neighbors), and the grid-backed three against a constructed Env.

class NaturalForcesTests {

    @Test
    fun gravityIsAttractiveInverseSquare() {
        val body = Body(tokens = listOf("gravity"), range = 300f, M = 1f)
        val p = Particle(position = Vec3.ZERO)
        val env = Env().apply { vector = Vec3(100f, 0f, 0f); dist = 100f; G = 1f; c = 12f } // body +x
        GravityForce().apply(body, p, env)

        // F = GM/(d²+ε²) toward the body (+x). ε = 2GM/c² is tiny, so ≈ 1/10000.
        val rs = 2f * 1f * 1f / (12f * 12f)
        val f = 1f / (100f * 100f + rs * rs)
        assertClose(f, p.velocity.x, tol = 1e-7f, msg = "gravity pull")
        assertTrue(p.velocity.x > 0f, "gravity attracts toward the body")
    }

    @Test
    fun chargeRepelsLikeSignsAndIgnoresNeutralMatter() {
        val body = Body(tokens = listOf("charge"), range = 300f, M = 1f, spin = 1f)
        val env = Env().apply { vector = Vec3(100f, 0f, 0f); dist = 100f; G = 1f; c = 12f }

        // q = +1, spin = +1 → s = −1 → pushed away from the body (−x): like signs repel.
        val charged = Particle().apply { charge = 1f }
        ChargeForce().apply(body, charged, env)
        assertTrue(charged.velocity.x < 0f, "like charges repel")

        // neutral matter ignores the charge field entirely.
        val neutral = Particle()
        ChargeForce().apply(body, neutral, env)
        assertEquals(Vec3.ZERO, neutral.velocity)
    }

    @Test
    fun magnetismTurnsVelocityWithoutChangingSpeed() {
        val body = Body(tokens = listOf("magnetism"), range = 300f, strength = 0.1f, spin = 1f)
        val env = Env().apply { dist = 150f } // falloff = 0.5
        val p = Particle(velocity = Vec3(1f, 0f, 0f)).apply { charge = 1f }
        MagnetismForce().apply(body, p, env)

        val theta = 1f * 1f * 0.1f * 0.5f // q·spin·B·falloff = 0.05
        assertClose(kotlin.math.cos(theta), p.velocity.x, msg = "rotated x")
        assertClose(kotlin.math.sin(theta), p.velocity.y, msg = "rotated y")
        assertClose(1f, p.velocity.length(), msg = "speed preserved (no work done)")
    }

    @Test
    fun thermalKicksMatterWhenHotAndIsInertWhenCold() {
        val body = Body(tokens = listOf("thermal"), range = 300f, strength = 1f)
        val hot = Particle()
        ThermalForce().apply(body, hot, Env().apply { dist = 10f; c = 12f })
        assertTrue(hot.velocity.length() > 0f, "a warm field agitates matter")

        // out of range → no kick.
        val cold = Particle()
        ThermalForce().apply(body, cold, Env().apply { dist = 1000f })
        assertEquals(Vec3.ZERO, cold.velocity)
    }

    @Test
    fun collideExchangesNormalMomentumElastically() {
        val body = Body(tokens = listOf("collide"), range = 300f, strength = 1f) // restitution 1
        val p = Particle(position = Vec3(0f, 0f, 0f), velocity = Vec3(1f, 0f, 0f))
        val q = Particle(position = Vec3(1.5f, 0f, 0f), velocity = Vec3(-1f, 0f, 0f))
        val env = Env().apply { dist = 10f; neighbors = { _, _ -> listOf(q) } }
        CollideForce().apply(body, p, env)

        // equal-mass elastic head-on → velocities exchange; both now separating.
        assertClose(-1f, p.velocity.x, msg = "p took q's velocity")
        assertClose(1f, q.velocity.x, msg = "q took p's velocity")
    }

    @Test
    fun diffuseFollowsTheGradientAndDeposits() {
        val stub = StubGrid(grad = Vec3(1f, 0f, 0f))
        val body = Body(tokens = listOf("diffuse"), range = 300f, strength = 1f)
        val p = Particle(position = Vec3(5f, 0f, 0f))
        DiffuseForce().apply(body, p, Env().apply { dist = 10f; grid = { stub } })

        assertClose(1f, p.velocity.x, msg = "steered up-gradient by strength")
        assertEquals(1, stub.deposits.size, "laid one mark")
        assertClose(1f, stub.deposits[0].second, msg = "deposit amount = strength")
    }

    @Test
    fun memoryAmplifiesPullByWornness() {
        val stub = StubGrid(sampleValue = 2f) // amp = 1 + 0.5·2 = 2
        val body = Body(tokens = listOf("memory"), range = 300f, strength = 1f)
        val p = Particle(position = Vec3(-10f, 0f, 0f))
        MemoryForce().apply(body, p, Env().apply { vector = Vec3(10f, 0f, 0f); dist = 10f; grid = { stub } })

        val falloff = 1f - 10f / 300f
        val expected = falloff * falloff * 0.5f * 2f // (1−d/r)²·strength·0.5·amp
        assertClose(expected, p.velocity.x, msg = "worn paths pull harder")
        assertClose(0.15f, stub.deposits[0].second, msg = "wear deposit = strength·0.15")
    }

    @Test
    fun propagateEmitsAShockTrainAndRidesTheFrontOutward() {
        val stub = StubGrid(grad = Vec3(1f, 0f, 0f))
        val body = Body(tokens = listOf("propagate"), range = 300f, strength = 1f).apply { isEngaged = true }
        val prop = PropagateForce()

        // source: deposits on the pulse frame, silent off it.
        prop.source(body, Env().apply { frameN = 0; grid = { stub } })
        assertEquals(1, stub.deposits.size, "emits on the pulse frame")
        prop.source(body, Env().apply { frameN = 1; grid = { stub } })
        assertEquals(1, stub.deposits.size, "silent between pulses")

        // apply: a passing front pushes matter radially OUTWARD (env.vector points inward).
        val p = Particle(position = Vec3(10f, 0f, 0f))
        prop.apply(body, p, Env().apply { vector = Vec3(10f, 0f, 0f); dist = 10f; c = 12f; grid = { stub } })
        assertClose(-7f, p.velocity.x, msg = "ride the front out (act·strength·WAVE_PUSH)")
    }
}
