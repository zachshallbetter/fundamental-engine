#if canImport(simd)
import simd
#else
import Foundation
#endif

// MARK: - FieldOptions

/// Wave current layout style.
public enum WaveStyle: String {
    case linear, circular
}

/// Wave center options for circular style waves.
public enum WaveCenter {
    case coordinate(Vec3)
    case provider(() -> Vec3)
}

/// Render modes for the field underlay (§20.6).
public enum RenderMode: String {
    case dots, trails, links, metaballs, voronoi, streamlines, none_
}

/// Overlay reading modes — additive (§Field Surfaces).
public enum OverlayMode: String {
    case off, streamlines, forceVectors, fieldLines, grid, temperature, energy, path, data
}

/// One or more additive overlay readings.
public enum OverlayInput {
    case single(OverlayMode)
    case stack([OverlayMode])
}

/// Per-frame energy snapshot.
public struct EnergyReport {
    public var kinetic: Float
    public var thermal: Float
    public var total: Float
    public var count: Int

    public init(kinetic: Float, thermal: Float, total: Float, count: Int) {
        self.kinetic = kinetic; self.thermal = thermal; self.total = total; self.count = count
    }
}

/// Per-element feedback the engine produces each frame (Phase D3 seam).
public struct FeedbackChannels {
    public var density: Float?
    public var heatmapDensity: Float?
    public var load: Float?
    public var lit: Float?
    public var entropy: Float?
    public var coherence: Float?
    public var temperature: Float?

    public init() {}
}

/// Receives a body's feedback in place of direct attribute writes.
public typealias FeedbackSink = (_ view: AnyObject, _ channels: FeedbackChannels) -> Void

public struct FieldOptions {
    public var accent: String?
    public var palette: [String]?
    public var density: Float?
    public var waves: Bool
    public var waveStyle: WaveStyle
    public var waveCenter: WaveCenter?
    public var render: RenderMode
    public var firstClassMass: Bool
    public var attention: Bool
    public var causality: Bool
    public var heatmap: Bool
    public var overlay: OverlayInput
    public var separation: Float
    /// How matter is drawn — `.dot` (default), `.star(...)`, `.polygon(...)`, or `.custom(...)`. The
    /// shape rides the physics: each particle's size + heat scale it. Only affects the matter render
    /// modes (`dots` / `trails` / `links`).
    public var particleShape: ParticleShape
    /// Global size multiplier applied at spawn time (default 1.0 = unchanged). Use values > 1 for
    /// celebration / win screens where you want clearly visible, large stars rather than ambient dust.
    public var particleSize: Float
    /// Scales how much a particle's *heat* (proximity to an engaged body) inflates and brightens it at
    /// draw time (default 1.0 = full). Lower it (e.g. 0.4) to keep matter calm and uniform near
    /// attractors — particles still respond physically, they just don't bloom. 0 = no heat glow at all.
    public var particleGlow: Float
    public var feedbackSink: FeedbackSink?
    /// Canvas background clear colour (hex) — the renderer clears to it each frame. `nil` = transparent.
    /// Mirrors JS `setBackground`. Only affects Metal/CG renderers that honour this option.
    public var background: String?
    /// Device-pixel-ratio cap — passed to Metal's `contentsScale`. Default `nil` = no cap.
    /// Mirrors JS `setDprCap`.
    public var dprCap: Float?
    /// Quality tier 0–3 (0 = full, 3 = paused). Read by the platform scheduler. Mirrors JS `setQualityTier`.
    public var qualityTier: Int
    /// FIRST-CLASS IDENTITY resolver (JS #884): derive a ``FieldBodyIdentity`` for a scanned body from its
    /// backing view. Return `nil` to fall through to the deterministic default (a monotonic `body-N`).
    /// Runs at scan time; the resolved identity is cached on the body for its life. Mirrors JS
    /// `FieldOptions.identify`.
    public var identify: ((AnyObject) -> FieldBodyIdentity?)?
    /// Initial runtime ``FieldPolicy`` — what this host/session/user/app PERMITS (runtime rules). Change
    /// it live with `FieldHandle.setPolicy`. `nil` = no policy (unbounded, byte-identical to a pre-policy
    /// field). Mirrors JS `FieldOptions.policy`.
    public var policy: FieldPolicy?

