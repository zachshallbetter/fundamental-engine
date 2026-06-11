import Foundation
import FieldUICore
import FieldUIPlatform

/// The concrete FieldHandle implementation — the running engine instance.
/// Equivalent to the object returned by `createBrowserField` in @field-ui/platform.
///
/// Owns the display loop, particle simulation, and render surface.
/// Platform-specific rendering is delegated to the host's FieldProjection.
final class FieldEngine: FieldHandle {

    private let host: any FieldHost
    private let platform: FieldPlatform
    private var loopToken: AnyObject?
    private var options: FieldOptions

    // State
    private var visible: Bool = true
    private var bodies: [Body] = []

    init(host: any FieldHost, options: FieldOptions) {
        self.host = host
        self.options = options
        self.platform = FieldPlatform(host: host)
        start()
    }

    // MARK: Loop

    private func start() {
        loopToken = host.scheduleFrame { [weak self] timestamp in
            self?.tick(at: timestamp)
        }
    }

    private func tick(at timestamp: TimeInterval) {
        guard visible, !host.isHidden else { return }
        _ = platform.tick(now: timestamp)
    }

    // MARK: FieldHandle

    func scan() {
        bodies = host.scanBodies()
        platform.measure.snapshot.forEach { _ in }   // trigger discover phase next tick
    }

    func rescan() { scan() }

    func setAccent(_ hex: String)         { options.accent = hex }
    func setPalette(_ palette: [String])  { options.palette = palette }
    func setRender(_ mode: RenderMode)    { options.render = mode }
    func setOverlay(_ input: OverlayInput) {
        options.overlay = input
        platform.overlays.setOverlay(input)
    }
    func setFormation(_ name: String)     { /* integrator formation swap — wired in next iteration */ }
    func setAttention(_ on: Bool)         { options.attention = on }
    func setCausality(_ on: Bool)         { options.causality = on }
    func setHeatmap(_ on: Bool)           { options.heatmap = on }

    func threads(_ list: [ThreadLink]?)   { /* thread rendering — wired with renderer */ }

    func burst(at position: Vec3, color: String? = nil) { /* integrator impulse — next iteration */ }
    func flowTo(_ position: Vec3, strength: Float? = nil) { /* flow focus — next iteration */ }
    func clearFlow()                      { }

    func seed(_ atoms: [AtomPayload])     { /* particle seeding — next iteration */ }
    func atomAt(_ position: Vec3) -> AtomPayload?  { nil }
    func focusAt(_ position: Vec3) -> AtomPayload? { nil }
    func clearFocus()                     { }

    func particleCount() -> Int           { 0 }   // wired once FieldStore exists
    func energy() -> EnergyReport         { EnergyReport(kinetic: 0, thermal: 0, total: 0, count: 0) }
    func scrollV() -> Float               { 0 }

    func setVisible(_ on: Bool)           { visible = on }

    func destroy() {
        if let token = loopToken { host.cancelFrame(token) }
        loopToken = nil
    }
}
