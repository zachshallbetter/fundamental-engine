import Foundation
import Testing
@testable import FundamentalVanilla
import FundamentalCore

// Scroll body-centre tracking — the JS #508 invariant, pinned natively (#509).
//
// The JS core re-measures body geometry only every 6th frame (getBoundingClientRect can force
// synchronous layout), so #508 translates the cached centres by the per-frame scroll delta
// between measures — without it the attractors snap in 6-frame steps during a scroll and the
// swarm reads as "pausing". The native engine has no measure throttle: FieldEngine.tick re-reads
// every body's worldBox from the host each frame, so centres track a scroll/pan with zero
// staleness by construction, and a delta shift would double-count the scroll already present in
// the fresh measure. These tests pin that invariant on both mount geometries so a future measure
// cadence can't silently reintroduce the JS bug without porting the compensation (with its
// contained guard).

@Suite("Scroll body-centre tracking (#508/#509)")
struct ScrollTrackingTests {

    @Test("window mount: a body's centre tracks the scroll on every frame — zero staleness")
    func windowMountTracksPerFrame() {
        let host = ScrollingFieldHost()
        let anchor = NSObject()
        let docY: Float = 600
        let body = Body(tokens: ["attract"], strength: 2, range: 400,
                        box: Box(center: Vec3(187, docY, 0), halfExtents: Vec3(50, 25, 0)))
        body.view = anchor
        host.bodies = [body]
        host.docBoxes[ObjectIdentifier(anchor)] = body.box

        let field = FieldField(host: host)
        field.scan()

        // Scroll 8pt per frame for 24 frames. The measured centre must sit at the fresh viewport
        // position after EVERY tick — the "plateau fraction 0" verification from JS #508.
        for i in 1...24 {
            host.scroll = Float(i) * 8
            host.fire(at: TimeInterval(i) / 60)
            #expect(abs(body.box.center.y - (docY - host.scroll)) < 1e-4,
                    "frame \(i): the centre must track the live scroll, not a stale measure")
        }
        #expect(field.scrollV() > 0, "a continuous scroll registers as scroll velocity")
        field.destroy()
    }

    @Test("the force-centre follows the scrolled position — the sampled force flips as the body passes the probe")
    func forceCentreFollowsScroll() {
        let host = ScrollingFieldHost()
        let anchor = NSObject()
        let docY: Float = 600
        let body = Body(tokens: ["attract"], strength: 2, range: 400,
                        box: Box(center: Vec3(187, docY, 0), halfExtents: Vec3(50, 25, 0)))
        body.view = anchor
        host.bodies = [body]
        host.docBoxes[ObjectIdentifier(anchor)] = body.box

        let field = FieldField(host: host)
        field.scan()

        // Probe a fixed viewport point the body scrolls PAST (600 → 408 crosses 500). The force's
        // y-component at the probe must flip sign as the true centre crosses it — a stale centre
        // (stuck at document y = 600) would keep the same sign the whole way.
        let probe = Vec3(187, 500, 0)
        var early: Float = 0
        var late: Float = 0
        for i in 1...24 {
            host.scroll = Float(i) * 8
            host.fire(at: TimeInterval(i) / 60)
            let f = field.sample(x: probe.x, y: probe.y)
            if i == 2 { early = f.y }   // body viewport y = 584 — below the probe
            if i == 24 { late = f.y }   // body viewport y = 408 — above the probe
        }
        #expect(early != 0 && late != 0, "the attract body exerts force at the probe")
        #expect((early > 0) != (late > 0),
                "the force direction flips as the tracked centre crosses the probe")
        field.destroy()
    }

    @Test("contained mount: scroll-invariant geometry is left untouched — no engine-side shift")
    func containedMountUnshifted() {
        let host = ScrollingFieldHost()
        host.containedMount = true // worldBox is scroll-invariant; scrollY still advances
        let anchor = NSObject()
        let docY: Float = 600
        let body = Body(tokens: ["attract"], strength: 2, range: 400,
                        box: Box(center: Vec3(187, docY, 0), halfExtents: Vec3(50, 25, 0)))
        body.view = anchor
        host.bodies = [body]
        host.docBoxes[ObjectIdentifier(anchor)] = body.box

        let field = FieldField(host: host)
        field.scan()

        // A contained mount scrolls WITH its bodies (the JS `!contained` guard, #540): the host
        // reports scroll but the boxes don't move. The engine must not shift them by the delta.
        for i in 1...24 {
            host.scroll = Float(i) * 8
            host.fire(at: TimeInterval(i) / 60)
            #expect(abs(body.box.center.y - docY) < 1e-4,
                    "frame \(i): a scroll-invariant box must not be scroll-shifted by the engine")
        }
        field.destroy()
    }
}

// MARK: - ScrollingFieldHost

/// A headless FieldHost that simulates a scrolling mount. Tests set `scroll` and drive frames
/// with `fire(at:)`. In the default (window) mount, `worldBox` answers with each body's document
/// box translated by the live scroll — the fixed-overlay geometry where the page scrolls under
/// the field (the JS #508 architecture). With `containedMount`, boxes are scroll-invariant while
/// `scrollY` still advances — the mount scrolls together with its bodies (#540).
final class ScrollingFieldHost: FieldHost {
    var scroll: Float = 0
    var containedMount = false

    /// Document-space boxes by view identity; set by tests.
    var docBoxes: [ObjectIdentifier: Box] = [:]
    /// Bodies returned by scanBodies(); set by tests.
    var bodies: [Body] = []

    var volume: FieldVolume { FieldVolume(width: 375, height: 812, depth: 0) }
    var scrollY: Float { scroll }
    var scrollHeight: Float { 2000 }
    var prefersReducedMotion: Bool { false }
    var isHidden: Bool { false }
    var projection: any HostProjection { FlatProjection() }

    private var frameCallback: ((TimeInterval) -> Void)?

    func scheduleFrame(_ callback: @escaping (TimeInterval) -> Void) -> AnyObject {
        frameCallback = callback
        return NSObject()
    }

    func cancelFrame(_ token: AnyObject) { frameCallback = nil }

    /// Drive one frame synchronously.
    func fire(at time: TimeInterval) { frameCallback?(time) }

    func onResize(_ cb: @escaping () -> Void) -> () -> Void { {} }
    func onScroll(_ cb: @escaping () -> Void) -> () -> Void { {} }
    func onVisibility(_ cb: @escaping () -> Void) -> () -> Void { {} }
    func onInput(_ cb: @escaping () -> Void) -> () -> Void { {} }

    func scanBodies() -> [Body] { bodies }

    func worldBox(of view: AnyObject) -> Box? {
        guard let doc = docBoxes[ObjectIdentifier(view)] else { return nil }
        if containedMount { return doc }
        return Box(center: Vec3(doc.center.x, doc.center.y - scroll, doc.center.z),
                   halfExtents: doc.halfExtents)
    }
}
