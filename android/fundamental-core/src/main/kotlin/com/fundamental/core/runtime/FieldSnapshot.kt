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
