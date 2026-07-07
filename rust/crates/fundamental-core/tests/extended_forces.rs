//! The class-[A] extended forces + the parity count + colour helpers.

use fundamental_core::engine::{Body, Env, Force, Particle, Registry};
use fundamental_core::forces::extended::curl_noise;
use fundamental_core::forces::{Buoyancy, Crystallize, Gate, Lens, Pigment, Shear, Warp, Wind};
use fundamental_core::math::{hex_to_rgb, mix_hex, rgb_to_hex, Vec3};

fn body(tokens: &[&str]) -> Body {
    Body {
        tokens: tokens.iter().map(|s| s.to_string()).collect(),
        center: Vec3::new(400.0, 300.0, 0.0),
        ..Body::default()
    }
}

fn env_at(vector: Vec3, dist: f64) -> Env {
    Env {
        vector,
        dist,
        ..Env::default()
    }
}

#[test]
fn lens_preserves_speed() {
    let b = body(&["lens"]);
    let v0 = Vec3::new(3.0, -2.0, 0.0);
    let mut p = Particle {
        velocity: v0,
        ..Default::default()
    };
    let mut e = env_at(Vec3::new(-100.0, 0.0, 0.0), 100.0);
    Lens.apply(&b, &mut p, &mut e);
    assert!(
        (p.velocity.length() - v0.length()).abs() < 1e-12,
        "a lens bends without adding energy"
    );
    assert_ne!(p.velocity, v0);
}

#[test]
fn gate_reflects_wrong_way_passes_right_way() {
    let mut b = body(&["gate"]);
    b.half_extents = Vec3::new(50.0, 20.0, 0.0);
    b.heading = Vec3::new(1.0, 0.0, 0.0); // membrane normal points +x

    // moving against the heading → reflected to travel with it.
    let mut wrong = Particle {
        position: Vec3::new(400.0, 300.0, 0.0),
        velocity: Vec3::new(-1.0, 0.0, 0.0),
        ..Default::default()
    };
    let mut e = Env::default();
    Gate.apply(&b, &mut wrong, &mut e);
    assert!(wrong.velocity.x > 0.0, "wrong-way crossers are reflected");

    // moving with the heading → passes untouched.
    let mut right = Particle {
        position: Vec3::new(400.0, 300.0, 0.0),
        velocity: Vec3::new(1.0, 0.0, 0.0),
        ..Default::default()
    };
    Gate.apply(&b, &mut right, &mut e);
    assert_eq!(right.velocity.x, 1.0, "right-way matter passes freely");
}

#[test]
fn buoyancy_light_rises_dense_settles() {
    let mut b = body(&["buoyancy"]);
    b.range = 0.0; // global

    // hot + unit size → lighter than the medium → rises (−y).
    let mut light = Particle {
        heat: 1.0,
        size: 1.0,
        ..Default::default()
    };
    let mut e = env_at(Vec3::ZERO, 1.0);
    Buoyancy.apply(&b, &mut light, &mut e);
    assert!(light.velocity.y < 0.0, "hot/large matter rises");

    // small + cool → denser than the medium → sinks (+y).
    let mut dense = Particle {
        heat: 0.0,
        size: 0.5,
        ..Default::default()
    };
    Buoyancy.apply(&b, &mut dense, &mut e);
    assert!(dense.velocity.y > 0.0, "dense matter settles");
}

#[test]
fn shear_drags_opposite_sides_oppositely() {
    let b = body(&["shear"]); // heading +x, flow axis x; perpendicular offset is along y
    let mut above = Particle {
        position: Vec3::new(400.0, 350.0, 0.0),
        ..Default::default()
    };
    let mut below = Particle {
        position: Vec3::new(400.0, 250.0, 0.0),
        ..Default::default()
    };
    let mut e = env_at(Vec3::new(0.0, -50.0, 0.0), 50.0);
    Shear.apply(&b, &mut above, &mut e);
    let mut e = env_at(Vec3::new(0.0, 50.0, 0.0), 50.0);
    Shear.apply(&b, &mut below, &mut e);
    assert!(
        above.velocity.x * below.velocity.x < 0.0,
        "laminae on opposite sides slide opposite ways: {} vs {}",
        above.velocity.x,
        below.velocity.x
    );
}

