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
- [x] **`FieldHandle` surface** — `threads()` (§10) and `burst()` (§11) both land;
      `burst(x,y,hex?)` shoves + heats + tints nearby matter and detaches bound
      particles (pure `burstImpulse` helper, golden-tested). The §13 API is complete.
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

## Phase 4 — Agents & reciprocity (§22) + word effects ✅

Ordered for overnight (highest visible value first):

- [x] **4a — Two-way density feedback (§8).** Per `data-feedback` body, sample local
      density (`count` within `range·0.5`), ease into `--d`; expose `--mass`/`--load`
      for absorbers; optionally drive variable-font weight via `data-fmin/fmax/opsz`.
- [x] **4w — Word effects (the punctuation rule, §11 note).** Wire the site hero
      word(s) with `data-feedback` + CSS so `--d` drives weight + `text-shadow` glow
      + colour (glow/grow). **No particle-into-letterform assembly.** Optional one-shot
      ripple/spark on engage.
- [x] **4b — Threads (§10).** `__field.threads(list)` — glowing connector lines with
      travelling pulses between an engaged `[data-index][data-threads]` set.
- [x] **4c — Element agent (§22.4).** `[data-target]` elements moved by forces via a
      transform offset (element mass `m_el`); anchor spring + field pressure.
- [x] **4d — Event agent (§22.5).** `data-on="dense:field:lit, captured:field:dock"`
      → debounced `CustomEvent`s carrying `{ body, influence, value }`.

## Phase 5 — Micro-reactions (§23) ✅

- [x] **5a — Reaction kit + budget.** `ΔE → I`; spark/flash/pulse primitives; wire
      `env.spark` to a real spark draw pass (reflect already calls it).
- [x] **5b — Recoil (the missing side, §23.5).** reflect/collide push back on the
      body/agent split by mass; **chromatic shed** (tint by the acting force, §20.8).
- [x] **5c — Render modes (§20.6).** trails, links, knockout — the easy high-impact ones.

## Phase 6 — Depth: physical primitives, presets, mass

- [x] **`gravity` + `charge`** — the shared softened inverse-square kernel
      (`s/(d²+ε²)`, Plummer ε=r_s, |v|≤c), in `forces/natural.ts`; opt-in, registered
      alongside the nine. Golden-tested (§20.10).
- [x] **`magnetism`** — the Lorentz force (`F = qB·(−v_y, v_x)`), perpendicular to
      velocity so it curls a moving charge without doing work; `spin` sets the
      out-of-plane sense. In `forces/natural.ts`, golden-tested (§20.10). Completes
      the EM pair with `charge`.
- [x] **`thermal`** — Langevin/Brownian agitation (`v += √(2T)·ξ`), the honest
      `wander`; paired with `drag` it's a fluctuation–dissipation thermostat. Pure
      `thermalSigma` + isotropic Box–Muller kick, in `forces/natural.ts` (§20.10).
- [x] **`collide`** — elastic pairwise collision via the live `env.neighbors`: overlapping,
      approaching discs exchange normal momentum (half-impulse each, `e = strength`).
      `forces/natural.ts` (§20.10).
- [x] **Scalar `grid` Env service** (§20.1 [C]) — `ScalarGridImpl` (bilinear sample,
      deposit, central-diff gradient, diffusion + leapfrog-wave stepping), wired into
      `field.ts` lazily (no grid allocated unless a force asks; per-frame `step()` +
      viewport `resize()`). Live field unchanged (preview-verified). Golden-tested.
- [x] **`diffuse`** (class [C]) — pheromone/stigmergy: deposit a mark into the diffusing
      `grid` and follow the blurred gradient up-slope; trails self-organize. `forces/natural.ts` (§20.10).
- [x] **`propagate`** (class [C]) — a travelling wave: an engaged body injects a shock into
      a wave-mode `grid`; particles ride the wavefront. `forces/natural.ts` (§20.10).
      **All §20.10 natural primitives now done.**
