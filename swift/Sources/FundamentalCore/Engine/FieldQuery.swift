import Foundation

// MARK: - Field Query API (substrate READ API — JS #837 / critical-path 02)

// The Field Query primitive: a structured, READ-ONLY question put to the live field — which bodies are
// here, what are they doing, how does the field measure right now — without a render surface. Mirror of
// the JS `@fundamental-engine/core` `query()` and the Kotlin `:fundamental-core` port (`FieldQuery.kt`):
// the result SHAPE + field names match 1:1 so a reading serializes identically across planes (the
// cross-plane conformance goal). Read-only throughout — `query()` never mutates field state. EXPERIMENTAL
// until stabilized. See docs/planning/critical-path/02-field-query-api.md and
// packages/core/src/core/types.ts (`FieldQueryResult` et al).

/// A rectangle in field coordinates (`DOMRect`-shaped) — the resolved region of a point/rect query.
/// Mirrors the JS `FieldRect`.
public struct FieldRect: Equatable, Sendable {
    public var x: Float
    public var y: Float
    public var width: Float
    public var height: Float
    public init(x: Float, y: Float, width: Float, height: Float) {
        self.x = x; self.y = y; self.width = width; self.height = height
    }
}

/// Where a ``FieldQuery`` looks: a point (with a radius) or a rectangle. Omitted (`nil`) ⇒ a global query
/// over the whole field. Mirrors the JS `FieldQuery.at` union (a `Vec2` point or a `FieldRect`).
public enum FieldQueryAt: Sendable {
    /// A point + query radius in field px (default 240).
    case point(x: Float, y: Float, radius: Float = 240)
    /// A rectangle region.
    case rect(x: Float, y: Float, width: Float, height: Float)
}

/// Which sections a ``FieldQuery`` should return (JS `FieldQueryInclude`). Omitted ⇒ a sensible default:
/// bodies + metrics + relationships (plus influences when the query targets a point/region).
public enum FieldQueryInclude: String, Sendable, CaseIterable, Hashable {
    case bodies
    case metrics
    case relationships
    case influences
}

/// A structured question put to the live field (read-only; never mutates state). Mirror of JS `FieldQuery`.
public struct FieldQuery: Sendable {
    /// Where to look; `nil` ⇒ a global query over the whole field.
    public var at: FieldQueryAt?
    /// Which sections to include; `nil` ⇒ the default set (see ``FieldQueryInclude``).
    public var include: Set<FieldQueryInclude>?
    public init(at: FieldQueryAt? = nil, include: Set<FieldQueryInclude>? = nil) {
        self.at = at; self.include = include
    }
}

/// A body as seen by a query — identity, box, active tokens, and its measured metrics/dimensions.
/// Mirror of JS `FieldBodyReading`.
public struct FieldBodyReading: Sendable {
    /// The stable id — equals `identity.id`. Kept top-level for parity with JS `FieldBodyReading.id`.
    public var id: String
    /// The body's resolved FIRST-CLASS IDENTITY (`identity.id == id`). Always present.
    public var identity: FieldBodyIdentity
    /// The body's box in field coordinates, when measured.
    public var rect: FieldRect?
    /// The composed force ids (the `data-body` tokens).
    public var tokens: [String]
    /// Scalar readings (lane: metric) — e.g. `density`, `load`, `count`, `engaged`.
    public var metrics: [String: Float]
    /// Measured field dimensions (lane: metric). Empty until the port exposes a dimension lane —
    /// same as the Kotlin port, and for the same reason (no dimension lane wired yet).
    public var dimensions: [String: Float]
    /// The Field Formation(s) biasing this body right now (the field's active formation).
    public var activeFormations: [String]
    /// Who owns this body's position. Fixed `"anchored"` (the JS default) until the port adds a
    /// body-authority lane — matching the Kotlin port.
    public var authority: String
    public init(id: String, identity: FieldBodyIdentity, rect: FieldRect?, tokens: [String],
                metrics: [String: Float], dimensions: [String: Float],
                activeFormations: [String], authority: String) {
        self.id = id; self.identity = identity; self.rect = rect; self.tokens = tokens
        self.metrics = metrics; self.dimensions = dimensions
        self.activeFormations = activeFormations; self.authority = authority
    }
}

/// A relationship (edge) as seen by a query. Mirror of JS `FieldRelationshipReading`.
public struct FieldRelationshipReading: Sendable {
    /// Source / target body ids (see ``FieldBodyReading/id``).
    public var from: String
    public var to: String
    /// The relationship kind (`"related"` by default).
    public var type: String
    /// Active coupling ∈ [0,1].
    public var strength: Float
    /// Slow accumulated familiarity ∈ [0,1].
    public var memory: Float
    /// Exercised this tick.
    public var active: Bool
    /// Whether the edge carried causal influence this frame (today: equal to `active`).
    public var causal: Bool
    public init(from: String, to: String, type: String, strength: Float, memory: Float,
                active: Bool, causal: Bool) {
        self.from = from; self.to = to; self.type = type; self.strength = strength
        self.memory = memory; self.active = active; self.causal = causal
    }
}

/// A single force's influence at the query point/region. Mirror of JS `FieldInfluenceReading`.
/// Present-but-empty in this port for now (no impulse accumulator yet); the type keeps the JS shape so
/// the lane is identical across planes once the accumulator lands.
public struct FieldInfluenceReading: Sendable {
    public var source: String
    public var target: String?
    public var force: String
    /// Which accumulator channel this contribution is in (`"linear"` Δv, `"thermal"` heat, …).
    public var channel: String
    /// The contribution — a Δv vector for `"linear"`.
    public var contribution: Vec3
    public var reason: String?
    public init(source: String, target: String? = nil, force: String, channel: String = "linear",
                contribution: Vec3, reason: String? = nil) {
        self.source = source; self.target = target; self.force = force
        self.channel = channel; self.contribution = contribution; self.reason = reason
    }
}

/// The structured answer to a ``FieldQuery`` (JS `FieldQueryResult`). Plain data; safe to serialize. The
/// field order + names mirror the JS shape 1:1 so a reading is identical across planes.
public struct FieldQueryResult: Sendable {
    /// The query that produced this reading (echoed back).
    public var query: FieldQuery
    /// The frame this reading was taken on.
    public var frame: Int
    /// The field clock at read time.
    public var time: Float
    /// The resolved region (for a point/rect query); `nil` for a global query.
    public var region: FieldRect?
    public var bodies: [FieldBodyReading]
    public var metrics: [String: Float]
    public var relationships: [FieldRelationshipReading]
    /// Per-force attributions at the query point. Empty until the port exposes an impulse accumulator —
    /// same as the Kotlin port (the field name mirrors JS `influences` so the shape stays identical).
    public var influences: [FieldInfluenceReading]
    /// The projections registered on the field (metadata only) — mirrors JS `query().projections` /
    /// the Kotlin port. Populated from the field's ``ProjectionRegistry`` via `list()`.
    public var projections: [FieldProjectionInfo]
    /// The lens id this reading was scoped through, when a lens was supplied. `nil` — no lens lane yet.
    public var lens: String?
    public init(query: FieldQuery, frame: Int, time: Float, region: FieldRect?,
                bodies: [FieldBodyReading], metrics: [String: Float],
                relationships: [FieldRelationshipReading], influences: [FieldInfluenceReading],
                projections: [FieldProjectionInfo], lens: String? = nil) {
        self.query = query; self.frame = frame; self.time = time; self.region = region
        self.bodies = bodies; self.metrics = metrics; self.relationships = relationships
        self.influences = influences; self.projections = projections; self.lens = lens
    }
}
