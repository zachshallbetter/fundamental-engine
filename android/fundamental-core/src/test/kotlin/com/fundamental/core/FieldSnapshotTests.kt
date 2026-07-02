package com.fundamental.core

import com.fundamental.core.engine.Box
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.BodySpec
import com.fundamental.core.runtime.FIELD_VERSION
import com.fundamental.core.runtime.FieldSnapshotOptions
import com.fundamental.core.runtime.SnapshotProfile
import com.fundamental.core.runtime.createField
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Substrate READ API — the Field Snapshot primitive (JS critical-path 03). Mirror of the JS `snapshot()`
// shape + semantics: a point-in-time capture of field STATE (distinct from the perf-metrics snapshot).

class FieldSnapshotTests {

    private fun fieldWithBodies() = createField(800f, 600f, particleCount = 100, seed = 3).also {
        it.addBody(BodySpec(tokens = listOf("attract"), strength = 1.5f, range = 800f, data = "left-payload", rect = { Box(center = Vec3(200f, 300f, 0f)) }))
        it.addBody(BodySpec(tokens = listOf("gravity"), strength = 1f, range = 800f, data = "right-payload", rect = { Box(center = Vec3(600f, 300f, 0f)) }))
    }

    @Test
    fun capturesFieldStateWithIdVersionFormationsAndBodies() {
        val f = fieldWithBodies()
        repeat(10) { f.tick() }
        val snap = f.snapshot()

        // id format: snap-<frame>-<seq>
        assertEquals("snap-${snap.frame}-0", snap.id)
        // createdAt is the field clock (env.t), not wall time — deterministic, and equals a later query()'s time
        assertEquals(f.query().time, snap.createdAt)
        // frame carried
        assertTrue(snap.frame >= 10)
        // version non-empty and equals the port's FIELD_VERSION
        assertTrue(snap.version.isNotEmpty())
        assertEquals(FIELD_VERSION, snap.version)
        // formation reported (default "ambient")
        assertEquals(listOf("ambient"), snap.formations)

        // bodies: both present, each with a non-empty id equal to its identity.id, tokens + metrics
        assertEquals(2, snap.bodies.size)
        assertTrue(snap.bodies.all { it.id.isNotEmpty() && it.id == it.identity.id })
        assertTrue(snap.bodies.any { it.tokens.contains("attract") })
        assertTrue(snap.bodies.all { it.metrics.containsKey("density") && it.metrics.containsKey("count") })
        assertTrue(snap.bodies.all { it.rect != null && it.position != null })
        assertTrue(snap.bodies.all { it.authority == "anchored" })

        // field-level metrics present
        assertTrue(snap.metrics.containsKey("particles"))
        assertEquals(2f, snap.metrics["bodies"])
        assertTrue(snap.metrics.containsKey("meanDensity"))

        // empty-for-now lanes are empty (not null) — same pattern as query()
        assertTrue(snap.influences.isEmpty())
        assertTrue(snap.projections.isEmpty())
    }

    @Test
    fun bodyDataWithheldByDefaultAndIncludedWhenOptedIn() {
        val f = fieldWithBodies()
        repeat(5) { f.tick() }

        // default: body data withheld (privacy-preserving)
        val plain = f.snapshot()
        assertTrue(plain.bodies.all { it.data == null })

        // opt-in: body data present
        val withData = f.snapshot(FieldSnapshotOptions(includeData = true))
        assertTrue(withData.bodies.any { it.data == "left-payload" })
        assertTrue(withData.bodies.any { it.data == "right-payload" })
    }

    @Test
    fun profileTightensInclusion() {
        val f = fieldWithBodies()
        repeat(5) { f.tick() }

        // PUBLIC profile: no relationships, no data (tightest). Even an explicit includeData=true cannot widen it.
        val pub = f.snapshot(FieldSnapshotOptions(profile = SnapshotProfile.PUBLIC, includeData = true))
        assertTrue(pub.relationships.isEmpty())
        assertTrue(pub.bodies.all { it.data == null })
        // ids + shape still present under the tightest profile
        assertEquals(2, pub.bodies.size)
    }

    @Test
    fun relationshipEndpointsAreIdentityIds() {
        val f = createField(800f, 600f, particleCount = 100, seed = 3)
        val left = f.addBody(BodySpec(tokens = listOf("attract"), data = "left-payload", rect = { Box(center = Vec3(200f, 300f, 0f)) }))
        val right = f.addBody(BodySpec(tokens = listOf("gravity"), data = "right-payload", rect = { Box(center = Vec3(600f, 300f, 0f)) }))
        f.addEdge(left, right, type = "supports")
        repeat(5) { f.tick() }

        val snap = f.snapshot()
        assertEquals(1, snap.relationships.size)
        val rel = snap.relationships.first()
        // endpoints are the bodies' first-class identity ids (JS bodyId / Swift resolveIdentity parity)…
        assertEquals(left.identity.id, rel.from)
        assertEquals(right.identity.id, rel.to)
        // …and join against the snapshot bodies lane's ids (same key space)
        assertTrue(snap.bodies.any { it.id == rel.from })
        assertTrue(snap.bodies.any { it.id == rel.to })
        // …not the endpoints' stringified opaque data
        assertNotEquals("left-payload", rel.from)
        assertNotEquals("right-payload", rel.to)
    }

    @Test
    fun snapshotIdSequenceIncrements() {
        val f = fieldWithBodies()
        repeat(3) { f.tick() }
        val a = f.snapshot()
        val b = f.snapshot()
        assertEquals("snap-${a.frame}-0", a.id)
        assertEquals("snap-${b.frame}-1", b.id)
    }

    @Test
    fun globalSnapshotHasNoRegionConcept() {
        // Snapshot is always whole-field — sanity that both bodies are captured regardless of position.
        val f = fieldWithBodies()
        repeat(2) { f.tick() }
        val snap = f.snapshot()
        assertEquals(2, snap.bodies.size)
        assertNull(snap.bodies.firstOrNull { it.tokens.contains("attract") }?.data)
    }
}
