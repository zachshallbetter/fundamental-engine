// swift-tools-version: 5.9
import PackageDescription

// FundamentalCore + FundamentalPlatform are platform-free (Foundation + the standard-library SIMD types
// only; Apple's `simd` module is shimmed on non-Apple toolchains — see Math/SIMDCompat.swift). The
// Vanilla / SwiftUI / Lab targets are irreducibly Apple (CoreGraphics, Metal, UIKit, AppKit,
// RealityKit) and are excluded on Linux, so `swift build` / `swift test` there exercise the pure
// engine on a cheaper, faster runner.
#if os(Linux)
let includeApplePlatforms = false
#else
let includeApplePlatforms = true
#endif

let coreProducts: [Product] = [
    // Pure physics contracts — use this when you only need the engine types.
    .library(name: "FundamentalCore",     targets: ["FundamentalCore"]),
    // Platform scheduler + registries — use when building a custom integration.
    .library(name: "FundamentalPlatform", targets: ["FundamentalPlatform"]),
]

let appleProducts: [Product] = [
    // The universal imperative API — works on iOS, macOS, and visionOS.
    // The Swift equivalent of @fundamental-engine/vanilla.
    .library(name: "FundamentalVanilla",  targets: ["FundamentalVanilla"]),
    // SwiftUI adapter — drop-in FieldView + modifiers. Mirror of @fundamental-engine/react.
    .library(name: "FundamentalSwiftUI",  targets: ["FundamentalSwiftUI"]),
]

let coreTargets: [Target] = [
    // ── Core ────────────────────────────────────────────────────────────────
    // Pure physics — no platform imports. 3D-native: Vec3 = SIMD3<Float> throughout.
    .target(
        name: "FundamentalCore",
        path: "Sources/FundamentalCore",
        resources: [.copy("Resources/recipes.json")], // the locked 64-recipe canon
        swiftSettings: [.enableExperimentalFeature("StrictConcurrency")]
    ),
    // ── Platform ──────────────────────────────────────────────────────────────
    // Six-phase scheduler + registries. No UIKit/AppKit dep.
    .target(
        name: "FundamentalPlatform",
        dependencies: ["FundamentalCore"],
        path: "Sources/FundamentalPlatform",
        swiftSettings: [.enableExperimentalFeature("StrictConcurrency")]
    ),
    .testTarget(
        name: "FundamentalCoreTests",
        dependencies: ["FundamentalCore"],
        path: "Tests/FundamentalCoreTests",
        resources: [.copy("Fixtures")] // cross-plane golden vectors (conformance-golden.json, #526)
    ),
    .testTarget(
        name: "FundamentalPlatformTests",
        dependencies: ["FundamentalPlatform"],
        path: "Tests/FundamentalPlatformTests"
    ),
]

let appleTargets: [Target] = [
    // ── Vanilla ─────────────────────────────────────────────────────────────
    // Universal imperative API. Platform hosts are internal — selected at compile time via
    // #if canImport(UIKit/AppKit/RealityKit). One import, all Apple platforms.
    .target(
        name: "FundamentalVanilla",
        dependencies: ["FundamentalCore", "FundamentalPlatform"],
        path: "Sources/FundamentalVanilla"
    ),
    // ── SwiftUI ─────────────────────────────────────────────────────────────
    // Declarative SwiftUI adapter. Wraps FundamentalVanilla, adds FieldView and view modifiers.
    .target(
        name: "FundamentalSwiftUI",
        dependencies: ["FundamentalVanilla"],
        path: "Sources/FundamentalSwiftUI"
    ),
    // ── FieldLab (the showcase) ─────────────────────────────────────────────
    // Scene specs + the headless snapshot pipeline, shared by the app and the proof tool.
    .target(
        name: "FieldLabKit",
        dependencies: ["FundamentalCore", "FundamentalVanilla"],
        path: "Sources/FieldLabKit"
    ),
    // The macOS lab app: every engine pillar as a live, interactive scene. `swift run FieldLab`
    .executableTarget(
        name: "FieldLab",
        dependencies: ["FieldLabKit", "FundamentalCore", "FundamentalVanilla"],
        path: "Sources/FieldLab"
    ),
    // Headless proof: renders the tour scenes to PNGs through the real engine.
    .executableTarget(
        name: "FieldLabSnapshots",
        dependencies: ["FieldLabKit"],
        path: "Sources/FieldLabSnapshots"
    ),
    .testTarget(
        name: "FundamentalVanillaTests",
        dependencies: ["FundamentalVanilla"],
        path: "Tests/FundamentalVanillaTests"
    ),
    // Visual snapshot model (#417/#392): the headless render reduced to a coarse perceptual signature.
    .testTarget(
        name: "FieldLabKitTests",
        dependencies: ["FieldLabKit", "FundamentalCore", "FundamentalVanilla"],
        path: "Tests/FieldLabKitTests"
    ),
    .testTarget(
        name: "FundamentalSwiftUITests",
        dependencies: ["FundamentalSwiftUI"],
        path: "Tests/FundamentalSwiftUITests"
    ),
]

let package = Package(
    name: "Fundamental",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
        .visionOS(.v1),
    ],
    products: coreProducts + (includeApplePlatforms ? appleProducts : []),
    targets: coreTargets + (includeApplePlatforms ? appleTargets : [])
)
