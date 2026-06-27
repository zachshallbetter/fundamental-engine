# Support matrix

> **Status: shipped + CI-pinned.** This is the RC-5 support declaration (closes #322) and the RC-8
> accessibility record (closes #325). Each row names the behavior *and* the test/check that exercises it
> — the matrix is enforced, not aspirational.

## Browsers

| Engine | Support | Notes |
|---|---|---|
| Chromium (Chrome, Edge, Brave, …) | ✅ supported | the e2e suite runs here (`apps/site/e2e/`, Playwright) |
| Firefox | ✅ supported | evergreen; same standards surface (Canvas 2D, custom elements, CSS vars) |
| WebKit (Safari, iOS Safari) | ✅ supported | evergreen; `mix-blend-mode` overlay honored |
| IE / legacy Edge | ❌ not supported | requires custom elements v1 + ES2020; no polyfills shipped |

The engine targets **evergreen browsers** — Canvas 2D, custom elements v1, CSS custom properties,
`IntersectionObserver`, `matchMedia`. No transpile-to-ES5, no DOM polyfills.

## Native (Swift) — Apple platforms

The engine also ships as a native **Swift port** (`swift/`) — a port of the JS engine, not a
reinterpretation: the package layout, API surface, and physics mirror the npm packages one-to-one.

| Platform | Support | Notes |
|---|---|---|
| iOS | ✅ supported (preview) | `.iOS(.v17)` minimum; UIKit host, Metal/Core Graphics render |
| macOS | ✅ supported (preview) | `.macOS(.v14)` minimum; AppKit host |
| visionOS | ✅ supported (preview) | `.visionOS(.v1)` minimum; RealityKit host, **3D-native** (positions are `SIMD3<Float>`, depth is a real axis) |

Four libraries map one-to-one to npm: `FundamentalCore` ↔ `@fundamental-engine/core` (zero platform
imports, the mirror of core's zero-DOM rule), `FundamentalPlatform` ↔ `@fundamental-engine/dom`,
`FundamentalVanilla` ↔ `@fundamental-engine/vanilla`, `FundamentalSwiftUI` ↔ `@fundamental-engine/react`.

- **Cross-plane conformance is enforced**, not asserted: the 36-force catalog is single-sourced and a
  golden test verifies the JS and Swift planes agree force-for-force (`gen:force-catalog`). The Swift
  macOS and iOS-Simulator builds + tests are CI gates.
- **Parity (honest):** the web plane moves first. Core forces, the scheduler/registries, formations,
  and the interactive scenes are present; the newest primitives (the field-channel read/write surface,
  the most recent reactive-component work) are **not yet ported**. Status is **preview** — stable in
  shape, trailing the web on the newest additions.
- **Consumption:** build from source (the SwiftPM package name is `Fundamental`, in `swift/`); no
  published registry release yet. See `swift/README.md`, the site's Swift guide
  (`/docs/guides/swift`), and the Implementations page (`/docs/implementations`).

## Native (Kotlin) — Android

The engine also ships as a native **Kotlin port** (`android/`) — a port of the JS engine on the same
terms as Swift, not a reinterpretation: the Gradle module layout, the API surface, and the physics
mirror the npm packages (and the Swift package) one-to-one.

| Module | Support | Notes |
|---|---|---|
| `:fundamental-core` | ✅ supported | the pure physics — full 36-force surface + integrator + `FieldHandle` (incl. relationship edges); zero Android deps, plain `kotlin("jvm")` |
| `:fundamental-platform` | ✅ supported | the six-phase scheduler (`discover→read→compute→state→write→render`) + the six registries (measurement / state / feedback / relationship / visual-binding / overlay), driven by an injected `FieldHost`; zero Android deps, plain `kotlin("jvm")` |
| `:fundamental-compose` (Compose host) | ✅ supported (preview) | Jetpack Compose adapter — `FieldView` composable + `Modifier.fieldBody()`; verified on-device (Pixel 7 / API 35) |
| `:fundamental-android` (non-Compose host) | ✅ supported (preview) | imperative `View`/`Canvas` host — `FieldFieldView` (custom `View`, `Choreographer`-driven, draws in `onDraw`) + `AndroidFieldHost` |
| `:lab` (desktop FieldLab) | ✅ supported | JVM Swing/Java2D FieldLab over the same core — live canvas + headless render/bench, no emulator |

Five modules map to the npm / Swift packages: `:fundamental-core` ↔ `@fundamental-engine/core` ↔
`FundamentalCore` (zero Android imports, the mirror of core's zero-DOM rule), `:fundamental-platform`
↔ `@fundamental-engine/dom` ↔ `FundamentalPlatform`, `:fundamental-android` ↔
`@fundamental-engine/vanilla` ↔ `UIKitFieldHost`, `:fundamental-compose` ↔ `@fundamental-engine/react`
↔ `FundamentalSwiftUI`, `:lab` ↔ `FieldLab`.

- **Cross-plane conformance is enforced**, not asserted: the Kotlin engine is held to the **same**
  shared golden (`conformance-golden.json`) as JS and Swift — `GoldenConformanceTests` syncs that exact
  fixture onto its test classpath and reproduces every force delta within tolerance. The Android build
  (core conformance + host assembly) is a CI gate (`android.yml`), re-run whenever the golden changes.
- **Parity (honest):** like the web, the JS plane moves first. Core forces, the integrator, the
  scheduler/registries, the `FieldHandle` API (incl. relationship edges), formations, recipes, and
  overlays are present; the matter-render extras (metaballs / voronoi) and the declarative `[data-body]`
  view scanner remain follow-ups. Status is **preview** on the hosts — stable in shape, trailing the web
  on the newest additions.
- **SDK requirements:** the host modules build against the Android SDK — **compileSdk 34, minSdk 24**
  (build-tools 34.0.0, AGP 8.7, Kotlin 2.1, Compose BOM 2024.12, Gradle wrapper 8.13). The pure
  `:fundamental-core` and `:fundamental-platform` are plain `kotlin("jvm")` and build/test on **any
  JDK-17** with no Android SDK.
- **Consumption:** build from source (Gradle, in `android/`); no published registry release yet. See
  `android/README.md`.

## Device pixel ratio (DPR)

The field renders at the device DPR, **capped** to keep fill-rate bounded (the field is fill-rate-bound,
not particle-bound). `dprCap` (option / `dpr-cap` attribute, default 2) sets the ceiling; the adaptive
quality tiers (`setQualityTier`, applied automatically by `<field-root>`) drop the effective DPR under
load (`TIER_DPR = [∞, 1.5, 1.25, 1]`). *Pinned by:* `core/dpr-cap.test.ts`, the quality-tier tests.

## Reduced motion

`prefers-reduced-motion: reduce` is honored end-to-end via `host.reducedMotion()`:

- **Engine** — integration freezes (`dt = 0`): no particle travel, no boot animation, no sparks, draw
  quarter-rated. *Pinned by:* `core/reduced-motion.test.ts` (particles provably don't move under reduce,
  and provably do without it).
- **Recipes / examples** — `applyRecipe` renders the static, meaning-preserving fallback instead of
  driving the field; emission alpha flattens, travel drops, focus is kept. *Pinned by:*
  `contracts/a11y.test.ts` ("meaning survives without motion").

## SSR / hydration

`@fundamental-engine/core` imports **zero DOM** (enforced by `core/dom-boundary.test.ts`); every
environment touch goes through the injected `FieldHost`. So the packages **import and construct on the
server** — `document`/`window` absent — and the field only reaches for the DOM client-side, through
`browserHost()`. The SSR-natural mode is `render: 'none'` (no context, no backing store, pure signals);
the particle surface is opt-in after hydration. *Pinned by:* `core/ssr.test.ts` (DOM globals absent → the
public surface still constructs, runs, and tears down).

## Accessibility (RC-8)

The field is **decorative ambiance**, and its accessibility posture follows from that one fact:

- **Hidden from assistive tech.** `<field-root>`/`<field-cell>` set `aria-hidden="true"` on connect (and
  on the overlay canvas), so a screen reader announces nothing for the field. Semantic HTML stays the
  source of meaning; the field is a behavior + visualization layer on top.
- **Motion is never the sole carrier of meaning.** The reduced-motion fallback is *required* and guarded;
  color/glyph are not the sole carriers (the visual lint enforces it). *Pinned by:* `contracts/a11y.test.ts`
  (the Accessibility Contract, its reduced-motion-fallback guard, the color/glyph lint, event
  thresholding).
- **No motion-induced reflow or focus theft.** The field canvas is `position: fixed`, click-through
  (`pointer-events: none`), and outside the tab order.

### AT-pass log

The automated accessibility invariants above run in CI on every change. The manual assistive-tech
spot-check (the human half of RC-8) is logged here:

| Date | Tool | Surface | Result |
|---|---|---|---|
| automated | CI (`a11y.test.ts`, `reduced-motion.test.ts`) | engine + recipes | ✅ reduced-motion fallback, semantic-truth, no motion-only meaning |
| _pending_ | VoiceOver / NVDA | fundamental-engine.com homepage + `/eli5` | _maintainer spot-check — confirm the field is skipped and content is fully navigable_ |

> The decorative field being `aria-hidden` means a conforming screen reader walks straight past it to the
> page's real content — the expected pass is "the field is announced as nothing." The pending row is a
> maintainer sign-off (a live VO/NVDA pass), the same hands-on gate as the perf fact sheet.
