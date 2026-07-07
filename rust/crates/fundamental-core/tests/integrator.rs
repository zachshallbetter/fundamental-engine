//! Integrator behaviour + determinism. The cross-plane golden pins single-apply force math; this
//! pins the multi-step loop the CMS "solve to equilibrium" runs on.

use fundamental_core::engine::{step, Body, Env, FieldStore, Registry};
use fundamental_core::math::Vec3;

/// A field: a bounded env, the standard registry, one attract body at centre, one particle.
fn attract_body(center: Vec3, range: f64) -> Body {
    Body {
        tokens: vec!["attract".into()],
        range,
        feedback: true,
        center,
        ..Body::default()
    }
}

fn bounded_env() -> Env {
    Env {
        volume: Vec3::new(800.0, 600.0, 0.0),
        ..Env::default()
    }
}

fn particle_at(x: f64, y: f64) -> fundamental_core::engine::Particle {
    fundamental_core::engine::Particle {
        position: Vec3::new(x, y, 0.0),
        ..Default::default()
    }
}

/// Same inputs → byte-identical trajectory. The f64 engine is deterministic by construction; this is
/// the load-bearing property for snapshot/replay + Field Receipts.
#[test]
fn deterministic_across_runs() {
    let run = || {
        let reg = Registry::standard();
        let mut env = bounded_env();
        let mut bodies = vec![attract_body(Vec3::new(400.0, 300.0, 0.0), 300.0)];
        let mut store = FieldStore::new();
        store.add(particle_at(250.0, 320.0));
        store.add(particle_at(500.0, 280.0));
        for _ in 0..500 {
            step(&mut store, &mut bodies, &mut env, &reg);
        }
        store
            .particles
            .iter()
            .map(|p| p.position)
            .collect::<Vec<_>>()
    };
    let a = run();
    let b = run();
    assert_eq!(
        a, b,
        "identical inputs must yield a byte-identical trajectory"
    );
}

/// Attract is a well: a particle inside range settles closer to the body.
#[test]
fn attract_pulls_matter_in() {
    let reg = Registry::standard();
    let mut env = bounded_env();
    let center = Vec3::new(400.0, 300.0, 0.0);
    let mut bodies = vec![attract_body(center, 300.0)];
    let mut store = FieldStore::new();
    let start = Vec3::new(250.0, 300.0, 0.0); // dx = 150, well inside range
    store.add(fundamental_core::engine::Particle {
        position: start,
        ..Default::default()
    });

    let d0 = (center - start).length();
    for _ in 0..600 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    let d1 = (center - store.particles[0].position).length();
    assert!(
        d1 < d0 * 0.5,
        "attract should draw matter in: start {d0:.1} → end {d1:.1}"
    );
}

/// Repel carves a void: a particle inside range ends up farther from the body.
#[test]
fn repel_pushes_matter_out() {
    let reg = Registry::standard();
    let mut env = bounded_env();
    let center = Vec3::new(400.0, 300.0, 0.0);
    let mut bodies = vec![Body {
        tokens: vec!["repel".into()],
        range: 300.0,
        center,
        ..Body::default()
    }];
    let mut store = FieldStore::new();
    let start = Vec3::new(300.0, 300.0, 0.0); // dx = 100, inside range
    store.add(fundamental_core::engine::Particle {
        position: start,
        ..Default::default()
    });

    let d0 = (center - start).length();
    for _ in 0..200 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    let d1 = (center - store.particles[0].position).length();
    assert!(
        d1 > d0,
        "repel should push matter out: start {d0:.1} → end {d1:.1}"
    );
}

/// A feedback body accumulates density from nearby matter — the raw signal a "score" reads.
#[test]
fn feedback_body_accumulates_density() {
    let reg = Registry::standard();
    let mut env = bounded_env();
    let center = Vec3::new(400.0, 300.0, 0.0);
    let mut bodies = vec![attract_body(center, 300.0)]; // feedback = true, range*0.5 = 150
    let mut store = FieldStore::new();
    store.add(particle_at(400.0, 300.0)); // dist 0 → max contribution
    store.add(particle_at(320.0, 300.0)); // dist 80 < 150 → contributes
    store.add(particle_at(700.0, 300.0)); // dist 300 > 150 → no contribution

    step(&mut store, &mut bodies, &mut env, &reg);
    // two particles inside the density window, one at the centre (≈1) + one at 80/150 (≈0.47).
    assert!(
        bodies[0].count > 1.0,
        "count should reflect two nearby particles, got {}",
        bodies[0].count
    );
    assert!(
        bodies[0].count < 2.0,
        "count should exclude the far particle, got {}",
        bodies[0].count
    );
}

/// No composite may drive a particle past `c` (the speed cap, §20.10).
#[test]
fn speed_cap_holds() {
    let reg = Registry::standard();
    let mut env = bounded_env();
    let mut bodies: Vec<Body> = vec![];
    let mut store = FieldStore::new();
    // a particle launched far past c; the cap clamps to c before the damp.
    store.add(fundamental_core::engine::Particle {
        position: Vec3::new(400.0, 300.0, 0.0),
        velocity: Vec3::new(100.0, 0.0, 0.0),
        ..Default::default()
    });
    step(&mut store, &mut bodies, &mut env, &reg);
    let speed = store.particles[0].velocity.length();
    assert!(
        speed <= env.c + 1e-9,
        "speed {speed} must not exceed c = {}",
        env.c
    );
}

/// `dt = 0` freezes motion but still drains density counters (#967).
#[test]
fn frozen_field_holds_position_and_drains_density() {
    let reg = Registry::standard();
    let mut env = bounded_env();
    let center = Vec3::new(400.0, 300.0, 0.0);
    let mut bodies = vec![attract_body(center, 300.0)];
    bodies[0].count = 99.0; // stale value from a prior live frame
    let mut store = FieldStore::new();
    let start = Vec3::new(300.0, 300.0, 0.0);
    store.add(particle_at(300.0, 300.0));

    env.dt = 0.0;
    step(&mut store, &mut bodies, &mut env, &reg);
    assert_eq!(
        store.particles[0].position, start,
        "frozen field must not move matter"
    );
    assert_eq!(
        bodies[0].count, 0.0,
        "frozen field must still zero the stale density (#967)"
    );
}
