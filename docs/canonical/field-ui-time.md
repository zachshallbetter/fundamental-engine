> **Status: canonical.**
> How field-ui handles time: the three clocks (simulation, experiential, world), the temporal
> kernels, and the declared-timestamp contract (`data-field-at`). Everything here is shipped
> and verified against code except where marked; the kernels live in
> `packages/core/src/core/temporal.ts`, the derivation in the platform metric pipeline, and
> the reference consumers are the Calendar, Memory, Backlog, and Inbox examples.

# Time in the Field

## Related Documents

| Document | Role |
|---|---|
| [`field-ui-system-contracts.md`](field-ui-system-contracts.md) | The metric lanes (`recency`, `memory`) and feedback variables |
| [`field-ui-invisible-fields.md`](field-ui-invisible-fields.md) | The live channels the clocks feed |
| [`field-ui-natural-fields.md`](field-ui-natural-fields.md) | Weak → transformation: the conceptual home of decay |
| [`fundamental-field-behavior-table.md`](fundamental-field-behavior-table.md) | Truth modes (the kernels are *designed*, not physical) |
| [`../engine-reference/physics-workover.md`](../engine-reference/physics-workover.md) | v0.4: real `dt` seconds + the fixed-step accumulator (simulation time's future) |

## 1. The three clocks

A field page experiences three kinds of time, and they must not be conflated:

| Clock | What it measures | Where it lives | Status |
|---|---|---|---|
| **Simulation time** | the field's own evolution — frames, particle ages, wave phase | `env.t` (seconds since boot), `env.dt` (1/frame; 0 under reduced motion), `Particle.age` (frames-to-live for mortal matter) | shipped; v0.4 upgrades `dt` to real seconds with a fixed-step accumulator |
| **Experiential time** | the *reader's* time — what has been attended, for how long, how recently | the platform metric lanes: `attention` (eased now), `memory` (slow integral of attention), `recency` (decays from the last engagement) | shipped (the metric pipeline) |
| **World time** | the *data's* time — when things happened or will happen | `data-field-at` timestamps + the temporal kernels | shipped (this document) |

The lanes stay separate the way all field-ui lanes do: simulation time is physics, experiential
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
  [`field-ui-invisible-fields.md`](field-ui-invisible-fields.md) §5–6.
- Simulation `dt` is not wall time (until v0.4's fixed-step work); nothing in the engine
  consumes the kernels per-frame — pages and the platform pipeline do, at their own cadence.
- Experiential `memory`/`recency` (inferred) and world-grounded `recency` (declared) are the
  same *lane* with different *sources*; the engine-measured thermodynamics
  (`--temperature` etc.) are a different thing entirely (workover v0.3) and share no naming.