    public init(
        accent: String? = nil,
        palette: [String]? = nil,
        density: Float? = nil,
        waves: Bool = true,
        waveStyle: WaveStyle = .linear,
        waveCenter: WaveCenter? = nil,
        render: RenderMode = .dots,
        firstClassMass: Bool = false,
        attention: Bool = false,
        causality: Bool = false,
        heatmap: Bool = false,
        overlay: OverlayInput = .single(.off),
        particleShape: ParticleShape = .dot,
        particleSize: Float = 1.0,
        particleGlow: Float = 1.0,
        separation: Float = 0.0,
        background: String? = nil,
        dprCap: Float? = nil,
        qualityTier: Int = 0,
        feedbackSink: FeedbackSink? = nil,
        identify: ((AnyObject) -> FieldBodyIdentity?)? = nil,
        policy: FieldPolicy? = nil
    ) {
        self.accent = accent
        self.density = density
        self.waves = waves
        self.waveStyle = waveStyle
        self.waveCenter = waveCenter
        self.render = render
        self.firstClassMass = firstClassMass
        self.palette = palette
        self.attention = attention
        self.causality = causality
        self.heatmap = heatmap
        self.overlay = overlay
        self.particleShape = particleShape
        self.particleSize = particleSize
        self.particleGlow = particleGlow
        self.separation = separation
        self.background = background
        self.dprCap = dprCap
        self.qualityTier = qualityTier
        self.feedbackSink = feedbackSink
        self.identify = identify
        self.policy = policy
    }
}

// MARK: - FieldHandle  (§13)

/// Spec for a **programmatic** body (`FieldHandle.addBody`) — a force source with no backing view.
/// Mirrors the JS `BodySpec`. `rect` is the position source, sampled each frame (a non-DOM host
/// projects its mesh/view position through here); `angle` is in degrees.
///
/// `onFeedback` receives the per-body `FeedbackChannels` snapshot each simulation frame —
/// the Swift counterpart of the JS `addBody` `onFeedback` callback (#headless-host). When omitted,
/// use `sampleScalar(at:)` / `sampleGradient(at:)` to pull per-position readings instead.
public struct BodySpec {
    public var tokens: [String]
    public var strength: Float
    public var range: Float
    public var spin: Float
    public var angle: Float?
    public var color: String?
    public var data: (any Sendable)?
    public var rect: () -> Box
    /// FIRST-CLASS IDENTITY for this programmatic body (see ``FieldBodyIdentity``, JS #884). Supply a
    /// stable identity so snapshots/diff/replay/relationships agree on `identity.id`; when omitted the
    /// engine derives a deterministic `body-N`. Mirrors JS `BodySpec.identity`.
    public var identity: FieldBodyIdentity?
    /// Called each frame with this body's field readings. Mirrors JS `BodySpec.onFeedback`.
    public var onFeedback: ((FeedbackChannels) -> Void)?
    public init(tokens: [String], strength: Float = 1, range: Float = 100, spin: Float = 1,
                angle: Float? = nil, color: String? = nil, data: (any Sendable)? = nil,
                identity: FieldBodyIdentity? = nil,
                rect: @escaping () -> Box,
                onFeedback: ((FeedbackChannels) -> Void)? = nil) {
        self.tokens = tokens; self.strength = strength; self.range = range; self.spin = spin
        self.angle = angle; self.color = color; self.data = data; self.rect = rect
        self.identity = identity
        self.onFeedback = onFeedback
    }
}

/// Live force params a `BodyHandle.set` can mutate (only the keys you pass change). `angle` in degrees.
public struct BodyParams {
    public var strength: Float?, range: Float?, angle: Float?, spin: Float?, color: String?
}

