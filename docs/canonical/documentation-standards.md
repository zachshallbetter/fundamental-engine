> **Status: canonical.**
> This document governs how Fundamental is described across the docs, the site, and the Lab: the canonical
> architecture statement, the core doctrine, the document-status taxonomy, the naming policy, and the
> "verify against code" rule. It is the source of truth for *framing*; the deep topic references are
> [platform-architecture.md](platform-architecture.md),
> [natural-fields.md](natural-fields.md),
> [system-contracts.md](system-contracts.md), and
> [definition-document.md](definition-document.md).

# Fundamental documentation standards

This began as a documentation truth-pass brief; the work it described has shipped, so it is recorded
here as the governing standard rather than a to-do. When docs, pages, force/Lab labels, or examples
are written or revised, they follow the framing below.

## Canonical architecture statement

```
Fundamental is a platform-native relational field runtime.

@fundamental-engine/core  computes renderer-agnostic field behavior.
Host adapters       bind field behavior to concrete platforms.
@fundamental-engine/dom   is the web host adapter: it binds the field to the DOM through
                    measurement, state, feedback, relationships, visual bindings, overlays,
                    linting, and scheduling.

Canvas is one render surface, not the whole system.
```

`@fundamental-engine/elements` and `@fundamental-engine/react` are authoring surfaces **on the DOM host** —
reserve "for the DOM" for the web host adapter and the surfaces built on it, not for the runtime as a
whole. The DOM is the first host, not the boundary of the system: the same core can run headlessly, in
native views (the Swift/Kotlin ports), or against any host adapter that supplies body geometry, identity,
a tick, and a feedback sink.

Fundamental creates **one shared field context** across bodies, agents, relationships, measurements,
metrics, feedback, particles, and render surfaces. Canvas, SVG overlays, and DOM feedback are each a
render surface; a host adapter is the participation layer for its platform; the core engine stays
renderer-agnostic.

Do not describe Fundamental as only "one canvas", "one particle field", "a particle background", or a
"DOM ⇄ canvas binding". Those phrases are fine when specifically discussing the canvas render surface,
but they must not define the whole product. The binding is **host ⇄ field runtime** (on the web,
**DOM ⇄ field runtime**).

## Core doctrine

```
field() is structure.        apply() is cause.        fieldflow carries matter along structure.
agents respond to influence. metrics measure accumulation. renders reveal invisible state.
feedback returns the field to the DOM.
```

Preserve: **Electric fields push. Magnetic fields bend. Fieldflow carries.** Do not make
`magnetism.apply()` follow magnetic field lines — field-aligned transport belongs to `fieldflow`.

## Natural Field Translation System

Fundamental does not copy physics into the interface; it **translates** the four fundamental fields into
interface behavior: gravity → priority, electromagnetic → polarity/signal, strong → binding, weak →
transformation. **Natural fields are not tokens; tokens are translations.** Canonical forces
(`attract`, `repel`, …) are designed verbs, not natural translations (`attract` ≠ gravity, `repel` ≠
charge). The classification is data — `FORCE_KIND` / `FORCE_FIELD` / `NATURAL_FIELDS` in
`packages/core/src/config/manual.ts` — and the full model is in
[natural-fields.md](natural-fields.md). It changes no particle/engine behavior; it
only organizes how each token is explained.

## Current implementation truth

These are shipped and may be described in the present tense (verify specifics against code before
asserting anything new):

```
Fundamental · @fundamental-engine/dom · @fundamental-engine/elements · @fundamental-engine/react · @fundamental-engine/vanilla
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

`Fundamental` imports **zero DOM** — the engine routes the environment through an injected
`FieldHost`; `browserHost()` lives in `@fundamental-engine/dom`, and `createField` requires a host (the
framework entry points wire it). `core/dom-boundary.test.ts` enforces this with an empty allowlist.

## Document-status taxonomy

Every markdown doc carries a status banner, and the folders mirror it:

- **canonical** (`docs/canonical/`) — current source of truth for product, architecture, contracts, framing.
- **as-built reference** (`docs/engine-reference/`) — accurate engine record, narrower than the whole product.
- **legacy / superseded** (`docs/planning-archive/`) — design history; not authoritative.
- **planning / roadmap** (`docs/planning-archive/`) — forward-looking; must not describe planned work as shipped.

## Naming policy

New code and docs use `--field-*` CSS variables and `field:*` events. The `--forces-*` CSS-variable
mirroring has been **removed** — `--d` and the `--field-*` family are the live vars. The `forces:*`
**event** aliases still fire from the engine for compatibility. Prefer `--field-density` in examples;
mention `--d` only as the compact alias. Use `Fundamental` for the project, packages, and docs.

## Status rule

Do not label anything "shipped" unless the code verifies it. Check the force registry, the manual
config, the render-mode catalog, tests, package exports, the Lab labels, and the docs navigation
before changing a status. Labels: shipped · experimental · planned · conceptual · legacy.

## The frame

```
The old story: Fundamental is a particle field behind the DOM.
The new story: Fundamental is a platform-native relational field runtime; the DOM is its first host.
Natural fields:  Four fields. Many expressions. One field runtime, many hosts.
```
