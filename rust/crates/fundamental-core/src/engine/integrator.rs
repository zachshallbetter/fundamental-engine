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

use super::{Body, Effect, Env, FieldStore, Force, Particle, Registry};
use crate::math::{screen_factor, Vec3};

/// Per-frame velocity damping (semi-implicit Euler). (JS `FRICTION`.)
pub const FRICTION: f64 = 0.95;
/// Per-frame heat decay. (JS `HEAT_DECAY`.)
pub const HEAT_DECAY: f64 = 0.972;
/// Toroidal-wrap margin outside the field bounds. (JS `EDGE`.)
pub const EDGE: f64 = 10.0;

/// Tokens whose forces read the neighbour snapshot — the integrator only rebuilds it when one is used.
/// A `screen` body's geometry, lifted out of `bodies` before the particle loop borrows it mutably.
///
/// NOTE — a cross-plane divergence, deliberate here: the distance is **3D**. The Swift integrator uses
/// `simd_length(s.center - p.position)` (3D); the JS integrator uses only `sdx`/`sdy` and drops z. The
/// two agree wherever `p.z == 0`, which is every conformance case and every flat field, so the
/// divergence is latent. This port follows Swift and its own body geometry, which is 3D throughout.
struct ScreenSource {
    index: usize,
    center: Vec3,
    range: f64,
    strength: f64,
    min: f64,
}

const NEIGHBOR_TOKENS: [&str; 6] = ["align", "cohesion", "pressure", "link", "hunt", "collide"];

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

    // Visible `screen` bodies (workover v0.3): each damps OTHER bodies' forces on matter inside its
    // range — quiet zones, text shielded from a noisy field. Their geometry is read ONCE here, before
    // the particle loop takes a mutable borrow of `bodies`; the per-body loop below cannot look at its
    // siblings, which is exactly why a cross-body modifier cannot live in the `modify` hook.
    // No screens (the common case) ⇒ an empty vec, and the whole pass is skipped at zero cost.
    let screens: Vec<ScreenSource> = bodies
        .iter()
        .enumerate()
        .filter(|(_, b)| b.visible && b.tokens.iter().any(|t| t == "screen"))
        .map(|(i, b)| ScreenSource {
            index: i,
            center: b.center,
            range: b.range,
            strength: b.strength,
            min: b.screen_min,
        })
        .collect();
    // reused across particles so the pass allocates nothing per particle
    let mut screen_fall: Vec<f64> = vec![1.0; screens.len()];

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
            // per-particle screen factors: one distance per screen body, computed once here and
            // reused across every body's pass below. 3D, matching the Swift port and this engine's own
            // body geometry — see the note on `ScreenSource`.
            for (j, s) in screens.iter().enumerate() {
                let sdx = s.center.x - p.position.x;
                let sdy = s.center.y - p.position.y;
                let sdz = s.center.z - p.position.z;
                screen_fall[j] = screen_factor(
                    (sdx * sdx + sdy * sdy + sdz * sdz).sqrt(),
                    s.range,
                    s.strength,
                    s.min,
                );
            }

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

                // modifier pass (§20.3): a body's OWN modifier tokens (spotlight/resonate) bend its
                // siblings — gates OR, strength factors multiply, so the composed value is
                // order-independent. Runs before the force pass, reading the geometry set above.
                let mut s_mul = 1.0;
                let mut gated = false;
                for k in 0..b.tokens.len() {
                    let Some(f) = forces.get(&b.tokens[k]) else {
                        continue;
                    };
                    if !f.is_modifier() {
                        continue;
                    }
                    if let Some(m) = f.modify(b, p, env) {
                        if let Some(s) = m.strength {
                            s_mul *= s;
                        }
                        gated |= m.gate;
                    }
                }
                if gated {
                    continue; // spotlight cone excludes this particle from this body
                }

                // `screen`: OTHER bodies' quiet zones damp this body's force on this particle. The
                // factors were computed once per particle above; a screen never damps itself, which is
                // what the index check enforces.
                let mut screen_mul = 1.0;
                for (j, s) in screens.iter().enumerate() {
                    if s.index != i {
                        screen_mul *= screen_fall[j];
                    }
                }

                // force pass. Scale the body's strength by the composed multiplier for the applies,
                // then restore it (the body object is shared across particles).
                let mul = s_mul * screen_mul;
                let orig_strength = b.strength;
                if mul != 1.0 {
                    b.strength = orig_strength * mul;
                }
                // iterate tokens by index so the body can be mutated (accretion) after each apply
                // without holding an immutable borrow of `b.tokens` across the mutation.
                for k in 0..b.tokens.len() {
                    let f = match forces.get(&b.tokens[k]) {
                        Some(f) => f,
                        None => continue,
                    };
                    if f.is_modifier() {
                        continue; // modifiers contribute no force of their own
                    }
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
                if mul != 1.0 {
                    b.strength = orig_strength;
                }
            }
        }

        // The force pass ends here. Integration now happens in a SECOND pass, below, so that the
        // impulses `collide` owes its neighbours (#1037) land on velocity BEFORE it is integrated
        // into position — draining them after integration would delay every collision by a frame.
        // Splitting is numerically inert for every other force: neighbours are read from the
        // frame-start snapshot, body centres are fixed for the step, and `b.count` is written but
        // never read during the pass, so no force observes another particle's integrated state.
    }

    // ── impulse drain (#1037) ──────────────────────────────────────────────────────────────────
    // Apply the neighbour halves `collide` emitted, addressed by id. Equal-and-opposite pairs make
    // this momentum-conserving; applying them here, between the force pass and integration, keeps a
    // collision response within the frame that detected it. Captured matter is skipped — it is held
    // by its sink and off the force path entirely.
    if env.effects.iter().any(|e| matches!(e, Effect::Impulse { .. })) {
        for eff in env.effects.iter() {
            if let Effect::Impulse { particle_id, dv } = eff {
                if let Some(q) = store
                    .particles
                    .iter_mut()
                    .find(|q| q.id == *particle_id && q.cap.is_none())
                {
                    q.velocity.x += dv.x;
                    q.velocity.y += dv.y;
                    q.velocity.z += dv.z;
                }
            }
        }
    }

    // ── integrate ─────────────────────────────────────────────────────────────────────────────
    for p in store.particles.iter_mut() {
        if p.cap.is_some() {
            continue; // captured matter drifted to its sink core above and does not integrate
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

    // ── class-[S] source pass (§20.1) ──────────────────────────────────────────────────────────
    // A BODY-level pass after the per-particle loop, so a source acts once per frame rather than once
    // per existing particle. `propagate` deposits its shock pulse here; spawn/morph will emit matter
    // through the same hook (#1038).
    for b in bodies.iter() {
        if !b.visible || b.tokens.is_empty() {
            continue;
        }
        for k in 0..b.tokens.len() {
            if let Some(f) = forces.get(&b.tokens[k]) {
                f.source(b, env);
            }
        }
    }

    // ── advance the scalar field buffers (§20.1 class [C]) ─────────────────────────────────────
    // After the source pass, mirroring the JS frame order: forces READ the grids, sources DEPOSIT
    // into them, then the buffers advance. A `held` grid's step is a no-op by construction.
    for g in env.grids.values_mut() {
        g.step();
    }

    // The frame counter a periodic source reads (`propagate`'s shock train fires on
    // `frame_n % WAVE_PULSE_PERIOD`). It was declared on `Env` from the start and advanced by
    // nothing, because until now nothing read it — left that way, a periodic source would fire on
    // EVERY frame, since `0 % n == 0` forever.
    env.frame_n = env.frame_n.wrapping_add(1);

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
