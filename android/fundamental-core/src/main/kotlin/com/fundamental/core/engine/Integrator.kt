package com.fundamental.core.engine

import com.fundamental.core.math.Vec3
import com.fundamental.core.math.screenFactor
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.random.Random

// The integrator (§2.2, §7) — the Kotlin port of swift/Sources/FundamentalCore/Engine/Integrator.swift
// (itself a direct port of packages/core/src/core/integrator.ts, lifted to 3D).
//
// Advances the field one tick. For each free particle: the wave current (§2.3), the formation bias
// (§7), the body forces (§4), then integrate and damp. First-class mass (§21.3) scales each additive
// force by 1/m; velocity-replacing (kinematic) forces are left untouched. Reduced motion (dt = 0)
// freezes the sim (§18).
//
// INTEGRATION SCHEMES (`Env.integrator`, the JS #958 mirror): the default LEGACY is semi-implicit
// Euler (forces update v, then `x += v·dt`, then a per-frame decay); FIXED keeps the same order but
// dt-scales the decays (doc 04 §Step 3). VELOCITY_VERLET (#659) is the opt-in second-order scheme,
// in the stored-acceleration form:
//
//   x(t+dt) = x(t) + v(t)·dt + ½·a(t)·dt²      (position full-step, BEFORE the force pass)
//   a′      = Δv/dt from the force pass          (forces evaluated at x(t+dt))
//   v(t+dt) = v(t) + ½·(a(t) + a′)·dt           (velocity half-step average)
//
// Approximations, deliberate and documented (physics caveat canon): (1) the engine's force model is
// impulse-based and velocity-dependent (drag-like forces read the CURRENT v), so a′ is taken as the
// pass's net Δv/dt rather than re-evaluating forces at the averaged velocity — the standard
// stored-acceleration treatment; (2) the per-step FRICTION/HEAT_DECAY decays stay outside the scheme
// (dt-scaled, like FIXED), which alone makes it NON-symplectic — this buys positional accuracy, it
// does NOT make energy/momentum conserved (they are non-conserved by design; particle COUNT remains
// the invariant); (3) a *kinematic* (velocity-REPLACING) force — jet/wall/lens/gate/warp — is a
// discontinuity, not an acceleration: when one fires, the replaced velocity stands un-averaged and
// the stored acceleration resets, so the next position step doesn't extrapolate across the break;
// (4) a pair force's equal-and-opposite leg on the NEIGHBOUR (collide/link) folds into that
// neighbour's own v(t) or Δv whenever its turn comes — the same class of caveat the JS header carries.

const val FRICTION: Float = 0.95f
const val HEAT_DECAY: Float = 0.972f
private const val EDGE: Float = 10f
private val PI_F: Float = PI.toFloat()

/** The per-frame inputs to [step]. Mirror of Swift's `StepInput`. */
class StepInput(
    val store: FieldStore,
    val bodies: List<Body>,
    val env: Env,
    val forces: ForceRegistry,
    val conditions: ConditionRegistry = emptyMap(),
    /** The carrier waves — free particles drift along their slope (§2.3). */
    val waves: List<Wave>? = null,
    val waveStyle: WaveStyle = WaveStyle.LINEAR,
    val waveCenter: Vec3? = null,
    val separation: Float = 0f,
)

private fun gatePasses(conds: ConditionRegistry, b: Body, p: Particle, env: Env): Boolean {
    if (b.`when`.isEmpty()) return true
    val fn = conds[b.`when`] ?: return true
    return fn(b, p, env)
}

/** The body's classified token sets, memoized — `tokens` never changes after construction. */
private fun classified(b: Body): ClassifiedTokens {
    b.classified?.let { return it }
    val c = classifyBodyTokens(b.tokens)
    b.classified = c
    return c
}

/**
 * Apply one force, honouring first-class mass (§21.3): an *additive* force's Δv is scaled by 1/m
 * (a = F/m); a kinematic force (reflection / rotation / relaunch) sets velocity outright, unscaled.
 */
private fun applyForce(f: Force, b: Body, p: Particle, env: Env, inv: Float) {
    if (inv == 1f || f.isKinematic) {
        // velocity-Verlet (#659): a kinematic force that actually changes velocity marks the
        // particle's pass as a discontinuity (env.kinTouch) — the half-step average is skipped.
        // One boolean test on the default path; the capture only runs under the opt-in mode.
        if (f.isKinematic && env.integrator == IntegratorMode.VELOCITY_VERLET) {
            val before = p.velocity
            f.apply(b, p, env)
            if (p.velocity != before) env.kinTouch = true
            return
        }
        f.apply(b, p, env)
        return
    }
    val before = p.velocity
    f.apply(b, p, env)
    p.velocity = before + (p.velocity - before) * inv
}

