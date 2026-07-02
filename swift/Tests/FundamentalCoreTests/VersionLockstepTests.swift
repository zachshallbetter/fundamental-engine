import Foundation
import Testing
import FundamentalCore

// Drift guard (#923) — the Swift mirror of the JS `version.test.ts` (#693). FIELD_VERSION is the
// snapshot-format version stamped onto every capture; it MUST equal the canonical engine version,
// which is the JS core's package version (`packages/core/package.json` — the release bump is the
// single source of truth). The package lives inside the monorepo, so the test reads the file
// `#filePath`-relative — `swift test` always runs from the repo checkout (locally and in the
// swift-linux / swift-macos workflows). Fails if a release bumps the packages but leaves this port's
// constant stale — otherwise snapshots would silently record the wrong format version.

@Suite("VersionLockstep")
struct VersionLockstepTests {

    @Test("FIELD_VERSION matches packages/core/package.json (no drift)")
    func lockstep() throws {
        // <repo>/swift/Tests/FundamentalCoreTests/VersionLockstepTests.swift → four levels up → <repo>
        let repoRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // FundamentalCoreTests/
            .deletingLastPathComponent() // Tests/
            .deletingLastPathComponent() // swift/
            .deletingLastPathComponent() // repo root
        let pkgURL = repoRoot
            .appendingPathComponent("packages/core/package.json", isDirectory: false)
        try #require(
            FileManager.default.fileExists(atPath: pkgURL.path),
            "packages/core/package.json not found at \(pkgURL.path) — run `swift test` from the monorepo checkout"
        )

        struct CorePackageJSON: Decodable { let version: String }
        let pkg = try JSONDecoder().decode(CorePackageJSON.self, from: Data(contentsOf: pkgURL))

        #expect(
            FIELD_VERSION == pkg.version,
            "update FIELD_VERSION in swift/Sources/FundamentalCore/Engine/FieldSnapshot.swift to match the release (packages/core/package.json is \(pkg.version))"
        )
    }
}
