import Foundation
import simd
import FieldUICore

// MARK: - The force catalog
//
// Every registered force as a browsable, runnable scene. Forces that are inert alone
// get their honest minimum pairing (fieldflow needs a field to follow; screen needs a
// neighbour to quiet; warp needs its pair) — the blurb says so, because the pairing IS
// the lesson.

public struct ForceEntry: Identifiable {
    public var id: String { token }
    public let token: String
    public let label: String
    public let group: String
    public let blurb: String
    public let scene: LabScene
}

public enum ForceCatalog {

    public static let groups = ["Canonical", "Natural", "Extended"]

    public static let all: [ForceEntry] = canonical + natural + extended

    public static func entries(group: String) -> [ForceEntry] {
        all.filter { $0.group == group }
    }

    public static func entry(token: String) -> ForceEntry? {
        all.first { $0.token == token }
    }

    // MARK: scene builders

    /// One centred card carrying `tokens` — the minimum stage for a self-sufficient force.
    private static func solo(
        _ token: String, label: String, group: String, blurb: String,
        tokens: [String]? = nil, strength: Float = 1.2, range: Float = 300,
        spin: Float = 1, angle: Float = -.pi / 2, engaged: Bool = false,
        formation: String = "ambient", render: RenderMode = .dots,
        overlay: [FieldUICore.OverlayMode] = [], density: Float = 2.5
    ) -> ForceEntry {
        var s = LabScene(
            id: "force-\(token)", name: label, blurb: blurb,
            cards: [CardSpec(label, x: 0.5, y: 0.5, w: 180, h: 70,
                             tokens: tokens ?? [token], strength: strength, range: range,
                             spin: spin, angle: angle, engaged: engaged)]
        )
        s.formation = formation
        s.render = render
        s.overlay = overlay
        s.density = density
        return ForceEntry(token: token, label: label, group: group, blurb: blurb, scene: s)
    }

    /// Two cards — for cross-body forces (screen, warp) and contrast demos.
    private static func pair(
        _ token: String, label: String, group: String, blurb: String,
        left: CardSpec, right: CardSpec,
        formation: String = "ambient", render: RenderMode = .dots,
        overlay: [FieldUICore.OverlayMode] = []
    ) -> ForceEntry {
        var s = LabScene(id: "force-\(token)", name: label, blurb: blurb, cards: [left, right])
        s.formation = formation
        s.render = render
        s.overlay = overlay
        s.density = 2.5
        return ForceEntry(token: token, label: label, group: group, blurb: blurb, scene: s)
    }

    // MARK: canonical nine (§6)

    static let canonical: [ForceEntry] = [
        solo("attract", label: "Attract", group: "Canonical",
             blurb: "A soft gravity-like well — the designed falloff (1 − d/range)², tuned for legible motion."),
        solo("jet", label: "Jet", group: "Canonical",
             blurb: "A conduit: draws matter in, relaunches it hot along the heading with a cone of spread.",
             angle: -.pi / 3, render: .trails),
        solo("tether", label: "Tether", group: "Canonical",
             blurb: "A spring with a rest length — matter holds at a shell radius around the card.",
             render: .links),
        solo("wall", label: "Wall", group: "Canonical",
             blurb: "An elastic boundary the size of the card — matter bounces, hard impacts spark."),
        solo("stream", label: "Stream", group: "Canonical",
             blurb: "A steady directional current along the card's heading.", angle: 0, render: .trails),
        solo("repel", label: "Repel", group: "Canonical",
             blurb: "The outward push — carves a void around the card."),
        solo("viscosity", label: "Viscosity", group: "Canonical",
             blurb: "Thickens the medium near the card — momentum bleeds, nothing redirects."),
        solo("swirl", label: "Swirl", group: "Canonical",
             blurb: "Tangential spin with light inward retention — a designed vortex, not a drain.",
             render: .trails),
        solo("sink", label: "Sink", group: "Canonical",
             blurb: "Captures matter into an accretion core, holds it, and supernovas it back at capacity.",
             strength: 1.4),
    ]

    // MARK: natural primitives (§20.10)

