# Rust plane — engine reference

> Status: living document, tracks `feat/rust-core`. The authority for force *math* is the JS core
> (`docs/engine-reference/forces-system.md`); this documents the Rust surface + porting status.

## Core types (`engine::types`)

### `Vec3`
The physics vector — `{ x, y, z: f64 }`, 3D-native (z stays 0 on a flat field). `Add`/`Sub`/`Mul<f64>`/
`Neg`, `dot`, `length`, `length_sq`. The Rust plane is f64 throughout.

### `Particle`
A free agent (the lightest body). Key fields: `position`, `velocity`, `mass`, `heat` (∈ [0,1]), `size`,
`id` (stable, assigned by the store), `cap` (the sink holding it), `charge`, `species`, `color`.

### `Body`
A force source — on a headless host, backed by a **data record**. Field parameters the forces read:
`tokens` (space-joined force ids that compose), `strength`, `range`, `spin`, `heading` (the JS `ux`/`uy`
= `heading.x`/`.y`), `engaged` (the "on" state), `source_mass` (the gravity/charge scalar `M`),
`center`/`half_extents` (geometry), `absorb_r`/`capacity`/`accreted` (accretion), `warp_*` (wormhole
pairing), `visible`, `feedback`, `count` (per-frame density — **the raw score signal**), `tint`.

### `Env`
The per-apply environment the integrator hands each force. Geometry scratch (`vector` = particle→body,
`dist ≥ 1`), the ambient `form`ation, `volume` (world bounds W/H/D), `t`/`frame_n`/`dt`, `c` (speed cap)
and `g` (gravitational constant). Plus the **force→world seam**:
- `rng()` — the next seeded uniform in `[0,1)`.
- `spark(at, power, color)` — emit a `Spark` effect.
- `request_capture()` — ask the integrator to capture the current particle (`sink`).
- `neighbors(at, r)` — frame-start neighbour samples within `r` (class-[B] forces).
- `effects: Vec<Effect>` — this step's effects, cleared each `step`, drained by the caller.

### `Force` (trait)
```rust
trait Force {
    fn token(&self) -> &'static str;
    fn label(&self) -> &'static str;
    fn kinematic(&self) -> bool { false }          // replaces velocity (unscaled by mass)
    fn is_modifier(&self) -> bool { false }         // no force of its own; bends siblings
    fn modify(&self, b, p, e) -> Option<ForceModification> { None }
    fn apply(&self, body: &Body, particle: &mut Particle, env: &mut Env);
}
```

### `Effect`
A side effect a force requests, applied by the integrator with full context. Today: `Spark { at, power,
color }`. Growing: `Impulse` (collide), `Spawn` (spawn) — see the epic.

## The force catalog (28 / 36)

Legend: ✅ ported · ⬜ deferred (with the sub-issue that lands it). "Class" is the JS implementation
class — [A] single-particle, [B] neighbour query, [C] scalar grid, [D] targets, [S] source, mod =
modifier.

### Canonical nine (§6) — all ported ✅

| Token | Class | Notes |
|---|---|---|
| `attract` | A | soft gravity-like well + optional orbital swirl |
| `repel` | A | inverse-square outward push |
| `swirl` | A | tangential swirl + light inward retention |
| `stream` | A | steady directional current |
| `viscosity` | A | bleeds momentum |
| `tether` | A | holds matter at a shell radius |
| `jet` | A | kinematic; RNG exit cone at the nozzle |
| `wall` | A | kinematic; bounce + `Spark` effect on hard impact |
| `sink` | A | capture → hold → supernova release (via `request_capture`) |

### Natural primitives (§20.10) — 4 / 8

