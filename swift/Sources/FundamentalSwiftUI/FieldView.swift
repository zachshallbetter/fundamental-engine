import SwiftUI
import FundamentalCore
import FundamentalVanilla

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

// MARK: - Field coordinate space

/// The frame of reference a `FieldView` shares with the `.fieldBody()` nodes inside it.
public enum FundamentalField {
    /// The named coordinate space a `FieldView` establishes for its content. `.fieldBody()` reports each
    /// view's frame in this space, so a body's force well sits exactly under its view. A `FieldView`
    /// with a content closure sets it automatically — you only need the name to relate frames yourself.
    public static let coordinateSpace = "fundamental-engine.field"
}

// MARK: - FieldCenter preference key
//
// Lets child views report their position as the circular wave center directly to
// the enclosing FieldView — avoiding the one-frame race that exists when relying
// on "star"/"vortex" body auto-detection (fieldBody's background GeometryReader
// fires after layout, so the engine may tick before the body is registered).
//
// Usage — in any view inside a FieldView content closure:
//   Color.clear
//       .frame(width: 1, height: 1)
//       .background(GeometryReader { geo in
//           Color.clear.preference(
//               key: FieldCenterPreferenceKey.self,
//               value: geo.frame(in: .named(FundamentalField.coordinateSpace)).center
//           )
//       })
//
// The FieldView collects this preference, converts it to WaveCenter.coordinate,
// and calls setWaveCenter on the running engine immediately — no extra @State or
// computed FieldOptions needed in the caller.
public struct FieldCenterPreferenceKey: PreferenceKey {
    public static let defaultValue: CGPoint? = nil
    public static func reduce(value: inout CGPoint?, nextValue: () -> CGPoint?) {
        value = nextValue() ?? value
    }
}

// MARK: - FieldView

/// A SwiftUI view that mounts and manages a field, and — with a content closure — scopes that field to
/// its children so they can become bodies with `.fieldBody(...)`. It creates its own render surface,
/// runs the engine, and tears it down automatically. The Swift equivalent of `<FieldField>` in
/// @fundamental-engine/react.
///
/// ```swift
/// // Background + powered nodes: wrap content, and `.fieldBody()` inside couples to this field.
/// FieldView(options: .init(accent: "#4da3ff", render: .dots)) {
///     LearnView()
///         .fieldBody(tokens: ["attract", "glow"], range: 120)
/// }
///
/// // Pure decorative background (no body coupling): omit the content closure.
/// FieldView(options: .init(render: .dots))
/// ```
public struct FieldView<Content: View>: View {
    private let options: FieldOptions
    private let depth: Float
    @ViewBuilder private let content: () -> Content
    @State private var field: FieldField?

    /// `depth` gives the field a shallow z volume (pt) on flat platforms; 0 — the default — is the flat
    /// field. The `content` becomes the field's body scope: any `.fieldBody(...)` inside couples to it.
    public init(options: FieldOptions = .init(), depth: Float = 0,
                @ViewBuilder content: @escaping () -> Content) {
        self.options = options
        self.depth = depth
        self.content = content
    }

    public var body: some View {
        ZStack {
            FieldRepresentable(options: options, depth: depth, field: $field)
                .ignoresSafeArea()
                .accessibilityHidden(true)   // the field itself is decorative (§18 a11y); content is not
            content()
        }
        // hand the running field + a shared frame of reference down to every `.fieldBody()` inside.
        .environment(\.fieldHandle, field)
        .coordinateSpace(.named(FundamentalField.coordinateSpace))
        // FieldCenterPreferenceKey: child views may report a CGPoint in the field
        // coordinate space; we forward it to setWaveCenter immediately so the engine
        // centers circular wave currents on that point without a @State or timing race.
        .onPreferenceChange(FieldCenterPreferenceKey.self) { pt in
            guard let pt, let f = field else { return }
            f.setWaveCenter(.coordinate(Vec3(Float(pt.x), Float(pt.y), 0)))
        }
    }
}

/// Background-only field — no body coupling, so no content closure needed (the original `FieldView()`).
public extension FieldView where Content == EmptyView {
    init(options: FieldOptions = .init(), depth: Float = 0) {
        self.init(options: options, depth: depth) { EmptyView() }
    }
}

// MARK: - FieldRepresentable

