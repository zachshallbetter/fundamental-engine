import Foundation

// MARK: - Field Snapshot (substrate READ API — JS critical-path 03)

// A snapshot captures *what the field was doing* at a frame (vs a screenshot's *what it looked like*) —
// the point-in-time capture that `diff`/`replay` are built on (both later follow-ups). Mirror of the JS
// `@fundamental-engine/core` `snapshot()` and the Kotlin `:fundamental-core` port (`FieldSnapshot.kt`):
// the result SHAPE + field names + semantics match 1:1, so a capture serializes identically across planes
// (the cross-plane conformance goal). Plain data; safe to serialize; read-only (never mutates state).
// EXPERIMENTAL until stabilized. See docs/planning/critical-path/03-field-snapshot-causal-replay.md and
// packages/core/src/core/types.ts.
//
// NOTE: this is DISTINCT from `FieldPerfSnapshot` (perf metrics, in FundamentalPlatform) — a different
// thing. This is field STATE.

/// The engine build / snapshot-format version — the Swift mirror of the JS `FIELD_VERSION` (`version.ts`)
/// and the Kotlin `FIELD_VERSION` constant. Stamped onto every ``FieldSnapshot/version`` so a capture
/// records the format it was produced by.
///
/// The Swift port has no standalone package-version constant to source from, so this is defined here
/// mirroring the Kotlin port. Keep it in lockstep with the package version (npm `latest`) and the JS
/// `FIELD_VERSION`.
public let FIELD_VERSION: String = "0.9.2"

/// Options for ``FieldHandle/snapshot(_:)`` (JS `FieldSnapshotOptions`). Composes with the runtime privacy
/// ``FieldPolicy`` and an optional ``SnapshotProfile``, always resolving to the TIGHTEST (most private)
/// inclusion — a profile/flag can tighten a capture but never widen it.
public struct FieldSnapshotOptions: Sendable {
    /// Include the raw particle pool (heavier; OFF by default). Present-but-unused in this port for now.
    public var includeParticles: Bool?
    /// Include the relationship (edge) graph (default TRUE).
    public var includeRelationships: Bool?
    /// Include each body's opaque `data` record (default FALSE — privacy-preserving).
    public var includeData: Bool?
    /// Include per-body force attribution (default FALSE). Empty-for-now in this port (no accumulator).
    public var includeInfluences: Bool?
    /// Apply a named ``SnapshotProfile`` preset — composes TIGHTEST with the flags + the privacy policy.
    public var profile: SnapshotProfile?

    public init(includeParticles: Bool? = nil, includeRelationships: Bool? = nil,
                includeData: Bool? = nil, includeInfluences: Bool? = nil,
                profile: SnapshotProfile? = nil) {
        self.includeParticles = includeParticles
        self.includeRelationships = includeRelationships
        self.includeData = includeData
        self.includeInfluences = includeInfluences
        self.profile = profile
    }
}

/// A body captured in a ``FieldSnapshot`` (JS `FieldBodySnapshot`). Like a ``FieldBodyReading`` plus the
/// body's `position` (centre) and its optional opaque `data` — the per-body capture that `diff`/`replay`
/// key on by ``id`` (`== identity.id`).
public struct FieldBodySnapshot: Sendable {
    /// Stable id — equals `identity.id`; snapshot/diff/replay key on it.
    public var id: String
    /// The body's resolved FIRST-CLASS IDENTITY (`identity.id == id`). Always present.
    public var identity: FieldBodyIdentity
    /// Who owns this body's position. Fixed `"anchored"` until the port adds a body-authority lane.
    public var authority: String
    /// The body's box in field coordinates.
    public var rect: FieldRect?
    /// The body's centre in field coordinates (z = 0 for an anchored body).
    public var position: Vec3?
    /// The composed force ids (the `data-body` tokens).
    public var tokens: [String]
    /// Scalar readings (lane: metric) — e.g. `density`, `count`, `engaged`, `load`.
    public var metrics: [String: Float]
    /// Measured field dimensions (lane: metric). Empty until the port exposes a dimension lane.
    public var dimensions: [String: Float]
    /// The body's opaque record — present ONLY when `includeData` was set AND the policy permits it.
    public var data: (any Sendable)?

    public init(id: String, identity: FieldBodyIdentity, authority: String, rect: FieldRect?,
                position: Vec3?, tokens: [String], metrics: [String: Float],
                dimensions: [String: Float], data: (any Sendable)? = nil) {
        self.id = id; self.identity = identity; self.authority = authority; self.rect = rect
        self.position = position; self.tokens = tokens; self.metrics = metrics
        self.dimensions = dimensions; self.data = data
    }
}

