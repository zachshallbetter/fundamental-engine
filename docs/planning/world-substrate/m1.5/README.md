# M1.5 — Semantic freeze for the Stage-1 kernel experiment

> **Status: RATIFIED 2026-07-19 — M1.5 complete.** These eight records specify — precisely enough for F1
> to *test* them — the semantics the kernel experiment depends on. They are ratified (record 02 with a
> two-level participant correction), so **G2 is open and F1 may build** following the
> [F1 execution spec](../F1-execution-spec.md). This is not where the decisions are proven correct; F1
> tests them. See the program in [`../README.md`](../README.md) and the WBS in [`../PLAN.md`](../PLAN.md).

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
| 01 Derivation taxonomy | **ratified** | Zach Shallbetter | 2026-07-19 |
| 02 Participant admission | **ratified** (two-level correction) | Zach Shallbetter | 2026-07-19 |
| 03 Boundary validity | **ratified** (detection-contract form) | Zach Shallbetter | 2026-07-19 |
| 04 Authority & capability | **ratified** | Zach Shallbetter | 2026-07-19 |
| 05 Causal claim classes | **ratified** | Zach Shallbetter | 2026-07-19 |
| 06 Kernel role hypotheses | **ratified** | Zach Shallbetter | 2026-07-19 |
| 07 Version envelope | **ratified** | Zach Shallbetter | 2026-07-19 |
| 08 Ablation methodology | **ratified** | Zach Shallbetter | 2026-07-19 |

Procedure completed: drafted → cross-record contradiction audit (clean) → unresolved decisions presented →
ratified per record (record 02 corrected to the world/episode two-level distinction) → **M1.5 complete**.
Remaining (does not block F1): apply the ratified semantics to the CompInt canonical corpus (C1.7–C1.10,
C1.12), preserving aliases and historical interpretability. F1 builds now, per the
[F1 execution spec](../F1-execution-spec.md); branches are not merged on the maintainer's behalf.
