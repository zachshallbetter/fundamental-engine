# FieldKit #443 — height-aware fields: terrain elevation as a field input

**Status:** DESIGN PASS ONLY. No engine code is proposed for merge by this document, and nothing
under `packages/` changes with it. Two competing designs are recorded, one of them adversarially
reviewed, and both costed; the open defects at the end need a maintainer decision before any
implementation PR.
**Scope:** issue #443 (FieldKit gap #6), **phase 1 only** — height-biased *planar* flow. True 3D
(bodies off the z = 0 plane) is deferred by the ticket's own text and by both designs. Its sibling,
#439, is designed in [fieldkit-439-navigation.md](fieldkit-439-navigation.md); the two share one
seam (an optional `Env` accessor onto `addField` channels).
**Author/owner:** Zach Shallbetter.
**Verified against:** `main` @ `fb065cc5` on 2026-09-12. The cached design work ran at
`ea615fdf` / `084fdebc` / `2bc1af02`; §8 lists every cached claim that has since gone stale.

---

## 1. Does the ticket still apply?

**Yes — but it is half-shipped, and the half that shipped is the half that matters least.**
`gh issue view 443`: OPEN, created 2026-06-13, milestone 1.0, labels `enhancement` +
`track-b-engine`, parent epic #730. It carries one comment — Zach's own review of 2026-09-11, which
already records the partial seam:

> the external field channel `field.addField(name, sampler)` … already gives a host a way to supply
> terrain height as a field input. What this issue still asks for and does not exist: a force that
> reads that height as a gradient (downhill flow, wind over relief) and, later, true 3D forces on
> bodies off the z = 0 plane.

### What exists today (the input half)

| Exists | Where |
| --- | --- |
| `FieldHandle.addField(name, (x,y) => number)` → `FieldChannelHandle { name, set, remove }` | `packages/core/src/engine/field.ts:3696`; the channel map is closure-local at `:342` |
| `FieldHandle.sampleField(name, x, y)` (returns 0 for an unregistered name) | `field.ts:3704` |
| The same pair on **Swift** (`FundamentalVanilla/FieldEngine.swift`, `FieldHandle.swift`) and **Kotlin** (`runtime/FieldHandle.kt`, `FieldController.kt`) | shipped 0.5.1 |
| The documentation naming terrain height as *the* use case | `types.ts:1759-1766`; `docs/canonical/system-contracts.md:121`; `apps/site/src/lib/docs-api.ts:108` |

And the documentation is equally explicit that this is **structure, not cause** — `types.ts:1759`:
"the engine does not (yet) couple it into forces … (Force coupling — a force reading a channel as a
potential — is a separate, opt-in step; this is the read substrate.)"

### What does not exist (the coupling half)

- **No force can reach a channel at all.** `Env` carries `dz?`, `D?`, `spawn`, `neighbors`,
  `grid(name)`, `fieldAt?`, `accum?` (`types.ts:462-514`) — and **no channel accessor**. Nothing in
  `packages/core/src` reads `fieldChannels` except `field.ts` itself and two tests. A force
  physically cannot sample `height` today.
- **No height-reading force.** Nothing consumes elevation as a gradient; `buoyancy`'s lift is `−y`
  on screen, an orthogonal notion.
- **No true 3D.** Bodies live at z = 0 on every plane; `docs/engine-reference/z-axis.md` lists
  `stream`, `wall`, `magnetism`, `gate`, `buoyancy`, `shear`, `crystallize`, `wind`, wave currents
  and scalar grids as *deliberately planar*, and the flat path is contractually bit-for-bit.
- **Rust** has no channel concept at all (experimental plane, 28/36 forces).

So the ticket's acceptance criterion — *water-matter biases toward lower terrain and wind-matter
slows climbing a ridge, both emerging from the field rather than faked by the host* — is **entirely
unmet**. What shipped moved the work from "design a whole new input substrate" to "design one
coupling."