/// A portable capture of field state at a moment in time (JS `FieldSnapshot`) — inspect, compare, test,
/// export, or hand to an agent. Plain data; safe to serialize. Field order + names mirror the JS shape
/// 1:1 so a capture is identical across planes. Versioned via ``version``.
public struct FieldSnapshot: Sendable {
    /// A per-field unique id (`snap-<frame>-<n>`).
    public var id: String
    /// The field clock at capture (`env.t`), NOT wall time. Deterministic.
    public var createdAt: Float
    /// The frame captured.
    public var frame: Int
    /// The engine build (``FIELD_VERSION``) — the snapshot-format version.
    public var version: String
    /// The active Field Formation id(s) at capture.
    public var formations: [String]
    public var bodies: [FieldBodySnapshot]
    public var relationships: [FieldRelationshipReading]
    public var metrics: [String: Float]
    /// Per-body force attribution at capture (only when `includeInfluences`). Empty until the port exposes
    /// an impulse accumulator — the field name mirrors JS `influences` so the shape stays identical.
    public var influences: [FieldInfluenceReading]
    /// The projections registered on the field at capture — metadata only. Empty until the port adds a
    /// registry — same as the Kotlin port.
    public var projections: [String]

    public init(id: String, createdAt: Float, frame: Int, version: String, formations: [String],
                bodies: [FieldBodySnapshot], relationships: [FieldRelationshipReading],
                metrics: [String: Float], influences: [FieldInfluenceReading] = [],
                projections: [String] = []) {
        self.id = id; self.createdAt = createdAt; self.frame = frame; self.version = version
        self.formations = formations; self.bodies = bodies; self.relationships = relationships
        self.metrics = metrics; self.influences = influences; self.projections = projections
    }
}

// MARK: - Snapshot inclusion resolution (TIGHTEST-wins)

/// The concrete inclusion flags a ``FieldSnapshotOptions`` resolves to — the JS `resolveSnapshotInclusion`
/// for the `snapshot()` call site. TIGHTEST-wins: a profile establishes a baseline, an explicit flag may
/// only tighten it further, and `includeData` additionally passes through the policy gate at the call
/// site.
///
/// With NO profile, mirrors today's JS defaults: relationships default TRUE, everything else default
/// FALSE (so body `data` is withheld unless explicitly opted in — privacy by default).
public struct ResolvedSnapshotFlags: Sendable {
    public var includeParticles: Bool
    public var includeRelationships: Bool
    public var includeData: Bool
    public var includeInfluences: Bool
}

/// Resolve ``FieldSnapshotOptions`` to concrete inclusion flags, TIGHTEST-wins (JS
/// `resolveSnapshotInclusion`, Kotlin `resolveSnapshotFlags`).
public func resolveSnapshotFlags(_ opts: FieldSnapshotOptions) -> ResolvedSnapshotFlags {
    guard let p = opts.profile else {
        // No profile: today's defaults — relationships default true, the rest default false.
        return ResolvedSnapshotFlags(
            includeParticles: opts.includeParticles == true,
            includeRelationships: opts.includeRelationships != false,
            includeData: opts.includeData == true,
            includeInfluences: opts.includeInfluences == true
        )
    }
    // Per-profile baselines (mirror of the JS/Kotlin table).
    let base: ResolvedSnapshotFlags
    switch p {
    case .debug:     base = ResolvedSnapshotFlags(includeParticles: true, includeRelationships: true, includeData: true, includeInfluences: true)
    case .agent:     base = ResolvedSnapshotFlags(includeParticles: false, includeRelationships: true, includeData: false, includeInfluences: true)
    case .bugReport: base = ResolvedSnapshotFlags(includeParticles: false, includeRelationships: true, includeData: false, includeInfluences: true)
    case .public_:   base = ResolvedSnapshotFlags(includeParticles: false, includeRelationships: false, includeData: false, includeInfluences: false)
    }
    // TIGHTEST wins: a flag is on only if the profile allows it AND the caller didn't explicitly turn it
    // off. An explicit `true` can never widen past the profile's baseline.
    return ResolvedSnapshotFlags(
        includeParticles: base.includeParticles && opts.includeParticles != false,
        includeRelationships: base.includeRelationships && opts.includeRelationships != false,
        includeData: base.includeData && opts.includeData != false,
        includeInfluences: base.includeInfluences && opts.includeInfluences != false
    )
}
