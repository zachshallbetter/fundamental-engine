//! The scalar-grid subsystem and the three class-[C] forces that ride it (#1039).
//!
//! Class [C] means the state lives in a field buffer rather than in the particle or the body: matter
//! influences matter only through what it has left behind. These tests pin the grid's schemes, the
//! name→mode convention that selects them, and the three forces' observable behaviour.

use fundamental_core::engine::{step, Body, Env, FieldStore, GridMode, Particle, Registry, ScalarGrid};
use fundamental_core::math::Vec3;

// ── the grid itself ──────────────────────────────────────────────────────────

#[test]
fn the_grid_name_picks_the_scheme() {
    // Load-bearing, not cosmetic: `propagate` asks for "wave-propagate" and gets leapfrog stepping
    // purely because of the prefix. Mirrors the JS field's picker.
    assert_eq!(GridMode::for_name("wave-propagate"), GridMode::Wave);
    assert_eq!(GridMode::for_name("wave"), GridMode::Wave);
    assert_eq!(GridMode::for_name("memory"), GridMode::Memory);
    assert_eq!(GridMode::for_name("potential:height"), GridMode::Held);
    assert_eq!(GridMode::for_name("diffuse"), GridMode::Diffuse);
    assert_eq!(GridMode::for_name("anything-else"), GridMode::Diffuse);
}

#[test]
fn deposit_then_sample_reads_the_mark_back() {
    let mut g = ScalarGrid::new(800.0, 600.0, GridMode::Diffuse, 32.0);
    assert_eq!(g.sample(320.0, 320.0), 0.0, "an empty grid is zero everywhere");
    g.deposit(320.0, 320.0, 5.0);
    // 320 is exactly a cell centre (10·32), so a bilinear read returns the deposit itself.
    assert!((g.sample(320.0, 320.0) - 5.0).abs() < 1e-12);
    assert_eq!(g.max(), 5.0, "max() finds the peak");
}

#[test]
fn the_gradient_points_up_slope() {
    let mut g = ScalarGrid::new(800.0, 600.0, GridMode::Diffuse, 32.0);
    g.deposit(320.0, 320.0, 10.0);
    // Sampled to the LEFT of the peak, the up-slope direction is +x (toward the peak).
    let (gx, _) = g.gradient(288.0, 320.0);
    assert!(gx > 0.0, "gradient left of the peak points right: {gx}");
    let (gx2, _) = g.gradient(352.0, 320.0);
    assert!(gx2 < 0.0, "gradient right of the peak points left: {gx2}");
}

#[test]
fn diffusing_spreads_a_mark_and_conserves_roughly() {
    let mut g = ScalarGrid::new(800.0, 600.0, GridMode::Diffuse, 32.0);
    g.deposit(320.0, 320.0, 10.0);
    let peak0 = g.sample(320.0, 320.0);
    let side0 = g.sample(352.0, 320.0);
    g.step();
    let peak1 = g.sample(320.0, 320.0);
    let side1 = g.sample(352.0, 320.0);
    assert!(peak1 < peak0, "the peak flattens: {peak0} → {peak1}");
    assert!(side1 > side0, "the neighbour rises: {side0} → {side1}");
}

#[test]
fn a_held_grid_never_moves() {
    // The declared-potential raster (#443): the engine wrote it and it stays exactly as written.
    let mut g = ScalarGrid::new(800.0, 600.0, GridMode::Held, 32.0);
    g.deposit(320.0, 320.0, 10.0);
    let before = g.sample(320.0, 320.0);
    for _ in 0..50 {
        g.step();
    }
    assert_eq!(g.sample(320.0, 320.0), before, "a held grid never blurs or decays");
}

#[test]
fn a_memory_grid_fades_far_slower_than_a_diffusing_one() {
    let peak_after = |mode: GridMode| {
        let mut g = ScalarGrid::new(800.0, 600.0, mode, 32.0);
        g.deposit(320.0, 320.0, 10.0);
        for _ in 0..40 {
            g.step();
        }
        g.sample(320.0, 320.0)
    };
    let mem = peak_after(GridMode::Memory);
    let dif = peak_after(GridMode::Diffuse);
    assert!(mem > dif, "memory holds its mark far longer: {mem} vs {dif}");
}

