// FieldLabSnapshots — render every tour scene headlessly to PNG.
//
//   swift run -c release FieldLabSnapshots [output-dir]
//
// Proof artifacts: the same engine + renderer the FieldLab app uses, no window needed.

import Foundation
import FieldLabKit

#if os(macOS)
// --bench: where does a frame go? sim vs draw, per scene / matter mode / reading.
if CommandLine.arguments.contains("--bench") {
    print("FieldLab bench — 1280×800 @2x, 240 frames per row (after 60 warm-up)\n")
    let rows = Bench.standardSweep()
    print(Bench.table(rows))
    exit(0)
}

let outDir = URL(fileURLWithPath: CommandLine.arguments.count > 1
    ? CommandLine.arguments[1]
    : FileManager.default.temporaryDirectory.appendingPathComponent("fieldlab").path)
try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

var opts = Snapshotter.Options()
opts.bursts = [(0.5, 0.55), (0.3, 0.35)]

for scene in LabScenes.tour {
    let url = outDir.appendingPathComponent("\(scene.id).png")
    do {
        try Snapshotter.render(scene: scene, options: opts, to: url)
        print("✓ \(scene.id) → \(url.path)")
    } catch {
        print("✗ \(scene.id): \(error.localizedDescription)")
        exit(1)
    }
}

// one recipe from the locked canon, to prove the catalog runs
if let recipeScene = LabScenes.recipe("priority-well") {
    let url = outDir.appendingPathComponent("recipe-priority-well.png")
    try Snapshotter.render(scene: recipeScene, options: opts, to: url)
    print("✓ recipe-priority-well → \(url.path)")
}

print("done — \(outDir.path)")
#else
print("FieldLabSnapshots is macOS-only")
#endif
