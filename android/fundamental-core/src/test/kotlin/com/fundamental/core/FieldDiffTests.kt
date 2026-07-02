package com.fundamental.core

import com.fundamental.core.engine.Box
import com.fundamental.core.engine.FieldBodyIdentity
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.BodySpec
import com.fundamental.core.runtime.FieldBodySnapshot
import com.fundamental.core.runtime.FieldRelationshipReading
import com.fundamental.core.runtime.FieldSnapshot
import com.fundamental.core.runtime.diffFieldSnapshots
import com.fundamental.core.runtime.createField
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Substrate READ API — the Field Snapshot `diff` primitive (JS critical-path 03). Mirror of the JS
// `diffFieldSnapshots(a, b)`: a PURE comparison of two captures reporting what changed, by lane
// (bodies / relationships / metrics / formations). PURE — no live field access, no mutation.

class FieldDiffTests {

    private fun fieldWithBodies() = createField(800f, 600f, particleCount = 100, seed = 3).also {
        it.addBody(BodySpec(tokens = listOf("attract"), strength = 1.5f, range = 800f, rect = { Box(center = Vec3(200f, 300f, 0f)) }))
        it.addBody(BodySpec(tokens = listOf("gravity"), strength = 1f, range = 800f, rect = { Box(center = Vec3(600f, 300f, 0f)) }))
    }

    @Test
    fun diffReportsBodyRemovalMetricDeltasAndFormationChange() {
        val f = createField(800f, 600f, particleCount = 100, seed = 3)
        f.addBody(BodySpec(tokens = listOf("attract"), strength = 1.5f, range = 800f, rect = { Box(center = Vec3(200f, 300f, 0f)) }))
        val gravity = f.addBody(BodySpec(tokens = listOf("gravity"), strength = 1f, range = 800f, rect = { Box(center = Vec3(600f, 300f, 0f)) }))
        repeat(10) { f.tick() }
        val a = f.snapshot()
        assertEquals(2, a.bodies.size)

        // Mutate the field between the two captures: remove one body, change the active formation, and let
        // the sim run so the remaining body's density/metrics move.
        val removedId = gravity.identity.id
        gravity.remove()
        f.setFormation("wells")
        repeat(20) { f.tick() }
        val b = f.snapshot()

        val d = f.diff(a, b)

        // from/to carry the two snapshot ids.
        assertEquals(a.id, d.from)
        assertEquals(b.id, d.to)

        // bodies: the gravity body was removed; the attract body remains (so it is NOT reported as removed/added).
        val bodyRemoved = d.bodyChanges.filter { it.kind == "removed" }
        assertEquals(1, bodyRemoved.size)
        assertEquals(removedId, bodyRemoved.first().id)
        assertTrue(d.bodyChanges.none { it.kind == "added" })

        // the surviving body changed — its metrics moved (density is re-measured each frame).
        val changed = d.bodyChanges.firstOrNull { it.kind == "changed" }
        assertNotNull(changed, "surviving body's metrics should have changed after 20 more ticks")
        assertTrue(changed.metrics!!.isNotEmpty())
        // each reported metric carries a genuine before/after (from != to).
        assertTrue(changed.metrics!!.values.all { it.from != it.to })

        // field-level metrics: bodies count 2 -> 1 is reported as a MetricChange.
        val bodiesMetric = d.metricChanges.firstOrNull { it.key == "bodies" }
        assertNotNull(bodiesMetric, "field-level 'bodies' metric change should be reported")
        assertEquals(2f, bodiesMetric.from)
        assertEquals(1f, bodiesMetric.to)

        // formations: default "ambient" deactivated, "wells" activated.
        assertTrue(d.formationChanges.any { it.id == "wells" && it.kind == "activated" })
        assertTrue(d.formationChanges.any { it.id == "ambient" && it.kind == "deactivated" })
    }

    @Test
    fun diffReportsBodyAddition() {
        val f = fieldWithBodies()
        repeat(3) { f.tick() }
        val a = f.snapshot()

        val added = f.addBody(BodySpec(tokens = listOf("charge"), strength = 1f, range = 800f, rect = { Box(center = Vec3(400f, 400f, 0f)) }))
        val addedId = added.identity.id
        repeat(3) { f.tick() }
        val b = f.snapshot()

        val d = f.diff(a, b)
        val bodyAdded = d.bodyChanges.filter { it.kind == "added" }
        assertEquals(1, bodyAdded.size)
        assertEquals(addedId, bodyAdded.first().id)
        assertTrue(d.bodyChanges.none { it.kind == "removed" })
    }

