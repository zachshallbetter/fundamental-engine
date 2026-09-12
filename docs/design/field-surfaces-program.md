# Field Surfaces — the program

**Status: PROPOSED.** Nothing in this document is built. It is the design for the
five open Field Surfaces tickets — [#672](https://github.com/zachshallbetter/fundamental-engine/issues/672)
`inline` placement, [#673](https://github.com/zachshallbetter/fundamental-engine/issues/673)
`framed` placement, [#674](https://github.com/zachshallbetter/fundamental-engine/issues/674)
scalar overlays, [#675](https://github.com/zachshallbetter/fundamental-engine/issues/675)
graph overlays, [#721](https://github.com/zachshallbetter/fundamental-engine/issues/721)
overlay-canvas ergonomics — under epic
[#732](https://github.com/zachshallbetter/fundamental-engine/issues/732), feeding
[#784](https://github.com/zachshallbetter/fundamental-engine/issues/784) (E1 — field per component).
**Scope:** architecture, carried defects, build sequence, gates, three-plane honesty.
**Not in scope:** code. No engine change ships from this document; each PR in §7 is its own change
with its own gates.
**Owner:** Zach Shallbetter. §6 lists the decisions this program cannot make for him.

**Verified against `main` at `fb065cc5` on 2026-09-12.** Every load-bearing claim about current code
state below was re-read at that commit; §2.4 lists the claims that were stale in the source material
and what replaced them.

Canon this program is bound by: [visualization-methods-taxonomy.md](../canonical/visualization-methods-taxonomy.md)
(Surfaces, §11 reveal-never-mutate, the Planned note at :194–197),
[wallpaper-rule.md](../canonical/wallpaper-rule.md) (default-off, declared, proofs must be produced),
[system-contracts.md](../canonical/system-contracts.md) (§11 overlays reveal; §21 overlays must
reference real links), [support-matrix.md](../canonical/support-matrix.md) (per-surface accessibility),
[agent-consumption-model.md](../canonical/agent-consumption-model.md) (a visual layer represents, it is
never the source of meaning), [api-stability.md](../canonical/api-stability.md) (additive),
[parity-matrix.md](../canonical/parity-matrix.md), and
[forces-system.md §13.7](../engine-reference/forces-system.md) (the `render:'none'` guarantee).

---

## 1. The shape of the problem

A **Field Surface** is where the engine paints. Today there are two, and only one placement:

| Layer | What draws there | Placement today |
|---|---|---|
| underlay | matter modes (`dots`, `trails`, `metaballs`, `voronoi`) | behind page content — the fixed `<field-root>` canvas |
| overlay | readings (the additive `OverlayMode` stack) | in front of page content — a second fixed, full-viewport canvas |

The taxonomy names two placements that do not exist — `inline` (a surface scoped to one box) and
`framed` (within a stage) — and four readings that do not exist — `potential`, `topology`,
`causality`, `prediction`. That is the whole program: **two placements and four readings**, plus the
ergonomics ticket (#721) that turns the hard-coded overlay-canvas constants into declared ones.

Two facts constrain every option:

1. **Core is DOM-free** (`packages/core/src/engine/dom-boundary.test.ts` — the ALLOW set is empty).
   Placement is therefore always host work: core draws into whatever `RenderBackend` it is handed,
   sized from `host.viewport()`.
2. **Core holds exactly one `overlayBackend` and one overlay stack per field**
   (`packages/core/src/engine/field.ts`). Multiple simultaneous surfaces mean multiple fields — or a
   new core seam, which §3 rejects on evidence.

---

## 2. What actually exists today (verified at `fb065cc5`)

### 2.1 The overlay pipeline

- `OverlayMode` is **9 symbols** — `off`, `streamlines`, `force-vectors`, `field-lines`, `grid`,
  `temperature`, `energy`, `path`, `data` (`packages/core/src/engine/types.ts:687-696`);
  `OverlayInput = OverlayMode | readonly OverlayMode[]`.
- `renderOverlay(out, stack)` clears once, runs an if/else chain over the 8 drawing built-ins, and
  then **unconditionally** calls `customOverlays.get(mode)` — so a `registerOverlay(name, fn)`
  registered under a *built-in* name composes **after** the built-in. That is the sanctioned
  composition seam (`field.ts:2810-2831`, `registerOverlay` at `:3382`).
- Every reading draws only through `RenderBackend` primitives (`segments` / `polyline` / `rect` /
  `text`); `Stroke` is `{r,g,b,alpha,width}` — **no dash, no fill path**.
- The frame gate is `ctx && cfg.render !== 'none' && canvasVisible && (motion > 0 || frameN % 4 === 0)`
  (`field.ts:2991`). **A field with `render:'none'` — the default since #538 — never draws a reading,
  anywhere, silently.**
- `ensureOverlaySurface()` is idempotent and ctx-gated (`field.ts`): it calls
  `opts.overlayCanvasProvider()` **before** checking `ctx`, then returns if there is no `ctx`. So a
  signals-only field with a provider creates a canvas it can never draw to (carried as **C-24**). It
  also sizes with the **raw** `host.viewport().dpr`, bypassing `dprCap` and the quality tier's DPR
  ceiling, which only `sizeSurfaces()` applies (**C-25**).

### 2.2 The hosts

- `<field-root>` is a fixed full-viewport singleton (`:host{position:fixed;inset:0;z-index:0;…}`) and
  builds the overlay canvas lazily through a provider (#676), styled
  `position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;mix-blend-mode:screen`,
  marked `data-field-overlay`, `aria-hidden`, and idled with `display:none` when no reading is active.
- Its `overlay` getter filters the attribute against a **hard-coded `KNOWN` list**
  (`packages/elements/src/index.ts:249-263`) and returns `'off'` when nothing matches — unknown tokens
  are dropped **silently**, and a `registerOverlay` name can never be enabled declaratively.
- The contained path (#540) is vanilla-only: `createField(canvas, { bounds })` +
  `containerHost(el)` + `makeContainedCanvas(bounds)` — `position:absolute;inset:0;…` with **no
  z-index**, appended as the last child of `bounds`, promoting `bounds` to `position:relative` when
  static. There is **no contained overlay canvas** today. `MountOptions` has no `bounds`
  (`mountField` is viewport-only); only `FieldField` takes it.
- `containerHost` has **no IntersectionObserver** (verified: zero occurrences) — its `hidden` is
  `document.hidden` only.
- `createBrowserField(canvas, opts: Omit<FieldOptions, 'host'>)` **strips `host` and hard-wires
  `browserHost()`** — it cannot be handed a `containerHost`.
- `packages/dom/src/overlays.ts` (`OverlayRegistry`) is a *record* store for relationship/callout
  render records. **Nothing in production calls `overlays.add()`** (verified: zero non-test callers).
  DOM-declared links live in a different registry — `RelationshipRegistry`, populated by
  `platform.relationships.discover(root)`.
- `packages/core/src/recipes/compile.ts:50` hard-codes
  `OVERLAY_READINGS = new Set([...8 readings])`; a Pattern declaring any other layer routes it to
  `unapplied`. **This is a fifth lockstep site no gate protects** — `data/recipes.json` already names
  `potential` / `prediction` / `topology` / `causality` / `contours` under `diagnostics`, and
  `check:recipes` stays green regardless.

### 2.3 Gates, as they really are

| Gate | What it actually checks | Relevance here |
|---|---|---|
| `check:api` | removals only (`scripts/check-api-surface.mjs`) | additive work passes |
| `check:docs` (`DOCS_GATE_ENFORCE=1`) | HANDLE, OPTIONS, feedback vars, force tokens, body attrs, **FIELD_ROOT_ATTRS** | **`OVERLAY_MODES` is *not* a gated surface** — a missing row silently drops the catalog/tour button with green CI (**C-18**) |
| `check:cem` | regen + `git diff --exit-code` on `packages/elements/custom-elements.json` | any `<field-root>` attr/JSDoc/member change |
| `check:atoms` | regen `apps/site/src/data/atoms.json` + diff | readings are not atoms — expect **no diff**; it must stay green, not go green |
| `gen:parity-matrix` | JS union · Swift `case` lines · Kotlin `NAME("id")` → `data/parity-matrix.json`; staleness fails `check:docs` | every new reading, on all three planes or as an honest gap |
| `check:golden` | **force math only** (frame-0 `dv` per force) | readings never touch it; a port-side *force* change would |
| `check:links` | relative links in tracked markdown | this document |
| CHANGELOG gate (`pr-checks.yml`) | any `packages/` change needs `[Unreleased]` lines | every PR in §7 |

`overlay-modes` is currently **9/9/9** in `data/parity-matrix.json`.

### 2.4 Where the cached design work was stale

The three architectures and fourteen adversarial reviews this document synthesises were produced
against `main` at `ea615fdf`/`084fdebc`. Since then #1102, #1104–#1110, #1141 and #1145 merged.
Re-verification found:

| Cached claim | Reality at `fb065cc5` |
|---|---|
| "#721 has shipped: `createOverlaySurface()` + `<field-root overlay-blend overlay-z>`" *(brief premise)* | **False — not merged.** [PR #1146](https://github.com/zachshallbetter/fundamental-engine/pull/1146) is **OPEN** (base `main`, `MERGEABLE`/`BLOCKED`), #721 is **OPEN**, and `packages/dom/src/overlay-surface.ts` does not exist on `main`. Treat #721 as *designed and in review*, not done. |
| The helper is provider-shaped, carries `placement`/`bounds`, and owns `display:none` gating *(assumed by all three architectures)* | #1146's helper is **viewport-only** (`position:fixed`), **eager** (`createOverlaySurface(root?, opts?) → { canvas, resize, destroy }`), and **deliberately excludes** display gating ("stays with the host that knows the overlay state"). It adds `blend`, `zIndex`, `parent`, `marker`, opt-in `autoSize`, validated `normalizeOverlayBlend`/`normalizeOverlayZ`, and `overlaySurfaceCssText()`. **The placement variant is program work, not a given** (see **Q-10**). |
| `field.ts:2982` is the frame gate; `:2807-2823` the dispatch | Same code, shifted lines (`:2991`, `:2810-2831`) — #1110's resting-motion floor moved them. Every line number in this document was re-read. |
| "`reduced-motion.spec.ts` has no overlay coverage" | Still true (**0** mentions), but #1104 extended that spec to per-surface "meaning survives motion removal" — the new readings now have a pattern they are expected to follow (**C-31**). |
| "The RC-7 budgets file does not exist yet" | Still not on `main`; it arrives with the open [PR #1147](https://github.com/zachshallbetter/fundamental-engine/pull/1147). The substantive finding survives: the sweep measures `overlay ∈ {off, grid}` at page placement only, so new readings/placements are *unmeasured*, not *within budget* (**C-29**). |
| #1106 added a `palette` parity dimension | Confirmed — `data/parity-matrix.json` now carries six dimensions; the overlay row is unaffected. |

---

## 3. The decision

Three architectures were designed and each was reviewed three ways (ticket-and-canon fidelity ·
engine integrity + performance · consumer ergonomics + accessibility), fourteen reviews in all, each
returning a defect array with evidence.

### 3.1 The scoreboard

Counting distinct defects (paired re-runs of the same review prompt collapsed):

| Architecture | Blocking | Major | Where the damage landed |
|---|---|---|---|
| **MINIMAL-SURFACE** — 4 tokens in the existing dispatch; one DOM helper with a `placement` option; inline/framed ride the shipped `containerHost`/`bounds` path; no new core seam | **4** | ~14 | 2 of the 4 blockers are *shared readings-lane* defects every option has (topology registry, prediction physics); the other 2 are **scope** questions (no declarative door; #672 and #673 become one mechanism) |
| **host-idiom** — engine owns *what* a reading is, host owns *where*; `framedBackend`/`multiBackend` core adapters window the page field into a stage; per-plane port front-surfaces | **1** | ~18 | its *distinguishing* seam is refuted: an injected `overlayBackend` is built and sized at boot, so `framed` **defeats #676 laziness** (pinned by `option-seams.test.ts`), never learns about a stage resize, and pays full-viewport sampling to paint a stage-sized window; its port lane is written against objects that do not exist |
| **PLACEMENT MODEL** — Surface = layer × placement; `<field-root placement="framed">`; a core PR that relaxes the render gate so readings can draw without matter | **5** | ~14 | each *distinguishing* move is refuted: `createBrowserField` cannot take a host (3 reviewers); relaxing the gate **breaks a written canonical guarantee** (§13.7/#297: "`getContext('2d')` is never called — on the main canvas or the overlay canvas"); `placement` **collides with canon's existing use of the word**; framed-via-`parentElement` hides light-DOM children behind `aria-hidden` with no `<slot>` |

### 3.2 The winner: MINIMAL-SURFACE, as the spine

**Chosen: the minimal-surface spine — four readings drawn inside the existing `renderOverlay`
dispatch through the existing `RenderBackend` primitives, and `inline`/`framed` realised as contained
fields (`containerHost` + `bounds`) with a contained overlay canvas built by the #721 helper — no new
core seam, no relaxed render gate, no new fixed-key surface struct.**

Why it wins on the evidence, not on taste:

1. **Its blockers are shared or scoped, not structural.** Strip the two readings-lane blockers that
   all three options carry identically and the minimal spine's remaining objections are "you have not
   given the declarative host a door" and "#672 and #673 are one code path" — both decisions for the
   owner (**Q-1**, **Q-2**), neither a refutation of the mechanism.
2. **The rival mechanisms are refuted with code.** `framedBackend` cannot keep the laziness it claims
   (`option-seams.test.ts` pins `overlayBackend.size()` during initialisation); `<field-root
   placement="framed">` cannot get a `containerHost` through `createBrowserField`; the
   readings-without-matter PR contradicts a documented guarantee. None of these is a wording problem.
3. **It is the only option that adds nothing to core's shape.** One `overlayBackend`, one stack, one
   dispatcher, no clip/translate primitive, no fan-out backend, no `setSurfaces` revival (the PR #487
   lesson), no `Stroke.dash`. `check:api` sees additions only.
4. **It preserves every pinned invariant**: `overlay:'off'` ⇒ no canvas (#676), the bare
   `data-field-overlay` stays the page singleton the site's `HomeRuntime` and `body > canvas` e2e
   locators depend on, matter stays on the underlay, readings stay lines and text.

### 3.3 What is grafted from the runners-up

From **host-idiom**:

- **The ownership sentence**, adopted verbatim as this program's framing: *the engine owns what a
  reading is — vocabulary, sampling, geometry, stack order, frame gate, backing-store size; the host
  owns where it composites — element, containing block, stacking order, blend, idle gating, lifecycle.*
- **The parity-honesty policy**: a token lands on a port only when it **draws from real data** there.
  A `break` arm that keeps the matrix green is a lie (§8).
- **The per-plane ownership table** (§8), including the finding that the `three` plane's `FieldLayer`
  hard-codes `render:'none'`, so no reading can draw there without a stub-canvas underlay pass.
- **The port front-surface gap** stated plainly rather than papered over — and kept *out* of this
  program as its own epic (§8).

From **PLACEMENT MODEL**:

- **The marker scheme**: every surface carries `data-field-surface="overlay"` +
  `data-field-placement="page|framed|inline"`; only page placement carries the bare
  `data-field-overlay`. This is what protects the singleton assumptions.
- **`hostForPlacement(placement, container?)`** as a pure exported function in `dom` —
  `browserHost()` for page, `containerHost(container)` for framed/inline — so the mapping is one
  testable thing rather than a rule repeated per host.
- **One vocabulary source** (`OVERLAY_MODE_LIST`) replacing the hand-copied `KNOWN` list — with the
  reviewer's correction that `as const satisfies readonly OverlayMode[]` proves only list ⊆ union, so
  it needs an exhaustiveness test in the other direction (**C-17**).
- **Surface = layer × extent** as the conceptual model — under a different word (**Q-7**).

### 3.4 What was rejected, and why (so it is not re-proposed)

| Rejected | Reason |
|---|---|
| `framedBackend` / `multiBackend` core adapters ("a window onto the page field") | injected backends are built and sized at construction (defeats #676); no resize signal when the stage reflows; whole-viewport sampling for a stage-sized output; `measureText` cannot be fanned out. Keep as the escape hatch if **Q-2** decides `framed` must *not* claim its bodies. |
| Relaxing the `render !== 'none'` overlay gate in this program | breaks the written §13.7/#297 guarantee. Belongs to its own ticket, on all three planes, with option-seams/render-modes/reduced-motion tests (**Q-3**). |
| `<field-root placement="framed">` resolving its stage from `this.parentElement` | `createBrowserField` cannot take a host; the element is `aria-hidden` with no `<slot>` so authored children vanish from AT; host CSS is written in the constructor and never rewritten; the containing-block promotion would ride a lazy provider. |
| `Stroke.dash`, a fill primitive, a clip/translate primitive, a `setSurfaces` struct | each widens the backend contract or re-locks the surface set; #487 removed the last one deliberately. |
| A generic `contours` **token** | its data source is ambiguous (which channel?) — see **Q-4**. |

---

## 4. The model

### 4.1 Surface = layer × extent

| | **page** (today) | **framed** (#673) | **inline** (#672) |
|---|---|---|---|
| **underlay** | fixed `<field-root>` canvas, `z-index:0` | contained canvas in the stage | contained canvas in the box |
| **overlay** | fixed canvas, `z-index:5`, `mix-blend-mode:screen`, `data-field-overlay` | contained canvas in the stage, `data-field-placement="framed"` | contained canvas in the box, `data-field-placement="inline"` |

`framed` and `inline` are the **same mechanism** — a contained field (`containerHost(el)` + `bounds`)
with a contained overlay canvas — differing in declared scope, marker value, and documentation. That
is a real consequence, not a hidden one: **#673 closes with no new mechanism** (**Q-2**).

### 4.2 The ownership split

| Engine owns (all planes) | Host owns (per plane) |
|---|---|
| the reading vocabulary and its stack order | the canvas element and where it is appended |
| sampling and geometry (bodies, particles, edges, probes) | the containing block, stacking order, blend mode, z-index |
| emission through `RenderBackend` primitives only | idle gating (`display:none`), lifecycle, removal |
| the frame gate and reduced-motion cadence | the coordinate space, via `FieldHost.viewport()` |
| backing-store size (`overlayBackend.size(W,H,dpr)`) | CSS size (`canvas2dBackend.size` never sets it) |

### 4.3 The rules every new reading inherits

Lines and text only, never washes; accent-tinted via `curAccent` so `setAccent` recolours live;
per-stroke alpha ≤ 0.8; body-cadence resampling (`cache === null || flow || frameN % 3 === 0`) with
draw-from-cache every frame; draws only inside the existing frame gate; reads, never mutates —
pinned by a before/after particle+body snapshot test per reading.

---

## 5. Per ticket

### #721 — overlay-canvas ergonomics *(designed; in review as PR #1146 — not merged)*

Shipped in that PR: `createOverlaySurface(root?, opts?)` in `@fundamental-engine/dom` returning
`{ canvas, resize, destroy }`; options `blend` (default `'screen'`), `zIndex` (default `5`), `parent`,
`marker`, opt-in `autoSize` + `dprCap`; validated `normalizeOverlayBlend` / `normalizeOverlayZ`
(so an attribute value can never inject a second declaration); `overlaySurfaceCssText()` so the
`compositing-fill-trap` lint keeps recognising the surface; `<field-root overlay-blend overlay-z>`
applied live through explicit `attributeChangedCallback` cases with `setOverlayBlend()`/`setOverlayZ()`
reflection; React's two inline copies replaced (and the React canvas now carries `data-field-overlay`
— a stated behaviour change). Defaults are byte-identical to today's overlay.

What it deliberately does **not** do, and this program must therefore do (**Q-10**):

- it is **eager** and **viewport-only** — #672/#673 need a provider-shaped, container-scoped variant
  that keeps the #676 pins in `option-seams.test.ts`;
- it does **not** own `display:none` idling — so every non-`<field-root>` host (React, vanilla, raw
  `createField`) still leaves a mix-blend layer in the compositing tree after `setOverlay('off')`
  (**C-11**);
- `autoSize` is off when bound to `createField`, which is correct — but core's lazy sizing path still
  ignores `dprCap` (**C-25**).

### #672 — `inline` placement

A per-box field: `containerHost(box)` + `makeContainedCanvas(box)` underlay + a contained overlay
canvas from the #721 helper's placement variant, auto-wired by `FieldField`/`createField` when
`bounds` is set **and** the caller passed none of `overlayCanvas` / `overlayCanvasProvider` /
`overlayBackend`. Coordinates are container-local already (`field.ts` re-reads `originX/Y` per frame
and skips scroll compensation when contained), and core sizes the backing store from
`host.viewport()`, so the canvas belongs at the container origin — the CSS size is the host's job.

Non-negotiable additions this ticket must carry, all from review evidence:

- a **content-layering contract** (**C-1**) — a positioned canvas paints above the box's in-flow
  content, and `background:'opaque'` then blanks it;
- **`isolation: isolate`** (or an explicit z-index) on the container (**C-3**) — `position:relative`
  alone creates no stacking context, so a contained `mix-blend-mode` canvas re-blends against the
  *root*, which is exactly the whole-page re-blend #676/#405 exist to avoid;
- **visibility gating** for contained fields (**C-4**) — `containerHost` has no IntersectionObserver
  today, so N cards are N always-running rAF loops;
- the bare `data-field-overlay` marker is **never** stamped on a contained canvas (**C-8**).

### #673 — `framed` placement

Same mechanism, stage scope, `data-field-placement="framed"`. The semantic consequence must be
documented loudly: a framed stage is **a field within a stage**, not the page field seen through a
window — `containerHost` sets `FIELD_BOUNDARY_ATTR`, so the page field **releases those bodies**
(#980). Reviewers also found that ownership only re-evaluates when the page field *scans*, so a
contained field attached after boot leaves both engines writing `--d` until an unrelated rescan
(**C-6**), and that a contained canvas pinned with `inset:0` **scrolls away** inside an
internally-scrolling stage while bodies stay box-relative (**C-5**).

### #674 — scalar overlays

**`potential`** — equipotential iso-lines of `Φ(x,y) = Σ sign·s/√(d²+ε²)` (ε = 6), sampled on a
24 px lattice, contoured through `contourSegments`, emitted as `out.segments` per level, accent-tinted
at alpha ≈ 0.38. Contours, never the `drawPotential` fill wash — under `mix-blend-mode:screen` a wash
brightens and occludes copy.

Three review findings this reading must answer before it can be called true:

- `potentialAt` consults **no tokens** — every body reads as an attractive well, so a `repel`,
  `vortex` or token-less body is drawn as a sink, contradicting the sibling readings that all derive
  from `forceAt` (which skips bodies with no field-bearing token). That is a reading that *defines*
  rather than *reveals* (**Q-5**).
- Normalising levels against the sampled `grid.min` **aliases**: with ε = 6 on a 24 px lattice the
  sampled minimum swings ~3× as a body drifts between lattice points, so an EMA'd depth pumps; the
  analytic well depth `Σ sᵢ/ε` is available and does not (**C-19**). The sampler also stops one
  column short of the right/bottom edge, unlike the shipped contour pass (**C-20**).
- `sampleScalarGrid` allocates a fresh `Float32Array` per call and `contourSegments` returns per-segment
  objects; the shipped contour pass reuses a module-level grid and packs numbers directly (**C-21**).

**Generic `contours`** — the ticket's second ask (its 2026-09-11 comment names *both* `potential` and
"a generic `contours` reading on the overlay surface"). Every architecture demoted it to a
`registerOverlay` factory, and every ticket-fidelity reviewer flagged the demotion, because **a
registered name cannot be activated**: `setOverlay` is typed to the closed union and `<field-root>`
drops unknown tokens. Ship it only with a decided answer (**Q-4**); do not tick #674 off the epic
with half of it re-scoped.

### #675 — graph overlays

**`topology`** — one segment per edge, width by strength, alpha by memory, accent-tinted. In core it
can only see **programmatic** `addEdge` edges. The DOM-declared graph an author already has
(`href="#id"`, `label[for]`, `aria-controls`, `data-field-relation`) is discovered into
`RelationshipRegistry`; the `OverlayRegistry` every architecture proposed to read from **is never
populated in production** (**C-13**). A bridge is required, plus a coordinate fix: measurement rects
are **viewport**-space while contained bodies are container-local, and the `Env` handed to a custom
overlay carries no origin (**C-14**). Until the bridge exists, `<field-root overlay="topology">`
paints nothing on a real page — a wallpaper-rule "proofs must be produced" failure, and the
`overlay-without-links` lint does not catch it because the new token creates no `OverlayRegistry`
records (**C-15**).

**`prediction`** — forward ghost trajectories. As specified everywhere it routes through
`ghostTrajectory` → `forceVectorAt`, which is the **wrong sampler twice over**: physically (no range
cull, no shaped-body reference, no `field()` hop — it disagrees with the integrator *and* with the
sibling `path` reading drawn on the same surface) and economically (a `Particle` literal, an `Env`, an
accumulator and an attribution record per step × token × body, inside a `try/catch` — ~10⁵ allocating
calls per resample against `path`'s ~3×10³ allocation-free ones). It must be re-specified on the
engine's own `forceAt` sampler (**C-22**, **C-23**). Two further constraints: `ghostTrajectory`
applies **one** token list to every body where the integrator applies each body's own (**C-26**), and
per-step alpha fade is impossible in one `segments()` call — the design must choose per-step strokes
(`path` parity, high call count) or quantised alpha bands (**C-27**).

**`causality`** — per-body attribution arrows and ranked bars. Class-A forces only (`probes.ts`), so
it is a **partial** reading and must say so (**C-28**). It must draw for `b.vis && b.feedback` bodies
as the `data` reading does, not every visible body — the homepage alone carries 37 `data-body`
elements and canvas `fillText` is the most expensive primitive on either backend (**C-16**). Its
cited per-frame precedent is actually the on-demand `snapshot()` path (**C-30**). And it puts
**information** — which force dominates, ranked token names — into an `aria-hidden`, 10 px canvas
with no DOM twin, where `data` at least mirrors `--d`/`--field-density` (**Q-8**).

---

## 6. Carried defects

Nothing found in review is dropped. Findings that are refuted by, or die with, a rejected option are
in §3.4. Everything below survives into the chosen design.

### 6.1 Constraints — must hold in the implementation (no maintainer decision needed)

**Placement / compositing**

- **C-1** A contained canvas paints **above** the box's in-flow content (positioned box, z-index auto/0),
  and `background:'opaque'` fills near-black every frame — the naive `<section><field render="dots">…copy…</section>`
  is a black rectangle over the author's copy. The program owes a content-layering contract and a
  worked example; the site already does this by hand (`.docs-shell{position:relative;z-index:2}`).
- **C-2** `mix-blend-mode:screen` over a light card screens to white — the readings are calibrated for
  the near-black underlay. A contained surface's default blend must be decided with a visual pass
  (**Q-12**), not inherited.
- **C-3** `position:relative` creates no stacking context: `z-index:5` on a contained canvas escapes
  to the nearest real stacking context (the site's own shells sit at `z-index:2`) and the blend group
  becomes the root. Promote with `isolation:isolate`.
- **C-4** Contained fields have no viewport gating: `containerHost` observes `document.visibilitychange`
  only; the `<field-root>` IntersectionObserver is element-specific. N cards ⇒ N rAF loops, N
  ResizeObservers, a per-frame `getBoundingClientRect` each, and `setVisible(false)` gates **draw**
  only — the simulation, measurement and feedback writes continue.
- **C-5** `inset:0` inside an internally scrolling stage scrolls the canvas away from box-relative
  bodies (`containerHost` explicitly supports inner scroll).
- **C-6** `FIELD_BOUNDARY_ATTR` ownership is applied at **scan** time; a contained field attached from
  code after boot leaves the page field writing the same bodies until a rescan.
- **C-7** Inline placement mutates the author's element (inline `position:relative`, an appended
  canvas child that changes `:empty` / `:last-child` / child-count selectors). Document it; guard the
  content model.
- **C-8** Contained canvases must never carry the bare `data-field-overlay` marker (`HomeRuntime`'s
  `querySelector` and the `body > canvas` e2e locators assume one page overlay).
- **C-9** `lintCompositingPerf` returns early unless `position === 'fixed'` — contained surfaces are
  invisible to the #405 fill-trap lint. Extend it or the gating has no enforcement.
- **C-10** `createField`'s vanilla door returns the core handle unwrapped, and core `destroy()` never
  detaches a host-owned overlay canvas — the contained canvas leaks unless the wrapper owns teardown.
- **C-11** `display:none` idling lives only in `<field-root>`; core emits no signal when the stack
  empties, and #1146 deliberately leaves gating to the host. React and vanilla therefore keep a
  mix-blend layer after `setOverlay('off')`.
- **C-12** `mountField` has no `bounds` (only `FieldField` does) — inline auto-wiring claims must name
  the right door.

**Readings**

- **C-13** `OverlayRegistry` is empty in production; DOM links live in `RelationshipRegistry`. A
  `topology` reading needs a bridge, or it references no real links (system-contracts §21).
- **C-14** Measurement rects are viewport-space; contained bodies are container-local; the custom-overlay
  `Env` carries no origin. The bridge must carry the origin explicitly.
- **C-15** `overlay-without-links` inspects `OverlayRegistry` records only — it does not guard the new
  token.
- **C-16** `causality` must draw for `b.vis && b.feedback`, matching `data`; text is the costliest
  primitive on both backends (and the three backend's 256-entry label cache thrashes past ~85 labels).
- **C-17** One vocabulary source (`OVERLAY_MODE_LIST`) must be checked in **both** directions — `satisfies`
  proves only list ⊆ union — and must also feed `recipes/compile.ts`'s `OVERLAY_READINGS` and the
  `<field-root>` `KNOWN` filter.
- **C-18** `OVERLAY_MODES` is not a `check:docs` surface, yet the catalog and engine-tour pages generate
  one button per row: a new reading with no row silently loses its button, and a row whose reading
  paints nothing is a wallpaper-rule failure. Add the surface to the gate in the same PR.
- **C-19 · C-20 · C-21** `potential` normalisation aliasing (use the analytic depth), the lattice's
  short final column, and the allocation churn of `sampleScalarGrid`/`contourSegments`.
- **C-22 · C-23** `prediction`/`causality` must sample through the engine's `forceAt`, not
  `probes.ts`'s `forceVectorAt` — for physical agreement with the integrator and the `path` reading,
  and for cost.
- **C-26** `ghostTrajectory` applies one token list to all bodies; the integrator applies each body's own.
- **C-27** Per-step alpha fade needs per-step strokes or quantised bands — one `segments()` call
  carries one `Stroke`.
- **C-28** `causality` covers class-A forces only. Document the partial reading.
- **C-30** Its cited precedent (`snapshot()` with `includeInfluences`) is on-demand, not per-frame —
  the cost is new, not inherited.
- **C-32** `threeBackend` strokes every line at 1 px (no `linewidth`) and composites rects additively,
  so `topology`'s width-encodes-strength and `causality`'s plates do not survive the three plane
  unchanged.

**Engine / surface plumbing**

- **C-24** `ensureOverlaySurface()` calls the provider **before** the `ctx` check — a signals-only
  field with a provider creates a canvas it can never draw to.
- **C-25** The lazy sizing path uses the raw host DPR, ignoring `dprCap` and the quality tier's ceiling,
  until the next `resize()`; on a DPR-3 phone that is 2.25× the underlay's pixels on a full-viewport
  mix-blend layer.

**Accessibility, reduced motion, gates**

- **C-31** Reduced motion: the Pattern lane deliberately draws **no** readings and substitutes a static
  `<aside>`; the handle/element lane keeps drawing at quarter rate. Both cannot be canonical (**Q-9**),
  and `reduced-motion.spec.ts` has **zero** overlay coverage today while #1104 established exactly the
  per-surface pattern the new readings would have to satisfy.
- **C-33** Nothing in any plane handles `forced-colors` / `prefers-contrast`, which
  visual-language-and-geometry lists as a required bound for any field-driven colour layer. A non-screen
  blend (#721's light-page remedy) paints readings directly across body copy.
- **C-34** Unknown `overlay` tokens are dropped silently; `render:'none'` + `overlay` is a silent
  no-op on every host; there is no `console.warn`/`devWarn` anywhere in `packages/elements` or
  `packages/vanilla`, though `packages/dom/src/dev-warn.ts` exists.
- **C-35** `overlay-z`'s default of `5` encodes a site-specific "above content, below the nav"
  assumption; a raised value puts click-through readings over dialogs, menus and focus rings.
- **C-36** Naming drift to avoid: one knob, three spellings (`overlay-z` / `overlayZIndex` / `zIndex`).
- **C-37** The lanes in §7 are **not** file-disjoint — `docs-api.ts`, `packages/elements/src/index.ts`,
  `custom-elements.json`, `CHANGELOG.md` and the taxonomy Planned note are shared. Under the strict
  merge queue they serialise; each PR edits only its own lines of the Planned note.
- **C-38** The `field-root-surface.test.ts` fake-document shim has no `getComputedStyle`, no container
  `appendChild` and no `ownerDocument` — it cannot cover the static→relative promotion. Contained
  surfaces need their own test harness.
- **C-29** The RC-7 hardware perf gate cannot see any of this: the sweep measures `overlay ∈ {off, grid}`
  at page placement, budgets are keyed per measured row (an absent row reads "not measured", not
  "fail"), and no compute bench exercises a reading. Extending the sweep is a precondition, not a
  follow-up (**Q-11**).

### 6.2 Open questions — Zach decides

| # | Question | Why it blocks | Recommendation |
|---|---|---|---|
| **Q-1** | What is the **declarative door** to inline/framed? `<field-root bounds-selector>` (named in #540's build plan, never built), a new `<field-inline>` element, or imperative-only? | `<field-root>` is a fixed viewport singleton; without a door, #672/#673 — the #784 adoption unlock — ship as JS only, and the primary a11y-hardened host gets none of the program | build `bounds-selector` on `<field-root>` (honours #540, one door, `check:cem`-visible) rather than a second element |
| **Q-2** | Is **`framed` a separate contained field that claims its bodies** (#980), or a window onto the page field? | decides whether #673 is documentation over #672's mechanism or needs the rejected `framedBackend` seam | contained field; keep the wrapping-backend as a recorded escape hatch |
| **Q-3** | Do we ever **relax the `render:'none'` overlay gate** (readings without matter)? | §13.7/#297 states the opposite as a guarantee; without a relaxation `#784`'s "readings over a data table" is undeliverable, and every inline card pays a full matter engine | separate ticket, all three planes, after this program |
| **Q-4** | **Generic `contours`** (#674's second ask): a token, an exported factory, or a factory **plus** a way to activate registered names declaratively? | a `registerOverlay` name can be registered but never enabled — `setOverlay` is typed to the closed union and `<field-root>` filters unknown tokens | factory **plus** a `custom:<name>` passthrough on the attribute and an `OverlayInput` widening; otherwise #674 cannot honestly close |
| **Q-5** | **`potential` semantics**: token-aware (skip bodies with no field-bearing token, sign by polarity) or fixed gravity wells with a documented caveat? Is `kind` an option? | a token-blind reading draws a `repel` body as a sink — it defines rather than reveals | token-aware, matching `forceAt`/`fieldline-seeds`; defer `kind` |
| **Q-6** | **`causality` on the ports**: leave the honest js-only gap (matrix becomes 12/11/11), or hold the reading until the ports have a per-force accumulator? | neither port keeps attribution; a `break` arm would be a hollow green | ship JS-only with the gap and a parity note — but see **Q-7** on where the note can live |
| **Q-7** | **Vocabulary**: canon already uses *Placement* for underlay-vs-overlay ("behind content" / "in front of content"), and the Surfaces table's second column is literally that. Do page/framed/inline take the word (canon's Planned note already says "`inline` placement") and the old column get renamed, or does the new axis get a new word (*extent* / *scope*)? | the program cannot add a second column called Placement to a table that has one | take the word, rename the existing column to *Compositing* in the same PR |
| **Q-8** | **Semantic twin for text-bearing readings** (`causality`, and `data` today): a feedback variable, a `data-field-visual-for` binding, a snapshot channel — or label them diagnostic-only and gate them out of the production preset? | canon says a visual layer represents and is never the source of meaning; testing-and-conformance already says debug overlays are disabled in the production preset | diagnostic-only + a snapshot channel; no new canvas-only meaning |
| **Q-9** | **Reduced-motion policy for readings**: which lane is canonical — the Pattern lane's "no readings, static aside" or the handle lane's quarter-rate redraw? Is `prediction` (a picture of motion that will not happen) permitted under `reduce` at all? | the two lanes contradict each other today and the new readings widen the gap | Pattern lane wins: readings off under `reduce` unless a static equivalent is declared; `prediction` suppressed |
| **Q-10** | Does **#1146's helper grow** the placement variant (provider shape, `container`, `setActive` gating), or does the program add a sibling factory and leave the viewport helper as shipped? | #1146 is eager, viewport-only and gating-free by design; #672/#673 need the opposite | grow it — one helper, `placement` + `container` + a provider-shaped `provide()`, gating opt-in |
| **Q-11** | Is **extending the RC-7 perf sweep** (readings × placements) a precondition for the readings lane, or a parallel lane? | today an unmeasured reading reads "not measured", so the budget gate cannot fail on it | precondition for #675; #674 may land with a one-off measurement |
| **Q-12** | **Default blend for contained surfaces**: keep `screen` (invisible on a light card) or default contained placements to something else with a re-calibrated alpha ramp? | the flagship inline use case is a light content card | decide with a visual pass before #672 lands; do not ship an invisible default |

---

## 7. Build sequence

Every PR opens **against `main`** (a non-main base gets no required checks), lands green, and is
handed over for merge — no auto-merge, no tags. The strict merge queue re-runs full CI per PR, so the
lanes below serialise where they share files (**C-37**).

**Lane 0 — in review**

| PR | Content | Gates |
|---|---|---|
| **#1146** (open) | #721 as designed: helper, validated `overlay-blend`/`overlay-z`, React adoption | already run on the head commit: `check:api`, `check:cem`, `DOCS_GATE_ENFORCE=1 check:docs`, `check:readme`, `check:recipes`, `check:atoms`, `gen:parity-matrix` (no diff), `check:links`, unit suites |

**Lane S — surfaces** (serialised; each depends on the previous)

| PR | Content | Gates that must be green |
|---|---|---|
| **S0** `fix(core)` | the lazy overlay surface honours `dprCap` + tier DPR (**C-25**); the provider is not called when there is no `ctx` (**C-24**) | `check:api`, core unit + `option-seams` (#676 pins), CHANGELOG |
| **S1** `feat(dom)` | placement variant of `createOverlaySurface` (**Q-10**): `placement`/`container`, provider-shaped `provide()`, `setActive(input)` gating, `isolation:isolate` promotion (**C-3**), markers (**C-8**), `hostForPlacement()`; extend `lintCompositingPerf` to contained surfaces (**C-9**); a real container test harness (**C-38**) | `check:api`, dom unit, `check:links`, CHANGELOG |
| **S2** `feat(dom)` | `containerHost` visibility gating — IntersectionObserver → `setVisible` (**C-4**) | dom unit, e2e unchanged, CHANGELOG |
| **S3** `feat(vanilla,dom)` — **#672** | inline auto-wiring on `FieldField`/`createField` when `bounds` is set; teardown ownership (**C-10**); scroll behaviour (**C-5**); ownership rescan (**C-6**); the content-layering contract + a worked light-card example (**C-1**, **C-2**, **C-7**); taxonomy Planned-note edit | `check:api`, `DOCS_GATE_ENFORCE=1 check:docs`, `check:links`, `check:atoms` (no diff), vanilla/dom unit, `home.spec.ts`, CHANGELOG |
| **S4** `feat(elements)` — **Q-1** | the declarative door (`bounds-selector` or `<field-inline>`) | `check:cem` (regen committed), `DOCS_GATE_ENFORCE=1 check:docs` (FIELD_ROOT_ATTRS row), `option-attrs` both directions, elements unit, e2e, CHANGELOG |
| **S5** `docs` — **#673** | `framed` as declared scope over S3's mechanism: marker value, ownership semantics (**Q-2**), taxonomy rows, one site stage example | `check:docs`, `check:links`, e2e |

**Lane R — readings** (serialised; `types.ts`, the `renderOverlay` block, the vocabulary lists and
`data/parity-matrix.json` are shared by every PR in the lane)

| PR | Content | Gates that must be green |
|---|---|---|
| **R0** `refactor(core)+ci` | one vocabulary source: `OVERLAY_MODE_LIST` + a both-directions exhaustiveness test (**C-17**), `recipes/compile.ts` and the `<field-root>` `KNOWN` filter derived from it, and `OVERLAY_MODES` added as a `check:docs` surface (**C-18**) | `check:api`, `DOCS_GATE_ENFORCE=1 check:docs`, `check:cem`, `check:recipes` (no diff), core/elements unit, CHANGELOG |
| **R1** `feat(core,kotlin,swift)` — **#674a** | `potential` on three planes: token semantics (**Q-5**), analytic normalisation (**C-19**), full lattice (**C-20**), packed emission (**C-21**); Kotlin enum + pure `potentialContours` + lab arm, Swift bare `case` + `Potential` + the exhaustive-switch arm + lab/bench lists; `gen:parity-matrix` → 10/10/10 | `check:api`, `check:docs` (+ new OVERLAY_MODES row), `check:cem`, parity regen committed, `check:golden` (no diff — force math untouched), `check:atoms` (no diff), core unit + mutation-guard test, Swift build + tests, Kotlin tests, CHANGELOG on each plane |
| **R2** — **#674b** | generic `contours` per **Q-4** | as R1, plus whatever door Q-4 chooses (`check:cem` if the attribute grows) |
| **R3** `feat(core,dom)` — **#675a** | `topology` + the `RelationshipRegistry` → segments bridge with explicit origin (**C-13**, **C-14**), lint coverage (**C-15**), ports where the data is real | as R1 + dom unit with a scrolled-measurement test |
| **R4** — **#675b** | `prediction` re-specified on `forceAt` (**C-22**, **C-26**, **C-27**), reduced-motion policy applied (**Q-9**), perf sweep extended (**Q-11**) | as R1 + the RC-7 sweep rows + a reduced-motion e2e per **C-31** |
| **R5** — **#675c** | `causality`, JS-only (**Q-6**), `b.feedback`-scoped (**C-16**), partial-reading documented (**C-28**), semantic twin per **Q-8** | as R1, parity matrix committed **with** the honest gap + the note (**Q-7** decides where it lives) |

**Cross-cutting, once:** the canon edits (taxonomy Planned note per PR, the Placement-column rename
from **Q-7**, `observable-surface.md`'s mis-statement that contours/potential are overlay modes), the
`forced-colors`/`prefers-contrast` posture (**C-33**), and a dev-warn for the silent no-ops (**C-34**).

---

## 8. Three-plane parity — what lands JS-first and what the ports owe

**JS-first, by construction.** Placement is DOM compositing: `inline`/`framed` are a containing block,
a stacking context, a blend mode and a z-index. They have **no port symbols** and add **no parity
dimension** — every Swift and Kotlin field is already scoped to its mount view, which is the ports'
native idiom for both placements.

**What the ports owe on readings.** The matrix parses the JS union, Swift's `enum OverlayMode` `case`
lines and Kotlin's `NAME("id")` entries, so a reading added on JS alone turns `overlay-modes` from
9/9/9 into a gap. Per reading:

| Reading | Kotlin (first, per cadence) | Swift (mirrors) | Honest status |
|---|---|---|---|
| `potential` | enum entry **+ the un-scanned duplicate enum in `fundamental-platform/Registries.kt`** (kept by hand, or its own TODO resolved by importing core), pure `netPotential` + `potentialContours`, lab arm, tests | bare `case potential` (a raw value would break the parity parser), pure `netPotential`, a `drawOverlay` arm (**the switch is exhaustive — a missing arm is a compile error**), lab/bench lists | buildable on both |
| `topology` | pure segments from the platform relationship registry + body centres | same, plus a `RenderFrame` field for edges | buildable; needs the data plumbed |
| `prediction` | pure forward trace over `forceAt` + integrator friction | same | buildable on both |
| `causality` | — | — | **data-blocked**: neither plane keeps per-force attribution ("no impulse accumulator"). Leave the gap (**Q-6**) |

**Three honesty statements this program must publish rather than bury:**

1. **Vocabulary parity is not draw parity.** Kotlin's app hosts (Compose `FieldView`,
   `FieldFieldView`) draw **no readings at all** — only the JVM lab does, through its own separate
   enum. Today's green 9/9/9 is already vocabulary-only on Kotlin. Adding tokens does not change that.
2. **The ports have no front surface.** Swift draws readings in the *same* `CALayer` stack as matter,
   and SwiftUI's `ZStack` puts the whole field **behind** `content()`. "Overlay" on JS means
   composited *above* content; on the ports it does not. Closing that is its own epic — and when it is
   built, the readings layer **must** be `allowsHitTesting(false)` + `.accessibilityHidden(true)`, or
   it swallows every tap on the content beneath it (today's `UIView` defaults to hit-testable).
   Reviewers also found the port-side plans in the source material were written against objects that
   do not exist — Compose's `FieldView` holds a `FieldController`, not a `FieldHandle`, and has no
   overlay parameter to read.
3. **The `three` plane cannot show a reading cheaply.** `FieldLayer` hard-codes `render:'none'`, and
   the frame gate requires a drawing render mode, so any reading there means acquiring a 2D context on
   a detached stub canvas and running a full underlay pass every frame purely to pass the gate. Note
   it in the parity notes; do not claim three parity for readings.

**Where parity notes can live:** `parity.astro` renders only the `field-handle-methods` dimension, so
a note attached to the `overlay-modes` row has nowhere to appear today. Either the page grows the
dimension or the note goes into `docs/canonical/parity-matrix.md` — settle it in **Q-7**'s PR.

**What parity does *not* touch:** the conformance golden pins **force math** (frame-0 `dv` per force).
No reading enters it; `check:golden` must show **no diff** through this entire program.

---

## 9. Provenance

This document is a synthesis, not a fresh analysis. Its inputs were three constraint-extraction passes
(code state · canon and tickets · gates), three competing architectures (MINIMAL-SURFACE · host-idiom ·
PLACEMENT MODEL), and fourteen adversarial reviews — each architecture read for ticket-and-canon
fidelity, engine integrity and performance, and consumer ergonomics and accessibility — totalling 11
blocking and 78 major findings with file-and-line evidence. The architecture in §3 was selected by
counting the blocking and major defects each option's *distinguishing* mechanisms accumulated, not by
preference. §2.4 records where that cached work had gone stale against `main`; every claim repeated
here was re-verified at `fb065cc5` before being written down.
