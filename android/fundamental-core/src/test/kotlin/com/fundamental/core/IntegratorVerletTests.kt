package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.Env
import com.fundamental.core.engine.FRICTION
import com.fundamental.core.engine.FieldStore
import com.fundamental.core.engine.Force
import com.fundamental.core.engine.IntegratorMode
import com.fundamental.core.engine.Particle
import com.fundamental.core.engine.StepInput
import com.fundamental.core.engine.step
import com.fundamental.core.forces.AttractForce
import com.fundamental.core.math.Vec3
import kotlin.math.pow
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

// Velocity-Verlet integrator mode (#659, the JS #958 mirror) — the opt-in second-order scheme,
// pinned test-for-test against packages/core/src/core/integrator-verlet.test.ts.
//
// Pins: (1) the default (LEGACY) trajectory is untouched by the new code paths; (2) pure drift
// (a = 0) reduces exactly to the legacy step; (3) the half-step average follows the
// stored-acceleration equations (`x += v·dt + ½·a·dt²`, then `v += ½·(a + a′)·dt`) to the digit;
// (4) a kinematic (velocity-REPLACING) force is treated as a discontinuity — never averaged — and
// resets the stored acceleration; (5) the particle-count invariant holds over a long forced run
// (the one strong invariant of the caveat canon). Plus the seam pin the JS keeps in its own suite:
// FIXED at dt = 1 is the legacy step, and dt-scales the decay away from it.

private fun makeEnv(mode: IntegratorMode = IntegratorMode.LEGACY, frame: Int = 1): Env = Env().apply {
    volume = Vec3(1000f, 800f, 0f)
    dt = 1f
    frameN = frame
    integrator = mode
}

// the attract body used throughout: at (100,100) vs center x 250 (range 300) the frame-0 Δvx is
// exactly 0.125 — the same geometry the JS suite pins.
private fun attractBody(): Body = Body(
    tokens = listOf("attract"),
    strength = 1f,
    range = 300f,
    box = Box(center = Vec3(250f, 100f, 0f), halfExtents = Vec3(50f, 20f, 0f)),
).apply { isVisible = true }

private fun runStep(store: FieldStore, bodies: List<Body>, forces: Map<String, Force>, env: Env) {
    store.reindex()
    step(StepInput(store, bodies, env, forces))
}

class IntegratorVerletTests {
    private val attract: Map<String, Force> = mapOf("attract" to AttractForce())

    @Test
    fun pureDriftReducesExactlyToTheLegacyStep() {
        val legacyStore = FieldStore()
        val legacy = Particle(position = Vec3(100f, 100f, 0f), velocity = Vec3(2f, 0f, 0f))
        legacyStore.add(legacy)
        runStep(legacyStore, emptyList(), emptyMap(), makeEnv())

        val verletStore = FieldStore()
        val verlet = Particle(position = Vec3(100f, 100f, 0f), velocity = Vec3(2f, 0f, 0f))
        verletStore.add(verlet)
        runStep(verletStore, emptyList(), emptyMap(), makeEnv(IntegratorMode.VELOCITY_VERLET))

        // Δv = 0 and a(t) = 0 ⇒ x += v·dt and v(t+dt) = v(t), then the same (dt = 1) decay.
        assertEquals(legacy.position.x, verlet.position.x, "x identical with no acceleration")
        assertEquals(legacy.velocity.x, verlet.velocity.x, "vx identical with no acceleration")
        assertEquals(102f, legacy.position.x, "sanity: drift moved v·dt")
        assertEquals(2f * FRICTION, legacy.velocity.x, "sanity: one decay applied")
    }

    @Test
    fun defaultModeTrajectoryIsUnchangedToTheDigit() {
        // The golden regen is the cross-plane proof; this pins the same fact in-tree. Legacy order is
        // forces → x += v·dt → decay, so from rest under attract: vx = Δv, x += Δv·dt, vx *= FRICTION.
        val store = FieldStore()
        val p = Particle(position = Vec3(100f, 100f, 0f))
        store.add(p)
        runStep(store, listOf(attractBody()), attract, makeEnv())
        assertEquals(100.125f, p.position.x, "legacy position: x += Δv·dt with Δv = 0.125")
        assertEquals(0.125f * FRICTION, p.velocity.x, "legacy velocity: Δv then one decay")
    }

    @Test
    fun halfStepAverageFollowsTheStoredAccelerationEquationsExactly() {
        // From rest with no stored acceleration: the position full-step is a no-op (v = a = 0), the
        // force pass lands Δv = 0.125 at the unmoved position, and the half-step average takes half:
        // v = v0 + ½(a·dt + Δv) = 0.0625, then the dt-scaled decay (dt = 1 ⇒ ·FRICTION). The pass's
        // Δv/dt is stored as a(t) for the next step.
        val store = FieldStore()
        val p = Particle(position = Vec3(100f, 100f, 0f))
        store.add(p)
        runStep(store, listOf(attractBody()), attract, makeEnv(IntegratorMode.VELOCITY_VERLET))
        assertEquals(100f, p.position.x, "step 1 position full-step is a no-op from rest")
        assertEquals(0.0625f * FRICTION, p.velocity.x, "v(t+dt) = ½·Δv, then one decay")
        assertEquals(0.125f, p.accel?.x, "the pass Δv/dt is stored as a(t) for the next step")

        // Step 2: the position full-step now carries both lanes — x += v·dt + ½·a·dt².
        val v1 = p.velocity.x
        runStep(store, listOf(attractBody()), attract, makeEnv(IntegratorMode.VELOCITY_VERLET, frame = 2))
        val expectedX = 100f + v1 * 1f + 0.5f * 0.125f * 1f * 1f
        assertClose(expectedX, p.position.x, tol = 1e-4f, msg = "step 2 x = x + v·dt + ½·a·dt²")
    }

