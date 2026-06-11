#if os(macOS)
import AppKit
import simd
import FieldUICore
import FieldUIVanilla
import FieldLabKit

// MARK: - BodyCardView
//
// A real piece of UI that is also a field body: it exerts the forces its tokens declare,
// and the field writes back — the card glows with its gathered density (`d`), brightens
// when neighbours spill light into it (`lit`), and fills as it accretes (`load`).
// Hovering engages it, exactly like hover/focus engages a DOM body.

final class BodyCardView: NSView, NSFieldBodyProvider {
    let fieldBody: Body
    private let titleField = NSTextField(labelWithString: "")
    private let tokenField = NSTextField(labelWithString: "")
    private var tracking: NSTrackingArea?
    private let pinnedEngaged: Bool

    init(spec: CardSpec) {
        let body = Body(
            tokens: spec.tokens,
            strength: spec.strength,
            range: spec.range,
            absorbR: spec.absorbR,
            capacity: spec.capacity,
            spin: spec.spin,
            heading: Vec3(cos(spec.angle), sin(spec.angle), 0),
            feedback: spec.feedback
        )
        body.tint = spec.tint
        body.life = spec.life
        body.isEngaged = spec.engaged
        self.pinnedEngaged = spec.engaged
        self.fieldBody = body
        super.init(frame: .zero)
        body.view = self

        wantsLayer = true
        layer?.cornerRadius = 12
        layer?.borderWidth = 1
        layer?.backgroundColor = NSColor(calibratedWhite: 0.09, alpha: 0.92).cgColor
        layer?.borderColor = NSColor(calibratedWhite: 1, alpha: 0.14).cgColor
        layer?.shadowColor = NSColor(calibratedRed: 0.3, green: 0.64, blue: 1, alpha: 1).cgColor
        layer?.shadowOffset = .zero
        layer?.shadowRadius = 18
        layer?.shadowOpacity = 0

        titleField.stringValue = spec.label
        titleField.font = .systemFont(ofSize: 13, weight: .semibold)
        titleField.textColor = .white
        tokenField.stringValue = spec.tokens.joined(separator: " · ")
        tokenField.font = .monospacedSystemFont(ofSize: 9, weight: .regular)
        tokenField.textColor = NSColor(calibratedWhite: 1, alpha: 0.45)
        for f in [titleField, tokenField] {
            f.translatesAutoresizingMaskIntoConstraints = false
            addSubview(f)
        }
        NSLayoutConstraint.activate([
            titleField.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            titleField.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            tokenField.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            tokenField.topAnchor.constraint(equalTo: titleField.bottomAnchor, constant: 3),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override var isFlipped: Bool { true }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let tracking { removeTrackingArea(tracking) }
        let t = NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeInKeyWindow],
                               owner: self, userInfo: nil)
        addTrackingArea(t)
        tracking = t
    }

    override func mouseEntered(with event: NSEvent) {
        fieldBody.isEngaged = true
    }

    override func mouseExited(with event: NSEvent) {
        fieldBody.isEngaged = pinnedEngaged // pinned cards stay engaged (sources, demos)
    }

    /// The reciprocal write-back: the field's per-frame channels become appearance.
    func apply(_ ch: FeedbackChannels) {
        let d = CGFloat(ch.density ?? 0)
        let lit = CGFloat(ch.lit ?? ch.density ?? 0)
        let load = CGFloat(ch.load ?? 0)
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        layer?.shadowOpacity = Float(min(0.9, lit * 0.9))
        layer?.borderColor = NSColor(
            calibratedRed: 0.3 + lit * 0.4, green: 0.42 + lit * 0.35, blue: 0.65 + lit * 0.35,
            alpha: 0.25 + lit * 0.6
        ).cgColor
        layer?.backgroundColor = NSColor(
            calibratedRed: 0.06 + d * 0.05 + load * 0.08,
            green: 0.07 + d * 0.07,
            blue: 0.1 + d * 0.12,
            alpha: 0.92
        ).cgColor
        CATransaction.commit()
    }
}

// MARK: - FieldCanvasView
//
// The lab bench: hosts the card views, runs the field behind them, and forwards
// pointer gestures — click = burst, drag = flow focus, hover = engage.

final class FieldCanvasView: NSView {
    private(set) var field: FieldField?
    private var cards: [BodyCardView] = []
    private var scene: LabScene
    private var built = false

    init(scene: LabScene) {
        self.scene = scene
        super.init(frame: .zero)
        wantsLayer = true
        layer?.backgroundColor = NSColor(calibratedRed: 0.043, green: 0.055, blue: 0.078, alpha: 1).cgColor
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override var isFlipped: Bool { true } // engine coords: origin top-left, y down

    // MARK: scene lifecycle

    func show(_ newScene: LabScene) {
        scene = newScene
        rebuild()
    }

    override func layout() {
        super.layout()
        positionCards()
        if !built && bounds.width > 10 && bounds.height > 10 {
            built = true
            rebuild()
        }
    }

    private func positionCards() {
        let w = Float(bounds.width)
        let h = Float(bounds.height)
        for (card, spec) in zip(cards, scene.cards) {
            card.frame = CGRect(
                x: CGFloat(spec.x * w - spec.w / 2),
                y: CGFloat(spec.y * h - spec.h / 2),
                width: CGFloat(spec.w),
                height: CGFloat(spec.h)
            )
        }
    }

    private func rebuild() {
        field?.destroy()
        field = nil
        cards.forEach { $0.removeFromSuperview() }
        cards = scene.cards.map(BodyCardView.init(spec:))
        cards.forEach(addSubview)
        positionCards()

        var options = scene.options()
        options.feedbackSink = { view, channels in
            (view as? BodyCardView)?.apply(channels)
        }
        let f = FieldField(in: self, options: options, depth: scene.depth)
        f.scan()
        f.setFormation(scene.formation)
        field = f
        // cards must sit above the render surface
        cards.forEach { $0.layer?.zPosition = 10 }
    }

    // MARK: gestures

    override func mouseDown(with event: NSEvent) {
        let p = convert(event.locationInWindow, from: nil)
        field?.burst(at: p)
    }

    override func mouseDragged(with event: NSEvent) {
        let p = convert(event.locationInWindow, from: nil)
        field?.flowTo(p)
    }

    override func mouseUp(with event: NSEvent) {
        field?.clearFlow()
    }

    deinit {
        field?.destroy()
    }
}
#endif
