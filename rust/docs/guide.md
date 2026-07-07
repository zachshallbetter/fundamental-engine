# Rust plane — guide

A practical tour of `fundamental-core`: build a field, run it, and read results back. For the design
rationale see [architecture.md](architecture.md); for the full surface see [reference.md](reference.md).

## The mental model

Three things:

- **Bodies** are your data records as force sources — an article, a row, a node. A body names one or
  more force **tokens** (`"attract"`, `"gravity"`, `"tether"`, …) and carries field parameters
  (`strength`, `range`, `center`, `heading`, `source_mass`, …).
- **Particles** are the ambient *field* — the matter that bodies move and gather. On a headless host
  they're the medium through which relationships become measurable density.
- **`step`** advances the whole field one tick. Loop it to a settle (a "solve"), then read state back.

You drive it with three pieces of owned state — a `Registry` (which forces exist), a `Vec<Body>`, a
`FieldStore` (the particle pool) — plus an `Env` (the world: bounds, `dt`, `c`, the rng, the effect
buffer).

## Hello, field

```rust
use fundamental_core::{step, Body, Env, FieldStore, Particle, Registry, Vec3};

let reg = Registry::standard();                       // the 28 ported forces
let mut env = Env { volume: Vec3::new(800.0, 600.0, 0.0), ..Default::default() };

let mut bodies = vec![Body {
    tokens: vec!["attract".into()],
    range: 300.0,
    feedback: true,                                   // sample local density into `count`
    center: Vec3::new(400.0, 300.0, 0.0),
    ..Default::default()
}];

let mut store = FieldStore::new();
store.add(Particle { position: Vec3::new(250.0, 300.0, 0.0), ..Default::default() });

for _ in 0..300 {
    step(&mut store, &mut bodies, &mut env, &reg);
}

// the particle has been drawn toward the body; the body has sampled its local density.
let settled = store.particles[0].position;
let density = bodies[0].count;
```

`step` takes everything `&mut` (bodies accumulate `count`/`accreted`; `env` holds the per-apply scratch
and the effect buffer). `env.effects` is cleared at the top of each `step` and holds that tick's effects
(e.g. `wall` sparks) on return.

## Composing forces

Forces compose by token — a body feels every token it names, each frame:

```rust
Body { tokens: vec!["gravity".into(), "swirl".into()], source_mass: 5.0, ..Default::default() };
```

Everything is **opt-in**: a body only feels the forces it names, so `Registry::standard()` never changes
a body that doesn't ask. Modifiers bend their siblings — `["spotlight", "stream"]` is a directed beam;
`["resonate", "attract"]` is a well that breathes.

## Determinism & receipts

The engine is deterministic by construction. Same seed + same inputs → a byte-identical run:

```rust
use fundamental_core::Rng;

let mut env = Env { rng: Rng::seeded(42), ..Default::default() };
```

`Env::rng` defaults to seed 0 (deterministic-by-default — the headless stance). Every stochastic draw
(the `jet` cone, `thermal`, future `spawn` jitter) flows through it, so a seeded field replays
identically on any machine and any plane — the Rust stream is bit-identical to the JS `seededRng`. This
is the foundation for snapshot + causal replay
([#1043](https://github.com/zachshallbetter/fundamental-engine/issues/1043)).

## Reading results — the CMS shape

The point of a headless field is what you read *out*. Today `Body::count` (local density, populated when
`feedback: true`) is the raw **score** signal — the "Gravity → importance" mapping. A worked, runnable
example ships as `examples/ranking.rs`:

```sh
cargo run --example ranking
```
```text
Ranked by field gravity (importance ← how much of the field each body gathers):

  1. Launch announcement               score  208.0
  2. Deep-dive: the field engine       score  160.0
  3. Changelog v0.9                    score   68.9
  4. About the author                  score   64.0
  5. Archived note                     score    1.0
```

It maps five "articles" to `attract` bodies whose importance sets their reach, seeds deterministic
ambient matter, solves to equilibrium, and ranks by the density each body gathered. That's a CMS ranking
built from field physics — reproducible, and (once [#1043](https://github.com/zachshallbetter/fundamental-engine/issues/1043)
lands) explainable via causal replay.

The first-class reading layer — **scores** (potential/density per body), **clusters** (density basins),
**relations** (nearest-in-field) — is
[#1044](https://github.com/zachshallbetter/fundamental-engine/issues/1044).

## Mapping domain data onto the field

The Natural Fields give you the vocabulary for turning records into bodies:

| You have | Field it becomes | Body knob |
|---|---|---|
| importance / authority / recency | **Gravity** | `source_mass` (with `gravity`), or `strength`/`range` (with `attract`) |
| stance / topic / polarity | **Electromagnetic** | `charge` (particles) + `spin` (body sign) |
| explicit links / "part-of" | **Strong** (binding) | `tether` / `link` tokens |
| lifecycle transitions | **Weak** (transformation) | `sink` (absorb), `warp` (relocate), forthcoming `spawn` |

## Loop model: `step` vs `solve`

`step()` is the primitive — one tick. Two shapes fall out of it:

- **Solve-to-equilibrium** (a CMS rebuild, a batch analysis): loop `step` until the field settles, read
  once. The `solve(until_settled)` wrapper that does this with a convergence check is
  [#1042](https://github.com/zachshallbetter/fundamental-engine/issues/1042).
- **Live runtime** (a long-lived server answering queries against current field state): keep a field
  alive and `step` it as data changes.

Both are the same engine — you don't choose up front.

## Bounds & headless safety

`env.volume` sets the world bounds `(W, H, D)`. When it's zero (the default), toroidal wrap is skipped —
a headless-safe default so content doesn't collapse to the origin for want of bounds. Set a volume when
you want wrap-around, or leave it zero for an unbounded solve.

## What's not here yet

8 of the 36 forces and their subsystems (scalar grid, source pass, field-line hooks, cross-body
`screen`) are deferred — tracked as sub-issues of the epic. They are documented no-ops: a field that
doesn't use them behaves exactly as the JS flat-field fast path. See
[reference.md](reference.md) → *The force catalog* for the per-force status and
[the epic](https://github.com/zachshallbetter/fundamental-engine/issues/1036) for the roadmap.
