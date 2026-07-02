import Foundation

// Substrate Projection Registry (JS critical-path 05). A PROJECTION maps field STATE into an output
// surface (an agent-readable JSON reading, a native view callback, and — on the web plane — CSS / DOM /
// SVG). Mirror of the JS `@fundamental-engine/core` projection registry (`ProjectionRegistry`,
// `FieldProjection`, `FieldProjectionInfo`, `agentJsonProjection`/`agentJsonTarget`) AND the Kotlin
// `:fundamental-core` port (#936) — same shape + semantics so a projection's METADATA serializes
// identically across planes (the cross-plane conformance goal). EXPERIMENTAL until stabilized. See
// docs/planning/critical-path/05-* and packages/core/src/core/types.ts / projection-agent-json.ts, and
// android/.../runtime/FieldProjection.kt.
//
// GOVERNANCE PRINCIPLE (kept verbatim from the JS core): *a projection reveals state; it MAY NOT mutate
// the field.* A projection reads over field state and writes to ITS OWN target — no forces, no body or
// metric writes. This is enforced STRUCTURALLY: `apply` receives a plain reading + a target and never the
// field; the registry lives on the handle and only ever calls `apply`. (See ProjectionRegistryTests'
// "never mutates the field" / "never perturbs the simulation" assertions.)
//
// PORTABLE-vs-WEB surfaces (Option A): this port implements the two PORTABLE surfaces — `agentJson`
// (serialize a reading for an agent / tool) and a generic host `callback` (a `(reading) -> Void` a native
// view wires up). The web-only surfaces (`css` / `domAttribute` / `svg`) are declared in the surface enum
// for METADATA parity (so `list()` reports them identically) but have no native target — they are
// web-first and belong to `@fundamental-engine/dom`. A projection may still *declare* a web surface; on
// this plane it simply has no matching target to write into.
//
// NAME NOTE: the substrate `FieldProjection` here is the projection *registry* type (JS `FieldProjection`,
// Kotlin `com.fundamental.core.runtime.FieldProjection`). It is DISTINCT from the host SPI coordinate
// projection, which Swift spells ``HostProjection`` (Kotlin keeps them apart by package — `runtime` vs
// `engine`; Swift has no in-module packages, so the host one was renamed and this keeps the cross-plane
// public spelling). See FieldHost.swift.

/// The kinds of output surface a ``FieldProjection`` can target (JS `FieldProjectionSurface`). Declared in
/// full so a projection's metadata is identical across planes. Only ``agentJson`` and ``callback`` have a
/// concrete target on this native port; the web surfaces (``css`` / ``domAttribute`` / ``svg``) are
/// declared for parity but are web-first (implemented in `@fundamental-engine/dom`, not here). The raw
/// value is the JS/Kotlin string id, so serialized metadata matches (`css`, `dom-attribute`, `agent-json`…).
public enum FieldProjectionSurface: String, Sendable, Equatable, CaseIterable {
    case css = "css"
    case domAttribute = "dom-attribute"
    case svg = "svg"
    case canvas = "canvas"
    case typography = "typography"
    case annotation = "annotation"
    case sound = "sound"
    case haptic = "haptic"
    case native = "native"
    case spatial = "spatial"
    case agentJson = "agent-json"
    /// A generic host callback surface (native-plane addition) — the target is a `(reading) -> Void`.
    case callback = "callback"
}

/// Where a projection writes (JS `FieldProjectionTarget`) — a minimal sink a projection's
/// ``FieldProjection/apply`` hands its reading to. Open by design so non-DOM surfaces (``AgentJsonTarget``,
/// ``CallbackTarget``, a future native view) each provide their own concrete target. Read-only w.r.t. the
/// field: a target receives a reading, it never reaches back into field state.
public protocol FieldProjectionTarget: AnyObject {
    /// Receive a reading (called by a projection's `apply`). The default is a no-op so a target that only
    /// cares about, say, DOM attributes can override just the part it needs — mirrors the open JS shape.
    func receive(_ reading: [String: Float])
}

public extension FieldProjectionTarget {
    func receive(_ reading: [String: Float]) {}
}

