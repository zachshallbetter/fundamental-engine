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
