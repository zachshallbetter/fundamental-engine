package com.fundamental.core

import com.fundamental.core.engine.Box
import com.fundamental.core.engine.FieldBudgets
import com.fundamental.core.engine.FieldPolicy
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.AgentCapability
import com.fundamental.core.runtime.BodySpec
import com.fundamental.core.runtime.FieldSnapshotOptions
import com.fundamental.core.runtime.SnapshotProfile
import com.fundamental.core.runtime.createField
import com.fundamental.core.runtime.resolveSnapshotInclusion
import com.fundamental.core.runtime.scopeSnapshotOptions
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Agent permissions (JS #894) — a read-only, capability-scoped view; tighten-only snapshot profiles.

class AgentPermissionsTests {

    private fun fieldWithBodies() = createField(800f, 600f, particleCount = 100, seed = 3).also {
        it.addBody(BodySpec(tokens = listOf("attract"), strength = 1.5f, range = 800f, rect = { Box(center = Vec3(400f, 300f, 0f)) }))
    }

    @Test
    fun emptyCapabilitiesYieldIdsAndShapeOnly() {
        val f = fieldWithBodies()
        repeat(10) { f.tick() }
        val view = f.forAgent(emptyList())
        // ids always present
        assertTrue(view.bodies().all { it.identity.id.isNotEmpty() })
        // no metrics, no relationships, no influences without the caps
        assertTrue(view.bodies().all { it.metrics.isEmpty() })
        assertTrue(view.relationships().isEmpty())
        assertTrue(view.metrics().isEmpty())
        assertNull(view.influenceAt(400f, 300f))
    }

    @Test
    fun capabilitiesUnlockScopedReads() {
        val f = fieldWithBodies()
        repeat(20) { f.tick() }
        val view = f.forAgent(listOf(AgentCapability.READ_METRICS, AgentCapability.READ_INFLUENCES))
        assertTrue(view.bodies().first().metrics.isNotEmpty())
        assertTrue(view.metrics().containsKey("particleCount"))
        assertNotNull(view.influenceAt(400f, 300f))
        // relationships still gated off
        assertTrue(view.relationships().isEmpty())
    }

    @Test
    fun redactionsStripNamedPathsAfterScoping() {
        val f = fieldWithBodies()
        repeat(10) { f.tick() }
        val view = f.forAgent(listOf(AgentCapability.READ_METRICS), redactions = listOf("metrics.density"))
        assertTrue(view.bodies().all { !it.metrics.containsKey("density") })
        // a non-redacted metric survives
        assertTrue(view.bodies().any { it.metrics.containsKey("count") })
    }

    @Test
    fun bodyDataStaysWithheldWithoutCapabilityOrPolicy() {
        val f = fieldWithBodies()
        // even with the cap, the default (no data lane on engine bodies) yields null — and a deny policy
        // must keep it null regardless.
        f.setPolicy(FieldPolicy(budgets = FieldBudgets(privacy = 0.1f)))
        val view = f.forAgent(listOf(AgentCapability.READ_METRICS, AgentCapability.READ_BODY_DATA))
        assertTrue(view.bodies().all { it.data == null })
    }

    @Test
    fun snapshotProfilesResolveToTightest() {
        // public: nothing structural
        val pub = resolveSnapshotInclusion(SnapshotProfile.PUBLIC)
        assertFalse(pub.relationships); assertFalse(pub.influences); assertFalse(pub.data)
        // agent: structural yes, data no
        val agent = resolveSnapshotInclusion(SnapshotProfile.AGENT, includeData = true)
        assertTrue(agent.relationships); assertTrue(agent.influences)
        assertFalse(agent.data, "agent profile withholds data even when requested")
        // debug: all on, but policy tightens data off
        val debugGated = resolveSnapshotInclusion(SnapshotProfile.DEBUG, includeData = true, policyPermitsData = false)
        assertTrue(debugGated.relationships)
        assertFalse(debugGated.data, "policy tightens data off")
        // explicit false tightens a profile-on flag
        val tightened = resolveSnapshotInclusion(SnapshotProfile.DEBUG, includeRelationships = false)
        assertFalse(tightened.relationships)
    }

    // ── #1160: the two gates that were declared but never consulted ────────────────────────────────

    @Test
    fun readSnapshotsGatesTheCaptureSurface() {
        val f = fieldWithBodies()
        repeat(10) { f.tick() }
        // DENY: every other read cap granted, READ_SNAPSHOTS deliberately withheld.
        val denied = f.forAgent(
            listOf(
                AgentCapability.READ_METRICS, AgentCapability.READ_RELATIONSHIPS,
                AgentCapability.READ_INFLUENCES, AgentCapability.READ_BODY_DATA,
                AgentCapability.READ_PROJECTIONS, AgentCapability.READ_DIAGNOSTICS,
            ),
        )
        assertNull(denied.snapshot(), "no read:snapshots -> the capture is closed, not emptied")
        // the other readings are not collateral damage — a denied agent is barred, not blinded.
        assertTrue(denied.bodies().isNotEmpty())

        // GRANT: the capture surface opens and actually captures.
        val granted = f.forAgent(listOf(AgentCapability.READ_SNAPSHOTS))
        val snap = granted.snapshot()
        assertNotNull(snap)
        assertTrue(snap.bodies.isNotEmpty())

        // an EMPTY grant is the most-restricted view: no capture at all.
        assertNull(f.forAgent(emptyList()).snapshot())
    }

    @Test
    fun readDiagnosticsGatesTheRawParticleLane() {
        // The scoping half is pure, so it is asserted directly — the port's FieldSnapshot has no particle
        // lane yet, so this gate is wired at the option boundary and becomes observable when that lane lands.
        val asked = FieldSnapshotOptions(
            includeParticles = true, includeRelationships = true,
            includeData = true, includeInfluences = true, profile = SnapshotProfile.DEBUG,
        )
        // DENY: no diagnostics cap -> the raw pool is forced off even though DEBUG + the flag ask for it.
        val denied = scopeSnapshotOptions(asked, setOf(AgentCapability.READ_SNAPSHOTS))
        assertFalse(denied.includeParticles!!)
        assertFalse(denied.includeData!!)          // per-lane caps tighten alongside it
        assertFalse(denied.includeRelationships!!)

        // GRANT: the lane may pass through (the profile/flags still decide).
        val granted = scopeSnapshotOptions(asked, setOf(AgentCapability.READ_SNAPSHOTS, AgentCapability.READ_DIAGNOSTICS))
        assertTrue(granted.includeParticles!!)

        // permission is not a request: the cap alone does not switch the heavy lane on.
        assertNull(scopeSnapshotOptions(null, setOf(AgentCapability.READ_SNAPSHOTS, AgentCapability.READ_DIAGNOSTICS)).includeParticles)
    }

    @Test
    fun closedAgentReadBudgetPinsAGrantedCaptureToPublic() {
        val f = fieldWithBodies()
        repeat(10) { f.tick() }
        f.setPolicy(FieldPolicy(budgets = FieldBudgets(agentRead = 0f)))
        val view = f.forAgent(listOf(AgentCapability.READ_SNAPSHOTS, AgentCapability.READ_BODY_DATA, AgentCapability.READ_RELATIONSHIPS))
        val snap = view.snapshot()
        assertNotNull(snap)                                  // granted, so the surface exists
        assertTrue(snap.relationships.isEmpty())             // but pinned to the public profile
        assertTrue(snap.bodies.all { it.data == null })
    }

    @Test
    fun capabilitiesAndRedactionsAreFrozenCopies() {
        val f = fieldWithBodies()
        val caps = mutableListOf(AgentCapability.READ_METRICS)
        val view = f.forAgent(caps)
        caps.add(AgentCapability.READ_INFLUENCES) // mutating the source must not leak in
        assertEquals(setOf(AgentCapability.READ_METRICS), view.capabilities)
    }
}
