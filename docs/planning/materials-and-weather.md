# Materials and Field Weather

> **Status: frontier — not canonical, not a runtime primitive.**
> This document sketches two authoring/diagnostic concepts that are deliberately kept **out of canon**
> until they are formalized. Neither is a force, neither is shipped, and neither introduces new engine
> state. They exist here to keep the idea space coherent and to fix the vocabulary *before* any of it
> touches the runtime. For shipped behavior see the package code, the conformance tests, and the
> canonical docs — especially [`../canonical/documentation-standards.md`](../canonical/documentation-standards.md)
> (framing + the naming lanes) and [`../canonical/field-possibilities.md`](../canonical/field-possibilities.md)
> (the wider possibility space this sits beside).

The naming lanes are load-bearing here, so state them up front:

```txt
Force        a real, passported runtime token (attract, gravity, sink, …). The catalog is locked.
Material     an authored *feel* preset that MAPS to forces + projections. Not a force. (this doc)
Field Pattern  composed field behavior; FieldPattern is its current API representation.
Projection   a rendering/summary of existing metrics; adds no new state.
```

A Material is not a Field Pattern and not a global formation mode. A Material never becomes a Force.
Field Weather is a Projection of metrics that already exist. Keeping these lanes separate is the whole
point of writing this down early.

## 1. Materials as presets, not physics

A **Material** is an authored *feel* preset — a named bundle of intent like `glass`, `rubber`, or
`paper`. It answers "how should this body *feel* when the field acts on it?" and it answers that by
**mapping to forces and projections that already exist**. It is authoring sugar over the locked
vocabulary, not a new layer of physics.

The hard boundary:

```txt
A Material MAY compose forces, projections, memory, and damping.
A Material MAY NOT become a new force token.
```

The force catalog (36 tokens) and the pattern canon (the locked 4×16 `FIELD_PATTERNS` set) stay frozen.
A Material is a *reference* into that vocabulary, the way a concept word like `absorb` refers to the
`sink` token without being a token itself. When a Material needs behavior the vocabulary can't express,
that is a signal to file a force/recipe proposal — not to smuggle a token in through a preset.

### Three illustrative mappings

These are sketches of the *feel → vocabulary* mapping, not a schema:

```txt
glass    projection-forward + lens-like read + low memory
         reads cleanly, refracts what is behind it, forgets fast.
         maps to: a static/underlay projection, a lens-style diagnostic read of local density,
                  memory decay tuned high (short trace).

rubber   tether-like response + damping
         resists, snaps back, absorbs shock rather than storing it.
         maps to: tether-family restoring response, high viscosity/damping,
                  little to no memory accumulation.

paper    static projection + memory trace
         holds a mark. what happens on it stays legible.
         maps to: a static projection surface, low damping, memory retained (visible trace)
                  so dwell and passage leave a lasting, readable record.
```

Each row is a translation into shipped concepts (projection placement, the tether/viscosity/memory
families, diagnostic reads). None of them add a `glass` or `rubber` or `paper` force. A Material is
resolved *down* to that vocabulary at author time; the engine only ever sees forces, projections, and
metrics it already knows.

### Why a preset and not a force

Interfaces need a small number of legible, composable *feels* far more than they need more force tokens.
"Make this card feel like glass" is an authoring intent; `attract`/`viscosity`/`memory` are the
mechanism. Collapsing the two would put a word in two lanes at once (describing *and* executing), which
is exactly what the naming canon forbids. Materials keep the descriptive lane (feel) cleanly separated
from the executing lane (forces).

**Open questions before this could leave the frontier:** where a Material is declared (a body attribute
vs. a pattern field), how a Material composes with an explicit force on the same body (override? add?),
whether the preset set is closed or extensible, and how a Material's reduced-motion equivalent is
derived. Until those are answered, Materials stay a concept, not a contract.

## 2. Field Weather as a diagnostic summary, not a primitive

**Field Weather** is a human-readable summary of the field's current state — a single word or short
phrase like `calm`, `turbulent`, `dense`, `cooling`, `fragmented`, `contested`, `converging`, or
`stale`. It is a **Projection of existing metrics**: it reads what the engine already measures and
narrates it. It introduces no new state, stores nothing new, and drives no behavior.

```txt
Field Weather is a Projection: it summarizes metrics; it does not add state.
```

The vocabulary is a reading of accumulation, not a new measurement:

```txt
calm         low net force, low velocity variance, stable equilibrium
turbulent    high velocity variance, unstable local flow
dense        high field density in the active region
cooling      falling heat/activity relative to recent frames
fragmented   many small disconnected clusters, weak binding
contested    high charge separation — opposing domains near each other
converging   bodies and flow trending toward a shared minimum (a gravity well forming)
stale        recency decay crossing threshold; little recent influence
```

Every one of those is computed **from** metrics that already exist (density, velocity/flow variance,
heat/activity, coherence, charge separation, recency/memory). Field Weather is the top layer of the
same stack the diagnostics already read — it just renders the summary as language instead of as a
heatmap or a vector overlay. It sits alongside the existing render/diagnostic surfaces, one more way to
answer "what is this field doing right now?", pitched at a human glance rather than an inspector.

Because it is a pure projection, Field Weather is also a natural **agent-readable** channel: a single
categorical read (`contested`, `converging`, …) is a cheap way for a consumer to sample field state
without parsing every metric. That keeps it in the projection lane — a summary of state, never a source
of it.

**Open questions before this could leave the frontier:** the exact metric thresholds per term, whether
the summary is per-region or whole-field, its cadence (it should follow a resample cadence, not
recompute every frame), and its reduced-motion / non-visual presentation. Like Materials, it stays a
concept until those are pinned to actual metric definitions.

## 3. What keeps both out of canon

Both concepts are attractive precisely because they *feel* like primitives — a Material feels like a
material, weather feels like a live reading. That is the trap. Canon admits a concept only once code
confirms it (the status rule in
[`../canonical/documentation-standards.md`](../canonical/documentation-standards.md)). Until a Material
resolves to a documented force/projection mapping and Field Weather resolves to documented metric
thresholds, they remain frontier sketches:

```txt
Material       authoring sugar → forces + projections. Never a new force.
Field Weather  a projection of metrics → language. Never new state.
```

Neither expands the frozen force catalog or the locked pattern set. When either is ready to formalize, it
graduates through the normal path — a canonical doc, a test, and the force/recipe or metric definitions
it maps to — not by being described as shipped here.
