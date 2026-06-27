package com.fundamental.core

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.FieldController
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// The runtime driver, headless — proves a host-less field runs: pool conserved + bounded over many
// frames, bodies gather matter, bursts shove it, formations bias it. The Compose/View hosts just call
// tick() and read particles, so this is where the driver is actually verified.

class FieldControllerTests {

    @Test
    fun ambientFieldStaysConservedAndBounded() {
        val fc = FieldController(width = 800f, height = 600f, particleCount = 200, seed = 7)
        repeat(120) { fc.tick() }
        assertEquals(200, fc.particleCount, "ambient pool is conserved")
        for (p in fc.particles) {
            assertTrue(p.position.x.isFinite() && p.position.y.isFinite() && p.velocity.x.isFinite(), "finite")
            assertTrue(p.velocity.length() <= fc.env.c + 1e-3f, "velocity bounded by c")
        }
    }

    @Test
    fun attractBodyGathersMatter() {
        val fc = FieldController(width = 800f, height = 600f, particleCount = 300, seed = 3)
        val c = Vec3(400f, 300f, 0f)
        fc.addBody(Body(tokens = listOf("attract"), strength = 1.5f, range = 900f, box = Box(center = c)))
        fun meanR() = fc.particles.sumOf { (it.position - c).length().toDouble() }.toFloat() / fc.particleCount
        val before = meanR()
        repeat(80) { fc.tick() }
        assertTrue(meanR() < before, "attract gathered the field toward the body")
    }

    @Test
    fun burstShovesAndHeatsNearbyMatter() {
        val fc = FieldController(width = 400f, height = 400f, particleCount = 1, seed = 1)
        // place the single particle next to the burst origin
        val p = fc.particles[0]
        p.position = Vec3(210f, 200f, 0f)
        p.velocity = Vec3.ZERO
        p.heat = 0f
        fc.burst(200f, 200f)
        assertTrue(p.velocity.x > 0f, "burst pushed matter outward (+x, away from origin)")
        assertTrue(p.heat > 0f, "burst heated nearby matter")
    }

    @Test
    fun lanesFormationBiasesDriftAlongX() {
        val fc = FieldController(width = 1000f, height = 600f, particleCount = 200, seed = 9)
        fc.setFormation("lanes") // driftX = 0.55
        repeat(120) { fc.tick() }
        val meanVx = fc.particles.sumOf { it.velocity.x.toDouble() }.toFloat() / fc.particleCount
        assertTrue(meanVx > 0f, "the lanes formation carries matter along +x (mean vx = $meanVx)")
    }
}
