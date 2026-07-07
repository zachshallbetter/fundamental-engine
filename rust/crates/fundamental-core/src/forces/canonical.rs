//! The deterministic canonical forces — mirrors `packages/core/src/forces/index.ts` §6.
//!
//! The math is the exact per-frame implementation from `docs/engine-reference/forces-system.md`.
//! `env.vector` (`e.dx/e.dy/e.dz`) points from the particle toward the body; `env.dist ≥ 1`. On-state
//! (`body.engaged`) widens range and boosts strength per the spec.
//!
//! Six of the canonical nine are here — the pure, deterministic ones the cross-plane golden pins.
//! The other three are stochastic or stateful and land with their services:
//!   - `jet`  — RNG cone (needs `env.rng`)
//!   - `wall` — emits sparks (needs `env.spark`)
//!   - `sink` — mutates the body + triggers supernova (needs `env.supernova`)

use crate::engine::{Body, Env, Force, Particle};

/// §6.1 — a soft gravity-like well, with optional orbital swirl.
pub struct Attract;

impl Force for Attract {
    fn token(&self) -> &'static str {
        "attract"
    }
    fn label(&self) -> &'static str {
        "Attract"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &Env) {
        let range = b.range * if b.engaged { 1.5 } else { 1.0 };
        let s = b.strength * if b.engaged { 3.0 } else { 1.0 };
        if e.dist >= range {
            return;
        }
        let f = (1.0 - e.dist / range).powi(2) * s * 0.5;
        let ux = e.vector.x / e.dist;
        let uy = e.vector.y / e.dist;
        p.velocity.x += ux * f;
        p.velocity.y += uy * f;
        if e.vector.z != 0.0 {
            p.velocity.z += (e.vector.z / e.dist) * f;
        }
        if e.form.orbit != 0.0 {
            p.velocity.x += -uy * f * e.form.orbit; // tangential swirl → orbits (about z)
            p.velocity.y += ux * f * e.form.orbit;
        }
        if b.engaged {
            p.heat = p.heat.max((1.0 - e.dist / range) * 0.9);
        }
    }
}

/// §6.6 — inverse-square outward push; carves a void.
pub struct Repel;

impl Force for Repel {
    fn token(&self) -> &'static str {
        "repel"
    }
    fn label(&self) -> &'static str {
        "Repel"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &Env) {
        let range = b.range * if b.engaged { 1.4 } else { 1.0 };
        let s = b.strength * if b.engaged { 2.0 } else { 1.0 };
        if e.dist >= range {
            return;
        }
        let f = (1.0 - e.dist / range).powi(2) * s * 0.5;
        p.velocity.x -= (e.vector.x / e.dist) * f;
        p.velocity.y -= (e.vector.y / e.dist) * f;
        if e.vector.z != 0.0 {
            p.velocity.z -= (e.vector.z / e.dist) * f;
        }
    }
}

/// §6.8 — tangential swirl with light inward retention.
pub struct Swirl;

impl Force for Swirl {
    fn token(&self) -> &'static str {
        "swirl"
    }
    fn label(&self) -> &'static str {
        "Swirl"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &Env) {
        let range = b.range * if b.engaged { 1.4 } else { 1.0 };
        let s = b.strength * if b.engaged { 2.0 } else { 1.0 };
        if e.dist >= range {
            return;
        }
        let f = (1.0 - e.dist / range).powf(1.4) * s * 0.45;
        let spin = b.spin;
        let ux = e.vector.x / e.dist;
        let uy = e.vector.y / e.dist;
        // tangential swirl (dominates ~8×) with a light inward retention (0.12).
        p.velocity.x += uy * f * spin + ux * f * 0.12;
        p.velocity.y += -ux * f * spin + uy * f * 0.12;
        if e.vector.z != 0.0 {
            p.velocity.z += (e.vector.z / e.dist) * f * 0.12;
        }
        if b.engaged {
            p.heat = p.heat.max((1.0 - e.dist / range) * 0.6);
        }
    }
}

/// §6.5 — a steady directional current along the heading.
pub struct Stream;

impl Force for Stream {
    fn token(&self) -> &'static str {
        "stream"
    }
    fn label(&self) -> &'static str {
        "Stream"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &Env) {
        let range = b.range * if b.engaged { 1.4 } else { 1.0 };
        let s = b.strength * if b.engaged { 2.0 } else { 1.0 };
        if e.dist >= range {
            return;
        }
        let f = (1.0 - e.dist / range).powf(1.1) * s * 0.5;
        p.velocity.x += b.heading.x * f;
        p.velocity.y += b.heading.y * f;
        if b.engaged {
            p.heat = p.heat.max((1.0 - e.dist / range) * 0.5);
        }
    }
}

/// §6.7 — viscosity; bleeds momentum, no redirection.
pub struct Viscosity;

impl Force for Viscosity {
    fn token(&self) -> &'static str {
        "viscosity"
    }
    fn label(&self) -> &'static str {
        "Viscosity"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &Env) {
        let range = b.range * if b.engaged { 1.4 } else { 1.0 };
        if e.dist >= range {
            return;
        }
        let k =
            (1.0 - e.dist / range) * (0.05 + b.strength * 0.07) * if b.engaged { 1.6 } else { 1.0 };
        p.velocity.x -= p.velocity.x * k;
        p.velocity.y -= p.velocity.y * k;
        if p.velocity.z != 0.0 {
            p.velocity.z -= p.velocity.z * k; // the medium thickens in all three axes
        }
    }
}

/// §6.3 — a tether with a rest length; holds matter at a shell radius.
pub struct Tether;

impl Force for Tether {
    fn token(&self) -> &'static str {
        "tether"
    }
    fn label(&self) -> &'static str {
        "Tether"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &Env) {
        let rest = b.range * 0.6 * if b.engaged { 1.25 } else { 1.0 };
        let reach = rest * 2.1;
        if e.dist >= reach {
            return;
        }
        let k = (0.006 + b.strength * 0.012) * if b.engaged { 1.7 } else { 1.0 };
        let stretch = e.dist - rest;
        let ux = e.vector.x / e.dist;
        let uy = e.vector.y / e.dist;
        p.velocity.x += ux * stretch * k;
        p.velocity.y += uy * stretch * k;
        if e.vector.z != 0.0 {
            p.velocity.z += (e.vector.z / e.dist) * stretch * k; // the shell is spherical
        }
        p.velocity.x *= 0.985;
        p.velocity.y *= 0.985;
        if p.velocity.z != 0.0 {
            p.velocity.z *= 0.985;
        }
        if b.engaged {
            p.heat = p.heat.max((1.0 - (stretch.abs() / rest).min(1.0)) * 0.5);
        }
    }
}