/// Handle to a programmatic body (`FieldHandle.addBody`). Mutate its params live (on the measure
/// cadence, no rescan) or remove it. Mirrors JS `BodyHandle`. Value type over the engine's mutate
/// closures (no retain cycle / no core→vanilla layering break).
public struct BodyHandle {
    /// The carried record (`BodySpec.data`).
    public let data: (any Sendable)?
    private let setImpl: (BodyParams) -> Void
    private let removeImpl: () -> Void
    /// Engine-internal: lets the engine resolve this handle back to its backing body for
    /// `addEdge`. Returns `AnyObject?` so external callers can't cast it to the private
    /// `Body` type — effectively opaque to consumers outside the engine.
    public let bodyRef: () -> AnyObject?
    private let loadImpl: () -> Float
    private let drainImpl: () -> Float
    public init(data: (any Sendable)?, set: @escaping (BodyParams) -> Void,
                remove: @escaping () -> Void, bodyRef: @escaping () -> AnyObject? = { nil },
                load: @escaping () -> Float = { 0 },
                drain: @escaping () -> Float = { 0 }) {
        self.data = data; self.setImpl = set; self.removeImpl = remove
        self.bodyRef = bodyRef
        self.loadImpl = load; self.drainImpl = drain
    }
    /// Mutate this body's force params live; a *structural* change (different `tokens`) still needs
    /// remove + `addBody`. `color` re-tints the carried pigment.
    public func set(strength: Float? = nil, range: Float? = nil, angle: Float? = nil,
                    spin: Float? = nil, color: String? = nil) {
        setImpl(BodyParams(strength: strength, range: range, angle: angle, spin: spin, color: color))
    }
    /// Remove the body from the field.
    public func remove() { removeImpl() }
    /// Current sink load: absorbed particles / capacity, ∈ [0, 1]. Zero if the body has no `sink` token.
    public var load: Float { loadImpl() }
    /// Drain all stored accretion and return the raw absorbed count (0–capacity). The body begins
    /// accumulating again immediately. Use the count to scale a burst: `max(1, Int(drain() * 0.2) + 1)`.
    @discardableResult
    public func drain() -> Float { drainImpl() }
}

/// Direction of a declared relationship edge (`FieldHandle.addEdge`).
public enum EdgeDirection: Sendable {
    case fromTo
    case toFrom
    case bidirectional
}

/// A snapshot of a relationship edge at the moment `readEdges()` is called.
/// Mirrors JS `readEdges()` record. All values are immutable snapshots.
public struct EdgeRecord: Sendable {
    public let from: (any Sendable)?    // source body's `data` field, verbatim
    public let to: (any Sendable)?      // target body's `data` field, verbatim
    public let type: String
    public let strength: Float          // 0..1; climbs ~1.5/s while active, decays ~0.3/s idle
    public let memory: Float            // 0..1; slow longitudinal accretion, holds while idle
    public let active: Bool             // source body density > 0.08 this tick
    public let direction: EdgeDirection
    public init(from: (any Sendable)?, to: (any Sendable)?, type: String,
                strength: Float, memory: Float, active: Bool, direction: EdgeDirection) {
        self.from = from; self.to = to; self.type = type
        self.strength = strength; self.memory = memory; self.active = active
        self.direction = direction
    }
}

/// Live handle to a registered relationship edge. Mirrors JS `EdgeHandle`.
public struct EdgeHandle: Sendable {
    private let setImpl: @Sendable (Float?, String?) -> Void
    private let removeImpl: @Sendable () -> Void
    public init(set: @escaping @Sendable (Float?, String?) -> Void,
                remove: @escaping @Sendable () -> Void) {
        self.setImpl = set; self.removeImpl = remove
    }
    public func set(strength: Float? = nil, type: String? = nil) { setImpl(strength, type) }
    public func remove() { removeImpl() }
}

/// Handle to a registered field channel (`FieldHandle.addField`). Swap the sampler live or remove it.
/// Mirrors the JS `FieldChannelHandle`. Value type wrapping the engine's mutate closures (no retain
/// cycle): the engine hands it weak-self closures over its channel map.
public struct FieldChannelHandle {
    /// The channel name (the key passed to `addField`).
    public let name: String
    private let setImpl: (@escaping (Float, Float) -> Float) -> Void
    private let removeImpl: () -> Void
    public init(name: String,
                set: @escaping (@escaping (Float, Float) -> Float) -> Void,
                remove: @escaping () -> Void) {
        self.name = name; self.setImpl = set; self.removeImpl = remove
    }
    /// Swap the sampler live (e.g. a season changes the moisture map).
    public func set(_ sampler: @escaping (Float, Float) -> Float) { setImpl(sampler) }
    /// Unregister the channel; `sampleField(name, …)` returns 0 afterward.
    public func remove() { removeImpl() }
}

