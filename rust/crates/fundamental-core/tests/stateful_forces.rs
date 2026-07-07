//! The stateful/stochastic canonical forces: jet (RNG cone), wall (spark effect), sink
//! (capture → supernova). Exercises the Env effects seam and the integrator's capture resolution.

use fundamental_core::config::canonical_force_color;
use fundamental_core::engine::{step, Body, Effect, Env, FieldStore, Force, Particle, Registry};
use fundamental_core::forces::{Jet, Wall};
use fundamental_core::math::Vec3;
use fundamental_core::Rng;

fn body(tokens: &[&str]) -> Body {
    Body {
        tokens: tokens.iter().map(|s| s.to_string()).collect(),
        center: Vec3::new(400.0, 300.0, 0.0),
        ..Body::default()
    }
}

// ── config ──────────────────────────────────────────────────────────────────

#[test]
fn canonical_colors_present() {
    assert_eq!(canonical_force_color("wall"), Some("#c4b5fd"));
    assert_eq!(canonical_force_color("attract"), Some("#4da3ff"));
    assert_eq!(canonical_force_color("not-a-force"), None);
}

// ── jet ─────────────────────────────────────────────────────────────────────

/// At the nozzle (dist < 24) jet relaunches matter at speed `2.4 + strength·2.6`, along a rng cone.
/// The cone rotates direction but preserves magnitude, so the launch speed is exact regardless of seed.
#[test]
fn jet_relaunches_at_the_nozzle() {
    let b = body(&["jet"]); // strength 1 → spd = 5.0
    let mut p = Particle {
        position: Vec3::new(410.0, 300.0, 0.0),
        ..Default::default()
    };
    let mut e = Env {
        vector: Vec3::new(-10.0, 0.0, 0.0),
        dist: 10.0, // < 24 → nozzle
        rng: Rng::seeded(1),
        ..Env::default()
    };
    Jet.apply(&b, &mut p, &mut e);
    assert!(
        (p.velocity.length() - 5.0).abs() < 1e-9,
        "launch speed should be 2.4 + 1·2.6 = 5.0"
    );
    assert_eq!(p.heat, 0.9, "nozzle matter is hot");
}

/// Seeded, jet is deterministic — the cone angle is drawn from the reproducible source.
#[test]
fn jet_is_deterministic_when_seeded() {
    let run = || {
        let b = body(&["jet"]);
        let mut p = Particle {
            position: Vec3::new(405.0, 300.0, 0.0),
            ..Default::default()
        };
        let mut e = Env {
            vector: Vec3::new(-5.0, 0.0, 0.0),
            dist: 5.0,
            rng: Rng::seeded(2024),
            ..Env::default()
        };
        Jet.apply(&b, &mut p, &mut e);
        p.velocity
    };
    assert_eq!(run(), run());
}

// ── wall ────────────────────────────────────────────────────────────────────

/// A fast particle hitting the wall reflects its velocity and throws a spark in the wall's hue.
#[test]
fn wall_bounces_fast_matter_and_sparks() {
    let mut b = body(&["wall"]);
    b.half_extents = Vec3::new(50.0, 20.0, 0.0);
    // near the right face, moving right fast.
    let mut p = Particle {
        position: Vec3::new(445.0, 300.0, 0.0),
        velocity: Vec3::new(3.0, 0.0, 0.0),
        ..Default::default()
    };
    let mut e = Env::default();
    Wall.apply(&b, &mut p, &mut e);
    assert!(p.velocity.x < 0.0, "the wall reflects the x velocity");
    assert_eq!(e.effects.len(), 1, "a hard impact throws one spark");
    match &e.effects[0] {
        Effect::Spark { color, .. } => {
            assert_eq!(
                color.as_deref(),
                Some("#c4b5fd"),
                "spark in the canon wall hue"
            );
        }
    }
}

/// A slow particle still bounces but is too gentle to spark (speed ≤ 0.7).
#[test]
fn wall_bounces_slow_matter_without_sparking() {
    let mut b = body(&["wall"]);
    b.half_extents = Vec3::new(50.0, 20.0, 0.0);
    let mut p = Particle {
        position: Vec3::new(445.0, 300.0, 0.0),
        velocity: Vec3::new(0.5, 0.0, 0.0),
        ..Default::default()
    };
    let mut e = Env::default();
    Wall.apply(&b, &mut p, &mut e);
    assert!(p.velocity.x < 0.0, "still reflects");
    assert!(e.effects.is_empty(), "a gentle touch does not spark");
}

// ── sink (capture + supernova) ───────────────────────────────────────────────

fn field_with_sink(capacity: f64) -> (Registry, Env, Vec<Body>, FieldStore) {
    let reg = Registry::standard();
    let env = Env {
        volume: Vec3::new(800.0, 600.0, 0.0),
        ..Env::default()
    };
    let sink = Body {
        tokens: vec!["sink".into()],
        absorb_r: 64.0,
        capacity,
        center: Vec3::new(400.0, 300.0, 0.0),
        ..Body::default()
    };
    (reg, env, vec![sink], FieldStore::new())
}

/// Below capacity, a sink captures nearby matter and holds it — the particle drifts to the core and
/// stops feeling other forces.
#[test]
fn sink_captures_and_holds() {
    let (reg, mut env, mut bodies, mut store) = field_with_sink(5.0);
    store.add(Particle {
        position: Vec3::new(410.0, 300.0, 0.0), // dist 10 < absorbR 64
        ..Default::default()
    });
    store.add(Particle {
        position: Vec3::new(390.0, 320.0, 0.0), // dist ~22 < 64
        ..Default::default()
    });

    step(&mut store, &mut bodies, &mut env, &reg);
    assert_eq!(bodies[0].accreted, 2, "both nearby particles captured");
    assert!(
        store.particles.iter().all(|p| p.cap == Some(0)),
        "held by the sink"
    );

    // captured matter drifts toward the core over subsequent steps.
    let core = bodies[0].center;
    let before = (core - store.particles[0].position).length();
    for _ in 0..10 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    let after = (core - store.particles[0].position).length();
    assert!(
        after < before,
        "captured matter drifts to the core: {before:.2} → {after:.2}"
    );
    assert_eq!(
        bodies[0].accreted, 2,
        "no re-capture of already-held matter"
    );
}

/// At capacity, the sink saturates and releases (a supernova): accretion resets and the held shell
/// is freed back into the field. Particle count is conserved.
#[test]
fn sink_releases_at_capacity() {
    let (reg, mut env, mut bodies, mut store) = field_with_sink(2.0);
    store.add(Particle {
        position: Vec3::new(410.0, 300.0, 0.0),
        ..Default::default()
    });
    store.add(Particle {
        position: Vec3::new(390.0, 300.0, 0.0),
        ..Default::default()
    });

    assert_eq!(store.len(), 2);
    step(&mut store, &mut bodies, &mut env, &reg);

    assert_eq!(
        bodies[0].accreted, 0,
        "saturation released the shell (supernova)"
    );
    assert!(
        store.particles.iter().all(|p| p.cap.is_none()),
        "matter freed back into the field"
    );
    assert_eq!(store.len(), 2, "count is conserved through a supernova");
}
