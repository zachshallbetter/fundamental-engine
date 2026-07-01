import Foundation
#if canImport(simd)
import simd
#endif

// MARK: - Viewport / Volume

/// The render surface's current dimensions.
/// `depth` is the z extent of the simulation volume: 0 = the flat field (every formula
/// reduces to the JS 2D math exactly); > 0 = a volumetric field — a shallow opt-in
/// volume on iOS/macOS (`FieldField(in:depth:)`), real meters on visionOS.
public struct FieldVolume {
    public var width: Float
    public var height: Float
    public var depth: Float
    public var scale: Float      // display scale factor (DPR equivalent)

    public init(width: Float, height: Float, depth: Float = 0, scale: Float = 1) {
        self.width = width
        self.height = height
        self.depth = depth
        self.scale = scale
    }

    public var size3: Vec3 { Vec3(width, height, depth) }
}

// MARK: - FieldProjection

/// Maps a 3D world position to a 2D render point (and a depth hint for size/opacity effects).
/// Implement this on the host to control how the physics volume is projected onto a surface.
public protocol FieldProjection {
    /// Project `p` to a 2D point in the render surface's coordinate space.
    func project(_ p: Vec3) -> (x: Float, y: Float)
    /// Depth hint ∈ [0,1] for size/opacity effects. 0 = at surface; 1 = far back.
    func depthHint(_ p: Vec3) -> Float
}

/// Flat projection — z is ignored. The depth-0 (flat field) default on iOS and macOS.
public struct FlatProjection: FieldProjection {
    public init() {}
    public func project(_ p: Vec3) -> (x: Float, y: Float) { (p.x, p.y) }
    public func depthHint(_ p: Vec3) -> Float { 0 }
}

/// Shallow perspective projection — z gives a size/opacity nudge without leaving 2D.
/// `strength` controls how much z deflects the projected position (default 0 = flat).
public struct PerspectiveProjection: FieldProjection {
    public var focalLength: Float
    public var strength: Float

    public init(focalLength: Float = 500, strength: Float = 0.1) {
        self.focalLength = focalLength
        self.strength = strength
    }

    public func project(_ p: Vec3) -> (x: Float, y: Float) {
        let scale = focalLength / max(focalLength - p.z * strength, 1)
        return (p.x * scale, p.y * scale)
    }

    public func depthHint(_ p: Vec3) -> Float { clamp(-p.z / focalLength, 0, 1) }
}

// MARK: - FieldHost

// MARK: - MinimalFieldHost (JS #888)

/// `MinimalFieldHost` — the SMALLEST surface a host must supply for the engine to run, mirroring the JS
/// `MinimalFieldHost`. It is the required core of ``FieldHost``; everything else (scroll, reduced-motion,
/// visibility, events) is an OPTIONAL capability the engine degrades around when absent (see
/// ``HostCapabilities``). A host that supplies only these members runs the full simulation + feedback
/// pipeline headlessly — it just never scrolls, never pauses on visibility, and emits no events.
///
/// The two things a host MUST provide:
/// - **geometry** — `volume` (size + DPR + optional depth), `projection`, and the body-scan hooks
///   (`scanBodies` / `worldBox`): *where* the field lives and in what coordinate space.
/// - **time** — `scheduleFrame` / `cancelFrame`: how the frame loop is scheduled (a real display link,
///   a manual tick, a native `CADisplayLink`/`CVDisplayLink`).
public protocol MinimalFieldHost: AnyObject {
    // ── geometry ──────────────────────────────────────────────────────────
    var volume: FieldVolume { get }
    /// How the 3D world is projected onto the render surface.
    var projection: any FieldProjection { get }

    // ── loop (time) ────────────────────────────────────────────────────────
    /// Schedule a display-sync callback. Returns a cancellation token.
    func scheduleFrame(_ callback: @escaping (TimeInterval) -> Void) -> AnyObject
    func cancelFrame(_ token: AnyObject)

    // ── body scanning ─────────────────────────────────────────────────────
    /// Walk the view hierarchy and return bodies found (the `[data-body]` scanner equivalent).
    func scanBodies() -> [Body]
    /// Geometry of a view in world space. Returns nil if not available.
    func worldBox(of view: AnyObject) -> Box?
}

// MARK: - FieldHost

/// The platform seam — the full renderer/environment SPI: the ``MinimalFieldHost`` required core plus
/// the OPTIONAL capabilities the engine consumes when a host offers them. Implement this once per
/// platform target (iOS, macOS, visionOS). Equivalent to `browserHost()` in @fundamental-engine/dom.
///
/// A `MinimalFieldHost` gets these optional members for free through the default implementations below
/// (scroll → 0, reduced-motion / hidden → false, every subscription → a no-op unsubscribe), so a new
/// host only has to supply the minimal core and the engine degrades gracefully. Existing hosts that
/// implement every member keep satisfying this contract unchanged. Use ``hostCapabilities(_:)`` to
/// detect what a given host actually offers.
public protocol FieldHost: MinimalFieldHost {
    // ── system signals (optional capability) ────────────────────────────────
    /// Whether the user prefers reduced motion (freezes the sim). Default `false` (motion allowed).
    var prefersReducedMotion: Bool { get }
    /// Whether the surface is hidden (backgrounded) — pauses the loop. Default `false` (never auto-pauses).
    var isHidden: Bool { get }

