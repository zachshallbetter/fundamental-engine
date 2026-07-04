package com.fundamental.core.runtime

import com.fundamental.core.engine.AtomPayload
import com.fundamental.core.engine.AttnInput
import com.fundamental.core.engine.Body
import com.fundamental.core.engine.BoundParticle
import com.fundamental.core.config.CANONICAL_FORCE_COLORS
import com.fundamental.core.engine.Env
import com.fundamental.core.engine.FieldBodyIdentity
import com.fundamental.core.engine.FieldPolicy
import com.fundamental.core.engine.FieldStore
import com.fundamental.core.engine.effectiveMotion
import com.fundamental.core.engine.policyPermitsBodyData
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
import com.fundamental.core.engine.FieldHost
import com.fundamental.core.engine.ForceRegistry
import com.fundamental.core.engine.Formation
import com.fundamental.core.engine.GridMode
import com.fundamental.core.engine.IntegratorMode
import com.fundamental.core.engine.Particle
import com.fundamental.core.engine.Registry
import com.fundamental.core.engine.ScalarGrid
import com.fundamental.core.engine.ScalarGridImpl
import com.fundamental.core.engine.StepInput
import com.fundamental.core.engine.builtinConditions
import com.fundamental.core.engine.easeFormation
import com.fundamental.core.engine.flowBias
import com.fundamental.core.engine.forceAt
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
    /**
     * Seed for reproducible runs; null = nondeterministic. The seeded generator is injected as
     * [Env.rng] (the JS `FieldOptions.rng` / #371 mirror), so it covers ALL engine randomness —
     * pool seeding, the integrator's brownian wander, force jitter (thermal / jet / morph / spawn),
     * spark counts + directions, and supernova release angles (the determinism seam, #974).
     */
    seed: Long? = null,
    /**
     * The integration scheme (the JS `FieldOptions.integrator`, doc 04 §Step 3 / #659). Opt-in:
     * [IntegratorMode.LEGACY] (the default) is the shipped engine, byte-identical.
     */
    integrator: IntegratorMode = IntegratorMode.LEGACY,
    /**
     * DECLARED ambient bias (Wallpaper Rule, JS #978): the resting `ambient` formation's tangential
     * swirl on `attract` (the JS `FieldOptions.ambientOrbit`). Formerly a hardcoded `0.1` in the JS
     * ambient preset; here it overrides the ambient preset's orbit when [setFormation]`("ambient")`
     * runs. Defaults to `0.1` (the historical value); `0` gives a purely radial resting attract.
     */
    private val ambientOrbit: Float = 0.1f,
    /**
     * DECLARED ambient bias (Wallpaper Rule, JS #978): the resting `ambient` formation's `wander`
     * drift (the JS `FieldOptions.ambientWander`). Defaults to `1.0` (the historical value); overrides
     * the ambient preset's wander when [setFormation]`("ambient")` runs.
     */
    private val ambientWander: Float = 1.0f,
) {
    val store = FieldStore()
    val forces: ForceRegistry = Registry.standardForces()

    /**
     * FIRST-CLASS IDENTITY resolver (substrate — JS #884). Derive a [FieldBodyIdentity] for a scanned
     * body from a host-supplied platform id. Called once per body, the first time it is keyed; the
     * returned identity is cached on the body. Return null to fall back to the default derivation (a
     * monotonic `body-N`). Programmatic `addBody(identity = …)` overrides this. Additive — leaving it
     * null reproduces the pre-identity behavior.
     */
    var identify: ((Body) -> FieldBodyIdentity?)? = null
    private var bodyIdSeq = 0

    /**
     * Resolve a body's stable [FieldBodyIdentity], caching it on first keying (JS #884 semantics).
     * Precedence: an already-resolved / supplied identity → the [identify] resolver → a monotonic
     * `body-N` synthetic. Deterministic (never random); stable for the body's life.
     */
    fun bodyIdentity(b: Body): FieldBodyIdentity {
        b.identity?.let { return it }
        val ident = identify?.invoke(b) ?: FieldBodyIdentity(id = "body-${bodyIdSeq++}")
        b.identity = ident
        return ident
    }
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

    /** The name of the active global formation — the JS `formationName`, reported by [FieldHandle.query]. */
    var formationName: String = "ambient"
        private set

    /** Short-range anti-clumping separation strength (0 = off). */
    var separation: Float = 0f

    /** Called once per tick, after the force step and all feedback — used by [FieldHandle] for events + agents. */
    var onAfterTick: (() -> Unit)? = null

    // ── runtime FIELD POLICY (JS #892) ────────────────────────────────────────────────────────────
    /**
     * What THIS host/session/user/app PERMITS (runtime), distinct from governance (static lint). Replace
     * live via [setPolicy]. Default: unbounded → byte-identical to the pre-policy engine. Reduced-motion
     * (fed via [reducedMotion]) ALWAYS wins over any policy in [effectiveMotion].
     */
    var policy: FieldPolicy = FieldPolicy.UNBOUNDED
        private set

    /**
     * The current reduced-motion signal, fed by the host (the Kotlin analog of the JS host's
     * `reducedMotion()` — the controller is host-agnostic, so the platform/handle feeds it like scroll).
     * When true, [effectiveMotion] is 0 regardless of policy: motion can only be lowered, never raised.
     */
    var reducedMotion: Boolean = false

    /** Replace the runtime policy (JS #892 `setPolicy` — REPLACE, not merge). Reduced-motion still wins. */
    fun setPolicy(next: FieldPolicy) { policy = next }

    /** The effective motion allowance `0..1` this frame — reduced-motion + policy folded (JS #892). */
    fun effectiveMotion(): Float = effectiveMotion(policy, reducedMotion)

    /** Whether the policy permits body data to be exposed (JS #892) — policy tightens, never widens. */
    fun policyPermitsBodyData(): Boolean = policyPermitsBodyData(policy)

    // ── loop lifecycle (pause / resume — the Swift #605 mirror) ──────────────────────────────────
    // Two independent pause lanes, both gating the SAME host-scheduled loop:
    //   userPaused — an explicit pause()/resume() pair, sticky (a visibility resume never overrides it);
    //   hostPaused — presentation-driven (the host reported hidden through the visibility seam).
    // The loop runs only while BOTH are false; syncLoop() is the single reconciliation point, so
    // double-pause / double-resume are no-ops by construction. Simulation state is never touched.
    // Mirrors FieldEngine.swift line-for-line; the one structural divergence is that this port's hosts
    // may also drive [tick] directly (no display link to cancel there), so the same lanes gate [tick]
    // itself — see the guard at its top.
    private var host: FieldHost? = null
    private var loopToken: Any? = null
    private var userPaused = false
    private var hostPaused = false
    /** Set by [destroy] — a late [resume] can never resurrect a torn-down field's loop. */
    private var destroyed = false
    /** Previous frame time (ms) — drives the frame-rate-independent dt. Null = re-based: next frame runs at dt 1. */
    private var lastTimestampMs: Double? = null
    private var unsubscribeVisibility: (() -> Unit)? = null

    /**
     * Attach a [FieldHost] and start the host-scheduled frame loop — the Kotlin counterpart of the
     * Swift `FieldEngine` taking its host at init. The controller then drives [tick] once per display
     * frame through [FieldHost.scheduleFrame] (dt normalized to the 60 fps baseline, clamped 0.2..2,
     * first frame 1, reduced-motion folded in) and mirrors the host's visibility seam into the
     * presentation pause lane, so hiding the surface cancels the loop entirely and showing it
     * reschedules — the Swift `visibilityChanged()` / the JS Page Visibility rAF pause. One attach per
     * controller; hosts that drive [tick] directly (the Compose adapter, the lab) simply never attach.
     */
    fun attach(host: FieldHost) {
        if (destroyed || this.host != null) return
        this.host = host
        unsubscribeVisibility = host.onVisibility {
            hostPaused = host.isHidden
            syncLoop()
        }
        // Seed the presentation lane from the host's CURRENT state — a field born hidden (created
        // before its surface attaches, or while it is off screen) never schedules an idle loop; the
        // first visibility resume starts it. (Mirrored by the Swift engine's init since #960.)
        hostPaused = host.isHidden
        syncLoop()
    }

    /**
     * Explicit pause — cancel the host-scheduled loop, keep every bit of simulation state. Sticky: a
     * host visibility resume never overrides it; only [resume] does. Idempotent. For a host that
     * drives [tick] directly (no [attach]), the same lane makes [tick] a no-op instead.
     */
    fun pause() {
        userPaused = true
        syncLoop()
    }

    /** Explicit resume — restart a paused loop (unless the host still reports hidden). Idempotent. */
    fun resume() {
        userPaused = false
        syncLoop()
    }

    /** Tear the loop down for good: cancel scheduling, drop the visibility subscription. Irreversible. */
    fun destroy() {
        destroyed = true
        unsubscribeVisibility?.invoke()
        unsubscribeVisibility = null
        syncLoop()
        clearFlow()
    }

    /**
     * The single loop reconciliation point: run ⟺ not destroyed ∧ not user-paused ∧ not host-paused.
     * Idempotence lives here — a redundant pause/resume finds the loop already in the right state.
     * Mirrors FieldEngine.swift `syncLoop()`.
     */
    private fun syncLoop() {
        val h = host ?: return
        val shouldRun = !destroyed && !userPaused && !hostPaused
        if (shouldRun) {
            if (loopToken != null) return // already running
            // No time-jump on resume: forget the pre-pause frame time so the first resumed frame
            // integrates at dt = 1, exactly like the field's first-ever frame. (The 0.2..2 dt clamp
            // would cap a stale gap anyway; this removes it entirely.)
            lastTimestampMs = null
            loopToken = h.scheduleFrame(::onFrame)
        } else {
            val token = loopToken ?: return
            h.cancelFrame(token)
            loopToken = null
        }
    }

    /** One host-scheduled frame: fold the host signals, derive dt, advance the sim. */
    private fun onFrame(timestampMs: Double) {
        val h = host ?: return
        // Per-tick fallback guard (mirror of Swift `guard !host.isHidden`): a host that reports hidden
        // without firing the visibility seam still stops integrating. `lastTimestampMs` is left
        // untouched, so the eventual visible frame clamps rather than integrating the hidden gap.
        if (h.isHidden) return
        reducedMotion = h.prefersReducedMotion
        // Frame-rate-independent timestep (#434): the real frame interval normalized to a 60 fps
        // baseline (≈1 at 60 fps, ≈0.5 at 120 fps), clamped so a long stall can't teleport matter.
        val last = lastTimestampMs
        val dtRaw = if (last == null) 1f else ((timestampMs - last) * 60.0 / 1000.0).toFloat()
        lastTimestampMs = timestampMs
        tick(dtRaw.coerceIn(0.2f, 2f))
    }

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

    /** Micro-reaction sparks (§23) — emitted by forces via `env.spark`, drawn by the host. Draws its
     *  counts + directions from the controller's rng, so a seeded run's sparks replay too (#974). */
    val sparks = SparkPool { rng.nextFloat() }

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
        env.integrator = integrator
        // the determinism seam (#974): every random draw in the engine — integrator wander, force
        // jitter, spark emission — flows through Env.rng, so a seeded controller run is reproducible.
        env.rng = { rng.nextFloat() }
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

    /**
     * The opaque `data` record carried by each programmatic body (the JS `b.data`). The engine [Body] has
     * no data slot, so the handle stores it here at [addBody]; snapshots read it back via [dataOf] (gated
     * by `includeData` + policy). Keyed by identity so it survives the body's life.
     */
    private val bodyData = HashMap<Body, Any?>()

    /** Register a force-source body. Marked visible so it acts immediately. */
    fun addBody(body: Body, data: Any? = null): Body {
        body.isVisible = true
        _bodies.add(body)
        if (data != null) bodyData[body] = data
        return body
    }

    /** The opaque `data` record carried by [body], or null. Read by [FieldHandle.snapshot] (privacy-gated). */
    fun dataOf(body: Body): Any? = bodyData[body]

    fun removeBody(body: Body): Boolean {
        // removing either endpoint automatically drops the edge (Swift FieldEngine parity).
        _edges.removeAll { it.from === body || it.to === body }
        bodyData.remove(body)
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

    /**
     * The live edges with their [Body] endpoints (purging any whose endpoint left the field) — the
     * shared read behind [readEdges] and [FieldHandle]'s identity-keyed relationship readings
     * (`query()` / `snapshot()`), which need the endpoint bodies to resolve [bodyIdentity].
     */
    internal fun liveEdges(): List<Edge> {
        _edges.removeAll { it.from !in _bodies || it.to !in _bodies }
        return _edges.toList()
    }

    /** Snapshot all live edges (purging any whose endpoint left the field). */
    fun readEdges(): List<EdgeRecord> = liveEdges().map {
        EdgeRecord(it.fromData, it.toData, it.type, it.strength, it.memory, it.active, it.direction)
    }

    /** Ease toward a named global formation (ambient / wells / lanes / scatter / accretion). */
    fun setFormation(name: String) {
        formation(name)?.let {
            // `ambient` carries the two DECLARED dials (JS #978); other formations keep authored presets.
            formationTarget = if (name == "ambient") it.preset.copy(orbit = ambientOrbit, wander = ambientWander) else it.preset
            formationName = name
        }
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
        // Loop-lifecycle guard (#605 mirror): a paused or destroyed field never advances. The
        // host-scheduled loop is already cancelled by syncLoop(); a host that drives tick() directly
        // (the Compose adapter, the lab) gets the same contract through this guard. State is retained.
        if (destroyed || userPaused || hostPaused) return
        // Effective motion (JS #892): reduced-motion + policy fold into the step. At the unbounded
        // default (no policy, no reduced-motion) this is dt · 1 → byte-identical. Reduced-motion clamps
        // to 0 (frozen); a motion budget scales the step proportionally.
        env.dt = dt * effectiveMotion()
        formCurrent = easeFormation(formCurrent, formationTarget)
        env.form = formCurrent
        // view-less programmatic bodies re-sample their position each frame.
        // Scroll body-centre tracking (JS #508, native audit #509): geometry is re-sampled EVERY
        // tick (rect closures here; view-backed boxes pushed per frame by the host — Compose
        // onGloballyPositioned / the platform MeasurementRegistry's per-frame read phase), so a
        // body's force-centre tracks a scroll/pan with zero staleness. The JS core measures only
        // every 6th frame (getBoundingClientRect can force layout) and compensates the cached
        // centres by the per-frame scroll delta between measures; a fresh per-frame read makes
        // that shift unnecessary — adding it would double-count. If a measure cadence is ever
        // introduced, port the JS compensation with its contained guard. Pinned by
        // ScrollTrackingTests.
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
        onAfterTick?.invoke()
    }

    /**
     * Probe the net force a particle would experience at world point (x, y). Uses the same
     * [forceAt] function the streamlines overlay draws — applies all visible body forces to a
     * temporary probe particle and returns the accumulated velocity delta. Safe to call between
     * ticks. Mirrors Swift `FieldEngine.sample(x:y:)`. Exposed via [FieldHandle.sample].
     */
    fun sample(x: Float, y: Float): Vec3 = forceAt(_bodies, forces, Vec3(x, y, 0f))

    val particles: List<Particle> get() = store.particles
    val particleCount: Int get() = store.size
}
