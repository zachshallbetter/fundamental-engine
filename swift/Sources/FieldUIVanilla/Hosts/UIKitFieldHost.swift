#if canImport(UIKit)
import UIKit
import FieldUICore
import FieldUIPlatform

// MARK: - UIKitFieldHost

/// The FieldHost implementation for UIKit (iOS / iPadOS, and visionOS windows).
/// Maps UIKit geometry, events, and display sync to the platform-agnostic FieldHost
/// protocol. `depth: 0` (default) is the flat field; > 0 opens a shallow z volume
/// rendered through a perspective projection.
final class UIKitFieldHost: FieldHost {
    private weak var rootView: UIView?
    private var displayLink: CADisplayLink?
    private var frameCallback: ((TimeInterval) -> Void)?
    private var resizeObservers:     [() -> Void] = []
    private var scrollObservers:     [() -> Void] = []
    private var visibilityObservers: [() -> Void] = []
    private var inputObservers:      [() -> Void] = []
    /// Simulation depth (pt). 0 = flat (the default, byte-identical to the JS field);
    /// > 0 gives the field a shallow volume rendered through a perspective projection.
    private let depth: Float

    public init(rootView: UIView, depth: Float = 0) {
        self.rootView = rootView
        self.depth = max(0, depth)
        setupNotifications()
    }

    // MARK: FieldHost — geometry

    public var volume: FieldVolume {
        // the mount's own bounds, not the screen — works on visionOS (no UIScreen)
        // and sizes per-view embeddings correctly everywhere else.
        let bounds = rootView?.window?.bounds ?? rootView?.bounds ?? .zero
        let scale  = rootView?.traitCollection.displayScale ?? 1
        return FieldVolume(
            width:  Float(bounds.width),
            height: Float(bounds.height),
            depth:  depth,   // 0 = flat; > 0 = a shallow volume behind the surface
            scale:  Float(scale)
        )
    }

    public var scrollY: Float { 0 }      // caller supplies via a UIScrollView subclass
    public var scrollHeight: Float { 0 }

    // MARK: FieldHost — system signals

    public var prefersReducedMotion: Bool {
        UIAccessibility.isReduceMotionEnabled
    }

    public var isHidden: Bool {
        rootView?.isHidden ?? true
    }

    // MARK: FieldHost — loop

    public func scheduleFrame(_ callback: @escaping (TimeInterval) -> Void) -> AnyObject {
        frameCallback = callback
        let link = CADisplayLink(target: self, selector: #selector(displayLinkFired(_:)))
        link.add(to: .main, forMode: .common)
        displayLink = link
        return link
    }

    public func cancelFrame(_ token: AnyObject) {
        (token as? CADisplayLink)?.invalidate()
        displayLink = nil
        frameCallback = nil
    }

    @objc private func displayLinkFired(_ link: CADisplayLink) {
        frameCallback?(link.timestamp)
    }

    // MARK: FieldHost — events

    public func onResize(_ callback: @escaping () -> Void) -> () -> Void {
        resizeObservers.append(callback)
        let idx = resizeObservers.count - 1
        return { [weak self] in self?.resizeObservers.remove(at: idx) }
    }

    public func onScroll(_ callback: @escaping () -> Void) -> () -> Void {
        scrollObservers.append(callback)
        let idx = scrollObservers.count - 1
        return { [weak self] in self?.scrollObservers.remove(at: idx) }
    }

    public func onVisibility(_ callback: @escaping () -> Void) -> () -> Void {
        visibilityObservers.append(callback)
        let idx = visibilityObservers.count - 1
        return { [weak self] in self?.visibilityObservers.remove(at: idx) }
    }

    public func onInput(_ callback: @escaping () -> Void) -> () -> Void {
        inputObservers.append(callback)
        let idx = inputObservers.count - 1
        return { [weak self] in self?.inputObservers.remove(at: idx) }
    }

    // MARK: FieldHost — projection

    /// Flat at depth 0; a shallow perspective once the field has volume — z nudges the
    /// projected position and feeds the renderer's depth-hint sizing/fading.
    public var projection: any FieldProjection {
        depth > 0 ? PerspectiveProjection(focalLength: max(depth * 4, 200)) : FlatProjection()
    }

    // MARK: FieldHost — body scanning

    /// Walk the UIView hierarchy from rootView, collecting views with a `fieldTokens` property
    /// (set via a UIView extension or FieldBodyView subclass).
    public func scanBodies() -> [Body] {
        guard let root = rootView else { return [] }
        var bodies: [Body] = []
        walk(view: root, into: &bodies)
        return bodies
    }

    private func walk(view: UIView, into bodies: inout [Body]) {
        if let body = (view as? FieldBodyProvider)?.fieldBody {
            bodies.append(body)
        }
        for sub in view.subviews {
            walk(view: sub, into: &bodies)
        }
    }

    public func worldBox(of viewRef: AnyObject) -> Box? {
        guard let view = viewRef as? UIView, let root = rootView else { return nil }
        let frame = view.convert(view.bounds, to: root)
        let cx = Float(frame.midX)
        let cy = Float(frame.midY)
        let hw = Float(frame.width  / 2)
        let hh = Float(frame.height / 2)
        return Box(center: Vec3(cx, cy, 0), halfExtents: Vec3(hw, hh, 0))
    }

    // MARK: Notifications

    private func setupNotifications() {
        NotificationCenter.default.addObserver(
            self, selector: #selector(appDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification, object: nil)
        NotificationCenter.default.addObserver(
            self, selector: #selector(appDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification, object: nil)
    }

    @objc private func appDidBecomeActive() {
        visibilityObservers.forEach { $0() }
    }

    @objc private func appDidEnterBackground() {
        visibilityObservers.forEach { $0() }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        displayLink?.invalidate()
    }
}

// MARK: - FieldBodyProvider

/// UIViews that participate as field bodies adopt this protocol.
/// Implement to supply a pre-configured Body, or use the FieldBodyView convenience class.
public protocol FieldBodyProvider: UIView {
    var fieldBody: Body { get }
}

// MARK: - FieldBodyView

/// A UIView subclass that is a field body out of the box.
/// Set tokens on init; geometry is filled each scan from worldBox(of:).
open class FieldBodyView: UIView, FieldBodyProvider {
    public let fieldBody: Body

    public init(tokens: [String], options: BodyOptions = .init(), frame: CGRect = .zero) {
        self.fieldBody = Body(
            tokens: tokens,
            strength: options.strength,
            range: options.range,
            absorbR: options.absorbR,
            capacity: options.capacity,
            spin: options.spin,
            heading: options.heading,
            when: options.when,
            feedback: options.feedback,
            shaped: options.shaped,
            fmin: options.fmin,
            fmax: options.fmax
        )
        super.init(frame: frame)
        fieldBody.view = self
    }

    @available(*, unavailable)
    required public init?(coder: NSCoder) { fatalError("use init(tokens:options:frame:)") }
}

// MARK: - BodyOptions

public struct BodyOptions {
    public var strength: Float = 1
    public var range: Float    = 100
    public var absorbR: Float  = 10
    public var capacity: Float = 30
    public var spin: Float     = 1
    public var heading: Vec3   = Vec3(0, -1, 0)
    public var when: String    = ""
    public var feedback: Bool  = false
    public var shaped: Bool    = false
    public var fmin: Float     = 0
    public var fmax: Float     = 1

    public init() {}
}

#endif
