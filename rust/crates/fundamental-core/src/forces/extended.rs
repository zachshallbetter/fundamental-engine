//! Designed extended forces (§20.3) — mirrors `packages/core/src/forces/extended.ts`.
//!
//! Like the canonical nine these are *designed* (finite range, soft falloff), but opt-in enrichments.
//! Ported here: the class-\[A\] forces that act on a single particle from the per-frame `env`, needing no
//! neighbour/grid/field/modifier subsystem — `lens`, `gate`, `buoyancy`, `shear`, `crystallize`,
//! `wind`, `pigment`, `warp`.
//!
//! Deferred with their subsystems: neighbour query → `align`, `cohesion`, `pressure`, `link`, `hunt`;
//! scalar grid → (natural) `diffuse`/`propagate`/`memory`; integrator modifier pass → `resonate`,
//! `spotlight`, `screen`; source/scatter state → `spawn`, `morph`; net field-line hook → `fieldflow`.

use crate::engine::{Body, Env, Force, ForceModification, Particle};
use crate::math::{mix_hex, Vec3};

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

// ── class-[B] neighbour forces (§20.3, over the frame-start neighbour snapshot) ───────────────────

const COHESION_REST: f64 = 0.5; // cohesion r₀ as a fraction of r₁
const PRESSURE_REST: f64 = 0.5; // pressure rest density ρ₀
const LINK_REST: f64 = 0.35; // link rest length as a fraction of the bond radius

/// §20.3 — `align`: steer velocity toward the mean neighbour heading (boids alignment), preserving
/// speed; falls back to the body heading when alone. `strength` is the steer gain.
pub struct Align;

impl Force for Align {
    fn token(&self) -> &'static str {
        "align"
    }
    fn label(&self) -> &'static str {
        "Align"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        if e.dist >= b.range {
            return;
        }
        let speed = p.velocity.length(); // steer toward ĥ·|v| → turns without speeding up
        let k = b.strength;
        let (mut hx, mut hy, mut hz) = (b.heading.x, b.heading.y, 0.0); // [A] default: body heading
        let (mut sx, mut sy, mut sz) = (0.0, 0.0, 0.0);
        for n in e.neighbors(p.position, b.range) {
            let ns = n.vel.length();
            if ns > 1e-6 {
                sx += n.vel.x / ns; // sum the neighbours' unit velocities
                sy += n.vel.y / ns;
                sz += n.vel.z / ns;
            }
        }
        let sm = (sx * sx + sy * sy + sz * sz).sqrt();
        if sm > 1e-6 {
            hx = sx / sm; // [B]: the mean neighbour heading
            hy = sy / sm;
            hz = sz / sm;
        }
        p.velocity.x += (hx * speed - p.velocity.x) * k;
        p.velocity.y += (hy * speed - p.velocity.y) * k;
        if hz != 0.0 || p.velocity.z != 0.0 {
            p.velocity.z += (hz * speed - p.velocity.z) * k;
        }
    }
}

/// §20.3 — `cohesion`: short-range pressure + mid-range pull (surface tension). Around a rest distance
/// `r₀` each neighbour pushes `p` away when closer, draws it in when between `r₀` and the range `r₁`.
pub struct Cohesion;

impl Force for Cohesion {
    fn token(&self) -> &'static str {
        "cohesion"
    }
    fn label(&self) -> &'static str {
        "Cohesion"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        if e.dist >= b.range {
            return;
        }
        let r1 = b.range;
        let r0 = r1 * COHESION_REST;
        let k = b.strength;
        for n in e.neighbors(p.position, r1) {
            let delta = n.pos - p.position;
            let dn = delta.length();
            if dn < 1e-6 {
                continue; // self / coincident
            }
            let u = delta * (1.0 / dn);
            if dn < r0 {
                let f = (k * (r0 - dn)) / r0; // pressure: push apart
                p.velocity -= u * f;
            } else {
                let f = (k * (dn - r0)) / (r1 - r0); // cohesion: pull toward the skin
                p.velocity += u * f;
            }
        }
    }
}

/// §20.3 — `pressure`: SPH-style density relaxation → an incompressible even-fill. Each particle
/// estimates local density with a smooth kernel and pushes down the gradient when above a rest density.
pub struct Pressure;

