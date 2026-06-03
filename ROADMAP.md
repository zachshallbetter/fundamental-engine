# Roadmap — the refactor to world-class

The prototype (`docs/reference/`) is plain global-script DOM + one `rAF` loop:
brilliant, but untyped, monolithic, and bound to one page. The goal is a clean,
typed, modular, framework-agnostic engine that realizes the spec
(`docs/forces-system.md`) without losing the feel.

Guiding principles:

- **The spec is the contract.** `docs/forces-system.md` is law; code conforms to it.
- **Grow primitives rarely.** New ideas are composites or emergent behavior (§20.0).
- **One source of truth.** `src/config/forces.config.ts` — never re-declare catalog data.
- **Framework-agnostic core.** Zero UI-framework deps in the engine; adapters are separate.
- **Make the transfer legible.** Micro-reactions (§23) are first-class, not polish.

## Phase 0 — Foundation ✅ (in progress)

- [x] Project scaffold (TS, tsup, vitest, strict).
- [x] Canonical catalog typed from `ds-data.js` → `config/forces.config.ts`.
- [x] Core contracts → `core/types.ts` (Particle · Body · Env · Force · Agent).
- [ ] `pnpm install` + green `typecheck` / `test`.

## Phase 1 — The core engine

- [ ] `FieldStore`: the particle pool, a spatial index (uniform grid/hash),
      optional scalar grids, and the extended `Env` services (§20.1).
- [ ] The loop + integrator (`a = F/m`), with the reduced-motion `dt=0` path (§18).
- [ ] Body scanner: `[data-body]`/`[data-preset]` → bodies, re-measured per frame (§2.1).
- [ ] Unit tests for the integrator and conservation invariants (§21.1).

## Phase 2 — Forces, conditions, formations

- [ ] The canonical nine as modules in `forces/`, registered against the contract (§6).
- [ ] Conditions (`data-when`) and the selective-gate rule (§5).
- [ ] Formations + the eased global bias, and the scroll journey (§7).
- [ ] Golden tests: each force's per-frame math matches the spec formulas.

## Phase 3 — Substrate & Currents

- [ ] Currents (the carrier waves): flow field + bound/free reservoir + healing (§24, §2).
- [ ] Wave rendering and the cool-baseline palette tied to the accent journey (§24.4).
- [ ] The conservation law as bookkept code (§2.4).

## Phase 4 — Agents & reciprocity (§22)

- [ ] Element agent: forces move DOM via transforms; element mass `m_el`.
- [ ] Event agent: `data-on` → debounced `CustomEvent`s (the field drives behavior).
- [ ] Two-way density feedback → `--d` / `--load` (§8); threads (§10).

## Phase 5 — Micro-reactions & render modes

- [ ] The reaction budget `ΔE → I` and the reaction kit; **recoil** (the missing side, §23.5).
- [ ] Render modes: metaballs, trails, links, knockout, redshift/blackbody (§20.6).

## Phase 6 — Depth: physical primitives, presets, mass

- [ ] Natural primitives: `gravity`, `charge` (shared `1/d²` kernel), `magnetism`,
      `thermal`, `propagate`, `collide`, `diffuse` (§20.10).
- [ ] The preset layer (`__presets`) — cosmology as composites (§20.9).
- [ ] First-class mass (Option B) on Lab/cosmology surfaces (§21.3).

## Phase 7 — Adapters, the landing page, Lab, docs site

- [ ] Vanilla adapter (mount once, scan the DOM) + a React adapter.
- [ ] **forces-ui.com landing page = the Field Manual, rebuilt on the engine.**
      The current `public/index.html` is a placeholder; the real home is the
      Manual (`docs/reference/manual.html`) — it explains the system *by being it*
      (live demos behind every concept). Keep the bones & style (4-chapter arc:
      Substrate → Forces → Conditions → System; dark aesthetic, Bricolage + Martian
      Mono, Currents, force palette; demo-per-concept; chapter rail; the "every
      element has mass" thesis). Rebuild on the typed engine (it becomes forces-ui's
      first real consumer / the whole-engine integration test), reframe from
      site-specific → the forces-ui manual, fix the "eight"→nine copy, and do a
      responsive / a11y / perf pass. **Gated on Phases 1–5** (the demos must run).
- [ ] The Lab (paint forces; shareable fields) (§14).
- [ ] A published docs site (the executable design system).

## Cross-cutting

- [ ] Performance: `ResizeObserver`/`IntersectionObserver` sync; `OffscreenCanvas` + worker.
- [ ] Accessibility: reduced motion, focus engagement, `z-index` background layer (§18).
- [ ] Naming/color reconciliation pass against the canonical palette (§20.2).

## Stack (decided)

A pnpm monorepo. The **core engine is framework-agnostic**; consumers reach it
through a **web-component** keystone so it drops into anything.

| Package | What | Tech |
|---|---|---|
| `packages/core` (`forces-ui`) | the engine — catalog, contracts, FieldStore, forces | vanilla TS |
| `packages/elements` (`@forces-ui/elements`) | `<forces-field>` + declarative `data-body` | web components (plain now; Lit when there's UI to template, e.g. the Lab) |
| `apps/site` (`@forces-ui/site`) | forces-ui.com — the manual / landing | Astro (static; Lit islands later) |
| `packages/react` (later) | thin React adapter | React |

Why web components as the keystone: "every element is a body" is a web-components-
shaped idea; a custom element works in React/Svelte/Astro/plain HTML unchanged →
forces-ui is a *platform*, not a framework library. The site shell (Astro) is a
separate, swappable choice and shares no code with the engine.

## Open decisions

- First-class mass everywhere vs. unit-mass UI + first-class Lab (§21.4) — leaning split.
- Final package name & the 24-force palette reconciliation (§20.2).
- Site shell stays Astro vs. SvelteKit/Next (Astro chosen; cheap to revisit — it
  shares no engine code).
