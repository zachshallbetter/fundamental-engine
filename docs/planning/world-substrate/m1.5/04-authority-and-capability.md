# M1.5-04 — Authority and capability

**Status:** proposed (awaiting ratification)

## Decision
Authority and capability are **typed constraints evaluated over a context**, not entities and not
free-standing substances. Neither is a kernel primitive.

```
Capable(participant, operation, object, state, environment, substrate)   → can execution occur?
Permitted(participant, operation, object, scope, state, time, authoritySource) → may it occur under governance?
```

**Capability** answers whether execution *can* occur (effective capacity/resources under the current
substrate). **Authority** answers whether it *may* occur under the declared governance model. Both are
predicates the transition system evaluates; they contribute to `Ω_sys` (record on F1.2) but add no eighth
primitive to `K`.

## Alternatives considered
- Authority as a kernel primitive (an 8th element). Rejected: it is derivable as a typed constraint over
  participants/operations/objects/scope/state/time; adding it violates R3 minimization.
- Authority as plain state or a relation. Rejected as the *default*: expressible either way, but modeling
  it as a constraint keeps evaluation uniform and auditable; whether it reduces to state/relation is a
  kernel-role question (record 06).

## Reason
Keeping authority/capability as evaluated predicates preserves their importance (they gate opportunity and
appear in the evidence ledger) without inflating the kernel, and cleanly separates *can* from *may* —
which the opportunity profile must not conflate.

## Operational consequences
- `Ω_sys` (F1.2) consumes both predicates; `Permitted` populates the ledger's `authority` field (F3.2).
- `authoritySource` is required, so every permission is traceable to a governance origin.
- Feeds C1.12 (authority rules scoped by claim-type).

## Falsification conditions
- A real governance rule cannot be expressed as `Permitted(...)` over the declared context tuple
  (the signature is insufficient).
- Capability and authority cannot be evaluated independently for a case where one holds and the other
  does not (the split is not real).

## Open questions
- Whether `Cap`/`Auth` reduce to `State`/`Dynamics` predicates (feeds the kernel-role ablation, record
  06/08). Provisional: modeled as constraints; reducibility tested in F1.4.
- Delegated/derived authority chains — representation deferred, but `authoritySource` leaves room.

## Ratification
Proposed. Ratify the two predicate signatures and the can/may split.
