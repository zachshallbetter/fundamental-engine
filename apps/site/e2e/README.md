# e2e — the invisible-fields suite

Playwright specs that pin the hand-verified invariants of the twelve example pages at
`/evidence` and `/evidence/<slug>`.

Three projects share one webServer (see `playwright.config.ts`):

- **chromium** and **webkit** run the full desktop suite — the sparkline regression this
  suite exists to prevent was WebKit-specific, so chromium-only coverage could never
  catch its class.
- **mobile** (Pixel 7 emulation: ~412px, `isMobile`, `hasTouch`) runs only
  `mobile.spec.ts` — the emulated-touch QA pass over all twelve pages (#299): no
  horizontal overflow, the chip-strip sidebar, the backlog long-press touch drag, the
  calendar week scroll-snap strip, the market mobile tiers, and a memory review by tap.
  Touch gestures go through CDP `Input.dispatchTouchEvent`, so the browser's real
  gesture arbitration (touch-action latching, scroll claiming, pointercancel) is what
  gets tested.

The suite runs against the **built** site (`astro preview` serves `dist/`), so build first:

```sh
pnpm --filter @field-ui/site build   # packages' dist must already be built (pnpm build at the root)
pnpm --filter @field-ui/site test:e2e
```

Every test blocks non-localhost network (see `fixtures.ts`), so the live-data loops fail
politely and the pages stay on their committed snapshots — the chips read "snapshot · …",
which is the designed offline behavior. Reduced motion is NOT emulated: the FLIP paths are
part of what the suite pins.

## Known WebKit quirks

**Custom-element upgrade timing.** `Base.astro` defers `import('@field-ui/elements')` to
`requestIdleCallback`, which Safari does not implement — it falls back to
`setTimeout(300)`. Imperative method calls on `<field-root>` made before that timer fires
land on a bare `HTMLElement` and are silently dropped. The `home.spec.ts` natural-field
picker test (`data-forcepick` block) once flaked here: `setOverlay('streamlines')` was
called at IntersectionObserver entry, which can fire before the element upgrades under
WebKit.

The fix is canonical: **drive long-lived field state through attributes**, not methods.
Attributes written pre-upgrade become the engine's construction-time config; post-upgrade
they forward through `attributeChangedCallback`. See §2 of `docs/engineering-practices.md`.

When writing tests that poll canvas pixels on WebKit: guard against a canvas that exists in
the DOM but has not yet been sized (width/height = 0) or was created after your first poll.
A thrown `evaluate` aborts `expect.poll` for good — return a sentinel (`-1` or `null`) until
the resource is ready rather than assuming it exists.
