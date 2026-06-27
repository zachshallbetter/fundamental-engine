package com.fundamental.core.engine

import com.fundamental.core.math.Vec3

// The core contracts — the Kotlin port of swift/Sources/FundamentalCore/Engine/Types.swift, trimmed
// to what the foundation slice needs. `Particle`/`Body`/`Env` are classes (reference semantics) on
// purpose: forces mutate them in place, exactly as the JS engine mutates particles and `env` in the
// hot loop. Fields the later forces/integrator need are added incrementally; nothing here is final.

/** An axis-aligned box — a body's geometry. Flat (`halfExtents.z == 0`) on 2D hosts. */
data class Box(
    val center: Vec3 = Vec3.ZERO,
    val halfExtents: Vec3 = Vec3.ZERO,
) {
    /** Half-width / half-height — the JS `hw`/`hh`. */
    val hw: Float get() = halfExtents.x
    val hh: Float get() = halfExtents.y
}

/** A free particle — the lightest agent. Positions/velocities are 3D; z stays 0 on flat fields. */
class Particle(
    var position: Vec3 = Vec3.ZERO,
    var velocity: Vec3 = Vec3.ZERO,
    /** ∈ [0,1]; drives color, size, and glow. */
    var heat: Float = 0f,
    /** Render-radius basis; also the collision/SPH radius. */
    var size: Float = 1f,
) {
    /** The sink/blackhole body holding this particle, or null (§6.9). */
    var cap: Body? = null

    /** Inertial mass — 1 = nominal (§21). */
    var mass: Float = 1f

    /** Stable per-particle scatter fractions, for `spread`/`morph` assignment (§7). */
    var gx: Float = 0.5f
    var gy: Float = 0.5f
    var gz: Float = 0.5f

    // ── extended-force attributes (§20) ──────────────────────────────────────────────
    /** Frames-to-live for mortal (spawned) matter; null = immortal. */
    var age: Float? = null

    /** Signed charge q, for `charge` / `magnetism` (§20.10). */
    var charge: Float? = null

    /** Species tag, for `hunt` (§20.3). */
    var species: Int? = null

    /** Carried pigment, conserved color transport (§20.8). */
    var color: String? = null

    /** Opaque data record bound by `FieldHandle.seed`. */
    var atom: AtomPayload? = null
}

/**
 * An opaque data record bindable to a particle via `FieldHandle.seed`. `weight` (a size/mass basis)
 * scales that particle's mass + size. Mirror of Swift's `AtomPayload`.
 */
class AtomPayload(var weight: Float? = null, var payload: Map<String, Any?> = emptyMap())

/** A registered view acting as a force source. */
class Body(
    /** Space-joined force ids (they compose). */
    var tokens: List<String> = emptyList(),
    var strength: Float = 1f,
    var range: Float = 100f,
    /** Capture radius for `sink` (§6.9). */
    var absorbR: Float = 10f,
    /** Captured-load ceiling before `sink` releases as a supernova (§6.9). */
    var capacity: Float = 30f,
    var spin: Float = 1f,
    /** Heading in 3D — the dipole axis, orbit axis, jet direction. */
    var heading: Vec3 = Vec3(0f, -1f, 0f),
    /** 3D geometry, refreshed each scan frame. */
    var box: Box = Box(),
    /** hover/focus/tap → active (`b.on` in JS). */
    var isEngaged: Boolean = false,
    /** Source mass M for `gravity`/`charge` (§20.10/§21). */
    var M: Float = 1f,
) {
    /** Captured load held by `sink` (was `mass`, §21.2). */
    var accreted: Float = 0f

    /** Eased density ∈ [0,1] — amplifies the charge/gravity field as a body charges up (§20.10). */
    var d: Float = 0f
    /** Cross-boundary causality channel (Concept 4): density spilled in from saturated neighbours. */
    var lit: Float = 0f

    /** Tint a `pigment` body stains onto overlapping matter (§20.8). */
    var tint: String? = null

    /** Assembly marks for `morph` (§20.3 [D]) — points, never letterforms. */
    var targets: List<Vec3>? = null

    // ── source budget for `spawn` (§20) ──────────────────────────────────────────────
    var life: Float? = null
    var sourceCap: Int? = null
    var emitAcc: Float? = null

    // ── warp / wormhole pairing, resolved each scan (§22.3) ──────────────────────────
    var warpHas: Boolean = false
    var warpTarget: Vec3? = null
    var twist: Float? = null
    var warpScale: Float? = null

    // ── runtime state read/written by the integrator ─────────────────────────────────
    /** On-screen and exerting force (§2.1). */
    var isVisible: Boolean = false
    /** Shaped source: forces reference the nearest point on the box, not its centre. */
    var shaped: Boolean = false
    /** Condition gate token (§5); empty = always on. Backtick-escaped (Kotlin keyword). */
    var `when`: String = ""
    /** Opt-in to two-way density/thermo sampling (§8). */
    var feedback: Boolean = false
    /** Per-frame density tally (§8). */
    var count: Float = 0f
    /** Conserved-attention strength multiplier (§2.4); null = neutral (1). */
    var attn: Float? = null
    /** Screen quiet-zone floor (§"screen"). */
    var screenMin: Float? = null
    /** Memoized token classification (filled lazily by the integrator). */
    var classified: ClassifiedTokens? = null
    /** Per-frame position source for a view-less programmatic body (`FieldHandle.addBody`); sampled each tick. */
    var rect: (() -> Box)? = null
    /** Thermodynamic accumulators (workover §"Metrics"); non-null opts the body into sampling. */
    var thermo: Thermo? = null
    /** Eased thermodynamic readout. */
    var metrics: Metrics? = null

    val center: Vec3 get() = box.center
}

