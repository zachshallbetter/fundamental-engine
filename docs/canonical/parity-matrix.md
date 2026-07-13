# Cross-platform parity matrix

> **The authoritative matrix is the live page: [`/docs/api/parity`](https://fundamental-engine.com/docs/api/parity)**
> (source: `apps/site/src/pages/docs/api/parity.astro`, whose counts are *computed* from a single
> `METHODS` array — not a separate hand-copy). This canonical note used to carry a hand-maintained copy
> of that table and later a hardcoded "44/44/44" summary; both drifted and were removed. **Do not restate
> a specific parity count here** — it will go stale again. All three ports briefly reached the full
> JS-side surface in June 2026 (Three.js, Swift, Kotlin; PRs #822/#823/#824); the JS surface has grown
> since, and the native ports are not currently at full parity — check the live page for the exact,
> current counts and which methods are missing on which plane.

The `FieldHandle` interface is the engine's public API contract. Every platform that ships a field
runtime implements it; the live page tracks which callable methods exist on each platform.

**Sources of truth:**
- **Methods:** `packages/core/src/engine/types.ts` — the `FieldHandle` interface.
- **Three.js:** `packages/three/src/layer.ts` — `FieldLayer` delegates the full surface to the wrapped handle.
- **Swift:** `swift/Sources/FundamentalVanilla/FieldEngine.swift`.
- **Kotlin:** `android/fundamental-core/src/main/kotlin/com/fundamental/core/engine/FieldHandle.kt`.

## Two different "parity" claims — keep them separate

- **API-surface parity** — which callable `FieldHandle` methods exist on each platform. This is what the
  [parity page](https://fundamental-engine.com/docs/api/parity) tracks.
- **Mathematical conformance** — the force *physics* being identical across JS, Swift, and Kotlin. This is
  verified separately by the shared golden fixture (`swift/Tests/.../Fixtures/conformance-golden.json`) and
  the per-platform `GoldenConformanceTests` (`pnpm check:golden`). API parity and physics conformance are
  independent guarantees.

Some methods behave differently *by platform design* even at full parity (e.g. `setRender`/`setOverlay`
are host-owned in Compose/SwiftUI; `scrollV` reads DOM/UIKit scroll). Those per-method notes live in the
parity page's Notes column, not here, so there is nothing to keep in sync.