The consumer premise holds too: Habitat's `docs/FieldKit.md` still lists gap #6 as open ("terrain
height isn't a field dimension; downhill water / wind-over-hill can't come from the field yet").

---

## 2. The two competing designs

Both add **one** new extended force token (36 → 37) and both are default-off. They differ in the
*coupling rung*: how the host's sampler reaches a particle.

### Design A — minimal-additive: `slope`, reading the sampler directly

- **`Env.sampleField?(name, x, y): number`** — an optional `Env` member in the exact shape of
  `Env.fieldAt?` / `Env.accum?`, assigned lazily by `addField` itself. A field that never calls
  `addField` has it `undefined`.
- **`slope` force** (class [A] body force, `packages/core/src/forces/extended.ts`): per particle, a
  four-tap central difference at ±16 px (the half-step `densityPush` already uses), giving ∇h; then
  `p.vx -= gx·gain; p.vy -= gy·gain` — downhill in the plane — with the `fieldflow` c-cap so a cliff
  cannot exceed `e.c`. No-ops when the accessor is absent, when the channel is unregistered, when the
  sample is non-finite, or when the gradient is flat.
- **`data-channel="<name>"`** (default `'height'`) → `Body.channel?: string`, parsed next to
  `chargeGated`; read only by `slope`.
- **No `FieldOptions` key, no `FieldHandle` method, no `ScalarGrid` change, no grid at all.** Being
  additive (not `kinematic`) it is 1/m-scaled and attributed under `linear` automatically, and it
  inherits the range cull, `data-affects` species gating, `data-when`, the modifiers and the
  reduced-motion freeze for free.
- Because `sample()` shares the live env, a `slope` body shows up in `force-vectors` immediately —
  a reveal, never a write-back. `fieldAt` / streamlines / `fieldflow` do **not** see terrain in
  phase 1 (a `field()` hook has no env and cannot reach a channel); that gap is stated, not hidden.

### Design B — substrate-aligned: `relief`, reading a declared potential off a held grid

- **A declared potential.** Under the five-question method the model is gravitational potential
  restricted to a surface, Φ(x,y) = g·h(x,y); transport is −∇Φ. `truthMode: 'physical'` is argued
  legal *only* because the entire structure is host-supplied — with no channel the force is a pure
  no-op and can never decorate, which is what satisfies the wallpaper rule.
- **A `'held'` `GridMode`** — `GridMode` gains `'held'`, `step()` gains one early-return arm, and
  `grid()`'s name inference maps a `potential:` prefix to it. Every existing grid steps
  byte-identically.
- **Rasterisation on a cadence (rung 2).** When a visible body declares `relief`, the engine opens
  `grid('potential:<name>')` and fills it by calling the sampler once per cell — immediately on
  declaration, on `FieldChannelHandle.set()`, on resize, and thereafter on the existing 6-frame
  measure cadence. ≈830 sampler calls per 6 frames at 1000×800/cell 32, versus 4 calls per particle
  per frame under A.
- **`Env.potential?(name): ScalarGrid | undefined`** — assigned only on the declaration path;
  `relief` reads `g.gradient()`, the same force-reads-grid pattern `diffuse` uses.
- **`data-potential="<channel>"`** (default `'height'`) → `Body.potential?`, plus
  `BodySpec.potential?`. `data-spin` sign selects downhill (+) or uphill (−).
- Honest about the mass model: the engine rescales an additive force's Δv by 1/m, so heavy matter
  slides slower than `a = −g∇h` — recorded as an **Idealization**, never "Faithful."
- "Wind over relief" ships as a **Pattern** (wind + relief on one body), not as a second coupling
  bolted onto `wind`.

---

## 3. Which design the reviews favour, and why

**Design B — with an explicit caveat about the evidence.**

The caveat first, because it matters for how much weight to put on this: the cached adversarial pass
reviewed **only Design B**. Design A has *no* adversarial review — it is not "the design that
survived fewer objections", it is the design that was never shot at. Its defect count is not
comparable, and a review of A would very likely find its own problems (starting with the per-particle
sampler cost the canon warns about).

