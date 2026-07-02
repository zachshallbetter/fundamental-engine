package com.fundamental.core

import com.fundamental.core.engine.Box
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.BodySpec
import com.fundamental.core.runtime.FieldProjection
import com.fundamental.core.runtime.FieldProjectionSurface
import com.fundamental.core.runtime.FieldProjectionTarget
import com.fundamental.core.runtime.agentJsonProjection
import com.fundamental.core.runtime.agentJsonTarget
import com.fundamental.core.runtime.callbackProjection
import com.fundamental.core.runtime.callbackTarget
import com.fundamental.core.runtime.createField
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Substrate Projection Registry (JS critical-path 05). Mirror of the JS `projection-registry.test.ts` +
// `projection-autoapply.test.ts`: a projection maps field STATE into an output surface and NEVER mutates
// the field. This port implements the portable surfaces — `agent-json` + a generic host `callback` — and
// wires `projectionList()` into `query()` / `snapshot()`. The web surfaces (css/dom/svg) are web-first.

class ProjectionRegistryTests {

    private fun field() = createField(400f, 300f, particleCount = 100, seed = 7)

    // A visual projection whose `apply` writes to a target — used to prove apply never touches the field.
    private fun densityOutline(sink: (Map<String, Float>) -> Unit): FieldProjection = FieldProjection(
        id = "density-outline",
        label = "Density Outline",
        channels = listOf("density"),
        surfaces = listOf(FieldProjectionSurface.CSS, FieldProjectionSurface.ANNOTATION),
        reducedMotionEquivalent = "outline and label",
        accessibilityEquivalent = "semantic emphasis and explanation",
        apply = { reading, _ -> sink(reading) },
    )

    @Test
    fun registerGetListUnregister() {
        val f = field()
        val proj = densityOutline {}
        val off = f.projections.register(proj)

        // get returns the full projection (incl. apply); list returns serializable metadata.
        assertEquals(proj, f.projections.get("density-outline"))
        val info = f.projections.list()
        assertEquals(1, info.size)
        assertEquals("density-outline", info[0].id)
        assertEquals("Density Outline", info[0].label)
        assertEquals(listOf("density"), info[0].channels)
        assertEquals(listOf(FieldProjectionSurface.CSS, FieldProjectionSurface.ANNOTATION), info[0].surfaces)
        assertEquals("outline and label", info[0].reducedMotionEquivalent)
        assertEquals("semantic emphasis and explanation", info[0].accessibilityEquivalent)

        // the returned unregister fn removes it
        off()
        assertTrue(f.projections.list().isEmpty())
        assertNull(f.projections.get("density-outline"))
    }

    @Test
    fun registerReplacesSameId() {
        val f = field()
        f.projections.register(agentJsonProjection("p", listOf("density"), label = "First"))
        val off2 = f.projections.register(agentJsonProjection("p", listOf("count"), label = "Second"))
        // a re-register under the same id wins — one entry, the newer metadata
        assertEquals(1, f.projections.list().size)
        assertEquals("Second", f.projections.list()[0].label)
        assertEquals(listOf("count"), f.projections.list()[0].channels)
        // the second registration's unregister fn removes the live entry
        off2()
        assertTrue(f.projections.list().isEmpty())
    }

    @Test
    fun applyWritesToTargetAndNeverMutatesTheField() {
        // Baseline: run a field 10 frames with NO projection and record particle count.
        val baseline = run {
            val f = field()
            repeat(10) { f.tick() }
            f.particleCount()
        }

        // Same field + frames, but with a projection registered AND applied — count must be identical.
        val f = field()
        var received: Map<String, Float>? = null
        f.projections.register(densityOutline { received = it })
        repeat(10) { f.tick() }
        val target = object : FieldProjectionTarget {}
        f.projections.apply("density-outline", mapOf("density" to 0.72f), target)

        assertEquals(mapOf("density" to 0.72f), received, "apply wrote the reading to the target surface")
        assertEquals(baseline, f.particleCount(), "applying a projection does not change field state")

        // unknown id is a no-op (no throw)
        f.projections.apply("nope", mapOf("density" to 1f), object : FieldProjectionTarget {})
    }

    @Test
    fun queryAndSnapshotReportRegisteredProjections() {
        val f = field()
        f.addBody(BodySpec(tokens = listOf("attract"), strength = 1f, range = 400f, rect = { Box(center = Vec3(200f, 150f, 0f)) }))
        f.projections.register(densityOutline {})
        repeat(3) { f.tick() }

        // query().projections is populated from the registry
        val q = f.query()
        assertEquals(1, q.projections.size)
        assertEquals("density-outline", q.projections[0].id)

        // snapshot().projections captures the same metadata
        val snap = f.snapshot()
        assertEquals(1, snap.projections.size)
        assertEquals("Density Outline", snap.projections[0].label)
        assertEquals(listOf(FieldProjectionSurface.CSS, FieldProjectionSurface.ANNOTATION), snap.projections[0].surfaces)
    }

