//! `solve` — step to equilibrium (#1042).
//!
//! [`step`] is the live-tick primitive: one frame, the thing a render host calls sixty times a second.
//! `solve` is the headless complement and the Rust plane's actual entry point — run the field until it
//! stops changing, then read it. A CMS rebuild or a batch analysis does not want frames; it wants the
//! settled answer, and it wants the same answer every time.
//!
//! **Convergence signal.** The largest per-particle velocity change across one step. It goes to zero at
//! a genuine fixed point — including a *moving* one, since a particle under a constant force reaches
//! terminal velocity where the force input equals the friction loss, and its Δv then vanishes. A field
//! that is perpetually stirred (a `thermal` body drawing the rng, a live `wander`) never reaches it, so
//! it runs to the cap and reports `settled: false` honestly rather than pretending.

use super::{step, Body, Env, FieldStore, Registry};

/// How hard to try. [`Default`] is 10 000 iterations at `1e-6`.
#[derive(Clone, Copy, Debug)]
pub struct SolveOptions {
    /// Give up after this many steps and report `settled: false`.
    pub max_iters: usize,
    /// Settle when the largest per-particle |Δvelocity| over one step is at or below this.
    pub epsilon: f64,
}

impl Default for SolveOptions {
    fn default() -> Self {
        SolveOptions {
            max_iters: 10_000,
            epsilon: 1e-6,
        }
    }
}

/// What `solve` did. `settled` is the honest answer, not a courtesy: `false` means the field was still
/// moving when the cap ran out, and whatever you read from it is a snapshot of motion, not equilibrium.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SolveResult {
    /// Steps actually run.
    pub iterations: usize,
    /// Whether the field reached the convergence threshold before the cap.
    pub settled: bool,
}

/// Step until the field settles, or until `opts.max_iters` runs out.
///
/// Deterministic: a fixed `dt` and a seeded rng make the iteration count itself reproducible, which is
/// what lets a receipt say "this ranking took 412 steps" and mean it.
///
/// **A frozen field never settles.** With `env.dt == 0` the integrator returns immediately (§18), so no
/// velocity ever changes and a naive convergence check would call that instant equilibrium. It is not —
/// the field never ran. `solve` returns `{ iterations: 0, settled: false }` rather than report a fixed
/// point it never reached.
///
/// An empty pool settles at the first step: there is no matter to move, which *is* the fixed point.
pub fn solve(
    store: &mut FieldStore,
    bodies: &mut [Body],
    env: &mut Env,
    forces: &Registry,
    opts: SolveOptions,
) -> SolveResult {
    if env.dt == 0.0 {
        return SolveResult {
            iterations: 0,
            settled: false,
        };
    }

    // Reused across iterations so a long solve doesn't allocate per step.
    let mut prev: Vec<(u64, crate::math::Vec3)> = Vec::with_capacity(store.particles.len());

    for i in 1..=opts.max_iters {
        prev.clear();
        prev.extend(store.particles.iter().map(|p| (p.id, p.velocity)));

        step(store, bodies, env, forces);

        // Largest |Δv| over the particles that survived the step, walked by index rather than looked up
        // by id: this loop runs up to `max_iters` times, and an id search inside it would make the whole
        // solve quadratic in pool size. The per-index id check keeps it honest if the pool ever shifts
        // under us (nothing removes particles mid-step today; `spawn`/despawn will, #1038) — a slot whose
        // id moved is skipped rather than silently compared against a different particle's velocity.
        let mut max_delta: f64 = 0.0;
        for (i, (id, v0)) in prev.iter().enumerate() {
            let p = match store.particles.get(i) {
                Some(p) if p.id == *id => p,
                _ => continue,
            };
            let dx = p.velocity.x - v0.x;
            let dy = p.velocity.y - v0.y;
            let dz = p.velocity.z - v0.z;
            let d = (dx * dx + dy * dy + dz * dz).sqrt();
            if d > max_delta {
                max_delta = d;
            }
        }

        if max_delta <= opts.epsilon {
            return SolveResult {
                iterations: i,
                settled: true,
            };
        }
    }

    SolveResult {
        iterations: opts.max_iters,
        settled: false,
    }
}
