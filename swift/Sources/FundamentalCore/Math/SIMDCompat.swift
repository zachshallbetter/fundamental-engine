// SIMDCompat — Linux shims for the Apple `simd` module.
//
// FundamentalCore is platform-free except for Apple's `simd` (the Accelerate-backed helpers). On a
// non-Apple Swift toolchain (Linux) the SIMD *types* — `SIMD2<Float>`, `SIMD3<Float>` — come from
// the standard library, but the `simd_*` free functions and `simd_quatf` do not. These shims
// provide exactly the surface the engine uses, so the pure core builds and its tests run on Linux.
//
// Apple builds compile this file to nothing (`canImport(simd)` is true) and use the real,
// vectorized implementations. The shims are scalar-simple on purpose: correctness over speed, on
// a platform where this package renders nothing anyway (it's the engine, headless).
#if !canImport(simd)
import Foundation

@inline(__always)
func simd_dot<V: SIMD>(_ a: V, _ b: V) -> V.Scalar where V.Scalar: FloatingPoint {
    let p = a * b
    var s = V.Scalar.zero
    for i in 0..<p.scalarCount { s += p[i] }
    return s
}

@inline(__always)
func simd_length_squared<V: SIMD>(_ v: V) -> V.Scalar where V.Scalar: FloatingPoint {
    simd_dot(v, v)
}

@inline(__always)
func simd_length<V: SIMD>(_ v: V) -> V.Scalar where V.Scalar: FloatingPoint {
    simd_length_squared(v).squareRoot()
}

@inline(__always)
func simd_distance<V: SIMD>(_ a: V, _ b: V) -> V.Scalar where V.Scalar: FloatingPoint {
    simd_length(a - b)
}

@inline(__always)
func simd_normalize<V: SIMD>(_ v: V) -> V where V.Scalar: FloatingPoint {
    let len = simd_length(v)
    return len > 0 ? v / len : v
}

@inline(__always)
func simd_abs(_ v: SIMD3<Float>) -> SIMD3<Float> {
    SIMD3<Float>(abs(v.x), abs(v.y), abs(v.z))
}

@inline(__always)
func simd_clamp(_ v: SIMD3<Float>, _ lo: SIMD3<Float>, _ hi: SIMD3<Float>) -> SIMD3<Float> {
    SIMD3<Float>(min(max(v.x, lo.x), hi.x),
                 min(max(v.y, lo.y), hi.y),
                 min(max(v.z, lo.z), hi.z))
}

@inline(__always)
func simd_max(_ a: SIMD3<Float>, _ b: SIMD3<Float>) -> SIMD3<Float> {
    SIMD3<Float>(max(a.x, b.x), max(a.y, b.y), max(a.z, b.z))
}

@inline(__always)
func simd_cross(_ a: SIMD3<Float>, _ b: SIMD3<Float>) -> SIMD3<Float> {
    SIMD3<Float>(a.y * b.z - a.z * b.y,
                 a.z * b.x - a.x * b.z,
                 a.x * b.y - a.y * b.x)
}

/// A minimal unit quaternion — the engine builds these as `simd_quatf(angle:axis:)` and applies
/// them with `.act(_:)` to rotate a vector. Matches Apple's `simd_quatf` for those two operations.
struct simd_quatf {
    var ix: Float, iy: Float, iz: Float, r: Float

    init(angle: Float, axis: SIMD3<Float>) {
        let half = angle / 2
        let s = sin(half)
        let a = simd_normalize(axis)
        ix = a.x * s; iy = a.y * s; iz = a.z * s; r = cos(half)
    }

    /// v' = v + 2r(q×v) + 2(q×(q×v)) — the standard quaternion-vector rotation.
    func act(_ v: SIMD3<Float>) -> SIMD3<Float> {
        let q = SIMD3<Float>(ix, iy, iz)
        let t = 2 * simd_cross(q, v)
        return v + r * t + simd_cross(q, t)
    }
}
#endif
