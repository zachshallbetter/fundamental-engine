# M1.5-08 — Ablation methodology

**Status:** ratified (2026-07-19)

## Decision
Kernel minimization (R3) uses **four ablation forms**, each specifying the **tested capability** and an
**information budget**:

1. **Deletion** — remove the element entirely.
2. **Substitution** — represent its information using only the remaining kernel elements.
3. **Collapse** — merge two elements; test for lost explanatory/computational capability.
4. **Factorization** — split an element; test whether the distinction adds measurable value.

The governing question for substitution/collapse:

> Can the same capability be preserved using **only the remaining formal resources**, **without adding
> equivalent hidden structure** or **materially increasing complexity**?

**Substitution is invalid if it quietly restores the removed element under another name.** Deletion alone
proves implementation locality, not theoretical necessity.

Track, per ablation, not only **pass/fail** but also: **representational complexity · runtime cost ·
authoring burden · explanatory clarity · conformance stability.** An element may be *formally reducible*
yet still justified as a **runtime index** or **authoring construct** — that is a valid, recorded outcome,
not a failure.

## Alternatives considered
- Deletion-only ablation (the v1 plan's implicit method). Rejected: removing `Relations` "breaks"
  Interaction only because coupling is *stored* there; that shows locality, not necessity.
- Pure pass/fail scoring. Rejected: hides the index/authoring justification and the complexity trade that
  decides whether a reducible element still earns its place.

## Reason
Without substitution/collapse/factorization and a budget, F1.4 would prove the implementation depends on
a field, not that the theory requires the element — the core methodological risk the review identified.

## Operational consequences
- Each F1.4 test declares its tested capability + information budget before running.
- The finding report (F1.5) classifies each element (record 06's five roles) with its complexity deltas.
- A "fully reducible" verdict does not automatically remove the authoring surface (R5 freeze respect).

## Falsification conditions
- A substitution passes capability but is later shown to smuggle the element back (methodology failed to
  catch hidden structure — tighten the budget rule).
- Complexity metrics are not comparable across ablations (the budget definition is too loose).

## Open questions
- Concrete metrics for "representational complexity" and "materially increasing" — provisional:
  element/field count + description length + evaluation cost; calibrated during F1.4.

## Ratification
**Ratified 2026-07-19.** Original proposal: ratify the four ablation forms, the substitution-validity rule, and the tracked-metrics set.