With that said, the evidence favours B:

- **B came through review with zero blocking defects** and three majors, all of which are closable
  engineering work rather than redesigns.
- **B's `Env.potential?` is the shipped zero-regression idiom**, verified: `Env.fieldAt?` /
  `Env.accum?` are documented as "absent on the default hot path", the integrator's only env-service
  assignment is `env.fieldAt` (`integrator.ts:260`), and nothing in the integrator reads
  `fieldChannels` — so a bare env cannot carry the property.
- **B's passport survives the lints.** `conservesSpeed: false` with `couplesDimensions: ['linear']`
  passes `lintDimensionCoupling`; attribution lands automatically through the central
  `applyAndRecord`; `validatePassports` accepts a force with no `field()` / `modify()`, klass C, and
  a matching experiment.
- **B's caching is the rung the canon asks for.** The coupling discipline is explicit that an
  expensive carrier samples on the measure cadence into a cache and the integrator reads the cache.
  A's four-taps-per-particle-per-frame is precisely the "sampler called on the hot path" shape the
  docs warn about — with a procedural host sampler it is 4 × particle count calls every frame.
- **The reveal is real, not aspirational, under B.** `forceAt` applies every non-field, non-modifier
  force to a still probe with the live env, and the handle's `sample()` passes that same env — so a
  declared potential shows in force-vectors with no write-back at all.

**Where A is genuinely better, and why it stays on the table as the fallback:**

1. **A does not contradict the canon's own words.** `system-contracts.md:123` and the matching JSDoc
   on all three planes say the sampler is "pull-based — called on demand, **never cached**." B's
   held raster caches it, and B's `set()` changes from a live swap to a swap-on-next-raster. That is
   a canon amendment plus a doc change on three planes — small, but it must be *decided*, not
   slipped in.
2. **A touches no grid machinery.** B's held mode has to be mirrored in **five** grid factories with
   independent name inference — `field.ts:950-952`, the conformance harness at
   `packages/core/src/conformance/run.ts:181`, Swift's *two* copies
   (`FundamentalVanilla/FieldEngine.swift:274` and `:997`), and Kotlin's `FieldController.kt:343-345`
   (which already drifts: it matches `name == "memory"` exactly where JS and Swift use a prefix).
3. **A needs no new grid write API.** `ScalarGridImpl.cur` is private and the public `ScalarGrid`
   surface is `sample` / `deposit` / `gradient` / `decay` / `clear` / `max` — filling a held raster
   needs a new impl-level write method on three implementations, which B's public-surface list omits.

---

## 4. Blocking and major defects

**No blocking defects were raised against either design for #443.** The three majors below were all
raised against Design B.

| # | Defect | Answered by B as written? |
| --- | --- | --- |
| **M1** | **The "executable proof" is environment-fragile and mis-cites its own helper.** B proposes committing a bit-for-bit Float64 fingerprint of a 300-frame composite run captured on `main`. A single-apply golden already drifts at the ULP level across Node majors (the known Node-25 drift; CI is Node 22), and a 300-frame hash over transcendental terms (wind curl noise, jitter) cannot be pinned bit-exact across runtimes. The helper it cites is at `packages/core/src/inspect/snapshot.ts` (not `engine/`) and its fingerprint is **coarse** — "particle count and mean speed / heat at the final frame" — not a per-particle bit pin. | **No.** Replace with the actual claim, tested in one process: reference (no `addField`) vs treatment (`addField` registered, no `relief` body) must be **equal in the same run**. Leave branch-vs-`main` to the existing determinism and golden suites. |
| **M2** | **The raster-refresh trigger set is incomplete, so held state is frame-phase dependent** — the determinism hazard B's own risk list names is left open. Missing triggers: `addField()` called when a `relief` body is *already* declared (the common ordering — `createField` scans the DOM first, then the host registers channels) and `remove()`. `addField`/`set`/`remove` touch only the channel map, never grids, so the raster stays empty (or, after `remove()`, **stale**) until the next `frameN % 6 === 0` frame. Calling `addField` at frame 3 rather than frame 0 yields different trajectories, and after `remove()` the force keeps reading the last raster for up to five frames — which directly contradicts B's own proof step ("`remove()` ⇒ `relief` becomes a no-op"). | **No.** Needs a dirty flag set by `addField`/`set`/`remove`, `Env.potential` returning `undefined` when the channel is absent (or dropping the grid on `remove`), and a synchronous re-raster before the force pass rather than inside the measure block. |
| **M3** | **The held-mode change is understated by a factor of five, and the conformance harness would silently erode the raster.** Name inference lives in five places (§3); the harness builds its *own* grid map and would open a `potential:` grid as **diffuse**, then step it every frame — so a 60-frame experiment expecting "speed increases descending" would read a slope that is blurring and decaying from frame 1. Plus the cell-write API on three `ScalarGridImpl`s (§3.3), unlisted in B's public surface and ports sections. | **No.** All five factories, the harness's grid construction, and the write API must be named in the PR checklist before the first line of code. |