impl Force for Pressure {
    fn token(&self) -> &'static str {
        "pressure"
    }
    fn label(&self) -> &'static str {
        "Pressure"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        if e.dist >= b.range {
            return;
        }
        let h = b.range;
        let k = b.strength;
        let ns = e.neighbors(p.position, h);
        // first pass: local density ρ = Σ (1 − d/h)²
        let mut rho = 0.0;
        for n in &ns {
            let d = (n.pos - p.position).length();
            if d < h {
                rho += (1.0 - d / h).powi(2);
            }
        }
        let over = rho - PRESSURE_REST;
        if over <= 0.0 {
            return; // under-dense → an even fill only relaxes crowding
        }
        // second pass: push away from each neighbour, weighted by how crowded the spot is
        for n in &ns {
            let delta = p.position - n.pos; // away-from-crowd direction
            let d = delta.length();
            if d < 1e-6 || d >= h {
                continue;
            }
            let f = (k * over * (1.0 - d / h)) / d;
            p.velocity += delta * f;
        }
    }
}

/// §20.3 — `link`: a Verlet distance constraint holding a rest length, so a dense blob ropes/drapes.
/// Each particle applies half the correction toward each partner; the partner does its half on its turn.
pub struct Link;

impl Force for Link {
    fn token(&self) -> &'static str {
        "link"
    }
    fn label(&self) -> &'static str {
        "Link"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        if e.dist >= b.range {
            return;
        }
        let r = b.range;
        let rest = r * LINK_REST;
        let k = b.strength;
        for n in e.neighbors(p.position, r) {
            let delta = n.pos - p.position;
            let d = delta.length();
            if d < 1e-6 {
                continue;
            }
            let err = d - rest; // +ve → too far (pull together); −ve → too close (push apart)
            let f = 0.5 * k * (err / rest); // half the Verlet correction
            p.velocity += delta * (f / d);
        }
    }
}

/// §20.3 — `hunt`: a two-species pursuit. Predators (species 0) accelerate toward the nearest particle
/// of another species; prey (species ≠ 0) flee the nearest predator. `strength` is the seek/flee gain.
pub struct Hunt;

impl Force for Hunt {
    fn token(&self) -> &'static str {
        "hunt"
    }
    fn label(&self) -> &'static str {
        "Hunt"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        if e.dist >= b.range {
            return;
        }
        let me = p.species;
        // the nearest neighbour of a *different* species — the target to chase or escape.
        let mut target: Option<Vec3> = None;
        let mut best_d2 = f64::INFINITY;
        for n in e.neighbors(p.position, b.range) {
            if n.species == me {
                continue;
            }
            let d2 = (n.pos - p.position).length_sq();
            if d2 < best_d2 {
                best_d2 = d2;
                target = Some(n.pos);
            }
        }
        let Some(t) = target else {
            return; // nothing of the other species in reach
        };
        let delta = t - p.position;
        let d = delta.length().max(1.0);
        let dir = if me == 0 { 1.0 } else { -1.0 }; // predator seeks, prey flees
        p.velocity += delta * (b.strength * dir / d);
    }
}

// ── modifiers (§20.3): no force of their own — they bend their sibling forces ──────────────────────

const RESONATE_OMEGA: f64 = 3.0;
const SPOTLIGHT_COS: f64 = 0.5; // cone half-angle ~60°

/// §20.3 — `resonate`: a modifier that pulses its sibling forces with a time-varying strength
/// `S(t) = S₀·(1 + sin(ω·t·spin))`, so e.g. `resonate attract` is a well that breathes.
pub struct Resonate;

impl Force for Resonate {
    fn token(&self) -> &'static str {
        "resonate"
    }
    fn label(&self) -> &'static str {
        "Resonate"
    }
    fn is_modifier(&self) -> bool {
        true
    }
    fn modify(&self, b: &Body, _p: &Particle, e: &Env) -> Option<ForceModification> {
        Some(ForceModification {
            strength: Some(1.0 + (e.t * RESONATE_OMEGA * b.spin).sin()),
            gate: false,
        })
    }
    fn apply(&self, _b: &Body, _p: &mut Particle, _e: &mut Env) {} // pure modifier
}

/// §20.3 — `spotlight`: a modifier that gates its sibling forces to an angular cone of the heading. A
/// particle outside the cone is skipped for every token on the body this frame — `spotlight stream` is
/// a directed beam.
pub struct Spotlight;

impl Force for Spotlight {
    fn token(&self) -> &'static str {
        "spotlight"
    }
    fn label(&self) -> &'static str {
        "Spotlight"
    }
    fn is_modifier(&self) -> bool {
        true
    }
    fn modify(&self, b: &Body, _p: &Particle, e: &Env) -> Option<ForceModification> {
        // body → particle (env.vector points particle → body, so negate).
        let dirx = -e.vector.x / e.dist;
        let diry = -e.vector.y / e.dist;
        Some(ForceModification {
            strength: None,
            gate: dirx * b.heading.x + diry * b.heading.y < SPOTLIGHT_COS,
        })
    }
    fn apply(&self, _b: &Body, _p: &mut Particle, _e: &mut Env) {} // pure modifier
}

