#if os(macOS)
import SwiftUI
import FieldUICore
import FieldUIVanilla
import FieldLabKit

// MARK: - FieldLab
//
// The field-ui engine, native: every scene is one pillar of the model running live —
// cards with mass, a conserved attention budget, causality that flows as matter, a
// field with depth, sources and sinks, wormholes, thermodynamics, the full force
// catalog, and the locked 64-recipe canon. Hover cards to engage; click to burst;
// drag to lead the flow.

@main
struct FieldLabApp: App {
    var body: some SwiftUI.Scene {
        WindowGroup("FieldLab") {
            LabRootView()
                .frame(minWidth: 1180, minHeight: 740)
                .preferredColorScheme(.dark)
        }
    }
}

// MARK: - Selection

enum LabSelection: Hashable {
    case tour(String)
    case force(String)
    case recipe(String)
}

// MARK: - Root

struct LabRootView: View {
    @State private var selection: LabSelection = .tour(LabScenes.tour[0].id)
    @State private var formation = "ambient"
    @State private var renderMode: RenderMode = .dots
    @State private var overlays: Set<FieldUICore.OverlayMode> = []
    @State private var accent = Color(red: 0.30, green: 0.64, blue: 1.0)
    @State private var density: Double = 2
    @State private var waves = false
    @State private var showInspector = true
    @State private var showPipeline = false
    @State private var stats = LiveStats()

    private static let tourSymbols: [String: String] = [
        "mass": "scalemass", "magnetism": "bolt.horizontal", "attention": "eye",
        "causality": "arrow.triangle.branch", "volume": "cube.transparent",
        "source-sink": "drop.triangle", "warp": "arrow.uturn.left.circle", "storm": "tornado",
    ]

    private var currentScene: LabScene {
        switch selection {
        case .tour(let id):
            return LabScenes.tour.first { $0.id == id } ?? LabScenes.mass
        case .force(let token):
            return ForceCatalog.entry(token: token)?.scene ?? LabScenes.mass
        case .recipe(let id):
            return LabScenes.recipe(id) ?? LabScenes.mass
        }
    }

    var body: some View {
        NavigationSplitView {
            sidebar
        } detail: {
            ZStack(alignment: .bottomLeading) {
                FieldCanvasRepresentable(
                    scene: currentScene,
                    formation: formation,
                    renderMode: renderMode,
                    overlays: Array(overlays),
                    accent: accent,
                    density: Float(density),
                    waves: waves,
                    stats: $stats
                )
                captionChip
            }
            .background(Color(red: 0.043, green: 0.055, blue: 0.078))
            .ignoresSafeArea(edges: .bottom)
            .navigationTitle(currentScene.name)
            .toolbar { toolbarContent }
            .inspector(isPresented: $showInspector) {
                inspector
                    .inspectorColumnWidth(min: 250, ideal: 280, max: 340)
            }
        }
        .onChange(of: selection, initial: true) { _, _ in
            let s = currentScene
            formation = s.formation
            renderMode = s.render
            overlays = Set(s.overlay)
            density = Double(s.density)
            waves = s.waves
        }
    }

    // MARK: sidebar

    private var sidebar: some View {
        List(selection: $selection) {
            Section("The tour") {
                ForEach(LabScenes.tour, id: \.id) { scene in
                    SidebarRow(symbol: Self.tourSymbols[scene.id] ?? "circle.dotted",
                               title: scene.name, subtitle: scene.blurb)
                        .tag(LabSelection.tour(scene.id))
                }
            }
            ForEach(ForceCatalog.groups, id: \.self) { group in
                Section("\(group) forces") {
                    ForEach(ForceCatalog.entries(group: group)) { entry in
                        SidebarRow(symbol: Self.forceSymbol(entry.token),
                                   title: entry.label, subtitle: entry.blurb)
                            .tag(LabSelection.force(entry.token))
                    }
                }
            }
            Section("The canon — 64 recipes") {
                ForEach(FieldRecipes.all, id: \.id) { r in
                    SidebarRow(symbol: "book.closed", title: r.name, subtitle: r.intent)
                        .tag(LabSelection.recipe(r.id))
                }
            }
        }
        .listStyle(.sidebar)
        .navigationSplitViewColumnWidth(min: 230, ideal: 270)
    }

