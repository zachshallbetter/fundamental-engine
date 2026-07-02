package com.fundamental.core.runtime

import com.fundamental.core.engine.FieldBodyIdentity

// Substrate READ API — the Field Query primitive (JS #837 / critical-path 02). A structured, read-only
// question put to the live field: which bodies are here, what are they doing, how does the field measure
// right now. Mirror of the JS `@fundamental-engine/core` `query()` — same result SHAPE + semantics, so a
// reading serializes identically across planes (the cross-plane conformance goal). Read-only throughout:
// `query()` never mutates field state. EXPERIMENTAL until stabilized. See
// docs/planning/critical-path/02-field-query-api.md and packages/core/src/core/types.ts.

/** A rectangle in field coordinates (`DOMRect`-shaped) — the resolved region of a point/rect query. */
data class FieldRect(val x: Float, val y: Float, val width: Float, val height: Float)

/** Where a [FieldQuery] looks: a point (with a radius) or a rectangle. Omitted ⇒ a global query. */
sealed class FieldQueryAt {
    /** A point + query radius in field px (default 240). */
    data class Point(val x: Float, val y: Float, val radius: Float = 240f) : FieldQueryAt()
    /** A rectangle region. */
    data class Rect(val x: Float, val y: Float, val width: Float, val height: Float) : FieldQueryAt()
}

/**
 * Which sections a [FieldQuery] should return (JS `FieldQueryInclude`). Omitted ⇒ a sensible default:
 * bodies + metrics + relationships (plus influences when the query targets a point/region).
 */
enum class FieldQueryInclude { BODIES, METRICS, RELATIONSHIPS, INFLUENCES }

/** A structured question put to the live field (read-only; never mutates state). Mirror of JS `FieldQuery`. */
data class FieldQuery(
    /** where to look; `null` ⇒ a global query over the whole field. */
    val at: FieldQueryAt? = null,
    /** which sections to include; `null` ⇒ the default set (see [FieldQueryInclude]). */
    val include: Set<FieldQueryInclude>? = null,
)

/** A body as seen by a query — identity, box, active tokens, and its measured metrics/dimensions. */
data class FieldBodyReading(
    /** the stable id — equals `identity.id`. Kept top-level for parity with JS `FieldBodyReading.id`. */
    val id: String,
    /** the body's resolved FIRST-CLASS IDENTITY (`identity.id === id`). Always present. */
    val identity: FieldBodyIdentity,
    /** the body's box in field coordinates, when measured. */
    val rect: FieldRect?,
    /** the composed force ids (the `data-body` tokens). */
    val tokens: List<String>,
    /** scalar readings (lane: metric) — e.g. `density`, `load`, `count`, `engaged`. */
    val metrics: Map<String, Float>,
    /** measured field dimensions (lane: metric). Empty until the port exposes a dimension lane. */
    val dimensions: Map<String, Float>,
    /** the Field Formation(s) biasing this body right now (the field's active formation). */
    val activeFormations: List<String>,
    /** who owns this body's position. Fixed `"anchored"` until the port adds a body-authority lane. */
    val authority: String,
)

/** A relationship (edge) as seen by a query. Mirror of JS `FieldRelationshipReading`. */
data class FieldRelationshipReading(
    val from: String,
    val to: String,
    val type: String,
    val strength: Float,
    val memory: Float,
    val active: Boolean,
    /** whether the edge carried causal influence this frame (today: equal to `active`). */
    val causal: Boolean,
)

/** A single force's influence at the query point/region. Mirror of JS `FieldInfluenceReading`. */
data class FieldInfluenceReading(
    val source: String,
    val target: String?,
    val force: String,
    val channel: String,
    /** the contribution — a Δv vector for `"linear"`. */
    val contribution: com.fundamental.core.math.Vec3,
    val reason: String? = null,
)

/**
 * The structured answer to a [FieldQuery] (JS `FieldQueryResult`). Plain data; safe to serialize. The
 * field order + names mirror the JS shape 1:1 so a reading is identical across planes.
 */
data class FieldQueryResult(
    /** the query that produced this reading (echoed back). */
    val query: FieldQuery,
    /** the frame this reading was taken on. */
    val frame: Int,
    /** the field clock at read time. */
    val time: Float,
    /** the resolved region (for a point/rect query); `null` for a global query. */
    val region: FieldRect?,
    val bodies: List<FieldBodyReading>,
    val metrics: Map<String, Float>,
    val relationships: List<FieldRelationshipReading>,
    /** per-force attributions at the query point. Empty until the port exposes an impulse accumulator. */
    val influences: List<FieldInfluenceReading>,
    /** the projections registered on the field (metadata only) — see [ProjectionRegistry] / [FieldHandle.projections]. */
    val projections: List<FieldProjectionInfo>,
    /** the lens id this reading was scoped through, when a lens was supplied. `null` (no lens lane yet). */
    val lens: String? = null,
)
