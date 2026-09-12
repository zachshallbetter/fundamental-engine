import Foundation
import Testing
@testable import FundamentalVanilla
import FundamentalCore

/// The Swift half of Field Surfaces lane S0 — §13.7 as amended.
///
/// `render: .none_` is the signals-only mode for MATTER. A declared overlay READING draws whatever
/// the underlay mode is; a field that declares no reading is unchanged (the draw gate stays shut).
/// The JS engine pins the same two facts in `packages/core/src/engine/overlay-surface-gate.test.ts`.
///
/// Driven on the shared `HeadlessFieldHost` (declared in `FieldFieldTests.swift`), whose `fire(at:)`
/// steps one frame synchronously — no display link, no surface.
@Suite("Overlay surface gate (§13.7 amended)")
struct OverlaySurfaceGateTests {

    /// A renderer that records the frames it was handed — the observable end of the draw gate.
    final class RecordingRenderer: FieldRenderer {
        var frames: [RenderFrame] = []
        func render(frame: RenderFrame) { frames.append(frame) }
    }

    @Test("a signals-only field with a declared reading still renders — the reading is not matter")
    func signalsOnlyDrawsReadings() {
        let host = HeadlessFieldHost()
        let renderer = RecordingRenderer()
        let field = FieldField(
            host: host,
            options: .init(render: .none_, overlay: .single(.grid)),
            renderer: renderer
        )
        host.fire(at: 1 / 60)
        #expect(!renderer.frames.isEmpty, "the render gate opened for the reading")
        #expect(renderer.frames.last?.overlays == [.grid], "and the reading reached the renderer")
        #expect(renderer.frames.last?.mode == .none_, "while the underlay mode stays signals-only")
        field.destroy()
    }

    @Test("a signals-only field with NO reading renders nothing — the guarantee is intact")
    func signalsOnlyWithoutReadingsDrawsNothing() {
        let host = HeadlessFieldHost()
        let renderer = RecordingRenderer()
        let field = FieldField(host: host, options: .init(render: .none_), renderer: renderer)
        host.fire(at: 1 / 60)
        host.fire(at: 2 / 60)
        #expect(renderer.frames.isEmpty, "no reading declared → the render gate stays shut, as before")
        field.destroy()
    }

    @Test("turning a reading on at runtime opens the gate; turning it off closes it again")
    func setOverlayOpensAndClosesTheGate() {
        let host = HeadlessFieldHost()
        let renderer = RecordingRenderer()
        let field = FieldField(host: host, options: .init(render: .none_), renderer: renderer)
        host.fire(at: 1 / 60)
        #expect(renderer.frames.isEmpty)

        field.setOverlay(.single(.streamlines))
        host.fire(at: 2 / 60)
        #expect(renderer.frames.count == 1, "a reading going active starts the draw")

        field.setOverlay(.single(.off))
        host.fire(at: 3 / 60)
        #expect(renderer.frames.count == 1, "and clearing it stops the draw again")
        field.destroy()
    }

    @Test("setVisible(false) still suppresses the reading")
    func invisibleFieldDrawsNoReading() {
        let host = HeadlessFieldHost()
        let renderer = RecordingRenderer()
        let field = FieldField(
            host: host,
            options: .init(render: .none_, overlay: .single(.grid)),
            renderer: renderer
        )
        field.setVisible(false)
        host.fire(at: 1 / 60)
        #expect(renderer.frames.isEmpty, "element-invisible beats a declared reading")
        field.setVisible(true)
        host.fire(at: 2 / 60)
        #expect(!renderer.frames.isEmpty)
        field.destroy()
    }

    @Test("OverlayInput.activeModes is the one definition of an active reading")
    func activeModesIsTheOneDefinition() {
        #expect(OverlayInput.single(.off).activeModes.isEmpty)
        #expect(OverlayInput.single(.off).isActive == false)
        #expect(OverlayInput.single(.grid).activeModes == [.grid])
        #expect(OverlayInput.stack([.off, .grid, .path]).activeModes == [.grid, .path], "order preserved, .off filtered")
        #expect(OverlayInput.stack([]).isActive == false)
    }
}
