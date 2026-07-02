package com.fundamental.core

import com.fundamental.core.engine.Box
import com.fundamental.core.engine.FieldBodyIdentity
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.BodySpec
import com.fundamental.core.runtime.CausalCause
import com.fundamental.core.runtime.CausalReplayStep
import com.fundamental.core.runtime.FieldBodySnapshot
import com.fundamental.core.runtime.FieldRelationshipReading
import com.fundamental.core.runtime.FieldSnapshot
import com.fundamental.core.runtime.MetricDelta
import com.fundamental.core.runtime.ReplayOptions
import com.fundamental.core.runtime.createField
import com.fundamental.core.runtime.replayFieldSnapshots
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

// Substrate READ API — the Causal Replay primitive (JS critical-path 03 phase 2). Mirror of the JS
// `replayFieldSnapshots(a, b, opts)`: an ordered, narrated sequence of causes derived PURELY from the diff
// of two captures (formations → relationships → body measurements → metric moves → forces). PURE — no live
// field access, no mutation. The force lane is empty-for-now in this port (no impulse accumulator), so it is
// exercised only for its shape; the structural lanes (formation/relationship/measurement/metric) are live.

class CausalReplayTests {

    // ── the through-a-field path: capture across a mutation sequence, replay, assert the per-step
    // structural changes appear in order (mirrors FieldDiffTests' field-driven case). ────────────────
    @Test
    fun replayNarratesFormationRelationshipAndMetricStepsInOrder() {
        val f = createField(800f, 600f, particleCount = 100, seed = 3)
        f.addBody(BodySpec(tokens = listOf("attract"), strength = 1.5f, range = 800f, rect = { Box(center = Vec3(200f, 300f, 0f)) }))
        val gravity = f.addBody(BodySpec(tokens = listOf("gravity"), strength = 1f, range = 800f, rect = { Box(center = Vec3(600f, 300f, 0f)) }))
        repeat(10) { f.tick() }
        val a = f.snapshot()

        // Mutate between captures: remove one body, switch the active formation, let the sim run so the
        // surviving body's metrics move.
        val removedId = gravity.identity.id
        gravity.remove()
        f.setFormation("wells")
        repeat(20) { f.tick() }
        val b = f.snapshot()

        val r = f.replay(a, b)

        // from/to carry the two snapshot ids; not scoped.
        assertEquals(a.id, r.from)
        assertEquals(b.id, r.to)
        assertEquals(null, r.focus)

        // every step is stamped with b's frame/time (mirror of JS — the window closes at b).
        assertTrue(r.steps.all { it.frame == b.frame && it.time == b.createdAt })

        // formation steps: "wells" activated + "ambient" deactivated.
        assertTrue(r.steps.any { it.cause == CausalCause.FORMATION && it.source == "wells" && it.description.contains("activated") })
        assertTrue(r.steps.any { it.cause == CausalCause.FORMATION && it.source == "ambient" && it.description.contains("deactivated") })

        // measurement step: the gravity body left the field.
        val left = r.steps.first { it.cause == CausalCause.MEASUREMENT && it.source == removedId }
        assertTrue(left.description.contains("left the field"))

        // metric steps: the surviving body's metrics moved, each carrying a genuine before/after.
        val metricSteps = r.steps.filter { it.cause == CausalCause.METRIC }
        assertTrue(metricSteps.isNotEmpty(), "surviving body's metrics should produce metric steps after 20 ticks")
        assertTrue(metricSteps.all { (it.contribution as MetricDelta).from != (it.contribution as MetricDelta).to })

        // ordering: formations precede relationships precede bodies (measurement + metric) precede forces.
        val order = mapOf(
            CausalCause.FORMATION to 0, CausalCause.RELATIONSHIP to 1,
            CausalCause.MEASUREMENT to 2, CausalCause.METRIC to 2, CausalCause.FORCE to 3,
        )
        val ranks = r.steps.map { order.getValue(it.cause) }
        assertEquals(ranks.sorted(), ranks, "steps must be emitted in the canonical lane order")

        // force lane is empty-for-now (no impulse accumulator in this port).
        assertTrue(r.steps.none { it.cause == CausalCause.FORCE })
    }

