#if os(macOS)
import Testing
import FieldLabKit
import FundamentalCore

// Visual snapshot model (#417/#392) — the third model of the cross-plane verification spine.
//
// The point is to verify the *rendered output* of each mode without a device or human eye — the gap
// that previously forced renderer-parity work (soft-glow particles #417, 3D streamline tubes / vector
// grid #392) to "needs human eyes." A full pixel-exact golden flakes: these scenes run the production
// default — the UNSEEDED rng (the engine's randomness is seedable since the #974 determinism seam,
// via `FieldOptions.rng` / `seededRng`, but the Lab exercises the default) — and CoreGraphics
// rasterization differs across machines. So the model reduces a headless render to a
// COARSE perceptual signature (downsampled luminance + lit fraction + centroid) and gates STRUCTURE:
//
//   1. every matter mode draws coherent, bounded content in the right place (non-blank, not blown out);
//   2. that coarse signature is stable run-to-run — the precondition for committing per-mode goldens.
//
// #417's signature assertion (the glow is present — `dotsGlowIsSoft`) sits on top of this, with the
// exact bloom/orbital-cloud geometry pinned deterministically in SoftGlowRenderTests; #392 adds its
// own (the tubes occupy the field) when it lands. If `signatureIsStable` ever fails, the coarse
// aggregate isn't stable enough for unseeded golden diffing — the seeded seam (#974) is the escape
// hatch: pin a `seededRng` scene and diff exactly.

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
        // dots is the densest, most wander-sensitive mode — the strictest stability check. The two
        // runs are deliberately UNSEEDED (the production default; a seeded `FieldOptions.rng` would
        // make them bit-identical, #974): the point is that the coarse signature holds across runs
        // whose exact particle paths genuinely differ.
        var scene = LabScenes.mass
        scene.render = .dots
        let a = try Snapshotter.signature(scene: scene, options: opts())
        let b = try Snapshotter.signature(scene: scene, options: opts())
        #expect(a.maxCellDelta(to: b) < 0.08, "coarse signature unstable run-to-run: \(a.maxCellDelta(to: b))")
        #expect(abs(a.litFraction - b.litFraction) < 0.03, "litFraction unstable: \(a.litFraction) vs \(b.litFraction)")
    }

    // The #417 signature assertion the suite header promises: the soft-glow treatment
    // fades matter toward the field edge and wraps every core in a dim additive bloom
    // shell, so a large share of LIT pixels sit below core brightness. The solid-disc
    // renderer this replaced measured soft ≈ 0.34–0.37 on this scene; the glow treatment
    // measures ≈ 0.49–0.53 (spread over repeated unseeded runs) — 0.43 splits the two
    // with ~0.06 margin each side. The exact per-pixel bloom/cloud geometry is pinned
    // deterministically in FundamentalVanillaTests/SoftGlowRenderTests.
    @Test("dots read as soft glows — the dim bloom shell dominates the lit area (#417)")
    func dotsGlowIsSoft() throws {
        var scene = LabScenes.mass
        scene.render = .dots
        let sig = try Snapshotter.signature(scene: scene, options: opts())
        let soft = (sig.litFraction - sig.brightFraction) / max(sig.litFraction, 1e-6)
        #expect(soft > 0.43, "lit pixels are mostly core-bright — solid discs, no glow shell (soft share \(soft))")
    }

    // The accretion story end-to-end (#417): the source/sink scene runs the real engine
    // until the sink holds captured matter, and the render must stay coherent — the
    // orbital cloud draws as bounded dim content, never blown out, never blank.
    @Test("the accretion scene draws coherent, bounded content — captured matter included")
    func accretionSceneDrawsContent() throws {
        var scene = LabScenes.sourceSink
        scene.render = .dots
        let sig = try Snapshotter.signature(scene: scene, options: opts())
        #expect(sig.litFraction > 0.001, "accretion scene renders (almost) nothing — litFraction \(sig.litFraction)")
        #expect(sig.litFraction < 0.9, "accretion scene blows out the whole screen — litFraction \(sig.litFraction)")
        #expect(sig.centroidX > 0.05 && sig.centroidX < 0.95, "lit mass off-canvas in x: \(sig.centroidX)")
        #expect(sig.centroidY > 0.05 && sig.centroidY < 0.95, "lit mass off-canvas in y: \(sig.centroidY)")
    }
}
#endif
