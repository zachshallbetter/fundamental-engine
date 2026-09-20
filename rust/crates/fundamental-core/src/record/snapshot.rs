//! Deterministic field capture — the Field Receipts substrate (#1043).
//!
//! A [`FieldSnapshot`] is *everything a step reads*, captured as an owned value: the particle pool
//! and its id counter, the bodies, the RNG's exact position in its stream, the frame counter, and the
//! environment constants. Restore it and the field is byte-for-byte where it was.
//!
//! **Why this is the receipts substrate.** A receipt has to answer "why did this happen", and the only
//! honest answer is one you can re-run. Two things make that possible here and would not in a
//! floating, wall-clock engine: the RNG is seeded and `Copy`, so a capture takes its exact position
//! rather than a fresh stream; and effects are plain values, so a step's consequences can be recorded
//! alongside the state that produced them ([`replay_recording`](super::replay_recording)).
//!
//! **No serialisation format is imposed.** The crate has zero dependencies, so a snapshot is a plain
//! owned struct rather than a serde type — a host serialises it however it already serialises things.
//! Every field is public for exactly that reason.

use crate::engine::{Body, Env, FieldStore, Formation, Particle};
use crate::math::Vec3;
use crate::record::Rng;

/// A complete, owned capture of a field's state.
///
/// What is deliberately **absent** is as considered as what is present. `Env::vector` and `Env::dist`
/// are per-particle scratch the integrator overwrites before every force call; `Env::effects` is
/// cleared at the top of each step; `capture_request` is consumed within a step; and the neighbour
/// snapshot is rebuilt from the pool each frame when a class-[B] force needs it. None of them survive
/// a step boundary, so none of them is state — capturing them would imply a fidelity that is not real.
#[derive(Clone, Debug)]
pub struct FieldSnapshot {
    pub particles: Vec<Particle>,
    /// The id the next auto-assigned particle will take. Restoring the pool without this would give
    /// re-added matter different ids than the original run, breaking every id-keyed attribution.
    pub next_id: u64,
    pub bodies: Vec<Body>,
    /// The RNG's exact position in its stream — not a seed. A capture mid-run must resume the stream
    /// where it stood, or every subsequent stochastic draw diverges.
    pub rng: Rng,
    pub frame_n: u64,
    pub t: f64,
    pub form: Formation,
    pub volume: Vec3,
    pub dt: f64,
    pub c: f64,
    pub g: f64,
    pub scroll_v: f64,
}

impl FieldSnapshot {
    /// Capture the field as it stands.
    pub fn capture(store: &FieldStore, bodies: &[Body], env: &Env) -> FieldSnapshot {
        FieldSnapshot {
            particles: store.particles.clone(),
            next_id: store.next_id(),
            bodies: bodies.to_vec(),
            rng: env.rng,
            frame_n: env.frame_n,
            t: env.t,
            form: env.form,
            volume: env.volume,
            dt: env.dt,
            c: env.c,
            g: env.g,
            scroll_v: env.scroll_v,
        }
    }

    /// Rebuild a runnable field from this capture. The returned triple is exactly what
    /// [`step`](crate::engine::step) takes.
    pub fn restore(&self) -> (FieldStore, Vec<Body>, Env) {
        let store = FieldStore::from_parts(self.particles.clone(), self.next_id);
        let bodies = self.bodies.clone();
        let env = Env {
            rng: self.rng,
            frame_n: self.frame_n,
            t: self.t,
            form: self.form,
            volume: self.volume,
            dt: self.dt,
            c: self.c,
            g: self.g,
            scroll_v: self.scroll_v,
            ..Env::default()
        };
        (store, bodies, env)
    }
}
