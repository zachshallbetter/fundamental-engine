//! The CMS reading layer — scores, clusters, relations (#1044).
//!
//! These read a SETTLED field. `Body::count` is a per-frame accumulator the integrator zeroes at the
//! top of every step, so a score describes the frame just run — read it after `solve` returns, or the
//! number means something other than it looks like.

use fundamental_core::engine::{solve, Body, Env, FieldStore, Particle, Registry, SolveOptions};
use fundamental_core::math::Vec3;
use fundamental_core::reading::{attribute, clusters, ranked, related_to, relations, scores};

fn body_at(x: f64, y: f64, strength: f64) -> Body {
    Body {
        tokens: vec!["attract".into()],
        range: 320.0,
        strength,
        feedback: true, // density is measured only where a body asks for it
        center: Vec3::new(x, y, 0.0),
        ..Body::default()
    }
}

fn settle(bodies: Vec<Body>, n: usize) -> (FieldStore, Vec<Body>) {
    let reg = Registry::standard();
    let mut env = Env {
        volume: Vec3::new(800.0, 600.0, 0.0),
        rng: fundamental_core::record::Rng::seeded(1),
        ..Env::default()
    };
    let mut bodies = bodies;
    let mut store = FieldStore::new();
    for i in 0..n {
        let t = (i as f64 + 0.5) / n as f64;
        let u = ((i as f64) * 0.618_033_988_749_895).fract();
        store.add(Particle {
            position: Vec3::new(u * 800.0, t * 600.0, 0.0),
            ..Default::default()
        });
    }
    solve(&mut store, &mut bodies, &mut env, &reg, SolveOptions::default());
    (store, bodies)
}

// ── scores ───────────────────────────────────────────────────────────────────

#[test]
fn a_stronger_body_scores_higher() {
    let (_, bodies) = settle(vec![body_at(200.0, 300.0, 0.3), body_at(600.0, 300.0, 2.0)], 300);
    let r = ranked(&bodies);
    assert_eq!(r[0].index, 1, "the strong body leads: {r:?}");
    assert!(r[0].raw > r[1].raw, "and by a real margin");
}

#[test]
fn normalization_puts_the_leader_at_one_and_never_divides_by_zero() {
    let (_, bodies) = settle(vec![body_at(200.0, 300.0, 0.3), body_at(600.0, 300.0, 2.0)], 300);
    let r = ranked(&bodies);
    assert!((r[0].normalized - 1.0).abs() < 1e-12, "leader normalizes to 1");
    assert!(r.iter().all(|s| (0.0..=1.0).contains(&s.normalized)));

    // a field where nothing gathered has no leader — and must not produce NaN by inventing one
    let empty = vec![body_at(200.0, 300.0, 1.0)];
    let s = scores(&empty);
    assert_eq!(s[0].raw, 0.0);
    assert_eq!(s[0].normalized, 0.0, "all-zero input yields zero, not NaN");
}

#[test]
fn ties_keep_the_callers_order_so_a_rebuild_does_not_reshuffle() {
    // Three identical bodies far apart: equal scores, and the ranking must stay in input order.
    let bodies = vec![body_at(100.0, 100.0, 1.0), body_at(400.0, 100.0, 1.0), body_at(700.0, 100.0, 1.0)];
    let r = ranked(&bodies); // un-run: every count is 0, so every score ties
    assert_eq!(r.iter().map(|s| s.index).collect::<Vec<_>>(), vec![0, 1, 2]);
}

#[test]
fn scores_are_attributed_to_the_callers_index() {
    let (_, bodies) = settle(vec![body_at(200.0, 300.0, 1.0), body_at(600.0, 300.0, 1.0)], 200);
    let s = scores(&bodies);
    assert_eq!(s.len(), bodies.len(), "one reading per body");
    assert_eq!(s.iter().map(|x| x.index).collect::<Vec<_>>(), vec![0, 1], "in the caller's order");
}

// ── clusters ─────────────────────────────────────────────────────────────────

