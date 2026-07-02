#if canImport(QuartzCore) && os(macOS)
import Testing
import CoreGraphics
import QuartzCore
import simd
import FundamentalCore
@testable import FundamentalVanilla

// Deterministic pixel proof of the soft-glow matter treatment (#417) — no engine, no
// unseeded wander: a hand-placed RenderFrame rasterized through the REAL CoreGraphics
// surface, sampled at known offsets. This is what pins "no solid discs":
//   · a free particle has a dim bloom shell OUTSIDE its core radius (a solid disc has
//     nothing there), visibly softer than the core;
//   · captured matter draws as the small dim orbital cloud regardless of its own
//     size/heat — a hot size-5 particle held by a sink still reads as a 1.3px dot.

@Suite("SoftGlowRender")
struct SoftGlowRenderTests {

    private let W = 240
    private let H = 160
    /// Snapshotter's dark field background (#0b0e14) — luminance ≈ 0.054.
    private let bg: (r: CGFloat, g: CGFloat, b: CGFloat) = (0.043, 0.055, 0.078)

    /// Rasterize one frame through FieldSurfaceLayer onto the dark background and
    /// return per-pixel luminance (row-major, y-down — layer coordinates).
    private func raster(_ frame: RenderFrame) throws -> [Float] {
        let layer = FieldSurfaceLayer()
        layer.frameData = frame
        layer.frame = CGRect(x: 0, y: 0, width: W, height: H)
        guard let ctx = CGContext(
            data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { throw NSError(domain: "SoftGlowRenderTests", code: 1) }
        ctx.setFillColor(CGColor(red: bg.r, green: bg.g, blue: bg.b, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
        ctx.translateBy(x: 0, y: CGFloat(H)) // CALayer is y-down, CG is y-up
        ctx.scaleBy(x: 1, y: -1)
        layer.draw(in: ctx)
        guard let raw = ctx.data else { throw NSError(domain: "SoftGlowRenderTests", code: 2) }
        let ptr = raw.bindMemory(to: UInt8.self, capacity: ctx.bytesPerRow * H)
        let bpr = ctx.bytesPerRow
        var lum = [Float](repeating: 0, count: W * H)
        for y in 0..<H {
            for x in 0..<W {
                let o = y * bpr + x * 4
                lum[y * W + x] = (0.299 * Float(ptr[o]) + 0.587 * Float(ptr[o + 1]) + 0.114 * Float(ptr[o + 2])) / 255
            }
        }
        return lum
    }

    /// Luminance ABOVE the background at a pixel.
    private func delta(_ lum: [Float], _ x: Int, _ y: Int) -> Float {
        let bgLum = Float(0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b)
        return lum[y * W + x] - bgLum
    }

    @Test("a free particle draws as a soft glow — bright core, dim bloom shell, nothing beyond")
    func freeParticleGlows() throws {
        // size 4 at (60,64): rs ≈ 0.152 → core radius ≈ 3.76, bloom radius ≈ 4.96.
        let p = Particle(position: Vec3(60, 64, 0), heat: 0, size: 4)
        let frame = RenderFrame(particles: [p], bodies: [], accent: DEFAULT_ACCENT,
                                mode: .dots, projection: FlatProjection(),
                                volume: FieldVolume(width: Float(W), height: Float(H)))
        let lum = try raster(frame)
        let core = delta(lum, 60, 64)        // centre: bloom + core sum additively
        let shell = delta(lum, 64, 64)       // r = 4.0 — outside the core, inside the bloom
        let outside = delta(lum, 68, 64)     // r = 8.0 — beyond the bloom
        #expect(core > 0.3, "core should be bright — delta \(core)")
        #expect(shell > 0.02, "no bloom shell outside the core — a solid disc? delta \(shell)")
        #expect(shell < core * 0.5, "the shell should read visibly softer than the core — \(shell) vs \(core)")
        #expect(outside < 0.012, "light beyond the bloom radius — delta \(outside)")
    }

    @Test("captured matter draws as the dim orbital cloud — small and fixed, whatever its size/heat")
    func capturedDrawsAsOrbitalCloud() throws {
        let sink = Body(tokens: ["sink"])   // cap is weak — keep the body alive
        let p = Particle(position: Vec3(180, 64, 0), heat: 1, size: 5)
        p.cap = sink
        let frame = RenderFrame(particles: [p], bodies: [sink], accent: DEFAULT_ACCENT,
                                mode: .dots, projection: FlatProjection(),
                                volume: FieldVolume(width: Float(W), height: Float(H)))
        let lum = try raster(frame)
        let dot = delta(lum, 180, 64)
        let past = delta(lum, 183, 64)  // r = 3 — a free hot size-5 particle would cover this; the cloud must not
        #expect(dot > 0.15, "the orbital-cloud dot should be visible — delta \(dot)")
        #expect(past < 0.012, "captured matter drew at free-particle size — the cloud treatment was skipped (delta \(past))")
        withExtendedLifetime(sink) {}
    }

    @Test("trails mode holds captured matter as the cloud too — never a streak")
    func trailsKeepTheCloud() throws {
        let sink = Body(tokens: ["sink"])
        let p = Particle(position: Vec3(120, 80, 0), velocity: Vec3(12, 0, 0), heat: 1, size: 5)
        p.cap = sink
        let frame = RenderFrame(particles: [p], bodies: [sink], accent: DEFAULT_ACCENT,
                                mode: .trails, projection: FlatProjection(),
                                volume: FieldVolume(width: Float(W), height: Float(H)))
        let lum = try raster(frame)
        #expect(delta(lum, 120, 80) > 0.15, "the cloud dot should be visible in trails")
        // the streak tail would sit ~72px behind (velocity·6); the cloud leaves it dark
        #expect(delta(lum, 84, 80) < 0.012, "captured matter streaked — it is held, not free")
        withExtendedLifetime(sink) {}
    }
}
#endif
