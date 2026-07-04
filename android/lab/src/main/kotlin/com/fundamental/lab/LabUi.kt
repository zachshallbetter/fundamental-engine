package com.fundamental.lab

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.FORMATIONS
import com.fundamental.core.engine.energyReport
import com.fundamental.core.overlay.Overlays
import com.fundamental.core.overlay.energyContours
import com.fundamental.core.overlay.temperatureContours
import com.fundamental.core.recipes.FieldRecipes
import com.fundamental.core.runtime.FieldController
import javax.swing.JCheckBox
import java.awt.BorderLayout
import java.awt.Color
import java.awt.Component
import java.awt.Dimension
import java.awt.Graphics
import java.awt.Graphics2D
import java.awt.GridLayout
import java.awt.event.ComponentAdapter
import java.awt.event.ComponentEvent
import java.awt.event.MouseAdapter
import java.awt.event.MouseEvent
import java.awt.image.BufferedImage
import javax.swing.Box as SwingBox
import javax.swing.BorderFactory
import javax.swing.BoxLayout
import javax.swing.DefaultListCellRenderer
import javax.swing.DefaultListModel
import javax.swing.JButton
import javax.swing.JColorChooser
import javax.swing.JComboBox
import javax.swing.JFrame
import javax.swing.JLabel
import javax.swing.JList
import javax.swing.JPanel
import javax.swing.JScrollPane
import javax.swing.JSlider
import javax.swing.JSplitPane
import javax.swing.ListSelectionModel
import javax.swing.Timer
import javax.swing.WindowConstants

// FieldLab desktop UI (Swing/Java2D) — the Kotlin analog of the macOS FieldLab: a sidebar (the tour +
// the full 36-force catalog), a live canvas, and an inspector (formation, render mode, density, accent,
// live body sliders, live stats). Drives the same :fundamental-core engine.

// ── overlay readings ────────────────────────────────────────────────────────────────────────────

/** The overlay diagnostics the inspector can toggle (the FieldLab "Readings" section). */
enum class Reading(val label: String, val color: Color) {
    STREAMLINES("Streamlines", Color(120, 170, 235)),
    FORCE_VECTORS("Force vectors", Color(150, 200, 255)),
    FIELD_LINES("Field lines", Color(120, 225, 150)),
    GRID("Deformation grid", Color(120, 128, 150)),
    TEMPERATURE("Temperature", Color(255, 150, 90)),
    ENERGY("Energy", Color(240, 220, 110)),
    PATH("Path traces", Color(180, 150, 235)),
    DATA("Data rings", Color(235, 200, 120)),
}

/** Compute + draw one reading over the current field. */
fun drawReading(g: Graphics2D, c: FieldController, r: Reading, w: Int, h: Int) {
    val fw = w.toFloat(); val fh = h.toFloat()
    val segs = when (r) {
        Reading.STREAMLINES -> Overlays.vectorField(c.bodies, c.forces, fw, fh, normalized = true)
        Reading.FORCE_VECTORS -> Overlays.vectorField(c.bodies, c.forces, fw, fh, normalized = false)
        Reading.FIELD_LINES -> Overlays.fieldLines(c.bodies, c.forces, fw, fh)
        Reading.GRID -> Overlays.deformationGrid(c.bodies, c.forces, fw, fh)
        Reading.TEMPERATURE -> temperatureContours(c.particles, fw, fh)
        Reading.ENERGY -> energyContours(c.particles, fw, fh)
        // PATH / DATA are stateful (position history / per-body) — drawn by the canvas, not here.
        Reading.PATH, Reading.DATA -> emptyList()
    }
    Renderer2D.drawSegments(g, segs, r.color, if (r == Reading.GRID) 0.6f else 1.1f)
}

// ── sidebar rows ──────────────────────────────────────────────────────────────────────────────────

private sealed class Row
private class Header(val title: String) : Row()
private class SceneRow(val title: String, val subtitle: String, val make: () -> LabScene) : Row()

private fun buildRows(): List<Row> {
    val rows = ArrayList<Row>()
    rows.add(Header("The tour"))
    for (s in tourScenes()) rows.add(SceneRow(s.name, s.blurb) { s })
    for (g in ForceCatalog.groups) {
        rows.add(Header("$g forces"))
        for (e in ForceCatalog.group(g)) rows.add(SceneRow(e.label, e.blurb) { forceScene(e) })
    }
    rows.add(Header("The canon — 64 recipes"))
    for (r in FieldRecipes.all) rows.add(SceneRow(r.name, r.intent) { recipeScene(r) })
    return rows
}

