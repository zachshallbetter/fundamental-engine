//! Field geometry — the renderable/followable STRUCTURE a body radiates (#1041).
//!
//! Mirrors `packages/core/src/math/geometry.ts`. These are the formulas behind
//! [`Force::field`](crate::engine::Force::field): the same superposition a field-line diagram traces
//! and `fieldflow` follows, so the picture is the engine's real field rather than a hand-rolled
//! stand-in.
//!
//! A structure field is **not** a particle path. `apply()` is unchanged by any of this — a sideways
//! moving particle can orbit a gravity well rather than fall down its field line.

/// Floors the distance at a pole/core so a sample never divides by zero. JS `geometry.EPS`.
pub const EPS: f64 = 1.0;

/// A point source: position and signed strength.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Pole {
    pub x: f64,
    pub y: f64,
    pub q: f64,
}

/// The two poles of a body's dipole, laid on its heading axis at the box edge.
///
/// The `+` (N) pole sits at the `+(ux, uy)` end and the `−` (S) pole at the other; `spin < 0` swaps
/// them. `reach` is the centre-to-edge distance along the heading, so a wide element makes a long
/// magnet and a tall one a short, fat one. Polarity and geometry only — strength is the consumer's.
pub fn pole_pair(cx: f64, cy: f64, ux: f64, uy: f64, hw: f64, hh: f64, spin: f64) -> [Pole; 2] {
    let tx = if ux != 0.0 { hw / ux.abs() } else { f64::INFINITY };
    let ty = if uy != 0.0 { hh / uy.abs() } else { f64::INFINITY };
    let reach = tx.min(ty); // centre → box edge along the heading
    let (ax, ay) = (ux * reach, uy * reach);
    let s = if spin < 0.0 { -1.0 } else { 1.0 };
    [
        Pole { x: cx + ax, y: cy + ay, q: s },
        Pole { x: cx - ax, y: cy - ay, q: -s },
    ]
}

/// The in-plane field of a set of poles: the superposition of each pole's radial `q/d²` monopole
/// (away from `+`, toward `−`). For a body's two poles this is the classic dipole, whose streamlines
/// are the bar-magnet (N→S) diagram.
pub fn dipole_field(poles: &[Pole], x: f64, y: f64) -> (f64, f64) {
    let (mut fx, mut fy) = (0.0, 0.0);
    for p in poles {
        let dx = x - p.x;
        let dy = y - p.y;
        let d = (dx * dx + dy * dy).sqrt().max(EPS);
        let k = p.q / (d * d); // radial monopole, 1/d² falloff
        fx += (dx / d) * k;
        fy += (dy / d) * k;
    }
    (fx, fy)
}

/// The radial monopole field of a single point charge: straight lines OUT of a `+` source
/// (`sign >= 0`) and IN to a `−`. `E = sgn·s·r̂/d²`.
pub fn monopole_field(cx: f64, cy: f64, sign: f64, s: f64, x: f64, y: f64) -> (f64, f64) {
    let dx = x - cx;
    let dy = y - cy;
    let d = (dx * dx + dy * dy).sqrt().max(EPS);
    let sgn = if sign < 0.0 { -1.0 } else { 1.0 };
    let mag = (sgn * s) / (d * d); // 1/d², signed by polarity
    ((dx / d) * mag, (dy / d) * mag)
}

/// The inward radial gravitational field: `g = M·r̂/d²`, always TOWARD the mass.
pub fn gravity_field(cx: f64, cy: f64, mass: f64, x: f64, y: f64) -> (f64, f64) {
    let dx = cx - x; // toward the body — gravity attracts
    let dy = cy - y;
    let d = (dx * dx + dy * dy).sqrt().max(EPS);
    let mag = mass / (d * d);
    ((dx / d) * mag, (dy / d) * mag)
}
