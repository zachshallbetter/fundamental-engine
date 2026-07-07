//! Class-[B] neighbour forces (align/cohesion/pressure/link/hunt) + the spatial-hash query. Each
//! populates a frame-start neighbourhood snapshot directly, then applies the force to a target particle.

use fundamental_core::engine::spatial_hash::Neighborhood;
use fundamental_core::engine::{step, Body, Env, FieldStore, Force, Particle, Registry};
use fundamental_core::forces::{Align, Cohesion, Hunt, Link, Pressure};
use fundamental_core::math::Vec3;

fn body(token: &str, range: f64, strength: f64) -> Body {
    Body {
        tokens: vec![token.into()],
        range,
        strength,
        center: Vec3::new(400.0, 300.0, 0.0),
        ..Body::default()
    }
}

/// An env whose neighbourhood snapshot holds `neighbors`, with the body-geometry scratch inside range.
fn env_with_neighbors(neighbors: &[Particle]) -> Env {
    let mut e = Env {
        vector: Vec3::new(-1.0, 0.0, 0.0),
        dist: 1.0, // inside any positive range
        ..Env::default()
    };
    e.neighborhood.rebuild(neighbors);
    e
}

fn at(x: f64, y: f64) -> Particle {
    Particle {
        position: Vec3::new(x, y, 0.0),
        ..Default::default()
    }
}

fn moving(x: f64, y: f64, v: Vec3) -> Particle {
    Particle {
        position: Vec3::new(x, y, 0.0),
        velocity: v,
        ..Default::default()
    }
}

// ── spatial hash ─────────────────────────────────────────────────────────────

#[test]
fn neighborhood_returns_only_points_within_radius() {
    let pts = [at(0.0, 0.0), at(30.0, 0.0), at(100.0, 0.0), at(0.0, 200.0)];
    let mut n = Neighborhood::default();
    n.rebuild(&pts);
    let near = n.near(Vec3::ZERO, 50.0);
    assert_eq!(near.len(), 2, "only the two within 50 of origin");
    assert!(near.iter().all(|s| (s.pos).length() <= 50.0));
}

// ── cohesion: pressure near, pull far ─────────────────────────────────────────

#[test]
fn cohesion_pushes_close_pulls_far() {
    let b = body("cohesion", 100.0, 1.0); // r0 = 50

    // a neighbour closer than r0 pushes p away.
    let mut p = at(400.0, 300.0);
    let mut e = env_with_neighbors(&[at(430.0, 300.0)]); // d = 30 < 50
    Cohesion.apply(&b, &mut p, &mut e);
    assert!(p.velocity.x < 0.0, "too-close neighbour pushes p apart");

    // a neighbour between r0 and r1 pulls p in.
    let mut p = at(400.0, 300.0);
    let mut e = env_with_neighbors(&[at(470.0, 300.0)]); // d = 70, r0 < 70 < r1
    Cohesion.apply(&b, &mut p, &mut e);
    assert!(p.velocity.x > 0.0, "mid-range neighbour pulls p toward it");
}

// ── link: hold the rest length ────────────────────────────────────────────────

#[test]
fn link_holds_rest_length() {
    let b = body("link", 100.0, 1.0); // rest = 35

    let mut p = at(400.0, 300.0);
    let mut e = env_with_neighbors(&[at(470.0, 300.0)]); // d = 70 > rest → pull together
    Link.apply(&b, &mut p, &mut e);
    assert!(
        p.velocity.x > 0.0,
        "an over-stretched bond pulls partners together"
    );

    let mut p = at(400.0, 300.0);
    let mut e = env_with_neighbors(&[at(420.0, 300.0)]); // d = 20 < rest → push apart
    Link.apply(&b, &mut p, &mut e);
    assert!(
        p.velocity.x < 0.0,
        "a compressed bond pushes partners apart"
    );
}

// ── hunt: predators seek, prey flee ───────────────────────────────────────────

