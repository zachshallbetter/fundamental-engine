package com.fundamental.core.engine

// Formation helpers (§7) — the Kotlin port of swift/Sources/FundamentalCore/Engine/Formations.swift.

/**
 * Ease [current] toward [target] (lerp `rate`/frame, §7) — transitions glide rather than snap.
 * Returns a new Formation (the Kotlin `Formation` is immutable, unlike the Swift inout struct).
 */
fun easeFormation(current: Formation, target: Formation, rate: Float = 0.03f): Formation =
    Formation(
        driftX = current.driftX + (target.driftX - current.driftX) * rate,
        wander = current.wander + (target.wander - current.wander) * rate,
        orbit = current.orbit + (target.orbit - current.orbit) * rate,
        spread = current.spread + (target.spread - current.spread) * rate,
        conv = current.conv + (target.conv - current.conv) * rate,
    )

/** The accretion target for `conv` — the first visible body that absorbs (§7). */
fun accretionTarget(bodies: List<Body>): Body? =
    bodies.firstOrNull { it.isVisible && it.tokens.contains("sink") }

/** A named global formation preset. */
data class FormationDef(val id: String, val name: String, val cue: String, val preset: Formation)

/** The five global formations, exactly as configured in the JS catalog (forces.config FORMATIONS). */
val FORMATIONS: List<FormationDef> = listOf(
    FormationDef("ambient", "Ambient", "resting drift", Formation(driftX = 0f, wander = 1.0f, orbit = 0.1f, spread = 0f, conv = 0f)),
    FormationDef("wells", "Wells", "matter pools", Formation(driftX = 0f, wander = 0.7f, orbit = 0.85f, spread = 0f, conv = 0f)),
    FormationDef("lanes", "Lanes", "a current carries", Formation(driftX = 0.55f, wander = 0.5f, orbit = 0f, spread = 0f, conv = 0f)),
    FormationDef("scatter", "Scatter", "energy dispersed", Formation(driftX = 0f, wander = 1.7f, orbit = 0f, spread = 0.6f, conv = 0f)),
    FormationDef("accretion", "Accretion", "everything gathers", Formation(driftX = 0f, wander = 0.6f, orbit = 0.4f, spread = 0f, conv = 0.6f)),
)

fun formation(named: String): FormationDef? = FORMATIONS.firstOrNull { it.id == named }
