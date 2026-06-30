> **Status: canonical.**
> The Field Agent Consumption Model: the unified account of *what a force acts on* and *how each
> target consumes the influence*. Particles, DOM elements, and event sinks are all **agents**; each
> owns a **consumer** that turns one influence into its own kind of change. Body Matter Interaction
> (the sink/accretion behavior) is a submodel here, not a separate model. Every status label below was
> verified against the code (`packages/core/src/agents`, `packages/core/src/forces`,
> `packages/core/src/core/field.ts`, `packages/dom`) and follows the
> [documentation standards](documentation-standards.md) status rule: nothing is called
> *shipped* unless code confirms it. Deeper references:
> [system-contracts §5–§9](system-contracts.md),
> [interaction-and-relationship-model](interaction-and-relationship-model.md),
> [forces-system §22](../engine-reference/forces-system.md),
> [substrate-api](substrate-api.md).

> **Agent-readable surface (shipped).** A software/AI agent no longer has to scrape the DOM or read
> per-body `--field-*` channels to understand the field: `field.query()` and `field.snapshot()` return
> the live model — bodies, metrics, relationships, and per-force influence — as plain structured data,
> and the projection registry's `agent-json` surface lets a Field Formation expose a tailored reading.
> `query()` is *the* substrate's agent-/tool-readable surface; see [substrate-api.md](substrate-api.md).

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

- **visual layer** — the [VisualBindingRegistry](platform-architecture.md) pairs an expressive
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
| **trigger** (threshold) | sets heat / state — **shipped** | toggle a class via `data-class` — **shipped** | dispatch a `CustomEvent` via `data-on` — **shipped** |
| **feedback** (gathered field → output) | `--d` / density — **shipped** | `--field-*` vars + `data-field-*` bands — **shipped** | — |

"Apply a force to a DOM element" = it consumes the *same* impulse a particle would, but as a
**transform** (with element mass `m_el`) instead of raw velocity. "Apply a force to an event" = the
influence, on crossing a threshold, becomes a **signal**.

