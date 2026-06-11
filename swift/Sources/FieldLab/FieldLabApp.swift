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
    @State private var showInspector = true
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
        ToolbarItem(placement: .primaryAction) {
            Button {
                showInspector.toggle()
            } label: {
                Label("Inspector", systemImage: "sidebar.trailing")
            }
            .help("Show or hide the field inspector")
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
            Section("Field") {
                Picker("Formation", selection: $formation) {
                    ForEach(FORMATIONS, id: \.id) { f in
                        Text(f.name).tag(f.id)
                    }
                }
                Picker("Matter", selection: $renderMode) {
                    Label("Dots", systemImage: "circle.grid.3x3.fill").tag(RenderMode.dots)
                    Label("Trails", systemImage: "scribble.variable").tag(RenderMode.trails)
                    Label("Links", systemImage: "point.3.connected.trianglepath.dotted").tag(RenderMode.links)
                    Label("Metaballs", systemImage: "drop.fill").tag(RenderMode.metaballs)
                    Label("Voronoi", systemImage: "rectangle.split.3x3").tag(RenderMode.voronoi)
                    Label("Streamlines", systemImage: "water.waves").tag(RenderMode.streamlines)
                }
                ColorPicker("Accent", selection: $accent, supportsOpacity: false)
                LabeledContent("Density") {
                    Slider(value: $density, in: 0.5...5, step: 0.5)
                }
            }

            Section("Readings") {
                readingToggle(.streamlines, "Streamlines", "water.waves")
                readingToggle(.forceVectors, "Force vectors", "arrow.up.right")
                readingToggle(.fieldLines, "Field lines", "point.forward.to.point.capsulepath")
                readingToggle(.grid, "Deformation grid", "grid")
                readingToggle(.temperature, "Temperature", "thermometer.medium")
                readingToggle(.energy, "Energy", "bolt")
                readingToggle(.path, "Path traces", "point.topleft.down.to.point.bottomright.curvepath")
                readingToggle(.data, "Density readouts", "gauge.with.needle")
            }

            Section("Live") {
                LabeledContent("Particles", value: "\(stats.particles)")
                LabeledContent("Kinetic", value: String(format: "%.1f", stats.kinetic))
                LabeledContent("Thermal", value: String(format: "%.1f", stats.thermal))
                LabeledContent("Frame", value: String(format: "%.1f ms", stats.frameMs))
            }
        }
        .formStyle(.grouped)
    }

    private func readingToggle(_ mode: FieldUICore.OverlayMode, _ label: String, _ symbol: String) -> some View {
        Toggle(isOn: Binding(
            get: { overlays.contains(mode) },
            set: { on in if on { overlays.insert(mode) } else { overlays.remove(mode) } }
        )) {
            Label(label, systemImage: symbol)
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
    @Binding var stats: LiveStats

    func makeNSView(context: Context) -> FieldCanvasView {
        let v = FieldCanvasView(scene: scene)
        context.coordinator.sceneId = scene.id
        context.coordinator.density = density
        context.coordinator.startStats(canvas: v) { stats = $0 }
        return v
    }

    func updateNSView(_ canvas: FieldCanvasView, context: Context) {
        var s = scene
        s.density = density
        if context.coordinator.sceneId != scene.id || context.coordinator.density != density {
            context.coordinator.sceneId = scene.id
            context.coordinator.density = density
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