| Token | Class | Status |
|---|---|---|
| `gravity` | A | ✅ softened inverse-square, mass-sourced |
| `charge` | A | ✅ signed inverse-square (like repels, opposite attracts) |
| `magnetism` | A | ✅ Lorentz rotation — preserves speed exactly |
| `thermal` | A | ✅ Langevin/Box–Muller kick off the seeded rng |
| `collide` | B | ⬜ [#1037](https://github.com/zachshallbetter/fundamental-engine/issues/1037) — pairwise-impulse effect |
| `diffuse` | C | ⬜ [#1039](https://github.com/zachshallbetter/fundamental-engine/issues/1039) — scalar grid |
| `propagate` | C | ⬜ [#1039](https://github.com/zachshallbetter/fundamental-engine/issues/1039) — scalar grid |
| `memory` | C | ⬜ [#1039](https://github.com/zachshallbetter/fundamental-engine/issues/1039) — scalar grid |

### Designed extended (§20.3) — 15 / 19

| Token | Class | Status |
|---|---|---|
| `lens` | A | ✅ kinematic velocity rotation |
| `gate` | A | ✅ kinematic one-way membrane |
| `buoyancy` | A | ✅ density-difference lift/sink |
| `shear` | A | ✅ laminar velocity gradient |
| `crystallize` | A | ✅ lattice snap for cool matter |
| `wind` | A | ✅ divergence-free curl-noise |
| `pigment` | A | ✅ conserved colour transport |
| `warp` | A | ✅ kinematic wormhole throat |
| `align` | B | ✅ boids alignment |
| `cohesion` | B | ✅ surface tension |
| `pressure` | B | ✅ SPH even-fill |
| `link` | B | ✅ Verlet distance constraint |
| `hunt` | B | ✅ two-species pursuit |
| `resonate` | mod | ✅ pulses sibling strength `S(t)=S₀(1+sin ωt)` |
| `spotlight` | mod | ✅ gates siblings to a heading cone |
| `morph` | D | ⬜ [#1038](https://github.com/zachshallbetter/fundamental-engine/issues/1038) — targets + source pass |
| `spawn` | S | ⬜ [#1038](https://github.com/zachshallbetter/fundamental-engine/issues/1038) — mortal matter + spawn effect |
| `screen` | mod | ⬜ [#1040](https://github.com/zachshallbetter/fundamental-engine/issues/1040) — cross-body attenuation |
| `fieldflow` | A | ⬜ [#1041](https://github.com/zachshallbetter/fundamental-engine/issues/1041) — net field-line hook |

`Registry::standard()` registers all ported forces (currently 28). Each is opt-in — a body only feels a
force it names in its `tokens`, so a fuller registry never changes a body that doesn't ask.

## Subsystems

### Registry (`engine::registry`)
`token → Box<dyn Force>`. `Registry::standard()` = canonical + natural + extended (ported).
`get(token)`, `tokens()`, `len()`.

### FieldStore (`engine::field_store`)
The particle pool. `add(particle) -> id` (assigns a stable id), `remove(id)`, `particles` (the live
vec). Order is not significant (removal is swap-remove).

### Neighborhood (`engine::spatial_hash`)
A uniform-grid spatial hash (cell 64) built as a **frame-start snapshot** (`NeighborSample { id, pos,
vel, size, species }`). `rebuild(particles)`, `near(at, r) -> Vec<NeighborSample>` (true 3D distance
filter). Rebuilt inside `step` only when a class-[B] force is present.

### Integrator (`engine::integrator`)
`step(store, bodies, env, forces)` — the legacy semi-implicit Euler tick (see architecture.md → *The
tick*). Constants `FRICTION` (0.95), `HEAT_DECAY` (0.972), `EDGE` (10). Additive forces are mass-scaled
(`a = F/m`); kinematic forces set velocity outright.

### Rng (`record::rng`)
Seeded mulberry32, **bit-identical to the JS `seededRng`** (the f64 mapping — all 32 bits ÷ 2³², not the
Swift f32 24-bit truncation). `Rng::seeded(seed)`, `next_f64()`; `seeded_rng(seed)` for the closure
form. `Copy` (so a snapshot captures the exact stream position). Deterministic-by-default (seed 0).

### Config (`config`)
`CANONICAL_FORCE_COLORS` (the nine hues) + `canonical_force_color(token)`.

## Conformance

`tests/golden_conformance.rs` loads the shared `conformance-golden.json` (120 cases) and reproduces
every `dv` at `1e-9 + 1e-9·|dv|` — far tighter than the f32 ports' `2e-4`, because both this plane and
the reference are f64. A real divergence (wrong coefficient, missing leg, sign flip) blows past it.
Fixing a failure means fixing the Rust force, never loosening the tolerance. Making the crate
self-contained (a crate-local golden copy) is
[#1045](https://github.com/zachshallbetter/fundamental-engine/issues/1045).

## Verification gate

```sh
cargo test                    # unit + golden + behaviour + determinism
cargo clippy --all-targets    # lints
cargo fmt --check             # formatting
cargo doc --no-deps           # API docs build clean
```
