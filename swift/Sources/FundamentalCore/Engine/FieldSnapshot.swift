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
/// mirroring the Kotlin port. Kept in lockstep with the package version (npm `latest`) and the JS
/// `FIELD_VERSION`: `VersionLockstepTests` fails the suite if this drifts from
/// `packages/core/package.json` (#923) — update it here on every release bump.
public let FIELD_VERSION: String = "0.9.4"

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
    /// The projections registered on the field at capture — metadata only. Mirrors JS
    /// `snapshot().projections` / the Kotlin port; populated from the field's ``ProjectionRegistry``.
    public var projections: [FieldProjectionInfo]

    public init(id: String, createdAt: Float, frame: Int, version: String, formations: [String],
                bodies: [FieldBodySnapshot], relationships: [FieldRelationshipReading],
                metrics: [String: Float], influences: [FieldInfluenceReading] = [],
                projections: [FieldProjectionInfo] = []) {
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

// MARK: - Field Snapshot diffing (JS `diffFieldSnapshots`, Kotlin `diffFieldSnapshots`)

// `diff(a, b)` is a PURE comparison of two ``FieldSnapshot``s — no live field state — so it is trivially
// testable and usable outside a running field (CI assertions, stored bug reports, AI memory).
// ``FieldHandle/diff(_:_:)`` delegates to ``diffFieldSnapshots(_:_:)`` here. Capture
// (``FieldHandle/snapshot(_:)``) lives on the handle (it needs the live field); this module owns the
// comparison so the two halves stay independent. Result SHAPE + field names + semantics mirror the JS
// `@fundamental-engine/core` and the Kotlin `:fundamental-core` port 1:1.

/// A before/after pair for one metric value (the JS/Kotlin `{ from, to }` shape — Swift has no anonymous
/// record, so it gets a named struct, matching the Kotlin port's `MetricDelta`).
public struct MetricDelta: Sendable, Equatable {
    public var from: Float
    public var to: Float
    public init(from: Float, to: Float) { self.from = from; self.to = to }
}

/// A before/after pair for a boolean (JS/Kotlin `{ from, to }` over booleans — e.g. a relationship's
/// `active`). Named struct, matching the Kotlin port's `BoolDelta`.
public struct BoolDelta: Sendable, Equatable {
    public var from: Bool
    public var to: Bool
    public init(from: Bool, to: Bool) { self.from = from; self.to = to }
}

/// A change to one body between two snapshots (JS/Kotlin `BodyChange`). ``kind`` is `"added"`, `"removed"`,
/// or `"changed"`. For `"changed"`, ``metrics`` holds the per-metric before/after for the metrics that
/// differ.
public struct BodyChange: Sendable, Equatable {
    public var id: String
    /// `"added"` | `"removed"` | `"changed"`.
    public var kind: String
    /// Per-metric before/after for the metrics that changed (kind `"changed"`); `nil` otherwise.
    public var metrics: [String: MetricDelta]?
    public init(id: String, kind: String, metrics: [String: MetricDelta]? = nil) {
        self.id = id; self.kind = kind; self.metrics = metrics
    }
}

/// A change to one relationship (edge) between two snapshots (JS/Kotlin `RelationshipChange`). The edge is
/// keyed by `from`+`to`+`type`. ``kind`` is `"added"`, `"removed"`, or `"changed"`; for `"changed"`,
/// ``strength`` and/or ``active`` carry the before/after for whichever differed.
public struct RelationshipChange: Sendable, Equatable {
    public var from: String
    public var to: String
    public var type: String
    /// `"added"` | `"removed"` | `"changed"`.
    public var kind: String
    public var strength: MetricDelta?
    public var active: BoolDelta?
    public init(from: String, to: String, type: String, kind: String,
                strength: MetricDelta? = nil, active: BoolDelta? = nil) {
        self.from = from; self.to = to; self.type = type; self.kind = kind
        self.strength = strength; self.active = active
    }
}

/// A change to one field-level metric between two snapshots (JS/Kotlin `MetricChange`).
public struct MetricChange: Sendable, Equatable {
    public var key: String
    public var from: Float
    public var to: Float
    public init(key: String, from: Float, to: Float) { self.key = key; self.from = from; self.to = to }
}

/// A Field Formation that activated or deactivated between two snapshots (JS/Kotlin `FormationChange`).
/// ``kind`` is `"activated"` (present in `b`, absent in `a`) or `"deactivated"` (absent in `b`, present in
/// `a`).
public struct FormationChange: Sendable, Equatable {
    public var id: String
    public var kind: String
    public init(id: String, kind: String) { self.id = id; self.kind = kind }
}

/// The structured comparison of two ``FieldSnapshot``s — what changed in the field, by lane (JS/Kotlin
/// `FieldDiff`). ``from``/``to`` are the compared snapshots' ids. Order-independent within each lane;
/// produced by the PURE ``diffFieldSnapshots(_:_:)``.
public struct FieldDiff: Sendable, Equatable {
    /// The id of snapshot `a`.
    public var from: String
    /// The id of snapshot `b`.
    public var to: String
    public var bodyChanges: [BodyChange]
    public var relationshipChanges: [RelationshipChange]
    public var metricChanges: [MetricChange]
    public var formationChanges: [FormationChange]
    public init(from: String, to: String, bodyChanges: [BodyChange],
                relationshipChanges: [RelationshipChange], metricChanges: [MetricChange],
                formationChanges: [FormationChange]) {
        self.from = from; self.to = to; self.bodyChanges = bodyChanges
        self.relationshipChanges = relationshipChanges; self.metricChanges = metricChanges
        self.formationChanges = formationChanges
    }
}

/// The composite key an edge is compared by (mirror of the JS `relKey` / Kotlin `relKey`): `from` + `to`
/// + `type`.
private func relKey(_ r: FieldRelationshipReading) -> String { "\(r.from) \(r.to) \(r.type)" }

/// Compare two field snapshots and report what changed, by lane (bodies, relationships, metrics,
/// formations). PURE — reads only the two snapshot objects, never the live field, and mutates nothing.
/// Order-independent within each lane. Mirror of the JS `diffFieldSnapshots(a, b)` and the Kotlin port.
///
/// - **bodies:** keyed by `id`. A body only in `a` → `removed`; only in `b` → `added`; in both with any
///   differing metric value → `changed` (with per-metric before/after over the union of metric keys,
///   missing treated as `0`). A body with identical metrics yields no change.
/// - **relationships:** keyed by `from`+`to`+`type`. Only in `a` → `removed`; only in `b` → `added`; in
///   both with a differing `strength` and/or `active` → `changed` (carrying the before/after that
///   differed).
/// - **metrics:** the union of field-level metric keys; any differing value (missing treated as `0`) →
///   a ``MetricChange``.
/// - **formations:** set difference — in `b` not `a` → `activated`; in `a` not `b` → `deactivated`.
public func diffFieldSnapshots(_ a: FieldSnapshot, _ b: FieldSnapshot) -> FieldDiff {
    // ── bodies ──────────────────────────────────────────────────────────────────────────────────
    var bodyChanges: [BodyChange] = []
    let aBodies = Dictionary(a.bodies.map { ($0.id, $0) }, uniquingKeysWith: { _, last in last })
    let bBodies = Dictionary(b.bodies.map { ($0.id, $0) }, uniquingKeysWith: { _, last in last })
    for (id, av) in aBodies {
        guard let bv = bBodies[id] else {
            bodyChanges.append(BodyChange(id: id, kind: "removed"))
            continue
        }
        var metrics: [String: MetricDelta] = [:]
        let keys = Set(av.metrics.keys).union(bv.metrics.keys)
        for k in keys {
            let from = av.metrics[k] ?? 0
            let to = bv.metrics[k] ?? 0
            if from != to { metrics[k] = MetricDelta(from: from, to: to) }
        }
        if !metrics.isEmpty { bodyChanges.append(BodyChange(id: id, kind: "changed", metrics: metrics)) }
    }
    for id in bBodies.keys where aBodies[id] == nil {
        bodyChanges.append(BodyChange(id: id, kind: "added"))
    }

    // ── relationships ─────────────────────────────────────────────────────────────────────────
    var relationshipChanges: [RelationshipChange] = []
    let aRel = Dictionary(a.relationships.map { (relKey($0), $0) }, uniquingKeysWith: { _, last in last })
    let bRel = Dictionary(b.relationships.map { (relKey($0), $0) }, uniquingKeysWith: { _, last in last })
    for (k, ar) in aRel {
        guard let br = bRel[k] else {
            relationshipChanges.append(RelationshipChange(from: ar.from, to: ar.to, type: ar.type, kind: "removed"))
            continue
        }
        let strength = ar.strength != br.strength ? MetricDelta(from: ar.strength, to: br.strength) : nil
        let active = ar.active != br.active ? BoolDelta(from: ar.active, to: br.active) : nil
        if strength != nil || active != nil {
            relationshipChanges.append(RelationshipChange(from: ar.from, to: ar.to, type: ar.type,
                                                          kind: "changed", strength: strength, active: active))
        }
    }
    for (k, br) in bRel where aRel[k] == nil {
        relationshipChanges.append(RelationshipChange(from: br.from, to: br.to, type: br.type, kind: "added"))
    }

    // ── field-level metrics ─────────────────────────────────────────────────────────────────────
    var metricChanges: [MetricChange] = []
    let metricKeys = Set(a.metrics.keys).union(b.metrics.keys)
    for key in metricKeys {
        let from = a.metrics[key] ?? 0
        let to = b.metrics[key] ?? 0
        if from != to { metricChanges.append(MetricChange(key: key, from: from, to: to)) }
    }

    // ── formations ────────────────────────────────────────────────────────────────────────────
    var formationChanges: [FormationChange] = []
    let aForm = Set(a.formations)
    let bForm = Set(b.formations)
    for id in bForm where !aForm.contains(id) { formationChanges.append(FormationChange(id: id, kind: "activated")) }
    for id in aForm where !bForm.contains(id) { formationChanges.append(FormationChange(id: id, kind: "deactivated")) }

    return FieldDiff(
        from: a.id,
        to: b.id,
        bodyChanges: bodyChanges,
        relationshipChanges: relationshipChanges,
        metricChanges: metricChanges,
        formationChanges: formationChanges
    )
}

// MARK: - Causal Replay (JS critical-path 03 phase 2 — `replayFieldSnapshots`)

// Explain HOW the field changed between two snapshots — an ordered, narrated sequence of causes derived
// PURELY from the diff (formation activations → relationship shifts → body measurements → metric moves →
// force attributions). ``FieldHandle/replay(_:_:_:)`` delegates to ``replayFieldSnapshots(_:_:_:)`` here.
// Like `diff`, it reads only the two snapshot objects, never the live field, and mutates nothing. Result
// SHAPE + field names + semantics mirror the JS `@fundamental-engine/core` and the Kotlin `:fundamental-core`
// port 1:1 so a replay serializes identically across planes. EXPERIMENTAL until stabilized. See
// packages/core/src/core/field-snapshot.ts and FieldSnapshot.kt.
//
// PORT NOTE (influences-derived cause empty-for-now): the JS `force` lane derives per-body force-attribution
// shifts from each snapshot's `influences`. This port has NO impulse accumulator, so captured `influences`
// are always empty (exactly as `query`/`snapshot`/`diff` left them). The force-lane logic is mirrored
// field-for-field below but simply produces no steps until the port grows an accumulator — the shape stays
// identical, only that one lane is dormant. The structural lanes (formation/relationship/measurement/metric)
// are fully live.

/// The lane a ``CausalReplayStep`` belongs to (JS `CausalCause`, Kotlin `CausalCause`).
public enum CausalCause: String, Sendable {
    case force
    case relationship
    case metric
    case formation
    case measurement
}

/// Options for ``FieldHandle/replay(_:_:_:)`` (JS `ReplayOptions`, Kotlin `ReplayOptions`).
public struct ReplayOptions: Sendable {
    /// Restrict the replay to steps touching this body id (its metrics, or a relationship endpoint).
    public var focus: String?
    public init(focus: String? = nil) { self.focus = focus }
}

/// One narrated cause in a ``CausalReplay`` (JS `CausalReplayStep`, Kotlin `CausalReplayStep`).
/// ``contribution`` is the structured before/after behind the ``description`` — a ``MetricDelta`` for a
/// metric/force move, else `nil`. (The JS `contribution` is `unknown`; every value it actually carries is a
/// `{ from, to }` delta, so this port types it as ``MetricDelta`` — matching the Kotlin port's `Any?` slot
/// which likewise only ever holds a `MetricDelta`.)
public struct CausalReplayStep: Sendable, Equatable {
    public var frame: Int
    public var time: Float
    public var cause: CausalCause
    /// The body/edge the cause originates from (a body id, or a relationship's `from`).
    public var source: String?
    /// The affected target, when the cause is a relationship.
    public var target: String?
    /// A human-readable account of the change (lane: diagnostic).
    public var description: String
    /// The structured before/after behind the description (e.g. a ``MetricDelta``); `nil` when none.
    public var contribution: MetricDelta?
    public init(frame: Int, time: Float, cause: CausalCause, source: String? = nil,
                target: String? = nil, description: String, contribution: MetricDelta? = nil) {
        self.frame = frame; self.time = time; self.cause = cause; self.source = source
        self.target = target; self.description = description; self.contribution = contribution
    }
}

/// An explanation of how the field changed between two snapshots — the ordered causal steps (JS
/// `CausalReplay`, Kotlin `CausalReplay`). PURE (derived from the two snapshots); plain data, safe to
/// serialize.
public struct CausalReplay: Sendable, Equatable {
    /// The id of snapshot `a`.
    public var from: String
    /// The id of snapshot `b`.
    public var to: String
    /// The focus body id, if the replay was scoped to one.
    public var focus: String?
    public var steps: [CausalReplayStep]
    public init(from: String, to: String, focus: String? = nil, steps: [CausalReplayStep]) {
        self.from = from; self.to = to; self.focus = focus; self.steps = steps
    }
}

/// Explain HOW the field changed from snapshot `a` to snapshot `b` — an ordered, narrated sequence of causes
/// derived from the diff (formation activations → relationship shifts → body measurements → metric changes →
/// force attributions). PURE; preserves the before/after on each step's ``CausalReplayStep/contribution``.
/// ``ReplayOptions/focus`` scopes the replay to one body id (its metrics, or a relationship it participates
/// in). Mirror of the JS `replayFieldSnapshots(a, b, opts)` and the Kotlin port; ``FieldHandle/replay(_:_:_:)``
/// delegates here.
///
/// Step ordering (mirrors JS): formations first (the global bias that frames the window), then relationships
/// (edges formed / dissolved / strengthened / activated), then bodies (entered / left, then per-metric
/// movements), then forces. The force lane compares each `(source, force, channel)` influence's magnitude
/// A→B and narrates which force engaged/grew/weakened/released — but only when BOTH snapshots captured
/// influences. In this port influences are always empty (no accumulator), so the force lane yields no steps.
public func replayFieldSnapshots(_ a: FieldSnapshot, _ b: FieldSnapshot,
                                 _ opts: ReplayOptions = ReplayOptions()) -> CausalReplay {
    func r2(_ n: Float) -> Float { (n * 1000).rounded() / 1000 }
    let d = diffFieldSnapshots(a, b)
    let frame = b.frame
    let time = b.createdAt
    var steps: [CausalReplayStep] = []
    func step(_ cause: CausalCause, _ description: String, source: String? = nil,
              target: String? = nil, contribution: MetricDelta? = nil) {
        steps.append(CausalReplayStep(frame: frame, time: time, cause: cause, source: source,
                                      target: target, description: description, contribution: contribution))
    }

    // formations first (the global bias that frames everything else this window)
    for f in d.formationChanges {
        step(.formation, "Formation '\(f.id)' \(f.kind)", source: f.id)
    }
    // relationships — the edges that strengthened / activated / appeared
    for rc in d.relationshipChanges {
        let what: String
        if rc.kind == "added" { what = "formed" }
        else if rc.kind == "removed" { what = "dissolved" }
        else {
            var parts: [String] = []
            if let active = rc.active { parts.append(active.to ? "became active" : "went idle") }
            if let strength = rc.strength {
                let verb = strength.to >= strength.from ? "strengthened" : "weakened"
                parts.append("\(verb) \(r2(strength.from))→\(r2(strength.to))")
            }
            what = parts.isEmpty ? "changed" : parts.joined(separator: ", ")
        }
        step(.relationship, "Relationship \(rc.from)→\(rc.to) (\(rc.type)) \(what)",
             source: rc.from, target: rc.to, contribution: rc.strength)
    }
    // bodies — entered/left, then per-metric movements
    for bc in d.bodyChanges {
        if bc.kind == "added" {
            step(.measurement, "Body \(bc.id) entered the field", source: bc.id)
        } else if bc.kind == "removed" {
            step(.measurement, "Body \(bc.id) left the field", source: bc.id)
        } else if let metrics = bc.metrics {
            for (k, v) in metrics {
                let dir = v.to > v.from ? "rose" : "fell"
                step(.metric, "Body \(bc.id) \(k) \(dir) \(r2(v.from))→\(r2(v.to))",
                     source: bc.id, contribution: v)
            }
        }
    }

    // forces — per-body attribution shifts (only when BOTH snapshots captured influences, via
    // snapshot(includeInfluences)). Compares each (source, force, channel)'s magnitude A→B so the replay can
    // say *which force* drove the change. EMPTY-FOR-NOW: this port has no impulse accumulator, so
    // `influences` is always empty and this lane yields no steps. The logic mirrors JS field-for-field so
    // the lane comes alive unchanged once an accumulator lands.
    if !a.influences.isEmpty && !b.influences.isEmpty {
        func mag(_ c: Vec3) -> Float { (c.x * c.x + c.y * c.y + c.z * c.z).squareRoot() }
        func key(_ i: FieldInfluenceReading) -> String { "\(i.source) \(i.force) \(i.channel)" }
        let am = Dictionary(a.influences.map { (key($0), $0) }, uniquingKeysWith: { _, last in last })
        let bm = Dictionary(b.influences.map { (key($0), $0) }, uniquingKeysWith: { _, last in last })
        for k in Set(am.keys).union(bm.keys) {
            let ai = am[k]
            let bi = bm[k]
            let m0 = ai.map { mag($0.contribution) } ?? 0
            let m1 = bi.map { mag($0.contribution) } ?? 0
            if abs(m1 - m0) < 1e-9 { continue }
            let ref = bi ?? ai!
            let verb = m1 > m0 ? (m0 == 0 ? "engaged" : "grew") : (m1 == 0 ? "released" : "weakened")
            let lane = ref.channel == "thermal" ? " (thermal)" : ""
            step(.force, "Force \(ref.force) on \(ref.source)\(lane) \(verb) \(r2(m0))→\(r2(m1))",
                 source: ref.source, contribution: MetricDelta(from: m0, to: m1))
        }
    }

    let focused = opts.focus.map { f in steps.filter { $0.source == f || $0.target == f } } ?? steps
    return CausalReplay(from: a.id, to: b.id, focus: opts.focus, steps: focused)
}