#[test]
fn matter_that_settled_apart_clusters_apart() {
    // Two wells far enough apart that their basins cannot touch.
    let (store, bodies) = settle(vec![body_at(150.0, 300.0, 2.0), body_at(650.0, 300.0, 2.0)], 300);
    let cs = clusters(&store, 26.0, 8);
    assert!(cs.len() >= 2, "the two basins are separate clusters: {}", cs.len());
    // and each attributes to a different body
    let a = attribute(&cs[0], &bodies);
    let b = attribute(&cs[1], &bodies);
    assert!(a.is_some() && b.is_some() && a != b, "each basin names its own body: {a:?} {b:?}");
}

#[test]
fn clusters_are_ordered_largest_first_and_specks_are_dropped() {
    let (store, _) = settle(vec![body_at(150.0, 300.0, 2.0), body_at(650.0, 300.0, 2.0)], 300);
    let cs = clusters(&store, 26.0, 8);
    for w in cs.windows(2) {
        assert!(w[0].size() >= w[1].size(), "descending by size");
    }
    assert!(cs.iter().all(|c| c.size() >= 8), "min_size drops the specks");
}

#[test]
fn clustering_is_stable_across_runs() {
    // A rebuild of unchanged content must not reshuffle what belongs together.
    let run = || {
        let (store, _) = settle(vec![body_at(150.0, 300.0, 2.0), body_at(650.0, 300.0, 2.0)], 300);
        clusters(&store, 26.0, 8)
    };
    assert_eq!(run(), run(), "same field in, same clusters out");
}

#[test]
fn an_empty_or_degenerate_field_clusters_to_nothing() {
    let store = FieldStore::new();
    assert!(clusters(&store, 26.0, 1).is_empty(), "no matter, no clusters");
    let (full, _) = settle(vec![body_at(400.0, 300.0, 1.0)], 50);
    assert!(clusters(&full, 0.0, 1).is_empty(), "a zero radius groups nothing");
}

// ── relations ────────────────────────────────────────────────────────────────

#[test]
fn nearer_bodies_relate_more_strongly() {
    let bodies = vec![body_at(100.0, 100.0, 1.0), body_at(160.0, 100.0, 1.0), body_at(700.0, 100.0, 1.0)];
    let rs = relations(&bodies, 1000.0, 320.0);
    assert_eq!((rs[0].a, rs[0].b), (0, 1), "the close pair leads: {rs:?}");
    for w in rs.windows(2) {
        assert!(w[0].strength >= w[1].strength, "descending by strength");
    }
    assert!(rs.iter().all(|r| r.strength > 0.0 && r.strength <= 1.0), "bounded in (0,1]");
}

#[test]
fn the_within_threshold_excludes_distant_pairs() {
    let bodies = vec![body_at(100.0, 100.0, 1.0), body_at(160.0, 100.0, 1.0), body_at(700.0, 100.0, 1.0)];
    let rs = relations(&bodies, 100.0, 320.0);
    assert_eq!(rs.len(), 1, "only the close pair survives: {rs:?}");
}

#[test]
fn relations_are_symmetric_and_never_self_referential() {
    let bodies = vec![body_at(100.0, 100.0, 1.0), body_at(160.0, 100.0, 1.0)];
    let rs = relations(&bodies, 1000.0, 320.0);
    assert!(rs.iter().all(|r| r.a != r.b), "no body relates to itself");
    assert_eq!(rs.len(), 1, "each pair appears once, not twice");
}

#[test]
fn related_to_returns_only_that_bodys_edges() {
    let bodies = vec![body_at(100.0, 100.0, 1.0), body_at(160.0, 100.0, 1.0), body_at(220.0, 100.0, 1.0)];
    let rs = related_to(&bodies, 0, 5, 1000.0, 320.0);
    assert!(!rs.is_empty());
    assert!(rs.iter().all(|r| r.a == 0 || r.b == 0), "every edge touches body 0: {rs:?}");
}
