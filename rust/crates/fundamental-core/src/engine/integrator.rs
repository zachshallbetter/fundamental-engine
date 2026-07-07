//! The integrator — advances the field one tick (§2.2). Mirrors `packages/core/src/engine/integrator.ts`.
//!
//! This is the **legacy semi-implicit Euler** core (the JS default `IntegratorMode`): for each free
//! particle, apply every body's forces (mass-scaled per §21.3), cap speed, integrate `x += v·dt`,
//! then damp. `dt = 0` freezes motion (§18) but still drains the per-body density counters (#967).
//!
//! Stateful/stochastic forces reach the world through the [`Env`] seam, resolved here: `sink` requests
//! a capture (the integrator holds the particle at the body's core, and releases the whole shell at
//! capacity — a supernova); `wall` emits sparks into `env.effects`; `jet` draws `env.rng`.
//!
//! Faithfully ported for the deterministic subset. **Deferred** (each lands with its capability, and
//! is a documented no-op until then — matching the JS "flat field, neutral formation" fast path
//! bit-for-bit): formation currents (drift/spread/conv), carrier waves, `screen`/modifier passes,
//! conserved-attention, velocity-Verlet, mortal-matter aging, agent steering/bounce, and
//! particle-to-particle separation. The supernova *burst* (relaunching held matter outward) is also
//! deferred — release currently just frees the shell back into the field (count-conserving).

use super::{Body, Env, FieldStore, Force, Particle, Registry};
use crate::math::Vec3;

/// Per-frame velocity damping (semi-implicit Euler). (JS `FRICTION`.)
pub const FRICTION: f64 = 0.95;
/// Per-frame heat decay. (JS `HEAT_DECAY`.)
pub const HEAT_DECAY: f64 = 0.972;
/// Toroidal-wrap margin outside the field bounds. (JS `EDGE`.)
pub const EDGE: f64 = 10.0;

/// Tokens whose forces read the neighbour snapshot — the integrator only rebuilds it when one is used.
const NEIGHBOR_TOKENS: [&str; 5] = ["align", "cohesion", "pressure", "link", "hunt"];

/// Apply one force to a particle, honouring first-class mass (§21.3): an *additive* force's velocity
/// change is scaled by `1/m` (a = F/m), while a `kinematic` force (reflection/rotation/relaunch)
/// sets velocity outright and is left unscaled. `inv == 1` (unit mass) is the identity path either way.
fn apply_force(f: &dyn Force, b: &Body, p: &mut Particle, e: &mut Env, inv: f64) {
    if inv == 1.0 || f.kinematic() {
        f.apply(b, p, e);
        return;
    }
    let v0 = p.velocity;
    f.apply(b, p, e);
    p.velocity.x = v0.x + (p.velocity.x - v0.x) * inv;
    p.velocity.y = v0.y + (p.velocity.y - v0.y) * inv;
    p.velocity.z = v0.z + (p.velocity.z - v0.z) * inv;
}

