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
    /**
     * Gates the CAPTURE surface: [AgentFieldView.snapshot] returns null unless this is granted. Withholding
     * it CLOSES the call rather than emptying it — an empty capture is indistinguishable from an empty
     * field. The always-available readings (ids + shape) are unaffected. Mirrors the JS gate, where the
     * member is absent from the facade entirely.
     */
    READ_SNAPSHOTS("read:snapshots"),
    READ_BODY_DATA("read:body-data"),
    READ_PROJECTIONS("read:projections"),
    /**
     * Gates the DIAGNOSTIC lane of a capture — the raw particle pool (`includeParticles`), the engine's own
     * internal state rather than a modelled reading of bodies / relationships / metrics. Without it
     * `includeParticles` is forced off even under [SnapshotProfile.DEBUG] (tightens, never widens).
     */
    READ_DIAGNOSTICS("read:diagnostics"),
    READ_REPLAY("read:replay"),
}

/**
 * Tighten a caller's [FieldSnapshotOptions] to what a capability grant allows — the shared,
 * side-effect-free half of the agent view's `snapshot()` gate (mirrors the JS `scopeSnapshot` scoping block
 * and the Swift `scopeSnapshotOptions`). TIGHTEN-ONLY: every branch can turn an inclusion OFF and none can
 * turn one on, so this can never widen a capture past what the caller asked for. Note it does NOT consult
 * [AgentCapability.READ_SNAPSHOTS] — that gate decides whether a capture may be taken at all, and is
 * applied by the view before it ever reaches here.
 */
fun scopeSnapshotOptions(
    opts: FieldSnapshotOptions?,
    capabilities: Set<AgentCapability>,
): FieldSnapshotOptions {
    val o = opts ?: FieldSnapshotOptions()
    return o.copy(
        includeRelationships = if (capabilities.contains(AgentCapability.READ_RELATIONSHIPS)) o.includeRelationships else false,
        includeData = if (capabilities.contains(AgentCapability.READ_BODY_DATA)) o.includeData else false,
        includeInfluences = if (capabilities.contains(AgentCapability.READ_INFLUENCES)) o.includeInfluences else false,
        includeParticles = if (capabilities.contains(AgentCapability.READ_DIAGNOSTICS)) o.includeParticles else false,
    )
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

    /** #915 — the share of the body population this view may consume (1 = the whole field). */
    private fun agentReadShare(): Float = handle.controller.policy.budgets?.agentRead ?: 1f
    private fun partial(): Boolean = agentReadShare() < 1f
    private fun redacted(path: String) = redactions.contains(path)

    /**
     * The bodies visible to this agent — always ids; metrics only with `read:metrics`; data only with
     * `read:body-data` AND policy permission. Redactions strip named metric/data paths.
     */
    fun bodies(): List<AgentBodyReading> {
        val wantMetrics = has(AgentCapability.READ_METRICS)
        val wantData = has(AgentCapability.READ_BODY_DATA) && handle.controller.policyPermitsBodyData() && !redacted("body.data")
        // #915: a partial read admits only its share of the body population.
        val share = agentReadShare()
        return handle.controller.bodies.filter { AgentReadShare.admits(handle.controller.bodyIdentity(it).id, share) }.map { b ->
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
        // #915: an `EdgeRecord` names its endpoints by the body's opaque `data`, not by identity, so a
        // partial read has NO KEY to filter it on. Tighten-only closes the lane outright under a
        // fractional budget; the endpoint-filtered graph is still available through `snapshot()`, whose
        // relationship readings are keyed by id. Giving EdgeRecord real ids would lift this.
        if (partial()) return emptyList()
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

    /**
     * A capability-scoped, portable [FieldSnapshot] — the CAPTURE surface, gated by
     * [AgentCapability.READ_SNAPSHOTS]. Returns null when that capability is NOT granted: the call is
     * closed, not emptied, because an empty capture reads exactly like an empty field and a
     * silently-permissive reading is the failure this gate exists to stop. JS expresses the same gate by
     * omitting the member from the facade; a Kotlin class member cannot vanish, so null is the idiomatic
     * mirror — the same shape [influenceAt] already uses.
     *
     * When granted, the per-lane caps still tighten what the capture contains (no `read:body-data` → no
     * opaque body `data`; no `read:diagnostics` → no raw particle pool), and a closed `agentRead` budget
     * pins the whole capture to the most-restricted profile, mirroring JS.
     */
    fun snapshot(opts: FieldSnapshotOptions? = null): FieldSnapshot? {
        if (!has(AgentCapability.READ_SNAPSHOTS)) return null
        val agentRead = handle.controller.policy.budgets?.agentRead
        if (agentRead != null && agentRead <= 0f) {
            return handle.snapshot(FieldSnapshotOptions(profile = SnapshotProfile.PUBLIC))
        }
        val snap = handle.snapshot(scopeSnapshotOptions(opts, capabilities))
        // #915: narrow the capture to the admitted share. Edges survive only when EVERY body they name
        // does — a relationship or influence naming a withheld body is itself a disclosure of that body.
        val share = agentReadShare()
        if (share >= 1f) return snap
        val kept = snap.bodies.map { it.id }.filter { AgentReadShare.admits(it, share) }.toSet()
        return snap.copy(
            bodies = snap.bodies.filter { kept.contains(it.id) },
            relationships = snap.relationships.filter { kept.contains(it.from) && kept.contains(it.to) },
            influences = snap.influences.filter { kept.contains(it.source) && (it.target == null || kept.contains(it.target)) },
        )
    }
}

// The body's carried `data` lives on the BodyHandle, not the Body; a programmatic body stores it via the
// controller's edge/data plumbing. The engine Body has no `data` slot, so the agent view exposes null
// here unless a future data lane lands — kept explicit so the capability gate is still exercised.
private fun com.fundamental.core.engine.Body.dataOf(): Any? = null

/**
 * #915 — the fractional `budgets.agentRead` gate.
 *
 * `budgets.agentRead` is a conservation law on the agent surface: `b` is the SHARE of the field's
 * readable body population one agent view may consume. `null` or `b >= 1` is the whole field, `b <= 0`
 * closes the surface entirely, and `0 < b < 1` grants a partial read.
 *
 * Selection is deterministic, stable per body id, and not positional — a random draw would be
 * unreplayable, a subset resampled per call leaks the whole field to a caller that simply reads in a
 * loop, and a positional prefix leaks scan order. **This digest must stay bit-identical to the JS and
 * Swift implementations**, or the planes admit different bodies under the same policy.
 */
object AgentReadShare {
    /**
     * FNV-1a over the id's UTF-16 code units, then a murmur3 `fmix32` avalanche. The finalizer is not
     * optional: real body ids are near-identical short strings (`body-0`, `body-1`, …) and raw FNV-1a
     * barely mixes its high bits across them — which is the whole signal once read as `h / 2^32`.
     */
    fun coordinate(id: String): Double {
        var h = -0x7ee3623b // 0x811c9dc5 as a signed Int
        for (ch in id) {
            h = h xor ch.code
            h *= 0x01000193
        }
        h = h xor (h ushr 16)
        h *= -0x7a143595 // 0x85ebca6b
        h = h xor (h ushr 13)
        h *= -0x3d4d51cb // 0xc2b2ae35
        h = h xor (h ushr 16)
        return (h.toLong() and 0xffffffffL).toDouble() / 4294967296.0
    }

    /** Whether a partial read at [share] admits the body with this id. */
    fun admits(id: String, share: Float): Boolean {
        if (!(share < 1f)) return true
        return coordinate(id) < share.toDouble()
    }
}