    private static func forceSymbol(_ token: String) -> String {
        [
            "attract": "arrow.down.forward.and.arrow.up.backward.circle", "jet": "wind",
            "tether": "link.circle", "wall": "square.dashed", "stream": "arrow.right",
            "repel": "arrow.up.backward.and.arrow.down.forward.circle",
            "viscosity": "drop.circle", "swirl": "hurricane", "sink": "tray.and.arrow.down",
            "gravity": "circle.circle", "charge": "plusminus.circle",
            "magnetism": "bolt.horizontal.circle", "thermal": "thermometer.medium",
            "collide": "circle.grid.cross", "diffuse": "aqi.medium", "propagate": "dot.radiowaves.left.and.right",
            "memory": "brain", "lens": "circle.lefthalf.filled", "gate": "door.left.hand.open",
            "buoyancy": "arrow.up.circle", "shear": "slider.horizontal.3",
            "crystallize": "snowflake", "align": "birds", "wind": "wind.circle",
            "cohesion": "drop.degreesign", "pressure": "gauge.with.dots.needle.50percent",
            "link": "point.3.connected.trianglepath.dotted", "hunt": "hare",
            "morph": "circle.dashed", "spawn": "sparkles", "resonate": "waveform",
            "spotlight": "flashlight.on.fill", "screen": "shield.lefthalf.filled",
            "pigment": "paintpalette", "fieldflow": "point.forward.to.point.capsulepath",
            "warp": "arrow.uturn.left.circle",
        ][token] ?? "atom"
    }

