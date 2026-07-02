package com.fundamental.core

import com.fundamental.core.engine.Box
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.BodySpec
import com.fundamental.core.runtime.FieldQuery
import com.fundamental.core.runtime.FieldQueryAt
import com.fundamental.core.runtime.FieldQueryInclude
import com.fundamental.core.runtime.createField
import kotlin.test.Test
import kotlin.test.assertEquals
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
}
