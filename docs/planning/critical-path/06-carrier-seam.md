# Carrier Seam — ambient structure as a declared, swappable channel

## Status

**Proposed.** Depends on the shipped substrate spine: the Field Query API (02), the
dimension-aware accumulator (04), and the Projection Registry (05) — the registry pattern,
truth-mode passports, and governance lints established there are reused here, not reinvented.

**Step 0 is separate.** Flipping the `waves` default to off (the demotion of the current
hardcoded Currents to explicit opt-in, precedented by the `render: 'none'` flip in #538) is a
small, self-contained change and ships on its own PR before any of this document is built.
This document is the design for what replaces the *pattern*, not that flip.

## Purpose

Every project pointed at the engine ships the same five sine curves. They are identical by
construction: `buildWaves` (`packages/core/src/engine/currents.ts:46`) derives every parameter —
anchor, amplitude, frequency, phase, speed, direction, depth — as a fixed formula of the layer
index, accepts no rng, and is on by default (`opts.waves ?? true`,
`packages/core/src/engine/field.ts:364`). The only per-project variation is palette and viewport.

That is a doctrine violation, not a cosmetic bug. The first line of the project's own canon is
*the field is a substrate, not wallpaper* — and hardcoded structure painted identically over
every host is wallpaper. The engine computes the real resting structure of every page (the
superposed body field that `streamlines.ts` already samples) and then draws a fake one on top.

The Currents also bundle five jobs into one subsystem:

```txt
1. Resting structure   — the field at idle is not dead
2. Ambient drift       — free matter has directional texture (integrator.ts:277-325)
3. A matter reservoir  — bound particles that heal onto / tear off the lines
                         (reservoir.ts:19,69,105) — half of the particle-count ledger
4. Engagement response — the spine bends lines toward hot bodies
5. Depth               — layered parallax on scroll
```

This document unbundles those jobs behind one seam — the **Carrier** — so that ambient
structure becomes *declared, readable, swappable, and governed* like every other lane of the
substrate, and the sine waves become one built-in implementation instead of an engine opinion.

**The waves are not the only instance.** The 2026-07-02 doctrine audit found the same pattern
inside the integrator: the formation `wander` term applies a hardcoded **curl-noise eddy**
(`sin(p.x·0.0032 + t·0.12) + cos(p.y·0.0034 − t·0.15)`, `integrator.ts:588`) — index-constant
structure, identical in every project, applied whenever the active formation's wander exceeds
0.05 (the default `ambient` formation qualifies). The adjacent brownian kick is fine (it is
unstructured and goes through the injected rng); the *structured* eddy is a second Currents.
Its disposition is the `curl` carrier below — the eddy geometry moves behind the seam and
becomes opt-in, seeded, and declared. The element layer also **re-encodes the waves default
independently** (`packages/elements/src/index.ts:197`), and the Swift port retains pre-#538
defaults (`render: .dots`, `waves: true` — `FieldHandle.swift:118`), so Step 0 is wider than
one line in core (see Migration).

## Core principle

```txt
The engine's resting structure is declared and readable — never painted.

A carrier conveys. It does not couple.
```

Carriers are not particle decoration. A carrier is a **declared source of ambient structure**
that any consumer of the field may ride or read: free matter, bound matter, bodies, agents,
grids, queries, projections. The generalization matters — the seam is designed for all of
these consumers even where the first implementation ships fewer.

## Terminology — the lane claim

**Carriers convey.** The lane sentence extends the canon:

```txt
Concepts describe. Dimensions hold state. Fields structure. Relationships associate.
Forces couple. Carriers convey. Tokens execute. Metrics measure. Diagnostics explain.
Conditions activate. Projections reveal. Formations compose. Recipes represent.
Contracts execute. No word lives in two lanes.
```

The word is a **promotion, not a coinage**: the code already calls the waves "the carrier
waves" (`currents.ts:2`, `types.ts:663`, `integrator.ts:50`). Two disambiguations:

- **Not the accessibility sense.** "Color must not be the only *carrier of meaning*"
  (`visual-language-and-geometry.md`) is prose, not a lane word; it stays as-is. The lane word
  is always capital-C **Carrier** or `carrier` in API surface.
- **Boundaries with the neighbor lanes.** A **Force couples** — a declared, passported,
  pairwise interaction between a body and matter. A **Formation composes** — a global bias on
  where matter settles. A **Carrier conveys** — directional structure the field's contents
  ride, with no body on the other end. `fieldflow` (the force that advects matter along the
  net body field) sits at the boundary deliberately: it is a *coupling that reads what the
  `field` carrier exposes* — see Open Questions.

## What a carrier is — the consumer matrix

The seam is not "what drift do particles feel." It is "what ambient structure exists here,"
answered once and consumed many ways:

| Consumer | What it takes from a carrier | Today (waves) |
|---|---|---|
| Free matter | a drift sample — direction/strength at a point | integrator wave-current pass |
| Bound matter | anchor geometry to rest on + heal/tear mechanics | the shimmer reservoir |
| Bodies (`data-authority="dynamic"`) | a ride — engine-owned bodies may drift along structure | none (new) |
| Agents | shared spatial memory — steering samples | none (ties to the parked steering spike) |
| Queries (02) | `carrierAt(x, y)` readings + registry metadata in `query()`/`snapshot()` | invisible |
| Accumulator (04) | attribution — carrier drift shows up in the influences lane | unattributed |
| Projections (05) | reveal — lines, ink, typographic weight, agent-json | the two hardcoded draw layers |
| Depth | a z/layer lane for parallax | `Wave.depth` |

## Proposed definition

```ts
/** A declared source of ambient structure. Pure over field state — a carrier NEVER mutates
 *  bodies, matter, or metrics (mirror of the projection purity rule, 05). */
interface FieldCarrier {
  id: string;
  label: string;
  /** truth-mode passport (physical | designed | hybrid | semantic …) — same six modes as
   *  forces. A `physical`/`hybrid` claim must derive from field state (lintable). */
  mode: TruthMode;
  /** directional transport at a point — the integrator's per-particle sample.
   *  Deterministic in (x, y, t) + the field's injected rng/seed. */
  flowAt(x: number, y: number, t: number, out: Vec2): void;
  /** OPTIONAL anchor geometry — where bound matter may rest. A carrier without anchors
   *  simply has no bound pool (the reservoir generalizes against this interface). */
  anchors?(t: number): readonly AnchorCurve[];
  /** OPTIONAL depth lane for parallax; omitted = flat. */
  depth?: number;
}

/** Registry mirroring the ProjectionRegistry (05): register/unregister/list; carriers are
 *  reported (metadata only) in query().carriers and snapshots. */
interface CarrierRegistry { … }
```

`FieldOptions.carriers` declares them at construction; `field.carriers` is the runtime
registry. The existing `waves` / `waveStyle` / `waveCenter` / `waveBaseline` options become
**sugar** that registers the built-in waves carrier — no consumer breaks.

## The five verbs

```txt
Declare   — carriers are registered (options or field.carriers.register), like projections
Influence — the integrator samples registered carriers instead of input.waves
            (the one hot-path change; integrator.ts:277-325 becomes the carrier pass)
Read      — query() reports carrier metadata; carrierAt(x,y) samples; drift is attributed
            through the accumulator's influences lane (source: 'carrier:<id>')
Reveal    — carrier geometry renders through projections/render modes, not bespoke draw code
Govern    — passports required; reduced-motion equivalence required for visual expressions
            (05's rule); budgets cap carrier count + sample cost; lints below
```

## Built-in carriers

```txt
waves        (designed)  — today's Currents, demoted to one opt-in implementation.
                           Behavior-identical when enabled; pinned by test.

field        (hybrid)    — THE FLAGSHIP. Resting drift derived from the page's own
                           superposed body field (the netField streamlines.ts already
                           samples). Every project looks different by construction,
                           because their content differs. This is the honest field —
                           the substrate answer to "they always look identical."

grid:<name>  (designed | semantic) — backed by a named ScalarGrid the host writes:
                           a scent map, a data-driven current, a brand flow. The engine
                           provides advection; the application authors structure.

curl         (designed)  — divergence-free curl noise, seeded from the field's injected
                           rng. Pure visual interest, honestly labelled as such.

(candidates) tab-order current — the deferred #943, reframed: the tab sequence as a
                           semantic carrier. reading-order, scroll-history likewise.
```

## The reservoir generalization (the hard part)

The bound-particle pool is half of the particle-count ledger — the engine's one strong
invariant. Today it is welded to sine tracks (`buildBound`, `currents.ts:65`; heal/tear in
`reservoir.ts`). Under the seam:

- A carrier that exposes `anchors()` gets a bound pool; heal (`healWaves`) and tear
  (`tearBoundNear` / `tearBoundByForces`) work against `AnchorCurve`, not `Wave`.
- Conservation is enforced at the registry level: bound + free is invariant across all
  carriers, exactly as it is across the wave pool today.
- Carriers without anchors (curl, most grid carriers) simply never bind matter — the
  wave-free path is already battle-tested (`render: 'none'` fields never build waves).

The engagement spine (job 4) generalizes as anchor deformation: an anchor curve may bend
toward engaged bodies. Whether that lives on the carrier or on the reveal side is an open
question below.

## Final homes — where the wallpaper lands (decided 2026-07-02)

The seam is the **extraction mechanism**: "move the waves out of the engine" is not a package
move (elements is web-only; both native planes render waves), it is the wave code ceasing to be
engine and becoming *a carrier implementation registered through a public seam*, outside the
integrator hot path. The sugar guarantee makes the move non-breaking whenever it lands:
`waves` / `waveStyle` / `waveCenter` / `waveBaseline` remain permanently as thin sugar that
registers the built-in waves carrier — code relocates, the option surface never breaks.

```txt
Waves (Currents)          → a carrier module behind the seam (steps 2-4); options stay as sugar
Curl eddy (integrator)    → the curl carrier, same module family (step 2)
Element waves default     → deleted — the element forwards the option (Step 0, #979)
Swift pre-#538 defaults   → aligned to signals-first (Step 0, #979)
Homepage inbox mock       → a real field reading in site code (#973)
Painted site proofs       → derived from the live engine, in site code (#977)
Render reference points   → not moved — mode parameters; home is FieldOptions, declared (#975)
Ambient orbit/wander      → defaults zeroed; the dials remain declared formation knobs (#978)
```

Sequencing (decided): the pre-1.0 scope is honesty — Step 0 + the audit fixes above (#973-#979).
The move itself (steps 2-4, the seam build) is the **first post-1.0 program item**: with defaults
off, 1.0 imposes no wallpaper, the sugar guarantee makes the later relocation non-breaking, and a
three-plane hot-path SPI is the wrong thing to rush against a release.

## Migration and cross-plane treatment

```txt
Step 0  waves default off (separate PR, precedent #538) — ACROSS ALL SURFACES: the core
        default (field.ts:364), the element's independent re-encoding (elements/index.ts:197),
        and the Swift port's retained pre-#538 defaults (FieldHandle.swift:118 — waves AND
        render, which never got the signals-first flip; Kotlin checked the same way).
        Pins on the pages built on them.
Step 1  this document — terminology + seam agreed
Step 2  JS core: CarrierRegistry + the integrator carrier pass; waves refactored onto the
        seam, behavior-identical-when-enabled (golden-pinned); reservoir against anchors
Step 3  the `field` carrier (flagship), sampled on the measure cadence into a cache
        (compute/draw cadence doctrine); accumulator attribution
Step 4  ports mirror (Currents.swift/Reservoir.swift; Currents.kt/Reservoir.kt/WaveStyle.kt
        already exist as the wave halves) — Kotlin first, Swift mirrors, per the cadence
Step 5  conformance golden extension: a carrier scenario at a pinned seed joins the
        cross-plane suite (the existing goldens never pass waves — verified — so steps 2-4
        cannot break them; step 5 makes carriers themselves conformance-held)
Later   grid/curl/semantic carriers; the homepage look re-cut as an EXPERIMENTAL_RECIPES
        entry composing the waves carrier (recipes canon stays locked)
```

Perf constraints carried from doctrine: the field is fill-rate-bound — carrier sampling must
not add per-frame allocation; expensive carriers (the `field` carrier's superposition) sample
on the measure cadence into a cache and the integrator reads the cache.

## Governance

- **Passports required.** Every carrier declares a truth mode. Lint: a `physical`/`hybrid`
  carrier must derive from field state — painted structure may not claim physics (the
  wallpaper lint).
- **Purity.** A carrier never mutates bodies, matter, or metrics (the projection rule, 05).
  The integrator applies what carriers report; carriers only answer questions.
- **Reduced motion.** A carrier's visual expression must declare its reduced-motion
  equivalent (05's `reducedMotionEquivalent` rule applies to the reveal side unchanged).
- **Budgets.** Registry caps carrier count and per-frame sample cost; `FieldPolicy` may
  restrict which carriers an agent view reports.

## Open questions (owner: Zach)

1. **The lane verb.** "Carriers convey" is proposed; alternatives: carry, transport, bear.
2. **Do bodies ride carriers in v1?** The seam is designed for it (dynamic-authority bodies
   sampling `flowAt`), but shipping matter-only first is smaller. Recommend: design for,
   ship matter-first.
3. **fieldflow's fate.** Fold into "a coupling that reads the `field` carrier," or leave as
   an independent force and accept the overlap. Recommend: leave, revisit after step 3.
4. **Anchor shape.** `AnchorCurve` (parametric curve) vs point-set vs both. Curves preserve
   today's shimmer; point-sets suit grid carriers.
5. **Attribution channel.** Carrier drift in the accumulator: a new `'carrier'` channel vs
   `'linear'` with `source: 'carrier:<id>'`. Recommend the latter (no channel proliferation).
6. **The homepage.** Keep the waves carrier pinned there, or move it to the `field` carrier
   once shipped — a brand decision, not an engineering one.
7. **The wander split.** The brownian kick (unstructured, rng-seeded) arguably stays as
   honest thermal texture; the structured curl eddy moves behind the seam as the `curl`
   carrier. Confirm that split, and whether the default formation keeps any wander at all.

## Non-goals

- Not a package move. The seam lives in core (both ports need it); `elements` stays a host.
- No new forces, no recipe-canon changes, no render-mode changes.
- Not a renderer feature: carriers structure the field; how they look is the reveal lane's job.