- [x] **The preset layer** (§20.9) — `data-preset="blackhole"` expands to several
      co-located virtual bodies (one primitive each, own attrs, shared rect) via
      `expandPreset`; `config/presets.ts` holds the table (blackhole/whitehole/star).
      Opt-in, additive to the scanner; `data-body` path untouched. The cosmology family
      as composition, no engine growth. (`warp`/`spawn` composites await those atoms.)
- [x] **More presets** — `quasar` (black hole + polar jets), `galaxy`, `nebula`,
      `tornado`, now that `lens`/`buoyancy`/`thermal`/etc. exist. A registry-cross-check
      test guards against any preset naming an unregistered token.
- [x] **First-class mass** (Option B, §21.3) — the integrator scales the body-force Δv by
      `1/m` (captured before the pass, divided after — no force needs to know about mass);
      the `mass: true` FieldOption makes particle mass ∝ size. Gated on `m ≠ 1`, default off,
      so the live field is unchanged (preview-verified). Golden-tested (a=F/m).

## Designed extended forces (§20.3, class [A] — opt-in, pure per-particle)

- [x] **`lens`** — rotates velocity preserving speed (`θ = θ_max·(1−d/d_max)·sign`);
      a path bend with no energy. In `forces/extended.ts`; also restored to the
      `blackhole` preset. Golden-tested (§20.3).
- [x] **`gate`** — a one-way membrane: passes matter along its heading `n`, reflects
      wrong-way crossers (`v −= 2(v·n)·n`); box-sized like `reflect`. `forces/extended.ts` (§20.3).
- [x] **`buoyancy`** — constant lift/sink by density difference (`ρ_p = base/(size·(1+heat))`);
      hot/large matter rises, dense settles; `range 0` = global. `forces/extended.ts` (§20.3).
- [x] **`shear`** — a laminar velocity gradient (Couette): flow speed along the axis
      grows with perpendicular offset (`v_∥ += S·(offset_⊥/d_max)·(1−d/d_max)`). `forces/extended.ts` (§20.3).
- [x] **`crystallize`** — a phase change: cool matter snaps onto a lattice (`v += (node−p)·k_snap`,
      then damps) and settles solid; hot matter melts and moves free. `forces/extended.ts` (§20.3).
- [x] **`align`** (heading variant) — steers velocity toward a heading preserving speed
      (`v += (ĥ·|v| − v)·k_align`). `forces/extended.ts` (§20.3). The `[B]` neighbour-mean
      variant awaits the `neighbors` service.
- [x] **`wind`** — divergence-free turbulence: the curl of a sinusoidal streamfunction
      (`v += curl(ψ)·S`, `∇·curl ≡ 0`), closed-form so deterministic. `forces/extended.ts` (§20.3).
- [x] **`cohesion`** (class [B]) — short-range pressure + mid-range pull over `env.neighbors`,
      i.e. surface tension; normalized to UI-sane velocities. `forces/extended.ts` (§20.3).
- [x] **`align` `[B]`** — now steers toward the neighbour-mean heading (boids) when it has
      neighbours, falling back to the body heading when alone. `forces/extended.ts` (§20.3).
- [x] **Modifier pass + `resonate` + `spotlight`** — the `Force` contract gains an optional
      `modify(b,p,env) → {strength?, gate?}`; the integrator runs modifiers before a body's
      core tokens, scaling their strength (`resonate`: `S(t)=S₀(1+sin ωt)`) or gating them to
      a heading cone (`spotlight`). Live field unchanged (preview-verified). **The entire force
      catalog — canonical nine + natural + extended + modifiers — is now complete.**

## Phase 7 — Adapters, the landing page, Lab, docs site

- [x] **Vanilla adapter** — `mountField(opts)` creates a fixed full-viewport canvas,
      starts the engine, returns the `FieldHandle` (`destroy()` also removes the canvas).
      The framework-free imperative mount, in `@forces-ui/elements`.
