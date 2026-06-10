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
        .library(name: "FieldUICore",      targets: ["FieldUICore"]),
        .library(name: "FieldUIPlatform",  targets: ["FieldUIPlatform"]),
        .library(name: "FieldUIiOS",       targets: ["FieldUIiOS"]),
        .library(name: "FieldUImacOS",     targets: ["FieldUImacOS"]),
        .library(name: "FieldUIvisionOS",  targets: ["FieldUIvisionOS"]),
    ],
    targets: [
        // Pure physics — no platform imports, no UIKit/AppKit/RealityKit.
        // 3D-native: Vec3 = SIMD3<Float> throughout.
        .target(
            name: "FieldUICore",
            path: "Sources/FieldUICore",
            swiftSettings: [.enableExperimentalFeature("StrictConcurrency")]
        ),
        // The six-phase scheduler + registries. No UIKit/AppKit dep.
        // Depends on FieldUICore for shared types.
        .target(
            name: "FieldUIPlatform",
            dependencies: ["FieldUICore"],
            path: "Sources/FieldUIPlatform",
            swiftSettings: [.enableExperimentalFeature("StrictConcurrency")]
        ),
        // UIKit host + UIView-based measurement / render.
        .target(
            name: "FieldUIiOS",
            dependencies: ["FieldUICore", "FieldUIPlatform"],
            path: "Sources/FieldUIiOS"
        ),
        // AppKit host + NSView-based measurement / render.
        .target(
            name: "FieldUImacOS",
            dependencies: ["FieldUICore", "FieldUIPlatform"],
            path: "Sources/FieldUImacOS"
        ),
        // RealityKit / SwiftUI host — full volumetric simulation.
        .target(
            name: "FieldUIvisionOS",
            dependencies: ["FieldUICore", "FieldUIPlatform"],
            path: "Sources/FieldUIvisionOS"
        ),
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
    ]
)
