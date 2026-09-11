//! A tiny CMS-shaped demo: rank "content" by **field gravity**.
//!
//! Each article becomes a `Body` whose importance sets how strongly it gathers the ambient field.
//! We seed deterministic matter, solve to (rough) equilibrium — the CMS "rebuild" — and read each
//! body's density (`Body::count`) back as an importance score. This is the "Gravity → importance"
//! Natural Field made concrete with today's API.
//!
//! Run: `cargo run --example ranking`
//!
//! What's still coming (tracked under epic #1036): a `solve(until_settled)` wrapper (#1042) so you
//! don't hand-roll the step loop, and a first-class reading layer for scores/clusters/relations
//! (#1044). This example uses only what has shipped.

use fundamental_core::{step, Body, Env, FieldStore, Particle, Registry, Rng, Vec3};

fn main() {
    let reg = Registry::standard();
    let mut env = Env {
        volume: Vec3::new(1200.0, 800.0, 0.0),
        ..Default::default()
    };

    // "Content": (title, importance weight). Importance drives the body's reach + pull.
    let articles = [
        ("Launch announcement", 3.0),
        ("Deep-dive: the field engine", 2.2),
        ("Changelog v0.9", 1.0),
        ("About the author", 0.6),
        ("Archived note", 0.3),
    ];
    let positions = [
        (300.0, 250.0),
        (850.0, 250.0),
        (300.0, 560.0),
        (850.0, 560.0),
        (575.0, 400.0),
    ];

    // Each article is an `attract` body with two-way feedback (so it samples its local density).
    let mut bodies: Vec<Body> = articles
        .iter()
        .zip(positions)
        .map(|((_, weight), (x, y))| Body {
            tokens: vec!["attract".into()],
            strength: *weight,
            range: 180.0 + *weight * 80.0, // more important → reaches further
            feedback: true,
            center: Vec3::new(x, y, 0.0),
            ..Default::default()
        })
        .collect();

    // Ambient matter — the field being gathered. Seeded RNG → a byte-identical run every time.
    let mut rng = Rng::seeded(42);
    let mut store = FieldStore::new();
    for _ in 0..600 {
        store.add(Particle {
            position: Vec3::new(rng.next_f64() * 1200.0, rng.next_f64() * 800.0, 0.0),
            ..Default::default()
        });
    }

    // Solve to (rough) equilibrium: run the tick until the field settles. (A `solve()` wrapper is #1042.)
    for _ in 0..600 {
        step(&mut store, &mut bodies, &mut env, &reg);
    }

    // Read `Body::count` (local density) back as the importance score, and rank.
    let mut ranked: Vec<(&str, f64)> = articles
        .iter()
        .zip(&bodies)
        .map(|((title, _), b)| (*title, b.count))
        .collect();
    ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

    println!("Ranked by field gravity (importance ← how much of the field each body gathers):\n");
    for (i, (title, score)) in ranked.iter().enumerate() {
        println!("  {}. {:<32}  score {:6.1}", i + 1, title, score);
    }
}
