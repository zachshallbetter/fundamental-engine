# M1.5-03 — Boundary validity

**Status:** proposed (awaiting ratification)

## Decision
An interaction/episode boundary is treated as: **declared · question-relative · evidence-constrained ·
resolution-dependent · challengeable by viable alternate boundaries.** The detector (F1.3) returns
**candidate episodes under a declared boundary**; it does **not** establish that the boundary itself is
scientifically privileged. When more than one boundary is defensible, alternate parameterizations are
**reported**, not silently treated as errors.

A boundary declaration must name: participants in scope, system/environment partition, timescale,
recurrence window, coupling predicate, minimum material-influence threshold, and start/closure rules.

## Alternatives considered
- Intrinsic boundaries (an episode "is" a fact). Rejected: enlarging the temporal or system boundary can
  manufacture a return influence, making interaction partly true by construction — the exact failure the
  CompInt determination flagged.
- Detector returns a single boolean "is/is not an interaction." Rejected: hides the boundary dependence.

## Reason
Reciprocity is boundary-relative in hard cases (delayed/asynchronous/mediated closure). Honesty requires
the boundary to be an explicit, challengeable parameter rather than an implicit authority.

## Operational consequences
- F1.3 signature carries the boundary parameters; output includes the boundary used, the
  recurrence/reciprocity basis, determinacy, and **alternate valid segmentations**.
- The eight F1.3 adversarial cases are scored against a **preregistered** expected result *under a stated
  boundary*; a case that flips under another defensible boundary is reported, not an error.
- Feeds C1.8 (boundary-validity status on the Interaction Contract).

## Falsification conditions
- No boundary parameterization distinguishes a known interaction from a known non-interaction
  (the parameter set is insufficient).
- Every boundary yields the same verdict for a case designed to be boundary-sensitive (the model is not
  actually resolution-dependent).

## Open questions
- Is there a principled *default* boundary per world type, or always explicit? Provisional: explicit,
  with optional declared defaults per world schema.
- Adjudication among competing boundaries (explanatory question, causal closure, measurement resolution,
  alternatives) — specified here as reporting; ranking criteria deferred to V2.

## Ratification
Proposed. Ratify as the boundary-validity model governing F1.3 and C1.8.
