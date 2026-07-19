# Work plan — Computational-World Substrate

> **Status: planning (proposed WBS).** The itemized work breakdown for the program described in
> [`README.md`](README.md). Narrative, the kernel, and the canonical terminology (`world` vs `model` vs
> `environment` vs `field`) live in the README — this document is the itemized plan and does not
> restate them. Nothing in F1–F5 or C2 is built. Each item's acceptance criterion is a **falsification**
> test, not "it compiles."

**Version:** 1.1 (draft for review) · **Updated:** 2026-07-19 · **Owner:** Zach Shallbetter

## Governing rules (apply to every item)
- **R1 — Executable derivation.** "X is derived from Y" ships as runtime code + an ablation, or it is not counted as derived.
- **R2 — Compression gate.** Every proposed kernel/contract field must survive an ablation (remove it → measurable loss) before it freezes, else it is demoted to sugar or dropped.
- **R3 — Kernel minimization.** The kernel `K = ⟨E, X, R, O, T, P, V⟩` is a hypothesis; each stage attempts to shrink the tuple and records which elements are irreducible.
- **R4 — Plane parity.** Any core change lands on JS first, then Swift + Kotlin, held to the shared conformance golden.
- **R5 — Freeze respect.** New surface stays EXPERIMENTAL until a stage exit graduates it; the frozen surface (`api-stability.md`) is not touched without explicit sign-off.
- **R6 — No merges on your behalf.** Work lands on named branches; you merge.

**Item schema:** `ID · deliverable · acceptance (falsification) criterion · depends-on · size {S/M/L/XL} · risk {Low/Med/High} · plane · gate`

---

## Track F — Fundamental: Computational-World Substrate

### F0 — Stage 0: the plan  ·  DONE (branch `plan/world-substrate`, pushed)
- **F0.1** Program planning doc + WBS, linked from critical-path. — *done*
- **F0.2** Pin canonical `world` terminology (world / model / environment / field). — *done (README Terminology section, commit `b8e512ff`)*
- **F0.3** Make the kernel the explicit center of the README narrative (demote "World Contract" to *serialization of `K`* everywhere; state R1/R3 as first-class rules). — accept: README leads with `K`; WorldContract is described only as its type · S · Low · docs · **gate: your word**

### F1 — Stage 1: kernel + first derivations  *(code begins here)*
Goal: prove the compact core is real by deriving two constructs executably and breaking them by ablation.
- **F1.1** Typed kernel core `K` in `packages/core` hosting an existing `FieldPattern` unchanged. — accept: a current Field Pattern runs inside `K` with **byte-identical** field behavior (golden unchanged) · L · Med · JS · **gate: Stage-1 go (G2)**
- **F1.2** Derive **Opportunity** `Ω = f(state, operations, authority, reachability, projection, history)` as runtime code. — accept: `Ω` computes over a live world; output serializable · M · Med · JS · gate: F1.1
- **F1.3** Derive **Interaction** as reciprocal/recurrent coupled transitions. — accept: episode detection runs over a trace of coupled transitions · M · Med · JS · gate: F1.1
- **F1.4** Ablation harness. — accept (falsification): removing **P** (projection) from `K` provably breaks the *exposure* half of `Ω`; removing **R** (relations) breaks Interaction; shown by a paired failing/passing test · M · Med · JS · gate: F1.2, F1.3
- **F1.5** Stage-1 finding report: which construct derived cleanly, which resisted, and any kernel element shown reducible/irreducible (R3). — accept: written finding + updated plan · S · Low · docs · gate: F1.4
- **F1.6** Port kernel + derivations to Swift + Kotlin under the golden. — accept: same world contract passes on all three planes · L · Med · +Swift +Kotlin · gate: F1.4

