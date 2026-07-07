//! Designed extended forces (§20.3) — mirrors `packages/core/src/forces/extended.ts`.
//!
//! Like the canonical nine these are *designed* (finite range, soft falloff), but opt-in enrichments.
//! Ported here: the class-[A] forces that act on a single particle from the per-frame `env`, needing no
//! neighbour/grid/field/modifier subsystem — `lens`, `gate`, `buoyancy`, `shear`, `crystallize`,
//! `wind`, `pigment`, `warp`.
//!
//! Deferred with their subsystems: neighbour query → `align`, `cohesion`, `pressure`, `link`, `hunt`;
//! scalar grid → (natural) `diffuse`/`propagate`/`memory`; integrator modifier pass → `resonate`,
//! `spotlight`, `screen`; source/scatter state → `spawn`, `morph`; net field-line hook → `fieldflow`.

use crate::engine::{Body, Env, Force, Particle};
use crate::math::mix_hex;

const FREEZE: f64 = 0.5; // heat below which crystallize solidifies matter
const LATTICE: f64 = 32.0; // crystallize lattice cell, px
const WIND_SCALE: f64 = 0.01;

/// A smooth divergence-free flow field (§20.3) — the curl of a sinusoidal stream function. Closed-form
/// (no RNG) → deterministic. `s` is the spatial scale of the eddies.
pub fn curl_noise(x: f64, y: f64, t: f64, s: f64) -> (f64, f64) {
    let a = x * s + t * 0.2;
    let b = y * s - t * 0.2;
    (-s * a.sin() * b.sin(), -s * a.cos() * b.cos())
}

/// §20.3 — `lens`: rotate the velocity, preserving its magnitude — bends a path without adding energy.
pub struct Lens;

impl Force for Lens {
    fn token(&self) -> &'static str {
        "lens"
    }
    fn label(&self) -> &'static str {
        "Lens"
    }
    fn kinematic(&self) -> bool {
        true
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        if e.dist >= b.range {
            return;
        }
        let theta = b.strength * (1.0 - e.dist / b.range) * b.spin;
        let (sn, cs) = theta.sin_cos();
        let (vx, vy) = (p.velocity.x, p.velocity.y);
        p.velocity.x = vx * cs - vy * sn; // rotate(v, θ) — speed conserved exactly
        p.velocity.y = vx * sn + vy * cs;
    }
}

/// §20.3 — `gate`: a one-way membrane. Matter passes freely along the heading; wrong-way crossers
/// (`v·n < 0`) are reflected across it. Sized by the body box (like `wall`).
pub struct Gate;

impl Force for Gate {
    fn token(&self) -> &'static str {
        "gate"
    }
    fn label(&self) -> &'static str {
        "Gate"
    }
    fn kinematic(&self) -> bool {
        true
    }
    fn apply(&self, b: &Body, p: &mut Particle, _e: &mut Env) {
        let pad = 6.0;
        if (p.position.x - b.center.x).abs() >= b.half_extents.x + pad
            || (p.position.y - b.center.y).abs() >= b.half_extents.y + pad
        {
            return;
        }
        let vn = p.velocity.x * b.heading.x + p.velocity.y * b.heading.y;
        if vn < 0.0 {
            p.velocity.x -= 2.0 * vn * b.heading.x; // reflect back through n
            p.velocity.y -= 2.0 * vn * b.heading.y;
        }
    }
}

/// §20.3 — `buoyancy`: a constant lift/sink by density difference. Hot/large matter is lighter than the
/// medium and rises (`−y`); denser matter settles (`+y`). `range = 0` ⇒ global.
pub struct Buoyancy;

impl Force for Buoyancy {
    fn token(&self) -> &'static str {
        "buoyancy"
    }
    fn label(&self) -> &'static str {
        "Buoyancy"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        if b.range > 0.0 && e.dist >= b.range {
            return;
        }
        const BASE: f64 = 1.0;
        const MEDIUM: f64 = 1.0;
        let rho_p = BASE / (p.size * (1.0 + p.heat)); // hotter / bigger → lighter
        p.velocity.y -= (MEDIUM - rho_p) * b.strength; // lift up when lighter than the medium
    }
}

/// §20.3 — `shear`: a laminar velocity gradient (Couette flow). Speed along the flow axis grows with a
/// particle's perpendicular offset from the body — laminae sliding past each other.
pub struct Shear;

