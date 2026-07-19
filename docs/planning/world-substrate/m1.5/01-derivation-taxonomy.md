# M1.5-01 — Derivation taxonomy

**Status:** proposed (awaiting ratification)

## Decision
Every construct the program discusses belongs to exactly one of three derivation classes, and the class
fixes its evidence standard and who may assert it:

- **Runtime-derived** — computable from the world `K` and asserted by the runtime: world state,
  transitions, system-relative opportunity (`Ω_sys`), reachability, enabled operations, permission,
  exposure, signaling, transition traces, candidate interaction episodes, execution-causal evidence.
- **Contract-relative** — defined only against an explicit analytical contract (property family,
  transforms, tolerances, purpose), never a property of the runtime alone: projection preservation,
  typed similarity, equivalence, invariance, comparison admissibility.
- **Empirically inferred** — not derivable by executing `K`; the runtime supplies *evidence* but never
  asserts the construct as fact: attributed behavior, human strategy, transfer, participant belief about
  opportunity, measurement claims, interpretation, experience.

**Load-bearing statement:** the kernel produces state, transitions, `Ω_sys`, candidate episodes, and
evidence; contract-relative and empirical constructs are defined *over* those outputs, not asserted by the
runtime.

## Alternatives considered
- One "derived" class (the original v1 plan). Rejected: it lets the runtime silently claim behavioral,
  strategic, and comparative facts it cannot establish — the decisive category error.
- Two classes (computational vs empirical). Rejected: it misfiles comparison/similarity/invariance, which
  are neither pure runtime facts nor empirical inferences but contract-relative.

## Reason
The three classes map one-to-one to the evidence rules R1a (computational), the contract requirement, and
R1b (empirical). Keeping them distinct is what bounds Fundamental's authority to computational facts.

## Operational consequences
- R1a governs runtime-derived claims; R1b governs empirical ones; contract-relative claims require a
  named contract present at evaluation.
- No runtime API returns an empirically-inferred construct as a value; it returns evidence + provenance.
- Class is a required annotation on every new construct in F1–F5.

## Falsification conditions
- A construct cannot be cleanly assigned to one class (suggests the taxonomy is incomplete).
- A runtime-derived construct is found to require empirical input to compute (misclassified).

## Open questions
- Do "candidate interaction episodes" stay runtime-derived, or become contract-relative once a boundary
  contract is required (see record 03)? Provisional: runtime-derived *under a declared boundary*.

## Ratification
Proposed. Ratify as the governing taxonomy for all of Track F and R1a/R1b.
