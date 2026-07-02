package com.fundamental.core

import com.fundamental.core.engine.Box
import com.fundamental.core.engine.FieldBodyIdentity
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.BodySpec
import com.fundamental.core.runtime.FieldQuery
import com.fundamental.core.runtime.FieldQueryAt
import com.fundamental.core.runtime.FieldQueryInclude
import com.fundamental.core.runtime.createField
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Substrate READ API — the Field Query primitive (JS #837 / critical-path 02). Mirror of the JS
// `query()` shape + semantics: a read-only structured question over the live field.

class FieldQueryTests {

    private fun fieldWithBodies() = createField(800f, 600f, particleCount = 100, seed = 3).also {
        it.addBody(BodySpec(tokens = listOf("attract"), strength = 1.5f, range = 800f, rect = { Box(center = Vec3(200f, 300f, 0f)) }))
        it.addBody(BodySpec(tokens = listOf("gravity"), strength = 1f, range = 800f, rect = { Box(center = Vec3(600f, 300f, 0f)) }))
    }

    @Test
    fun globalQueryReturnsBodiesWithIdsAndMetrics() {
        val f = fieldWithBodies()
        repeat(10) { f.tick() }
        val res = f.query()

        // bodies: both present, each with a non-empty id equal to its identity.id
        assertEquals(2, res.bodies.size)
        assertTrue(res.bodies.all { it.id.isNotEmpty() })
        assertTrue(res.bodies.all { it.id == it.identity.id })
        // tokens + metrics populated per body
        assertTrue(res.bodies.any { it.tokens.contains("attract") })
        assertTrue(res.bodies.all { it.metrics.containsKey("density") && it.metrics.containsKey("count") })
        // rect measured for a scanned body
        assertTrue(res.bodies.all { it.rect != null })
        // formation reported (default "ambient")
        assertTrue(res.bodies.all { it.activeFormations == listOf("ambient") })

        // field-level metrics present
        assertTrue(res.metrics.containsKey("particles"))
        assertEquals(2f, res.metrics["bodies"])
        assertTrue(res.metrics.containsKey("meanDensity"))

        // frame/time carried; global query has no region; empty-for-now lanes are empty (not null)
        assertTrue(res.frame >= 10)
        assertNull(res.region)
        assertTrue(res.influences.isEmpty())
        assertTrue(res.projections.isEmpty())
        assertNull(res.lens)
    }

    @Test
    fun pointQueryScopesToRegion() {
        val f = fieldWithBodies()
        repeat(10) { f.tick() }
        // a tight radius around the left body (200,300) excludes the right body (600,300)
        val res = f.query(FieldQuery(at = FieldQueryAt.Point(x = 200f, y = 300f, radius = 100f)))
        assertEquals(1, res.bodies.size)
        assertTrue(res.bodies.first().tokens.contains("attract"))
        assertEquals(1f, res.metrics["bodies"])
        // resolved region reflects the point + radius
        val r = res.region!!
        assertEquals(100f, r.x)
        assertEquals(200f, r.width)
    }

    @Test
    fun includeFilterHonored() {
        val f = fieldWithBodies()
        repeat(5) { f.tick() }
        // ask for metrics only — bodies + relationships must be empty
        val res = f.query(FieldQuery(include = setOf(FieldQueryInclude.METRICS)))
        assertTrue(res.bodies.isEmpty())
        assertTrue(res.relationships.isEmpty())
        assertTrue(res.metrics.isNotEmpty())
    }

    @Test
    fun relationshipEndpointsAreIdentityIds() {
        val f = createField(800f, 600f, particleCount = 100, seed = 3)
        // one supplied identity, one engine-derived — both must key the reading (JS bodyId / Swift resolveIdentity)
        val left = f.addBody(BodySpec(tokens = listOf("attract"), data = "left-data", identity = FieldBodyIdentity(id = "nav.left"), rect = { Box(center = Vec3(200f, 300f, 0f)) }))
        val right = f.addBody(BodySpec(tokens = listOf("gravity"), data = "right-data", rect = { Box(center = Vec3(600f, 300f, 0f)) }))
        f.addEdge(left, right, type = "supports")
        repeat(5) { f.tick() }

        val res = f.query()
        assertEquals(1, res.relationships.size)
        val rel = res.relationships.first()
        // endpoints are the bodies' first-class identity ids…
        assertEquals("nav.left", rel.from)
        assertEquals(right.identity.id, rel.to)
        // …and join against the bodies lane's ids (same key space)
        assertTrue(res.bodies.any { it.id == rel.from })
        assertTrue(res.bodies.any { it.id == rel.to })
        // …not the endpoints' stringified opaque data
        assertNotEquals("left-data", rel.from)
        assertNotEquals("right-data", rel.to)
    }

    @Test
    fun localQueryRegionFiltersRelationships() {
        // JS/Swift parity: a LOCAL query keeps only edges with at least one endpoint in the region
        // (JS `!local || inRegion(e.from) || inRegion(e.to)`); global query + snapshot read every edge.
        val f = createField(800f, 600f, particleCount = 100, seed = 3)
        val a = f.addBody(BodySpec(tokens = listOf("attract"), identity = FieldBodyIdentity(id = "a"), rect = { Box(center = Vec3(100f, 300f, 0f)) }))
        val b = f.addBody(BodySpec(tokens = listOf("attract"), identity = FieldBodyIdentity(id = "b"), rect = { Box(center = Vec3(200f, 300f, 0f)) }))
        val c = f.addBody(BodySpec(tokens = listOf("gravity"), identity = FieldBodyIdentity(id = "c"), rect = { Box(center = Vec3(600f, 300f, 0f)) }))
        val d = f.addBody(BodySpec(tokens = listOf("gravity"), identity = FieldBodyIdentity(id = "d"), rect = { Box(center = Vec3(700f, 300f, 0f)) }))
        f.addEdge(a, b, type = "in-in")   // both endpoints inside the region
        f.addEdge(b, c, type = "in-out")  // one endpoint inside — still touches the region
        f.addEdge(c, d, type = "out-out") // no endpoint inside — dropped from a local query
        repeat(5) { f.tick() }

        // local query around (150,300): a + b are in region (dist 50 ≤ r 100), c + d are not
        val local = f.query(FieldQuery(at = FieldQueryAt.Point(x = 150f, y = 300f, radius = 100f)))
        assertEquals(setOf("in-in", "in-out"), local.relationships.map { it.type }.toSet())

        // global query is unchanged — every edge is read
        assertEquals(3, f.query().relationships.size)

        // snapshot is a GLOBAL capture — never region-filtered (mirrors JS `snapshot()`)
        assertEquals(3, f.snapshot().relationships.size)
    }
}
