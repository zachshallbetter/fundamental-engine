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
 * lockstep with the JS constant / the release version: `VersionLockstepTests` fails the build if this
 * drifts from `packages/core/package.json` (#923) — update it here on every release bump.
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
    /** the projections registered on the field at capture — metadata only. See [ProjectionRegistry]. */
    val projections: List<FieldProjectionInfo> = emptyList(),
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

// ── Causal Replay (JS critical-path 03 phase 2 — `replayFieldSnapshots`) ─────────────────────────
// Explain HOW the field changed between two snapshots — an ordered, narrated sequence of causes derived
// PURELY from the diff (formation activations → relationship shifts → body measurements → metric moves →
// force attributions). `FieldHandle.replay` delegates to [replayFieldSnapshots] here. Like `diff`, it
// reads only the two snapshot objects, never the live field, and mutates nothing. Result SHAPE + field
// names + semantics mirror the JS `@fundamental-engine/core` 1:1 so a replay serializes identically across
// planes. EXPERIMENTAL until stabilized. See packages/core/src/core/field-snapshot.ts.
//
// PORT NOTE (influences-derived cause empty-for-now): the JS `force` lane derives per-body force-attribution
// shifts from each snapshot's `influences`. This port has NO impulse accumulator, so captured `influences`
// are always empty (exactly as `query`/`snapshot`/`diff` left them). The force-lane logic is mirrored
// field-for-field below but simply produces no steps until the port grows an accumulator — the shape stays
// identical, only that one lane is dormant. The structural lanes (formation/relationship/measurement/metric)
// are fully live.

/** The lane a [CausalReplayStep] belongs to (JS `CausalCause`). */
enum class CausalCause(val value: String) {
    FORCE("force"),
    RELATIONSHIP("relationship"),
    METRIC("metric"),
    FORMATION("formation"),
    MEASUREMENT("measurement"),
}

/** Options for [FieldHandle.replay] (JS `ReplayOptions`). */
data class ReplayOptions(
    /** restrict the replay to steps touching this body id (its metrics, or a relationship endpoint). */
    val focus: String? = null,
)

/**
 * One narrated cause in a [CausalReplay] (JS `CausalReplayStep`). [contribution] is the structured
 * before/after behind the [description] — a [MetricDelta] for a metric/force move, else null.
 */
data class CausalReplayStep(
    val frame: Int,
    val time: Float,
    val cause: CausalCause,
    /** the body/edge the cause originates from (a body id, or a relationship's `from`). */
    val source: String? = null,
    /** the affected target, when the cause is a relationship. */
    val target: String? = null,
    /** a human-readable account of the change (lane: diagnostic). */
    val description: String,
    /** the structured before/after behind the description (e.g. a [MetricDelta]); null when none. */
    val contribution: Any? = null,
)

/**
 * An explanation of how the field changed between two snapshots — the ordered causal steps (JS
 * `CausalReplay`). PURE (derived from the two snapshots); plain data, safe to serialize.
 */
data class CausalReplay(
    /** the id of snapshot `a`. */
    val from: String,
    /** the id of snapshot `b`. */
    val to: String,
    /** the focus body id, if the replay was scoped to one. */
    val focus: String? = null,
    val steps: List<CausalReplayStep>,
)

/**
 * Explain HOW the field changed from snapshot [a] to snapshot [b] — an ordered, narrated sequence of causes
 * derived from the diff (formation activations → relationship shifts → body measurements → metric changes →
 * force attributions). PURE; preserves the before/after on each step's [CausalReplayStep.contribution].
 * [ReplayOptions.focus] scopes the replay to one body id (its metrics, or a relationship it participates in).
 * Mirror of the JS `replayFieldSnapshots(a, b, opts)`; [FieldHandle.replay] delegates here.
 *
 * Step ordering (mirrors JS): formations first (the global bias that frames the window), then relationships
 * (edges formed / dissolved / strengthened / activated), then bodies (entered / left, then per-metric
 * movements), then forces. The force lane compares each `(source, force, channel)` influence's magnitude
 * A→B and narrates which force engaged/grew/weakened/released — but only when BOTH snapshots captured
 * influences. In this port influences are always empty (no accumulator), so the force lane yields no steps.
 */
fun replayFieldSnapshots(a: FieldSnapshot, b: FieldSnapshot, opts: ReplayOptions = ReplayOptions()): CausalReplay {
    fun r2(n: Float): Float = Math.round(n * 1000f) / 1000f
    val d = diffFieldSnapshots(a, b)
    val frame = b.frame
    val time = b.createdAt
    val steps = mutableListOf<CausalReplayStep>()
    fun step(cause: CausalCause, description: String, source: String? = null, target: String? = null, contribution: Any? = null) {
        steps.add(CausalReplayStep(frame = frame, time = time, cause = cause, source = source, target = target, description = description, contribution = contribution))
    }

    // formations first (the global bias that frames everything else this window)
    for (f in d.formationChanges) {
        step(CausalCause.FORMATION, "Formation '${f.id}' ${f.kind}", source = f.id)
    }
    // relationships — the edges that strengthened / activated / appeared
    for (rc in d.relationshipChanges) {
        val what: String = when (rc.kind) {
            "added" -> "formed"
            "removed" -> "dissolved"
            else -> {
                val parts = mutableListOf<String>()
                rc.active?.let { parts.add(if (it.to) "became active" else "went idle") }
                rc.strength?.let {
                    val verb = if (it.to >= it.from) "strengthened" else "weakened"
                    parts.add("$verb ${r2(it.from)}→${r2(it.to)}")
                }
                if (parts.isEmpty()) "changed" else parts.joinToString(", ")
            }
        }
        step(
            CausalCause.RELATIONSHIP,
            "Relationship ${rc.from}→${rc.to} (${rc.type}) $what",
            source = rc.from,
            target = rc.to,
            contribution = rc.strength,
        )
    }
    // bodies — entered/left, then per-metric movements
    for (bc in d.bodyChanges) {
        when {
            bc.kind == "added" -> step(CausalCause.MEASUREMENT, "Body ${bc.id} entered the field", source = bc.id)
            bc.kind == "removed" -> step(CausalCause.MEASUREMENT, "Body ${bc.id} left the field", source = bc.id)
            bc.metrics != null -> {
                for ((k, v) in bc.metrics) {
                    val dir = if (v.to > v.from) "rose" else "fell"
                    step(CausalCause.METRIC, "Body ${bc.id} $k $dir ${r2(v.from)}→${r2(v.to)}", source = bc.id, contribution = v)
                }
            }
        }
    }

    // forces — per-body attribution shifts (only when BOTH snapshots captured influences, via
    // snapshot(includeInfluences)). Compares each (source, force, channel)'s magnitude A→B so the replay can
    // say *which force* drove the change. EMPTY-FOR-NOW: this port has no impulse accumulator, so
    // `influences` is always empty and this lane yields no steps. The logic mirrors JS field-for-field so
    // the lane comes alive unchanged once an accumulator lands.
    if (a.influences.isNotEmpty() && b.influences.isNotEmpty()) {
        fun mag(c: Vec3): Float = kotlin.math.sqrt(c.x * c.x + c.y * c.y + c.z * c.z)
        fun key(i: FieldInfluenceReading): String = "${i.source} ${i.force} ${i.channel}"
        val am = a.influences.associateBy { key(it) }
        val bm = b.influences.associateBy { key(it) }
        for (k in am.keys + bm.keys) {
            val ai = am[k]
            val bi = bm[k]
            val m0 = ai?.let { mag(it.contribution) } ?: 0f
            val m1 = bi?.let { mag(it.contribution) } ?: 0f
            if (kotlin.math.abs(m1 - m0) < 1e-9f) continue
            val ref = bi ?: ai!!
            val verb = if (m1 > m0) (if (m0 == 0f) "engaged" else "grew") else if (m1 == 0f) "released" else "weakened"
            val lane = if (ref.channel == "thermal") " (thermal)" else ""
            step(
                CausalCause.FORCE,
                "Force ${ref.force} on ${ref.source}$lane $verb ${r2(m0)}→${r2(m1)}",
                source = ref.source,
                contribution = MetricDelta(m0, m1),
            )
        }
    }

    val focus = opts.focus
    val focused = if (focus != null) steps.filter { it.source == focus || it.target == focus } else steps
    return CausalReplay(from = a.id, to = b.id, focus = focus, steps = focused)
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
