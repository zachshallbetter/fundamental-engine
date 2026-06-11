import simd

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
        self.feedbackSink = feedbackSink
    }
}

// MARK: - FieldHandle  (§13)

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

    // ── lifecycle ─────────────────────────────────────────────────────────
    func setVisible(_ on: Bool)
    func destroy()
}
