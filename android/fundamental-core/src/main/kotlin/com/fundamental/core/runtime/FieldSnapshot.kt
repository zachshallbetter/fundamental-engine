package com.fundamental.core.runtime

import com.fundamental.core.engine.FieldBodyIdentity
import com.fundamental.core.math.Vec3

// Substrate READ API — the Field Snapshot primitive (JS critical-path 03). A snapshot captures *what the
// field was doing* at a frame (vs a screenshot's *what it looked like*) — the point-in-time capture that
// `diff`/`replay` are built on (both later follow-ups). Mirror of the JS `@fundamental-engine/core`
// `snapshot()` — same result SHAPE + field names + semantics, so a capture serializes identically across
// planes (the cross-plane conformance goal). Plain data; safe to serialize; read-only (never mutates state).
// EXPERIMENTAL until stabilized. See docs/planning/critical-path/03-field-snapshot-causal-replay.md and
// packages/core/src/core/types.ts.
//
// NOTE: this is DISTINCT from `FieldPerfSnapshot` (perf metrics) — a different thing. This is field STATE.

/**
 * The engine build / snapshot-format version — the Kotlin mirror of the JS `FIELD_VERSION` (`version.ts`).
 * Stamped onto every [FieldSnapshot.version] so a capture records the format it was produced by. Kept in
 * lockstep with the JS constant.
 */
const val FIELD_VERSION: String = "0.9.2"

/**
 * Options for [FieldHandle.snapshot] (JS `FieldSnapshotOptions`). Composes with the runtime privacy
 * [com.fundamental.core.engine.FieldPolicy] and an optional [SnapshotProfile], always resolving to the
 * TIGHTEST (most private) inclusion — a profile/flag can tighten a capture but never widen it.
 */
data class FieldSnapshotOptions(
    /** include the raw particle pool (heavier; OFF by default). Present-but-unused in this port for now. */
    val includeParticles: Boolean? = null,
    /** include the relationship (edge) graph (default TRUE). */
    val includeRelationships: Boolean? = null,
    /** include each body's opaque `data` record (default FALSE — privacy-preserving). */
    val includeData: Boolean? = null,
    /** include per-body force attribution (default FALSE). Empty-for-now in this port (no accumulator). */
    val includeInfluences: Boolean? = null,
    /** apply a named [SnapshotProfile] preset — composes TIGHTEST with the flags + the privacy policy. */
    val profile: SnapshotProfile? = null,
)

/**
 * A body captured in a [FieldSnapshot] (JS `FieldBodySnapshot`). Like a [FieldBodyReading] plus the body's
 * `position` (centre) and its optional opaque `data` — the per-body capture that `diff`/`replay` key on by
 * [id] (`== identity.id`).
 */
data class FieldBodySnapshot(
    /** stable id — equals `identity.id`; snapshot/diff/replay key on it. */
    val id: String,
    /** the body's resolved FIRST-CLASS IDENTITY (`identity.id === id`). Always present. */
    val identity: FieldBodyIdentity,
    /** who owns this body's position. Fixed `"anchored"` until the port adds a body-authority lane. */
    val authority: String,
    /** the body's box in field coordinates. */
    val rect: FieldRect?,
    /** the body's centre in field coordinates (z = 0 for an anchored body). */
    val position: Vec3?,
    /** the composed force ids (the `data-body` tokens). */
    val tokens: List<String>,
    /** scalar readings (lane: metric) — e.g. `density`, `count`, `engaged`, `load`. */
    val metrics: Map<String, Float>,
    /** measured field dimensions (lane: metric). Empty until the port exposes a dimension lane. */
    val dimensions: Map<String, Float>,
    /** the body's opaque record — present ONLY when `includeData` was set AND the policy permits it. */
    val data: Any? = null,
)

/**
 * A portable capture of field state at a moment in time (JS `FieldSnapshot`) — inspect, compare, test,
 * export, or hand to an agent. Plain data; safe to serialize. Field order + names mirror the JS shape 1:1
 * so a capture is identical across planes. Versioned via [version].
 */
data class FieldSnapshot(
    /** a per-field unique id (`snap-<frame>-<n>`). */
    val id: String,
    /** the field clock at capture (`env.t`), NOT wall time. Deterministic. */
    val createdAt: Float,
    /** the frame captured. */
    val frame: Int,
    /** the engine build ([FIELD_VERSION]) — the snapshot-format version. */
    val version: String,
    /** the active Field Formation id(s) at capture. */
    val formations: List<String>,
    val bodies: List<FieldBodySnapshot>,
    val relationships: List<FieldRelationshipReading>,
    val metrics: Map<String, Float>,
    /**
     * per-body force attribution at capture (only when `includeInfluences`). Empty until the port exposes
     * an impulse accumulator — the field name mirrors JS `influences` so the shape stays identical.
     */
    val influences: List<FieldInfluenceReading> = emptyList(),
    /** the projections registered on the field at capture — metadata only. Empty until the port adds a registry. */
    val projections: List<Any> = emptyList(),
)

