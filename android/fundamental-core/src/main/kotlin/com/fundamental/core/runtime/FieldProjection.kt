package com.fundamental.core.runtime

// Substrate Projection Registry (JS critical-path 05). A PROJECTION maps field STATE into an output
// surface (an agent-readable JSON reading, a native view callback, and — on the web plane — CSS / DOM /
// SVG). Mirror of the JS `@fundamental-engine/core` projection registry (`ProjectionRegistry`,
// `FieldProjection`, `FieldProjectionInfo`, `agentJsonProjection`/`agentJsonTarget`) — same shape +
// semantics so a projection's METADATA serializes identically across planes (the cross-plane conformance
// goal). EXPERIMENTAL until stabilized. See docs/planning/critical-path/05-* and
// packages/core/src/core/types.ts / projection-agent-json.ts.
//
// GOVERNANCE PRINCIPLE (kept verbatim from the JS core): *a projection reveals state; it MAY NOT mutate
// the field.* A projection reads over field state and writes to ITS OWN target — no forces, no body or
// metric writes. This is enforced structurally: `apply` receives a plain reading + a target, and never the
// field; the registry lives on the handle and only ever calls `apply`. (See ProjectionRegistryTests'
// "never mutates the field" assertion.)
//
// PORTABLE-vs-WEB surfaces (Option A): this port implements the two PORTABLE surfaces — `AGENT_JSON`
// (serialize a reading for an agent / tool) and a generic host CALLBACK (a `(reading) -> Unit` a native
// view wires up). The web-only surfaces (`CSS` / `DOM_ATTRIBUTE` / `SVG`) are declared in the surface enum
// for METADATA parity (so `projectionList()` reports them identically) but have no native target — they
// are web-first and belong to `@fundamental-engine/dom`. A projection may still *declare* a web surface; on
// this plane it simply has no matching target to write into.

/**
 * The kinds of output surface a [FieldProjection] can target (JS `FieldProjectionSurface`). Declared in
 * full so a projection's metadata is identical across planes. Only [AGENT_JSON] and [CALLBACK] have a
 * concrete target on this native port; the web surfaces ([CSS] / [DOM_ATTRIBUTE] / [SVG]) are declared for
 * parity but are web-first (implemented in `@fundamental-engine/dom`, not here).
 */
enum class FieldProjectionSurface(val id: String) {
    CSS("css"),
    DOM_ATTRIBUTE("dom-attribute"),
    SVG("svg"),
    CANVAS("canvas"),
    TYPOGRAPHY("typography"),
    ANNOTATION("annotation"),
    SOUND("sound"),
    HAPTIC("haptic"),
    NATIVE("native"),
    SPATIAL("spatial"),
    AGENT_JSON("agent-json"),
    /** A generic host callback surface (native-plane addition) — the target is a `(reading) -> Unit`. */
    CALLBACK("callback"),
}

/**
 * Where a projection writes (JS `FieldProjectionTarget`) — a minimal sink a projection's [FieldProjection.apply]
 * hands its reading to. Open by design so non-DOM surfaces ([AgentJsonTarget], [CallbackTarget], a future
 * native view) each provide their own concrete target. Read-only w.r.t. the field: a target receives a
 * reading, it never reaches back into field state.
 */
interface FieldProjectionTarget {
    /** Receive a reading (called by a projection's `apply`). The default is a no-op so a target that only
     *  cares about, say, DOM attributes can override just the part it needs — mirrors the open JS shape. */
    fun receive(reading: Map<String, Float>) {}
}

/**
 * A named mapping from field state to an output surface (JS `FieldProjection`). [apply] is the (optional)
 * writer; the rest is declarative metadata for governance + tooling. A projection MUST NOT change field
 * state — [apply] receives a plain reading + a target and never the field.
 */
data class FieldProjection(
    val id: String,
    val label: String,
    /** the field channels this projection reads (e.g. `["density","confidence"]`). */
    val channels: List<String>,
    /** the surface(s) it writes to. */
    val surfaces: List<FieldProjectionSurface>,
    /** the non-motion equivalent, for reduced-motion (governance: motion must translate). */
    val reducedMotionEquivalent: String? = null,
    /** the accessibility equivalent — an alternate projection of the same state, not a fallback. */
    val accessibilityEquivalent: String? = null,
    /** write the reading onto the target (read-only w.r.t. the field). Null ⇒ a pure-metadata projection. */
    val apply: ((reading: Map<String, Float>, target: FieldProjectionTarget) -> Unit)? = null,
)

