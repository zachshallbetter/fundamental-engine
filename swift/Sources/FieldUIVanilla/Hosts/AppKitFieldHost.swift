#if canImport(AppKit) && !targetEnvironment(macCatalyst)
import AppKit
import FieldUICore
import FieldUIPlatform

// MARK: - AppKitFieldHost

/// The FieldHost implementation for AppKit (macOS).
final class AppKitFieldHost: FieldHost {
    private weak var rootView: NSView?
    private var displayLink: CVDisplayLink?
    private var frameCallback: ((TimeInterval) -> Void)?

    public init(rootView: NSView) {
        self.rootView = rootView
    }

    // MARK: FieldHost — geometry

    public var volume: FieldVolume {
        guard let screen = NSScreen.main else {
            return FieldVolume(width: 1440, height: 900)
        }
        return FieldVolume(
            width:  Float(screen.frame.width),
            height: Float(screen.frame.height),
            depth:  0,
            scale:  Float(screen.backingScaleFactor)
        )
    }

    public var scrollY: Float { 0 }
    public var scrollHeight: Float { 0 }

    public var prefersReducedMotion: Bool {
        NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
    }

    public var isHidden: Bool { rootView?.isHidden ?? true }

    // MARK: FieldHost — loop (CVDisplayLink)

    public func scheduleFrame(_ callback: @escaping (TimeInterval) -> Void) -> AnyObject {
        frameCallback = callback
        // CVDisplayLink setup — fires on a background thread; dispatch to main for UI safety.
        var link: CVDisplayLink?
        CVDisplayLinkCreateWithActiveCGDisplays(&link)
        if let link {
            CVDisplayLinkSetOutputHandler(link) { [weak self] _, inNow, _, _, _ in
                let time = TimeInterval(inNow.pointee.videoTime) /
                           TimeInterval(inNow.pointee.videoTimeScale)
                DispatchQueue.main.async { self?.frameCallback?(time) }
                return kCVReturnSuccess
            }
            CVDisplayLinkStart(link)
            displayLink = link
            return link as AnyObject
        }
        return NSObject()
    }

    public func cancelFrame(_ token: AnyObject) {
        if let link = displayLink { CVDisplayLinkStop(link) }
        displayLink = nil
        frameCallback = nil
    }

    // MARK: FieldHost — events (stubs; connect via NSNotificationCenter / KVO as needed)

    public func onResize(_ callback: @escaping () -> Void) -> () -> Void { { } }
    public func onScroll(_ callback: @escaping () -> Void) -> () -> Void { { } }
    public func onVisibility(_ callback: @escaping () -> Void) -> () -> Void { { } }
    public func onInput(_ callback: @escaping () -> Void) -> () -> Void { { } }

    // MARK: FieldHost — projection

    public var projection: any FieldProjection { FlatProjection() }

    // MARK: FieldHost — body scanning

    public func scanBodies() -> [Body] {
        guard let root = rootView else { return [] }
        var bodies: [Body] = []
        walk(view: root, into: &bodies)
        return bodies
    }

    private func walk(view: NSView, into bodies: inout [Body]) {
        if let body = (view as? NSFieldBodyProvider)?.fieldBody {
            bodies.append(body)
        }
        for sub in view.subviews { walk(view: sub, into: &bodies) }
    }

    public func worldBox(of viewRef: AnyObject) -> Box? {
        guard let view = viewRef as? NSView, let root = rootView else { return nil }
        let frame = view.convert(view.bounds, to: root)
        return Box(
            center:      Vec3(Float(frame.midX), Float(frame.midY), 0),
            halfExtents: Vec3(Float(frame.width / 2), Float(frame.height / 2), 0)
        )
    }
}

public protocol NSFieldBodyProvider: NSView {
    var fieldBody: Body { get }
}

#endif
