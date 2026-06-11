import SwiftUI
import FieldUICore
import FieldUIVanilla

// MARK: - FieldEnvironment

/// Gives child views access to the running field handle.
/// The SwiftUI equivalent of the React context FieldField provides.
private struct FieldHandleKey: EnvironmentKey {
    static let defaultValue: (any FieldHandle)? = nil
}

public extension EnvironmentValues {
    var fieldHandle: (any FieldHandle)? {
        get { self[FieldHandleKey.self] }
        set { self[FieldHandleKey.self] = newValue }
    }
}

// MARK: - FieldView

/// A SwiftUI view that mounts and manages a field.
/// Drop it into any SwiftUI hierarchy — it creates its own render surface,
/// runs the engine, and tears it down automatically.
///
/// The Swift equivalent of `<ForcesField>` in @field-ui/react.
///
/// ```swift
/// ZStack {
///     FieldView(options: .init(accent: "#4da3ff", render: .dots))
///     ContentView()
///         .fieldBody(tokens: ["attract"], range: 120)
/// }
/// ```
public struct FieldView: View {
    private let options: FieldOptions
    private let depth: Float
    @State private var field: FieldField?

    /// `depth` gives the field a shallow z volume (pt) on flat platforms; 0 — the
    /// default — is the flat field. See `FieldField.init(in:options:depth:)`.
    public init(options: FieldOptions = .init(), depth: Float = 0) {
        self.options = options
        self.depth = depth
    }

    public var body: some View {
        FieldRepresentable(options: options, depth: depth, field: $field)
            .ignoresSafeArea()
            .environment(\.fieldHandle, field)
            .accessibilityHidden(true)   // decorative field (§18 a11y)
    }
}

// MARK: - FieldRepresentable

/// The construction-time options — changing any of these rebuilds the engine (the rest are
/// live-settable). `FieldOptions` isn't `Equatable` (it carries a sink closure), so compare by hand.
private struct BuildSignature: Equatable {
    let density: Float?
    let waves: Bool
    let mass: Bool
    let depth: Float
    init(_ o: FieldOptions, _ depth: Float) {
        density = o.density; waves = o.waves; mass = o.firstClassMass; self.depth = depth
    }
}

/// Re-apply the live-settable options onto a running field (idempotent) — so changing `options`
/// on a live `FieldView` actually takes effect, instead of being a no-op after first build.
private func applyLiveOptions(_ f: FieldField, _ o: FieldOptions) {
    if let a = o.accent { f.setAccent(a) }
    if let p = o.palette { f.setPalette(p) }
    f.setRender(o.render)
    f.setOverlay(o.overlay)
    f.setAttention(o.attention)
    f.setCausality(o.causality)
    f.setHeatmap(o.heatmap)
}

/// UIViewRepresentable / NSViewRepresentable bridge that creates the FieldField
/// and manages its lifecycle. Stays internal — callers only see FieldView.
#if canImport(UIKit)
struct FieldRepresentable: UIViewRepresentable {
    let options: FieldOptions
    let depth: Float
    @Binding var field: FieldField?

    /// Owns the engine's lifetime so `dismantleUIView` can tear it down — SwiftUI hands the
    /// coordinator (not the binding) to dismantle, so without it the field leaked on disappear.
    final class Coordinator { var field: FieldField?; fileprivate var build: BuildSignature? }
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> UIView {
        let container = UIView()
        container.backgroundColor = .clear
        return container
    }

    func updateUIView(_ container: UIView, context: Context) {
        let c = context.coordinator
        let sig = BuildSignature(options, depth)
        if let f = c.field {
            if c.build == sig { applyLiveOptions(f, options); return } // live re-apply, no rebuild
            f.destroy(); c.field = nil // a construction-time option changed → rebuild below
        }
        let f = FieldField(in: container, options: options, depth: depth)
        f.scan()
        c.field = f
        c.build = sig
        // publish to the environment binding after this update pass (never mutate during it)
        DispatchQueue.main.async { field = f }
    }

    static func dismantleUIView(_ container: UIView, coordinator: Coordinator) {
        coordinator.field?.destroy()
        coordinator.field = nil
    }
}
#elseif canImport(AppKit)
struct FieldRepresentable: NSViewRepresentable {
    let options: FieldOptions
    let depth: Float
    @Binding var field: FieldField?

    /// Owns the engine's lifetime so `dismantleNSView` can tear it down (the field leaked before —
    /// the AppKit branch had no dismantle at all).
    final class Coordinator { var field: FieldField?; fileprivate var build: BuildSignature? }
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> NSView {
        let container = NSView()
        return container
    }

    func updateNSView(_ container: NSView, context: Context) {
        let c = context.coordinator
        let sig = BuildSignature(options, depth)
        if let f = c.field {
            if c.build == sig { applyLiveOptions(f, options); return }
            f.destroy(); c.field = nil
        }
        let f = FieldField(in: container, options: options, depth: depth)
        f.scan()
        c.field = f
        c.build = sig
        DispatchQueue.main.async { field = f }
    }

    static func dismantleNSView(_ container: NSView, coordinator: Coordinator) {
        coordinator.field?.destroy()
        coordinator.field = nil
    }
}
#else
// visionOS: RealityView-based — field is driven via FieldView's RealityKit integration.
struct FieldRepresentable: View {
    let options: FieldOptions
    let depth: Float
    @Binding var field: FieldField?
    var body: some View { Color.clear }
}
#endif

// MARK: - .fieldBody() modifier

/// Registers a view as a field body — the SwiftUI equivalent of `data-body` in HTML.
///
/// ```swift
/// Text("Hello")
///     .fieldBody(tokens: ["attract", "glow"], strength: 1.2, range: 150)
/// ```
public extension View {
    func fieldBody(
        tokens: [String],
        strength: Float = 1,
        range: Float = 100,
        feedback: Bool = false
    ) -> some View {
        modifier(FieldBodyModifier(tokens: tokens, strength: strength, range: range, feedback: feedback))
    }
}

struct FieldBodyModifier: ViewModifier {
    let tokens: [String]
    let strength: Float
    let range: Float
    let feedback: Bool

    @Environment(\.fieldHandle) private var fieldHandle

    func body(content: Content) -> some View {
        content
            .background(
                FieldBodyAnchor(tokens: tokens, strength: strength, range: range, feedback: feedback)
                    .allowsHitTesting(false)
            )
    }
}

/// A zero-size view that registers itself as a field body using its geometry reader position.
struct FieldBodyAnchor: View {
    let tokens: [String]
    let strength: Float
    let range: Float
    let feedback: Bool

    @Environment(\.fieldHandle) private var handle

    var body: some View {
        GeometryReader { geo in
            Color.clear
                .onAppear {
                    // Register with the running engine — wired once FieldEngine
                    // exposes a registerBody(_ body: Body) entry point.
                    _ = geo.frame(in: .global)
                }
        }
    }
}

// MARK: - Convenience modifiers

public extension View {
    /// Burst the field at the tapped location.
    func fieldBurst(color: String? = nil) -> some View {
        modifier(FieldBurstModifier(color: color))
    }
}

struct FieldBurstModifier: ViewModifier {
    let color: String?
    @Environment(\.fieldHandle) private var handle

    func body(content: Content) -> some View {
        content
            .onTapGesture { location in
                handle?.burst(at: Vec3(Float(location.x), Float(location.y), 0), color: color)
            }
    }
}