// ── the live canvas ─────────────────────────────────────────────────────────────────────────────

class LabCanvas : JPanel() {
    var accent: Color = Renderer2D.parseAccent("#4da3ff")
    private var controller: FieldController? = null
    private var scene: LabScene = tourScenes()[0]
    private var mode: LabMode = LabMode.DOTS
    private var formation: String = "ambient"
    private var density: Int = 600
    private var primary: Body? = null
    private var buffer: BufferedImage? = null
    private val readings = LinkedHashSet<Reading>()
    private var attentionOn = false
    private var causalityOn = false
    private var heatmapOn = false
    private var wavesOn = false
    private var particleShape = com.fundamental.core.engine.ParticleShape.DOT
    var frameMs: Double = 0.0; private set
    private val timer = Timer(16) { tickOnce() }
    // Path traces: a rolling buffer of recent sampled particle positions (the `path` reading machinery).
    private val pathHistory = ArrayDeque<FloatArray>()
    private var currentRecipe: com.fundamental.core.recipes.FieldRecipe? = null

    fun toggleReading(r: Reading, on: Boolean) {
        if (on) readings.add(r) else { readings.remove(r); if (r == Reading.PATH) pathHistory.clear() }
    }

    /** The recipe backing the loaded scene, if any (drives the inspector's Export). */
    fun currentRecipe(): com.fundamental.core.recipes.FieldRecipe? = currentRecipe
    fun setAttention(on: Boolean) { attentionOn = on; controller?.attentionEnabled = on }
    fun setCausality(on: Boolean) { causalityOn = on; controller?.causalityEnabled = on }
    fun setHeatmap(on: Boolean) { heatmapOn = on; controller?.heatmapEnabled = on }
    fun setWaves(on: Boolean) { wavesOn = on; controller?.wavesEnabled = on }
    fun setShape(s: com.fundamental.core.engine.ParticleShape) { particleShape = s; resetBuffer(); repaint() }

    init {
        background = Renderer2D.BG
        preferredSize = Dimension(720, 900)
        isFocusable = true
        addComponentListener(object : ComponentAdapter() {
            override fun componentResized(e: ComponentEvent) = rebuild()
        })
        addMouseListener(object : MouseAdapter() {
            override fun mousePressed(e: MouseEvent) { controller?.burst(e.x.toFloat(), e.y.toFloat()) }
        })
    }

    fun start() = timer.start()
    fun controllerOrNull() = controller

    fun load(s: LabScene) {
        scene = s; mode = s.renderMode; formation = s.formation; density = s.density
        currentRecipe = s.recipe
        pathHistory.clear()
        rebuild()
    }

    fun setMode(m: LabMode) { mode = m; resetBuffer(); repaint() }
    fun setFormation(f: String) { formation = f; controller?.setFormation(f) }
    fun setDensity(d: Int) { density = d; rebuild() }
    fun setBodyParams(strength: Float, range: Float, spin: Float) {
        primary?.let { it.strength = strength; it.range = range; it.spin = spin }
    }

    fun primaryParams(): Triple<Float, Float, Float>? = primary?.let { Triple(it.strength, it.range, it.spin) }

    private fun rebuild() {
        if (width <= 0 || height <= 0) return
        val c = FieldController(width.toFloat(), height.toFloat(), particleCount = density)
        c.setFormation(formation)
        scene.setup(c, width.toFloat(), height.toFloat())
        c.attentionEnabled = attentionOn
        c.causalityEnabled = causalityOn
        c.heatmapEnabled = heatmapOn
        c.wavesEnabled = wavesOn
        controller = c
        primary = c.bodies.firstOrNull { scene.token != null && it.tokens.contains(scene.token) } ?: c.bodies.firstOrNull()
        resetBuffer()
    }

    private fun resetBuffer() {
        if (width <= 0 || height <= 0) return
        buffer = BufferedImage(width, height, BufferedImage.TYPE_INT_RGB).also {
            it.createGraphics().apply { color = Renderer2D.BG; fillRect(0, 0, width, height); dispose() }
        }
    }

    private fun tickOnce() {
        val c = controller ?: run { if (width > 0 && height > 0) rebuild(); return }
        val t0 = System.nanoTime()
        c.tick()
        frameMs = frameMs * 0.9 + (System.nanoTime() - t0) / 1e6 * 0.1
        if (Reading.PATH in readings) capturePath(c)
        repaint()
    }