### Minors worth carrying into the PR

- **Resize zeroes, it does not rescale.** `ScalarGrid.resize()` preserves nothing. B's risk item
  assumed stale cells would be interpolated; in fact `relief` reads a **zero gradient** after a
  resize until the next raster. And the re-raster must run *after* `scan()` re-detects the body, not
  at the `grids.resize` line.
- **The `potential:` prefix change is itself a (tiny) non-byte-identical change** for any host
  already opening a grid whose name starts with `potential:` — today that grid diffuses; afterwards
  it would be held. Call it out as the one documented exception.
- **Post-un-declaration state is unspecified.** When a `relief` body leaves the DOM, the held grid
  stays in the map and is iterated by the per-frame `step()` loop forever, and `Env.potential` stays
  assigned. Pin keep-vs-drop in the test.
- **Harness cost and offset handling.** The conformance field is 6000 × 4000, so an eager raster is
  ≈23.7k sampler calls per env, and the runner builds a fresh env per particle — gate rasterisation
  on the scenario actually carrying a potential. `centerScenario` translates bodies and particles
  unless the force is in `NO_OFFSET` (today `crystallize`, `wind`, `warp`): a linear h = 0.01·x is
  offset-invariant so B's numbers survive, but a non-linear test potential would not — document it or
  add the new token to `NO_OFFSET`.
- **Per-call allocation.** `ScalarGrid.gradient()` returns a fresh `Vec2` inside the per-particle
  loop. `diffuse` already pays this, so it is not a regression, but it violates the carrier perf
  rule; a `gradientInto(x, y, out)` is the additive fix.
- **A doc contradiction the canon touch-ups miss:** the "never cached" promise (§3.1).

---

## 5. Regression posture

The claim under test: **with no body declaring the new token, every plane is byte-identical to
`main` — whether or not the host has called `addField`.** That second clause is the important one:
*registration must not couple*, because the shipped docs promise exactly that.

### 5.1 What the default frame does — unchanged

- The new `Env` member (`sampleField?` under A, `potential?` under B) is **assigned only on the
  opt-in path** and is absent from every bare or probe env — the `fieldAt?` / `accum?` precedent
  (`types.ts:504`, `:514`). `applyForce` never sees it.
- No grid is opened in a bare field, and none is opened by `addField` alone under either design.
- `scalar-grid.ts`'s `step()` gains (under B) a branch on a mode **no existing grid carries**; under
  A there is no grid change at all.
- **Neither design adds a `FieldOptions` key**, so `contract-coverage.test.ts`'s
  `interfaceKeys('FieldOptions')` scan is untouched. (#1110's `restingMotion` is the worked example
  of what it costs when you *do* add one.)
- Both designs add **one token**: `MANUAL_FORCES` goes 36 → 37 and `catalog-counts-doc.test.ts`
  derives the count from it, so ~10 doc sites flip in the same PR, plus `gen:force-catalog` (which
  also writes the Swift generated catalog) and `gen:parity-matrix`.

