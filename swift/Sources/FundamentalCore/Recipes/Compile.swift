import Foundation
#if canImport(simd)
import simd
#endif

// MARK: - Recipe compiler (recipes/compile.ts, authoring §5)
//
// Turns a portable FieldPattern into a runtime plan — the bridge from "recipe as record"
// to "recipe as program". The lane split is preserved on purpose: concepts describe ·
// tokens execute · metrics measure · diagnostics explain · conditions activate. Only the
// `primitives` lane becomes body behavior; concepts are never compiled into force tokens.

/// The feedback lane a metric writes to (`attention` → `field-attention`).
/// (The JS emits CSS custom properties; the Swift platform exposes the same names
/// through FeedbackChannels / the state registry.)
public func metricVar(_ metric: String) -> String {
    "field-\(metric)"
}

/// One compiled body: the configured parameters + the runtime tokens it carries.
/// The Swift counterpart of the JS `data-*` attribute set — `makeBody()` produces a
/// ready Body the caller attaches to a view (or places headless).
public struct RecipeBodyRegistration {
    public var tokens: [String]
    public var strength: Float
    public var range: Float
    public var spin: Float
    public var heading: Vec3
    public var feedback: Bool

    /// Build a configured Body from this registration. Geometry comes later — attach
    /// it to a view (set `body.view`) or place it by setting `body.box` directly.
    public func makeBody() -> Body {
        Body(
            tokens: tokens,
            strength: strength,
            range: range,
            spin: spin,
            heading: heading,
            feedback: feedback
        )
    }
}

public struct RecipeRelationshipRegistration {
    public var from: String
    public var to: String
    public var type: String
    public var strength: Float?
}

/// A metric → feedback-variable binding (the metric lane becoming measurable state).
public struct RecipeFeedbackBinding {
    public var metric: String
    public var variable: String
}

/// The reduced-motion output plan — what the runtime renders when motion is reduced.
public struct RecipeReducedMotionPlan {
    public var reducedMotion: String
    public var meaningWithoutMotion: String
    /// The static surfaces the runtime should render in place of motion.
    public var staticOutputs: [String]
}

/// A compiled recipe — the runtime plan, lanes preserved.
public struct CompiledPattern {
    public var id: String
    public var recipe: FieldPattern
    public var bodies: [RecipeBodyRegistration]
    public var relationships: [RecipeRelationshipRegistration]
    public var feedback: [RecipeFeedbackBinding]
    public var diagnostics: [String]
    public var metrics: [String]
    public var conditions: [String]
    public var reducedMotion: RecipeReducedMotionPlan
}

/// Derive the static surfaces a reduced-motion render should produce from the lanes.
private func staticOutputs(_ r: FieldPattern) -> [String] {
    var out: [String] = []
    if !r.metrics.isEmpty { out.append("metric-badges") }
    if !(r.relationships ?? []).isEmpty { out.append("relationship-list") }
    if !r.diagnostics.isEmpty { out.append("inspector-table") }
    if !(r.conditions ?? []).isEmpty { out.append("condition-list") }
    out.append("reduced-motion-note")
    return out
}

/// Compile a recipe into a runtime plan (pure). Reads behavior ONLY from the strict
/// token lane — a concept word never becomes a token. Metrics become feedback bindings;
/// the accessibility block becomes a reduced-motion output plan.
public func compilePattern(_ r: FieldPattern) -> CompiledPattern {
    CompiledPattern(
        id: r.id,
        recipe: r,
        bodies: r.bodies.map { b in
            let angle = b.angle ?? (-Float.pi / 2) // the JS default heading: up
            return RecipeBodyRegistration(
                tokens: b.body.split(separator: " ").map(String.init),
                strength: b.strength ?? 1,
                range: b.range ?? 100,
                spin: b.spin ?? 1,
                heading: Vec3(cos(angle), sin(angle), 0),
                feedback: b.feedback ?? false
            )
        },
        relationships: (r.relationships ?? []).map {
            RecipeRelationshipRegistration(from: $0.from, to: $0.to, type: $0.type, strength: $0.strength)
        },
        feedback: r.metrics.map { RecipeFeedbackBinding(metric: $0, variable: metricVar($0)) },
        diagnostics: r.diagnostics,
        metrics: r.metrics,
        conditions: r.conditions ?? [],
        reducedMotion: RecipeReducedMotionPlan(
            reducedMotion: r.accessibility.reducedMotion,
            meaningWithoutMotion: r.accessibility.meaningWithoutMotion,
            staticOutputs: staticOutputs(r)
        )
    )
}

// MARK: - Deprecated aliases (recipe → Pattern rename; removed at 1.0)

@available(*, deprecated, renamed: "CompiledPattern")
public typealias CompiledRecipe = CompiledPattern

@available(*, deprecated, renamed: "compilePattern")
public func compileRecipe(_ r: FieldPattern) -> CompiledPattern { compilePattern(r) }