    // Snapshot the first ~64 particles' positions each frame; keep a short rolling window.
    private fun capturePath(c: FieldController) {
        val parts = c.particles
        val n = minOf(64, parts.size)
        val snap = FloatArray(n * 2)
        for (i in 0 until n) { snap[i * 2] = parts[i].position.x; snap[i * 2 + 1] = parts[i].position.y }
        pathHistory.addLast(snap)
        while (pathHistory.size > 30) pathHistory.removeFirst()
    }

    override fun paintComponent(g: Graphics) {
        super.paintComponent(g)
        val c = controller ?: return
        val g2 = g as Graphics2D
        val buf = buffer
        if (mode == LabMode.TRAILS && buf != null) {
            Renderer2D.fadeTrails(buf); Renderer2D.stampTrails(buf, c, accent, particleShape); g2.drawImage(buf, 0, 0, null)
        } else {
            Renderer2D.drawFrame(g2, c, mode, accent, width, height, particleShape)
        }
        if (wavesOn) Renderer2D.drawWaves(g2, c, width, height)
        if (heatmapOn) Renderer2D.drawHeatmap(g2, c, width, height, accent)
        Renderer2D.drawSparks(g2, c)
        for (r in readings) when (r) {
            Reading.PATH -> drawPathTraces(g2)
            Reading.DATA -> drawDataRings(g2, c)
            else -> drawReading(g2, c, r, width, height)
        }
    }

    // The `path` reading: each sampled particle's recent trajectory as a fading polyline.
    private fun drawPathTraces(g: Graphics2D) {
        if (pathHistory.size < 2) return
        g.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON)
        val base = Reading.PATH.color
        // particle count can drift; trace only indices present in every frame. Skip empty captures
        // (a frame that sampled 0 particles would otherwise collapse n — and the whole trace — to 0).
        val frames = pathHistory.toList().filter { it.isNotEmpty() }
        if (frames.size < 2) return
        val n = frames.minOf { it.size / 2 }
        for (j in 0 until n) {
            for (f in 1 until frames.size) {
                val a = frames[f - 1]; val b = frames[f]
                val alpha = (f.toFloat() / frames.size * 200f).toInt().coerceIn(12, 220)
                g.color = Color(base.red, base.green, base.blue, alpha)
                g.stroke = java.awt.BasicStroke(1.4f)
                g.drawLine(a[j * 2].toInt(), a[j * 2 + 1].toInt(), b[j * 2].toInt(), b[j * 2 + 1].toInt())
            }
        }
    }

    // The per-body `data` reading: a density ring + (for sinks) a load arc, with the live readout.
    private fun drawDataRings(g: Graphics2D, c: FieldController) {
        g.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON)
        val accentRing = Reading.DATA.color
        for (b in c.bodies) {
            if (!b.isVisible || b.tokens.isEmpty()) continue
            val cx = b.box.center.x.toInt(); val cy = b.box.center.y.toInt()
            val rad = (b.range * 0.5f).coerceIn(20f, 180f)
            // outer density ring — opacity tracks the body's eased density d ∈ [0,1].
            val dAlpha = (40 + b.d.coerceIn(0f, 1f) * 180f).toInt().coerceIn(40, 220)
            g.color = Color(accentRing.red, accentRing.green, accentRing.blue, dAlpha)
            g.stroke = java.awt.BasicStroke(1.6f + b.d.coerceIn(0f, 1f) * 2.4f)
            g.drawOval(cx - rad.toInt(), cy - rad.toInt(), (rad * 2).toInt(), (rad * 2).toInt())
            // sink load arc — sweep ∝ accreted/capacity.
            val isSink = b.capacity > 0f
            val load = if (isSink) (b.accreted / b.capacity).coerceIn(0f, 1f) else 0f
            if (isSink) {
                val ir = (rad * 0.62f).toInt()
                g.color = Color(255, 140, 90, 220)
                g.stroke = java.awt.BasicStroke(3f)
                g.drawArc(cx - ir, cy - ir, ir * 2, ir * 2, 90, -(load * 360f).toInt())
            }
            // readout text — mirrors the Swift FieldCanvas "d 0.00" / "load N%".
            val label = if (isSink) "load ${(load * 100).toInt()}%" else "d %.2f".format(b.d)
            g.color = Color(220, 224, 232, 230)
            g.font = g.font.deriveFont(java.awt.Font.BOLD, 11f)
            g.drawString(label, cx + rad.toInt() + 4, cy)
        }
    }
}

// ── the window ──────────────────────────────────────────────────────────────────────────────────

