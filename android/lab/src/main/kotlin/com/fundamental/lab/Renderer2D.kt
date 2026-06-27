package com.fundamental.lab

import com.fundamental.core.overlay.Segment
import com.fundamental.core.runtime.FieldController
import java.awt.AlphaComposite
import java.awt.BasicStroke
import java.awt.Color
import java.awt.Graphics2D
import java.awt.MultipleGradientPaint
import java.awt.RadialGradientPaint
import java.awt.RenderingHints
import java.awt.geom.Ellipse2D
import java.awt.geom.Line2D
import java.awt.geom.Point2D
import java.awt.image.BufferedImage

/** How matter is drawn — the JVM-lab mirror of the Compose `RenderMode`. */
enum class LabMode { DOTS, TRAILS, LINKS, GLOW }

/**
 * Java2D rendering of a [FieldController]'s particle pool — shared by the interactive Swing window and
 * the headless PNG/bench path, so what you see in the lab is what the snapshot writes. Pure JDK.
 */
object Renderer2D {
    val BG = Color(10, 10, 18)
    private val COOL = Color(255, 224, 200)
    private const val LINK_RADIUS = 38f

    fun parseAccent(hex: String): Color = try {
        val h = hex.removePrefix("#")
        Color(h.substring(0, 2).toInt(16), h.substring(2, 4).toInt(16), h.substring(4, 6).toInt(16))
    } catch (e: Exception) {
        Color(77, 163, 255)
    }

    private fun blend(a: Color, b: Color, t: Float): Color {
        val k = t.coerceIn(0f, 1f)
        return Color(
            (a.red + (b.red - a.red) * k).toInt(),
            (a.green + (b.green - a.green) * k).toInt(),
            (a.blue + (b.blue - a.blue) * k).toInt(),
        )
    }

    fun antialias(g: Graphics2D) {
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)
    }

    fun fillBackground(g: Graphics2D, w: Int, h: Int) {
        g.color = BG
        g.fillRect(0, 0, w, h)
    }

    fun drawDots(g: Graphics2D, c: FieldController, accent: Color) {
        for (p in c.particles) {
            val heat = p.heat.coerceIn(0f, 1f)
            val r = 1.5f + p.size * 1.5f + heat * 3f
            g.color = blend(COOL, accent, heat)
            g.fill(Ellipse2D.Float(p.position.x - r, p.position.y - r, 2 * r, 2 * r))
        }
    }

    fun drawGlow(g: Graphics2D, c: FieldController, accent: Color) {
        for (p in c.particles) {
            val heat = p.heat.coerceIn(0f, 1f)
            val core = blend(COOL, accent, heat)
            val glowR = 5f + p.size * 2f + heat * 16f
            val center = Point2D.Float(p.position.x, p.position.y)
            val edge = Color(core.red, core.green, core.blue, 0)
            val mid = Color(core.red, core.green, core.blue, (110 + heat * 100).toInt().coerceIn(0, 255))
            g.paint = RadialGradientPaint(
                center, glowR, floatArrayOf(0f, 1f), arrayOf(mid, edge),
                MultipleGradientPaint.CycleMethod.NO_CYCLE,
            )
            g.fill(Ellipse2D.Float(p.position.x - glowR, p.position.y - glowR, 2 * glowR, 2 * glowR))
        }
    }

    fun drawLinks(g: Graphics2D, c: FieldController, accent: Color) {
        for (p in c.particles) {
            for (q in c.store.neighbors(p, LINK_RADIUS)) {
                val dx = p.position.x - q.position.x
                val dy = p.position.y - q.position.y
                val d = Math.sqrt((dx * dx + dy * dy).toDouble()).toFloat()
                val a = ((1f - d / LINK_RADIUS) * 0.25f).coerceIn(0f, 1f)
                g.color = Color(accent.red, accent.green, accent.blue, (a * 255).toInt())
                g.draw(Line2D.Float(p.position.x, p.position.y, q.position.x, q.position.y))
            }
        }
        for (p in c.particles) {
            val heat = p.heat.coerceIn(0f, 1f)
            val r = 1.5f + heat * 2f
            g.color = blend(COOL, accent, heat)
            g.fill(Ellipse2D.Float(p.position.x - r, p.position.y - r, 2 * r, 2 * r))
        }
    }

    /** Fade a persistent TRAILS buffer toward the background (comet-trail decay). */
    fun fadeTrails(buffer: BufferedImage, fade: Float = 0.16f) {
        val g = buffer.createGraphics()
        g.composite = AlphaComposite.getInstance(AlphaComposite.SRC_OVER, fade)
        g.color = BG
        g.fillRect(0, 0, buffer.width, buffer.height)
        g.dispose()
    }

    /** Stamp the current matter into a TRAILS buffer (opaque dots on top of the faded frame). */
    fun stampTrails(buffer: BufferedImage, c: FieldController, accent: Color) {
        val g = buffer.createGraphics()
        antialias(g)
        drawDots(g, c, accent)
        g.dispose()
    }

    /** Draw the §23 micro-reaction sparks — bright dots fading by life. */
    fun drawSparks(g: Graphics2D, c: FieldController) {
        antialias(g)
        for (s in c.sparks.sparks) {
            val a = s.life.coerceIn(0f, 1f)
            g.color = Color(
                (s.color.x / 255f).coerceIn(0f, 1f),
                (s.color.y / 255f).coerceIn(0f, 1f),
                (s.color.z / 255f).coerceIn(0f, 1f),
                a,
            )
            val r = 1.4f + a * 1.6f
            g.fill(Ellipse2D.Float(s.position.x - r, s.position.y - r, 2 * r, 2 * r))
        }
    }

    /** Draw the density heatmap as a coarse accent-tinted glow, sampled from the controller's buffer. */
    fun drawHeatmap(g: Graphics2D, c: FieldController, w: Int, h: Int, accent: Color, cell: Int = 24) {
        var y = 0
        while (y < h) {
            var x = 0
            while (x < w) {
                val v = c.sampleScalar((x + cell / 2).toFloat(), (y + cell / 2).toFloat())
                if (v > 0.03f) {
                    g.color = Color(accent.red, accent.green, accent.blue, (v * 150f).toInt().coerceIn(0, 170))
                    g.fillRect(x, y, cell, cell)
                }
                x += cell
            }
            y += cell
        }
    }

    /** Draw overlay-reading segments (vectors, field-lines, contours, the deformation grid). */
    fun drawSegments(g: Graphics2D, segs: List<Segment>, color: Color, width: Float = 1f) {
        antialias(g)
        g.stroke = BasicStroke(width)
        g.color = color
        for (s in segs) g.draw(Line2D.Float(s.ax, s.ay, s.bx, s.by))
    }

    /** Draw one non-trail frame (DOTS/LINKS/GLOW) to a fresh surface. */
    fun drawFrame(g: Graphics2D, c: FieldController, mode: LabMode, accent: Color, w: Int, h: Int) {
        antialias(g)
        fillBackground(g, w, h)
        when (mode) {
            LabMode.DOTS -> drawDots(g, c, accent)
            LabMode.GLOW -> drawGlow(g, c, accent)
            LabMode.LINKS -> drawLinks(g, c, accent)
            LabMode.TRAILS -> drawDots(g, c, accent) // trails need a persistent buffer; caller handles it
        }
    }
}
