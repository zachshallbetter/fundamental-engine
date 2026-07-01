package com.fundamental.core.runtime

import com.fundamental.core.engine.FieldBodyIdentity
import com.fundamental.core.engine.policyPermitsBodyData
import com.fundamental.core.math.Vec3

// Agent permissions (JS #894) — a capability-scoped, READ-ONLY view a Software Agent uses to read the
// field safely. `agent-readable is not agent-writable`: the facade has NO mutators. Every reading is
// tightened to the granted capabilities, then redactions strip named paths, and nothing can widen past
// what the field's FieldPolicy already permits. A snapshot profile resolves to the TIGHTEST inclusion.

/**
 * A scoped read CAPABILITY an [AgentFieldView] grants (JS #894). Each names one dimension of the field's
 * read surface; a capability set is an allow-list — a dimension the caps don't include is stripped from
 * every reading (it tightens, never widens). Read-only throughout: there is no write capability.
 */
enum class AgentCapability(val token: String) {
    READ_METRICS("read:metrics"),
    READ_RELATIONSHIPS("read:relationships"),
    READ_INFLUENCES("read:influences"),
    READ_SNAPSHOTS("read:snapshots"),
    READ_BODY_DATA("read:body-data"),
    READ_PROJECTIONS("read:projections"),
    READ_DIAGNOSTICS("read:diagnostics"),
    READ_REPLAY("read:replay"),
}

/**
 * A named snapshot profile (JS #894) — a concrete inclusion preset resolved to the TIGHTEST (most
 * private) combination of its base inclusions, any explicit request, and the runtime privacy policy.
 * A profile can only tighten a call; it never widens past what policy allows.
 *
 * - [DEBUG] — everything (body data still gated by policy).
 * - [AGENT] — ids + metrics + relationships + influences, but NO opaque body data.
 * - [BUG_REPORT] — structural (relationships + influences), no user data.
 * - [PUBLIC] — minimal: ids + shape only, no relationships, influences, or data.
 */
enum class SnapshotProfile { DEBUG, AGENT, BUG_REPORT, PUBLIC }

/** The resolved inclusion flags for a snapshot read (JS #894 `resolveSnapshotInclusion`). */
data class ResolvedSnapshotInclusion(
    val relationships: Boolean,
    val influences: Boolean,
    val data: Boolean,
)

/**
 * Resolve snapshot inclusions to the TIGHTEST of the profile's base, the explicit request, and the
 * privacy policy (JS #894). Every flag is an AND: a `true` survives only when the profile, the request,
 * AND policy all allow it. `null` request flags fall through to the profile default.
 */
fun resolveSnapshotInclusion(
    profile: SnapshotProfile = SnapshotProfile.DEBUG,
    includeRelationships: Boolean? = null,
    includeInfluences: Boolean? = null,
    includeData: Boolean? = null,
    policyPermitsData: Boolean = true,
): ResolvedSnapshotInclusion {
    val base = when (profile) {
        SnapshotProfile.DEBUG -> ResolvedSnapshotInclusion(relationships = true, influences = true, data = true)
        SnapshotProfile.AGENT -> ResolvedSnapshotInclusion(relationships = true, influences = true, data = false)
        SnapshotProfile.BUG_REPORT -> ResolvedSnapshotInclusion(relationships = true, influences = true, data = false)
        SnapshotProfile.PUBLIC -> ResolvedSnapshotInclusion(relationships = false, influences = false, data = false)
    }
    // A request flag can only TIGHTEN (AND): default true, an explicit false turns it off; an explicit
    // true cannot re-enable what the profile turned off.
    fun tighten(baseOn: Boolean, req: Boolean?) = baseOn && (req ?: true)
    return ResolvedSnapshotInclusion(
        relationships = tighten(base.relationships, includeRelationships),
        influences = tighten(base.influences, includeInfluences),
        data = tighten(base.data, includeData) && policyPermitsData, // policy tightens further
    )
}

