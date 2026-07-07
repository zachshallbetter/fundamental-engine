//! Natural primitives (§20.10) — real field laws, mirrors `packages/core/src/forces/natural.ts`.
//!
//! Where the canonical nine are *designed* (finite range, soft `(1 − d/d_max)ⁿ` falloff), these are
//! *natural*: a true softened inverse-square law in the sim unit system. `gravity` and `charge` are the
//! **same kernel** — only the source scalar differs (mass ≥ 0 vs. signed charge). Opt-in: a body only
//! feels them via its tokens, so registering them changes nothing on a body that doesn't ask.
//!
//! Ported here: the four that read only the per-particle `env` (`gravity`, `charge`, `magnetism`,
//! `thermal`). Deferred with their subsystems: `collide` (neighbour query), `diffuse` / `propagate` /
//! `memory` (scalar grid). The renderable `field()` structure hooks (dipole/monopole) land with the
//! field-line/streamline layer.

use crate::engine::{Body, Env, Force, Particle};
use std::f64::consts::PI;

/// Clamp a particle's speed to the unit system's `c` — the hard velocity cap that IS the in-sim speed
/// of light (§20.10). Shared by the natural primitives.
fn clamp_to_c(p: &mut Particle, c: f64) {
    let sp = p.velocity.length();
    if sp > c {
        p.velocity = p.velocity * (c / sp);
    }
}

/// The shared softened inverse-square kernel (§20.10): `s / (d² + ε²)` along the unit vector toward the
/// body, then clamp to `c`. Plummer softening `ε = r_s = 2GM/c²` keeps the force finite at the core
/// while staying a true `1/d²` law far out. `s` is the signed source strength.
fn inverse_square(b: &Body, p: &mut Particle, e: &Env, s: f64) {
    if e.dist >= b.range {
        return; // practical cutoff radius
    }
    let rs = (2.0 * e.g * b.source_mass) / (e.c * e.c); // Schwarzschild radius → softening ε
    let f = s / (e.dist * e.dist + rs * rs);
    p.velocity.x += (e.vector.x / e.dist) * f;
    p.velocity.y += (e.vector.y / e.dist) * f;
    if e.vector.z != 0.0 {
        p.velocity.z += (e.vector.z / e.dist) * f;
    }
    clamp_to_c(p, e.c);
}

/// The Langevin noise amplitude `σ = √(2·k_B·T·γ)`; in sim units `k_B = γ = 1`, so `σ = √(2T)`.
pub fn thermal_sigma(t: f64) -> f64 {
    (2.0 * t.max(0.0)).sqrt()
}

/// §20.10 — true softened inverse-square: `F = GM·d̂/(d²+ε²)`, always attractive.
pub struct Gravity;

impl Force for Gravity {
    fn token(&self) -> &'static str {
        "gravity"
    }
    fn label(&self) -> &'static str {
        "Gravity"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        inverse_square(b, p, e, e.g * b.source_mass); // GM, mass-sourced (M ≥ 0 → pulls in)
    }
}

/// §20.3/§20.10 — the signed sibling of gravity; same kernel, sign sets direction (like repels,
/// opposite attracts). Acts only on charged matter.
pub struct Charge;

impl Force for Charge {
    fn token(&self) -> &'static str {
        "charge"
    }
    fn label(&self) -> &'static str {
        "Charge"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        let q = p.charge;
        if q == 0.0 {
            return; // neutral matter ignores charge fields
        }
        // F = σ·q·GM/(d²+ε²); negated for the inward-pointing kernel so like signs repel.
        inverse_square(b, p, e, -(b.spin * q * e.g * b.source_mass));
    }
}

/// §20.10 — the Lorentz force on a moving charge: a rotation perpendicular to velocity (a cyclotron
/// curl) that preserves speed exactly. Acts only on charged, *moving* matter; the body's `spin` sets
/// the out-of-plane sense, `strength` is `|B|`, graded by a `(1 − d/r)` falloff.
pub struct Magnetism;

impl Force for Magnetism {
    fn token(&self) -> &'static str {
        "magnetism"
    }
    fn label(&self) -> &'static str {
        "Magnetism"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        if e.dist >= b.range {
            return;
        }
        let q = p.charge;
        if q == 0.0 {
            return; // the Lorentz force needs charge
        }
        // exact rotation by θ = q·spin·B·falloff — preserves |v| to floating-point precision.
        let falloff = 1.0 - e.dist / b.range;
        let theta = q * b.spin * b.strength * falloff;
        let (sn, cs) = theta.sin_cos();
        let vx0 = p.velocity.x;
        p.velocity.x = vx0 * cs - p.velocity.y * sn;
        p.velocity.y = vx0 * sn + p.velocity.y * cs;
    }
}

/// §20.10 — `thermal`: Langevin/Brownian agitation, the *honest* wander. A Gaussian kick `v += σ·ξ`
/// with `σ = √(2T)`, localized by a `(1 − d/d_max)` falloff. Box–Muller turns two uniforms (from the
/// seeded rng) into one isotropic kick, so a seeded thermal run is reproducible.
pub struct Thermal;

impl Force for Thermal {
    fn token(&self) -> &'static str {
        "thermal"
    }
    fn label(&self) -> &'static str {
        "Thermal"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        if e.dist >= b.range {
            return;
        }
        let falloff = 1.0 - e.dist / b.range;
        let sigma = thermal_sigma(b.strength * falloff);
        if sigma == 0.0 {
            return;
        }
        // Box–Muller from the injected rng — drawn in the same order as JS for cross-plane parity.
        let u1 = {
            let u = e.rng();
            if u == 0.0 {
                1e-9
            } else {
                u
            }
        }; // avoid log(0)
        let mag = sigma * (-2.0 * u1.ln()).sqrt();
        let ang = 2.0 * PI * e.rng();
        p.velocity.x += mag * ang.cos();
        p.velocity.y += mag * ang.sin();
        // in a depth > 0 volume the kick is isotropic in 3D — a third gaussian leg (z-axis.md).
        if e.volume.z > 0.0 {
            let u2 = {
                let u = e.rng();
                if u == 0.0 {
                    1e-9
                } else {
                    u
                }
            };
            p.velocity.z += sigma * (-2.0 * u2.ln()).sqrt() * (2.0 * PI * e.rng()).cos();
        }
        if b.engaged {
            p.heat = p.heat.max(falloff * 0.4);
        }
        clamp_to_c(p, e.c);
    }
}