### 5.2 What the 120-case cross-plane conformance golden sees — nothing

`swift/Tests/FundamentalCoreTests/Fixtures/conformance-golden.json` is `count: 120` over six pinned
forces — `attract`, `repel`, `swirl`, `stream`, `tether`, `viscosity`
(`scripts/gen-conformance-golden.mjs:27`) — and the generator reads only dist/vector plus scalar body
params. A height-reading force is not in that list and cannot be: its input is a host sampler. **The
proof is a zero diff** (`pnpm check:golden` = `gen:golden && git diff --exit-code`), and the new
force gets a *behavioural* conformance experiment instead, per plane.

Do not regenerate the golden on Node 25 (three last-bit floats drift for environment reasons; CI is
Node 22).

### 5.3 The dt / reduced-motion path

`step()` returns at `integrator.ts:243` (`if (dt === 0)`) before the force pass, and grids and the
heatmap advance only under `env.dt` — so both the (B) raster/solve and the transport freeze under
`prefers-reduced-motion` with no special case. No force dt-scales its impulse under the `fixed`
integrator, so a height force following `fieldflow`'s shape inherits exactly the same dt behaviour.

The trap is identical to #439's: B's raster scheduling lives in `field.ts`, not the integrator, and
must be dt-gated too, or the engine re-rasterises a potential while motion is frozen. Any
motion-bearing reveal (a flowing contour overlay) owes a static reduced-motion equivalent; static
contours satisfy it trivially.

### 5.4 The particle/force count invariants in `safety.test.ts`

`packages/core/src/conformance/safety.test.ts` asserts per force, per frame: no NaN/Infinity, finite
positions, speed ≤ c, bounded heat (`HEAT_MAX = 2`), and **count conservation** (`count ≠ startCount`
fails for any non-source scenario).

- **Count:** neither design spawns, destroys, or touches particle age — the strong invariant holds by
  construction.
- **NaN:** the real exposure is a **host sampler that returns `NaN` or `Infinity`**, which turns
  straight into a NaN velocity, and a non-finite velocity slips the `> c²` test. Both designs must
  clamp non-finite samples at the boundary — A at the tap (it already checks
  `Number.isFinite(gx) && Number.isFinite(gy)`), B at raster time — with `safety.test.ts` as the
  backstop only, never the design.
- **Speed ≤ c:** a discontinuous height field (a cliff) produces an unbounded ∇h; both designs keep
  `fieldflow`'s c-cap for exactly this reason, and it must be in the first PR, not a follow-up.

### 5.5 The three-plane parity obligation

`data/parity-matrix.json` is auto-derived by `scripts/gen-parity-matrix.mjs` across six dimensions —
`field-handle-methods`, `field-options`, **`force-tokens`**, `render-modes`, `overlay-modes`,
`palette` — for `js` / `swift` / `kotlin`, and `check:docs` fails when the committed JSON is stale.

Because `force-tokens` **is** a tracked dimension, a JS-only land of `slope` or `relief` is
immediately a visible parity delta — which is the argument for the single cross-plane PR (the
generator regexes `token: '…'` / `token = "…"` out of each plane's catalog, so the Swift and Kotlin
implementations must exist for the matrix to come back green). The ports' standing "full 36-force
surface" claims and the CI-derived count must stay true at every merge, which means the count docs
and the three implementations move together.