    // ── pure, hand-built snapshots: full narration + focus scoping (no field needed). ───────────────
    @Test
    fun replayPureNarratesRelationshipMetricAndFormationSteps() {
        fun body(id: String, metrics: Map<String, Float>) = FieldBodySnapshot(
            id = id, identity = FieldBodyIdentity(id = id, kind = "element"),
            authority = "anchored", rect = null, position = null, tokens = emptyList(),
            metrics = metrics, dimensions = emptyMap(),
        )
        val rel = { from: String, to: String, s: Float, active: Boolean ->
            FieldRelationshipReading(from = from, to = to, type = "attract", strength = s, memory = 0f, active = active, causal = active)
        }
        fun snap(id: String, frame: Int, bodies: List<FieldBodySnapshot>, rels: List<FieldRelationshipReading>, forms: List<String>) =
            FieldSnapshot(id = id, createdAt = frame.toFloat(), frame = frame, version = "test", formations = forms, bodies = bodies, relationships = rels, metrics = emptyMap())

        val a = snap("a", 0, listOf(body("x", mapOf("density" to 1f))), listOf(rel("x", "y", 0.5f, true)), listOf("ambient"))
        // b: x.density rose 1->3; the x->y edge strengthened + went idle; formation ambient->wells.
        val b = snap("b", 5, listOf(body("x", mapOf("density" to 3f))), listOf(rel("x", "y", 0.9f, false)), listOf("wells"))

        val r = replayFieldSnapshots(a, b)

        // formation lane.
        assertTrue(r.steps.any { it.cause == CausalCause.FORMATION && it.description.contains("wells") && it.description.contains("activated") })
        assertTrue(r.steps.any { it.cause == CausalCause.FORMATION && it.description.contains("ambient") && it.description.contains("deactivated") })

        // relationship lane: strengthened + went idle, keyed x->y.
        val relStep = r.steps.first { it.cause == CausalCause.RELATIONSHIP }
        assertEquals("x", relStep.source); assertEquals("y", relStep.target)
        assertTrue(relStep.description.contains("strengthened"))
        assertTrue(relStep.description.contains("went idle"))
        assertEquals(MetricDelta(0.5f, 0.9f), relStep.contribution)

        // metric lane: density rose 1->3.
        val metricStep = r.steps.first { it.cause == CausalCause.METRIC }
        assertEquals("x", metricStep.source)
        assertTrue(metricStep.description.contains("rose"))
        assertEquals(MetricDelta(1f, 3f), metricStep.contribution)

        // every step is stamped with b's frame/time.
        assertTrue(r.steps.all { it.frame == 5 && it.time == 5f })
    }

    @Test
    fun replayFocusScopesToOneBody() {
        fun body(id: String, metrics: Map<String, Float>) = FieldBodySnapshot(
            id = id, identity = FieldBodyIdentity(id = id, kind = "element"),
            authority = "anchored", rect = null, position = null, tokens = emptyList(),
            metrics = metrics, dimensions = emptyMap(),
        )
        fun snap(id: String, bodies: List<FieldBodySnapshot>) =
            FieldSnapshot(id = id, createdAt = 0f, frame = 0, version = "test", formations = emptyList(), bodies = bodies, relationships = emptyList(), metrics = emptyMap())

        val a = snap("a", listOf(body("keep", mapOf("d" to 1f)), body("other", mapOf("d" to 1f))))
        val b = snap("b", listOf(body("keep", mapOf("d" to 2f)), body("other", mapOf("d" to 9f))))

        val r = replayFieldSnapshots(a, b, ReplayOptions(focus = "keep"))
        assertEquals("keep", r.focus)
        assertTrue(r.steps.isNotEmpty())
        assertTrue(r.steps.all { it.source == "keep" }, "focus must drop every step not touching 'keep'")
    }

    @Test
    fun replayOfIdenticalSnapshotHasNoSteps() {
        val f = createField(800f, 600f, particleCount = 100, seed = 3)
        f.addBody(BodySpec(tokens = listOf("attract"), strength = 1.5f, range = 800f, rect = { Box(center = Vec3(200f, 300f, 0f)) }))
        repeat(5) { f.tick() }
        val a = f.snapshot()

        val r = f.replay(a, a)
        assertEquals(a.id, r.from)
        assertEquals(a.id, r.to)
        assertTrue(r.steps.isEmpty(), "replaying a snapshot against itself yields no causal steps")
    }

    // The force lane is empty-for-now (no accumulator): even hand-built snapshots WITH influences produce
    // no `force` steps here, because captured `influences` are always empty in this port. This pins the
    // documented convention so a future accumulator flip is a visible, intentional change.
    @Test
    fun forceLaneEmptyForNow() {
        fun snap(id: String) = FieldSnapshot(
            id = id, createdAt = 0f, frame = 0, version = "test",
            formations = emptyList(), bodies = emptyList(), relationships = emptyList(), metrics = emptyMap(),
            influences = emptyList(),
        )
        val steps: List<CausalReplayStep> = replayFieldSnapshots(snap("a"), snap("b")).steps
        assertTrue(steps.none { it.cause == CausalCause.FORCE })
        assertNotNull(steps)
    }
}