// MARK: - Event bus types

/// Field lifecycle events — the typed event bus vocabulary. Mirrors JS `FieldEvent`.
public enum FieldEvent: Hashable {
    case tick
    case bodyAdd
    case bodyRemove
    case particleCapture
    case supernova
}

/// The payload delivered to an `on` subscriber.
public struct FieldEventPayload {
    public let event: FieldEvent
    public let body: Body?
    public let particle: Particle?
    public init(event: FieldEvent, body: Body? = nil, particle: Particle? = nil) {
        self.event = event; self.body = body; self.particle = particle
    }
}

/// A live subscription returned by `FieldHandle.on`. Call `cancel()` to unsubscribe.
public final class Subscription {
    private let _cancel: () -> Void
    public init(_ cancel: @escaping () -> Void) { _cancel = cancel }
    public func cancel() { _cancel() }
}

// MARK: - Overlay renderer type

/// A named overlay renderer registered via `FieldHandle.registerOverlay`. The host's draw loop
/// calls `render(in:)` each frame after the underlay draw. Mirrors JS `registerOverlay`.
public protocol OverlayRenderer: AnyObject {
    func render(in handle: any FieldHandle)
}

// MARK: - Agent types

/// Spec for an autonomous field-agent consumer. `position` reports the agent's world location
/// each tick; `onInfluence` receives the net force vector the field exerts there.
/// Mirrors JS `AgentSpec`.
public struct AgentSpec {
    public var position: () -> Vec3
    public var range: Float
    public var tokens: [String]
    public var onInfluence: ((Vec3) -> Void)?
    public init(position: @escaping () -> Vec3, range: Float = 120, tokens: [String] = [],
                onInfluence: ((Vec3) -> Void)? = nil) {
        self.position = position; self.range = range; self.tokens = tokens; self.onInfluence = onInfluence
    }
}

/// Handle returned by `FieldHandle.addAgent`. Call `remove()` to deregister. Mirrors JS `AgentHandle`.
public final class AgentHandle {
    public let spec: AgentSpec
    private let _remove: () -> Void
    public init(spec: AgentSpec, remove: @escaping () -> Void) { self.spec = spec; _remove = remove }
    public func remove() { _remove() }
}

// MARK: - FieldHandle protocol

/// The public field API — the handle returned by `createField`.
/// All spatial parameters are 3D; on 2D platforms pass z = 0.
public protocol FieldHandle: AnyObject {
    // ── scanning ──────────────────────────────────────────────────────────
    func scan()
    func rescan()   // alias

    // ── appearance ────────────────────────────────────────────────────────
    func setAccent(_ hex: String)
    func setPalette(_ palette: [String])
    func setRender(_ mode: RenderMode)
    func setOverlay(_ input: OverlayInput)
    func setWaveStyle(_ style: WaveStyle)
    func setWaveCenter(_ center: WaveCenter?)
    func setSeparation(_ strength: Float)

    // ── simulation toggles ────────────────────────────────────────────────
    func setFormation(_ name: String)
    func setAttention(_ on: Bool)
    func setCausality(_ on: Bool)
    func setHeatmap(_ on: Bool)

    // ── threads  (§10) ────────────────────────────────────────────────────
    func threads(_ list: [ThreadLink]?)

    // ── imperative interactions ────────────────────────────────────────────
    /// One-shot: shove + heat matter near `position` (§11).
    func burst(at position: Vec3, color: String?)
    /// Place / move a dynamic flow focus (§flowTo).
    func flowTo(_ position: Vec3, strength: Float?)
    func clearFlow()

