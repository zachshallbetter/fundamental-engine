# G3 + F2 foundation — phase findings

**Status:** complete (2026-07-19). Code on `feat/world-kernel` (`6b03c933`, `3f491bcd`, `9365554b`).
**Scope:** second-substrate generalization (G3) and the ProjectionContract / property-classification
foundations (F2). **Not** Stage-2 implementation — no projection runtime, model checker, empirical
validation system, or public API.

---

## Why this phase existed

After Stage 1, `DynamicsContract` had been validated against exactly one substrate: the field runtime it
was extracted from. A contract with one implementation is indistinguishable from a description of that
implementation. The only way to tell whether it generalizes is to adapt something that is unlike the
field on every axis the contract measures, and see what breaks.

---

## G3.1 — substrate selection (and the constraint that shaped it)

The chosen substrate is the **quality-governor rule set**: discrete threshold transitions with
asymmetric hysteresis (escalate fast, recover slow), history-dependent streak state, a transition law
that is a declared table, fully surfaced state, and exact determinism with no clock and no RNG. It is
the field's opposite in nearly every respect, which is what makes it useful.

**Limitation, stated plainly.** The adapted module is a faithful **core-local port** of the *shipped*
`QualityGovernor` in `@fundamental-engine/dom`, not the shipped class itself. Three verified constraints
forced this: `core` must never import `dom` (strict dependency direction), core's package `exports` map
is closed, and `check:api` scans dom's exports. The adapter had to live in `core`, and no suitable
core-local substrate existed — `semantic/states.ts` is data plus a type guard, and the conformance
runner is field-coupled.

So the second substrate is *behaviourally* independent of the field but not *organizationally*
independent of this repository. It is a genuine second implementation of the contract; it is not
evidence that an unrelated third-party system would adapt as cleanly. A truly external substrate remains
the stronger test, and is not claimed here.

## G3.2 — equivalence

Same discipline as F1.4: the raw substrate is the authority, the adapted path routes an identical
fixture through `DynamicsContract` + `hostWorld`, and equivalence is compared at **every transition**.
All values are discrete, so comparison is exact — no tolerance is needed, unlike the field.

The *controls* differ from F1.4, and that difference is itself evidence. This substrate has no clock, no
randomness, no queue, no environment, no retry policy, no external I/O and no host geometry, so those
controls are recorded as **not-applicable** rather than silently claimed as satisfied.

Negative fixtures cover altered operation order, changed input, skipped transition, changed failure
result, reordered tier-change event, and a case where final-state-only comparison **false-passes** while
per-transition comparison catches it.

---

## G3.3 — the cross-substrate finding

**Outcome: generalized-with-refinement.**

Eighteen dimensions compared, with every row read off the *live* contracts rather than stored prose
(`world/cross-substrate.ts`).

| Dimension | Field | Governor | Classification |
|---|---|---|---|
| state model | opaque handle, closure-scattered | plain data record | substrate-specific-value |
| input model | `{ steps? }` | `{ durationMs }` | substrate-specific-value |
| output model | `{ steps }` | `{ tier, changed }` | substrate-specific-value |
| executionKind | `opaque-native` | `interpreted` | supported-by-both |
| determinism | conditionally-deterministic (2 uncontrolled) | deterministic (0 uncontrolled) | supported-by-both |
| capabilities | snapshot only | snapshot + restore + replay + inspect + law | supported-by-both |
| evidence shape | five channels | same five channels | supported-by-both |
| failure semantics | typed codes, none exercised in-run | `invalid-state`, restore rejection | supported-by-both |
| snapshot fidelity | `partial-observable` | `complete-restorable` | supported-by-both |
| replay | false | true | supported-by-both |
| restore | false (method absent) | true (method present) | supported-by-both |
| lifecycle | init → advance* → snapshot | init → advance* → snapshot → restore | supported-by-both |
| ordering | frame ordering, 6-frame cadence | strict input-sequence ordering | supported-by-both |
| environment dependence | host geometry, viewport, scroll | none | substrate-specific-value |
| opaque vs declarative region | wholly opaque | wholly declared | supported-by-both |
| host dependence | requires a `FieldHost` | none | substrate-specific-value |
| execution context `now` | unused | unused | **unnecessary-generalization** |
| transition-law access | capability false | capability true, **no accessor existed** | **missing-general-concept** |

**No dimension was field-biased or second-substrate-biased.** The second substrate adopted the contract
unchanged in executionKind, determinism, capabilities, evidence shape, failure taxonomy, snapshot
fidelity, replay, restore, lifecycle and ordering. The four substrate-specific values were carried by
the generic type parameters without the contract needing to know anything about them. A field-fitted
result would have been a permanent stop; it did not occur.

### The one refinement the evidence justified

`capabilities.declareTransitionLaw` could be set truthfully while the contract offered **no way to
obtain the law**. The field never exposed this because it declares the capability false — the gap was
invisible until a substrate existed that could honestly declare it true.

