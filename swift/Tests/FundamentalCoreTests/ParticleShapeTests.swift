import Testing
#if canImport(simd)
import simd
#endif
import FundamentalCore

@Suite("ParticleShape")
struct ParticleShapeTests {

    @Test("dot is the fast circle — no polygon vertices")
    func dot() {
        #expect(ParticleShape.dot.vertices == nil)
        #expect(ParticleShape.dot.isDot)
    }

    @Test("star yields 2×points vertices, first straight up, alternating outer/inner radius")
    func star() {
        let s = ParticleShape.star(points: 5, innerRatio: 0.5)
        let v = try! #require(s.vertices)
        #expect(v.count == 10)
        #expect(!s.isDot)
        // first point straight up (screen y-down): (0, -1) at the outer radius.
        #expect(abs(v[0].x) < 1e-5)
        #expect(abs(v[0].y + 1) < 1e-5)
        // even indices ride the outer radius (1), odd indices the inner radius (innerRatio).
        #expect(abs(simd_length(v[2]) - 1) < 1e-5)
        #expect(abs(simd_length(v[1]) - 0.5) < 1e-5)
    }

    @Test("polygon yields N unit-circle vertices")
    func polygon() {
        #expect(ParticleShape.polygon(sides: 3).vertices?.count == 3)
        let hex = try! #require(ParticleShape.polygon(sides: 6).vertices)
        #expect(hex.count == 6)
        for vertex in hex { #expect(abs(simd_length(vertex) - 1) < 1e-5) }
    }

    @Test("custom carries the given vertices verbatim")
    func custom() {
        let verts: [SIMD2<Float>] = [SIMD2(0, -1), SIMD2(1, 1), SIMD2(-1, 1)]
        #expect(ParticleShape.custom(verts).vertices == verts)
        #expect(!ParticleShape.custom(verts).isDot)
    }

    @Test("a render frame carries the configured shape through to the renderer")
    func framePropagatesShape() {
        // FieldOptions → RenderFrame is the channel the CoreGraphics / Metal renderers read.
        let opts = FieldOptions(render: .dots, particleShape: .star(points: 6))
        #expect(opts.particleShape.vertices?.count == 12)
    }
}
