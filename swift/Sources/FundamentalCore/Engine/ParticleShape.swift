import Foundation // cos/sin — from Darwin on Apple, Glibc on Linux (the simd shim doesn't provide them)
#if canImport(simd)
import simd
#endif

/// How a particle is drawn — a vector shape the renderer stamps at each particle's position, scaled by
/// its (physics-driven) size and heat. The default `.dot` keeps the fast batched-circle path; every
/// other shape is a unit polygon (origin-centred, radius ≤ 1) the renderer transforms per particle.
///
/// Renderer-agnostic data: the core only carries the vertices — each plane's renderer (CoreGraphics,
/// Metal, canvas, WebGL) draws them. Because the renderer scales the shape by each particle's `size`
/// and `heat`, the appearance still rides the physics: a hot particle is a bigger, brighter star.
///
/// ```swift
/// FieldView(options: .init(render: .dots, particleShape: .star(points: 5)))
/// // or a custom vector:  .custom([SIMD2(0, -1), SIMD2(1, 1), SIMD2(-1, 1)])  // a triangle
/// ```
public struct ParticleShape: Equatable, Sendable {
    /// Unit vertices in `[-1, 1]` (origin-centred), filled in order — or `nil` for the built-in circle
    /// (`.dot`), the fast batched path renderers keep accelerated.
    public let vertices: [SIMD2<Float>]?

    public init(vertices: [SIMD2<Float>]?) { self.vertices = vertices }

    /// The default soft circle — the fast batched path (Metal-accelerated where available).
    public static let dot = ParticleShape(vertices: nil)

    /// An N-pointed star. `innerRatio` ∈ (0, 1] sets the waist depth (0.5 = a classic five-point star).
    public static func star(points: Int = 5, innerRatio: Float = 0.5) -> ParticleShape {
        let n = max(2, points)
        let inner = min(max(innerRatio, 0.01), 1)
        var v = [SIMD2<Float>]()
        v.reserveCapacity(n * 2)
        for i in 0..<(n * 2) {
            let r = i.isMultiple(of: 2) ? Float(1) : inner
            let a = Float(i) * .pi / Float(n) - .pi / 2 // first point straight up
            v.append(SIMD2(cos(a) * r, sin(a) * r))
        }
        return ParticleShape(vertices: v)
    }

    /// A regular polygon — triangle (3), square (4), hexagon (6)… `rotation` in degrees.
    public static func polygon(sides: Int, rotation: Float = 0) -> ParticleShape {
        let n = max(3, sides)
        let rot = rotation * .pi / 180
        var v = [SIMD2<Float>]()
        v.reserveCapacity(n)
        for i in 0..<n {
            let a = Float(i) * 2 * .pi / Float(n) - .pi / 2 + rot
            v.append(SIMD2(cos(a), sin(a)))
        }
        return ParticleShape(vertices: v)
    }

    /// Any custom vector shape — your own unit vertices in `[-1, 1]` (origin-centred), filled in order.
    public static func custom(_ vertices: [SIMD2<Float>]) -> ParticleShape {
        ParticleShape(vertices: vertices)
    }

    /// Whether this is the fast built-in circle (no polygon path).
    public var isDot: Bool { vertices == nil }
}
