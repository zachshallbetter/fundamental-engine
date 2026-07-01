> **Status: canonical (concept).**
> Two disciplines that keep the substrate honest: the **causality ladder** (how much a replay is
> allowed to claim) and the **dimension / metric / channel / projection lock** (four naming lanes that
> must never collapse). Plus the implementation-facing **truth labels** that sit next to the six truth
> modes. This is *framing* over the [substrate API](substrate-api.md); it introduces no new engine
> behavior. Follows the [status rule](documentation-standards.md).

# Causality and truth

The substrate can `query`, `snapshot`, `diff`, and `replay` a field as plain data
([substrate-api.md](substrate-api.md)). That power invites over-claiming: a narrated replay *feels* like
it proves causation, and a measured metric *feels* interchangeable with the dimension it measures. This
document draws the two lines that keep those honest.

## Part A — the causality ladder

`replay()` derives an ordered account of *how* a field changed between two snapshots. It reads the two
snapshots; **it does not re-run the sim.** So a replay is an explanation, not a proof. The ladder names
five levels of claim, from what we directly saw to what we merely project. Each level asserts strictly
more than the one below — and each has a hard ceiling on what it does **not** say.

| Level | Asserts | Does **not** assert | Substrate source |
|---|---|---|---|
| **Observed** | "this value was X at frame N" | why it was X | `snapshot()`, `query()` |
| **Attributed** | "force `attract` contributed +0.42 linear to this body" | that `attract` *caused* the outcome alone | `Env.accum` attribution / `FieldInfluenceReading` |
| **Explained** | "density rose because these attributions net positive" | that no unmodeled factor mattered | `diff()` |
| **Replayed** | "in order: formation activated, then relationship strengthened, then density rose" | that re-running would reproduce it identically | `replay()` |
| **Predicted** | "under the same field, this body will move toward here" | that it *will* happen — the world may change | prediction diagnostic |

**Do not call any of this "causality" unqualified.** The engine's own caveat canon applies: energy and
momentum are not conserved by design, and only particle *count* is a strong invariant — so an
attribution is a faithful record of *what the accumulator summed*, not a physical proof of cause.
`replay()` steps carry the `diagnostic` lane precisely because they *explain*, they do not *measure*.

Practical rule: **quote the highest level your data supports, and no higher.**
- Only Observed if you have one snapshot.
- Only Attributed/Explained if snapshots were captured with `includeInfluences` (otherwise `cause: 'force'`
  steps are not even emitted).
- Predicted is always conditional — label it as such.

## Part B — the dimension / metric / channel / projection lock

Four words describe four different things about one axis of a field. Collapsing any two of them is the
recurring conceptual bug. They lock in this order:

| Lane | Definition | Example |
|---|---|---|
| **Dimension** | an *axis of state* a body can have | `attention` |
| **Metric** | a *measured reading* of a dimension (+ its live channel var) | `--d` / `--field-attention` |
| **Channel** | an *accumulator lane* force accumulates in | `linear` (or `thermal`, `angular`, `temporal`, `semantic`) |
| **Projection** | a *host expression* of the state | `outline-weight` (a CSS write) |

### Worked example

> A body has the **dimension** `attention`. Its current value is read as the **metric** exposed on the
> `--d` / `--field-attention` channel var. Forces that move it accumulate in the `linear` **channel** of
> the impulse accumulator. A registered **projection** expresses it as `outline-weight` on screen.

One axis, four lanes: `attention` (dimension) · `--d` (metric channel var) · `linear` (accumulator
channel) · `outline-weight` (projection). None of these words may stand in for another:

- A dimension is not its metric — the axis exists even when nothing reads it (headless, `render: 'none'`).
- A metric is not the accumulator channel — the metric is the *reading*; the channel is *where force
  summed to produce it*.
- A projection is not the state — *projection reveals state; coupling changes state* (the substrate-05
  governance principle). A projection never writes back into a dimension.

This is the naming canon (*no word lives in two lanes*) applied to the substrate's measurement surface,
and `lintWordLanes()` ([substrate-api.md](substrate-api.md)) guards it mechanically. Note "channel" is
doubly loaded in casual speech — the **accumulator channel** (`linear`/`thermal`/…) and the **metric
channel var** (`--field-*`) are different lanes; this table keeps them apart.

## Part C — truth labels (adjacent to the six truth modes)

The six **truth modes** ([passport](../../packages/core/src/contracts/passport.ts): physical, designed,
hybrid, diagnostic, poetic, semantic) describe *what kind of statement a force makes*. Alongside them,
implementation needs **truth labels** describing *how a reading was produced* — the epistemic status of
a number, not the rhetorical mode of a force:

| Label | The reading is… | Reproducible? |
|---|---|---|
| **deterministic** | a fixed function of field state | yes — same input, same output |
| **stochastic** | sampled with randomness | only in distribution |
| **heuristic** | an approximation / rule of thumb | yes, but not exact truth |
| **semantic** | derived from meaning/data, not physics | as stable as its source data |
| **diagnostic** | an explanation *about* the field | it describes, it does not measure |

These labels map onto the causality ladder: Observed/Attributed values are typically **deterministic** (at
`dt === 1` the integrator is byte-identical); a **stochastic** reading can never climb above Explained;
**diagnostic** is the lane of every `replay()` step. A serialized record (see the frontier
[Field Protocol](../planning/field-protocol.md)) should carry its truth label so a consumer never
over-reads a heuristic or a narrated replay as measured cause.

## Related documents

| Document | Role |
|---|---|
| [`substrate-api.md`](substrate-api.md) | `replay()` + snapshot trio + the accumulator channels this doc constrains |
| [`documentation-standards.md`](documentation-standards.md) | The naming canon + status rule this lock enforces |
| [`dimensional-coupling.md`](dimensional-coupling.md) | The coupling passport — how a channel-crossing force must declare itself |
| [`fundamental-field-behavior-table.md`](fundamental-field-behavior-table.md) | The six truth modes these labels sit beside |