    @Test
    fun diffOfIdenticalSnapshotIsEmptyByLane() {
        val f = fieldWithBodies()
        repeat(5) { f.tick() }
        val a = f.snapshot()

        // diffing a snapshot against itself: no lane reports anything (pure, deterministic).
        val d = f.diff(a, a)
        assertEquals(a.id, d.from)
        assertEquals(a.id, d.to)
        assertTrue(d.bodyChanges.isEmpty())
        assertTrue(d.relationshipChanges.isEmpty())
        assertTrue(d.metricChanges.isEmpty())
        assertTrue(d.formationChanges.isEmpty())
    }

    // The relationship lane is exercised deterministically with hand-built snapshots (pure — the standalone
    // `diffFieldSnapshots` needs no field), covering added / removed / changed (strength + active) by the
    // from+to+type edge key.
    @Test
    fun diffReportsRelationshipAddedRemovedAndChanged() {
        fun snap(id: String, rels: List<FieldRelationshipReading>) = FieldSnapshot(
            id = id, createdAt = 0f, frame = 0, version = "test",
            formations = listOf("ambient"), bodies = emptyList(),
            relationships = rels, metrics = emptyMap(),
        )
        val rel = { from: String, to: String, s: Float, active: Boolean ->
            FieldRelationshipReading(from = from, to = to, type = "attract", strength = s, memory = 0f, active = active, causal = active)
        }

        val a = snap("a", listOf(rel("x", "y", 0.5f, true), rel("p", "q", 0.2f, false)))
        // b: x->y strength changed + went idle; p->q removed; m->n added.
        val b = snap("b", listOf(rel("x", "y", 0.9f, false), rel("m", "n", 0.3f, true)))

        val d = diffFieldSnapshots(a, b)

        val removed = d.relationshipChanges.first { it.kind == "removed" }
        assertEquals("p", removed.from); assertEquals("q", removed.to)

        val added = d.relationshipChanges.first { it.kind == "added" }
        assertEquals("m", added.from); assertEquals("n", added.to)

        val changed = d.relationshipChanges.first { it.kind == "changed" }
        assertEquals("x", changed.from); assertEquals("y", changed.to)
        assertNotNull(changed.strength)
        assertEquals(0.5f, changed.strength!!.from); assertEquals(0.9f, changed.strength!!.to)
        assertNotNull(changed.active)
        assertEquals(true, changed.active!!.from); assertEquals(false, changed.active!!.to)
    }

    // The body-metric lane, hand-built (pure) — added / removed / changed by id, with per-metric before/after.
    @Test
    fun diffBodyMetricsPure() {
        fun body(id: String, metrics: Map<String, Float>) = FieldBodySnapshot(
            id = id, identity = FieldBodyIdentity(id = id, kind = "element"),
            authority = "anchored", rect = null, position = null, tokens = emptyList(),
            metrics = metrics, dimensions = emptyMap(),
        )
        fun snap(id: String, bodies: List<FieldBodySnapshot>) = FieldSnapshot(
            id = id, createdAt = 0f, frame = 0, version = "test",
            formations = emptyList(), bodies = bodies, relationships = emptyList(), metrics = emptyMap(),
        )

        val a = snap("a", listOf(body("keep", mapOf("density" to 1f, "count" to 3f)), body("gone", mapOf("density" to 2f))))
        val b = snap("b", listOf(body("keep", mapOf("density" to 5f, "count" to 3f)), body("new", mapOf("density" to 1f))))

        val d = diffFieldSnapshots(a, b)

        assertTrue(d.bodyChanges.any { it.id == "gone" && it.kind == "removed" })
        assertTrue(d.bodyChanges.any { it.id == "new" && it.kind == "added" })

        val changed = d.bodyChanges.first { it.id == "keep" && it.kind == "changed" }
        // only density changed (1 -> 5); count unchanged so it is NOT reported.
        assertEquals(setOf("density"), changed.metrics!!.keys)
        assertEquals(1f, changed.metrics!!["density"]!!.from)
        assertEquals(5f, changed.metrics!!["density"]!!.to)
        assertNull(changed.metrics!!["count"])
    }
}
