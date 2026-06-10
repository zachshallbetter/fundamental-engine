import Foundation
import simd

// MARK: - Primitive aliases

/// The physics vector throughout the engine. 3D-native: on 2D platforms z=0.
public typealias Vec3 = SIMD3<Float>

/// An RGB triple ∈ [0,255].
public typealias RGB = SIMD3<Float>

// MARK: - Scalar helpers

@inline(__always)
public func clamp(_ v: Float, _ lo: Float, _ hi: Float) -> Float {
    v < lo ? lo : v > hi ? hi : v
}

@inline(__always)
public func lerp(_ a: Float, _ b: Float, _ t: Float) -> Float {
    a + (b - a) * t
}

// MARK: - Color

/// Cool (resting) particle color (§20.8).
public let COOL: RGB = RGB(200, 224, 255)
/// Warm (energized) particle color (§20.8).
public let WARM: RGB = RGB(255, 122, 69)
/// Fallback accent blue.
public let DEFAULT_ACCENT: RGB = RGB(77, 163, 255)

/// Parse `#rrggbb` or `#rgb` → RGB, falling back to the default blue.
public func hexToRgb(_ hex: String) -> RGB {
    var h = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
    if h.count == 3 {
        h = h.flatMap { [String($0), String($0)] }.joined()
    }
    guard h.count >= 6, let n = UInt32(h.prefix(6), radix: 16) else {
        return DEFAULT_ACCENT
    }
    return RGB(
        Float((n >> 16) & 0xFF),
        Float((n >>  8) & 0xFF),
        Float( n        & 0xFF)
    )
}

/// RGB → `#rrggbb`.
public func rgbToHex(_ c: RGB) -> String {
    func h(_ v: Float) -> String {
        String(format: "%02x", Int(clamp(v.rounded(), 0, 255)))
    }
    return "#\(h(c.x))\(h(c.y))\(h(c.z))"
}

/// Free-particle color: cool→warm by `rs` (normalized dist²), blended toward `accent` by `heat`.
public func particleRGB(rs: Float, heat: Float, accent: RGB) -> RGB {
    var c = COOL + (WARM - COOL) * rs
    c += (accent - c) * heat
    return c
}

/// Lerp two hex colors by `t` ∈ [0,1].
public func mixHex(_ a: String, _ b: String, t: Float) -> String {
    let ca = hexToRgb(a)
    let cb = hexToRgb(b)
    let k = clamp(t, 0, 1)
    return rgbToHex(ca + (cb - ca) * k)
}

/// Sample a color ramp at `frac` ∈ [0,1].
public func sampleStops(_ stops: [RGB], frac: Float) -> RGB {
    guard !stops.isEmpty else { return DEFAULT_ACCENT }
    if stops.count == 1 { return stops[0] }
    let f = clamp(frac, 0, 1) * Float(stops.count - 1)
    let i = min(stops.count - 2, Int(f))
    let t = f - Float(i)
    return stops[i] + (stops[i + 1] - stops[i]) * t
}

/// Screen attenuation factor (workover v0.3 §"`screen` modifier").
public func screenFactor(d: Float, range: Float, strength: Float, min floor: Float = 0) -> Float {
    guard range > 0 else { return 1 }
    let fall = max(0, 1 - d / range)
    let factor = 1 - strength * fall * fall
    let f = clamp(floor, 0, 1)
    return clamp(factor, f, 1)
}
