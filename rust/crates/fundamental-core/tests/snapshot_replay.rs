//! Deterministic snapshot + causal replay — the Field Receipts substrate (#1043).
//!
//! The acceptance criterion is *byte-identical*, so these compare raw IEEE bit patterns rather than
//! `==`. `f64` equality would quietly accept `0.0 == -0.0` and reject a legitimate `NaN`; `to_bits()`
//! accepts neither and is what "byte-identical" actually means.

use fundamental_core::engine::{step, Body, Effect, Env, FieldStore, Particle, Registry};
use fundamental_core::math::Vec3;
use fundamental_core::record::{replay, replay_recording, FieldSnapshot};

fn bits(p: &Particle) -> Vec<u64> {
    vec![
        p.position.x.to_bits(),
        p.position.y.to_bits(),
        p.position.z.to_bits(),
        p.velocity.x.to_bits(),
        p.velocity.y.to_bits(),
        p.velocity.z.to_bits(),
        p.heat.to_bits(),
        p.id,
    ]
}

fn pool_bits(store: &FieldStore) -> Vec<Vec<u64>> {
    store.particles.iter().map(bits).collect()
}

/// A field with a stochastic force in it, so the RNG stream actually matters to the outcome.
fn field() -> (FieldStore, Vec<Body>, Env) {
    let mut store = FieldStore::new();
    for (x, y) in [(250.0, 320.0), (500.0, 280.0), (420.0, 150.0), (610.0, 410.0)] {
        store.add(Particle {
            position: Vec3::new(x, y, 0.0),
            ..Default::default()
        });
    }
    let bodies = vec![
        Body {
            tokens: vec!["attract".into()],
            range: 300.0,
            center: Vec3::new(400.0, 300.0, 0.0),
            ..Body::default()
        },
        Body {
            // thermal draws the rng every step — if a capture took a fresh stream instead of the
            // live position, this is the body that would expose it.
            tokens: vec!["thermal".into()],
            range: 10_000.0,
            strength: 3.0,
            center: Vec3::new(400.0, 300.0, 0.0),
            ..Body::default()
        },
    ];
    let env = Env {
        volume: Vec3::new(800.0, 600.0, 0.0),
        rng: fundamental_core::record::Rng::seeded(7),
        ..Env::default()
    };
    (store, bodies, env)
}

#[test]
fn replay_from_a_capture_matches_stepping_the_original() {
    // The acceptance criterion: snapshot → replay(N) == running N steps from the same start.
    let reg = Registry::standard();
    let (mut store, mut bodies, mut env) = field();
    let snap = FieldSnapshot::capture(&store, &bodies, &env);

    for _ in 0..50 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    let replayed = replay(&snap, 50, &reg);

    assert_eq!(
        pool_bits(&store),
        pool_bits(&replayed.store),
        "replayed trajectory is bit-identical"
    );
    assert_eq!(env.frame_n, replayed.env.frame_n, "and the frame counters agree");
}

#[test]
fn a_capture_taken_mid_run_resumes_the_rng_stream_rather_than_restarting_it() {
    // The subtle one. If `capture` stored a SEED instead of the live generator, this passes for a
    // capture at frame 0 and fails for one taken later — so the capture is deliberately taken late.
    let reg = Registry::standard();
    let (mut store, mut bodies, mut env) = field();
    for _ in 0..30 {
        step(&mut store, &mut bodies, &mut env, &reg); // burn 30 frames of rng first
    }
    let snap = FieldSnapshot::capture(&store, &bodies, &env);

    // carry the ORIGINAL field forward — no clone, and no using replay to test replay
    for _ in 0..25 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    let replayed = replay(&snap, 25, &reg);

    assert_eq!(
        pool_bits(&store),
        pool_bits(&replayed.store),
        "a mid-run capture resumes the stream where it stood"
    );
}

#[test]
fn replaying_the_same_capture_twice_gives_the_same_result() {
    let reg = Registry::standard();
    let (store, bodies, env) = field();
    let snap = FieldSnapshot::capture(&store, &bodies, &env);
    let a = replay(&snap, 40, &reg);
    let b = replay(&snap, 40, &reg);
    assert_eq!(pool_bits(&a.store), pool_bits(&b.store), "replay is a pure function of the capture");
}