#[test]
fn hunt_predator_seeks_prey_flees() {
    let b = body("hunt", 200.0, 1.0);
    let prey = Particle {
        species: 1,
        ..at(430.0, 300.0)
    };
    let predator = Particle {
        species: 0,
        ..at(430.0, 300.0)
    };

    // predator (species 0) accelerates toward the prey.
    let mut pred = Particle {
        species: 0,
        ..at(400.0, 300.0)
    };
    let mut e = env_with_neighbors(&[prey]);
    Hunt.apply(&b, &mut pred, &mut e);
    assert!(pred.velocity.x > 0.0, "predator seeks prey");

    // prey (species 1) accelerates away from the predator.
    let mut fleer = Particle {
        species: 1,
        ..at(400.0, 300.0)
    };
    let mut e = env_with_neighbors(&[predator]);
    Hunt.apply(&b, &mut fleer, &mut e);
    assert!(fleer.velocity.x < 0.0, "prey flees the predator");

    // same-species neighbours are ignored.
    let mut lone = Particle {
        species: 0,
        ..at(400.0, 300.0)
    };
    let same = Particle {
        species: 0,
        ..at(430.0, 300.0)
    };
    let mut e = env_with_neighbors(&[same]);
    Hunt.apply(&b, &mut lone, &mut e);
    assert_eq!(lone.velocity, Vec3::ZERO, "same species → no pursuit");
}

// ── align: steer toward the mean neighbour heading, preserving speed ───────────

#[test]
fn align_steers_toward_neighbour_heading() {
    let b = body("align", 200.0, 1.0); // k = 1 → snap fully to the mean heading
    let mut p = moving(400.0, 300.0, Vec3::new(5.0, 0.0, 0.0)); // moving +x, speed 5
    let neighbors = [
        moving(410.0, 300.0, Vec3::new(0.0, 3.0, 0.0)),
        moving(420.0, 305.0, Vec3::new(0.0, 4.0, 0.0)),
    ];
    let mut e = env_with_neighbors(&neighbors);
    Align.apply(&b, &mut p, &mut e);
    assert!(
        p.velocity.y > 0.0,
        "steers toward the neighbours' +y heading"
    );
    assert!(
        (p.velocity.length() - 5.0).abs() < 1e-9,
        "alignment preserves speed"
    );
}

// ── pressure: crowding pushes matter apart ────────────────────────────────────

#[test]
fn pressure_relaxes_crowding() {
    let b = body("pressure", 100.0, 1.0);
    let mut p = at(400.0, 300.0);
    // three neighbours clustered to one side → net push the other way.
    let neighbors = [at(408.0, 300.0), at(408.0, 305.0), at(408.0, 295.0)];
    let mut e = env_with_neighbors(&neighbors);
    Pressure.apply(&b, &mut p, &mut e);
    assert!(
        p.velocity.x < 0.0,
        "crowded matter is pushed away from the cluster"
    );
}

// ── integration: the step() gate rebuilds the neighbourhood ───────────────────

#[test]
fn step_builds_neighborhood_for_neighbour_forces() {
    let reg = Registry::standard();
    let mut env = Env {
        volume: Vec3::new(800.0, 600.0, 0.0),
        ..Env::default()
    };
    // a global cohesion body (range 0 would skip; use a wide range covering both particles).
    let mut bodies = vec![Body {
        tokens: vec!["cohesion".into()],
        range: 400.0,
        strength: 1.0,
        center: Vec3::new(400.0, 300.0, 0.0),
        ..Body::default()
    }];
    let mut store = FieldStore::new();
    store.add(at(398.0, 300.0)); // two particles closer than r0 = 200
    store.add(at(402.0, 300.0));
    let gap0 = (store.particles[1].position - store.particles[0].position).length();

    for _ in 0..20 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    let gap1 = (store.particles[1].position - store.particles[0].position).length();
    assert!(
        gap1 > gap0,
        "cohesion pressure separates crowded matter: {gap0:.2} → {gap1:.2}"
    );
}
