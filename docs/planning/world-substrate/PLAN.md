# Work plan — Computational-World Substrate

> **Status: planning (proposed WBS).** The itemized work breakdown for the program in
> [`README.md`](README.md). Narrative, the kernel, the derivation classes, and the canonical
> terminology live in the README — this document is the itemized plan. Nothing in F1–F5 or C2 is built.
> Each item's acceptance criterion is a **falsification** test, not "it compiles."

**Version:** 2.0 (revised per plan review, 2026-07-19) · **Owner:** Zach Shallbetter

## The decisive correction (v2.0)

Not everything previously labeled "derived" is the same kind of derivation. Three classes, with
different evidence standards:

- **Runtime-derived** — computable from the world model `K`: system-relative opportunity, reachability, enabled operations, permission, exposure, signaling, transition traces, candidate interaction episodes.
- **Contract-relative** — defined only against an explicit analytical contract: projection preservation, typed similarity, equivalence, invariance, comparison admissibility. Not properties of the runtime alone.
- **Empirically inferred** — not derivable by executing `K`: attributed behavior, human strategy, transfer, participant *belief* about opportunity, measurement claims, interpretation, experience. The runtime supplies evidence; it does not assert these as facts.

**Central statement:** *The kernel produces world state, transitions, system-relative opportunity,
candidate interaction episodes, and evidence. Contract-relative comparison and empirically inferred
constructs are defined over those outputs but are not asserted by the runtime.*

## The kernel is a hypothesis, not seven settled primitives

Working hypothesis: `K = ⟨Entities, State, Relations, Operations, Dynamics, Projection, Invariants⟩`.
**Competing (smaller) hypothesis to test against it:** `K₀ = ⟨X, Θ, Π, V⟩` — world configuration `X`;
lawful evolution + admissible operations `Θ`; participant-relative projection/access `Π`; validity +
invariant predicates `V`. Entities/relations become typed structures in `X`; operations become typed
members of `Θ`. The runtime may still *expose* all seven authoring concepts while the minimization
inquiry tests whether the smaller formal core suffices. **Authority and capability are not primitives** —
authority is a typed constraint `Permitted(participant, operation, object, scope, state, time)` evaluated
by the transition system; capability is an operational predicate over participant type, environment, and
substrate.

## Governing rules
- **R1a — Computational derivation.** A runtime-derived claim ships with: executable derivation; formal I/O definition; positive + negative test cases; an ablation/alternative-encoding test; determinism + provenance guarantees.
- **R1b — Empirical inference.** An empirically-inferred claim ships with: observation model; attribution rule; uncertainty model; rival explanations; a reliability/validity study; stated conditions under which inference is *not* permitted. (These are Track-C obligations; the runtime never asserts them.)
- **R2 — Compression gate.** Every proposed kernel/contract field must survive ablation before it freezes, else it is demoted to sugar or dropped.
- **R3 — Kernel minimization (four ablations).** Test each element by **deletion**, **substitution** (encode via another element), **collapse** (merge two, test for lost capability), and **factorization** (split, test for added value). Classify each element as: *required formal primitive · required runtime index · required authoring syntax · required only for explanation · fully reducible.* Deletion alone proves implementation locality, not necessity.
- **R4 — Plane-neutral core, deferred ports.** Core semantics are plane-neutral from the start; JS is the executable reference during experimentation. Every stage emits language-neutral conformance vectors. Swift/Kotlin must pass those vectors before a surface graduates from EXPERIMENTAL — but native porting is **deferred until the relevant JS semantics survive a full stage with no kernel-shape question open.** (Stricter semantically, cheaper operationally.)
- **R5 — Freeze respect.** New surface stays EXPERIMENTAL until a stage exit graduates it; the frozen surface (`api-stability.md`) is untouched without sign-off.
- **R6 — No merges on your behalf.** Work lands on named branches; you merge.

**Item schema:** `ID · deliverable · acceptance (falsification) criterion · depends-on · size · risk · plane · gate`

