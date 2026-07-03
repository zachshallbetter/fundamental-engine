package com.fundamental.core

import com.fundamental.core.engine.AtomPayload
import com.fundamental.core.engine.Box
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.BodySpec
import com.fundamental.core.runtime.FieldEvent
import com.fundamental.core.runtime.FieldEventPayload
import com.fundamental.core.runtime.FieldHandle
import com.fundamental.core.runtime.OverlayRenderer
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
    fun addEdgeStrengthensWhileSourceIsSalientThenSetsAndRemoves() {
        val f = createField(400f, 300f, particleCount = 300, seed = 7)
        // A = a strong attract source (gathers matter → salient); B = the target it relates to.
        val a = f.addBody(BodySpec(tokens = listOf("attract"), strength = 1.6f, range = 260f,
            data = mapOf("entity" to "meeting"), rect = { Box(center = Vec3(200f, 150f, 0f)) }))
        val b = f.addBody(BodySpec(tokens = listOf("attract"), strength = 0.2f, range = 80f,
            data = mapOf("entity" to "file"), rect = { Box(center = Vec3(40f, 40f, 0f)) }))
        val edge = f.addEdge(a, b, type = "relates")

        // reads back immediately, keyed by the bodies' carried records.
        var edges = f.readEdges()
        assertEquals(1, edges.size)
        assertEquals("relates", edges[0].type)
        assertEquals(mapOf("entity" to "meeting"), edges[0].from)
        assertEquals(mapOf("entity" to "file"), edges[0].to)
        val start = edges[0].strength

        // drive frames: A gathers matter → A.d passes the salience gate → the edge strengthens + warms.
        repeat(240) { f.tick() }
        edges = f.readEdges()
        assertTrue(edges[0].active, "the edge went active as its source gathered matter")
        assertTrue(edges[0].strength > start, "strength rose while active ($start → ${edges[0].strength})")
        assertTrue(edges[0].memory > 0f, "memory accumulated — the relationship is warm")

        // live mutation + removal.
        edge.set(strength = 0.1f)
        assertEquals(0.1f, f.readEdges()[0].strength, "set() mutates strength live")
        edge.remove()
        assertEquals(0, f.readEdges().size, "remove() drops the edge")
    }

    @Test
    fun removingABodyDropsTheEdgesThatTouchedIt() {
        val f = createField(300f, 300f, particleCount = 50, seed = 9)
        val a = f.addBody(BodySpec(tokens = listOf("attract"), rect = { Box(center = Vec3(10f, 10f, 0f)) }))
        val b = f.addBody(BodySpec(tokens = listOf("attract"), rect = { Box(center = Vec3(90f, 90f, 0f)) }))
        f.addEdge(a, b)
        assertEquals(1, f.readEdges().size)
        a.remove()
        assertEquals(0, f.readEdges().size, "the edge is dropped when an endpoint body is removed")
    }

    @Test
    fun sampleReportsNetForceTowardANearbyAttractorAndZeroFarAway() {
        // #816 force-probe: sample() returns the net force a free particle would feel at a point.
        val f = createField(1000f, 1000f, particleCount = 10, seed = 8)
        // an attractor at (100, 100) with ample range
        f.addBody(BodySpec(tokens = listOf("attract"), strength = 2f, range = 400f, rect = { Box(center = Vec3(100f, 100f, 0f)) }))
        f.scan() // sample the body rect into its box

        // probe a point below-right of the body — the force should pull back toward it (up-left)
        val force = f.sample(140f, 140f)
        assertTrue(force.x < 0f, "pulled toward the body (which sits at lower x)")
        assertTrue(force.y < 0f, "pulled toward the body (which sits at lower y)")
        assertTrue(force.length() > 0f, "a nearby probe feels a non-zero force")

        // a point far outside range feels ~nothing
        val far = f.sample(900f, 900f)
        assertEquals(0f, far.length(), "a probe outside range feels no force")
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

    // ── #818 readParticleIds — stable per-particle identity ─────────────────────────────
    @Test
    fun readParticleIdsAreStableAcrossFramesAndParallelReadParticles() {
        val f = createField(300f, 300f, particleCount = 10, seed = 8)
        val ids = IntArray(10)
        val n = f.readParticleIds(ids)
        assertEquals(10, n, "returns the particle count")
        // ids are assigned at pool creation, one per slot, all distinct
        assertEquals(10, ids.toSet().size, "every particle carries a distinct id")

        // parallel to readParticles: same pool order, so ids[i] identifies the particle written at
        // stride offset i*5 in readParticles — driving frames does not renumber a live slot.
        val before = ids.copyOf()
        repeat(30) { f.tick() }
        val after = IntArray(10)
        f.readParticleIds(after)
        assertTrue(before.contentEquals(after), "ids survive across ticks (stable identity)")

        // a smaller buffer truncates to capacity but still reports the true count
        val small = IntArray(3)
        assertEquals(10, f.readParticleIds(small), "count is reported even when the buffer truncates")
    }

    // ── #819 readParticleChannels — per-particle field-channel readout ──────────────────
    @Test
    fun readParticleChannelsPacksNamedGridSamplesAtEachParticle() {
        val f = createField(400f, 400f, particleCount = 8, seed = 3)
        // open two scalar grids and write a known constant into each so the sampled value is predictable.
        val a = f.grid("a"); val b = f.grid("b")
        for (p in f.controller.particles) { a.deposit(p.position, 1f); b.deposit(p.position, 2f) }

        val names = listOf("a", "b")
        val out = FloatArray(8 * names.size)
        val n = f.readParticleChannels(names, out)
        assertEquals(8, n, "returns the particle count")
        // stride = names.size; each particle sees a positive sample from a grid it splatted into.
        for (i in 0 until 8) {
            assertTrue(out[i * 2] > 0f, "channel a sampled non-zero at particle $i")
            assertTrue(out[i * 2 + 1] >= out[i * 2], "channel b (splatted 2×) samples at least channel a")
        }

        // a buffer too small for the next full stride stops early but reports the true count.
        val small = FloatArray(3 * names.size)
        assertEquals(8, f.readParticleChannels(names, small), "count reported even when the buffer truncates")
    }

    // ── #817 on(event, handler) — the discrete event bus ────────────────────────────────
    @Test
    fun onTickFiresEachFrameAndSubscriptionCancels() {
        val f = createField(300f, 300f, particleCount = 5, seed = 1)
        var ticks = 0
        val sub = f.on(FieldEvent.TICK) { ticks++ }
        repeat(4) { f.tick() }
        assertEquals(4, ticks, "TICK fires once per frame while subscribed")

        sub.cancel()
        repeat(3) { f.tick() }
        assertEquals(4, ticks, "cancel() removes the listener — no further deliveries")
    }

    @Test
    fun onBodyAddDeliversTheBodyPayload() {
        val f = createField(300f, 300f, particleCount = 5, seed = 1)
        var got: FieldEventPayload? = null
        f.on(FieldEvent.BODY_ADD) { got = it }
        val h = f.addBody(BodySpec(tokens = listOf("attract"), rect = { Box(center = Vec3(150f, 150f, 0f)) }))
        assertNotNull(got, "BODY_ADD fired on addBody")
        assertEquals(FieldEvent.BODY_ADD, got!!.event)
        assertTrue(got!!.body === h.body, "the payload carries the added body")
    }

    // ── #820 registerOverlay — named renderer registry the host drives ──────────────────
    @Test
    fun registerOverlayIsHeldInTheRegistryAndRemovable() {
        val f = createField(300f, 300f, particleCount = 5, seed = 1)
        var rendered = 0
        val renderer = object : OverlayRenderer {
            override fun render(handle: FieldHandle) { rendered++ }
        }
        f.registerOverlay("diag", renderer)
        assertTrue(f.overlayRegistry.containsKey("diag"), "the renderer is held under its key")
        assertTrue(f.overlayRegistry["diag"] === renderer, "the exact renderer is retained")

        // the host drives the registry each frame — simulate one host draw pass.
        f.overlayRegistry.values.forEach { it.render(f) }
        assertEquals(1, rendered, "a host draw pass invokes the registered renderer")

        f.removeOverlay("diag")
        assertTrue(f.overlayRegistry.isEmpty(), "removeOverlay drops it")
    }
}
