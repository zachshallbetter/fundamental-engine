import Foundation
import FundamentalCore
import FundamentalPlatform
#if canImport(UIKit)
import UIKit
#endif
#if canImport(AppKit) && !targetEnvironment(macCatalyst)
import AppKit
#endif
#if canImport(RealityKit) && os(visionOS)
import RealityKit
#endif

// MARK: - MountPoint

/// Anything that can host a field render surface.
/// Extend your own view types to conform — the engine never imports UIKit/AppKit directly.
public protocol FieldMountPoint: AnyObject {
    /// The frame of this mount point in screen coordinates, used to size the field.
    var fieldFrame: CGRect { get }
    /// Add a sublayer / subview / child entity that the field renders into.
    func addFieldSurface(_ surface: AnyObject)
    /// Remove a previously-added field surface.
    func removeFieldSurface(_ surface: AnyObject)
}

// MARK: - FieldField

/// The universal imperative field — the Swift equivalent of `FieldField` in @fundamental-engine/vanilla.
///
/// ```swift
/// import FundamentalVanilla
///
/// // Attach to any FieldMountPoint (UIView, NSView, or RealityKit Entity)
/// let field = FieldField(in: myView)
/// field.scan()
/// field.burst(at: .init(200, 300, 0))
/// field.setFormation("wells")
/// // …
/// field.destroy()
/// ```
///
/// The platform host is selected internally at compile time — callers never reference
/// UIKit, AppKit, or RealityKit directly through this API.
public final class FieldField: FieldHandle {

    private let handle: any FieldHandle
    /// True when FieldField created the render surface (and must remove it on destroy).
    private let managed: Bool
    /// The managed engine (concrete) — so `setRender` can attach a surface lazily when a
    /// signals-only field (render `none`) starts drawing. nil for the unmanaged form.
    private let managedEngine: FieldEngine?
    /// Backing-store scale captured at mount, for lazy surface creation.
    private let managedScale: CGFloat
    /// The mount point this field was attached to.
    private weak var mountPoint: (any FieldMountPoint)?
    /// The managed render surfaces added to the mount (Metal layer + CG readings layer
    /// in the hybrid, or the single CG layer), in mount order.
    private var surfaces: [AnyObject] = []

    // MARK: Init

    /// Attach a field to `mountPoint`. A render surface is created and added automatically.
    ///
    /// `depth` gives a flat mount's field a shallow z volume (pt): 0 — the default — is the
    /// flat field, byte-identical to the JS engine; > 0 lets matter drift in z, rendered
    /// through a perspective projection (size/opacity recede with depth). The simulation is
    /// 3D either way — depth only opens the third axis of the *volume*, never the math.
    /// A RealityKit mount ignores it (a volumetric host defines its own extent).
    public init(in mountPoint: any FieldMountPoint, options: FieldOptions = .init(), depth: Float = 0) {
        let host = FieldField.makeHost(for: mountPoint, depth: depth)
        let engine = FieldEngine(host: host, options: options)
        self.handle = engine
        self.managed = true
        self.managedEngine = engine
        self.managedScale = CGFloat(host.volume.scale)
        self.mountPoint = mountPoint

        // managed render surfaces — skipped entirely in signals-only mode (render "none"),
        // matching the JS no-allocation guarantee (§13.7). `setRender` out of "none" attaches
        // them lazily (so a signals-only field can start drawing later, like the JS engine).
        if options.render != .none_ { attachManagedSurfaces() }
    }

    /// Drive a field on a host you supply — the unmanaged form.
    /// Use this when you want full control of the render surface lifecycle.
    public init(host: any FieldHost, options: FieldOptions = .init(), renderer: (any FieldRenderer)? = nil) {
        let engine = FieldEngine(host: host, options: options)
        engine.renderer = renderer
        self.handle = engine
        self.managed = false
        self.managedEngine = nil   // unmanaged: the caller owns the render surface lifecycle
        self.managedScale = 1
    }

