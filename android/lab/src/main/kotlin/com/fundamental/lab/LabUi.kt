package com.fundamental.lab

import com.fundamental.core.engine.Body
import com.fundamental.core.engine.FORMATIONS
import com.fundamental.core.engine.energyReport
import com.fundamental.core.runtime.FieldController
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
    var frameMs: Double = 0.0; private set
    private val timer = Timer(16) { tickOnce() }

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
        repaint()
    }

    override fun paintComponent(g: Graphics) {
        super.paintComponent(g)
        val c = controller ?: return
        val g2 = g as Graphics2D
        val buf = buffer
        if (mode == LabMode.TRAILS && buf != null) {
            Renderer2D.fadeTrails(buf); Renderer2D.stampTrails(buf, c, accent); g2.drawImage(buf, 0, 0, null)
        } else {
            Renderer2D.drawFrame(g2, c, mode, accent, width, height)
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
