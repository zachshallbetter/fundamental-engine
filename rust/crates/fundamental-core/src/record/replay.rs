//! Causal replay — re-run a captured field and, optionally, record what each step did (#1043).
//!
//! `replay(snapshot, n)` must produce exactly what running `n` steps from the original field would
//! have produced. That equality is the whole point: a receipt that says "412 steps from here" is only
//! worth anything if someone else can run those 412 steps and land in the same place.

use crate::engine::{step, Body, Effect, Env, FieldStore, Registry};
use crate::record::FieldSnapshot;

/// A field restored from a capture and advanced. Exactly the triple [`step`] takes, so a caller can
/// keep stepping it, capture it again, or read it.
pub struct Replayed {
    pub store: FieldStore,
    pub bodies: Vec<Body>,
    pub env: Env,
}

/// Restore `snapshot` and run `n` steps. Byte-identical to having run those steps on the original.
pub fn replay(snapshot: &FieldSnapshot, n: usize, forces: &Registry) -> Replayed {
    let (mut store, mut bodies, mut env) = snapshot.restore();
    for _ in 0..n {
        step(&mut store, &mut bodies, &mut env, forces);
    }
    Replayed { store, bodies, env }
}

/// Replay, keeping each step's effects — the attribution log.
///
/// Returns one `Vec<Effect>` per step, in order. This is the causal half of a receipt: the state says
/// *what* the field became, the log says *what happened to make it so* — which sink captured, which
/// wall threw a spark, which collision owed an impulse and to whom.
///
/// It is a recording, not a re-derivation: the effects are the very values the forces emitted, copied
/// out before the next step clears them.
pub fn replay_recording(
    snapshot: &FieldSnapshot,
    n: usize,
    forces: &Registry,
) -> (Replayed, Vec<Vec<Effect>>) {
    let (mut store, mut bodies, mut env) = snapshot.restore();
    let mut log: Vec<Vec<Effect>> = Vec::with_capacity(n);
    for _ in 0..n {
        step(&mut store, &mut bodies, &mut env, forces);
        log.push(env.effects.clone());
    }
    (Replayed { store, bodies, env }, log)
}