#[test]
fn a_capture_is_an_owned_value_that_the_live_field_cannot_mutate() {
    // A snapshot that aliased the pool would silently track the field it came from, and a receipt
    // would then describe the present rather than the past.
    let reg = Registry::standard();
    let (mut store, mut bodies, mut env) = field();
    let snap = FieldSnapshot::capture(&store, &bodies, &env);
    let before = snap.particles[0].position.x.to_bits();
    for _ in 0..30 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    assert_ne!(
        store.particles[0].position.x.to_bits(),
        before,
        "the live field really did move"
    );
    assert_eq!(
        snap.particles[0].position.x.to_bits(),
        before,
        "the capture did not"
    );
}

#[test]
fn the_id_counter_survives_a_round_trip() {
    // Restoring the pool without the counter would hand re-added matter different ids than the
    // original run, and every id-keyed attribution would then name the wrong particle.
    let (mut store, bodies, env) = field();
    store.add(Particle {
        position: Vec3::new(1.0, 1.0, 0.0),
        ..Default::default()
    });
    let expected_next = store.next_id();
    let snap = FieldSnapshot::capture(&store, &bodies, &env);
    let (mut restored, _, _) = snap.restore();
    assert_eq!(restored.next_id(), expected_next, "the counter is part of the state");
    let fresh = restored.add(Particle::default());
    assert_eq!(fresh, expected_next, "and the next id really is the one the original would give");
}

#[test]
fn the_effect_log_records_what_each_step_did() {
    // The causal half of a receipt: the state says what the field became, the log says what happened.
    let reg = Registry::standard();
    let mut store = FieldStore::new();
    // near the wall's right face, moving into it fast — the shape the wall test already pins
    store.add(Particle {
        position: Vec3::new(445.0, 300.0, 0.0),
        velocity: Vec3::new(3.0, 0.0, 0.0),
        ..Default::default()
    });
    let bodies = vec![Body {
        tokens: vec!["wall".into()],
        center: Vec3::new(400.0, 300.0, 0.0),
        half_extents: Vec3::new(50.0, 20.0, 0.0),
        ..Body::default()
    }];
    let env = Env {
        volume: Vec3::new(800.0, 600.0, 0.0),
        ..Env::default()
    };
    let snap = FieldSnapshot::capture(&store, &bodies, &env);
    let (_, log) = replay_recording(&snap, 20, &reg);

    assert_eq!(log.len(), 20, "one entry per step, in order");
    let sparks: usize = log
        .iter()
        .flatten()
        .filter(|e| matches!(e, Effect::Spark { .. }))
        .count();
    assert!(sparks > 0, "the wall impact was recorded as a spark effect");
}

#[test]
fn the_effect_log_reproduces() {
    // A recorded run's log must replay identically, or a receipt's causal account is not evidence.
    let reg = Registry::standard();
    let (store, bodies, env) = field();
    let snap = FieldSnapshot::capture(&store, &bodies, &env);
    let (_, a) = replay_recording(&snap, 30, &reg);
    let (_, b) = replay_recording(&snap, 30, &reg);
    assert_eq!(a.len(), b.len());
    for (i, (x, y)) in a.iter().zip(b.iter()).enumerate() {
        assert_eq!(x, y, "step {i}'s effects reproduce");
    }
}

#[test]
fn recording_does_not_change_the_outcome() {
    // Observing must not perturb: the recorded replay and the plain one must land in the same place.
    let reg = Registry::standard();
    let (store, bodies, env) = field();
    let snap = FieldSnapshot::capture(&store, &bodies, &env);
    let plain = replay(&snap, 35, &reg);
    let (recorded, _) = replay_recording(&snap, 35, &reg);
    assert_eq!(
        pool_bits(&plain.store),
        pool_bits(&recorded.store),
        "the attribution log is a read, not a perturbation"
    );
}

#[test]
fn a_capture_round_trips_through_restore_unchanged() {
    let (store, bodies, env) = field();
    let snap = FieldSnapshot::capture(&store, &bodies, &env);
    let (rs, rb, re) = snap.restore();
    assert_eq!(pool_bits(&store), pool_bits(&rs), "the pool survives");
    assert_eq!(rb.len(), bodies.len(), "the bodies survive");
    assert_eq!(re.frame_n, env.frame_n);
    assert_eq!(re.t.to_bits(), env.t.to_bits());
    assert_eq!(re.dt.to_bits(), env.dt.to_bits());
    assert_eq!(re.c.to_bits(), env.c.to_bits());
    assert_eq!(re.g.to_bits(), env.g.to_bits());
    assert_eq!(re.volume.x.to_bits(), env.volume.x.to_bits());
}