This is a missing general concept, not a substrate convenience: a capability flag that cannot be
exercised is an incoherence in the contract itself. `DynamicsContract` gains an optional
`describeTransitionLaw()` returning the law as data, plus two consistency rules — the capability and the
accessor must agree in both directions — while `opaque-native` remains barred from declaring a law at
all.

The rule immediately caught a **pre-existing** F1.3 fixture (the counter contract) that claimed the
capability without being able to produce a law. That is the refinement paying for itself on the first
run. The field adapter is unaffected and still validates clean, pinned by a migration test.

### The over-generalization we kept

`DynamicsExecutionContext.now` was read by **neither** substrate in any fixture — the field injects its
own clock and the governor has none. It is recorded as an unnecessary generalization and **kept**, not
silently deleted: two substrates are not enough evidence to remove a concept, and removing it would
erase the finding. It is a candidate for removal if a third substrate also declines to use it.

---

## F2 foundation — ProjectionContract

Projection is modelled as a presentation of a world, kept deliberately distinct from six neighbours it
is routinely collapsed into: observation, snapshot, evidence, capability, authority, and operation
availability. Separate concepts carry the distinctions (`ProjectionDefinition`, `ProjectionSurface`,
`ObservationAccess`, `OperationExposure`, `EvidenceAccess`, `AuthorityPresentation`, `ProjectionResult`).

**The load-bearing rule: a projection is subtractive with respect to power.** It may hide, withhold,
redact and understate. It may never manufacture a capability or silently grant permission. Where a
definition claims more than the source holds, the surface still reflects the *source* and the excess is
reported as an anomaly — the report is what makes the overstatement non-silent.

Three consequences worth stating:

- **`exposed` / `hidden` / `unavailable` are three different states.** Hidden means "exists in the
  world, not offered here"; unavailable means "not in the world's vocabulary at all". Collapsing them
  would let a projection misrepresent the world it projects.
- **Observation access is independent of operation exposure, in both directions.** Readable state with
  no offered operation, and an offered operation over unreadable state, are both expressible.
- **A projection changes `Ω_sys` without changing world state.** Demonstrated by driving the F1.6
  evaluator from two surfaces over one identical snapshot: `signaled` differs, `available` does not.
  That is the intended behaviour, not a defect — `exposed` and `signaled` are projection-relative
  predicates by construction.

Projection-relative invariants are evaluated against the surface only. A claim reading hidden state
returns `unevaluable-outside-surface` — it is never satisfied *or refuted* by reaching into the world.
Signaling raises an **unresolved empirical obligation** rather than asserting that anyone perceived
anything.

Nine required fixtures, each written so it fails if the distinction it guards were collapsed.

---

## F2 foundation — property classification

The Stage-2 three-class vocabulary: `mechanically-decidable`, `model-checkable`, `empirically-testable`,
each with a distinct evaluation authority (runtime / model-checker / external-empirical). Every result
carries class, authority, required evidence, status, reason and provenance. Statuses are `satisfied`,
`violated`, `unresolved`, `not-applicable`, `insufficient-evidence`.

Two limits are enforced **in code**, not described in prose:

1. **An empirical claim can never be marked satisfied internally.** The validator may return only
   `unresolved`, `insufficient-evidence`, or a deferral carrying an external study reference. An
   explicit mechanical verdict of `true` is *not honoured* for an empirical claim, and a belief-laden
   statement classed as mechanical is refused as `not-applicable` rather than evaluated. The forbidden
   vocabulary (believe, perceive, understand, expect, experience, usability, trust, …) is checked
   against the statement itself, so a misclassification cannot slip through by relabelling.
2. **One observed execution is not a model check.** A single run yields `insufficient-evidence`; so do
   500 runs, because sampling is not checking. A bounded model check holds only within its stated bound
   and returns `unresolved` beyond it. Only exhaustive exploration earns `satisfied`.

Five negative fixtures cover each required case, including the two projection-relative ones: a claim
cannot reach past the surface into hidden state, and evidence the surface withholds cannot discharge a
claim.

---

## Limitations

- The second substrate is behaviourally but not organizationally independent (see G3.1). A third-party
  substrate remains the stronger generalization test.
- Two substrates justify *keeping* `context.now` under scrutiny, not removing it.
- `ProjectionContract` is a foundation: definitions are applied to a source and checked, but nothing
  *executes* through a projection yet. No projection runtime, no model checker, no empirical validation
  system.
- Property classification validates and classifies declarations. It does not discharge model-checkable
  properties — it can only recognize whether evidence sufficient to discharge them has been supplied.
- Participant belief, perception and interpretation remain out of scope (M1.5-01) and are represented
  only as unresolved obligations.

## Stop conditions — none triggered

No suitable-substrate failure; contract not field-fitted; no frozen or public API change; `World` holds
no substrate instance; no generic callback or untyped escape hatch was needed; `ProjectionContract` does
not require participant belief; projection remained distinct from observation and authority; no F1.4
regression; no ratified M1.5 result contradicted; no conflicting canonical definitions introduced.

## Gates

`typecheck` clean · `check:api` **20 frozen entries intact** · `check:docs` 100% · core suite
**1039/1039**. All new surfaces internal and experimental; field goldens unchanged.
