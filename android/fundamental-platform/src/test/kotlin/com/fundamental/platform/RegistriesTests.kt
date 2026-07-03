package com.fundamental.platform

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.engine.FieldVolume
import com.fundamental.core.math.Vec3
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Behavior coverage for the platform registries (Registries.kt + MeasurementRegistry.kt).
// Identity keying is the through-line: every registry keys on Body reference identity (`===`),
// never structural equality, so two distinct bodies with identical tokens never collide.

// TestHost + NullBoxHost live in TestHosts.kt (shared with FieldPlatformTests).

class RegistriesTests {

    // ── StateRegistry ─────────────────────────────────────────────────────────

    @Test
    fun stateRegistrySetGetRoundTrips() {
        val reg = StateRegistry()
        val body = Body(tokens = listOf("attract"))
        val state = BodyState(density = 0.7f, lit = 0.5f, temperature = 0.3f)

        reg.set(state, body)

        val got = reg.get(body)
        assertNotNull(got, "a set body's state reads back")
        assertEquals(0.7f, got.density)
        assertEquals(0.5f, got.lit)
        assertEquals(0.3f, got.temperature)
    }

    @Test
    fun stateRegistryReadingAnUnsetBodyReturnsNull() {
        val reg = StateRegistry()
        val body = Body(tokens = listOf("attract"))
        assertNull(reg.get(body), "an unset body has no state")
    }

    @Test
    fun stateRegistryRemoveClearsTheEntry() {
        val reg = StateRegistry()
        val body = Body(tokens = listOf("attract"))
        reg.set(BodyState(density = 1f), body)
        reg.remove(body)
        assertNull(reg.get(body), "remove clears the state")
    }

    @Test
    fun stateRegistryKeysOnIdentityNotEquality() {
        val reg = StateRegistry()
        // Two distinct bodies with identical tokens — they must not collide.
        val a = Body(tokens = listOf("attract"))
        val b = Body(tokens = listOf("attract"))
        reg.set(BodyState(density = 0.9f), a)
        assertNull(reg.get(b), "a second distinct body shares no state with the first")
        assertEquals(0.9f, reg.get(a)?.density)
    }

    // ── FeedbackRegistry ──────────────────────────────────────────────────────
    //
    // The ported FeedbackRegistry is a write-phase stub: `flush` is a no-op (concrete
    // attribute writes live in platform targets). We assert the API is safely callable —
    // flush before any sink, after setSink, and after clearing the sink — never throws.

    @Test
    fun feedbackRegistryFlushIsASafeNoOpWithNoSink() {
        val feedback = FeedbackRegistry()
        val state = StateRegistry()
        feedback.flush(state, now = 1.0)
    }

    @Test
    fun feedbackRegistrySetSinkAndFlushDoesNotInvokeSinkInStub() {
        // The ported flush() is a stub, so even a registered sink is not called yet.
        // This pins the current contract: flush is side-effect-free at the platform-core layer.
        var calls = 0
        val feedback = FeedbackRegistry()
        feedback.setSink { _, _ -> calls += 1 }
        feedback.flush(StateRegistry(), now = 2.0)
        assertEquals(0, calls, "the stub flush does not yet drive the sink")
        feedback.setSink(null) // clearing the sink is safe
        feedback.flush(StateRegistry(), now = 3.0)
    }

    // ── RelationshipRegistry ──────────────────────────────────────────────────

    @Test
    fun relationshipRegistryAddAndQueryByFrom() {
        val reg = RelationshipRegistry()
        val a = Body(tokens = listOf("attract"))
        val b = Body(tokens = listOf("attract"))
        val c = Body(tokens = listOf("attract"))
        reg.add(RelationshipRegistry.Relationship(from = a, to = b, kind = "spill"))
        reg.add(RelationshipRegistry.Relationship(from = a, to = c, kind = "cause"))

        val fromA = reg.relationships(from = a)
        assertEquals(2, fromA.size, "both edges out of a are returned")
        assertTrue(fromA.all { it.from === a })
        assertTrue(fromA.any { it.to === b && it.kind == "spill" })
        assertTrue(fromA.any { it.to === c && it.kind == "cause" })
        assertTrue(reg.relationships(from = b).isEmpty(), "b has no outgoing edges")
    }

