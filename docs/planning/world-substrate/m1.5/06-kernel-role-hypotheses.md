# M1.5-06 — Kernel role hypotheses

**Status:** ratified (2026-07-19)

## Decision
Record, for every candidate kernel element, its **hypothesized role** *before* F1.4 runs, so the ablation
report measures change against a stated baseline. Each element is hypothesized as one of: **formal
primitive · runtime index · authoring construct · explanatory construct · potentially reducible
encoding.**

Working hypothesis `K = ⟨Entities, State, Relations, Operations, Dynamics, Projection, Invariants⟩`;
competing smaller `K₀ = ⟨X, Θ, Π, V⟩`.

| Element | Hypothesized role (baseline) | Reducibility conjecture |
|---|---|---|
| State (`X`) | formal primitive | irreducible |
| Dynamics (`Θ`: evolution + operations) | formal primitive | irreducible |
| Entities | runtime index over `State` | likely reducible to indexed `X` |
| Relations | runtime index / structured state | likely reducible to typed `X` or `Dynamics` |
| Operations | authoring construct over `Dynamics` | reducible to labeled members of `Θ` |
| Projection (`Π`) | formal primitive (observation function) | possibly the *first derived layer*, not kernel — open |
| Invariants (`V`) | formal primitive (predicate family) | possibly guards/postconditions over `Dynamics` — open |
| Authority / Capability | typed constraints (record 04) | not primitives; predicates over context |

## Alternatives considered
- Assert seven independent primitives. Rejected: several are plausibly encodings of others; asserting
  independence pre-judges the F1.4 experiment.
- Adopt `K₀` now. Rejected: adopting the smaller kernel before ablation would be the same error in the
  other direction. `K₀` is the competing hypothesis, not the settled answer.

## Reason
R3 minimization is only meaningful against a declared baseline. This record *is* that baseline; F1.5
reports movements from it.

## Operational consequences
- F1.4 tests each element by deletion / substitution / collapse / factorization (record 08) and updates
  its row.
- The runtime may still expose all seven authoring concepts even where an element proves reducible
  (justified as index/authoring — see record 08).

## Falsification conditions
- An element hypothesized irreducible is fully substituted with no capability/complexity cost (baseline
  wrong — a *good* finding).
- An element hypothesized reducible cannot be encoded elsewhere without hidden structure (also a finding).

## Open questions
- The two genuine unknowns flagged above: is `Projection` kernel or first-derived? Is `Invariants` a
  distinct category or guards over `Dynamics`? These are the highest-value F1.4 questions.

## Ratification
**Ratified 2026-07-19.** Original proposal: ratify the baseline role table as the pre-registration for F1.4.

---

## F1.8 outcome — evidence recorded (2026-07-19)

The baseline table above is **preserved as the pre-registration**. This section records what the F1.3–F1.8
evidence actually showed. Where the outcome differs from the hypothesis, that is a finding, not a
correction of the record. Full synthesis: [`../F1.9-stage1-findings.md`](../F1.9-stage1-findings.md).

| Element | Hypothesized role (pre-registered) | Ablation result | Recorded role after evidence |
|---|---|---|---|
| State (`X`) | formal primitive · irreducible | `necessary-primitive` | **confirmed** — every derivation reads it; nothing reconstructs it |
| Dynamics (`Θ`) | formal primitive · irreducible | `non-substitutable` | **confirmed as a necessary component of Θ**, with a *declarative region + opaque execution region* (F1.5). Not shown to be a primitive independent of Θ |
| Entities | runtime index over `State` · likely reducible | `representation-dependent` | **partly confirmed** — identity is necessary for attribution; hosting as a typed structure in `X` is a representation choice |
| Relations | runtime index / structured state · likely reducible | `collapsible-with-loss` | **hypothesis rejected** — observed edges reconstruct, but latent/persistent relations and relation *type* do not. Retained (as typed structure in `X`) |
| Operations | authoring construct over `Dynamics` · reducible | `non-substitutable` | **hypothesis rejected** — latent, never-invoked operations are unrecoverable from transitions. Retained |
| Projection (`Π`) | formal primitive · *open: possibly first-derived* | `non-substitutable` | **OPEN QUESTION RESOLVED — Projection is NOT merely a derived observation layer.** Identical state under two projections yields different `Ω_sys` availability, so it materially changes derivations. Retained in `K₀` |
| Invariants (`V`) | formal primitive · *open: possibly guards over Dynamics* | `necessary-component` | **OPEN QUESTION RESOLVED (for opaque substrates) — invariants cannot be guards inside Dynamics.** The field substrate declares `inspectInternalState=false` / `declareTransitionLaw=false`; there is no guard-installation point, so invariants must be checked kernel-side. *Unresolved for fully declarative substrates* |
| Authority / Capability | typed constraints; not primitives | `collapsible-with-loss` | **confirmed** — independent predicates (removing one leaves the other intact); collapsing them loses the diagnosis. Not kernel elements |
| DynamicsContract | *(introduced after this record, F1.3)* | `execution-boundary-only` | **runtime interface, not a kernel primitive** — one kernel drives an `opaque-native` and an `interpreted` substrate unchanged. Deliberately **not** added as an eighth element |

### Consequences for the two pre-registered unknowns

Both highest-value questions in *Open questions* above are now answered **for the tested domain**:

1. *Is `Projection` kernel or first-derived?* → **kernel** (`Π` retained): it changes derivation results,
   so it does not collapse into observation.
2. *Is `Invariants` a distinct category or guards over `Dynamics`?* → **distinct** (`V` retained) for
   opaque substrates; guard-reduction remains **unresolved** for fully declarative substrates.

### K versus K₀

`K₀ = ⟨X, Θ, Π, V⟩` is **supported by the ablation as a representational reduction**: Entities,
Relations, and Operations fold into `X` as typed structures. They are *not derived away* — every
distinction they carry survived ablation and must still be represented.
