# Platforms & use-cases frontier

> **Status: exploration.** This is a forward-looking catalog of *where else* the engine could run and
> *what else* the field is good for — not a commitment. Nothing here is shipped. Each entry has a
> corresponding **draft brief on the RC1 board** ([user Project #24](https://github.com/users/zachshallbetter/projects/24),
> Status `Backlog`) so the idea is dispatchable when it gets prioritized. Strategic context lives in
> [`planning-archive/roadmap-frontiers.md`](../planning-archive/roadmap-frontiers.md); the shipped port
> status is in [`../../android/README.md`](../../android/README.md) and the
> [Swift](../../swift/) tree.

## Why this is even possible

The engine's leverage is one architectural fact: **`@fundamental-engine/core` imports zero DOM and reaches
the outside world only through an injected `FieldHost`** (enforced by `core/dom-boundary.test.ts`, empty
allowlist). A "new platform" is therefore not a rewrite — it is *a new host + a new draw surface*. The
Swift and Kotlin ports already prove the seam holds: both mirror the npm packages 1:1 and pass the shared
cross-plane conformance golden. Everything below is a variation on "implement `FieldHost` over X" or "read
the field out instead of drawing it."

Two structural reminders shape the whole list:

- **The differentiator is reciprocity, not particles.** Bodies bend the field and the field's local
  density bends them back. The use-cases worth pursuing are the ones where *bidirectional influence is the
  product* — a settling, responsive system — not the ones where a tween would do.
- **The field is fill-rate-bound, not particle-bound** (see CLAUDE.md "Performance"). Drawing is the cost;
  the sim is cheap. That is exactly why the **headless / non-visual** uses below are so attractive — they
  pay none of the draw cost and `render: 'none'` is already the default (#538).

---

## A. Languages & runtimes — new cores/ports behind the same `FieldHost` seam

| Idea | Sketch | Why it's interesting | Component |
|---|---|---|---|
| **Rust + WASM core** | Reimplement the hot path (force accumulation, integration, grid sampling) in Rust+SIMD, compile to WASM; TS becomes the host/binding layer. Long arc: JS and native planes *link the same core*. | Highest-leverage item here. Collapses the "fix an engine bug in every plane" tax toward one numerically-authoritative core. | Architecture |
| **C / embedded** (RP2040, ESP32) | `FieldHost` over an LED matrix or e-ink panel. | Allocation-light core + one strong invariant (particle count) → a *physical ambient display*; importance/attention rendered as light. "Invisible field, physical surface." | Core engine |
| **GPU compute core** (WGSL/GLSL) | A second core implementation running the whole sim on the GPU; instanced draw on top. | The path to 100k+ bodies. The fill-rate lesson says draw is the wall — compute-shader sim + instanced draw blows past it. | Rendering |
| **Python host** (data/agents, not UI) | Bindings to feed bodies in and read `sample()`/`sampleGradient()` out. | Not for drawing — for using the field as a force-directed reasoning/embedding substrate (see section C). | Consumer DX & API |

## B. Use-cases that exploit *reciprocity* specifically

| Idea | Sketch | Why it's interesting | Component |
|---|---|---|---|
| **Force-directed graph/diagram layout** | Nodes = bodies, edges = `addEdge` springs, read positions each frame. A live, settling system, not a one-shot algorithm. | Probably the most *defensible product* hiding in here. Reciprocity is the moat — almost no layout library has it. Drag a node, the neighborhood reorganizes. **Recipe-shaped** → candidate for `EXPERIMENTAL_RECIPES` (`relationships` domain). | Consumer DX & API |
| **Headless layout / constraint solver** | Settle bodies under attract/separation/cohesion with `render:'none'`, read final positions, place real DOM. | The field as an *invisible* layout engine — tag clouds, docks, avatar piles, magnetic snapping — without drawing a particle. | Platform/DOM |
| **Recommendation / accretion ranking** | Importance=gravity, signal=electromagnetic, binding=strong; items accrete attention via the sink/accretion model (`--load`). | Physics-as-explanation: a *visible, explainable* ranking surface. **Recipe-shaped** → candidate for `EXPERIMENTAL_RECIPES` (`priority` domain). | Consumer DX & API |

## C. Headless / non-visual — the underexplored frontier

These draw nothing. `headlessHost` already exists.

| Idea | Sketch | Why it's interesting | Component |
|---|---|---|---|
| **Embeddings clustering engine** | Drop N embeddings as bodies in 2-/3-D, run attract+separation, read clusters via `readParticles`/`grid`. | An *interactive, incremental* force-directed projection (add a doc, it finds its place) instead of a frozen UMAP. | Core engine |
| **Agent steering substrate** | Agents probe `sample(x,y)` to feel a designed relevance field and move toward signal; `addAgent` ticks them. | Most forward-looking use in the current API, and least documented. We *just* shipped `addAgent`/`sample` on all four planes — the field becomes shared spatial memory multiple agents navigate. | Consumer DX & API |
| **Server-side / edge SSR pre-settle** | Compute the settled field on the server (Go/Rust headless), ship initial positions in HTML, hydrate live client-side. | No layout-shift flash; the field arrives already arranged. | Platform/DOM |
| **Sonification host** | `FieldHost` mapping density / particle capture / `supernova` events to a Web Audio graph. | Importance becomes *sound*. Accessibility win and an art piece at once. | Rendering |

## D. Platforms & hosts — new draw surfaces, same core

| Idea | Sketch | Why it's interesting | Component |
|---|---|---|---|
| **Terminal / TUI host** | `FieldHost` over a cell grid (Ink / ratatui / Bubble Tea). | Delightful *and* the strongest conformance demo — if it works in 80×24 cells, the host seam is genuinely clean. | Platform/DOM |
| **Game-engine host** (Godot / Bevy / Unity) | Native host over the engine's draw API. | The native ports already prove the core ports; makes Fundamental a diegetic UI / juice layer — menus, inventory, cooldowns as real fields. | Architecture |
| **WebGPU volumetric web plane** | Push `@fundamental-engine/three` to true volumetric via WebGPU. | visionOS already runs 3-D-native; bring depth-as-a-real-axis to the web. | Rendering |
| **Design-tool plugin** (Figma) | `FieldHost` over the plugin canvas. | Designers *feel* importance/attention while composing — bridges "concepts describe, tokens execute" inside the design tool. | Consumer DX & API |
| **React Native / Flutter host** | A cross-platform-framework host below the Kotlin/Swift level. | One field layer usable from RN/Flutter apps without dropping to native per platform. | Architecture |

---

## Ranked top three (where to actually start)

1. **Rust + WASM (eventually shared) core** — architectural force-multiplier; collapses the multi-plane
   maintenance tax and unlocks every native/embedded host.
2. **Headless force-directed layout / graph engine** — the most defensible standalone product; reciprocity
   is the moat.
3. **Agent steering substrate** (`sample`/`addAgent`) — most forward-looking; the API just landed on all
   four planes and has the least demo/docs behind it.

## Note on the site "use cases" surface

The site's use-case metadata (`apps/site/src/lib/recipe-taxonomy.ts`) is **keyed to the 64 locked
`FIELD_RECIPES`** — each entry needs a `scaffoldId`, a render mode, and one of nine UI-problem domains.
Most ideas here are *ports and applications*, not UI recipes, so they do **not** belong in that taxonomy.
The two genuinely recipe-shaped entries — **force-directed graph layout** (`relationships`) and
**accretion ranking** (`priority`) — are flagged above as candidates for `EXPERIMENTAL_RECIPES` (never the
locked set; see CLAUDE.md "Recipe canon is locked"). Everything else lives here and on the board.
