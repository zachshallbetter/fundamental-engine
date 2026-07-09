import Foundation

// MARK: - FieldPattern schema + validation (recipes/schema.ts)
//
// A recipe is a portable, serializable, inspectable field program: the natural field it
// translates, the engine primitives + bodies, the render stack, metrics, diagnostics,
// accessibility behavior, and expected conformance. Validation checks the shape and that
// every reference is real — every force token is a registered force, every render layer
// + diagnostic is a known mode, the declared primitives match the body tokens.
//
// The 64-recipe catalog is LOCKED CANON, embedded as recipes.json (generated from the TS
// catalog — one source of truth, never hand-retyped).

public enum RenderLayer: String, Codable, Sendable, CaseIterable {
    case particles, dots, trails, links, streamlines, metaballs, voronoi
    case fieldLines = "field-lines"
    case heatmap
}

public enum DiagnosticMode: String, Codable, Sendable, CaseIterable {
    case forceVectors = "force-vectors"
    case contours, potential, energy, topology, inspector, causality, prediction
}

/// One body in a recipe: a force token (or space-separated tokens) + attributes.
public struct BodyRecipe: Codable, Sendable {
    public var body: String
    public var strength: Float?
    public var range: Float?
    public var spin: Float?
    public var angle: Float?
    public var feedback: Bool?
    public var scope: String?
}

public struct RelationshipRecipe: Codable, Sendable {
    public var from: String
    public var to: String
    public var type: String
    public var strength: Float?
}

public struct AccessibilityRecipe: Codable, Sendable {
    /// What replaces motion under reduced motion.
    public var reducedMotion: String
    /// How meaning survives without color/motion.
    public var meaningWithoutMotion: String
}

public struct ExpectedMetrics: Codable, Sendable {
    public var particleCount: Int?
    public var entropyRange: [Float]?
    public var energyDriftMax: Float?
}

public enum RecipeTier: String, Codable, Sendable {
    case core, applied, systems, operational
}

public enum RecipeStatus: String, Codable, Sendable {
    case shipped, experimental, planned, conceptual
}

/// A portable field recipe (authoring §5) — the reusable unit connecting the natural-
/// field model, engine primitives, authoring, feedback, diagnostics, and accessibility.
///
/// The lane split: concepts describe · tokens execute · metrics measure · diagnostics
/// explain · conditions activate. Only `primitives` (the runtime tokens) becomes behavior.
public struct FieldPattern: Codable, Sendable {
    public var id: String
    public var name: String
    public var intent: String
    public var tier: RecipeTier?
    public var naturalField: String?
    public var translation: String?
    /// RUNTIME TOKENS: the strict, real engine forces this recipe composes.
    public var primitives: [String]
    /// CONCEPTS: human-facing product language — never runtime tokens.
    public var concepts: [String]?
    /// METRICS: measured / semantic state — not forces.
    public var metrics: [String]
    /// DIAGNOSTICS: inspection / render modes — not forces.
    public var diagnostics: [String]
    /// CONDITIONS: activation logic — not forces.
    public var conditions: [String]?
    public var bodies: [BodyRecipe]
    public var relationships: [RelationshipRecipe]?
    public var render: [String]
    public var accessibility: AccessibilityRecipe
    public var status: RecipeStatus?
    public var notes: String?
}

// MARK: - Validation

let RENDER_LAYER_IDS: Set<String> = Set(RenderLayer.allCases.map(\.rawValue))
let DIAGNOSTIC_MODE_IDS: Set<String> = Set(DiagnosticMode.allCases.map(\.rawValue))
/// Every render + diagnostic mode id a recipe may reference.
public let FIELD_MODES: Set<String> = RENDER_LAYER_IDS.union(DIAGNOSTIC_MODE_IDS)
let VALID_FIELDS: Set<String> = ["gravity", "electromagnetic", "strong", "weak"]

public struct RecipeProblem: Sendable {
    public var path: String
    public var issue: String
}

