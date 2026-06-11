import Foundation
import simd
import FieldUICore

// MARK: - FieldLab scenes
//
// Each scene is one pillar of the engine made tangible: cards are *bodies* — UI elements
// with mass — and the scene declares what the field does around them. The same specs
// drive the live macOS app (cards become real NSViews) and the headless snapshot
// pipeline (cards become authored bodies), so what you see in a snapshot is exactly
// what the app runs.

/// One card in a scene — a UI element that participates as a field body.
public struct CardSpec {
    public var label: String
    /// Normalized center (0…1 across the canvas).
    public var x: Float
    public var y: Float
    /// Size in points.
    public var w: Float
    public var h: Float
    public var tokens: [String]
    public var strength: Float
    public var range: Float
    public var spin: Float
    /// Heading angle (radians, screen coords — −π/2 points up).
    public var angle: Float
    public var feedback: Bool
    public var engaged: Bool
    public var tint: String?
    public var absorbR: Float
    public var capacity: Float
    public var life: Float?
    /// Index of the warp-paired card, for `warp` throats.
    public var warpPair: Int?

    public init(
        _ label: String, x: Float, y: Float, w: Float = 150, h: Float = 64,
        tokens: [String], strength: Float = 1, range: Float = 240, spin: Float = 1,
        angle: Float = -.pi / 2, feedback: Bool = true, engaged: Bool = false,
        tint: String? = nil, absorbR: Float = 26, capacity: Float = 40,
        life: Float? = nil, warpPair: Int? = nil
    ) {
        self.label = label
        self.x = x; self.y = y; self.w = w; self.h = h
        self.tokens = tokens
        self.strength = strength; self.range = range; self.spin = spin; self.angle = angle
        self.feedback = feedback; self.engaged = engaged; self.tint = tint
        self.absorbR = absorbR; self.capacity = capacity; self.life = life
        self.warpPair = warpPair
    }
}

/// A complete FieldLab scene: cards + field configuration + the story it tells.
public struct LabScene {
    public var id: String
    public var name: String
    /// The one-sentence claim this scene proves.
    public var blurb: String
    public var cards: [CardSpec]
    public var formation: String = "ambient"
    public var render: RenderMode = .dots
    public var overlay: [FieldUICore.OverlayMode] = []
    public var attention = false
    public var causality = false
    public var heatmap = false
    public var waves = true
    public var depth: Float = 0
    public var accent = "#4da3ff"
    public var density: Float = 2

    public init(id: String, name: String, blurb: String, cards: [CardSpec]) {
        self.id = id
        self.name = name
        self.blurb = blurb
        self.cards = cards
    }

    public func options() -> FieldOptions {
        FieldOptions(
            accent: accent,
            density: density,
            waves: waves,
            render: render,
            attention: attention,
            causality: causality,
            heatmap: heatmap,
            overlay: overlay.isEmpty ? .single(.off) : .stack(overlay)
        )
    }

    /// Resolve the cards into authored bodies for a canvas of `width × height` points
    /// (the headless path — the app builds real views from the same specs instead).
    public func makeBodies(width: Float, height: Float) -> [Body] {
        var bodies: [Body] = cards.map { c in
            let b = Body(
                tokens: c.tokens,
                strength: c.strength,
                range: c.range,
                absorbR: c.absorbR,
                capacity: c.capacity,
                spin: c.spin,
                heading: Vec3(cos(c.angle), sin(c.angle), 0),
                feedback: c.feedback,
                box: Box(center: Vec3(c.x * width, c.y * height, 0),
                         halfExtents: Vec3(c.w / 2, c.h / 2, 0)),
                M: 20 + c.strength * 40
            )
            b.isVisible = true
            b.isEngaged = c.engaged
            b.tint = c.tint
            b.life = c.life
            return b
        }
        // resolve warp pairs after all bodies exist
        for (i, c) in cards.enumerated() where c.warpPair != nil {
            if bodies.indices.contains(c.warpPair!) {
                bodies[i].pairBody = bodies[c.warpPair!]
            }
        }
        return bodies
    }
}

// MARK: - The catalog

public enum LabScenes {