    @Test
    fun relationshipRegistryRemoveByBodyIdentity() {
        val reg = RelationshipRegistry()
        val a = Body(tokens = listOf("attract"))
        val b = Body(tokens = listOf("attract"))
        val c = Body(tokens = listOf("attract"))
        reg.add(RelationshipRegistry.Relationship(from = a, to = b, kind = "spill"))
        reg.add(RelationshipRegistry.Relationship(from = a, to = c, kind = "cause"))

        reg.remove(from = a, to = b)

        val fromA = reg.relationships(from = a)
        assertEquals(1, fromA.size, "only the a→b edge was removed")
        assertTrue(fromA.single().to === c, "the a→c edge survives")
    }

    @Test
    fun relationshipRegistryRemoveMatchesOnIdentityNotEquality() {
        val reg = RelationshipRegistry()
        val a = Body(tokens = listOf("attract"))
        val b = Body(tokens = listOf("attract"))
        // A structurally-equal but distinct "to" must NOT remove the real edge.
        val bImposter = Body(tokens = listOf("attract"))
        reg.add(RelationshipRegistry.Relationship(from = a, to = b, kind = "spill"))

        reg.remove(from = a, to = bImposter)
        assertEquals(1, reg.relationships(from = a).size, "identity mismatch leaves the edge intact")

        reg.remove(from = a, to = b)
        assertTrue(reg.relationships(from = a).isEmpty(), "the identical-reference edge is removed")
    }

    // ── VisualBindingRegistry ─────────────────────────────────────────────────

    @Test
    fun visualBindingRegistryBindAndQueryByBody() {
        val reg = VisualBindingRegistry()
        val a = Body(tokens = listOf("attract"))
        val b = Body(tokens = listOf("attract"))
        val targetA = Any()
        reg.bind(body = a, lane = "density", target = targetA)
        reg.bind(body = a, lane = "temperature", target = Any())
        reg.bind(body = b, lane = "entropy", target = Any())

        val forA = reg.bindings(body = a)
        assertEquals(2, forA.size, "both of a's lanes are bound")
        assertTrue(forA.all { it.body === a })
        assertTrue(forA.any { it.lane == "density" && it.target === targetA })
        assertTrue(forA.any { it.lane == "temperature" })
        assertEquals(1, reg.bindings(body = b).size, "b's binding is isolated from a")
    }

    @Test
    fun visualBindingRegistryQueryKeysOnIdentity() {
        val reg = VisualBindingRegistry()
        val a = Body(tokens = listOf("attract"))
        val twin = Body(tokens = listOf("attract"))
        reg.bind(body = a, lane = "density", target = Any())
        assertTrue(reg.bindings(body = twin).isEmpty(), "a structurally-equal body has no bindings")
    }

    // ── OverlayRegistry ───────────────────────────────────────────────────────

    @Test
    fun overlayRegistryStartsEmpty() {
        val reg = OverlayRegistry()
        assertTrue(reg.isEmpty)
        assertTrue(reg.activeOverlays.isEmpty())
    }

    @Test
    fun overlayRegistrySetSingleOverlay() {
        val reg = OverlayRegistry()
        reg.setOverlay(OverlayInput.Single(OverlayMode.STREAMLINES))
        assertFalse(reg.isEmpty)
        assertEquals(listOf(OverlayMode.STREAMLINES), reg.activeOverlays)
    }

    @Test
    fun overlayRegistrySingleOffClearsOverlays() {
        val reg = OverlayRegistry()
        reg.setOverlay(OverlayInput.Single(OverlayMode.GRID))
        reg.setOverlay(OverlayInput.Single(OverlayMode.OFF))
        assertTrue(reg.isEmpty, "Single(OFF) clears the active overlays")
        assertTrue(reg.activeOverlays.isEmpty())
    }

    @Test
    fun overlayRegistryStackFiltersOutOff() {
        val reg = OverlayRegistry()
        reg.setOverlay(
            OverlayInput.Stack(
                listOf(OverlayMode.STREAMLINES, OverlayMode.OFF, OverlayMode.FORCE_VECTORS),
            ),
        )
        assertEquals(
            listOf(OverlayMode.STREAMLINES, OverlayMode.FORCE_VECTORS),
            reg.activeOverlays,
            "OFF is stripped from a stack, order preserved",
        )
    }

    // ── MeasurementRegistry ───────────────────────────────────────────────────
    //
    // OverlayRegistry has no resolve-against-snapshot API in the ported slice, so the
    // measurement coverage here exercises the registry's own snapshot contract directly.

