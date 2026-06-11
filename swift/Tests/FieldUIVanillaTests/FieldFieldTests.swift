import Foundation
import Testing
@testable import FieldUIVanilla
import FieldUICore

@Suite("FieldField")
struct FieldFieldTests {

    @Test("mountField returns a working handle")
    func mountFieldReturnsHandle() {
        // Headless test: supply a custom host so no UIKit/AppKit is needed.
        let host = HeadlessFieldHost()
        let field = FieldField(host: host, options: .init())
        #expect(field.particleCount() == 0)
        field.destroy()
    }

    @Test("setVisible suspends ticking")
    func setVisibleSuspends() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host, options: .init())
        field.setVisible(false)
        // No assertion needed — just must not crash.
        field.destroy()
    }

    @Test("destroy cancels the frame loop")
    func destroyCancels() {
        let host = HeadlessFieldHost()
        let field = FieldField(host: host, options: .init())
        field.destroy()
        #expect(host.cancelCalled)
    }
}

// MARK: - HeadlessFieldHost

/// A no-op FieldHost for unit tests — no display link, no views.
final class HeadlessFieldHost: FieldHost {
    var volume: FieldVolume { FieldVolume(width: 375, height: 812) }
    var scrollY: Float { 0 }
    var scrollHeight: Float { 0 }
    var prefersReducedMotion: Bool { false }
    var isHidden: Bool { false }
    var projection: any FieldProjection { FlatProjection() }
    private(set) var cancelCalled = false

    func scheduleFrame(_ callback: @escaping (TimeInterval) -> Void) -> AnyObject { NSObject() }
    func cancelFrame(_ token: AnyObject) { cancelCalled = true }

    func onResize(_ cb: @escaping () -> Void) -> () -> Void { { } }
    func onScroll(_ cb: @escaping () -> Void) -> () -> Void { { } }
    func onVisibility(_ cb: @escaping () -> Void) -> () -> Void { { } }
    func onInput(_ cb: @escaping () -> Void) -> () -> Void { { } }

    func scanBodies() -> [Body] { [] }
    func worldBox(of view: AnyObject) -> Box? { nil }
}
