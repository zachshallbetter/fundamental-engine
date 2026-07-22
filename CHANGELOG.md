# Changelog

All notable changes are documented here, following
[Keep a Changelog](https://keepachangelog.com) and [SemVer](https://semver.org).
The packages are published to npm under the `@fundamental-engine` scope; each release is also cut as
a git tag (see [RELEASING.md](RELEASING.md)).

## [Unreleased]

## [0.10.1] — 2026-07-21

**Kotlin port parity: the Compose `FieldView` now renders a multi-hue palette.**

### Fixed

- **`FieldView` (`@fundamental-engine/compose`, Kotlin) collapsed a multi-colour palette to a single hue** (#1090). It took one `accent` and drew every particle as `lerp(COOL, accent, heat)`, where the JS and Swift engines' `FieldOptions` carry a `palette` — so an Android field rendered monochrome where iOS rendered multi-hue. Adds `palette: List<Color>`, colouring each particle by a stable pool index across all four render modes (DOTS, GLOW, LINES, TRAILS). **Backward-compatible**: the parameter defaults to `[accent]`, the previous behaviour, so existing callers are unaffected. Verified against the iOS `10-intro-star` reference, which the Android field now matches.

> **Scope.** This is a **Kotlin-only** change. The JS and Swift engines are byte-identical to 0.10.0 — they already had the palette. The npm and Swift artifacts are republished at 0.10.1 only to keep the cross-plane version in lockstep; there is no JS or Swift behaviour change in this release.
>
> **Still open:** the parity matrix does not track colour (#1091), which is why this divergence reached an app before any gate. Closing it would fail a future single-accent-vs-palette mismatch at CI instead.

- **Release tooling: scope the version bump to `./packages/*`, not the `@fundamental-engine/*` name glob.** The glob also matched the private workspace apps (`apps/site`, `apps/starter`, `apps/observatory`), which share the npm scope but version independently — and `exec npm version` ignores the `private` flag, so it silently bumped them to the release version (0.10.0 caught this: observatory jumped `0.0.0 → 0.10.0` before it was reverted by hand). The path filter targets exactly the seven publishable packages, so no private app is bumped and the old "revert the apps afterward" step is gone. `pnpm publish` already skipped private packages, so only the version bump was ever affected. Fixed in `RELEASING.md`, `PUBLISHING.md`, and `release.yml`.

## [0.10.0] — 2026-07-21

The reproducibility envelope ships, and cross-plane publishing is complete: **one `git tag v0.10.0`
now releases npm, Swift (SPM) and Kotlin (Maven/GitHub Packages) in lockstep at a single version.**

### Breaking (pre-1.0)

- **`FieldHandle` gains a required `guarantees` member.** **Additive for every consumer** — reading
  `field.guarantees` is a new capability and breaks no calling code. **Breaking only for third-party
  code that *implements* `FieldHandle` itself**, which must now provide the member. **Migration:**
  return the runtime's envelope, or delegate to a wrapped field — the in-repo implementers
  `FieldLayer` (`@fundamental-engine/three`) and `FieldField` (`@fundamental-engine/vanilla`) both
  delegate, and are the reference pattern. Per the pre-1.0 policy this is the `0.MINOR` position, hence
  `0.10.0` rather than a patch.

### Added

- **`FieldHandle.guarantees` — the reproducibility envelope is now queryable.** The runtime's determinism classification, its controlled and **uncontrolled** inputs, the requirements for repeatability, and the cross-plane numeric tolerance were previously stated only inside an unexported experimental module. The first external integrator concluded the runtime was byte-identical across environments and designed replay and shared-state features on that — a reasonable inference from unavailable information. It is `conditionally-deterministic`, `host-geometry` and `body-ordering` are **not** controlled, and cross-plane agreement is a tolerance (`1e-6`), never bit-equality. A drift test asserts the published envelope matches the internal contract declaration, because two statements of one fact diverge unless something checks them.
- **New canonical doc: [`coupling-discipline.md`](docs/canonical/coupling-discipline.md).** The rung discipline — couple at the lowest rung that achieves the effect — arrived at independently by two consumer projects that each hit the same wall. Covers rung selection, sampling cadence, the measured cost (fill-rate-bound, not particle-bound; ~1ms against a 16.7ms budget), and **when not to use the field at all**: high-frequency domain telemetry belongs in your own arrays, not in bodies.

### Build & release

- **Android artifacts publish from CI on a release tag, at a tag-derived version.** `android.yml` gains a `publish` job (`if: refs/tags/v*`, `packages: write`, Actions `GITHUB_TOKEN` — no personal token) that runs `:fundamental-core:publish :fundamental-compose:publish`. The version is derived from the tag via `-PreleaseVersion` and defaults to a `SNAPSHOT` locally — the hardcoded `version = "0.9.5"` is gone, so a publish can never silently overwrite a release with different code. One `git tag vX.Y.Z` now releases every plane at one version: npm via `release.yml`, Swift via the SPM tag, Kotlin via this. Publication config verified against the local Maven repo before merge.

### Docs & site

- **Homepage leads with the artifact instead of the abstraction.** The hero opened with 227 words before anything moved, and asked a reader to hold six unfamiliar concepts — "a readable behavior layer for host objects" appeared in the kicker, the page title, the meta description *and* the first sentence, all before any evidence. The standfirst is now two sentences that are checkable on the page itself, the strongest of which is **"nothing on this page is animated."** Kicker and title become "a physics engine for interfaces" — a category people already have a slot for.
- **New `#shipped` section: four doors, one core.** [Habitat](https://habitat.fundamental-engine.com) (WebGL, `@fundamental-engine/three`), [Ascent](https://ascent.guide) (iOS, `<field-root>` + elements, on the App Store), [zachshallbetter.com](https://zachshallbetter.com) (`@fundamental-engine/vanilla`), and the [native parity matrix](https://fundamental-engine.com/docs/api/parity). The renderer-agnostic claim was previously asserted in prose; it is now four links you can open.
- **Cross-plane parity surfaced in the hero meta** — `js · swift · kotlin`, six forces, identical output, checked in CI.
- **Positioning made consistent site-wide.** The footer, which renders on every page, and the `Base.astro` default title still carried the old phrasing after the homepage rewrite; both now say "a physics engine for interfaces".
- **Finished retiring the freeze vocabulary across `docs/canonical/`.** Nine documents still described "the freeze contract" / "the frozen surface"; all now say *protected* / *removal-protection*. Four uses meaning something else entirely (`Object.freeze` clones, reduced-motion "freeze the sim", the poster "frozen particles", "frozen design history") are deliberately untouched.
- **README: the WebGL door is signposted where architecture decisions get made.** `@fundamental-engine/three` was documented three-quarters down the packages table; two independent readers still recommended hand-building the headless-to-`THREE.Points` bridge it already ships.
- Maturity line corrected: it read *"no external users yet"* while shipping in a published iOS app and a live WebGL game.

## [0.9.5] — 2026-07-20

- **CI: replaced the third-party path-filter action with plain git.** GitHub began forcing Node 24 onto actions that target Node 20; the filter action dies silently mid-run and takes the whole gate with it via `conclusion`. A path filter is one `git diff` and does not need a dependency that can break underneath the repository. All nine original path patterns preserved and verified against a fixture of paths that must and must not match; the replacement also logs which files it saw and which way it decided.
- **Retired the API "freeze" — it was never real.** The list was described as frozen for `0.x` and had been edited 40 times; a stability promise revised whenever it becomes inconvenient is not a promise, it is a claim that quietly stops being true. The check itself is kept and renamed to what it actually does: it protects listed symbols from **silent removal**. It has never failed on an addition and cannot — new exports land freely. Removing or renaming a listed symbol is allowed and expected; it just has to be deliberate, which means dropping the entry in the same change and adding a migration note so consumers are told. `FROZEN_*` → `PROTECTED_*` throughout, with failure messages that now say what happened and what to do. Three inaccuracies fixed in passing: the docs page claimed entries "fail the build if they change" (only removal fails); `api-stability.md` and `substrate-api.md` cited "the frozen 17" where the check reports **20**. `RELEASING.md`, `PUBLISHING.md` and three canonical docs updated to match. Freeze language remains in prose elsewhere in `docs/canonical/` and is tracked as follow-up — it is stale wording, not a wrong claim about the gate.
- **Documentation accuracy pass.** `docs/README.md` now indexes `docs/method/` (a whole top-level docs directory that was unlisted) and the `planning/world-substrate/` program. `PLAN.md`'s status header said *"Nothing in F1–F5 or C2 is built"* — false since Stage 1 landed — and the document contradicted itself, carrying both a current "Not started" line and a superseded one, plus a note calling F1.4 equivalence "pending" when it is measured. The repository guide listed **17** protected API entries where `check:api` reports **20**, and its layout table omitted `apps/observatory` entirely. Corrected, with the authoritative source named in each case so the next drift is self-diagnosing.
- **Documentation and code now reference only tracked documents.** Nine files pointed at a repository-root file that is no longer version-controlled, so those references resolved for some checkouts and broke on a fresh clone. They now point at `docs/engineering-practices.md`, which is tracked and carries the same guidance. The site's `llms.txt` generator was also including that untracked root file in its published output; it now publishes `README.md` and `CHANGELOG.md` only.
- **Documentation accuracy pass.** `docs/README.md` now indexes `docs/method/` (a whole top-level docs directory that was unlisted) and the `planning/world-substrate/` program. `PLAN.md`'s status header said *"Nothing in F1–F5 or C2 is built"* — false since Stage 1 landed — and the document contradicted itself, carrying both a current "Not started" line and a superseded one, plus a note calling F1.4 equivalence "pending" when it is measured. The repository guide listed **17** frozen API entries where `check:api` reports **20**, and its layout table omitted `apps/observatory` entirely. Corrected, with the authoritative source named in each case so the next drift is self-diagnosing.
### Added

- **`@fundamental-engine/core` + `apps/observatory` — the FCI Observatory: an inspection instrument for the research program (EXPERIMENTAL, internal).** New `world/observatory/{evidence-log,capture}.ts`, `scripts/emit-observatory-bundle.mjs`, and a dependency-free `apps/observatory`. The Observatory is **strictly downstream and derives nothing**: the runtime emits a normalized evidence log (`living system → instrumentation adapter → evidence log → Observatory`) and the app renders it. The app *cannot* import the runtime — core's `exports` map is closed and core must stay DOM-free — so the bundle is the only path evidence can take, which makes the boundary structural rather than a matter of discipline. Every displayed value resolves to an evidence node naming the runtime function that produced it (`evaluateOpportunity()`, `project()`, `detectEpisodes()`, `runAblations()`, the registries), and the evidence DAG is asserted to have no dangling citation and no duplicate id. **Six replay panes** (World · Projection · Opportunity · Episodes · Evidence · Timeline) over deterministic replay of recorded runs — pause/play/scrub/step/jump-to-evidence, with replay unable to touch runtime state because it holds no runtime reference — plus a **research mode** (Corpus · Discoveries · Predictions · Projection lab · Ablation · Cross-version) that visualizes the research itself. Captures all four adapted substrates (field · governor · FSM · planner) through one generic path with no per-substrate special case. What it refuses to do is the point, and is enforced by tests that walk the app's own source: pending substrates get no fabricated run, a substrate that cannot declare its law shows none, an ablation the harness never executed is marked *unsupported with the reason*, alternate episode groupings are all retained and labelled conditional, `inferred` state is structurally zero, and cross-version comparison with one revision loaded shows nothing rather than inventing a baseline. The bundle is a generated capture and is gitignored — a stale committed capture could display findings that no longer match the live registries. Not exported; frozen surface unchanged.
- **`@fundamental-engine/core` — negative results registry + evidence provenance (EXPERIMENTAL, internal).** New `world/conformance/{negative-results,evidence}.ts`. A **negative result** is a hypothesis that survived pre-registration and adaptation and was then disproven — distinct from a rejected convenience and from a regraded prediction, because regrading a prediction *erases the belief behind it*, which is the thing a later reader is most likely to re-propose. `N-001`–`N-005` record what this program stopped believing (termination is search-specific — falsified by the FSM; a `CompiledPattern` is a complete world declaration — falsified by F1.1; field dynamics is fully declarative — falsified by F1.5; plus two pending). Entries are permanent: never deleted, never renumbered, never rewritten; identifiers are asserted dense so a deletion shows as a gap; a falsified entry must name what disproved it and why; and a test asserts hypotheses are not retroactively strawmanned. Three entries are flagged **reconstructed** — recorded after the fact rather than when the belief was abandoned — and counted separately rather than presented as equivalent. **Evidence provenance** becomes a first-class dimension alongside maturity, because two claims can share a grade while differing entirely in support: one exercising a mechanism built earlier for another purpose (which could have behaved otherwise), the other exercising an API introduced in the same commit as its test — the first can fail, the second is a tautology with assertions. Five levels with independence ratings that are properties of the *source*, not of author confidence (`emerged-from-prior-mechanism` / `revealed-by-independent-substrate` = high, `independent-adversarial-test` = medium, `fixture-against-same-implementation` = low, `architectural-argument` = none), plus a consistency rule that **maturity may never outrun provenance** — and catches the converse error of grading something a hypothesis when an independent substrate actually revealed it. Projection independence: 2 high, **0 medium**, 2 low, 4 none — there is as yet no independent adversarial test anywhere in the projection evidence. Both discoveries are `revealed-by-independent-substrate`, and no discovery may rest on an architectural argument. The domain-neutral method is extracted to `docs/method/empirical-protocol.md`. Not exported; frozen surface unchanged.
- **`@fundamental-engine/core` — discovery registry, prediction accuracy, and a three-way refinement taxonomy (EXPERIMENTAL, internal).** New `world/conformance/{discoveries,predictions}.ts` and `world/projection/evidence-profile.ts`, formalizing the experimental protocol as testable data rather than prose. **Refinements are now classified three ways** — `structural` / `representational` / `convenience` — replacing a binary that had no room for "the concept existed, this expresses it better" and so forced representational changes to be misfiled (3 structural, 0 representational, 0 conveniences accepted). **Discoveries get permanent identifiers** (`D-001` transition-law retrieval, `D-002` termination): each must name the substrate that forced it, argue why the *prior* contract was incoherent rather than merely improvable, state why no existing substrate could have revealed it, and record what was deliberately **not** generalized alongside it. Tests assert identifiers stay dense and ordered (a removed entry shows as a gap), that a discovery contains only structural changes, and that the discovery and corpus ledgers cannot drift apart — and that **neither discovery came from `FieldRuntime`**, the substrate the contract was extracted from. **Prediction accuracy** is tracked separately from contract stability, because a contract nobody changes might be right or might be untested: `partially-confirmed` is available only to predictions that pre-declared ≥2 independent components and is rejected when all or none held, partial credit is not counted toward accuracy, and every falsified prediction must keep the lesson it taught. Current record: 8 registered, 3 graded — 1 confirmed, 1 partial, 1 falsified; accuracy 1/3, surprise rate 1/3 (tracked deliberately — a program with no falsifications is not being tested). The figure is explicitly **not** independent evidence: the same author writes, grades, and implements, so commit order is the real guarantee and every graded prediction names its registering commit. **The projection evidence profile** grades each projection claim `experimentally-grounded` / `fixture-supported` / `architectural-hypothesis`, on the principle that a test written against an API one designed is a consistency check that cannot falsify its own design: 2 grounded (both resting on the independently-built F1.6 `Ω_sys` evaluator), 2 fixture-supported, 4 hypotheses — a grounded fraction of 0.25, asserted rather than admitted. Every ungrounded claim names the experiment that would ground it; `P-005`–`P-008` pre-register the projection phase, including the untested case current fixtures never cover: **projecting a projection**, where a second layer might launder what the first withheld. Not exported; frozen surface unchanged.
- **`@fundamental-engine/core` — substrate conformance corpus + the termination concept (EXPERIMENTAL, internal).** New `world/substrates/{fsm,planner}.ts`, `world/adapters/{fsm,planner}-runtime.ts`, and `world/conformance/corpus.ts`. The corpus measures one pre-registered question — *how little does `DynamicsContract` change as independently-written substrates are adapted to it?* — under a **substrate-first, adapt-second** protocol: each substrate is written from its own domain semantics and **committed before its adapter exists**, and a guard asserts it imports nothing from the contract, kernel or world. **The FSM control's prediction was falsified:** pre-registered at churn 0 on the reasoning that an FSM is the most contract-shaped substrate imaginable, it instead exposed that an accepting state *finishes* — the first corpus substrate to do so — and the contract had no generic way to say so. The falsification is the stronger result: termination is a general property of lawful evolution, not a search idiosyncrasy, and neither the field nor the governor could have revealed it because neither ever finishes. `Transition.lifecycle` (`'continuing' | 'terminal'`, optional, absent read as continuing so nothing migrates) and `KernelHost.lastLifecycle` close it — the kernel was discarding the signal, which would have made the concept decorative. Deliberately *not* split into finished-with-result vs finished-without: both corpus substrates exhibit that distinction but the evidence only forces "must the kernel keep going?". The planner cost **0** (the FSM had already paid) and became the first substrate to exercise `executionKind: 'hybrid'` — declared in F1.3, never used until now — because its law is only partially declarable (expansion table declarative, euclidean heuristic computed). One tempting change, `TransitionLawDescription.completeness`, was **rejected as a substrate convenience** and recorded as a rejection: `declareTransitionLaw: false` already answers truthfully. Ledger: 4 adapted (`opaque-native` · `interpreted` · `declarative` · `hybrid`), 4 pending, total churn 3, **zero substrate conveniences accepted**, converging on the last adapted substrate; pending entries are asserted never to count as evidence of generality. Adds a substrate-agnostic conformance battery that drives any contract through capabilities and declarations only, never substrate identity. Not exported; frozen surface unchanged.
- **`@fundamental-engine/core` — F2 foundation: `ProjectionContract` + property classification (EXPERIMENTAL, internal).** New `world/projection/projection.ts` and `world/properties/properties.ts`. **Projection** is modelled as a presentation of a world that is kept deliberately distinct from observation, snapshot, evidence, capability, authority, and operation availability, via separate concepts (`ProjectionDefinition` · `ProjectionSurface` · `ObservationAccess` · `OperationExposure` · `EvidenceAccess` · `AuthorityPresentation` · `ProjectionResult`). The load-bearing rule is that **a projection is subtractive with respect to power**: it may hide, withhold and understate, but `project()` can never manufacture a capability or silently grant permission — where a definition claims more than the source holds, the surface still reflects the source and the excess is reported as an anomaly. `exposed` / `hidden` / `unavailable` are three genuinely different operation states (hidden ≠ absent from the world), and observation access is independent of operation exposure in both directions. A projection **can** change `Ω_sys` without changing world state — proven by driving F1.6 from two surfaces over one snapshot. Projection-relative invariants are evaluated against the surface only; a claim reading hidden state is `unevaluable-outside-surface`, never satisfied or refuted by reaching into the world. **Property classification** establishes the Stage-2 three-class vocabulary (`mechanically-decidable` / `model-checkable` / `empirically-testable`) with per-class evaluation authority, required evidence, status (`satisfied` / `violated` / `unresolved` / `not-applicable` / `insufficient-evidence`), reason and provenance. Two limits are enforced rather than documented: an **empirical claim can never be marked satisfied internally** — the runtime may only return `unresolved`, `insufficient-evidence`, or a deferral carrying an external study reference, and a belief-laden statement classed as mechanical is refused as `not-applicable`; and **one observed execution is not a model check** — 500 runs still yield `insufficient-evidence`, a bounded check holds only within its bound, and only exhaustive exploration earns `satisfied`. Nine projection fixtures + five negative property fixtures. Not exported; frozen surface unchanged.
- **`@fundamental-engine/core` — G3.3 cross-substrate generalization finding + transition-law refinement (EXPERIMENTAL, internal).** New `world/cross-substrate.ts`: compares the field and governor substrates against the same `DynamicsContract` across 18 dimensions, with every row read off the **live contracts** rather than stored prose. **Outcome: generalized-with-refinement.** No dimension is field-biased or second-substrate-biased — the second substrate adopted `executionKind`, determinism, capabilities, evidence shape, failure taxonomy, snapshot fidelity, replay, restore, lifecycle and ordering unchanged; four dimensions are substrate-specific values carried by the generic type parameters. One **missing general concept** surfaced, visible only once a second substrate existed: `capabilities.declareTransitionLaw` could be claimed truthfully while the contract offered no way to obtain the law. `DynamicsContract` gains an optional `describeTransitionLaw()` returning the law as data, plus two consistency rules (capability **iff** accessor); `opaque-native` remains barred from declaring a law at all. The rule immediately caught a pre-existing F1.3 fixture that claimed the capability without being able to produce a law. One **unnecessary generalization** is recorded rather than removed: `DynamicsExecutionContext.now` was unused by both substrates. The field adapter is unaffected (capability false, no accessor) — pinned by a migration test. Not exported; frozen surface unchanged.
- **`@fundamental-engine/core` — G3 second substrate behind `DynamicsContract` (EXPERIMENTAL, internal).** New `world/substrates/governor.ts` + `world/adapters/governor-runtime.ts` + `world/governor-equivalence.ts`: a second, non-field substrate — the quality-governor rule set (a faithful core-local port of the **shipped** `@fundamental-engine/dom` `QualityGovernor`; `core` cannot import `dom` and core's `exports` map is closed, so the shipped class is unreachable — provenance and limitation recorded). It contrasts with the field on every contract axis: discrete threshold transitions with **asymmetric hysteresis**, a transition law that is a **declared table**, fully surfaced state, and exact determinism with no clock and no RNG. Declared truthfully as `executionKind: 'interpreted'` · `deterministic` (zero uncontrolled inputs) · snapshot **`complete-restorable`** with working `restore` + `replay` + `inspectInternalState` + `declareTransitionLaw` — every one of which the field substrate honestly cannot claim. **The contract was not changed to make it fit.** Raw-vs-adapted equivalence is measured at every transition (raw substrate is the authority), with negative fixtures for altered operation order, changed input, skipped transition, changed failure result, reordered tier-change event, and a case where final-state-only comparison would falsely pass. Native error causes are retained internally and never leak a native type onto the generic surface. Not exported; frozen surface unchanged.
- **`@fundamental-engine/core` — F1.8 kernel ablation harness (EXPERIMENTAL, internal).** New `world/ablation/ablation.ts`: runs the four ratified ablation forms (removal · collapse · substitution · reconstruction) by **executing** the real F1.5–F1.7 derivations with ablated inputs, not by asserting stored verdicts. Each record carries hypothesis, transformation, fixture, expected distinguishing case, observed result, failed capability / preserved behavior, evidence, classification, and the K/K₀ implication. Headline results: `Dynamics` **non-substitutable** (declarative-only substitution covers 8/11 corpus laws; 3 remain opaque), `Ω_sys` **derived-complete** (all five lower inputs necessary), interaction episodes **derived-conditional**, coupling-vs-shared-cause **structural** (survives the most permissive thresholds), `Relations` **collapsible-with-loss** (observed edges reconstruct, latent/typed semantics do not), `Operations` **non-substitutable** (latent operations unrecoverable), `Projection` **non-substitutable** (materially changes Ω_sys over identical state), `Invariants` **kernel-side** (cannot be guards inside an opaque substrate), and `DynamicsContract` **execution-boundary-only** (not promoted to an eighth primitive). Includes a negative fixture asserting the harness does *not* report loss where none occurs. Not exported; frozen surface unchanged.
- **`@fundamental-engine/core` — F1.7 candidate-episode detection (EXPERIMENTAL, internal).** New `world/episodes/episodes.ts`: `detectEpisodes(trace, contract, worldParticipants)` under the ratified detection contract ⟨boundary, timescale, coupling predicate, recurrence window, influence threshold⟩. Returns **conditional** findings only — candidate episodes, episode participants, supporting transition pairs, boundary used, coupling/reciprocity/recurrence basis, determinacy, **alternate segmentations** (defensible parameterizations reported, not errors), failure reasons, evidence. Coupling is distinguished from shared cause structurally (directed `from→to`; a common source `C→A` / `C→B` with no `A↔B` link is not a coupled episode). Preserves world-participant vs episode-participant (a latent authority holder is a world participant, never an episode participant). Eight preregistered adversarial cases (unilateral, delayed, timeout, retry, nested, one-shot, async-outside-window, shared-cause) + six additional (latent authority, mediator, overlapping episodes, boundary-alters-membership, influence-drops-weak-coupling, identical-timing-no-path). Not exported; frozen surface unchanged.
- **`@fundamental-engine/core` — F1.6 system-relative opportunity `Ω_sys` (EXPERIMENTAL, internal).** New `world/opportunity/opportunity.ts`: `evaluateOpportunity(context, operation)` returns per-predicate results — `domainValid` / `capable` / `permitted` / `enabled` / `reachable` / `exposed` / `signaled` / `reversible` + `recoveryPaths` + `failedPredicates` + `evidence` (retaining the world/version envelope, reconstructible). **Runtime-derived only** — no belief / perceived availability / interpretation / expectation / confidence / experience / strategy. Capability (`Capable` = *can*) and authority (`Permitted` = *may*) are separate; every permission requires an `authoritySource` (empty or `unknown` ⇒ not permitted). No aggregate boolean without predicate-level evidence. Ten negative fixtures cover capable-not-permitted, permitted-not-capable, enabled-unreachable, reachable-not-exposed, exposed-not-signaled, irreversible-no-recovery, projection-changes-result, history-changes-result, unknown-authority-source, and unsupported-operation. Not exported; frozen surface unchanged.
- **`@fundamental-engine/core` — F1.5 declarative-FieldDynamics experiment (EXPERIMENTAL, internal).** New `world/experiments/declarative-dynamics.ts`: a minimal typed expression IR + interpreter (a closed op union — **no callbacks, eval, `Function`, script strings, or execution escape hatch**) tested against a representative force corpus. Distance/relation/environment/threshold/composition/parameterized/linear-time laws are `declarative-expression`; explicitly-surfaced state is `declarative-stateful`; nonlinear-time, closure-captured state, and host/callback dependence are `opaque-only` with recorded reasons (`unsupported-input` / `hidden-mutable-state` / `callback-dependence`). **Result: partial-with-opaque-extensions** — non-trivial force laws *are* representable as data, but the force system as a whole is **not** fully declarative, and the IR was not expanded to force success. This corroborates that "Dynamics" is not reducible to declarative data and that the `opaque-native` `DynamicsContract` substrate is justified (feeds the F1.8 `K`/`K₀` ablation). Not exported; frozen surface unchanged.
- **`@fundamental-engine/core` — F1.4 raw-vs-substrate equivalence harness (EXPERIMENTAL, internal).** New `packages/core/src/world/equivalence.ts`: the **raw** field path is the authority; the adapted path (the field behind `DynamicsContract` + `hostWorld`) is built independently from the same fixture — identical compiled pattern, body identity/ordering, injected RNG **and** clock, host geometry, placement, and transition count, via a fixture-owned `FieldConstruction`. Equivalence is compared at **every transition** (not just the final state), exact for discrete values and a **declared tolerance** for floats; the result records the determinism **conditions**, an honest structural **coverage** map (`represented` / `substrate-owned` / `observable-only` / `lossy` / `unavailable` — nothing silently upgraded), and snapshot **fidelity** (`partial-observable`, non-restorable). Negative fixtures prove the harness detects divergence, including one where a final-state-only check false-passes but per-transition catches it. A clean pass establishes that the opaque field substrate preserves *observable* execution **under the declared conditions** — not that the kernel represents or understands its laws. Not exported; frozen surface unchanged; existing field goldens unchanged.
- **`@fundamental-engine/core` — world kernel: generic `World` (F1.2) + enriched `DynamicsContract` (F1.3) over an opaque `FieldRuntime` substrate (EXPERIMENTAL, internal).** New `packages/core/src/world/`: a field-free generic `World` declaration; a `DynamicsContract<State, Input, Output, Evidence>` execution boundary carrying `executionKind` (closed union) · conservative `capabilities` · a `determinism` **declaration** (not a boolean) · a typed `DynamicsResult` (no exceptions for expected failures) · a typed evidence channel whose `unresolvedInterpretations` **record, never assert**, interpretation; `hostWorld` orchestrates `initialize` / `advance` / `snapshot`, threading an opaque `State`. The one-way `adapters/field-runtime.ts` maps `CompiledPattern → World` and wraps the field as `executionKind: 'opaque-native'` — lossy snapshot ⇒ **no restore/replay**, **no `declarative` boolean**, no declarative-equivalence claim. A `validateDynamicsContract` consistency checker + architectural guards (no field imports, no `any`/`Function`, no capability over-claim) enforce the boundary. Not exported; frozen surface unchanged (`check:api`: 20 intact). **Finding (F1.1):** a `CompiledPattern` is not a complete world declaration — lawful evolution exists only as executable force code — so the field is one *execution substrate behind the contract*, not the world itself. See `docs/planning/world-substrate/F1.1-integration-audit.md` + `PLAN.md` v2.1.
- **`@fundamental-engine/core` — F1.0 world version envelope (EXPERIMENTAL, internal).** New `packages/core/src/world/envelope.ts`: an eight-field `WorldVersionEnvelope` (`worldInstance` / `worldSchema` / `kernelSemantics` / `contractSchema` / `projectionContract` / `implementation` / `conformanceVector` / `migrationChain`) with explicit-fail compatibility — `assertCompatibleEnvelope` throws `IncompatibleWorldVersion` naming the differing field, with no silent migration (migration *tooling* is deferred to Stage 4). Not exported from the package entry; the frozen public surface is unchanged. First increment of the world-substrate kernel experiment (see `docs/planning/world-substrate/` and its `m1.5/` semantic freeze).

### Deprecated

- **`@fundamental-engine/core` + `@fundamental-engine/dom` — the recipe → `Pattern` rename reaches the internal helper surface (phase 4, additive).** The remaining `recipe`-named exported helpers are renamed to `Pattern`, each keeping a `@deprecated` alias of the old name (removed at `1.0`): `BodyPattern` (was `BodyRecipe`), `RelationshipPattern`, `AccessibilityPattern`, `PatternTier`, `PatternStatus`, `PatternProblem`, `PatternTierGroup`, `PatternRenderPlan`, `PatternBodyRegistration`, `PatternRelationshipRegistration`, `PatternFeedbackBinding`, `PatternReducedMotionPlan`, `PatternAuthoring`, `PatternFieldTarget` (dom), the consts `PATTERN_TIERS` / `PATTERN_CONTRACTS`, and the functions `validatePattern` / `serializePattern` / `patternById` / `patternBodyAttributes` / `patternRenderPlan` / `patternToMarkup` / `patternAuthoring`. `bindData` gains a `pattern` option (the `recipe` option is still read as a deprecated fallback). Every old name still works. Intentionally left unchanged (invisible plumbing, not concept surface): the `recipes/` source folder, `apply-recipe.ts`, `data/recipes.json`, and the `RelationshipSource` `'recipe'` value tag.
- **Swift + Kotlin ports — the phase-4 helper rename is mirrored.** `FundamentalCore` (Swift) and `:fundamental-core` (Kotlin) rename the same helper family (`BodyRecipe`→`BodyPattern`, `RecipeProblem`→`PatternProblem`, `validateRecipe`→`validatePattern`, the registrations, …). A clean rename (no deprecation aliases): the ports have no external consumers, so nothing needs the old names — unlike the JS packages, whose site consumes them. Verified: `swift test` (234 incl. the conformance golden) + Kotlin `:fundamental-core:test :lab:test` (217) green.
- **The last recipe → Pattern gaps, closed.** Three exported helpers missed by phase 4 are renamed with `@deprecated` aliases: `parsePattern` (was `parseRecipe`), `destroyPattern` (was `destroyRecipe`, dom), `FIRST_RELEASE_PATTERNS` (was `FIRST_RELEASE_RECIPES`). `check:readme`'s catalog-count check now reads `FIELD_PATTERNS` and looks for "N patterns" (was "N recipes") — a gate-script drift the rename itself introduced. The root `README.md`, `apps/starter` (code + `index.html` + `README.md`, runtime-verified), `packages/react`'s JSDoc, and the full `docs/planning` critical-path family (including a real naming-collision fix: the proposed future `FieldFormationReading`/`patterns` tracking is distinct from the already-shipped `formations`/`activeFormations`/`FormationChange` mode-tracking — both now correctly named) now read Pattern throughout.

## [0.9.4] — 2026-07-10

### Added

- **`@fundamental-engine/core` — the focus / attention substrate (EXPERIMENTAL): operator attention as an input, agent attention as an output, over one shared field.** A source-tagged, decaying attention **ledger** written by `field.focus(target, input?)` and read by `field.focusState(opts?)` + `metrics.salience`, with the `focus` discrete event as the write-back channel. `focus('file:src/auth.ts', { source: 'operator' })` deposits decay-then-add per source (decay = `temporal.freshness`, the `env.t` clock — no `Date.now`; `halfLife` in `env.t` seconds, ~8s default); a string id always records, retained identity-keyed until a body with that id appears, then binds. `focusState()` is the ranked, thresholded, capped **sharp tip** (a few hundred bytes for an agent turn); the aggregate per-body `salience` rides `query()`/`snapshot()` under the base grant (an agent should see *where* attention is), while the per-source split (*who*) is gated by the new **`read:focus`** capability — which alone gates `AgentFieldView.focusState?`. The agent view stays **read-only**: agent writes route through the host relay `field.focus(id, { source: 'agent' })`, so agent-readable is still not agent-writable. A focus **well** (`Body.focusMul`, clamped ≤2×) at the integrator deepens a focused body's forces as its salience freshens — the field visibly **gathers toward whatever is currently focused** — and relaxes as it goes stale; any unfocused body keeps the `mul === 1` fast path. Signals-first, runs under `render: 'none'`. Ships the experimental **`FOCUS_WELL`** Pattern (`focus-well`, in `EXPERIMENTAL_PATTERNS` — never the locked 64). On DOM custom elements `focus`/`focusState` are reached via `el.handle` (`HTMLElement.focus` stays the DOM/keyboard focus); mirrored on `@fundamental-engine/vanilla`. Purely additive (new handle methods + types + one `AgentCapability` + one event); Swift/Kotlin ports are a batched follow-up.
- **`@fundamental-engine/core` + `@fundamental-engine/dom` — the concept "recipe" is renamed to `Pattern` (phase 1, additive).** The authored composed-arrangement concept is now a **Field Pattern**, and the public API gains canonical `Pattern` names: `FieldPattern` (was `FieldRecipe`), `compilePattern` (was `compileRecipe`), `CompiledPattern`, and the data consts `FIELD_PATTERNS` / `EXPERIMENTAL_PATTERNS` / `FIRST_RELEASE_PATTERN_IDS` in core; `applyPattern` (was `applyRecipe`) with `ApplyPatternOptions` / `AppliedPattern` / `AppliedPatternInspection` in dom. The frozen surface now carries `compilePattern` / `applyPattern` / `FieldPattern` as canonical (20 frozen entries; 13 values, 4 types). Purely additive — every old name still works.

### Deprecated

- **The old `recipe`-named API symbols are now `@deprecated` aliases of the `Pattern` names, removed at `1.0`:** `FieldRecipe` / `SceneRecipe` → `FieldPattern`, `compileRecipe` → `compilePattern`, `CompiledRecipe` → `CompiledPattern`, `FIELD_RECIPES` / `ESSENTIAL_RECIPES` → `FIELD_PATTERNS`, `FIRST_RELEASE_RECIPE_IDS` → `FIRST_RELEASE_PATTERN_IDS`, `EXPERIMENTAL_RECIPES` → `EXPERIMENTAL_PATTERNS`, `applyRecipe` → `applyPattern` (+ `ApplyRecipeOptions` / `AppliedRecipe` / `AppliedRecipeInspection`). No runtime warn (a `type`/`const` re-export, matching the existing `SceneRecipe`/`ESSENTIAL_RECIPES` convention); the `@deprecated` JSDoc and [`deprecation-plan.md`](docs/canonical/deprecation-plan.md) rows 4–9 are the signal. Internal-only helper type names (`BodyRecipe`, `RecipeTier`, …) and the `data/recipes.json` filename are a later phase; the ports mirror the rename in phase 2.

### Changed

- **`@fundamental-engine/core` (internal, no API change):** extracted the pure-math modules (`math.ts`, `geometry.ts`) from `src/core/` into a dedicated `src/math/` folder — step 1 of standardizing the core folder layout across all planes (`engine · forces · math · recipes` + the finer concern folders). Public exports and the barrel are unchanged; `check:api` intact.
- **`@fundamental-engine/core` (internal, no API change):** renamed `src/core/` → `src/engine/` to match the port layout (Swift `Engine/`, Kotlin `engine/`) — step 2 of the cross-plane folder standardization. 127 files moved with history; imports, the barrel, hardcoded read-paths in `contract-coverage.test.ts` / `check-docs.mjs` / `gen-parity-matrix.mjs`, and 26 doc links all repointed. Public exports unchanged; `check:api` 17-frozen intact.
- **Swift + Kotlin ports — the recipe → `Pattern` rename is mirrored (phase 2).** `FundamentalCore` (Swift) and `:fundamental-core` (Kotlin) rename `FieldRecipe` → `FieldPattern`, `CompiledRecipe` → `CompiledPattern`, `compileRecipe` → `compilePattern`, and the `FieldRecipes` catalog namespace → `FieldPatterns`, keeping the old names as `@available(*, deprecated)` / `@Deprecated` aliases (removed at `1.0`) — parity with phase 1's public boundary. Internal helper type names (`BodyRecipe`, `RecipeTier`, …) are deferred, matching phase 1. Verified: `swift build` + `swift test` (234 tests incl. the cross-plane conformance golden) and Kotlin `:fundamental-core:test :lab:test` (217 tests) green.

## [0.9.3] — 2026-07-03

### Added

- **`@fundamental-engine/core` — DECLARED four render reference points (Wallpaper Rule, #975).** Four
  content-independent constants painted into the render/diagnostics draw path (a "gray debt") are now
  documented, opt-in `FieldOptions` whose defaults reproduce the historical values, so every render
  mode is byte-identical by default:
  - `heatCenter: { x, y }` — the cool→warm heat-vignette center for the `dots`/`depth` swarm, as
    viewport fractions (default `{ x: 0.5, y: 0.4 }` = the old `(W/2, H·0.4)`).
  - `redshiftObserver: { x, y }` — the observer the `redshift` mode reads radial velocity against
    (default `{ x: 0.5, y: 0.5 }` = the old `(W/2, H/2)`).
  - `depthFocal: number` — the `depth` camera perspective focal length in CSS px (default `480` = the
    old `FOCAL`).
  - `heatmapFade: { start, span }` — the density-`heatmap` scroll-fade curve in viewports; full above
    `start·H`, gone by `(start+span)·H` (default `{ start: 0.3, span: 0.85 }` reproduces the old
    `(1.15 - scrollY/H)/0.85`; set a large `span` to disable the scroll fade). Also fixes the stale
    "NOT coupled to scroll" comment that contradicted the fade code.

- **DX batch (#993) — dev-only diagnostics + teardown reclamation.**
  - **`@fundamental-engine/core`:** `semanticToMetrics()` now emits a dev-only, deduped
    `NOOP_CONCEPTUAL_LAYER` warning when a semantic layer whose target is a conceptual/visual lane
    (`phase`/`potential`, e.g. `status`) returns `{}` — explaining why the result is empty instead of
    a silent no-op. Documented the metric-channel resolution order for co-occurring layers
    (importance+priority→attention, urgency+recency→heat, relationship+history→memory): per-layer,
    last-write-wins on merge. Dev-gated (compiled out in production).
  - **`@fundamental-engine/dom`:** `RelationshipRegistry.discover()` and
    `VisualBindingRegistry.scan()` now warn once (dev-only, deduped) when invoked at frame frequency —
    the layout-traversal trap; both walk the DOM and are meant to run on a throttle / on mutation.
    Added a package-local `dev-warn` helper mirroring core's guard gate. Added
    `StateRegistry.clearAll()`, `FeedbackRegistry.prune()`, and `FeedbackRegistry.clearAll()` for
    immediate strong-ref reclamation.
  - **`@fundamental-engine/elements`:** the `<field-root>` platform runtime `destroy()` now explicitly
    prunes + clears the state and feedback registries on teardown, closing the strong-ref retention
    window rather than relying on the platform object being collected.
  - **`@fundamental-engine/create`:** template deps are pinned to a bounded range (`^0.9.2`) instead
    of `latest`; the CLI now handles `--help`/`-h` and `--version`/`-v`; added non-interactive CLI
    smoke tests.

- **`@fundamental-engine/core` + `@fundamental-engine/elements`:** **declared the resting
  `ambient` formation's swirl + drift (Wallpaper Rule, #978).** The default `ambient` formation
  injected a hardcoded `orbit: 0.1` tangential swirl into `attract` bodies (plus a hardcoded
  `wander: 1.0` drift) — a content-independent "gray debt" painted into behavior. Per the Wallpaper
  Rule remedy order (derive → declare → demote → sugar; never delete), these are now DECLARED as
  documented, opt-in `FieldOptions` — `ambientOrbit` (default `0.1`) and `ambientWander`
  (default `1.0`), also `<field-root ambient-orbit>` / `<field-root ambient-wander>`. The defaults
  reproduce the historical constants, so the resting field is byte-identical; set `ambientOrbit: 0`
  for a purely radial resting attract (no spiral). Applies to the `ambient` formation only (the
  section formations keep their authored presets). Proven default-unchanged in
  `ambient-formation-declared.test.ts`.

- **`@fundamental-engine/core` + `@fundamental-engine/elements`:** **four new underlay render
  modes — `knockout`, `redshift`, `blackbody`, `depth` (#667, #668, #669, #670).** All are
  additive values on the existing `render` option / `setRender(mode)` /
  `<field-root render="…">` union; the default (`'none'`) and every existing mode are
  untouched. `knockout` inverts figure and ground: the field paints a solid accent wash and
  matter erases feathered holes through it (`destination-out`) — matter as negative space;
  for the field-visible-only-inside-letters treatment the host clips the canvas to real type
  with a CSS mask (§11-safe — matter never assembles into letterforms). `redshift` keeps the
  dots geometry but tints by spectral shift: Doppler from each particle's radial velocity
  against a viewport-centre observer (receding red, approaching blue, normalized by the unit
  system's `env.c`) plus a gravitational red near body wells. `blackbody` tints by energy
  (carried heat + kinetic) on a thermal ramp — ember → deep red → orange → warm white →
  blue-white — with brightness rising with temperature. `depth` makes the z lane visible as
  true 2.5D: far-to-near painter's sorting (drawn source-over so near matter occludes far),
  perspective parallax toward the viewport centre, and a draw-time defocus (wider halo,
  faded core) with distance — exactly the dots pass in a flat field. The pure geometry/color
  math (`knockoutHoleRadius`, `radialVelocity`/`dopplerShift`/`wellWeight`/`redshiftShift`/
  `redshiftRGBInto`, `blackbodyT`/`blackbodyRGBInto`, `depthScale`/`depthProject`/
  `depthAlpha`/`depthBlurRadius`) lives in `core/render-modes.ts` with pinned unit tests,
  mirroring the port-ready extraction pattern (#961). No new surfaces, no `mix-blend`, no
  per-frame allocation (the depth sort reuses a persistent index scratch). The four modes
  join the `RENDER_MODES` catalog (now 20 entries), the recipe render layers, and the
  `<field-root>` CEM. JS core only; Swift/Kotlin port parity is a follow-up.

- **`@fundamental-engine/core`:** **`BURST_RADIUS` and `monopoleField` exports (#977, Wallpaper
  Rule).** `BURST_RADIUS` is the reach a one-shot `field.burst()` touches (formerly a private
  literal in the burst glue), exported so a UI affordance that visualizes a burst sizes itself to
  the real blast front. `monopoleField(cx, cy, sign, s, x, y)` is the engine's radial-monopole
  field — now the ONE formula `charge.field` (via `bodyMonopole`) radiates AND the site's
  charge-stage field-line diagram traces, so the diagram is the real engine field, not a hand-rolled
  stand-in. `FrameState` (conformance trajectory) also records carried `color`, so a `pigment`
  scenario's trajectory captures the real color transport. Additive; no behavior change.

- **`@fundamental-engine/core` + `@fundamental-engine/elements`:** **opt-in velocity-Verlet
  integrator mode (#659).** `integrator: 'velocity-verlet'` (also
  `<field-root integrator="velocity-verlet">`) runs the second-order scheme in its
  stored-acceleration form: the position full-step uses the previous step's acceleration
  (`x += v·dt + ½·a·dt²`), the force pass then evaluates `a′` at the updated position, and the
  velocity takes the half-step average (`v += ½·(a + a′)·dt`). The engine's impulse-based,
  velocity-dependent force model is folded in the standard way — a step's net Δv is read as
  `a′·dt` — and kinematic velocity-REPLACING forces (`jet`/`wall`/`lens`/`gate`/`warp`) bypass
  the average as discontinuities (the replaced velocity stands; the stored acceleration resets).
  The `FRICTION`/`HEAT_DECAY` decays are dt-scaled like `'fixed'`. Caveat canon: this buys
  positional accuracy, not conservation — energy/momentum remain non-conserved by design and the
  per-step decay keeps the scheme non-symplectic; particle count stays the invariant. Purely
  opt-in: the default `'legacy'` path is byte-identical and the cross-plane conformance golden
  (generated at defaults) is unchanged. JS core only; Swift/Kotlin port parity is a follow-up.

- **`@fundamental-engine/elements`:** **per-cell particle budgets + isolation on `<field-cell>`
  (#685, shadow-dom.md §31.19).** Two new attributes cap a standalone local cell's resource use so a
  docs page full of demos stays cheap: `max-particles` is a hard ceiling on the pool size (it clamps
  *both* the auto-size and an explicit `count`, so a cell can never exceed its declared budget), and
  `fps` throttles the animation loop to a target framerate (0/absent = the display's native rAF
  cadence). Each cell already owns its own pool; both caps are enforced **per instance**, so a
  saturating cell cannot share, starve, or resize a neighbour. Additive and backward-compatible —
  cells without the new attributes behave exactly as before.

- **`@fundamental-engine/elements`:** **SSR pre-registration queue for shadow hosts (#683).** On a
  server-rendered page, custom-element bodies can upgrade — and dispatch their composed
  `field:register-body` events — *before* `<field-root>` boots and wires its listeners; that one-shot
  event had no listener yet, so the body was silently lost and rendered as inert HTML. The package now
  installs a capturing document listener at first-field construction (SSR-guarded — a no-op without
  `document`) that **buffers** early register/unregister/update events, keyed by element (last write
  wins, so an `unregister` supersedes a pending `register` — no stale body). When a field boots it
  drains the queue, replaying the buffered events on their source elements so the field registers them
  through its normal, idempotent path (shadow-dom.md §31.10). Purely additive lifecycle plumbing —
  no new public surface; a client-only page whose field boots before any body buffers nothing and
  behaves exactly as before.

- **`@fundamental-engine/dom`:** **reduced-motion platform lint (`lintReducedMotion`, RC-8 / #325).** A
  new dev-only lint rule (`motion-without-reduced-motion`) flags the accessibility sibling of the
  silent-contract gap: a `[data-body]` that expresses **independent** motion — a CSS `animation`, or a
  static (non-feedback-driven) `transform`/`translate`/`rotate`/`scale` — with **no**
  `@media (prefers-reduced-motion: reduce)` rule that matches it. The invariant it guards is *reduced
  motion removes motion, not meaning*. **Feedback-var-driven motion is deliberately exempt:** this engine
  gates motion at the engine level — under `prefers-reduced-motion` the simulation freezes (dt=0; the
  integrator early-returns), so ambient, sim-driven change in `--d`/`--field-*`/`--load` stops, while the
  feedback lane stays live for direct engagement (pointer/focus); what remains is a discrete interaction
  response, not autonomous motion — those bodies are reduced-motion-safe and are not flagged. Like the
  other stylesheet-walking lints it is heuristic and browser-coupled: it no-ops where stylesheets are
  unreachable (SSR / tests / cross-origin), so it can only under-report, never false-positive;
  opacity/colour changes are not treated as motion, and the transform-family match is
  property-name-anchored so typography (`text-transform: uppercase`) is not mistaken for movement. Runs
  automatically inside `lintPlatform`. (This is the lint half of RC-8; the real assistive-tech pass
  remains a separate manual step.)

- **`@fundamental-engine/core`:** **opt-in charge-gated `fieldflow` (#711).** A new body flag
  `data-charge-gated` restricts the `fieldflow` force to *charged* matter (`charge ≠ 0`), modelling
  magnetized plasma tied to the field line so it composes with `charge`; neutral matter drifts free.
  The default (flag unset) is unchanged — `fieldflow` still advects ALL matter (neutral-medium
  transport). Exposed on the body contract as `chargeGated` (parsed from `data-charge-gated`).

- **`@fundamental-engine/three`:** **native 3D field visuals hardened — pooled streamline tubes,
  magnitude-coloured vector grid, cadenced re-sampling (#392).** `streamlineTubes` no longer rebuilds
  its scene objects on every `update()`: tube `Mesh`es are now pooled and reused across retraces
  (hidden — not removed — when a line stalls, mirroring the #391 label-sprite pool), path points reuse
  a persistent scratch, and only the `TubeGeometry` a retrace replaces is disposed; `dispose()` still
  frees everything. Both visuals gain an `interval` option — re-sample the field every Nth `update()`
  call (tubes default to `6`, the engine's measure cadence; arrows to `1`) — so an expensive trace runs
  on a cadence while the scene draws the cached geometry every frame. `vectorField` arrows now colour
  by magnitude (a per-instance `color → hotColor` lerp, default white-hot), and both visuals place
  their `z` as an offset off the **projected field plane** rather than an absolute world `z`, so they
  register correctly under a `VolumeProjection({ centerZ: true })`. Renderer-free lifecycle tests pin
  pool reuse, cadence, and disposal.

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

### Changed

- **`@fundamental-engine/core` (breaking, pre-1.0 window, #988):** renamed the discrete event-bus keys
  `absorb` → `captured` and `release` → `released` (`field.on(...)` / `FieldEventMap`). `absorb` was a
  naming-lane violation — concept language in the execution/event lane (the token is `sink`) — and the
  new past-tense occurrence verbs match the native ports (Swift `CaptureEvent.captured/released`,
  Kotlin `CaptureEvent.CAPTURED/RELEASED`). Only the bus keys change; the `data-absorb` body attribute,
  the `--load` channel, and the DOM `field:captured`/`field:released` CustomEvents are unaffected.
  Migrate `field.on('absorb'|'release', …)` → `field.on('captured'|'released', …)`.

- **`@fundamental-engine/core` + `@fundamental-engine/elements`:** **the Currents (`waves`) default
  to OFF — explicit opt-in on every plane (#979, doc-06 Step 0).** **Behavior change:** a bare field
  no longer builds or draws the background carrier waves (the five wave layers + the bound shimmer
  reservoir). `createField`'s `waves` option now defaults to `false`, and the `<field-root waves>`
  attribute becomes a true opt-in boolean (absent = off; present and not `"false"` = on — the same
  semantics as `attention`/`causality`/`mass`; previously absence meant ON). Opt back in with
  `waves: true` / the `waves` attribute — the opted-in field is unchanged. This is the signals-first
  companion to the `render: 'none'` flip (#538): hardcoded ambient structure painted identically
  over every host is wallpaper, not substrate — the resting look is now declared where it is wanted
  (the starter pins `waves`; the site's `<field-root>` already declared `waves="false"`). The Swift
  port takes the same flip **plus** the `render: .dots → .none_` default it had retained from
  pre-#538 (`FieldOptions` in `FieldHandle.swift`); the Kotlin port already had both defaults off
  (`wavesEnabled = false`, `RenderMode.NONE`) and gains a pin test. The cross-plane conformance
  golden never passes waves and is byte-unchanged.

- **`@fundamental-engine/core` + `@fundamental-engine/dom`:** **allocation/lookup refactors on the
  per-frame hot paths (#991)** — correctness-preserving, aimed at GC churn rather than a headline
  fps win (the field is fill-rate-bound; see the performance notes). (1) `SpatialHash`
  (`packages/core/src/core/spatial-hash.ts`) now pools bin arrays across the every-frame `reindex`
  rebuild — `clear()` empties live bins (`length = 0`) onto a free-list instead of discarding them,
  so a re-populated cell reuses its backing array instead of allocating a fresh one per non-empty
  cell per frame. An equivalence test pins neighbour-query results byte-identical to brute force
  across 60 churning rebuilds. (2) `MeasurementRegistry.for()`
  (`packages/dom/src/measurement.ts`) is now O(1) via an identity-keyed `Map` built during
  `measure()`, replacing a linear `snapshot.find()` scan (was O(M×N)/frame when forces looked up
  per element); the self-healing prune of disconnected elements is unchanged. (3) the off-thread
  render bridge (`packages/dom/src/worker/offthread-bridge.ts` + `render-worker.ts`) transfers a
  pooled particle buffer to the worker and back each frame instead of `buf.slice(...)` copying it,
  removing the per-tick allocation. Public behaviour unchanged; benchmark deltas are indicative only
  (headless software-raster) — confirm on real hardware.

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

- **The migration-alias surface, per the 1.0 removal checklist (#939):** the `forces:*` event alias
  (use the canonical `field:*` events), the `--mass` CSS variable (use `--load`), and the deprecated
  `@fundamental-engine/platform` alias package (import `@fundamental-engine/dom` directly). The
  publishable set is now six packages. Dev-console deprecation warnings shipped one cycle ahead (#930);
  the migration table is `docs/migration-0.x-to-1.0.md`.

- **Removed the historical `ROADMAP.md` and `BACKLOG.md` root docs.** The pre-1.0 refactor roadmap and the
  manually-maintained backlog lagged `main` and duplicated the RC1 board (user Project #24); planned work
  now lives on the board, and shipped work in `CHANGELOG.md` + per-version `docs/release-notes/`. Inbound
  references (docs, the catalog-count doc guard, the `llms` corpus generator) were updated accordingly.

### Fixed

- `packages/react/tsconfig.json` now excludes `*.test.tsx`/`*.spec.*` (not just `*.test.ts`), so a JSX test file no longer compiles into `dist/` and gets picked up as a stale `node --test` artifact (#1006).

- **`@fundamental-engine/core` — rescan continuity follow-ups (#970, builds on #966/#969).** Two
  more rescan discontinuities carried in `scan()`'s reconciliation, keyed by the same (element,
  per-element body index):
  - **Anonymous-id churn.** A body with no DOM id resolves to a synthetic `body-N`. That id lived
    only on the rebuilt `Body` object, so any rescan minted a fresh id for the same element — the id
    churned, breaking every consumer that keys on it (snapshot/diff/replay, captures, relationship
    edges). The reconciliation now carries `identity` onto the replacement, so the same element keeps
    its id even when its scan index shifts under an add/remove.
  - **Dynamic-body motion reset.** A `data-authority="dynamic"` body's engine-owned position/velocity
    (`bx/by/bvx/bvy`) were undefined on the rebuilt `Body`, so a rescan re-adopted the freshly-measured
    DOM centre and zeroed velocity — a drifting body teleported back to its authored slot when any
    body was added/removed. The reconciliation now carries the kinematic state, so the body resumes
    on its trajectory. The ports (Swift/Kotlin) register bodies explicitly rather than rescanning the
    document, so neither discontinuity exists there — no port follow-up.

- **`@fundamental-engine/core`:** **the last two unseeded randomness sites now flow through the
  injected rng (#976).** The `thermal` force's four Box–Muller draws (`forces/natural.ts`) and the
  spark-burst COUNT (`sparkCount` in `field.ts`'s `spawnSpark` — the directions were already
  seeded) drew raw `Math.random`, so a seeded field with a thermal body was non-reproducible and
  any discharge shifted the shared rng stream by a run-varying number of draws, diverging every
  draw after it. Both now use the #371 `(e.rng ?? Math.random)` pattern; a field-level determinism
  test pins a seeded thermal + discharge run to a bit-identical fingerprint across runs. Default
  (unseeded) behavior is unchanged; the conformance harness's global-swap seeding still applies
  through the fallback.

- **`@fundamental-engine/dom` + `@fundamental-engine/react`:** hardening pass on the X-Ray overlay
  and `useForcesData` (#989). **`mountXRay`** (`packages/dom/src/x-ray.ts`) no longer builds its panel
  with `innerHTML` — an interpolated `hotkey` value (or any readout) was an injection surface; the
  panel is now assembled from typed element/`textContent` nodes, so a hotkey like `<img onerror=…>`
  renders as inert text and injects no element. It also mounts against the container's own document
  (`ownerDocument`) instead of the global `document`/`body` (works in an iframe / popup / test DOM),
  and probes the optional `sample`/`energy` readouts through typed structural guards rather than
  `(field as any)`. **`useForcesData`** (`packages/react/src/index.tsx`) no longer skips binding
  forever when `containerRef.current` is null on the first effect pass: the host node is tracked in
  state and the mount effect re-runs the moment the container attaches. New mount/teardown +
  injection-inert tests for X-Ray; new null-first-pass retry tests for the hook.

- **`@fundamental-engine/core` + `@fundamental-engine/dom`:** **bodies belong to the nearest
  enclosing field — contained fields stop double-adoption (#980).** A contained field
  (`containerHost(el)` / the `bounds:` option) and the document-rooted page `<field-root>` both
  adopted the same `[data-body]` elements, so two engines alternated `--d`/`--field-density`
  writes on them every frame (a visible per-frame flicker between the contained field's values
  and the page field's near-zero ones — verified on /docs/reactive-component). Ownership is now
  nearest-enclosing-field: `containerHost` marks its bounds element with the reserved, engine-set
  `data-field-boundary` attribute at attach (idempotent) and removes it via the new optional
  `FieldHost.detach()` hook (called once by `FieldHandle.destroy()`); the scanner
  (`scanBodies`/`bodyElements`, shared with platform measurement) skips any body whose closest
  boundary marker is not the scan root — the page field only adopts bodies whose nearest boundary
  is the document, each contained field owns exactly its subtree, nesting resolves to the nearest
  boundary, and destroying a contained field hands its bodies back to the page field on rescan.
  New exports: `FIELD_BOUNDARY_ATTR`, `FIELD_BOUNDARY_SELECTOR`, `ownedByScanRoot`. DOM-plane
  fix only: the Swift/Kotlin hosts register bodies explicitly (no document-wide scan), so the
  double-adoption class does not exist there.

- **`@fundamental-engine/core`:** **the conformance runner injects its seeded PRNG through the
  `Env.rng` seam instead of monkey-patching the global `Math.random` (#992, post-#981).** `thermal`'s
  Box–Muller kicks now draw from `e.rng ?? Math.random` like `jet`/`spawn` already did, and
  `conformance/run.ts` threads one seeded `mulberry` instance through the frame-0 delta env and the
  trajectory env — so a seeded scenario is reproducible with no global side effect. Production behavior
  is byte-identical (no `Env.rng` set ⇒ `Math.random`); the cross-plane conformance golden is unchanged.

- **`@fundamental-engine/three`:** **`threeBackend`'s overlay `z` now offsets the projected field
  plane instead of being an absolute world z (#949).** The backend pinned every overlay vertex —
  lines/arrows (`segments`/`polyline`), the data-chip plates (`rect`), and the #921 label sprites
  (`text`) — at `z` in world space, so overlay readings mis-registered under a
  `VolumeProjection({ centerZ: true })`, whose field plane sits at `-depth/2 · depthScale`, not at
  the world origin. Each draw path now projects the field point through the injected projection and
  applies `z` as an offset off the projected plane — the same contract the native field visuals
  (samplers) hold. `PlaneProjection` and an uncentered `VolumeProjection` put that plane at world-z
  0, so default scenes are pixel-identical; tests pin the centered-volume registration and the
  default-unchanged invariant across all three draw paths.

- **`@fundamental-engine/core`:** **rescan no longer discards body feedback state or strands
  captured matter (#966).** `scan()` rebuilds every Body on any add/remove/register, and the
  rebuilt bodies started from zeroed runtime state — so every `data-feedback` body's `--d`
  hard-dropped (measured 1.000 → 0.080) and eased back over ~1s on ANY rescan, while matter a
  sink had captured stayed pinned to the old (ghost) Body object — frozen centre, never
  released — as the rebuilt sink re-captured a second full capacity. `scan()` now reconciles
  the new generation against the old (the same pattern the movers/emitters already used), keyed
  by (element, per-element body index) so `data-preset` expansions carry per virtual body:
  persisting bodies keep `d`, `attn`, `accreted`, `count`, and `wasOn`; captured particles and
  docked elements are remapped to the replacement Body (one O(P) pass, only when a persisting
  body actually held matter); the Body-keyed `sinkPeak` + `bodyThresholds` side tables are
  re-keyed (so a mid-cycle sink still reports its release count and carried density doesn't
  re-fire an already-announced threshold edge), while proximity membership and the measured
  thermodynamic windows still reset by design (they re-derive within a frame). Removed elements
  still drop all their state. No public API change; measure cadence untouched.

- **`@fundamental-engine/core`:** **reduced-motion no longer leaves body density stale (#967).**
  Under `prefers-reduced-motion` (or `maxMotionBudget`/`budgets.motion` = 0) the sim freezes with
  `env.dt = 0` and the integrator's `step()` early-returns — but it returned *before* the per-pass
  `b.count = 0` reset, so the density counts held their last live value while `writeFeedback()` kept
  running every frame, easing `--d`/`--field-density` (and the font-weight channel) toward a stale,
  permanently-elevated count. A frozen field reported particle presence from a simulation that was
  no longer running. The count/thermo reset is now hoisted into a shared `resetDensity()` that runs
  on both the live and the `dt === 0` paths, so a frozen body's `b.count` re-zeros and `b.d` eases
  down to `feedbackTarget(0, b.on)` — the engagement-only baseline. Engagement (`b.on`, which is
  dt-independent) still reads truthfully: motion freezes, but the signals stay honest. Fixed in all
  three planes (JS core + Swift + Kotlin, which shared the same integrator-seam ordering bug).

- **`@fundamental-engine/three`:** **`threeBackend`'s line/rect vertex data actually reaches the GPU
  again** — writing the registration tests above exposed that the #463 persistent-buffer refactor
  never uploaded a single overlay vertex: `flush` wrote each frame into a kept `Float32Array`, but
  the `Float32BufferAttribute` wrapping it **copies** its input at construction, so the attribute
  held its own zeroed array and every in-place write landed in memory the GPU never saw (all line +
  rect geometry silently drew degenerate points at the origin; the #921 label sprites, which don't
  ride these buffers, were unaffected). The attributes are now plain `BufferAttribute`s, which hold
  the typed array by reference — the write-in-place + `needsUpdate` design of #463 as intended. The
  new registration tests double as the guard: they read the vertices back out of the attributes.

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

- **`@fundamental-engine/{core,elements,vanilla}`:** **five permanent drift-guard tests (#992).**
  (1) `<field-root>`'s option-forwarding reverse guard now DERIVES its checked set from
  `observedAttributes`/`OPTIONS` instead of a stale hand-maintained literal (it had fallen behind
  `grid-warp`/`theme`/`gradient*`/`wave-baseline`/`separation`). (2) A vanilla delegation-drift guard
  compares a real headless `FieldHandle`'s method surface to `FieldField.prototype`. (3) A `forAgent`
  facade-completeness guard requires every `FieldHandle` method to be explicitly exposed OR withheld
  (safety: no accidental agent exposure). (4) A passport-vs-implementation guard (in
  `validatePassports`) asserts any force whose live object defines `modify()` is passported as a
  non-moving modifier. (5) Conformance-runner determinism guards prove a seeded scenario reproduces
  exactly and never touches the global `Math.random`. Each was verified non-vacuous (fails when its
  invariant is deliberately broken).

### Documentation

- Correct `packages/core/README.md` feedback wording: `--d` and `--field-density` are consistent twins (same live value, read either), not legacy aliases; only `--forces-density` is the removed legacy variable — matching `docs/canonical/feedback-channels.md`.

- **`<field-cell>` boundary statement (#993):** documented that a cell is a demo pool, not the engine
  — own particle pool, local `Math.random()`, and **none** of the core guarantees (no determinism,
  snapshot/causal replay, cross-plane conformance, or physics parity). Added to the
  `@fundamental-engine/elements` README and `docs/engine-reference/shadow-dom.md`. Also aligned the
  Next.js example's SSR guidance (`examples/nextjs/app/components/FieldCanvas.tsx`) with the README:
  a `'use client'` import from a Server Component IS the App Router SSR boundary — no
  `dynamic(…, { ssr: false })` wrapper (that pattern is Pages-Router-only and throws in an RSC).

- **`@fundamental-engine/dom`:** corrected the stale `QualityGovernor` header comment
  (`packages/dom/src/governor.ts`) — it still said the engine-side quality responses were "NOT
  automatic yet", but since #413 the `<field-root>` runtime forwards each tier change to
  `handle.setQualityTier` (DPR cap + heatmap drop applied automatically); only *further* responses
  (render simplification, particle caps) remain the embedder's via `field:quality-tier`. Comment
  only — no runtime change. Part of the #588 docs pass (the createField unguarded-path guidance on
  the performance page, the TypeScript/core guides, and `docs/canonical/platform-architecture.md`).

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
  `@fundamental-engine/*`) across `docs/canonical`, `docs/research`, `docs/engine-reference`,
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