/// The distinct engine primitives used across a recipe's bodies, in first-seen order.
public func primitivesOf(_ bodies: [BodyRecipe]) -> [String] {
    var seen = Set<String>()
    var out: [String] = []
    for b in bodies {
        for t in b.body.split(separator: " ").map(String.init) where !t.isEmpty {
            if seen.insert(t).inserted { out.append(t) }
        }
    }
    return out
}

/// Validate a recipe's shape and references against a force registry. Returns every
/// problem (empty = valid).
public func validateRecipe(_ r: FieldPattern, against registry: Registry) -> [RecipeProblem] {
    var problems: [RecipeProblem] = []
    if r.id.isEmpty { problems.append(RecipeProblem(path: "id", issue: "required")) }
    if r.name.isEmpty { problems.append(RecipeProblem(path: "name", issue: "required")) }
    if r.bodies.isEmpty { problems.append(RecipeProblem(path: "bodies", issue: "at least one body is required")) }
    for (i, b) in r.bodies.enumerated() {
        let tokens = b.body.split(separator: " ").map(String.init)
        if tokens.isEmpty {
            problems.append(RecipeProblem(path: "bodies[\(i)].body", issue: "empty force token list"))
        }
        for t in tokens where registry.forces[t] == nil {
            problems.append(RecipeProblem(path: "bodies[\(i)].body", issue: "unknown force token \"\(t)\""))
        }
    }
    // declared primitives must be exactly the distinct body tokens (no drift).
    let derived = primitivesOf(r.bodies)
    let declared = r.primitives
    if declared.count != derived.count
        || derived.contains(where: { !declared.contains($0) })
        || declared.contains(where: { !derived.contains($0) }) {
        problems.append(RecipeProblem(
            path: "primitives",
            issue: "must list exactly the body tokens (expected: \(derived.joined(separator: ", ")))"
        ))
    }
    for (i, layer) in r.render.enumerated() where !RENDER_LAYER_IDS.contains(layer) {
        problems.append(RecipeProblem(path: "render[\(i)]", issue: "unknown render layer \"\(layer)\""))
    }
    for (i, mode) in r.diagnostics.enumerated() where !FIELD_MODES.contains(mode) {
        problems.append(RecipeProblem(path: "diagnostics[\(i)]", issue: "unknown diagnostic mode \"\(mode)\""))
    }
    if let nf = r.naturalField, !VALID_FIELDS.contains(nf) {
        problems.append(RecipeProblem(path: "naturalField", issue: "unknown fundamental field \"\(nf)\""))
    }
    if r.accessibility.reducedMotion.isEmpty || r.accessibility.meaningWithoutMotion.isEmpty {
        problems.append(RecipeProblem(
            path: "accessibility",
            issue: "reducedMotion + meaningWithoutMotion are required (no recipe is motion-only)"
        ))
    }
    return problems
}

// MARK: - The locked catalog

struct RecipeFile: Codable {
    var count: Int
    var recipes: [FieldPattern]
}

/// The locked 64-recipe catalog (4 tiers × 16), decoded from the embedded canon.
/// Loaded once; throws a fatal error only if the bundled resource is corrupt (a build
/// failure, not a runtime condition).
public enum FieldPatterns {
    public static let all: [FieldPattern] = {
        guard let url = Bundle.module.url(forResource: "recipes", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let file = try? JSONDecoder().decode(RecipeFile.self, from: data) else {
            fatalError("FundamentalCore: bundled recipes.json is missing or corrupt")
        }
        return file.recipes
    }()

    public static func recipe(id: String) -> FieldPattern? {
        all.first { $0.id == id }
    }

    public static func recipes(tier: RecipeTier) -> [FieldPattern] {
        all.filter { $0.tier == tier }
    }
}

// MARK: - Deprecated aliases (recipe → Pattern rename; removed at 1.0)

@available(*, deprecated, renamed: "FieldPattern")
public typealias FieldRecipe = FieldPattern

@available(*, deprecated, renamed: "FieldPatterns")
public typealias FieldRecipes = FieldPatterns
