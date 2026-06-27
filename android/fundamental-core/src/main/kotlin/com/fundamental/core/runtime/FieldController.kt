package com.fundamental.core.runtime

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Env
import com.fundamental.core.engine.FieldStore
import com.fundamental.core.engine.ForceRegistry
import com.fundamental.core.engine.Formation
import com.fundamental.core.engine.GridMode
import com.fundamental.core.engine.Particle
import com.fundamental.core.engine.Registry
import com.fundamental.core.engine.ScalarGridImpl
import com.fundamental.core.engine.StepInput
import com.fundamental.core.engine.builtinConditions
import com.fundamental.core.engine.easeFormation
import com.fundamental.core.engine.formation
import com.fundamental.core.engine.step
import com.fundamental.core.math.Vec3
import kotlin.math.max
import kotlin.random.Random

/**
 * The runtime driver — the platform-free, pure-Kotlin counterpart of the JS `createField` loop and the
 * Swift `FieldEngine`. It owns the particle pool, the per-frame environment, the scalar grids, and the
 * body list, and advances one frame on each [tick]. A host (the Compose `FieldView`, a `View`/`Canvas`
 * surface, a test) drives `tick()` and reads [particles] to render.
 *
 * No Android, no rendering — this is the engine wiring only, so it is fully unit-testable on the JVM.
 * Carrier waves are not wired yet (the `buildWaves` port is a follow-up); the field runs the
 * bodies-and-formations sim, which is the JS engine with `input.waves` empty.
 */
class FieldController(
    width: Float,
    height: Float,
    depth: Float = 0f,
    particleCount: Int = 300,
    /** Seed for reproducible runs (tests); null = nondeterministic. */
    seed: Long? = null,
) {
    val store = FieldStore()
    val forces: ForceRegistry = Registry.standardForces()
    private val conditions = builtinConditions()
    private val _bodies = ArrayList<Body>()
    val bodies: List<Body> get() = _bodies
    private val grids = HashMap<String, ScalarGridImpl>()
    private val rng = if (seed != null) Random(seed) else Random.Default

    val env = Env()
    private var w = width
    private var h = height
    private var d = depth
    private var formCurrent = Formation.NEUTRAL

    /** The formation the field eases toward (set via [setFormation]). */
    var formationTarget: Formation = Formation.NEUTRAL

    /** Short-range anti-clumping separation strength (0 = off). */
    var separation: Float = 0f

    init {
        env.volume = Vec3(w, h, d)
        env.dt = 1f
        env.neighbors = { p, r -> store.neighbors(p, r) }
        env.spawn = { store.add(it) }
        env.grid = { name -> grids.getOrPut(name) { ScalarGridImpl(w, h, modeForName(name)) } }
        env.supernova = { b -> releaseSink(b) }
        seedPool(particleCount)
    }

    private fun modeForName(name: String): GridMode = when {
        name.startsWith("wave") -> GridMode.WAVE
        name == "memory" -> GridMode.MEMORY
        else -> GridMode.DIFFUSE
    }

    private fun seedPool(n: Int) {
        repeat(n) {
            val p = Particle(
                position = Vec3(rng.nextFloat() * w, rng.nextFloat() * h, if (d > 0f) rng.nextFloat() * d else 0f),
                velocity = Vec3((rng.nextFloat() - 0.5f) * 2f, (rng.nextFloat() - 0.5f) * 2f, 0f),
            )
            p.gx = rng.nextFloat(); p.gy = rng.nextFloat(); p.gz = rng.nextFloat()
            store.add(p)
        }
    }

    /** Release a saturated sink's captured matter outward (the §6.9 supernova). */
    private fun releaseSink(b: Body) {
        for (p in store.particles) {
            if (p.cap === b) {
                p.cap = null
                val dir = p.position - b.center
                val dn = max(dir.length(), 1f)
                p.velocity = (dir / dn) * (3f + rng.nextFloat() * 3f)
                p.heat = max(p.heat, 0.8f)
            }
        }
        b.accreted = 0f
    }

    /** Resize the world (host viewport changed). */
    fun resize(width: Float, height: Float) {
        w = width
        h = height
        env.volume = Vec3(w, h, d)
        grids.values.forEach { it.resize(w, h) }
    }

    /** Register a force-source body. Marked visible so it acts immediately. */
    fun addBody(body: Body): Body {
        body.isVisible = true
        _bodies.add(body)
        return body
    }

    fun removeBody(body: Body) = _bodies.remove(body)

    /** Ease toward a named global formation (ambient / wells / lanes / scatter / accretion). */
    fun setFormation(name: String) {
        formation(name)?.let { formationTarget = it.preset }
    }

    /** One-shot: shove + heat matter near a point (the §11 burst interaction). */
    fun burst(x: Float, y: Float, power: Float = 1f) {
        val at = Vec3(x, y, 0f)
        for (p in store.particles) {
            val delta = p.position - at
            val dn = delta.length()
            if (dn < 140f) {
                val f = (1f - dn / 140f) * 6f * power
                val u = if (dn < 0.001f) Vec3.ZERO else delta / dn
                p.velocity += u * f
                p.heat = max(p.heat, 1f - dn / 140f)
            }
        }
    }

    /** Advance the field one frame: ease the formation, step the grids, then integrate. */
    fun tick(dt: Float = 1f) {
        env.dt = dt
        formCurrent = easeFormation(formCurrent, formationTarget)
        env.form = formCurrent
        store.reindex()
        for (g in grids.values) g.step()
        step(StepInput(store, _bodies, env, forces, conditions, separation = separation))
        env.frameN += 1
        env.t += dt
    }

    val particles: List<Particle> get() = store.particles
    val particleCount: Int get() = store.size
}