Two further parity facts: **body attributes are not a dimension**, so a `data-channel` /
`data-potential` gap would be invisible to `check:docs` — the way `data-charge-gated` (#711) came to
be JS-only with nothing tracking it (0 hits under `swift/Sources` and `android/`, re-verified at
`fb065cc5`). And **Rust** has no channel concept at all; it is experimental and off the parity page,
so a one-line status note is the whole obligation.

Port specifics worth pinning now: Swift's channel map lives in `FundamentalVanilla/FieldEngine.swift`
while `ScalarGridImpl` and `GridMode` live in `FundamentalCore`, so the wiring and the grid change
land in different modules; Kotlin holds `channels` on `FieldController`. Under B, the Kotlin `when`
and Swift `switch` over the grid mode are exhaustive, so a port that forgets the held case **fails to
compile** — a free parity forcer.

### 5.6 Scope discipline: what phase 1 is not

Phase 2 — bodies off z = 0, height as a genuine z coordinate — is **not additive** and is not in
either design. The flat path is contractually bit-for-bit and `z-axis.md` lists the deliberately
planar forces; a height force joins that list in phase 1. True 3D waits on the substrate foundation.
Saying this on the ticket is part of the deliverable: #443 will not be "closed" by phase 1, and
pretending otherwise would be the regression in the *record* rather than the code.

---

## 6. What it would cost to build

### Design B (favoured), phase 1

| | |
| --- | --- |
| **Files touched (JS)** | `forces/extended.ts` (the `relief` force); `contracts/passport.ts` (one row); `config/manual.ts` (`MANUAL_FORCES` + the five catalog maps); `engine/types.ts` (`Env.potential?`, `Body.potential?`, `BodySpec.potential?`); `engine/scanner.ts` (attr parse + key union); `engine/scalar-grid.ts` (`'held'` mode + a write API); `engine/field.ts` (grid inference, raster scheduling, env wiring, resize path); `conformance/run.ts` (harness grid construction + an experiment); `conformance/experiments.ts`. |
| **New public surface** | token `relief`; `data-potential` → `Body.potential?` / `BodySpec.potential?`; `Env.potential?(name)`; `GridMode 'held'` + the `potential:` prefix convention; a dev-warn code for the no-channel no-op. No `FieldOptions` key, no new `FieldHandle` method in phase 1. |
| **Gate work** | `scripts/api-surface.data.mjs` rows; `apps/site/src/lib/docs-api.ts` ATTRS row (`check:docs` + the contract-coverage attribute leg); `docs/engine-reference/forces-tests.md` row (`forces-tests-doc.test.ts`); `pnpm gen:force-catalog` + `pnpm gen:parity-matrix`; the 36→37 flip across ~10 doc sites in the **same** PR; `CHANGELOG [Unreleased]`; canon touch-ups (`system-contracts.md` §2.1 "separate, opt-in coupling" → names the force; the designed-vs-natural map row as **Idealization**; the `z-axis.md` planar list; the "never cached" amendment); `check:links`; and the refuted-claims hygiene test on the prose. |
| **Tests** | the ticket's own acceptance — matter drains into the basins of a host `h` and an agent rolls downhill under `maxSpeed`; "wind slows climbing a ridge" as a Pattern test; no-channel ⇒ no impulse (the wallpaper pin); registration-does-not-couple (same-process reference vs treatment, per M1); raster refresh on declare/`set`/`remove`/resize (per M2); the held grid opens exactly one grid and steps zero times; golden `git diff --exit-code`. |
| **Port work** | Kotlin: the force in `forces/ExtendedForces.kt` (the parity regex needs the literal `token = "relief"`), `Env.potential`, `Body.potential`, `GridMode.HELD` + the write API, raster wiring on `FieldController`'s cadence, tests. Swift: the same across `FundamentalCore` (force, `Env`, `Body` with a defaulted init parameter — source-compatible) and `FundamentalVanilla` (channel map + raster + env wiring), with **both** of its grid factories updated. |
| **Sequencing** | One cross-plane PR against `main` (a non-main base gets no CI), per the count-doc and parity obligations; #1110 is the recent precedent for three planes in one commit. |

### Design A (fallback), phase 1

Same token toll, same doc/count/parity work, same port obligation — **minus** the entire grid story:
no `GridMode` change, no five-factory sweep, no write API, no raster scheduling, no "never cached"
canon amendment. **Plus** a per-particle sampling cost (four sampler calls per particle per frame)
that has never been measured and that the RC-7 perf gate does not currently exercise (its bench
bodies are `attract` and `gravity` only), and a resolution story that is worse: a 16 px four-tap
cannot resolve features a rasterised `cell` option could.

### Increments after phase 1 (either design)

Reveal (contour / hillshade overlay reading the channel, plus a `scalarField` hook so the
`potential` / contour overlay modes work — a projection, never a write-back) → per-channel raster
resolution (`addField(name, sampler, { cell })` on all three planes) → zero-alloc gradient reads →
the shared `Env` channel accessor with #439, where a terrain channel becomes *per-cell cost* in a
navigation solve → **gated:** true 3D.

---

## 7. Recommendation

Implement **B (`relief` over a declared, held potential)**, with M1–M3 closed first: same-process
reference-vs-treatment proof instead of a committed fingerprint; a dirty flag covering
`addField`/`set`/`remove`/resize with a synchronous pre-force re-raster; and a PR checklist that
names all five grid factories, the harness's own grid construction, and the three-impl write API.

Two decisions belong to the maintainer, not to the implementer: **(a)** amending the "pull-based,
never cached" promise on three planes, which B requires and A does not; and **(b)** whether to
commission an adversarial review of A before committing to B, given that A has never been reviewed
and its per-particle cost is unmeasured.

---

## 8. Cached claims that are now stale

The cached design work ran at `ea615fdf` / `084fdebc` / `2bc1af02`; `main` is now `fb065cc5`
(#1107–#1110, #1145, #1146 merged since). Re-checked on 2026-09-12:

| Cached claim | Status now |
| --- | --- |
| "verified against `main` at `ea615fdf`" / "HEAD `084fdebc`" | Stale anchors only; the tree at the time was a feature branch, not `main`. Every load-bearing premise re-verified at `fb065cc5`. |
| "the held mode must be mirrored in **four** grid factories" | **Undercounted — there are five**: `field.ts:950-952`, `conformance/run.ts:181`, `FieldEngine.swift:274`, `FieldEngine.swift:997`, `FieldController.kt:343-345`. The noted Kotlin drift (`name == "memory"` exact vs prefix elsewhere) is real and still there. |
| "`CHANGELOG [Unreleased]` holds only #1091" | Stale — it has moved on repeatedly since. |
| "#1123 declared potentials / admissibility, #1124 explicit dissipation" | **Mischaracterised.** #1123 is *"Lagrangian + action diagnostic over conservative field histories"*; #1124 is *"symmetry, conserved quantities, and structure-preserving integration"*. Both open under the vNext epic #1111, neither is a declared-potential admissibility ticket. |
| Line numbers throughout (`types.ts:1734-1746`, `field.ts:3687-3700`, `integrator.ts:226-238`, …) | Drifted. Current anchors: `addField` `field.ts:3696`, `sampleField` `:3704`, channel map `:342`, grid memo `:950-952`, `env.fieldAt` assignment `integrator.ts:260`, `dt === 0` return `:243`, `Env.fieldAt?` `types.ts:504`, `accum?` `:514`, the addField JSDoc `types.ts:1759-1766`. |
| "`swift/Tests/FundamentalCoreTests` has no `ExtendedForcesTests` while Kotlin does — `testing-and-conformance.md` needs the correction" | Still true, and still worth fixing while nearby. |
| Everything else load-bearing — `addField`/`sampleField` shipped on JS/Swift/Kotlin and not Rust, no `Env` channel accessor, nothing outside `field.ts` reading the channel map, `GridMode = diffuse \| wave \| memory`, `ScalarGridImpl.cur` private with no raster write API, bilinear `sample()` + central-difference `gradient()`, 36 tokens, 120-case golden over six forces, harness 6000×4000 with `NO_OFFSET = {crystallize, wind, warp}`, the coarse `inspect/snapshot.ts` fingerprint, `chargeGated` absent on both ports | **Verified true at `fb065cc5`.** |

One genuinely new input since the cached pass: **#1110 (resting-motion floor)** shipped a declared,
default-OFF primitive across JS + Swift + Kotlin in a single commit — the closest precedent for both
the opt-in shape and the single cross-plane PR this ticket needs.