- [x] **React adapter** (`@forces-ui/react`) — `<ForcesField>` component + `useForcesField`
      hook mount the engine via `createField`; every `FieldOptions` prop + an `onReady(handle)`.
      React is a peer dependency (the one approved framework dep; core stays zero-dep).
      Typecheck + `pnpm -r build` green.
- [x] **The Field Manual `/reference` — the complete definition, in the UI.** Renders
      `MANUAL_FORCES`/`MANUAL_PRESETS`/`MANUAL_CONDITIONS` from core: every one of the 26
      forces with its law, `data-*` attributes, and description; presets as compositions;
      the `data-when` gates — all over the live field, linked from the home page. Driven by
      the catalog (completeness-tested), so it can't drift from the engine. Opens with a
      **live, playable `<forces-cell>` demo** + a force switcher (attract/repel/vortex/stream/
      gravity/spring/buoyancy) — the manual explains by being it.
- [x] **forces-ui.com rebuilt on the engine.** The home page is now the engine-driven
      manual — the live `<forces-field>` runs the whole engine (its first real consumer);
      the hero `mass.` is a real `data-feedback` body that glows; the Field Cell row demos
      forces; the chapter rail (Substrate → Forces → Conditions → System), the "every element
      has mass" thesis, Bricolage + Martian Mono, Currents, and the force palette are all
      present; copy says nine; a11y + perf passes done. The deep dives are `/reference` (the
      complete definition + a live demo) and `/lab` (interactive). _Optional future expansion:
      the full long-form 4-chapter arc with a demo behind every single concept._
- [x] **Field Cell** (`<forces-cell force="vortex">`) — an in-frame, container-sized
      single-force/formation demo surface (§25.1); the embeddable unit for the
      manual's per-concept demos and the poster/render-mode variant.
- [x] **The Lab** (§14) — `/lab`: pick a force, click to drop a real `[data-body]` node,
      drag to move, double-click to remove; the single background field reacts (the
      field-reacts law, not foreground particles). The layout serializes to the URL hash
      (shareable, restorable). `<forces-field>` now proxies the FieldHandle surface
      (`scan`/`rescan`/`setAccent`/`setFormation`/`burst`) so any page can drive it. Linked
      from the home page; build + preview verified.
- [x] A published docs site (the executable design system) — `/reference` renders the
      complete force catalog (laws, attributes, presets, conditions) live from the engine's
      single source of truth, with a playable demo. The executable design system, shipped.

## Cross-cutting

- [x] **Performance** — `<forces-cell>` uses `ResizeObserver` + `IntersectionObserver`-gated
      rAF (pauses off-screen); the main field now pauses its loop + idle timer on
      `visibilitychange` when backgrounded. (`OffscreenCanvas` + worker offload remains as a
      larger future optimization.)
- [x] **Accessibility** (§18) — reduced motion (integrator `dt=0` + static cell frame +
      CSS animation off), focus engagement (`[data-hot]` on focus), `z-index:0` background
      layer, and the decorative canvases (`<forces-field>`, `<forces-cell>`, `mountField`)
      now marked `aria-hidden` so assistive tech skips them.
- [x] **Colour templates** — `config/palettes.ts`: four accent palettes (`ours`, `heatmap`,
      `infrared`, `spectrum`) selectable via the `palette` FieldOption / `<forces-field palette>`
      attribute, and swappable live with `field.setPalette(name | hex[])`; a switcher in the Lab.
      Golden-tested.
- [ ] Naming/color reconciliation pass against the canonical palette (§20.2).
      **Decision-gated:** renaming the forces / reconciling the 24-force palette is an
      opinionated design call best made by the user (distinct from the colour templates above).
- [x] Emit the design tokens (`--f-*`, `--coherence`, `--ease`) from `forces.config.ts` (§25.2).
- [x] Public-facing explainer: Element→Field / Field→Element, anatomy of a body,
      "captured = released" (§25 + possibilities); the plain-language on-ramp.

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