/// A named mapping from field state to an output surface (JS `FieldProjection`). ``apply`` is the
/// (optional) writer; the rest is declarative metadata for governance + tooling. A projection MUST NOT
/// change field state — ``apply`` receives a plain reading + a target and never the field.
public struct FieldProjection {
    public let id: String
    public let label: String
    /// The field channels this projection reads (e.g. `["density","confidence"]`).
    public let channels: [String]
    /// The surface(s) it writes to.
    public let surfaces: [FieldProjectionSurface]
    /// The non-motion equivalent, for reduced-motion (governance: motion must translate). `nil` = none.
    public let reducedMotionEquivalent: String?
    /// The accessibility equivalent — an alternate projection of the same state, not a fallback.
    public let accessibilityEquivalent: String?
    /// Write the reading onto the target (read-only w.r.t. the field). `nil` ⇒ a pure-metadata projection.
    public let apply: ((_ reading: [String: Float], _ target: any FieldProjectionTarget) -> Void)?

    public init(
        id: String,
        label: String,
        channels: [String],
        surfaces: [FieldProjectionSurface],
        reducedMotionEquivalent: String? = nil,
        accessibilityEquivalent: String? = nil,
        apply: ((_ reading: [String: Float], _ target: any FieldProjectionTarget) -> Void)? = nil
    ) {
        self.id = id
        self.label = label
        self.channels = channels
        self.surfaces = surfaces
        self.reducedMotionEquivalent = reducedMotionEquivalent
        self.accessibilityEquivalent = accessibilityEquivalent
        self.apply = apply
    }
}

/// A live reading source for a bound (auto-applied) projection (JS `ProjectionSource`) — called once per
/// write phase to produce the reading handed to the projection's ``FieldProjection/apply``. The field
/// never reads it for simulation.
public typealias ProjectionSource = () -> [String: Float]

/// Serializable metadata about a registered projection (JS `FieldProjectionInfo`) — no `apply`. What
/// `query()` / `snapshot()` and governance tooling read. Field names mirror JS/Kotlin 1:1 so the metadata
/// serializes identically across planes.
public struct FieldProjectionInfo: Sendable, Equatable {
    public let id: String
    public let label: String
    public let channels: [String]
    public let surfaces: [FieldProjectionSurface]
    public let reducedMotionEquivalent: String?
    public let accessibilityEquivalent: String?

    public init(
        id: String,
        label: String,
        channels: [String],
        surfaces: [FieldProjectionSurface],
        reducedMotionEquivalent: String? = nil,
        accessibilityEquivalent: String? = nil
    ) {
        self.id = id
        self.label = label
        self.channels = channels
        self.surfaces = surfaces
        self.reducedMotionEquivalent = reducedMotionEquivalent
        self.accessibilityEquivalent = accessibilityEquivalent
    }
}

/// A ``FieldProjectionTarget`` for the `agent-json` surface (JS `AgentJsonTarget`): it captures the last
/// reading written to it as a plain dictionary, serializable for agent / tooling consumption. Build one
/// with ``agentJsonTarget()`` and pair it with ``agentJsonProjection(id:channels:label:accessibilityEquivalent:)``.
/// Read-only w.r.t. the field — like every projection target, it only ever receives readings.
public final class AgentJsonTarget: FieldProjectionTarget {
    private var last: [String: Float]?

    internal init() {}

    /// Receive a reading (called by the projection's `apply`). Stores a COPY (dictionaries are value types
    /// in Swift, so the assignment already copies) — mutating the source afterward never changes this.
    public func receive(_ reading: [String: Float]) {
        last = reading
    }

    /// The last received reading, or `nil` before the first write.
    public func value() -> [String: Float]? { last }

    /// The last received reading serialized as a JSON object string (`"null"` before the first write).
    /// Matches JS `JSON.stringify`: keys in a deterministic order (sorted, so the string is stable), and
    /// whole floats print WITHOUT a trailing `.0` (e.g. `1`, not `1.0`) for JS/Kotlin parity.
    public func json() -> String {
        guard let v = last else { return "null" }
        let body = v.keys.sorted()
            .map { key in "\(Self.jsonString(key)):\(Self.jsonNumber(v[key]!))" }
            .joined(separator: ",")
        return "{\(body)}"
    }

