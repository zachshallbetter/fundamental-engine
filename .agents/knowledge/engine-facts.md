# Engine facts — the things that are easy to get wrong

Each fact was verified against source or the built catalog (engine 0.11.1, 2026-10-16). Where the code
and a doc disagree, the code is right and the doc is a bug. Re-verify before quoting a number in public.

## Catalog

| What | Value | Source of truth |
|---|---|---|
| Forces | **37** = 9 canonical + 8 natural + 20 extended | `MANUAL_FORCES` (`packages/core/src/config/manual.ts`), `data/forces-catalog.json` |
| Field Patterns | **64** = 4 tiers × 16: `core` / `applied` / `systems` / `operational` | `FIELD_PATTERNS`, `data/recipes.json` |
| Presets | **9**: blackhole, whitehole, wormhole, star, quasar, galaxy, nebula, tornado, fountain | `MANUAL_PRESETS` |
| Formations (global modes) | **5**: `ambient`, `wells`, `lanes`, `scatter`, `accretion` | `FORMATIONS` |
| Body conditions (`data-when`) | `active`, `fast`, `slow`, `hot`, `cool`, `scrolling` (and always) | `CONDITIONS` (`config/forces.config.ts`) |
| Four-field classification | only **10** forces carry it (gravity, charge, magnetism, propagate, crystallize, align, cohesion, pressure, link, morph); the canonical nine are unclassified | `FORCE_FIELD` |

`coherent`, `dwell` and `inview` are **proposed** conditions (`docs/canonical/field-possibilities.md` §6),
not shipped. `spring`, `drag`, `reflect`, `absorb`, `threads` are concepts, not force tokens.
There is no `setBodyStrength`, `ScrollAgent` or `data-truth` attribute — change a body's strength by
writing its `data-strength` (re-read live, no rescan) or through a `BodyHandle`.

## Render modes — "20" is a catalog, not 20 `render` values

`RENDER_MODES` names 20 modes. They are reached three ways:

- **`render` / `setRender()`** (10 of the 20, plus `flow` and `none`): dots, trails, links, streamlines,
  metaballs, voronoi, knockout, redshift, blackbody, depth.
- **Overlay readings / toggles**: `field-lines`, `force-vectors`, `energy` are `overlay`/`setOverlay()`
  modes (the overlay vocabulary also includes `grid`, `temperature`, `path`, `data`); `heatmap` is
  `setHeatmap()`.
- **Standalone `draw*()` helpers** you call on your own canvas: contours, potential, topology,
  inspector, causality, prediction (`packages/core/src/diagnostics/`).

`render: 'contours'` is a type error. Overlays draw only when `render !== 'none'`.

## Feedback written back to `[data-feedback]` elements (default sink)

`packages/core/src/engine/feedback-sink.ts`: `--d` **and** `--field-density` (the same eased value,
both permanent — neither is legacy), `--field-heatmap-density`, `--load` (captured matter / capacity —
only for bodies that capture), `--lit` (+ thresholded `field:lit` / `field:dim` events), and the
body's measured `--entropy`, `--coherence`, `--temperature`.

Not written by the sink: `--field-attention`, `--field-memory`, `--field-recency`, etc. — those come
from a Field Pattern metric or an explicit `platform.feedback.bind`. `--mass` is no longer written (use
`--load`). The measured `--entropy/--coherence` are distinct from pattern-inferred
`--field-entropy/--field-coherence`.

## query / snapshot / diff / replay

- `query()` body metrics: `density`, `count`, `engaged`, plus `attention`, `salience`, `load` when
  computed; per-body dimensions `entropy`, `coherence`, `temperature`. **Relationships in a query or
  snapshot are only programmatic `addEdge` edges** — relationships discovered by Field Patterns or DOM
  attributes (`RelationshipRegistry`) do not appear there.
- A `FieldSnapshot` holds bodies (identity, authority, rect/position, tokens, metrics, dimensions),
  relationships, metrics, formations, projections, frame and field clock; influences and particles
  only when opted in (`includeInfluences`, `includeParticles`). No diagnostics, event log or host
  metadata.
- `replay(a, b)` is a **structured diff of two snapshots**, not a timeline: every step carries `b`'s
  frame/time, ordered by lane (formation → relationship → body/metric → force). Force steps need
  `includeInfluences` on both snapshots.
- "What changed since the last snapshot" is `diff()`, not `query()`.

## Reduced motion

`prefers-reduced-motion` (read live each frame) sets the effective motion budget to 0 → `dt = 0`: the
simulation freezes, but **feedback keeps being computed and written**, so CSS can still express density.
Field Patterns append a static prose `<aside>` when applied with reduced motion. Gaps (audit M7, open):
`burst()` sparks are gated on a boot-time capture; threads/waves animate from wall-clock time;
`bindFieldNav` checks reduced motion only at bind. The `sound`/`haptic` projection *surfaces* are enum
members only — no built-in implementation.

## Conformance and ports

- Two tolerances, don't conflate them: in-plane `exactDelta` defaults to **2e-3**
  (`conformance/expectations.ts`); the **cross-plane golden** uses **2e-4 + 1e-3·|dv|**.
- `conformance-golden.json` = **120 cases = 6 forces × 4 variants × 5 probes** — the deterministic
  canonical subset `attract, repel, swirl, stream, tether, viscosity`. The other forces are tested
  behaviourally per plane. Never describe the golden as an "N-force" suite.
- Swift owns the fixture; Android copies it (`syncGolden`); Rust keeps a crate-local copy
  (`check:golden:sync` asserts they match). The Android core is ported from the Swift sources. The ports
  are 3D-native (`depth 0` = the JS 2D behaviour); cross-plane results are tolerance-equal, never bit-equal.
- Parity matrix: JS, Swift and Kotlin each register 37 force tokens. Registration is not reachability
  (#1176 — Kotlin `warp` was registered but unreachable until #1175).
- **Rust** registers **36 of 37** (all but `relief`, which needs a host scalar-channel API Rust lacks);
  `solve()`, snapshot + causal replay and the reading layer exist; not published to crates.io.

## Runtime behaviour worth knowing

- Six-phase platform scheduler: `discover → read → compute → state → write → render`; layout reads only
  in discover/read. The engine re-measures bodies (`getBoundingClientRect`) every 6th frame and
  scroll-compensates cached centres in between (window fields only).
- Since 0.11.1: removed `[data-body]` elements are pruned on the measure cadence (no ghost bodies at
  the origin); `destroy()` inside a frame callback stops the loop; a height-only resize within 160 px of
  the built height keeps the swarm; an unchanged overlay frame is not re-rastered; `QualityGovernor`
  scales thresholds with its frame budget (`setBudget()` / `budgetMs`).
- After #1250 (unreleased as of 2026-10-16): `mountXRay`'s hotkey ignores editable fields and the panel
  mounts on the current `<body>`.
- Two default sets: DOM `data-strength` 0.5 / `data-range` 280; conformance `resolveBody` strength 1 /
  range 300.
- The integrator is damped: not symplectic, not energy-conserving; particle count is the invariant.
  `reaction: true` is not deterministic across repeated runs in one process (#1207, open).
- `forces:*` DOM events are gone; `field:*` is the only event namespace.
- Persistent UI bodies that should keep matter moving want `swirl` with `data-spin ≥ 1.0`;
  `attract`/`sink` on a persistent element collect matter into a static clump.
