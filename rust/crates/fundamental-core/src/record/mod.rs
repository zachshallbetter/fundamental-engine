//! Record / replay — the determinism seam. Mirrors `packages/core/src/record`.
//!
//! For now: the seeded PRNG every stochastic draw flows through. Snapshot + causal replay build on it.

mod rng;
pub use rng::{seeded_rng, Rng};
