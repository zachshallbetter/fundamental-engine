package com.fundamental.core.runtime

import com.fundamental.core.engine.AtomPayload
import com.fundamental.core.engine.AttnInput
import com.fundamental.core.engine.Body
import com.fundamental.core.engine.BoundParticle
import com.fundamental.core.engine.CANONICAL_FORCE_COLORS
import com.fundamental.core.engine.Env
import com.fundamental.core.engine.FieldStore
import com.fundamental.core.engine.FlowFocus
import com.fundamental.core.engine.Heatmap
import com.fundamental.core.engine.SparkPool
import com.fundamental.core.engine.Wave
import com.fundamental.core.engine.WaveStyle
import com.fundamental.core.engine.buildBound
import com.fundamental.core.engine.buildWaves
import com.fundamental.core.engine.healWaves
import com.fundamental.core.engine.induceCharges
import com.fundamental.core.engine.releaseCaptured
import com.fundamental.core.engine.tearBoundByForces
import com.fundamental.core.engine.SpillBody
import com.fundamental.core.engine.attentionMuls
import com.fundamental.core.engine.spillover
import com.fundamental.core.engine.ForceRegistry
import com.fundamental.core.engine.Formation
import com.fundamental.core.engine.GridMode
import com.fundamental.core.engine.Particle
import com.fundamental.core.engine.Registry
import com.fundamental.core.engine.ScalarGrid
import com.fundamental.core.engine.ScalarGridImpl
import com.fundamental.core.engine.StepInput
import com.fundamental.core.engine.builtinConditions
import com.fundamental.core.engine.easeFormation
import com.fundamental.core.engine.flowBias
import com.fundamental.core.engine.formation
import com.fundamental.core.engine.makeFlowFocus
import com.fundamental.core.engine.step
import com.fundamental.core.math.Vec3
import com.fundamental.core.math.clamp
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
    private val _edges = ArrayList<Edge>()
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

    /** Active flow focus (a transient pull point), or null. Set via [flowTo] / cleared by [clearFlow]. */
    var flow: FlowFocus? = null
        private set

    private val channels = HashMap<String, (Float, Float) -> Float>()

    // ── Body-Matter-Interaction toggles (§2.4 / Concept 4 / H1) ──────────────────────────────────
    /** Conserved attention — engaging a body drains the others (Σ S·mul invariant). */
    var attentionEnabled: Boolean = false
    /** Cross-boundary causality — saturated bodies spill density to neighbours (Σ deltas = 0). */
    var causalityEnabled: Boolean = false
    /** Density heatmap — a scalar buffer of where matter pools, sampled back + drawn as a glow. */
    var heatmapEnabled: Boolean = false
    private var heatmap: Heatmap? = null

    /** Micro-reaction sparks (§23) — emitted by forces via `env.spark`, drawn by the host. */
    val sparks = SparkPool()

    // ── carrier waves + the bound↔free reservoir (§2.3 / §2.4 / §24) ─────────────────────────────
    /** The ambient resting structure: five standing currents (decorative; off by default). */
    var wavesEnabled: Boolean = false
        set(value) { field = value; rebuildWaves() }
    private var _waves: List<Wave> = emptyList()
    val waves: List<Wave> get() = _waves
    private val _bound = ArrayList<BoundParticle>()
    val bound: List<BoundParticle> get() = _bound
    private var boundTarget: Int = 0

    private fun rebuildWaves() {
        if (wavesEnabled && w > 0f && h > 0f) {
            _waves = buildWaves(emptyList()) // palette empty → DEFAULT_ACCENT; the host recolors on draw
            _bound.clear()
            _bound.addAll(buildBound(_waves.size, density = 2f, rand = { rng.nextFloat() }))
            boundTarget = _bound.size
        } else {
            _waves = emptyList(); _bound.clear(); boundTarget = 0
        }
    }

    init {
        env.volume = Vec3(w, h, d)
        env.dt = 1f
        env.neighbors = { p, r -> store.neighbors(p, r) }
        env.spawn = { store.add(it) }
        env.grid = { name -> grids.getOrPut(name) { ScalarGridImpl(w, h, modeForName(name)) } }
        env.spark = { at, power, color -> sparks.emit(at, power, color) }
        env.supernova = { b ->
            releaseCaptured(store.particles, b, rng = { rng.nextFloat() }) // eject held matter, conserved
            sparks.emit(b.center, 3f, CANONICAL_FORCE_COLORS["sink"]) // the supernova flash (§23)
        }
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
    /** Resize the world (host viewport changed). */
    fun resize(width: Float, height: Float) {
        w = width
        h = height
        env.volume = Vec3(w, h, d)
        grids.values.forEach { it.resize(w, h) }
        heatmap?.resize(w, h)
        rebuildWaves()
    }

    /** Normalized heatmap density ∈ [0,1] at a point (0 when the heatmap is off). */
    fun sampleScalar(x: Float, y: Float): Float = heatmap?.norm(Vec3(x, y, 0f)) ?: 0f

    /** Heatmap density gradient at a point, up-slope toward denser matter. */
    fun sampleGradient(x: Float, y: Float): Vec3 = heatmap?.gradient(Vec3(x, y, 0f)) ?: Vec3.ZERO

    /** Register a force-source body. Marked visible so it acts immediately. */
    fun addBody(body: Body): Body {
        body.isVisible = true
        _bodies.add(body)
        return body
    }

    fun removeBody(body: Body): Boolean {
        // removing either endpoint automatically drops the edge (Swift FieldEngine parity).
        _edges.removeAll { it.from === body || it.to === body }
        return _bodies.remove(body)
    }

    // ── relationship edges (§addEdge) ──────────────────────────────────────────────────
    /** A directed relationship between two programmatic bodies; carries live strength + memory. */
    internal class Edge(
        val from: Body, val fromData: Any?, val to: Body, val toData: Any?,
        var type: String, var strength: Float, val direction: EdgeDirection,
    ) {
        var memory: Float = 0f
        var active: Boolean = false
    }

    /** Register an edge; returns an [EdgeHandle] to mutate strength/type or remove it. */
    fun addEdge(
        from: Body, fromData: Any?, to: Body, toData: Any?,
        type: String, strength: Float, direction: EdgeDirection,
    ): EdgeHandle {
        // strength is stored verbatim (no clamp) — Swift FieldEngine parity; the per-tick dynamics
        // (min(1)/max(0)) walk an out-of-range seed back into [0,1] on the next active/idle frame.
        val edge = Edge(from, fromData, to, toData, type, strength, direction)
        _edges.add(edge)
        return EdgeHandle(
            setImpl = { s, t -> s?.let { edge.strength = it }; t?.let { edge.type = it } },
            removeImpl = { _edges.remove(edge) },
        )
    }

    /** Snapshot all live edges (purging any whose endpoint left the field). */
    fun readEdges(): List<EdgeRecord> {
        _edges.removeAll { it.from !in _bodies || it.to !in _bodies }
        return _edges.map {
            EdgeRecord(it.fromData, it.toData, it.type, it.strength, it.memory, it.active, it.direction)
        }
    }

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

    /** Place / move a flow focus the field bends toward (§flowTo). */
    fun flowTo(x: Float, y: Float, strength: Float? = null, radius: Float? = null) {
        flow = makeFlowFocus(Vec3(x, y, 0f), strength, radius)
    }

    fun clearFlow() { flow = null }

    /**
     * Get or create a named [ScalarGrid] — exposed so [FieldHandle.grid] can access the same
     * grid the force system uses. The same logic as the internal env.grid lambda above.
     */
    fun grid(name: String): ScalarGrid = grids.getOrPut(name) { ScalarGridImpl(w, h, modeForName(name)) }

    /** Register / replace an external scalar field channel (the open-input analog of a render surface). */
    fun addFieldChannel(name: String, sampler: (Float, Float) -> Float) { channels[name] = sampler }

    fun removeFieldChannel(name: String) { channels.remove(name) }

    /** Sample a registered channel at (x, y); 0 if none by that name. */
    fun sampleField(name: String, x: Float, y: Float): Float = channels[name]?.invoke(x, y) ?: 0f

    /** Bind data records to the first `atoms.size` particles; a record's `weight` sets its size+mass basis. */
    fun seed(atoms: List<AtomPayload>) {
        val parts = store.particles
        for (i in atoms.indices) {
            if (i >= parts.size) break
            val a = atoms[i]
            parts[i].atom = a
            a.weight?.let { w -> parts[i].size = max(0.25f, w); parts[i].mass = max(0.25f, w) }
        }
    }

    /** The atom bound to the nearest seeded particle within `radius`, or null. */
    fun atomAt(x: Float, y: Float, radius: Float = 24f): AtomPayload? {
        val at = Vec3(x, y, 0f)
        var best: Particle? = null
        var bestD = Float.MAX_VALUE
        for (p in store.near(at, radius)) {
            if (p.atom == null) continue
            val d = (p.position - at).lengthSquared()
            if (d < bestD) { bestD = d; best = p }
        }
        return best?.atom
    }

    /** Copy live particle state into a caller buffer (stride 5: x, y, z, heat, size); returns the count written. */
    fun readParticles(out: FloatArray): Int {
        val n = minOf(store.size, out.size / PARTICLE_STRIDE)
        val parts = store.particles
        var i = 0
        for (k in 0 until n) {
            val p = parts[k]
            out[i++] = p.position.x; out[i++] = p.position.y; out[i++] = p.position.z
            out[i++] = p.heat; out[i++] = p.size
        }
        return n
    }

    /** Advance the field one frame: ease the formation, track programmatic bodies, apply flow, step. */
    fun tick(dt: Float = 1f) {
        env.dt = dt
        formCurrent = easeFormation(formCurrent, formationTarget)
        env.form = formCurrent
        // view-less programmatic bodies re-sample their position each frame.
        for (b in _bodies) b.rect?.let { b.box = it() }
        store.reindex()
        for (g in grids.values) g.step()
        // flow focus: a transient pull toward a moving point, before the body forces integrate.
        val f = flow
        if (f != null) {
            for (p in store.particles) if (p.cap == null) p.velocity += flowBias(p.position, f)
        }
        // conserved attention (§2.4): set each body's strength multiplier before the force pass.
        if (attentionEnabled && _bodies.isNotEmpty()) {
            val muls = attentionMuls(_bodies.map { AttnInput(it.strength, it.isEngaged) })
            _bodies.forEachIndexed { i, b -> b.attn = muls[i] }
        } else {
            for (b in _bodies) b.attn = null
        }

        // charge induction (§2.4): charge bodies polarize nearby matter, so charge/magnetism act.
        induceCharges(_bodies, store.particles)

        step(StepInput(store, _bodies, env, forces, conditions, waves = if (wavesEnabled) _waves else null, separation = separation))

        // the bound↔free reservoir (§2.4): heal calm matter onto the lines, tear it loose near bodies.
        if (wavesEnabled && _waves.isNotEmpty()) {
            healWaves(store, _bound, boundTarget, _waves, w, h, env.t) { rng.nextFloat() }
            tearBoundByForces(_bound, _waves, _bodies, forces, w, h, env.t) { store.add(it) }
        }

        // feedback easing (§8): ease each body's density toward its per-frame tally (step set b.count).
        for (b in _bodies) b.d += (clamp(b.count / 40f, 0f, 1f) - b.d) * 0.12f

        // relationship edges (§addEdge): strength rises while the source body is salient (d > 0.08),
        // decays idle; memory accretes longitudinally and holds. Mirrors FieldEngine.swift line-for-line.
        if (_edges.isNotEmpty()) {
            val edt = env.dt
            for (e in _edges) {
                e.active = e.from.d > 0.08f
                if (e.active) {
                    e.strength = minOf(1f, e.strength + 1.5f * edt)
                    e.memory = minOf(1f, e.memory + 0.2f * edt)
                } else {
                    e.strength = maxOf(0f, e.strength - 0.3f * edt)
                    // memory holds — no decay on idle
                }
            }
        }

        // cross-boundary causality (Concept 4): saturated bodies spill density to neighbours (ΣΔ = 0).
        if (causalityEnabled) {
            val vis = _bodies.filter { it.isVisible }
            if (vis.size >= 2) {
                val deltas = spillover(vis.map { SpillBody(it.d, it.center) })
                vis.forEachIndexed { i, b -> b.lit += (max(0f, deltas[i]) - b.lit) * 0.2f }
            }
        } else {
            for (b in _bodies) b.lit = 0f
        }

        // density heatmap (H1): deposit + decay the scalar buffer once per frame.
        if (heatmapEnabled) {
            val hm = heatmap ?: Heatmap(w, h).also { heatmap = it }
            hm.update(store.particles)
        }

        sparks.update() // §23 micro-reaction matter: drift, damp, fade, drop

        env.frameN += 1
        env.t += dt
    }

    val particles: List<Particle> get() = store.particles
    val particleCount: Int get() = store.size
}
