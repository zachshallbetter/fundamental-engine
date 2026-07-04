> **Status: canonical.**
> How Fundamental handles time: the three clocks (simulation, experiential, world), the temporal
> kernels, and the declared-timestamp contract (`data-field-at`). Everything here is shipped
> and verified against code except where marked; the kernels live in
> `packages/core/src/engine/temporal.ts`, the derivation in the platform metric pipeline, and
> the reference consumers are the Calendar, Memory, Backlog, and Inbox examples.

# Time in the Field

## Related Documents

| Document | Role |
|---|---|
| [`system-contracts.md`](system-contracts.md) | The metric lanes (`recency`, `memory`) and feedback variables |
| [`invisible-fields.md`](invisible-fields.md) | The live channels the clocks feed |
| [`natural-fields.md`](natural-fields.md) | Weak → transformation: the conceptual home of decay |
| [`fundamental-field-behavior-table.md`](fundamental-field-behavior-table.md) | Truth modes (the kernels are *designed*, not physical) |
| [`../engine-reference/physics-workover.md`](../engine-reference/physics-workover.md) | v0.4: real `dt` seconds + the fixed-step accumulator (simulation time's future) |

## 1. The three clocks

A field page experiences three kinds of time, and they must not be conflated:

| Clock | What it measures | Where it lives | Status |
|---|---|---|---|
| **Simulation time** | the field's own evolution — frames, particle ages, wave phase | `env.t` (seconds since boot), `env.dt` (1/frame; 0 under reduced motion), `Particle.age` (frames-to-live for mortal matter) | shipped; v0.4 upgrades `dt` to real seconds with a fixed-step accumulator |
| **Experiential time** | the *reader's* time — what has been attended, for how long, how recently | the platform metric lanes: `attention` (eased now), `memory` (slow integral of attention), `recency` (decays from the last engagement) | shipped (the metric pipeline) |
| **World time** | the *data's* time — when things happened or will happen | `data-field-at` timestamps + the temporal kernels | shipped (this document) |

The lanes stay separate the way all Fundamental lanes do: simulation time is physics, experiential
time is *inferred* from interaction, world time is *declared* by the data. When both could
apply, **declaration wins over inference** (§3).

## 2. The temporal kernels

Temporal distance is a distance. The engine derives force from spatial distance; the kernels
derive weight from temporal distance — pure, deterministic functions in
`@fundamental-engine/core` (`core/temporal.ts`), all `(…, nowMs) → 0..1`, no `Date.now()` inside
(callers supply `now`, which keeps them testable and frame-coherent):

| Kernel | Shape | The question it answers |
|---|---|---|
| `imminence(atMs, nowMs, horizonMs)` | `1 − ln(until/h₀ + 1) / ln(horizon/h₀ + 1)`, clamped; 1 at/past the moment | *how soon?* — approach ramps weight (the Calendar's gravity) |
| `freshness(atMs, nowMs, halfLifeMs)` | `2^(−since/halfLife)`; exactly ½ at one half-life | *how recent?* — newness decays (Backlog, Inbox). `staleness = 1 − freshness` |
| `retention(anchor, sinceMs, opts?)` | `a · e^(−since/τ(a))`, τ growing with anchor strength | *how well held?* — the Ebbinghaus forgetting curve (Memory); deep anchors decay slower |
| `phase(nowMs, periodMs, offsetMs?)` | cyclical position `[0, 1)` | *where in the rhythm?* — daily/weekly cycles. Shipped; consumer-less today (stated honestly in its JSDoc) |

These are **designed** truth-mode functions (legible, monotone, parameterized), not physical
claims. They were extracted, not invented: four example pages had hand-rolled four variants of
"temporal distance → weight," and the kernels reproduce the originals bit-identically (the
e2e suite pins the conversions).

## 3. The declared timestamp: `data-field-at`

An element may declare *when it is*:

```html
<li data-body="attract" data-feedback
    data-field-at="2026-06-09T14:30:00Z"   <!-- ISO 8601 or epoch ms -->
    data-field-halflife="86400000">        <!-- optional; default 7 days -->
```

When `data-field-at` is present (and `data-field-recency` is not explicitly supplied), the
platform metric pipeline **grounds the `recency` lane in world time**:
`recency = freshness(at, now, halfLife)`, with `now` sampled once per frame. Without a
declared timestamp, the pipeline keeps its existing behavior — recency *inferred* from
interaction (1 while engaged, easing down after). One lane, two sources, a strict precedence:

```txt
explicit data-field-recency   >   declared data-field-at   >   inferred from interaction
```

Invalid timestamps parse as absent (no error — but note the silent-gap doctrine in
[`../engineering-practices.md`](../engineering-practices.md): if this pair ever bites, it
gets a lint rule).

## 4. What this is for

The reference consumers show the intended division of labor — *the kernel shapes the weight,
the page owns the semantics*:

- **Calendar** — `imminence` drives `--w` on a 1 Hz tick: the next launch literally pulls
  hardest, and the ramp is now the same function any consumer can import.
- **Memory** — `retention` is the forgetting curve; reviewing re-anchors (`retention(a, 0) = a`).
- **Backlog / Inbox** — `freshness` grounds activity weights; both pages also declare
  `data-field-at` in markup, so their `--field-recency` lane is world-grounded for real
  (the Inbox's conserved budget is unaffected — allocation happens after weighting).

## 5. What time is NOT here

- The kernels do not schedule anything — they map time to weight. Scheduling (polling
  cadence, reveal pacing) is the live-data plumbing (`apps/site/src/lib/live-data.ts`) and
  the reading-pace gate, documented in
  [`invisible-fields.md`](invisible-fields.md) §5–6.
- Simulation `dt` is not wall time (until v0.4's fixed-step work); nothing in the engine
  consumes the kernels per-frame — pages and the platform pipeline do, at their own cadence.
- Experiential `memory`/`recency` (inferred) and world-grounded `recency` (declared) are the
  same *lane* with different *sources*; the engine-measured thermodynamics
  (`--temperature` etc.) are a different thing entirely (workover v0.3) and share no naming.

## Temporal semantics — the five time senses

The three clocks above (§1) are the page author's model. The substrate needs a finer split: once a
field can be snapshotted, replayed, and fed external data, "time" fractures into **five distinct
senses**, and collapsing any two of them is the recurring temporal bug. They are not
interchangeable and no single number carries all five.

| Sense | What it is | Where it lives | Kind |
|---|---|---|---|
| **Simulation time** | the field's own advancing clock — frames, `dt`, particle ages, wave phase | `env.t`, `env.dt`, `Particle.age`; the accumulator's `temporal` channel | engine-internal, monotone |
| **Host time** | the platform / wall clock supplied by the host adapter | injected via `FieldHost` (never `Date.now()` in core) | external, monotone |
| **World time** | an external / domain timestamp attached to *data* — when a record was authored, when an event will occur | `data-field-at` (§3), the `nowMs` fed to the kernels | declared, arbitrary |
| **Semantic time** | the *meaning* of age — staleness, freshness, recency, decay, imminence | the temporal kernels (§2) mapping world/host time → weight | derived, non-linear |
| **Replay time** | a reconstructed causal *sequence* — the ordered account a `replay()` derives between two snapshots | `replay()` steps ([causality-and-truth.md](causality-and-truth.md)) | reconstructed, ordinal |

The first three are *clocks* (they tick); semantic time is a *reading* (it weighs); replay time is
an *ordering* (it narrates). Map them back to §1: simulation time is unchanged; **host time is new
here** — §1 folded it into simulation time, but the substrate must name the adapter-supplied wall
clock separately because it is the thing core deliberately does not read directly. World time is
§1's world clock. Semantic time is what the kernels *produce* from world/host time; §1's
experiential lanes are one consumer of it. Replay time has no §1 analogue — it exists only once
snapshots do.

### Doctrine

- **Adapters map host time.** Core imports no wall clock (`core/temporal.ts` takes `nowMs` from its
  caller; the kernels never call `Date.now()`). The host adapter is the *only* place host time
  enters, and it enters as a supplied value — this is what keeps the engine testable and
  frame-coherent.
- **The accumulator's `temporal` channel is simulation-time.** The `temporal` lane of the impulse
  accumulator ([substrate-api.md](substrate-api.md)) measures *mortal age* in the field's own clock
  — engine frames, not wall seconds and not world timestamps. Do not read a body's accumulated
  `temporal` value as "how old the underlying data is."
- **Semantic time must be mapped explicitly, never assumed spatial or linear.** Age → weight is a
  *designed* function (freshness halves per half-life, imminence ramps logarithmically, retention
  follows Ebbinghaus). Nothing makes temporal distance behave like spatial distance, and nothing
  makes it linear. A consumer that wants staleness to matter must run a kernel; it may not infer
  "older = further" or "twice as old = twice as weak" for free.
- **A snapshot's frame/time is not world or semantic time.** A snapshot carries simulation time
  (its frame) and, if the host stamped it, host time. It carries **neither world time nor semantic
  time** unless a consumer explicitly attached them. Reading a snapshot's frame index as "when the
  data was authored," or its age-in-frames as "staleness," silently conflates the engine clock with
  data meaning — the exact collapse this split exists to prevent. Replay time, likewise, orders the
  *simulation's* changes between two snapshots; it is not a timeline of world events.

These lanes obey the same discipline as the rest of the naming canon: *simulation time ticks, host
time is supplied, world time is declared, semantic time is derived, replay time is reconstructed* —
and no one of them may stand in for another.
