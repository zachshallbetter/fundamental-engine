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