    @Test
    fun measurementRegistryRegisterHasUnregisterCount() {
        val reg = MeasurementRegistry()
        val body = Body(tokens = listOf("attract"))
        assertFalse(reg.has(body))
        assertEquals(0, reg.count)

        reg.register(body)
        assertTrue(reg.has(body))
        assertEquals(1, reg.count)

        reg.unregister(body)
        assertFalse(reg.has(body))
        assertEquals(0, reg.count)
    }

    @Test
    fun measurementRegistrySnapshotAndLookupAfterMeasure() {
        val host = TestHost(FieldVolume(400f, 300f, depth = 20f))
        val reg = MeasurementRegistry()
        val body = Body(tokens = listOf("attract"))
        body.box = Box(center = Vec3(200f, 150f, 10f), halfExtents = Vec3(20f, 20f, 10f))
        // `Body.view` is the opaque platform handle the host boxes; TestHost keys `worldBox` on it.
        // Self-reference here so the host reads this body's own `box` (mirrors the view-backed contract).
        body.view = body
        reg.register(body)

        val out = reg.measure(now = 5.0, volume = host.volume, host = host)

        assertEquals(1, out.size, "the registered body produced one measurement")
        assertEquals(out, reg.snapshot, "the snapshot mirrors the returned measurements")
        val m = reg.measurement(body)
        assertNotNull(m, "measurement(body) finds the body in the snapshot")
        assertEquals(5.0, m.timestamp)
        assertTrue(m.isVisible, "a body inside the volume is visible (ratio > 0)")
    }

    @Test
    fun measurementRegistryDropsBodiesWithNoWorldBox() {
        // When the host can't resolve a body's world box, measure() drops it from the registry.
        val host = NullBoxHost(FieldVolume(100f, 100f))
        val reg = MeasurementRegistry()
        val body = Body(tokens = listOf("attract"))
        body.view = body // present view, but the host still can't box it — exercises the box-null drop.
        reg.register(body)
        assertTrue(reg.has(body))

        val out = reg.measure(volume = host.volume, host = host)

        assertTrue(out.isEmpty(), "an unresolvable body yields no measurement")
        assertFalse(reg.has(body), "the unresolvable body was dropped from the registry")
        assertEquals(0, reg.count)
    }

    @Test
    fun measurementRegistryDropsBodiesWhoseViewIsGone() {
        // Contract mirror of Swift's `guard let view = body.view` (MeasurementRegistry.swift): a body
        // registered without a live view handle (view-less, or a GC'd weak ref) is dropped by measure()
        // BEFORE the host is even asked to box it — the host never sees a `Body` masquerading as a view.
        val host = TestHost(FieldVolume(100f, 100f))
        val reg = MeasurementRegistry()
        val body = Body(tokens = listOf("attract")) // no `view` set → view == null.
        reg.register(body)
        assertTrue(reg.has(body))

        val out = reg.measure(volume = host.volume, host = host)

        assertTrue(out.isEmpty(), "a body with no view yields no measurement")
        assertFalse(reg.has(body), "the view-less body was dropped from the registry")
        assertEquals(0, reg.count)
    }

    @Test
    fun measurementRegistryReReadsScrolledGeometryEveryMeasure() {
        // Scroll body-centre tracking (#508/#509): measure() re-reads geometry from the host on
        // EVERY call — no internal cache or throttle — so a scrolled body's centre is fresh each
        // read-phase and never needs the JS core's between-measure scroll-delta compensation. If
        // a measure cadence is ever introduced, this fails and the JS `dScroll` compensation
        // (field.ts) must be ported alongside it.
        val host = ScrollingTestHost(FieldVolume(375f, 812f))
        val reg = MeasurementRegistry()
        val docY = 600f
        val body = Body(tokens = listOf("attract"))
        body.view = body // the host keys `docBoxes` / `worldBox` on the body's view handle.
        host.docBoxes[body] = Box(center = Vec3(187f, docY, 0f), halfExtents = Vec3(50f, 25f, 0f))
        reg.register(body)

        for (i in 1..12) {
            host.scroll = i * 8f
            val out = reg.measure(now = i / 60.0, volume = host.volume, host = host)
            assertEquals(1, out.size)
            assertEquals(docY - host.scroll, out[0].box.center.y, "read $i: the measurement reflects the live scroll")
            assertEquals(docY - host.scroll, body.box.center.y, "read $i: the body's cached box is refreshed")
        }
    }
}
