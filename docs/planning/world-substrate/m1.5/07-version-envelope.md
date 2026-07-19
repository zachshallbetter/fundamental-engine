# M1.5-07 — Version envelope

**Status:** ratified (2026-07-19)

## Decision
A single `version` field is insufficient. Every serialized world and trace carries a **version envelope**
that separately identifies:

```
world instance          which running world this is
world schema            the shape of this world's declared state/ontology
kernel semantics        the K semantics that evolve it
contract schema         the shape of the contracts in force
projection contract     the projection(s) that produced any accompanying representation
implementation          the engine/plane build (JS/Swift/Kotlin + version)
conformance-vector      the version of the golden vectors this was checked against
migration chain         the ordered history of schema migrations applied
```

Incompatible versions **fail explicitly**; there is **no silent migration** (F1.0).

## Alternatives considered
- One `version` string. Rejected: cannot express that a v3-instance under kernel-semantics v2 was checked
  against conformance-vectors v5 — the combinations that actually occur.
- Semver on the whole world only. Rejected: couples independently-evolving layers (schema vs kernel vs
  implementation vs vectors).

## Reason
The layers evolve independently and the evidence ledger must record *which* versions governed each
transition for replay and historical interpretation to remain valid (a v3 snapshot interpretable at v7).

## Operational consequences
- F1.0 stamps the envelope onto every serialized world and trace; traces retain the envelope they were
  produced under.
- Version *identity* ships in Stage 1 (F1.0); governed *migration* tooling is Stage 4 (F4.4). This record
  fixes identity only.
- A load that finds an incompatible envelope element errors rather than coercing.

## Falsification conditions
- A real interoperability case needs a version distinction not in the eight fields (envelope incomplete).
- Two of the eight fields are found to always co-vary in practice (candidate to collapse — a compression
  finding).

## Open questions
- Representation (semver vs content-hash vs both) per field — deferred to F1.0 implementation; identity
  semantics fixed here.
- Whether `conformance-vector` belongs in the world envelope or only in the test harness — provisional:
  recorded in the trace so a replay knows what it was validated against.

## Ratification
**Ratified 2026-07-19.** Original proposal: ratify the eight-field envelope and the explicit-fail / no-silent-migration rule.
