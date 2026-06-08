> **Status: canonical.**
> The Field Agent Consumption Model: the unified account of *what a force acts on* and *how each
> target consumes the influence*. Particles, DOM elements, and event sinks are all **agents**; each
> owns a **consumer** that turns one influence into its own kind of change. Body Matter Interaction
> (the sink/accretion behavior) is a submodel here, not a separate model. Every status label below was
> verified against the code (`packages/core/src/agents`, `packages/core/src/forces`,
> `packages/core/src/core/field.ts`, `packages/platform`) and follows the
> [documentation standards](field-ui-documentation-standards.md) status rule: nothing is called
> *shipped* unless code confirms it. Deeper references:
> [system-contracts §5–§9](field-ui-system-contracts.md),
> [interaction-and-relationship-model](field-ui-interaction-and-relationship-model.md),
> [forces-system §22](../engine-reference/forces-system.md).

# Field Agent Consumption Model

A force does not "move particles." A force produces an **influence at a location**; whatever sits
there — a particle, a DOM element, an event sink — decides how to consume it. Particles are just the
**lightest** agents. An element is a *heavy* body with a DOM consumer; an event sink is a *write-only*
agent. One DOM body can be all three at once: sourcing force, being pushed by neighbors, and firing
events.

This is the correct framing. It is **not** a new "Body Matter Interaction" model — that older, narrower
idea (bodies absorb particles) is one **submodel** of this one. The general statement is:

```
A field body can be more than a force source.
It can be a particle source/receiver, a density receiver, a force target, and an event host.
Particles, elements, and event sinks can consume the same influence in different ways.
```

## Agent types

`FieldAgentKind` (`packages/core/src/agents/index.ts`) — seven kinds, all present in code with concrete
modules and agent contracts (`AGENT_CONTRACTS`, same file):

| Agent | What it is | Consumes / does | Status |
|---|---|---|---|
| **particle** | visual matter | velocity impulse + heat; held in a sink core | **shipped** |
| **element** | a DOM responder | metrics → `--field-*` vars + `data-field-*` bands; moved as a transform (`data-move`) | **shipped** |
| **relationship** | an active connection | strength/tension/memory; strengthens with use, decays idle; transfers attention | **shipped** |
| **user** | pointer / focus / selection | projects a field source (wake + accessible focus); respects reduced motion | **shipped** |
| **layout** | a region-level responder | aggregates contained body metrics over a rect; writes back like an element | **shipped** |
| **data** | a semantic record | salience ∈ [0,1] that decays unless reinforced | **shipped** |
| **event** | a threshold trigger | hysteretic, debounced edge detection → one clean edge per crossing | **shipped** |

Two things the broader framing sometimes calls "agents" are **not** field agents — they are platform
concerns, and the distinction matters:

