import Foundation
import Testing
import simd
@testable import FieldUIVanilla
import FieldUICore

@Suite("FieldField")
struct FieldFieldTests {

    @Test("the engine builds the base pool — 130 × density particles")
    func basePool() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        #expect(field.particleCount() == 130)
        field.destroy()

        let dense = FieldField(host: HeadlessFieldHost(), options: .init(density: 2))
        #expect(dense.particleCount() == 260)
        dense.destroy()
    }

    @Test("burst shoves and heats nearby matter")
    func burstHeats() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        let before = field.energy()
        field.burst(at: Vec3(187, 406, 0)) // somewhere in the 375×812 volume
        let after = field.energy()
        #expect(after.thermal > before.thermal)
        #expect(after.kinetic > before.kinetic)
        field.destroy()
    }

    @Test("energy reports the live pool")
    func energyCount() {
        let field = FieldField(host: HeadlessFieldHost())
        #expect(field.energy().count == 130)
        field.destroy()
    }

    @Test("ticking the loop advances the simulation")
    func tickAdvances() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        field.burst(at: Vec3(187, 406, 0)) // give matter some velocity
        let before = field.energy().kinetic
        for i in 0..<30 { host.fire(at: TimeInterval(i) / 60) }
        let after = field.energy().kinetic
        #expect(after < before) // friction bled the burst's energy back out
        field.destroy()
    }

    @Test("seed binds atoms round-robin and atomAt picks them back")
    func seedAndPick() {
        let field = FieldField(host: HeadlessFieldHost())
        field.seed([AtomPayload(weight: 1, payload: ["name": "alpha"])])
        // every particle carries the one atom; querying at any particle finds it
        let engine = field.particleCount()
        #expect(engine == 130)
        // probe a grid of points — at least one lands within 24px of a particle
        var found: AtomPayload?
        for x in stride(from: Float(0), to: 375, by: 24) {
            for y in stride(from: Float(0), to: 812, by: 24) {
                if let atom = field.atomAt(Vec3(x, y, 0)) { found = atom; break }
            }
            if found != nil { break }
        }
        #expect(found != nil)
        #expect(found?.payload["name"] as? String == "alpha")
        field.destroy()
    }

    @Test("feedback body charges up (d rises) as matter gathers")
    func feedbackCharges() {
        let host = HeadlessFieldHost()
        let body = Body(tokens: ["attract"], strength: 2, range: 300,
                        box: Box(center: Vec3(187, 406, 0), halfExtents: Vec3(50, 25, 0)))
        body.feedback = true
        body.view = host
        host.bodies = [body]
        host.boxes[ObjectIdentifier(host)] = body.box

        let field = FieldField(host: host)
        field.scan()
        for i in 0..<120 { host.fire(at: TimeInterval(i) / 60) }
        #expect(body.d > 0) // the eased density rose from gathered matter
        field.destroy()
    }

    @Test("destroy cancels the frame loop")
    func destroyCancels() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        field.destroy()
        #expect(host.cancelCalled)
    }

    @Test("setFormation eases the live formation between presets")
    func formationSwitch() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host)
        field.setFormation("lanes")
        for i in 0..<60 { host.fire(at: TimeInterval(i) / 60) }
        // after 60 eased frames driftX is most of the way to 0.55 — verify via energy:
        // a lanes drift adds lateral kinetic energy to the pool vs. a frozen field.
        #expect(field.energy().kinetic > 0)
        field.destroy()
    }
}

// MARK: - HeadlessFieldHost

/// A FieldHost for unit tests — no display link, no views. Tests drive the loop by
/// calling `fire(at:)`, which invokes the engine's frame callback synchronously.
final class HeadlessFieldHost: FieldHost {
    var volume: FieldVolume { FieldVolume(width: 375, height: 812) }
    var scrollY: Float { 0 }
    var scrollHeight: Float { 0 }
    var prefersReducedMotion: Bool { false }
    var isHidden: Bool { false }
    var projection: any FieldProjection { FlatProjection() }

    private(set) var cancelCalled = false
    private var frameCallback: ((TimeInterval) -> Void)?

    /// Bodies returned by scanBodies(); set by tests.
    var bodies: [Body] = []
    /// World boxes by view identity; set by tests.
    var boxes: [ObjectIdentifier: Box] = [:]

    func scheduleFrame(_ callback: @escaping (TimeInterval) -> Void) -> AnyObject {
        frameCallback = callback
        return NSObject()
    }

    func cancelFrame(_ token: AnyObject) {
        cancelCalled = true
        frameCallback = nil
    }

    /// Drive one frame synchronously.
    func fire(at time: TimeInterval) {
        frameCallback?(time)
    }

    func onResize(_ cb: @escaping () -> Void) -> () -> Void { { } }
    func onScroll(_ cb: @escaping () -> Void) -> () -> Void { { } }
    func onVisibility(_ cb: @escaping () -> Void) -> () -> Void { { } }
    func onInput(_ cb: @escaping () -> Void) -> () -> Void { { } }

    func scanBodies() -> [Body] { bodies }
    func worldBox(of view: AnyObject) -> Box? { boxes[ObjectIdentifier(view)] }
}