#[test]
fn crystallize_snaps_cool_frees_hot() {
    let b = body(&["crystallize"]);
    // cool matter offset from a lattice node is pulled back toward it.
    let mut cool = Particle {
        position: Vec3::new(410.0, 305.0, 0.0),
        heat: 0.0,
        ..Default::default()
    };
    let mut e = env_at(Vec3::new(-10.0, -5.0, 0.0), 11.18);
    Crystallize.apply(&b, &mut cool, &mut e);
    assert!(
        cool.velocity.x < 0.0,
        "cool matter snaps toward the lattice node at the centre"
    );

    // hot matter has melted → moves freely (untouched).
    let mut hot = Particle {
        position: Vec3::new(410.0, 305.0, 0.0),
        heat: 0.9,
        ..Default::default()
    };
    Crystallize.apply(&b, &mut hot, &mut e);
    assert_eq!(hot.velocity, Vec3::ZERO, "hot matter is free");
}

#[test]
fn wind_is_curl_noise_and_deterministic() {
    let mut b = body(&["wind"]);
    b.range = 0.0; // global
    let mut p = Particle {
        position: Vec3::new(123.0, 456.0, 0.0),
        ..Default::default()
    };
    let mut e = Env {
        t: 10.0,
        ..Env::default()
    };
    Wind.apply(&b, &mut p, &mut e);
    let (cx, cy) = curl_noise(123.0, 456.0, 10.0, 0.01);
    assert_eq!(
        p.velocity,
        Vec3::new(cx, cy, 0.0),
        "wind advects by the curl-noise field"
    );
    assert_ne!(p.velocity, Vec3::ZERO);
}

#[test]
fn pigment_stains_overlapping_matter() {
    let mut b = body(&["pigment"]);
    b.range = 100.0;
    b.tint = Some("#ff0000".into());
    let mut p = Particle {
        position: Vec3::new(405.0, 300.0, 0.0),
        ..Default::default()
    };
    let mut e = env_at(Vec3::new(-5.0, 0.0, 0.0), 5.0); // dist 5 < range·0.6 = 60
    Pigment.apply(&b, &mut p, &mut e);
    assert_eq!(
        p.color.as_deref(),
        Some("#ff0000"),
        "matter takes on the pigment"
    );
}

#[test]
fn warp_relocates_matter_to_the_paired_throat() {
    let mut b = body(&["warp"]);
    b.warp_has = true;
    b.absorb_r = 30.0;
    b.warp_target = Vec3::new(700.0, 500.0, 0.0);
    b.twist = 0.0;
    b.warp_scale = 1.0;
    let mut p = Particle {
        position: Vec3::new(410.0, 300.0, 0.0),
        ..Default::default()
    };
    let mut e = env_at(Vec3::new(-10.0, 0.0, 0.0), 10.0); // within throat 30
    Warp.apply(&b, &mut p, &mut e);
    // emerges just outside the paired throat: target + (out_r, 0), out_r = 30·1 + 6 = 36.
    assert!((p.position.x - 736.0).abs() < 1e-9 && (p.position.y - 500.0).abs() < 1e-9);
    assert_eq!(p.heat, 0.6);
}

// ── parity + colour ──────────────────────────────────────────────────────────

#[test]
fn standard_registry_has_the_ported_catalog() {
    let reg = Registry::standard();
    assert_eq!(reg.len(), 21, "9 canonical + 4 natural + 8 extended");
    for tok in [
        "attract",
        "sink",
        "gravity",
        "charge",
        "magnetism",
        "thermal",
        "lens",
        "gate",
        "buoyancy",
        "shear",
        "crystallize",
        "wind",
        "pigment",
        "warp",
    ] {
        assert!(reg.get(tok).is_some(), "registry is missing '{tok}'");
    }
    // deferred forces are honestly absent (not silently stubbed).
    for tok in [
        "collide",
        "diffuse",
        "align",
        "cohesion",
        "spawn",
        "fieldflow",
    ] {
        assert!(
            reg.get(tok).is_none(),
            "'{tok}' should not be registered yet"
        );
    }
}

#[test]
fn color_helpers_roundtrip() {
    assert_eq!(hex_to_rgb("#ff8000"), Vec3::new(255.0, 128.0, 0.0));
    assert_eq!(rgb_to_hex(Vec3::new(255.0, 128.0, 0.0)), "#ff8000");
    assert_eq!(mix_hex("#000000", "#ffffff", 0.5), "#808080");
    assert_eq!(mix_hex("#ff0000", "#00ff00", 0.0), "#ff0000");
    // shorthand + fallback
    assert_eq!(hex_to_rgb("#f00"), Vec3::new(255.0, 0.0, 0.0));
    assert_eq!(hex_to_rgb("bogus"), fundamental_core::math::DEFAULT_ACCENT);
}
