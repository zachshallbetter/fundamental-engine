> **Status: planning / roadmap.**
> Forward-looking record. Items here may have shipped since — verify against the canonical docs ([../canonical/](../canonical/)) and the code before treating anything as current or as still-pending.

# Docs & showcase overhaul — inventory and plan

> **Historical planning record (completed).** Most of this plan has since shipped: the recipe
> gallery, inspector, snapshots, diagnostics, the accessibility/reduced-motion preview, the
> narrative concept pages, and the authoring-across-surfaces docs are all live. The render modes,
> field-line / dipole / monopole rendering, heatmaps, shaped sources, chargeable bodies, and
> shadow-DOM participation listed below as gaps or TODOs are now part of the shipped surface. Kept
> for provenance; treat the TODO/DONE markers below as the state at the time of writing.

The field-systems work added a lot of surface that lives only in the engine, the internal
specs, and the marketing/Lab demos. This is the inventory of every new detail and concept,
the gap against the public `/docs` portal, and the page-by-page plan to close it.

## Inventory — what's new (the things to document and showcase)

### New engine modules (`packages/core/src/core/`)
- **`geometry.ts`** — shaped-source primitives: `nearestOnRect`, `sdfRect`, `polePair`,
  `dipoleField`, `EPS`, types `Rect`/`AxisRect`/`Pole`.
- **`fieldlines.ts`** — field-line tracing: `traceFieldLine`, `traceFieldLines`, `FieldSample`,
  `FieldLineOpts`.
- **`heatmap.ts`** — the density heatmap buffer: `class Heatmap` (`update`, `norm`, `resize`,
  `cell`).
- **`shadow.ts`** — shadow-DOM participation: `FieldController`, `ShadowRegistry`,
  `RegisterBodyDetail`, the `field:register-body` / `…unregister-body` / `…update-body` events.

### New API surface
- `FieldOptions.heatmap` (default false); `FieldHandle.setHeatmap(on)` (proxied through
  vanilla + elements).
- `Force.field?(b, x, y): Vec2` — the visual/structure field a body projects; powers field-line
  rendering and the streamlines field-flow view (used by `forceAt`).
- `Body.shaped?`, `Body.rect?`, `Body.writeTarget?`.
- `data-shaped` body attribute.
- CSS write-back: `--field-density` (primary; `--d` and `--forces-density` are legacy/compat
  aliases), `--field-heatmap-density`.

### New concepts (the prose to write)
1. **Field lines & the field-flow view** — `Force.field()`, the streamlines render as a
   diagnostic of the real field, and why velocity/charge-dependent forces (magnetism, charge)
   only become visible through `field()`.
2. **Charge is a radial monopole; magnetism is a dipole** — a lone electric charge radiates
   (straight lines out of +, into −); a magnet loops (no magnetic monopoles). The render and
   the physics both reflect this.
3. **Magnetism**: exact rotation (preserves |v|), graded by a `(1 − d/r)` falloff.
4. **Shaped sources** (`data-shaped`) — forces reference the nearest point on the element's box,
   so matter shells the shape instead of bunching at its centre.
5. **Chargeable bodies** — a `data-feedback` body's accumulated density `Q = --field-density` (legacy
   `--d`) sources its own field (radiates up to `1 + Q_GAIN`× stronger): agents → density → DOM →
   field, one shared field context closing the reciprocal loop.
6. **Heatmaps** — a scalar buffer of where matter pools (deposit → decay → glow → write-back),
   not a force; `heatmap` / `setHeatmap` / `--field-heatmap-density`.
7. **Shadow-DOM participation** — host-first, event-driven registration (`FieldController`),
   closed-root support via `getRect`, write-back via `writeTarget`. (Spec: `docs/shadow-dom.md`.)

## Gap — current public-docs coverage

- **Fully absent**: the heatmap option/`setHeatmap`/`--field-heatmap-density`, the `Force.field()`
  hook, field-line / dipole / monopole rendering, the chargeable-body `Q = --d` concept, the whole
  shadow-DOM model.
- **Table/formula only (no concept)**: `data-shaped`, the charge/magnetism physics.
- The internal specs (`forces-fields-plan.md`, `shadow-dom.md`) and the engine catalog are well
  developed; none of it has been promoted into the rendered portal.

## Plan — three workstreams

### 1. API reference (factual) — DONE (commit 18c6f61)
- OPTIONS += `heatmap`; HANDLE += `setHeatmap`; Types page `Force` += `field`/`kinematic`/`source`,
  `Body` += `shaped`/`rect`/`writeTarget`; new "What the field writes back" CSS-var table.

### 2. Concept / guide pages (prose + live demos) — TODO
New pages under `/docs`, each with a live demo and added to `docs-nav.ts`:
- **`/docs/concepts/field-lines`** — `field()`, field-flow, magnetism dipole vs charge monopole.
- **`/docs/concepts/shaped-sources`** — `data-shaped`, the shell vs the blob.
- **`/docs/concepts/chargeable`** — `Q = --field-density` (legacy `--d`) sources the field; the
  reciprocal loop closing.
- **`/docs/concepts/heatmaps`** — the buffer, `setHeatmap`, `--field-heatmap-density`, the glow.
- **`/docs/guides/shadow-dom`** — `FieldController`, the register events, closed roots, write
  targets (promoted from `docs/shadow-dom.md`).
- Update `docs/api/forces` charge/magnetism cards and `concepts.astro` to cross-link the above.

### 3. Showcase overhaul (`pages/examples.astro`) — TODO
Add live, toggleable demos grouped by concept:
- the magnetism dipole + charge monopole field-line diagrams,
- the density heatmap glow (with the nav toggle),
- a `data-shaped` body (shell formation),
- a chargeable element (charges up, radiates more),
- a shadow-DOM component joining the field via `FieldController`.

## Execution order
Workstream 1 (done) → the five concept/guide pages (one commit each, with a demo) → the showcase
demos → a final cross-link/nav pass. Each page ships green (site build) and is verified in preview.
