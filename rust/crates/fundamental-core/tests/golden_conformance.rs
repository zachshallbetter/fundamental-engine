//! Cross-plane conformance (#526) — the Rust engine must reproduce the JS engine's force math.
//!
//! Loads the **shared** golden emitted by `scripts/gen-conformance-golden.mjs` (the same fixture the
//! Swift `GoldenConformanceTests` consumes): the canonical deterministic forces fired at a fan of
//! probe particles, each with its frame-0 velocity delta (`dv`) as computed by the f64 JS engine.
//! Here the f64 Rust engine applies the same force to the same reconstructed inputs and must land on
//! the same `dv`.
//!
//! Because the Rust plane is also f64 (unlike the f32 Swift/Kotlin ports), the tolerance is tight:
//! ~machine-epsilon, not the ports' 2e-4. A real divergence — a wrong coefficient, a missing falloff
//! leg, a sign flip — blows well past it. When this fails, fix the Rust force; never loosen the
//! tolerance to hide it.
//!
//! Single source of truth: the fixture is embedded from the committed Swift path so the two planes
//! can never test different goldens. (Follow-up: teach the generator to also emit a crate-local copy
//! so a published `fundamental-core` is self-contained.)

use fundamental_core::engine::{Body, Env, Particle, Registry};
use fundamental_core::math::Vec3;
use serde::Deserialize;

const GOLDEN: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../swift/Tests/FundamentalCoreTests/Fixtures/conformance-golden.json"
));

#[derive(Deserialize)]
struct Golden {
    count: usize,
    cases: Vec<Case>,
}

#[derive(Deserialize)]
struct Case {
    force: String,
    label: String,
    px: f64,
    py: f64,
    body: BodyJson,
    env: EnvJson,
    particle: Vel,
    dv: Dv,
}

#[derive(Deserialize)]
struct BodyJson {
    strength: f64,
    range: f64,
    spin: f64,
    ux: f64,
    uy: f64,
    on: bool,
}

#[derive(Deserialize)]
struct EnvJson {
    dx: f64,
    dy: f64,
    dz: f64,
    dist: f64,
    orbit: f64,
}

#[derive(Deserialize)]
struct Vel {
    vx: f64,
    vy: f64,
    vz: f64,
}

#[derive(Deserialize)]
struct Dv {
    x: f64,
    y: f64,
    z: f64,
}

#[test]
fn cross_plane_conformance() {
    let golden: Golden = serde_json::from_str(GOLDEN).expect("parse conformance-golden.json");
    assert_eq!(golden.cases.len(), golden.count);
    assert!(golden.count > 0);

    let reg = Registry::standard();
    let mut checked = 0usize;

    for c in &golden.cases {
        // Every force the golden exercises must be registered — a missing one is a real gap, not a
        // silent skip. (The golden covers the six deterministic forces; the registry also holds
        // jet/wall/sink, which the golden does not pin because they are stochastic/stateful.)
        let force = reg
            .get(&c.force)
            .unwrap_or_else(|| panic!("golden force '{}' is not registered", c.force));

        // Reconstruct the exact inputs the JS apply saw (body at the origin; matches the emitter).
        let mut body = Body {
            tokens: vec![c.force.clone()],
            strength: c.body.strength,
            range: c.body.range,
            spin: c.body.spin,
            heading: Vec3::new(c.body.ux, c.body.uy, 0.0),
            ..Body::default()
        };
        body.engaged = c.body.on;

        let mut p = Particle {
            position: Vec3::new(c.px, c.py, 0.0),
            velocity: Vec3::new(c.particle.vx, c.particle.vy, c.particle.vz),
            ..Particle::default()
        };

        let mut e = Env {
            vector: Vec3::new(c.env.dx, c.env.dy, c.env.dz),
            dist: c.env.dist,
            ..Env::default()
        };
        e.form.orbit = c.env.orbit;

        let v0 = p.velocity;
        force.apply(&body, &mut p, &mut e);
        let dv = p.velocity - v0;
        let want = Vec3::new(c.dv.x, c.dv.y, c.dv.z);

        let tol = 1e-9 + 1e-9 * want.length();
        let err = (dv - want).length();
        assert!(
            err <= tol,
            "{}/{} @({},{}): Rust dv=({},{},{}) vs JS ({},{},{}) — err {:e} > tol {:e}",
            c.force,
            c.label,
            c.px,
            c.py,
            dv.x,
            dv.y,
            dv.z,
            want.x,
            want.y,
            want.z,
            err,
            tol
        );
        checked += 1;
    }

    // No case was skipped: every one of the 120 was reconstructed and checked.
    assert_eq!(checked, golden.count, "every golden case must be checked");
}
