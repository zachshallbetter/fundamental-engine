> **Status: canonical.**
> This document governs how field-ui is described across the docs, the site, and the Lab: the canonical
> architecture statement, the core doctrine, the document-status taxonomy, the naming policy, and the
> "verify against code" rule. It is the source of truth for *framing*; the deep topic references are
> [field-ui-platform-architecture.md](field-ui-platform-architecture.md),
> [field-ui-natural-fields.md](field-ui-natural-fields.md),
> [field-ui-system-contracts.md](field-ui-system-contracts.md), and
> [field-ui-definition-document.md](field-ui-definition-document.md).

# field-ui documentation standards

This began as a documentation truth-pass brief; the work it described has shipped, so it is recorded
here as the governing standard rather than a to-do. When docs, pages, force/Lab labels, or examples
are written or revised, they follow the framing below.

## Canonical architecture statement

```
field-ui is a platform-native relational field runtime for the DOM.

@field-ui/core      computes renderer-agnostic field behavior.
@field-ui/platform  binds field behavior to the DOM through measurement, state, feedback,
                    relationships, visual bindings, overlays, linting, and scheduling.
@field-ui/elements  exposes native HTML and web-component authoring.
@field-ui/react     adapts the same contracts for React.

Canvas is one render surface, not the whole system.
```

field-ui creates **one shared field context** across DOM bodies, agents, relationships, measurements,
metrics, feedback, particles, and render surfaces. Canvas, SVG overlays, and DOM feedback are each a
render surface; the platform layer is the DOM participation layer; the core engine stays
renderer-agnostic.

Do not describe field-ui as only "one canvas", "one particle field", "a particle background", or a
"DOM ⇄ canvas binding". Those phrases are fine when specifically discussing the canvas render surface,
but they must not define the whole product. The binding is **DOM ⇄ field runtime**.

## Core doctrine

```
field() is structure.        apply() is cause.        fieldflow carries matter along structure.
agents respond to influence. metrics measure accumulation. renders reveal invisible state.
feedback returns the field to the DOM.
```

Preserve: **Electric fields push. Magnetic fields bend. Fieldflow carries.** Do not make
`magnetism.apply()` follow magnetic field lines — field-aligned transport belongs to `fieldflow`.

## Natural Field Translation System

field-ui does not copy physics into the interface; it **translates** the four fundamental fields into
interface behavior: gravity → priority, electromagnetic → polarity/signal, strong → binding, weak →
transformation. **Natural fields are not tokens; tokens are translations.** Canonical forces
(`attract`, `repel`, …) are designed verbs, not natural translations (`attract` ≠ gravity, `repel` ≠
charge). The classification is data — `FORCE_KIND` / `FORCE_FIELD` / `NATURAL_FIELDS` in
`packages/core/src/config/manual.ts` — and the full model is in
[field-ui-natural-fields.md](field-ui-natural-fields.md). It changes no particle/engine behavior; it
only organizes how each token is explained.

## Current implementation truth

These are shipped and may be described in the present tense (verify specifics against code before
asserting anything new):

```
@field-ui/core · @field-ui/platform · @field-ui/elements · @field-ui/react · @field-ui/vanilla
FrameScheduler (discover → read → compute → state → write → render)
MeasurementRegistry · StateRegistry · FeedbackRegistry · RelationshipRegistry ·
  VisualBindingRegistry · OverlayRegistry · lintPlatform()
the platform runtime is the default for <field-root> (Phase D); core is guarded renderer-agnostic
all render modes (incl. topology, inspector, causality, prediction)
field.flowTo() / clearFlow() controlled flow-field API
Reading Field demo · Accessibility Preview · Narrative Reveal · PNG/SVG diagnostic export
native HTML / web component / React authoring examples
the Natural Field Translation System (four-field classification + /docs/natural-fields)
```

Remaining frontier: moving the canvas render loop out of `core/field.ts` so `@field-ui/core` imports
zero DOM (it is the one allowlisted exception in `core/dom-boundary.test.ts`).

## Document-status taxonomy

Every markdown doc carries a status banner, and the folders mirror it:

- **canonical** (`docs/canonical/`) — current source of truth for product, architecture, contracts, framing.
- **as-built reference** (`docs/engine-reference/`) — accurate engine record, narrower than the whole product.
- **legacy / superseded** (`docs/planning-archive/`) — design history; not authoritative.
- **planning / roadmap** (`docs/planning-archive/`) — forward-looking; must not describe planned work as shipped.

## Naming policy

New code and docs use `--field-*` CSS variables and `field:*` events. The compact `--d` and the
`--forces-*` / `forces:*` families remain as compatibility aliases (the FeedbackRegistry auto-mirrors
`--field-*` → `--forces-*` and `field:*` → `forces:*`). Prefer `--field-density` in examples; mention
`--d` / `--forces-*` only as aliases. Use `field-ui` for the project, packages, and docs.

## Status rule

Do not label anything "shipped" unless the code verifies it. Check the force registry, the manual
config, the render-mode catalog, tests, package exports, the Lab labels, and the docs navigation
before changing a status. Labels: shipped · experimental · planned · conceptual · legacy.

## The frame

```
The old story: field-ui is a particle field behind the DOM.
The new story: field-ui is a platform-native relational field runtime for the DOM.
Natural fields:  Four fields. Many expressions. One DOM runtime.
```
