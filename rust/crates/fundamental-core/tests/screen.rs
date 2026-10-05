//! workover v0.3 `screen` — the cross-body quiet zone (#1040).
//!
//! The only modifier that acts on OTHER bodies. `spotlight` and `resonate` bend their own body's
//! siblings and so live in the per-body `modify` hook; `screen` damps a *neighbour's* pull on matter
//! inside its range, which no per-body hook can express — the whole force lives in the integrator.

use fundamental_core::engine::{step, Body, Env, FieldStore, Particle, Registry};
use fundamental_core::math::{screen_factor, Vec3};

// ── the math, pinned against the JS reference ────────────────────────────────

#[test]
fn screen_factor_matches_the_js_reference() {
    // Generated from `screenFactor` in packages/core/src/math/math.ts. If these drift, a quiet zone
    // shields by a different amount on each plane under the same markup.
    let cases: [(f64, f64, f64, f64, f64); 9] = [
        (0.0, 200.0, 1.0, 0.0, 0.0),        // at the core, full strength → total cancellation
        (100.0, 200.0, 1.0, 0.0, 0.75),     // quadratic, not linear: (1 − 0.5)² = 0.25 damped
        (200.0, 200.0, 1.0, 0.0, 1.0),      // at the rim → untouched, and smooth getting there
        (300.0, 200.0, 1.0, 0.0, 1.0),      // outside → untouched
        (0.0, 200.0, 1.0, 0.25, 0.25),      // the floor holds
        (50.0, 200.0, 0.5, 0.0, 0.71875),   // partial strength
        (0.0, 0.0, 1.0, 0.0, 1.0),          // range 0 shields nothing (NOT "global")
        (0.0, -5.0, 1.0, 0.0, 1.0),         // negative range likewise
        (100.0, 200.0, 2.0, 0.0, 0.5),      // strength > 1 still clamps into [min, 1]
    ];
    for (d, range, strength, min, want) in cases {
        let got = screen_factor(d, range, strength, min);
        assert!(
            (got - want).abs() < 1e-15,
            "screen_factor({d}, {range}, {strength}, {min}) = {got}, JS says {want}"
        );
    }
}

// ── the cross-body behaviour ─────────────────────────────────────────────────

fn attract_at(x: f64, y: f64) -> Body {
    Body {
        tokens: vec!["attract".into()],
        range: 300.0,
        strength: 1.0,
        center: Vec3::new(x, y, 0.0),
        ..Body::default()
    }
}