fun launchLab() {
    val frame = JFrame("FieldLab — Fundamental (Kotlin/JVM)")
    frame.defaultCloseOperation = WindowConstants.EXIT_ON_CLOSE
    frame.setSize(1180, 820)
    frame.setLocationRelativeTo(null)

    val canvas = LabCanvas()
    val rows = buildRows()
    val sidebar = makeSidebar(rows, canvas)
    val inspector = makeInspector(canvas)

    val right = JSplitPane(JSplitPane.HORIZONTAL_SPLIT, canvas, inspector).apply {
        resizeWeight = 1.0; dividerLocation = 860
    }
    val split = JSplitPane(JSplitPane.HORIZONTAL_SPLIT, JScrollPane(sidebar), right).apply {
        dividerLocation = 270
    }
    frame.contentPane.add(split, BorderLayout.CENTER)
    frame.isVisible = true
    canvas.load(tourScenes()[1]) // open on the Attractor
    canvas.start()
}

private fun makeSidebar(rows: List<Row>, canvas: LabCanvas): JList<Row> {
    val model = DefaultListModel<Row>().apply { rows.forEach { addElement(it) } }
    val list = JList(model)
    list.selectionMode = ListSelectionModel.SINGLE_SELECTION
    list.cellRenderer = object : DefaultListCellRenderer() {
        override fun getListCellRendererComponent(l: JList<*>?, value: Any?, index: Int, sel: Boolean, focus: Boolean): Component {
            val c = super.getListCellRendererComponent(l, value, index, sel, focus) as JLabel
            when (value) {
                is Header -> { c.text = value.title.uppercase(); c.font = c.font.deriveFont(java.awt.Font.BOLD, 11f); c.foreground = Color(150, 160, 180); c.border = BorderFactory.createEmptyBorder(10, 8, 2, 8) }
                is SceneRow -> { c.text = "<html><b>${value.title}</b><br><span style='color:#8a93a6'>${value.subtitle}</span></html>"; c.border = BorderFactory.createEmptyBorder(3, 14, 3, 8) }
            }
            return c
        }
    }
    list.addListSelectionListener {
        if (!it.valueIsAdjusting) {
            (list.selectedValue as? SceneRow)?.let { row -> canvas.load(row.make()) }
        }
    }
    return list
}

