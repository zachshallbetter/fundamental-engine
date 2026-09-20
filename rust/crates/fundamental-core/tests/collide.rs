//! §20.10 `collide` — elastic pairwise collision (#1037).
//!
//! The one class-[B] force that must move its NEIGHBOUR as well as its own particle. Driven through
//! the full `step()` path on purpose: the neighbour's half of the exchange travels as an
//! `Effect::Impulse` that only the integrator applies, so a test that called `Collide.apply` directly
//! would assert on half a collision and pass while the other half went nowhere.

use fundamental_core::engine::integrator::FRICTION;
use fundamental_core::engine::{step, Body, Env, FieldStore, Particle, Registry};
use fundamental_core::math::Vec3;

/// A collide body covering the whole field. `strength` is the restitution.
fn collide_body(restitution: f64) -> Body {
    Body {
        tokens: vec!["collide".into()],
        range: 10_000.0,
        strength: restitution,
        center: Vec3::new(400.0, 300.0, 0.0),
        ..Body::default()
    }
}

fn unbounded_env() -> Env {
    // volume 0 ⇒ no toroidal wrap, so positions stay readable across a step.
    Env::default()
}

fn moving(x: f64, y: f64, vx: f64) -> Particle {
    Particle {
        position: Vec3::new(x, y, 0.0),
        velocity: Vec3::new(vx, 0.0, 0.0),
        size: 4.0,
        ..Default::default()
    }
}

/// One step over a two-particle pool; returns their velocities after.
fn one_step(a: Particle, b: Particle, restitution: f64) -> (Vec3, Vec3) {
    let reg = Registry::standard();
    let mut env = unbounded_env();
    let mut bodies = vec![collide_body(restitution)];
    let mut store = FieldStore::new();
    let ida = store.add(a);
    let idb = store.add(b);
    step(&mut store, &mut bodies, &mut env, &reg);
    let va = store.particles.iter().find(|p| p.id == ida).unwrap().velocity;
    let vb = store.particles.iter().find(|p| p.id == idb).unwrap().velocity;
    (va, vb)
}

#[test]
fn head_on_elastic_collision_exchanges_velocity() {
    // Two equal spheres, closing head-on, restitution 1: they swap normal velocity.
    let (va, vb) = one_step(moving(100.0, 300.0, 10.0), moving(105.0, 300.0, -10.0), 1.0);
    assert!(
        (va.x - -10.0 * FRICTION).abs() < 1e-9,
        "the left particle rebounds: {va:?}"
    );
    assert!(
        (vb.x - 10.0 * FRICTION).abs() < 1e-9,
        "the right particle rebounds: {vb:?}"
    );
}

#[test]
fn momentum_is_conserved_at_every_restitution() {
    // The property that makes the impulse pair equal-and-opposite rather than merely plausible.
    for r in [0.0, 0.25, 0.5, 1.0] {
        let before = 10.0 + -4.0;
        let (va, vb) = one_step(moving(100.0, 300.0, 10.0), moving(105.0, 300.0, -4.0), r);
        let after = (va.x + vb.x) / FRICTION;
        assert!(
            (after - before).abs() < 1e-9,
            "restitution {r}: momentum {before} → {after}"
        );
    }
}

#[test]
fn a_fully_inelastic_pair_ends_with_no_relative_normal_velocity() {
    let (va, vb) = one_step(moving(100.0, 300.0, 10.0), moving(105.0, 300.0, -4.0), 0.0);
    assert!(
        (va.x - vb.x).abs() < 1e-9,
        "restitution 0 leaves the pair moving together: {va:?} vs {vb:?}"
    );
}

#[test]
fn a_separating_pair_is_never_impulsed() {
    // Overlapping but already moving apart — the guard that stops collide from gluing matter together.
    let (va, vb) = one_step(moving(100.0, 300.0, -10.0), moving(105.0, 300.0, 10.0), 1.0);
    assert!((va.x - -10.0 * FRICTION).abs() < 1e-9, "left unchanged: {va:?}");
    assert!((vb.x - 10.0 * FRICTION).abs() < 1e-9, "right unchanged: {vb:?}");
}

#[test]
fn particles_out_of_contact_do_not_collide() {
    // 40 apart, radii 4 + 4 — inside the query radius but not touching.
    let (va, vb) = one_step(moving(100.0, 300.0, 10.0), moving(140.0, 300.0, -10.0), 1.0);
    assert!((va.x - 10.0 * FRICTION).abs() < 1e-9, "left unchanged: {va:?}");
    assert!((vb.x - -10.0 * FRICTION).abs() < 1e-9, "right unchanged: {vb:?}");
}

#[test]
fn the_pair_is_resolved_exactly_once() {
    // The failure the id gate exists to prevent. Both particles read a frame-start snapshot, so both
    // see an approaching pair; without the gate each would apply the exchange and the pair would
    // separate at TWICE the correct speed. Elastic head-on at ±10 must come back at ∓10, not ∓30.
    let (va, vb) = one_step(moving(100.0, 300.0, 10.0), moving(105.0, 300.0, -10.0), 1.0);
    let closing_before = 20.0;
    let separating_after = (vb.x - va.x) / FRICTION;
    assert!(
        (separating_after - closing_before).abs() < 1e-9,
        "one resolution, not two: closing {closing_before} → separating {separating_after}"
    );
}

#[test]
fn the_result_is_independent_of_pool_order() {
    // The guarantee the snapshot + id gate buys, and which the JS engine does not have: the outcome
    // must not depend on which particle the integrator happens to visit first.
    let forward = one_step(moving(100.0, 300.0, 10.0), moving(105.0, 300.0, -4.0), 0.7);
    let reversed = one_step(moving(105.0, 300.0, -4.0), moving(100.0, 300.0, 10.0), 0.7);
    assert!(
        (forward.0.x - reversed.1.x).abs() < 1e-12 && (forward.1.x - reversed.0.x).abs() < 1e-12,
        "same physics either way: {forward:?} vs {reversed:?}"
    );
}

#[test]
fn collisions_resolve_in_three_dimensions() {
    let reg = Registry::standard();
    let mut env = unbounded_env();
    let mut bodies = vec![collide_body(1.0)];
    let mut store = FieldStore::new();
    let a = store.add(Particle {
        position: Vec3::new(100.0, 300.0, 0.0),
        velocity: Vec3::new(0.0, 0.0, 6.0),
        size: 4.0,
        ..Default::default()
    });
    let b = store.add(Particle {
        position: Vec3::new(100.0, 300.0, 5.0),
        velocity: Vec3::new(0.0, 0.0, -6.0),
        size: 4.0,
        ..Default::default()
    });
    step(&mut store, &mut bodies, &mut env, &reg);
    let va = store.particles.iter().find(|p| p.id == a).unwrap().velocity;
    let vb = store.particles.iter().find(|p| p.id == b).unwrap().velocity;
    assert!(va.z < 0.0 && vb.z > 0.0, "they rebound along z: {va:?} {vb:?}");
    assert!(
        ((va.z + vb.z) / FRICTION).abs() < 1e-9,
        "z momentum conserved: {va:?} {vb:?}"
    );
}
