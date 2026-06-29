# Cross-platform parity matrix

The `FieldHandle` interface is the engine's public API contract. Every platform that
ships a field runtime implements a subset of it; the table below is the machine-generated
snapshot of which methods are present on each platform.

**Method source of truth:** `packages/core/src/core/types.ts` — `FieldHandle` interface.
**Swift source:** `swift/Sources/FundamentalVanilla/FieldEngine.swift`.
**Kotlin source:** `android/fundamental-core/src/main/kotlin/com/fundamental/core/runtime/FieldHandle.kt`.

The cross-plane *mathematical* conformance (force physics identical across JS, Swift, and Kotlin)
is separately verified by the golden fixture and the per-platform `GoldenConformanceTests`.
This matrix tracks *API surface* parity — which callable methods exist on each platform.

Last generated: 2026-06-29 (from the source files above). Update when adding a method to any platform.

---

## FieldHandle method coverage

| Method | JS | Swift | Kotlin | Notes |
|--------|----|-------|--------|-------|
| `scan` | ✓ | ✓ | — | Kotlin re-scans implicitly on tick |
| `rescan` | ✓ | ✓ | — | alias of scan |
| `setAccent` | ✓ | ✓ | — | visual layer — Compose has its own color API |
| `setPalette` | ✓ | ✓ | — | visual layer |
| `setFormation` | ✓ | ✓ | ✓ | |
| `setWaveStyle` | ✓ | ✓ | — | visual layer |
| `setWaveCenter` | ✓ | ✓ | — | visual layer |
| `setSeparation` | ✓ | ✓ | — | Kotlin exposes as `var separation` |
| `setAttention` | ✓ | ✓ | ✓ | |
| `setCausality` | ✓ | ✓ | ✓ | |
| `setHeatmap` | ✓ | ✓ | ✓ | |
| `setDprCap` | ✓ | — | — | pixel-density control — native OSs handle DPR differently |
| `setQualityTier` | ✓ | — | — | adaptive quality governor |
| `setRender` | ✓ | ✓ | — | render surface is Compose/SwiftUI-owned on native |
| `setOverlay` | ✓ | ✓ | — | overlay readings (overlay canvas) |
| `setBackground` | ✓ | — | — | Web-specific: transparent vs opaque canvas clearing |
| `threads` | ✓ | ✓ | — | visual layer — glowing connector lines |
| `burst` | ✓ | ✓ | ✓ | |
| `flowTo` | ✓ | ✓ | ✓ | |
| `clearFlow` | ✓ | ✓ | ✓ | |
| `seed` | ✓ | ✓ | ✓ | |
| `addAgent` | ✓ | — | — | engine-stepped agent — planned for native |
| `addBody` | ✓ | ✓ | ✓ | |
| `addEdge` | ✓ | ✓ | ✓ | |
| `readEdges` | ✓ | ✓ | ✓ | |
| `addField` | ✓ | ✓ | ✓ | |
| `sampleField` | ✓ | ✓ | ✓ | |
| `atomAt` | ✓ | ✓ | ✓ | |
| `focusAt` | ✓ | ✓ | — | |
| `clearFocus` | ✓ | ✓ | — | |
| `particleCount` | ✓ | ✓ | ✓ | |
| `energy` | ✓ | ✓ | ✓ | |
| `sample` | ✓ | — | — | force-field vector at a point; Swift uses renderer path |
| `sampleScalar` | ✓ | ✓ | ✓ | heatmap density at a point |
| `sampleGradient` | ✓ | ✓ | ✓ | density gradient at a point |
| `grid` | ✓ | — | — | named ScalarGrid — planned for native |
| `on` | ✓ | — | — | event subscription bus — planned for native |
| `readParticles` | ✓ | ✓ | ✓ | raw swarm read-out (stride 5) |
| `readParticleIds` | ✓ | — | — | stable per-particle ids |
| `readParticleChannels` | ✓ | — | — | multi-channel read-out (§future) |
| `registerOverlay` | ✓ | — | — | custom overlay fn |
| `scrollV` | ✓ | ✓ | — | DOM/UIKit-specific scroll velocity |
| `setVisible` | ✓ | ✓ | — | element-level visibility hint |
| `destroy` | ✓ | ✓ | ✓ | |

**Summary:**

| Platform | Methods | Coverage |
|----------|---------|----------|
| JS (npm) | 44/44 | 100% (source of truth) |
| Swift | 34/44 | 77% |
| Kotlin | 20/44 | 45% |

The gap between Swift and Kotlin reflects that the Kotlin port is at **engine parity** (identical
force math, verified by the golden conformance suite) while the Swift port additionally covers the
full visual and scan API. Render-layer methods (`setRender`, `setOverlay`, `threads`, `setAccent`)
are absent from Kotlin because the Compose / View rendering APIs are host-owned; the Kotlin engine
exposes the data pipeline (forces, density, particles, edges) and Compose wires the drawing.