    /// Elements have mass: one heavy card outweighs three light ones, and the field shows
    /// the hierarchy — matter pools around weight, and the heavy card charges up (d → glow).
    public static let mass = LabScene(
        id: "mass", name: "Mass",
        blurb: "Importance is physical: the heavy card gathers the field; the light ones barely dent it.",
        cards: [
            CardSpec("Ship the keynote", x: 0.38, y: 0.42, w: 220, h: 84,
                     tokens: ["attract", "gravity"], strength: 1.8, range: 340),
            CardSpec("Reply to Dana", x: 0.74, y: 0.28, w: 150, h: 56,
                     tokens: ["attract"], strength: 0.55, range: 170),
            CardSpec("Book travel", x: 0.72, y: 0.62, w: 150, h: 56,
                     tokens: ["attract"], strength: 0.5, range: 160),
            CardSpec("Water plants", x: 0.18, y: 0.74, w: 150, h: 56,
                     tokens: ["attract"], strength: 0.4, range: 150),
        ]
    )

    /// Real electromagnetism: two opposed magnets polarize passing matter (charge
    /// induction), the Lorentz force curls it, fieldflow threads it down the dipole
    /// lines — drawn live by the field-lines reading.
    public static var magnetism: LabScene {
        var s = LabScene(
            id: "magnetism", name: "Magnetism",
            blurb: "A real Lorentz force: matter polarizes, curls, and threads the dipole lines you can see.",
            cards: [
                CardSpec("N · dipole", x: 0.3, y: 0.5, w: 170, h: 64,
                         tokens: ["magnetism", "fieldflow"], strength: 0.6, range: 320, spin: 1, angle: 0),
                CardSpec("S · dipole", x: 0.7, y: 0.5, w: 170, h: 64,
                         tokens: ["magnetism", "fieldflow"], strength: 0.6, range: 320, spin: -1, angle: .pi),
            ]
        )
        s.overlay = [.fieldLines]
        s.formation = "wells"
        return s
    }

    /// Conserved attention: one finite budget. Engage a card and it physically drains
    /// force from every other — the field cannot emphasise two things at once.
    public static var attention: LabScene {
        var s = LabScene(
            id: "attention", name: "Attention",
            blurb: "One budget: engaging a card strengthens it by exactly what the others lose.",
            cards: [
                CardSpec("Inbox", x: 0.25, y: 0.3, tokens: ["attract"], strength: 1, range: 230),
                CardSpec("Roadmap", x: 0.75, y: 0.3, tokens: ["attract"], strength: 1, range: 230,
                         engaged: true), // the engaged one — hover moves this live in the app
                CardSpec("Metrics", x: 0.25, y: 0.7, tokens: ["attract"], strength: 1, range: 230),
                CardSpec("On-call", x: 0.75, y: 0.7, tokens: ["attract"], strength: 1, range: 230),
            ]
        )
        s.attention = true
        return s
    }

    /// Cross-boundary causality: density spills to neighbours as a conserved transfer —
    /// engage the middle card and the ones beside it light up because matter actually flows.
    public static var causality: LabScene {
        var s = LabScene(
            id: "causality", name: "Causality",
            blurb: "Saturate one card and its neighbours light up — the wiring is matter, not markup.",
            cards: [
                CardSpec("Design", x: 0.22, y: 0.5, tokens: ["attract"], strength: 0.9, range: 220),
                CardSpec("Build", x: 0.5, y: 0.5, tokens: ["attract"], strength: 1.4, range: 260,
                         engaged: true),
                CardSpec("Release", x: 0.78, y: 0.5, tokens: ["attract"], strength: 0.9, range: 220),
            ]
        )
        s.causality = true
        s.formation = "wells"
        return s
    }

    /// The optional third axis: a 420pt-deep volume. Matter drifts behind the surface
    /// (receding as it goes), the well pulls it back to the page plane.
    public static var volume: LabScene {
        var s = LabScene(
            id: "volume", name: "Volume",
            blurb: "The field has depth: matter recedes into a 420pt volume and the page plane pulls it home.",
            cards: [
                CardSpec("Surface", x: 0.5, y: 0.5, w: 190, h: 72,
                         tokens: ["attract", "gravity"], strength: 1.4, range: 380),
            ]
        )
        s.depth = 420
        s.formation = "scatter"
        s.density = 3
        return s
    }