    // MARK: toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .secondaryAction) {
            Button {
                showPipeline.toggle()
            } label: {
                Label("How a field works", systemImage: "info.circle")
            }
            .help("The data → force → field → feedback pipeline")
            .popover(isPresented: $showPipeline, arrowEdge: .bottom) {
                pipelineExplainer
            }
        }
        ToolbarItem(placement: .primaryAction) {
            Button {
                showInspector.toggle()
            } label: {
                Label("Inspector", systemImage: "sidebar.trailing")
            }
            .help("Show or hide the field inspector")
        }
    }

    /// The whole model in four steps — what every scene in this app is an instance of.
    private var pipelineExplainer: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("How a field works")
                .font(.headline)
            pipelineStep("1", "Data becomes bodies",
                         "A card's data — importance, polarity, adjacency, budget — is written as body parameters: force tokens, strength (0.4…2.0 by the weight contract), range, spin, heading. The card IS the data, standing in the field.")
            pipelineStep("2", "Bodies bend the field",
                         "Every visible body applies its forces to the shared matter each frame — designed falloffs (attract, repel…) or real laws (gravity 1/d², the Lorentz force). Forces compose; modifiers gate and scale them.")
            pipelineStep("3", "Matter responds, conserved",
                         "The pool is finite and ledgered: attention is one budget, sinks hold what they capture, sources are mortal-budgeted, spillover sums to zero. Nothing is styled — everything is accounted.")
            pipelineStep("4", "The field measures back",
                         "Each measuring card receives its eased local density d, load, lit, and the thermo metrics — the same channels the web engine writes as --field-* variables. The glow you see on a card is a measurement, not a decoration.")
            Text("Field Agent Consumption Model → Body Matter Interaction → Sink/Accretion")
                .font(.caption2.monospaced())
                .foregroundStyle(.tertiary)
        }
        .padding(18)
        .frame(width: 440)
    }

    private func pipelineStep(_ n: String, _ title: String, _ body: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(n)
                .font(.caption.bold().monospaced())
                .padding(6)
                .background(.quaternary, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.bold())
                Text(body).font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    // MARK: caption chip — the scene's claim, plus canon details for recipes/forces

    private var captionChip: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(currentScene.name)
                .font(.headline)
            Text(currentScene.blurb)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if !currentScene.story.isEmpty {
                Text(currentScene.story)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 2)
            }
            if case .recipe(let id) = selection, let r = FieldRecipes.recipe(id: id) {
                recipeDetails(r)
            }
            if case .force(let token) = selection, let entry = ForceCatalog.entry(token: token) {
                Text("\(entry.group.lowercased()) force · token \(entry.token)")
                    .font(.caption.monospaced())
                    .foregroundStyle(.tertiary)
                    .padding(.top, 2)
            }
            Text("click → burst · drag → flow · hover a card → engage")
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .padding(.top, 2)
        }
        .padding(14)
        .frame(maxWidth: 460, alignment: .leading)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .padding(20)
        .allowsHitTesting(false)
    }

    /// The recipe's canon lanes, straight from the locked data: tokens execute, metrics
    /// measure, accessibility survives without motion.
    @ViewBuilder
    private func recipeDetails(_ r: FieldRecipe) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(r.primitives.joined(separator: " · "))
                .font(.caption.monospaced())
                .foregroundStyle(.secondary)
            if !r.metrics.isEmpty {
                Text("measures: " + r.metrics.joined(separator: " · "))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            if let notes = r.notes {
                Text(notes)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .lineLimit(3)
            }
            Text("without motion: \(r.accessibility.meaningWithoutMotion)")
                .font(.caption2.italic())
                .foregroundStyle(.tertiary)
                .lineLimit(2)
        }
        .padding(.top, 2)
    }

    // MARK: inspector

    private var inspector: some View {
        Form {
            Section {
                Picker("Formation", selection: $formation) {
                    ForEach(FORMATIONS, id: \.id) { f in
                        Text(f.name).tag(f.id)
                    }
                }
                .help(FORMATIONS.first { $0.id == formation }.map { "\($0.name) — \($0.cue)" } ?? "")
                Picker("Matter", selection: $renderMode) {
                    Label("Dots", systemImage: "circle.grid.3x3.fill").tag(RenderMode.dots)
                    Label("Trails", systemImage: "scribble.variable").tag(RenderMode.trails)
                    Label("Links", systemImage: "point.3.connected.trianglepath.dotted").tag(RenderMode.links)
                    Label("Metaballs", systemImage: "drop.fill").tag(RenderMode.metaballs)
                    Label("Voronoi", systemImage: "rectangle.split.3x3").tag(RenderMode.voronoi)
                    Label("Streamlines", systemImage: "water.waves").tag(RenderMode.streamlines)
                }
                .help("How the same matter is drawn — the simulation underneath is identical in every mode.")
                ColorPicker("Accent", selection: $accent, supportsOpacity: false)
                    .help("The travelling accent color — heat blends matter toward it.")
                LabeledContent("Density") {
                    Slider(value: $density, in: 0.5...5, step: 0.5)
                }
                .help("Particle-count multiplier: the pool is 130 × density, conserved while the field runs.")
                Toggle(isOn: $waves) {
                    Label("Carrier waves", systemImage: "water.waves.slash")
                }
                .help("The ambient resting structure (§2.3): five standing currents that carry bound shimmer and exchange matter with the free pool. Canon, but decorative here — off by default.")
            } header: {
                Text("Field")
            } footer: {
                Text("The medium. A formation biases every free particle; matter is how the one simulation is drawn; density is how much of it there is.")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            Section {
                readingToggle(.streamlines, "Streamlines", "water.waves",
                              "the net push a still probe would feel, as direction arrows")
                readingToggle(.forceVectors, "Force vectors", "arrow.up.right",
                              "the same arrows scaled by raw magnitude")
                readingToggle(.fieldLines, "Field lines", "point.forward.to.point.capsulepath",
                              "structure only — the dipoles and monopoles bodies radiate")
                readingToggle(.grid, "Deformation grid", "grid",
                              "a reference lattice displaced by the local field")
                readingToggle(.temperature, "Temperature", "thermometer.medium",
                              "iso-contours of the heat the matter carries")
                readingToggle(.energy, "Energy", "bolt",
                              "iso-contours of kinetic energy, ½·m·|v|²")
                readingToggle(.path, "Path traces", "point.topleft.down.to.point.bottomright.curvepath",
                              "flow integrated over distance from seeded probes")
                readingToggle(.data, "Density readouts", "gauge.with.needle",
                              "each measuring card's d as a fill ring — the --d signal")
            } header: {
                Text("Readings")
            } footer: {
                Text("Line diagnostics drawn over the matter. Each reveals one quantity the field is computing anyway — readings measure, they never push.")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            Section {
                liveRow("Particles", "\(stats.particles)", "the conserved pool (130 × density + budgeted sources)")
                liveRow("Kinetic", String(format: "%.1f", stats.kinetic), "Σ ½·m·|v|² over the pool")
                liveRow("Thermal", String(format: "%.1f", stats.thermal), "Σ heat — agitation the matter carries")
                liveRow("Frame", String(format: "%.1f ms", stats.frameMs), "main-thread tick gap (EMA) — 16.7 ms is 60 fps")
            } header: {
                Text("Live")
            } footer: {
                Text("Measured from the running simulation each half-second — the same accessors (particleCount, energy) the engine exposes to any host.")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .formStyle(.grouped)
    }

    private func readingToggle(_ mode: FieldUICore.OverlayMode, _ label: String,
                               _ symbol: String, _ meaning: String) -> some View {
        Toggle(isOn: Binding(
            get: { overlays.contains(mode) },
            set: { on in if on { overlays.insert(mode) } else { overlays.remove(mode) } }
        )) {
            Label {
                VStack(alignment: .leading, spacing: 1) {
                    Text(label)
                    Text(meaning)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            } icon: {
                Image(systemName: symbol)
            }
        }
    }

    private func liveRow(_ label: String, _ value: String, _ meaning: String) -> some View {
        LabeledContent {
            Text(value).monospacedDigit()
        } label: {
            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                Text(meaning)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }
}

// MARK: - Sidebar row

/// A two-line sidebar row: title + the item's one-sentence description, straight from
/// the scene/force/recipe data — every entry explains itself before it's opened.
struct SidebarRow: View {
    let symbol: String
    let title: String
    let subtitle: String

    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        } icon: {
            Image(systemName: symbol)
        }
        .padding(.vertical, 1)
    }
}

// MARK: - Live stats

struct LiveStats: Equatable {
    var particles = 0
    var kinetic: Float = 0
    var thermal: Float = 0
    var frameMs: Double = 0
}

// MARK: - The canvas bridge

struct FieldCanvasRepresentable: NSViewRepresentable {
    let scene: LabScene
    let formation: String
    let renderMode: RenderMode
    let overlays: [FieldUICore.OverlayMode]
    let accent: Color
    let density: Float
    let waves: Bool
    @Binding var stats: LiveStats

    func makeNSView(context: Context) -> FieldCanvasView {
        var s = scene
        s.density = density
        s.waves = waves
        let v = FieldCanvasView(scene: s)
        context.coordinator.sceneId = scene.id
        context.coordinator.density = density
        context.coordinator.waves = waves
        context.coordinator.startStats(canvas: v) { stats = $0 }
        return v
    }

    func updateNSView(_ canvas: FieldCanvasView, context: Context) {
        var s = scene
        s.density = density
        s.waves = waves
        // density and waves are creation-time options (pool size, the wave build) —
        // changing them rebuilds the field, exactly as a resize does.
        if context.coordinator.sceneId != scene.id
            || context.coordinator.density != density
            || context.coordinator.waves != waves {
            context.coordinator.sceneId = scene.id
            context.coordinator.density = density
            context.coordinator.waves = waves
            canvas.show(s)
        }
        canvas.field?.setFormation(formation)
        canvas.field?.setRender(renderMode)
        canvas.field?.setOverlay(overlays.isEmpty ? .single(.off) : .stack(overlays))
        if let hex = accent.fieldHex {
            canvas.field?.setAccent(hex)
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator {
        var sceneId = ""
        var density: Float = 2
        var waves = false
        private var timer: Timer?

        func startStats(canvas: FieldCanvasView, push: @escaping (LiveStats) -> Void) {
            timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak canvas] _ in
                guard let canvas, let field = canvas.field else { return }
                let e = field.energy()
                push(LiveStats(particles: field.particleCount(),
                               kinetic: e.kinetic, thermal: e.thermal,
                               frameMs: canvas.lastFrameMs))
            }
        }

        deinit { timer?.invalidate() }
    }
}

extension Color {
    /// `#rrggbb` for the engine's accent API.
    var fieldHex: String? {
        guard let c = NSColor(self).usingColorSpace(.sRGB) else { return nil }
        return String(format: "#%02x%02x%02x",
                      Int(c.redComponent * 255), Int(c.greenComponent * 255), Int(c.blueComponent * 255))
    }
}
#endif

#if !os(macOS)
// FieldLab is a macOS app; cross-platform package builds still need an entry point.
@main
struct FieldLabUnavailable {
    static func main() {
        print("FieldLab is a macOS app — run it there: swift run FieldLab")
    }
}
#endif