fn screen_at(x: f64, y: f64, range: f64, strength: f64) -> Body {
    Body {
        tokens: vec!["screen".into()],
        range,
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

/// Run `frames` steps and return each particle's displacement from where it started.
fn displacements(bodies: Vec<Body>, particles: Vec<Particle>, frames: usize) -> Vec<f64> {
    let reg = Registry::standard();
    let mut env = Env::default();
    let mut bodies = bodies;
    let mut store = FieldStore::new();
    let start: Vec<Vec3> = particles.iter().map(|p| p.position).collect();
    for p in particles {
        store.add(p);
    }
    for _ in 0..frames {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    store
        .particles
        .iter()
        .zip(start.iter())
        .map(|(p, s)| {
            let dx = p.position.x - s.x;
            let dy = p.position.y - s.y;
            let dz = p.position.z - s.z;
            (dx * dx + dy * dy + dz * dz).sqrt()
        })
        .collect()
}

#[test]
fn a_quiet_zone_damps_a_neighbouring_attractor() {
    // Mirrors the cross-plane conformance scenario: two identical attract wells act on two identical
    // particles; one particle sits at a screen's core (factor → 0), the other pair is far outside it.
    let d = displacements(
        vec![
            screen_at(0.0, 0.0, 200.0, 1.0),
            attract_at(150.0, 0.0),    // shielded pair
            attract_at(150.0, 1200.0), // free pair
        ],
        vec![at(0.0, 0.0), at(0.0, 1200.0)],
        30,
    );
    let (inside, outside) = (d[0], d[1]);
    assert!(outside > 1.0, "the free particle actually moves: {outside}");
    assert!(
        inside < outside * 0.05,
        "matter in the quiet zone is attenuated: inside {inside:.3}px vs outside {outside:.3}px"
    );
}

#[test]
fn a_screen_never_damps_its_own_siblings() {
    // A body carrying BOTH screen and attract must still attract at full strength — the attenuation
    // is cross-body by definition. Without the index check this body would shield itself to a halt.
    let mut both = attract_at(0.0, 0.0);
    both.tokens = vec!["attract".into(), "screen".into()];
    both.range = 300.0;
    both.strength = 1.0;
    let with_screen = displacements(vec![both], vec![at(120.0, 0.0)], 30);
    let plain = displacements(vec![attract_at(0.0, 0.0)], vec![at(120.0, 0.0)], 30);
    assert!(
        (with_screen[0] - plain[0]).abs() < 1e-12,
        "a self-screening body attracts exactly as the plain one: {:?} vs {:?}",
        with_screen[0],
        plain[0]
    );
}

#[test]
fn a_screen_with_no_radius_shields_nothing() {
    // range 0 is NOT "global" for a screen — a quiet zone with no radius is inert, and the field must
    // be bit-identical to one with no screen at all.
    let neutral = displacements(
        vec![screen_at(0.0, 0.0, 0.0, 1.0), attract_at(150.0, 0.0)],
        vec![at(0.0, 0.0)],
        30,
    );
    let none = displacements(vec![attract_at(150.0, 0.0)], vec![at(0.0, 0.0)], 30);
    assert_eq!(neutral[0], none[0], "an inert screen changes nothing");
}

#[test]
fn matter_outside_the_quiet_zone_is_untouched() {
    // The rim is smooth and the outside is exactly unshielded — a particle beyond the screen's range
    // must move precisely as it would with no screen present.
    let shielded = displacements(
        vec![screen_at(0.0, 0.0, 100.0, 1.0), attract_at(500.0, 0.0)],
        vec![at(400.0, 0.0)], // 400 from the screen, well outside its 100 range
        30,
    );
    let free = displacements(vec![attract_at(500.0, 0.0)], vec![at(400.0, 0.0)], 30);
    assert_eq!(shielded[0], free[0], "outside the radius, nothing is damped");
}

#[test]
fn an_invisible_screen_does_not_shield() {
    // Visibility gates the pass, matching JS (`b.vis`) and Swift (`b.isVisible`).
    let mut hidden = screen_at(0.0, 0.0, 200.0, 1.0);
    hidden.visible = false;
    let with_hidden = displacements(
        vec![hidden, attract_at(150.0, 0.0)],
        vec![at(0.0, 0.0)],
        30,
    );
    let none = displacements(vec![attract_at(150.0, 0.0)], vec![at(0.0, 0.0)], 30);
    assert_eq!(with_hidden[0], none[0], "a hidden screen shields nothing");
}

#[test]
fn the_attenuation_floor_is_respected() {
    // screen_min leaves a share of the neighbour's force intact: a floored screen must damp LESS than
    // an unfloored one, and still less than no screen at all.
    let mut floored = screen_at(0.0, 0.0, 200.0, 1.0);
    floored.screen_min = 0.5;
    let d_floored = displacements(
        vec![floored, attract_at(150.0, 0.0)],
        vec![at(0.0, 0.0)],
        30,
    )[0];
    let d_full = displacements(
        vec![screen_at(0.0, 0.0, 200.0, 1.0), attract_at(150.0, 0.0)],
        vec![at(0.0, 0.0)],
        30,
    )[0];
    let d_none = displacements(vec![attract_at(150.0, 0.0)], vec![at(0.0, 0.0)], 30)[0];
    assert!(
        d_full < d_floored && d_floored < d_none,
        "floor 0.5 sits between total shielding and none: {d_full:.4} < {d_floored:.4} < {d_none:.4}"
    );
}
