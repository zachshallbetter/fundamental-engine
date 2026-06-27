package com.fundamental.lab

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.Box
import com.fundamental.core.math.Vec3
import com.fundamental.core.runtime.FieldController

/** A named lab scene: a configured field + the render mode that shows it off. */
class Scene(
    val name: String,
    val mode: LabMode,
    val particleCount: Int = 600,
    val build: (FieldController) -> Unit = {},
)

private fun body(tokens: List<String>, cx: Float, cy: Float, strength: Float, range: Float, spin: Float = 1f) =
    Body(tokens = tokens, strength = strength, range = range, spin = spin, box = Box(center = Vec3(cx, cy, 0f)))

/** The tour — each scene proves a render mode / behavior, mirroring the Swift FieldLab tour. */
fun tour(w: Float, h: Float): List<Scene> = listOf(
    Scene("ambient-dots", LabMode.DOTS) { },
    Scene("attract-trails", LabMode.TRAILS) { it.addBody(body(listOf("attract", "swirl"), w / 2, h / 2, 2.6f, 560f, 1.3f)) },
    Scene("links-network", LabMode.LINKS) { it.addBody(body(listOf("attract", "swirl"), w / 2, h / 2, 2.4f, 520f, 1.2f)) },
    Scene("glow-nebula", LabMode.GLOW) { it.addBody(body(listOf("attract"), w / 2, h / 2, 2.2f, 600f)) },
    Scene("multi-body", LabMode.DOTS) {
        it.addBody(body(listOf("attract"), w * 0.3f, h * 0.4f, 1.6f, 480f))
        it.addBody(body(listOf("repel"), w * 0.65f, h * 0.55f, 1.4f, 360f))
        it.addBody(body(listOf("swirl"), w * 0.5f, h * 0.7f, 1.6f, 460f, 1.6f))
    },
)