    // ── atoms  (§seed) ────────────────────────────────────────────────────
    func seed(_ atoms: [AtomPayload])
    func atomAt(_ position: Vec3) -> AtomPayload?
    func focusAt(_ position: Vec3) -> AtomPayload?
    func clearFocus()

    // ── observability ─────────────────────────────────────────────────────
    func particleCount() -> Int
    func energy() -> EnergyReport
    func scrollV() -> Float
    /// Copy live particle state into a caller-owned buffer (stride 5: `x, y, z, heat, size`); returns
    /// the count written = `min(particleCount(), out.count / 5)`. Zero-alloc read-out an alternative
    /// renderer (a SceneKit / Metal swarm) draws from — mirrors JS `FieldHandle.readParticles`.
    func readParticles(into out: inout [Float]) -> Int
    /// The smooth diffused density scalar ∈ [0,1] at a point — the heatmap grid bilinearly sampled,
    /// or 0 when the heatmap layer is off. Mirrors JS `sampleScalar`.
    func sampleScalar(at p: Vec3) -> Float
    /// The gradient of that density field at a point (points up-slope, toward denser matter), or
    /// `.zero` when the heatmap is off — the forage-by-gradient read-out. Mirrors JS `sampleGradient`.
    func sampleGradient(at p: Vec3) -> Vec3

    // ── open inputs (field channels) ──────────────────────────────────────
    /// Register an external scalar field channel — the open *input* analog of the render surfaces
    /// (a moisture map, a season, a heat source). Returns a handle to swap the sampler live or remove
    /// it. Mirrors JS `addField`.
    func addField(_ name: String, _ sampler: @escaping (Float, Float) -> Float) -> FieldChannelHandle
    /// Sample a registered channel at `(x, y)`; `0` if no channel by that name. Mirrors JS `sampleField`.
    func sampleField(_ name: String, _ x: Float, _ y: Float) -> Float

    // ── programmatic bodies ───────────────────────────────────────────────
    /// Add a force source with no backing view — a body driven by code, positioned each frame by the
    /// spec's `rect` closure (a non-DOM host projects its mesh position through it). Survives `scan()`.
    /// Returns a handle to mutate its params live or remove it. Mirrors JS `addBody`.
    func addBody(_ spec: BodySpec) -> BodyHandle

    // ── relationship edges  (§addEdge) ────────────────────────────────────
    /// Declare a directed relationship between two programmatic bodies. The edge's `strength`
    /// rises while the source body is salient (density > 0.08) and decays while idle; `memory`
    /// accumulates longitudinally. Neither body needs a view. Mirrors JS `addEdge` (#603).
    /// Removing either endpoint body automatically removes the edge.
    @discardableResult
    func addEdge(_ from: BodyHandle, _ to: BodyHandle,
                 type: String, strength: Float, direction: EdgeDirection) -> EdgeHandle
    /// Snapshot all live edges. Mirrors JS `readEdges()`.
    func readEdges() -> [EdgeRecord]

    // ── scalar grid ───────────────────────────────────────────────────────
    /// Get or create a named `ScalarGrid` — the field-buffer substrate backing `diffuse`/`propagate`
    /// forces. Grids are lazily created and shared with the force system. Mirrors JS `grid(name)`.
    func grid(_ name: String) -> any ScalarGrid

    // ── visual tuning ─────────────────────────────────────────────────────
    /// Background / canvas clear colour (hex string) — the renderer clears to it each frame.
    /// `nil` = transparent. Mirrors JS `setBackground`.
    func setBackground(_ hex: String?)
    /// Device-pixel-ratio cap — the platform host clamps its backing-scale to this value.
    /// Mirrors JS `setDprCap`.
    func setDprCap(_ cap: Float)
    /// Quality tier 0–3 (0 = full, 3 = paused). The platform host adapts its draw complexity.
    /// Mirrors JS `setQualityTier`.
    func setQualityTier(_ tier: Int)

    // ── particle ids ──────────────────────────────────────────────────────
    /// Fill `out` with the stable integer ID of each live particle; return the particle count.
    /// IDs are assigned at pool creation and survive re-binding. Mirrors JS `readParticleIds`.
    func readParticleIds(into out: inout [Int]) -> Int

