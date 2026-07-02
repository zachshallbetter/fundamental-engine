# Changelog

All notable changes are documented here, following
[Keep a Changelog](https://keepachangelog.com) and [SemVer](https://semver.org).
The packages are published to npm under the `@fundamental-engine` scope; each release is also cut as
a git tag (see [RELEASING.md](RELEASING.md)).

## [Unreleased]

### Fixed

- **`@fundamental-engine/core`:** **keyboard focus now engages a `[data-hot]` body at mouse
  parity (#665, a11y).** Engagement bound `focus`/`blur`, which do not bubble — so when a keyboard
  user tabbed to a focusable *descendant* of a `[data-hot]` container (a card's `<a>`, a row's
  `<button>`, an `<li>`/`<aside>` wrapper), the container's body never engaged, while a mouse user
  got the reaction via `pointerenter`. Engagement now binds the bubbling `focusin`/`focusout`, so
  tabbing into (or out of) any focusable content inside a `[data-hot]` element drives the same
  engaged state — `data-active="1"`, `b.on`, wave-spine bend, `--d` gather — that hover produces
  (the RC-8 principle: keyboard users get the same field reactions as the mouse). A directly
  focusable `[data-hot]` element (a `[data-hot]` button/link) is unaffected — `focusin` still fires
  on it. Engagement only sets state; the integrator (which reduced-motion already freezes) drives the
  motion, so focus engagement is reduced-motion-safe by the same path hover is. DOM plane only — the
  native ports set engagement from the body model and have no DOM focus event. The speculative
  "tab order forms a current" half of #665 (a directional flow along the tab sequence) is deferred.

### Changed

- **`@fundamental-engine/core`:** **the RC-6 contract-coverage guard now guards body attributes**
  (`packages/core/src/contract-coverage.test.ts`, #323). The meta-test already asserted every public
  `FieldOptions` key and the readable metric surface are exercised by a test; it now adds the third leg
  of the RC-6 predicate — every documented body `data-*` attribute must be referenced by a test. The
  documented set is derived from the same `apps/site/src/lib/docs-api.ts` `ATTRS[]` surface `check:docs`
  treats as authoritative (so the two can't drift), and the attribute leg scans the package test corpus
  recursively (attribute coverage lives in sub-directory tests). Closed the coverage gaps this exposed
  with minimal `parseBodyParams`/`bodyFromElement` tests for `data-fmin`/`data-fmax`/`data-opsz`,
  `data-scale`, `data-charge-gated`, and `data-color`. Test-only; no runtime change.

### Deprecated

- **`@fundamental-engine/core` + `@fundamental-engine/platform`:** **documented sunset + dev-only
  deprecation warnings for the migration aliases (#709).** The `forces-ui → field-ui → Fundamental`
  rename left a few living aliases; they ship through RC1 and are **removed at `1.0`**. The
  runtime-observable ones now warn in dev (`NODE_ENV !== 'production'`), deduped so they warn at most
  once: (1) the `forces:*` capture/release/relocate **events** (mirror of `field:*`) warn once per event
  name at the dispatch site in core; (2) importing the **`@fundamental-engine/platform`** package (a thin
  re-export of `@fundamental-engine/dom`) warns once on import. The `--mass` CSS var (alias of `--load`)
  is doc-only — a CSS-var write is not interceptable from JS. **Kept permanently, NOT deprecated:**
  `--d`/`--field-density` (canonical dual density naming) and `--load`. The full policy is in
  [`docs/canonical/api-stability.md`](docs/canonical/api-stability.md) ("Deprecation & removal policy")
  and [`docs/canonical/deprecation-plan.md`](docs/canonical/deprecation-plan.md).

### Removed

- **Removed the historical `ROADMAP.md` and `BACKLOG.md` root docs.** The pre-1.0 refactor roadmap and the
  manually-maintained backlog lagged `main` and duplicated the RC1 board (user Project #24); planned work
  now lives on the board, and shipped work in `CHANGELOG.md` + per-version `docs/release-notes/`. Inbound
  references (docs, the catalog-count doc guard, the `llms` corpus generator) were updated accordingly.

### Added

- **`@fundamental-engine/core`:** **opt-in charge-gated `fieldflow` (#711).** A new body flag
  `data-charge-gated` restricts the `fieldflow` force to *charged* matter (`charge ≠ 0`), modelling
  magnetized plasma tied to the field line so it composes with `charge`; neutral matter drifts free.
  The default (flag unset) is unchanged — `fieldflow` still advects ALL matter (neutral-medium
  transport). Exposed on the body contract as `chargeGated` (parsed from `data-charge-gated`).

- **`@fundamental-engine/three`:** **`threeBackend` now renders `data`-overlay chip labels** — the
  backend's `text()` was a no-op (only the chip plates drew); it now draws each numeric label as a
  pooled `THREE.Sprite` carrying a per-string `CanvasTexture` (cached by label + color, so a steady
  overlay uploads no new textures). Sprites are pooled and hidden — not recreated — across frames, and
  `dispose()` frees the sprite materials + cached textures. Plate sizing (`measureText`) is unchanged;
  the line/rect overlays are untouched. (#391)

- **`@fundamental-engine/core` + `@fundamental-engine/elements`:** **lazy overlay-canvas creation (#676).**
  `<field-root>` no longer creates its full-viewport overlay canvas at boot — a mix-blend, full-viewport
  canvas costs a whole-screen re-blend every frame it's in the compositing tree, even empty (the DPR2 /
  mix-blend trap, #405). The element now hands core a new **`FieldOptions.overlayCanvasProvider`** (a
  `() => HTMLCanvasElement | null` factory) instead of an eager canvas; core calls it **once**, the first
  time an overlay reading actually goes active (a non-`off` `setOverlay`, or an `overlay=` set at mount),
  and never before. The common `overlay: off` page adds no overlay canvas to the DOM at all; toggling
  overlays off and on again reuses the one canvas (idempotent). Purely additive to the (unfrozen) options;
  underlay/render, reduced-motion, and signals-first behaviour are unchanged.

- **`@fundamental-engine/core`:** **agent permissions + redactions + snapshot profiles** — the scoped,
  read-only surface a **Software Agent** uses to read the field safely (the safety layer over the
  query/snapshot substrate; *agent-readable is not agent-writable*). `field.forAgent({ capabilities,
  redactions? })` returns an **`AgentFieldView`** facade exposing **only** scoped `query()` / `snapshot()`
  (and `replay()` **only** when `read:replay` is granted) — it has **no** mutation methods (no
  `applyForce` / `addBody` / `setPolicy`), enforced by the facade's shape. **`AgentCapability`**
  (`read:metrics | read:relationships | read:influences | read:snapshots | read:body-data |
  read:projections | read:diagnostics | read:replay`) is an allow-list: a dimension the caps don't grant
  is stripped from every reading (tightens, never widens — no `read:influences` → influences stripped; no
  `read:body-data` → `body.data` withheld even if a profile/`includeData` asked for it). **`redactions?:
  string[]`** strips dotted paths (`body.data`, `host.user`, `metrics.temperature`) after capability
  scoping. **Snapshot profiles** add **`FieldSnapshotOptions.profile`** (`'debug' | 'agent' | 'bug-report'
  | 'public'`) — concrete inclusion presets that **compose** with the explicit `include*` flags and the
  `FieldPolicy` privacy budget, always resolving to the **tightest (most private)** result; a profile or
  agent view can never widen past what policy allows. Respects `FieldPolicy`: a `budgets.agentRead === 0`
  closes the agent surface to the most-restricted view (the fractional `0 < agentRead < 1` gradient is a
  declared seam). Purely additive to the (unfrozen) handle + snapshot options; Swift/Kotlin ports are a
  batched follow-up.
- **`@fundamental-engine/core`:** **runtime FIELD POLICY + a FIELD BUDGET model.** A new `FieldPolicy`
  (`{ allowBodyDataInSnapshots?, allowMotionProjection?, maxMotionBudget?, budgets?: Partial<FieldBudgets> }`)
  expresses what THIS host/session/user/app **permits** at runtime — a distinct lane from governance
  (what doctrine *allows*, via static lint). `FieldBudgets` bounds consumable field resources
  (`motion`, `force`, `attention`, `thermal`, `render`, `privacy`, `accessibility`, `agentRead`). Set it
  at creation via `createField({ policy })` and live via `field.setPolicy(p)` (a **replace**, not a merge);
  read a frozen copy via `field.policy`. **Wired today:** the **motion budget** folds (via `min`) with
  host reduced-motion and performance pressure into a single effective motion allowance the
  integrator/easing path reads — reduced-motion **always wins** (accessibility can only *lower* motion,
  never raise it), and `maxMotionBudget: 0` behaves exactly as reduced-motion (frozen); the **privacy
  budget** (and `allowBodyDataInSnapshots`) gates body `data` in `snapshot()`. The remaining budgets are
  declared-not-yet-enforced (carried for host/tooling introspection, wired as their consumers land).
  Mirrored on `@fundamental-engine/vanilla` and `@fundamental-engine/three`. Purely additive — a field
  with no policy behaves exactly as before.

- **`@fundamental-engine/core`:** **`MinimalFieldHost` + a host capability model.** `MinimalFieldHost` is the
  smallest surface a host must supply — `root` + `viewport()` (geometry) and `raf()`/`cancelRaf()` (time).
  `FieldHost` now `extends MinimalFieldHost` with every other member (`scrollY`, `scrollHeight`,
  `reducedMotion`, `hidden`, `createCanvas`, `onResize`/`onScroll`/`onVisibility`/`onInput`/`onBodyEvent`)
  marked **optional**: absent capabilities degrade gracefully (scroll → 0, reduced-motion/hidden → `false`,
  subscriptions → no-op; a drawing mode needing `createCanvas` throws a clear error, `render: 'none'` never
  calls it), so a host with only the four required members runs the full simulation + feedback pipeline
  headlessly. New `hostCapabilities(host)` → `HostCapabilities` inspects which optional lanes a host provides
  (**host conformance** — the third parity category beside API-surface parity and mathematical conformance),
  and `defineHost(minimal & partial)` builds a full `FieldHost` with no-op subscription defaults. Purely
  additive and a **widening** of the (frozen) `FieldHost` type — every existing host (`browserHost`,
  `containerHost`, `headlessHost`, `threeHost`) still satisfies it unchanged. Swift/Kotlin ports follow.
- **`@fundamental-engine/core`:** first-class **body identity** — a stable, structured `FieldBodyIdentity`
  (`{ id, namespace?, kind?, host? }`) for every body, so `query`/`snapshot`/`diff`/`replay`/relationships
  reference bodies by identity instead of object reference or display text. Supply it via
  `addBody({ identity })` (a bare string is shorthand for `{ id }`) or the new `createField({ identify })`
  resolver (derives an identity from a DOM element); omitted ⇒ the engine derives a deterministic stable id
  (the element DOM id, else a monotonic `body-N` — never `Math.random`). The resolved identity is surfaced on
  `FieldBodyReading.identity` and `FieldBodySnapshot.identity`; the existing top-level `id` is unchanged
  (`identity.id === id`) and diff/replay continue to key on it. Purely additive. Swift/Kotlin ports follow.

## [0.9.2] — 2026-07-01

### Changed

- **`@fundamental-engine/core`:** the default `dprCap` stays **`2`** — an experimental drop to `1.5` was
  reverted after on-hardware benchmarking (`/perf-bench`) showed it gives no measurable fps benefit even in
  the mix-blend/compositing case, and the QualityGovernor already lowers DPR adaptively under real load.
- **Tests:** aggressive cross-surface integration coverage for the substrate API — new
  `substrate-api.test.ts` in `@fundamental-engine/{vanilla,three,elements,react}` (+47 tests)
  verifying `query`/`snapshot`/`diff`/`replay`/`projections` are reachable, correctly shaped, and
  delegate per surface (incl. the `<field-root>` before-start fallbacks the codex review flagged, and
  body-authority round-trips). Closes the surface-level coverage gap; no behavior change.

### Added

- **`@fundamental-engine/core`:** **Newtonian own-emission reaction** (substrate momentum, #873). New
  opt-in `reaction` option: a **dynamic** body feels the equal-and-opposite of the net impulse it imparts
  to nearby matter (`moveDynamicBodies` sums the body's own force over in-range particles and recoils by
  `-Σf · coeff / inertia`, capped) — so a directional emitter kicks back like a rocket, closing the
  reciprocity thesis through *motion*, not just feedback. Best paired with `mass` (recoil ÷ inertial
  mass, #872). Default false ⇒ byte-identical. Measured: a `stream` body recoils opposite its emission;
  off ⇒ no self-recoil. **Experimental.** Completes momentum (#871) with #872.


- **`@fundamental-engine/core`:** **first-class body inertial mass** (substrate momentum, #872). The
  existing `mass` option (§21.3, particle mass ∝ size) now also gives **dynamic bodies** an inertial mass
  ∝ rendered area (`Body.inertia = clamp(sqrt(area/ref), 0.4, 4)`), and `moveDynamicBodies` recoils by
  `a = F/(inertia ?? M)` — so a big heading settles slowly and overshoots while a small tag snaps. This
  also fixes a latent conflation: recoil previously scaled by the source mass `M` (force *strength*),
  which is backwards; it now uses real inertial mass when `mass` is on. `mass` off ⇒ `inertia` undefined
  ⇒ **byte-identical** (recoil falls back to `M`). Measured: under `mass`, a light body recoils >1.5× a
  heavy one. **Experimental.** The `sqrt`+clamp curve keeps typical masses near 1, minimizing recipe churn.


- **`@fundamental-engine/core`:** **coupling passports + the `field/no-dimension-coupling-without-passport`
  lint** (substrate governance 05, roadmap 6). `ForcePassport` gains `couplesDimensions?: readonly
  string[]` — the dimensions a force cross-links. `lintDimensionCoupling()` reports any force that
  *conserves speed* (so it necessarily redirects velocity — a dimension coupling) yet declares none, plus
  any declared dimension that is not a known lane. The three speed-conserving forces (`wall`, `magnetism`,
  `warp`) now declare `couplesDimensions: ['linear']`, so the lint returns `[]` — it guards future drift.
  Additive, behavior-preserving. **Experimental.** *Design call flagged for review: the coupling rule
  keys off `conservesSpeed` (unarguable) and the declared vocabulary is minimal (`['linear']`); a richer
  per-force coupling map (e.g. `linear→angular` for a torque force) is a follow-up.*


- **`@fundamental-engine/core`:** **semantic accumulator lane** (substrate doc 04 §Step 6, roadmap 3).
  `applyAndRecord` now annotates a force's contribution with the body's conserved-attention multiplier
  in effect (`Body.attn`, which scales the body's effective force strength) into `acc.semantic.attention`
  with a `{ channel: 'semantic' }` attribution — "this force's influence here was attention-scaled to X".
  Only when attention is active (`attn` defined and ≠ 1), so the neutral field is byte-identical.
  Capture-only / behavior-preserving (identical Δv with the accumulator on vs off). `confidence`/`memory`
  remain reserved. **Experimental.**

- **`@fundamental-engine/core`:** **temporal accumulator lane** (substrate doc 04 §Step 6, roadmap 2).
  `applyAndRecord` now captures a per-force change in `Particle.age` (frames-to-live, for *mortal*
  matter) into `acc.temporal.decay` with a `{ channel: 'temporal' }` attribution — "which force aged /
  extended this particle's life here". Immortal particles (no `age`) never engage the lane, so the
  default conserved field is byte-identical. Capture-only / behavior-preserving (the force's age
  mutation is its own; recording the delta changes nothing). `delay`/`phase` remain reserved.
  **Experimental.**

- **`@fundamental-engine/core`:** **word→lane registry + the `field/no-word-in-two-lanes` lint**
  (substrate governance 05 — the governance module names this as a planned rule). `LANE_WORDS` indexes
  the engine's shipped vocabulary by lane straight from the source-of-truth catalogs (`force` = the 36
  tokens, `formation` = the 5 field-shape modes, `condition` = the data-when keywords, `visualization`
  = the 16 render+diagnostic modes); `laneOf(word)` resolves a word; `lintWordLanes()` reports any word
  in two lanes. With the shipped catalogs it returns `[]` — the canon's "no word lives in two lanes"
  holds — so the lint's job is to guard future drift. **Experimental.** *Design calls (flagged for
  review): `render`/`diagnostic` are merged into one `visualization` lane (no clean catalog boundary),
  and `metric` is not yet a lane (no single metric-name catalog).*


- **`@fundamental-engine/core`:** **performance suite** (`packages/core/bench/`) — a deterministic,
  pure-Node benchmark of the engine's *algorithmic* cost: full-frame scaling vs particle count, the
  opt-in accumulator capture overhead, `query()`/`snapshot()` read cost, and the every-6th-frame
  body-measure cadence. Run with `pnpm --filter @fundamental-engine/core bench`. Tooling only — not
  shipped in `dist`, no engine behavior change. Reads alongside the new
  [`docs/engine-reference/performance.md`](docs/engine-reference/performance.md), which documents why the
  field is fill-rate-bound (GPU, measured on hardware) rather than particle-bound (the math measured here).


- **`@fundamental-engine/core`:** **query lenses** (substrate query phase 2, roadmap 8/10). A `FieldLens`
  is a user-defined declarative scope over a query reading — NOT an opinionated preset catalog: the
  caller supplies it. Each clause is an allow-list (`metrics` keys, influence `channels`, body `tokens`;
  an omitted clause keeps everything in that dimension). `field.query({ lens })` scopes the live answer
  and tags it with `lens.id`; the standalone `applyLens(result, lens)` is exported and **pure** (returns
  a new result, never mutates), so a lens composes over any `FieldQueryResult`. The query *time-window*
  (interpreting a past moment) is served by the existing `snapshot()`/`diff()`/`replay()` trio rather
  than a new in-engine history buffer. Additive; behavior-preserving. **Experimental.**


- **`@fundamental-engine/core`:** **projection write-phase auto-apply + the `agent-json` surface**
  (substrate doc 05, roadmap 9/10). `ProjectionRegistry.bind(id, target, source)` ties a registered
  projection to a target + a live `ProjectionSource` (`() => Record<string, number>`); the field
  re-applies it once per write phase (right after feedback), read-only w.r.t. the field — a projection
  still never moves matter. Returns an unbind fn; multiple bindings coexist; binding an unknown id is
  inert. New `agentJsonProjection(id, channels, opts?)` + `agentJsonTarget()` give an agent/tooling
  surface whose output is a serializable reading (`value()` / `json()`) rather than a visual write.
  Additive; behavior-preserving (a bound projection does not perturb the simulation). **Experimental.**


- **`@fundamental-engine/core`:** **angular accumulator lane + particle orientation** (substrate doc 04
  §Step 6). Opt-in `Particle.orient?` (angle, radians) + `spin?` (angular velocity) — undefined ⇒ inert,
  byte-identical to the spin-less engine (the z-lane discipline). When a force gives a particle `spin`,
  `applyAndRecord` captures the Δspin into `acc.angular.z` with a `{ channel: 'angular' }` attribution,
  and the integrator advances `orient += spin·dt` (damped by `FRICTION`) — only when `spin` is defined.
  Behavior-preserving; the default field never gains orientation. **Experimental.** (A public `torque`
  force that drives spin is a follow-up; the lane + capture + integrate ship here.)


- **`@fundamental-engine/core`:** **Causal Replay force attribution** (substrate critical-path 03 ph2
  + doc 04 §Step 6). `snapshot({ includeInfluences })` now captures per-body force attribution (each
  body's forces sampled just off its centre, by channel — linear Δv + thermal), and `replay(a, b)`
  derives **`cause: 'force'`** steps from how those shift between two captures — e.g. "Force attract on
  claim-3 grew 0.12→0.30", "Force attract on B released 0.20→0". Ties the substrate together
  (accumulator → snapshot → replay), incl. the thermal lane. `FieldSnapshot.influences` +
  `FieldSnapshotOptions.includeInfluences`. **Experimental.**


- **`@fundamental-engine/core`:** **accumulator thermal channel** (substrate doc 04 §Step 6). The
  per-force capture path (`applyAndRecord`) now also records each force's **heat** change, populating
  the accumulator's reserved `thermal` lane and emitting `{ channel: 'thermal' }` attribution — so
  `accumulateAt`/`query().influences` answer "which force *heated* matter here", not only "which moved
  it". `FieldInfluenceReading` gains an optional `channel` field (defaults to `'linear'`). Capture-only
  and behavior-preserving (the default no-accumulator hot path is untouched); `causalityAt` stays the
  linear motion lane. **Experimental.** (The angular/temporal/semantic lanes remain reserved.)
- **`@fundamental-engine/core`:** **governance lint** (substrate critical-path 05 phase 2). The
  `ProjectionRegistry` gains `lint()` and the standalone `lintProjections(projections)` is exported —
  pure accessibility-governance checks over registered projections: `field/reduced-motion-equivalent-required`
  (a motion-capable projection with no `reducedMotionEquivalent` → **error**, an accessibility-contract
  violation) and `field/accessibility-equivalent-required` (no `accessibilityEquivalent` → **warning**).
  New `GovernanceWarning` type. Rides every surface via `field.projections.lint()`. **Experimental** —
  the lane-separation / coupling-passport / relationship-as-force rules are a later step.


- **`@fundamental-engine/core`:** **Projection Registry** — `field.projections` (substrate
  critical-path 05). Register named **projections** that map field *state* to an output surface (CSS,
  dom-attribute, annotation, agent-json, reduced-motion, sound, haptic, native, spatial, …), each
  declaring its `channels`, `surfaces`, and `reducedMotionEquivalent`/`accessibilityEquivalent`.
  `register(p)` (→ unregister fn) / `unregister(id)` / `get(id)` / `list()` (serializable metadata) /
  `apply(id, reading, target)`. **Governance principle: a projection reveals state, it never changes
  it** (no forces) — accessibility is an alternate projection, not a fallback. `query()`/`snapshot()`
  now report the registered projections. New `FieldProjection`, `FieldProjectionInfo`,
  `FieldProjectionSurface`, `FieldProjectionTarget`, `ProjectionRegistry` types. On every surface.
  **Experimental** — governance lint rules + write-phase auto-apply are later steps.
- **`@fundamental-engine/core`:** **Causal Replay** — `field.replay(a, b, opts?)` (substrate
  critical-path 03 phase 2). Explains *how* the field changed between two snapshots: an ordered,
  narrated sequence of causes (formation activations, relationship shifts, body entries/exits, metric
  movements) derived from the diff, each carrying its before/after `contribution` — e.g. "Formation
  'wells' activated", "Relationship A→B (supports) became active, strengthened 0.10→0.40", "Body
  claim-3 density rose 0.20→0.60". `opts.focus` scopes it to one body. Pure (derived from the two
  snapshots); the standalone `replayFieldSnapshots(a, b, opts)` is also exported. New `CausalReplay`,
  `CausalReplayStep`, `CausalCause`, `ReplayOptions` types. On every surface. **Experimental.**
- **`@fundamental-engine/core`:** **dynamic bodies + recoil** (substrate doc 04 §Step 5). A body with
  `authority: 'dynamic'` now has its position **owned by the engine**: each frame it integrates under
  the net field the other bodies create at its centre (`a = F/M`, lightly damped + speed-capped) and
  writes the result back to its centre — so the source moves in response to the field (the reciprocity
  thesis: bodies bend the field; the field bends them back). Reported through `query()`/`snapshot()`
  position. Opt-in and behavior-preserving: anchored (default) and kinematic bodies are untouched, so
  fields with no `dynamic` body run identically. (Literal momentum-recoil from a body's *own* emission
  is a later refinement; this is the field-to-body coupling.)

- **`@fundamental-engine/core`:** opt-in fixed-timestep integrator (substrate doc 04 §Step 3). A new
  `integrator: 'fixed'` field option (default `'legacy'`) makes the per-step decays frame-rate
  independent — `FRICTION`/`HEAT_DECAY` scale with `dt` (`FRICTION^dt`). At the reference frame rate
  (`dt === 1`, and every golden/conformance run) it is byte-identical to the shipped semi-implicit
  Euler, so opting in never moves the golden. New `IntegratorMode` type and `Env.integrator` channel;
  the option is forwarded through `<field-root>`, `<FieldField>`/`useFieldField`, and vanilla.
  (Frame-rate-correct force *impulses* — which require pair forces like `collide` to contribute their
  `q` leg through the accumulator — land with the later force-contract change.)
- **`@fundamental-engine/core`:** **body-authority modes** (substrate doc 04 §Step 4). A body can now
  declare who owns its position via `data-authority` / `BodySpec.authority` / `Body.authority`:
  `anchored` (default — the DOM/host rect is authoritative, today's behavior), `kinematic` (the engine
  writes the visual transform; the shipped `data-move` pattern), or `dynamic` (the engine owns
  position/velocity — **declared but not yet physically simulated**; Step 5 wires recoil/torque onto
  it). Reported in `query()` and `snapshot()` body readings. New `BodyAuthority` type. Behavior-
  preserving — a declaration only; anchored/kinematic behave exactly as before.
- **`@fundamental-engine/core`:** **Field Snapshot + Diff (MVP)** — `field.snapshot(opts?)` and
  `field.diff(a, b)` (substrate critical-path 03). A snapshot captures *what the field is doing* at a
  frame — a portable, versioned, serializable `FieldSnapshot` (bodies with rect/position/tokens/
  metrics/dimensions, relationships, active formations, field metrics; optional particles/data) — vs a
  screenshot of what it looked like. `diff` compares two snapshots and reports body / relationship /
  metric / formation changes; the pure `diffFieldSnapshots(a, b)` is also exported. Read-only, works
  headless, privacy-preserving by default (`includeData` opt-in). New types `FieldSnapshot`,
  `FieldSnapshotOptions`, `FieldBodySnapshot`, `FieldParticleSnapshot`, `FieldDiff`, `BodyChange`,
  `RelationshipChange`, `MetricChange`, `FormationChange`. On every surface (`<field-root>`,
  React/element handles, vanilla, three). **Experimental** — not in the frozen surface. (Causal Replay
  is the next step.)

- **`@fundamental-engine/core`:** **Field Query API (MVP)** — `field.query(q?)` (substrate critical-path
  02). A read-only, render-agnostic way to ask the live field a structured question — a point
  (`{x, y}` + `radius`), a `DOMRect`-shaped rect, or the whole field — and get back plain, serializable
  data: `bodies` (id, rect, tokens, metrics, dimensions, active formation), `metrics`, `relationships`
  (the edge graph by id), and `influences` (per-force Δv at the point, from the impulse accumulator).
  Works headless; never mutates state. New types `FieldQuery`, `FieldQueryResult`, `FieldBodyReading`,
  `FieldRelationshipReading`, `FieldInfluenceReading`, `FieldQueryInclude`, plus `FieldRect`/`Vec3`. The
  method is exposed on every surface (`<field-root>`, `<FieldField>`/`useFieldField`, vanilla, three).
  **Experimental** — not yet part of the frozen API surface.

- **`@fundamental-engine/core`:** dimension-aware impulse accumulator (substrate critical path). An
  opt-in `Env.accum` (`FieldImpulseAccumulator`) lets a diagnostic or query probe read each force's
  per-particle contribution — a net `linear` channel plus per-force attribution — captured centrally
  by the integrator without changing the integration math. The default hot path is byte-identical
  (`accum` absent); the public API surface is unchanged.
- **`@fundamental-engine/core`:** `applyAndRecord` (the single force-capture path) and `accumulateAt`
  — the net + per-force attribution at a point. `causalityAt` now reads the accumulator. Additive and
  behavior-identical.
- **`@fundamental-engine/core`:** `forceVectorAt` reads the accumulator via `applyAndRecord`, so the
  force-vectors overlay, causality, and prediction share one capture path. Behavior-identical.

### Fixed

- **`@fundamental-engine/dom`:** `apply-recipe.ts` no longer overwrites `--field-density` when
  applying a recipe's metric pipeline. The `density` CSS variable is now excluded from the recipe
  `varMap` so the engine's live density signal (`--field-density`) is preserved across recipe changes.

## [0.9.1] - 2026-06-27

### Added

- **Root `Package.swift` for Swift Package Manager.** Adds a `Package.swift` at the repository root
  so `https://github.com/zachshallbetter/fundamental-engine` can be used as a remote SPM reference
  without a subdirectory path. Exports `FundamentalCore`, `FundamentalPlatform`, `FundamentalVanilla`,
  and `FundamentalSwiftUI` — sources live in `swift/Sources/` and are unchanged.

## [0.9.0] - 2026-06-27

The Android/Kotlin port reaches Swift/JS parity, Consumer DX & API additions land, the
testing/QA spine fills out, and the research family doubles. All package API changes are
additive (the frozen surface is intact).

### Internal

- **Frame-driving test harness for element consumers + capture/release events (core test-support).** A
  new `frameHarness` (`packages/core/src/core/frame-harness.ts`) drives the *real* `field.ts` frame loop
  frame-by-frame on a deterministic `dt` + seeded `rng`, over a hand-rolled (DOM-free) element scan root.
  It closes the long-standing gap where PR #260's per-frame element wiring — `[data-move]` movers,
  `[data-dock]` collapse, `[data-warp]` relocate, `[data-emit]` cloning, and the `field:captured` /
  `field:released` / `field:relocated` dispatch — never ran under the only `createField` stub (a `raf`
  that never fired + an empty `querySelectorAll`). Adds `frame-harness.test.ts` asserting the
  capture → hold → release sequence (both the gated-discharge and saturating-supernova paths), warp
  relocate, and element emit (cap + a11y + teardown). Closes #704.
- **Property-based fuzz test for the integrator (core test).** `packages/core/src/core/fuzz.test.ts`
  generates random-but-valid field configs (bodies, the canonical force set, formation/env params within
  documented ranges) from a seeded LCG and steps each many ticks, asserting the engine invariants hold
  across the space: particle COUNT is conserved (the one strong invariant), no NaN/Infinity ever appears
  in positions/velocities, and values stay finite and bounded (speed ≤ `env.c`, position within the wrap
  halo). Deterministic — every case reproduces from its seed. Closes #691.
- **Catalog-count doc-drift guard (core test).** A new conformance test derives the force count from the
  catalog (`MANUAL_FORCES`) and fails CI if any current-truth doc (canonical, engine-reference, ROADMAP,
  BACKLOG, CLAUDE, README) states a different total — catching the recurring force-count drift by hand.
  Closes #710.
- **Silent-contract-gap CI report.** `scripts/check-silent-contract.mjs` (`pnpm check:contract-gap`) runs
  `lintPlatform`'s silent-contract-gap detection (the canonical rule bodies, lifted from the built
  `@fundamental-engine/dom`) over the built site pages in headless Chromium and emits a per-page,
  per-code count. A new advisory `silent-contract-gap` job in `pr-checks.yml` diffs base vs head and
  surfaces any NEW gap a PR introduces (a `[data-feedback]` body whose `--field-*` channel no CSS rule
  reads). Report-only for now (`--fail-on-new` flips it to a hard gate). Closes #717.

### Docs

- **Documentation synced to 0.8.1.** Repo-wide doc-correctness pass: removed the stale `--forces-*`
  CSS-variable auto-mirroring claim (the mirroring was removed; only `forces:*` event aliases remain),
  marked all shipped-in-0.8.1 APIs as shipped, fixed force/render-mode/adapter counts, and corrected a
  stale comment in `packages/three/src/index.ts` (both `PlaneProjection` and `VolumeProjection` ship).

### Added
- **Reserved agent-threshold events now dispatched (`@fundamental-engine/core`, FACM).** The
  previously reserved `field:*` agent-threshold events fire as a body crosses a metric level —
  hysteretic + debounced via the shared `Thresholder`, never per-frame: `field:saturated` (a sink
  hit capacity, fired from the saturation transition; `field:released` is its paired down-edge),
  `field:entered`/`field:exited` (the body's own gathered density crossing 0.6/0.2 — distinct from
  `field:lit`/`field:dim`, which carry the neighbour-spillover lit channel),
  `field:attention-shifted`/`field:attention-settled` (conserved-attention multiplier, when attention
  is on), `field:entropy-warning`/`field:entropy-cleared` (measured local entropy), and
  `field:memory-threshold`/`field:memory-faded` (an `addEdge` relationship's `memory`, on the source
  body's element). DOM CustomEvents on the same channel as the existing `field:lit`/`field:captured`
  family — DOM/consumer-plane only, no Swift/Android port mirror needed (the ports have no DOM event
  bus). `field:relationship-strengthened` stays reserved (the designed dynamics rarely cross a fixed
  level cleanly). Additive. Closes #686.
- **Element trigger class-toggle via `data-class` (`@fundamental-engine/core`, FACM).** The last
  still-planned FACM element-influence cell. `data-class="dense:lit, captured:full"` adds a class to
  the element while a trigger holds and removes it when the trigger releases — the same
  `trigger:value` grammar `data-on` uses (`dense`/`sparse`/`engaged`/`captured`), but the value is a
  class name toggled on the element instead of a `CustomEvent` dispatched. Opt-in by attribute (never
  touches existing content), idempotent, and the declarative no-JS counterpart of a `data-on` handler
  calling `classList.toggle`. DOM/consumer-plane only — no port mirror needed. Additive. Closes #687.
- **Per-frame coalescing of discrete field events (`@fundamental-engine/core`).** `FieldHandle.on(...)`
  occurrences (`absorb`/`release`/`enter`/`exit`/`met`) now batch to at most ONE delivery per
  `(source, type)` per frame instead of firing per detection pass. Emissions are buffered during the
  frame and flushed once at frame end (last-wins payload — a consumer sees the final state for that
  frame); a same-frame fill+release or a doubly-raised edge no longer delivers duplicates within a
  tick. State events (`absorb`/`release`) key on the source element; relational events
  (`enter`/`exit`/`met`) key on the counterparty pair, so distinct pairs in one frame stay distinct.
  Behaviour-preserving for listeners that just react to "it happened." DOM-plane only — no Swift/Android
  port mirror needed (the ports have no discrete event bus). Closes #684.
- **Typed `--field-density` / `--d` via `CSS.registerProperty` (dom).** `browserHost()` now registers the
  field-density channels (`--field-density` and its compact alias `--d`) as typed `<number>` custom
  properties (`inherits: true`, `initialValue: '0'`) once at boot, so consumers can transition/animate
  `var(--field-density)`/`var(--d)` on the compositor instead of getting an all-or-nothing swap. New
  `registerFieldProperties()` (`packages/dom/src/register-properties.ts`) is feature-detected,
  idempotent, and a graceful no-op where `CSS.registerProperty` is unavailable or the property is
  already registered. DOM-plane only — no Swift/Android port mirror needed. Closes #677.
- **`textBodies({ observe })` — opt-in ResizeObserver re-annotation (`@fundamental-engine/dom`).** The
  boundary spans `textBodies()` emits are a one-time layout snapshot; callers re-annotated on resize by
  hand. The new `observe` option (`true`, or a debounce in ms — default `100`) wires a debounced
  `ResizeObserver` on the source inside `annotate()`: each resize disposes the previous spans and
  re-measures fresh boxes, so the boundary tracks the reflowed text. Default behavior is unchanged
  (opt-in), it's silently skipped where `ResizeObserver` is unavailable (SSR / older runtimes), and the
  observer is torn down by the same disposer `annotate()` returns. DOM-plane only — no Swift/Android port
  mirror needed. Closes #713.
- **Android port — ParticleShape, visual-snapshot gate, path-aware CI (`android/` + CI).** The final
  follow-ups. **`ParticleShape`** (core): dot / star / polygon / custom unit-vector stamps the host scales
  per particle by size + heat — ported from Swift, wired into the FieldLab renderer + a Shape inspector
  picker (4 tests). **Visual-snapshot signature** (`Snapshotter`, lab): a perceptual luminance-grid +
  lit-fraction + centroid fingerprint with a stability/structure gate (3 tests) — the headless visual
  regression model. **Path-aware CI**: `ci.yml` gains a `changes` filter so android/docs/swift-only PRs
  skip the JS gate + e2e (the required `conclusion` treats skipped deps as satisfied), ending the
  e2e-flake-rerun dance; `android.yml` adds an advisory on-emulator smoke job (sample install + launch +
  no-crash) on pushes to main. Core 92 + platform 28 + lab 5 JVM tests.
- **Android port reaches full parity — core + platform + both hosts + the lab (`android/`).** Four epochs
  on `android-waves` close the gap to the Swift port: the Kotlin port now mirrors `FundamentalCore`,
  `FundamentalPlatform`, both hosts (the imperative `UIKitFieldHost` analog + the Compose adapter), and the
  FieldLab.
  - **Relationship edges — `addEdge` / `readEdges` (core).** The last `FieldHandle` capability: directed
    edges between two programmatic bodies, with per-tick dynamics ported line-for-line from
    `FieldEngine.swift` — strength climbs while the source body is salient (`d > 0.08`), decays idle, and
    `memory` accretes and holds; removing either endpoint drops the edge. `EdgeRecord` snapshots carry the
    endpoints' data + `type` / `strength` / `memory` / `active` / direction, the relationship layer the way
    `readParticles` is the swarm. Completes the Kotlin `FieldHandle` / `FundamentalCore` surface. 2 new JVM
    tests (**85 core total**).
  - **`:fundamental-platform` — the host-agnostic platform layer (mirror of Swift `FundamentalPlatform`).**
    The **six-phase `FrameScheduler`** (`discover→read→compute→state→write→render`, with the read-phase guard
    + violation recording), the six **registries** (`MeasurementRegistry` with frame-stable geometry +
    visibility, `StateRegistry`, `FeedbackRegistry`, `RelationshipRegistry`, `VisualBindingRegistry`,
    `OverlayRegistry`), the **`FieldPlatform`** coordinator (wires `read→measure`, `write→flush`), and the
    `QualityGovernor` / `FieldPerf` budget governors. The platform seam — `FieldHost` / `FieldVolume` /
    `FieldProjection` — moves into core (Android-free). Pure `kotlin("jvm")`, JVM-tested
    (`FrameSchedulerTests`, `FieldPlatformTests`; **10 platform tests**).
  - **`:fundamental-android` — the imperative non-Compose host (mirror of `UIKitFieldHost`).** A `View` /
    `Canvas` host for non-Compose apps: `FieldFieldView` (a custom `android.view.View` that owns a
    `FieldController`, drives it from the `Choreographer`, draws the pool in `onDraw`, tap-to-burst) +
    `AndroidFieldHost` (the core `FieldHost` impl — volume / visibility / reduced-motion, the `Choreographer`
    frame loop, `worldBox` via `getLocationOnScreen`). **Verified to assemble against the Android SDK**; the
    on-device E2E pass is a follow-up (the Compose host + sample remain the on-device-verified path).
  - **FieldLab desktop parity (`android/lab`).** Completes the desktop FieldLab to full parity with the
    Swift lab: **recipe save/export** (`RecipeExport` round-trips a scene's `@Serializable FieldRecipe` back
    to the canon JSON shape) and the final two overlay readings — **`path` traces** (per-particle position
    history) and per-body **`data` rings** (the eased density `--d` as a fill ring). All eight readings now
    work; `:lab` gains a `kotlinx-serialization-json` dep for export.

- **Record / replay foundation — `recordRun` / `replayRun` / `verifyReplay` / `seededRng` (core).** A
  pure, headless capture-and-reproduce seam (#692): `recordRun(config)` drives a deterministic
  (seeded-rng + lockstep wall clock) field on a `headlessHost` and captures each frame's particle state
  via the `readParticles` wire format (`PARTICLE_STRIDE` / `PARTICLE_WIRE_VERSION`) into one compact
  `Float32Array`; `replayRun` re-runs the same config to reproduce it bit-for-bit; `verifyReplay`
  compares a replay against a recording; `frameAt` slices one frame back out. `seededRng(seed)` is the
  small mulberry32 generator the seam stands on (the engine's injectable `rng`). Foundational slice:
  per-frame particle positions/heat/size + seed + config are captured and proven to replay identically;
  an input timeline (interleaved `burst`/`flowTo`/formation calls), programmatic-body configs, and an
  on-disk serialization format are deferred. JS-only; a Swift/Android mirror would be a follow-up.
- **`createFieldPerf` LoAF / long-task lane (dom).** Opt in with `createFieldPerf({ loaf: true })` and the
  meter attaches a feature-detected `PerformanceObserver` (`long-animation-frame`, falling back to
  `longtask`), surfacing `loafCount` and `tbtMs` (Total Blocking Time, `Σ max(0, duration − 50)`) on the
  same `snapshot()` — so consumers see the main-thread stalls the field contends with. Graceful no-op where
  unsupported; off by default (the meter stays pure without it). `dispose()` disconnects the observer.
  Additive to the unfrozen `FieldPerfOptions` / `FieldPerfSnapshot` / `FieldPerf`. Closes #714.
- **`feedback-never-written` lint + `FeedbackRegistry.feedbackActivity()` (dom).** The runtime half of
  the silent-contract-gap detector: `lintFeedbackNeverWritten` warns when a `[data-feedback]` body has
  been bound for many frames (`FEEDBACK_NEVER_WRITTEN_FRAMES`, default 120) yet never once received a
  non-zero value — the reciprocal loop is inert even though the CSS consumer may be wired correctly. It
  reads new per-element activity (`feedbackActivity()`) that `flush()` accumulates. Complements the
  existing CSS-side `feedback-writes-unread` (body written but no rule reads it). Dev-only via `lintPlatform`.
- **Single-file (vendorable) build for the no-bundler consumer (vanilla).** `@fundamental-engine/vanilla`
  now ships two pre-bundled, fully self-contained artifacts so a consumer can drop in one `<script>` with
  no bundler and no import map: `dist/standalone.js` (bundled ESM, `import { createField } from
  '.../standalone.js'`) and `dist/standalone.global.js` (IIFE exposing a `Fundamental` global). Both inline
  the `vanilla→dom→core` graph (no bare `@fundamental-engine/*` imports), are produced by `pnpm --filter
  @fundamental-engine/vanilla build:standalone` (also part of the package `build`), and are size-checked in
  `check:dist`. Closes #585.
- **Wire-format contract — `PARTICLE_STRIDE` (5) and `PARTICLE_WIRE_VERSION` (0) (core).** Typed
  constants documenting the `readParticles()` buffer layout so renderers can assert the contract rather
  than embedding the magic number.
- **`readParticleChannels(channels, out)` (core).** Column-wise multi-channel particle read into
  caller-owned `Float32Array` buffers — avoids repeated full-stride copies when a consumer needs only
  position or heat.
- **`registerOverlay(name, drawFn)` (core).** Register a custom named overlay into the existing
  `setOverlay` stack; returns an unregister function for clean teardown.
- **`FIELD_VERSION` re-exported from the adapter doors (vanilla / react / elements).** The
  engine-version constant is now a named export off each authoring door, not core-only — a missing
  named import aborts the whole consuming ES module, so `import { FIELD_VERSION } from
  '@fundamental-engine/vanilla'` (and react / elements) now resolves, equal to `field.version` on the
  handle. Added to the frozen API surface. Closes #584.
- **`useForcesData(records, mapper, options)` React hook (react).** The React wrapper for `bindData()`
  — attach the returned `containerRef` to a host element and the hook drives a live field from React
  state, doing record → body diffing (entering/decaying rather than popping) on every `records` change.
  Returns `{ containerRef, bindingRef, inspect }`; the bindData mapper/option/inspection types are
  re-exported alongside it. Closes #698.
- **Off-main-thread render (C3) — Worker + OffscreenCanvas (dom).** `attachOffthreadRender(field, canvas)`
  transfers a canvas to a dedicated Worker and drives particle rendering off the main thread via
  `readParticles()` + postMessage each frame. Falls back gracefully on browsers without
  `OffscreenCanvas`. The main-thread render path is completely untouched — this is an additive opt-in.
- **Auto-update-branch CI** — a new `auto-update-branch.yml` workflow fires on every push to main
  and calls `gh pr update-branch` on all open PRs that are BEHIND or DIRTY, eliminating the manual
  update-branch cycle that stalls parallel agent PRs in the strict merge queue.
- **Swift Apple-platform CI** (`swift-apple-platforms.yml`) — builds and tests the Swift port on
  iOS Simulator (Xcode xcodebuild, `iPhone 16` destination) and builds for visionOS Simulator,
  filling the gap left by the macOS-only swift workflow (UIKit host is iOS-only).
- **Android port — carrier waves + the bound↔free reservoir (§24/§2.4) (`android/`).** Ported the
  remaining `Currents` (`buildWaves` — the five layered standing currents — + `buildBound` + `BoundParticle`)
  and `Reservoir` (`healWaves`/`tearBoundNear`/`tearBoundByForces`/`induceCharges`; the Reservoir draft was
  produced by a sub-agent and reviewed line-by-line). Wired into the driver behind a `wavesEnabled` toggle:
  free matter drifts along the wave slopes (the integrator's existing wave block), the bound shimmer pool
  rides the lines, and `healWaves`/`tearBoundByForces` exchange matter between free and bound — the free +
  bound count is invariant. `induceCharges` runs each frame (charge bodies polarize nearby matter into
  +/- domains, so charge/magnetism act automatically). FieldHandle `setWaves`; the FieldLab gained a
  Carrier-waves toggle + wave/shimmer rendering. 4 new JVM tests (81 core total): five layered waves,
  shimmer count, charge polarization, and reservoir conservation. Headless `overlay-waves.png` shows the
  five currents with 160 shimmer riders. Advances #644 / #645.
- **Android port — reactions & sparks (§23) (`android/`).** Ported the micro-reaction layer
  (`Reactions` + a host-agnostic `SparkPool`): `energyDelta`, `reactionIntensity`, `burstImpulse`,
  `captureEdge`, and the conserved sink-release `releaseCaptured` (ejects held matter past the absorb
  horizon, made immortal — a real fill→explode→fall-back cycle). The driver wires `env.spark` to the
  capped pool (wall impacts + the sink supernova flash emit sparks), updates/decays it each frame, and
  exposes `controller.sparks`; the lab draws them. 6 new JVM tests (77 core total): energy loss, burst
  falloff, spark emit/decay/cap, conserved release, the capture edge, and sparks-on-wall-impact through
  the engine. Headless `overlay-sparks.png` shows sparks firing on all four wall faces. Advances #646.
- **Android port — Body-Matter-Interaction: attention, causality, heatmap (`android/`).** The model's
  conserved truths, ported (`Attention`/`Causality`/`Heatmap`) and wired into the driver as toggles:
  **conserved attention** (one strength budget — engaging a body drains the others, Σ S·mul invariant —
  fed into the integrator's `attn` multiplier each frame), **cross-boundary causality** (saturated bodies
  spill density to neighbours, ΣΔ = 0, into a new `lit` channel; with per-frame feedback density easing),
  and the **density heatmap** (the H1 scalar buffer of where matter pools — sampled back via
  `FieldHandle.sampleScalar`/`sampleGradient` and drawn as a glow underlay). All three are inspector
  toggles in the FieldLab, completing its Body-Matter-Interaction section. 5 new JVM tests (71 core
  total): attention is rest-neutral + conserves total strength, causality spillover conserves and flows
  to neighbours, the heatmap reads hotter where matter pooled. Advances #647 / #649.
- **Android port — recipes: the locked 64-recipe canon (`android/`).** Ported the recipe schema,
  validation, and the `compileRecipe` compiler (a `recipe` package). The **64-recipe canon** is decoded
  at runtime from the shared `data/recipes.json` (synced into the core's resources by a `syncRecipes`
  Gradle task — one source of truth with the JS catalog and Swift bundle, never hand-retyped); `kotlinx-
  serialization-json` becomes a core `implementation` dep (pure Kotlin, so the core stays platform-free).
  The FieldLab sidebar gained a **"The canon — 64 recipes"** section: selecting one compiles it and runs
  its bodies live. 5 new JVM tests (66 core total): all 64 load, every recipe validates against the
  standard registry, every body token is a registered force, all four tiers present, compile produces
  runnable bodies. Recipe save/export remains a follow-up. Advances #652.
- **Android port — overlay readings (`android/`).** The field diagnostics, in a pure `overlay` package
  computed as plain `Segment`s any host draws: `forceAt` (the still-probe net force, ported from
  `streamlines.ts`) → **streamlines** / **force-vectors**; the field-line tracer over `netField` →
  **field lines**; a field-displaced lattice → the **deformation grid**; and **marching-squares
  iso-contours** for **temperature** and **energy** from a particle-splatted scalar grid. Wired into the
  FieldLab inspector's **Readings** panel and the headless render (overlay PNGs). 6 new JVM tests (61
  core total); verified headless (force-vectors show a clean radial inflow; gravity's monopole traces
  field lines). The `path` and per-body `data` readings remain follow-ups. Advances #654 / #732.
- **Android port — Kotlin core (`android/`).** A native **Kotlin** port of the engine, mirroring the
  Swift port one-to-one. The pure-`kotlin("jvm")` `:fundamental-core` module (zero Android deps — the
  analog of `FundamentalCore`) ports the core contracts (`Vec3`/`Box`/`Particle`/`Body`/`Env`/
  `Formation`/`ScalarGrid`/`Force`+`ForceModification`/`ForceColors`/`Registry`) and the **full
  36-force surface** line-for-line: the canonical nine (§6), the natural primitives (§20.10 —
  gravity/charge/magnetism/thermal/collide/diffuse/propagate/memory), and the designed extended set
  (§20.3 — lens…warp). The six deterministic canonical forces are **machine-checked on the same golden**
  as Swift — a `syncGolden` Gradle task pulls `swift/Tests/.../conformance-golden.json` onto the Kotlin
  test classpath and `GoldenConformanceTests` reproduces every `dv` within tolerance (`2e-4 + 1e-3·|dv|`);
  every other force gets exact/behavioral unit tests (36 tests total), as on Swift. New CI workflow
  `android.yml` (JDK 17, `./gradlew :fundamental-core:build`) gates it and re-runs when the golden
  changes; committed Gradle 8.13 wrapper, JVM-17 bytecode. See [`android/README.md`](android/README.md).
- **Android port — the integrator (`android/`).** Ported `step()` (the per-tick loop) and its
  subsystems to Kotlin, line-for-line from the Swift integrator: first-class mass, the range cull, the
  modifier contract (spotlight → screen → resonate), cross-body screen attenuation, conserved attention,
  the carrier-wave current (linear + circular), formation currents, the `c` cap, friction/heat decay,
  wander, mortal aging, toroidal wrap, and the source pass — plus real scalar grids (`ScalarGridImpl`:
  diffuse/wave/memory), `SpatialHash`/`FieldStore`, `Currents`, `Geometry` (dipoles + `netField`),
  `Formations`, the `when` gates, thermodynamics, weights, and temporal kernels; the `field()` structure
  hooks are now complete. Verified by a headless `EngineTests` (gather / friction / planar / capture /
  bounded sources) and a deterministic `PerfRegressionTests` (1200 particles × 600 frames: count
  conserved, all-finite, velocity/heat bounded) — 44 core tests total. Still to come: the `createField`
  driver + `FieldHandle`, the platform scheduler, the Android `View`/`Canvas` + Compose hosts, a sample app.
- **Android port — runtime driver + Jetpack Compose host (`android/`).** The engine now runs on-device.
  `FieldController` (pure Kotlin, the `createField`-equivalent loop: pool seeding, env-service wiring,
  scalar-grid stepping, formation easing, `tick()`, plus `addBody`/`burst`/`setFormation`/`resize`) is
  driven by a new `:fundamental-compose` module — `FieldView` (one frame per display frame via
  `withFrameNanos`, particle rendering on a Compose `Canvas`, tap-to-burst) and `Modifier.fieldBody(...)`
  (a composable becomes a force source tracking its on-screen bounds, mirroring SwiftUI `.fieldBody`) —
  with a runnable `:sample` app. 55 core tests (incl. `FieldControllerTests`); the host + sample build
  against the Android SDK and were **verified running on a Pixel 7 / API 35 emulator** (a centered
  `fieldBody` bends the particle field into an orbiting shell). CI (`android.yml`) now sets up the Android
  SDK and assembles the host modules alongside the core conformance gate. compileSdk 34, minSdk 24,
  AGP 8.7, Compose BOM 2024.12.
- **Android port — the public `FieldHandle` API (`android/`).** A `createField(...)` facade over the
  runtime driver (the Kotlin `FieldField`), exposing the consumer surface: programmatic bodies with live
  `BodyHandle`s (`set` / `remove` / `load` / `drain` for sinks), `burst`, `flowTo` / `clearFlow` (a new
  `Flow` focus ported from `flow.ts` — a transient linear-falloff pull applied in `tick`), data atoms
  (`seed` / `atomAt`, with `AtomPayload`), open scalar channels (`addField` / `sampleField`), `energy`,
  `particleCount`, and `readParticles(out)` (stride-5 wire format, with `PARTICLE_STRIDE` /
  `PARTICLE_WIRE_VERSION`). Programmatic bodies track a per-frame `rect`. 7 new JVM tests (55 core total).
  Still pending (subsystems not yet ported): relationship edges and `sampleScalar` / `sampleGradient`.
- **Android port — Compose render modes (`android/`).** `FieldView` gained a `renderMode` parameter:
  `DOTS`, `TRAILS` (a faded persistent buffer → comet trails / accretion-disk look), `LINKS` (proximity
  line segments via the engine's spatial hash → a constellation network), and `GLOW` (soft
  radial-gradient blobs). The `:sample` can pick a mode via an `--es mode …` intent extra. All four
  verified on the Pixel 7 / API 35 emulator. (Metaballs / voronoi / streamlines / heatmap overlays
  remain follow-ups — they need the heatmap grid + marching-squares.)
- **Android port — FieldLab for the JVM (`android/lab`).** A desktop **FieldLab** over the same
  pure-Kotlin engine, drawn with Java2D (built into the JDK — no Android, no emulator, no
  Compose-Multiplatform). The Kotlin analog of `swift run FieldLab`: `./gradlew :lab:run` opens a real
  Swing app with a **sidebar** (the tour + the full 36-force catalog, grouped canonical/natural/extended),
  a **live canvas**, and an **inspector** (formation, render mode, density, accent, live
  strength/range/spin sliders, and live stats — particles / kinetic / thermal / frame-ms). Each force
  opens a scene wired to actually show it (charge/magnetism get charged matter, hunt two species, wall/gate
  a box, morph a target). Headless paths: `--args="render out/"` renders the tour + a catalog spread to
  PNGs (a CI-able visual gate needing no display — wired into `android.yml`) and `--args="bench"` reports
  deterministic sim ms/frame. Closes the "can't iterate/verify rendering without an emulator" gap;
  advances #655. (Not yet vs. Swift FieldLab: overlay readings, the recipe canon, and the
  attention/causality/heatmap toggles — they follow their engine subsystems.)

### Fixed

- **Android port — programmatic bodies build with `feedback=true` (`android/`, Swift `addBody` parity).**
  Code-driven bodies were constructed without feedback, so their density `d` never rose — which silently
  broke `addEdge` salience, conserved attention, and causality on bodies made via `FieldHandle.addBody`
  (they only worked on scanned/DOM-equivalent bodies). They now construct with `feedback=true`, matching
  Swift `addBody`.

## [0.8.1] — 2026-06-25

### Added

- **Circular wave currents — `waveStyle: 'circular'` + `waveCenter` (core, elements, vanilla, react, three).** The wave current system now supports two layouts: `'linear'` (default — horizontal bands, unchanged) and `'circular'` (concentric rings radiating from a center point). `waveCenter: { x, y }` sets the origin; it defaults to the viewport center and is updated live via the `wave-center` attribute on `<field-root>` (a space-separated `"x y"` string). The `field-root` exposes both as observable attributes (`wave-style`, `wave-center`) and reflects them through to `createField` options. SwiftUI port propagates `waveStyle`/`waveCenter` through live option updates via a new `FieldCenterPreferenceKey` for reliable layout-pass centering.
- **Pluggable `lintPlatform` rules (dom).** `lintPlatform` now accepts inline rules
  (`opts.rules`) and a global registry (`registerLintRule` / unregister fn) so teams can enforce
  project-specific field conventions alongside the built-in checks.
- **`mountXRay(field, container, opts?)` (dom).** Keystroke-triggered inspection overlay (default
  `?`) showing live particle count, kinetic/thermal energy, and force vector under the cursor.
  Press `?` on any field page to reveal field internals; press again or `Escape` to close.
  Corner position and hotkey are configurable; returns a teardown fn.
- **RC-6 option-seam tests — `gridWarp`, `gridIntensity`, `overlayBackend`, `feedbackSink` (core).** Ten new tests pin every previously-uncovered `FieldOptions` constructor seam: `gridWarp` (flat / amplified / negative-fallback), `gridIntensity` (zero / max / clamped), `overlayBackend` (injected backend receives `size()`, replaces the default canvas2d backend), and `feedbackSink` (custom sink accepted; absent sink falls back to the default). Closes the RC-6 contract-coverage gap.
- **Swift visual snapshot model — render output gated without a device.** `Snapshotter.signature`
  reduces a headless render to a coarse perceptual signature (downsampled luminance grid + lit fraction +
  centroid); `VisualSnapshotTests` asserts every matter render mode draws coherent, bounded content in the
  right place, and that the signature is stable run-to-run (observed Δ ≈ 0.004 vs a 0.08 threshold — the
  precondition for per-mode goldens). A pixel-exact golden would flake (unseeded wander + cross-machine
  rasterization), so the model gates structure, not pixels. Completes the native verification spine and is
  what lets the renderer-parity work (#417, #392) be verified without human eyes.
- **`addEdge()` — programmatic relationships between bodies (core; vanilla + three).** The non-DOM
  counterpart of `addBody`: `field.addEdge(a, b, opts?)` relates two `addBody` handles with a live
  `RelationshipAgent` that **strengthens while its source body is salient** (gathering matter) and decays
  while idle, accumulating `memory`. `readEdges()` returns the live graph (`{ from, to, type, strength,
  memory, active }`) for a non-visual consumer — an agent modelling `file ↔ meeting ↔ app` gets the
  relationship layer + its longitudinal warmth with zero DOM, the way `readParticles` is the swarm.
  Removing an endpoint body drops its edges; the `EdgeHandle` mutates (`set`) / removes it. Additive,
  shipped-but-unfrozen; mirrored through vanilla `FieldField` + three `FieldLayer`; runs headless.
- **`headlessHost()` — a DOM-free reference host for non-visual consumers (core, #600).** Where
  `browserHost()` binds the engine to `window`/`document`/rAF, `headlessHost({ width, height })` binds it
  to nothing: an abstract volume, a no-op scan root (bodies come via `addBody`), no canvas, and a manual
  `tick()` loop the caller drives instead of requestAnimationFrame (`resize()` re-volumes it). Paired with
  `render: 'none'`, the field runs the full simulation + writes its signals and draws nothing — read them
  per-body via `addBody`'s `onFeedback` or globally via `sampleScalar`/`readParticles`. The substrate an
  agent, a native sidecar, or a Node service reads the field through, with zero DOM. Re-exported from
  `@fundamental-engine/vanilla` beside `createField` (which now accepts no canvas in this mode).
- **SwiftUI `.fieldBody()` is live — nodes are real engine bodies (FundamentalSwiftUI).** The modifier was
  a stub (its `onAppear` predated body registration); it now bridges to `FieldHandle.addBody`, so a view
  becomes a programmatic body whose force well tracks its frame each tick and is removed on disappear.
  `FieldView` gained a content closure (`FieldView { … }`, mirroring React's `<FieldField>`) that scopes
  the running field + a shared named coordinate space (`FundamentalField.coordinateSpace`) to its
  children, so `.fieldBody(tokens:…)` couples to the field with no per-app glue. Covered by a frame→Box
  conversion test + a real-field register/track/remove lifecycle test.
- **Particle shape — matter isn't only dots (Swift; cross-plane contract).** A new `particleShape`
  field option: `.dot` (default, the fast Metal-batched circle), `.star(points:innerRatio:)`,
  `.polygon(sides:rotation:)`, or `.custom(vertices:)` — any unit vector polygon. The shape rides the
  physics (each particle's size + heat scale it), and a non-dot shape routes through the CoreGraphics
  path while default dots stay Metal-fast, so it works on-device with no shader work. The contract
  (`ParticleShape`, renderer-agnostic vertex data on `FieldOptions`/`RenderFrame`) is shared so the JS
  canvas / WebGL planes can adopt the same option. Covered by shape-resolution tests.
- **Grid overlay — heatmap colouring, foldless warp, smooth curves (core).** The `grid` overlay (the
  warped spacetime lattice) now (1) tints each line by how hard the field warps it there — a neon ramp
  from cool accent in flat space, through electric violet and neon magenta, to hot neon pink at the mass
  wells, with opacity rising the same way; (2)
  warps as a coherent rubber sheet — the displacement field is box-blurred and each vertex is clamped to
  ~half a cell, so masses dimple the lattice into deep but **foldless** bowls instead of a tangle of
  crossing lines (the throw can no longer exceed the cell pitch, the cause of the moiré); and (3) draws the
  warped lines as Catmull-Rom curves instead of faceted segments. Same-temperature segments merge into
  single polylines, so the colouring costs a handful of extra strokes, not one per cell.

### Fixed

- **Grid overlay frames the viewport — no edge pull-away (core).** The warped lattice tapers its
  displacement to zero within ~1.5 cells of each viewport edge, so the boundary lines stay pinned to the
  screen edges and ease into the full warp inward — a strong inward warp can no longer bare the edges.
- **`forceAt` honours `data-shaped` — the grid / streamlines warp by a body's whole box, not its centre
  (core, JS + Swift).** The field sampler always measured from the body centre, while the integrator
  (particles) clamps to the element's box for shaped bodies — so a shaped element (a button, a wide
  headline) shelled particles around its outline but only dented the grid at a single point. `forceAt`
  now mirrors the integrator's nearest-box-point reference on both planes. Covered by a new test.
- **Cross-plane conformance harness — Swift parity is now machine-checked (#526).** `pnpm gen:golden`
  fires the canonical deterministic forces through the f64 JS engine and writes their frame-0 force
  deltas to a golden fixture; the f32 Swift `GoldenConformanceTests` must reproduce every one within
  tolerance (120 cases: 6 forces × 4 variants × 5 probes). Two CI gates close the loop — `pnpm
  check:golden` fails if the golden drifts from the JS math, and the Swift CI legs fail if a Swift force
  drifts from the golden. The first autonomous, no-device verification model for the native port; the
  same harness extends to the EM/grid/RNG/extended forces.
- **Support matrix + accessibility record, CI-pinned (RC hardening — #322, #325).** A stated
  browsers / DPR / reduced-motion / SSR support matrix and accessibility posture
  (`docs/canonical/support-matrix.md`), each row backed by a test: `core/reduced-motion.test.ts`
  (integration provably freezes — `dt = 0`, no travel — when the host reports reduced motion, and
  provably animates otherwise), `core/ssr.test.ts` (the engine imports, constructs, runs, and tears down
  with `document`/`window` absent — `render:'none'` is the SSR-natural mode), alongside the existing
  DPR-cap and Accessibility-Contract tests. The field stays `aria-hidden` (decorative; AT walks past it);
  the AT-pass log records the automated invariants and leaves the live screen-reader spot-check as a
  maintainer sign-off.
- **Lifecycle contract + contract-coverage guard (RC hardening — #320, #323).** A documented
  create→register→measure→unmount contract (`docs/canonical/lifecycle-contract.md`) backed by per-surface
  unmount tests (vanilla idempotent destroy, the `<field-root>` `disconnectedCallback` teardown, the
  React `useEffect` cleanup), plus a meta-test that fails CI if any public `FieldOptions` key or the
  `particleCount()` metric ships without a test. The guard surfaced and closed real gaps — the theming
  (`theme`/`gradientCool`/`gradientWarm`/`waveBaseline`) and grid (`gridWarp`/`gridIntensity`) options
  now have coverage.

### Removed

- **Deleted the retired `@fundamental-engine/kit` + `fundamental-engine` umbrella packages.** They were
  retired (private, 0 LOC) at 0.7.0 and are now removed from the workspace entirely — the published set
  is the 6 real packages (`core`, `dom`, `elements`, `react`, `vanilla`, `three`) plus the deprecated
  `platform` alias. Also fixed `check:readme`'s package list (it was missing `dom` and still listed the
  umbrellas). No published-surface change (the umbrellas never shipped). `platform` removal is deferred
  to 1.0 (it's a published alias — see the packaging decision in #537).
### Changed

- **BREAKING (pre-1.0): `render` now defaults to `'none'` (signals-first) — #538.** A field created
  without an explicit `render` (`createField(canvas)`, `new FieldField()`, `<field-root>`) now runs the
  full simulation + feedback pipeline but **draws nothing** — it exists purely as signals (`--d`,
  `--load`, `--lit`, capture events, `scrollV()`). The particle surface is opt-in: pass `render: 'dots'`
  (or `<field-root render="dots">`). This makes the default experience the *behavior* layer the engine
  is actually for, instead of a particle background — a field stops feeling like "particles" and starts
  feeling like a tool. **Migration:** anywhere you relied on the implicit particle field, add
  `render: 'dots'` / `render="dots"`. Unaffected: `<field-cell>` (its own demo pool, still draws),
  recipes (set their own render), and any call already passing `render`. The site homepage and the
  starter app pin `render="dots"` explicitly (they *are* the field showcase).

### Performance

- **Hot-path allocation sweep (#530).** Eliminated the clearest steady-state per-frame allocations in
  the draw loop: **twelve `hexToRgb(cfg.accent)` re-parses per frame** (one per draw/overlay pass) now
  read the already-cached live accent (`curAccent`) — zero parse, zero alloc, and slightly more precise
  (no hex round-trip); and the self-laying-out repulsion no longer allocates `centers.filter(j !== i)`
  every frame per mover (was **O(movers²) arrays/frame** on a cluster) — `repelForce` takes a `skip`
  index instead. Behaviour is unchanged (pinned by a skip-vs-filter equivalence test). The GC-pressure
  *budget* as a CI gate (the issue's secondary ask) needs allocation-measurement infra — a follow-up.

### Added

- **Compositing perf-lint — the mix-blend fill trap as a guard (`lintCompositingPerf`, dom, #532).**
  The hardest-won fill-rate lesson is now a dev-time lint: a full-viewport `mix-blend-mode` canvas
  re-composites the **whole screen every frame** the layer below animates, *even when empty* (#405) — so
  it must stay `display:none` until it draws. The rule flags a mounted full-viewport mix-blend canvas
  whose backing store is unsized (`0×0` → not drawing) yet isn't `display:none`. Pure, inline-style only,
  wired into `lintPlatform`. (The adaptive-DPR half of #532 shipped as `setQualityTier` in #413.)
- **Adaptive quality tiers — `setQualityTier` + automatic governor response (#413).** The
  `QualityGovernor` already detected sustained frame-budget overruns and emitted a tier (0–3), but the
  *engine-side* response was a documented gap — the embedder had to wire it. Now `FieldHandle.setQualityTier(0–3)`
  maps the tier to the engine's own levers (caps the effective backing-store DPR — 1.5 / 1.25 / 1 — the
  dominant fill lever, and skips the heaviest ambient layer, the heatmap glow, at tier 2+), reversibly.
  The `<field-root>` platform runtime now **forwards the governor's tier automatically**, so a struggling
  field self-simplifies and recovers without any wiring; the `field:quality-tier` event still fires for
  custom responses. Mirrored on vanilla / `<field-root>` / three / React.
- **Discrete proximity events — `enter` / `exit` / `met` (core, #441).** The discrete event bus
  (`field.on(type, cb)`) gains the gameplay triggers from FieldKit gap #4: `enter` / `exit` fire as
  another body crosses INTO / OUT OF a body's `range` (`{ body, other }`), and `met` fires once when
  two bodies' boxes touch (`{ a, b }`) — so a bee-agent entering a bloom or a predator meeting prey is a
  callback, not per-frame distance polling. Body-level, object-identity tracking (survives rescan), runs
  on the measure cadence, and **lazy** (a type with no listener costs nothing). Available on
  vanilla / `<field-root>` / three / React via the generic `on`.
- **First-class theming — the ambient palette as `FieldOptions` (#529, supersedes #498).** The
  free-particle heat ramp (`COOL`/`WARM`) and the background-wave baseline (`WAVE_RGB`) were hardcoded
  module constants — theming meant forking core. Now they're a **theme contract**: `theme` picks a named
  preset (`'warm'` (default) · `'cool'` · `'mono'`) and `gradientCool` / `gradientWarm` / `waveBaseline`
  override individual lanes (all `FieldOptions`, mirrored as `<field-root theme|gradient-cool|gradient-warm|wave-baseline>`).
  Exports `THEMES` + `FieldTheme`. **Additive, frozen surface intact** — `theme: 'warm'` reproduces the
  shipped palette byte-for-byte (the hot-path `particleRGBInto` defaults to the same constants).
- **`FIELD_VERSION` + `field.version` — the running engine version (#547).** The engine now exposes
  its version: `import { FIELD_VERSION } from '@fundamental-engine/core'`, and every field handle has a
  `version` property (mirrored on `FieldField`, `<field-root>`, and the React handle) — so a consumer or
  an introspecting agent can read which build it is on, including a CDN/bundled copy at runtime. A drift
  guard (`version.test.ts`) keeps `FIELD_VERSION` locked to `packages/core/package.json`. Additive to the
  (unfrozen) handle. (CDN snippet pinning lands with the next npm publish.)
- **`npm create @fundamental-engine` scaffold (#546).** A new `@fundamental-engine/create` package: one
  command spins up a starter — `npm create @fundamental-engine my-app` (interactive) or with
  `-- --template vanilla|react|web-component`. All three are **signals-first** and explicit about
  `render` (so they behave the same whichever engine version resolves); the default `vanilla` template is
  a *contained, signals-only* reactive list (`FieldField` + `bounds`, `render: 'none'`) — the field as
  behaviour, no particle canvas. Zero-dependency CLI; the templates ship in the package.
- **`gridIntensity` — the warped grid as a visual centerpiece (#552).** The `grid` overlay's stroke
  opacity is now an option (`gridIntensity`, `<field-root grid-intensity>`); default `0.16` keeps the
  faint diagnostic unchanged, raise it (≈`0.5`) and the lattice reads as a deliberate surface. Pairs with
  `gridWarp` (how far the lattice deflects). Powers the homepage hero: `overlay="grid"` warped by the
  "mass" headline (a gravity well co-located with its swirl — a spinning mass that dips *and* drags the
  lattice, the spacetime-curvature image), bold across the hero and faded out below it by a scroll-zone
  controller, with particles drifting through. The overlay surface is also marked `data-field-overlay`
  (the single light-DOM canvas Fundamental adds) so a consumer can target it — e.g. for that scroll fade.
- **`<field-root>` consumer-surface completeness (#541, #542).** Two CAPMPrep-driven fixes to the web
  component's discoverability: (1) **imperative setters reflect to their attribute** — after
  `el.setRender("links")`, `el.getAttribute("render") === "links"` (it used to show a stale value and
  actively mislead attribute-based debugging). All live setters reflect (`render`/`overlay`/`background`/
  `accent`/`palette`/`formation` + the boolean toggles), guarded against the re-apply loop; `formation`
  is now a first-class round-tripping attribute. (2) **`.handle` accessor + the last forwards** — the
  element exposes its live `FieldHandle` via `el.handle` (the escape hatch for the full surface and for
  `bindData`/`applyRecipe` from `@fundamental-engine/dom`), and `scrollV()`/`setVisible()` join the
  proxied methods — so introspecting the element no longer wrongly reads as "a thin API."
- **Dev no-op diagnostics — `devWarnNoOp` (core, #543).** A method that returns a neutral value because
  a prerequisite is missing now explains itself in dev instead of failing silently: `sampleScalar` /
  `sampleGradient` called with the heatmap layer off (where they return `0` / `{0,0}`) emit a one-shot,
  deduped `console.warn` naming the fix (`{ heatmap: true }` / `setHeatmap(true)`). Gated by the same
  contract-checks flag as the guards (no-op + dead-code-eliminable under `NODE_ENV=production`), deduped
  by message so a per-frame call warns once, and never throws — the no-op stays legal, it's just no longer
  mysterious. The first slice of the silent-no-op diagnostic family; more call sites follow.
- **Contained, card-scoped fields — `containerHost` + `bounds` (#540).** A field can now render scoped to
  an element instead of the window — the structural gap that made every embed feel like a full-window
  particle background. `new FieldField({ bounds: cardEl })` (or `createField(canvas, { host: containerHost(el) })`)
  puts the field, its bodies (scanned within the element), and its canvas in the element's local coordinate
  space. Mechanism: `HostViewport` gains an optional `originX/originY`; the scanner and the thread/move
  readouts subtract it, and a contained field re-reads its origin each frame + skips the window-only scroll
  shift (its local positions are scroll-invariant). Additive — `originX/originY` default to 0, so window
  fields stay byte-identical (668 core tests unchanged). The first concrete `FieldSurface` toward #539.
- **One imperative `createField` door — host resolution (#537).** `@fundamental-engine/vanilla`'s
  `createField(canvas, opts)` is now a single entry that resolves the host from `opts.host` → `opts.bounds`
  (contained, via `containerHost`) → `browserHost()` (default), so the contained and custom-host modes no
  longer require reaching for `createBrowserField`/`containerHost` by hand — the three-`createField`
  footgun that confused embedders. `FieldField` routes through the same entry. The frozen contract is
  preserved exactly: `createField(canvas)` with no host still auto-supplies `browserHost`; `bounds` and
  `host` are additive options. New type: `CreateFieldOptions`.

### Added

- **Consumer-side feedback-contract lint — `lintFeedbackReadsUnwritten` (dom, #516).** Completes the
  silent-contract lint family: a CSS *rule* that reads a feedback var (`var(--field-*)`/`--load`/`--d`)
  and matches a `[data-body]` element with **no** `data-feedback` — a field body styled from a channel
  it never opted into, so the style sits at its fallback forever. The stylesheet-level mirror of the
  inline-only `lintFeedbackVarReads` and the inverse of `lintFeedbackWritesUnread`; scoped to
  `[data-body]` to stay high-signal. Wired into `lintPlatform` (runs on the homepage), dev-only/no-op
  under SSR.

### Performance

- **Tag-tint RGB is cached on the measure cadence (core, #515).** The render-time tag-tint precompute
  re-parsed every coloured body's hex (`hexToRgb`) and rebuilt its array *every frame*; it now caches the
  parsed RGB + reach² on the 6th-frame measure cadence (where colour/range actually change). Body
  positions are read live each frame, so the tint still tracks scroll (the #508 fix) — only the per-frame
  string-parse churn is gone.

### Added (earlier in 0.8.0)

- **`gridWarp` — distortion multiplier for the `grid` overlay (core).** The `grid` overlay (the
  reference lattice displaced by the field) deflects each node by a deliberately-legible amount; the new
  `gridWarp` FieldOption scales that deflection so the deformation reads more strongly (`1` default;
  `2`–`3` exaggerates it for demos; `0` flattens the lattice). Exposed as `<field-root grid-warp>` and
  documented in the options reference. Additive — the frozen API surface is unchanged.

- **`wall` sparks in the body's own colour (core).** A kinematic `wall` already throws a spark on a hard
  impact (§6.4); it now sparks in the body's `data-color` tint when it carries one (falling back to the
  canonical wall hue), so a tagged container's impact flash matches its tag-tint. One-line change to the
  `wall` force; existing spark/bounce tests unchanged.

- **Tag-tint — particles wear their nearest tag's colour (core).** Every body that carries a colour
  (`data-color`) now stains the swarm toward its tint at render time, by proximity — a *pervasive*
  companion to the overlap-only `pigment` force, so a particle near a tagged body reflects its hue even
  on a sparse field (nearest-strongest wins, linear falloff to ~1.4× the force range; pigment still
  layers on top for advected streaks). Automatic — no markup beyond `data-color`.
- **Scroll-position heatmap fade (core).** The density heatmap now fades out as the page scrolls past
  the hero (≈ the first viewport) — a smooth, MONOTONIC function of scroll position, so unlike the
  earlier velocity-based suppression it never pops/flickers. Below the hero the whole layer is skipped
  (no texel recompute, no upscale), confining the at-rest heatmap cost (#409) to where it's focused.

- **`lintFeedbackWritesUnread` — the producer half of the feedback-contract lint (dom).** Closes the
  recurring "charged but reads nothing" bug class (#411): a `data-feedback` body gets `--d`/`--load`/
  `--field-*` written every frame, but if no style rule reads them it changes invisibly. The existing
  `lintFeedbackVarReads` caught the inverse (reads-without-writes); this catches writes-without-reads by
  walking the document's accessible stylesheets for var consumers and warning for any `data-feedback`
  body matched by none. Dev-only/heuristic — no-ops under SSR/tests/cross-origin sheets, and lenient
  (strips pseudo-selectors) so it under-reports rather than false-positives. Wired into `lintPlatform`.

### Changed

- **Warm default palette (core).** The free-particle heat ramp (`COOL`/`WARM` in `math.ts`) and the
  Currents' wave baseline (`WAVE_RGB` in `field.ts`) shift from the cool blue/teal/purple baseline to a
  warm one (`COOL [255,224,200]` / `WARM [255,110,80]`; waves `#ff8a5c`/`#f0628e`/`#ffc46b`). The
  energized **accent** is unchanged and still overridable per field (`accent` / `palette` / `setAccent`),
  so the look is warm ambient matter under cool-accent highlights. This is the engine's default identity
  now; the wave baseline and ramp ends remain hardcoded (no per-field override yet — tracked separately).
  The Swift port is brought to parity in a follow-up so the planes don't diverge.

- **Overlay arrows resample on a cadence (core perf).** `drawOverlayArrows` (the in-front
  `streamlines`/`force-vectors` Field-Surfaces reading) rebuilt its whole force-vector grid every
  frame — the same per-frame regrid waste the underlay shed in #406. It now resamples every 3rd frame
  (or when its cache is empty / a flow focus is live) and draws from the cache every frame, so the
  arrows never flicker or step. Matches the underlay `slSamples` pattern; `accent` is still read every
  frame so `setAccent` recolors immediately. (#412)

### Fixed

- **`<field-root dpr-cap>` rejects non-finite values (elements).** The `dprCap` getter now guards with
  `Number.isFinite` like `density`/`depth`, so `dpr-cap="Infinity"`/`"NaN"` fall back to the engine
  default instead of feeding a bad backing-store DPR downstream.
- **Removed the non-functional `root` option from `FieldLayerOptions` (three).** The `FieldLayer` class
  scans its mesh-body registry, so the DOM `[data-body]` scan root was silently discarded (`void root`).
  It's gone from the type; the lower-level `createThreeField({ root })` builder still honours it.
- **Corrected the `ParticlePool` staging-buffer stride comment (three)** — it read "stride-4 `[x,y,heat,size]`"
  but the buffer is stride-5 `[x, y, z, heat, size]`, matching `readParticles`.


- **Bodies track scroll between re-measures — no more swarm "pause" on scroll (core).** Body centres are
  re-measured (`getBoundingClientRect`) only every 6th frame, but the page scrolls continuously under the
  fixed field — so during a scroll each attractor's force-centre snapped in 6-frame steps and the swarm
  read as pausing/stuttering. The cached centres are now translated by the per-frame scroll delta between
  measures (`b.cy -= dScroll`), which carries the shaped box too (it's centred on `cy`); `measureBodies`
  still refreshes from the real rects on its cadence, so there's no drift. Verified: sampled body force at
  a fixed point changes every frame through a scroll (plateau fraction 0, was ~0.83).


- **Post-0.7.0 integrity sweep.** The release workflow's post-publish smoke + provenance checks no
  longer install the retired `kit`/`fundamental-engine` umbrellas (that mismatch is why the 0.7.0 run
  reported failure even though all 7 packages published); the version-match gate now skips private
  packages. Doc corrections: `api-stability.md` no longer promises a `forces-*` alias window that the
  hard rename removed (only `forces:*` events survive); the root README + `RELEASING.md` + the retired
  umbrella READMEs drop install instructions for unpublished packages; `elements` README `dom` links
  point at `../dom`; stale "35 forces" counts fixed (authoritative is 36); the `addField` JSDoc no
  longer implies the engine consumes channels internally. Test hardening: `BodyHandle.set` color +
  range/angle/spin coverage, and a reverse option-drift guard that would have caught the original
  `depth` drop.

### Internal

- **`check:dist` now smoke-tests all 7 published packages** — it had drifted to the pre-0.7.0 set and was
  omitting `dom` and `three` (validating only the deprecated `platform` alias).
- **`check:links` now validates cross-file `#fragment` anchors** against the target doc's headings
  (GitHub slug rules), catching the section-rename → rotted-link class. Same-file ToC anchors stay out of
  scope (they follow the site renderer's slug convention, not GitHub's).
- **Site home-runtime hygiene:** the drag `pointermove`/`pointerup` listeners now bind to the page
  AbortSignal (no orphan on navigate-mid-drag), and the gallery readout reads the engine's inline
  `--field-density` write instead of calling `getComputedStyle` every animation frame.

### Site

- **A `/changelog` page — "what's new", on the site.** Recently-shipped highlights over the full,
  versioned log, rendered at build time straight from this `CHANGELOG.md` (single source of truth). A
  version badge in the nav links to it.
- **Homepage content pass.** Sharpened the copy to explain the point over the spectacle (the AI-trust
  section, the install story), de-jargoned the install language, and added the `0.x preview` maturity
  signal to `/eli5`. Tightened the narrative by cutting three Gallery beats that re-demoed earlier
  chapters (the live experience keeps its full length; only the redundancy is gone).
- **Wayfinding — every concept leads to its reference.** Each manual chapter now links to its canonical
  doc, and all 36 forces deep-link to their exact entry in the force catalog. Added a "pick your
  package" decision path to the docs and two worked accessibility examples (reduced-motion CSS, the
  `aria-hidden` visual-binding pattern).

### Documentation

- **Docs accuracy sweep.** Audited all 86 docs + package READMEs against the code. Corrected the force
  count to **36** where docs drifted (9 canonical + 19 extended + 8 natural; `forces-engine.md`,
  `research/01`); fixed package READMEs (`react`/`vanilla` `../platform` links → `../dom`, `three` CDN
  example `@0.3.1` → `@0.7.0`); reconciled `RELEASING.md`/`PUBLISHING.md` to **six** published packages at
  **0.7.0**; removed a false `compat-*` package claim; split the shipped `warp` atom from the spec-only
  `wormhole` preset; fixed the `pheromone`→`diffuse` token name; repaired broken `docs/...` cross-paths;
  committed the load-bearing RC/1.0 gate spec and removed stale `docs/planning/` duplicates; added a
  table of contents to `forces-system.md`.
- **Site API reference completeness for the 0.8 surface.** Added the four 0.8 surface entries that were
  missing from the live API reference (`apps/site/src/lib/docs-api.ts`): the options `gridIntensity`
  (#552) and `bounds` (contained fields, #540), and the handle members `setQualityTier` (#413) and
  `version` (#547) — so the documented surface matches the shipped one.

## [0.8.0] — 2026-06-22

### Added

- **Swift performance model — deterministic perf gate + wall-clock measurement.** `PerfRegressionTests`
  runs a heavy 1200-particle field for 600 frames and asserts the work stays bounded — particle count
  conserved (no leak / unbounded spawn), every value finite (no NaN/Inf), velocity and heat in range —
  a machine-independent gate for the perf-bug class that actually ships (runaway allocation, divergent
  integrator). Wall-clock is *measured* (`swift run FieldLabSnapshots --bench`) but deliberately not
  CI-gated: the field is fill-rate-bound and headless rasterization exaggerates fill, so real frame-time
  budgets need on-hardware measurement (the #324 lesson). Second model of the native verification spine.
- **Cross-plane conformance harness — Swift parity is now machine-checked (#526).** `pnpm gen:golden`
  fires the canonical deterministic forces through the f64 JS engine and writes their frame-0 force
  deltas to a golden fixture; the f32 Swift `GoldenConformanceTests` must reproduce every one within
  tolerance (120 cases: 6 forces × 4 variants × 5 probes). Two CI gates close the loop — `pnpm
  check:golden` fails if the golden drifts from the JS math, and the Swift CI legs fail if a Swift force
  drifts from the golden. The first autonomous, no-device verification model for the native port; the
  same harness extends to the EM/grid/RNG/extended forces.
- **Support matrix + accessibility record, CI-pinned (RC hardening — #322, #325).** A stated
  browsers / DPR / reduced-motion / SSR support matrix and accessibility posture
  (`docs/canonical/support-matrix.md`), each row backed by a test: `core/reduced-motion.test.ts`
  (integration provably freezes — `dt = 0`, no travel — when the host reports reduced motion, and
  provably animates otherwise), `core/ssr.test.ts` (the engine imports, constructs, runs, and tears down
  with `document`/`window` absent — `render:'none'` is the SSR-natural mode), alongside the existing
  DPR-cap and Accessibility-Contract tests. The field stays `aria-hidden` (decorative; AT walks past it);
  the AT-pass log records the automated invariants and leaves the live screen-reader spot-check as a
  maintainer sign-off.
- **Lifecycle contract + contract-coverage guard (RC hardening — #320, #323).** A documented
  create→register→measure→unmount contract (`docs/canonical/lifecycle-contract.md`) backed by per-surface
  unmount tests (vanilla idempotent destroy, the `<field-root>` `disconnectedCallback` teardown, the
  React `useEffect` cleanup), plus a meta-test that fails CI if any public `FieldOptions` key or the
  `particleCount()` metric ships without a test. The guard surfaced and closed real gaps — the theming
  (`theme`/`gradientCool`/`gradientWarm`/`waveBaseline`) and grid (`gridWarp`/`gridIntensity`) options
  now have coverage.

### Removed

- **Deleted the retired `@fundamental-engine/kit` + `fundamental-engine` umbrella packages.** They were
  retired (private, 0 LOC) at 0.7.0 and are now removed from the workspace entirely — the published set
  is the 6 real packages (`core`, `dom`, `elements`, `react`, `vanilla`, `three`) plus the deprecated
  `platform` alias. Also fixed `check:readme`'s package list (it was missing `dom` and still listed the
  umbrellas). No published-surface change (the umbrellas never shipped). `platform` removal is deferred
  to 1.0 (it's a published alias — see the packaging decision in #537).
### Changed

- **BREAKING (pre-1.0): `render` now defaults to `'none'` (signals-first) — #538.** A field created
  without an explicit `render` (`createField(canvas)`, `new FieldField()`, `<field-root>`) now runs the
  full simulation + feedback pipeline but **draws nothing** — it exists purely as signals (`--d`,
  `--load`, `--lit`, capture events, `scrollV()`). The particle surface is opt-in: pass `render: 'dots'`
  (or `<field-root render="dots">`). This makes the default experience the *behavior* layer the engine
  is actually for, instead of a particle background — a field stops feeling like "particles" and starts
  feeling like a tool. **Migration:** anywhere you relied on the implicit particle field, add
  `render: 'dots'` / `render="dots"`. Unaffected: `<field-cell>` (its own demo pool, still draws),
  recipes (set their own render), and any call already passing `render`. The site homepage and the
  starter app pin `render="dots"` explicitly (they *are* the field showcase).

### Performance

- **Hot-path allocation sweep (#530).** Eliminated the clearest steady-state per-frame allocations in
  the draw loop: **twelve `hexToRgb(cfg.accent)` re-parses per frame** (one per draw/overlay pass) now
  read the already-cached live accent (`curAccent`) — zero parse, zero alloc, and slightly more precise
  (no hex round-trip); and the self-laying-out repulsion no longer allocates `centers.filter(j !== i)`
  every frame per mover (was **O(movers²) arrays/frame** on a cluster) — `repelForce` takes a `skip`
  index instead. Behaviour is unchanged (pinned by a skip-vs-filter equivalence test). The GC-pressure
  *budget* as a CI gate (the issue's secondary ask) needs allocation-measurement infra — a follow-up.

### Added

- **Compositing perf-lint — the mix-blend fill trap as a guard (`lintCompositingPerf`, dom, #532).**
  The hardest-won fill-rate lesson is now a dev-time lint: a full-viewport `mix-blend-mode` canvas
  re-composites the **whole screen every frame** the layer below animates, *even when empty* (#405) — so
  it must stay `display:none` until it draws. The rule flags a mounted full-viewport mix-blend canvas
  whose backing store is unsized (`0×0` → not drawing) yet isn't `display:none`. Pure, inline-style only,
  wired into `lintPlatform`. (The adaptive-DPR half of #532 shipped as `setQualityTier` in #413.)
- **Adaptive quality tiers — `setQualityTier` + automatic governor response (#413).** The
  `QualityGovernor` already detected sustained frame-budget overruns and emitted a tier (0–3), but the
  *engine-side* response was a documented gap — the embedder had to wire it. Now `FieldHandle.setQualityTier(0–3)`
  maps the tier to the engine's own levers (caps the effective backing-store DPR — 1.5 / 1.25 / 1 — the
  dominant fill lever, and skips the heaviest ambient layer, the heatmap glow, at tier 2+), reversibly.
  The `<field-root>` platform runtime now **forwards the governor's tier automatically**, so a struggling
  field self-simplifies and recovers without any wiring; the `field:quality-tier` event still fires for
  custom responses. Mirrored on vanilla / `<field-root>` / three / React.
- **Discrete proximity events — `enter` / `exit` / `met` (core, #441).** The discrete event bus
  (`field.on(type, cb)`) gains the gameplay triggers from FieldKit gap #4: `enter` / `exit` fire as
  another body crosses INTO / OUT OF a body's `range` (`{ body, other }`), and `met` fires once when
  two bodies' boxes touch (`{ a, b }`) — so a bee-agent entering a bloom or a predator meeting prey is a
  callback, not per-frame distance polling. Body-level, object-identity tracking (survives rescan), runs
  on the measure cadence, and **lazy** (a type with no listener costs nothing). Available on
  vanilla / `<field-root>` / three / React via the generic `on`.
- **First-class theming — the ambient palette as `FieldOptions` (#529, supersedes #498).** The
  free-particle heat ramp (`COOL`/`WARM`) and the background-wave baseline (`WAVE_RGB`) were hardcoded
  module constants — theming meant forking core. Now they're a **theme contract**: `theme` picks a named
  preset (`'warm'` (default) · `'cool'` · `'mono'`) and `gradientCool` / `gradientWarm` / `waveBaseline`
  override individual lanes (all `FieldOptions`, mirrored as `<field-root theme|gradient-cool|gradient-warm|wave-baseline>`).
  Exports `THEMES` + `FieldTheme`. **Additive, frozen surface intact** — `theme: 'warm'` reproduces the
  shipped palette byte-for-byte (the hot-path `particleRGBInto` defaults to the same constants).
- **`FIELD_VERSION` + `field.version` — the running engine version (#547).** The engine now exposes
  its version: `import { FIELD_VERSION } from '@fundamental-engine/core'`, and every field handle has a
  `version` property (mirrored on `FieldField`, `<field-root>`, and the React handle) — so a consumer or
  an introspecting agent can read which build it is on, including a CDN/bundled copy at runtime. A drift
  guard (`version.test.ts`) keeps `FIELD_VERSION` locked to `packages/core/package.json`. Additive to the
  (unfrozen) handle. (CDN snippet pinning lands with the next npm publish.)
- **`npm create @fundamental-engine` scaffold (#546).** A new `@fundamental-engine/create` package: one
  command spins up a starter — `npm create @fundamental-engine my-app` (interactive) or with
  `-- --template vanilla|react|web-component`. All three are **signals-first** and explicit about
  `render` (so they behave the same whichever engine version resolves); the default `vanilla` template is
  a *contained, signals-only* reactive list (`FieldField` + `bounds`, `render: 'none'`) — the field as
  behaviour, no particle canvas. Zero-dependency CLI; the templates ship in the package.
- **`gridIntensity` — the warped grid as a visual centerpiece (#552).** The `grid` overlay's stroke
  opacity is now an option (`gridIntensity`, `<field-root grid-intensity>`); default `0.16` keeps the
  faint diagnostic unchanged, raise it (≈`0.5`) and the lattice reads as a deliberate surface. Pairs with
  `gridWarp` (how far the lattice deflects). Powers the homepage hero: `overlay="grid"` warped by the
  "mass" headline (a gravity well co-located with its swirl — a spinning mass that dips *and* drags the
  lattice, the spacetime-curvature image), bold across the hero and faded out below it by a scroll-zone
  controller, with particles drifting through. The overlay surface is also marked `data-field-overlay`
  (the single light-DOM canvas Fundamental adds) so a consumer can target it — e.g. for that scroll fade.
- **`<field-root>` consumer-surface completeness (#541, #542).** Two CAPMPrep-driven fixes to the web
  component's discoverability: (1) **imperative setters reflect to their attribute** — after
  `el.setRender("links")`, `el.getAttribute("render") === "links"` (it used to show a stale value and
  actively mislead attribute-based debugging). All live setters reflect (`render`/`overlay`/`background`/
  `accent`/`palette`/`formation` + the boolean toggles), guarded against the re-apply loop; `formation`
  is now a first-class round-tripping attribute. (2) **`.handle` accessor + the last forwards** — the
  element exposes its live `FieldHandle` via `el.handle` (the escape hatch for the full surface and for
  `bindData`/`applyRecipe` from `@fundamental-engine/dom`), and `scrollV()`/`setVisible()` join the
  proxied methods — so introspecting the element no longer wrongly reads as "a thin API."
- **Dev no-op diagnostics — `devWarnNoOp` (core, #543).** A method that returns a neutral value because
  a prerequisite is missing now explains itself in dev instead of failing silently: `sampleScalar` /
  `sampleGradient` called with the heatmap layer off (where they return `0` / `{0,0}`) emit a one-shot,
  deduped `console.warn` naming the fix (`{ heatmap: true }` / `setHeatmap(true)`). Gated by the same
  contract-checks flag as the guards (no-op + dead-code-eliminable under `NODE_ENV=production`), deduped
  by message so a per-frame call warns once, and never throws — the no-op stays legal, it's just no longer
  mysterious. The first slice of the silent-no-op diagnostic family; more call sites follow.
- **Contained, card-scoped fields — `containerHost` + `bounds` (#540).** A field can now render scoped to
  an element instead of the window — the structural gap that made every embed feel like a full-window
  particle background. `new FieldField({ bounds: cardEl })` (or `createField(canvas, { host: containerHost(el) })`)
  puts the field, its bodies (scanned within the element), and its canvas in the element's local coordinate
  space. Mechanism: `HostViewport` gains an optional `originX/originY`; the scanner and the thread/move
  readouts subtract it, and a contained field re-reads its origin each frame + skips the window-only scroll
  shift (its local positions are scroll-invariant). Additive — `originX/originY` default to 0, so window
  fields stay byte-identical (668 core tests unchanged). The first concrete `FieldSurface` toward #539.
- **One imperative `createField` door — host resolution (#537).** `@fundamental-engine/vanilla`'s
  `createField(canvas, opts)` is now a single entry that resolves the host from `opts.host` → `opts.bounds`
  (contained, via `containerHost`) → `browserHost()` (default), so the contained and custom-host modes no
  longer require reaching for `createBrowserField`/`containerHost` by hand — the three-`createField`
  footgun that confused embedders. `FieldField` routes through the same entry. The frozen contract is
  preserved exactly: `createField(canvas)` with no host still auto-supplies `browserHost`; `bounds` and
  `host` are additive options. New type: `CreateFieldOptions`.

### Added

- **Consumer-side feedback-contract lint — `lintFeedbackReadsUnwritten` (dom, #516).** Completes the
  silent-contract lint family: a CSS *rule* that reads a feedback var (`var(--field-*)`/`--load`/`--d`)
  and matches a `[data-body]` element with **no** `data-feedback` — a field body styled from a channel
  it never opted into, so the style sits at its fallback forever. The stylesheet-level mirror of the
  inline-only `lintFeedbackVarReads` and the inverse of `lintFeedbackWritesUnread`; scoped to
  `[data-body]` to stay high-signal. Wired into `lintPlatform` (runs on the homepage), dev-only/no-op
  under SSR.

### Performance

- **Tag-tint RGB is cached on the measure cadence (core, #515).** The render-time tag-tint precompute
  re-parsed every coloured body's hex (`hexToRgb`) and rebuilt its array *every frame*; it now caches the
  parsed RGB + reach² on the 6th-frame measure cadence (where colour/range actually change). Body
  positions are read live each frame, so the tint still tracks scroll (the #508 fix) — only the per-frame
  string-parse churn is gone.

### Added (earlier in 0.8.0)

- **`gridWarp` — distortion multiplier for the `grid` overlay (core).** The `grid` overlay (the
  reference lattice displaced by the field) deflects each node by a deliberately-legible amount; the new
  `gridWarp` FieldOption scales that deflection so the deformation reads more strongly (`1` default;
  `2`–`3` exaggerates it for demos; `0` flattens the lattice). Exposed as `<field-root grid-warp>` and
  documented in the options reference. Additive — the frozen API surface is unchanged.

- **`wall` sparks in the body's own colour (core).** A kinematic `wall` already throws a spark on a hard
  impact (§6.4); it now sparks in the body's `data-color` tint when it carries one (falling back to the
  canonical wall hue), so a tagged container's impact flash matches its tag-tint. One-line change to the
  `wall` force; existing spark/bounce tests unchanged.

- **Tag-tint — particles wear their nearest tag's colour (core).** Every body that carries a colour
  (`data-color`) now stains the swarm toward its tint at render time, by proximity — a *pervasive*
  companion to the overlap-only `pigment` force, so a particle near a tagged body reflects its hue even
  on a sparse field (nearest-strongest wins, linear falloff to ~1.4× the force range; pigment still
  layers on top for advected streaks). Automatic — no markup beyond `data-color`.
- **Scroll-position heatmap fade (core).** The density heatmap now fades out as the page scrolls past
  the hero (≈ the first viewport) — a smooth, MONOTONIC function of scroll position, so unlike the
  earlier velocity-based suppression it never pops/flickers. Below the hero the whole layer is skipped
  (no texel recompute, no upscale), confining the at-rest heatmap cost (#409) to where it's focused.

- **`lintFeedbackWritesUnread` — the producer half of the feedback-contract lint (dom).** Closes the
  recurring "charged but reads nothing" bug class (#411): a `data-feedback` body gets `--d`/`--load`/
  `--field-*` written every frame, but if no style rule reads them it changes invisibly. The existing
  `lintFeedbackVarReads` caught the inverse (reads-without-writes); this catches writes-without-reads by
  walking the document's accessible stylesheets for var consumers and warning for any `data-feedback`
  body matched by none. Dev-only/heuristic — no-ops under SSR/tests/cross-origin sheets, and lenient
  (strips pseudo-selectors) so it under-reports rather than false-positives. Wired into `lintPlatform`.

### Changed

- **Warm default palette (core).** The free-particle heat ramp (`COOL`/`WARM` in `math.ts`) and the
  Currents' wave baseline (`WAVE_RGB` in `field.ts`) shift from the cool blue/teal/purple baseline to a
  warm one (`COOL [255,224,200]` / `WARM [255,110,80]`; waves `#ff8a5c`/`#f0628e`/`#ffc46b`). The
  energized **accent** is unchanged and still overridable per field (`accent` / `palette` / `setAccent`),
  so the look is warm ambient matter under cool-accent highlights. This is the engine's default identity
  now; the wave baseline and ramp ends remain hardcoded (no per-field override yet — tracked separately).
  The Swift port is brought to parity in a follow-up so the planes don't diverge.

- **Overlay arrows resample on a cadence (core perf).** `drawOverlayArrows` (the in-front
  `streamlines`/`force-vectors` Field-Surfaces reading) rebuilt its whole force-vector grid every
  frame — the same per-frame regrid waste the underlay shed in #406. It now resamples every 3rd frame
  (or when its cache is empty / a flow focus is live) and draws from the cache every frame, so the
  arrows never flicker or step. Matches the underlay `slSamples` pattern; `accent` is still read every
  frame so `setAccent` recolors immediately. (#412)

### Fixed

- **`<field-root dpr-cap>` rejects non-finite values (elements).** The `dprCap` getter now guards with
  `Number.isFinite` like `density`/`depth`, so `dpr-cap="Infinity"`/`"NaN"` fall back to the engine
  default instead of feeding a bad backing-store DPR downstream.
- **Removed the non-functional `root` option from `FieldLayerOptions` (three).** The `FieldLayer` class
  scans its mesh-body registry, so the DOM `[data-body]` scan root was silently discarded (`void root`).
  It's gone from the type; the lower-level `createThreeField({ root })` builder still honours it.
- **Corrected the `ParticlePool` staging-buffer stride comment (three)** — it read "stride-4 `[x,y,heat,size]`"
  but the buffer is stride-5 `[x, y, z, heat, size]`, matching `readParticles`.


- **Bodies track scroll between re-measures — no more swarm "pause" on scroll (core).** Body centres are
  re-measured (`getBoundingClientRect`) only every 6th frame, but the page scrolls continuously under the
  fixed field — so during a scroll each attractor's force-centre snapped in 6-frame steps and the swarm
  read as pausing/stuttering. The cached centres are now translated by the per-frame scroll delta between
  measures (`b.cy -= dScroll`), which carries the shaped box too (it's centred on `cy`); `measureBodies`
  still refreshes from the real rects on its cadence, so there's no drift. Verified: sampled body force at
  a fixed point changes every frame through a scroll (plateau fraction 0, was ~0.83).


- **Post-0.7.0 integrity sweep.** The release workflow's post-publish smoke + provenance checks no
  longer install the retired `kit`/`fundamental-engine` umbrellas (that mismatch is why the 0.7.0 run
  reported failure even though all 7 packages published); the version-match gate now skips private
  packages. Doc corrections: `api-stability.md` no longer promises a `forces-*` alias window that the
  hard rename removed (only `forces:*` events survive); the root README + `RELEASING.md` + the retired
  umbrella READMEs drop install instructions for unpublished packages; `elements` README `dom` links
  point at `../dom`; stale "35 forces" counts fixed (authoritative is 36); the `addField` JSDoc no
  longer implies the engine consumes channels internally. Test hardening: `BodyHandle.set` color +
  range/angle/spin coverage, and a reverse option-drift guard that would have caught the original
  `depth` drop.

### Internal

- **`check:dist` now smoke-tests all 7 published packages** — it had drifted to the pre-0.7.0 set and was
  omitting `dom` and `three` (validating only the deprecated `platform` alias).
- **`check:links` now validates cross-file `#fragment` anchors** against the target doc's headings
  (GitHub slug rules), catching the section-rename → rotted-link class. Same-file ToC anchors stay out of
  scope (they follow the site renderer's slug convention, not GitHub's).
- **Site home-runtime hygiene:** the drag `pointermove`/`pointerup` listeners now bind to the page
  AbortSignal (no orphan on navigate-mid-drag), and the gallery readout reads the engine's inline
  `--field-density` write instead of calling `getComputedStyle` every animation frame.

### Site

- **A `/changelog` page — "what's new", on the site.** Recently-shipped highlights over the full,
  versioned log, rendered at build time straight from this `CHANGELOG.md` (single source of truth). A
  version badge in the nav links to it.
- **Homepage content pass.** Sharpened the copy to explain the point over the spectacle (the AI-trust
  section, the install story), de-jargoned the install language, and added the `0.x preview` maturity
  signal to `/eli5`. Tightened the narrative by cutting three Gallery beats that re-demoed earlier
  chapters (the live experience keeps its full length; only the redundancy is gone).
- **Wayfinding — every concept leads to its reference.** Each manual chapter now links to its canonical
  doc, and all 36 forces deep-link to their exact entry in the force catalog. Added a "pick your
  package" decision path to the docs and two worked accessibility examples (reduced-motion CSS, the
  `aria-hidden` visual-binding pattern).

### Documentation

- **Docs accuracy sweep.** Audited all 86 docs + package READMEs against the code. Corrected the force
  count to **36** where docs drifted (9 canonical + 19 extended + 8 natural; `forces-engine.md`,
  `research/01`); fixed package READMEs (`react`/`vanilla` `../platform` links → `../dom`, `three` CDN
  example `@0.3.1` → `@0.7.0`); reconciled `RELEASING.md`/`PUBLISHING.md` to **six** published packages at
  **0.7.0**; removed a false `compat-*` package claim; split the shipped `warp` atom from the spec-only
  `wormhole` preset; fixed the `pheromone`→`diffuse` token name; repaired broken `docs/...` cross-paths;
  committed the load-bearing RC/1.0 gate spec and removed stale `docs/planning/` duplicates; added a
  table of contents to `forces-system.md`.
- **Site API reference completeness for the 0.8 surface.** Added the four 0.8 surface entries that were
  missing from the live API reference (`apps/site/src/lib/docs-api.ts`): the options `gridIntensity`
  (#552) and `bounds` (contained fields, #540), and the handle members `setQualityTier` (#413) and
  `version` (#547) — so the documented surface matches the shipped one.

## [0.7.0] — 2026-06-17

### Breaking

- **`@fundamental-engine/platform` → `@fundamental-engine/dom`.** The package is the DOM-binding layer
  (`browserHost`, the six registries, the frame scheduler, `lintPlatform`, `bindData`) — `dom` is the
  honest name. `packages/platform` moved to `packages/dom`; all internal references updated.
  **Migration:** change `@fundamental-engine/platform` → `@fundamental-engine/dom` in your imports.
  `@fundamental-engine/platform` continues to publish as a thin **deprecated alias** that re-exports
  `dom` (with a console deprecation notice), so existing imports keep working for now — but it will be
  removed in a future release. Pin to `~0.7` and migrate when convenient.
- **Umbrella packages retired.** `@fundamental-engine/kit` and `fundamental-engine` are no longer
  published. Install the specific `@fundamental-engine/*` package(s) you need (`core` is the engine;
  `dom` / `elements` / `react` / `vanilla` / `three` are the surfaces). They added an indirection
  without earning it, and the unpublish/republish churn around them caused real incidents.

### Fixed

- **Force-availability accuracy (docs/comments).** Corrected the misleading `// … opt-in` comments on
  `registerNaturalForces`/`registerExtendedForces` in `field.ts` — all **36** forces are registered on
  every field (the natural and extended sets are *not* opt-in; activate any per-body via its
  `data-body` token). Fixed stale "34"/"35" force counts in the core guide and force-glyph styles.

## [0.6.0] — 2026-06-15

### Yanked

- **`0.6.0` is a burned version — do not install `@fundamental-engine/*@0.6.0`.** It was published to npm on
  2026-06-15 (`release: v0.6.0`, #483), then rolled back the **same cycle**: it was cut prematurely (a
  thin batch with one half-finished feature), and the repository was reverted to 0.5.0 (`revert: roll the
  repo back to 0.5.0`, #484). The npm version can never be republished, which is why the published line
  skips from 0.5.1 to 0.7.0. Recorded here so every version that ever reached the registry is accounted for.

## [0.5.1] — 2026-06-17

### Added

- **`FieldHandle.addField(name, sampler)` + `sampleField(name, x, y)` — open input-channel registry
  (core).** The render surfaces (`setRender`/`setOverlay`) are bundled *output* layers; this is their
  *input* mirror: register an external scalar field — terrain height, soil moisture, a heat map — as a
  pull-based sampler `(x, y) => number` and read it back through `sampleField`, so a consumer queries
  **one** field instead of bolting a parallel grid alongside it. Returns a `FieldChannelHandle` to swap
  the sampler live or remove the channel. Pull-based (never cached). Force coupling — a force reading a
  channel as a potential — is a separate, opt-in follow-up; this is the read substrate. Mirrored on
  vanilla / elements / three; additive.
- **`BodyHandle.set({ strength, range, angle, spin, color })` — reactive params for programmatic
  bodies (core).** `addBody`'s handle gained the live setter the three `FieldBody` already had: mutate a
  body's force params within a frame on the measure cadence, with no `rescan()` and no remove + re-add
  (a fading lure, a fox getting hungrier). `color` re-tints the carried pigment; a *structural* change
  (different `tokens`) still needs remove + `addBody`. Additive.
- **`FieldOptions.dprCap` + `FieldHandle.setDprCap(cap)` — a configurable render-resolution ceiling
  (core).** The field rendered at full `devicePixelRatio` (hard-capped at 2), the dominant fill-rate
  cost on retina — and the ambient field is soft, so it doesn't need 2× crispness. `dprCap` (default 2)
  caps the backing-store DPR: the effective DPR is `min(devicePixelRatio, dprCap)`, so ~1.5 buys ~1.8×
  fill headroom for a small softening. Settable at creation (`createField({ dprCap })`), at runtime
  (`setDprCap`, re-sizes immediately), and as `<field-root dpr-cap>` (live). Mirrored on vanilla /
  elements / react; additive. (#410)
- **`FieldHandle.addBody(spec)` — first-class programmatic bodies (core).** The only sanctioned way to
  make a body was the `[data-body]` DOM scan, so a non-DOM host (`@fundamental-engine/three`, a native
  view) had to duck-type a fake element + a fake `querySelectorAll` root (#393/#418). `addBody(spec)` is
  the real API: `{ tokens, strength?, range?, spin?, angle?, color?, rect, data?, onFeedback? }`, where
  `rect()` is sampled each frame for the body's box in field px. Two riders from the Field Agent
  Consumption Model: the body **carries a `data` record** (the Body-level analog of a particle's atom)
  and takes **per-body feedback** (`onFeedback` — its channels demultiplexed from the global sink). It
  persists across `rescan()`. Returns a `BodyHandle` (`data`, live `channels`, `remove()`). Mirrored on
  vanilla / elements / three (overloaded with three's mesh form). Additive. (#419 — three's
  `FieldBodyRegistry` collapse onto `addBody` is the remaining follow-up.)

### Fixed

- **`<field-root>` now forwards `FieldOptions.depth` (elements).** `<field-root depth="40">` was a
  no-op — `depth` had no attribute, getter, or forwarding, though core/react/vanilla/three all support
  it. Added the attribute + getter + forwarding, and table-drove `start()`'s option object from one
  `OPTIONS` source so an option can't be silently dropped again; a drift-guard test pins
  `observedAttributes` to that table.
- **`@fundamental-engine/elements` npm metadata corrected.** The package description and README named
  the pre-rename `<forces-field>` / `<forces-cell>` tags, which aren't registered (the rename left no
  aliases). Corrected to `<field-root>` (also registered as `<field-field>`) and `<field-cell>`.

### Removed

- **`setSurfaces` / `getSurfaces` / `SurfacePlan` and `readParticleColors` — pulled before shipping.**
  A design review found both were the rigidity they were meant to solve: `setSurfaces` is a fixed-key
  struct where an open `registerOverlay` registry belongs (the output mirror of `addField`), and
  `readParticleColors` is a half-feature with no consumer. Both were unreleased, so this is **not** a
  breaking change. `setRender`/`setOverlay`/`setHeatmap` and `readParticles`/`readParticleIds` are
  unchanged.

## [0.5.0] — 2026-06-14

### Fixed

- **`@fundamental-engine/three` samplers — EMA-smoothed vector field + core field-line tracing.**
  `vectorField` normalized its arrows by the raw per-frame peak magnitude, so every arrow jittered as a
  transient (a dragged body, an animated strength) shifted the peak frame to frame; it now eases the
  peak (up fast, down slow — the core "pulsing lesson"), so the field reads as a calm pulse (#422).
  `traceStreamline` (the streamline-tube path) re-walked the field forward-only; it now delegates to
  core's `traceFieldLine` — bidirectional (the seed sits mid-line), loop-closing, with a turn budget so
  a vortex can't wind the whole step budget into one circle (#421).

### Added

- **`FieldHandle.readParticleIds(out)` + `Particle.id` — stable per-particle identity (core).** Pooled
  particles were anonymous, so a host couldn't track a specific one across frames (a wind-borne seed,
  a tagged mote) or keep payload attached to it through readback. Each particle now carries a stable
  monotonic `id`, and `readParticleIds(out)` copies them into a caller `Uint32Array` parallel to
  `readParticles` (same order, same agent exclusion) — so `ids[i]` is the identity of the particle at
  stride offset `i*5`. The engine carries the identity; the host keeps its own opaque payload keyed by
  id (spec FieldUI-Engine-Features §1.3). Zero-allocation, read-only. Mirrored on vanilla / elements /
  three; additive — `Particle.id` is optional for back-compat (the engine always sets it).

### Added

- **`FieldHandle.on(type, cb)` — a host-agnostic discrete event bus (core).** The engine emitted
  continuous feedback channels (`density`/`load`/…) but no discrete *occurrences*, so a non-DOM host
  (3D/native/headless) had to poll state every frame to know when something happened. `on(type, cb)`
  delivers occurrences as plain-data push (no DOM, distinct from the `data-on` CustomEvent bindings),
  returning an unsubscribe. First events: **`absorb`** / **`release`** — a `sink` body captured / let
  go of matter (the rising / falling edge of accretion), `{ body, count }`. Detection is lazy — a type
  with no listener costs nothing. (`contact`, `settle`, and per-particle `enter`·`exit` are the next
  slice, #441.) Mirrored on vanilla / elements / three; additive to the (unfrozen) handle.

### Added

- **`FieldHandle.grid(name)` — host-authorable scalar grids (core).** The engine's field-buffer
  primitive (the uniform scalar grid `diffuse` / `memory` / `propagate` run on) is now a public
  surface, so an application can lay down and read its own fields the simulation composes with: a scent
  map, a wear/desire-path layer, a goal-attractor field. `grid(name)` returns a `ScalarGrid` with
  `deposit(x,y,amount)` / `sample(x,y)` / `gradient(x,y)` (forage-by-gradient on an authored field) plus
  the new `decay(rate)` / `clear()`. It is created on first access (allocating nothing until then), kept
  viewport-sized, and advanced once per frame by the mode inferred from its name (`wave…` = wave scheme,
  `memory…` = slow decay, else diffuse). A force of the same name shares the buffer, so a host can read
  what a force writes (and vice versa); a distinct name keeps an authored field independent. Mirrored on
  vanilla / elements / three; additive to the (unfrozen) handle and to `ScalarGrid`.

### Fixed

- **React adapter forwards the full `FieldOptions`.** `<FieldField>` and `useFieldField` destructured
  only 10 of the engine options and silently dropped `depth`, `heatmap`, `overlayBackend`, `rng`, `now`,
  and `feedbackSink` — so `<FieldField heatmap depth={120} />` did nothing. All `FieldOptions` are now
  forwarded to `createBrowserField` in both the component and the hook (declarative ones drive
  recreation via the dep list; the determinism/feedback seams forward but stay out of deps). (#468)

### Added

- **Adapter type re-exports.** `@fundamental-engine/{vanilla,react}` now re-export `AgentSpec`,
  `AgentHandle`, `AtomPayload`, `FeedbackSink`, and `FeedbackChannels` (and vanilla re-exports the
  `cssFeedbackSink` value), so consumers using `field.addAgent(...)` / `field.atomAt(...)` / a custom
  feedback sink don't have to import the types from `@fundamental-engine/core` separately. (#469)

### Added

- **`FieldHandle.sampleGradient(x, y)` — the analytic gradient of the density field (core).** The
  companion `sampleScalar` shipped without a gradient, so callers finite-differenced it — and sampled
  too close in, that re-introduces the exact flattening-at-a-source the scalar exists to avoid (the
  failure that forced foragers back onto explicit seek points). `sampleGradient` returns the `{x, y}`
  direction + steepness (1/px) of increasing density straight off the same diffused heatmap grid
  (central difference, normalized by the eased peak), so it stays non-degenerate at a source: add it to
  a heading to climb toward matter, negate it to flee crowding. Requires the heatmap layer
  (`createField({ heatmap: true })` / `setHeatmap(true)`); returns `{ x: 0, y: 0 }` when off or empty.
  Pure, read-only, maintained under `render: 'none'`. Mirrored on vanilla / elements / three; additive
  to the (unfrozen) handle. (Swift port tracked under #423.)

### Changed

- **Documentation rebrand: `field-ui` → Fundamental, completed.** The #428 code rebrand renamed the
  published packages to `@fundamental-engine/*` but left the docs on the intermediate `field-ui` name.
  This finishes it: ~845 prose/token occurrences swept (`field-ui` → Fundamental, `@field-ui/*` →
  `@fundamental-engine/*`) across `CLAUDE.md`, `docs/canonical`, `docs/research`, `docs/engine-reference`,
  `docs/planning-archive`, code comments, scripts, and the Swift port; the 13 canonical docs lose their
  `field-ui-` filename prefix (e.g. `field-ui-natural-fields.md` → `natural-fields.md`) with every
  reference updated. The original `forces-ui` / `@forces-ui` names, the CHANGELOG/MIGRATION history, and
  the README lineage note are preserved as historical record. No runtime behavior change.

### Fixed

- **Stale `@forces-ui` / `forces-ui` alias claims removed.** #428's hard rename removed the `@forces-ui/*`
  compat packages and the `ForcesField` / `useForcesField` API aliases (the test suite asserts their
  absence), but several docs still described them as live: `platform-architecture.md`
  ("compatibility alias packages re-export…"), `forces-engine.md` ("`@forces-ui/*` are deprecated
  aliases"), the React package's `## Aliases` README section, and CI/release/`check-packaging` comments.
  These claimed shipped surfaces that no longer exist; corrected to reflect the hard rename. The
  `migration.test.ts` guards that pin the old scopes/exports as *absent* are kept (they enforce the
  rename); CHANGELOG/MIGRATION history is unchanged. Docs-only — no behavior change.

### Added

- **`FieldHandle.addAgent` — engine-stepped agents (the creatures primitive, core).** An agent is a
  mesh-bound participant the integrator *moves*: it lives in the particle pool, so it feels every
  force the swarm feels — body forces AND the particle-level ones (`hunt`/`align`/`cohesion`) — and
  each step its `report(p)` fires so an external transform follows it. `maxSpeed` caps it, `species`
  lets tagged bodies (`affects`) steer it selectively, it edge-bounces (not wraps), and
  `readParticles` excludes it. Unlike the self-integrating `FieldAgent` (where the caller integrates),
  the engine owns the motion — the lever that lets particle-level forces act on creatures.
  `@fundamental-engine/three` gains `layer.addAgent(object3d, { maxSpeed, species, hover,
  faceVelocity })`, the aligned successor to `FieldAgent`. Mirrored on vanilla / `<field-root>`. (#438)
- **`cssFeedbackSink` — the feedback CSS adapter, named.** Feedback was already plain data
  (`FeedbackChannels`) through an injectable sink, but the CSS write path (`--d`/`--field-density`/
  `--load`/`--lit`) was unnamed engine-internal default. It's now exported so the DOM door installs it
  explicitly and a non-DOM host (e.g. `@fundamental-engine/three`'s `FieldLayer`) clearly opts out by
  passing its own sink. Behavior is identical — the default for `createField`/vanilla/`<field-root>`
  is unchanged. (#445)
- **Matter tagging — multiple ecologies in one field with selective forces.** A body's new
  `data-affects` (comma-separated species) restricts its forces to that matter — particles whose
  `species` isn't in the set are skipped entirely (no force, no density sample); omit it and the body
  acts on all matter (back-compat, bit-for-bit). A `spawn` source's new `data-species` stamps its tag
  on the matter it emits, so pollen, seeds, and spores can share one field, each pulled only by its
  own attractors/sinks. `@fundamental-engine/three`'s `FieldBodySpec` gains `species` and `affects`.
  (#444)
- **Reactive body params — live `strength`/`range`/`angle`/`spin` without a `rescan()`.** A body's
  hot force params are now re-read from its element on the measure cadence, so changing `data-strength`
  on a DOM body (or calling `FieldBody.set({ strength })` in `@fundamental-engine/three`) takes effect
  within a frame. Only attributes actually present override, so preset/intent bodies are untouched.
  `@fundamental-engine/three`'s `FieldBody` gains `set({ strength, range, angle, spin })`. (#442)
- **`FieldHandle.sampleScalar(x, y)` — smooth, gradient-capable density sampling.** Returns the
  diffused density scalar ∈ [0,1] (the heatmap grid, bilinear-sampled) at a point, so its gradient
  stays meaningful *at* a source — what forage-by-gradient needs (a nearest-body readout flattens
  there). Requires the heatmap layer (`createField({ heatmap: true })` / `setHeatmap(true)`); returns
  `0` when off; updated each frame including under `render: 'none'`. Mirrored on
  `@fundamental-engine/vanilla`, `<field-root>`, and `@fundamental-engine/three`'s `FieldLayer`.
  Additive. (#440)

### Fixed

- **Rebrand stragglers in user-facing engine strings.** The `inspect` example recipe's `intent`, the
  system-report heading, and the canvas-context error/warn messages still said "field-ui"; renamed to
  "Fundamental". Copy-only — no API, recipe structure, or behavior change.
- **The density heatmap no longer reacts to scroll.** It was suppressed while scrolling (draw only when
  `scrollV < 6`), so the glow popped off the instant you scrolled and back on when you stopped — choppy.
  The scroll coupling is removed entirely: the heatmap is a continuous ambient layer that draws every
  frame when enabled. The original perf intent is served by the existing compute throttle (the texel
  grid recomputes only every 3rd frame), so the per-frame cost is just the cached bilinear upscale.
- **Engagement listeners no longer accumulate on a long-lived field.** `bindEngagement()` deduped via
  `data-fx-engaged` but, unlike the body/emitter reconciliation, never pruned `[data-hot]` elements that
  had left the DOM — so a persistent field (the page `<field-root>` with `transition:persist`) outliving
  the elements swapped under it could retain detached nodes and their pointer/focus listeners across
  rescans. Each rescan now drops disconnected engagements, releasing their four listeners and the array
  ref. (Latent: didn't manifest in a 20-navigation heap probe, but closed for very long sessions.)
- **Frame-rate-independent particle motion.** `env.dt` was a flat `1` regardless of framerate, so the
  per-frame sim ran 2–4× faster once the perf work lifted the homepage to 60–120fps. dt is now the real
  frame interval normalized to a 60fps baseline (≈1 at 60fps, clamped so a stall can't teleport matter);
  position alone is dt-scaled, forces/friction stay per-frame by design. Mirrored to the Swift port. (#434)
- **Particle glow is now crisp points.** #416's three-disc soft glow — *and* the older heat-scaled halo
  it had replaced (`size + 3 + 6*h`) — both bloomed into large overlapping rings wherever the accretion
  sink heats a cluster (every particle there reaches `h≈1`). Particles now draw as a crisp core with a
  single fixed ~1px bloom; heat reads through the core's brightness and size, never a growing aura. (#434)
- **Lifecycle teardown closes registry + observer leaks.** `platform` destroy now prunes stale registry
  entries and disconnects its observers; `@fundamental-engine/three`'s layer tears down its body registry
  on destroy and reuses overlay GPU buffers instead of reallocating them per frame. Repeated
  field teardown/rescan no longer retains detached entries or leaks observers. (#463)

### Performance

- **Reuse draw/flow scratch instead of allocating per particle per frame.** The core draw and flow paths
  allocated scratch (`flowBias`/`particleRGB`) per particle per frame; the hot loops now pass shared
  module scratch via internal write-into variants — the public `flowBias`/`particleRGB` stay as thin
  wrappers, math bit-for-bit unchanged. (#463)

## [0.4.0] — 2026-06-13

### Changed

- **Renamed: `@field-ui/*` → `@fundamental-engine/*`.** The project is now **Fundamental**
  (`fundamental-engine.com`). All packages move to the `@fundamental-engine` scope, and the one-install
  umbrella is now the bare package **`fundamental-engine`** (`npm i fundamental-engine`), replacing
  `@field-ui/kit` / `@field-ui/field-ui`. A **hard rename** — the deprecated `@forces-ui/*` compatibility
  shims are dropped (there are no external consumers yet). The **engine's primitive is unchanged**:
  `<field-root>`, `FieldHandle`, `createField`, and the `--field-*` CSS variables stay — *fundamental
  forces act across a field*. Old `@field-ui/*` packages will be deprecated on npm pointing here.

### Added

- **`FieldAgent` — an `Object3D` that rides the field (`@field-ui/three`).** The creatures
  primitive: a specific scene object (a bee, a fish, a drone) that samples the live field at its own
  position each frame, steers along the force (acceleration toward it, drag, a top speed, optional
  wander and hover-bob), and writes its world position through the shared `FieldProjection`. Agents
  are consumers, not bodies — they feel the field but exert nothing back unless also registered with
  `addBody`. The `sampler` is the `FieldSampler` interface, so an agent can follow a layer, a raw
  handle, or any custom blend. Renderer-free and unit-tested. (#426)

### Changed

- **`@field-ui/three`'s `three` peer range relaxed to `>=0.147.0`** (was `>=0.150.0`). An API audit
  shows the package touches only long-stable three symbols — the newest are `InstancedMesh` (r109)
  and `Object3D.clear()` (r123) — and r147 is verified live in a real integration (a no-build game
  pinning `three@0.147`). The old floor forced `?deps`/import-map overrides to fight the manifest;
  now the declared range matches reality.

## [0.3.1] — 2026-06-12

`@field-ui/three` joins the published family — the Three.js authoring surface (the engine headless,
its swarm and structure rendered in a WebGL scene), plus the two engine read-outs it consumes. All
additive; the frozen API surface is unchanged.

### Added

- **`FieldBodySpec.color` — pigment tint on mesh-bodies (`@field-ui/three`).** The scanner reads a
  body's tint from `el.dataset.color` (the `pigment` force's conserved color transport); the virtual
  element now carries it from the spec, so a registered mesh can dye passing matter with its color.
  (#418)
- **`FieldHandle.sample(x, y)` — read the live field at a point.** Returns the net force a still test
  particle would feel as `{ x, y }` (a thin wrapper over `forceAt(bodies, forces, env)`): pure,
  read-only, samplable at any resolution. The seam external 3D visualizers consume to build their own
  field geometry. Mirrored on `@field-ui/vanilla` and `<field-root>`; additive, the frozen API surface
  is unchanged.
- **`@field-ui/three`: meshes as bodies.** `layer.addBody(object3d, spec)` (and `FieldBodyRegistry`)
  registers a `THREE.Object3D` as a field body — it bends the field and the swarm responds, while
  `density` / `load` / `lit` feedback flows back onto the mesh (drive a uniform from `onFeedback`).
  Crucially the body **carries a `data` record** (a genome, an inventory), so a mesh can be a
  meaningful agent, not just a force. Needs no core change — the body is a lightweight non-DOM
  element scanned through the host, its rect projected from the mesh's world position.
- **`@field-ui/three`: native field visuals.** `vectorField()` (instanced arrow grid) and
  `streamlineTubes()` (traced flow tubes) build scene geometry from `FieldHandle.sample()` — the
  field's structure rendered directly, not via particles. The tracing core is pure and tested.

- **`@field-ui/three` — bind the field engine to a Three.js scene.** A new authoring-surface
  package that runs the engine headless (`render: 'none'`) and renders its conserved swarm as a
  `THREE.Points` layer: `createFieldLayer()` / `FieldLayer` (which implements the full
  `FieldHandle`, so `burst`/`flowTo`/`setFormation`/`seed` drive the 3D layer). A `FieldProjection`
  coordinate seam maps the field to world space — `PlaneProjection` (flat, stylistic heat-relief) or
  `VolumeProjection` (the engine's real depth lane; `createFieldLayer({ depth })` selects it). Also
  ships `threeHost()` (the `FieldHost` for a WebGL scene) and `threeBackend()` (a `RenderBackend`
  drawing the diagnostic line overlays — streamlines, field-lines, grid, contours — as scene
  geometry). `three` is a peer dependency. (#408)
- **`FieldHandle.readParticles(out)` — render-agnostic swarm read-out.** Copies live particle state
  into a caller-owned `Float32Array` (stride 5: `x, y, z, heat, size`; `z` is the optional depth lane
  from the z-axis, `0` in a flat field) and returns the count written. Zero-allocation and read-only,
  so a surface with no 2D context (the `@field-ui/three` particle bridge) can draw the swarm directly.
  Mirrored on `@field-ui/vanilla` and `<field-root>`; additive, the frozen API surface is unchanged.
  `RenderBackend` / `Stroke` are now also exported from `@field-ui/core` for external surfaces to
  implement. (#408)

- **`overlay` prop for `@field-ui/react` — Field Surfaces parity with `<field-root>`.** The
  `<FieldField>` component and `useFieldField` hook now accept an `overlay` prop (`OverlayInput`
  — one mode or an additive stack) that activates the front overlay surface. The component
  lazily creates a fixed, full-viewport, `pointer-events:none`, `z-index:5`,
  `mix-blend-mode:screen` canvas on `document.body` when an overlay mode is first set —
  matching the pattern of `<field-root overlay="…">` — and removes it on unmount. The
  `overlay` dep is wired into the effect's dep array alongside the other engine options, so
  changing the mode re-creates the field with the new overlay. Purely additive; no behavior
  changes when `overlay` is omitted. (#352)
- **`render: 'flow'` — particles and the streamline arrows in one underlay canvas.** A new
  underlay render mode that draws the dot swarm AND the field's streamline arrows together in
  the single `<field-root>` canvas — the particles drifting along the visible flow — with no
  separate front surface and no `mix-blend`, so it stays one cheap composited layer.
  (`'streamlines'` still draws the arrows alone; `'flow'` keeps the dots underneath.) Accepted
  by `createField({ render: 'flow' })`, `setRender('flow')`, and `<field-root render="flow">`.
  Additive — the frozen API surface is unchanged. (#405)

### Fixed

- **Smoother scrolling with the streamline arrows on.** The underlay streamlines / `flow` arrows
  re-sampled the whole force-field grid every frame, even though the sampled field is driven by
  body positions that only update on the `measureBodies` cadence (every 6th frame). The grid is
  now resampled every 3rd frame (or when the cache is empty / a flow focus is animating) and the
  arrows draw from the cache every frame — no flicker or stepping, ~3× less per-frame work for the
  flow layer, and dropped frames during scroll fall sharply. (#406)
- **The density heatmap is much cheaper per frame.** Its texel grid is now recomputed on a cadence
  (every 3rd frame) into a reused `ImageData` buffer instead of being rebuilt and reallocated every
  frame, and the full-viewport bilinear-upscale draw is suppressed while the page is scrolling fast
  (eased `env.scrollV`) — the heatmap is ambient density you read at rest, not detail you track
  mid-scroll, so it returns the instant the page settles and scrolling never pays its fill cost.
- **Particles render as a soft glow, not a solid disc.** Each particle is now three concentric
  additive discs — a wide faint aura, a mid body, a small bright core — summing under the `lighter`
  composite into a smooth radial falloff, so matter reads as *light* rather than a hard filled
  circle. Cheap (a few small arcs; no per-particle gradient or shadowBlur). And a sink's captured
  matter renders again as its dim orbital cloud (an earlier change had removed it entirely) — the
  body visibly gathers and holds a real swarm before the supernova flings it back out; still
  conserved either way.
- **The Field-Surfaces overlay canvas no longer costs framerate when idle.** The full-viewport
  `mix-blend-mode: screen` overlay canvas was left in the compositing tree even with `overlay:
  off`, so the browser re-blended the whole screen against the animating underlay every frame —
  roughly halving the framerate of a singleton page field since the surface landed. `<field-root>`
  now takes the canvas out of the tree (`display: none`) whenever no reading is active and restores
  it when one is set. Visible-overlay behavior is unchanged. (#405)
- **`[data-dock]` collapsed elements and emit clones now set `inert` alongside `aria-hidden`**, so focusable descendants inside a scale-collapsed mover or a decorative emit clone are removed from the tab order and cannot receive keyboard focus while invisible. `inert` is removed on all restore paths (undock, teardown). (#353)
- **`scan()` / `rescan()` reconciles consumer state across rescans** instead of rebuilding from scratch: persisting `[data-move]` elements carry their offset and dock progress forward (no reset during a live animation), and `[data-emit]` emitters carry their existing clones forward so repeat scans no longer accumulate up to `cap × rescans` clones. Clones from emitter elements that have left the scan root are removed on the next scan. (#354)

## [0.3.0] — 2026-06-12

A native **Swift port** of the engine also landed this cycle — `FieldUICore` /
`FieldUIPlatform` / `FieldUIVanilla` / `FieldUISwiftUI` mirroring the npm family, plus the
**FieldLab** macOS showcase app, byte-equivalent to the JS engine at z = 0. It lives in
[`swift/`](swift/README.md) and is versioned separately from these npm packages.

### Added

- **`background: 'transparent'` — the underlay can sit over light content.** The engine painted a
  near-black substrate every frame, so the underlay blanked out anything beneath it (a 3D scene,
  an image, a light page) — consumers had to reach for a `mix-blend-mode: screen` workaround. A new
  additive `FieldOptions.background` (`'opaque'` default · `'transparent'`) clears to transparent
  instead, so the bright matter composites over the content and trails light-paint that fade to
  transparent rather than to black (`destination-out`). Live via `field.setBackground(mode)`,
  declaratively via `<field-root background="transparent">`, and as a prop on the React component.
  Purely additive — the default is unchanged.

- **Traced field lines + the `gravity-field` preset.** The `field-lines` overlay reading now draws
  the field's real *structure as curves* instead of sampled arrows: `fieldLineSeeds` (new,
  `@field-ui/core` `fieldline-seeds.ts`) seeds each field-bearing body by its own geometry — a
  dipole's perpendicular bisector for a magnet, a core ring for a monopole `charge`/`gravity` well —
  and `traceFieldLines` follows the **net** field through every seed, so the bar-magnet loops, the
  radial spokes, and the linkage between two bodies all emerge from the math (bodies that radiate no
  `field()` get no seeds, so the diagram stays the structure, never a starburst). `FIELD_BEARING_TOKENS`
  is the canonical set (`magnetism`, `charge`, `gravity`). Built on this, the experimental
  **`gravity-field`** recipe presents gravity as a *visible, followable natural field* — `gravity`
  radiates the monopole structure the lines trace, and a light `swirl` makes infalling matter thread
  those lines in orbit rather than dropping straight in. It joins `EXPERIMENTAL_RECIPES` (outside the
  locked 64; `gravity` and `swirl` stay their own force tokens).

- **`fieldLineSeeds` / `dipoleSeeds` / `monopoleSeeds`** (`@field-ui/core`, `fieldlines.ts`).
  The field-line *seeding* algorithm — where to start tracing so the diagram is the correct
  STRUCTURE (dipole loops seeded along the heading's perpendicular bisector; monopole spokes
  from a core ring) — was app-only, living in `apps/site/src/lib/field-probe.ts`. It is now a
  pure core export with the synthesized-dipole fallback the field math uses, so every consumer
  (the site's force chips, the native renderers, any future bridge) shares one definition. The
  site's `traceDipole` is refactored onto it; behavior is unchanged.

- **`<field-root heatmap>`** — the density heatmap layer (field-systems H1) is now a declarative
  attribute on the element runtime (observed, toggles live via `setHeatmap`), alongside the
  existing `mass` / `attention` / `causality`. The handle and `FieldOptions` already supported it;
  this exposes it to HTML authors. Documented in the regenerated custom-elements manifest.

- **Recipes execute their declarations.** `recipe.render` and per-body condition gates stop being
  descriptive (#370): `compileRecipe` now derives an executable render plan (one underlay matter
  mode, the additive overlay reading stack, the heatmap toggle — unmappable layers are NAMED in
  `plan.unapplied`, never silently dropped), and `applyRecipe` gains a structural `field` target
  (`FieldHandle` and `<field-root>` both fit) that it drives with the plan and releases on
  `destroy()`. `BodyRecipe.when` is the new executable gate — compiled to `data-when`, validated
  against the engine's registered condition ids so an unknown gate is a validation error rather
  than a silently-never-passing body. The `contour-charge` recipe now carries its own engagement
  gate. Fully additive: without a `field` option recipes stay signals-only as before; `renderless`
  and reduced motion skip the drive.

- **Injectable randomness and wall clock (#371).** Every random draw in the engine — particle
  seeding, spawn scatter, brownian wander, force jitter and emission cones, release angles —
  now flows through one source: `createField({ rng })` (default `Math.random`), carried to
  forces and the integrator as `env.rng`. A seeded generator makes a run reproducible — the
  seam record/replay needs, pinned by a bit-identical two-run test. The wall clock joins it:
  `createField({ now })` (default `performance.now`) feeds input-idle tracking, completing the
  three-clocks separation (wall / frame / simulation — see temporal.ts).

- **RenderBackend — the drawing seam (#373).** The structural contract between the engine and a
  drawing surface (`size` / `clear` / `segments` / `polyline` / `rect` / `text`), with the
  Canvas 2D implementation as the default. The OVERLAY surface — all eight readings — now
  renders exclusively through it; `createField({ overlayBackend })` accepts any conforming
  implementation, which is the seam the WebGL/WebGPU frontier builds on. The underlay matter
  modes (dots' gradients, metaballs, voronoi) still draw on the 2D context directly and convert
  in a later slice — the contract grows additively when their needs (gradients, composite modes)
  arrive. Contract pinned by recording-stub tests.

- **`FieldLineOpts.maxTurns` — a turning budget for the field-line tracer** (`@field-ui/core`,
  `fieldlines.ts`). A traced line orbiting a pole that never passes back through its *seed*
  (so `loopDist` can't close it) otherwise winds the same circle for its whole step budget —
  hundreds of overlapping segments that waste the trace and, on renderers whose antialiaser
  computes path self-intersections, explode stroke cost superlinearly (measured at ~3 s/frame
  in the Swift CoreGraphics renderer before this guard; ~81× faster after). The budget counts
  cumulative heading change in full revolutions; `Infinity` — the default — preserves the
  unbounded behavior exactly, so existing consumers and goldens are untouched. Renderers
  tracing dipole fields should pass ~`1.5` (a closed dipole line turns exactly one revolution).

- **Attention-gated discharge + the `contour-charge` recipe.** A sink gated on engagement
  (`data-when="active"`) now RELEASES what it holds on the falling edge of attention — the same
  conserved supernova ritual (same radial burst, same `field:released` event) that saturation
  fires; capture was already gated, release now matches (`dischargeDisengaged`, accretion.ts).
  The experimental `contour-charge` recipe names the composed behavior — attract + sink gated on
  `active`, glow ∝ `--load`, glyph-outline rings as the bound representation — and joins the
  wayfinding pair in `EXPERIMENTAL_RECIPES` (bare `charge` stays the electric force token; the
  compound respects the one-word-one-lane rule). The home Gallery demos it live: dwell on the
  Charge mark to fill it, look away and it lets go.

- **Contour primitive — glyph outlines from any font (`@field-ui/platform`).**
  `contourPathData(font, text, size)` lays out text as combined glyph-outline SVG path data
  (per-glyph + pair kerning; Latin display scope), and `contourSvgFor(el, font)` generates the
  aria-hidden contour-ring SVG from a body element's own text and computed font-size, binds it
  with `data-field-visual-for`, and lets the Bound Visual mirroring drive its rings from the
  body's live `--d` / `--load`. The caller supplies the parsed font — any object matching the
  `ContourFont` contract (opentype.js's `Font` fits directly) — so the primitive works with
  whatever face the author applied to the element and field-ui stays zero-dependency. The same
  function powers the site's build-time generation (`gen-contours.mjs`).

- **The optional z lane — a not-required third axis** (`@field-ui/core`,
  [docs/engine-reference/z-axis.md](docs/engine-reference/z-axis.md)). The engine simulates an
  opt-in depth dimension: `createField({ depth: 300 })` seeds matter through a shallow volume
  behind the page, bodies stay on the page plane (z = 0) and their falloffs pull matter back
  toward it, z integrates/damps/wraps toroidally, the `c` cap bounds the full 3D speed, and the
  dots render recedes (smaller + fainter) with depth. **Flat is exact:** with no `depth` — the
  default — every z term multiplies away to nothing and the engine matches its prior behavior
  bit-for-bit (enforced by the `z-axis.test.ts` suite). Every new field is optional
  (`Particle.z`/`vz`/`gz`, `Env.dz`/`D`, `FieldOptions.depth`) so existing `Particle`/`Env`
  literals keep compiling unchanged; no public call signature changes (`burst(x, y)` et al. act on
  the plane, their effects extending into the volume automatically). Distance is 3D everywhere
  (the body delta, range cull, spatial-hash filter, sink absorption, sampling, atom picking,
  kinetic energy); radial forces gain a spherical z leg; the neighbour forces (`collide` —
  spheres, not discs — `cohesion`, `pressure`, `link`, `hunt`, `align`) are truly 3D; the
  deliberately-planar set (`wall`, `magnetism`/`lens`, the currents, the grids, the modifiers) is
  documented per-force with its reasoning.

- **Bound Visual Sink — state mirroring for visual bindings.** The platform's
  `VisualBindingRegistry` now mirrors a semantic body's feedback channels (`--d` /
  `--field-density`, `--load` / `--mass`, `--lit`, and the measured metrics — the exported
  `MIRRORED_CHANNELS`) onto every bound `representation` / `measurement` visual
  (`data-field-visual-for`), change-gated via a MutationObserver on the source's style attribute.
  CSS custom properties don't cross to siblings, so an `aria-hidden` SVG beside a sink heading can
  now thicken its contours from `var(--load)` exactly as authored — the element absorbs, the visual
  shows what absorption means, the text stays the source of meaning. On by default in
  `createFieldPlatform` (`visuals.setMirroring(true)`); the element runtime scans declarative
  visuals at start. The canon now names the sink tiers: Element Sink · Text Sink · Bound Visual
  Sink · Contour Sink (Body Matter Interaction → Sink/Accretion).

- **`bindFieldNav` + the inert-metric-lane guard.** The navigation-chrome idiom the site
  hand-spread across ~12 surfaces (run a recipe signals-only over a nav's `<a href>` links, pin the
  current as the well, mark visited links, return a teardown) lifts into
  `bindFieldNav(root, recipe, { pin, visited, extraMetrics, reducedMotion })`
  (`@field-ui/platform`); reduced motion → `null` (plain, reachable links). Paired guard:
  `classifyMetric(name)` splits a recipe's metric lanes into **computed** / **supplied-only** /
  **designed** (`COMPUTED_METRICS` + `SUPPLIED_ONLY_METRICS` partition `METRIC_KINDS`), and the new
  `lintInertFeedback` rule (now in `lintPlatform`) flags a feedback binding to a designed
  `--field-<m>` lane the host never supplies — declared but never written, the same silent-contract
  class as `lintSinkFeedback`. The `/recipes` pages now document each metric's lane support. All
  additive and unfrozen.

- **Field Surfaces: additive overlay readings.** `setOverlay` (core, `<field-root overlay>`,
  vanilla) now accepts one reading **or a stack** — an array (`['grid','path']`) or a
  space-separated attribute (`overlay="grid path"`) — drawn in order on the front surface, so
  several readings compose over any underlay matter mode. Five new readings join
  `streamlines` / `force-vectors` / `field-lines`, all line/text diagnostics (the overlay reveals,
  never occludes): `grid` (a reference lattice displaced by the field — deformation),
  `temperature` (iso-contours of particle heat), `energy` (iso-contours of kinetic energy),
  `path` (streamline curves traced from seeded probes), and `data` (numeric `--d` density
  readouts beside each measuring body). The home Field Surfaces panel now defines every mode
  in place and exposes the readings as additive toggles, scoped to the panel in view.

The **physics workover** begins: a designed / natural / hybrid substrate that makes the
engine more physically coherent without losing the designed interface feel. The full plan
and an as-built audit live in [`docs/engine-reference/physics-workover.md`](docs/engine-reference/physics-workover.md); the
work ships across v0.3 to v0.6. (The audit's headline: first-class mass, softened
inverse-square gravity/charge, `b.accreted`, and class-[S] source/sink budgeting already
ship, so the work is the mode system, medium formalization, safety layer, `screen`,
metrics, and the transformation primitives, not re-building what exists.)

### Changed

- **A supernova now ejects captured matter as PERSISTENT field matter** (`@field-ui/core`,
  `accretion.ts`). When a sink saturates and supernovas, `releaseCaptured` clears each released
  particle's `age`: mortal class-`[S]` source-spawned matter that the sink captured and held is
  released **immortal**, so a `spawn → sink → supernova` loop visibly conserves — the matter a
  source made rejoins the lasting field instead of silently dying once released. A **no-op for the
  conserved base pool** (whose particles already have no `age`). Closes a long-standing gap where a
  source's output, once captured and released, would quietly expire rather than return to the field.

- **A supernova now ejects matter PAST the absorption radius, so the sink cycle repeats**
  (`@field-ui/core`, `accretion.ts`). `releaseCaptured` placed ejecta *at the core* — inside
  `absorbR` — so the sink re-captured its own ejecta on the very next frame, degenerating the
  explosion into a ~1-per-frame strobe whose blast progressively evacuated the catchment until the
  sink fell dormant ("exploded once, won't collect again"; ejecta appears to accelerate away and
  never return). Each particle is now ejected just past `absorbR` along its bearing, so matter
  leaves the accretion zone, a `sink+attract` well reels it back, and the
  fill → explode → fall-back → refill cycle repeats at a real period (≈9 frames vs ≈1; in a headless
  `sink+attract` repro, supernovas drop from 581 to 66 per 600 frames while the catchment stays
  populated instead of decaying). A lone `sink` simply lets the ejecta disperse.

### Fixed

- **One source of truth for reduced-motion and page-visibility probes (`@field-ui/platform`).** Four
  independent `matchMedia('(prefers-reduced-motion: reduce)')` calls and two direct `document.hidden`
  reads scattered across `flip.ts`, `field-nav.ts`, `apply-recipe.ts`, and `browser-host.ts` have
  been consolidated into a single `env.ts` module exposing `prefersReducedMotion()` and
  `pageHidden()`. Both helpers are SSR-safe (return `false` when `window`/`document` are absent) and
  accept overrides via `setEnvOverrides` / `clearEnvOverrides` — a clean test seam that replaces
  the previous approach of stubbing `globalThis.matchMedia` in tests. `browserHost()` implements its
  `reducedMotion` and `hidden` methods through the helpers; `flip.ts` tests now use `setEnvOverrides`
  instead of patching the global. The site-level `politeLoop` (apps/site) gains injectable
  `isHidden` and `onVisibilityChange` options (both default to the live `document` behaviour) for
  the same reason.

- **Platform registries close their exits.** Three registries leaked entries for elements that
  left the DOM: `FeedbackRegistry` (no unregister at all — bindings and thresholds for removed
  elements flushed forever), `RelationshipRegistry` (unresolved edges accumulated and were never
  re-resolved when a target later mounted), and `StateRegistry` (per-key `delete` stranded empty
  listener maps). Each now prunes disconnected elements at its natural moment — `flush()`,
  `discover()` (which also re-resolves late-mounting targets by replacing the unresolved set),
  and a new `prune()` — and gains an explicit `unregister(element)` for immediate reclamation,
  matching the standard `MeasurementRegistry` and `VisualBindingRegistry` already set.

- **Warp pair ghost (#368a).** When a paired element (resolved via `data-pair`) leaves the DOM,
  `updateWarpTargets` now clears `pairBody` and `warpHas` so the wormhole closes instead of
  relocating matter to the detached node. The link re-resolves naturally on the next rescan.

- **Docked element removal (#368b).** A `[data-dock]` mover whose DOM node is removed while
  docked no longer leaves the sink believing it holds that element. `updateMovers` now detects
  `!el.isConnected`, clears `mv.docked` / `mv.dock.dock`, and skips all per-frame work for
  the detached element — symmetric with how the rescan reconciliation handles departed bodies.

- **Heatmap buffer persists across disable/enable (#369).** `setHeatmap(false)` now calls
  `heatmap.clear()` before releasing the buffer, so a paused or mid-accumulation field never
  bleeds stale density into the next active session. Re-enabling creates a fresh instance.
  `Heatmap.clear()` (new) zeroes the grid and resets the peak tracker; `ScalarGridImpl.clear()`
  (new) fills all three internal buffers with zero.

- **`priority-well` recipe note corrected.** It claimed `density` writes back as `--field-density`;
  that lane is host-supplied (ground it with `data-field-density`) — the engine's live density
  channel is `--d` on `data-feedback` bodies. Surfaced by the new metric-lane classifier.

- **Streamlines arrow-field pulsing eliminated.** The `streamlines` underlay render and all three
  overlay arrow modes (`streamlines`, `force-vectors`, `field-lines`) normalized arrow length and
  alpha to the raw per-frame peak magnitude, so any frame-to-frame shift in `maxMag` (body drag,
  animated strength, charge-feedback density ramp) rescaled the entire arrow field at once — a
  visible flash/pulse. Both renderers now maintain an independent EMA of their normalization
  reference (rise alpha 0.3, decay alpha 0.1), seeded on the first frame, so the scale tracks
  real changes while smoothing transients. The underlay and overlay carry separate state and
  cannot cross-influence each other.

- The home manual's last two untraced stages now trace real engine runs: **`fieldflow`**
  pairs with a magnet on the live chip (it advects matter along the *net* field other
  forces radiate, so alone it had no lines to follow — the demo itself was a silent
  kinematic no-op, not just untraced) and **`warp`** wires its pair target headlessly the
  way the conformance experiment does, showing the conserved relocation from throat to
  pair. Both gained per-force demo-accuracy tests, and the e2e boot test dropped its
  `UNTRACEABLE` exception list — every chip-bearing stage must hold exactly one traced
  canvas.

## [0.2.3] — 2026-06-10

The cycle that built the **invisible-fields family** — twelve real-data example pages whose
render surface is the page's own type — and shipped the engine/platform capabilities the
family proved out. The pattern is canonical in
[`docs/canonical/invisible-fields.md`](docs/canonical/invisible-fields.md).

### Added

- **`FieldHandle.scrollV()`** — the engine's eased page-scroll velocity (the `scrolling`
  condition gate's EMA), mirrored to **`--field-scroll-v`** on `:root` by the platform write
  phase (deduped when unchanged). Experimental surface; px/frame, refresh-rate dependent.
- **`FieldHandle.setVisible(on)`** — element-level visibility hint: `false` skips all draw
  work while the simulation and feedback signals stay live. `<field-root>` wires it
  automatically from an IntersectionObserver. Under reduced motion the static scene redraws
  at quarter rate.
- **`render: 'none'`** — the signals-only engine mode (#297): created with `'none'`, a field
  never acquires a canvas context, never sizes a backing store, never allocates render
  scratch — it exists purely as signals (`--d`, `--load`, `--lit`, events, `scrollV`).
  `setRender` out of `'none'` acquires the context lazily.
- **`QualityGovernor`** + the **`field:quality-tier`** event — adaptive frame-budget tier
  detection (0–3, asymmetric escalation/recovery); the `<field-root>` runtime feeds it,
  skips discontinuity frames, resets on `visibilitychange`, and throttles its own platform
  tick at tiers 2–3 as the built-in consumer.
- **`FeedbackRegistry.cssWritesLastFrame()`** — the actual per-frame DOM write count
  (mirrored `--field-*`/`--forces-*` pairs count as 2), distinct from `boundVars().length`.
- **`PlatformRuntime.attachHandle(handle)`** — post-hoc wiring of the engine handle into the
  platform runtime (scroll-v writes + governor monitoring).
- **`withFlip()`** in `@field-ui/platform` (#295) — the FLIP reflow helper extracted from the
  example runtimes (1D/2D, exclude hook, reduced-motion guard).
- **`allocateAttention()`** in `@field-ui/core` (#296) — conserved water-filling allocation
  (Σw = budget exact, pins take the cap, capped excess re-flows), unit-tested for exactness.
- **The invisible-fields example family** at `/evidence/<slug>` — twelve pages over committed
  real-data snapshots (refreshed weekly by CI) with live in-browser upgrades, provenance
  chips, and per-page signature mechanics; pinned by a 62-test Playwright matrix
  (chromium · webkit · Pixel-7 touch).

### Fixed

- `[hidden]` on styled grid/flex elements is restated in author CSS (the UA default loses).
- Sparkline draw-ins use `pathLength="100"` keyframes ending dash-free (WebKit dash-precision
  artifacts at `pathLength="1"`).
- Touch drag on the backlog board arms by long-press (touch-action latches at gesture start).
- The dependencies snapshot reads publish dates from the full packument (`/latest` omits
  `time`).
- `threads`' depth variable renamed `--depth` (it collided with the engine's `--d` channel).

### Expanded the field-ui model (migration plan Phases 4–8)

On top of the migrated, stabilized base, the field-first model was built out — all engine-side,
pure, and node-tested, with no change to the preserved physics:

- **Contracts** (`core/contracts`): formal contract types, a validated `ForcePassport` for all 34
  forces, the Error-Taxonomy dev-mode guards, and an inspectable contracts catalog.
- **Agents** (`core/agents`): the FieldAgent model — element, relationship, user, layout, and data
  agents, plus a thresholded EventAgent (hysteretic, debounced) runtime.
- **Visual language** (`core/visual`): bounded metric→appearance mappings (typography, color,
  shape, emission), lint rules, and the semantic-text fallback.
- **Authoring & recipes** (`core/recipes`): the serializable SceneRecipe schema + validation, the
  intent compiler, the essential-recipe gallery, and Explain-This-Field / Field-Diff.
- **Inspection** (`core/inspect`): deterministic snapshot regression, a performance-budget
  inspector, and an aggregate system report.

The suite grew to 476 tests. App-level surfaces (Composer, Inspector UI) remain the frontier.

### Migrated to field-ui

The project moved from `forces-ui` to **field-ui** — a field-first framing where the field (the
invisible structure) is the primary abstraction. This is a rename + alias pass, **not** a rewrite:
no force formulas, integrator behavior, magnetism (Lorentz `F = q(v × B)`), fieldflow, render
math, heatmap math, force tokens, or `data-*` authoring changed. The migration plan is
`docs/field-ui-migration-plan.md` (since retired).

Every old public name keeps working as a compatibility alias during the transition:

- **Packages** renamed: `forces-ui` → `field-ui`, `@forces-ui/{elements,react,vanilla}` →
  `@field-ui/*`. Thin re-export alias packages keep the old specifiers resolving.
- **Events**: `field:register-body` / `field:unregister-body` / `field:update-body` are now
  dispatched and listened for alongside the `forces:*` names.
- **CSS variables**: `--field-density` / `--field-heatmap-density` are written alongside
  `--forces-density` / `--forces-heatmap-density` (same values).
- **Elements**: `<field-root>` / `<field-field>` / `<field-cell>` register alongside
  `<forces-field>` / `<forces-cell>`; React gains `FieldField` / `useFieldField`, vanilla gains a
  `FieldField` alias.

Aliases will be removed in a future major once docs, examples, and downstream code have moved.

### Added

- **`@forces-ui/vanilla` — a framework-free TypeScript wrapper.** A fourth package exposes the
  imperative API as a typed `ForcesField` class (it manages a canvas for you, or drives one you
  own) alongside `mountField()` and a re-exported `createField()` plus the catalog — with no
  custom-element registration and no framework dependency, so importing it has no side effects.
  `mountField` now lives here as its canonical home; `@forces-ui/elements` re-exports it, so
  existing `import { mountField } from '@forces-ui/elements'` is unchanged. The developer portal
  gains a **TypeScript** guide for it.
- **`waves` is now a real toggle.** `FieldOptions.waves` (and `<forces-field waves>` / the React
  `waves` prop) now actually gates the background Currents — default stays `true`, set `false`
  for the bare free-particle field. It was previously accepted but ignored.
- **`scrolling` `data-when` gate wired.** `data-when="scrolling"` now acts only while the page is
  actually scrolling: the engine eases a per-frame scroll speed into `env.scrollV` and the gate
  fires above `0.25`. It was cataloged but inert before (silently acting "always").
- **`mass` on the web component.** `<forces-field mass>` now opts into first-class mass (§21.3),
  matching the React adapter and the `ForcesField` class; the option was previously React-only.
- **SSR-safe imports + a browser-only guard.** Importing `@forces-ui/elements` no longer throws
  `HTMLElement is not defined` under server-side rendering (the custom-element base is guarded),
  and `new ForcesField()` / `mountField()` from `@forces-ui/vanilla` throw a clear "client only"
  error during SSR instead of a cryptic `document is not defined`. A new `pnpm check:dist` smoke
  check (in CI and the publish checklist) verifies every package's entry points import cleanly.
- **Global velocity cap + safety conformance sweep.** The integrator now clamps every free
  particle's speed to the unit system's `c` (12) each step, so no canonical force or
  composite can produce a runaway (the natural primitives already self-clamped; this makes
  it universal). A new conformance **safety sweep** runs every experiment and asserts the
  whole trajectory stays finite (no NaN/Infinity), positions finite, speed ≤ c, heat
  bounded, and the particle count stable unless a budgeted [S] source is active.

### Changed

- **BREAKING — six canonical force tokens renamed to functional terms.** `vortex → swirl`,
  `spring → tether`, `emitter → jet`, `drag → viscosity`, `reflect → wall`, and `absorb → sink`
  (the other three canonical forces — `attract`, `repel`, `stream` — keep their names). This is
  a **hard rename**: the old `data-body` values no longer resolve, so update markup to the new
  tokens. The capture-radius attribute stays `data-absorb` and the accretion CSS var stays
  `--load`; the per-force vars follow the tokens (`--f-swirl`, `--f-viscosity`, …). The engine,
  presets, the conformance catalog + full test suite, the Field Manual, the Lab, and every doc
  move together. (The wave-binding tear keys on a force *property*, not a token list, so it
  needed no change.)

### Fixed

- **`<forces-field>` reacts to live attribute changes, and `destroy()` cleans up fully.**
  Changing `accent` / `render` / `palette` / `attention` / `causality` on a mounted
  `<forces-field>` now applies immediately (and `density` / `waves` / `mass` rebuild the field);
  the `observedAttributes` were declared but inert before. `destroy()` / `disconnectedCallback`
  now also release the per-element `[data-hot]` engagement listeners, so repeated mount/destroy
  on the same DOM no longer leaks handlers.
- **First-class mass no longer corrupts velocity-replacing forces.** Under `mass: true` the
  integrator scaled the *whole* per-frame velocity change by `1/m`, breaking forces that *set*
  velocity rather than add to it: a `wall` bounce could drive matter through the wall, and a
  `jet` launched heavy matter far too slowly (`lens`/`gate` likewise). Mass is now applied
  per-force — additive forces scale by `1/m`, while velocity-replacing forces (newly flagged
  `kinematic`: `wall`, `jet`, `lens`, `gate`) set velocity outright. New conformance scenarios
  cover `m ≠ 1`, which the suite never exercised before.
- **Canonical vortex swirls again (inward bias `0.6` → `0.12`).** Reverts the v0.2.0 bias:
  the spec (§6.8) and the catalog already specified `0.12`. Canonical `vortex` is a designed
  swirl verb — the tangential component dominates the inward one ~8×, so it holds shape — not
  a spiral drain. That binding belongs in a preset (`whirlpool` / `blackhole` / `accretion`).
  The conformance check moves from an exact inward spiral to **tangential dominance**; the Lab
  shows the first-frame Δv `(0.020, −0.171)` with `|Δvᵧ| > 4×|Δvₓ|` and a swirl track.
- **Every force can disturb the resting field (not just seven canonical tokens).** The
  resting field rides on wave-bound matter, and a force only reaches a bound particle once
  it's torn loose. The tear pass had a hardcoded allowlist — `reflect`, `attract`, `absorb`,
  `emitter`, `repel`, `vortex`, `stream` — so every **natural primitive and extended force**
  (`gravity`, `charge`, `magnetism`, `thermal`, `collide`, `diffuse`, `propagate`, `memory`,
  `cohesion`, `pressure`, …, plus `drag` and `spring`) let the wave shimmer ride straight
  through, doing nothing. Tearing is now keyed on a force *property*, not a token list: any
  visible always/active body that carries a non-modifier, non-source token frees nearby bound
  matter with a gentle inward nudge, then the integrator's real `apply()` shapes it — so gentle
  forces read gently and strong ones strongly. (Modifiers `resonate`/`spotlight` and the pure
  source `spawn` correctly never tear.)
- **`charge` and `magnetism` now act on the live field (charge induction).** Both forces
  ignore neutral matter by contract — and every live particle starts neutral, so on the page
  they did nothing. A charge/magnetism body now **polarizes** the matter in its range: a
  neutral particle picks up a sign by which side of the body it sits on (a +/- domain split),
  induced once so matter carries its charge. Induction is a field-level pass (`induceCharges`)
  kept *outside* the integrator the conformance suite runs, so the force's golden contract
  ("ignores neutral matter") stays exactly true while the field gains charged matter to push.
- **Field Cell + React adapter caught up to the rename.** The Field Cell's poster engine
  still switched on `vortex`/`spring`, so the Lab's `swirl`/`tether` cells fell through to
  `attract`; renamed to `swirl`/`tether`. React `<ForcesField>` / `useForcesField` had
  silently dropped the `palette`, `attention`, and `causality` props; they are now forwarded.
  The elements package gained a `test` script so its cell-force tests run in CI.

### Documentation

- **Audit cleanup sweep.** Marked the four spec-only render modes (`knockout` / `heatmap` /
  `redshift` / `blackbody`) **planned** in the §20.6 table; documented `morph`'s `range` as its
  *recruitment radius* (distant matter isn't pulled into the form — use `data-range="0"` for the
  whole field); corrected the `presets.ts` note (`lens` / `buoyancy` / `spawn` ship now, not
  "deferred"); and fixed the ROADMAP scaffold line (`tsc` / `node:test`, not `tsup` / `vitest`).
- **Docs and the live manual reconciled to the workover.** The Field Manual's `vortex`
  panel now reads as a swirl — the inward bias surfaces as `+ 0.12` in its formula, with no
  "whirlpool" — and the `absorb` panel uses `accreted / capacity`. The formula handbook's
  `absorb` row, the testing guide (the new safety-sweep layer, the corrected class list, the
  test count), the spec's §20.10 (an as-built note on the global cap + safety sweep),
  the possibilities doc, and the README status (`v0.2.0`; packages not yet on npm) are all
  brought in line.
- **Repo-wide documentation audit.** Swept every doc against the shipped engine. Corrected
  stale tokens the rename missed (the explainer's `data-body` list, ROADMAP prose, the Field
  Cell example), the formula handbook's forward registry (`pheromone` → `diffuse`;
  `diffuse`/`memory` flagged as natural [C]; the spec-only `warp`/`wormhole` and the
  `supernova` event marked; the budgeted source named `spawn`), the test count (306),
  ROADMAP's force counts (33), the spec's runtime-field list (drops the removed `b.mass`), and
  stopped PUBLISHING / SECURITY / the package READMEs from implying the packages are on npm.

## [0.2.2] — 2026-06-09

Documentation and release-tooling pass — no engine code changed.

### Added
- **Provenance release workflow** (`.github/workflows/release.yml`): a tag-triggered CI publish that
  signs each package with npm provenance (a Sigstore build attestation) via GitHub OIDC. Provenance
  can only be produced from CI, so this becomes the path for all future releases.

### Changed
- Expanded the `@field-ui/react`, `@field-ui/elements`, and `@field-ui/vanilla` READMEs with full
  options/methods tables, the `data-body` attribute vocabulary, and framework/SSR notes.

## [0.2.1] — 2026-06-08

First npm release under the `@field-ui` scope.

### Changed
- **The core package is published as `@field-ui/core`** (was the unscoped `field-ui`). The unscoped
  name is unavailable on npm — an unrelated, active `fieldui` package trips the registry's
  name-similarity guard — so the engine ships under the org scope alongside the four adapters. All
  internal dependencies and `import … from 'field-ui'` specifiers now resolve to `@field-ui/core`;
  the public API surface is otherwise unchanged (the freeze gate still passes its 14 entries).

### Published
- `@field-ui/core`, `@field-ui/platform`, `@field-ui/elements`, `@field-ui/react`, and
  `@field-ui/vanilla` are live on npm. Install any layer directly (`npm i @field-ui/core`, etc.).
- `@field-ui/kit` (a meta-package that installs the whole suite) and `@field-ui/field-ui` (a thin
  alias for the kit) also published, for one-install consumption.

## [0.2.0] — 2026-06-04

### Added

- **Force-aware Lab controls.** The TUNE & REFIRE panel is driven by each force's
  catalog attributes — it shows only the knobs that matter for the selected force
  (shear exposes its flow angle, `vortex`/`charge`/`resonate` expose spin, class-[S]
  sources show just strength + angle), each with its symbol (S, d, σ, θ°), units,
  a live formula line, and a default-value tick on the track.
- **Quick-pick value bands.** Named quick-set chips under each control (strength:
  weak/default/strong/max; range: near/default/far; spin: ccw/off/cw; angle:
  0/45/90/180; vx/vy: 0/slow/fast; count: 1/8/24) — click a meaningful setting
  instead of guessing and dragging; the active band is highlighted.
- **Frontiers roadmap + backlog.** `docs/roadmap-frontiers.md` (implementation notes for
  the next frontiers — reciprocal input channels, a GPU backend, the compositor bridge,
  `bindData()`, finishing the cosmology, and render frontiers) and `BACKLOG.md` (the
  granular queue). All 33 forces re-verified via the Lab — every one reaches MATCH.
- **Seven more forces (33 total), spanning every input class.** `memory` (a worn-path
  occupancy field, [C]) and `pigment` (conserved color transport, [E]); `pressure`
  (SPH density relaxation — incompressible even-fill, [B]); `link` (a Verlet distance
  constraint — ropes, cloth, soft structures, [B]); `hunt` (two-species predator/prey
  pursuit, [B]); `morph` (matter assembles into a mark/chart/logo — never words, §11; the
  new shape-assignment class [D]); and `spawn` (a budgeted source atom that *creates*
  matter, the new class [S]).
- **The source system (class [S]).** A `source(b, env)` hook on the `Force` contract
  (run once per body per frame, the dual of `modify`), plus an integrator source pass and
  an aging/despawn **sink** for mortal matter. Sources are budgeted by a per-particle
  lifespan and a hard pool ceiling, so they can't grow the field without bound. Adds the
  `fountain` preset (a continuous upward jet arcing home under gravity).
- **Two more render modes (six total)** — `metaballs` (a liquid iso-surface traced by
  marching squares) and `voronoi` (shattered-glass nearest-neighbour cells), alongside
  `dots` · `trails` · `links` · `streamlines`.
- **Closed-loop concepts on the Field Manual** — **material typography** (one density,
  `--d`, drives every type axis at once: weight, optical size, tracking, bloom, color)
  and a **self-laying-out page** (`data-move="layout"` elements find equilibrium positions
  via anchor + mutual repulsion + density pressure, and re-settle on resize).
- **Conserved attention** (§2.4) — one finite strength budget across the page; engaging a
  body pulls force off the others. Opt-in via `FieldOptions.attention` /
  `FieldHandle.setAttention` / `<forces-field attention>`.
- **Cross-boundary causality** — density spills from a saturated body to its neighbours
  (`--lit` + `field:lit`/`field:dim` events). Opt-in via `causality`.
- **Physics conformance framework** (`forces-ui` `conformance/`) — `runScenario` + a
  declarative `EXPERIMENTS` catalog of per-force invariants and exact checks, shared by
  the test suite and the Lab. Fire a particle into a force, verify it reacts as the math
  predicts.
- **The Lab is a physics detector** — fire known particles into a force, watch the track,
  the field, and related particles, and see each conformance check pass frame-by-frame.
  Numeric tuning + presets, multi-particle firing, once/loop/unlocked playback, a
  timeline with a per-particle **speed waveform** and a marker at every test's pass-frame
  with a MATCH flag, a parameter-sweep plot (vary one input across its range, see the
  response curve), and actionable save (Export JSON / Copy report). Handles class-[S]
  sources that start with no test particle (drawing the emitted spray).
- **Composition + condition experiments** — `COMPOSITE_EXPERIMENTS` verifies that forces
  compose (`attract repel` cancel; `attract vortex` sums to a spiral) and gate on
  conditions (`data-when` runs through the real condition registry).
- **Developer portal** (`/docs`) — getting started, concepts, framework guides, a
  catalog-driven API reference, recipes, and performance/accessibility notes.
- **`docs/forces-tests.md`** — the testing & conformance reference.
- **Release engineering** — CI (typecheck · test · build on every PR), `CONTRIBUTING.md`,
  `RELEASING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and issue/PR templates.

### Fixed

- **Vortex binds its orbit into a whirlpool.** Its inward bias (0.12) was far too
  weak to provide centripetal binding, so particles gained tangential speed and
  drifted *outward* — a feeble swirl that read like gravity. Raising it to 0.6
  binds the orbit: matter circles ~1.2× while spiralling gently in, a real
  whirlpool (tangential still dominates ~1.7×). Driven by headless orbit-count
  sweeps; the conformance exact-Δv and the `attract vortex` composite are updated.
- **Drag's no-redirection check is velocity-relative.** It hardcoded Δvy = 0 —
  true only for horizontal motion — so tuning a test particle's vy flipped a
  correct drag to NO MATCH. Drag is `v −= v·k`, so Δv is anti-parallel to v at any
  velocity; the check now asserts no perpendicular component (cross ≈ 0).
- **The emitter Lab scenario fires from the nozzle**, so it demonstrates the jet
  (relaunched fast along the heading, receding from the body) instead of sitting
  in the feed zone, where it read as an attractor.
- **`collide` now conserves momentum in the trajectory.** It resolved only `p` and
  trusted `q`'s later turn, but the integrator processes particles sequentially, so `q`
  read `p`'s already-changed velocity — an order-dependent, non-conserving result. The
  pair is now resolved symmetrically in one pass (equal & opposite impulses), giving a
  proper equal-mass elastic bounce.
- **Conformance experiments tightened** — `thermal` isotropy is measured over a 150-body
  cloud (ratio ≈ 1, not a single noisy walk); `collide` is centred in positive space and
  approaches slowly so the bounce is clear (gap 20 → 31) and gains a velocity-reversal
  check; `wind` uses a stronger gust; the `gate` expectation wording is corrected
  ("reflected back along n").

### Changed

- **The site front door** — the Field Manual is now the home page (`/reference` redirects
  to `/`); client-side navigation keeps the field running continuously across pages.

### Performance

- Range-culled the integrator body-force loop (~2× at scale) and removed all
  `shadowBlur` from the render path; cached the per-frame `scrollHeight` read.

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
- **Color templates** — `ours`, `heatmap`, `infrared`, `spectrum`.
- **§20.2 reconciliation** — a canonical color for every registered force.

### Site (field-ui.com)

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

## [0.1.0] — 2026-06-03

### Added

- **Initial tagged release (`v0.1.0`).** Predates this changelog — no per-change notes were kept at the
  time; the entry exists so every tagged/published version is accounted for. This cut established the
  engine (`@fundamental-engine/core`), the DOM platform, and the initial authoring surfaces; all later
  versions are detailed above.