// ── Field Snapshot diffing (JS `diffFieldSnapshots`) ─────────────────────────────────────────────
// `diff(a, b)` is a PURE comparison of two [FieldSnapshot]s — no live field state — so it is trivially
// testable and usable outside a running field (CI assertions, stored bug reports, AI memory).
// [FieldHandle.diff] delegates to [diffFieldSnapshots] here. Capture ([FieldHandle.snapshot]) lives on
// the handle (it needs the live field); this module owns the comparison so the two halves stay
// independent. Result SHAPE + field names + semantics mirror the JS `@fundamental-engine/core` 1:1.

/**
 * A change to one body between two snapshots (JS `BodyChange`). [kind] is `"added"`, `"removed"`, or
 * `"changed"`. For `"changed"`, [metrics] holds the per-metric before/after for the metrics that differ.
 */
data class BodyChange(
    val id: String,
    /** `"added"` | `"removed"` | `"changed"`. */
    val kind: String,
    /** per-metric before/after for the metrics that changed (kind `"changed"`); null otherwise. */
    val metrics: Map<String, MetricDelta>? = null,
)

/** A before/after pair for one metric value (the JS `{ from, to }` shape). */
data class MetricDelta(val from: Float, val to: Float)

/**
 * A change to one relationship (edge) between two snapshots (JS `RelationshipChange`). The edge is keyed
 * by `from`+`to`+`type`. [kind] is `"added"`, `"removed"`, or `"changed"`; for `"changed"`, [strength]
 * and/or [active] carry the before/after for whichever differed.
 */
data class RelationshipChange(
    val from: String,
    val to: String,
    val type: String,
    /** `"added"` | `"removed"` | `"changed"`. */
    val kind: String,
    val strength: MetricDelta? = null,
    val active: BoolDelta? = null,
)

/** A before/after pair for a boolean (JS `{ from, to }` over booleans — e.g. a relationship's `active`). */
data class BoolDelta(val from: Boolean, val to: Boolean)

/** A change to one field-level metric between two snapshots (JS `MetricChange`). */
data class MetricChange(val key: String, val from: Float, val to: Float)

/**
 * A Field Formation that activated or deactivated between two snapshots (JS `FormationChange`). [kind] is
 * `"activated"` (present in `b`, absent in `a`) or `"deactivated"` (absent in `b`, present in `a`).
 */
data class FormationChange(val id: String, val kind: String)

/**
 * The structured comparison of two [FieldSnapshot]s — what changed in the field, by lane (JS `FieldDiff`).
 * [from]/[to] are the compared snapshots' ids. Order-independent within each lane; produced by the PURE
 * [diffFieldSnapshots].
 */
data class FieldDiff(
    /** the id of snapshot `a`. */
    val from: String,
    /** the id of snapshot `b`. */
    val to: String,
    val bodyChanges: List<BodyChange>,
    val relationshipChanges: List<RelationshipChange>,
    val metricChanges: List<MetricChange>,
    val formationChanges: List<FormationChange>,
)

/** The composite key an edge is compared by (mirror of the JS `relKey`): `from` + `to` + `type`. */
private fun relKey(r: FieldRelationshipReading): String = "${r.from} ${r.to} ${r.type}"

/**
 * Compare two field snapshots and report what changed, by lane (bodies, relationships, metrics,
 * formations). PURE — reads only the two snapshot objects, never the live field, and mutates nothing.
 * Order-independent within each lane. Mirror of the JS `diffFieldSnapshots(a, b)`.
 *
 * - **bodies:** keyed by `id`. A body only in `a` → `removed`; only in `b` → `added`; in both with any
 *   differing metric value → `changed` (with per-metric before/after over the union of metric keys,
 *   missing treated as `0`). A body with identical metrics yields no change.
 * - **relationships:** keyed by `from`+`to`+`type`. Only in `a` → `removed`; only in `b` → `added`; in
 *   both with a differing `strength` and/or `active` → `changed` (carrying the before/after that differed).
 * - **metrics:** the union of field-level metric keys; any differing value (missing treated as `0`) →
 *   a [MetricChange].
 * - **formations:** set difference — in `b` not `a` → `activated`; in `a` not `b` → `deactivated`.
 */
