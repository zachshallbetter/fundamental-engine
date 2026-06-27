package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.Env
import com.fundamental.core.engine.FieldStore
import com.fundamental.core.engine.Formation
import com.fundamental.core.engine.Particle
import com.fundamental.core.engine.Registry
import com.fundamental.core.engine.StepInput
import com.fundamental.core.engine.energyReport
import com.fundamental.core.engine.step
import com.fundamental.core.math.Vec3
import kotlin.math.cos
import kotlin.math.sin
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// The integrator driven headlessly — the Kotlin counterpart of Swift's core-level EngineTests. A tiny
// driver advances real frames synchronously and asserts real behavior (matter gathers, friction bleeds
// energy, flat fields stay planar, sinks capture, sources create/expire, count is conserved).

private class Sim(width: Float = 6000f, height: Float = 4000f, depth: Float = 0f) {
    val store = FieldStore()
    val forces = Registry.standardForces()
    val env = Env().apply {
        volume = Vec3(width, height, depth)
        dt = 1f
        c = 12f
        G = 1f
        neighbors = { p, r -> store.neighbors(p, r) }
        spawn = { store.add(it) }
    }

    fun frame(bodies: List<Body> = emptyList()) {
        store.reindex()
        step(StepInput(store, bodies, env, forces))
        env.frameN += 1
        env.t += env.dt
    }

    fun run(frames: Int, bodies: List<Body> = emptyList()) = repeat(frames) { frame(bodies) }
}

private fun meanRadius(store: FieldStore, c: Vec3): Float =
    if (store.size == 0) 0f else store.particles.sumOf { (it.position - c).length().toDouble() }.toFloat() / store.size

private fun ring(c: Vec3, radius: Float, n: Int): List<Particle> =
    (0 until n).map {
        val a = it.toDouble() / n * 2.0 * Math.PI
        Particle(position = c + Vec3((cos(a) * radius).toFloat(), (sin(a) * radius).toFloat(), 0f))
    }

class EngineTests {

    @Test
    fun attractPullsMatterInward() {
        val sim = Sim()
        val c = Vec3(3000f, 2000f, 0f)
        val body = Body(tokens = listOf("attract"), strength = 1f, range = 600f, box = Box(center = c)).apply { isVisible = true }
        ring(c, 200f, 48).forEach { sim.store.add(it) }
        val before = meanRadius(sim.store, c)
        sim.run(40, listOf(body))
        val after = meanRadius(sim.store, c)
        assertTrue(after < before, "attract gathered matter inward ($after !< $before)")
    }

    @Test
    fun feedbackBodyTalliesDensity() {
        val sim = Sim()
        val c = Vec3(3000f, 2000f, 0f)
        val body = Body(tokens = listOf("attract"), strength = 1f, range = 600f, box = Box(center = c)).apply {
            isVisible = true
            feedback = true
        }
        ring(c, 150f, 24).forEach { sim.store.add(it) }
        sim.frame(listOf(body))
        assertTrue(body.count > 0f, "a feedback body tallies nearby matter as density")
    }

    @Test
    fun frictionBleedsKineticEnergy() {
        val sim = Sim()
        repeat(50) { i -> sim.store.add(Particle(position = Vec3(1000f + i * 10f, 2000f, 0f), velocity = Vec3(6f, -4f, 0f))) }
        val e0 = energyReport(sim.store.particles).kinetic
        sim.run(5)
        val e1 = energyReport(sim.store.particles).kinetic
        assertTrue(e1 < e0, "friction bleeds kinetic energy each frame ($e1 !< $e0)")
    }

    @Test
    fun toroidalWrapAtTheEdge() {
        val sim = Sim()
        sim.store.add(Particle(position = Vec3(6025f, 2000f, 0f))) // past width + EDGE(10) ⇒ wraps to −EDGE
        sim.frame()
        assertClose(-10f, sim.store.particles[0].position.x, msg = "wrapped across the right edge")
    }

    @Test
    fun flatFieldStaysPlanarButVolumetricSpreadsInZ() {
        // flat (depth 0): z must never move, even under wander.
        val flat = Sim(depth = 0f).apply { env.form = Formation(wander = 1f) }
        ring(Vec3(3000f, 2000f, 0f), 100f, 40).forEach { flat.store.add(it) }
        flat.run(80)
        assertTrue(flat.store.particles.all { it.position.z == 0f }, "a flat field provably stays in z = 0")

        // volumetric (depth > 0): the brownian wander opens the z axis.
        val vol = Sim(depth = 400f).apply { env.form = Formation(wander = 1f) }
        ring(Vec3(3000f, 2000f, 0f), 100f, 40).forEach { vol.store.add(it) }
        vol.run(81)
        assertTrue(vol.store.particles.any { it.position.z != 0f }, "a volumetric field spreads matter through z")
    }

    @Test
    fun sinkCapturesAndHoldsMatter() {
        val sim = Sim()
        val c = Vec3(3000f, 2000f, 0f)
        val sink = Body(tokens = listOf("sink"), absorbR = 80f, capacity = 1_000_000f, box = Box(center = c)).apply { isVisible = true }
        ring(c, 40f, 24).forEach { sim.store.add(it) } // inside the absorb radius
        sim.run(3, listOf(sink))
        val captured = sim.store.particles.count { it.cap === sink }
        assertTrue(captured > 0, "a sink captures matter within its absorb radius")
    }

    @Test
    fun spawnCreatesMortalMatterThatStaysBounded() {
        val sim = Sim()
        val c = Vec3(3000f, 2000f, 0f)
        val spawn = Body(tokens = listOf("spawn"), strength = 1f, box = Box(center = c)).apply {
            isVisible = true
            isEngaged = true
            life = 2f // short-lived → the pool must not grow without bound
        }
        sim.run(5, listOf(spawn))
        assertTrue(sim.store.size > 0, "spawn creates matter")
        sim.run(60, listOf(spawn))
        assertTrue(sim.store.size in 1..40, "mortal matter expires → pool stays bounded (was ${sim.store.size})")
    }
}
