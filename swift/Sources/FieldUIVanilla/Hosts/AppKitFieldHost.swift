#if canImport(AppKit) && !targetEnvironment(macCatalyst)
import AppKit
import FieldUICore
import FieldUIPlatform

// MARK: - AppKitFieldHost

/// The FieldHost implementation for AppKit (macOS).
final class AppKitFieldHost: FieldHost {
    private weak var rootView: NSView?
    private var displayLink: CADisplayLink?
    private var frameCallback: ((TimeInterval) -> Void)?
    /// Simulation depth (pt). 0 = flat (the default, byte-identical to the JS field);
    /// > 0 gives the field a shallow volume rendered through a perspective projection.
    private let depth: Float

    public init(rootView: NSView, depth: Float = 0) {
        self.rootView = rootView
        self.depth = max(0, depth)
    }

    // MARK: FieldHost — geometry

    public var volume: FieldVolume {
        // the mount IS the field: per-view embeddings size to their own bounds.
        let bounds = rootView?.bounds ?? .zero
        let scale = rootView?.window?.backingScaleFactor ?? NSScreen.main?.backingScaleFactor ?? 1
        return FieldVolume(
            width:  Float(bounds.width),
            height: Float(bounds.height),
            depth:  depth,   // 0 = flat; > 0 = a shallow volume behind the surface
            scale:  Float(scale)
        )
    }

    public var scrollY: Float { Float(rootView?.enclosingScrollView?.documentVisibleRect.origin.y ?? 0) }
    public var scrollHeight: Float {
        guard let sv = rootView?.enclosingScrollView, let doc = sv.documentView else { return 0 }
        return Float(max(0, doc.bounds.height - sv.contentView.bounds.height))
    }

    public var prefersReducedMotion: Bool {
        NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
    }

    public var isHidden: Bool { rootView?.isHidden ?? true }

    // MARK: FieldHost — loop (CADisplayLink, macOS 14)
    //
    // NSView.displayLink fires on the MAIN run loop, coalesced by Core Animation — a
    // missed frame is dropped, never queued. (The previous CVDisplayLink + main.async
    // approach enqueued a block per display tick unconditionally: on a 120Hz panel with
    // a busy main thread the backlog grew without bound — the classic lag spiral — and
    // the simulation ran at 2× speed besides.) The 60Hz clamp keeps the sim cadence the
    // engine's constants were tuned for (dt = 1 per frame at 60fps, same as the JS rAF).

    public func scheduleFrame(_ callback: @escaping (TimeInterval) -> Void) -> AnyObject {
        frameCallback = callback
        guard let view = rootView else { return NSObject() }
        let link = view.displayLink(target: self, selector: #selector(displayLinkFired(_:)))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 30, maximum: 60, preferred: 60)
        link.add(to: .main, forMode: .common)
        displayLink = link
        return link
    }

    @objc private func displayLinkFired(_ link: CADisplayLink) {
        frameCallback?(link.timestamp)
    }

    public func cancelFrame(_ token: AnyObject) {
        displayLink?.invalidate()
        displayLink = nil
        frameCallback = nil
    }

    // MARK: FieldHost — events

    /// Real resize wiring: the engine rebuilds its pool when the mount's frame changes
    /// (the JS engine does the same on window resize).
    public func onResize(_ callback: @escaping () -> Void) -> () -> Void {
        guard let view = rootView else { return {} }
        view.postsFrameChangedNotifications = true
        let token = NotificationCenter.default.addObserver(
            forName: NSView.frameDidChangeNotification, object: view, queue: .main
        ) { _ in callback() }
        return { NotificationCenter.default.removeObserver(token) }
    }

    public func onScroll(_ callback: @escaping () -> Void) -> () -> Void { { } }
    public func onVisibility(_ callback: @escaping () -> Void) -> () -> Void { { } }
    public func onInput(_ callback: @escaping () -> Void) -> () -> Void { { } }

    // MARK: FieldHost — projection

    /// Flat at depth 0; a shallow perspective once the field has volume.
    public var projection: any FieldProjection {
        depth > 0 ? PerspectiveProjection(focalLength: max(depth * 4, 200)) : FlatProjection()
    }

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
