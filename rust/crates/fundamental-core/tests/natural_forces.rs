//! Natural primitives: gravity/charge (inverse-square), magnetism (Lorentz rotation), thermal
//! (Langevin kick). Each test pins the force's defining physical property.

use fundamental_core::engine::{Body, Env, Force, Particle};
use fundamental_core::forces::{Charge, Gravity, Magnetism, Thermal};
use fundamental_core::math::Vec3;
use fundamental_core::Rng;

/// Env with the particle→body geometry set, as each force reads it.
fn env_toward_body(vector: Vec3, dist: f64) -> Env {
    Env {
        vector,
        dist,
        ..Env::default()
    }
}

fn charged(q: f64, velocity: Vec3) -> Particle {
    Particle {
        charge: q,
        velocity,
        ..Default::default()
    }
}

#[test]
fn gravity_attracts() {
    let b = Body {
        tokens: vec!["gravity".into()],
        ..Body::default()
    };
    let mut p = Particle::default();
    // body 100 to the −x side (vector points toward it).
    let mut e = env_toward_body(Vec3::new(-100.0, 0.0, 0.0), 100.0);
    Gravity.apply(&b, &mut p, &mut e);
    assert!(p.velocity.x < 0.0, "gravity pulls toward the body");
}

#[test]
fn charge_like_repels_opposite_attracts() {
    let b = Body {
        tokens: vec!["charge".into()],
        spin: 1.0, // positive source
        ..Body::default()
    };
    let vector = Vec3::new(-100.0, 0.0, 0.0); // body on the −x side

    let mut like = charged(1.0, Vec3::ZERO);
    let mut e = env_toward_body(vector, 100.0);
    Charge.apply(&b, &mut like, &mut e);
    assert!(
        like.velocity.x > 0.0,
        "like charge is pushed away from the body"
    );

    let mut opposite = charged(-1.0, Vec3::ZERO);
    let mut e = env_toward_body(vector, 100.0);
    Charge.apply(&b, &mut opposite, &mut e);
    assert!(
        opposite.velocity.x < 0.0,
        "opposite charge is pulled toward the body"
    );

    // neutral matter ignores charge fields entirely.
    let mut neutral = charged(0.0, Vec3::ZERO);
    let mut e = env_toward_body(vector, 100.0);
    Charge.apply(&b, &mut neutral, &mut e);
    assert_eq!(
        neutral.velocity,
        Vec3::ZERO,
        "neutral matter ignores charge"
    );
}

#[test]
fn magnetism_preserves_speed_and_needs_charge() {
    let b = Body {
        tokens: vec!["magnetism".into()],
        strength: 0.3,
        spin: 1.0,
        ..Body::default()
    };
    let v0 = Vec3::new(2.0, 1.0, 0.0);

    let mut p = charged(1.0, v0);
    let mut e = env_toward_body(Vec3::new(-100.0, 0.0, 0.0), 100.0);
    Magnetism.apply(&b, &mut p, &mut e);
    assert!(
        (p.velocity.length() - v0.length()).abs() < 1e-12,
        "the Lorentz curl preserves speed exactly"
    );
    assert_ne!(p.velocity, v0, "but it turns the heading");

    // neutral matter passes straight through.
    let mut neutral = charged(0.0, v0);
    let mut e = env_toward_body(Vec3::new(-100.0, 0.0, 0.0), 100.0);
    Magnetism.apply(&b, &mut neutral, &mut e);
    assert_eq!(neutral.velocity, v0, "no charge → no Lorentz force");
}

#[test]
fn thermal_is_deterministic_when_seeded_and_silent_when_cold() {
    let run = || {
        let b = Body {
            tokens: vec!["thermal".into()],
            strength: 1.0,
            ..Body::default()
        };
        let mut p = Particle::default();
        let mut e = Env {
            vector: Vec3::new(-100.0, 0.0, 0.0),
            dist: 100.0,
            rng: Rng::seeded(77),
            ..Env::default()
        };
        Thermal.apply(&b, &mut p, &mut e);
        p.velocity
    };
    let a = run();
    assert_ne!(a, Vec3::ZERO, "thermal agitates matter");
    assert_eq!(a, run(), "seeded, the kick is reproducible");

    // zero temperature → σ = 0 → no kick.
    let b = Body {
        tokens: vec!["thermal".into()],
        strength: 0.0,
        ..Body::default()
    };
    let mut p = Particle::default();
    let mut e = Env {
        vector: Vec3::new(-100.0, 0.0, 0.0),
        dist: 100.0,
        rng: Rng::seeded(77),
        ..Env::default()
    };
    Thermal.apply(&b, &mut p, &mut e);
    assert_eq!(p.velocity, Vec3::ZERO, "no temperature → no agitation");
}
