// FieldLabSnapshots — render every tour scene headlessly to PNG.
//
//   swift run -c release FieldLabSnapshots [output-dir]
//
// Proof artifacts: the same engine + renderer the FieldLab app uses, no window needed.

import Foundation
import FieldLabKit
import FundamentalCore
import FundamentalVanilla

#if os(macOS)
// --probe-source: does the source actually produce real, counted particles, and does the
// sink supernova release them back persistently? Runs source-sink for 600 frames, logging
// the live count + a supernova counter (a sharp accreted→0 on the collector).
if CommandLine.arguments.contains("--probe-source") {
    let scene = LabScenes.sourceSink
    let bodies = scene.makeBodies(width: 1280, height: 800)
    let host = ManualFieldHost(width: 1280, height: 800, bodies: bodies)
    let field = FieldField(host: host, options: scene.options())
    field.scan()
    field.setFormation(scene.formation)
    let collector = bodies.first { $0.tokens.contains("sink") }!
    var prevAccreted: Float = 0
    var supernovas = 0
    print("frame  count  accreted  supernovas")
    for i in 0..<600 {
        host.fire(at: TimeInterval(i) / 60)
        if prevAccreted > 5 && collector.accreted < prevAccreted - 5 { supernovas += 1 }
        prevAccreted = collector.accreted
        if i % 30 == 0 {
            print(String(format: "%5d  %5d  %8.0f  %d",
                         i, field.particleCount(), collector.accreted, supernovas))
        }
    }
    field.destroy()
    exit(0)
}

// --bench: where does a frame go? sim vs draw, per scene / matter mode / reading.
if CommandLine.arguments.contains("--bench") {
    print("FieldLab bench — 1280×800 @2x, 240 frames per row (after 60 warm-up)\n")
    let rows = Bench.standardSweep()
    print(Bench.table(rows))
    exit(0)
}

// --verify: the two field-line fixes, with the readings the user pins.
//   mass-lines: Mass + field-lines ON → clean spokes into the gravity body, not a starburst.
//   magnetism:  the tour scene → matter threads the dipole loops.
if CommandLine.arguments.contains("--verify") {
    let dir = URL(fileURLWithPath: "/tmp/fl-verify")
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    var mass = LabScenes.mass
    mass.overlay = [.fieldLines]
    try Snapshotter.render(scene: mass, options: Snapshotter.Options(),
                           to: dir.appendingPathComponent("mass-lines.png"))
    try Snapshotter.render(scene: LabScenes.magnetism, options: Snapshotter.Options(),
                           to: dir.appendingPathComponent("magnetism.png"))
    // gravity + the deformation grid — should now visibly curve toward the mass.
    if let gravity = ForceCatalog.entry(token: "gravity")?.scene {
        var g = gravity
        g.overlay = [.grid]
        try Snapshotter.render(scene: g, options: Snapshotter.Options(),
                               to: dir.appendingPathComponent("gravity-grid.png"))
    }
    // source & sink — supernovas eject persistent matter.
    try Snapshotter.render(scene: LabScenes.sourceSink, options: Snapshotter.Options(),
                           to: dir.appendingPathComponent("source-sink.png"))
    print("verify → \(dir.path)")
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
