//! Scalar + vector math. Mirrors `packages/core/src/math` and `swift/.../Math`.

mod vec3;
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