/// Advance the field one tick: mutate every particle in `store` under the forces of `bodies`.
///
/// `bodies` is `&mut` because the density counter (`Body::count`) and accretion (`Body::accreted`)
/// accumulate during the pass; `env` is `&mut` because the per-apply geometry scratch and the effect
/// seam live there. `env.effects` is cleared at the top and holds this step's effects on return.
/// `env.volume` supplies the world bounds `(W, H, D)`; when it is zero, toroidal wrap is skipped
/// (headless-safe — content shouldn't collapse to the origin for want of bounds).
pub fn step(store: &mut FieldStore, bodies: &mut [Body], env: &mut Env, forces: &Registry) {
    env.effects.clear();

    // Density bookkeeping drains every frame, including the frozen path (#967), so `count` never
    // carries a stale value.
    for b in bodies.iter_mut() {
        b.count = 0.0;
    }

    let dt = env.dt;
    if dt == 0.0 {
        return; // motion frozen (§18); counts already zeroed
    }

    // Rebuild the neighbour snapshot only when a class-[B] force is actually in play — most fields use
    // none, and the rebuild is O(n). (Frame-start snapshot: see `spatial_hash`.)
    let needs_neighbors = bodies.iter().any(|b| {
        b.visible
            && b.tokens
                .iter()
                .any(|t| NEIGHBOR_TOKENS.contains(&t.as_str()))
    });
    if needs_neighbors {
        env.neighborhood.rebuild(&store.particles);
    }

    let (w, h, d) = (env.volume.x, env.volume.y, env.volume.z);
    let cap = env.c;
    let has_bodies = !bodies.is_empty();
    // sink bodies that reached capacity this frame → released after the particle pass.
    let mut supernova: Vec<usize> = Vec::new();

    for p in store.particles.iter_mut() {
        // captured matter drifts to its sink core and skips the force pass (§6.9). A released body
        // (index gone) frees the particle back into the field.
        if let Some(bi) = p.cap {
            match bodies.get(bi) {
                Some(cb) => {
                    p.position.x += (cb.center.x - p.position.x) * 0.18;
                    p.position.y += (cb.center.y - p.position.y) * 0.18;
                    if p.position.z != 0.0 {
                        p.position.z += -p.position.z * 0.18;
                    }
                    continue;
                }
                None => p.cap = None,
            }
        }

        // body forces — the field's sources move matter (§4).
        if has_bodies {
            // first-class mass (§21.3): additive Δv scaled by 1/m; kinematic forces left unscaled.
            let inv = if p.mass != 1.0 && p.mass > 0.0 {
                1.0 / p.mass
            } else {
                1.0
            };
            for (i, b) in bodies.iter_mut().enumerate() {
                if !b.visible || b.tokens.is_empty() {
                    continue;
                }
                // vector from particle toward body; z leg is −p.z (bodies live on the z = 0 plane).
                let dx = b.center.x - p.position.x;
                let dy = b.center.y - p.position.y;
                let dz = -p.position.z;
                let d2 = dx * dx + dy * dy + dz * dz;
                // range cull: a ranged body can't reach past ~1.6× its range (tether's 1.575×).
                // range 0 = global → never culled.
                if b.range > 0.0 && d2 >= b.range * b.range * 2.56 {
                    continue;
                }
                let dist = d2.sqrt();
                // density sample for two-way feedback (ungated engine bookkeeping, §8).
                if b.feedback && dist < b.range * 0.5 {
                    b.count += 1.0 - dist / (b.range * 0.5);
                }
                env.vector = Vec3::new(dx, dy, dz);
                env.dist = if dist < 1.0 { 1.0 } else { dist };
                // iterate tokens by index so the body can be mutated (accretion) after each apply
                // without holding an immutable borrow of `b.tokens` across the mutation.
                for k in 0..b.tokens.len() {
                    let f = match forces.get(&b.tokens[k]) {
                        Some(f) => f,
                        None => continue,
                    };
                    apply_force(f, b, p, env, inv);
                    // resolve a capture request (sink): hold the particle, grow the body, and queue a
                    // release when it saturates. Set now; the top-of-loop guard acts next frame.
                    if env.capture_request {
                        env.capture_request = false;
                        p.cap = Some(i);
                        b.accreted += 1;
                        if (b.accreted as f64) >= b.capacity && !supernova.contains(&i) {
                            supernova.push(i);
                        }
                    }
                }
            }
        }

        // global safety cap (§20.10): no composite may drive a particle past `c` ("speed of light").
        let sp2 = p.velocity.length_sq();
        if sp2 > cap * cap {
            let k = cap / sp2.sqrt();
            p.velocity = p.velocity * k;
        }

        // integrate, then damp (§2.2).
        p.position.x += p.velocity.x * dt;
        p.position.y += p.velocity.y * dt;
        p.position.z += p.velocity.z * dt;
        p.velocity = p.velocity * FRICTION;
        p.heat *= HEAT_DECAY;

        // toroidal wrap at the edges — skipped when bounds are unset (headless-safe; see docs above).
        if w > 0.0 && h > 0.0 {
            if p.position.x < -EDGE {
                p.position.x = w + EDGE;
            } else if p.position.x > w + EDGE {
                p.position.x = -EDGE;
            }
            if p.position.y < -EDGE {
                p.position.y = h + EDGE;
            } else if p.position.y > h + EDGE {
                p.position.y = -EDGE;
            }
            if d > 0.0 {
                if p.position.z < -EDGE {
                    p.position.z = d + EDGE;
                } else if p.position.z > d + EDGE {
                    p.position.z = -EDGE;
                }
            }
        }
    }

    // release saturated sinks (§6.9): reset accretion and free the held shell back into the field.
    // (The outward burst is deferred; freeing is count-conserving.)
    for bi in supernova {
        bodies[bi].accreted = 0;
        for p in store.particles.iter_mut() {
            if p.cap == Some(bi) {
                p.cap = None;
            }
        }
    }
}