    /// Attach the managed render surface(s) to the mount and wire them into the engine — the init
    /// path, reused by `setRender` to create a surface lazily when leaving signals-only mode.
    /// A no-op when unmanaged, when surfaces already exist, or with no QuartzCore.
    private func attachManagedSurfaces() {
        #if canImport(QuartzCore)
        guard managed, surfaces.isEmpty, let engine = managedEngine, let mountPoint else { return }
        #if canImport(Metal)
        if let hybrid = HybridFieldRenderer(scale: managedScale) {
            engine.renderer = hybrid
            mountPoint.addFieldSurface(hybrid.metal.metalLayer) // beneath
            mountPoint.addFieldSurface(hybrid.cg.surface)       // readings above
            self.surfaces = [hybrid.metal.metalLayer, hybrid.cg.surface]
            return
        }
        #endif
        let renderer = CoreGraphicsFieldRenderer(scale: managedScale)
        engine.renderer = renderer
        mountPoint.addFieldSurface(renderer.surface)
        self.surfaces = [renderer.surface]
        #endif
    }

    // MARK: FieldHandle forwarding

    public func scan()    { handle.scan() }
    public func rescan()  { handle.rescan() }

    public func setAccent(_ hex: String)                  { handle.setAccent(hex) }
    public func setPalette(_ palette: [String])           { handle.setPalette(palette) }
    public func setRender(_ mode: RenderMode) {
        handle.setRender(mode)
        // leaving signals-only: a managed field built with render "none" has no surface yet —
        // attach one now so it actually draws (idempotent once surfaces exist).
        if mode != .none_ { attachManagedSurfaces() }
    }
    public func setOverlay(_ input: OverlayInput)         { handle.setOverlay(input) }
    public func setWaveStyle(_ style: WaveStyle)          { handle.setWaveStyle(style) }
    public func setWaveCenter(_ center: WaveCenter?)      { handle.setWaveCenter(center) }
    public func setSeparation(_ strength: Float)          { handle.setSeparation(strength) }
    public func setFormation(_ name: String)              { handle.setFormation(name) }
    public func setAttention(_ on: Bool)                  { handle.setAttention(on) }
    public func setCausality(_ on: Bool)                  { handle.setCausality(on) }
    public func setHeatmap(_ on: Bool)                    { handle.setHeatmap(on) }

    public func threads(_ list: [ThreadLink]?)            { handle.threads(list) }

    public func burst(at position: Vec3, color: String? = nil) { handle.burst(at: position, color: color) }
    public func flowTo(_ position: Vec3, strength: Float? = nil) { handle.flowTo(position, strength: strength) }
    public func clearFlow()                               { handle.clearFlow() }

    public func seed(_ atoms: [AtomPayload])              { handle.seed(atoms) }
    public func atomAt(_ position: Vec3) -> AtomPayload?  { handle.atomAt(position) }
    public func focusAt(_ position: Vec3) -> AtomPayload? { handle.focusAt(position) }
    public func clearFocus()                              { handle.clearFocus() }

    public func particleCount() -> Int                    { handle.particleCount() }
    public func readParticles(into out: inout [Float]) -> Int { handle.readParticles(into: &out) }
    public func readParticleIds(into out: inout [Int]) -> Int { handle.readParticleIds(into: &out) }
    public func readParticleChannels(_ names: [String], into out: inout [Float]) -> Int { handle.readParticleChannels(names, into: &out) }
    public func sample(x: Float, y: Float) -> Vec3        { handle.sample(x: x, y: y) }
    @discardableResult
    public func on(_ event: FieldEvent, _ handler: @escaping (FieldEventPayload) -> Void) -> Subscription { handle.on(event, handler) }
    public func registerOverlay(_ key: String, _ renderer: any OverlayRenderer) { handle.registerOverlay(key, renderer) }
    public func removeOverlay(_ key: String) { handle.removeOverlay(key) }
    public var overlayRegistry: [String: any OverlayRenderer] { handle.overlayRegistry }
    @discardableResult
    public func addAgent(_ spec: AgentSpec) -> AgentHandle { handle.addAgent(spec) }
    public func sampleScalar(at p: Vec3) -> Float         { handle.sampleScalar(at: p) }
    public func sampleGradient(at p: Vec3) -> Vec3        { handle.sampleGradient(at: p) }
    public func addField(_ name: String, _ sampler: @escaping (Float, Float) -> Float) -> FieldChannelHandle { handle.addField(name, sampler) }
    public func sampleField(_ name: String, _ x: Float, _ y: Float) -> Float { handle.sampleField(name, x, y) }
    public func addBody(_ spec: BodySpec) -> BodyHandle { handle.addBody(spec) }
    @discardableResult
    public func addEdge(_ from: BodyHandle, _ to: BodyHandle,
                        type: String, strength: Float = 0.5,
                        direction: EdgeDirection = .bidirectional) -> EdgeHandle {
        handle.addEdge(from, to, type: type, strength: strength, direction: direction)
    }
    public func readEdges() -> [EdgeRecord]               { handle.readEdges() }
    public func energy() -> EnergyReport                  { handle.energy() }
    public func scrollV() -> Float                        { handle.scrollV() }

