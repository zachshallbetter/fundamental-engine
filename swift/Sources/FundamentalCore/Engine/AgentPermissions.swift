import Foundation

// MARK: - SnapshotProfile (substrate — JS #894)

/// A named snapshot profile — a concrete inclusion preset resolved to the TIGHTEST (most private)
/// combination of its base inclusions, any explicit request, and the runtime ``FieldPolicy`` privacy
/// budget. A profile can only tighten a call; it never widens past what policy allows. Mirrors the JS
/// `SnapshotProfile`.
///
/// - `debug` — everything: particles, relationships, influences, and body `data` (still gated by policy).
/// - `agent` — the Software-Agent read: stable ids + metrics + relationships + influence attribution +
///   projections, but NO opaque body `data`.
/// - `bugReport` — structural + versions (relationships + influences), no user data.
/// - `public_` — minimal: ids + shape (bodies/metrics/projections), no relationships, influences, or data.
public enum SnapshotProfile: String, Sendable, CaseIterable {
    case debug
    case agent
    case bugReport = "bug-report"
    case public_ = "public"
}

// MARK: - AgentCapability (substrate — JS #894)

/// A scoped read CAPABILITY an ``AgentFieldView`` grants. Each names one dimension of the field's read
/// surface; a capability set is an allow-list — a dimension the caps don't include is stripped from every
/// reading (it tightens, never widens). Read-only throughout — there is no write capability, because
/// *agent-readable is not agent-writable*. Mirrors the JS `AgentCapability` (the 8 `read:*` tokens).
public enum AgentCapability: String, Sendable, CaseIterable, Hashable {
    case metrics = "read:metrics"
    case relationships = "read:relationships"
    case influences = "read:influences"
    case snapshots = "read:snapshots"
    case bodyData = "read:body-data"
    case projections = "read:projections"
    case diagnostics = "read:diagnostics"
    case replay = "read:replay"
}

// MARK: - AgentViewOptions (substrate — JS #894)

/// Options for ``FieldHandle/forAgent(_:)`` — the capability grant + optional redaction list. Mirrors the
/// JS `AgentViewOptions`.
public struct AgentViewOptions: Sendable {
    /// The capabilities this agent view grants. An allow-list: any dimension not listed is stripped from
    /// every reading. An empty set yields the most-restricted view (ids + shape only).
    public var capabilities: Set<AgentCapability>
    /// Dotted paths stripped from every reading AFTER capability scoping (e.g. `"body.data"`,
    /// `"metrics.temperature"`). Carried and honored by readings that support the dotted-path shape;
    /// opaque to the engine otherwise.
    public var redactions: [String]

    public init(capabilities: Set<AgentCapability>, redactions: [String] = []) {
        self.capabilities = capabilities
        self.redactions = redactions
    }
}

// MARK: - AgentFieldView (substrate — JS #894)

/// A READ-ONLY facade over a field, scoped to a set of ``AgentCapability``s — the surface a Software
/// Agent uses to read the field safely. It exposes ONLY scoped read methods and has NO mutation methods
/// (no `burst`, no `addBody`, no `setPolicy`) — enforced by the facade's very shape: *agent-readable is
/// not agent-writable*. Every reading is tightened to the granted capabilities. Mirrors the JS
/// `AgentFieldView`.
///
/// PARITY NOTE: the JS view scopes `query()` / `snapshot()` / `replay()`. `FieldHandle.query()` now
/// exists on the Swift core (substrate READ API — JS #837), but `snapshot()` / `replay()` do not yet, so
/// this facade still scopes the read surface that has always existed — energy, particle counts, and the
/// relationship (edge) graph — under the same tighten-only capability rules. Scoping `query()` through the
/// agent view (the JS `scopeQuery` intersect-include path) is a focused follow-up; it grows the
/// query/snapshot members when that lands. A capability the view doesn't grant strips the matching reading.
public protocol AgentFieldView: AnyObject {
    /// The granted capabilities (a frozen copy).
    var capabilities: Set<AgentCapability> { get }
    /// The redaction paths (a frozen copy).
    var redactions: [String] { get }

    /// Live particle count — always readable (shape is the base grant).
    func particleCount() -> Int
    /// The field's energy report — always readable (shape/metrics of the pool).
    func energy() -> EnergyReport
    /// The relationship (edge) graph — present ONLY when `read:relationships` is granted (otherwise an
    /// empty array, so the facade's output reflects the grant).
    func readEdges() -> [EdgeRecord]
}
