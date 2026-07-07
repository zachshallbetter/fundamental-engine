//! The deterministic canonical forces — mirrors `packages/core/src/forces/index.ts` §6.
//!
//! The math is the exact per-frame implementation from `docs/engine-reference/forces-system.md`.
//! `env.vector` (`e.dx/e.dy/e.dz`) points from the particle toward the body; `env.dist ≥ 1`. On-state
//! (`body.engaged`) widens range and boosts strength per the spec.
//!
//! All of the canonical nine. Six are pure/deterministic (pinned by the cross-plane golden); the other
//! three reach the world through the [`Env`] seam — `jet` draws the RNG, `wall` emits a spark effect,
//! `sink` requests a capture the integrator resolves.

use crate::config::canonical_force_color;
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
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
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
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
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
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
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
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
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
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
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
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
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

/// §6.2 — a conduit: draws matter in, jets it out along the heading. Kinematic (relaunches at the
/// nozzle), and stochastic (the exit cone is drawn from `env.rng`).
pub struct Jet;

impl Force for Jet {
    fn token(&self) -> &'static str {
        "jet"
    }
    fn label(&self) -> &'static str {
        "Jet"
    }
    fn kinematic(&self) -> bool {
        true
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        let range = b.range * if b.engaged { 1.4 } else { 1.0 };
        if e.dist >= range {
            return;
        }
        if e.dist < 24.0 {
            // at the nozzle: relaunch as a hot jet, with a cone of spread.
            let sp = (e.rng() - 0.5) * 0.8;
            let (sn, cs) = sp.sin_cos();
            let hx = b.heading.x * cs - b.heading.y * sn;
            let hy = b.heading.x * sn + b.heading.y * cs;
            let spd = 2.4 + b.strength * 2.6;
            p.velocity.x = hx * spd;
            p.velocity.y = hy * spd;
            p.position.x = b.center.x + hx * 26.0;
            p.position.y = b.center.y + hy * 26.0;
            // the nozzle relaunches on the body plane (z-axis.md): z is reset like x/y.
            p.position.z = 0.0;
            p.velocity.z = 0.0;
            p.heat = p.heat.max(0.9);
        } else {
            // feed: draw surrounding matter toward the nozzle.
            let f = (1.0 - e.dist / range).powi(2) * (0.25 + b.strength * 0.15);
            p.velocity.x += (e.vector.x / e.dist) * f;
            p.velocity.y += (e.vector.y / e.dist) * f;
            if e.vector.z != 0.0 {
                p.velocity.z += (e.vector.z / e.dist) * f;
            }
        }
    }
}

/// §6.4 — an axis-aligned bouncing wall; sparks on hard impact. Kinematic (an elastic bounce reflects
/// velocity regardless of inertia). The impact throws a [`spark`](Env::spark) effect.
pub struct Wall;

impl Force for Wall {
    fn token(&self) -> &'static str {
        "wall"
    }
    fn label(&self) -> &'static str {
        "Wall"
    }
    fn kinematic(&self) -> bool {
        true
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        let pad = 6.0;
        let ox = (p.position.x - b.center.x).abs();
        let oy = (p.position.y - b.center.y).abs();
        let (hw, hh) = (b.half_extents.x, b.half_extents.y);
        if ox >= hw + pad || oy >= hh + pad {
            return;
        }
        let speed = p.velocity.x.hypot(p.velocity.y);
        let px = hw + pad - ox;
        let py = hh + pad - oy;
        if px < py {
            p.position.x = if p.position.x < b.center.x {
                b.center.x - hw - pad
            } else {
                b.center.x + hw + pad
            };
            p.velocity.x = -p.velocity.x * 0.85;
        } else {
            p.position.y = if p.position.y < b.center.y {
                b.center.y - hh - pad
            } else {
                b.center.y + hh + pad
            };
            p.velocity.y = -p.velocity.y * 0.85;
        }
        if speed > 0.7 {
            // spark in the wall's own tint when tagged (a tagged container throws its tag's sparks),
            // else the canonical wall hue.
            let color = b
                .tint
                .clone()
                .or_else(|| canonical_force_color("wall").map(String::from));
            e.spark(p.position, speed.min(2.4), color);
            p.heat = p.heat.max((speed * 0.4).min(0.85));
        }
    }
}

/// §6.9 — captures matter (held, conserved), then releases on saturation. Requests a capture through
/// the [`Env`] seam; the integrator holds the particle, increments the body, and releases at capacity.
pub struct Sink;

impl Force for Sink {
    fn token(&self) -> &'static str {
        "sink"
    }
    fn label(&self) -> &'static str {
        "Sink"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        if p.cap.is_some() || e.dist >= b.absorb_r {
            return;
        }
        e.request_capture();
    }
}
