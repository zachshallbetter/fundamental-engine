package com.fundamental.core.engine

import com.fundamental.core.math.nearestOnBox
import com.fundamental.core.math.Vec3
import com.fundamental.core.math.netField
import com.fundamental.core.math.clamp
import kotlin.math.acos
import kotlin.math.sqrt
import kotlin.random.Random

// Streamlines / vector-field probes (streamlines.ts, §20.6 diagnostic) — the Kotlin port of the
// overlay-reading computations in swift/Sources/FundamentalCore/Engine/Streamlines.swift.
// `netField` lives in Geometry.kt; this file adds the force probe + the field-line tracer.

// PURITY (#1172, the Kotlin half of JS #1155 / Swift #1162). A probe is an INSTRUMENT, not matter: it
// may read the field and must never write to it. That contract used to be incidental rather than
// structural. Kotlin got the ENV half right by accident — `forceAt` builds its own `Env()` rather than
// threading the caller's live one, and Kotlin's service defaults are already no-ops — but an inert env
// alone cannot close this, because `sink` writes `body.accreted` DIRECTLY, through no service at all:
//
//     if (particle.cap != null || env.dist >= body.absorbR) return
//     particle.cap = body
//     body.accreted += 1f                                       // ← a REAL body
//     if (body.accreted >= body.capacity) env.supernova(body)
//
// And the probe `Particle` is FRESH per call, so `cap` is always null and that guard never
// short-circuits — unlike the JS engine, whose one module-level probe carried `cap` for the life of the
// process and so over-accreted a body exactly once, self-limiting by accident. Every probe point inside
// `absorbR` accreted, on every sample of every frame: a 12-frame streamlines walk over one capacity-4
// sink accreted 420 times, the same figure Swift measured.
//
// Kotlin stopped short of detonating the body on the spot only because the bare env's `supernova` is a
// no-op — which made the bug HARDER to diagnose, not milder. The corrupted `accreted` drives the body's
// load metric and feedback vars, and pushes it past `capacity`, so the INTEGRATOR'S next genuine
// capture detonates it: a body exploding with no cause the simulation can account for, frames after the
// drawing that caused it.
//
// So the env is now built deliberately by [makeProbeEnv] and carries the [Env.isProbe] marker, which
// `sink` checks before accreting. One writer, one reader. The drawn vectors are unchanged for every
// non-mutating force — `sink` contributes no velocity either way — so the cross-plane conformance
// golden is byte-identical.

/**
 * The probe's own noise seed (the golden-ratio constant JS's `streamlines.ts` uses). A fresh generator
 * is built for every sample, so a stochastic force (`jet`'s nozzle cone, `thermal`'s Langevin kick,
 * `morph`'s jitter) reads the same at the same point however many samples came before it — and a
 * drawn diagnostic is reproducible rather than drawn from the platform generator, which is what a bare
 * [Env] defaults to.
 */
const val PROBE_SEED: Long = 0x9e37_79b9L

/**
 * The env one probe sample runs under. Every service that WRITES is inert — [Env.spark]/[Env.supernova]
 * /[Env.spawn] keep [Env]'s no-op defaults and [Env.grid] hands back a `NoopGrid`, so `diffuse`/`memory`
 * never wear the real field — and [Env.rng] is the probe's own freshly seeded stream. [Env.isProbe] tells
 * a force that writes engine state *outside the probe particle* (today only `sink`'s accretion) that this
 * pass is a reading, not a capture.
 *
 * Built per sample, as the Swift port does, rather than cached in a module-level singleton as the JS port
 * does: `forceAt` already allocates a fresh `Particle` per call, and a shared mutable env would not be
 * safe to sample from two threads.
 *
 * NOTE (the accuracy gap, deliberately unchanged here): Kotlin's `forceAt` takes no live env, so unlike
 * Swift's `makeProbeEnv(mirroring:)` this cannot mirror the caller's per-frame scalars (`t`, `frameN`,
 * `volume`, `c`, `G`, `form`) and its readings are correspondingly less faithful. That is an accuracy
 * gap, not a mutation one, and threading the live env is a public-signature change out of scope for
 * this fix.
 */
