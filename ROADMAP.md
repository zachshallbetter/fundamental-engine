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
- [x] `pnpm install` + green `typecheck` / `test`.

## Phase 1 — The core engine ✅

- [x] `FieldStore`: particle pool + uniform-grid spatial index + `Env` services
      (`grid`/`spark`/`supernova` stubbed for later phases).
- [x] The loop + integrator + the reduced-motion `dt=0` path (§18). Unit-mass path
      for now; first-class `a = F/m` is Phase 6 (§21.4).
- [x] Body scanner: `[data-body]` → bodies, re-measured per frame (§2.1).
      `[data-preset]` lands with the preset layer (§20.9).
- [x] `node:test` coverage — integrator, store, spatial hash, scanner, conditions,
      math (25 tests), incl. the reduced-motion and edge-wrap (conservation) cases.
- [x] `createField` browser entry + a minimal particle renderer; `<forces-field>`
      mounts it. (Forces themselves are Phase 2; Currents + full render are Phase 3.)

> Toolchain note: source uses `.ts` import extensions + `rewriteRelativeImportExtensions`
> so `node:test` runs the source directly and `tsc` emits Node-valid `.js`. Zero test/build
> framework — just TypeScript.

## Phase 2 — Forces, conditions, formations ✅

- [x] The canonical nine as modules in `forces/` (§6), registered into `createField`;
      absorb capture → supernova release (§6.9) + captured-particle drift.
- [x] Condition predicates (`data-when`: active/fast/slow/hot/cool) — built in Phase 1.
      Remaining: the selective-gate-on-bound-particles rule (with Currents, Phase 3).
- [x] Formations: eased global bias (`easeFormation`, lerp 0.03/frame), the
      `spread`/`conv`/brownian terms, and the scroll-journey conductor
      (`[data-formation]` sections in view → ease; idle → `ambient`) (§7).
- [x] Golden tests: each force's per-frame math matches the spec formulas (13 tests).

Carried over from the Phase 1 conformance audit:

- [x] **Formation easing** — `easeFormation` lerps the active preset toward target
      at 0.03/frame; `setFormation` sets the target (§7).
- [x] **Formation terms** — integrator now applies `driftX`, curl-noise, periodic
      **brownian** (every 40 frames), **`spread`** (`Particle.gx/gy`), and **`conv`**
      (accretion target via `accretionTarget`) (§7).
- [ ] **`FieldHandle` surface** — add `threads()` (§10, Phase 4) and `burst()`
      (§11, interaction) to match the §13 API. Deferred to their phases.
- Phase 3 will also bring: the cool→warm distance render ramp + accent blend
  (§20.8 — Phase 1 ships a minimal heat-only tint), and `alpha:false` vs the
  current transparent-overlay canvas (deliberate, revisit with Currents).

## Phase 3 — Substrate & Currents ✅

- [x] Currents (`currents.ts`): 5 wave layers + bound shimmer riding them + the
      wave-current flow that drifts free particles along the slope (§24, §2.3).
- [x] Wave rendering (gradient fills + glowing strokes) over an opaque dark
      substrate; the cool-baseline wave palette (§24.4); upgraded free-particle
      render — cool centre → warm edge → accent (`particleRGB`, §20.8).
- [x] The conservation **reservoir** (`reservoir.ts`, §2.4): wave-healing reclaims
      calm free matter onto the lines (capped at `boundTarget`); a supernova tears
      nearby bound matter loose. Count conserved throughout.
- [x] **Force-tearing** (`tearBoundByForces`): any force reaching a bound particle
      tears it loose so it feels the force (selective gates skip bound).
- [x] **The "spine"** — waves bend toward the engaged element (`waveYat` pull);
      hover/focus a `[data-hot]` element to engage it (`b.on` → on-state forces).
- [x] **Accent journey** (§9): scroll travels the palette (`sampleStops`), a
      hovered `[data-color]` element overrides; the field recolours with it.

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
