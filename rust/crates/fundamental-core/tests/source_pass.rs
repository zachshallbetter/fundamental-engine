//! The source pass, mortal matter, and the two source/scatter forces (#1038).
//!
//! `spawn` is the one force that deliberately breaks conservation, so the budget that bounds it has
//! to travel with the matter: every emitted particle is mortal. These pin that the population stays
//! bounded rather than growing without limit, which is the failure a fountain left running produces.

use fundamental_core::engine::{step, Body, Env, FieldStore, Particle, Registry};
use fundamental_core::math::Vec3;

fn env800() -> Env {
    Env {
        volume: Vec3::new(800.0, 600.0, 0.0),
        rng: fundamental_core::record::Rng::seeded(5),
        ..Env::default()
    }
}

fn source(life: Option<f64>, cap: Option<f64>, strength: f64) -> Body {
    Body {
        tokens: vec!["spawn".into()],
        range: 400.0,
        strength,
        center: Vec3::new(400.0, 300.0, 0.0),
        heading: Vec3::new(1.0, 0.0, 0.0),
        life,
        source_cap: cap,
        engaged: true,
        ..Body::default()
    }
}

fn run(bodies: Vec<Body>, frames: usize) -> (FieldStore, Vec<Body>, Env) {
    let reg = Registry::standard();
    let mut env = env800();
    let mut bodies = bodies;
    let mut store = FieldStore::new();
    for _ in 0..frames {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    (store, bodies, env)
}

// ── spawn ────────────────────────────────────────────────────────────────────

#[test]
fn a_source_grows_the_pool_from_nothing() {
    let (store, _, _) = run(vec![source(Some(90.0), None, 1.0)], 10);
    assert!(store.len() > 0, "the source emitted matter: {}", store.len());
}

#[test]
fn every_spawned_particle_is_mortal() {
    // The budget travels with the matter. An immortal emission is a leak by construction.
    let (store, _, _) = run(vec![source(Some(90.0), None, 1.0)], 5);
    assert!(store.len() > 0);
    assert!(
        store.particles.iter().all(|p| p.age.is_some()),
        "no emitted particle is immortal"
    );
}

#[test]
fn matter_despawns_when_its_age_runs_out() {
    // A short life, then long enough with the source switched off that everything must have expired.
    let reg = Registry::standard();
    let mut env = env800();
    let mut bodies = vec![source(Some(5.0), None, 1.0)];
    let mut store = FieldStore::new();
    for _ in 0..3 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    let peak = store.len();
    assert!(peak > 0, "matter was emitted first: {peak}");

    // Visibility is the off switch, not engagement: `spawn` emits whenever it is visible (JS says
    // so in as many words — "a fountain flows while on-screen"), and the source pass is what skips
    // a non-visible body. An earlier draft of this test set `engaged = false` and watched the pool
    // keep growing, which is the force behaving correctly and the test asserting folklore.
    bodies[0].visible = false; // stop emitting; only aging remains
    for _ in 0..20 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    assert_eq!(store.len(), 0, "every mortal particle aged out, peak was {peak}");
}

#[test]
fn immortal_matter_is_never_aged_out() {
    // The conserved base field must survive a field that also has a source in it.
    let reg = Registry::standard();
    let mut env = env800();
    let mut bodies = vec![source(Some(3.0), None, 1.0)];
    let mut store = FieldStore::new();
    let base = store.add(Particle {
        position: Vec3::new(100.0, 100.0, 0.0),
        ..Default::default()
    });
    for _ in 0..40 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    assert!(
        store.particles.iter().any(|p| p.id == base),
        "immortal matter survives; age: None is not a lifespan of zero"
    );
}

#[test]
fn the_source_cap_bounds_the_population() {
    // The acceptance criterion. rate = cap / life per frame, so the live population settles near cap
    // however hard the body pushes — a fountain has a basin, not an ever-rising flood.
    let (small, _, _) = run(vec![source(Some(20.0), Some(40.0), 50.0)], 120);
    assert!(
        small.len() <= 60,
        "a cap of 40 over a life of 20 keeps the population bounded: {}",
        small.len()
    );
    // and a bigger budget really does hold more
    let (big, _, _) = run(vec![source(Some(20.0), Some(200.0), 50.0)], 120);
    assert!(
        big.len() > small.len(),
        "a larger cap sustains more matter: {} vs {}",
        big.len(),
        small.len()
    );
}

#[test]
fn a_fractional_rate_still_flows() {
    // cap/life = 10/100 = 0.1 per frame. Rounding that to zero would make a slow source silent.
    let (store, _, _) = run(vec![source(Some(100.0), Some(10.0), 1.0)], 60);
    assert!(
        store.len() > 0,
        "a sub-one-per-frame budget accumulates instead of rounding away: {}",
        store.len()
    );
}

#[test]
fn an_idle_source_emits_nothing() {
    let mut idle = source(Some(90.0), None, 1.0);
    idle.engaged = true;
    idle.visible = false; // the source pass skips non-visible bodies
    let (store, _, _) = run(vec![idle], 20);
    assert_eq!(store.len(), 0, "an invisible source is silent");
}

#[test]
fn emitted_matter_carries_a_real_id() {
    // Added through the store, not pushed at the pool: id 0 is invisible to collide's pair gate and
    // to every id-keyed attribution downstream.
    let (store, _, _) = run(vec![source(Some(90.0), None, 1.0)], 4);
    assert!(store.len() > 0);
    assert!(store.particles.iter().all(|p| p.id != 0), "every emission has an id");
    let ids: std::collections::HashSet<u64> = store.particles.iter().map(|p| p.id).collect();
    assert_eq!(ids.len(), store.len(), "and the ids are unique");
}

// ── morph ────────────────────────────────────────────────────────────────────

fn morph_body(targets: Vec<Vec3>) -> Body {
    Body {
        tokens: vec!["morph".into()],
        range: 10_000.0,
        strength: 1.0,
        center: Vec3::new(400.0, 300.0, 0.0),
        targets,
        ..Body::default()
    }
}

#[test]
fn morph_with_no_targets_is_inert() {
    let reg = Registry::standard();
    let mut env = env800();
    let mut bodies = vec![morph_body(vec![])];
    let mut store = FieldStore::new();
    store.add(Particle { position: Vec3::new(100.0, 100.0, 0.0), ..Default::default() });
    let before = store.particles[0].position;
    for _ in 0..20 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    assert_eq!(store.particles[0].position, before, "no shape assigned → nothing moves");
}

#[test]
fn matter_assembles_toward_its_target() {
    let reg = Registry::standard();
    let mut env = env800();
    let target = Vec3::new(600.0, 300.0, 0.0);
    let mut bodies = vec![morph_body(vec![target])];
    let mut store = FieldStore::new();
    store.add(Particle { position: Vec3::new(100.0, 300.0, 0.0), ..Default::default() });
    let d0 = (store.particles[0].position.x - target.x).abs();
    for _ in 0..80 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    let d1 = (store.particles[0].position.x - target.x).abs();
    assert!(d1 < d0 * 0.5, "matter closed on its target: {d0:.1} → {d1:.1}");
}

#[test]
fn a_particle_always_aims_at_the_same_target() {
    // The reason the scatter fraction is fixed per particle rather than derived from pool position:
    // a reordering pool would rehash the assignment every frame and the mark would boil.
    let reg = Registry::standard();
    let mut env = env800();
    let targets = vec![
        Vec3::new(600.0, 100.0, 0.0),
        Vec3::new(600.0, 500.0, 0.0),
    ];
    let mut bodies = vec![morph_body(targets.clone())];
    let mut store = FieldStore::new();
    // gx = 0.9 → index 1 (the lower target); gx = 0.1 → index 0
    store.add(Particle { position: Vec3::new(300.0, 300.0, 0.0), gx: 0.9, ..Default::default() });
    store.add(Particle { position: Vec3::new(300.0, 300.0, 0.0), gx: 0.1, ..Default::default() });
    for _ in 0..80 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    let high = store.particles.iter().find(|p| p.gx == 0.1).unwrap();
    let low = store.particles.iter().find(|p| p.gx == 0.9).unwrap();
    assert!(
        high.position.y < low.position.y,
        "each particle went to ITS target, not a reshuffled one: {:.1} vs {:.1}",
        high.position.y,
        low.position.y
    );
}
