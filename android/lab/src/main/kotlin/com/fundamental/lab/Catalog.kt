package com.fundamental.lab

/** A force-catalog entry — token, display label, family group, and a one-line blurb. */
class ForceEntry(val token: String, val label: String, val group: String, val blurb: String)

/**
 * The force catalog for the lab sidebar, assembled from two sources.
 *
 * `token`, `label` and `group` are GENERATED from the JS passport (see GeneratedForceCatalog.kt) — they
 * are the fields that drift, and hand-maintaining them is why `relief` was missing here after it shipped
 * on three planes, and why `fieldflow` had become "Field Flow". The generator now owns them.
 *
 * `blurb` stays hand-written. It is independent editorial prose, not a copy of the engine's `meta.desc`:
 * of the tokens carrying both, none matches. Deleting it to generate the file would have thrown away 36
 * curated lines. CatalogCoverageTest fails if a generated force has no blurb, or a blurb is orphaned.
 */
object ForceCatalog {
    val groups = listOf("Canonical", "Natural", "Extended")

    /** token → one-line identity. Hand-written; must cover every entry in GENERATED_FORCES. */
    val blurbs: Map<String, String> = mapOf(
        // ── canonical nine (§6) ──────────────────────────────────────────────────────
        "attract" to "A soft gravity-like well; on-state adds orbital swirl.",
        "jet" to "A conduit — draws matter in, jets it out along the heading.",
        "tether" to "Holds matter at a rest-length shell radius.",
        "wall" to "An axis-aligned bouncing box; sparks on hard impact.",
        "stream" to "A steady directional current along the heading.",
        "repel" to "Inverse-square outward push; carves a void.",
        "viscosity" to "Bleeds momentum — drag, no redirection.",
        "swirl" to "Tangential spin with light inward retention.",
        "sink" to "Captures matter, holds it, releases on saturation.",
        // ── natural primitives (§20.10) ──────────────────────────────────────────────
        "gravity" to "True softened inverse-square pull, always attractive.",
        "charge" to "Signed inverse-square; like signs repel (needs charged matter).",
        "magnetism" to "Lorentz turn — curves a charged path without doing work.",
        "thermal" to "Langevin agitation — Brownian jitter, σ = √(2T).",
        "collide" to "Elastic pairwise collision — granular momentum exchange.",
        "diffuse" to "Pheromone trails — deposit + follow the blurred gradient.",
        "propagate" to "A travelling shock; matter rides the front outward.",
        "memory" to "Worn paths deepen and pull harder over time.",
        // ── designed extended set (§20.3) ────────────────────────────────────────────
        "lens" to "Rotates velocity, preserving speed — bends the path.",
        "gate" to "One-way membrane — reflects wrong-way crossers.",
        "buoyancy" to "Lift/sink by density — hot/large matter rises.",
        "shear" to "A laminar velocity gradient (Couette flow).",
        "crystallize" to "Cool matter snaps to a lattice and settles.",
        "align" to "Steers toward the mean neighbour heading (boids).",
        "wind" to "Divergence-free curl turbulence.",
        "cohesion" to "Short-range pressure + mid-range pull — surface tension.",
        "pressure" to "SPH density relaxation — an even, incompressible fill.",
        "link" to "Verlet distance constraint — rope / cloth / chain.",
        "hunt" to "Two-species pursuit — predators chase, prey flee.",
        "morph" to "Matter assembles into a target shape.",
        "spawn" to "The source — emits mortal matter in a cone.",
        "resonate" to "Modifier — pulses siblings with 1 + sin(ωt).",
        "spotlight" to "Modifier — gates siblings to a heading cone.",
        "screen" to "A quiet zone — damps other bodies' forces.",
        "pigment" to "Conserved color transport — matter takes a tint.",
        "fieldflow" to "Follows the net structure field lines.",
        "warp" to "A wormhole throat — relocates matter to its pair.",
        "relief" to "Matter slides down a declared height field — terrain as a force.",
    )

    val entries: List<ForceEntry> = GENERATED_FORCES.map { g ->
        ForceEntry(g.token, g.label, g.group, blurbs[g.token] ?: "")
    }

    fun group(g: String): List<ForceEntry> = entries.filter { it.group == g }
    fun entry(token: String): ForceEntry? = entries.firstOrNull { it.token == token }
}
