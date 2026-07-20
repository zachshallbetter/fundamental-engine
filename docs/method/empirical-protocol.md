# An empirical protocol for evolving computational theories

**Status:** active method, extracted from practice (2026-07-19). Domain-neutral by intent — this
document describes the protocol itself. The program that produced it is one instance, not the subject.

Most abstractions are built by design and revised by taste. Someone proposes a contract, implementations
are written against it, and when an implementation is awkward the contract is adjusted until it isn't.
That process has no way to distinguish a contract that is *right* from one that has been reshaped until
nothing can contradict it.

This protocol is a way to build an abstraction by adapting real systems to it while constraining
**when the abstraction is allowed to change**. It is applicable to any program with the same shape: a
theory, a growing set of independent implementations, and a temptation to smooth over the friction
between them.

---

## The governing question

Weak form:

> Does this implementation fit the abstraction?

Strong form:

> Can we predict where the abstraction will fail before adapting, and are those predictions borne out?

The second question is answerable in advance and can embarrass its author. That is the entire reason to
prefer it.

## The sequence

```
choose an implementation to adapt
        ↓
describe it on its OWN domain terms
        ↓
freeze it
        ↓
COMMIT                    ← it can no longer be reshaped to fit
        ↓
pre-register predictions
        ↓
COMMIT                    ← they can no longer become hindsight
        ↓
adapt it to the abstraction
        ↓
measure churn
        ↓
classify each refinement
        ↓
accept structural · allow representational · reject convenience
        ↓
grade the predictions
        ↓
update the registries
```

**There is no step called "design a better abstraction."** The abstraction changes only when an
implementation cannot be expressed without the change. Every other rule exists to protect that one.

The two commit boundaries are the enforcement mechanism, and neither depends on good intentions:
*implementation-before-adapter* and *prediction-before-result* are both verifiable in version history by
someone who does not trust the author.

## 1. Frozen implementations

Each implementation is written from its own domain semantics, with the API its own domain would give
it, and committed **before** its adapter exists. It may not be edited to make the adapter cleaner — if
the adapter is awkward, the awkwardness is a finding.

A guard should assert that implementations do not import the abstraction. An implementation aware of
the contract can be shaped to fit it, consciously or not.

**Residual weakness:** this constrains the *order* of authorship, not the *identity* of the author. A
program where one person writes both the implementations and the abstraction retains a bias that no
commit ordering removes. Say so rather than implying otherwise.

## 2. Churn as a measured quantity

Assign fixed weights before measuring, so the cost of a change cannot be renegotiated after it is
wanted:

| Change | Weight |
|---|---|
| new **required** member | 3 — breaks every existing implementation |
| **changed semantics** of an existing member | 3 |
| new **optional** member | 1 |
| new union variant | 1 |
| new consistency rule | 1 |

**Convergence** is claimed when a newly adapted implementation costs **zero** *and* was predicted to —
on the **most recent** implementation, never on an average. Averages hide a rising trend.

**Divergence stop:** if an implementation forces a change that is a convenience rather than a genuine
gap, and it cannot be avoided, the abstraction is over-fitted. Stop expanding and revise.

## 3. Refinement taxonomy

| Kind | Meaning | Disposition |
|---|---|---|
| **structural** | the abstraction lacked a concept | accepted; becomes a numbered discovery |
| **representational** | the concept existed; this expresses it better | allowed; **not** a discovery |
| **convenience** | eases adaptation, adds no explanatory power | **never accepted** |

A two-way split (gap vs convenience) is insufficient: representational changes have nowhere to go and
must be misfiled as a neighbour. That ambiguity is how an abstraction drifts while appearing
disciplined.

Rejections should be **written down**, not merely made. A rejection count assembled from memory is a
floor, not a total, and should be labelled as such.

## 4. Discoveries

A **discovery** is a concept the abstraction was missing, found because an implementation could not be
expressed without it. Discoveries take permanent identifiers, because they are the empirical record of
how the theory changed and an identifier survives renaming in a way a changelog entry does not.

Each entry must state:

- the **implementation that forced it**;
- why the **prior abstraction was wrong** — incoherent or incomplete, not merely improvable;
- **why no existing implementation could have revealed it**;
- what was **deliberately not generalized** at the same time.

