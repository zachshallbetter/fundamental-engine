//! Scalar + vector math. Mirrors `packages/core/src/math` and `swift/.../Math`.

mod color;
mod vec3;
pub use color::{hex_to_rgb, mix_hex, rgb_to_hex, DEFAULT_ACCENT};
pub use vec3::Vec3;

/// Clamp `v` into `[lo, hi]`.
#[inline]
pub fn clamp(v: f64, lo: f64, hi: f64) -> f64 {
    if v < lo {
        lo
    } else if v > hi {
        hi
    } else {
        v
    }
}

/// Linear interpolation `a → b` by `t`.
#[inline]
pub fn lerp(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}

/// The `screen` quiet-zone attenuation (workover v0.3) — mirrors JS `screenFactor` and the Swift
/// `screenFactor`.
///
/// `clamp(1 − S·(1 − d/r)², min, 1)`: a quadratic falloff that is 1 at the rim (no attenuation) and
/// `1 − S` at the core, floored at `min`. `range <= 0` is not "global" here — a screen with no radius
/// shields nothing, so it returns 1.
#[inline]
pub fn screen_factor(d: f64, range: f64, strength: f64, min: f64) -> f64 {
    if !(range > 0.0) {
        return 1.0;
    }
    let fall = (1.0 - d / range).max(0.0);
    let factor = 1.0 - strength * fall * fall;
    let floor = clamp(min, 0.0, 1.0);
    clamp(factor, floor, 1.0)
}