#[test]
fn fill_from_clamps_non_finite_at_the_boundary() {
    // A NaN cell would reach a velocity through sample(), and a NaN velocity slips the `speed > c`
    // guard entirely — every comparison against NaN is false. The check belongs where the untrusted
    // value enters the engine, not downstream.
    let mut g = ScalarGrid::new(200.0, 200.0, GridMode::Held, 32.0);
    g.fill_from(|x, _y| if x > 64.0 { f64::NAN } else { 3.0 });
    for ix in 0..g.cols() {
        for iy in 0..g.rows() {
            let v = g.sample(ix as f64 * 32.0, iy as f64 * 32.0);
            assert!(v.is_finite(), "cell ({ix},{iy}) is non-finite: {v}");
        }
    }
    g.fill_from(|_, _| f64::INFINITY);
    assert_eq!(g.max(), 0.0, "infinity is clamped to zero too");
}

#[test]
fn the_boundary_is_zero_flux_not_a_hole() {
    // Neumann: reading past the edge clamps to the edge cell rather than sampling emptiness, so a
    // mark deposited at a corner does not leak out of the field.
    let mut g = ScalarGrid::new(200.0, 200.0, GridMode::Diffuse, 32.0);
    g.deposit(0.0, 0.0, 10.0);
    assert!(g.sample(-500.0, -500.0) > 0.0, "off-grid reads clamp to the edge");
    let total_before = g.max();
    g.step();
    assert!(g.max() < total_before, "it still diffuses");
    assert!(g.max() > 0.0, "but does not vanish through the wall");
}

#[test]
fn decay_and_clear_do_what_they_say() {
    let mut g = ScalarGrid::new(200.0, 200.0, GridMode::Diffuse, 32.0);
    g.deposit(64.0, 64.0, 8.0);
    g.decay(0.5);
    assert!((g.sample(64.0, 64.0) - 4.0).abs() < 1e-12, "half faded");
    g.decay(0.0);
    assert!((g.sample(64.0, 64.0) - 4.0).abs() < 1e-12, "rate 0 is a no-op");
    g.clear();
    assert_eq!(g.max(), 0.0, "cleared");
}

// ── the forces ───────────────────────────────────────────────────────────────

fn env800() -> Env {
    Env {
        volume: Vec3::new(800.0, 600.0, 0.0),
        ..Env::default()
    }
}

fn body(token: &str, x: f64, y: f64, strength: f64) -> Body {
    Body {
        tokens: vec![token.into()],
        range: 400.0,
        strength,
        center: Vec3::new(x, y, 0.0),
        ..Body::default()
    }
}

fn at(x: f64, y: f64) -> Particle {
    Particle {
        position: Vec3::new(x, y, 0.0),
        ..Default::default()
    }
}

#[test]
fn diffuse_lays_a_trail_that_shows_up_in_the_grid() {
    let reg = Registry::standard();
    let mut env = env800();
    let mut bodies = vec![body("diffuse", 400.0, 300.0, 1.0)];
    let mut store = FieldStore::new();
    store.add(at(400.0, 300.0));
    for _ in 0..10 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    let g = env.grids.get("diffuse").expect("the force created its grid");
    assert!(g.max() > 0.0, "a trail was laid: peak {}", g.max());
}

#[test]
fn diffuse_matter_is_drawn_up_the_trail_another_particle_left() {
    // The point of a class-[C] force: influence travels through the buffer, not directly. One
    // particle sits still laying a heavy mark; a second, far from it, should be pulled up-gradient.
    let reg = Registry::standard();
    let mut env = env800();
    let mut bodies = vec![body("diffuse", 400.0, 300.0, 1.0)];
    let mut store = FieldStore::new();
    // pre-load the grid with a strong mark to the RIGHT of the test particle
    env.grid("diffuse").deposit(480.0, 300.0, 200.0);
    let id = store.add(at(400.0, 300.0));
    let x0 = store.particles[0].position.x;
    for _ in 0..5 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    let p = store.particles.iter().find(|p| p.id == id).unwrap();
    assert!(
        p.position.x > x0,
        "matter climbed toward the mark: {x0} → {}",
        p.position.x
    );
}