    public func grid(_ name: String) -> any ScalarGrid    { handle.grid(name) }
    public func setBackground(_ hex: String?)             { handle.setBackground(hex) }
    public func setDprCap(_ cap: Float)                   { handle.setDprCap(cap) }
    public func setQualityTier(_ tier: Int)               { handle.setQualityTier(tier) }

    public func setVisible(_ on: Bool)                    { handle.setVisible(on) }

    /// The field's current runtime ``FieldPolicy`` (substrate — JS #892).
    public var policy: FieldPolicy                        { handle.policy }
    /// Replace the runtime ``FieldPolicy`` live (substrate — JS #892).
    public func setPolicy(_ policy: FieldPolicy)          { handle.setPolicy(policy) }

    /// Derive a READ-ONLY, capability-scoped ``AgentFieldView`` (substrate — JS #894).
    public func forAgent(_ options: AgentViewOptions) -> any AgentFieldView { handle.forAgent(options) }

    /// Ask the live field a structured, READ-ONLY question (substrate READ API — JS #837). See
    /// ``FieldHandle/query(_:)``.
    public func query(_ q: FieldQuery? = nil) -> FieldQueryResult { handle.query(q) }

    public func destroy() {
        handle.destroy()
        // remove the managed render surfaces, mirroring `destroy()` removing the managed canvas.
        if managed, let mountPoint {
            for s in surfaces { mountPoint.removeFieldSurface(s) }
        }
        surfaces = []
    }

    // MARK: Platform host factory

    private static func makeHost(for mountPoint: any FieldMountPoint, depth: Float) -> any FieldHost {
        #if canImport(RealityKit) && os(visionOS)
        if let mount = mountPoint as? RealityKitMountPoint,
           let entity = mount.fieldEntity as? Entity {
            return RealityFieldHost(root: entity) // volumetric by construction; depth n/a
        }
        #endif
        #if canImport(AppKit) && !targetEnvironment(macCatalyst)
        if let nsView = mountPoint as? NSView {
            return AppKitFieldHost(rootView: nsView, depth: depth)
        }
        #endif
        #if canImport(UIKit)
        if let uiView = mountPoint as? UIView {
            return UIKitFieldHost(rootView: uiView, depth: depth)
        }
        #endif
        // Fallback — callers can also pass a fully custom host via init(host:options:).
        fatalError("FieldField: unsupported mount point type \(type(of: mountPoint)). Use init(host:options:) for custom platforms.")
    }
}

// MARK: - mountField

/// Create and start a field attached to `mountPoint` — the free-function form.
/// Mirrors `mountField` from @fundamental-engine/vanilla. `depth` as in `FieldField.init(in:options:depth:)`.
///
/// ```swift
/// let handle = mountField(in: myView)
/// handle.scan()
/// ```
public func mountField(in mountPoint: any FieldMountPoint, options: FieldOptions = .init(), depth: Float = 0) -> any FieldHandle {
    FieldField(in: mountPoint, options: options, depth: depth)
}

// MARK: - RealityKitMountPoint (visionOS)

/// Adopt this on types that wrap a RealityKit Entity as a field mount point.
public protocol RealityKitMountPoint: FieldMountPoint {
    var fieldEntity: AnyObject { get }   // typed as AnyObject to avoid unconditional RealityKit import
}
