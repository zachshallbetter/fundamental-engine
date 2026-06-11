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
    private let readoutField = NSTextField(labelWithString: "")
    private var tracking: NSTrackingArea?
    private let pinnedEngaged: Bool
    private let isSink: Bool

    /// The card's identity color — its primary force token's canon/lab color. Every
    /// surface that names this force (sidebar, chip, this card) shares it.
    private let identity: NSColor
    private let identityRGB: RGB

    // feedback sublayers
    private let stripe = CALayer()      // identity stripe (left edge)
    private let loadFill = CALayer()    // sink accretion rising from the bottom
    private let meter = CALayer()       // the d meter track
    private let meterFill = CALayer()   // the d meter fill — literally --d

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
        self.isSink = spec.tokens.contains("sink")
        self.fieldBody = body
        let rgb = hexToRgb(cardColor(tokens: spec.tokens))
        self.identityRGB = rgb
        self.identity = NSColor(calibratedRed: CGFloat(rgb.x / 255), green: CGFloat(rgb.y / 255),
                                blue: CGFloat(rgb.z / 255), alpha: 1)
        super.init(frame: .zero)
        body.view = self

        wantsLayer = true
        layer?.cornerRadius = 12
        layer?.cornerCurve = .continuous // the Apple squircle, not a plain round-rect
        layer?.borderWidth = 1
        layer?.backgroundColor = NSColor(calibratedWhite: 0.09, alpha: 0.92).cgColor
        layer?.borderColor = identity.withAlphaComponent(0.22).cgColor
        layer?.shadowColor = identity.cgColor // the glow is the force's own color
        layer?.shadowOffset = .zero
        layer?.shadowRadius = 18
        layer?.shadowOpacity = 0
        layer?.masksToBounds = false

        // identity stripe — the force's color as a constant mark on the element
        stripe.backgroundColor = identity.withAlphaComponent(0.85).cgColor
        stripe.cornerRadius = 1.5
        // sink load — the capture ledger rising behind the content
        loadFill.backgroundColor = identity.withAlphaComponent(0.16).cgColor
        loadFill.cornerRadius = 12
        loadFill.cornerCurve = .continuous
        // the d meter — the --d measurement, drawn as data
        meter.backgroundColor = NSColor(calibratedWhite: 1, alpha: 0.08).cgColor
        meter.cornerRadius = 1.5
        meterFill.backgroundColor = identity.cgColor
        meterFill.cornerRadius = 1.5
        for l in [loadFill, stripe, meter, meterFill] {
            l.actions = ["bounds": NSNull(), "position": NSNull(), "backgroundColor": NSNull(), "opacity": NSNull()]
            layer?.addSublayer(l)
        }

        titleField.stringValue = spec.label
        titleField.font = .preferredFont(forTextStyle: .headline)
        titleField.textColor = .labelColor
        tokenField.stringValue = spec.tokens.joined(separator: " · ")
        tokenField.font = .monospacedSystemFont(ofSize: NSFont.preferredFont(forTextStyle: .caption2).pointSize, weight: .regular)
        tokenField.textColor = identity.withAlphaComponent(0.75)
        readoutField.stringValue = isSink ? "load 0%" : "d 0.00"
        readoutField.font = .monospacedSystemFont(ofSize: 9, weight: .medium)
        readoutField.textColor = .tertiaryLabelColor
        readoutField.alignment = .right
        for f in [titleField, tokenField, readoutField] {
            f.translatesAutoresizingMaskIntoConstraints = false
            addSubview(f)
        }
        NSLayoutConstraint.activate([
            titleField.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            titleField.topAnchor.constraint(equalTo: topAnchor, constant: 11),
            tokenField.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            tokenField.topAnchor.constraint(equalTo: titleField.bottomAnchor, constant: 2),
            readoutField.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            readoutField.topAnchor.constraint(equalTo: topAnchor, constant: 12),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override var isFlipped: Bool { true }

    override func layout() {
        super.layout()
        stripe.frame = CGRect(x: 6, y: 10, width: 3, height: bounds.height - 20)
        meter.frame = CGRect(x: 16, y: bounds.height - 10, width: bounds.width - 32, height: 3)
        // fills update in apply(); keep their tracks in place on resize
        meterFill.frame = CGRect(x: 16, y: bounds.height - 10, width: meterFill.frame.width, height: 3)
    }

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

    /// The reciprocal write-back: the field's per-frame channels become appearance, each
    /// channel to its own honest surface —
    ///   d (gathered density)      → the meter fill + the glow, in the force's color
    ///   load (sink accretion)     → a fill rising through the card
    ///   lit (causality spill)     → border + title brightness
    ///   temperature (measured)    → the background warms
    ///   engaged                   → the ring sharpens
    /// Nothing here is decoration: every change is one of the engine's numbers.
    func apply(_ ch: FeedbackChannels) {
        let d = CGFloat(ch.density ?? 0)
        let lit = CGFloat(ch.lit ?? ch.density ?? 0)
        let load = CGFloat(ch.load ?? 0)
        let temp = CGFloat(ch.temperature ?? 0)
        let engaged = fieldBody.isEngaged

        CATransaction.begin()
        CATransaction.setDisableActions(true)

        // glow: gathered density, in the force's own color
        layer?.shadowOpacity = Float(min(0.85, d * 0.8 + lit * 0.25))
        // ring: spill brightness + engagement sharpness
        layer?.borderWidth = engaged ? 1.5 : 1
        layer?.borderColor = identity.withAlphaComponent(0.22 + lit * 0.55 + (engaged ? 0.15 : 0)).cgColor
        // background: warms with measured temperature, deepens with density
        layer?.backgroundColor = NSColor(
            calibratedRed: 0.06 + d * 0.03 + temp * 0.10,
            green: 0.07 + d * 0.05 + temp * 0.03,
            blue: 0.10 + d * 0.09 - temp * 0.02,
            alpha: 0.92
        ).cgColor
        // the meter IS --d (or the sink's load — its more telling number)
        let meterValue = isSink ? load : d
        let trackWidth = max(bounds.width - 32, 0)
        meterFill.frame = CGRect(x: 16, y: bounds.height - 10,
                                 width: trackWidth * min(meterValue, 1), height: 3)
        // sink accretion: the capture ledger rising through the card
        if isSink {
            let h = bounds.height * min(load, 1)
            loadFill.frame = CGRect(x: 0, y: bounds.height - h, width: bounds.width, height: h)
        }
        CATransaction.commit()

        // the numeric readout — the measurement, printed (cheap: only on visible change)
        let label = isSink ? "load \(Int(load * 100))%" : String(format: "d %.2f", d)
        if readoutField.stringValue != label {
            readoutField.stringValue = label
            readoutField.textColor = identity.withAlphaComponent(0.5 + meterValue * 0.5)
        }
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
    /// First-class mass (§21.3) — a creation-time truth; the representable rebuilds on change.
    var firstClassMass = false

    /// Effective main-thread frame time (EMA of display-tick gaps) — the number the
    /// inspector's Live panel shows. Gaps above ~16.7ms are dropped frames.
    private(set) var lastFrameMs: Double = 0
    private var statsLink: CADisplayLink?
    private var lastTick: CFTimeInterval = 0

    init(scene: LabScene, firstClassMass: Bool = false) {
        self.scene = scene
        self.firstClassMass = firstClassMass
        super.init(frame: .zero)
        wantsLayer = true
        layer?.backgroundColor = NSColor(calibratedRed: 0.043, green: 0.055, blue: 0.078, alpha: 1).cgColor
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        statsLink?.invalidate()
        guard window != nil else { return }
        let link = displayLink(target: self, selector: #selector(statsTick(_:)))
        link.add(to: .main, forMode: .common)
        statsLink = link
    }

    @objc private func statsTick(_ link: CADisplayLink) {
        if lastTick > 0 {
            let gap = (link.timestamp - lastTick) * 1000
            lastFrameMs = lastFrameMs == 0 ? gap : lastFrameMs * 0.9 + gap * 0.1
        }
        lastTick = link.timestamp
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
        options.firstClassMass = firstClassMass // a = F/m once mass ∝ size (§21.3)
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
        statsLink?.invalidate()
        field?.destroy()
    }
}
#endif