/** Advance the field one tick. */
fun step(input: StepInput) {
    val store = input.store
    val bodies = input.bodies
    val env = input.env
    val forces = input.forces
    val conditions = input.conditions
    val dt = env.dt
    if (dt == 0f) return
    // the opt-in second-order scheme (#659) — see the header doc for the math + approximations.
    val verlet = env.integrator == IntegratorMode.VELOCITY_VERLET
    // Under FIXED / VELOCITY_VERLET the per-step decays scale with dt (`FRICTION^dt`, doc 04 §Step 3)
    // so they are frame-rate independent; `pow(x, 1) == x`, so the dt = 1 default path is
    // byte-identical. Hoisted (loop-invariant) — the JS computes the same value per particle.
    val dtScaledDecays = env.integrator == IntegratorMode.FIXED || verlet
    val fr = if (dtScaledDecays) FRICTION.pow(dt) else FRICTION
    val heatDecay = if (dtScaledDecays) HEAT_DECAY.pow(dt) else HEAT_DECAY
    val w = env.volume.x
    val h = env.volume.y
    val d3 = env.volume.z
    val form = env.form

    // expose the net structure field so field-following forces can read the superposition.
    env.fieldAt = { p -> netField(bodies, forces, p) }

    for (b in bodies) {
        b.count = 0f
        if (b.thermo != null) b.thermo = Thermo()
    }

    // visible `screen` bodies: each damps OTHER bodies' forces on matter inside its range.
    var screens: MutableList<Body>? = null
    for (b in bodies) {
        if (b.isVisible && b.tokens.isNotEmpty() && classified(b).modifiers.contains("screen")) {
            if (screens == null) screens = mutableListOf(b) else screens.add(b)
        }
    }
    val sc = screens
    val screenFall = FloatArray(sc?.size ?: 0) { 1f }

    val hasBodies = bodies.isNotEmpty()
    var dead: MutableList<Particle>? = null
    val conv = if (form.conv > 0.02f) accretionTarget(bodies) else null

    val waves = input.waves
    val hasWaves = !(waves?.isEmpty() ?: true)

    for (p in store.particles) {
        // captured matter is held inside a sink core, drifting to it (§6.9).
        val cap = p.cap
        if (cap != null) {
            p.position += (cap.center - p.position) * 0.18f
            // held matter has no acceleration of its own — drop any stored Verlet lane so a later
            // release doesn't extrapolate a stale a(t). Only ever non-null under the opt-in mode.
            if (p.accel != null) p.accel = Vec3.ZERO
            continue
        }

        // velocity-Verlet (#659): the position FULL-STEP runs first, from last step's velocity and
        // stored acceleration — x(t+dt) = x(t) + v(t)·dt + ½·a(t)·dt² — so the force pass below
        // evaluates a′ at x(t+dt). v0 keeps v(t) for the half-step average after the pass.
        var v0 = Vec3.ZERO
        if (verlet) {
            p.position += p.velocity * dt + (p.accel ?: Vec3.ZERO) * (0.5f * dt * dt)
            v0 = p.velocity
            env.kinTouch = false
        }

        // wave current (§2.3): near a wave line, drift along its slope like debris.
        if (hasWaves && waves != null) {
            if (input.waveStyle == WaveStyle.CIRCULAR) {
                val c = input.waveCenter ?: Vec3(w / 2f, h / 2f, 0f)
                var near: Wave? = null
                var nd = 1e9f
                var nearR = 0f
                var nearRWave = 0f
                var nearTheta = 0f
                for (wv in waves) {
                    val res = waveDistance(wv, p.position.x, p.position.y, env.t, w, h, WaveStyle.CIRCULAR, c)
                    if (res.dist < nd) {
                        nd = res.dist; near = wv; nearR = res.r; nearRWave = res.rWave; nearTheta = res.theta
                    }
                }
                val nw = near
                if (nw != null && nd < 70f) {
                    val factor = 1f - nd / 70f
                    val tx = -sin(nearTheta) * nw.dir
                    val ty = cos(nearTheta) * nw.dir
                    val pullSign = if ((nearRWave - nearR) >= 0f) 1f else -1f
                    val rx = cos(nearTheta) * pullSign
                    val ry = sin(nearTheta) * pullSign
                    p.velocity = Vec3(
                        p.velocity.x + tx * 0.035f * factor + rx * 0.05f * factor,
                        p.velocity.y + ty * 0.035f * factor + ry * 0.05f * factor,
                        p.velocity.z,
                    )
                }
            } else {
                var near: Wave? = null
                var nd = 1e9f
                for (wv in waves) {
                    val dd = abs(waveYat(wv, p.position.x, env.t, h) - p.position.y)
                    if (dd < nd) { nd = dd; near = wv }
                }
                val nw = near
                if (nw != null && nd < 70f) {
                    val f = 1f - nd / 70f
                    p.velocity = Vec3(
                        p.velocity.x + nw.dir * 0.035f * f,
                        p.velocity.y + waveSlope(nw, p.position.x, env.t) * 0.1f * f,
                        p.velocity.z,
                    )
                }
            }
        }

        // formation currents (§7), before the body forces.
        if (form.driftX != 0f) {
            p.velocity = Vec3(p.velocity.x + form.driftX * 0.02f, p.velocity.y, p.velocity.z)
        }
        if (form.spread > 0.02f) {
            val tx = ((p.gx + env.frameN * 0.00004f) % 1f) * w
            val ty = p.gy * h
            val tz = if (d3 > 0f) p.gz * d3 else 0f
            p.velocity += (Vec3(tx, ty, tz) - p.position) * (0.0006f * form.spread)
        }
        if (conv != null) {
            val cd = conv.center - p.position
            val dd = max(cd.length(), 1f)
            p.velocity += (cd / dd) * (form.conv * 0.06f)
        }

        // body forces — the registered elements move the field (§4).
        if (hasBodies) {
            if (sc != null) {
                for (i in sc.indices) {
                    val s = sc[i]
                    screenFall[i] = screenFactor((s.center - p.position).length(), s.range, s.strength, s.screenMin ?: 0f)
                }
            }
            val inv = if (p.mass != 1f && p.mass > 0f) 1f / p.mass else 1f
            for (b in bodies) {
                if (!b.isVisible || b.tokens.isEmpty()) continue
                // shaped sources reference the nearest point on the box; inside delta = 0 (no-op).
                val delta = if (b.shaped) nearestOnBox(p.position, b.box) - p.position else b.center - p.position
                val d2 = delta.lengthSquared()
                // range cull: a ranged body can't reach past ~1.6× its range. range 0 = global.
                if (b.range > 0f && d2 >= b.range * b.range * 2.56f) continue
                val d = sqrt(d2)
                // density + thermodynamic sampling for two-way feedback (§8).
                if (b.feedback && d < b.range * 0.5f) {
                    b.count += 1f - d / (b.range * 0.5f)
                    val th = b.thermo ?: Thermo()
                    val s2 = p.velocity.lengthSquared()
                    th.n += 1
                    th.sv += p.velocity
                    th.ss += sqrt(s2)
                    th.ss2 += s2
                    th.sh += p.heat
                    b.thermo = th
                }
                if (b.`when`.isNotEmpty() && !gatePasses(conditions, b, p, env)) continue
                env.vector = delta
                env.dist = if (d < 1f) 1f else d
                // modifier pass (workover v0.3 contract): gates OR, strengths multiply.
                val cls = classified(b)
                var sMul = 1f
                var gated = false
                var hasModifier = false
                for (tok in cls.modifiers) {
                    val force = forces[tok] ?: continue
                    if (!force.hasModify) continue
                    hasModifier = true
                    val m = force.modify(b, p, env) ?: continue
                    m.strength?.let { sMul *= it }
                    if (m.gate) gated = true
                }
                for (tok in cls.forces) {
                    val force = forces[tok] ?: continue
                    if (!force.hasModify) continue
                    hasModifier = true
                    val m = force.modify(b, p, env) ?: continue
                    m.strength?.let { sMul *= it }
                    if (m.gate) gated = true
                }
                if (gated) continue // spotlight cone excludes this particle
                var screenMul = 1f
                if (sc != null) {
                    for (i in sc.indices) if (sc[i] !== b) screenMul *= screenFall[i]
                }
                val attn = b.attn ?: 1f
                val mul = sMul * attn * screenMul
                if (!hasModifier && mul == 1f) {
                    for (tok in b.tokens) forces[tok]?.let { applyForce(it, b, p, env, inv) }
                } else if (!hasModifier) {
                    val origS = b.strength
                    b.strength = origS * mul
                    for (tok in b.tokens) forces[tok]?.let { applyForce(it, b, p, env, inv) }
                    b.strength = origS
                } else {
                    val origS = b.strength
                    b.strength = origS * mul
                    for (tok in b.tokens) {
                        val f = forces[tok]
                        if (f != null && !f.hasModify) applyForce(f, b, p, env, inv)
                    }
                    b.strength = origS
                }
            }
        }

        // short-range particle-to-particle separation to prevent clumping.
        if (input.separation > 0f) {
            for (n in env.neighbors(p, 12f)) {
                val deltaS = p.position - n.position
                val dd = deltaS.length()
                val dist = if (dd < 0.1f) 0.1f else dd
                if (dist < 12f) {
                    val force = ((12f - dist) / 12f) * input.separation * 0.12f
                    p.velocity += (deltaS / dist) * force
                }
            }
        }

        // velocity-Verlet second half (#659): fold this step's impulse into the half-step average.
        if (verlet) {
            // the pass's net Δv is a′·dt — every force above evaluated at the updated position.
            val dv = p.velocity - v0
            if (env.kinTouch) {
                // a kinematic (velocity-REPLACING) force fired: a discontinuity, not an acceleration.
                // The replaced velocity stands as-is; the stored acceleration resets so the next
                // position step doesn't extrapolate across the break.
                p.accel = Vec3.ZERO
            } else {
                // v(t+dt) = v(t) + ½·(a(t) + a′)·dt — ½·a(t)·dt from the stored lane, ½·Δv for a′.
                p.velocity = v0 + ((p.accel ?: Vec3.ZERO) * dt + dv) * 0.5f
                p.accel = dv / dt
            }
        }

        // global safety cap (§20.10): no token or composite may drive a particle past c.
        val capC = env.c
        val sp2 = p.velocity.lengthSquared()
        if (sp2 > capC * capC) p.velocity *= capC / sqrt(sp2)

        // integrate, then damp (§2.2). Velocity-Verlet already took its position full-step before
        // the force pass; its decays (like FIXED's) are dt-scaled — see `fr` above.
        if (!verlet) p.position += p.velocity * dt
        p.velocity *= fr

        // wander (after damping): a periodic brownian jitter every 40 frames + a curl eddy (§7).
        if (env.frameN % 40 == 0 && form.wander > 0f) {
            val wsc = 0.05f * form.wander
            p.velocity = Vec3(
                p.velocity.x + (Random.nextFloat() - 0.5f) * wsc,
                p.velocity.y + (Random.nextFloat() - 0.5f) * wsc,
                if (d3 > 0f) p.velocity.z + (Random.nextFloat() - 0.5f) * wsc else p.velocity.z,
            )
        }
        if (form.wander > 0.05f) {
            val cn = (sin(p.position.x * 0.0032f + env.t * 0.12f) + cos(p.position.y * 0.0034f - env.t * 0.15f)) * PI_F
            p.velocity = Vec3(
                p.velocity.x + cos(cn) * 0.013f * form.wander,
                p.velocity.y + sin(cn) * 0.013f * form.wander,
                p.velocity.z,
            )
        }

        p.heat *= heatDecay

        // mortal matter ages (the class-[S] sink); immortal base-field matter (age null) is untouched.
        val age = p.age
        if (age != null) {
            val na = age - dt
            p.age = na
            if (na <= 0f) {
                if (dead == null) dead = mutableListOf(p) else dead.add(p)
            }
        }

        // toroidal wrap at the edges (z wraps only in a volumetric field).
        var px = p.position.x
        var py = p.position.y
        var pz = p.position.z
        if (px < -EDGE) px = w + EDGE else if (px > w + EDGE) px = -EDGE
        if (py < -EDGE) py = h + EDGE else if (py > h + EDGE) py = -EDGE
        if (d3 > 0f) {
            if (pz < -EDGE) pz = d3 + EDGE else if (pz > d3 + EDGE) pz = -EDGE
        }
        p.position = Vec3(px, py, pz)
    }

    // class-[S] sources (§20.1): a body-level pass after the per-particle loop, once per frame.
    if (hasBodies) {
        for (b in bodies) {
            if (b.isVisible && b.tokens.isNotEmpty()) {
                for (tok in b.tokens) forces[tok]?.source(b, env)
            }
        }
    }

    // remove expired mortal matter.
    dead?.let { for (p in it) store.remove(p) }
}
