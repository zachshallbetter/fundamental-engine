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

/// Which inspector settings the user has pinned this session. An untouched setting is
/// "auto" — it follows each scene's own configuration; once the user changes it, it
/// persists across sidebar selections until Reset.
enum SettingKey: String, CaseIterable {
    case formation, matter, overlays, density, waves
    case mass, attention, causality, heatmap
}

struct LabRootView: View {
    @State private var selection: LabSelection = .tour(LabScenes.tour[0].id)
    @State private var formation = "ambient"
    @State private var renderMode: RenderMode = .dots
    @State private var overlays: Set<FieldUICore.OverlayMode> = []
    @State private var accent = Color(red: 0.30, green: 0.64, blue: 1.0)
    @State private var density: Double = 2
    @State private var waves = false
    // Body Matter Interaction — how bodies and matter exchange (the engine truths)
    @State private var firstClassMass = false
    @State private var attention = false
    @State private var causality = false
    @State private var heatmap = false
    @State private var showInspector = true
    @State private var showPipeline = false
    @State private var stats = LiveStats()
    /// Settings the user has pinned (everything else follows the scene).
    @State private var pinned: Set<SettingKey> = []
    /// True while a scene's defaults are being applied — those writes never pin.
    @State private var applyingScene = false
    // live body parameters the formula panel manipulates (reset per scene).
    @State private var paramStrength: Double = 1
    @State private var paramRange: Double = 240
    @State private var paramSpin: Double = 1

