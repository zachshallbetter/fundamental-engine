# Forces backlog — design verification (#660 · #661–#664/#658 · #708 · #671)

**Status:** VERIFICATION, pre-build. Nothing here is built. No engine code exists for any
of it.
**Why this exists:** four forces backlog items were approved to build *subject to a
condition* — "verify we're creating and building these properly to the latest and
upcoming tickets before we commit." This is that verification. It makes the go/no-go case
per item rather than assuming go.
**Scope:** design only. No `packages/` change accompanies this document.
**Author/owner:** Zach Shallbetter.
**Method:** three competing designs per item (physics-first, product-first,
contract-and-parity-first) plus eight per-item adversarial reviews, then a spot-check of
every load-bearing claim against `main` at `fb065cc5` and against live ticket state
(`gh issue view`). Stale cached claims are listed in §2.

---

## 1. The verdicts

| # | Item | Verdict | One-line reason |
|---|------|---------|-----------------|
| **#660** | `wormhole` preset | **BUILD WITH CHANGES** | Cheapest item by a wide margin — no new force token, no golden, no port work — but the drafted composition is *not* the canon spec and traps matter 2 px outside the throat instead of transporting it. Build the spec's asymmetric composition, settle the exit-side question first. |
| **#661–#664 + #658** | transmutation set (`fuse`/`fission`/`decay`/`phase`) + reactive medium | **DON'T BUILD (now)** | Two independent blocking defects: the clock/medium substrate is designed against a `dt = 1` engine that does not exist, and `fission`/`decay` silently destroy mass at the spawn ceiling — the exact "mass-conserving" claim the tickets are named for. Highest gate cost of the four (36 → 39/40 across every plane). #1123/#1124 now want conservation *declared and falsifiable*; shipping an unfalsifiable one first inverts the dependency. |
| **#708** | fieldflow flux-linkage gain | **DON'T BUILD** | The proposed law is not flux linkage. It is a multi-source alignment metric that scores ≈0.78 for two gravity wells whose lines never link, and collapses to ≈0 exactly where the linked flux tube converges on the other pole — the opposite of what the ticket asks. It is also discontinuous at every source's cull radius. The honest version is a read-only diagnostic, not a gain term. |
| **#671** | `lic` render mode | **BUILD WITH CHANGES** | The physics is sound and the gate cost is modest (no force token, no golden), but the headline claim — "render-only, mutates no engine state" — is **false today**: the shared render probe carries `cap` between calls and `sink`/`memory`/`diffuse` write real engine state through it. LIC multiplies that ~33×. Fix `forceAt` purity first, in its own PR; then LIC. |

**Net:** two of four proceed, and one of those two is gated behind a bug fix that is worth
doing on its own. Two do not proceed. The "36 forces" brand fact does not move under any
recommendation in this document.

---

## 2. Stale-claim ledger (cached analysis vs. `main` today)

The design work ran against an older `main`. Checked against `fb065cc5`:

| Cached claim | Status | Correction |
|---|---|---|
| "the Rust plane is on branch `feat/rust-core` only" | **STALE** | Rust is on `main` (`084fdebc`, #1108) with 28 of 36 forces. `fieldflow` is explicitly *not* registered (`rust/crates/fundamental-core/tests/extended_forces.rs:240`) and is deferred to #1041. This makes #708 a four-plane item in intent, landing on a force one plane does not have. |
| "`fieldflow.test.ts` has exactly 8 tests" | **WRONG** | 7 (`grep -c 'test('` = 7). One review asserted 8, another caught it. The 7-test figure is correct. |
| `chargeGated` (#711) exists only in JS | **STILL TRUE** | `grep -rc chargeGated swift/Sources android/` returns no hits on `main`. The divergence is real and unfixed. |
| "36 forces / 8 presets / 20 render modes / 120 golden cases" | **CONFIRMED** | `MANUAL_FORCES.length` 36; `MANUAL_PRESETS` 8; `RENDER_MODES` 20 entries; `conformance-golden.json` `count: 120`. |
| `SOURCE_TOKENS` is exact-equality gated | **CONFIRMED** | `forces.config.ts:204` is literally `['spawn']`; `forces.config.test.ts:51` `deepEqual`s it against the passported [S] set. |
| passport has no potential/conservation vocabulary | **CONFIRMED** | `grep -n 'potential\|conservative' packages/core/src/contracts/passport.ts` → empty. |
| `gen-force-catalog` carries an appended passport key | **WRONG** | `scripts/gen-force-catalog.mjs:40` captures only `token,label,family,klass,truthMode`; an appended key is silently dropped, never reaching `data/forces-catalog.json` or `GeneratedForceCatalog.swift`. (Safe, but three designs asserted the opposite.) |
| reviews predate #1110 | **NOTED** | The resting-motion floor (`9dc8478b`, #1110) landed after the cached pass. It is now the precedent every item in this document should follow: *declared, default-OFF, present on all three planes, golden-neutral.* |
| `docs/canonical/api-stability.md:96` "16 shipped render modes" | **ALREADY STALE ON MAIN** | `RENDER_MODES` is 20 and this line is outside the `check:readme` gate. Pre-existing drift; #671 would make it worse by one. |

---

## 3. The cross-cutting precondition that must NOT ship

All three design rounds opened with the same move: add a `potential` field to
`ForcePassport`, with hand-derived potentials for gravity/charge/attract/repel, "so #1123
has something to read." **Seven of the eight adversarial reviews flagged this, and it
should be rejected on two independent grounds.**

**(a) It is canon promotion, which the program forbids.** `ForcePassport` is public API
(`contracts/index.ts` → `index.ts`, exporting `PASSPORTS`/`passportFor`). #1123's
acceptance says verbatim *"No public API/canon promotion."* #1111's governing rule says
*"All new runtime work starts experimental / unexported. No public API or canon promotion
from these issues alone."* And #1123 *depends on #1119 and #1120*, both open — so this
would front-run its own dependency chain. Defining which shipped forces admit a
trustworthy potential is #1123's **own required-scope deliverable**; handing it a
pre-decided table from a preset PR is precisely the inversion the epic exists to prevent.

**(b) The declared potential is sign-wrong.** Four reviews caught this independently.
`natural.ts` documents that `e.dx`/`e.dy` point *from the particle toward the body*, so
`+s` pulls inward; the attractive potential is therefore `V(d) = +(s/ε)·atan(d/ε)`. All
three designs wrote `−(s/ε)·atan(d/ε)`, whose gradient is **repulsive**. Feeding #1123 a
sign-flipped gravity potential is the exact "faked potential" #1123 was written to forbid.

There are further honesty gaps in the same table: `clampToC` is a dissipative velocity
projection, not a boundary term; the declared "conservative" domain for `attract`/`repel`
omits the integrator's per-frame `mul = sMul · attn · screenMul · (focusMul ?? 1)`
rescale, the `b.on` range ×1.5 / strength ×3 jump, the shipped `ambientOrbit: 0.1` default
(which puts the live default *outside* the declared conservative domain), the always-on
`FRICTION = 0.95`, and the `env.dist = d < 1 ? 1 : d` sub-pixel clamp. Separately, the
`field()` hooks that `streamlines`/`fieldflow` actually follow are a *different law* from
the `apply()` kernels — unsoftened, uncut, with a `Q_GAIN` density gain and no `G` — so a
potential derived from `apply` does not describe the field lines drawn on screen.

**Disposition:** none of the four items needs this. Each recommendation below assumes the
`potential` field is dropped. When #1123 runs, the vocabulary it needs can live in an
unexported, experimental map beside the diagnostic — the epic's stated pattern.

---

## 4. #660 — the `wormhole` preset

### 4.1 What it is, as physics

Not a force: a **topological identification of two throat disks**. Matter inside throat A
(`|x − A| < r_t`) is mapped `x ↦ B + R(θ)·û·(k·r_t + 6)`, `v ↦ R(θ)·v`, where `û` is the
unit entry offset, `θ = data-twist`, `k = data-scale`
(`packages/core/src/forces/extended.ts`, `warp.apply`).

- **Conserved by construction:** particle count, speed `|v|`, mass `m`, `vz` (the twist is
  about z). At `θ = 0` the momentum vector is conserved exactly.
- **Not conserved:** position continuity (a jump discontinuity), and for `θ ≠ 0` the
  direction of momentum — the twist breaks translational symmetry.
- **Work done:** zero. `warp` is `kinematic`, and its passport already says
  `doesWork: false`, `conservesSpeed: true`.
- **Truth mode:** `poetic` — presets are expressive composites of stable primitives.
- **Force class:** A (body → particle). The preset adds no new class.
- **Potential admitted:** **none**, and this is the honest answer, not a gap. A position
  map is not the gradient of anything. Under #1123 the composite is
  `unsupported: discontinuous`.

### 4.2 Does it still apply?

**Yes, unchanged.** #660's entire text is "Compose wormhole from the shipped `warp` atom
(BACKLOG v0.5)" — so the canon **is** the acceptance criterion, and the canon already
specifies the composition (`docs/engine-reference/forces-system.md` §20.3/§20.9,
`forces-formulas.md`). Nothing in #1111's sub-issues touches presets: #1123/#1124 are
history-space diagnostics over *conservative* systems, and a discontinuous position map is
explicitly out of their supported set. No newer ticket supersedes or reframes #660.

The blocker the design found is real and verified: **a preset cannot carry a pairing
today.** `scanner.ts` `entryAttrs` maps only the eight numeric `PresetEntry` fields, and
`makeBody(el, sb)` never reads the element for pairing — so `data-pair` on a preset
element never reaches the `warp` virtual body, and `warp` no-ops on `!b.warpHas`. That is
the whole reason #660 has not shipped, and the fix is data-plumbing, not engine code.

### 4.3 Recommendation: BUILD WITH CHANGES

Build it — it is by far the cheapest item here — but **not the composition the design
drafted.** Three changes are mandatory:

1. **Ship the canon composition, not the drafted one.** The spec is *asymmetric*:
   `attract + warp(throat A) ⟷ warp + repel(throat B)`, throat 40, attract range 300, **no
   `lens`**. The design substituted a symmetric `attract + warp + lens`, absorb 48 /
   range 260, with no ejection mouth — and did not say it was deviating.
2. **Settle the exit-side physics question before writing the preset table.** `warp`
   rotates both the offset `û` *and* `v` by the same twist, so the relation "v points at
   the centre from the offset" survives every twist: inward-moving matter emerges
   inward-moving and re-enters. The `+ 6` in `outR = throat * k + 6` only prevents
   same-frame re-entry. This is a one-line question about the atom
   (`warpX − rux·outR` vs `+`) and it is Zach's call, because it would change a shipped
   force on three planes.
3. **Drop the `potential` passport precondition** (§3).

### 4.4 Defects raised, and whether the design answers them

| Sev | Defect | Answered? |
|---|---|---|
| **Blocking** | Well-posedness argument is physically wrong: the composite does not transport, it *traps*. Simulated through the real conformance runner — warp-only pair, inbound `v = 3`, twist 0 → **9 crossings in 60 frames**; preset-faithful arrangement → matter parks at **50.1 px** from mouth B, 2.1 px outside `absorbR = 48`, held only by `lens` orbiting at ≈0.29 rad/frame. | **No.** Fixed only by adopting the spec's `repel` at mouth B, which ejects to ≈245 px vs the design's ≈52 px. |
| **Blocking** | Silent deviation from the canonical spec (dropped `repel`, added `lens`, changed throat/range). | **No** — and the dropped term is exactly the one that fixes blocker 1. |
| Major | The `potential` passport precondition over-reaches #660 and pre-empts #1123. | **No.** See §3. |
| Major | Declared gravity/charge potential has the wrong sign; `clampToC` mislabeled a boundary term. | **No.** See §3. |
| Major | Invariant 1 ("speed preserved across the relocate frame within 1e-9") cannot pass: `FRICTION 0.95` is applied every frame *after* forces, and `FrameState` is captured after the whole step. Measured ratio is exactly 0.950, and ≈6e11 for the design's at-rest seeds. | **No.** Speed conservation of `warp` is provable only as a unit test on `warp.apply` directly, never on a trajectory. |
| Major | The proposed `COMPOSITE_EXPERIMENTS` entry does not exercise the preset: one body with `tokens: ['attract','warp','lens']` shares one `strength`/`range`, so `lens` runs at θ_max 0.9 / range 260 instead of 0.35 / 300. Simulated: single-body settles at 60.8 px, preset-faithful at 50.1 px — different dynamics. | **No.** Needs one `extraBodies` entry per virtual body. |
| Major | Site gate list misses the pages that render one chip per `MANUAL_PRESETS` entry — `engine-tour.astro`, `design.astro`, `docs/api/presets.astro` each hard-code 8 preset colors, and `force-glyphs.css` has no `fgp-wormhole`. An unpaired `wormhole` chip would ship as a degraded well. | **No.** |
| Minor | `lens` classified `unsupported: discontinuous` when it is a continuous velocity rotation (the honest reason is velocity-dependent); the proposed test keys on a `kinematic` flag the passport does not carry (it lives on the `Force` module). Pre-existing drift: the `lens` passport row says `doesWork: true, conservesSpeed: false`, contradicting the code. | **No** — and the pre-existing row drift is worth its own ticket. |
| Minor | `data-scale` semantics contradict across code / `docs-api.ts` / spec (offset-only vs velocity vs both). | **No.** |
| Minor | `forces-tests.md` count edit mis-cited (the "39 experiments" string is line 254, not 251; the `~76 checks` figure on 252 also moves). | Partially. |

**Kept, verified:** the pairing blocker diagnosis; the element-level overlay as the right
mechanism (`field.ts` resolves `b.pair` by selector and `updateWarpTargets` refreshes each
frame — no integrator change); `absorb` → `absorbR` reuse matching `blackhole`; the
`docs-api.ts` ATTRS rows for `data-pair`/`data-twist`/`data-scale` already existing (no new
`check:docs` surface); count invariant holding through the throat (count constant 3/4 over
300 simulated frames, heat ≤ 0.6); excluding `sink` (warp requires `!p.cap`); and ports
correctly scoped to nothing.

### 4.5 Gate cost

| Gate | Cost |
|---|---|
| `safety.test.ts` "36 forces" count budget | **None.** No new force token. |
| passport ROWS + `validatePassports` | **None** for the preset itself. (Presets are not passported forces.) |
| `SOURCE_TOKENS` exact-equality | **None.** |
| Catalog counts in docs | `README.md:301` **8 presets → 9** (`check:readme`, derived from `MANUAL_PRESETS.length`), `engine-tour.astro:91` "133 atoms … 8 presets", `index.astro:456`. Preset atoms 8 → 9 via `gen:atoms`. **"36 forces" does not move.** |
| 120-case cross-plane golden | **Zero diff required and achievable** — `attract` is in the golden, so `pnpm check:golden` is the regression proof that no atom changed. |
| Three-plane ceremony | **None.** No `PRESETS`/`expandPreset` on Swift or Kotlin; the parity matrix has no preset dimension; `warp`/`attract` already 36/36/36. *Unless* the exit-side fix is taken — then it is a one-line sign change on all three planes (Kotlin first), plus the Rust plane (`warp` is among the ported 28). |
| Other | `COMPOSITE_EXPERIMENTS` +1 ⇒ `forces-tests.md` 3 → 4 and 39 → 40 (ungated, keep-true); site preset-color maps and `force-glyphs.css` need a `wormhole` entry. |

### 4.6 Regression posture

- **Default-OFF:** a preset ships inert. `warp` no-ops while unpaired, and the engine severs
  the link if the partner leaves the DOM — the preset must preserve that no-op and never
  throw. Nothing changes for any existing page.
- **What the golden sees:** nothing. No force formula moves (unless the exit-side fix is
  taken, in which case the golden still shows zero diff — `warp` is not one of the six
  golden forces, which is itself a gap worth naming).
- **Reduced motion:** a wormhole with `motion = 0` is a static pair of marked throats; the
  non-motion equivalent is the existing preset-chip rendering. The preset must not be the
  only carrier of meaning on any page that ships it.

---

## 5. #661–#664 + #658 — the transmutation set and the reactive medium

### 5.1 What it is, as physics

Four primitives behind one opt-in medium mode, plus the #658 substrate:

- **`fuse` [B], 2→1.** A perfectly inelastic merger: on contact and approach,
  `m' = m_a + m_b`, `v' = (m_a v_a + m_b v_b)/m'`, `size' = √(size_a² + size_b²)`
  (area-additive). **Conserves** mass and linear momentum exactly. **Does not conserve**
  kinetic energy — the deficit `½·μ·|v_rel|²` (μ the reduced mass) is the binding energy,
  deposited as heat. Truth mode `physical`; class B (particle ↔ particle). No potential —
  it is a collision operator, not a field.
- **`fission` [S], 1→2.** A budgeted split: parent `m ← m/2`, daughter spawned with the
  complementary mass and an equal-and-opposite recoil. Intended to conserve mass, charge
  and momentum at the event. Class S (budgeted source).
- **`decay` [S].** 1→2 emission driven by a **time-decay bucket** (the ticket's words) — a
  deterministic accumulator, not a random draw. Conserves mass; breaks time-translation
  symmetry by construction (that is what a half-life *is*).
- **`phase`.** A state transition over derived conditions (gas / liquid / solid / plasma)
  keyed on heat and neighbour density. Conserves count and mass; it reclassifies matter
  rather than moving it. Truth mode `physical`; class undecided between B and A in the
  design — and `validatePassports` requires the passport klass to equal the scenario klass,
  so this must be resolved before a row can be written.
- **#658 substrate.** `MediumMode` drag (linear `v·e^{−γ·dt}` / quadratic / mixed),
  ε-softening as a declared mode, and real `dt` in seconds with a fixed-step accumulator.
  Under #1124 this is the right shape: naming `FRICTION = 0.95` as `γ = −ln 0.95` makes
  dissipation an **explicit term** rather than an invisible per-frame multiply.

### 5.2 Does it still apply?

**Partly, and the framing has moved under it.**

- The tickets are alive and grouped: #729 (epic) and #786 (E3 "Alive") both carry them,
  and #786 states the intent precisely — *"behind an opt-in reactive-medium mode (#658) so
  the count invariant stays default."* That instinct is correct and should be kept.
- **But #1123 and #1124 now exist and reframe the physics half.** #1124's required
  boundaries read as a direct critique of this design as drafted: *"A designed UI force is
  not automatically physical merely because it resembles one"*; *"Conservation only applies
  under declared closed-system assumptions; damping, sources, sinks, host work, collisions
  with restitution <1, etc. must appear as explicit drive/dissipation/boundary terms"*;
  *"Diagnostics refuse/qualify unsupported systems rather than emitting misleading
  conservation claims."* A transmutation set whose mass conservation **fails silently on
  the production path** (§5.4, blocking #2) is the misleading conservation claim #1124 is
  written to refuse. Shipping it before #1123 has defined what a trustworthy conservation
  declaration even looks like inverts the dependency order.
- **#659 (velocity-Verlet) and #658 are both named as *related* to #1123/#1124** — the
  integrator/medium substrate is now research input to an open program, not an
  independent build item.
- **#663's mechanism has been silently reinterpreted.** The ticket says "time-decay
  **bucket** (budgeted source)". The design made it a per-frame Bernoulli draw from
  `env.rng`, which is not reproducible across planes and cannot be goldened; a bucket
  could be. The design also renamed the token (`radiate` in one round, `halflife` in
  another — the rounds disagree with each other) on the strength of a *comment* in
  `recipes/schema.ts` that no test pins, and where the lookup checks `passportFor(token)`
  *before* consulting `OTHER_LANE` anyway.

### 5.3 Recommendation: DON'T BUILD (now)

Three reasons, in order of weight:

1. **The substrate half is designed against an engine that does not exist.** See blocking
   #1. Every "byte-identical when unset" claim in the medium/clock design is false on the
   live path.
2. **The physics half violates its own headline law on the production path.** See blocking
   #2. `fission`/`decay` destroy mass whenever the pool is at its ceiling, and the
   conformance harness — which runs an unbounded store — structurally cannot see it.
3. **It is the most expensive item in the backlog by an order of magnitude** (§5.5), and
   it is the only one that moves the "36 forces" brand fact. That cost is not payable for
   a design with two unanswered blockers.

**What to do instead.** Split the item and re-file:

- **Re-specify #658 against the real `dt`.** The medium vocabulary (`MediumConfig` with
  declared `drag`/`dragK`/`epsilon`) is genuinely valuable and is what #1124 asks for —
  explicit dissipation terms. It just has to be written against `env.dt ∈ [0.2, 2]`, not
  against a mythical `dt = 1`. This is a good standalone PR.
- **Hold #661–#664 until #1123 lands**, or until `Env.spawn` gains a failure signal.
  `fuse` alone is the most defensible of the four (its math is correct, `collide` is the
  right template, and it needs no source budget) and could go first as a single [B] force
  — one token, not four.

### 5.4 Defects raised, and whether the design answers them

| Sev | Defect | Answered? |
|---|---|---|
| **Blocking** | **The clock/drag substrate rests on a false premise.** The design asserts "no force sees anything but `dt = 1`", "`clock.unit:'frame'` = today", and invariant (i) "`drag:'linear'`, `dragK = −ln 0.95` is byte-identical to default". The live engine does not run at `dt = 1`: `field.ts:2846` computes `dtRaw = (now − lastNow)/16.6667` and `field.ts:2853` sets `env.dt = clamp(dtRaw, 0.2, 2) · motion` (#434 — ≈1 at 60 fps, ≈0.5 at 120, ≈2 at 30), mirrored in Swift. On the legacy path friction is applied *unscaled* whatever `dt` is. A 33.3 ms host frame is **one step at dt ≈ 2**, not two steps at dt = 1, so "frame" and "seconds" modes are not the same trajectory. | **No.** Found independently by both reviewers. The entire substrate design needs rewriting against variable `dt`. |
| **Blocking** | **`fission`/`decay` lose mass at the spawn ceiling.** `Env.spawn` is `void` and the live implementation is `if (store.size >= spawnCeiling) return;` (`field.ts:942`, `spawnCeiling = round(130·density)·4`), mirrored in Swift. The design's ordering decrements the parent's mass *then* spawns — so at the ceiling the parent has lost `m/2` and taken the recoil, and the daughter never exists. Mass and net momentum both change. The conformance harness runs an unbounded store and can never observe it. | **No.** Needs either a failure-signalling `spawn` or a reserve-then-commit ordering — an `Env` contract change on every plane. |
| Major | **Charge is not conserved across a live fission.** `newParticle` copies `m`, `heat`, `size`, `age`, `color`, `species` — **not `charge`** (verified on `main`). So `charge_parent/2` + daughter `0` ≠ original charge on the path users actually hit. The design's gate list names the conformance `makeEnv` but omits the live `newParticle`. | **No.** |
| Major | **`Env.despawn` / `Particle.dead` is under-specified exactly where it matters.** The per-particle loop skips only `p.cap`; there is no `dead` skip, and removal is deferred until after the source pass. A `q` fused by an earlier `p` still runs its full pass this frame — density feedback into `b.count`/`b.d`, every body force, separation, wander, wrap — the double-count `despawn` exists to prevent. `env.neighbors` reads the store index with no liveness filter, so the rule "pair forces skip `q.dead`" silently requires hand-edits in **seven** neighbour consumers (`collide`, `cohesion`, `align`, `pressure`, `link`, `hunt`, the integrator's own separation pass) **on every plane**. | **No.** |
| Major | **Family-count bookkeeping is internally inconsistent.** The design simultaneously says `extendedForces` stays at 19/20, that Kotlin's `assertEquals(36, forces.size)` becomes 40, that force-tokens reads 40/40/40, and that README says 40 — while gating three of the forces out of the default registry. The parity matrix counts token *literals* in the three files per port (so it reads 40), but the ports' tests assert the *default registry* (which would be 37). `manual.test.ts` deep-equals `MANUAL_FORCES` against actual registration and would fail. | **No.** The design must pick one: either the reactive three are family `extended` and `extendedForces` includes them with registration gated inside, or they get their own family — and the docs then state a number that does not match `extendedForces.length`. |
| Major | **The proposed reactive invariant is vacuous.** "`fuzz.test.ts` gains a sweep asserting Σm conserved" — but `fuzz.test.ts`'s `randomEnv` has `spawn: () => {}` ("inert") and `neighbors: () => []`. Under it `fuse` never fires (nothing to fuse) and `fission`/`decay` halve the parent then call an inert spawn, so Σm strictly *decreases*. The sweep as described either proves nothing or fails. | **No.** Needs a `FieldStore`-backed env. |
| Major | **The declared gravity/charge potential's domain is wrong twice over**, beyond the sign error in §3: `env.dist = d < 1 ? 1 : d` means the kernel evaluates at `dist = 1` below a pixel — a *constant*-magnitude force, not `−∇V` of the atan potential — and at conformance constants ε = 2GM/c² ≈ 0.014 px, so the `dist ≥ 1` clamp, not ε, is the effective regularizer. "Declared ε ⇒ declared potential" therefore declares a potential whose regularizer is somewhere else. | **No.** |
| Major | **#663's token and mechanism were changed unilaterally.** The ticket names `decay` and a *time-decay bucket*; the design renamed it (inconsistently across rounds) and made it a Bernoulli draw. The cited prohibition is a comment no test pins, and the ticket-faithful path is available. | **No.** |
| Major | **`fission` is class [S] but splits inside `apply`**, with a budget (`b.emitAcc`) that nothing refills — the only top-up is inside `spawn.source()`, called once per body per frame by the source pass. `validatePassports` only checks `isSource === (klass === 'S')`, so a source-less [S] force is **silently** accepted. | Partially — the mechanism works (the apply loop does iterate source tokens) but the refill hook is undeclared. |
| Minor | `fuse`'s heat law can reach 1.5–2.5 from two hot parents, outside the documented `heat ∈ [0,1]` lane and at/over `HEAT_MAX = 2` in the safety sweep. Needs an outer clamp in the *law*, not just for the chosen seeds. | **No.** |
| Minor | The "seconds" clock spec is self-contradictory — it both carries the accumulator remainder and caps a 500 ms hitch at 4 substeps, which is the spiral the cap exists to prevent. | **No.** |
| Minor | #658 is only partly mapped: `PhysicsMode` is never addressed, and "semi-implicit Euler" is skipped rather than declared already-shipped (`types.ts` documents `'legacy'` as exactly that). | **No.** |
| Minor | `phase`'s plasma branch cannot be exercised for more than ~4 frames (`p.heat *= 0.972` each frame, nothing pumps heat), and `'phase'` already occupies the metric lane in `semantic/layers.ts` and `recipes/catalog.ts` — a one-word-one-lane violation the lint will not catch because the metric lane is deferred. Its `phase` thresholds also disagree with `crystallize`'s shipped `FREEZE = 0.5`. | **No.** |
| Minor | Switching the safety sweep from `klass === 'S'` to `matter !== 'conserved'` silently changes the speed ≤ c exemption for `fuse`, and `Scenario` has no `matter` field — the lookup would throw on `COMPOSITE_EXPERIMENTS`, whose `force` strings ("attract repel") are not tokens. | **No.** |
| Minor | `medium.drag:'linear'` byte-identity is a V8 numerical coincidence at `dt = 1`, not an IEEE guarantee, and the ports run `Float` where it need not hold. | Partially — must be stated as harness-only. |
| Minor | The live scanner guard forces `life = 300, cap = 120` onto any `SOURCE_TOKENS` body lacking a budget, so live daughters are *always* mortal — mass is conserved only until frame 300. | **No.** |

**Kept, verified:** substrate-first ordering with default-OFF discipline; a first-class
`Env.despawn` rather than an `age = 0` hack; registration-gating the count-changing forces;
`fuse`'s inelastic math (momentum-weighted `v`, centre of mass, area-summed size); the
observation that `attract`'s `−uy·f·orbit` term is a genuine curl, so `attract` is
conservative only at `orbit = 0`; `γ = −ln 0.95` as the declared dissipation coefficient;
keeping all four **out** of the 6-force golden; `collide` as the right template for `fuse`;
`fuse`/`fission` colliding with no existing render mode, formation, condition or symbol;
and the port feasibility of `despawn` (both ports' `Particle` is a reference type, so
identity-based dead-marking works).

### 5.5 Gate cost — the reason this one is expensive

| Gate | Cost |
|---|---|
| `safety.test.ts` "36 forces" count budget | **This is the item that moves it.** The count invariant (`frame.length === startCount` for every non-[S] scenario) is the engine's strongest safety property; `fuse` destroys and `fission`/`decay` create. The design's answer — register them only under `medium.reactive` — is right, but the sweep's `isSource` derivation (`scenario.klass === 'S'`) then governs both the count assertion *and* the speed ≤ c exemption, and the proposed rewrite breaks on composites. |
| passport ROWS + `validatePassports` | **+3 or +4 rows.** `isSource ≡ (klass === 'S')` and `isModifier ≡ (klass === 'modifier')` are both hard-checked; `klass` must equal the conformance scenario's klass — so `phase`'s undecided B-or-A must be resolved first. A new optional `matter`/`count` field plus a new validation rule. |
| `SOURCE_TOKENS` exact-equality | **Direct hit.** `forces.config.ts:204` is literally `['spawn']` and `forces.config.test.ts:51` `deepEqual`s it against the passported [S] set. Adding two [S] forces edits both, and the test is exact — no drift tolerated. |
| Catalog counts in docs | **The brand-fact bump.** `catalog-counts-doc.test.ts` derives `TOTAL` and the family breakdown from `MANUAL_FORCES` and **fails CI** if any current-truth doc states a different number. That is `README.md:286` "**36 forces**", `README.md:211` "28 of the 36 forces" (the Rust line), `engine-tour.astro:91` "133 atoms … 36 forces", `index.astro:456`, `forces-tests.md:251` "**36 forces**", plus the "9 canonical / 8 natural / 19 extended" breakdown wherever it appears. |
| 120-case cross-plane golden | **Zero diff required** — none of the four is env-simple enough to join the six golden forces (`attract`, `repel`, `swirl`, `stream`, `tether`, `viscosity`), so each PR must show `pnpm check:golden` clean. That is the correct posture but it also means **the cross-plane math of these four forces is proven by nothing.** |
| Three-plane ceremony | **Full cost, ×3 (×4 with Rust).** Each token needs a literal `token = "…"` in `CoreForces`/`NaturalForces`/`ExtendedForces` on each port (the parity regex reads exactly those files), registration in `extendedForces()`/`standardForces()`, and Kotlin's `assertEquals(36, forces.size)` updated. On top of that: `Env` gains `despawn` and `count` on every plane, `Body` gains `pending`, `SOURCE_TOKENS`/`classifyBodyTokens` mirror, and the seven neighbour consumers each gain a liveness check. Conformance types change too — `FrameState.m`, `ScenarioParticle.m`, the `safety.test.ts` snap round-trip guard, `run.ts` `makeEnv`, `expectations.ts` `probeEnv`. |
| Other | `CONDITIONS` 7 → 11 and `PHASE_THRESHOLDS` in `forces.config.ts` + its exactness test; `manual.ts` `FORCES_RAW` ×3–4 with `FORCE_COLORS`; `docs-api.ts` rows; `check:docs` surface 4 (token regex over `extended.ts`); recipe canon (64 patterns) impact per #786. |

### 5.6 Regression posture

- **Default-OFF:** the gating mechanism proposed — *vocabulary admission*, where
  `scanner.makeBody`/`classifyBodyTokens` drop reactive tokens from any body unless
  `cfg.medium.reactive` is set — is the right shape and is byte-identical by construction:
  a body that never carries the token has no code path. It is the same discipline #1110
  established. `MediumConfig` defaulting to `{}` is likewise correct.
- **What the golden sees:** nothing, by design. Which is also the problem — see above.
- **Reduced motion:** unaddressed in the design and it needs to be. A medium that fuses and
  splits matter is a *motion* behaviour; under `prefers-reduced-motion` the honest
  equivalent is the phase/state readout without the transitions, and that has to be
  designed, not asserted. The site already gates this per surface (#1104, "meaning survives
  motion removal").

---

## 6. #708 — fieldflow flux-linkage gain

### 6.1 What it is, as physics

`fieldflow` is field-aligned transport: `v ← v + (n̂·|v| − v)·k_steer + n̂·gain·a_accel`
with `n̂ = F/|F|`, `F = env.fieldAt` = the superposition of every visible body's `field()`
hook, and `gain = strength·(1 − d/r)` (`extended.ts`). It **does work** and does **not**
conserve speed (its passport says so: `doesWork: true`, `conservesSpeed: false`,
`truthMode: 'hybrid'`). Under #1123 it admits **no potential** and is `unsupported` — so any
linkage term is a modulation of a *non-conservative drive* and must never be described in
energy or potential language.

#708 asks for a gain weighted by "how many field lines link to another body." **In 2D,
that quantity is not net flux.** By Gauss, the pairwise flux `Φ_AB = ∮_∂B F_A·n̂ ds` is zero
for any source outside B — net flux cannot count linking lines. The honest quantity is the
*fraction of A's field lines that terminate on B*, which requires **line tracing**, and
line tracing makes it a **relationship metric**, not a force term.

### 6.2 Does it still apply?

**The intent survives; the proposed mechanism does not, and the porting picture got worse.**

- #708 is open, unchanged since June 2026, and its premise is still accurate:
  `fieldflow`'s gain has no connectivity term today (verified on `main`).
- **#1041 changes the cost.** The Rust plane is now on `main`, `fieldflow` is explicitly
  *not* registered there, and #1041 ("Rust: field structure hooks + fieldflow — completes
  36 forces") specifies the port including the charge-gated variant. Adding a linkage term
  now means either blocking on #1041 or shipping a formula that one of four planes will
  have to reimplement from a moving target.
- **The existing divergence is unfixed.** #711's `chargeGated` gate exists only in JS —
  verified: no hits in `swift/Sources` or `android/` on `main`. `fieldflow` is outside the
  120-case golden and the parity matrix checks *token presence only*, so **no gate in the
  repo would notice that the three planes' `fieldflow` already compute different things.**
  Layering a second ungated term on top of an ungated divergence is the wrong order of
  operations.

### 6.3 Recommendation: DON'T BUILD

This is the clearest "no" of the four, and the reason is physics, not cost.

**The proposed law does not measure what the ticket asks for.** `L = C · min(1, 2(1 − s_max))`
(field coherence times an anti-dominance share term) is a **multi-source alignment metric**,
and both reviewers demonstrated the failure numerically against the real `field()` hooks:

- It scores **≈0.78 for two gravity wells** whose lines terminate on masses and never link
  to each other — and an identical 0.78 for two *like* poles. The design's claimed "like
  poles ⇒ 0" holds only at the exact midpoint.
- It scores **exactly 0 for the canonical linked-flux case, a lone bar magnet** — because a
  single body×token is one source, so `s_max = 1`. At `w = 1` the term therefore **kills
  `fieldflow`'s own headline demo**, the magnetism dipole whose loops matter threads.
- It **collapses where the ticket wants it to peak.** Evaluated against the real
  `charge.field()` with poles at ±300: `L = 1.000` at the midpoint, `0.400` at x = 100,
  `0.118` at x = 180 — so "channelling between two poles strengthens with linkage" is
  inverted: transport dies exactly where matter arrives. With the design's own proposed
  experiment geometry the decay is steeper still (1.000 → 0.016 over 100 px).
- It is **discontinuous in position**, which the design listed among its verified
  properties. The `2.56·range²` cull in `netField` drops a whole source at once:
  `L = 0.117878` at x = 179.9, `L = 0.000000` at x = 180.1. The `field()` hooks themselves
  have no cutoff, so the step is entirely the cull. A 50×50 bounds/no-NaN grid cannot
  detect it. **A gain term with a jump discontinuity is not shippable.**
- The premise "field-line density **is** |F|" is false for these fields. Density equals |F|
  only for a solenoidal field; a 2D radial 1/d² field drawn with N lines has density
  `N/(2πd) ∝ 1/d`. The `|F|`-based share quadratically over-weights the near pole.

**What to do instead.** The physics-first design itself found the right answer and then did
not follow it: split the idea into a **read-only diagnostic** `fluxLinkage(bodies, forces,
A, B, n, maxSteps)` beside `netField` — trace n lines seeded on A's `absorbR` circle along
the net field, return the fraction entering B's range — surfaced through the **existing**
`topology` render mode ("threads, flux links") and the Lab probes, **never read by
`apply()`**. That is honest, costs no force token, moves no count, and is what the ticket's
quantity actually is. File it as a new ticket and **reframe #708** to say the gain-term
reading was examined and rejected, with these numbers as the evidence.

**Prerequisite regardless:** port #711's `chargeGated` to Swift and Kotlin (and specify it
for Rust per #1041) before any further `fieldflow` work, so the three shipped planes agree
on the force that exists today.

### 6.4 Defects raised, and whether the design answers them

| Sev | Defect | Answered? |
|---|---|---|
| **Blocking** | `L` is not inter-body flux linkage — it is a multi-source alignment metric, ≈0.78 for unlinked gravity wells and 0 for a lone bar magnet. | **No.** Fatal to the item as specified. |
| **Blocking** | `L → 0` near any source, so the term dies exactly where the linked flux tube converges on the other pole — the inverse of #708's requirement. Numerically: 1.000 / 0.400 / 0.118 at x = 0 / 100 / 180. | **No.** |
| Major | "L is continuous in position" is false — the `2.56·range²` cull steps `L` from 0.118 to 0.000 across 0.2 px. | **No.** |
| Major | "Lone source ⇒ L = 0" is false as stated, because sources are counted per **body × token**: one body carrying `['gravity','charge']` gives two co-directed terms ⇒ `L = 1` with no other body on the page. (With the opposite spin they cancel exactly to a net zero field — a separate pre-existing oddity.) | **No.** |
| Major | The potential-passport precondition declares gravity/charge conservative from the `apply()` kernel, but the `field()` hook that `fieldflow` actually follows is a **different law** — unsoftened, uncut, with a `Q_GAIN = 1.5` live-density gain and no `G`. So `−∇V ≠ field()`, and #1123 would read a potential that does not describe the lines. | **No.** See §3. |
| Major | Three-plane parity is already broken and ungated: #711's `chargeGated` was never ported; `fieldflow` is outside the golden; the parity matrix is token-presence only. Kotlin is `Float`, so the proposed `1e-12` scale-invariance tolerances cannot mirror. | **No.** |
| Minor | At `w = 1` the term disables `fieldflow`'s single-magnet prominence — the force's headline use case — and the design does not state the trade-off. | **No.** |
| Minor | Documented degradation is misdescribed: with `linkageAt` absent, transport continues at `gain·(1 − w)`, not zero, for any `w < 1`; only `w = 1` is tested. | **No.** |
| Minor | Frame-0 `exactDelta(0,0)` "lone source inert" is vacuous evidence — it passes because the frame-0 env has no `linkageAt` at all, not because `L = 0`. | **No.** |
| Minor | The `magnetic` doc-drift "fix" is itself wrong: the code comment points at a **planned** §20.5 formation, and the proposed rewording would erase the cross-reference. The one real drift is a missing "planned" in `forces-formulas.md`. | **No.** |
| Minor | Gate-list drift: `fieldflow.test.ts` has **7** tests, not 8; the composite-count fix touches two lines of `forces-tests.md`, not one. | Caught by review. |

**Kept, verified:** the opt-in `data-linkage` knob defaulting to 0 is genuinely
byte-identical (the conformance `resolvePartialBody` never sets it) and mirrors the #711
pattern; **rejecting a `fieldflow` `field()` hook is correct** (`netField` sums every
token's `field()`, so a `fieldflow` field would self-superpose and flip `ownsField`, which
`validatePassports` hard-checks); a pure exported helper beside `netField` sharing its
visible/tokens filter has genuinely zero default-path cost; and **the ratio-of-magnitudes
construction really is scale-fair** — identical to 1e-16 when every mass is multiplied by
7, which satisfies that half of #708. The scale-fairness is the one thing the design got
right; it is not enough when the quantity being scaled is the wrong quantity.

### 6.5 Gate cost

| Gate | Cost |
|---|---|
| "36 forces" count budget | **None.** No new token — it modifies an existing force. |
| passport ROWS + `validatePassports` | A `physicsNote` edit on the `fieldflow` row. **Critically:** `ownsField` must stay false, which the design correctly preserves. |
| `SOURCE_TOKENS` | **None.** |
| Catalog counts in docs | **None on "36 forces."** `COMPOSITE_EXPERIMENTS` +1–2 ⇒ `forces-tests.md` 3 → 4/5 and 39 → 40/41 (two lines, ungated). |
| 120-case golden | **Zero diff** — `fieldflow` is not among the six golden forces. Which is exactly why this change would be **unprovable across planes.** |
| Three-plane ceremony | `Body.linkage` + `Env.fieldCoherenceAt` + a coherence sampler + the gain expression on **Swift and Kotlin** (Kotlin-first), plus Kotlin-only `fieldflow` tests (Swift has none). **Plus Rust**, where `fieldflow` does not exist yet (#1041) — so the formula has to be specified into a port that is not written. |
| Other | `scanner.parseBodyParams` + `scanner.test.ts`; `docs-api.ts` ATTRS row (`data-charge-gated` is the precedent); `run.ts` `makeEnv` + `expectations.ts` `probeEnv`. |

### 6.6 Regression posture

- **Default-OFF:** yes, and correctly so — `data-linkage` defaults to 0 and at `λ = 0` the
  gain expression is `gain · 1`, IEEE-exact. This part of the design is sound.
- **What the golden sees:** nothing. That is the problem, not the mitigation.
- **Reduced motion:** `fieldflow` is transport; under reduced motion the field structure is
  shown by `streamlines`/`field-lines` without advection. A linkage *diagnostic* (the
  recommended alternative) is strictly better here — it is readable with `motion = 0`.

---

## 7. #671 — the `lic` render mode

### 7.1 What it is, as physics

Line integral convolution is a **read-only functional of a vector field**:

```
I(x) = (1/Σk) ∫_{−L}^{L} k(s) · N(σ_x(s)) ds
```

where `σ_x` is the streamline of `F` through `x` parametrized by arc length, `N` a
white-noise texture, `k` a box/Hann kernel of half-length `L`. It visualizes the field's
**integral curves** (tangent structure), not its magnitude — so it is **scale-free by
construction**, since `σ_x` depends only on `F/|F|`. That is the same principle as
`fieldflow`'s normalization and the streamlines arrows' relative scaling, and it is the
right answer to #708's "must avoid absolute-magnitude bias."

- **Conserves:** nothing — it is not a dynamics. It is a *rendering* of a field.
- **Truth mode:** `diagnostic` (it reveals internal state). Note: `TruthMode` is a
  `ForcePassport` field and has **no declaration site for a render mode** — the actual
  surface is `VISUALIZATION_TRUTH_TABLE` (`readsFrom` / `mutatesPhysics` /
  `showsTruthAbout`), and #671 needs a row there.
- **Force class:** none. No force token.

### 7.2 Does it still apply?

**Yes, and nothing supersedes it.** #671 is one line — "smoky line-integral-convolution
vector render — a richer streamlines (BACKLOG)" — and `streamlines` still ships as the
only integral-curve view. #1123/#1124 do not touch rendering. #674 (Field Surfaces: scalar
overlays / contours) is an adjacent but distinct lane (scalar, not tangent).

The item is unaffected by the vNext program. Its obstacle is entirely internal and it is a
**bug on `main` today**, not a design question.

### 7.3 Recommendation: BUILD WITH CHANGES

Build it, in two PRs, in this order:

**PR 1 — fix `forceAt` purity (no LIC).** This is worth doing on its own merit, because
`streamlines` has the same bug at ~580 probes/frame today. `forceAt` runs every non-`field()`
force's real `apply()` against a **module-level shared probe** whose reset writes
`x, y, vx, vy, heat` — and **never clears `cap`**. Verified on `main`:

- `sink.apply` does `p.cap = b; b.accreted += 1; if (b.accreted >= b.capacity) e.supernova(b)`
  — a render probe moves a real body's accretion budget and can fire a supernova one
  particle early. Worse, the probe then stays captured **forever**, so every subsequent
  `sink`/`warp` probe **in every field on the page** is skipped.
- `diffuse.apply` and `memory.apply` call `g.deposit(p.x, p.y, …)` from the probe position —
  the render grid wears the memory/diffusion grids across the whole viewport.

So `mutatesPhysics: false` cannot honestly be written for LIC — or for `streamlines` — until
this is fixed. The fix is small (a fresh or fully-reset probe, or excluding state-writing
forces from the probe path) and it makes Invariant 1 true rather than asserted.

**PR 2 — LIC itself**, with four changes:

1. **Declare the field source.** `forceAt` returns `probe.vx + fxField` — a per-frame Δv
   from `apply()` **added to raw `field()` values in different units**. `bodyGravityField`
   has no `G`, no ε softening, no range cutoff and a `Q_GAIN` density gain, while
   `gravity.apply` is softened, range-culled and c-clamped. Kinematic forces
   (`jet`/`wall`/`lens`/`gate`/`warp`) *replace* velocity outright. The design must state
   which field LIC draws and accept that it is not "the net push."
2. **Prove the dial with a real observation.** Invariant 4 ("byte-identical by default;
   `licSeed: 2` differs") is **vacuous** with the cited #975 harness: the offscreen buffer's
   `putImageData` is a no-op stub and the main log serializes the blit as
   `drawImage([object Object], …)` for every seed. Assert on the pure kernel's
   `Float32Array`/`ImageData` instead — the `marchingCell`/`splatDensity` golden precedent.
3. **Decide `licCell` from a real profile before the Wallpaper Rule locks it.** The design
   fixes `licCell = 8` in the public surface while its own RISKS section says the default
   "should be 12 — decide from the browser-pane profile." Both cannot be true: the default
   *is* the API. And the cost model is understated — `field.ts` resamples **every frame**
   while a flow focus is live (`slSamples === null || flow || frameN % 3 === 0`), so at
   1280×960 / cell 8 that is 19,200 `forceAt` calls × bodies × tokens per frame against a
   physics step of ~130·density particles. The convolution estimate ("~460k lookups") is
   ~5× low; the real figure is ≈2.3M reads per resample.
4. **Specify the kernel exactly.** The proposed golden ("a uniform +x field ⇒ every row
   constant along x") is wrong — it gives the 1-D box filter of the noise row — and the
   kernel signature must fix the noise-lookup rule at fractional positions (`licStep` is
   0.5 cells), the boundary policy, and the behaviour at saddle points where bilinear
   interpolation of unit tangents stalls the walk.

### 7.4 Defects raised, and whether the design answers them

| Sev | Defect | Answered? |
|---|---|---|
| **Blocking** | "Render-only, mutates no engine state" is **false today** for any field containing `sink`, `memory`, `diffuse` or `collide`, and LIC multiplies the mutation ~33× (19,200 probes vs ~580). Verified on `main`. | **No** — and it is a *current* bug, not a new one. This is PR 1. |
| **Blocking** | The `potential` passport precondition is scope creep beyond #671 and contradicts #1123's "No public API/canon promotion" and #1111's governing rule. | **No.** See §3. Note the item itself correctly declares `potential` N/A, so dropping it costs #671 nothing. |
| Major | "WHAT IT IS" misstates the field: a mixed-unit superposition of `apply()` Δv and raw `field()` values, with magnetism's dipole B drawn as if it were a push direction (a still, neutral probe feels no Lorentz force). | **No.** Change 1 above. |
| Major | Invariant 4's "the dial is real" is unobservable with the cited harness. | **No.** Change 2. |
| Major | The passport-test rule fabricates reasons — a `{kind:'unsupported', reason:'designed'}` default would label `magnetism`, `thermal`, `diffuse`, `propagate` (all `truthMode: 'physical'`) and `memory` (`'semantic'`) as "designed", and the rule selects "kinematic rows" from a passport that has no `kinematic` field (it lives on the `Force` module). `thermal` is Langevin — "stochastic" is not even in the proposed reason union. | **No.** Moot once §3's precondition is dropped. |
| Major | Cost model wrong on two counts; `licCell` default locked before the profile that must decide it. | **No.** Change 3. |
| Minor | Kernel golden (a) is self-contradictory and under-specified (noise lookup at fractional positions, boundary policy, saddle-point stall, transpose golden needs square dims). | **No.** Change 4. |
| Minor | `truthMode: 'diagnostic'` has no declaration site for a render mode; the real surface is `VISUALIZATION_TRUTH_TABLE`, and `readsFrom` would honestly read "apply() probe + field()" with `mutatesPhysics` not `false` until PR 1 lands. | **No.** |
| Minor | Hard-coded mode counts outside `check:readme` are missed: `visualization-methods-taxonomy.md:65` "a **20-mode** catalog" and :70 "the eleven underlay modes"; `api-stability.md:96` "the 16 shipped render modes" is *already* stale on `main`. | **No.** |
| Minor | Relative scaling is not "exactly as streamlines does" — streamlines uses `sqrt(mag/slMaxSmoothed)` for both length and alpha; the design writes `relMag` undefined. | **No.** |
| Minor | "`forces-catalog.json` gains the field via `gen:force-catalog`" is false — the generator captures five row fields and drops anything else. | **No.** (Harmless once §3 is dropped.) |

**Kept, verified:** the vocabulary-site map is accurate and complete on the JS side
(`types.ts` render unions, the elements whitelist + `@attr` JSDoc → `check:cem`,
`docs-api.ts` rows, `RENDER_MODES` → `README.md:304` "20 render modes" via `check:readme`,
the passport `RenderMode` union as the parity-matrix vocabulary, the `lane-registry`
visualization lane); Swift's `switch frame.mode` is exhaustive with no `default` in both
`CoreGraphicsRenderer` and `MetalRenderer`, so the trailing Swift PR **must** carry a draw
branch or the package will not compile; keeping `'lic'` **out of** `recipes/schema.ts`
`RENDER_LAYERS` and `compile.ts` `MATTER_MODES` is correct (extending them would force both
ports' 64-recipe validation to change); seeded integer-hash noise with a declared `licSeed`
rather than `Math.random`/`env.rng`; the cached-`ImageData` + offscreen-canvas shape
following the heatmap precedent (and it should name `host.createCanvas` explicitly so
headless hosts keep working); the pure-kernel-in-`render-modes.ts` home with golden tests;
and "no golden/conformance impact" being genuinely true.

### 7.5 Gate cost

| Gate | Cost |
|---|---|
| "36 forces" count budget | **None.** No force token. This item never touches the brand fact. |
| passport ROWS + `validatePassports` | The `RenderMode` union gains `'lic'`, and `bestRenderModes` arrays may cite it (`passport.test.ts` only requires non-empty). No new ROW. |
| `SOURCE_TOKENS` | **None.** |
| Catalog counts in docs | `README.md:304` **20 → 21 render modes** (`check:readme`); `RENDER_MODES` +1 with a `visualization.test.ts` status rule; `visualization-methods-taxonomy.md` "20-mode" and "eleven underlay modes"; and `api-stability.md:96` should be corrected on the way past. |
| 120-case golden | **Zero — no engine code, no force formula.** `pnpm check:golden` clean. |
| Three-plane ceremony | **Deferred, honestly.** Adding `'lic'` to the passport `RenderMode` union makes `gen:parity-matrix` record ✗ for Swift and Kotlin — **a recorded gap is allowed; staleness is not**, so the regenerated `data/parity-matrix.json` must be committed or `check:docs` fails. When the ports follow: Swift needs `case lic` in the `RenderMode` enum (the only enum the matrix parses) **and** a branch in both exhaustive renderer switches; Kotlin needs the `LIC("lic")` form. The precedent already exists — `field-lines` and `heatmap` are JS-only today (JS 8 / Swift 7 / Kotlin 7). |
| Other | `render-reference-points-declared.test.ts` (#975) gains `'lic'`; `lane-registry` visualization-lane word; `VISUALIZATION_TRUTH_TABLE` row; `packages/elements` attribute surface; `docs-api.ts` rows. |

### 7.6 Regression posture

- **Default-OFF:** yes — an opt-in `render: 'lic'` value. No existing page changes. The
  `licCell`/`licLength`/`licStep`/`licSeed` defaults must reproduce a single declared design
  (the #975 Wallpaper Rule: every render mode byte-identical by default), which is why the
  `licCell` number has to be decided *before* the defaults ship, not after.
- **What the golden sees:** nothing. Correct — this is a renderer, and `check:golden` clean
  is the proof that it stayed one.
- **Reduced motion:** LIC replaces matter exactly like `streamlines`. Under
  `prefers-reduced-motion` a *static* LIC frame is arguably the **best** of all the render
  modes — it is a still image of field structure with no motion at all. That should be
  stated as a designed property and given a declared non-motion equivalent, not left
  implicit. One caveat: the per-frame resample while a flow focus is live must be
  suppressed, or "static" is a lie at 19,200 probes per frame.

---

## 8. Summary — what the gates cost, side by side

| Gate | #660 wormhole | #661–#664 + #658 | #708 linkage | #671 lic |
|---|---|---|---|---|
| "36 forces" count budget (`safety.test.ts`) | — | **36 → 39/40** | — | — |
| passport ROWS + `validatePassports` | — | **+3/+4 rows, new rule** | note edit | union +1 |
| `SOURCE_TOKENS` exact-equality | — | **+2 [S] tokens** | — | — |
| Catalog counts in current-truth docs | 8 → 9 presets | **6+ sites, CI-gated** | — | 20 → 21 modes |
| 120-case cross-plane golden | zero diff | zero diff *(unproven math)* | zero diff *(unproven math)* | zero diff |
| Three-plane ceremony | **none** | **full, ×3 (+Rust)** | ×2 (+Rust gap) | deferred, recorded |
| Default-OFF achievable | yes | yes | yes | yes |
| Blocking defects unanswered | **2** | **2** | **2** | **2** (one is a pre-existing bug) |

The pattern is worth naming: the two items recommended for build are the two that **do not
move the "36 forces" fact and do not demand a three-plane token ceremony**. The two
recommended against are the two whose *physics* failed review — not their cost. Cost made
the decision easy; it did not make the decision.

---

## 9. If these go ahead

1. **Drop the `potential` passport precondition from all four.** It belongs to #1123, after
   #1119/#1120, as an unexported experimental map. If it ships anywhere, it ships with the
   sign fixed.
2. **#671 PR 1: fix `forceAt` probe purity.** Independently valuable — `streamlines` has the
   bug today. Do this first regardless of whether LIC follows.
3. **#660:** settle the warp exit-side question with a moving-particle composite experiment
   (60 frames, `vx = −2`, two paired throats), then build the **canon** composition:
   `attract + warp ⟷ warp + repel`, throat 40, range 300, no `lens`. Preset table and
   scanner plumbing only; no engine code.
4. **#671 PR 2:** LIC, with the field source declared, the kernel fully specified, a real
   pixel-level golden, and `licCell` chosen from a browser-pane GPU profile.
5. **#708:** reframe the ticket. Record that the gain-term reading was examined and rejected
   with numbers; file the read-only `fluxLinkage` diagnostic as its successor. Port #711's
   `chargeGated` to Swift and Kotlin first.
6. **#658:** re-file against the real `env.dt ∈ [0.2, 2]`. The `MediumConfig` vocabulary is
   what #1124 wants; the `dt = 1` premise it was designed on is fiction.
7. **#661–#664:** hold. Revisit after #1123 defines what a trustworthy conservation
   declaration is, or after `Env.spawn` can report refusal. If one goes early, make it
   `fuse` alone — one [B] token, correct math, no source budget.

Every PR: against `main` (a non-main base gets no required checks), default-OFF,
`pnpm check:golden` showing zero diff, Kotlin-first where a port is touched, green PRs
handed over rather than auto-merged, and no tag or publish.