    @Test
    fun trajectoryIsSecondOrderAndDiffersFromLegacy() {
        val legacyStore = FieldStore()
        val legacy = Particle(position = Vec3(100f, 100f, 0f))
        legacyStore.add(legacy)
        val verletStore = FieldStore()
        val verlet = Particle(position = Vec3(100f, 100f, 0f))
        verletStore.add(verlet)
        for (i in 1..5) {
            runStep(legacyStore, listOf(attractBody()), attract, makeEnv(frame = i))
            runStep(verletStore, listOf(attractBody()), attract, makeEnv(IntegratorMode.VELOCITY_VERLET, frame = i))
        }
        assertTrue(legacy.position.x > 100f && verlet.position.x > 100f, "both schemes move toward the body")
        assertTrue(verlet.position.x.isFinite() && verlet.velocity.x.isFinite(), "verlet stays finite")
        assertNotEquals(legacy.position.x, verlet.position.x, "the second-order trajectory differs from semi-implicit Euler")
    }

    @Test
    fun kinematicForceIsADiscontinuityNeverAveraged() {
        // A kinematic force REPLACES velocity (a bounce/relaunch). Averaging it with v(t) would gut
        // the reflection (a head-on bounce would stall near 0) — the mode must let it stand and reset
        // the stored acceleration so the next position step doesn't extrapolate across the break.
        val relaunch = object : Force {
            override val token = "relaunch"
            override val label = "Relaunch"
            override val isKinematic = true
            override fun apply(body: Body, particle: Particle, env: Env) {
                particle.velocity = Vec3(-5f, particle.velocity.y, particle.velocity.z)
            }
        }
        val store = FieldStore()
        val p = Particle(position = Vec3(100f, 100f, 0f), velocity = Vec3(2f, 0f, 0f))
        p.accel = Vec3(0.4f, 0f, 0f) // a stored acceleration that must be dropped
        store.add(p)
        val body = Body(
            tokens = listOf("relaunch"),
            strength = 1f,
            range = 300f,
            box = Box(center = Vec3(100f, 100f, 0f), halfExtents = Vec3(50f, 20f, 0f)),
        ).apply { isVisible = true }
        runStep(store, listOf(body), mapOf("relaunch" to relaunch), makeEnv(IntegratorMode.VELOCITY_VERLET))
        assertEquals(-5f * FRICTION, p.velocity.x, "the replaced velocity stands (only the decay applies)")
        assertEquals(Vec3.ZERO, p.accel, "the stored acceleration resets at the discontinuity")
    }

    @Test
    fun particleCountInvariantHoldsOverALongForcedRun() {
        val store = FieldStore()
        repeat(24) { i ->
            store.add(
                Particle(
                    position = Vec3(40f * (i + 1), 60f + 25f * i, 0f),
                    velocity = Vec3((i % 5 - 2).toFloat(), (i % 3 - 1).toFloat(), 0f),
                ),
            )
        }
        val before = store.size
        for (i in 1..50) {
            runStep(
                store,
                listOf(attractBody()),
                attract,
                makeEnv(IntegratorMode.VELOCITY_VERLET, frame = i).apply { t = i / 60f },
            )
        }
        assertEquals(before, store.size, "no matter created or destroyed")
        for (p in store.particles) {
            assertTrue(p.position.x.isFinite() && p.position.y.isFinite(), "positions stay finite")
            assertTrue(p.velocity.x.isFinite() && p.velocity.y.isFinite(), "velocities stay finite")
        }
    }

    @Test
    fun fixedModeIsLegacyAtDtOneAndDtScalesTheDecay() {
        // The FIXED seam ships with the same enum (doc 04 §Step 3): at dt = 1 it is the legacy step
        // to the digit (`x^1 == x`) …
        val legacyStore = FieldStore()
        val legacy = Particle(position = Vec3(100f, 100f, 0f))
        legacyStore.add(legacy)
        val fixedStore = FieldStore()
        val fixed = Particle(position = Vec3(100f, 100f, 0f))
        fixedStore.add(fixed)
        for (i in 1..5) {
            runStep(legacyStore, listOf(attractBody()), attract, makeEnv(frame = i))
            runStep(fixedStore, listOf(attractBody()), attract, makeEnv(IntegratorMode.FIXED, frame = i))
        }
        assertEquals(legacy.position.x, fixed.position.x, "FIXED at dt = 1 is the legacy trajectory")
        assertEquals(legacy.velocity.x, fixed.velocity.x, "FIXED at dt = 1 is the legacy velocity")

        // … and away from dt = 1 the per-step decay scales (`FRICTION^dt`), frame-rate independent.
        val halfStore = FieldStore()
        val half = Particle(position = Vec3(100f, 100f, 0f), velocity = Vec3(2f, 0f, 0f))
        halfStore.add(half)
        runStep(halfStore, emptyList(), emptyMap(), makeEnv(IntegratorMode.FIXED).apply { dt = 0.5f })
        assertEquals(101f, half.position.x, "position integrates v·dt")
        assertClose(2f * FRICTION.pow(0.5f), half.velocity.x, tol = 1e-6f, msg = "FIXED dt-scales the decay")
    }
}
