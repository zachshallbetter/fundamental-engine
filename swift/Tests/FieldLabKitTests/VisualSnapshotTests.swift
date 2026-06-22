#if os(macOS)
import Testing
import FieldLabKit
import FundamentalCore

// Visual snapshot model (#417/#392) — the third model of the cross-plane verification spine.
//
// The point is to verify the *rendered output* of each mode without a device or human eye — the gap
// that previously forced renderer-parity work (soft-glow particles #417, 3D streamline tubes / vector
// grid #392) to "needs human eyes." A full pixel-exact golden flakes: the engine's wander is unseeded
// and CoreGraphics rasterization differs across machines. So the model reduces a headless render to a
// COARSE perceptual signature (downsampled luminance + lit fraction + centroid) and gates STRUCTURE:
//
//   1. every matter mode draws coherent, bounded content in the right place (non-blank, not blown out);
//   2. that coarse signature is stable run-to-run — the precondition for committing per-mode goldens.
//
// When #417/#392 land, each adds a signature assertion (the glow is present / the tubes occupy the
// field) on top of this. If `signatureIsStable` ever fails, the coarse aggregate isn't stable enough
// and the engine needs a seeded RNG seam before golden diffing — that's the honest tripwire.

@Suite("VisualSnapshot")
struct VisualSnapshotTests {

    private let modes: [RenderMode] = [.dots, .trails, .links, .metaballs, .voronoi, .streamlines]

    private func opts() -> Snapshotter.Options {
        var o = Snapshotter.Options()
        o.frames = 150  // enough for the field to settle
        o.scale = 1     // 1280×800 — fast, and downsampling makes scale irrelevant to the signature
        return o
    }

    @Test("every matter render mode draws coherent, bounded content")
    func everyModeDrawsContent() throws {
        for mode in modes {
            var scene = LabScenes.mass
            scene.render = mode
            let sig = try Snapshotter.signature(scene: scene, options: opts())
            #expect(sig.litFraction > 0.001, "\(mode) renders (almost) nothing — litFraction \(sig.litFraction)")
            #expect(sig.litFraction < 0.9, "\(mode) blows out the whole screen — litFraction \(sig.litFraction)")
            #expect(sig.centroidX > 0.05 && sig.centroidX < 0.95, "\(mode) lit mass off-canvas in x: \(sig.centroidX)")
            #expect(sig.centroidY > 0.05 && sig.centroidY < 0.95, "\(mode) lit mass off-canvas in y: \(sig.centroidY)")
        }
    }

    @Test("the coarse signature is stable run-to-run despite unseeded wander")
    func signatureIsStable() throws {
        // dots is the densest, most wander-sensitive mode — the strictest stability check.
        var scene = LabScenes.mass
        scene.render = .dots
        let a = try Snapshotter.signature(scene: scene, options: opts())
        let b = try Snapshotter.signature(scene: scene, options: opts())
        #expect(a.maxCellDelta(to: b) < 0.08, "coarse signature unstable run-to-run: \(a.maxCellDelta(to: b))")
        #expect(abs(a.litFraction - b.litFraction) < 0.03, "litFraction unstable: \(a.litFraction) vs \(b.litFraction)")
    }
}
#endif