- **visual layer** — the [VisualBindingRegistry](field-ui-platform-architecture.md) pairs an expressive
  visual (SVG/Canvas) with its semantic source for linting and inspection. It participates in
  accessibility, not physics. See [Text and the visual layer](#text-and-the-visual-layer).
- **event sink** — not a distinct agent kind; it is the **event-host role** a body plays through
  `data-on` (the `event` agent above provides the threshold machinery).

## Influence kinds → how each agent consumes them

Every force emits one of a few **influence kinds**. The matrix is the spec, and each cell carries its
own status. *This corrects the older unannotated matrix in
[forces-system §22.3](../engine-reference/forces-system.md), which once presented unbuilt cells as if
equal to shipped ones.*

| Influence (from force) | Particle | Element | Event sink |
|---|---|---|---|
| **impulse** `Δv` (attract, repel, wind, stream…) | `v += F/m` — **shipped** | `o_v += F/m_el` → `translate(o)` via `data-move` — **shipped** | — |
| **constraint** (tether, wall, gate) | clamp pos/vel — **shipped** | anchor tether + offset clamp (`maxOffset`) — **shipped** | — |
| **capture** (sink) | `p.cap = b`, held then released — **shipped** | dock / collapse the element via `data-dock` — **shipped** | fire `field:captured` / `field:released` — **shipped** |
| **relocate** (warp) | `warp` throat → paired body, conserved — **shipped** | teleport offset to the pair via `data-warp` — **shipped** | — |
| **emit** (spawn) | new particle — **shipped** | clone a decorative template via `data-emit` — **shipped** | — |
| **trigger** (threshold) | sets heat / state — **shipped** | toggle a class — **planned** (no built-in; do it in a `data-on` handler) | dispatch a `CustomEvent` via `data-on` — **shipped** |
| **feedback** (gathered field → output) | `--d` / density — **shipped** | `--field-*` vars + `data-field-*` bands — **shipped** | — |

"Apply a force to a DOM element" = it consumes the *same* impulse a particle would, but as a
**transform** (with element mass `m_el`) instead of raw velocity. "Apply a force to an event" = the
influence, on crossing a threshold, becomes a **signal**.

**The honest summary:** every influence kind is now wired for particles, and elements consume impulse,
constraint, feedback, capture (`data-dock`), relocate (`data-warp`), and emit (`data-emit`). The
element consumers are **opt-in by attribute**, so they never surprise existing `data-move` content, and
they stay accessible — docked elements are restored on release, emitted clones are `aria-hidden`. The
one still-planned cell is the element `trigger` *class toggle* (do it in a `data-on` handler today).
Element relocate is a **transform teleport**, not a DOM-tree reorder: reordering nodes would disrupt
focus and reading order, so it is intentionally avoided.

## Body roles

A single DOM body can play up to four roles at once. All four are **shipped**
([forces-system §22.1](../engine-reference/forces-system.md)):

| Role | Mechanism | Status |
|---|---|---|
| **source** | `data-body` tokens emit force onto particles | **shipped** |
| **density receiver** | gathered field → `--field-density` (alias `--d`), gated by `data-feedback` | **shipped** |
| **force target** | `data-move` integrates net force into a transform | **shipped** |
| **event host** | `data-on` binds field state to `CustomEvent`s; saturated bodies fire `field:lit`/`field:dim` | **shipped** |

## Body Matter Interaction (submodel)

The concrete, fully shipped particle-level case. A `sink` body captures matter into an accretion core,
**holds** it (it is not deleted), and **releases exactly what it held** when saturated.

```html
<section data-body="sink attract" data-absorb="64" data-max="30" data-feedback>
  Accretion body
</section>
```

| Piece | Meaning | Code | Status |
|---|---|---|---|
| `sink` token | the only capture token | `packages/core/src/forces/index.ts` | **shipped** |
| `attract` | pulls particles toward the body | `forces/index.ts` | **shipped** |
| `data-absorb` | capture radius (`absorbR`, default 64) | `scanner.ts` | **shipped** |
| `data-max` | capacity (`capacity`, default 60) | `scanner.ts` | **shipped** |
| capture | `p.cap = b`; the particle stays in the pool, drifts to the core | `integrator.ts` | **shipped** |
| `--load` | `accreted / capacity` ∈ [0,1], written each frame | `field.ts` | **shipped** |
| `--mass` | back-compat **alias** of `--load` (identical value) | `field.ts` | **legacy** alias |
| release | saturation → `supernova` releases exactly the held particles, then resets | `field.ts` | **shipped** |

Terminology, per the [status rule](field-ui-documentation-standards.md): **`sink` is the runtime
token.** `absorb` is **not** a token — only the `data-absorb` *attribute* exists. Treat `absorb` as
concept/legacy language. `--load` is canonical; `--mass` is the alias.

**Test coverage:** capture-within-radius and saturation-triggers-supernova are unit-tested
(`forces.test.ts`), and the full hold → release cycle — captured matter stays in the pool, drifts to
the core, then the *same* particles are released (conserved, count unchanged) — is covered end-to-end
through the real integrator in `accretion.test.ts`. The release core is the pure, DOM-free
`releaseCaptured` (`accretion.ts`), shared by `field.ts` and the test.

**Element capture (dock).** A `[data-move][data-dock]` element that drifts into a sink's `absorbR`
docks: it collapses toward the core (translate + scale → 0) and is held until the sink releases
(supernova), which restores it. Docked elements become `aria-hidden` while collapsed and are restored
on release and on teardown — element capture is conserved like particle capture. The collapse math is
the pure `dock.ts` (`withinCapture` / `stepDock` / `dockTransform`), tested in `dock.test.ts`.

## Events

Field events are thresholded and debounced — never per-frame by default. The canonical catalog is
`FIELD_EVENTS` (`packages/core/src/agents/event-agent.ts`); `field:*` mirrors to `forces:*` during the
alias window (`FeedbackRegistry`, `shadow.ts`).

**Dispatched today (shipped):**

- `field:lit` / `field:dim` — density crosses the lit threshold (`field.ts`; also `FeedbackRegistry`).
- `field:register-body` / `field:unregister-body` / `field:update-body` — body lifecycle (`shadow.ts`).
- `field:captured` / `field:released` — a sink begins accreting (rising edge of `accreted > 0`) and
  releases on supernova (falling edge); also fired on a docked element when it docks / is restored.
- `field:relocated` — a `[data-warp]` element teleports through a warp throat to its pair.
- **any event name you bind via `data-on`** — e.g. `data-on="captured:field:dock, dense:field:lit"`.

Every `field:*` here mirrors to its `forces:*` twin during the alias window.

**Names reserved, not yet dispatched (planned):** `field:saturated`, `field:entered`, `field:exited`,
`field:attention-shifted`, `field:relationship-strengthened`, `field:memory-threshold`,
`field:entropy-warning` — the agent-threshold events, still wiring up.

**Edge nuance.** `field:captured`/`released` are edge-debounced on `accreted > 0`. Release is fired
directly from `supernova` so a same-frame fill-and-release never drops it; the rising-edge capture is
sampled after the force pass (the same model as the `captured` `data-on` trigger).

## Text and the visual layer

Text is a special case of the same model, governed by a design law
([forces-system §11](../engine-reference/forces-system.md),
[visual-language-and-geometry](field-ui-visual-language-and-geometry.md)):

> Words are bodies the field decorates; punctuation is where matter assembles.

- The semantic text stays **real HTML** — the source of meaning, in the accessibility tree.
- A text element can register as a **field body**: source, density receiver, capture (sink), or event
  host like any other.
- **Density drives type**, not particles: `--field-density` (alias `--d`) feeds variable-font weight
  (`data-fmin`/`data-fmax`/`data-opsz`), glow, and color. **shipped.**
- **Do not assemble words out of particles** — it reads as noisy. Reserve glyph/particle assembly for
  punctuation and marks (a `.`, `—`, a logo glyph), where the silhouette is simple. (design law)
- A vector/SVG/Canvas layer may **represent** the text, but it is **not** the source of meaning. Bind
  it declaratively with `data-field-visual-for` + `data-field-visual-role="representation"` and keep it
  `aria-hidden` — the [VisualBindingRegistry](field-ui-platform-architecture.md) discovers, binds, and
  lints the pairing. **shipped** (binding + lint). Generating glyph geometry *from* text
  (outline extraction, text → SVG path) is **planned**, tracked as a frontier.

```html
<h1 id="title" data-body="sink attract" data-absorb="72" data-max="36" data-feedback>Contour Field</h1>
<svg data-field-visual-for="title" data-field-visual-role="representation" aria-hidden="true" focusable="false">…</svg>
```

The `h1` is the semantic source **and** a field body; `--field-density` / `--load` expose its state; the
SVG is a bound representation, not the meaning. Particles and contours are **expression**.

## Hierarchy at a glance

```
Field Agent Consumption Model
  Agent types:        particle · element · relationship · user · layout · data · event   (all shipped)
  Influence kinds:    impulse · constraint · capture · relocate · emit · trigger · feedback
                      (per-agent status in the matrix; only the element trigger class-toggle is planned)
  Body roles:         source · density receiver · force target · event host              (all shipped)
  Submodel — Body Matter Interaction:
    source · attract/repel/shape · capture (sink) · hold · release · expose feedback     (shipped)
    dock an element (data-dock) · emit a node (data-emit) · relocate/teleport (data-warp) (shipped)
```
