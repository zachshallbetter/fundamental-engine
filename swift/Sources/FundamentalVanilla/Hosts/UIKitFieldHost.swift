#if canImport(UIKit)
import UIKit
import FundamentalCore
import FundamentalPlatform

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
        let bounds = rootView?.bounds ?? .zero // the mount IS the field; works on visionOS too (no UIScreen)
        let scale  = rootView?.traitCollection.displayScale ?? 1
        return FieldVolume(
            width:  Float(bounds.width),
            height: Float(bounds.height),
            depth:  depth,   // 0 = flat; > 0 = a shallow volume behind the surface
            scale:  Float(scale)
        )
    }

    /// The nearest enclosing scroll view, if the field is mounted inside one — so a page-like
    /// layout drives the `scrolling` condition and the travelling accent (§9) for free.
    private var enclosingScroll: UIScrollView? {
        var v: UIView? = rootView
        while let cur = v { if let s = cur as? UIScrollView { return s }; v = cur.superview }
        return nil
    }
    public var scrollY: Float { Float(enclosingScroll?.contentOffset.y ?? 0) }
    public var scrollHeight: Float {
        guard let s = enclosingScroll else { return 0 }
        return Float(max(0, s.contentSize.height - s.bounds.height))
    }

    // MARK: FieldHost — system signals

    public var prefersReducedMotion: Bool {
        UIAccessibility.isReduceMotionEnabled
    }

    /// Explicit host-level pause SPI (#605) — folded into `isHidden`, so flipping it drives the
    /// engine's auto-pause through the same visibility seam the lifecycle notifications use.
    /// SwiftUI does NOT set `UIView.isHidden` on views covered by `.sheet` / `.fullScreenCover`
    /// (they stay in the window hierarchy, ticking invisibly) — a presenter sets this instead.
    /// Callers holding a `FieldHandle` should prefer `pause()` / `resume()` on the handle.
    public var isPaused: Bool = false {
        didSet { if oldValue != isPaused { fireVisibility() } }
    }

    /// The app (or this view's scene) is in the background — the UIKit analog of `document.hidden`.
    private var backgrounded = false

    public var isHidden: Bool {
        guard let view = rootView else { return true }
        return view.isHidden || isPaused || backgrounded
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
    public var projection: any HostProjection {
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

    // MARK: Notifications — the presentation-aware lifecycle (#605)
    //
    // The UIKit analog of the web's Page Visibility pause: while the app (or this view's scene) is
    // backgrounded, `isHidden` reads true and the visibility seam fires, so the engine stops the
    // display link entirely; on return it fires again and the engine restarts. Note `willResign` /
    // control-center pulls do NOT pause (the app stays foreground-inactive but visible), matching
    // `document.hidden` semantics on the web.

    private func setupNotifications() {
        let nc = NotificationCenter.default
        // App lifecycle — the whole app entered / left the background.
        nc.addObserver(self, selector: #selector(hostDidBackground),
                       name: UIApplication.didEnterBackgroundNotification, object: nil)
        nc.addObserver(self, selector: #selector(hostWillForeground),
                       name: UIApplication.willEnterForegroundNotification, object: nil)
        nc.addObserver(self, selector: #selector(hostWillForeground),
                       name: UIApplication.didBecomeActiveNotification, object: nil)
        // Scene lifecycle — iPad multi-window / visionOS: ONE scene can background (its window
        // closed or off-space) while the app process stays active. Filtered to this view's scene.
        nc.addObserver(self, selector: #selector(sceneDidBackground(_:)),
                       name: UIScene.didEnterBackgroundNotification, object: nil)
        nc.addObserver(self, selector: #selector(sceneWillForeground(_:)),
                       name: UIScene.willEnterForegroundNotification, object: nil)
    }

    @objc private func hostDidBackground() {
        backgrounded = true
        fireVisibility()
    }

    @objc private func hostWillForeground() {
        backgrounded = false
        fireVisibility()
    }

    @objc private func sceneDidBackground(_ note: Notification) {
        guard isOwnScene(note.object) else { return }
        backgrounded = true
        fireVisibility()
    }

    @objc private func sceneWillForeground(_ note: Notification) {
        guard isOwnScene(note.object) else { return }
        backgrounded = false
        fireVisibility()
    }

    /// Whether a scene notification is about the scene this view lives in. A view not yet attached
    /// to a window can't be attributed to a scene — those fall through to the app-level pair.
    private func isOwnScene(_ object: Any?) -> Bool {
        guard let scene = object as? UIScene,
              let own = rootView?.window?.windowScene else { return false }
        return scene === own
    }

    private func fireVisibility() {
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
