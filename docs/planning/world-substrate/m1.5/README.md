# M1.5 — Semantic freeze for the Stage-1 kernel experiment

> **Status: proposed decision records awaiting ratification.** These eight records specify — precisely
> enough for F1 to *test* them — the semantics the kernel experiment depends on. This is **not** where the
> decisions are proven correct; it is where they are stated precisely and revisably. This branch
> (`docs/m1.5-semantic-freeze`) must not merge until the decisions are explicitly ratified. **F1 does not
> begin until then** (gate G2). See the program in [`../README.md`](../README.md) and the WBS in
> [`../PLAN.md`](../PLAN.md).

*(Placed under the program at `docs/planning/world-substrate/m1.5/` rather than a top-level `docs/m1.5/`,
to keep the planning tree consistent — the content matches the reviewer's eight-record structure.)*

## Why a freeze, and how small

M1.5 is the actual intellectual critical path. It gives just enough semantic stability that F1 is
interpretable — participant, boundary, authority, derivation, and versioning are pinned so an ablation
result means something. It is **not** a full theory freeze. Each record is a *decision*, not an essay:
implementable, falsifiable, and revisable.

M1.5 **ratifies** the provisional semantics that then govern the CompInt canonical edits (C1.7–C1.10,
C1.12) and the F1 implementation. It is not blocked on those canonical edits.

## Records

| # | Record | Governs | Feeds |
|---|---|---|---|
| 01 | [Derivation taxonomy](01-derivation-taxonomy.md) | runtime / contract-relative / empirical split | R1a/R1b, all of F |
| 02 | [Participant admission](02-participant-admission.md) | who is a participant | kernel `Entities`; F1.1 |
| 03 | [Boundary validity](03-boundary-validity.md) | when an episode boundary is legitimate | F1.3 |
| 04 | [Authority and capability](04-authority-and-capability.md) | typed constraints, not primitives | `Ω_sys` (F1.2); ledger (F3.2) |
| 05 | [Causal claim classes](05-causal-claim-classes.md) | the permissions ladder | evidence ledger (F3.2) |
| 06 | [Kernel role hypotheses](06-kernel-role-hypotheses.md) | per-element baseline before ablation | F1.4 |
| 07 | [Version envelope](07-version-envelope.md) | what "version" means, split | F1.0 |
| 08 | [Ablation methodology](08-ablation-methodology.md) | how minimization is judged | F1.4, R2/R3 |

## Ratification ledger

| Record | Status | Ratified by | Date |
|---|---|---|---|
| 01–08 | **proposed** | — | — |

Ratification procedure: (1) draft (this branch); (2) cross-record contradiction audit; (3) present only
the unresolved decisions; (4) record ratification per record; (5) apply ratified semantics to the CompInt
canonical corpus; (6) mark M1.5 complete; (7) then F1.0 → F1.1.
