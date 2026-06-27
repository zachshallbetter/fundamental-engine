package com.fundamental.lab

import com.fundamental.core.runtime.FieldController
import java.awt.Graphics
import java.awt.Graphics2D
import java.awt.event.ComponentAdapter
import java.awt.event.ComponentEvent
import java.awt.event.KeyAdapter
import java.awt.event.KeyEvent
import java.awt.event.MouseAdapter
import java.awt.event.MouseEvent
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO
import javax.swing.JFrame
import javax.swing.JPanel
import javax.swing.Timer
import javax.swing.WindowConstants

private const val W = 720
private const val H = 1280
private val ACCENT = Renderer2D.parseAccent("#4da3ff")

fun main(args: Array<String>) {
    when (args.getOrNull(0)) {
        "render" -> {
            System.setProperty("java.awt.headless", "true")
            renderTour(args.getOrElse(1) { "lab-out" })
        }
        "bench" -> {
            System.setProperty("java.awt.headless", "true")
            bench()
        }
        else -> launchInteractive()
    }
}

// ── headless: render the tour to PNGs (the CI-able visual gate) ───────────────────────────────────

private fun renderTour(dir: String) {
    val out = File(dir).apply { mkdirs() }
    for (scene in tour(W.toFloat(), H.toFloat())) {
        val c = FieldController(W.toFloat(), H.toFloat(), particleCount = scene.particleCount, seed = 42)
        scene.build(c)
        val img = BufferedImage(W, H, BufferedImage.TYPE_INT_RGB)
        if (scene.mode == LabMode.TRAILS) {
            img.createGraphics().apply { color = Renderer2D.BG; fillRect(0, 0, W, H); dispose() }
            repeat(140) {
                c.tick()
                Renderer2D.fadeTrails(img)
                Renderer2D.stampTrails(img, c, ACCENT)
            }
        } else {
            repeat(90) { c.tick() }
            val g = img.createGraphics()
            Renderer2D.drawFrame(g, c, scene.mode, ACCENT, W, H)
            g.dispose()
        }
        val file = File(out, "${scene.name}.png")
        ImageIO.write(img, "png", file)
        println("wrote ${file.path}")
    }
    println("done → ${out.absolutePath}")
}

// ── headless: deterministic sim cost per scene (reported, not gated) ──────────────────────────────

private fun bench() {
    for (scene in tour(W.toFloat(), H.toFloat())) {
        val c = FieldController(W.toFloat(), H.toFloat(), particleCount = scene.particleCount, seed = 42)
        scene.build(c)
        repeat(30) { c.tick() } // warm
        val frames = 300
        val t0 = System.nanoTime()
        repeat(frames) { c.tick() }
        val msPerFrame = (System.nanoTime() - t0) / 1e6 / frames
        println("%-16s %5d particles  %.3f ms/frame (sim)".format(scene.name, scene.particleCount, msPerFrame))
    }
}

// ── interactive: the desktop window (the `swift run FieldLab` analog) ─────────────────────────────

private fun launchInteractive() {
    val frame = JFrame("FieldLab — Fundamental (Kotlin/JVM)")
    frame.defaultCloseOperation = WindowConstants.EXIT_ON_CLOSE
    frame.setSize(W, H)
    frame.setLocationRelativeTo(null)
    val panel = LabPanel()
    frame.contentPane.add(panel)
    frame.isVisible = true
    panel.requestFocusInWindow()
    panel.start()
}

/**
 * The live lab surface. Click bursts; D/T/L/G switch render mode; ←/→ cycle scenes. Drives the same
 * [FieldController] the Android host runs, at ~60fps via a Swing timer.
 */
private class LabPanel : JPanel() {
    private var controller: FieldController? = null
    private var mode = LabMode.TRAILS
    private var sceneIdx = 1
    private var buffer: BufferedImage? = null
    private val scenes get() = tour(width.coerceAtLeast(1).toFloat(), height.coerceAtLeast(1).toFloat())
    private val timer = Timer(16) { controller?.tick(); repaint() }

    init {
        isFocusable = true
        addComponentListener(object : ComponentAdapter() {
            override fun componentResized(e: ComponentEvent) = ensureField()
        })
        addMouseListener(object : MouseAdapter() {
            override fun mousePressed(e: MouseEvent) {
                controller?.burst(e.x.toFloat(), e.y.toFloat())
                requestFocusInWindow()
            }
        })
        addKeyListener(object : KeyAdapter() {
            override fun keyPressed(e: KeyEvent) {
                when (e.keyCode) {
                    KeyEvent.VK_D -> mode = LabMode.DOTS
                    KeyEvent.VK_T -> mode = LabMode.TRAILS
                    KeyEvent.VK_L -> mode = LabMode.LINKS
                    KeyEvent.VK_G -> mode = LabMode.GLOW
                    KeyEvent.VK_RIGHT -> loadScene(sceneIdx + 1)
                    KeyEvent.VK_LEFT -> loadScene(sceneIdx - 1)
                }
                resetBuffer()
                repaint()
            }
        })
    }

    fun start() = timer.start()

    private fun ensureField() {
        if (width <= 0 || height <= 0) return
        if (controller == null) {
            loadScene(sceneIdx)
        } else {
            controller!!.resize(width.toFloat(), height.toFloat())
        }
        resetBuffer()
    }

    private fun loadScene(i: Int) {
        if (width <= 0 || height <= 0) return
        val list = scenes
        sceneIdx = ((i % list.size) + list.size) % list.size
        val scene = list[sceneIdx]
        mode = scene.mode
        val c = FieldController(width.toFloat(), height.toFloat(), particleCount = scene.particleCount)
        scene.build(c)
        controller = c
        resetBuffer()
    }

    private fun resetBuffer() {
        if (width <= 0 || height <= 0) return
        buffer = BufferedImage(width, height, BufferedImage.TYPE_INT_RGB).also {
            it.createGraphics().apply { color = Renderer2D.BG; fillRect(0, 0, width, height); dispose() }
        }
    }

    override fun paintComponent(g: Graphics) {
        super.paintComponent(g)
        val c = controller ?: run { ensureField(); return }
        val g2 = g as Graphics2D
        val buf = buffer
        if (mode == LabMode.TRAILS && buf != null) {
            Renderer2D.fadeTrails(buf)
            Renderer2D.stampTrails(buf, c, ACCENT)
            g2.drawImage(buf, 0, 0, null)
        } else {
            Renderer2D.drawFrame(g2, c, mode, ACCENT, width, height)
        }
    }
}
