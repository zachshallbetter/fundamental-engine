# M1.5-05 — Causal claim classes

**Status:** proposed (awaiting ratification)

## Decision
Causal claims form a **permissions ladder**, not a set of interchangeable labels. Each rung has explicit
evidence requirements and forbidden interpretations. The runtime may assert **only the lowest rung**
within its own deterministic substrate.

| Rung | May be asserted by | Evidence required | Forbidden interpretation |
|---|---|---|---|
| `execution-causal` | **the runtime** | deterministic transition lineage in `K` (this transition produced this state) | that it caused a *human* decision or an out-of-substrate effect |
| `mechanism-declared` | analysis, with a model | a declared mechanism linking factors | that the mechanism is empirically confirmed |
| `counterfactual-simulated` | analysis, in-substrate | a simulated intervention over the world model | that the simulated counterfactual holds of the real world |
| `intervention-supported` | empirical study | an actual controlled intervention | generalization beyond the studied population/context |
| `empirically-causal` | empirical study | intervention + replication + identification assumptions | universal or mechanism claims not tested |

## Alternatives considered
- Flat causal labels. Rejected: lets a provenance record read as an empirical causal claim.
- A single "causal" flag on the ledger. Rejected: conflates execution lineage with scientific causation.

## Reason
The transition evidence ledger (F3.2) can authoritatively report *execution* causality inside the
deterministic substrate and nothing higher. Typing the ladder stops that authority from silently
generalizing — the same discipline as the causality ladder in `docs/canonical/causality-and-truth.md`.

## Operational consequences
- The ledger emits `execution-causal` only; higher rungs are constructed by the analysis layer with their
  required evidence and are never emitted by the runtime.
- Each rung ships its forbidden-interpretation note wherever it is surfaced.
- Feeds C1.9 (canonical causal claim classes).

## Falsification conditions
- A needed causal claim does not fit any rung (ladder incomplete).
- The runtime is found emitting a claim above `execution-causal` (a boundary violation to fix).

## Open questions
- Placement of `counterfactual-simulated` relative to `mechanism-declared` when a simulation encodes a
  declared mechanism — provisional order above; revisit if they collapse.

## Ratification
Proposed. Ratify the ladder, its evidence/forbidden columns, and the runtime-asserts-only-rung-1 rule.
