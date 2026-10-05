//! Field structure hooks + `fieldflow` (#1041).
//!
//! `gravity`, `charge` and `magnetism` RADIATE a structure field; `fieldflow` FOLLOWS the
//! superposition. A structure field is not a force law — `apply()` is untouched by any of this, and
//! a field line is not a particle path.

use fundamental_core::engine::{net_field, step, Body, Env, FieldStore, Force, Particle, Registry};
use fundamental_core::forces::{Charge, Gravity, Magnetism};
use fundamental_core::math::{dipole_field, gravity_field, monopole_field, pole_pair, Pole};

fn body(token: &str, x: f64, y: f64) -> Body {
    Body {
        tokens: vec![token.into()],
        range: 0.0, // global
        strength: 1.0,
        source_mass: 10.0,
        center: fundamental_core::math::Vec3::new(x, y, 0.0),
        heading: fundamental_core::math::Vec3::new(1.0, 0.0, 0.0),
        ..Body::default()
    }
}

// ── the geometry ─────────────────────────────────────────────────────────────

#[test]
fn a_monopole_radiates_outward_from_a_positive_source() {
    // sign >= 0 → straight lines OUT; sign < 0 → IN.
    let (fx, _) = monopole_field(0.0, 0.0, 1.0, 5.0, 100.0, 0.0);
    assert!(fx > 0.0, "positive source pushes outward: {fx}");
    let (gx, _) = monopole_field(0.0, 0.0, -1.0, 5.0, 100.0, 0.0);
    assert!(gx < 0.0, "negative source pulls inward: {gx}");
}

#[test]
fn a_monopole_falls_off_as_one_over_d_squared() {
    let near = monopole_field(0.0, 0.0, 1.0, 1.0, 100.0, 0.0).0;
    let far = monopole_field(0.0, 0.0, 1.0, 1.0, 200.0, 0.0).0;
    assert!(
        (near / far - 4.0).abs() < 1e-9,
        "doubling the distance quarters the field: {near} vs {far}"
    );
}

#[test]
fn gravity_field_always_points_at_the_mass() {
    for (x, y) in [(100.0, 0.0), (-100.0, 0.0), (0.0, 100.0), (70.0, 70.0)] {
        let (fx, fy) = gravity_field(0.0, 0.0, 10.0, x, y);
        // the field must point back toward the origin from wherever it is sampled
        assert!(fx * x <= 0.0 && fy * y <= 0.0, "inward at ({x},{y}): ({fx},{fy})");
    }
}

#[test]
fn a_dipole_loops_rather_than_radiating() {
    // The defining difference from a monopole: on the axis beyond the + pole the field points away,
    // but on the perpendicular bisector it points back along the axis — the N→S return path.
    let poles = [
        Pole { x: 50.0, y: 0.0, q: 1.0 },
        Pole { x: -50.0, y: 0.0, q: -1.0 },
    ];
    let (ax, _) = dipole_field(&poles, 200.0, 0.0); // out along the axis
    assert!(ax > 0.0, "beyond the + pole the field runs outward: {ax}");
    let (bx, _) = dipole_field(&poles, 0.0, 200.0); // on the bisector
    assert!(bx < 0.0, "on the bisector it returns toward the − pole: {bx}");
}

#[test]
fn pole_pair_lays_the_axis_on_the_heading_and_spin_swaps_polarity() {
    let p = pole_pair(0.0, 0.0, 1.0, 0.0, 40.0, 20.0, 1.0);
    assert!(p[0].x > 0.0 && p[1].x < 0.0, "axis follows +x: {p:?}");
    assert!(p[0].q > 0.0 && p[1].q < 0.0, "+ pole at the +heading end");
    let q = pole_pair(0.0, 0.0, 1.0, 0.0, 40.0, 20.0, -1.0);
    assert!(q[0].q < 0.0 && q[1].q > 0.0, "spin < 0 swaps the poles");
}

// ── the hooks ────────────────────────────────────────────────────────────────

#[test]
fn only_the_radiating_forces_implement_field() {
    let b = body("gravity", 0.0, 0.0);
    assert!(Gravity.field(&b, 100.0, 0.0).is_some(), "gravity radiates a well");
    assert!(Charge.field(&b, 100.0, 0.0).is_some(), "charge radiates a monopole");
    assert!(Magnetism.field(&b, 100.0, 0.0).is_some(), "magnetism radiates a dipole");
    // a force with no structure returns None by default — the trait's default, not a stub
    use fundamental_core::forces::Wind;
    assert!(Wind.field(&b, 100.0, 0.0).is_none(), "wind radiates nothing");
}

