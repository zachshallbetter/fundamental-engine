//! `solve(until_settled)` — step to equilibrium (#1042). The CMS entry point: a rebuild wants the
//! settled answer, not frames, and wants the same answer every time.

use fundamental_core::engine::{solve, step, Body, Env, FieldStore, Particle, Registry, SolveOptions};
use fundamental_core::math::Vec3;

fn attract_body(range: f64) -> Body {
    Body {
        tokens: vec!["attract".into()],
        range,
        center: Vec3::new(400.0, 300.0, 0.0),
        ..Body::default()
    }
}

/// A `thermal` body draws the rng every step, so the field is perpetually stirred and never settles.
fn thermal_body() -> Body {
    Body {
        tokens: vec!["thermal".into()],
        range: 10_000.0,
        strength: 5.0,
        center: Vec3::new(400.0, 300.0, 0.0),
        ..Body::default()
    }
}

fn bounded_env() -> Env {
    Env {
        volume: Vec3::new(800.0, 600.0, 0.0),
        ..Env::default()
    }
}

fn particle_at(x: f64, y: f64) -> Particle {
    Particle {
        position: Vec3::new(x, y, 0.0),
        ..Default::default()
    }
}

fn field(bodies: Vec<Body>) -> (FieldStore, Vec<Body>, Env, Registry) {
    let mut store = FieldStore::new();
    store.add(particle_at(250.0, 320.0));
    store.add(particle_at(500.0, 280.0));
    store.add(particle_at(420.0, 150.0));
    (store, bodies, bounded_env(), Registry::standard())
}

#[test]
fn an_attract_field_converges_and_reports_settled() {
    let (mut store, mut bodies, mut env, reg) = field(vec![attract_body(300.0)]);
    let r = solve(
        &mut store,
        &mut bodies,
        &mut env,
        &reg,
        SolveOptions::default(),
    );
    assert!(r.settled, "an attract well reaches equilibrium: {r:?}");
    assert!(
        r.iterations < SolveOptions::default().max_iters,
        "it settled before the cap, not at it: {r:?}"
    );
}

#[test]
fn a_perpetually_stirred_field_hits_the_cap_and_says_so() {
    // The honesty case. `thermal` injects a fresh random kick every step, so |Δv| never decays to the
    // threshold. `solve` must report that rather than return a fixed point it never found.
    let (mut store, mut bodies, mut env, reg) = field(vec![thermal_body()]);
    let opts = SolveOptions {
        max_iters: 500,
        ..SolveOptions::default()
    };
    let r = solve(&mut store, &mut bodies, &mut env, &reg, opts);
    assert!(!r.settled, "a stirred field never settles: {r:?}");
    assert_eq!(r.iterations, 500, "it ran to the cap: {r:?}");
}

#[test]
fn identical_inputs_give_an_identical_iteration_count() {
    // Determinism at the level a receipt quotes: not just the same positions, the same amount of work.
    let run = || {
        let (mut store, mut bodies, mut env, reg) = field(vec![attract_body(300.0)]);
        solve(
            &mut store,
            &mut bodies,
            &mut env,
            &reg,
            SolveOptions::default(),
        )
    };
    assert_eq!(run(), run(), "same inputs → same iterations and same verdict");
}

#[test]
fn a_frozen_field_never_settles() {
    // dt == 0 freezes the integrator (§18), so no velocity ever changes. A naive convergence check
    // would call that instant equilibrium; it is the opposite — the field never ran at all.
    let (mut store, mut bodies, mut env, reg) = field(vec![attract_body(300.0)]);
    env.dt = 0.0;
    let r = solve(
        &mut store,
        &mut bodies,
        &mut env,
        &reg,
        SolveOptions::default(),
    );
    assert!(!r.settled, "a frozen field is not a settled one: {r:?}");
    assert_eq!(r.iterations, 0, "and it ran no steps: {r:?}");
}

#[test]
fn an_empty_pool_settles_immediately() {
    let mut store = FieldStore::new();
    let mut bodies = vec![attract_body(300.0)];
    let mut env = bounded_env();
    let reg = Registry::standard();
    let r = solve(
        &mut store,
        &mut bodies,
        &mut env,
        &reg,
        SolveOptions::default(),
    );
    assert!(r.settled && r.iterations == 1, "no matter is the fixed point: {r:?}");
}

#[test]
fn a_tighter_epsilon_costs_more_iterations() {
    // Guards the threshold actually being consulted — a `solve` that ignored epsilon would return the
    // same count for both.
    let count = |epsilon: f64| {
        let (mut store, mut bodies, mut env, reg) = field(vec![attract_body(300.0)]);
        solve(
            &mut store,
            &mut bodies,
            &mut env,
            &reg,
            SolveOptions {
                epsilon,
                ..SolveOptions::default()
            },
        )
        .iterations
    };
    let loose = count(1e-3);
    let tight = count(1e-9);
    assert!(tight > loose, "tighter tolerance takes longer: {loose} vs {tight}");
}

#[test]
fn solve_matches_stepping_the_same_number_of_times() {
    // `solve` must be exactly `step` in a loop — no extra step, no skipped one, no hidden state. If
    // these diverge, a receipt's "this took N steps" does not describe a reproducible trajectory.
    let (mut a_store, mut a_bodies, mut a_env, reg) = field(vec![attract_body(300.0)]);
    let r = solve(
        &mut a_store,
        &mut a_bodies,
        &mut a_env,
        &reg,
        SolveOptions::default(),
    );

    let (mut b_store, mut b_bodies, mut b_env, reg2) = field(vec![attract_body(300.0)]);
    for _ in 0..r.iterations {
        step(&mut b_store, &mut b_bodies, &mut b_env, &reg2);
    }

    for (x, y) in a_store.particles.iter().zip(b_store.particles.iter()) {
        assert_eq!(x.position, y.position, "same trajectory as the manual loop");
        assert_eq!(x.velocity, y.velocity, "same velocity as the manual loop");
    }
}