The third requirement is the load-bearing one. It forces every discovery to demonstrate *necessity*: a
discovery is not "something we hadn't written down", it is "something the prior empirical basis could
not, in principle, have exposed." Without it, any overlooked idea can be relabelled a discovery.

The fourth guards the opposite failure. Recording the restraint alongside the change makes
over-generalization visible — a discovery that quietly added three adjacent concepts looks identical to
a minimal one unless the exclusions are written down.

## 5. The originating implementation is a control

The implementation an abstraction was *extracted from* should discover nothing. It cannot surprise a
contract derived from it, so its role is to validate extraction, not to generate findings.

Assert this. **If the originating implementation begins producing discoveries after the fact, the
abstraction is being retrofitted rather than generalized** — that is a warning sign, not a success.

## 6. Predictions, and their grading

Stability and predictive power measure different things. An abstraction nobody changes may be right, or
may be untested. What indicates maturity is that a theory **predicts where it will fail** and is
surprised only in specific, explainable ways.

Two anti-gaming rules, which should be enforced mechanically rather than observed by habit:

1. **`partially-confirmed` requires ≥2 independent components declared in advance**, each graded
   separately, and is invalid if all held (that is *confirmed*) or none did (*falsified*). Unguarded,
   this grade absorbs every miss and the registry becomes decorative.
2. **Partial credit is not counted toward accuracy.** A partial is not most of a hit.

Falsified predictions keep the lesson they taught and are never rewritten.

**Expect accuracy to fall as the corpus diversifies.** A mature theory should increasingly meet
surprising domains. Accuracy climbing monotonically while implementations become more varied is a
signal to scrutinize — most likely the predictions are being written to be safe. Track the **surprise
rate** alongside accuracy for exactly this reason: a program with no falsifications is not being tested.

**What the metric is not.** Where the same author writes, grades, and implements, accuracy is a
discipline rather than independent evidence. Its only real guarantee is commit order.

## 7. Negative results

A **negative result** is a hypothesis that survived pre-registration and adaptation and was then
disproven. It is neither a rejected convenience (a refinement declined) nor a regraded prediction.

The distinction matters because **regrading a prediction erases the intuition behind it**. The belief
itself — the thing a later reader is most likely to re-propose — vanishes unless captured separately.

Entries are permanent: never deleted, never renumbered, never rewritten into a prediction update. A
superseded entry names its successor rather than disappearing. Hypotheses are recorded **as they were
actually held**, not softened in hindsight into something obviously wrong.

Entries reconstructed after the fact should be flagged. A belief recorded when it was abandoned is
stronger evidence of discipline than one remembered later.

## 8. Evidence provenance

Maturity (*how settled is this claim?*) and provenance (*what backs it?*) are independent dimensions and
are easily conflated.

| Provenance | Independence |
|---|---|
| emerged from a prior mechanism | **high** |
| revealed by an independent implementation | **high** |
| independent adversarial test | **medium** |
| fixture against the same implementation | **low** |
| architectural argument | **none** |

Two claims can share a maturity grade and differ entirely in support: one exercising a mechanism built
earlier for another purpose — which could have behaved otherwise — and one exercising an API introduced
in the same commit as its test. **The first can fail. The second is a tautology with assertions.**

Enforce that **maturity never outruns provenance**: a claim cannot be called experimentally grounded on
the strength of a fixture written against its own implementation. Enforce the converse too — grading
something a hypothesis when an independent implementation revealed it understates what is known.

Every ungrounded claim should name the experiment that would ground it. A claim with no path to
evidence is a permanent assumption wearing the costume of a pending one.

## 9. What the protocol does not do

- It does not remove author bias, only authorship *order* bias.
- It does not make self-graded accuracy independent evidence.
- It cannot tell you whether the abstraction is *useful* — only whether it is being changed honestly.
- It is slower than designing by taste, and the cost is real. It buys the ability to say which parts of
  a theory were forced by reality and which were chosen.

---

## Applying it elsewhere

Nothing above depends on the domain. The requirements are only that a theory exists, that independent
implementations can be adapted to it, and that someone is willing to record predictions before results
and preserve the ones that failed.

An instance of this protocol lives in
[`docs/planning/world-substrate/`](../planning/world-substrate/experimental-protocol.md), applied to a
computational-world substrate, with the registries implemented as executable data under
`packages/core/src/world/conformance/` — the assertions there are about the *method*, not about the
theory it produced.