---

## Track F — Fundamental: Computational-World Substrate

### F0 — Stage 0: the plan  ·  (branch `plan/world-substrate`, pushed)
- **F0.1** Program planning doc + WBS. — *done*
- **F0.2** Pin canonical `world` terminology. — *done (`b8e512ff`)*
- **F0.3** Kernel-reframe of README: make `K` the explicit center; add the **three derivation classes**, the `K` vs `K₀` competing-hypothesis note, and R1a/R1b. — accept: README leads with the kernel + derivation classes; WorldContract described only as `K`'s type · S · Low · docs · **gate: G1**

### M1.5 — Semantic freeze for the experiment  *(new gating milestone; precedes F1)*
Enough semantic stability to make F1 interpretable (not a full theory freeze). Required outputs:
derivation taxonomy (the three classes); provisional **participant-admission rule** (feeds `Entities`);
provisional **boundary-validity model** (feeds Interaction); **authority-encoding decision** (typed
constraint); kernel element role definitions; the runtime-vs-empirical claim boundary; the **version
envelope**; the four-ablation methodology. — accept: all eight recorded + provisionally ratified · M · Med · docs+theory · **gate: G2 precondition**. Depends on C1.7–C1.10 (provisional, not full prose).

### F1 — Stage 1: kernel + first derivations  *(code begins; gated on M1.5)*
- **F1.0** Kernel identity + version envelope. — accept: every serialized world names its kernel-schema + contract versions; traces retain the version they were produced under; incompatible versions fail explicitly; **no silent migration** · M · Med · JS · gate: M1.5
- **F1.1** Typed kernel core `K` hosting an existing `FieldPattern`, proven by **three equivalences**. — accept: a current Field Pattern is represented through `K` with (a) **operational** equivalence — identical numerical output + transition traces; (b) **structural** equivalence — bodies/relations/dimensions/config map in without hidden/lossy translation; (c) **invariant** equivalence — invariants, replay, failure conditions unchanged; and **no field-specific escape hatch** in the kernel API · L · High · JS · gate: F1.0
- **F1.2** Derive **system-relative opportunity** `Ω_sys = f(X, O, C, A, R, Π, H)` only — one predicate for one participant/operation/state/projection (`evaluateOpportunity(context, operation)`): domain-validity, capability, permission, enablement, reachability, exposure, signaling, reversibility, recovery. **Participant belief `Ω̂` is out of scope** (empirical). — accept: `Ω_sys` computes + serializes; no belief/interpretation field present · M · Med · JS · gate: F1.1
- **F1.3** **Parameterized candidate-episode detection**, not unconditional interaction facts. `detectInteractions(trace, {participants, boundary, timescale, recurrenceWindow, couplingPredicate, minimumInfluence})` returning: detected episode · supporting transition pairs · boundary used · recurrence/reciprocity basis · determinacy · alternative segmentations · failure reason. Ship with **adversarial examples**: unilateral effect · delayed response · timeout · retry · nested · one-shot no-reply · async-outside-window · shared-environmental-cause. — accept: detector returns candidates under declared parameters; adversarial cases classified correctly (esp. the non-interactions) · L · High · JS · gate: F1.1
- **F1.4** **Four-ablation harness** (per R3): Projection test (can exposure live in participant-relative state/observation without a distinct `P`?); Relation test (coupling in transitions without distinct `R`?); Operation test (operations as labeled `Dynamics`?); Invariant test (invariants as transition guards/postconditions?). — accept: each element receives a necessity classification; the report distinguishes theory-necessity from implementation-locality · M · Med · JS · gate: F1.2, F1.3
- **F1.5** Stage-1 finding report: derivation classes confirmed/revised; per-element necessity classification (R3); `K` vs `K₀` verdict. — accept: written finding + updated plan · S · Low · docs · gate: F1.4
- **F1.6** *(moved)* Native port of the kernel + derivations. — **deferred to after F2 review** per R4; JS conformance vectors emitted now, native implementation later · L · Med · +Swift +Kotlin · gate: F2 review