### F2 — Stage 2: projections as executable contracts
- **F2.1** `ProjectionContract` type: preserve / transform / omit / introduce / expose / signal / accessibility. — accept: a projection is declarable and compilable · M · Med · JS · gate: F1
- **F2.2** Projection validator. — accept: the **reduced-motion** and **agent-readable** projections are checked against declared preservation claims; a violated claim fails · L · Med · JS · gate: F2.1
- **F2.3** Ablation: a projection claiming to preserve property `Q` that doesn't is caught. — accept: negative test passes · S · Low · JS · gate: F2.2
- **F2.4** Plane port. — accept: projection contracts validate on Swift + Kotlin · M · Med · +Swift +Kotlin · gate: F2.2

### F3 — Stage 3: opportunity + evidence runtime
- **F3.1** Opportunity Graph API: enumerate domain-valid / capable / permitted / enabled / reachable / exposed / signaled / reversible per state+projection. — accept: `world.opportunities(...)` returns the typed profile · L · Med · JS · gate: F1.2, F2.1
- **F3.2** World evidence ledger: per-transition provenance (prior state → trigger → authority → preconditions → transition → projection → result → invariants). — accept: a real decision reconstructs end-to-end from the ledger · L · Med · JS · gate: F1.1
- **F3.3** False-opportunity detection. — accept: an agent claiming an operation it lacks is identified with the missing predicate named · M · Med · JS · gate: F3.1
- **F3.4** Plane port. — accept: opportunity + ledger on all planes · L · Med · +Swift +Kotlin · gate: F3.1, F3.2

### F4 — Stage 4: typed conformance
- **F4.1** `compare(a, b, {dimensions, transforms, tolerances})` → **typed profile** (identity/relations/operations/opportunity/projection/trace), never a scalar. — accept: profile output; a critical failure cannot be numerically hidden · L · Med · JS · gate: F3
- **F4.2** Expand the conformance golden to world / operation / projection / opportunity conformance. — accept: golden covers the new dimensions · L · Med · JS · gate: F4.1
- **F4.3** Cross-plane world conformance. — accept: Swift, Kotlin, web pass the **same** world contract against declared invariance claims · XL · High · +Swift +Kotlin · gate: F4.2
- **F4.4** Governed evolution: world schema versioning + migration. — accept: a v3 snapshot stays interpretable at v7 · L · Med · JS · gate: F1.1

### F5 — Stage 5: flagship world
- **F5.1** One declared world, ≥4 projections (visual · native · conversational · headless/API). — accept: shared identities/relations/operations/history across all · XL · High · all · gate: F4
- **F5.2** Live demonstration set: cross-projection state change; per-projection operation-set differences; live false-opportunity catch; reduced-motion semantic preservation; snapshot+replay of a decision; typed comparison of two projections; one headless run with no renderer. — accept: all seven demonstrated live · L · Med · all · gate: F5.1
- **F5.3** Reposition public copy from "physics for interfaces" to "computational-world substrate." — accept: hero/docs updated; honest maturity framing kept · M · Med · site · **gate: branding sign-off (G4)**

---

## Track C — CompInt: corpus + V2 (parallel, low coupling to Track F)

### C1 — Priority defects to fix immediately (from the determination)
Safe / mechanical (executable on a branch now):
- **C1.1** Unique per-type contract IDs (`COMPINT-CONTRACT-PROJECTION-001`, …) replacing the shared `-001`. — accept: each contract type has a stable distinct ID · S · Low
- **C1.2** Correct "Behavioral Opportunities" mislabeled as a "measurement unit" (opportunity = typed action-availability profile). — accept: term fixed everywhere · S · Low
- **C1.3** Clarify "Interaction Ecology" status (canonical / candidate / historical); mark outdated priority-language in root README. — accept: status labels applied · S · Low
- **C1.4** Distribution hygiene: exclude `.DS_Store`, `__MACOSX`, compiled objects/binaries from public source; confirm `.gitignore`. — accept: junk untracked/ignored · S · Low
- **C1.5** Add `LICENSE`, `CITATION.cff`, authorship/contribution files. — accept: files present · S · Low · **gate: license choice (G3)**

