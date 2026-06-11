// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FieldUI",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
        .visionOS(.v1),
    ],
    products: [
        // Pure physics contracts — use this when you only need the engine types.
        .library(name: "FieldUICore",     targets: ["FieldUICore"]),
        // Platform scheduler + registries — use when building a custom integration.
        .library(name: "FieldUIPlatform", targets: ["FieldUIPlatform"]),
        // The universal imperative API — works on iOS, macOS, and visionOS.
        // The Swift equivalent of @field-ui/vanilla.
        .library(name: "FieldUIVanilla",  targets: ["FieldUIVanilla"]),
        // SwiftUI adapter — drop-in FieldView + modifiers.
        // The Swift equivalent of @field-ui/react.
        .library(name: "FieldUISwiftUI",  targets: ["FieldUISwiftUI"]),
    ],
    targets: [
        // ── Core ────────────────────────────────────────────────────────────
        // Pure physics — no platform imports, no UIKit/AppKit/RealityKit.
        // 3D-native: Vec3 = SIMD3<Float> throughout.
        .target(
            name: "FieldUICore",
            path: "Sources/FieldUICore",
            resources: [.copy("Resources/recipes.json")], // the locked 64-recipe canon
            swiftSettings: [.enableExperimentalFeature("StrictConcurrency")]
        ),
        // ── Platform ────────────────────────────────────────────────────────
        // Six-phase scheduler + registries. No UIKit/AppKit dep.
        .target(
            name: "FieldUIPlatform",
            dependencies: ["FieldUICore"],
            path: "Sources/FieldUIPlatform",
            swiftSettings: [.enableExperimentalFeature("StrictConcurrency")]
        ),
        // ── Vanilla ─────────────────────────────────────────────────────────
        // Universal imperative API. Platform hosts are internal — selected at
        // compile time via #if canImport(UIKit/AppKit/RealityKit). One import,
        // all Apple platforms.
        .target(
            name: "FieldUIVanilla",
            dependencies: ["FieldUICore", "FieldUIPlatform"],
            path: "Sources/FieldUIVanilla"
        ),
        // ── SwiftUI ─────────────────────────────────────────────────────────
        // Declarative SwiftUI adapter. Wraps FieldUIVanilla, adds FieldView and
        // view modifiers. Mirror of @field-ui/react.
        .target(
            name: "FieldUISwiftUI",
            dependencies: ["FieldUIVanilla"],
            path: "Sources/FieldUISwiftUI"
        ),
        // ── FieldLab (the showcase) ─────────────────────────────────────────
        // Scene specs + the headless snapshot pipeline, shared by the app and
        // the proof tool — what a snapshot shows is exactly what the app runs.
        .target(
            name: "FieldLabKit",
            dependencies: ["FieldUICore", "FieldUIVanilla"],
            path: "Sources/FieldLabKit"
        ),
        // The macOS lab app: every engine pillar as a live, interactive scene.
        //   swift run FieldLab
        .executableTarget(
            name: "FieldLab",
            dependencies: ["FieldLabKit", "FieldUICore", "FieldUIVanilla"],
            path: "Sources/FieldLab"
        ),
        // Headless proof: renders the tour scenes to PNGs through the real engine.
        //   swift run -c release FieldLabSnapshots /tmp/fieldlab
        .executableTarget(
            name: "FieldLabSnapshots",
            dependencies: ["FieldLabKit"],
            path: "Sources/FieldLabSnapshots"
        ),
        // ── Tests ────────────────────────────────────────────────────────────
        .testTarget(
            name: "FieldUICoreTests",
            dependencies: ["FieldUICore"],
            path: "Tests/FieldUICoreTests"
        ),
        .testTarget(
            name: "FieldUIPlatformTests",
            dependencies: ["FieldUIPlatform"],
            path: "Tests/FieldUIPlatformTests"
        ),
        .testTarget(
            name: "FieldUIVanillaTests",
            dependencies: ["FieldUIVanilla"],
            path: "Tests/FieldUIVanillaTests"
        ),
    ]
)
