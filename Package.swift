// swift-tools-version: 5.9
import PackageDescription

// Root Package.swift — makes `https://github.com/zachshallbetter/fundamental-engine`
// work as a remote Swift package reference. Sources live in swift/Sources/.
// This mirrors the products declared in swift/Package.swift.

let package = Package(
    name: "Fundamental",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
        .visionOS(.v1),
    ],
    products: [
        .library(name: "FundamentalCore",     targets: ["FundamentalCore"]),
        .library(name: "FundamentalPlatform", targets: ["FundamentalPlatform"]),
        .library(name: "FundamentalVanilla",  targets: ["FundamentalVanilla"]),
        .library(name: "FundamentalSwiftUI",  targets: ["FundamentalSwiftUI"]),
    ],
    targets: [
        .target(
            name: "FundamentalCore",
            path: "swift/Sources/FundamentalCore",
            resources: [.copy("Resources/recipes.json")]
        ),
        .target(
            name: "FundamentalPlatform",
            dependencies: ["FundamentalCore"],
            path: "swift/Sources/FundamentalPlatform"
        ),
        .target(
            name: "FundamentalVanilla",
            dependencies: ["FundamentalCore", "FundamentalPlatform"],
            path: "swift/Sources/FundamentalVanilla"
        ),
        .target(
            name: "FundamentalSwiftUI",
            dependencies: ["FundamentalVanilla"],
            path: "swift/Sources/FundamentalSwiftUI"
        ),
    ]
)
