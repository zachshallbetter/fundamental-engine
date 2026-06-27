package com.fundamental.core

import com.fundamental.core.engine.AtomPayload
import com.fundamental.core.engine.Box
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.BodySpec
import com.fundamental.core.runtime.PARTICLE_STRIDE
import com.fundamental.core.runtime.createField
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// The public FieldHandle surface — the consumer API over the engine. Each capability is exercised
// headlessly: programmatic bodies + handles, flow focus, data atoms, open channels, and readParticles.

class FieldHandleTests {

    @Test
    fun addBodyReturnsALiveHandleThatGathersAndRemoves() {
        val f = createField(800f, 600f, particleCount = 300, seed = 5)
        val c = Vec3(400f, 300f, 0f)
        val h = f.addBody(BodySpec(tokens = listOf("attract"), strength = 1.6f, range = 900f, rect = { Box(center = c) }))
        fun meanR() = f.controller.particles.sumOf { (it.position - c).length().toDouble() }.toFloat() / f.particleCount()
        val before = meanR()
        repeat(80) { f.tick() }
        assertTrue(meanR() < before, "the programmatic body gathered matter")

        h.remove()
        assertTrue(f.controller.bodies.none { it === h.body }, "remove() detaches the body")
    }

    @Test
    fun bodyHandleSetMutatesLive() {
        val f = createField(400f, 400f, particleCount = 10, seed = 1)
        val h = f.addBody(BodySpec(tokens = listOf("attract"), rect = { Box(center = Vec3(200f, 200f, 0f)) }))
        h.set(strength = 3.5f, range = 250f, spin = 2f, angleDeg = 90f)
        assertEquals(3.5f, h.body.strength)
        assertEquals(250f, h.body.range)
        assertEquals(2f, h.body.spin)
        assertTrue(h.body.heading.y > 0.99f, "angle 90° points heading toward +y")
    }

    @Test
    fun sinkHandleReportsLoadAndDrains() {
        val f = createField(600f, 600f, particleCount = 200, seed = 2)
        val c = Vec3(300f, 300f, 0f)
        val h = f.addBody(BodySpec(tokens = listOf("sink"), range = 200f, rect = { Box(center = c) }))
        h.body.absorbR = 120f
        h.body.capacity = 1000f
        repeat(5) { f.tick() }
        assertTrue(h.load > 0f, "sink load rises as it captures matter")
        val drained = h.drain()
        assertTrue(drained > 0f && h.load == 0f, "drain returns the count and resets the load")
    }

    @Test
    fun flowToPullsMatterTowardTheFocus() {
        val f = createField(800f, 600f, particleCount = 200, seed = 4)
        val focus = Vec3(150f, 150f, 0f)
        fun meanR() = f.controller.particles.sumOf { (it.position - focus).length().toDouble() }.toFloat() / f.particleCount()
        val before = meanR()
        f.flowTo(focus.x, focus.y, strength = 1.5f, radius = 1200f)
        repeat(60) { f.tick() }
        assertTrue(meanR() < before, "flow focus draws matter toward the point")
        f.clearFlow()
        assertNull(f.controller.flow, "clearFlow removes the focus")
    }

    @Test
    fun seedBindsAtomsAndAtomAtFindsThem() {
        val f = createField(500f, 500f, particleCount = 50, seed = 6)
        val atoms = (0 until 5).map { AtomPayload(weight = 2f, payload = mapOf("i" to it)) }
        f.seed(atoms)
        // a seeded particle's size/mass follow its weight
        assertTrue(f.controller.particles[0].size == 2f && f.controller.particles[0].mass == 2f, "weight sets size+mass")
        f.tick() // builds the neighbour index atomAt queries
        val p0 = f.controller.particles[0]
        val found = f.atomAt(p0.position.x, p0.position.y, radius = 12f)
        assertNotNull(found, "atomAt finds the nearest seeded particle's record")
    }

    @Test
    fun fieldChannelsSampleAndRemove() {
        val f = createField(400f, 400f, particleCount = 1)
        val ch = f.addField("moisture") { x, _ -> x / 400f }
        assertEquals(0.5f, f.sampleField("moisture", 200f, 0f), 1e-6f)
        ch.remove()
        assertEquals(0f, f.sampleField("moisture", 200f, 0f), "removed channel reads 0")
    }

    @Test
    fun readParticlesWritesStrideFive() {
        val f = createField(300f, 300f, particleCount = 10, seed = 8)
        val out = FloatArray(10 * PARTICLE_STRIDE)
        val n = f.readParticles(out)
        assertEquals(10, n)
        // a smaller buffer truncates to capacity
        val small = FloatArray(3 * PARTICLE_STRIDE)
        assertEquals(3, f.readParticles(small))
    }
}
