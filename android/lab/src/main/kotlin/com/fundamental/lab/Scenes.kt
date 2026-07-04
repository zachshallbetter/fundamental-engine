package com.fundamental.lab

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.math.Vec3
import com.fundamental.core.recipes.FieldRecipe
import com.fundamental.core.recipes.compileRecipe
import com.fundamental.core.runtime.FieldController
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * A named lab scene: field settings + a `setup` that places bodies (and, where a force needs it, tweaks
 * the seeded matter — charge for charge/magnetism, species for hunt, …). `token` is the primary force,
 * driving the inspector's live strength/range/spin sliders.
 */
class LabScene(
    val name: String,
    val blurb: String,
    val token: String?,
    val renderMode: LabMode,
    val formation: String = "ambient",
    val density: Int = 600,
    /** The recipe this scene was built from, if any — lets the inspector export it. */
    val recipe: FieldRecipe? = null,
    val setup: (c: FieldController, w: Float, h: Float) -> Unit = { _, _, _ -> },
)

private fun centeredBody(token: String, w: Float, h: Float, strength: Float, range: Float, spin: Float = 1.3f) =
    Body(tokens = listOf(token), strength = strength, range = range, spin = spin, box = Box(center = Vec3(w / 2, h / 2, 0f)))

private fun ringTargets(cx: Float, cy: Float, r: Float, n: Int): List<Vec3> =
    (0 until n).map { val a = it.toDouble() / n * 2.0 * Math.PI; Vec3(cx + (cos(a) * r).toFloat(), cy + (sin(a) * r).toFloat(), 0f) }

/** A sensible default render mode per force, so a freshly-opened force looks its best. */
fun defaultMode(token: String): LabMode = when (token) {
    "attract", "swirl", "gravity", "tether", "jet", "fieldflow", "magnetism", "warp" -> LabMode.TRAILS
    "link", "cohesion", "collide", "align", "pressure", "hunt" -> LabMode.LINKS
    "thermal", "spawn", "propagate", "diffuse", "memory" -> LabMode.GLOW
    else -> LabMode.DOTS
}

/** Build the scene for a catalog force — one engaged body at centre, matter prepared as the force needs. */
fun forceScene(e: ForceEntry): LabScene = LabScene(
    name = e.label, blurb = e.blurb, token = e.token, renderMode = defaultMode(e.token),
) { c, w, h ->
    val range = minOf(w, h) * 0.5f
    val b = centeredBody(e.token, w, h, strength = 2f, range = range)
    b.isEngaged = true
    when (e.token) {
        "sink" -> { b.absorbR = 90f; b.capacity = 1e9f }
        "spawn" -> b.life = 90f
        "pigment" -> b.tint = "#ff5da3"
        "wall" -> b.box = Box(center = Vec3(w / 2, h / 2, 0f), halfExtents = Vec3(170f, 170f, 0f))
        "gate" -> b.box = Box(center = Vec3(w / 2, h / 2, 0f), halfExtents = Vec3(220f, 220f, 0f))
        "morph" -> b.targets = ringTargets(w / 2, h / 2, range * 0.45f, 72)
    }
    c.addBody(b)
    // some forces only act on prepared matter:
    when (e.token) {
        "charge", "magnetism" -> c.particles.forEachIndexed { i, p -> p.charge = if (i % 2 == 0) 1f else -1f }
        "hunt" -> c.particles.forEachIndexed { i, p -> p.species = i % 2 }
    }
}

/** Map a recipe's first render layer to a lab render mode. */
private fun recipeMode(render: List<String>): LabMode = when (render.firstOrNull()) {
    "trails" -> LabMode.TRAILS
    "links" -> LabMode.LINKS
    "metaballs", "heatmap" -> LabMode.GLOW
    else -> LabMode.DOTS
}

/** Compile a canon recipe into a runnable scene: place its compiled bodies, prep matter as needed. */
fun recipeScene(r: FieldRecipe): LabScene = LabScene(
    name = r.name, blurb = r.intent, token = r.primitives.firstOrNull(), renderMode = recipeMode(r.render),
    recipe = r,
) { c, w, h ->
    val compiled = compileRecipe(r)
    val n = compiled.bodies.size.coerceAtLeast(1)
    compiled.bodies.forEachIndexed { i, reg ->
        val b = reg.makeBody()
        b.isEngaged = true
        val cx: Float; val cy: Float
        if (compiled.bodies.size == 1) { cx = w / 2; cy = h / 2 } else {
            val a = i.toDouble() / n * 2.0 * PI
            cx = (w / 2 + cos(a) * w * 0.24).toFloat(); cy = (h / 2 + sin(a) * h * 0.2).toFloat()
        }
        b.box = Box(center = Vec3(cx, cy, 0f), halfExtents = Vec3(44f, 44f, 0f))
        c.addBody(b)
    }
    val toks = r.primitives.toSet()
    if ("charge" in toks || "magnetism" in toks) c.particles.forEachIndexed { i, p -> p.charge = if (i % 2 == 0) 1f else -1f }
    if ("hunt" in toks) c.particles.forEachIndexed { i, p -> p.species = i % 2 }
}

/** The tour — the iconic showcase scenes (mirror of the Swift FieldLab tour, scoped to shipped features). */
fun tourScenes(): List<LabScene> = listOf(
    LabScene("Ambient", "The resting field — a conserved pool drifting.", null, LabMode.DOTS),
    LabScene("Attractor", "A body's well gathers matter into an orbiting shell.", "attract", LabMode.TRAILS) { c, w, h ->
        c.addBody(centeredBody("attract", w, h, 2.6f, 560f).apply { isEngaged = true; tokens = listOf("attract", "swirl") })
    },
    LabScene("Network", "Proximity links — the field as a constellation.", "attract", LabMode.LINKS) { c, w, h ->
        c.addBody(centeredBody("attract", w, h, 2.4f, 520f, 1.2f).apply { isEngaged = true; tokens = listOf("attract", "swirl") })
    },
    LabScene("Nebula", "Soft additive glow, brightest where matter is hot.", "attract", LabMode.GLOW) { c, w, h ->
        c.addBody(centeredBody("attract", w, h, 2.2f, 600f).apply { isEngaged = true })
    },
    LabScene("Three bodies", "Attract, repel, and swirl share one pool.", null, LabMode.DOTS) { c, w, h ->
        c.addBody(centeredBody("attract", w * 0.6f, h * 0.8f, 1.6f, 480f).apply { box = Box(center = Vec3(w * 0.3f, h * 0.4f, 0f)); isEngaged = true })
        c.addBody(centeredBody("repel", w, h, 1.4f, 360f).apply { box = Box(center = Vec3(w * 0.65f, h * 0.55f, 0f)); isEngaged = true })
        c.addBody(centeredBody("swirl", w, h, 1.6f, 460f, 1.6f).apply { box = Box(center = Vec3(w * 0.5f, h * 0.72f, 0f)); isEngaged = true })
    },
)
