package com.fundamental.core

import com.fundamental.core.engine.Box
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.BodySpec
import com.fundamental.core.runtime.EdgeDirection
import com.fundamental.core.runtime.createField
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// Relationship edges (`addEdge` / `readEdges`) — the longitudinal dynamics of a declared relationship.
// FieldHandleTests covers the happy path (rise + active + memory + set/remove + endpoint drop); this
// file pins the parts that path leaves open: the SALIENT→IDLE transition (decay + memory holds), that
// `active` tracks the source's density past the 0.08 gate, and that all three directions carry their
// endpoints' `data` correctly. Deterministic: a fixed seed + a hand-driven `tick()` loop.

class EdgesTests {

    /** A salient source body: a strong, wide attractor that gathers matter so its density clears 0.08. */
    private fun strongAttract(cx: Float, cy: Float, data: Any?) =
        BodySpec(tokens = listOf("attract"), strength = 1.6f, range = 260f, data = data,
            rect = { Box(center = Vec3(cx, cy, 0f)) })

    /** An idle source body: weak + tiny range in an empty corner, so its density never clears 0.08. */
    private fun idleAttract(cx: Float, cy: Float, data: Any?) =
        BodySpec(tokens = listOf("attract"), strength = 0.05f, range = 6f, data = data,
            rect = { Box(center = Vec3(cx, cy, 0f)) })

    @Test
    fun edgeAppearsInReadEdgesKeyedByEndpointData() {
        val f = createField(400f, 300f, particleCount = 200, seed = 11)
        val a = f.addBody(strongAttract(200f, 150f, mapOf("entity" to "meeting")))
        val b = f.addBody(idleAttract(40f, 40f, mapOf("entity" to "file")))
        f.addEdge(a, b, type = "relates")

        val edges = f.readEdges()
        assertEquals(1, edges.size, "the edge reads back")
        assertEquals("relates", edges[0].type)
        assertEquals(mapOf("entity" to "meeting"), edges[0].from, "from carries the source body's data")
        assertEquals(mapOf("entity" to "file"), edges[0].to, "to carries the target body's data")
        assertEquals(EdgeDirection.FROM_TO, edges[0].direction)
    }

    @Test
    fun strengthAndMemoryRiseWhileSalientThenDecayWhileMemoryHoldsWhenIdle() {
        val f = createField(400f, 300f, particleCount = 300, seed = 12)
        // Source A starts salient (gathers matter); target B is irrelevant to the source's density.
        // A's position is mutable + re-sampled each frame, so phase 2 can walk it off the cluster.
        var ax = 200f; var ay = 150f
        val a = f.addBody(BodySpec(tokens = listOf("attract"), strength = 1.6f, range = 260f,
            data = mapOf("id" to "A"), rect = { Box(center = Vec3(ax, ay, 0f)) }))
        val b = f.addBody(idleAttract(40f, 40f, mapOf("id" to "B")))
        f.addEdge(a, b, type = "relates", strength = 0.2f)
        val start = f.readEdges()[0].strength

        // Phase 1 — salient: drive frames until A's density passes the gate. Strength + memory climb.
        repeat(240) { f.tick() }
        val salient = f.readEdges()[0]
        assertTrue(salient.active, "active while the source is dense")
        assertTrue(salient.strength > start, "strength rose while active ($start → ${salient.strength})")
        assertTrue(salient.memory > 0f, "memory accreted while active")
        val peakStrength = salient.strength
        val warmMemory = salient.memory

        // Phase 2 — go idle: collapse the source to a weak pinpoint AND walk it off into an empty
        // corner, so it stops tallying matter and its eased density (b.d) relaxes below the 0.08 gate.
        a.set(strength = 0.02f, range = 4f)
        ax = 396f; ay = 296f
        repeat(200) { f.tick() }
        val idle = f.readEdges()[0]
        assertFalse(idle.active, "active drops once the source stops gathering matter")
        assertTrue(idle.strength < peakStrength, "strength decays while idle ($peakStrength → ${idle.strength})")
        assertTrue(idle.memory >= warmMemory - 1e-4f,
            "memory holds while idle — no decay ($warmMemory → ${idle.memory})")
    }

    @Test
    fun activeReflectsSourceDensityNotTargetDensity() {
        // The gate keys on the SOURCE body only. A salient target with an idle source stays inactive.
        val f = createField(400f, 300f, particleCount = 300, seed = 13)
        val idleSource = f.addBody(idleAttract(380f, 280f, mapOf("id" to "src")))
        val saliENTTarget = f.addBody(strongAttract(200f, 150f, mapOf("id" to "tgt")))
        f.addEdge(idleSource, saliENTTarget, type = "relates")

        repeat(200) { f.tick() }
        assertFalse(f.readEdges()[0].active, "an idle source keeps the edge inactive even with a dense target")
    }

    @Test
    fun bothDirectionsAndBidirectionalArePreserved() {
        val f = createField(400f, 300f, particleCount = 80, seed = 14)
        val a = f.addBody(strongAttract(200f, 150f, mapOf("id" to "A")))
        val b = f.addBody(idleAttract(40f, 40f, mapOf("id" to "B")))
        f.addEdge(a, b, type = "fwd", direction = EdgeDirection.FROM_TO)
        f.addEdge(a, b, type = "rev", direction = EdgeDirection.TO_FROM)
        f.addEdge(a, b, type = "both", direction = EdgeDirection.BIDIRECTIONAL)

        val byType = f.readEdges().associateBy { it.type }
        assertEquals(3, byType.size)
        assertEquals(EdgeDirection.FROM_TO, byType.getValue("fwd").direction)
        assertEquals(EdgeDirection.TO_FROM, byType.getValue("rev").direction)
        assertEquals(EdgeDirection.BIDIRECTIONAL, byType.getValue("both").direction)
        // endpoint data is direction-agnostic in the record (from = first arg, to = second arg).
        for (t in listOf("fwd", "rev", "both")) {
            assertEquals(mapOf("id" to "A"), byType.getValue(t).from, "$t.from")
            assertEquals(mapOf("id" to "B"), byType.getValue(t).to, "$t.to")
        }
    }

    @Test
    fun removingEitherEndpointBodyDropsTheEdge() {
        // Source removal.
        val f1 = createField(300f, 300f, particleCount = 40, seed = 15)
        val a1 = f1.addBody(strongAttract(60f, 60f, mapOf("id" to "A")))
        val b1 = f1.addBody(idleAttract(240f, 240f, mapOf("id" to "B")))
        f1.addEdge(a1, b1)
        assertEquals(1, f1.readEdges().size)
        a1.remove()
        assertEquals(0, f1.readEdges().size, "removing the source drops the edge")

        // Target removal.
        val f2 = createField(300f, 300f, particleCount = 40, seed = 16)
        val a2 = f2.addBody(strongAttract(60f, 60f, mapOf("id" to "A")))
        val b2 = f2.addBody(idleAttract(240f, 240f, mapOf("id" to "B")))
        f2.addEdge(a2, b2)
        assertEquals(1, f2.readEdges().size)
        b2.remove()
        assertEquals(0, f2.readEdges().size, "removing the target drops the edge")
    }
}
