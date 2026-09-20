//! Record / replay — the determinism seam. Mirrors `packages/core/src/record`.
//!
//! The seeded PRNG every stochastic draw flows through, plus the snapshot + causal replay built on
//! it (#1043) — the Field Receipts substrate.

mod replay;
mod rng;
mod snapshot;
pub use replay::{replay, replay_recording, Replayed};
pub use rng::{seeded_rng, Rng};
pub use snapshot::FieldSnapshot;
