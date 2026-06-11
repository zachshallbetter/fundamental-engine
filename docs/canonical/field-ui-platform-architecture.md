> **Status: canonical.**
> This document defines the current `@field-ui/platform` architecture as of the runtime-platform
> unification phase (Phase D): the FrameScheduler, the six registries, `lintPlatform()`, the live
> `<field-root>` runtime, and the platform→core boundary. For force/field math see
> [forces-system.md](../engine-reference/forces-system.md); for the data model and contracts see
> [field-ui-definition-document.md](field-ui-definition-document.md) and
> [field-ui-system-contracts.md](field-ui-system-contracts.md).

# field-ui platform architecture

field-ui is a **platform-native relational field runtime for the DOM**. It lets semantic HTML, DOM
elements, particles, relationships, measurements, visual layers, and user interaction participate in
one shared field context. The visible particle canvas is **one render surface**, not the whole
system.

## Package hierarchy

```
field-ui
  renderer-agnostic field, force, particle, metric, diagnostic, and conformance logic.
  Computes field behavior against plain data. Touches no DOM globals (guarded by
  core/dom-boundary.test.ts; the canvas renderer in core/field.ts and the download helper in
  export.ts are the two allowlisted, quarantined exceptions).

@field-ui/platform
  DOM participation: measurement, state, feedback, relationships, visual bindings, overlays,
  scheduling, and linting. Depends on core for contracts; core never depends on it.

@field-ui/elements
  native web components — <field-root> / <field-cell> and the [data-body] authoring contract.

@field-ui/react
  the React adapter over the same contracts (<FieldField>, useFieldField).

@field-ui/vanilla
  the FieldField class for plain TypeScript apps.

@field-ui/kit
  umbrella meta-package — installs the whole suite (core + platform + the three adapters) in one
  dependency. No code of its own; import from the specific package. @field-ui/field-ui is a thin alias.

apps/site · lab · docs
  product surfaces, executable documentation, diagnostics, examples, and previews.
```

Dependency direction is strict and uniform: `elements → platform → core`, `react → platform → core`,
`vanilla → platform → core`. `field-ui` is renderer-agnostic and imports **zero** DOM (enforced
by `core/dom-boundary.test.ts` with an empty allowlist); the browser environment adapter —
`browserHost()`, `createBrowserField()`, and the DOM download helpers — lives in `@field-ui/platform`.
`createField(canvas, opts)` requires `opts.host`; the framework entry points wire `browserHost()` for
you. Compatibility alias packages (`@forces-ui/*`, `forces-ui`) re-export the renamed
families during the migration window.

## The FrameScheduler

The platform runs one shared loop with explicit, ordered phases, so the registries never interleave
reads and writes and thrash layout:

```
discover → read → compute → state → write → render
```

1. **discover** — register/unregister bodies, relationships, and visual bindings (structure changes).
2. **read** — measure the DOM once: snapshot geometry and visibility. The only place layout is read.
3. **compute** — run field/force/agent logic against the immutable snapshot. No DOM.
4. **state** — fold results into the StateRegistry and thresholds. Internal truth, no DOM writes.
5. **write** — flush state to CSS variables, data attributes, ElementInternals, and thresholded events.
6. **render** — draw overlays, field lines, and heatmaps from the registries (read-only).

`createFieldPlatform(root, { strict? })` wires `measure → read` and `flush → write` by default,
installs a read-phase guard (a measurement requested off-phase is recorded, or thrown under
`strict`), and exposes `.scheduler` plus `.on(phase, handler)` so callers hang `discover` / `compute`
/ `state` / `render` handlers off the same loop. `tick(now, viewport)` runs one frame and returns a
report of the phases that ran and any violations.

## The six registries

1. **MeasurementRegistry** — frame-stable geometry. Reads every registered element's box once per
   frame and returns an immutable snapshot, so the rest of the system works from one consistent set
   of rectangles. A `getRect` override supports closed Shadow roots and inner cores. Read-phase only.
2. **StateRegistry** — typed, observable element state (numeric / boolean / string / vector2). This
   is internal truth, distinct from ARIA. CSS and JS both consume it; only feedback writes it.
3. **FeedbackRegistry** — the write phase. Turns held state into CSS custom properties (continuous)
   and thresholded, debounced events (discrete, with hysteresis). Mirrors `--field-*` → `--forces-*`
   and `field:*` → `forces:*` during the alias window. Do not let other modules write CSS variables
   directly. `cssWritesLastFrame()` reports the actual `style.setProperty` calls made during the
   last `flush()` — a mirrored `--field-*`/`--forces-*` pair counts as 2 — which is the real
   per-frame DOM write cost (off-screen elements with active bindings still generate mutations).
   It is distinct from `boundVars().length`, which counts registrations, not writes; the
   DataConsole's write-cost metric reads it.
