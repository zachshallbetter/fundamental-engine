package com.fundamental.lab

import com.fundamental.core.math.Vec3
import com.fundamental.core.recipe.FieldRecipes
import com.fundamental.core.runtime.FieldController
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO

private const val W = 720
private const val H = 1280
private val ACCENT = Renderer2D.parseAccent("#4da3ff")

fun main(args: Array<String>) {
    when (args.getOrNull(0)) {
        "render" -> { System.setProperty("java.awt.headless", "true"); renderTour(args.getOrElse(1) { "lab-out" }) }
        "bench" -> { System.setProperty("java.awt.headless", "true"); bench() }
        else -> launchLab()
    }
}

/** The headless render set: the tour + a representative spread of catalog forces. */
private fun renderScenes(): List<LabScene> =
    tourScenes() +
        listOf("gravity", "magnetism", "hunt", "wall", "spawn", "pressure")
            .mapNotNull { ForceCatalog.entry(it) }
            .map { forceScene(it) } +
        FieldRecipes.all.filter { it.tier == "core" }.take(2).map { recipeScene(it) }

private fun slug(name: String) = name.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')

// ── headless: render the tour to PNGs (the CI-able visual gate) ───────────────────────────────────

private fun renderTour(dir: String) {
    val out = File(dir).apply { mkdirs() }
    for (scene in renderScenes()) {
        val c = FieldController(W.toFloat(), H.toFloat(), particleCount = scene.density, seed = 42)
        c.setFormation(scene.formation)
        scene.setup(c, W.toFloat(), H.toFloat())
        val img = BufferedImage(W, H, BufferedImage.TYPE_INT_RGB)
        if (scene.renderMode == LabMode.TRAILS) {
            img.createGraphics().apply { color = Renderer2D.BG; fillRect(0, 0, W, H); dispose() }
            repeat(140) { c.tick(); Renderer2D.fadeTrails(img); Renderer2D.stampTrails(img, c, ACCENT) }
        } else {
            repeat(90) { c.tick() }
            val g = img.createGraphics()
            Renderer2D.drawFrame(g, c, scene.renderMode, ACCENT, W, H)
            g.dispose()
        }
        val file = File(out, "${slug(scene.name)}.png")
        ImageIO.write(img, "png", file)
        println("wrote ${file.path}")
    }
    // overlay readings showcase
    overlayShot(out, "overlay-vectors", forceScene(ForceCatalog.entry("attract")!!), Reading.FORCE_VECTORS)
    overlayShot(out, "overlay-fieldlines", forceScene(ForceCatalog.entry("gravity")!!), Reading.FIELD_LINES)
    overlayShot(out, "overlay-temperature", forceScene(ForceCatalog.entry("attract")!!), Reading.TEMPERATURE)
    overlayShot(out, "overlay-grid", forceScene(ForceCatalog.entry("attract")!!), Reading.GRID)
    heatmapShot(out, "overlay-heatmap", forceScene(ForceCatalog.entry("attract")!!))
    sparkShot(out, "overlay-sparks")
    println("done → ${out.absolutePath}")
}

private fun sparkShot(out: File, name: String) {
    // drive matter hard into a wall box → continuous impact sparks (§23).
    val c = FieldController(W.toFloat(), H.toFloat(), particleCount = 600, seed = 42)
    c.addBody(
        com.fundamental.core.engine.Body(
            tokens = listOf("wall"),
            box = com.fundamental.core.engine.Box(
                center = Vec3(W / 2f, H / 2f, 0f),
                halfExtents = Vec3(160f, 160f, 0f),
            ),
        ).apply { isVisible = true },
    )
    c.flowTo(W / 2f, H / 2f, strength = 3f, radius = 4000f)
    repeat(60) { c.tick() }
    val img = BufferedImage(W, H, BufferedImage.TYPE_INT_RGB)
    val g = img.createGraphics()
    Renderer2D.drawFrame(g, c, LabMode.DOTS, ACCENT, W, H)
    Renderer2D.drawSparks(g, c)
    g.dispose()
    val f = File(out, "$name.png")
    ImageIO.write(img, "png", f)
    println("wrote ${f.path} (${c.sparks.count} live sparks)")
}

private fun heatmapShot(out: File, name: String, scene: LabScene) {
    val c = FieldController(W.toFloat(), H.toFloat(), particleCount = scene.density, seed = 42)
    c.setFormation(scene.formation)
    scene.setup(c, W.toFloat(), H.toFloat())
    c.heatmapEnabled = true
    repeat(90) { c.tick() }
    val img = BufferedImage(W, H, BufferedImage.TYPE_INT_RGB)
    val g = img.createGraphics()
    Renderer2D.drawFrame(g, c, LabMode.DOTS, ACCENT, W, H)
    Renderer2D.drawHeatmap(g, c, W, H, ACCENT)
    g.dispose()
    val f = File(out, "$name.png")
    ImageIO.write(img, "png", f)
    println("wrote ${f.path}")
}

private fun overlayShot(out: File, name: String, scene: LabScene, reading: Reading) {
    val c = FieldController(W.toFloat(), H.toFloat(), particleCount = scene.density, seed = 42)
    c.setFormation(scene.formation)
    scene.setup(c, W.toFloat(), H.toFloat())
    repeat(90) { c.tick() }
    val img = BufferedImage(W, H, BufferedImage.TYPE_INT_RGB)
    val g = img.createGraphics()
    Renderer2D.drawFrame(g, c, LabMode.DOTS, ACCENT, W, H)
    drawReading(g, c, reading, W, H)
    g.dispose()
    val f = File(out, "$name.png")
    ImageIO.write(img, "png", f)
    println("wrote ${f.path}")
}

// ── headless: deterministic sim cost per scene (reported, not gated) ──────────────────────────────

private fun bench() {
    for (scene in renderScenes()) {
        val c = FieldController(W.toFloat(), H.toFloat(), particleCount = scene.density, seed = 42)
        c.setFormation(scene.formation)
        scene.setup(c, W.toFloat(), H.toFloat())
        repeat(30) { c.tick() }
        val frames = 300
        val t0 = System.nanoTime()
        repeat(frames) { c.tick() }
        val msPerFrame = (System.nanoTime() - t0) / 1e6 / frames
        println("%-16s %5d particles  %.3f ms/frame (sim)".format(slug(scene.name), scene.density, msPerFrame))
    }
}