    private static func jsonString(_ s: String) -> String {
        var out = "\""
        for c in s {
            switch c {
            case "\"": out += "\\\""
            case "\\": out += "\\\\"
            case "\n": out += "\\n"
            case "\r": out += "\\r"
            case "\t": out += "\\t"
            default:
                if let scalar = c.unicodeScalars.first, scalar.value < 0x20 {
                    out += String(format: "\\u%04x", scalar.value)
                } else {
                    out.append(c)
                }
            }
        }
        out += "\""
        return out
    }

    // Match JS JSON.stringify: whole floats print without a trailing `.0` (e.g. `1`, not `1.0`); non-finite
    // values serialize as `null` (JSON has no NaN/Infinity).
    private static func jsonNumber(_ n: Float) -> String {
        if n.isNaN || n.isInfinite { return "null" }
        if n == n.rounded() && abs(n) < 9.007e15 { return String(Int64(n)) }
        return String(n)
    }
}

/// A ``FieldProjectionTarget`` for the generic host `callback` surface (native-plane addition): every
/// reading it receives is forwarded to a `(reading) -> Void` a host wires to a native view (a text label,
/// a gauge, a haptic driver). The portable analog of a DOM write — the host owns the sink; the field only
/// supplies the reading. Build one with ``callbackTarget(_:)`` and pair it with
/// ``callbackProjection(id:channels:label:accessibilityEquivalent:)``.
public final class CallbackTarget: FieldProjectionTarget {
    private let sink: ([String: Float]) -> Void
    internal init(_ sink: @escaping ([String: Float]) -> Void) { self.sink = sink }
    public func receive(_ reading: [String: Float]) { sink(reading) }
}

/// Create an ``AgentJsonTarget`` — the sink an `agent-json` projection writes into (JS `agentJsonTarget()`).
public func agentJsonTarget() -> AgentJsonTarget { AgentJsonTarget() }

/// Create a projection that targets the `agent-json` surface (JS `agentJsonProjection`): its `apply` hands
/// the reading to an ``AgentJsonTarget`` (via `receive`). Pass `accessibilityEquivalent` if this projection
/// IS the alternate surface for a visual one (agent-json is inherently non-visual, so it usually is).
public func agentJsonProjection(
    id: String,
    channels: [String],
    label: String? = nil,
    accessibilityEquivalent: String? = nil
) -> FieldProjection {
    FieldProjection(
        id: id,
        label: label ?? id,
        channels: channels,
        surfaces: [.agentJson],
        accessibilityEquivalent: accessibilityEquivalent,
        apply: { reading, target in target.receive(reading) }
    )
}

/// Create a ``CallbackTarget`` wrapping a host sink — the target a `callback` projection writes into.
public func callbackTarget(_ sink: @escaping ([String: Float]) -> Void) -> CallbackTarget {
    CallbackTarget(sink)
}

/// Create a projection that targets the generic `callback` surface: its `apply` hands the reading to a
/// ``CallbackTarget``. The portable way to drive a native view from field state without a DOM.
public func callbackProjection(
    id: String,
    channels: [String],
    label: String? = nil,
    accessibilityEquivalent: String? = nil
) -> FieldProjection {
    FieldProjection(
        id: id,
        label: label ?? id,
        channels: channels,
        surfaces: [.callback],
        accessibilityEquivalent: accessibilityEquivalent,
        apply: { reading, target in target.receive(reading) }
    )
}

