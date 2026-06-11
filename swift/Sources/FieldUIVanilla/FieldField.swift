import Foundation
import FieldUICore
import FieldUIPlatform
#if canImport(UIKit)
import UIKit
#endif
#if canImport(AppKit) && !targetEnvironment(macCatalyst)
import AppKit
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

/// The universal imperative field — the Swift equivalent of `FieldField` in @field-ui/vanilla.
///
/// ```swift
/// import FieldUIVanilla
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
    /// The mount point this field was attached to.
    private weak var mountPoint: (any FieldMountPoint)?

    // MARK: Init

    /// Attach a field to `mountPoint`. A render surface is created and added automatically.
    public init(in mountPoint: any FieldMountPoint, options: FieldOptions = .init()) {
        let host = FieldField.makeHost(for: mountPoint)
        self.handle = FieldEngine(host: host, options: options)
        self.managed = true
        self.mountPoint = mountPoint
    }

    /// Drive a field on a host you supply — the unmanaged form.
    /// Use this when you want full control of the render surface lifecycle.
    public init(host: any FieldHost, options: FieldOptions = .init()) {
        self.handle = FieldEngine(host: host, options: options)
        self.managed = false
    }

    // MARK: FieldHandle forwarding

    public func scan()    { handle.scan() }
    public func rescan()  { handle.rescan() }

    public func setAccent(_ hex: String)                  { handle.setAccent(hex) }
    public func setPalette(_ palette: [String])           { handle.setPalette(palette) }
    public func setRender(_ mode: RenderMode)             { handle.setRender(mode) }
    public func setOverlay(_ input: OverlayInput)         { handle.setOverlay(input) }
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
    public func energy() -> EnergyReport                  { handle.energy() }
    public func scrollV() -> Float                        { handle.scrollV() }

    public func setVisible(_ on: Bool)                    { handle.setVisible(on) }

    public func destroy() {
        handle.destroy()
        // If we created the render surface, hand it back off.
        // (Concrete removal is handled by each platform host's destroy().)
    }

    // MARK: Platform host factory

    private static func makeHost(for mountPoint: any FieldMountPoint) -> any FieldHost {
        #if canImport(RealityKit) && os(visionOS)
        if let entity = mountPoint as? RealityKitMountPoint {
            return RealityFieldHost(root: entity.fieldEntity)
        }
        #endif
        #if canImport(AppKit) && !targetEnvironment(macCatalyst)
        if let nsView = mountPoint as? NSView {
            return AppKitFieldHost(rootView: nsView)
        }
        #endif
        #if canImport(UIKit)
        if let uiView = mountPoint as? UIView {
            return UIKitFieldHost(rootView: uiView)
        }
        #endif
        // Fallback — callers can also pass a fully custom host via init(host:options:).
        fatalError("FieldField: unsupported mount point type \(type(of: mountPoint)). Use init(host:options:) for custom platforms.")
    }
}

// MARK: - mountField

/// Create and start a field attached to `mountPoint` — the free-function form.
/// Mirrors `mountField` from @field-ui/vanilla.
///
/// ```swift
/// let handle = mountField(in: myView)
/// handle.scan()
/// ```
public func mountField(in mountPoint: any FieldMountPoint, options: FieldOptions = .init()) -> any FieldHandle {
    FieldField(in: mountPoint, options: options)
}

// MARK: - RealityKitMountPoint (visionOS)

/// Adopt this on types that wrap a RealityKit Entity as a field mount point.
public protocol RealityKitMountPoint: FieldMountPoint {
    var fieldEntity: AnyObject { get }   // typed as AnyObject to avoid unconditional RealityKit import
}
