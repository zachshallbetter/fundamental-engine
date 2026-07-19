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