    // ── scroll (optional capability) ────────────────────────────────────────
    /// Current scroll offset in the y axis (units). Default 0 (never scrolls).
    var scrollY: Float { get }
    /// Total scrollable height. Default 0 (falls back to the viewport height).
    var scrollHeight: Float { get }

    // ── events (optional capability) ────────────────────────────────────────
    /// Called on resize. Returns unsubscribe closure. Default: never fires.
    func onResize(_ callback: @escaping () -> Void) -> () -> Void
    /// Called on scroll. Returns unsubscribe closure. Default: never fires.
    func onScroll(_ callback: @escaping () -> Void) -> () -> Void
    /// Called on visibility change. Returns unsubscribe closure. Default: never fires.
    func onVisibility(_ callback: @escaping () -> Void) -> () -> Void
    /// Called on any user input gesture (tap/drag/pinch…). Returns unsubscribe closure. Default: never fires.
    func onInput(_ callback: @escaping () -> Void) -> () -> Void
}

/// Graceful-degradation defaults — the Swift counterpart of the JS engine treating an absent host
/// capability as a no-op. A ``MinimalFieldHost`` that only declares `FieldHost` conformance inherits all
/// of these: scroll reads 0, the system signals read `false`, and every subscription returns an
/// immediately-usable no-op unsubscribe.
public extension FieldHost {
    var prefersReducedMotion: Bool { false }
    var isHidden: Bool { false }
    var scrollY: Float { 0 }
    var scrollHeight: Float { 0 }
    func onResize(_ callback: @escaping () -> Void) -> () -> Void { {} }
    func onScroll(_ callback: @escaping () -> Void) -> () -> Void { {} }
    func onVisibility(_ callback: @escaping () -> Void) -> () -> Void { {} }
    func onInput(_ callback: @escaping () -> Void) -> () -> Void { {} }
}

// MARK: - HostCapabilities (JS #888)

/// What optional capabilities a ``FieldHost`` actually supplies — the "host conformance" read-out,
/// mirroring the JS `HostCapabilities`. A capability is present when the host provides a real backing
/// implementation (not the graceful no-op default); the engine degrades gracefully around any absent
/// one. This is the third parity/testing category alongside API-surface parity and mathematical
/// conformance: *does this host tick time, provide geometry, feed back, project…?*
public struct HostCapabilities: Sendable, Equatable {
    /// Always true — the required core (`volume` + `projection` + `scanBodies`/`worldBox`) is present by type.
    public var geometry: Bool
    /// The host schedules frames (`scheduleFrame`/`cancelFrame`) — always true for a valid host.
    public var time: Bool
    /// The host reports scroll position/height (a non-default `scrollY`/`scrollHeight`).
    public var scroll: Bool
    /// The host reports the reduced-motion preference.
    public var reducedMotion: Bool
    /// The host reports surface visibility so the loop can auto-pause.
    public var visibility: Bool
    /// The host emits at least one event subscription (resize/scroll/visibility/input).
    public var events: Bool

    public init(geometry: Bool = true, time: Bool = true, scroll: Bool = false,
                reducedMotion: Bool = false, visibility: Bool = false, events: Bool = false) {
        self.geometry = geometry
        self.time = time
        self.scroll = scroll
        self.reducedMotion = reducedMotion
        self.visibility = visibility
        self.events = events
    }
}

/// A host may declare which optional capabilities it actually backs — the Swift analog of the JS
/// `hostCapabilities(host)` probe. Swift can't introspect whether a protocol member is the default or an
/// override, so a host opts in by conforming to ``HostCapabilityReporting`` and reporting its own set; a
/// host that doesn't is assumed to back everything a full ``FieldHost`` declares (the historical hosts).
public protocol HostCapabilityReporting {
    var hostCapabilities: HostCapabilities { get }
}

/// Inspect which optional capabilities a host supplies — see ``HostCapabilities``. A host conforming to
/// ``HostCapabilityReporting`` reports its own set; otherwise every optional lane is assumed present
/// (the historical full hosts declare and back all members). Use it to branch on host shape or as the
/// basis of a host-conformance check.
public func hostCapabilities(_ host: any FieldHost) -> HostCapabilities {
    if let reporting = host as? HostCapabilityReporting { return reporting.hostCapabilities }
    // A plain FieldHost that doesn't report is treated as a full host backing every optional lane.
    return HostCapabilities(geometry: true, time: true, scroll: true,
                            reducedMotion: true, visibility: true, events: true)
}