/// The field's projection registry (JS `ProjectionRegistry`; exposed as ``FieldHandle/projections``) —
/// register named projections and apply them. READ/OUTPUT ONLY: registering, binding, or applying a
/// projection never changes how matter moves (see the file docs above). One registry per field, owned by
/// the handle.
///
/// Parity with the JS `ProjectionRegistry` + the Kotlin port: `register` (returns an unregister fn) /
/// `unregister` / `get` / `list` (metadata) / `apply` / `bind` (auto-apply each write phase, returns an
/// unbind fn). The web-plane `lint()` (governance) is NOT mirrored here — governance lint is a later step
/// on both native planes and lives with the doctrine tooling, not the core registry mechanism.
public final class ProjectionRegistry {
    // Insertion-ordered so list() is deterministic (mirrors the JS Map iteration order + Kotlin's
    // LinkedHashMap). A parallel key→index map keeps get/unregister O(1).
    private var order: [String] = []
    private var byId: [String: FieldProjection] = [:]

    private struct Binding {
        let token: Int
        let id: String
        let target: any FieldProjectionTarget
        let source: ProjectionSource
    }
    private var bindings: [Binding] = []
    private var bindSeq = 0

    public init() {}

    /// Register a projection (replacing any with the same id); returns an unregister fn.
    @discardableResult
    public func register(_ projection: FieldProjection) -> () -> Void {
        if byId[projection.id] == nil { order.append(projection.id) }
        byId[projection.id] = projection
        let registeredId = projection.id
        return { [weak self] in
            // Only remove if this exact registration is still live (a re-register under the id wins).
            guard let self, self.byId[registeredId] != nil else { return }
            self.unregister(registeredId)
        }
    }

    /// Remove a registered projection by id.
    public func unregister(_ id: String) {
        guard byId.removeValue(forKey: id) != nil else { return }
        order.removeAll { $0 == id }
    }

    /// The full projection (incl. `apply`) for an id, or `nil`.
    public func get(_ id: String) -> FieldProjection? { byId[id] }

    /// Serializable metadata for every registered projection (JS `list()`) — no `apply`, insertion order.
    public func list() -> [FieldProjectionInfo] { order.compactMap { byId[$0] }.map(info) }

    /// Apply a registered projection's writer to a target (no-op if the id / `apply` is absent).
    public func apply(_ id: String, _ reading: [String: Float], _ target: any FieldProjectionTarget) {
        byId[id]?.apply?(reading, target)
    }

    /// Bind a registered projection to a target + a live reading source — the field auto-applies it once
    /// per write phase (after feedback), read-only w.r.t. the field. Returns an unbind fn. Multiple
    /// bindings (even of the same id) coexist; binding an unknown / `apply`-less id is inert (no throw).
    @discardableResult
    public func bind(_ id: String, _ target: any FieldProjectionTarget, _ source: @escaping ProjectionSource) -> () -> Void {
        bindSeq += 1
        let token = bindSeq
        bindings.append(Binding(token: token, id: id, target: target, source: source))
        return { [weak self] in self?.bindings.removeAll { $0.token == token } }
    }

    /// Auto-apply every bound projection for the current write phase (JS `applyBoundProjections`). Invoked
    /// by the handle once per frame after feedback easing (see `FieldEngine.tick`). Read-only w.r.t. the
    /// field — it only reads the bound sources and writes to the bound targets; it never moves matter.
    ///
    /// This is the registry's WRITE-PHASE SEAM, not part of the advertised registry API (neither JS nor
    /// Kotlin surface it publicly; Kotlin marks it module-`internal`). It is `public` here only because the
    /// concrete handle (`FieldEngine`) lives in a *different* module (`FundamentalVanilla`) from this type
    /// (`FundamentalCore`) and Swift `internal` is module-scoped — the same reason the engine's `step(_:)`
    /// seam is public. Hosts should never need to call it; the handle drives it each frame.
    public func applyBoundProjections() {
        // Snapshot the bindings so a source/apply that unbinds mid-phase doesn't mutate the list we iterate.
        for b in bindings { byId[b.id]?.apply?(b.source(), b.target) }
    }

    private func info(_ p: FieldProjection) -> FieldProjectionInfo {
        FieldProjectionInfo(
            id: p.id,
            label: p.label,
            channels: p.channels,
            surfaces: p.surfaces,
            reducedMotionEquivalent: p.reducedMotionEquivalent,
            accessibilityEquivalent: p.accessibilityEquivalent
        )
    }
}
