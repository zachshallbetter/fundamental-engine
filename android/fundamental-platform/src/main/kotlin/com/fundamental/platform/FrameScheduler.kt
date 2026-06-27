package com.fundamental.platform

import com.fundamental.core.engine.FieldVolume

/**
 * The six-phase frame loop — ported from FrameScheduler.swift line-for-line.
 * discover → read → compute → state → write → render. Phase order is a hard invariant.
 */
enum class Phase { DISCOVER, READ, COMPUTE, STATE, WRITE, RENDER;

    override fun toString(): String = name.lowercase()
}

/** Phases in which reading geometry is legal. */
val readPhases: Set<Phase> = setOf(Phase.DISCOVER, Phase.READ)

data class FrameContext(
    val now: Double,
    val volume: FieldVolume,
    val phase: Phase,
    val frame: Int,
)

typealias PhaseHandler = (FrameContext) -> Unit

data class PhaseViolation(
    val phase: Phase,
    val op: String,
    val allowed: List<Phase>,
    val frame: Int,
) {
    val message: String
        get() = "\"$op\" ran in the $phase phase; allowed only in: ${allowed.joinToString(", ")}"
}

data class FrameReport(
    val frame: Int,
    val now: Double,
    val ran: List<Phase>,
    val violations: List<PhaseViolation>,
)

/**
 * One shared loop with explicit, ordered phases so the registries never fight each other.
 * A geometry read requested during the write phase is a violation: in strict mode it throws,
 * otherwise it is recorded and the frame continues.
 */
class FrameScheduler(private val strict: Boolean = false) {

    private class Subscription(val id: Int, val handler: PhaseHandler)
    private val handlers: MutableMap<Phase, MutableList<Subscription>> =
        Phase.entries.associateWith { mutableListOf<Subscription>() }.toMutableMap()
    private var nextToken = 0

    private val recorded = ArrayList<PhaseViolation>()
    var current: Phase? = null
        private set
    var frame: Int = 0
        private set

    /** Register a handler for a phase. Returns an unsubscribe closure. */
    fun on(phase: Phase, handler: PhaseHandler): () -> Unit {
        val id = nextToken++
        handlers.getValue(phase).add(Subscription(id, handler))
        return { handlers[phase]?.removeAll { it.id == id } }
    }

    /** Called by registries before reading geometry. Off-phase reads are violations. */
    fun assertReadPhase(op: String) {
        val phase = current ?: return // outside a frame — allowed
        if (phase !in readPhases) {
            val v = PhaseViolation(phase, op, readPhases.toList(), frame)
            if (strict) error("[Fundamental/Platform] ${v.message}")
            recorded.add(v)
        }
    }

    fun readGuard(): (String) -> Unit = { op -> assertReadPhase(op) }

    fun violations(): List<PhaseViolation> = recorded.toList()
    fun clearViolations() = recorded.clear()

    /** Run one full six-phase frame. Returns the per-frame report. */
    fun runFrame(now: Double = 0.0, volume: FieldVolume = FieldVolume(0f, 0f)): FrameReport {
        val startViolations = recorded.size
        val ran = ArrayList<Phase>()
        for (phase in Phase.entries) {
            val list = handlers[phase] ?: continue
            if (list.isEmpty()) continue
            current = phase
            ran.add(phase)
            val ctx = FrameContext(now, volume, phase, frame)
            // snapshot to tolerate unsubscribe during iteration
            for (sub in list.toList()) sub.handler(ctx)
        }
        current = null
        val report = FrameReport(frame, now, ran, recorded.subList(startViolations, recorded.size).toList())
        frame += 1
        return report
    }
}