/**
 * A live reading source for a bound (auto-applied) projection (JS `ProjectionSource`) — called once per
 * write phase to produce the reading handed to the projection's [FieldProjection.apply]. The field never
 * reads it for simulation.
 */
typealias ProjectionSource = () -> Map<String, Float>

/**
 * Serializable metadata about a registered projection (JS `FieldProjectionInfo`) — no `apply`. What
 * `query()` / `snapshot()` and governance tooling read. Field names mirror JS 1:1 so the metadata
 * serializes identically across planes.
 */
data class FieldProjectionInfo(
    val id: String,
    val label: String,
    val channels: List<String>,
    val surfaces: List<FieldProjectionSurface>,
    val reducedMotionEquivalent: String? = null,
    val accessibilityEquivalent: String? = null,
)

/**
 * A [FieldProjectionTarget] for the `agent-json` surface (JS `AgentJsonTarget`): it captures the last
 * reading written to it as a plain map, serializable for agent / tooling consumption. Build one with
 * [agentJsonTarget] and pair it with [agentJsonProjection]. Read-only w.r.t. the field — like every
 * projection target, it only ever receives readings.
 */
class AgentJsonTarget internal constructor() : FieldProjectionTarget {
    private var last: Map<String, Float>? = null

    /** Receive a reading (called by the projection's `apply`). Stores a COPY (not a reference). */
    override fun receive(reading: Map<String, Float>) {
        last = LinkedHashMap(reading)
    }

    /** The last received reading, or null before the first write. */
    fun value(): Map<String, Float>? = last

    /** The last received reading serialized as a JSON object string (`"null"` before the first write). */
    fun json(): String {
        val v = last ?: return "null"
        return v.entries.joinToString(prefix = "{", postfix = "}") { (k, value) ->
            "${jsonString(k)}:${jsonNumber(value)}"
        }
    }

    private fun jsonString(s: String): String {
        val sb = StringBuilder("\"")
        for (c in s) when (c) {
            '"' -> sb.append("\\\"")
            '\\' -> sb.append("\\\\")
            '\n' -> sb.append("\\n")
            '\r' -> sb.append("\\r")
            '\t' -> sb.append("\\t")
            else -> if (c < ' ') sb.append("\\u%04x".format(c.code)) else sb.append(c)
        }
        return sb.append('"').toString()
    }

    // Match JS JSON.stringify: whole floats print without a trailing `.0` (e.g. `1`, not `1.0`).
    private fun jsonNumber(n: Float): String {
        if (n.isNaN() || n.isInfinite()) return "null" // JSON.stringify serializes non-finite as null
        return if (n == n.toLong().toFloat()) n.toLong().toString() else n.toString()
    }
}

/**
 * A [FieldProjectionTarget] for the generic host `callback` surface (native-plane addition): every reading
 * it receives is forwarded to a `(reading) -> Unit` a host wires to a native view (a text label, a gauge,
 * a haptic driver). The portable analog of a DOM write — the host owns the sink; the field only supplies
 * the reading. Build one with [callbackTarget] and pair it with [callbackProjection].
 */
class CallbackTarget internal constructor(private val sink: (Map<String, Float>) -> Unit) : FieldProjectionTarget {
    override fun receive(reading: Map<String, Float>) = sink(reading)
}

/** Create an [AgentJsonTarget] — the sink an `agent-json` projection writes into (JS `agentJsonTarget()`). */
fun agentJsonTarget(): AgentJsonTarget = AgentJsonTarget()

/**
 * Create a projection that targets the `agent-json` surface (JS `agentJsonProjection`): its `apply` hands
 * the reading to an [AgentJsonTarget] (via `receive`). Pass [accessibilityEquivalent] if this projection
 * IS the alternate surface for a visual one (agent-json is inherently non-visual, so it usually is).
 */
fun agentJsonProjection(
    id: String,
    channels: List<String>,
    label: String? = null,
    accessibilityEquivalent: String? = null,
): FieldProjection = FieldProjection(
    id = id,
    label = label ?: id,
    channels = channels.toList(),
    surfaces = listOf(FieldProjectionSurface.AGENT_JSON),
    accessibilityEquivalent = accessibilityEquivalent,
    apply = { reading, target -> target.receive(reading) },
)

