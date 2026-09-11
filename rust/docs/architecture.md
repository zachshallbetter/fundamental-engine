# Rust plane — architecture

> Status: living document. Reflects `feat/rust-core` as of the milestone-6 cut (28/36 forces).
> Tracking epic: [#1036](https://github.com/zachshallbetter/fundamental-engine/issues/1036).

## What this is

`fundamental-core` is the **Rust plane** of the Fundamental fleet — a DOM-free, renderer-agnostic port
of the relational field engine, alongside the JS reference core (`packages/core`) and the Swift/Kotlin
ports. It is held to the **same cross-plane conformance golden** as the native ports.

The other planes bind the field to a *screen* — their `Body` wraps a UI element (`view: UIView?`). The
Rust plane has no screen. Its hosts are servers, data pipelines, CMS runtimes, analysis jobs. That
drives the one design inversion everything else follows from:

> **A body is a data record, not a widget.**

Once a body is a domain record, the four Natural Fields stop being metaphors and become a relational
solver: **Gravity → importance, Electromagnetic → polarity/signal, Strong → binding, Weak →
transformation**. The field's *outputs* — scores, clusters, relations — are the product.

## Design commitments

| Commitment | Why | Where |
|---|---|---|
| **f64 everywhere** | Reproduce the JS f64 engine bit-for-bit → tight golden tolerance (~1e-9 vs the f32 ports' 2e-4), exact deterministic replay, trustworthy ranking numerics. The most-precise plane in the fleet. | `math::Vec3`, all signatures |
| **Zero runtime dependencies** | Same contract as the JS core. Auditable, embeddable, no supply chain. (Dev-deps `serde`/`serde_json` are test-only.) | `Cargo.toml` |
| **Deterministic by construction** | Fixed `dt` + seeded RNG → same seed & inputs give a byte-identical run. The load-bearing property for the Field Receipts thesis. | `record::Rng`, `Env` |
| **Effects-as-data** | A force never mutates the world directly; it emits an `Effect` value, draws `env.rng()`, or requests a capture, and the integrator resolves it. Effects are recordable → the receipts substrate; and the hot loop stays borrow-clean. | `engine::Effect`, `Force::apply(&mut Env)` |
| **Mirror the JS folder scheme** | A change lands in the same-named place on every plane. | `math`/`engine`/`forces`/`config`/`record` |
| **Strict dependency direction** | `core ← platform ← surfaces`; core never depends up. | workspace |

## Module map

```
fundamental-core
├── math/            Vec3 (f64), scalar helpers, hex↔RGB colour
├── engine/
│   ├── types        Body · Particle · Env · Formation · Force trait · Effect · ForceModification
│   ├── registry     Registry (token → Force), Registry::standard()
│   ├── field_store  FieldStore — the particle pool (stable ids)
│   ├── spatial_hash Neighborhood — a frame-start neighbour snapshot (§20.1 class [B])
│   └── integrator   step() — the legacy semi-implicit Euler tick
├── forces/
│   ├── canonical    the nine (attract, jet, tether, wall, stream, repel, viscosity, swirl, sink)
│   ├── natural      §20.10 (gravity, charge, magnetism, thermal, …)
│   └── extended     §20.3 (lens, gate, buoyancy, …, align, cohesion, …, resonate, spotlight, …)
├── config/          canonical force colours
└── record/          Rng — seeded mulberry32 (the determinism seam)
```

The modules mirror `packages/core/src/{math,engine,forces,config,record}` and the Swift
`Sources/FundamentalCore/{Math,Engine,Forces,Config,Record}`.

## The tick

`step(store, bodies, env, forces)` advances the field one frame (legacy semi-implicit Euler):

1. Clear the effect buffer; drain per-body density counters (even when frozen — `dt = 0`, #967).
2. Rebuild the neighbour snapshot **iff** a class-[B] force is in play.
3. For each free particle (skipping captured matter, which drifts to its sink core):
   - **modifier pass** — the body's own modifier tokens (`spotlight`/`resonate`) gate/scale its siblings;
   - **force pass** — each body's force tokens apply, mass-scaled (`a = F/m`, §21.3), density sampled;
   - **effect resolution** — a `sink` capture is recorded, accretion grows, saturation queues a release;
   - **speed cap** at `c`, then integrate `x += v·dt`, damp, and toroidal-wrap (when bounds are set).
4. Release saturated sinks (supernova); despawn expired matter *(the aging lane lands with `spawn`)*.

`solve(until_settled)` — the CMS entry point — is `step()` looped to a convergence threshold; it is
tracked in [#1042](https://github.com/zachshallbetter/fundamental-engine/issues/1042). One primitive,
both a live runtime and a batch solve.

## Two architectural bets

**Effects-as-data over service closures.** The JS engine hands forces closures on `Env` (`e.spark`,
`e.supernova`, `e.spawn`) that mutate the world live. Rust's ownership model makes live pairwise
mutation during a `&mut` iteration awkward — and, more importantly, closures aren't *recordable*. So a
force here emits an `Effect` (a value) and the integrator applies it with full context. This keeps the
hot loop borrow-clean **and** makes a step's side effects a serializable log — exactly the substrate the
Field Receipts thesis wants.

**Frame-start neighbour snapshot over live queries.** The JS `env.neighbors(p, r)` returns live
particle objects (so `collide` mutates a neighbour in place). The Rust plane instead snapshots the pool
at the top of the frame and forces read from the snapshot. Because a particle integrates only at the
*end* of its own iteration, when it is processed its own snapshot sample sits at distance 0 — so the
forces' existing `d < 1e-6` guards skip self exactly as the JS identity check does. The snapshot is
order-independent and deterministic; the one force that needs to mutate a neighbour (`collide`) uses a
pairwise-impulse effect ([#1037](https://github.com/zachshallbetter/fundamental-engine/issues/1037)).

## Relationship to the fleet

- **JS reference** (`packages/core`) — the authority; the Rust force math is ported from it verbatim.
- **Cross-plane golden** (`scripts/gen-conformance-golden.mjs`) — 120 force-apply cases; the Rust test
  embeds the same fixture the Swift port consumes and reproduces every `dv`.
- **Swift / Kotlin ports** — f32, UI-host planes. Rust is the f64, headless plane: numerically the
  strictest, and the first where a body is a data record rather than a widget.

## Deferred, deliberately

The 8 unported forces and the engine lanes they need (scalar grid, source pass, field-line hooks,
cross-body `screen`, velocity-Verlet, carrier waves, formation currents, agents) are **documented
no-ops** — a field that doesn't use them is byte-identical to the JS flat-field fast path. Each is a
tracked sub-issue of #1036. Nothing is silently stubbed; the parity test asserts the deferred forces
are absent from the registry.