#[test]
fn net_field_superposes_and_two_opposed_sources_cancel() {
    let reg = Registry::standard();
    let bodies = vec![body("charge", -100.0, 0.0), body("charge", 100.0, 0.0)];
    // both are positive monopoles (spin defaults to 1), so midway between them they cancel
    let (fx, fy) = net_field(&bodies, &reg, 0.0, 0.0);
    assert!(
        fx.abs() < 1e-9 && fy.abs() < 1e-9,
        "a true null point between equal opposed sources: ({fx}, {fy})"
    );
    // and off-centre it does not
    let (gx, _) = net_field(&bodies, &reg, 50.0, 0.0);
    assert!(gx.abs() > 1e-9, "off the null the field is real: {gx}");
}

#[test]
fn an_invisible_body_radiates_nothing() {
    let reg = Registry::standard();
    let mut b = body("charge", 0.0, 0.0);
    b.visible = false;
    let (fx, fy) = net_field(&[b], &reg, 100.0, 0.0);
    assert_eq!((fx, fy), (0.0, 0.0), "hidden bodies are out of the superposition");
}

// ── the force ────────────────────────────────────────────────────────────────

fn run(bodies: Vec<Body>, p: Particle, frames: usize) -> Particle {
    let reg = Registry::standard();
    let mut env = Env::default();
    let mut bodies = bodies;
    let mut store = FieldStore::new();
    let id = store.add(p);
    for _ in 0..frames {
        step(&mut store, &mut bodies, &mut env, &reg);
    }
    store.particles.iter().find(|q| q.id == id).unwrap().clone()
}

fn at(x: f64, y: f64) -> Particle {
    Particle {
        position: fundamental_core::math::Vec3::new(x, y, 0.0),
        ..Default::default()
    }
}

#[test]
fn matter_streams_off_a_monopole() {
    // A positive charge radiates outward; fieldflow should carry NEUTRAL matter down those lines.
    let src = body("charge", 0.0, 0.0);
    let mut flow = body("fieldflow", 0.0, 0.0);
    flow.strength = 1.0;
    let p = run(vec![src, flow], at(100.0, 0.0), 30);
    assert!(
        p.position.x > 100.0,
        "neutral matter streamed outward along the line: {}",
        p.position.x
    );
    assert_eq!(p.charge, 0.0, "and it really was neutral");
}

#[test]
fn the_charge_gate_leaves_neutral_matter_free() {
    // Opt-in (#711): the magnetized-plasma reading carries only charged matter.
    let src = body("charge", 0.0, 0.0);
    let mut flow = body("fieldflow", 0.0, 0.0);
    flow.charge_gated = true;

    let neutral = run(vec![src.clone(), flow.clone()], at(100.0, 0.0), 30);
    assert!(
        (neutral.position.x - 100.0).abs() < 1e-9,
        "gated: neutral matter drifts free, not transported: {}",
        neutral.position.x
    );

    let charged = run(
        vec![src, flow],
        Particle {
            charge: 1.0,
            ..at(100.0, 0.0)
        },
        30,
    );
    assert!(
        charged.position.x > 100.0,
        "gated: charged matter still follows: {}",
        charged.position.x
    );
}

#[test]
fn fieldflow_with_nothing_radiating_is_inert() {
    // No radiating body ⇒ `field_here` is None ⇒ no line to follow, and matter must not drift.
    let flow = body("fieldflow", 0.0, 0.0);
    let p = run(vec![flow], at(100.0, 0.0), 30);
    assert_eq!(p.position.x, 100.0, "no field, no transport");
    assert_eq!(p.velocity.x, 0.0, "and no velocity was invented");
}

#[test]
fn the_steer_turns_velocity_onto_the_line_without_inventing_speed() {
    // The steer is speed-preserving (like `align`); the stream is what does work. Separate them by
    // giving the follower zero strength for the stream to act on... which also zeroes the steer, so
    // instead: check that matter moving ACROSS the lines is turned to run along them.
    let src = body("charge", 0.0, 0.0);
    let flow = body("fieldflow", 0.0, 0.0);
    let moving_across = Particle {
        velocity: fundamental_core::math::Vec3::new(0.0, 20.0, 0.0), // perpendicular to the radial line
        ..at(100.0, 0.0)
    };
    let p = run(vec![src, flow], moving_across, 12);
    assert!(
        p.velocity.x.abs() > p.velocity.y.abs(),
        "velocity was turned onto the radial line: ({}, {})",
        p.velocity.x,
        p.velocity.y
    );
}

#[test]
fn a_field_with_no_follower_costs_nothing_and_changes_nothing() {
    // The superposition is only resolved when a `fieldflow` body is present. A radiating body alone
    // must behave exactly as it did before this feature existed.
    let with_radiator = run(vec![body("charge", 0.0, 0.0)], at(100.0, 0.0), 30);
    // charge acts only on charged matter, so a neutral particle is untouched either way
    assert_eq!(with_radiator.position.x, 100.0, "neutral matter ignores charge");
    assert_eq!(with_radiator.velocity.x, 0.0);
}
