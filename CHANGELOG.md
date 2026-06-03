# Changelog

## 0.1.0 — the complete engine

The first feature-complete milestone: the full reciprocal-field engine, a
self-documenting site, and adapters for any stack. Every ROADMAP item is checked.

### Engine

- **26 forces** — the canonical nine (§6); seven **natural primitives** (`gravity`,
  `charge`, `magnetism`, `thermal`, `collide`, `diffuse`, `propagate`; §20.10); nine
  **designed-extended** forces and two **modifiers** (`lens`, `gate`, `buoyancy`,
  `shear`, `crystallize`, `align`, `wind`, `cohesion`, `resonate`, `spotlight`; §20.3).
- **Env services** — spatial-hash `neighbors`, the scalar `grid` (diffusion + leapfrog
  wave), the integrator **modifier pass**, and **first-class mass** (`a = F/m`).
- **Preset layer** (§20.9) — `blackhole`, `whitehole`, `star`, `quasar`, `galaxy`,
  `nebula`, `tornado`, guarded by a registry cross-check.
- **Full `FieldHandle` API** — `scan`/`setAccent`/`setFormation`/`threads`/`burst`/
  `setPalette`/`destroy`, proxied onto `<forces-field>`.
- **Colour templates** — `ours`, `heatmap`, `infrared`, `spectrum`.
- **§20.2 reconciliation** — a canonical colour for every registered force.

### Site (forces-ui.com)

- The engine-driven **home** page; **`/reference`** — the Field Manual, rendered from
  the catalog (pinned to the engine by a completeness test) with a playable demo;
  **`/lab`** — paint forces on the page, watch the single field react, share via URL.

### Adapters

- The `<forces-field>` **custom element**, the framework-free **`mountField()`**, and
  the **`@forces-ui/react`** `<ForcesField>` component + `useForcesField` hook.

### Quality

- **162 core tests**, every merge green-and-tested.
- **Zero runtime dependencies** in the engine; React is a peer dependency of the React
  adapter only.
