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

private fun controller(scene: LabScene): FieldController {
    val c = FieldController(W.toFloat(), H.toFloat(), particleCount = scene.density, seed = 42)
    c.setFormation(scene.formation)
    scene.setup(c, W.toFloat(), H.toFloat())
    return c
}

private fun render(scene: LabScene, frames: Int): BufferedImage {
    val c = controller(scene)
    repeat(frames) { c.tick() }
    val img = BufferedImage(W, H, BufferedImage.TYPE_INT_RGB)
    val g = img.createGraphics()
    Renderer2D.drawFrame(g, c, LabMode.DOTS, ACCENT, W, H)
    g.dispose()
    return img
}

/**
 * Render a scene in a specific matter mode, the way the headless tour does: TRAILS needs the
 * persistent buffer (fade, then stamp, once per frame), every other mode draws one frame onto a
 * fresh surface. So what this gate measures is what `:lab render` writes.
 */
private fun renderMode(scene: LabScene, mode: LabMode, frames: Int): BufferedImage {
    val c = controller(scene)
    val img = BufferedImage(W, H, BufferedImage.TYPE_INT_RGB)
    if (mode == LabMode.TRAILS) {
        img.createGraphics().apply { color = Renderer2D.BG; fillRect(0, 0, W, H); dispose() }
        repeat(frames) { c.tick(); Renderer2D.fadeTrails(img); Renderer2D.stampTrails(img, c, ACCENT) }
    } else {
        repeat(frames) { c.tick() }
        val g = img.createGraphics()
        Renderer2D.drawFrame(g, c, mode, ACCENT, W, H)
        g.dispose()
    }
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

    // Parity with the Swift model's `everyModeDrawsContent` (FieldLabKitTests/VisualSnapshotTests):
    // the gate is only a renderer gate if it covers EVERY matter mode. A mode that silently stopped
    // drawing — an empty neighbour list in LINKS, a gradient that resolves transparent in GLOW, a
    // trail buffer that fades to nothing — reads here as a blank or blown-out signature, on the same
    // scene the other assertions use.
    @Test
    fun everyRenderModeDrawsCoherentBoundedContent() {
        val scene = tourScenes().first { it.name == "Attractor" }
        for (mode in LabMode.entries) {
            val sig = Snapshotter.signature(renderMode(scene, mode, 60))
            assertTrue(sig.lit > 0.001f, "$mode renders (almost) nothing — lit=${sig.lit}")
            assertTrue(sig.lit < 0.9f, "$mode blows out the whole frame — lit=${sig.lit}")
            assertTrue(sig.cx in 0.05f..0.95f, "$mode lit mass off-canvas in x: ${sig.cx}")
            assertTrue(sig.cy in 0.05f..0.95f, "$mode lit mass off-canvas in y: ${sig.cy}")
        }
    }

    // Every mode is a genuinely different treatment of the same matter, so no two modes may reduce to
    // the same signature on one scene. This is what would catch a `when (mode)` branch that fell
    // through to the wrong draw call — the failure `everyRenderModeDrawsCoherentBoundedContent`
    // cannot see, because a wrong-but-drawn frame is still coherent and bounded.
    @Test
    fun eachRenderModeReadsDifferently() {
        val scene = tourScenes().first { it.name == "Attractor" }
        val sigs = LabMode.entries.associateWith { Snapshotter.signature(renderMode(scene, it, 60)) }
        val modes = LabMode.entries
        for (i in modes.indices) {
            for (j in i + 1 until modes.size) {
                val d = sigs.getValue(modes[i]).distance(sigs.getValue(modes[j]))
                assertTrue(d > 0.005f, "${modes[i]} and ${modes[j]} render identically (distance $d)")
            }
        }
    }
}
