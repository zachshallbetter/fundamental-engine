# The Observatory

**Status:** shipped, first version (2026-07-19). Code: `apps/observatory` +
`packages/core/src/world/observatory/`. Run it with two commands (see the app README).

An inspection instrument for the empirical research program. Not a demo, a dashboard, a reference
implementation, or an analytics system — a **debugger for computational interaction**.

## The single design principle

> Every visible statement must be reproducible from recorded evidence. A reviewer should never need to
> trust the UI.

Everything below follows from that.

## Topology

```
living system (four adapted substrates)
      │  driven through their real DynamicsContract adapters
instrumentation adapter          packages/core/src/world/observatory/capture.ts
      │  records; computes nothing
normalized evidence log          the bundle (JSON)
      │
FCI runtime + experiment registry   the authority for every value in it
      │
Observatory                      apps/observatory — renders, derives nothing
```

**The boundary is structural, not disciplinary.** The app *cannot* import the runtime: core's `exports`
map is closed and core must stay DOM-free. The bundle is therefore the only path evidence can take, and
there is no code path by which the UI could compute a finding even if someone tried.

This was initially a constraint to work around. It turned out to be the correct architecture.

## What it will not do

Each of these is enforced by a test, not by a comment:

| Refusal | Why |
|---|---|
| registry sections must deep-equal the live registries | the UI cannot show a discovery the runtime does not hold |
| pending substrates get no run | an empty run reads as a result |
| a substrate that cannot declare its law shows **no** law | an empty law reads as a law |
| an unexecuted ablation is marked *unsupported, with the reason* | two of four requested ablations currently are |
| alternate episode groupings all retained, labelled conditional | a single grouping reads as *the* answer |
| `inferred` state is structurally zero | the category exists so its emptiness is visible |
| one-revision comparison shows nothing | a fabricated baseline makes a diff meaningless |

Two guards walk **source** rather than data: the capture layer and the app are both scanned for
hardcoded discovery / prediction / negative-result / ablation-classification literals, and the app is
additionally scanned for any call to a runtime derivation.

## Modes

**Replay** — a recorded execution of one substrate. World · Projection · Opportunity · Episodes ·
Evidence · Timeline. Replay is deterministic because nothing is recomputed: the cursor indexes an
immutable array the runtime already produced, and it holds no runtime reference, so it cannot modify
runtime state.

**Research** — the research program itself. Corpus · Discoveries · Predictions · Projection lab ·
Ablation · Cross-version. Cross-version compares **scientific state** — discoveries, negative results,
prediction grades, churn, accuracy — never source text, and flags a discovery that disappears between
revisions, because identifiers are permanent.

## Why the bundle is not committed

It is a generated capture. A stale committed bundle could display findings that no longer match the live
registries — exactly the failure this whole apparatus exists to prevent. Re-emit it instead.

## Honest limits of the first version

- The projection surfaces, opportunity contexts and episode traces in the capture are **fixtures**, the
  same ones the test suite uses. They are inputs chosen to exercise the runtime, not observations of a
  live application. A reviewer sees real runtime derivations over chosen inputs.
- Only the four **adapted** substrates are captured; the four pending ones appear as pending.
- Cross-version needs a second capture to be taken manually; nothing captures revisions automatically.
- There is no live-system mode yet. Every run is a recording.

---

# O11 — Instrument calibration and self-observation

**Status:** shipped (2026-07-19, `aeb4b79b`). Tests: `apps/observatory/test/instrument.test.mjs`.

The first version made the Observatory a **trustworthy downstream instrument**. It had not been
**characterized as an instrument**. Those are different achievements:

```
achieved first          runtime evidence → loss-resistant transport → faithful rendering
the open question       runtime evidence → instrument transformations → reviewer perception
```

The guards prove the Observatory cannot invent registry entries or call runtime derivations. They do
not prove that its selection, ordering, filtering, visual encoding and interaction design preserve the
meaning of the evidence. **A renderer can compute nothing and still mislead.**

## Two instrument effects found in the shipped build

Found by looking, not by testing — which is itself the argument for this phase:

1. The Projection pane treated the **first recorded projection as an unlabelled baseline** for its "vs"
   column, making one surface read as canonical.
2. The Episodes pane **defaulted to segmentation index 0** — exactly the failure of making a conditional
   boundary appear canonical.

Neither is a runtime derivation. Both are now declared transformations with stated mitigations.

## The transformation ledger

Every transformation between normalized evidence and visible output is named, classified, and required
to state its information loss, evidential basis, risk and mitigation.

| Class | Meaning | Count |
|---|---|---|
| lossless | the original is fully recoverable from what is shown | 4 |
| lossy-disclosed | information is dropped **and** the drop is visible | 2 |
| interpretive | the instrument makes a choice the evidence does not determine | 5 |
| refused | would assert something the evidence cannot support — not implemented | 5 |

The target is **not zero transformations** — a visualization necessarily transforms. The target is
explicit, bounded, inspectable transformation.

The refusals are the interesting half: severity-ranking failed predicates (the runtime assigns no
severity), hiding unavailable operations by default (absence would read as nonexistence), inferring
causality between a discovery and the prediction preceding it (the registries record chronology, not
causation), collapsing disagreeing provenance, and drawing a view over insufficient evidence.

## Representation invariants

Views build an inspectable **semantic model** before rendering, so invariants are asserted against
meaning rather than pixels. The distinctions that must never collapse:

```
hidden ≠ unavailable ≠ absent ≠ unknown ≠ unsupported ≠ missing
```

Eight rules, each with a positive case **and** a case proving the defect is caught — a renderer mapping
hidden onto unavailable, a bare conditional grouping, an undisclosed interpretive transformation, a
hypothesis dressed with grounded emphasis, omission without an indicator.

## Three layers that must never merge

```
subject claims        what the substrate and the FCI runtime establish
instrument claims     what the Observatory rendered, withheld, reordered, emphasized
interpretation        what a reviewer understood, missed, or inferred
```

A reviewer misreading an episode boundary does **not** falsify episode detection; it may falsify the
instrument's representation of conditionality. A better visualization that helps someone find an
existing inconsistency improves **inspection quality**, not the theory.

This is why the instrument's own predictions (`P-OBS-001..004`) live in a separate registry: mixing
claims about a user interface into the theory's accuracy metric would contaminate it. All four are
pending.

## Fidelity, including what is not measured

| Measure | Current |
|---|---|
| transformation disclosure | 1.00 |
| semantic distinction preserved | yes (7 status kinds) |
| replay fidelity | exact |
| revision fidelity | foreign schema refused, not reinterpreted |
| **interpretation error** | **not measured** |

Interpretation error is deliberately not computed. It requires structured review tasks, and presuming
it zero would be exactly the unearned claim this program exists to prevent. The UI states *"not
measured is not zero."*

## Still deferred, deliberately

**Live-system mode** — live input introduces ordering, partial evidence, dropped events and temporal
uncertainty. Recorded mode is the proper calibration environment, and calibration is not finished.
**Cross-framework comparison** — introduces interpretive mappings far less grounded than the current
representations. **Reviewer analytics as scientific evidence** — interaction traces may study the
instrument; they must never strengthen an FCI claim.
