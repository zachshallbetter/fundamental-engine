# FieldKit #439 — obstacle-aware navigation + goal flow-fields

**Status:** DESIGN PASS ONLY. No engine code is proposed for merge by this document, and nothing
under `packages/` changes with it. Two competing designs are recorded, adversarially reviewed, and
costed; the blocking defects at the end need a maintainer decision before any implementation PR.
**Scope:** issue #439 (FieldKit gap #2) — impassable geometry and a goal flow-field that routes
*around* obstacles. Its sibling, #443 (height as a field input), is designed in
[fieldkit-443-height-fields.md](fieldkit-443-height-fields.md); the two share one seam (an optional
`Env` accessor onto `addField` channels) and are otherwise independent.
**Author/owner:** Zach Shallbetter.
**Verified against:** `main` @ `fb065cc5` on 2026-09-12. The cached design work ran at
`ea615fdf` / `084fdebc` / `2bc1af02`; §8 lists every cached claim that has since gone stale.

---

## 1. Does the ticket still apply?

**Yes — unchanged, and nothing navigational has shipped.** `gh issue view 439`: OPEN, created
2026-06-13, last touched 2026-06-20, labels `enhancement` + `track-b-engine`, milestone 1.0, zero
comments. Both of the ticket's premises hold on `main` today:

1. *"`wall`/`gate` exist as forces but don't truly block."* Confirmed. `wall`
   (`packages/core/src/forces/index.ts:168`) is `kinematic: true` — an elastic bounce inside the
   element box plus a 6 px pad (`:173`) that reflects one velocity component. `gate`
   (`packages/core/src/forces/extended.ts:44`) reflects wrong-way crossers inside its own box.
   Neither defines a `field()` hook, and `env.fieldAt` is rebuilt each step as
   `netField(bodies, forces, x, y)` (`packages/core/src/engine/integrator.ts:260`) — so `sample()`,
   the streamline overlays and `fieldflow` all see straight *through* a wall.
2. *"No flow-field-to-goal."* Confirmed. A grep for `navmesh|navgrid|flowfield|impassable|dijkstra`
   over `packages/core/src`, `packages/three/src`, `swift/Sources` and
   `android/fundamental-core/src` returns **nothing**. The only occupancy structure in the engine is
   the `memory` force's own decaying grid (`packages/core/src/forces/natural.ts:346`,
   `packages/core/src/contracts/passport.ts:168`). `flowTo` is a linear-falloff point pull, not
   navigation.

The consumer premise also still holds: Habitat's `docs/FieldKit.md` still lists gap #2 as open
("we keep `moveLand` + barrier-avoidance + stuck-repick until this lands"), and
`Habitat/app/critters.js` still carries `moveLand` (:333) and `barrierPush` (:359).

### What shipped since it was filed, and how it narrows the ticket

