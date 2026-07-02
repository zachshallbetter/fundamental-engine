import Testing
#if canImport(simd)
import simd
#else
import Foundation
#endif
@testable import FundamentalCore

// The soft-glow matter treatment (#417) — the pure sprite math both render backends
// share, pinned to the JS source (field.ts render()): at glow == 1 and depthHint == 0
// every number below is byte-for-byte the web engine's.

@Suite("ParticleSprite")
struct ParticleSpriteTests {

    // MARK: the sprite (size / alpha / bloom)

    @Test("at the anchor, cold: the JS base case — size unscaled, alpha 0.5, bloom +1.2 at 0.12×")
    func baseCase() {
        let s = particleSprite(size: 2, heat: 0, rs: 0)
        #expect(abs(s.size - 2) < 1e-6)
        #expect(abs(s.alpha - 0.5) < 1e-6)
        #expect(abs(s.bloomSize - 3.2) < 1e-6)
        #expect(abs(s.bloomAlpha - 0.06) < 1e-6)
    }

    @Test("at the field edge (rs = 1): size shrinks by 0.4, alpha fades to 0.2")
    func edgeRecession() {
        let s = particleSprite(size: 2, heat: 0, rs: 1)
        #expect(abs(s.size - 1.2) < 1e-6)   // 2 · (1 − 0.4)
        #expect(abs(s.alpha - 0.2) < 1e-6)  // 0.5 − 0.3
    }

    @Test("heat inflates (+2) and brightens (+0.5, clamped at 1)")
    func heatBloom() {
        let s = particleSprite(size: 2, heat: 1, rs: 0)
        #expect(abs(s.size - 4) < 1e-6)     // 2 + 1·2
        #expect(abs(s.alpha - 1) < 1e-6)    // clamp(0.5 + 0.5)
        #expect(abs(s.bloomSize - 5.2) < 1e-6)
        #expect(abs(s.bloomAlpha - 0.12) < 1e-6)
    }

    @Test("the glow dial scales ONLY the heat term — glow 0.5 halves heat's contribution")
    func glowDial() {
        let s = particleSprite(size: 2, heat: 1, rs: 0, glow: 0.5)
        #expect(abs(s.size - 3) < 1e-6)      // 2 + 1·2·0.5
        #expect(abs(s.alpha - 0.75) < 1e-6)  // 0.5 + 1·0.5·0.5
        // and glow leaves the cold sprite untouched
        let cold = particleSprite(size: 2, heat: 0, rs: 0, glow: 0)
        #expect(abs(cold.size - 2) < 1e-6)
        #expect(abs(cold.alpha - 0.5) < 1e-6)
    }

    @Test("depth recession: both size and alpha recede by the JS factor 0.55")
    func depthRecession() {
        let s = particleSprite(size: 2, heat: 0, rs: 0, depthHint: 1)
        #expect(abs(s.size - 0.9) < 1e-6)     // 2 · (1 − 0.55)
        #expect(abs(s.alpha - 0.225) < 1e-6)  // 0.5 · 0.45
        // flat host (depthHint 0) is the identity
        let flat = particleSprite(size: 2, heat: 0, rs: 0, depthHint: 0)
        #expect(abs(flat.size - 2) < 1e-6)
    }

    // MARK: the thermal anchor (rs)

    @Test("rs is 0 at the anchor (W/2, 0.4·H) and 1 at the farthest corner")
    func anchorGeometry() {
        #expect(particleRS(x: 500, y: 320, width: 1000, height: 800) == 0)
        // the farthest corners are the bottom ones: dist = hypot(500, 480) = maxD
        #expect(abs(particleRS(x: 0, y: 800, width: 1000, height: 800) - 1) < 1e-5)
        #expect(abs(particleRS(x: 1000, y: 800, width: 1000, height: 800) - 1) < 1e-5)
        // rs is normalized dist², so halfway out reads 0.25
        #expect(abs(particleRS(x: 500 + 250, y: 320 + 240, width: 1000, height: 800) - 0.25) < 1e-5)
    }

    @Test("rs clamps at 1 — nothing beyond the corner reach overshoots")
    func rsClamp() {
        #expect(particleRS(x: -500, y: -500, width: 1000, height: 800) == 1)
    }

    // MARK: the orbital cloud + pigment tint

    @Test("captured-cloud constants match the JS accretion draw (radius 1.3, alpha 0.55)")
    func capturedCloud() {
        #expect(CapturedCloud.radius == 1.3)
        #expect(CapturedCloud.alpha == 0.55)
    }

    @Test("stained matter blends 75% toward its pigment — never a full replacement")
    func pigmentTint() {
        let accent = RGB(77, 163, 255)
        let base = particleTint(rs: 0.5, heat: 0.5, accent: accent, stain: nil)
        let stain = RGB(255, 0, 0)
        let tinted = particleTint(rs: 0.5, heat: 0.5, accent: accent, stain: stain)
        let expected = base + (stain - base) * 0.75
        #expect(simd_length(tinted - expected) < 1e-4)
        #expect(simd_length(tinted - stain) > 1) // not a full replacement
    }
}