fun makeProbeEnv(): Env {
    val env = Env()
    env.isProbe = true
    val noise = Random(PROBE_SEED)
    env.rng = { noise.nextFloat() }
    // spark / supernova / spawn / grid are left at Env's defaults, which are already inert — the live
    // services are never handed to a probe pass.
    return env
}

/**
 * Net force a zero-velocity test particle would feel at a point — the field vector the streamlines /
 * force-vector readings draw. Mirrors the integrator's body-force loop (same range cull), minus the
 * per-particle modifier pass. A force that defines a `field()` contributes that instead of its `apply`,
 * so velocity-/charge-dependent forces (magnetism, charge) still appear on a still, neutral probe.
 *
 * READ-ONLY: the forces run against a probe env, so this never writes to the simulation (#1172).
 */
fun forceAt(bodies: List<Body>, forces: ForceRegistry, point: Vec3): Vec3 {
    val probe = Particle(position = point)
    val env = makeProbeEnv()
    var fieldSum = Vec3.ZERO
    for (b in bodies) {
        if (!b.isVisible || b.tokens.isEmpty()) continue
        val delta = if (b.shaped) nearestOnBox(point, b.box) - point else b.center - point
        val d2 = delta.lengthSquared()
        if (b.range > 0f && d2 >= b.range * b.range * 2.56f) continue
        val d = sqrt(d2)
        env.vector = delta
        env.dist = if (d < 1f) 1f else d
        for (tok in b.tokens) {
            val f = forces[tok] ?: continue
            if (f.hasModify) continue
            val v = f.field(b, point)
            if (v != null) fieldSum += v else f.apply(b, probe, env)
        }
    }
    return probe.velocity + fieldSum
}

// ── field-line tracing (fieldlines.ts, Stage B2) ──────────────────────────────────────────────────

/** A point sampler for the vector field being traced. */
typealias FieldSampler = (Vec3) -> Vec3

/** Options for [traceFieldLine]. */
data class FieldLineOpts(
    val step: Float = 6f,
    val maxSteps: Int = 400,
    val minStrength: Float = 1e-9f,
    /** Viewport (w, h); stop when the line leaves it by more than a step. Null = unbounded. */
    val bounds: Pair<Float, Float>? = null,
    val loopDist: Float = 6f,
    /** Turning budget in revolutions; stop once cumulative heading change exceeds it (orbit guard). */
    val maxTurns: Float = Float.POSITIVE_INFINITY,
)

private fun traceOne(sample: FieldSampler, seed: Vec3, dir: Float, o: FieldLineOpts): MutableList<Vec3> {
    val pts = mutableListOf(seed)
    var p = seed
    val m = o.step
    var prevDir = Vec3.ZERO
    var turned = 0f
    val turnBudget = o.maxTurns * 2f * Math.PI.toFloat()
    for (i in 0 until o.maxSteps) {
        val f = sample(p)
        val mag = f.length()
        if (!(mag >= o.minStrength)) break
        val u = (f / mag) * dir
        if (turnBudget.isFinite()) {
            if (prevDir != Vec3.ZERO) {
                val dot = clamp(u.dot(prevDir), -1f, 1f)
                turned += acos(dot)
                if (turned > turnBudget) break
            }
            prevDir = u
        }
        p += u * o.step
        val b = o.bounds
        if (b != null && (p.x < -m || p.y < -m || p.x > b.first + m || p.y > b.second + m)) break
        if (i > 4 && (p - seed).length() < o.loopDist) { pts.add(p); break }
        pts.add(p)
    }
    return pts
}

/** Trace a full field line through a seed: upstream reversed, then downstream, seed mid-line. */
fun traceFieldLine(sample: FieldSampler, seed: Vec3, opts: FieldLineOpts = FieldLineOpts()): List<Vec3> {
    val back = traceOne(sample, seed, -1f, opts)
    val fwd = traceOne(sample, seed, 1f, opts)
    back.reverse()
    if (back.isNotEmpty()) back.removeAt(back.size - 1) // drop the duplicated seed shared with fwd[0]
    return back + fwd
}

/** Trace a field line from each seed; empty/degenerate lines are dropped. */
fun traceFieldLines(sample: FieldSampler, seeds: List<Vec3>, opts: FieldLineOpts = FieldLineOpts()): List<List<Vec3>> =
    seeds.map { traceFieldLine(sample, it, opts) }.filter { it.size > 1 }