private fun makeInspector(canvas: LabCanvas): JPanel {
    val panel = JPanel().apply {
        layout = BoxLayout(this, BoxLayout.Y_AXIS)
        border = BorderFactory.createEmptyBorder(12, 12, 12, 12)
        preferredSize = Dimension(300, 800)
    }

    // Formation
    val formationBox = JComboBox(FORMATIONS.map { it.id }.toTypedArray())
    formationBox.addActionListener { canvas.setFormation(formationBox.selectedItem as String) }
    panel.add(labeled("Formation", formationBox))

    // Render mode
    val modeBox = JComboBox(LabMode.values())
    modeBox.addActionListener { canvas.setMode(modeBox.selectedItem as LabMode) }
    panel.add(labeled("Matter", modeBox))

    // Particle shape (#651) — stamp a vector shape per particle, scaled by size + heat.
    val shapes = linkedMapOf(
        "Dot" to com.fundamental.core.engine.ParticleShape.DOT,
        "Star" to com.fundamental.core.engine.ParticleShape.star(5),
        "Triangle" to com.fundamental.core.engine.ParticleShape.polygon(3),
        "Square" to com.fundamental.core.engine.ParticleShape.polygon(4),
        "Hexagon" to com.fundamental.core.engine.ParticleShape.polygon(6),
    )
    val shapeBox = JComboBox(shapes.keys.toTypedArray())
    shapeBox.addActionListener { canvas.setShape(shapes[shapeBox.selectedItem as String]!!) }
    panel.add(labeled("Shape", shapeBox))

    // Density
    val densitySlider = JSlider(2, 8, 5)
    densitySlider.addChangeListener { if (!densitySlider.valueIsAdjusting) canvas.setDensity(densitySlider.value * 130) }
    panel.add(labeled("Density (×130)", densitySlider))

    // Accent
    val accentBtn = JButton("Accent colour…")
    accentBtn.addActionListener {
        val picked = JColorChooser.showDialog(panel, "Accent", canvas.accent)
        if (picked != null) canvas.accent = picked
    }
    panel.add(accentBtn)

    // Recipe save/export — write the loaded recipe back to canonical JSON.
    val exportBtn = JButton("Export recipe…")
    exportBtn.addActionListener {
        val recipe = canvas.currentRecipe()
        if (recipe == null) {
            javax.swing.JOptionPane.showMessageDialog(panel, "Load a recipe scene (the canon section) to export it.")
        } else {
            val chooser = javax.swing.JFileChooser().apply { selectedFile = java.io.File(RecipeExport.defaultFileName(recipe)) }
            if (chooser.showSaveDialog(panel) == javax.swing.JFileChooser.APPROVE_OPTION) {
                val f = RecipeExport.write(recipe, chooser.selectedFile)
                javax.swing.JOptionPane.showMessageDialog(panel, "Exported ${recipe.name} → ${f.absolutePath}")
            }
        }
    }
    panel.add(exportBtn)

    // Body params
    val strength = JSlider(0, 300, 200)
    val range = JSlider(40, 900, 400)
    val spin = JSlider(-300, 300, 130)
    val push = { canvas.setBodyParams(strength.value / 100f, range.value.toFloat(), spin.value / 100f) }
    strength.addChangeListener { push() }
    range.addChangeListener { push() }
    spin.addChangeListener { push() }
    panel.add(section("Body formula"))
    panel.add(labeled("strength ×0.01", strength))
    panel.add(labeled("range px", range))
    panel.add(labeled("spin ×0.01", spin))

    // Readings (overlay diagnostics)
    panel.add(section("Readings"))
    for (r in Reading.values()) {
        val cb = JCheckBox(r.label)
        cb.foreground = Color(200, 206, 218)
        cb.isOpaque = false
        cb.alignmentX = Component.LEFT_ALIGNMENT
        cb.addActionListener { canvas.toggleReading(r, cb.isSelected) }
        panel.add(cb)
    }

    // Body Matter Interaction — the model's conserved truths
    panel.add(section("Body Matter Interaction"))
    fun bmi(label: String, apply: (Boolean) -> Unit) {
        val cb = JCheckBox(label)
        cb.foreground = Color(200, 206, 218); cb.isOpaque = false; cb.alignmentX = Component.LEFT_ALIGNMENT
        cb.addActionListener { apply(cb.isSelected) }
        panel.add(cb)
    }
    bmi("Conserved attention") { canvas.setAttention(it) }
    bmi("Cross-boundary causality") { canvas.setCausality(it) }
    bmi("Density heatmap") { canvas.setHeatmap(it) }
    bmi("Carrier waves") { canvas.setWaves(it) }

    // Live stats
    panel.add(section("Live"))
    val statParticles = JLabel("—"); val statKinetic = JLabel("—"); val statThermal = JLabel("—"); val statFrame = JLabel("—")
    panel.add(statRow("Particles", statParticles))
    panel.add(statRow("Kinetic", statKinetic))
    panel.add(statRow("Thermal", statThermal))
    panel.add(statRow("Frame ms", statFrame))
    Timer(500) {
        val c = canvas.controllerOrNull()
        if (c != null) {
            val e = energyReport(c.particles)
            statParticles.text = c.particleCount.toString()
            statKinetic.text = "%.1f".format(e.kinetic)
            statThermal.text = "%.1f".format(e.thermal)
            statFrame.text = "%.2f".format(canvas.frameMs)
        }
        // reflect the loaded scene's body params onto the sliders (once, on scene change)
        canvas.primaryParams()?.let { (s, r, sp) ->
            if (!strength.valueIsAdjusting && !range.valueIsAdjusting && !spin.valueIsAdjusting) {
                // no-op: leave user-driven; sliders push to the body, not the reverse
            }
        }
    }.start()

    panel.add(SwingBox.createVerticalGlue())
    return panel
}

private fun labeled(title: String, c: Component): JPanel = JPanel(BorderLayout(6, 2)).apply {
    maximumSize = Dimension(Int.MAX_VALUE, 56)
    add(JLabel(title).apply { foreground = Color(170, 178, 196) }, BorderLayout.NORTH)
    add(c, BorderLayout.CENTER)
    border = BorderFactory.createEmptyBorder(4, 0, 4, 0)
}

private fun section(title: String): JLabel = JLabel(title.uppercase()).apply {
    font = font.deriveFont(java.awt.Font.BOLD, 11f); foreground = Color(150, 160, 180)
    border = BorderFactory.createEmptyBorder(12, 0, 4, 0)
}

private fun statRow(label: String, value: JLabel): JPanel = JPanel(GridLayout(1, 2)).apply {
    maximumSize = Dimension(Int.MAX_VALUE, 22)
    add(JLabel(label).apply { foreground = Color(150, 160, 180) })
    add(value.apply { foreground = Color(220, 224, 232) })
}
