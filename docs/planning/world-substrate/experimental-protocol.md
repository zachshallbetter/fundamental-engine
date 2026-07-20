# The experimental protocol

**Status:** active method, extracted from practice (2026-07-19). Implemented as testable data in
`packages/core/src/world/conformance/{corpus,discoveries,predictions}.ts` — the assertions in
`methodology.test.ts` are about the *method*, not about `DynamicsContract`.

This document describes how this program is allowed to change its own theory. The abstractions —
`DynamicsContract`, `Ω_sys`, `ProjectionContract` — are domain-specific results. The protocol that
produced them is the more general contribution, and it is what this file records.

---

## The shift

Before the corpus, the operative question was:

> Does this substrate fit the contract?

It is now:

> Can we predict where the contract will fail before adaptation, and are those predictions borne out?

The second question is answerable in advance and can embarrass you. That is what makes it useful.

## The sequence

```
choose substrate
      ↓
describe substrate on its own domain terms
      ↓
freeze implementation
      ↓
COMMIT                     ← the substrate cannot now be reshaped to fit
      ↓
pre-register predictions
      ↓
COMMIT                     ← the predictions cannot now be revised into hindsight
      ↓
adapt to the contract
      ↓
measure churn
      ↓
classify each refinement: structural / representational / convenience
      ↓
accept structural, allow representational, REJECT convenience
      ↓
grade predictions
      ↓
update corpus, discovery registry, prediction registry
```

**There is no step called "design a better contract."** The contract changes only when a substrate
cannot be expressed without the change. This is the single most important property of the method and
every other rule exists to protect it.

The two commit boundaries are the enforcement mechanism. Neither is a matter of good intentions:
substrate-before-adapter and prediction-before-result are both checkable in the git history by someone
who does not trust the author.

## Refinement taxonomy

| Kind | Meaning | Disposition |
|---|---|---|
| **structural** | the contract lacked a concept | accepted, and becomes a numbered **discovery** |
| **representational** | the concept existed; this expresses it better | allowed, but it is not a discovery |
| **convenience** | makes adaptation easier, adds no explanatory power | **never accepted** |

The earlier binary (missing-concept vs convenience) had nowhere to put a representational change, so
one would have had to be misfiled as its neighbour. That ambiguity is how a contract drifts while
appearing disciplined.

**Current:** 3 structural · 0 representational · 0 conveniences accepted · 1 convenience rejected *and
written down*. That last number is a **floor, not a total** — rejections made while writing an adapter
and never recorded do not count, and several early ones were not recorded.

## Discoveries

A discovery is a concept the contract was missing, found because a substrate could not be expressed
without it. Discoveries carry permanent identifiers because they are the empirical record of how the
theory changed, and an identifier survives renaming and rewriting in a way a changelog entry does not.

Each entry must state:

- the **substrate that forced it**;
- why the **prior contract was wrong** — incoherent or incomplete, not merely improvable;
- **why no existing substrate could have revealed it** (this is what makes it a discovery rather than a
  belated observation);
- what was **deliberately not generalized** at the same time.

| Id | Concept | Discovered by | Why it was invisible before |
|---|---|---|---|
| **D-001** | transition-law retrieval | QualityGovernor | the only prior substrate is `opaque-native` and declares the capability false, so the unusable branch was never taken |
| **D-002** | termination | FiniteStateMachine | neither prior substrate ever finishes, so termination was not absent from the contract — it was unobservable |

Note what the table shows: **`FieldRuntime` has discovered nothing.** The substrate the contract was
extracted from cannot surprise it. That is the expected result, and it is asserted in tests.

## Prediction accuracy

Contract stability and predictive power measure different things. A stable contract with poor predictive
power is still weak — it may be stable because it is right, or because nothing hard has been tried. A
contract that repeatedly predicts where it will fail, and is surprised only in specific and explainable
ways, is becoming scientifically mature.

**Current record:** 8 registered · 3 graded · 1 confirmed · 1 partially confirmed · 1 falsified.
Accuracy **1/3**. Surprise rate **1/3**.

Two anti-gaming rules, enforced in code:

1. **`partially-confirmed` requires ≥2 independent components declared in advance**, each graded
   separately, and is rejected if all held (that is *confirmed*) or none did (that is *falsified*).
   Without this rule it becomes the grade that lets a wrong prediction feel half-right.
2. **Partial credit is not counted toward accuracy.** A partial is not most of a hit.

Falsified predictions keep their lesson and are never rewritten. The surprise rate is reported rather
than minimized: a program with no falsifications is not being tested hard enough.

**What this metric is not.** The same author writes the predictions, grades them, and implements the
contract. The accuracy figure is a discipline, not independent evidence. Its only real guarantee is
commit order, which is why every graded prediction names the commit that registered it.

## Evidence grading

Applied first to projection, where the risk was sharpest — the concept currently carries more
explanatory weight than any other Stage-2 idea.

| Grade | Meaning |
|---|---|
| **experimentally-grounded** | supported by a result from an **independently built** component, or an ablation that changed an outcome |
| **fixture-supported** | a test I wrote passes against an API I designed — a consistency check that **cannot falsify its own design** |
| **architectural-hypothesis** | asserted by the design, untested; currently indistinguishable from a good guess |

**Projection today:** 2 grounded · 2 fixture-supported · 4 hypotheses. Grounded fraction **0.25**.

The two grounded claims (projection ≠ observation; a projection moves `Ω_sys` without moving world
state) rest on the F1.6 `Ω_sys` evaluator, which was built *before* `ProjectionContract` existed and
could therefore have failed to show a difference. The rest is architecture.

Every ungrounded claim must name the experiment that would ground it, and every hypothesis must
reference a registered prediction. Both are asserted in tests, so a claim cannot sit ungrounded and
unexamined.

## Why this generalizes

Nothing in the sequence above is specific to fields, substrates, or interaction. The method is:
constrain when a theory may change, require pre-registered predictions, preserve falsifications,
measure adaptation cost, distinguish discoveries from conveniences, and grade the evidence behind each
claim rather than the confidence with which it is stated.

That is applicable to any program that builds an abstraction by adapting real systems to it. Whether it
is *worth* generalizing is not something this program can establish about itself.