    static let natural: [ForceEntry] = [
        solo("gravity", label: "Gravity", group: "Natural",
             blurb: "The real law: softened inverse-square (Plummer ε = 2GM/c²) — orbits emerge, not falloffs.",
             range: 600, overlay: [.path]),
        solo("charge", label: "Charge", group: "Natural",
             blurb: "Gravity's signed sibling. Passing matter polarizes by side, then like repels and opposite attracts.",
             range: 420, overlay: [.fieldLines]),
        solo("magnetism", label: "Magnetism", group: "Natural",
             blurb: "The Lorentz force curves charged matter perpendicular to its velocity. Paired with fieldflow so matter threads the dipole loops — iron filings.",
             tokens: ["magnetism", "fieldflow"], strength: 0.9, range: 560,
             render: .trails, overlay: [.fieldLines], density: 4),
        solo("thermal", label: "Thermal", group: "Natural",
             blurb: "Langevin agitation — a real temperature: σ = √(2T) Gaussian kicks, hotter near the card.",
             engaged: true, overlay: [.temperature]),
        solo("collide", label: "Collide", group: "Natural",
             blurb: "Hard-sphere elastic collisions — momentum-conserving pairwise impulses inside the region.",
             density: 3.5),
        solo("diffuse", label: "Diffuse", group: "Natural",
             blurb: "Stigmergy: matter lays pheromone into a diffusing grid and climbs the blurred gradient — trails self-organize."),
        solo("propagate", label: "Propagate", group: "Natural",
             blurb: "A travelling wave (∂²φ/∂t² = c²∇²φ): pulsed shocks expand as rings and sweep matter outward.",
             engaged: true),
        solo("memory", label: "Memory", group: "Natural",
             blurb: "The field remembers: occupancy wears into a slow-decay grid, and worn paths pull harder."),
    ]

    // MARK: designed extended (§20.3)

    static let extended: [ForceEntry] = [
        solo("lens", label: "Lens", group: "Extended",
             blurb: "Gravitational lensing: velocity rotates without gaining energy — paths bend, speed holds.",
             render: .trails),
        solo("gate", label: "Gate", group: "Extended",
             blurb: "A one-way membrane: matter passes along the heading, wrong-way crossers reflect.",
             angle: 0),
        solo("buoyancy", label: "Buoyancy", group: "Extended",
             blurb: "Density lift: hot or large matter rises, dense matter settles — set range 0 for a global medium.",
             range: 0),
        solo("shear", label: "Shear", group: "Extended",
             blurb: "Couette flow: speed grows with perpendicular offset — laminae slide past each other.",
             angle: 0, render: .trails),
        solo("crystallize", label: "Crystallize", group: "Extended",
             blurb: "A phase change: cool matter snaps onto the card's lattice and settles; heat melts it free."),
        solo("align", label: "Align", group: "Extended",
             blurb: "Boids alignment: matter steers toward its neighbours' mean heading, speed preserved.",
             render: .trails, density: 3),
        solo("wind", label: "Wind", group: "Extended",
             blurb: "Divergence-free curl noise — stirs without compressing. Deterministic turbulence.",
             range: 0, render: .trails),
        solo("cohesion", label: "Cohesion", group: "Extended",
             blurb: "Surface tension: short-range pressure, mid-range pull — droplets form around a rest spacing.",
             density: 3),
        solo("pressure", label: "Pressure", group: "Extended",
             blurb: "SPH density relaxation: crowded matter pushes apart down the gradient — an incompressible even fill.",
             density: 3.5),
        solo("link", label: "Link", group: "Extended",
             blurb: "Verlet distance constraints to every neighbour — matter ropes, chains, and drapes.",
             render: .links, density: 3),
        solo("hunt", label: "Hunt", group: "Extended",
             blurb: "Two-species pursuit: predators seek, prey flee. Needs mixed species seeded — alone, the field is one tribe and stays calm."),
        {
            // morph: matter assembles into a ring mark (never words — §11)
            var spec = CardSpec("Morph", x: 0.5, y: 0.5, w: 180, h: 70,
                                tokens: ["morph"], strength: 1.2, range: 0)
            spec.morphRing = true
            var s = LabScene(id: "force-morph", name: "Morph",
                             blurb: "Matter assembles into a mark — here a ring; never words or letterforms (§11). Range 0 recruits the whole field.",
                             cards: [spec])
            s.density = 3
            return ForceEntry(token: "morph", label: "Morph", group: "Extended",
                              blurb: s.blurb, scene: s)
        }(),
        solo("spawn", label: "Spawn", group: "Extended",
             blurb: "The source atom: budgeted mortal matter emitted along the heading — every particle carries a lifespan.",
             angle: -.pi / 2, engaged: true, render: .trails),
        solo("resonate", label: "Resonate", group: "Extended",
             blurb: "A modifier: pulses its sibling forces with S(t) = S₀(1 + sin ωt) — this well breathes.",
             tokens: ["resonate", "attract"]),
        solo("spotlight", label: "Spotlight", group: "Extended",
             blurb: "A modifier: gates its siblings to a cone of the heading — attract becomes a directed beam.",
             tokens: ["spotlight", "attract"], angle: 0),
        pair("screen", label: "Screen", group: "Extended",
             blurb: "A quiet zone: the screen card damps every OTHER body's force inside its radius — calm carved out of a loud field.",
             left: CardSpec("Loud well", x: 0.32, y: 0.5, w: 170, h: 66,
                            tokens: ["attract"], strength: 2, range: 460),
             right: CardSpec("Quiet zone", x: 0.68, y: 0.5, w: 170, h: 66,
                             tokens: ["screen"], strength: 1, range: 240)),
        solo("pigment", label: "Pigment", group: "Extended",
             blurb: "Conserved color transport: matter that overlaps the card takes its tint and carries it away.",
             tokens: ["pigment", "attract"]),
        {
            var s = LabScene(
                id: "force-fieldflow", name: "Field Flow",
                blurb: "Follows the net structure field other bodies radiate — alone it has no lines to follow, so it pairs with a magnet (the honest minimum).",
                cards: [CardSpec("Dipole", x: 0.5, y: 0.5, w: 180, h: 70,
                                 tokens: ["magnetism", "fieldflow"], strength: 0.7, range: 360)]
            )
            s.overlay = [.fieldLines]
            s.render = .trails
            s.density = 2.5
            return ForceEntry(token: "fieldflow", label: "Field Flow", group: "Extended",
                              blurb: s.blurb, scene: s)
        }(),
        pair("warp", label: "Warp", group: "Extended",
             blurb: "A wormhole: matter entering one throat exits the other, momentum twisted through — conserved relocation.",
             left: CardSpec("Throat A", x: 0.27, y: 0.5, w: 150, h: 64,
                            tokens: ["warp", "attract"], range: 260, absorbR: 40, warpPair: 1),
             right: CardSpec("Throat B", x: 0.73, y: 0.5, w: 150, h: 64,
                             tokens: ["warp", "attract"], range: 260, absorbR: 40, warpPair: 0),
             render: .trails),
    ]
}

