//! Scores — rank content by what the field says about it (#1044).
//!
//! The raw signal is `Body::count`: the gathered density the integrator measures at each body during
//! the force pass. A body that matter pools around scores high; one matter passes by scores low.
//!
//! **Read a settled field, immediately.** `count` is a PER-FRAME accumulator — the integrator zeroes
//! every body's count at the top of each step and rebuilds it during that step's particle loop. So a
//! score describes the frame you just ran, not the history of the run. Call this after
//! [`solve`](crate::engine::solve) returns and before stepping again; anything else reads a number
//! that means something other than it appears to.

use crate::engine::Body;

/// One body's reading, attributed to its position in the host's own body list.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Score {
    /// Index into the `bodies` slice — the caller's key back to its own record.
    pub index: usize,
    /// The measured density at this body, as the integrator left it.
    pub raw: f64,
    /// `raw` divided by the largest `raw` in the set, in `[0,1]`. All-zero input yields all-zero
    /// output rather than `NaN`: a field where nothing gathered has no leader, and inventing one by
    /// dividing by zero would rank noise.
    pub normalized: f64,
}

/// Every body's score, in the caller's order.
pub fn scores(bodies: &[Body]) -> Vec<Score> {
    let max = bodies.iter().fold(0.0_f64, |m, b| m.max(b.count));
    bodies
        .iter()
        .enumerate()
        .map(|(index, b)| Score {
            index,
            raw: b.count,
            normalized: if max > 0.0 { b.count / max } else { 0.0 },
        })
        .collect()
}

/// Scores ranked strongest first.
///
/// Ties keep the caller's order, so a rebuild of unchanged content produces an unchanged ranking
/// rather than shuffling equal rows — the property a CMS notices immediately when it is missing.
pub fn ranked(bodies: &[Body]) -> Vec<Score> {
    let mut out = scores(bodies);
    out.sort_by(|a, b| {
        b.raw
            .partial_cmp(&a.raw)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.index.cmp(&b.index))
    });
    out
}