fun diffFieldSnapshots(a: FieldSnapshot, b: FieldSnapshot): FieldDiff {
    // ── bodies ────────────────────────────────────────────────────────────────────────────────
    val bodyChanges = mutableListOf<BodyChange>()
    val aBodies = a.bodies.associateBy { it.id }
    val bBodies = b.bodies.associateBy { it.id }
    for ((id, av) in aBodies) {
        val bv = bBodies[id]
        if (bv == null) {
            bodyChanges.add(BodyChange(id, "removed"))
            continue
        }
        val metrics = mutableMapOf<String, MetricDelta>()
        val keys = av.metrics.keys + bv.metrics.keys
        for (k in keys) {
            val from = av.metrics[k] ?: 0f
            val to = bv.metrics[k] ?: 0f
            if (from != to) metrics[k] = MetricDelta(from, to)
        }
        if (metrics.isNotEmpty()) bodyChanges.add(BodyChange(id, "changed", metrics))
    }
    for (id in bBodies.keys) if (id !in aBodies) bodyChanges.add(BodyChange(id, "added"))

    // ── relationships ─────────────────────────────────────────────────────────────────────────
    val relationshipChanges = mutableListOf<RelationshipChange>()
    val aRel = a.relationships.associateBy { relKey(it) }
    val bRel = b.relationships.associateBy { relKey(it) }
    for ((k, ar) in aRel) {
        val br = bRel[k]
        if (br == null) {
            relationshipChanges.add(RelationshipChange(ar.from, ar.to, ar.type, "removed"))
            continue
        }
        val strength = if (ar.strength != br.strength) MetricDelta(ar.strength, br.strength) else null
        val active = if (ar.active != br.active) BoolDelta(ar.active, br.active) else null
        if (strength != null || active != null) {
            relationshipChanges.add(RelationshipChange(ar.from, ar.to, ar.type, "changed", strength, active))
        }
    }
    for ((k, br) in bRel) {
        if (k !in aRel) relationshipChanges.add(RelationshipChange(br.from, br.to, br.type, "added"))
    }

    // ── field-level metrics ───────────────────────────────────────────────────────────────────
    val metricChanges = mutableListOf<MetricChange>()
    val metricKeys = a.metrics.keys + b.metrics.keys
    for (key in metricKeys) {
        val from = a.metrics[key] ?: 0f
        val to = b.metrics[key] ?: 0f
        if (from != to) metricChanges.add(MetricChange(key, from, to))
    }

    // ── formations ────────────────────────────────────────────────────────────────────────────
    val formationChanges = mutableListOf<FormationChange>()
    val aForm = a.formations.toSet()
    val bForm = b.formations.toSet()
    for (id in bForm) if (id !in aForm) formationChanges.add(FormationChange(id, "activated"))
    for (id in aForm) if (id !in bForm) formationChanges.add(FormationChange(id, "deactivated"))

    return FieldDiff(
        from = a.id,
        to = b.id,
        bodyChanges = bodyChanges,
        relationshipChanges = relationshipChanges,
        metricChanges = metricChanges,
        formationChanges = formationChanges,
    )
}

/**
 * The concrete inclusion flags a [FieldSnapshotOptions] resolves to — the JS `resolveSnapshotInclusion`
 * for the `snapshot()` call site. TIGHTEST-wins: a profile establishes a baseline, an explicit flag may
 * only tighten it further, and `includeData` additionally passes through the policy gate at the call site.
 *
 * With NO profile, mirrors today's JS defaults: relationships default TRUE, everything else default FALSE
 * (so body `data` is withheld unless explicitly opted in — privacy by default).
 */
internal data class ResolvedSnapshotFlags(
    val includeParticles: Boolean,
    val includeRelationships: Boolean,
    val includeData: Boolean,
    val includeInfluences: Boolean,
)

/** Resolve [FieldSnapshotOptions] to concrete inclusion flags, TIGHTEST-wins (JS `resolveSnapshotInclusion`). */
internal fun resolveSnapshotFlags(opts: FieldSnapshotOptions): ResolvedSnapshotFlags {
    val p = opts.profile
    if (p == null) {
        // No profile: today's defaults — relationships default true, the rest default false.
        return ResolvedSnapshotFlags(
            includeParticles = opts.includeParticles == true,
            includeRelationships = opts.includeRelationships != false,
            includeData = opts.includeData == true,
            includeInfluences = opts.includeInfluences == true,
        )
    }
    // Per-profile baselines (mirror of the JS table).
    val base = when (p) {
        SnapshotProfile.DEBUG -> ResolvedSnapshotFlags(true, true, true, true)
        SnapshotProfile.AGENT -> ResolvedSnapshotFlags(false, true, false, true)
        SnapshotProfile.BUG_REPORT -> ResolvedSnapshotFlags(false, true, false, true)
        SnapshotProfile.PUBLIC -> ResolvedSnapshotFlags(false, false, false, false)
    }
    // TIGHTEST wins: a flag is on only if the profile allows it AND the caller didn't explicitly turn it
    // off. An explicit `true` can never widen past the profile's baseline.
    return ResolvedSnapshotFlags(
        includeParticles = base.includeParticles && opts.includeParticles != false,
        includeRelationships = base.includeRelationships && opts.includeRelationships != false,
        includeData = base.includeData && opts.includeData != false,
        includeInfluences = base.includeInfluences && opts.includeInfluences != false,
    )
}
