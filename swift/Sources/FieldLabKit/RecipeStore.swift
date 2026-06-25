import Foundation
import Combine

/// Persists user-created FieldLab scenes to UserDefaults.
/// Key format: "fundamental.recipe.<scene.id>".
public final class RecipeStore: ObservableObject {
    public static let shared = RecipeStore()
    private let defaults = UserDefaults.standard
    private let prefix = "fundamental.recipe."

    @Published public private(set) var recipes: [LabScene] = []

    public init() { reload() }

    public func save(_ scene: LabScene) {
        guard let data = try? JSONEncoder().encode(scene) else { return }
        defaults.set(data, forKey: prefix + scene.id)
        reload()
    }

    public func delete(_ scene: LabScene) {
        defaults.removeObject(forKey: prefix + scene.id)
        reload()
    }

    public func reload() {
        let keys = defaults.dictionaryRepresentation().keys.filter { $0.hasPrefix(prefix) }
        recipes = keys.compactMap { key in
            guard let data = defaults.data(forKey: key) else { return nil }
            return try? JSONDecoder().decode(LabScene.self, from: data)
        }.sorted { $0.name < $1.name }
    }

    /// Export a scene as pretty-printed JSON string (for share sheet / clipboard).
    public func exportJSON(_ scene: LabScene) -> String? {
        guard let data = try? JSONEncoder().encode(scene) else { return nil }
        let obj = try? JSONSerialization.jsonObject(with: data)
        let pretty = try? JSONSerialization.data(withJSONObject: obj as Any, options: .prettyPrinted)
        return pretty.flatMap { String(data: $0, encoding: .utf8) }
    }

    /// Export a scene as Swift FieldOptions-style snippet (for copy-to-code).
    public func exportSwiftSnippet(_ scene: LabScene) -> String {
        let cardsStr = scene.cards.isEmpty ? "[]" : scene.cards.map {
            "  FieldBodySpec(tokens: [\($0.tokens.map { "\"\($0)\"" }.joined(separator: ", "))], strength: \($0.strength), range: \($0.range))"
        }.joined(separator: ",\n")

        return """
        // \(scene.name) — exported from FieldLab
        let options = FieldOptions(
            render: .dots,
            density: \(scene.density),
            formation: "\(scene.formation)"
        )
        // Bodies:
        [
        \(cardsStr)
        ]
        """
    }
}
