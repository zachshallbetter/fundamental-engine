package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.Env
import com.fundamental.core.engine.FieldStore
import com.fundamental.core.engine.Particle
import com.fundamental.core.engine.Registry
import com.fundamental.core.engine.StepInput
import com.fundamental.core.engine.step
import com.fundamental.core.math.Vec3
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// The deterministic, machine-independent half of the perf story (mirror of Swift's PerfRegressionTests):
// run a heavy field for many frames and assert the WORK stays bounded — count conserved (no leak /
// unbounded spawn), every value finite (no NaN/Inf blow-up), velocity and heat in range. This catches
// the perf-bug class that actually ships — a runaway allocation or a divergent integrator — without a
// clock. Wall-clock timing is deliberately not asserted (fill-rate-bound, machine-dependent).

class PerfRegressionTests {

    @Test
    fun heavyFieldStaysBoundedOverManyFrames() {
        val w = 6000f
        val h = 4000f
        val store = FieldStore()
        val forces = Registry.standardForces()
        val env = Env().apply {
            volume = Vec3(w, h, 0f)
            dt = 1f
            c = 12f
            G = 1f
            neighbors = { p, r -> store.neighbors(p, r) }
            spawn = { store.add(it) }
        }

        val rnd = Random(1234)
        repeat(1200) {
            store.add(
                Particle(
                    position = Vec3(rnd.nextFloat() * w, rnd.nextFloat() * h, 0f),
                    velocity = Vec3((rnd.nextFloat() - 0.5f) * 8f, (rnd.nextFloat() - 0.5f) * 8f, 0f),
                ),
            )
        }

        // a mix of conservative forces — no source/sink/mortal, so count must be exactly conserved.
        val bodies = listOf(
            Body(tokens = listOf("attract"), strength = 1.5f, range = 1200f, box = Box(center = Vec3(2000f, 2000f, 0f))).apply { isVisible = true },
            Body(tokens = listOf("swirl"), strength = 1.2f, range = 1500f, spin = 1.4f, box = Box(center = Vec3(4000f, 2000f, 0f))).apply { isVisible = true },
            Body(tokens = listOf("repel"), strength = 1f, range = 800f, box = Box(center = Vec3(3000f, 3200f, 0f))).apply { isVisible = true },
        )

        repeat(600) {
            store.reindex()
            step(StepInput(store, bodies, env, forces, separation = 0.5f))
            env.frameN += 1
            env.t += env.dt
        }

        // 1) count conserved — no leak, no unbounded spawn.
        assertEquals(1200, store.size, "particle count conserved across 600 frames")

        // 2) finiteness + bounds — no NaN/Inf, velocity within c, heat sane.
        val cap = env.c
        for (p in store.particles) {
            assertTrue(p.position.x.isFinite() && p.position.y.isFinite() && p.position.z.isFinite(), "finite position")
            assertTrue(p.velocity.x.isFinite() && p.velocity.y.isFinite() && p.velocity.z.isFinite(), "finite velocity")
            assertTrue(p.velocity.length() <= cap + 1e-3f, "velocity bounded by c (was ${p.velocity.length()})")
            assertTrue(p.heat in 0f..2f, "heat in range (was ${p.heat})")
        }
    }
}