Decision-needed (need a call before touching):
- **C1.6** Ratify canonical concept IDs (concepts/definitions/figures/claims/papers/superseded terms). — L · Med · **gate: ratification pass**
- **C1.7** Participant-admission rule in the canonical ontology. — M · Med · **gate: canonical authoring**
- **C1.8** Boundary-validity status on the Interaction Contract. — M · Med · **gate: canonical authoring**
- **C1.9** Canonical causal claim classes (descriptive / predictive / mechanistic / intervention / reciprocal). — M · Med · **gate: canonical authoring**
- **C1.10** Consolidate shared contract fields (inherited base) to cut duplication. — M · Med · **gate: schema refactor**
- **C1.11** Separate historical release archives from the primary distribution. — M · Low · **gate: conflicts with the "lossless" design — your call**
- **C1.12** Authority rules scoped by claim-type, not one global linear order. — M · Med · **gate: governance decision**
- **C1.13** Bibliography authority verification (claim-level source verification). — XL · Med · **gate: large research task**

Out of scope for an agent (empirical / human-subjects):
- **C1.14** Pilot ≥1 full contract chain in an actual study before freezing schema 1.0.

### C2 — V2 empirical sequence (each item is also a Track-F derivation test)
- **C2.1** Canonical + schema cleanup (C1.1–C1.12).
- **C2.2** Annotation & segmentation study — inter-rater agreement on episodes / participants / actions / opportunity / strategy.
- **C2.3** Contract-ablation study — full vs reduced contracts: coding time, agreement, predictive gain (feeds R2).
- **C2.4** Projection–opportunity experiment — hold semantics constant, vary exposure/signaling; test `Ω` predicts discovery / execution / recovery (validates F3.1).
- **C2.5** Strategy-identity & transfer — preregister invariants before the target task; test strategy predicts transfer beyond trace similarity.
- **C2.6** Continuous + distributed benchmark — one embodied continuous task + one institutional workflow; test the discrete architecture.
- **C2.7** Comparative scientific-gain benchmark — HCI baseline · process-mining · cognitive model · reduced CompInt · full CompInt; held-out + intervention prediction, cost, interpretability.

---

## Sequencing & milestones
```
M1  F0.3 + C1 safe cleanup (C1.1–C1.5)            small, immediate, parallel
M2  F1 kernel + 2 derivations + ablation (JS)      the thesis test — go/no-go on the whole program
M3  F1.6 plane parity  +  F2 projection contracts
M4  F3 opportunity + evidence runtime  (+ C2.4 experiment)
M5  F4 typed conformance across planes
M6  F5 flagship world + repositioning
```
**Gate discipline:** do not start M(n+1) until M(n)'s falsification criterion passes. If F1's ablation
shows a construct is *not* derivable from `K`, stop and revise the kernel before proceeding — that is a
successful result, not a blocker.

## Decision gates requiring sign-off
1. **G1** — Advance the README kernel-reframe (F0.3). *(low-risk; yes/no)*
2. **G2** — Green-light Stage 1 build (F1): new typed core, all planes, incremental + verified, no merge. *(the real commitment)*
3. **G3** — Run CompInt safe cleanup now (C1.1–C1.5) + license choice for C1.5. *(parallel, low-risk)*
4. **G4** — Branding reposition (F5.3) and any move of experimental surface into the frozen set (per stage exits).

## Status ledger
- **Done:** F0.1, F0.2 (terminology pinned, `b8e512ff`); earlier — FCI↔Fundamental alignment (`docs/fci-alignment`), CompInt remediation + audit standard (`CompInt/main`).
- **Ready on your word:** F0.3, C1.1–C1.5.
- **Needs explicit go:** F1 and everything after (G2).
- **Needs a decision from you:** C1.5 license, C1.6–C1.13, F5.3 branding.
- **Cannot be done by me:** C1.14 and all C2 studies (human-subjects / empirical) — I build the apparatus and analysis scaffolding; you/collaborators run the studies.