4. **RelationshipRegistry** — the DOM is a tree, but interfaces are graphs. Normalizes the
   relationships HTML/ARIA already express (`a[href#id]`, `label[for]`, `aria-controls` /
   `-describedby` / `-labelledby` / `-flowto`, `data-field-relation` / `-target`) into one typed
   graph, mapped onto core `RelationshipAgent`s.
5. **VisualBindingRegistry** — binds an expressive visual layer (SVG, Canvas, WebGL) to its semantic
   DOM source without duplicating meaning. The visual is `aria-hidden` unless it carries independent
   meaning; `lint()` flags orphan and un-hidden visuals. Bindings can be authored declaratively:
   mark the visual with `data-field-visual-for` (the source's id or selector) and
   `data-field-visual-role` (`decorative` · `representation` · `debug` · `relationship` ·
   `measurement`), then call `platform.visuals.scan(root)`. `scan()` resolves each source, binds it,
   and returns `{ total, bound, unresolved, warnings }`. It is idempotent (keyed by the visual
   element, so re-scanning updates role/source and prunes disconnected visuals) — safe to re-run after
   navigation. `representation` and `relationship` roles require a resolved source; a missing one is
   reported as unresolved rather than throwing.

   **State mirroring (the Bound Visual Sink tier).** CSS custom properties don't cross to siblings,
   so the registry mirrors them: with `setMirroring(true)` — the `createFieldPlatform` default —
   every `representation`/`measurement` visual receives its source's feedback channels
   (`MIRRORED_CHANNELS`: `--d`/`--field-density`/`--forces-density`, `--load`/`--mass`, `--lit`,
   `--entropy`/`--coherence`/`--temperature`, `--field-heatmap-density`) copied onto its own inline
   style — an `aria-hidden` SVG beside a sink heading thickens its contours from `var(--load)`
   exactly as authored. Change-gated via a MutationObserver on the source's style attribute: a quiet
   field costs nothing. `decorative`/`debug` roles never mirror. The platform runtime
   (`startPlatformRuntime`) scans declarative visuals at start; dynamically added visuals need a
   `platform.visuals.scan()`.

   - **Implemented:** the registry, declarative binding via `data-field-visual-for` /
     `data-field-visual-role` (`scan()`), the accessibility lint, and source→visual state mirroring
     (`setMirroring` / `mirrorNow` / `MIRRORED_CHANNELS`).
   - **Glyph outlines (the Contour Sink tier):** `contours.ts` is the font-agnostic primitive —
     `contourPathData(font, text, size)` (pure layout: per-glyph + pair kerning, Latin display
     scope) and `contourSvgFor(el, font)` (generates the aria-hidden ring SVG from the element's
     OWN text and computed size, binds it via `data-field-visual-for`, receives mirrored state).
     The caller supplies the parsed font — any `ContourFont`-shaped object; opentype.js satisfies
     it directly — so the primitive works with whatever face the author applied to the body, and
     field-ui keeps its zero-dependency rule. The same primitive runs at build time (the site's
     `gen-contours.mjs` commits its output). Automatic font-binary discovery from the element's
     CSS, complex-script shaping, and true offset contours (polygon offsetting) remain future
     work.
6. **OverlayRegistry** — relationship lines, field lines, debug layers. Render layers only: they read
   from the relationship + measurement registries and produce geometry to draw. They never own
   relationships or mutate physics. *Overlays reveal. They do not define.*

## Platform lint

`lintPlatform(platform)` aggregates pure guardrail rules that surface the quiet failures of a field
system:

- `relation-target-missing` — `[data-field-relation]` with a missing or unresolvable target.
- `state-unregistered` — an element holds field state but was never registered for measurement.
- `overlay-without-links` — a relationship overlay with no relationships behind it.
- `feedback-non-css-var` — a binding that writes ARIA/attributes instead of a `--field-*` variable.
- `measurement-off-phase` — a layout read recorded outside the read phase.
- `visual-orphan` / `visual-not-hidden` — accessibility hazards from `VisualBindingRegistry`.

Lint reads. It never mutates state, physics, or the DOM.

## The live runtime (Phase D)

Since Phase D the platform runtime is the **default** for every `<field-root>`. The legacy engine
(`core/field.ts`) still simulates and renders the canvas, while the platform owns DOM participation:

- **D1** — a platform-backed `<field-root>` path behind an experimental flag.
- **D2** — body discovery/measurement routed through MeasurementRegistry (`bodyElements` is the one
  selector source of truth shared with the legacy scanner).
- **D3** — CSS-variable + event feedback routed through FeedbackRegistry via a `feedbackSink` seam in
  `createField`; the eased density signal is unchanged, only the write target moves. Since #228 the
  sink contract is the engine's **only** feedback write path: when no platform sink is configured
  (raw `createField`, `@field-ui/vanilla`, recipe-scoped engines), the engine installs an internal
  default sink (`core/feedback-sink.ts`) whose direct writes are byte-identical to the historical
  behavior — same variables (`--d`/`--forces-density`/`--field-density`, the heatmap mirror pair,
  `--load`/`--mass`, `--lit`), same three-decimal formatting, same `field:lit`/`field:dim`
  hysteresis. There is no direct-write branch left in the engine loop.
- **D4** — Shadow-DOM host registration handled by the platform (the host's `getRect` flows into
  MeasurementRegistry).
- **D5** — the relationship graph discovered and maintained in the running field-root.
- **D6** — the platform runtime flipped to default after parity. Opt back to the pure-legacy path per
  element with `experimental-platform="off"`, or globally with `usePlatformRuntime(false)`.
- **D7** — the legacy DOM glue quarantined behind a renderer-agnostic boundary guard
  (`core/dom-boundary.test.ts`), so core stays DOM-free outside the two allowlisted modules.

**Frontier — done:** `core/field.ts` (the engine + canvas render loop) no longer touches any DOM
globals. It routes every environment touchpoint (viewport, scroll, rAF, reduced-motion, visibility,
scan root, events) through an injected `FieldHost`; `browserHost()` and the DOM download helpers moved
to `@field-ui/platform`. `core/dom-boundary.test.ts` now runs with an **empty allowlist** — every
source file in `field-ui` is provably DOM-global-free, so the engine is portable to any renderer
(Canvas, WebGL, WebGPU, native, headless) via a custom host.

## Attaching the engine handle

The platform runtime starts before the engine handle exists: `startPlatformRuntime(root)` begins
scheduling as soon as `<field-root>` connects, while `createField()` runs later in the element's
start path. `PlatformRuntime.attachHandle(handle)` (`packages/elements/src/platform-runtime.ts`)
wires the two post-hoc. Once a handle is attached:

- The **write phase** writes `--field-scroll-v` — the handle's eased scroll velocity,
  `scrollV()`, formatted to three decimals — to `:root` each frame, deduped when the value is
  unchanged so idle frames stay mutation-free. It is written directly, **not** through
  FeedbackRegistry: it is a page-global, not a per-body channel, so it does not count toward
  `cssWritesLastFrame()`.
- The **QualityGovernor** begins monitoring frame spacing (the governor is reset on attach, so
  detection starts from full quality).

## The QualityGovernor

`QualityGovernor` (`packages/platform/src/governor.ts`) detects sustained frame-budget overruns
and emits a coarse tier signal. The split is deliberate: the governor detects, the caller
responds.

| Tier | Meaning | Escalates after |
|---|---|---|
| 0 | full quality (default) | — |
| 1 | effects reduced | 10 consecutive frames > 20 ms |
| 2 | minimal | 5 consecutive frames > 33 ms |
| 3 | paused | 3 consecutive frames > 50 ms |

Recovery is asymmetric to avoid thrashing at the boundary: dropping back down requires **30
consecutive clean frames per tier step**. `reset()` returns to tier 0 and clears both streaks.

The `<field-root>` runtime feeds the governor rAF-to-rAF spacing, skips discontinuity frames
(gaps > 500 ms — background tabs, system sleep, debugger pauses — are timing artifacts, not
budget overruns), resets it on `visibilitychange`, and dispatches a `field:quality-tier`
CustomEvent (bubbles, composed, `detail: { tier, durationMs }`) from the scan root whenever the
tier changes. One consumer is built in: at tier 2 the platform tick — measurement, feedback
writes, relationship discovery — runs every 2nd frame, at tier 3 every 4th. The engine keeps
simulating at full rate; only the platform's DOM read/write cadence drops. Engine-side responses
(render simplification, particle caps) are the embedder's to wire via the event — that surface is
unfrozen/experimental.

## Reading Field

[/docs/reading-field](https://field-ui.com/docs/reading-field) is the flagship demonstration: an
ordinary content page (sections, headings, citations, a table of contents) wired to
`createFieldPlatform`, exercising every registry through the scheduler. Sections are measured bodies;
viewport-centre proximity becomes attention; attention accumulates into memory; the table of contents
reflects memory and the current section; citations become relationships. Reduced motion loses no
meaning — state still tracks; only CSS easing drops. It proves the substrate on prose, without
spectacle.

## Authoring across surfaces

The same field body is authored three ways, all compiling to the same `[data-body]` contract:
native HTML (`createField` + `[data-body]`), the web component (`<field-root>` + `[data-body]`), and
React (`<FieldField>` + `[data-body]`). See [field-ui-authoring-and-recipes.md](field-ui-authoring-and-recipes.md)
and the live `/docs/authoring` page.
