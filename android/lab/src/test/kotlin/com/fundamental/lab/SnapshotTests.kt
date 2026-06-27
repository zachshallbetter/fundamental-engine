package com.fundamental.lab

import com.fundamental.core.runtime.FieldController
import java.awt.Color
import java.awt.image.BufferedImage
import kotlin.test.Test
import kotlin.test.assertTrue

// Visual-snapshot model (§654) — the structure gate. Renders a scene headlessly through the real
// engine + Renderer2D and asserts the perceptual signature is non-blank, well-placed, and stable
// run-to-run (the precondition for per-scene goldens, and the tripwire that would demand a seeded
// rasterizer if it ever broke).

private const val W = 480
private const val H = 480
private val ACCENT = Color(77, 163, 255)

private fun render(scene: LabScene, frames: Int): BufferedImage {
    val c = FieldController(W.toFloat(), H.toFloat(), particleCount = scene.density, seed = 42)
    c.setFormation(scene.formation)
    scene.setup(c, W.toFloat(), H.toFloat())
    repeat(frames) { c.tick() }
    val img = BufferedImage(W, H, BufferedImage.TYPE_INT_RGB)
    val g = img.createGraphics()
    Renderer2D.drawFrame(g, c, LabMode.DOTS, ACCENT, W, H)
    g.dispose()
    return img
}

class SnapshotTests {

    @Test
    fun signatureIsStableRunToRun() {
        val scene = tourScenes().first { it.name == "Attractor" }
        val a = Snapshotter.signature(render(scene, 60))
        val b = Snapshotter.signature(render(scene, 60))
        assertTrue(a.distance(b) < 1e-4f, "same seed + same frames → identical signature (was ${a.distance(b)})")
    }

    @Test
    fun matterDrawsCoherentBoundedContent() {
        val sig = Snapshotter.signature(render(tourScenes()[0], 30)) // ambient
        assertTrue(sig.lit in 0.001f..0.5f, "non-blank but not blown out (lit=${sig.lit})")
        assertTrue(sig.cx in 0f..1f && sig.cy in 0f..1f, "centroid on-canvas")
    }

    @Test
    fun differentScenesHaveDifferentSignatures() {
        val ambient = Snapshotter.signature(render(tourScenes()[0], 40))
        val attractor = Snapshotter.signature(render(tourScenes().first { it.name == "Attractor" }, 40))
        assertTrue(ambient.distance(attractor) > 0.01f, "the attractor's gathered field reads differently from ambient drift")
    }
}
