//! Hex ↔ RGB colour helpers — mirrors the colour section of `packages/core/src/math/math.ts`
//! (and the Swift `Math.swift`). Used by `pigment` (conserved colour transport, §20.8).

use super::{clamp, Vec3};

/// Fallback accent blue (RGB ∈ [0,255]).
pub const DEFAULT_ACCENT: Vec3 = Vec3::new(77.0, 163.0, 255.0);

/// Parse `#rrggbb` or `#rgb` → RGB, falling back to [`DEFAULT_ACCENT`].
pub fn hex_to_rgb(hex: &str) -> Vec3 {
    let h = hex.strip_prefix('#').unwrap_or(hex);
    // expand shorthand `#rgb` → `rrggbb`
    let expanded: String = if h.len() == 3 {
        h.chars().flat_map(|c| [c, c]).collect()
    } else {
        h.to_string()
    };
    if expanded.len() >= 6 {
        if let Ok(n) = u32::from_str_radix(&expanded[..6], 16) {
            return Vec3::new(
                ((n >> 16) & 0xFF) as f64,
                ((n >> 8) & 0xFF) as f64,
                (n & 0xFF) as f64,
            );
        }
    }
    DEFAULT_ACCENT
}

/// RGB → `#rrggbb`.
pub fn rgb_to_hex(c: Vec3) -> String {
    let ch = |v: f64| clamp(v.round(), 0.0, 255.0) as u8;
    format!("#{:02x}{:02x}{:02x}", ch(c.x), ch(c.y), ch(c.z))
}

/// Lerp two hex colours by `t ∈ [0,1]`.
pub fn mix_hex(a: &str, b: &str, t: f64) -> String {
    let ca = hex_to_rgb(a);
    let cb = hex_to_rgb(b);
    let k = clamp(t, 0.0, 1.0);
    rgb_to_hex(ca + (cb - ca) * k)
}
