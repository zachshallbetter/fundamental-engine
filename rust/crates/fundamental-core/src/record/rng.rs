//! A small, dependency-free seeded PRNG — mirrors `packages/core/src/record/rng.ts`.
//!
//! `mulberry32`, a well-known 32-bit generator: tiny, fast, pure integer math. The same seed always
//! produces the same stream. Every engine random draw (jet cone spread, brownian wander, spawn
//! jitter, spark counts) flows through this one source, so a seeded field is fully reproducible — the
//! determinism seam (#371/#974) and the foundation for snapshot/replay + Field Receipts.
//!
//! **Cross-plane parity:** the Rust plane keeps the JS `[0, 1)` mapping exactly — all 32 bits of state
//! divided into an f64 (`state / 2^32`). This makes the Rust stream *bit-identical to JS* (verified in
//! tests), unlike the f32 Swift port which truncates to the top 24 bits. Not cryptographic.

/// A seeded mulberry32 generator. `Copy`, so cloning an [`Env`](crate::engine::Env) forks the stream
/// at its current position (deliberate — a snapshot captures the exact RNG state).
#[derive(Clone, Copy, Debug)]
pub struct Rng {
    state: u32,
}

impl Rng {
    /// Create a generator from a 32-bit seed. Same seed → same stream.
    pub fn seeded(seed: u32) -> Self {
        Rng { state: seed }
    }

    /// The next uniform value in `[0, 1)`. Bit-identical to the JS `seededRng` stream.
    pub fn next_f64(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6d2b_79f5);
        let mut t = (self.state ^ (self.state >> 15)).wrapping_mul(self.state | 1);
        t = (t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61))) ^ t;
        ((t ^ (t >> 14)) as f64) / 4_294_967_296.0
    }
}

impl Default for Rng {
    /// Seed 0 — deterministic by default (the headless plane's stance; the DOM plane defaults to a
    /// nondeterministic source instead). Call [`Rng::seeded`] to pick a stream.
    fn default() -> Self {
        Rng::seeded(0)
    }
}

/// Create a seeded `impl FnMut() -> f64` (uniform in `[0, 1)`) — the closure form, mirroring the JS
/// `seededRng(seed)` API for callers that want a plain generator function.
pub fn seeded_rng(seed: u32) -> impl FnMut() -> f64 {
    let mut r = Rng::seeded(seed);
    move || r.next_f64()
}