    /// Sources and sinks: a fountain creates budgeted mortal matter; a sink across the
    /// canvas captures it, saturates, and supernovas it back — conservation with drama.
    public static var sourceSink: LabScene {
        var s = LabScene(
            id: "source-sink", name: "Source & Sink",
            blurb: "A budgeted fountain feeds a sink that saturates and supernovas — creation, capture, release.",
            cards: [
                CardSpec("Emitter", x: 0.25, y: 0.68, w: 150, h: 60,
                         tokens: ["spawn"], strength: 1.6, range: 200,
                         angle: -.pi / 3, engaged: true, life: 140),
                CardSpec("Collector", x: 0.72, y: 0.35, w: 170, h: 66,
                         tokens: ["sink", "attract"], strength: 1.2, range: 300,
                         absorbR: 34, capacity: 60),
            ]
        )
        s.formation = "lanes"
        return s
    }

    /// Warp throats: matter entering one card emerges from its pair, momentum carried
    /// through — conserved relocation between two pieces of UI.
    public static var warp: LabScene {
        var s = LabScene(
            id: "warp", name: "Warp",
            blurb: "Two cards, one wormhole: matter that enters here exits there, momentum intact.",
            cards: [
                CardSpec("Here", x: 0.27, y: 0.5, w: 150, h: 64,
                         tokens: ["warp", "attract"], strength: 1.0, range: 260,
                         absorbR: 40, warpPair: 1),
                CardSpec("There", x: 0.73, y: 0.5, w: 150, h: 64,
                         tokens: ["warp", "attract"], strength: 1.0, range: 260,
                         absorbR: 40, warpPair: 0),
            ]
        )
        s.formation = "wells"
        s.render = .trails
        return s
    }

    /// A thermodynamic storm: a hot card agitates (Langevin), the medium collides
    /// elastically, a cold card freezes passing matter onto its lattice — phase change
    /// as UI state, read by the temperature contours.
    public static var storm: LabScene {
        var s = LabScene(
            id: "storm", name: "Storm",
            blurb: "A hot card boils the medium, a cold one crystallizes it — temperature is a real scalar here.",
            cards: [
                CardSpec("Hot path", x: 0.3, y: 0.42, w: 170, h: 66,
                         tokens: ["thermal", "collide"], strength: 1.1, range: 300, engaged: true),
                CardSpec("Cold store", x: 0.72, y: 0.6, w: 170, h: 66,
                         tokens: ["crystallize", "attract"], strength: 0.8, range: 260),
            ]
        )
        s.overlay = [.temperature]
        s.formation = "scatter"
        return s
    }

    /// The canon, runnable: any of the locked 64 recipes compiled into live bodies.
    public static func recipe(_ id: String, width: Float = 1, height: Float = 1) -> LabScene? {
        guard let r = FieldRecipes.recipe(id: id) else { return nil }
        let compiled = compileRecipe(r)
        // lay the recipe's bodies out on a ring around the canvas centre
        let n = compiled.bodies.count
        var cards: [CardSpec] = []
        for (i, reg) in compiled.bodies.enumerated() {
            let a = Float(i) / Float(max(n, 1)) * 2 * .pi - .pi / 2
            let cx = 0.5 + (n > 1 ? cos(a) * 0.22 : 0)
            let cy = 0.5 + (n > 1 ? sin(a) * 0.22 : 0)
            cards.append(CardSpec(
                reg.tokens.joined(separator: " "),
                x: cx, y: cy, w: 160, h: 60,
                tokens: reg.tokens,
                strength: reg.strength,
                range: reg.range,
                spin: reg.spin,
                feedback: reg.feedback
            ))
        }
        var s = LabScene(
            id: "recipe-\(r.id)", name: r.name,
            blurb: r.intent,
            cards: cards
        )
        if r.render.contains("trails") { s.render = .trails }
        else if r.render.contains("links") { s.render = .links }
        return s
    }

    /// The curated tour, in narrative order.
    public static let tour: [LabScene] = [
        mass, magnetism, attention, causality, volume, sourceSink, warp, storm,
    ]
}
