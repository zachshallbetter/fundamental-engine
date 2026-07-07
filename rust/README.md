# Fundamental — Rust plane

The Rust port of the Fundamental relational field engine. A fourth plane alongside the JS reference
core (`packages/core`) and the Swift/Kotlin ports, held to the **same** cross-plane conformance golden.

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
the sink capture-and-hold / release-at-capacity cycle. **18 tests, all green.**

### Next

- The extended + natural force sets (→ 36 forces total).
- `solve(until_settled)` = `step()` to convergence; spatial hash for large fields.
- Snapshot + causal replay, building on the RNG seam + effects-as-data (the receipts substrate).
- The CMS-facing reading layer: scores (density/potential per body), clusters (density basins),
  relations/recommendations (nearest-in-field).

## Develop

```sh
cd rust
cargo test          # includes the cross-plane golden conformance test
cargo clippy --all-targets
cargo fmt --check
```
