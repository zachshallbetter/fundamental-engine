# Fundamental Critical Path Docs

This pack contains the focused planning documents for the next major Fundamental substrate work.

## Documents

1. [Field Formation Terminology](01-field-formation-terminology.md) (superseded — shipped as **Pattern**, see the doc's Status)
2. [Field Query API](02-field-query-api.md)
3. [Field Snapshot + Causal Replay](03-field-snapshot-causal-replay.md)
4. [Dimension-Aware Accumulator + Body-Authority Modes](04-dimension-aware-accumulator-body-authority.md)
5. [Projection Registry + Governance](05-projection-registry-governance.md)
6. [Carrier Seam](06-carrier-seam.md)

## Critical path

```txt
Field Pattern terminology (shipped)
  establishes the conceptual language

Field Query API
  makes the field readable

Field Snapshot + Causal Replay
  makes the field inspectable over time

Dimension-aware accumulator + body-authority modes
  makes the engine substrate ready for restored dimensions

Projection registry + governance
  makes field behavior visible, accessible, and trustworthy

Carrier seam
  makes ambient structure declared and readable instead of painted
```

## Guiding principle

Fundamental does not need more spectacle first. It needs queryability, inspectability, persistence, projection, stronger contracts, and governance.

```txt
Field Pattern = authored arrangement
Field Query = ask the field
Field Snapshot = capture the field
Causal Replay = explain the field
Accumulator = attribute cause before integration
Body Authority = decide who owns position
Projection = reveal state
Governance = keep the system authorable instead of magical
Carrier = convey ambient structure
```