/// The construction-time options — changing any of these rebuilds the engine (the rest are
/// live-settable). `FieldOptions` isn't `Equatable` (it carries a sink closure), so compare by hand.
private struct BuildSignature: Equatable {
    let density: Float?
    let waves: Bool
    let waveStyle: WaveStyle
    let mass: Bool
    let depth: Float
    let particleSize: Float
    let particleGlow: Float
    init(_ o: FieldOptions, _ depth: Float) {
        density = o.density; waves = o.waves; waveStyle = o.waveStyle; mass = o.firstClassMass
        self.depth = depth; particleSize = o.particleSize; particleGlow = o.particleGlow
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
    f.setWaveStyle(o.waveStyle)
    f.setWaveCenter(o.waveCenter)
    f.setSeparation(o.separation)
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

/// Registers a view as a field body — the SwiftUI equivalent of `data-body` in HTML. Use inside a
/// `FieldView { … }` content closure, which scopes the field + coordinate space. The body is a real
/// programmatic engine body (`addBody`); its force well tracks this view's frame live and is removed
/// when the view disappears.
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
        feedback: Bool = false,
        onFeedback: ((FeedbackChannels) -> Void)? = nil
    ) -> some View {
        modifier(FieldBodyModifier(
            tokens: tokens,
            strength: strength,
            range: range,
            feedback: feedback,
            onFeedback: onFeedback
        ))
    }
}

struct FieldBodyModifier: ViewModifier {
    let tokens: [String]
    let strength: Float
    let range: Float
    let feedback: Bool
    let onFeedback: ((FeedbackChannels) -> Void)?

    func body(content: Content) -> some View {
        content
            .background(
                FieldBodyAnchor(
                    tokens: tokens,
                    strength: strength,
                    range: range,
                    feedback: feedback,
                    onFeedback: onFeedback
                )
                .allowsHitTesting(false)
            )
    }
}

/// Reports the view's frame (in the field's coordinate space) and registers a programmatic body with
/// the running engine via `addBody`, keeping the body's position synced to the view, and removing it on
/// disappear. The frame travels through a preference so registration happens once the geometry is known.
struct FieldBodyAnchor: View {
    let tokens: [String]
    let strength: Float
    let range: Float
    let feedback: Bool
    let onFeedback: ((FeedbackChannels) -> Void)?

    @Environment(\.fieldHandle) private var handle
    @State private var registration = FieldBodyRegistration()

    var body: some View {
        Color.clear
            .background(GeometryReader { geo in
                Color.clear.preference(
                    key: FieldBodyFrameKey.self,
                    value: geo.frame(in: .named(FundamentalField.coordinateSpace))
                )
            })
            .onPreferenceChange(FieldBodyFrameKey.self) { frame in
                registration.sync(
                    field: handle,
                    tokens: tokens,
                    strength: strength,
                    range: range,
                    onFeedback: onFeedback,
                    frame: frame
                )
            }
            .onChange(of: strength) { registration.update(strength: strength, range: range) }
            .onChange(of: range) { registration.update(strength: strength, range: range) }
            .onDisappear { registration.remove() }
    }
}

private struct FieldBodyFrameKey: PreferenceKey {
    static let defaultValue: CGRect = .zero
    static func reduce(value: inout CGRect, nextValue: () -> CGRect) { value = nextValue() }
}

/// Owns a programmatic body's lifetime: the `BodyHandle` from `addBody` + the latest frame the engine's
/// `rect()` closure samples every tick. A reference type so that closure sees live position updates.
/// Main-thread confined — the engine ticks on the host's display link, the same run loop as SwiftUI.
final class FieldBodyRegistration {
    private var handle: BodyHandle?
    private var box = Box(center: .zero, halfExtents: .zero)

    /// A frame in the field's coordinate space (points) → an engine `Box` (centre + half-extents). The
    /// SwiftUI mirror of the host's `worldBox(of:)`. Pure + testable.
    static func box(from frame: CGRect) -> Box {
        Box(center: Vec3(Float(frame.midX), Float(frame.midY), 0),
            halfExtents: Vec3(Float(frame.width / 2), Float(frame.height / 2), 0))
    }

    /// Register on the first known frame, then track the view's position on every change.
    func sync(
        field: (any FieldHandle)?,
        tokens: [String],
        strength: Float,
        range: Float,
        onFeedback: ((FeedbackChannels) -> Void)? = nil,
        frame: CGRect
    ) {
        box = Self.box(from: frame)
        guard handle == nil, let field, !tokens.isEmpty else { return }
        handle = field.addBody(BodySpec(
            tokens: tokens, strength: strength, range: range,
            rect: { [weak self] in self?.box ?? Box(center: .zero, halfExtents: .zero) },
            onFeedback: onFeedback
        ))
    }

    func update(strength: Float, range: Float) { handle?.set(strength: strength, range: range) }
    func remove() { handle?.remove(); handle = nil }

    var isRegistered: Bool { handle != nil }
    var currentBox: Box { box }
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