/// workover v0.3 — `screen`: a quiet zone / shield (truth mode: designed).
///
/// The only **cross-body** modifier. `spotlight` and `resonate` bend their own body's siblings, so
/// they compose inside that body's token loop; `screen` damps *other* bodies' forces on matter inside
/// its range, which no per-body hook can express. Its `apply` and `modify` are therefore both no-ops —
/// the whole force lives in the integrator, which is the only place per-particle, per-body forces
/// compose. A screen never damps its own siblings.
pub struct Screen;

impl Force for Screen {
    fn token(&self) -> &'static str {
        "screen"
    }
    fn label(&self) -> &'static str {
        "Screen"
    }
    fn is_modifier(&self) -> bool {
        true
    }
    // No `modify`: this modifier acts on OTHER bodies, which the per-body hook cannot reach.
    fn apply(&self, _b: &Body, _p: &mut Particle, _e: &mut Env) {} // pure modifier
}

/// Fraction of velocity turned onto the line per frame (× gain).
const FIELDFLOW_STEER: f64 = 0.5;
/// Streaming acceleration along the line (× gain).
const FIELDFLOW_ACCEL: f64 = 0.12;

/// §20.3 — `fieldflow`: follow the field lines. Steer onto the local net field line and stream down
/// it — solar prominences, aurora, plasma streams, guided matter.
///
/// The one force that reads **existing field geometry** rather than sourcing its own: it consumes the
/// superposition of every radiating body ([`Env::field_here`]) and transports matter along it. That
/// makes it the consumer half of the structure-field hooks — `gravity`, `charge` and `magnetism`
/// radiate, `fieldflow` follows, and a field-line diagram traces the same function.
///
/// Two distinct motions, and the distinction matters: the STEER turns velocity onto the tangent
/// without spending it (speed-preserving, like `align`), while the STREAM accelerates along it and
/// therefore does work. `magnetism` carries only charged matter; `fieldflow` carries neutral matter
/// too, unless the opt-in charge gate says otherwise.
pub struct Fieldflow;

impl Force for Fieldflow {
    fn token(&self) -> &'static str {
        "fieldflow"
    }
    fn label(&self) -> &'static str {
        "Field Flow"
    }
    fn apply(&self, b: &Body, p: &mut Particle, e: &mut Env) {
        if b.range > 0.0 && e.dist >= b.range {
            return; // range 0 ⇒ global
        }
        // Opt-in charge gate (#711): the magnetized-plasma reading follows only charged matter.
        if b.charge_gated && p.charge == 0.0 {
            return;
        }
        let Some((fx, fy)) = e.field_here else {
            return; // nothing radiates — no line to follow
        };
        let mag = (fx * fx + fy * fy).sqrt();
        if !(mag > 1e-9) {
            return; // a true null point (or NaN) — no line here
        }
        // the field-line tangent, direction only: scale-free, so a faint dipole reads as clearly
        // as a strong monopole.
        let (ux, uy) = (fx / mag, fy / mag);
        let falloff = if b.range > 0.0 {
            1.0 - e.dist / b.range
        } else {
            1.0
        };
        let gain = b.strength * falloff;

        // 1) STEER onto the line — turn velocity toward the tangent without spending it.
        // The structure field is planar (bodies radiate in the page plane), so this also turns any
        // z velocity onto the in-plane line: matter funnels back toward the plane.
        let sp = (p.velocity.x * p.velocity.x
            + p.velocity.y * p.velocity.y
            + p.velocity.z * p.velocity.z)
            .sqrt();
        if sp > 1e-6 {
            let k = (gain * FIELDFLOW_STEER).min(1.0);
            p.velocity.x += (ux * sp - p.velocity.x) * k;
            p.velocity.y += (uy * sp - p.velocity.y) * k;
            if p.velocity.z != 0.0 {
                p.velocity.z += -p.velocity.z * k; // the line's z tangent is 0
            }
        }
        // 2) STREAM down the line — accelerate along it (the flare ejection; does work).
        p.velocity.x += ux * gain * FIELDFLOW_ACCEL;
        p.velocity.y += uy * gain * FIELDFLOW_ACCEL;

        // bound by the unit system's speed of light (§20.10), as gravity/thermal do.
        let s2 = p.velocity.x * p.velocity.x
            + p.velocity.y * p.velocity.y
            + p.velocity.z * p.velocity.z;
        if s2 > e.c * e.c {
            let inv = e.c / s2.sqrt();
            p.velocity.x *= inv;
            p.velocity.y *= inv;
            p.velocity.z *= inv;
        }
        if b.engaged {
            p.heat = p.heat.max(falloff * 0.4);
        }
    }
}
