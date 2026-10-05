//! A CMS rebuild, end to end (#1044).
//!
//!     content records → bodies → solve() → scores / clusters / relations, with a receipt
//!
//! The point of running a field over content rather than scoring it directly: the ranking is produced
//! by matter settling under every record's influence at once, so a record's score reflects its
//! NEIGHBOURHOOD, not just its own declared importance.
//!
//! You can read that straight off the output. "Changelog v0.9" is declared LESS important than
//! "Deep-dive" (0.45 against 0.80) and still outranks it, because it sits between the other two
//! records in the launch cluster and inherits the matter they gather. A flat weighting cannot express
//! that; it would put Deep-dive second by construction and never notice the neighbourhood.
//!
//!     cargo run --example cms -p fundamental-core

use fundamental_core::engine::{solve, Body, Env, FieldStore, Particle, Registry, SolveOptions};
use fundamental_core::math::Vec3;
use fundamental_core::reading::{clusters, ranked, relations};
use fundamental_core::record::{FieldSnapshot, Rng};

/// A content record, as a CMS already has it.
struct Doc {
    title: &'static str,
    /// Editorial importance, 0..1 — becomes the body's mass.
    importance: f64,
    at: (f64, f64),
}

fn main() {
    // ── the content ──────────────────────────────────────────────────────────
    let docs = [
        Doc { title: "Launch announcement",        importance: 1.00, at: (250.0, 200.0) },
        Doc { title: "Deep-dive: the field engine", importance: 0.80, at: (310.0, 240.0) },
        Doc { title: "Changelog v0.9",             importance: 0.45, at: (290.0, 170.0) },
        Doc { title: "About the author",           importance: 0.40, at: (640.0, 440.0) },
        Doc { title: "Archived note",              importance: 0.05, at: (700.0, 120.0) },
    ];

    // ── bind: a record becomes a body. Importance is MASS, so a heavier record gathers more matter.
    let mut bodies: Vec<Body> = docs
        .iter()
        .map(|d| Body {
            // `attract` rather than `gravity`: the designed force has a finite range and a soft
            // falloff, so the field SETTLES. True inverse-square gravity orbits forever, and a CMS
            // rebuild that never reaches equilibrium has no settled state to read.
            tokens: vec!["attract".into()],
            range: 320.0,
            strength: 0.3 + d.importance * 1.2,
            source_mass: 0.2 + d.importance * 2.0,
            feedback: true, // the engine only measures density at a body that asks
            center: Vec3::new(d.at.0, d.at.1, 0.0),
            ..Body::default()
        })
        .collect();

    // ── the field ────────────────────────────────────────────────────────────
    let reg = Registry::standard();
    let mut env = Env {
        volume: Vec3::new(800.0, 600.0, 0.0),
        rng: Rng::seeded(1),
        ..Env::default()
    };
    let mut store = FieldStore::new();
    let n = 400;
    for i in 0..n {
        // a deterministic spread — a seeded shuffle would still depend on how many draws preceded it
        let t = (i as f64 + 0.5) / n as f64;
        let u = ((i as f64) * 0.618_033_988_749_895).fract();
        store.add(Particle {
            position: Vec3::new(u * 800.0, t * 600.0, 0.0),
            ..Default::default()
        });
    }

    // the receipt: everything needed to re-run this exact rebuild
    let receipt = FieldSnapshot::capture(&store, &bodies, &env);

    let result = solve(&mut store, &mut bodies, &mut env, &reg, SolveOptions::default());

    // ── read ─────────────────────────────────────────────────────────────────
    println!("settled: {} in {} steps\n", if result.settled { "yes" } else { "NO — hit the cap" }, result.iterations);

    println!("scores");
    for s in ranked(&bodies) {
        println!("  {:>5.3}  {}", s.normalized, docs[s.index].title);
    }

    println!("\nclusters (radius 26, min 8)");
    for (i, c) in clusters(&store, 26.0, 8).iter().enumerate().take(4) {
        let near = fundamental_core::reading::attribute(c, &bodies)
            .map(|b| docs[b].title)
            .unwrap_or("—");
        println!("  #{i}  {:>4} particles  nearest: {near}", c.size());
    }

    println!("\nrelations (within 200px)");
    for r in relations(&bodies, 200.0, 320.0).iter().take(4) {
        println!("  {:>5.3}  {} ↔ {}", r.strength, docs[r.a].title, docs[r.b].title);
    }

    // ── the receipt answers "why did this rank here" by re-running it ────────
    let again = fundamental_core::record::replay(&receipt, result.iterations, &reg);
    let same = ranked(&again.bodies)
        .iter()
        .zip(ranked(&bodies).iter())
        .all(|(x, y)| x.index == y.index);
    println!("\nreceipt: replaying {} steps reproduces the ranking — {}", result.iterations, same);
}
