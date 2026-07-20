# Substrate conformance corpus — pre-registration

**Status:** pre-registration, written **before** any corpus substrate was implemented or adapted.
Committed ahead of the results deliberately: predictions recorded after the fact are not predictions.

**Purpose.** `DynamicsContract` has been exercised by two substrates. Two is enough to show it is not a
description of one implementation; it is not enough to show it is an execution abstraction. The next
leap is not another contract feature — it is a growing collection of independently adapted substrates,
and a measured answer to one question:

> **How little does the contract change as the corpus grows?**

---

## The threat this protocol exists to counter

Every corpus substrate will be authored in this repository, by the same author who knows the contract.
That is the G3 limitation multiplied. A corpus assembled carelessly would show near-zero churn and mean
nothing, because the substrates would be shaped — consciously or not — to fit the contract they are
about to be measured against.

Three safeguards, binding for every corpus entry:

1. **Substrate-first, adapt-second.** Each substrate is implemented from its own domain semantics, with
   the API its own domain would naturally give it, and **committed** before its adapter is written. The
   commit boundary is the evidence. A substrate may not be edited to make its adapter cleaner; if the
   adapter is awkward, the awkwardness is the finding.
2. **Pre-registered predictions.** Before adapting, the expected outcome and the expected contract change
   (if any) are written down here. A gap that was predicted and then observed is strong evidence; a gap
   discovered and then explained is weak.
3. **Change classification is adversarial.** Every contract change must be argued as a *missing general
   concept*. "It would be more convenient" is a rejection, not a justification.

---

## Churn metric

Contract churn per substrate, counted against `DynamicsContract` and its validator:

| Class | Counted as |
|---|---|
| new **required** member | 3 — the heaviest; breaks every existing substrate |
| new **optional** member | 1 |
| new union variant (executionKind, failure code, fidelity) | 1 |
| new consistency rule | 1 |
| **changed semantics** of an existing member | 3 |
| new type used only in an optional member's signature | 0 — carried by the member it serves |

**Convergence claim.** The contract may be called an execution abstraction, rather than a
field-plus-one abstraction, when a newly adapted substrate requires **churn = 0** *and* was predicted to
require zero. Convergence is claimed on the last substrate adapted, never on the average.

**Divergence stop.** If any substrate requires a change that is a substrate convenience rather than a
missing general concept, and the change cannot be avoided, the contract is over-fitted. Stage-2
expansion stops and the contract is revised.

**Budget.** Expected ≤ 1 optional member per substrate for the next three. Two consecutive substrates
each requiring a new *required* member falsifies the current factorization.

---

## The corpus

| Substrate | Role | Status |
|---|---|---|
| FieldRuntime | continuous, opaque, non-terminating | **adapted** — generalized-with-refinement (G3.3) |
| QualityGovernor | discrete thresholds, declared law, non-terminating | **adapted** — generalized-with-refinement (G3.3) |
| Finite state machine | **control** | pending — this phase |
| Search / planner | **falsification candidate** | pending — this phase |
| Event-sourced aggregate | replay semantics probe | pending |
| Workflow engine | external/async effects | pending |
| Rule engine | declarative law, conflict resolution | pending |
| Game turn system | multi-participant turn order | pending |

Order is deliberate: the **control runs first** and the **highest-risk substrate runs second**, so a
falsification arrives early and cheaply rather than after four confirmations have built false confidence.

---

## Pre-registered predictions

### P1 — Finite state machine (control): churn = 0

An FSM is the most contract-shaped thing in computing: explicit states, declared transition table,
complete observable state, exact determinism, trivial snapshot/restore. It should adapt with **no**
contract change whatsoever.

**This prediction is a test of the contract, not of the FSM.** If an FSM requires a contract change,
the contract is malformed and the finding is about `DynamicsContract`, not about state machines.

### P2 — Search / planner: predicted churn = 1 (a missing **termination** concept)

A planner is the first corpus substrate that **finishes**. The field simulates indefinitely; the
governor consumes frames indefinitely. Neither ever reaches a state where `advance` is meaningless.

A planner does: it exhausts its frontier, or it finds a goal. At that point the contract has no vocabulary
for what happened. The available responses are all wrong:

- returning `ok` with an unchanged state falsely implies progress;
- returning a failure implies something went wrong, when termination is success;
- looping forever misrepresents a finished search as a running one.

**Predicted change:** an optional terminal-state signal on the transition result, classified
*missing general concept* — "has this substrate reached a state from which no further transition is
defined" is a property of lawful evolution in general, not of search in particular.

**Predicted secondary finding:** a planner's transition law is *partially* declarable — the expansion
rule is a table, the heuristic is opaque — which should force `executionKind: 'hybrid'`, a variant
declared in F1.3 but so far **never exercised by any substrate**. If `hybrid` turns out to be
unusable in practice, that is evidence the union was speculative.

### P3 — Event-sourced aggregate (later phase): predicted churn = 0, with a semantic probe

Predicted to expose that "replay" is two different things: **log replay** (re-folding recorded events)
and **deterministic re-execution** (running the same inputs and getting the same result). The contract
already separates `replay` from `deterministicReplay`, so the prediction is **churn = 0** and the
existing flags prove sufficient. If they do not, the distinction was cosmetic and the finding is real.

---

## What would make this corpus stronger than I can currently make it

Every entry here is authored in-repo. The corpus reduces the risk of a field-fitted contract; it does
not eliminate author bias. The genuinely strong test — an existing third-party runtime, adapted by
someone who did not design the contract — remains outstanding and is not claimed by any result below.