**The honest summary:** every influence kind is now wired for particles, and elements consume impulse,
constraint, feedback, capture (`data-dock`), relocate (`data-warp`), emit (`data-emit`), and trigger
(`data-class`). The element consumers are **opt-in by attribute**, so they never surprise existing
`data-move` content, and they stay accessible — docked elements are restored on release, emitted clones
are `aria-hidden`. The element `trigger` *class toggle* is `data-class="dense:lit, captured:full"`: the
same `trigger:value` grammar `data-on` uses, but the value is a class name added while the trigger
holds and removed when it releases (the no-JS counterpart of a `data-on` handler calling
`classList.toggle`). Element relocate is a **transform teleport**, not a DOM-tree reorder: reordering
nodes would disrupt focus and reading order, so it is intentionally avoided.

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
| discharge | an engagement-gated sink (`data-when="active"`) releases on the FALLING edge of attention — same conserved ritual, same events (#365) | `accretion.ts` `dischargeDisengaged` | **shipped** |

Terminology, per the [status rule](documentation-standards.md): **`sink` is the runtime
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

### The sink tiers (one contract, four surfaces)

The law that orders the whole hierarchy:

> **The element absorbs field matter. The visual layer shows what that absorption means. The
> semantic text remains the source of meaning.**

One sentence for the combined concept: *a body-sink lets a semantic element act as a vessel — it
captures field matter, exposes its load as feedback, and may release that matter back into the
field, while any SVG, Canvas, or vector layer remains a bound visual representation of the semantic
source.*

```
Body Matter Interaction
  Sink / Accretion
    Element Sink        — any DOM element as the vessel (the base contract above)
    Text Sink           — the same contract on real text; the heading stays real text,
                          CSS reads --d / --load for field-responsive typography
    Bound Visual Sink   — an authored aria-hidden visual (SVG/Canvas) beside the body,
                          bound via data-field-visual-for; the platform MIRRORS the
                          body's feedback channels onto it (visual-bindings.ts,
                          MIRRORED_CHANNELS), so var(--load) works on the sibling
    Contour Sink        — the text/vector form: glyph outlines as the expressive
                          boundary of a Text Sink. The platform primitive is
                          font-agnostic (contours.ts: contourPathData / contourSvgFor —
                          the caller supplies ANY parsed font; opentype.js fits the
                          ContourFont contract), usable at runtime or build time (the
                          site commits its output) — live at /docs/contour-typography
```

| Tier | Contract | Status |
|---|---|---|
| Element Sink | `data-body="sink …"` + `data-absorb`/`data-max`/`data-feedback` → `--load` | **shipped** |
| Text Sink | identical — text elements are ordinary bodies; a11y rule: the text stays real | **shipped** |
| Bound Visual Sink | `data-field-visual-for` + platform state mirroring (`setMirroring`, default on) | **shipped** |
| Contour Sink | font-agnostic platform primitive (`contourSvgFor` — any parsed font) + Bound Visual mirroring; demo on /docs/contour-typography | **shipped** |

Naming discipline: the tiers are *surfaces of one contract*, not new tokens — the token is `sink`
in every tier, and a chip or doc that prints `ABSORB` instead of `SINK` is wrong (absorb is the
attribute/concept lane). The visual layer never becomes the body; it represents the body.

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
- `field:saturated` — a sink hit its capacity (fired from `supernova`, the saturation transition);
  `field:released` is its paired down-edge.
- `field:entered` / `field:exited` — a body's own gathered density crossed the 0.6 / 0.2 levels
  (hysteretic + debounced; distinct from `field:lit`/`field:dim`, which carry the neighbour-spillover
  lit channel).
- `field:attention-shifted` / `field:attention-settled` — a body's conserved-attention multiplier
  crossed (only when attention is on).
- `field:entropy-warning` / `field:entropy-cleared` — a body's measured local entropy crossed.
- `field:memory-threshold` / `field:memory-faded` — an `addEdge` relationship's `memory` crossed
  (dispatched on the source body's element).
- **any event name you bind via `data-on`** — e.g. `data-on="captured:field:dock, dense:field:lit"`.

Every `field:*` here mirrors to its `forces:*` twin during the alias window.

**Names reserved, not yet dispatched (planned):** `field:relationship-strengthened` — the designed
relationship-strength dynamics rarely cross a fixed level cleanly, so it is left reserved until a use
case lands.

**Edge nuance.** `field:captured`/`released` are edge-debounced on `accreted > 0`. Release is fired
directly from `supernova` so a same-frame fill-and-release never drops it; the rising-edge capture is
sampled after the force pass (the same model as the `captured` `data-on` trigger).

## Text and the visual layer

Text is a special case of the same model, governed by a design law
([forces-system §11](../engine-reference/forces-system.md),
[visual-language-and-geometry](visual-language-and-geometry.md)):

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
  `aria-hidden` — the [VisualBindingRegistry](platform-architecture.md) discovers, binds, and
  lints the pairing. **shipped** (binding + lint). Generating glyph geometry *from* text
  (outline extraction, text → SVG path) **ships** as the font-agnostic Contour Sink primitive
  (`contours.ts`: `contourPathData` / `contourSvgFor`, any parsed font); only automatic CSS
  font-binary discovery and complex-script shaping remain future work.

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
                      (per-agent status in the matrix; all cells now shipped)
  Body roles:         source · density receiver · force target · event host              (all shipped)
  Submodel — Body Matter Interaction:
    source · attract/repel/shape · capture (sink) · hold · release · expose feedback     (shipped)
    dock an element (data-dock) · emit a node (data-emit) · relocate/teleport (data-warp) (shipped)
```

> **Body-carried data (addBody).** A programmatic body created with `FieldHandle.addBody(spec)` carries an opaque `data` record — the Body-level analog of a particle's `atom`. It extends this model from *matter that carries records* to *sources that carry records*: an emitter is itself an addressable agent with attached data and per-body feedback (`onFeedback`), surfaced on its `BodyHandle`.
>
> **El-less bodies and the callback consumer.** A programmatic body has no DOM element. The model's element-agent has a *DOM consumer* (the engine writes `--d`/`--load`/`--field-*` onto the element, author CSS reads them); an `addBody` body has a **callback consumer** instead — its feedback channels arrive at `onFeedback(channels)` (and the live `BodyHandle.channels`), the non-DOM consumer for a non-DOM host (a Three.js mesh, a native view). Its force params are **reactive**: `BodyHandle.set({ strength, range, angle, spin, color })` mutates them on the measure cadence with no rescan — the same live-param path a scanned `[data-body]` gets from a `data-*` change, surfaced on the handle.

---

## Headless runtime

*Status: shipped (0.8.1).*

The engine runs outside the DOM — in a Node.js service, a native sidecar, an OS-level agent, a test — using the same physics and signals surface. No browser, no `canvas`, no `requestAnimationFrame`. The two pieces that gate this:

### `headlessHost` — a DOM-free `FieldHost`

```ts
import { createField, headlessHost } from '@fundamental-engine/core';

const host = headlessHost({ width: 1920, height: 1080 });
const field = createField(undefined, { host, render: 'none' });

// caller drives the clock:
host.tick();                   // one frame at ~16.6 ms cadence
host.tick(performanceNow);     // or explicit ms timestamp
host.resize(w, h);             // when workspace bounds change
```

`render: 'none'` is signals-first mode (#538, now the engine default): full simulation, no drawing, all feedback channels live. `headlessHost` stubs every DOM dependency — `root` scans empty (all bodies come via `addBody`), `createCanvas` throws, all `on*` subscriptions are no-ops. **Swift:** `OSFieldHost` in Jellybean is the direct equivalent (`OSFieldHost.tick(at:)` drives the clock). **Kotlin/Android:** the pure `:fundamental-core` is host-free by construction — `createField(…)` / `FieldController.tick(dt)` run the full simulation with no view or renderer (the JVM tests and desktop FieldLab drive it headlessly); `:fundamental-platform` injects a `FieldHost` when a host is present.

### `addBody` + `onFeedback` — entities as bodies

```ts
const body = field.addBody({
  tokens: ['attract'],
  strength: 1.4,          // drive from the entity's live importance
  range: 300,
  data: { kind: 'window', id: 'figma-1' },  // echoed back in readEdges()
  rect: () => screenRectOf('figma-1'),        // sampled every frame
  onFeedback: (ch) => {
    // per-body channels: density, load, lit, entropy, coherence, temperature
  },
});

body.set({ strength: 2.0 });  // live, no rescan
body.channels;                // latest snapshot (also pushed to onFeedback)
body.remove();
```

**Swift parity:** `BodySpec.onFeedback` was added alongside the TS version — programmatic bodies now receive `FeedbackChannels` per frame even when `view == nil`. `BodyHandle.set(strength:)` exists in both runtimes. **Kotlin/Android parity:** `BodyHandle.set(strength = …)` exists, and programmatic bodies build with `feedback = true` so their density `d` is measured each frame; a per-frame `onFeedback` callback is **not yet** exposed on the Kotlin `BodySpec` (follow-up).

### `addEdge` / `readEdges` — relationships with memory

A relationship is not a physics coupling (v1 caveat: strengthening A↔B does not yet make A's salience physically pull B's matter — that transfer is a deliberate follow-up). It is a **dynamics layer** over the body graph: strength responds to salience on fast timescales; memory accretes longitudinally.

```ts
const edge = field.addEdge(meetingBody, fileBody, {
  type: 'opened-during',
  strength: 0.5,
  direction: 'bidirectional',    // 'from-to' | 'to-from' | 'bidirectional'
});

edge.set({ strength: 0.8, type: 'references' });
edge.remove();

field.readEdges();
// ReadonlyArray<{
//   from: unknown,     // source body's `data` record, verbatim
//   to: unknown,
//   type: string,
//   strength: number,  // 0..1; rises ~1.5/s while source salient, decays ~0.3/s idle
//   memory: number,    // 0..1; slow longitudinal "warmth" — the accretion signal
//   active: boolean,   // source density > 0.08 this tick
// }>
```

Removing either endpoint body drops the edge automatically. Edges survive `scan()` (they're programmatic, not DOM-derived). **Swift parity:** `FieldHandle.addEdge`/`readEdges` added alongside the TS API; the same dynamics (dt-scaled strength/memory updates) run in `FieldEngine.swift`. **Kotlin/Android parity:** `FieldHandle.addEdge`/`readEdges` ported with identical per-tick dynamics in `FieldController.kt` (strength `+1.5·dt` while the source is salient, `−0.3·dt` idle; memory `+0.2·dt`, holding on idle); removing an endpoint drops the edge.

### The agent tick loop

```ts
const host = headlessHost({ width, height });
const field = createField(undefined, { host, render: 'none' });
const bodies = new Map<string, BodyHandle>();

function tick(osState) {
  // 1. reconcile entities → bodies
  for (const e of osState.entities) {
    const b = bodies.get(e.id) ?? bodies.set(e.id, field.addBody({
      tokens: [e.importanceToken], data: e, rect: () => e.rect,
    })).get(e.id)!;
    b.set({ strength: e.importance * (e.frontmost ? 2 : 1) });
  }
  // 2. reconcile relationships → edges (addEdge / edge.remove as they appear/vanish)
  // 3. advance the field
  host.tick();
  // 4. read the situational model back
  const salience = [...bodies].map(([id, b]) => ({ id, ...b.channels }));
  const graph = field.readEdges();   // strength + memory per relationship
  return { salience, graph };
}
```

**Availability:** Status: shipped (0.8.1). `headlessHost` (#602) and `addEdge` (#603) are in the npm `@fundamental-engine/*` 0.8.1 release. The Swift implementations shipped alongside, in `FundamentalCore`/`FundamentalVanilla`. The Kotlin/Android implementations mirror the same surface in the `android/` tree (`:fundamental-core` `FieldHandle` incl. edges, the `:fundamental-platform` host layer), held to the shared cross-plane golden — riding the Android port branch, not yet a published release.
