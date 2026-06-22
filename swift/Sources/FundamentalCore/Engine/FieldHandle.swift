#if canImport(simd)
import simd
#else
import Foundation
#endif

// MARK: - FieldOptions

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
    public var density: Float?
    public var waves: Bool
    public var render: RenderMode
    public var firstClassMass: Bool
    public var palette: [String]?
    public var attention: Bool
    public var causality: Bool
    public var heatmap: Bool
    public var overlay: OverlayInput
    /// How matter is drawn — `.dot` (default), `.star(...)`, `.polygon(...)`, or `.custom(...)`. The
    /// shape rides the physics: each particle's size + heat scale it. Only affects the matter render
    /// modes (`dots` / `trails` / `links`).
    public var particleShape: ParticleShape
    public var feedbackSink: FeedbackSink?

    public init(
        accent: String? = nil,
        density: Float? = nil,
        waves: Bool = true,
        render: RenderMode = .dots,
        firstClassMass: Bool = false,
        palette: [String]? = nil,
        attention: Bool = false,
        causality: Bool = false,
        heatmap: Bool = false,
        overlay: OverlayInput = .single(.off),
        particleShape: ParticleShape = .dot,
        feedbackSink: FeedbackSink? = nil
    ) {
        self.accent = accent
        self.density = density
        self.waves = waves
        self.render = render
        self.firstClassMass = firstClassMass
        self.palette = palette
        self.attention = attention
        self.causality = causality
        self.heatmap = heatmap
        self.overlay = overlay
        self.particleShape = particleShape
        self.feedbackSink = feedbackSink
    }
}

// MARK: - FieldHandle  (§13)

/// Spec for a **programmatic** body (`FieldHandle.addBody`) — a force source with no backing view.
/// Mirrors the JS `BodySpec`. `rect` is the position source, sampled each frame (a non-DOM host
/// projects its mesh/view position through here); `angle` is in degrees.
public struct BodySpec {
    public var tokens: [String]
    public var strength: Float
    public var range: Float
    public var spin: Float
    public var angle: Float?
    public var color: String?
    public var data: (any Sendable)?
    public var rect: () -> Box
    public init(tokens: [String], strength: Float = 1, range: Float = 100, spin: Float = 1,
                angle: Float? = nil, color: String? = nil, data: (any Sendable)? = nil,
                rect: @escaping () -> Box) {
        self.tokens = tokens; self.strength = strength; self.range = range; self.spin = spin
        self.angle = angle; self.color = color; self.data = data; self.rect = rect
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
    public init(data: (any Sendable)?, set: @escaping (BodyParams) -> Void, remove: @escaping () -> Void) {
        self.data = data; self.setImpl = set; self.removeImpl = remove
    }
    /// Mutate this body's force params live; a *structural* change (different `tokens`) still needs
    /// remove + `addBody`. `color` re-tints the carried pigment.
    public func set(strength: Float? = nil, range: Float? = nil, angle: Float? = nil,
                    spin: Float? = nil, color: String? = nil) {
        setImpl(BodyParams(strength: strength, range: range, angle: angle, spin: spin, color: color))
    }
    /// Remove the body from the field.
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

    // ── lifecycle ─────────────────────────────────────────────────────────
    func setVisible(_ on: Bool)
    func destroy()
}
