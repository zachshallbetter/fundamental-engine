#if os(macOS)
import SwiftUI
import FieldUICore
import FieldUIVanilla
import FieldLabKit

// MARK: - FieldLab
//
// The field-ui engine, native: every scene is one pillar of the model running live —
// cards with mass, a conserved attention budget, causality that flows as matter,
// a field with depth, sources and sinks, wormholes, thermodynamics, and the locked
// 64-recipe canon. Hover cards to engage them; click to burst; drag to lead the flow.

@main
struct FieldLabApp: App {
    var body: some SwiftUI.Scene {
        WindowGroup("FieldLab") {
            LabRootView()
                .frame(minWidth: 1100, minHeight: 700)
        }
        .windowStyle(.automatic)
    }
}

// MARK: - Root

struct LabRootView: View {
    @State private var selection: String = LabScenes.tour[0].id
    @State private var formation: String = "ambient"
    @State private var renderMode: RenderMode = .dots
    @State private var overlays: Set<FieldUICore.OverlayMode> = []

    private var currentScene: LabScene {
        if selection.hasPrefix("recipe-") {
            let id = String(selection.dropFirst("recipe-".count))
            if let s = LabScenes.recipe(id) { return s }
        }
        return LabScenes.tour.first { $0.id == selection } ?? LabScenes.mass
    }

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Section("The tour") {
                    ForEach(LabScenes.tour, id: \.id) { scene in
                        Text(scene.name).tag(scene.id)
                    }
                }
                Section("The canon — 64 recipes") {
                    ForEach(FieldRecipes.all, id: \.id) { r in
                        Text(r.name).tag("recipe-\(r.id)")
                    }
                }
            }
            .navigationSplitViewColumnWidth(min: 200, ideal: 230)
        } detail: {
            VStack(spacing: 0) {
                FieldCanvasRepresentable(
                    scene: currentScene,
                    formation: formation,
                    renderMode: renderMode,
                    overlays: Array(overlays)
                )
                controls
            }
            .background(Color(red: 0.043, green: 0.055, blue: 0.078))
            .navigationTitle("FieldLab — \(currentScene.name)")
            .navigationSubtitle(currentScene.blurb)
        }
        .onChange(of: selection) { _, _ in
            // a new scene resets the live controls to the scene's own configuration
            formation = currentScene.formation
            renderMode = currentScene.render
            overlays = Set(currentScene.overlay)
        }
    }

    private var controls: some View {
        HStack(spacing: 18) {
            Picker("Formation", selection: $formation) {
                ForEach(FORMATIONS, id: \.id) { f in
                    Text(f.name).tag(f.id)
                }
            }
            .frame(width: 190)

            Picker("Matter", selection: $renderMode) {
                Text("Dots").tag(RenderMode.dots)
                Text("Trails").tag(RenderMode.trails)
                Text("Links").tag(RenderMode.links)
                Text("Metaballs").tag(RenderMode.metaballs)
                Text("Voronoi").tag(RenderMode.voronoi)
                Text("Streamlines").tag(RenderMode.streamlines)
            }
            .frame(width: 190)

            HStack(spacing: 10) {
                Text("Readings").font(.caption).foregroundStyle(.secondary)
                overlayToggle(.streamlines, "Flow")
                overlayToggle(.fieldLines, "Lines")
                overlayToggle(.grid, "Grid")
                overlayToggle(.temperature, "Heat")
                overlayToggle(.path, "Paths")
            }

            Spacer()
            Text("click → burst · drag → flow · hover a card → engage")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.black.opacity(0.35))
    }

    private func overlayToggle(_ mode: FieldUICore.OverlayMode, _ label: String) -> some View {
        Toggle(label, isOn: Binding(
            get: { overlays.contains(mode) },
            set: { on in
                if on { overlays.insert(mode) } else { overlays.remove(mode) }
            }
        ))
        .toggleStyle(.button)
        .controlSize(.small)
    }
}

// MARK: - The canvas bridge

struct FieldCanvasRepresentable: NSViewRepresentable {
    let scene: LabScene
    let formation: String
    let renderMode: RenderMode
    let overlays: [FieldUICore.OverlayMode]

    func makeNSView(context: Context) -> FieldCanvasView {
        let v = FieldCanvasView(scene: scene)
        context.coordinator.sceneId = scene.id
        return v
    }

    func updateNSView(_ canvas: FieldCanvasView, context: Context) {
        if context.coordinator.sceneId != scene.id {
            context.coordinator.sceneId = scene.id
            canvas.show(scene)
        }
        canvas.field?.setFormation(formation)
        canvas.field?.setRender(renderMode)
        canvas.field?.setOverlay(overlays.isEmpty ? .single(.off) : .stack(overlays))
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator {
        var sceneId: String = ""
    }
}
#endif