#[test]
fn propagate_only_emits_from_an_engaged_body_and_only_on_the_pulse() {
    let reg = Registry::standard();
    let mut env = env800();
    let mut idle = body("propagate", 400.0, 300.0, 5.0);
    idle.engaged = false;
    let mut bodies = vec![idle];
    let mut store = FieldStore::new();
    store.add(at(400.0, 300.0));
    for _ in 0..24 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    let quiet = env
        .grids
        .get("wave-propagate")
        .map(|g| g.max())
        .unwrap_or(0.0);
    assert_eq!(quiet, 0.0, "an idle body emits nothing: {quiet}");

    // and an engaged one does
    let mut env2 = env800();
    let mut bodies2 = vec![body("propagate", 400.0, 300.0, 5.0)];
    bodies2[0].engaged = true;
    let mut store2 = FieldStore::new();
    store2.add(at(400.0, 300.0));
    for _ in 0..24 {
        step(&mut store2, &mut bodies2, &mut env2, &reg);
    }
    assert!(
        env2.grids.get("wave-propagate").unwrap().max() != 0.0,
        "an engaged body emits a shock train"
    );
}

#[test]
fn propagate_sweeps_matter_outward_not_inward() {
    // The acceptance criterion, and the reason the force rides the gradient MAGNITUDE rather than the
    // field value: a standing bump at the source would pull matter IN, which is what this must not do.
    let reg = Registry::standard();
    let mut env = env800();
    let mut b = body("propagate", 400.0, 300.0, 6.0);
    b.engaged = true;
    let mut bodies = vec![b];
    let mut store = FieldStore::new();
    let id = store.add(at(500.0, 300.0)); // 100px to the right of the source
    let r0 = 100.0_f64;
    for _ in 0..40 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    let p = store.particles.iter().find(|p| p.id == id).unwrap();
    let r1 = ((p.position.x - 400.0).powi(2) + (p.position.y - 300.0).powi(2)).sqrt();
    assert!(
        r1 > r0,
        "the front pushed matter outward: r {r0} → {r1} (inward would mean a standing bump)"
    );
}

#[test]
fn memory_wears_a_path_and_a_worn_path_pulls_harder() {
    let reg = Registry::standard();
    let pull = |preloaded: f64| {
        let mut env = env800();
        let mut bodies = vec![body("memory", 400.0, 300.0, 1.0)];
        let mut store = FieldStore::new();
        if preloaded > 0.0 {
            env.grid("memory").deposit(500.0, 300.0, preloaded);
        }
        let id = store.add(at(500.0, 300.0));
        for _ in 0..12 {
            step(&mut store, &mut bodies, &mut env, &reg);
        }
        let p = store.particles.iter().find(|p| p.id == id).unwrap();
        500.0 - p.position.x // displacement toward the body at x = 400
    };
    let fresh = pull(0.0);
    let worn = pull(50.0);
    assert!(fresh > 0.0, "memory pulls toward its body: {fresh}");
    assert!(
        worn > fresh,
        "a worn path pulls harder: worn {worn:.4} vs fresh {fresh:.4}"
    );
}

#[test]
fn the_frame_counter_advances() {
    // It was declared on Env from the start and advanced by nothing. `propagate`'s pulse is gated on
    // `frame_n % 12`, so left at zero the shock train would fire on EVERY frame.
    let reg = Registry::standard();
    let mut env = env800();
    let mut bodies: Vec<Body> = vec![];
    let mut store = FieldStore::new();
    store.add(at(400.0, 300.0));
    for _ in 0..7 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    assert_eq!(env.frame_n, 7, "one tick per step");
}

#[test]
fn a_field_with_no_grid_forces_creates_no_grids() {
    // The whole subsystem is opt-in: a body that names no class-[C] force must not allocate a buffer.
    let reg = Registry::standard();
    let mut env = env800();
    let mut bodies = vec![body("attract", 400.0, 300.0, 1.0)];
    let mut store = FieldStore::new();
    store.add(at(500.0, 300.0));
    for _ in 0..20 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    assert!(env.grids.is_empty(), "no grids were created");
}
