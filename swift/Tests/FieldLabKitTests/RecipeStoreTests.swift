import Testing
@testable import FieldLabKit

@Suite("RecipeStore")
struct RecipeStoreTests {
    @Test func saveAndReload() throws {
        let store = RecipeStore()
        let scene = LabScene(
            id: "test-\(Int.random(in: 0..<10000))",
            name: "Test Scene",
            blurb: "test", story: "test",
            cards: [],
            formation: "ambient",
            render: .dots,
            overlay: nil,
            density: 0.5,
            attention: false,
            causality: false,
            heatmap: false,
            waves: false,
            depth: 0,
            accent: nil
        )
        store.save(scene)
        store.reload()
        #expect(store.recipes.contains { $0.id == scene.id })
        store.delete(scene)
        store.reload()
        #expect(!store.recipes.contains { $0.id == scene.id })
    }

    @Test func exportJSONIsValid() throws {
        let store = RecipeStore()
        let scene = LabScene(
            id: "export-test",
            name: "Export",
            blurb: "", story: "",
            cards: [],
            formation: "ambient",
            render: .dots,
            overlay: nil,
            density: 1.0,
            attention: false,
            causality: false,
            heatmap: false,
            waves: true,
            depth: 0,
            accent: nil
        )
        let json = store.exportJSON(scene)
        #expect(json != nil)
        #expect(json!.contains("export-test"))
    }
}
