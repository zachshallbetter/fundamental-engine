//! The integrator modifier pass: `resonate` (pulses sibling strength) and `spotlight` (gates siblings
//! to a cone). Both are no-op forces on their own — their effect only shows through a sibling force.

use fundamental_core::engine::{step, Body, Env, FieldStore, Registry};
use fundamental_core::math::Vec3;

fn bounded_env(t: f64) -> Env {
    Env {
        volume: Vec3::new(800.0, 600.0, 0.0),
        t,
        ..Env::default()
    }
}

fn one_particle(x: f64, y: f64) -> FieldStore {
    let mut s = FieldStore::new();
    s.add(fundamental_core::engine::Particle {
        position: Vec3::new(x, y, 0.0),
        ..Default::default()
    });
    s
}

/// `resonate attract` breathes: at `sin(ωt) > 0` the well pulls harder than a bare attract; at
/// `sin(ωt) < 0` it pulls weaker. (ω = 3.)
#[test]
fn resonate_pulses_sibling_strength() {
    let reg = Registry::standard();
    let attract_body = || Body {
        tokens: vec!["attract".into()],
        range: 300.0,
        center: Vec3::new(400.0, 300.0, 0.0),
        ..Body::default()
    };
    let resonant_body = || Body {
        tokens: vec!["resonate".into(), "attract".into()],
        range: 300.0,
        spin: 1.0,
        center: Vec3::new(400.0, 300.0, 0.0),
        ..Body::default()
    };

    // pick t so sin(3t) is clearly positive (t = 0.5 → sin(1.5) ≈ 0.997).
    let pull = |body: Body, t: f64| {
        let mut env = bounded_env(t);
        let mut bodies = vec![body];
        let mut store = one_particle(250.0, 300.0);
        step(&mut store, &mut bodies, &mut env, &reg);
        store.particles[0].position.x - 250.0 // +ve = pulled toward the body at x=400
    };

    let plain = pull(attract_body(), 0.5);
    let boosted = pull(resonant_body(), 0.5);
    assert!(
        boosted > plain,
        "at sin(ωt)>0 resonate pulls harder: {boosted} vs {plain}"
    );

    // t = 1.5 → sin(4.5) ≈ −0.978 → weaker than plain.
    let plain2 = pull(attract_body(), 1.5);
    let damped = pull(resonant_body(), 1.5);
    assert!(
        damped < plain2,
        "at sin(ωt)<0 resonate pulls weaker: {damped} vs {plain2}"
    );
}

/// `spotlight stream` is a directed beam: matter inside the heading cone feels the stream; matter
/// behind the body (outside the cone) is gated out entirely.
#[test]
fn spotlight_gates_siblings_to_a_cone() {
    let reg = Registry::standard();
    let beam = || Body {
        tokens: vec!["spotlight".into(), "stream".into()],
        range: 400.0,
        heading: Vec3::new(1.0, 0.0, 0.0), // cone opens toward +x
        center: Vec3::new(400.0, 300.0, 0.0),
        ..Body::default()
    };

    // a particle on the +x side of the body is inside the cone → the stream acts.
    let mut env = bounded_env(0.0);
    let mut bodies = vec![beam()];
    let mut inside = one_particle(500.0, 300.0);
    step(&mut inside, &mut bodies, &mut env, &reg);
    assert!(
        inside.particles[0].velocity.length() > 0.0,
        "matter in the cone feels the beam"
    );

    // a particle on the −x side is outside the cone → gated, untouched.
    let mut env = bounded_env(0.0);
    let mut bodies = vec![beam()];
    let mut outside = one_particle(300.0, 300.0);
    step(&mut outside, &mut bodies, &mut env, &reg);
    assert_eq!(
        outside.particles[0].velocity,
        Vec3::ZERO,
        "matter behind the spotlight is gated out"
    );
}