/** A body as seen through an [AgentFieldView] — identity + scoped metrics, never object references. */
data class AgentBodyReading(
    val identity: FieldBodyIdentity,
    /** scalar readings (present only when `read:metrics` is granted). */
    val metrics: Map<String, Float>,
    /** the body's opaque data (present only when `read:body-data` is granted AND policy permits). */
    val data: Any?,
)

/** A relationship as seen through an [AgentFieldView] (present only when `read:relationships`). */
data class AgentRelationshipReading(
    val from: Any?,
    val to: Any?,
    val type: String,
    val strength: Float,
    val active: Boolean,
)

/**
 * A READ-ONLY facade over a field, scoped to a set of [AgentCapability]s (JS #894) — the surface a
 * Software Agent uses to read the field safely. It has NO mutation methods — no addBody, no setPolicy —
 * enforced by the facade's very shape. Every reading is tightened to the granted capabilities, then any
 * redaction paths are stripped, and the result can never widen past what the field's FieldPolicy permits.
 *
 * Redactions are dotted paths stripped AFTER capability scoping (`"metrics.temperature"` drops that
 * metric from every body; `"body.data"` drops all body data). Tighten-only.
 */
class AgentFieldView internal constructor(
    private val handle: FieldHandle,
    capabilities: Collection<AgentCapability>,
    redactions: Collection<String> = emptyList(),
) {
    /** the granted capabilities (a frozen copy). */
    val capabilities: Set<AgentCapability> = capabilities.toSet()
    /** the redaction paths (a frozen copy). */
    val redactions: Set<String> = redactions.toSet()

    private fun has(cap: AgentCapability) = capabilities.contains(cap)
    private fun redacted(path: String) = redactions.contains(path)

    /**
     * The bodies visible to this agent — always ids; metrics only with `read:metrics`; data only with
     * `read:body-data` AND policy permission. Redactions strip named metric/data paths.
     */
    fun bodies(): List<AgentBodyReading> {
        val wantMetrics = has(AgentCapability.READ_METRICS)
        val wantData = has(AgentCapability.READ_BODY_DATA) && handle.controller.policyPermitsBodyData() && !redacted("body.data")
        return handle.controller.bodies.map { b ->
            val ident = handle.controller.bodyIdentity(b)
            val metrics: Map<String, Float> = if (wantMetrics) {
                buildMap {
                    if (!redacted("metrics.density")) put("density", b.d)
                    if (!redacted("metrics.count")) put("count", b.count)
                    if (!redacted("metrics.engaged")) put("engaged", if (b.isEngaged) 1f else 0f)
                    if (b.capacity > 0f && !redacted("metrics.load")) put("load", (b.accreted / b.capacity).coerceIn(0f, 1f))
                }
            } else emptyMap()
            AgentBodyReading(identity = ident, metrics = metrics, data = if (wantData) b.dataOf() else null)
        }
    }

    /** Relationships — present ONLY when `read:relationships` is granted (else empty). */
    fun relationships(): List<AgentRelationshipReading> {
        if (!has(AgentCapability.READ_RELATIONSHIPS)) return emptyList()
        return handle.readEdges().map { AgentRelationshipReading(it.from, it.to, it.type, it.strength, it.active) }
    }

    /** The net influence (force) vector at a point — present ONLY when `read:influences` is granted. */
    fun influenceAt(x: Float, y: Float): Vec3? =
        if (has(AgentCapability.READ_INFLUENCES)) handle.sample(x, y) else null

    /** Field-level metrics — present ONLY when `read:metrics` is granted (else empty). */
    fun metrics(): Map<String, Float> {
        if (!has(AgentCapability.READ_METRICS)) return emptyMap()
        return buildMap {
            if (!redacted("metrics.particleCount")) put("particleCount", handle.particleCount().toFloat())
            if (!redacted("metrics.kinetic")) put("kinetic", handle.energy().kinetic)
        }
    }
}

// The body's carried `data` lives on the BodyHandle, not the Body; a programmatic body stores it via the
// controller's edge/data plumbing. The engine Body has no `data` slot, so the agent view exposes null
// here unless a future data lane lands — kept explicit so the capability gate is still exercised.
private fun com.fundamental.core.engine.Body.dataOf(): Any? = null