| Shipped | Effect on #439 |
| --- | --- |
| `addAgent` (#438) — `field.ts:3386`, `AgentSpec` `types.ts:1023-1025` | Gives the acceptance subject: an engine-stepped, `maxSpeed`-clamped particle with a per-step `report(p)`. No controller class is needed. |
| `addField(name, sampler)` / `sampleField` (0.5.1) — `field.ts:342`, `:3696` | Gives the host a pull-based **occupancy input** on JS, Swift and Kotlin. The ticket's "its own `NavGrid` module the field can read" collapses to a *derived structure over a host channel*. |
| `sampleScalar` (#440) / `sampleGradient` (#423) | Smooth scalar reads exist — but over the *net field*, not over host geometry. |
| `data-affects` / `data-species` (#444) | Lets a goal route one species only — but **numerically**: `AgentSpec.species?: number` (`types.ts:1025`), and `data-affects` is parsed as a comma list filtered by `Number.isFinite` (`scanner.ts:104-108`). |
| Reactive body params (#442); resting-motion floor (#1110, merged 2026-09-11) | #1110 is the freshest precedent for a *declared, default-OFF* primitive landed on all three planes in **one** commit (`feat(core,swift,kotlin)`), which is a live alternative to the Kotlin-first-then-Swift sequencing both designs below assume. |

**What the ticket still asks for and does not exist:** (a) a goal flow-field — a structure whose
directions route around obstacles; (b) impassable geometry that blocks matter rather than bouncing
it inside a box; (c) "deflects the sampled field" — and (c) is the part canon forbids literally (see
§6.6).

---

## 2. The two competing designs

Both are opt-in and default-off. They differ in *where the routing structure lives* and *what pays
for it*.

### Design A — minimal-additive: a derived `FlowField`, transported by the existing `fieldflow`

- **Occupancy** is host truth through the shipped channel: `field.addField('nav:blocked', (x,y) => 0|1)`.
  Nothing new; pull-based, read only at rasterisation time.
- **Structure** is a new pure engine object, `packages/core/src/engine/flow-field.ts`:
  `field.flowField(name, { occupancy?, goal?, cell = 32, diagonal = true })` allocates `Uint8Array`
  blocked / `Int32Array` dist / `Float32Array` dirX,dirY / `Int32Array` queue **once**, sized like
  `ScalarGridImpl` (`scalar-grid.ts:33`). `rebuild()` rasterises the occupancy sampler once per cell,
  runs a FIFO BFS from the goal cell (8-connected, corner-cutting forbidden), and writes a unit
  direction per free cell. Blocked cells get an *escape* direction toward the nearest free neighbour;
  unreachable cells get none. Sampling is **nearest-cell, not bilinear** (bilinear across a fence
  edge averages opposite directions to zero and stalls the agent). Rebuild triggers: goal moves to a
  different cell, explicit `rebuild()`, viewport resize. No rng; deterministic by construction.
- **Transport** is the existing `fieldflow` force, selected per body by a new opt-in attribute
  `data-flow-field="<name>"`. In `extended.ts` the single line that reads the net field becomes a
  ternary on `b.flowField !== undefined`; steer (`FIELDFLOW_STEER` 0.5, `:556`), stream
  (`FIELDFLOW_ACCEL` 0.12, `:557`), the c-cap, range falloff, charge gate and heat are untouched.
- **No new force token.** The explicit argument: a `navigate` token would pay the full toll
  (passport row, `MANUAL_FORCES`, a conformance experiment that today cannot inject a flow field into
  the bare probe env, the 36→37 flip across ~10 doc sites, three port implementations) for an
  `apply()` that is a byte-copy of `fieldflow` with one line changed.
- **Hard blocking and the field reveal are deferred** to later increments: blocking becomes an opt-in
  kinematic constraint reading the *same* rasterised `Uint8`, and the reveal is a projection
  (`sampleFlow` + an overlay), never a mutation of `netField`.

### Design B — substrate-aligned: a declared nav potential Φ, transported by a new `navflow` token

- **Occupancy** is the same `addField` channel, plus a convenience: bodies may opt in with
  `data-solid`, so their measured box (+ pad 6, matching `wall`) rasterises into the same occupancy.
  `wall`/`gate` keep their exact `apply()` and passports.
- **Structure** is a *declared potential*: Φ_g = geodesic distance-to-goal, solved by Dijkstra over a
  new **held** `ScalarGrid` mode (`GridMode` gains `'held'`; `step()` gains one early-return arm).
  Cells at or above the occupancy threshold are **inadmissible: Φ = +∞**. Transport direction is
  −∇Φ, read through the existing `gradient()`. The solve re-runs only on an input version bump
  (occupancy re-raster on the 6-frame measure cadence, goal cell change, resize); buffers are
  preallocated; index-ordered tie-breaking, no rng.
- **Force** is a new passported token `navflow` (family extended, klass C, `truthMode: 'designed'` —
  a navigation algorithm has no physical analogue). The body carrying `navflow` *is* the goal, so
  `<div data-body="navflow">` reads "route to me around solids". `apply()` no-ops when `e.nav` is
  undefined, then runs the `fieldflow` math verbatim on the unit −∇Φ.
- **Projection** is explicit and read-only: `field.navField(goal)` exposing `potentialAt`, `flowAt`,
  `admissible(x,y)`, `version` for contour/flow overlays. `sample()` and `netField` stay
  byte-identical.
- **New surface beyond the token:** `FieldOptions.nav?: { cell?, occupancy?, threshold?, pad? }`,
  `Body.solid?`, `Env.nav?: NavService`, `FieldHandle.navField()`, `GridMode 'held'`,
  `grid(name, opts?)`.

---

## 3. Which design the reviews favour, and why

**Design A, with two borrowings from B.** Three adversarial reviews ran: two against A
(regression/engine-integrity and a ticket-fidelity pass) and one against B.

The reasoning in the reviews' own "keep" lists:

- **The no-new-token decision is the strongest single point in A's favour, and it was verified, not
  asserted.** `passport.ts` carries exactly one `fieldflow` row; `catalog-counts-doc.test.ts` derives
  the force count from `MANUAL_FORCES` (36 tokens today); ~10 doc sites carry the count. A `navigate`
  or `navflow` `apply()` would duplicate the `fieldflow` body with one line changed and buy a
  36→37 flip on every plane.
- **A's default-path shape is the shipped zero-regression idiom.** A branch guarded by
  `b.flowField !== undefined` mirrors `Body.chargeGated` (`types.ts:320-325`, `scanner.ts:101`), and
  an `Env.flowAt?` that is never assigned when no flow field is registered mirrors `Env.fieldAt?`
  (`types.ts:504`) and `Env.accum?` (`:514`).
- **B pays substantially more for the same acceptance criterion**, and its two blocking defects are
  *correctness* problems (a NaN-producing gradient; a range cull that silently disables the
  acceptance scene), where A's single blocking defect is a *plumbing gap* with a one-line fix.
- **Both designs correctly refuse to implement "deflects the sampled field" as a field mutation.**
  That refusal is canon (`dimensional-coupling.md` "fields do not usually affect fields"; the
  `netField` purity contract), and all three reviews keep it.

**Borrow from B into A before implementation:**

1. **`data-solid`** — rasterising a body's measured box into occupancy is strictly more ergonomic
   than making every host write a sampler that knows where its own walls are, and it does not touch
   `wall`/`gate`.
2. **Truth-mode honesty.** B's `truthMode: 'designed'` is the accurate label for a BFS structure. A
   reuses `fieldflow`, whose passport says `hybrid` / `usesFieldAt: true` — which is no longer true in
   flow-field mode. Review defect A-M5 (§4) is precisely this, and it is the one place where A's
   economy costs honesty.

---

## 4. Blocking and major defects

Verdict column: does the favoured design (A, as amended in §3) answer it?

### 4.1 Blocking

**A-B1 — the stated opt-in path for non-DOM hosts does not exist.** *Raised against A; raised again
as a major by the second reviewer.* The design's usage snippet opts a body in with
`addBody({ data: { 'flow-field': 'nav' } })`. **That call does not set the attribute the design reads,
and never has.** `addBody` builds the synthetic element's attribute map from exactly six keys —
tokens, `data-strength`, `data-range`, `data-spin`, `data-angle`, `data-color`
(`packages/core/src/engine/field.ts:3404-3408`) — and then stores `spec.data` as an opaque carried
record (`:3431`, `BodySpec.data?: unknown` at `types.ts:1063`). `bodyFromElement` only ever sees
attributes (`scanner.ts`), so `flowField` is unreachable through `addBody`. Every three / native /
game / sim host — the ticket's stated audience — enters the field through `addBody`, so as written
**the feature would be DOM-only and the acceptance scene could not be built at all.**
*Verified still true at `fb065cc5`.*
**Answered?** Only by amending the design: `BodySpec.flowField?: string` must be added to the public
surface (plus the three `FieldBodySpec` pass-through, which already stamps flags as `data-*`), and it
must appear in `api-surface.data.mjs` and `contract-coverage`. This is a small fix — but it is a
**hole in the published design**, not an implementation detail, and it is the single item most worth
a maintainer's eye.

**B-B1 — `data-range` absent is not `0`, so the acceptance scene is range-culled.** The design's
public surface says "`data-range` → 0/absent = global". Absent is **280** on JS
(`scanner.ts:91`), and the integrator culls matter beyond `range × 1.6` before any `apply()`
(`integrator.ts:453`). With the design's own acceptance geometry (agent at x=100, goal at x=900) the
goal body never touches the agent. Worse cross-plane: the absent default is **100** on Swift
(`swift/Sources/FundamentalCore/Engine/Types.swift:171`) and **100f** on Kotlin
(`android/.../engine/Types.kt:117`), so a shared fixture that omits `range` is not even comparable
between planes. **Answered?** N/A for A (A reuses `fieldflow`'s existing range semantics), but the
lesson transfers: **every shared fixture and the acceptance scene must pin `data-range="0"`
explicitly**, and the per-plane divergence should be recorded.

**B-B2 — storing Φ = +∞ for inadmissible cells produces NaN directions exactly where routing
matters.** `ScalarGrid.sample()` is bilinear (`scalar-grid.ts`, `top = at(ix,iy)*(1-fx) + at(ix+1,iy)*fx`)
and `gradient()` is a central difference over two samples. `Infinity * 0` is `NaN`; a non-zero weight
gives `Infinity`; normalising `Infinity/Infinity` gives `NaN`. So every admissible cell *adjacent to a
fence* — the cells the whole feature exists for — yields a NaN or infinite direction, and a NaN
velocity slips the `> c²` test (the integrator says so in its own comment). The backstop is
`packages/core/src/conformance/safety.test.ts`, which is a sweep, not a design. **Answered?** A does
not have this failure mode at all: it stores integer BFS distances and normalised `Float32`
directions and samples nearest-cell, never bilinear. If B is ever revived, Φ must be stored with a
finite sentinel and the gradient masked to admissible taps.

### 4.2 Major

| # | Defect | Against | Answered by A (amended)? |
| --- | --- | --- | --- |
| A-M1 | `species: 'rabbit'` / `data-affects="rabbit"` in the acceptance scene are a silent type error: species are **numbers** (`types.ts:1025`; `scanner.ts:104-108` drops non-finite values), so the goal acts on *all* matter and the "only the species moves" assertion cannot pass. | A | Yes — mechanical: the scene must use numeric species. Flagged so it is not copied into a fixture. |
| A-M2 | The `data-charge-gated` "opt-in attribute precedent" A leans on is **JS-only**. `grep chargeGated swift/Sources android/fundamental-core/src/main` → **0 hits** (re-verified at `fb065cc5`). So the ports plan assumes plumbing that does not exist, and the precedent is itself an unrecorded parity gap. | A | Partly. The port work must *build* the body-attribute path, not mirror it. Recommend recording `data-charge-gated` as unported in the same pass. |
| A-M3 | The pinned acceptance numbers do not hold at the design's own defaults. At `data-strength` 0.5 (`scanner.ts:62`) steer k = min(1, 0.25) per frame and streaming is 0.06 px/frame²; with `FRICTION` 0.95 the terminal speed is ≈1.14 px/frame, so an 800 px detour needs **>700** steps, not the design's "≤ 600". A 90° turn takes ≳4 frames ≈ 30 px, i.e. roughly a full 32 px cell mid-turn. | A | Not as written. The scene must pin `data-strength` (≥ 2–4), and the invariant must become "never *ends* blocked / is ejected within N steps" rather than "never blocked". |
| A-M4 | **Ticket fidelity:** with hard blocking deferred, any *other* force on the scene (attract, thermal, hunt) can push an agent into a blocked cell where only the weak escape vector opposes it — which is the multi-behaviour "rabbit stuck on the wrong side of the fence" failure the ticket cites. The escape direction is also null for interior cells of thick obstacles, and the ticket's "water" is an area, not a one-cell fence. Premise (1), impassable geometry, is unaddressed at the increment that claims to close the gap. | A | **No — this is the real scoping decision.** Either fold the rasterised-`Uint8` kinematic clamp into the first PR (still no field mutation), or split #439 explicitly into "routing" and "blocking" and say so on the ticket. |
| A-M5 | **Truth-mode honesty is prose-only.** `fieldflow`'s passport says `hybrid` / `usesFieldAt: true`; in flow-field mode it reads a designed BFS structure derived from host data, and A's `FlowFieldHandle` carries no truth mode. The planned wallpaper lint and carrier metadata would either flag it or lie. | A | Partly — by the §3 borrowing: give `FlowFieldHandle` a `readonly mode: 'designed'` from day one and make the passport note machine-readable, not a docs row. |
| A-M6 | The committed-literal seeded fingerprint proposed as the default-path proof is a brittleness this repo has deliberately avoided: `determinism.test.ts` compares **two in-process runs**, never a pinned string, and a `toFixed(6)` hash over 40 ticks of transcendental math is exactly what drifts across Node majors (the known Node-25 golden ULP drift; CI is Node 22). | A | Yes — replace with same-process A/B (registry present-but-dormant vs control) plus the structural probe and a `git diff --exit-code` on the golden fixture. See §6. |
| B-M1 | The engine's occupancy grid and a host `grid('occupancy')` share **one name-keyed map with no mode check** (`field.ts:950-952`, mode inferred from the name prefix), so creation order silently decides whether occupancy diffuses — which destroys admissibility. The same shape exists in Kotlin. | B | N/A for A (no grid involved). If B revives: reserve the name or throw on a mode mismatch. |
| B-M2 | The acceptance predicate "the agent's cell is never blocked" is ill-defined against the node-sampled lattice plus `wall`'s pad-6 push-out: a legally routed agent sits 6 px outside the box, up to ~16 px from a node the raster marks inadmissible, so the assertion passes or fails on a rounding convention. | B | Transfers to A: make the acceptance assertion **geometric** ("never inside any solid box"), not raster-based, and keep cell ≤ 16 px or gap ≥ 3 cells in the fixture. |
| B-M3 | "`solid` on all three scanners/specs" undercounts the body-spec entry points. There are **five**: the DOM scanner, core `BodySpec` + `addBody`'s attrs map, three's `FieldBodySpec` + registry, Kotlin's *two* spec classes plus its `Body` constructor call, Swift's *two* inits. `chargeGated` is missing from the ports precisely because nobody enumerated these. | B | Transfers to A verbatim — this is the same list `BodySpec.flowField` (A-B1) must walk. |
| B-M4 | The same committed-fingerprint brittleness as A-M6. | B | Same answer. |

### 4.3 Minors worth carrying into the PR

- `Env.flowAt` **cannot** be assigned "in the integrator prelude": `StepInput` has no access to the
  handle's registries; env services are built in `field.ts`. Assign it there (at scan/measure
  reconciliation) and keep the integrator read-only. Assert `env.flowAt === undefined`, not key
  absence — writing `env.flowAt = undefined` makes the key present.
- A viewport resize **zeroes** every grid (it preserves nothing) while body re-measure is on the
  6-frame cadence — so a naive design leaves several frames in which every cell is admissible and
  agents route straight through fences. Re-raster synchronously in the resize path, or mark the
  service stale so `flowAt` returns nothing until the next raster.
- Goal resolution is **ambiguous** when two bodies carry the same flow-field name, and body ordering
  is a *declared uncontrolled input*. Specify a rule (reject duplicates with a dev warning, or
  require an explicit goal). An off-viewport goal body is skipped entirely (`integrator.ts:421`
  `if (!b.vis …) continue`).
- Don't resolve a string through a `Map` per particle per frame; bind the flow-field reference onto
  the body at scan/refresh (the `warp` force's `data-pair` resolution is the precedent), and add
  `flowField` to the scanner's live-refresh path or a live attribute change won't be re-read.
- 8-connected **unit-cost** BFS yields Chebyshev distances (diagonal = orthogonal), heavy ties and
  axis-biased zig-zags; integer-weighted Dijkstra keeps the `Int32` arrays and the determinism while
  routing near-Euclidean. Also "normalised integer offsets — exact across f32/f64" is false for
  1/√2; the fixture tolerance should say ≤ 1e-6, not "exact".
- A's claim that its `flowAt` "*is* the `06-carrier-seam` `grid:<name>` shape" **overstates**: the
  carrier signature takes `t` and writes into a required `out`, returning `void`. It is
  carrier-*compatible* through a thin adapter, and it is a new carrier kind — say that, don't claim
  identity.

---

## 5. Regression posture

This is the section Zach asked for in detail. The claim under test: **with no flow field registered
and no opt-in attribute present, every plane is byte-identical to `main`.**

### 5.1 What the default frame does — unchanged

- The only hot-path line A touches is inside `fieldflow`, behind `b.flowField !== undefined`, a
  property that is `undefined` for every body that exists today.
- `Env.flowAt` is **never assigned** when the flow-field registry is empty — the `Env.fieldAt?` /
  `Env.accum?` / `Env.dz?` precedent (`types.ts:462`, `:504`, `:514`), and the same shape as the
  existing null-skip for `screen` modifiers.
- No `FieldOptions` key, so `contract-coverage.test.ts`'s `interfaceKeys('FieldOptions')` scan
  (`:139-147`) is untouched. (Design B *does* add one, `FieldOptions.nav`, and would owe that test a
  reference — the `restingMotion` key from #1110 is the worked example of doing this correctly.)
- No `ScalarGrid` / `GridMode` change under A. Under B, `GridMode` gains `'held'` — which is
  incidentally a *free parity forcer*, because the Kotlin `when` and Swift `switch` over the mode
  enum are exhaustive and a port that forgets the case fails to compile.
- No new token under A, so `classified()`, `MANUAL_FORCES` (36 tokens), the passport table and every
  "36 forces" doc line stay exactly as they are. B flips 36→37 and owes ~10 doc sites plus
  `gen:force-catalog` and `gen:parity-matrix` regeneration in the same PR
  (`catalog-counts-doc.test.ts` derives the count from `MANUAL_FORCES`).

### 5.2 What the 120-case cross-plane conformance golden sees — nothing

`swift/Tests/FundamentalCoreTests/Fixtures/conformance-golden.json` is `count: 120` over exactly six
pinned forces: `attract`, `repel`, `swirl`, `stream`, `tether`, `viscosity`
(`scripts/gen-conformance-golden.mjs:27`). Neither `fieldflow` nor any new navigation token is among
them, and the harness reads only dist/vector plus scalar body params. **The correct proof is a zero
diff:** `pnpm check:golden` is `gen:golden && git diff --exit-code` on that fixture.

Two cautions: (1) never regenerate the golden on Node 25 — it drifts three last-bit floats against
the committed file for environment reasons, and CI is Node 22; (2) a new solver fixture belongs
**outside** the cross-plane golden, as its own JSON read by all three planes.

### 5.3 The dt / reduced-motion path

`step()` returns at `integrator.ts:243` (`if (dt === 0)`) *before* the force pass, and grids and the
heatmap only advance under `env.dt`. So under `prefers-reduced-motion` the solve and the transport
freeze with **no special case** — reduced motion is free for both designs.

The trap is on the *field* side: whatever schedules a rebuild or a re-raster lives in `field.ts`, not
the integrator, and must be dt-gated too — otherwise the engine re-solves a nav potential while
motion is frozen. And any motion-bearing projection of the routed structure (a flow overlay) must
declare a static reduced-motion equivalent, per the existing per-surface proof.

Also inherited unchanged: no force dt-scales its impulse under the `fixed` integrator, so a
flow-field branch has exactly `fieldflow`'s dt behaviour and is byte-identical at `dt === 1`.

### 5.4 The particle/force count invariants in `safety.test.ts`

`packages/core/src/conformance/safety.test.ts` asserts, per force, per frame: no NaN/Infinity, finite
positions, speed ≤ c, bounded heat (`HEAT_MAX = 2`), and **count conservation** — `count ≠ startCount`
fails for any non-source scenario.

- **Count:** neither design spawns or destroys. Agents are already pool particles counted by
  `particleCount` and excluded from `readParticles`. The invariant is safe by construction — but say
  so in the PR rather than assuming it.
- **NaN:** this is where B's blocking defect B-B2 would land, and it is a *sweep*, not a proof. A
  navigation solver must assert finiteness at its own boundary: every direction returned adjacent to
  an obstacle is finite, or the reader returns "no direction" — with `safety.test.ts` as the backstop
  only.
- **Speed ≤ c:** reusing `fieldflow`'s c-cap verbatim is what keeps this true across a discontinuous
  structure (a cliff-edge direction flip).

### 5.5 The three-plane parity obligation

`data/parity-matrix.json` is **auto-derived** (`scripts/gen-parity-matrix.mjs`) across six
dimensions — `field-handle-methods`, `field-options`, `force-tokens`, `render-modes`,
`overlay-modes`, `palette` — for planes `js`, `swift`, `kotlin`; `check:docs` fails when the
committed JSON is stale.

Consequences, both directions:

- Adding `FieldHandle.flowField` / `sampleFlow` (A) or a `navflow` token (B) **auto-creates
  Swift ✗ / Kotlin ✗ rows**. The JS PR must run `pnpm gen:parity-matrix` and either land the ports in
  the same PR (the #1110 resting-motion precedent: one commit, three planes) or record the gap
  honestly (the #1091 palette precedent) — never claim parity it doesn't have.
- **Body attributes are not a parity dimension at all.** `data-flow-field` / `data-solid` gaps would
  be *invisible* to `check:docs` — which is exactly how `data-charge-gated` (#711) came to be JS-only
  with nothing tracking it (0 hits under `swift/Sources` and `android/`, re-verified). Either add an
  attribute dimension to the generator or record the gap in prose deliberately.
- **Rust** (`rust/`, experimental, 28/36 forces) has no `addField` channel at all and is not on the
  parity page: no obligation, but a one-line status note is honest.
- The ports are 3D-native (`fieldAt` is `Vec3`-shaped on Swift and Kotlin), so a nav accessor must
  take a `Vec3` and return z = 0 to reduce to JS exactly at the plane.

### 5.6 The one thing that cannot be delivered as written

The ticket asks for a navmesh "that deflects both particles **and the sampled field**." Mutating
`env.fieldAt` / a `field()` hook to route around obstacles breaks linear superposition and
field-function purity, and canon says fields do not affect fields. Both designs decline it and route
the reveal to a **projection** (`sampleFlow` / `navField` + an overlay — see also the open
"Flow-field LIC render mode" ticket #671). The implementation PR must say this out loud on the
ticket; a reviewer expecting `sample()` to bend around a fence will otherwise reject the work.

---

## 6. What it would cost to build

### Design A (favoured)

| | |
| --- | --- |
| **Files touched (JS)** | new `packages/core/src/engine/flow-field.ts` (solver) + its test; `engine/field.ts` (handle methods, registry, env-service wiring, resize path); `engine/types.ts` (`Body.flowField?`, `BodySpec.flowField?`, `Env.flowAt?`, exported option/handle types); `engine/scanner.ts` (attr parse + live refresh); `forces/extended.ts` (**one** ternary in `fieldflow`); pass-throughs in `packages/vanilla`, `packages/elements`, `packages/three`. |
| **New public surface** | `FieldHandle.flowField(name, opts)` → `FlowFieldHandle { name, cell, version, mode: 'designed', setGoal, rebuild, flowAt, reachable, remove }`; `FieldHandle.sampleFlow(name, x, y)`; `Env.flowAt?`; `Body.flowField?` ← `data-flow-field`; **`BodySpec.flowField?` (required by A-B1)**; optionally `data-solid`. No new token, no `FieldOptions` key. |
| **Gate work** | `scripts/api-surface.data.mjs` (a `partial` row in the `grid(name)` style); `apps/site/src/lib/docs-api.ts` ATTRS row (`check:docs` + the contract-coverage attribute leg); `pnpm gen:parity-matrix` (new handle-method rows); `CHANGELOG` `[Unreleased]`; a canon note in `system-contracts.md` §4 plus a short `docs/engine-reference` page; `check:links`. No `check:golden` delta (zero diff is the proof), no `check:cem` unless an element attribute is added. |
| **Tests** | solver unit tests (BFS distances, corner-cutting, escape direction, unreachable pockets, rebuild-count = 1 over 300 static frames, bit-identical re-solve); force-integration tests via the existing `fieldkit-gaps.test.ts` virtual-body harness; the acceptance scene **plus its contrast case** (same scene with a plain attract goal → agent pressed against the fence); default-path A/B + `env.flowAt === undefined` probe. |
| **Port work** | Kotlin and Swift each: `Env.flowAt?`, `Body.flowField`, a mirrored solver, registry + wiring, the one-line force branch, handle methods, and the **body-spec entry points enumerated in B-M3** (two spec classes on Kotlin, two inits on Swift). Sequencing: either Kotlin-first-then-Swift in separate PRs against `main` (a non-main base gets no CI), or all three planes in one commit per the #1110 precedent. |
| **Deferred increments** | hard blocking (kinematic clamp on the rasterised `Uint8`); the reveal overlay; a shared `Env` channel accessor with #443; per-cell cost from a terrain channel (Dijkstra), which is where #439 and #443 finally meet. |

### Design B (for comparison)

Everything above **plus**: a passport row and a conformance experiment for `navflow`; `MANUAL_FORCES`
+ the five catalog maps; `gen:force-catalog` regeneration (which also writes the Swift generated
catalog); the 36→37 flip across ~10 doc sites in the same PR; `FieldOptions.nav` (and a
contract-coverage reference for it); `GridMode 'held'` + a cell-write API on three `ScalarGridImpl`s;
`Body.solid` through all five body-spec entry points; `FieldHandle.navField()`. Its blocking defects
(B-B1, B-B2) must be closed first.

---

## 7. Recommendation

Implement **A, amended**: add `BodySpec.flowField?` (A-B1), adopt `data-solid` and a `designed`
truth mode from B, pin `data-range="0"` and a numeric species in every fixture, replace the committed
fingerprint with same-process A/B, and **decide A-M4 before writing code** — either fold the
kinematic blocking clamp into the first increment or split the ticket in two. Ship it as one
cross-plane change (#1110's precedent) or Kotlin-first with the parity gap recorded, never claimed.

---

## 8. Cached claims that are now stale

The cached design work ran at `ea615fdf` / `084fdebc` / `2bc1af02`; `main` is now `fb065cc5`
(#1107–#1110, #1145, #1146 merged since). Re-checked on 2026-09-12:

| Cached claim | Status now |
| --- | --- |
| "HEAD is `084fdebc`" / "`main` at `ea615fdf`" | Stale anchors only. Every load-bearing premise re-verified at `fb065cc5`. |
| "`rust/docs/reference.md` does not exist (and `rust/README.md` links to it — a dangling link)" | **Stale — the file exists now.** The Rust note has somewhere to go, and there is no dangling link to report. |
| "`CHANGELOG [Unreleased]` holds only #1091" | Stale — it has moved on repeatedly since. |
| "parity-matrix dimensions are field-handle-methods / forces / render / palette" | Slightly stale: there are **six** (`field-handle-methods`, `field-options`, `force-tokens`, `render-modes`, `overlay-modes`, `palette`). The substantive point stands: **attributes are still not a dimension.** |
| Line numbers throughout (`field.ts:3392-3399`, `types.ts:487-494`, `integrator.ts:226-237`, …) | Drifted by a few lines. Current anchors: `addBody` attrs `field.ts:3404-3408`, `body.data` `:3431`, `addField` `:3696`, grid memo `:950-952`, `env.fieldAt` assignment `integrator.ts:260`, `dt === 0` return `:243`, range cull `:453`, `Env.fieldAt?` `types.ts:504`, `accum?` `:514`. |
| "#1123 declared potentials / admissibility, #1124 explicit dissipation" | **Mischaracterised.** #1123 is *"Lagrangian + action diagnostic over conservative field histories"* and #1124 is *"symmetry, conserved quantities, and structure-preserving integration"*. Both are open under the vNext epic #1111; neither is a declared-potential admissibility ticket. |
| Everything else load-bearing — `addBody` not stamping `spec.data` as attributes, numeric species, `range` defaults 280/100/100f, bilinear `sample()` + central-difference `gradient()`, `chargeGated` absent on both ports, no navigation code on any plane, 36 tokens, 120-case golden over six forces, `dt === 0` early return | **Verified true at `fb065cc5`.** |

One genuinely new input since the cached pass: **#1110 (resting-motion floor)** shipped a declared,
default-OFF primitive across JS + Swift + Kotlin in a single commit, with a new `FieldOptions` key.
It is the closest precedent either design has, for both the opt-in shape and the port sequencing.