/** Token classification — `{ modifiers, forces }` per the modifier contract (workover v0.3). */
data class ClassifiedTokens(val modifiers: List<String>, val forces: List<String>)

/** The formalized modifier order (workover v0.3): spotlight → screen → resonate. */
val MODIFIER_ORDER: List<String> = listOf("spotlight", "screen", "resonate")

/** Split a body's tokens into modifiers (in contract order) and forces (in authored order). */
fun classifyBodyTokens(tokens: List<String>): ClassifiedTokens {
    val modifiers = MODIFIER_ORDER.filter { tokens.contains(it) }
    val forces = tokens.filter { it !in MODIFIER_ORDER }
    return ClassifiedTokens(modifiers, forces)
}

/** A global bias on every free particle. Only `orbit` is exercised by the foundation forces. */
data class Formation(
    val driftX: Float = 0f,
    val wander: Float = 0f,
    val orbit: Float = 0f,
    val spread: Float = 0f,
    val conv: Float = 0f,
) {
    companion object {
        val NEUTRAL = Formation()
    }
}

/** A scalar field grid (§20.1 class [C]) — the substrate diffuse/propagate/memory read and write. */
interface ScalarGrid {
    fun sample(at: Vec3): Float
    fun deposit(at: Vec3, amount: Float)
    fun gradient(at: Vec3): Vec3
}

/** A grid that holds nothing — the default until the scalar-grid port lands. Grid-backed forces no-op. */
class NoopGrid : ScalarGrid {
    override fun sample(at: Vec3): Float = 0f
    override fun deposit(at: Vec3, amount: Float) {}
    override fun gradient(at: Vec3): Vec3 = Vec3.ZERO
}

/**
 * The shared per-frame environment handed to every force. A class because the integrator updates
 * `vector`/`dist` per body–particle pair in the hot loop (as the JS engine mutates `env.dx/dy/dist`).
 */
class Env {
    /** Vector from particle to body: (body.center − particle.position). */
    var vector: Vec3 = Vec3.ZERO

    /** |vector|, clamped ≥ 1. */
    var dist: Float = 1f

    /** The active, eased formation. */
    var form: Formation = Formation.NEUTRAL

    /** World volume (width, height, depth). Depth = 0 on 2D platforms. */
    var volume: Vec3 = Vec3.ZERO

    /** Elapsed time in seconds. */
    var t: Float = 0f

    /** Integration step: 1 a frame, 0 under reduced motion. */
    var dt: Float = 1f

    /** Frame counter. */
    var frameN: Int = 0

    /** Velocity cap / "speed of light" (§20.10). */
    var c: Float = 12f

    /** Gravitational constant (§20.10). */
    var G: Float = 1f

    /** Recent scroll speed (eased); 0 when inactive. */
    var scrollV: Float = 0f

    // ── services (closures filled by the engine; safe no-ops by default) ──────────────
    var spark: (at: Vec3, power: Float, color: String?) -> Unit = { _, _, _ -> }
    var supernova: (body: Body) -> Unit = { _ -> }
    var spawn: (particle: Particle) -> Unit = { _ -> }
    var neighbors: (particle: Particle, radius: Float) -> List<Particle> = { _, _ -> emptyList() }
    var grid: (name: String) -> ScalarGrid = { _ -> NoopGrid() }

    /** Net structure field at a world point (dipoles + monopoles). Set by the integrator. */
    var fieldAt: ((p: Vec3) -> Vec3)? = null
}

/** The outcome of a modifier force's [Force.modify] hook (spotlight → screen → resonate). */
data class ForceModification(
    /** Multiplies sibling forces' strength for this particle. */
    val strength: Float? = null,
    /** When true, skips all sibling forces entirely. */
    val gate: Boolean = false,
)

/**
 * A force module. The engine owns the loop; a force owns only the math. Mirror of Swift's `Force`
 * protocol. Concrete forces implement only what they need; the hooks default to no-ops.
 */
interface Force {
    val token: String
    val label: String get() = token

    /**
     * True if this force replaces velocity (a reflection, rotation, or relaunch) rather than adding
     * an acceleration — first-class mass must not scale it. Default false.
     */
    val isKinematic: Boolean get() = false

    /**
     * Whether this force implements [modify]. Swift can't distinguish a protocol default from an
     * implementation, so modifier forces declare it; we mirror that contract. Default false.
     */
    val hasModify: Boolean get() = false

    /** Apply this force to a free particle (mutates the particle). */
    fun apply(body: Body, particle: Particle, env: Env)

    /** Optional modifier hook — run before the body's other tokens (spotlight/screen/resonate). */
    fun modify(body: Body, particle: Particle, env: Env): ForceModification? = null

    /** Optional source hook — run once per body per frame to create matter (`spawn`, `propagate`). */
    fun source(body: Body, env: Env) {}

    /** Optional visual-field hook — the structure field this body projects at a world point. */
    fun field(body: Body, at: Vec3): Vec3? = null
}

/** The force registry — `token → Force` (§4). */
typealias ForceRegistry = Map<String, Force>