    /// The token whose formula + params the panel shows — the scene's primary force.
    private var primaryToken: String { currentScene.cards.first?.tokens.first ?? "" }

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
                    firstClassMass: firstClassMass,
                    attention: attention,
                    causality: causality,
                    heatmap: heatmap,
                    bodyStrength: Float(paramStrength),
                    bodyRange: Float(paramRange),
                    bodySpin: Float(paramSpin),
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
            applySceneDefaults()
        }
    }

    /// Scene switch: apply the scene's configuration ONLY to settings the user hasn't
    /// pinned — touched settings persist across the sidebar until Reset.
    private func applySceneDefaults() {
        let s = currentScene
        applyingScene = true
        defer { applyingScene = false }
        if !pinned.contains(.formation) { formation = s.formation }
        if !pinned.contains(.matter)    { renderMode = s.render }
        if !pinned.contains(.overlays)  { overlays = Set(s.overlay) }
        if !pinned.contains(.density)   { density = Double(s.density) }
        if !pinned.contains(.waves)     { waves = s.waves }
        if !pinned.contains(.attention) { attention = s.attention }
        if !pinned.contains(.causality) { causality = s.causality }
        if !pinned.contains(.heatmap)   { heatmap = s.heatmap }
        // the formula panel's params always reset to the new scene's primary body —
        // manipulation is scene-local (never pinned), so each force opens at its own values.
        if let c = s.cards.first {
            paramStrength = Double(c.strength)
            paramRange = Double(c.range)
            paramSpin = Double(c.spin)
        }
        // mass has no scene default (no tour scene uses it) — purely user-controlled
    }

    /// Mark a setting user-pinned (no-op while a scene is being applied).
    private func pin(_ key: SettingKey) {
        if !applyingScene { pinned.insert(key) }
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
                                   title: entry.label, subtitle: entry.blurb,
                                   tint: Color(fieldHex: forceColor(entry.token)))
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

    // MARK: caption chip — the scene's claim + narrative (the math moved to the formula panel)

    private var captionChip: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 7) {
                if case .force(let token) = selection {
                    Circle().fill(Color(fieldHex: forceColor(token))).frame(width: 9, height: 9)
                }
                Text(currentScene.name).font(.headline)
            }
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
            Text("click → burst · drag → flow · hover a card → engage · adjust the formula in the inspector ›")
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
            // the token lane, each in its force's identity color — the same hue the
            // cards carrying that token wear
            HStack(spacing: 5) {
                ForEach(r.primitives, id: \.self) { token in
                    Text(token)
                        .font(.caption2.monospaced())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1.5)
                        .background(Color(fieldHex: forceColor(token)).opacity(0.18),
                                    in: Capsule())
                        .foregroundStyle(Color(fieldHex: forceColor(token)))
                }
            }
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

    // MARK: formula panel — the live math + the sliders that drive it

    @ViewBuilder
    private var formulaSection: some View {
        if let formula = ForceFormulas.formula(for: primaryToken) {
            let lines = formula.render(Float(paramStrength), Float(paramRange), Float(paramSpin))
            Section {
                ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(line.math)
                            .font(.system(.callout, design: .monospaced))
                            .foregroundStyle(Color(fieldHex: forceColor(primaryToken)))
                            .textSelection(.enabled)
                        if let note = line.note {
                            Text(note).font(.caption2).foregroundStyle(.tertiary)
                        }
                    }
                    .padding(.vertical, 1)
                }
                ForEach(formula.params, id: \.key.rawValue) { p in
                    paramSlider(p)
                }
            } header: {
                Label(formula.title, systemImage: "function")
            } footer: {
                Text("Live: every number is the body's current value, and the sliders drive the real field — no rebuild.")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    private func paramSlider(_ p: TunableParam) -> some View {
        let binding: Binding<Double> = {
            switch p.key {
            case .strength: return $paramStrength
            case .range:    return $paramRange
            case .spin:     return $paramSpin
            }
        }()
        return VStack(alignment: .leading, spacing: 1) {
            HStack {
                Text("\(p.symbol) · \(p.label)").font(.caption)
                Spacer()
                Text(p.key == .range ? String(format: "%.0f", binding.wrappedValue)
                                     : String(format: "%.2f", binding.wrappedValue))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            Slider(value: binding, in: p.range, step: p.step)
        }
    }

    // MARK: inspector

    private var inspector: some View {
        Form {
            formulaSection

            if !pinned.isEmpty {
                Section {
                    Button {
                        pinned.removeAll()
                        applySceneDefaults()
                    } label: {
                        Label("Reset to scene defaults", systemImage: "arrow.uturn.backward")
                    }
                } footer: {
                    Text("Settings you change stay as you set them across the sidebar; untouched ones follow each scene. \(pinned.count) pinned.")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }

            Section {
                Picker("Formation", selection: $formation) {
                    ForEach(FORMATIONS, id: \.id) { f in
                        Text(f.name).tag(f.id)
                    }
                }
                .onChange(of: formation) { _, _ in pin(.formation) }
                .help(FORMATIONS.first { $0.id == formation }.map { "\($0.name) — \($0.cue)" } ?? "")
                Picker("Matter", selection: $renderMode) {
                    Label("Dots", systemImage: "circle.grid.3x3.fill").tag(RenderMode.dots)
                    Label("Trails", systemImage: "scribble.variable").tag(RenderMode.trails)
                    Label("Links", systemImage: "point.3.connected.trianglepath.dotted").tag(RenderMode.links)
                    Label("Metaballs", systemImage: "drop.fill").tag(RenderMode.metaballs)
                    Label("Voronoi", systemImage: "rectangle.split.3x3").tag(RenderMode.voronoi)
                    Label("Streamlines", systemImage: "water.waves").tag(RenderMode.streamlines)
                }
                .onChange(of: renderMode) { _, _ in pin(.matter) }
                .help("How the same matter is drawn — the simulation underneath is identical in every mode.")
                ColorPicker("Accent", selection: $accent, supportsOpacity: false)
                    .help("The travelling accent color — heat blends matter toward it.")
                LabeledContent("Density") {
                    Slider(value: $density, in: 0.5...5, step: 0.5)
                }
                .onChange(of: density) { _, _ in pin(.density) }
                .help("Particle-count multiplier: the pool is 130 × density, conserved while the field runs.")
                Toggle(isOn: $waves) {
                    Label("Carrier waves", systemImage: "water.waves.slash")
                }
                .onChange(of: waves) { _, _ in pin(.waves) }
                .help("The ambient resting structure (§2.3): five standing currents that carry bound shimmer and exchange matter with the free pool. Canon, but decorative here — off by default.")
            } header: {
                Text("Field")
            } footer: {
                Text("The medium. A formation biases every free particle; matter is how the one simulation is drawn; density is how much of it there is.")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            Section {
                bmiToggle($firstClassMass, .mass, "First-class mass", "scalemass",
                          "a = F/m — heavier matter accelerates less; mass ∝ size")
                bmiToggle($attention, .attention, "Conserved attention", "eye",
                          "one strength budget: engaging a body drains the others, Σ S·mul invariant")
                bmiToggle($causality, .causality, "Cross-boundary causality", "arrow.triangle.branch",
                          "saturated bodies spill density to neighbours — conserved, Σ deltas = 0")
                bmiToggle($heatmap, .heatmap, "Density heatmap", "circle.lefthalf.filled.inverse",
                          "a scalar buffer of where matter pools, drawn as a glow underlay")
            } header: {
                Text("Body Matter Interaction")
            } footer: {
                Text("How bodies and matter exchange — the model's truths, each conserved and measurable. Scenes set their own; your changes pin.")
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

    /// A Body Matter Interaction toggle: title + the conservation law it enacts.
    private func bmiToggle(_ binding: Binding<Bool>, _ key: SettingKey,
                           _ label: String, _ symbol: String, _ meaning: String) -> some View {
        Toggle(isOn: binding) {
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
        .onChange(of: binding.wrappedValue) { _, _ in pin(key) }
    }

    private func readingToggle(_ mode: FieldUICore.OverlayMode, _ label: String,
                               _ symbol: String, _ meaning: String) -> some View {
        Toggle(isOn: Binding(
            get: { overlays.contains(mode) },
            set: { on in
                if on { overlays.insert(mode) } else { overlays.remove(mode) }
                pin(.overlays)
            }
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
    var tint: Color? = nil // the force's identity color — same hue on its cards

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
                .foregroundStyle(tint ?? .secondary)
        }
        .padding(.vertical, 1)
    }
}

extension Color {
    /// A Color from the engine's `#rrggbb` strings (force identities, accents).
    init(fieldHex hex: String) {
        let rgb = hexToRgb(hex)
        self.init(red: Double(rgb.x) / 255, green: Double(rgb.y) / 255, blue: Double(rgb.z) / 255)
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
    let firstClassMass: Bool
    let attention: Bool
    let causality: Bool
    let heatmap: Bool
    let bodyStrength: Float
    let bodyRange: Float
    let bodySpin: Float
    @Binding var stats: LiveStats

    private func configured() -> LabScene {
        var s = scene
        s.density = density
        s.waves = waves
        s.attention = attention
        s.causality = causality
        s.heatmap = heatmap
        return s
    }

    func makeNSView(context: Context) -> FieldCanvasView {
        let v = FieldCanvasView(scene: configured(), firstClassMass: firstClassMass)
        context.coordinator.sceneId = scene.id
        context.coordinator.density = density
        context.coordinator.waves = waves
        context.coordinator.mass = firstClassMass
        context.coordinator.startStats(canvas: v) { stats = $0 }
        return v
    }

    func updateNSView(_ canvas: FieldCanvasView, context: Context) {
        // density / waves / first-class mass are creation-time options (pool size, the
        // wave build, m ∝ size at seeding) — changing them needs a full rebuild. A scene
        // switch alone keeps the SAME running field and pool, swapping only the bodies, so
        // the matter flows continuously across the transition.
        let coord = context.coordinator
        let creationChanged = coord.density != density || coord.waves != waves || coord.mass != firstClassMass
        if creationChanged {
            coord.sceneId = scene.id
            coord.density = density
            coord.waves = waves
            coord.mass = firstClassMass
            canvas.firstClassMass = firstClassMass
            canvas.show(configured())
        } else if coord.sceneId != scene.id {
            coord.sceneId = scene.id
            canvas.swapScene(configured()) // persistent — keep the pool, swap the bodies
        }
        canvas.field?.setFormation(formation)
        canvas.field?.setRender(renderMode)
        canvas.field?.setOverlay(overlays.isEmpty ? .single(.off) : .stack(overlays))
        canvas.field?.setAttention(attention)
        canvas.field?.setCausality(causality)
        canvas.field?.setHeatmap(heatmap)
        // the formula panel's sliders push live body params — the integrator reads them
        // next frame, so the field responds without a rebuild.
        canvas.setBodyParams(strength: bodyStrength, range: bodyRange, spin: bodySpin)
        if let hex = accent.fieldHex {
            canvas.field?.setAccent(hex)
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator {
        var sceneId = ""
        var density: Float = 2
        var waves = false
        var mass = false
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