/** Create a [CallbackTarget] wrapping a host sink — the target a `callback` projection writes into. */
fun callbackTarget(sink: (Map<String, Float>) -> Unit): CallbackTarget = CallbackTarget(sink)

/**
 * Create a projection that targets the generic `callback` surface: its `apply` hands the reading to a
 * [CallbackTarget]. The portable way to drive a native view from field state without a DOM.
 */
fun callbackProjection(
    id: String,
    channels: List<String>,
    label: String? = null,
    accessibilityEquivalent: String? = null,
): FieldProjection = FieldProjection(
    id = id,
    label = label ?: id,
    channels = channels.toList(),
    surfaces = listOf(FieldProjectionSurface.CALLBACK),
    accessibilityEquivalent = accessibilityEquivalent,
    apply = { reading, target -> target.receive(reading) },
)

/**
 * The field's projection registry (JS `ProjectionRegistry`; exposed as [FieldHandle.projections]) — register
 * named projections and apply them. READ/OUTPUT ONLY: registering, binding, or applying a projection never
 * changes how matter moves (see the class docs above). One registry per field, owned by the [FieldHandle].
 *
 * Parity with the JS `ProjectionRegistry`: `register` (returns an unregister fn) / `unregister` / `get` /
 * `list` (metadata) / `apply` / `bind` (auto-apply each write phase, returns an unbind fn). The web-plane
 * `lint()` (governance) is not mirrored here — governance lint is a later step on both planes and lives with
 * the doctrine tooling, not the core registry mechanism.
 */
class ProjectionRegistry {
    // Insertion-ordered so list() is deterministic (mirrors the JS Map iteration order).
    private val projections = LinkedHashMap<String, FieldProjection>()
    private val bindings = mutableListOf<Binding>()

    private data class Binding(val id: String, val target: FieldProjectionTarget, val source: ProjectionSource)

    /** Register a projection (replacing any with the same id); returns an unregister fn. */
    fun register(projection: FieldProjection): () -> Unit {
        projections[projection.id] = projection
        return {
            // Only remove if it's still the same projection (a re-register under this id wins).
            if (projections[projection.id] === projection) projections.remove(projection.id)
        }
    }

    /** Remove a registered projection by id. */
    fun unregister(id: String) {
        projections.remove(id)
    }

    /** The full projection (incl. `apply`) for an id, or null. */
    fun get(id: String): FieldProjection? = projections[id]

    /** Serializable metadata for every registered projection (JS `list()`) — no `apply`, insertion order. */
    fun list(): List<FieldProjectionInfo> = projections.values.map { info(it) }

    /** Apply a registered projection's writer to a target (no-op if the id / `apply` is absent). */
    fun apply(id: String, reading: Map<String, Float>, target: FieldProjectionTarget) {
        projections[id]?.apply?.invoke(reading, target)
    }

    /**
     * Bind a registered projection to a target + a live reading source — the field auto-applies it once per
     * write phase (after feedback), read-only w.r.t. the field. Returns an unbind fn. Multiple bindings
     * (even of the same id) coexist; binding an unknown / `apply`-less id is inert (no throw).
     */
    fun bind(id: String, target: FieldProjectionTarget, source: ProjectionSource): () -> Unit {
        val binding = Binding(id, target, source)
        bindings.add(binding)
        return { bindings.remove(binding) }
    }

    /**
     * Auto-apply every bound projection for the current write phase (JS `applyBoundProjections`). Invoked by
     * the [FieldHandle] once per frame after feedback easing. Read-only w.r.t. the field — it only reads the
     * bound sources and writes to the bound targets; it never moves matter. Internal to the registry seam.
     */
    internal fun applyBoundProjections() {
        // Snapshot the bindings so a source/apply that unbinds mid-phase doesn't mutate the list we iterate.
        for (b in bindings.toList()) projections[b.id]?.apply?.invoke(b.source(), b.target)
    }

    private fun info(p: FieldProjection): FieldProjectionInfo = FieldProjectionInfo(
        id = p.id,
        label = p.label,
        channels = p.channels.toList(),
        surfaces = p.surfaces.toList(),
        reducedMotionEquivalent = p.reducedMotionEquivalent,
        accessibilityEquivalent = p.accessibilityEquivalent,
    )
}
