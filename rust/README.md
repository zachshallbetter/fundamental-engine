# Fundamental — Rust plane

The Rust port of the Fundamental relational field engine. A fourth plane alongside the JS reference
core (`packages/core`) and the Swift/Kotlin ports, held to the **same** cross-plane conformance golden.

## Documentation

- **[docs/architecture.md](docs/architecture.md)** — purpose, design commitments, module map, the tick,
  and the two architectural bets (effects-as-data, frame-start neighbour snapshot).
- **[docs/reference.md](docs/reference.md)** — the core types, the full 36-force catalog with porting
  status, the subsystems, and conformance.
- **[docs/guide.md](docs/guide.md)** — a practical tour: build a field, compose forces, determinism, and
  reading results back (the CMS shape).
- **`cargo run --example ranking`** — a runnable "rank content by field gravity" demo.
- **`cargo doc --no-deps --open`** — the generated API docs (every type + module is documented).
- Roadmap: [epic #1036](https://github.com/zachshallbetter/fundamental-engine/issues/1036).

## What makes the Rust plane different

The DOM, Swift, and Kotlin planes bind the field to a **UI host** — their `Body` wraps an element
(`view: UIView?`). The Rust plane is built for **headless** hosts: servers, data pipelines, CMS
runtimes, analysis. The defining inversion:

> **A body is a data record, not a widget.**

That turns the four Natural Fields into a relational solver — **Gravity→importance,
Electromagnetic→polarity/signal, Strong→binding, Weak→transformation** — whose *outputs* (scores,
clusters, relations) are the product you consume.

### Design commitments

- **f64 everywhere.** Reproduces the JS f64 engine bit-for-bit. Tight conformance tolerance
  (~1e-9, vs the f32 ports' 2e-4), exact deterministic snapshot/replay, trustworthy ranking numerics.
  The Rust plane is the most-precise plane in the fleet.
- **Deterministic by construction.** Fixed `dt`, seeded RNG (once stochastic forces land). This is the
  load-bearing property for the "Field Receipts" auditability thesis — receipts become a thin opt-in
  layer, never a retrofit.
- **Zero runtime dependencies** in `fundamental-core` — same contract as the JS core.
- **Strict dependency direction:** `core ← platform ← {surfaces}`. Core never depends up.

## Layout

```
rust/
  Cargo.toml                     # workspace
  crates/
    fundamental-core/            # the engine — DOM-free, renderer-agnostic
      src/
        math/                    # Vec3 + scalar helpers
        engine/                  # types (Body/Particle/Env), Force trait, Registry
        forces/                  # the force catalog
      tests/
        golden_conformance.rs    # loads the SHARED conformance golden; must reproduce every dv
```

Modules mirror the JS/Swift/Kotlin folder scheme (`math` · `engine` · `forces` · `config` ·
`recipes` · `record`), so a change lands in the same-named place on every plane.

## Status

**Milestone 1 — cross-plane physics parity (proof-of-life).** ✅
The six deterministic canonical forces (`attract`, `repel`, `swirl`, `stream`, `tether`, `viscosity`)
pass the shared `conformance-golden.json` — the same fixture the Swift port consumes — across all 120
of their cases.

**Milestone 2 — the `step()` loop.** ✅
`FieldStore` (the particle pool) + the legacy semi-implicit Euler integrator: body forces → mass
scaling → speed cap → integrate → damp, plus per-body density sampling and the frozen-frame (`dt=0`)
drain (#967). Advanced lanes (formations, waves, modifiers, velocity-Verlet, mortal matter, agents,
separation) are explicitly deferred and no-op until their capability lands.

**Milestone 3 — the canonical nine + the determinism seam.** ✅
- `record::Rng` — seeded mulberry32, **bit-identical to the JS stream** (verified against captured JS
  values). Deterministic-by-default (seed 0). The single source every stochastic draw flows through.
- `config` — the canonical force colours.
- **Effects-as-data**: a force never mutates the world directly — it emits an `Effect` (or draws
  `env.rng()` / requests a capture) and the integrator resolves it. This is the substrate the Field
  Receipts thesis wants (effects are recordable values), and it keeps the hot loop borrow-clean.
- The last three canonical forces: `jet` (RNG exit cone), `wall` (bounce + spark effect), `sink`
  (capture → hold → supernova release, count-conserving). **The canonical nine are complete.**

Tested: RNG cross-plane parity + determinism, jet nozzle relaunch, wall bounce/spark thresholds, and
the sink capture-and-hold / release-at-capacity cycle.

**Milestone 4 — natural + extended forces (self-contained set).** ✅ 9 → **21 forces**.
- Natural (§20.10): `gravity`, `charge` (shared softened inverse-square kernel), `magnetism` (Lorentz
  rotation, speed-preserving), `thermal` (Langevin/Box–Muller kick off the seeded rng).
- Extended (§20.3), the class-[A] single-particle set: `lens`, `gate`, `buoyancy`, `shear`,
  `crystallize`, `wind` (curl-noise), `pigment` (colour transport), `warp` (wormhole throat).
- Added the state they need (`Particle.charge`/`.color`, `Body.source_mass` + warp pairing) and the
  hex↔RGB colour helpers.

The remaining 15 forces wait on their subsystems: **neighbour query** → `collide`/`align`/`cohesion`/
`pressure`/`link`/`hunt`; **scalar grid** → `diffuse`/`propagate`/`memory`; **integrator modifier +
source passes** → `resonate`/`spotlight`/`screen`/`spawn`/`morph`; **net field-line hook** → `fieldflow`.

**Milestone 5 — the neighbour query + class-[B] forces.** ✅ 21 → **26 forces**.
- A uniform-grid **spatial hash** (`Neighborhood`) — a frame-start snapshot of the pool, rebuilt each
  step only when a class-[B] force is in play. Because a particle integrates at the end of its own
  iteration, its snapshot sample sits at distance 0 when it's processed, so the forces' `d < 1e-6`
  guards skip self exactly as JS's identity check does.
- The five read-only neighbour forces: `align` (boids), `cohesion` (surface tension), `pressure` (SPH
  even-fill), `link` (Verlet distance constraint), `hunt` (two-species pursuit).

**Milestone 6 — the integrator modifier pass.** ✅ 26 → **28 forces**.
The `Force` trait gains a `modify` hook (`ForceModification { strength, gate }`). Before a body's force
pass, its modifier tokens run: gates OR, strength factors multiply (order-independent). `resonate`
pulses sibling strength `S(t) = S₀(1 + sin ωt)`; `spotlight` gates siblings to a heading cone.

**41 tests, all green.**

### Next (toward full parity — 8 forces remain)

- **`collide`** — the one class-[B] force that mutates its neighbour; needs a pairwise-impulse effect.
- **Source/scatter pass** → `spawn` (mortal matter + a spawn effect), `morph` (target set + scatter).
- **Scalar grid** → `diffuse`/`propagate`/`memory`.
- **Cross-body `screen`** (integrator force-pass attenuation) + **net field-line hook** → `fieldflow`.
- `solve(until_settled)` = `step()` to convergence.
- Snapshot + causal replay (the receipts substrate).
- The CMS-facing reading layer: scores (density/potential per body), clusters (density basins),
  relations/recommendations (nearest-in-field).

## Develop

```sh
cd rust
cargo test          # includes the cross-plane golden conformance test
cargo clippy --all-targets
cargo fmt --check
```