impl Force for Shear {
    fn token(&self) -> &'static str {
        "shear"
    }
    fn label(&self) -> &'static str {
        "Shear"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        if e.dist >= b.range {
            return;
        }
        // perpendicular axis is (−uy, ux); offset_⊥ = (p − centre) · perp
        let offset_perp =
            (p.position.x - b.center.x) * -b.heading.y + (p.position.y - b.center.y) * b.heading.x;
        let f = b.strength * (offset_perp / b.range) * (1.0 - e.dist / b.range);
        p.velocity.x += b.heading.x * f; // accelerate along the flow axis
        p.velocity.y += b.heading.y * f;
    }
}

/// §20.3 — `crystallize`: a phase change. Cool matter (`heat < FREEZE`) snaps toward the nearest node
/// of a lattice anchored at the body and damps into a solid; hot matter melts and moves freely.
pub struct Crystallize;

impl Force for Crystallize {
    fn token(&self) -> &'static str {
        "crystallize"
    }
    fn label(&self) -> &'static str {
        "Crystallize"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        if e.dist >= b.range || p.heat >= FREEZE {
            return; // out of range or melted → free
        }
        let node_x = b.center.x + ((p.position.x - b.center.x) / LATTICE).round() * LATTICE;
        let node_y = b.center.y + ((p.position.y - b.center.y) / LATTICE).round() * LATTICE;
        p.velocity.x += (node_x - p.position.x) * b.strength; // pull toward the lattice node
        p.velocity.y += (node_y - p.position.y) * b.strength;
        p.velocity.x *= 0.9; // damp → settle into the solid
        p.velocity.y *= 0.9;
    }
}

/// §20.3 — `wind`: divergence-free curl-noise turbulence. `range = 0` ⇒ a global gust.
pub struct Wind;

impl Force for Wind {
    fn token(&self) -> &'static str {
        "wind"
    }
    fn label(&self) -> &'static str {
        "Wind"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        if b.range > 0.0 && e.dist >= b.range {
            return;
        }
        let (cx, cy) = curl_noise(p.position.x, p.position.y, e.t, WIND_SCALE);
        p.velocity.x += cx * b.strength;
        p.velocity.y += cy * b.strength;
    }
}

/// §20.8 — `pigment`: conserved colour transport. Matter overlapping a pigment body takes on its tint
/// and carries it away — the section *stains* the field. Inert without a tint.
pub struct Pigment;

impl Force for Pigment {
    fn token(&self) -> &'static str {
        "pigment"
    }
    fn label(&self) -> &'static str {
        "Pigment"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        let tint = match &b.tint {
            Some(t) => t,
            None => return,
        };
        if e.dist >= b.range * 0.6 {
            return; // only stains on overlap
        }
        p.color = Some(match &p.color {
            Some(c) => mix_hex(c, tint, 0.08), // adopt, then advect toward
            None => tint.clone(),
        });
    }
}

/// §22.3 — `warp`: a wormhole throat. Matter entering the throat (within `absorb_r`) is *relocated*
/// (conserved) to the paired body's throat, emerging just outside it, offset + velocity rotated by
/// `twist` and scaled by `warp_scale`. No-ops until the engine resolves the pairing (`warp_has`).
pub struct Warp;

impl Force for Warp {
    fn token(&self) -> &'static str {
        "warp"
    }
    fn label(&self) -> &'static str {
        "Warp"
    }
    fn kinematic(&self) -> bool {
        true
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        if !b.warp_has || p.cap.is_some() {
            return;
        }
        let throat = b.absorb_r;
        if e.dist >= throat {
            return;
        }
        let (sn, cs) = b.twist.sin_cos();
        let k = b.warp_scale;
        // entry direction (unit local offset; e.vector points toward the body), twisted
        let ux = -e.vector.x / e.dist;
        let uy = -e.vector.y / e.dist;
        let rux = ux * cs - uy * sn;
        let ruy = ux * sn + uy * cs;
        // emerge just outside the paired throat so it does not immediately re-enter
        let out_r = throat * k + 6.0;
        p.position.x = b.warp_target.x + rux * out_r;
        p.position.y = b.warp_target.y + ruy * out_r;
        if p.position.z != 0.0 {
            p.position.z = (-e.vector.z / e.dist) * out_r;
        }
        // carry momentum through, rotated by the same twist (speed conserved)
        let (vx, vy) = (p.velocity.x, p.velocity.y);
        p.velocity.x = vx * cs - vy * sn;
        p.velocity.y = vx * sn + vy * cs;
        p.heat = p.heat.max(0.6);
    }
}
