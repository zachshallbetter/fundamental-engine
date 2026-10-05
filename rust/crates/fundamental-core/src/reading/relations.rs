//! Relations — "related content", read out of the settled field (#1044).
//!
//! Two bodies are related when they are near each other **in the field**, which is not the same as
//! being near in the input: a body's position is where the host put it, but what settles around it is
//! the product of every force acting on it. Proximity after `solve` therefore carries information the
//! inputs did not.
//!
//! Symmetric by construction — relatedness is not directional here, and an asymmetric "A relates to B
//! but B does not relate to A" is an artifact of top-k truncation rather than a fact about the field.
//! Callers wanting recommendations take the top-k per body from a symmetric set.

use crate::engine::Body;

/// One derived edge between two bodies.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Relation {
    pub a: usize,
    pub b: usize,
    /// Centre-to-centre distance in the settled field.
    pub distance: f64,
    /// `1 / (1 + distance/scale)` — a bounded closeness in `(0,1]`, so a caller can rank or threshold
    /// without knowing the field's units. Monotonically decreasing in distance, never negative, and
    /// never divides by zero.
    pub strength: f64,
}

/// Every pair closer than `within`, strongest first.
///
/// `scale` sets what "close" means for the strength curve — pass the field's characteristic body
/// range. Ties break on `(a, b)` so the ordering is stable across runs.
pub fn relations(bodies: &[Body], within: f64, scale: f64) -> Vec<Relation> {
    let scale = if scale > 0.0 { scale } else { 1.0 };
    let mut out = Vec::new();
    for a in 0..bodies.len() {
        for b in (a + 1)..bodies.len() {
            let (p, q) = (bodies[a].center, bodies[b].center);
            let d = ((p.x - q.x).powi(2) + (p.y - q.y).powi(2) + (p.z - q.z).powi(2)).sqrt();
            if d <= within {
                out.push(Relation {
                    a,
                    b,
                    distance: d,
                    strength: 1.0 / (1.0 + d / scale),
                });
            }
        }
    }
    out.sort_by(|x, y| {
        y.strength
            .partial_cmp(&x.strength)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(x.a.cmp(&y.a))
            .then(x.b.cmp(&y.b))
    });
    out
}

/// The `k` bodies most related to `index`, strongest first — the "you might also like" read.
pub fn related_to(bodies: &[Body], index: usize, k: usize, within: f64, scale: f64) -> Vec<Relation> {
    relations(bodies, within, scale)
        .into_iter()
        .filter(|r| r.a == index || r.b == index)
        .take(k)
        .collect()
}