// MARK: - Force color identity
//
// The canonical nine carry their canon colors (CANONICAL_FORCE_COLORS, ported from
// forces.config.ts). The natural and extended sets have no canon colors — these are
// the LAB's presentation palette: physics-flavored families (naturals warm/electric,
// extended cooler utility hues), stable per token so a force is the same color in the
// sidebar, the caption chip, and on every card that carries it.

public let LAB_FORCE_COLORS: [String: String] = [
    // natural primitives
    "gravity":     "#ffce6b",
    "charge":      "#f472b6",
    "magnetism":   "#60a5fa",
    "thermal":     "#fb7185",
    "collide":     "#e2e8f0",
    "diffuse":     "#34d399",
    "propagate":   "#22d3ee",
    "memory":      "#c084fc",
    // designed extended
    "lens":        "#93c5fd",
    "gate":        "#fbbf24",
    "buoyancy":    "#67e8f9",
    "shear":       "#a3e635",
    "crystallize": "#bae6fd",
    "align":       "#5eead4",
    "wind":        "#a5f3fc",
    "cohesion":    "#38bdf8",
    "pressure":    "#f97316",
    "link":        "#84cc16",
    "hunt":        "#f87171",
    "morph":       "#e879f9",
    "spawn":       "#fde047",
    "resonate":    "#f0abfc",
    "spotlight":   "#fef08a",
    "screen":      "#94a3b8",
    "pigment":     "#fb923c",
    "fieldflow":   "#818cf8",
    "warp":        "#c4b5fd",
]

/// The identity color for a force token: canon first, the lab palette second,
/// the accent blue as the final fallback.
public func forceColor(_ token: String) -> String {
    canonicalForceColor(token) ?? LAB_FORCE_COLORS[token] ?? "#4da3ff"
}

/// A card's identity color — its FIRST force token (the primary behavior).
public func cardColor(tokens: [String]) -> String {
    forceColor(tokens.first ?? "")
}