### F2 — Stage 2: projections as executable contracts
- **F2.1** `ProjectionContract` type + a **property language** typing each claim into three classes: **mechanically-decidable** (identity/operation coverage, label preservation, value tolerance), **model-checkable** (reachable-outcome preservation, stutter-equivalent ordering, authority-not-expanded, reversibility retained), **empirically-testable** (discoverability, comprehension, accessibility, salience). — accept: a projection declares typed claims · M · Med · JS · gate: F1
- **F2.2** Validator + oracle. — accept: mechanically-decidable and model-checkable claims are checked and a violation fails; **empirically-testable claims produce an *unresolved empirical obligation*, never a pass** (so "accessibility preserved" cannot become a software assertion outrunning evidence) · L · High · JS · gate: F2.1
- **F2.3** Ablation: a projection claiming to preserve `Q` that doesn't is caught (for the two decidable classes). — accept: negative test passes · S · Low · JS · gate: F2.2
- **F2.4** *(after F1/F2 architecture review)* Native kernel + projection port. — accept: JS conformance vectors pass on Swift + Kotlin · L · Med · +Swift +Kotlin · gate: F2.2 + review

### F3 — Stage 3: opportunity graph + transition evidence
- **F3.1** **Opportunity Graph + horizon analysis** (distinct from F1.2's single predicate): `world.opportunities({participant, state, projection, horizon})` — graph traversal, reachable outcomes, recovery paths, reversibility, explanation of failed predicates. — accept: typed profile over a state space; failed predicates named · L · Med · JS · gate: F1.2, F2.1
- **F3.2** **Transition evidence ledger** (not "causal" by default): per-transition provenance (prior state → trigger → authority → preconditions → transition → projection → result → invariants). Causal claims are **typed**: execution-causal · mechanism-declared · counterfactual-simulated · intervention-supported · empirically-causal. The runtime authoritatively reports only **execution-causal** within its deterministic substrate. — accept: a real decision reconstructs end-to-end; no claim above execution-causal is emitted by the runtime · L · Med · JS · gate: F1.0
- **F3.3** False-opportunity detection. — accept: an agent claiming an operation it lacks is flagged with the missing predicate named · M · Med · JS · gate: F3.1
- **F3.4** *(after interface stabilization)* Native port. — accept: opportunity + ledger vectors pass on all planes · L · Med · +Swift +Kotlin · gate: F3.1, F3.2

### F4 — Stage 4: typed conformance + adversarial suite
- **F4.1** `compare(a, b, contract)` with an **admissibility gate before profile computation**: (1) comparison question → (2) admissibility check → (3) resolve transforms → (4) resolve dimensions/invariants → (5) typed profile → (6) unsupported dimensions → (7) substitution-claim decision. May return `{admissible:false, reason, unsupportedDimensions, profile:null}`. — accept: incomparability is distinguished from low similarity; a critical failure cannot be numerically hidden · L · Med · JS · gate: F3
- **F4.2** Expand the conformance golden to world / operation / projection / opportunity conformance. — accept: golden covers the new dimensions · L · Med · JS · gate: F4.1
- **F4.3** Cross-plane world conformance. — accept: Swift, Kotlin, web pass the **same** world contract against declared invariance claims · XL · High · +Swift +Kotlin · gate: F4.2
- **F4.4** Governed **migration** + historical interpretation (version *identity* already shipped in F1.0). — accept: a v3 snapshot stays interpretable at v7; migrations are explicit · L · Med · JS · gate: F1.0
- **F4.5** **Adversarial world suite** *(new; precedes the flagship)* — ≥4 worlds: clean deterministic workflow · asynchronous distributed interaction · continuous embodied/simulated control · institutionally-governed world with changing authority. — accept: the kernel represents each **without bespoke primitive additions**; failures + unsupported cases are documented; **no demo-specific exceptions enter the core** · XL · High · all · gate: F4.1

### F5 — Stage 5: flagship world  *(demonstrates a tested architecture, not defines it)*
- **F5.1** One declared world, ≥4 projections (visual · native · conversational · headless/API). — accept: shared identities/relations/operations/history across all · XL · High · all · gate: F4.5
- **F5.2** Live demonstration set (cross-projection state change; per-projection operation-set differences; live false-opportunity catch; reduced-motion semantic preservation; snapshot+replay of a decision; typed comparison; headless run). — accept: all seven demonstrated live · L · Med · all · gate: F5.1
- **F5.3** Reposition public copy → "computational-world substrate." — accept: hero/docs updated; honest maturity framing · M · Med · site · **gate: G4 (after F4)**

---

## Track C — CompInt (partly a *semantic prerequisite* to Track F, not fully parallel)

### C1 — Priority defects
Safe / immediate (approved in the review):
- **C1.2** Correct "Behavioral Opportunities" mislabeled as a "measurement unit." — S · Low · **approved**
- **C1.3** Clarify "Interaction Ecology" status; mark outdated priority-language in root README. — S · Low · **approved**
- **C1.4** Distribution hygiene (exclude `.DS_Store`, `__MACOSX`, objects/binaries; confirm `.gitignore`). — S · Low · **approved**
- **C1.1** Unique per-type contract IDs **+ alias/migration registry**: former shared ID retained as a deprecated family alias; all references migrated; ambiguous new use rejected; historical artifacts stay resolvable. — accept: unique IDs *and* provenance preserved · M · Med · **approved with alias registry**
- **C1.5** **Dual licensing**: `Apache-2.0` for code/schemas/tooling (patent grant), `CC BY 4.0` for research corpus + owned docs/figures; third-party materials excluded/attributed; `LICENSE` + `LICENSE-CODE` + `LICENSE-CONTENT` + a root note stating which paths fall under which. — accept: files present + path mapping clear · S · Low · **gate: G3 (confirm vs commercialization plans)**

Semantic prerequisites to F1 (move ahead as *provisional ratification*, feed M1.5 — not editorial afterthoughts):
- **C1.7** Participant-admission rule → affects `Entities`. — **before F1**
- **C1.8** Boundary-validity status/model → affects Interaction detection (F1.3). — **before F1**
- **C1.9** Canonical causal claim classes → affects the evidence ledger (F3.2). — **before F3**
- **C1.10** Shared contract base (consolidated fields) → affects serialization. — **before F1**
- **C1.12** Authority rules scoped by claim-type (not one global order) → canonical interpretation. — before F1

Registry / larger:
- **C1.6** Canonical **namespace system** (not bare IDs): typed, version-independent (`compint:concept/interaction-episode`, `compint:contract/projection`, `compint:claim/interaction-definition`, …). Each entry: stable ID · preferred label · definition · status · version-introduced · version-deprecated · replacement ID · source authority · aliases · dependencies · machine-readable type. **Version lives in metadata, never in the stable ID.** — L · Med · gate: ratification
- **C1.11** Separate historical release archives from the primary distribution. — M · Low · gate: conflicts with "lossless" design
- **C1.13** Bibliography authority verification (claim-level). — XL · Med · gate: research task
- **C1.14** *(out of scope for the agent)* Pilot a full contract chain in an actual study before freezing schema 1.0.

### C2 — V2 empirical sequence — each item splits A–E (I can do A, B, D scaffolding; you/collaborators do C)
`A. apparatus + protocol · B. synthetic dry run · C. human/field execution · D. analysis · E. theory update`
Preparation I can complete now without participants: study protocols, preregistration drafts, annotation
manuals, synthetic datasets, power-analysis + randomization scaffolding, analysis scripts, inter-rater
metrics, benchmark interfaces, consent/ethics-review drafts, data dictionaries, failure criteria.
- **C2.2** Annotation & segmentation (episodes/participants/actions/opportunity/strategy agreement).
- **C2.3** Contract-ablation (full vs reduced; feeds R2).
- **C2.4** Projection–opportunity (validates F3.1 `Ω_sys`).
- **C2.5** Strategy-identity & transfer (preregister invariants first).
- **C2.6** Continuous + distributed benchmark (tests the discrete architecture; pairs with F4.5).
- **C2.7** Comparative scientific-gain benchmark.

---

## Revised critical path
```
M1     Plan reframe (F0.3) · safe corpus cleanup (C1.2–C1.4) · identifier migration design (C1.1)
M1.5   Derivation taxonomy · participant admission (C1.7) · boundary validity (C1.8) ·
       authority encoding (C1.12) · causal claim classes (C1.9) · shared contract base (C1.10) ·
       version envelope · ablation methodology
M2     JS kernel (F1.0/F1.1) · system-relative opportunity (F1.2) · candidate interaction (F1.3) ·
       deletion/substitution/collapse/factorization ablations (F1.4) · finding report (F1.5)
M3     Projection property language + validator (F2) · admissibility + unresolved empirical obligations ·
       native kernel/projection conformance (F1.6/F2.4)
M4     Opportunity graph (F3.1) · transition evidence ledger (F3.2) · false-opportunity (F3.3) ·
       projection–opportunity study apparatus (C2.4-A/B)
M5     Typed comparison (F4.1) · cross-plane conformance (F4.3) · governed migration (F4.4) ·
       adversarial world suite (F4.5)
M6     Flagship world (F5) · public positioning (F5.3, after F4) · empirical pilots (C2 C/D)
```
**Gate discipline:** do not start M(n+1) until M(n)'s falsification criterion passes. If F1's ablation
shows a construct is *not* derivable from `K`, stop and revise the kernel — a successful result.

## Decision gates (revised per review)
- **G1 — F0.3 reframe:** *approve with revision* — kernel stays center; must distinguish runtime / contract-relative / empirical derivation, and state that seven-element `K` is one candidate factorization (vs `K₀`).
- **G2 — Stage 1 build:** *conditional approval* — begin F1 only after: authority encoding decided; participant + boundary rules provisionally ratified; F1.2 limited to `Ω_sys`; F1.3 parameterized candidate detection; F1.4 supports substitution + collapse ablations; version identity (F1.0) added; native ports deferred until JS survives Stage 1 + F2 review. (These = M1.5.)
- **G3 — C1 cleanup:** approve **C1.2/C1.3/C1.4** now; **C1.1** with alias/migration registry; **C1.5** dual-license (Apache-2.0 code / CC BY 4.0 corpus) pending commercialization review; **C1.7–C1.10 + C1.12** proceed as provisional semantic prerequisites (feed M1.5), not parallel editorial.
- **G4 — Branding reposition:** *defer* — public category changes only after the kernel survives ablation, ≥2 projections validate mechanically, `Ω_sys` derives without semantic cheating, the adversarial suite passes, and one non-field world runs without bespoke exceptions (i.e., after **F4**, not at F5 start). Internal language may broaden now.

## Revised program statement
The authoritative program statement lives in [`README.md`](README.md#the-description-this-program-earns)
("Fundamental derives authoritative computational facts from the world model; CompInt defines the
contracts and empirical methods by which those facts may support claims").

## Status ledger
- **Done:** F0.1, F0.2 (`b8e512ff`); earlier — FCI↔Fundamental alignment (`docs/fci-alignment`), CompInt remediation + audit standard (`CompInt/main`).
- **Ready on your word:** F0.3 (G1); C1.2/C1.3/C1.4 + C1.1-with-alias + C1.5 dual-license (G3).
- **Precondition for F1:** M1.5 (with provisional C1.7–C1.10, C1.12).
- **Needs explicit go:** F1 and after (G2, conditional).
- **Deferred by decision:** native ports (until post-Stage-1/F2 review); branding (until post-F4).
- **Cannot be done by me:** C1.14 and the C-execution (human-subjects) parts of C2; I build A/B/D (apparatus, synthetic dry runs, analysis scaffolding).