    // ── particle channel readout ──────────────────────────────────────────
    /// Sample each named scalar grid at every live particle's position and pack the results into
    /// `out` (stride = `names.count`). Returns the particle count. Mirrors JS `readParticleChannels`.
    func readParticleChannels(_ names: [String], into out: inout [Float]) -> Int

    // ── force probe ───────────────────────────────────────────────────────
    /// Net force vector a particle at (x, y) would experience from all active bodies.
    /// Mirrors JS `sample(x, y)`.
    func sample(x: Float, y: Float) -> Vec3

    // ── event bus ─────────────────────────────────────────────────────────
    /// Subscribe to a field event. Returns a `Subscription`; call `.cancel()` to unsubscribe.
    /// The `tick` event fires after each simulation frame. Mirrors JS `on(event, handler)`.
    @discardableResult
    func on(_ event: FieldEvent, _ handler: @escaping (FieldEventPayload) -> Void) -> Subscription

    // ── overlay registry ──────────────────────────────────────────────────
    /// Register a named overlay renderer — called by the host frame loop after underlay draw.
    func registerOverlay(_ key: String, _ renderer: any OverlayRenderer)
    /// Remove a registered overlay renderer.
    func removeOverlay(_ key: String)
    /// The live overlay registry — read by the host frame loop.
    var overlayRegistry: [String: any OverlayRenderer] { get }

    // ── agents ────────────────────────────────────────────────────────────
    /// Register an autonomous agent consumer. Each tick the engine evaluates the net force
    /// at the agent's `position()` and delivers it via `onInfluence`. Mirrors JS `addAgent`.
    @discardableResult
    func addAgent(_ spec: AgentSpec) -> AgentHandle

    // ── policy  (substrate — JS #892) ──────────────────────────────────────
    /// The field's current runtime ``FieldPolicy`` (a value copy). An empty policy when none was set.
    /// Mirrors JS `FieldHandle.policy`.
    var policy: FieldPolicy { get }
    /// Replace the runtime ``FieldPolicy`` live — what this host/session/user/app PERMITS. REPLACE (not
    /// merge): the field runs exactly the policy handed in. Reduced-motion still wins over it (a policy
    /// can lower motion but never raise it above what reduced-motion allows). Mirrors JS `setPolicy`.
    func setPolicy(_ policy: FieldPolicy)

    // ── agent permissions  (substrate — JS #894) ───────────────────────────
    /// Derive a READ-ONLY ``AgentFieldView`` scoped to a set of ``AgentCapability``s — the safe surface a
    /// Software Agent reads the field through. The returned view has NO mutation methods (enforced by its
    /// shape) and tightens every reading to the granted caps. It reads the same live field; it does not
    /// fork or copy it. Mirrors JS `forAgent`.
    func forAgent(_ options: AgentViewOptions) -> any AgentFieldView

    // ── substrate READ API: query  (JS #837 / critical-path 02) ─────────────
    /// Ask the live field a structured, READ-ONLY question — which bodies are here, what they're doing,
    /// how the field measures right now — without a render surface. Mirror of the JS
    /// `@fundamental-engine/core` `query()` (and the Kotlin `:fundamental-core` port); the returned
    /// ``FieldQueryResult`` has the same field names + shape, so a reading is identical across planes.
    ///
    /// A `nil` query is a global query (whole field, default include set). A
    /// ``FieldQueryAt/point(x:y:radius:)`` (radius default 240) or
    /// ``FieldQueryAt/rect(x:y:width:height:)`` scopes to a region — only bodies whose centre falls in
    /// the region are returned, and `influences` becomes meaningful (though empty in this port until the
    /// impulse accumulator lands). The `include` set filters which sections are computed; omitted ⇒
    /// bodies + metrics + relationships (plus influences for a local query).
    ///
    /// Read-only throughout: `query()` never mutates field state. Mirrors JS `FieldHandle.query`.
    func query(_ q: FieldQuery?) -> FieldQueryResult

    // ── lifecycle ─────────────────────────────────────────────────────────
    func setVisible(_ on: Bool)
    func destroy()
}
