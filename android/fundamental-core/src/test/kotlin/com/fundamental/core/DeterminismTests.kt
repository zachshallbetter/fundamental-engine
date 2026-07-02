package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.Env
import com.fundamental.core.forces.JetForce
import com.fundamental.core.forces.ThermalForce
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.FieldController
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

// The determinism seam (#974) — the Kotlin mirror of the JS record/replay contract
// (packages/core/src/record/record.test.ts): a seeded run reproduces bit-for-bit, a different seed
// diverges. Every engine random draw — pool seeding, the integrator's brownian wander, thermal's
// Box–Müller kicks, jet's nozzle cone, spawn's emission cone, spark counts + directions — flows
// through the one injected source ([Env.rng], fed by `FieldController(seed = …)`), so the whole-run
// fingerprint below is exact equality, not tolerance.

class DeterminismTests {

    /**
     * A run that exercises every rng consumer: the ambient formation (wander = 1.0 → the
     * integrator's periodic brownian kick), a `thermal` body (Box–Müller uniforms), a `jet`
     * body (nozzle-cone spread), a `spawn` body (emission cone + speed), and a spark emission
     * (count + directions through the SparkPool's injected rng).
     */
    private fun fingerprint(seed: Long, frames: Int = 120): List<Float> {
        val fc = FieldController(width = 800f, height = 600f, particleCount = 150, seed = seed)
        fc.setFormation("ambient") // wander = 1.0 — the integrator jitter fires every 40 frames
        fc.addBody(Body(tokens = listOf("thermal"), strength = 1.2f, range = 500f, box = Box(center = Vec3(400f, 300f, 0f))))
        fc.addBody(Body(tokens = listOf("jet"), strength = 1f, range = 320f, box = Box(center = Vec3(150f, 300f, 0f))))
        fc.addBody(Body(tokens = listOf("spawn"), strength = 0.6f, range = 200f, box = Box(center = Vec3(650f, 150f, 0f))))
        repeat(frames) { fc.tick() }
        fc.sparks.emit(Vec3(100f, 100f, 0f), 2f, null)
        val out = ArrayList<Float>(fc.particleCount * 7 + fc.sparks.count * 4)
        for (p in fc.particles) {
            out.add(p.position.x); out.add(p.position.y); out.add(p.position.z)
            out.add(p.velocity.x); out.add(p.velocity.y); out.add(p.velocity.z)
            out.add(p.heat)
        }
        for (s in fc.sparks.sparks) {
            out.add(s.position.x); out.add(s.position.y)
            out.add(s.velocity.x); out.add(s.velocity.y)
        }
        return out
    }

    @Test
    fun sameSeedReproducesTheRunExactly() {
        val a = fingerprint(seed = 42)
        val b = fingerprint(seed = 42)
        assertTrue(a.isNotEmpty(), "the run produced a non-empty fingerprint")
        assertEquals(a, b, "same seed → bit-identical particle + spark state after 120 frames")
    }

    @Test
    fun differentSeedDiverges() {
        val a = fingerprint(seed = 1)
        val b = fingerprint(seed = 2)
        assertNotEquals(a, b, "distinct seeds must not produce the same run")
    }

    @Test
    fun thermalDrawsFromTheInjectedRng() {
        // the seam itself, at a single force: thermal's Box–Müller uniforms come from Env.rng,
        // never a private generator — an injected counter proves the draws route through it.
        var draws = 0
        val env = Env().apply {
            rng = { draws++; 0.5f }
            dist = 10f
            volume = Vec3(800f, 600f, 0f)
        }
        val b = Body(tokens = listOf("thermal"), strength = 2f, range = 100f, box = Box(center = Vec3(0f, 0f, 0f)))
        ThermalForce().apply(b, com.fundamental.core.engine.Particle(), env)
        assertEquals(2, draws, "a planar thermal kick draws exactly its two Box–Müller uniforms from Env.rng")
    }

    @Test
    fun jetNozzleDrawsFromTheInjectedRng() {
        var draws = 0
        val env = Env().apply {
            rng = { draws++; 0.5f }
            dist = 10f // inside the nozzle (< 24)
        }
        val b = Body(tokens = listOf("jet"), strength = 1f, range = 200f, box = Box(center = Vec3(0f, 0f, 0f)))
        JetForce().apply(b, com.fundamental.core.engine.Particle(), env)
        assertEquals(1, draws, "the jet's nozzle-cone spread draws from Env.rng")
    }
}
