package com.fundamental.lab

/** A force-catalog entry — token, display label, family group, and a one-line blurb. */
class ForceEntry(val token: String, val label: String, val group: String, val blurb: String)

/**
 * The full 36-force catalog, grouped as in the Swift FieldLab sidebar (canonical / natural / extended).
 * Labels mirror the engine's `Force.label`; blurbs are the one-line identities.
 */
object ForceCatalog {
    val groups = listOf("Canonical", "Natural", "Extended")

    val entries: List<ForceEntry> = listOf(
        // ── canonical nine (§6) ──────────────────────────────────────────────────────
        ForceEntry("attract", "Attract", "Canonical", "A soft gravity-like well; on-state adds orbital swirl."),
        ForceEntry("jet", "Jet", "Canonical", "A conduit — draws matter in, jets it out along the heading."),
        ForceEntry("tether", "Tether", "Canonical", "Holds matter at a rest-length shell radius."),
        ForceEntry("wall", "Wall", "Canonical", "An axis-aligned bouncing box; sparks on hard impact."),
        ForceEntry("stream", "Stream", "Canonical", "A steady directional current along the heading."),
        ForceEntry("repel", "Repel", "Canonical", "Inverse-square outward push; carves a void."),
        ForceEntry("viscosity", "Viscosity", "Canonical", "Bleeds momentum — drag, no redirection."),
        ForceEntry("swirl", "Swirl", "Canonical", "Tangential spin with light inward retention."),
        ForceEntry("sink", "Sink", "Canonical", "Captures matter, holds it, releases on saturation."),
        // ── natural primitives (§20.10) ──────────────────────────────────────────────
        ForceEntry("gravity", "Gravity", "Natural", "True softened inverse-square pull, always attractive."),
        ForceEntry("charge", "Charge", "Natural", "Signed inverse-square; like signs repel (needs charged matter)."),
        ForceEntry("magnetism", "Magnetism", "Natural", "Lorentz turn — curves a charged path without doing work."),
        ForceEntry("thermal", "Thermal", "Natural", "Langevin agitation — Brownian jitter, σ = √(2T)."),
        ForceEntry("collide", "Collide", "Natural", "Elastic pairwise collision — granular momentum exchange."),
        ForceEntry("diffuse", "Diffuse", "Natural", "Pheromone trails — deposit + follow the blurred gradient."),
        ForceEntry("propagate", "Propagate", "Natural", "A travelling shock; matter rides the front outward."),
        ForceEntry("memory", "Memory", "Natural", "Worn paths deepen and pull harder over time."),
        // ── designed extended set (§20.3) ────────────────────────────────────────────
        ForceEntry("lens", "Lens", "Extended", "Rotates velocity, preserving speed — bends the path."),
        ForceEntry("gate", "Gate", "Extended", "One-way membrane — reflects wrong-way crossers."),
        ForceEntry("buoyancy", "Buoyancy", "Extended", "Lift/sink by density — hot/large matter rises."),
        ForceEntry("shear", "Shear", "Extended", "A laminar velocity gradient (Couette flow)."),
        ForceEntry("crystallize", "Crystallize", "Extended", "Cool matter snaps to a lattice and settles."),
        ForceEntry("align", "Align", "Extended", "Steers toward the mean neighbour heading (boids)."),
        ForceEntry("wind", "Wind", "Extended", "Divergence-free curl turbulence."),
        ForceEntry("cohesion", "Cohesion", "Extended", "Short-range pressure + mid-range pull — surface tension."),
        ForceEntry("pressure", "Pressure", "Extended", "SPH density relaxation — an even, incompressible fill."),
        ForceEntry("link", "Link", "Extended", "Verlet distance constraint — rope / cloth / chain."),
        ForceEntry("hunt", "Hunt", "Extended", "Two-species pursuit — predators chase, prey flee."),
        ForceEntry("morph", "Morph", "Extended", "Matter assembles into a target shape."),
        ForceEntry("spawn", "Spawn", "Extended", "The source — emits mortal matter in a cone."),
        ForceEntry("resonate", "Resonate", "Extended", "Modifier — pulses siblings with 1 + sin(ωt)."),
        ForceEntry("spotlight", "Spotlight", "Extended", "Modifier — gates siblings to a heading cone."),
        ForceEntry("screen", "Screen", "Extended", "A quiet zone — damps other bodies' forces."),
        ForceEntry("pigment", "Pigment", "Extended", "Conserved color transport — matter takes a tint."),
        ForceEntry("fieldflow", "Field Flow", "Extended", "Follows the net structure field lines."),
        ForceEntry("warp", "Warp", "Extended", "A wormhole throat — relocates matter to its pair."),
    )

    fun group(g: String): List<ForceEntry> = entries.filter { it.group == g }
    fun entry(token: String): ForceEntry? = entries.firstOrNull { it.token == token }
}
