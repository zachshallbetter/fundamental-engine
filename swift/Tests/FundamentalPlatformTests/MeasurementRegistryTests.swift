import Foundation
import Testing
import FundamentalCore
@testable import FundamentalPlatform

// The registry-path half of the scroll body-centre tracking audit (#509, JS #508): measure()
// re-reads geometry from the host on EVERY call — there is no internal cache or throttle — so a
// scrolled body's centre is fresh each read-phase and never needs the JS core's between-measure
// scroll-delta compensation. If a measure cadence is ever introduced, these tests fail and the
// JS `dScroll` compensation (field.ts) must be ported alongside it.

@Suite("MeasurementRegistry — per-frame freshness (#508/#509)")
struct MeasurementRegistryTests {

    @Test("measure() re-reads a scrolling host's geometry on every call — snapshots never go stale")
    func measureTracksScrollPerCall() {
        let host = RegistryScrollHost()
        let anchor = NSObject()
        let docY: Float = 600
        let body = Body(tokens: ["attract"], strength: 1, range: 200,
                        box: Box(center: Vec3(187, docY, 0), halfExtents: Vec3(50, 25, 0)))
        body.view = anchor
        host.docBoxes[ObjectIdentifier(anchor)] = body.box

        let registry = MeasurementRegistry()
        registry.register(body)

        // Simulate a continuous scroll across consecutive read phases: every measure() must
        // deliver the body's fresh viewport position (document position minus the live scroll).
        for i in 1...12 {
            host.scroll = Float(i) * 8
            let out = registry.measure(now: TimeInterval(i) / 60, volume: host.volume, host: host)
            #expect(out.count == 1)
            #expect(abs(out[0].box.center.y - (docY - host.scroll)) < 1e-4,
                    "read \(i): the measurement must reflect the live scroll")
            #expect(abs(body.box.center.y - (docY - host.scroll)) < 1e-4,
                    "read \(i): the body's cached box is refreshed by the measure")
        }
    }
}

// MARK: - RegistryScrollHost

/// A minimal host whose `worldBox` answers each body's document box translated by the live
/// scroll — the fixed-overlay mount where the page scrolls under the field. All optional
/// FieldHost capabilities take their graceful defaults except `scrollY`.
private final class RegistryScrollHost: FieldHost {
    var scroll: Float = 0
    var docBoxes: [ObjectIdentifier: Box] = [:]

    var volume: FieldVolume { FieldVolume(width: 375, height: 812, depth: 0) }
    var scrollY: Float { scroll }
    var projection: any HostProjection { FlatProjection() }

    func scheduleFrame(_ callback: @escaping (TimeInterval) -> Void) -> AnyObject { NSObject() }
    func cancelFrame(_ token: AnyObject) {}
    func scanBodies() -> [Body] { [] }

    func worldBox(of view: AnyObject) -> Box? {
        guard let doc = docBoxes[ObjectIdentifier(view)] else { return nil }
        return Box(center: Vec3(doc.center.x, doc.center.y - scroll, doc.center.z),
                   halfExtents: doc.halfExtents)
    }
}
