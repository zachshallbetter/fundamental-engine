import Testing
import CoreGraphics
import FundamentalCore
import FundamentalVanilla
@testable import FundamentalSwiftUI

#if canImport(AppKit)
import AppKit
#endif

/// The `.fieldBody()` → `addBody` bridge: a SwiftUI view's frame, in the field's coordinate space,
/// becomes a live programmatic body whose well tracks the view and is removed on disappear.
@Suite("FieldBody bridge")
struct FieldBodyBridgeTests {

    @Test("frame → Box maps centre + half-extents (the worldBox mirror)")
    func frameToBox() {
        let box = FieldBodyRegistration.box(from: CGRect(x: 100, y: 50, width: 40, height: 20))
        #expect(box.center.x == 120) // midX of x=100,w=40
        #expect(box.center.y == 60)  // midY of y=50,h=20
        #expect(box.center.z == 0)   // flat field
        #expect(box.hw == 20)        // half-width
        #expect(box.hh == 10)        // half-height
    }

    #if canImport(AppKit)
    @Test("registers a real engine body via addBody, tracks position live, and removes")
    @MainActor
    func registersTracksRemoves() {
        // render: .none_ → signals-only, no renderer/Metal needed for a headless test.
        let view = NSView(frame: CGRect(x: 0, y: 0, width: 400, height: 300))
        let field = FieldField(in: view, options: .init(render: .none_))
        let reg = FieldBodyRegistration()
        #expect(!reg.isRegistered)

        // first known frame → one programmatic body, positioned under the view.
        reg.sync(field: field, tokens: ["attract"], strength: 1, range: 100,
                 frame: CGRect(x: 100, y: 50, width: 40, height: 20))
        #expect(reg.isRegistered)
        #expect(reg.currentBox.center.x == 120)
        #expect(reg.currentBox.center.y == 60)

        // a position change moves the box the engine's rect() samples — without re-registering.
        reg.sync(field: field, tokens: ["attract"], strength: 1, range: 100,
                 frame: CGRect(x: 200, y: 120, width: 40, height: 20))
        #expect(reg.isRegistered) // still exactly one body — moved, not re-added
        #expect(reg.currentBox.center.x == 220)

        // empty tokens never register (no body for a tokenless modifier).
        let empty = FieldBodyRegistration()
        empty.sync(field: field, tokens: [], strength: 1, range: 100,
                   frame: CGRect(x: 0, y: 0, width: 10, height: 10))
        #expect(!empty.isRegistered)

        reg.remove()
        #expect(!reg.isRegistered)
        field.destroy()
    }
    #endif
}