    @Test
    fun agentJsonTargetCapturesAndSerializes() {
        val tgt = agentJsonTarget()
        assertNull(tgt.value(), "null before the first write")
        assertEquals("null", tgt.json())

        tgt.receive(mapOf("density" to 0.4f, "attention" to 0.9f))
        assertEquals(mapOf("density" to 0.4f, "attention" to 0.9f), tgt.value())
        // whole numbers serialize without a trailing .0 (JS JSON.stringify parity)
        tgt.receive(mapOf("k" to 1f))
        assertEquals("{\"k\":1}", tgt.json())

        // captured BY VALUE — mutating the source map afterward does not change what was received
        val src = HashMap<String, Float>()
        src["density"] = 1f
        tgt.receive(src)
        src["density"] = 99f
        assertEquals(1f, tgt.value()!!["density"], "stored a copy, not a reference")
    }

    @Test
    fun agentJsonProjectionWritesThroughApplyIntoTarget() {
        val f = field()
        val tgt = agentJsonTarget()
        f.projections.register(agentJsonProjection("agent", listOf("density"), label = "Agent view"))
        f.projections.apply("agent", mapOf("density" to 0.5f), tgt)
        assertEquals(mapOf("density" to 0.5f), tgt.value())
    }

    @Test
    fun bindAutoAppliesEachWritePhaseUnbindStops() {
        val f = field()
        val tgt = agentJsonTarget()
        var n = 0
        f.projections.register(agentJsonProjection("live", listOf("k")))
        val unbind = f.projections.bind("live", tgt) { mapOf("k" to (++n).toFloat()) }

        assertNull(tgt.value(), "no write before the first frame")
        f.tick()
        val afterOne = tgt.value()!!["k"]!!
        assertTrue(afterOne >= 1f, "projection applied on the write phase")
        f.tick()
        assertTrue(tgt.value()!!["k"]!! > afterOne, "applied again on the next frame")

        val stoppedAt = tgt.value()!!["k"]!!
        unbind()
        f.tick()
        assertEquals(stoppedAt, tgt.value()!!["k"], "no further writes after unbind")
    }

    @Test
    fun boundProjectionNeverPerturbsTheSimulation() {
        // Baseline: 10 frames, no binding.
        val baseline = run {
            val f = field()
            repeat(10) { f.tick() }
            f.particleCount()
        }
        // Same, with a projection bound and auto-applying every write phase.
        val f = field()
        f.projections.register(agentJsonProjection("p", listOf("density")))
        f.projections.bind("p", agentJsonTarget()) { mapOf("density" to 1f) }
        repeat(10) { f.tick() }
        assertEquals(baseline, f.particleCount(), "particle count identical with a projection bound")
    }

    @Test
    fun bindingAnUnregisteredIdIsInert() {
        val f = field()
        // A target whose receive throws if ever called — binding an unknown id must never invoke it.
        val exploding = object : FieldProjectionTarget {
            override fun receive(reading: Map<String, Float>) = throw AssertionError("should not be called")
        }
        f.projections.bind("nope", exploding) { mapOf("x" to 1f) }
        f.tick() // must not throw
        assertTrue(true, "ticking with an inert binding did not throw")
    }

    @Test
    fun callbackTargetForwardsReadingsToHostSink() {
        val f = field()
        val seen = mutableListOf<Map<String, Float>>()
        val tgt = callbackTarget { seen.add(it) }
        f.projections.register(callbackProjection("native-label", listOf("density"), label = "Native label"))
        val unbind = f.projections.bind("native-label", tgt) { mapOf("density" to 0.3f) }

        f.tick()
        f.tick()
        assertEquals(2, seen.size, "the host sink received one reading per write phase")
        assertEquals(mapOf("density" to 0.3f), seen.last())

        // callback surface reported in the metadata
        assertEquals(listOf(FieldProjectionSurface.CALLBACK), f.projections.list()[0].surfaces)

        unbind()
        f.tick()
        assertEquals(2, seen.size, "no further writes after unbind")
    }

    @Test
    fun defaultFieldHasNoProjections() {
        // Guards the empty-for-now assertions that query/snapshot tests already make: a field with nothing
        // registered reports an empty (not null) projections list on both reads.
        val f = field()
        repeat(3) { f.tick() }
        assertTrue(f.projections.list().isEmpty())
        assertTrue(f.query().projections.isEmpty())
        assertTrue(f.snapshot().projections.isEmpty())
        assertFalse(f.query().projections.any { it.id == "x" })
    }
}
