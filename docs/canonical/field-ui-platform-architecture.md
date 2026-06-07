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
field-ui (@field-ui/core)
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

apps/site · lab · docs
  product surfaces, executable documentation, diagnostics, examples, and previews.
```

Dependency direction is strict: `elements → platform → core`, `react → platform → core`,
`vanilla → core`. Compatibility alias packages (`@forces-ui/*`, `forces-ui`) re-export the renamed
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
   directly.
4. **RelationshipRegistry** — the DOM is a tree, but interfaces are graphs. Normalizes the
   relationships HTML/ARIA already express (`a[href#id]`, `label[for]`, `aria-controls` /
   `-describedby` / `-labelledby` / `-flowto`, `data-field-relation` / `-target`) into one typed
   graph, mapped onto core `RelationshipAgent`s.
5. **VisualBindingRegistry** — binds an expressive visual layer (SVG, Canvas, WebGL) to its semantic
   DOM source without duplicating meaning. The visual is `aria-hidden` unless it carries independent
   meaning; `lint()` flags orphan and un-hidden visuals.
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
  `createField`; the eased density signal is unchanged, only the write target moves.
- **D4** — Shadow-DOM host registration handled by the platform (the host's `getRect` flows into
  MeasurementRegistry).
- **D5** — the relationship graph discovered and maintained in the running field-root.
- **D6** — the platform runtime flipped to default after parity. Opt back to the pure-legacy path per
  element with `experimental-platform="off"`, or globally with `usePlatformRuntime(false)`.
- **D7** — the legacy DOM glue quarantined behind a renderer-agnostic boundary guard
  (`core/dom-boundary.test.ts`), so core stays DOM-free outside the two allowlisted modules.

**Remaining frontier:** the canvas render loop itself still lives in `core/field.ts`. Moving
rendering onto the platform so core imports zero DOM is future work beyond Phase D.

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
