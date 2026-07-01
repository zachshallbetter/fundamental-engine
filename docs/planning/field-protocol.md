> **Status: frontier / speculative.**
> This is **not canonical and not frozen.** It sketches a future serialized interchange format — the
> "Field Protocol" — for moving field state between apps, tools, ports, and agents. The
> [substrate API](../canonical/substrate-api.md) is the *live, in-process* read surface; this doc is
> what its results might look like once they cross a process boundary. Nothing here is shipped. Shapes
> below are **illustrative TypeScript**, not the frozen 17 ([api-stability.md](../canonical/api-stability.md)),
> and will change until real consumers force them to settle. Follows the
> [status rule](../canonical/documentation-standards.md): none of this is "shipped" until code confirms it.

# Field Protocol (frontier)

The substrate API already turns a running field into plain, serializable data *inside one process*:
`query()` / `snapshot()` / `diff()` / `replay()` return structured records with no DOM and no render
surface. The **Field Protocol** is the next question: when that data leaves the process — over a wire,
into a file, across the JS ⇄ Swift ⇄ Kotlin ports, or into an agent's context — what is the *stable
serialized schema* both ends agree on?

This document exists so we design that schema deliberately rather than accidentally freezing whatever
`JSON.stringify(field.query())` happens to emit. It stays in `docs/planning/` until at least two real,
independent consumers need to exchange field state. Until then it is a **target**, not a contract.

## Why a protocol at all

- **Cross-app interop.** A design tool captures a field; a runtime replays it; an agent explains it.
  Each needs the same record shape, versioned so an old snapshot still parses.
- **Cross-plane parity.** JS, Swift, and Android cores are held to a shared conformance golden. A wire
  format lets them exchange snapshots directly instead of comparing byte streams.
- **Agent legibility.** The `agent-json` projection surface already emits readings for tooling. A
  protocol names the *whole* vocabulary — bodies, relationships, influences, projections — so an agent
  reads a field the same way regardless of where it ran.

## Alignment with the substrate API

Every shape below is a **serialization view** of an existing substrate result, not a new concept:

| Protocol shape | Substrate source ([substrate-api.md](../canonical/substrate-api.md)) |
|---|---|
| `FieldReading` | `FieldQueryResult` |
| `FieldSnapshot` | `FieldSnapshot` (+ `FieldSnapshotOptions`) |
| `FieldBody` | `FieldBodyReading` |
| `FieldRelationship` | `FieldRelationshipReading` |
| `FieldInfluence` | `FieldInfluenceReading` / `ForceAttribution` |
| `FieldProjection` | `FieldProjectionInfo` (metadata only — no `apply`) |
| `FieldMetric` | an entry of `FieldQueryResult.metrics` |
| `FieldPolicy` | `GovernanceWarning` provenance (projection / lane / coupling lints) |
| `FieldLens` | `FieldLens` |

The live API keeps functions (`apply`, `bind`); the protocol keeps **only data** — a projection crosses
the wire as metadata, never as executable code.

## Illustrative shapes (not frozen)

```ts
/** The protocol envelope. Every serialized field record carries version + provenance. */
interface FieldProtocolEnvelope {
  protocol: 'fundamental-field-protocol';
  version: string;              // FIELD_VERSION of the emitter
  kind: 'reading' | 'snapshot' | 'diff' | 'replay';
  emittedAt: number;            // wall-clock ms; distinct from field time
  payload: FieldReading | FieldSnapshot /* | FieldDiff | CausalReplay */;
}

/** A point/rect/global answer at one frame — the wire view of FieldQueryResult. */
interface FieldReading {
  frame: number; time: number;
  region?: { x: number; y: number; width: number; height: number };
  bodies: FieldBody[];
  metrics: FieldMetric[];
  relationships: FieldRelationship[];
  influences: FieldInfluence[];
  projections: FieldProjection[];  // metadata only
  lens?: string;                   // lens id this reading was scoped through
}

/** A captured frame — portable, versioned, replayable against another snapshot. */
interface FieldSnapshot {
  version: string; frame: number; time: number;
  bodies: FieldBody[];
  relationships?: FieldRelationship[];
  metrics: FieldMetric[];
  influences?: FieldInfluence[];   // present iff captured with includeInfluences
  particles?: unknown;             // raw pool, heavy; present iff includeParticles
}

/** One body's state. Position is in FIELD space (see coordinate-spaces.md), not screen px. */
interface FieldBody {
  id: string;
  rect: { x: number; y: number; width: number; height: number };
  tokens: string[];                // passported force tokens carried
  metrics: Record<string, number>; // per-body measured readings
  dimensions: Record<string, number>; // axes of state (attention, confidence, …)
  authority: 'anchored' | 'kinematic' | 'dynamic';
  activeFormations?: string[];
}

/** A directed edge between two bodies. */
interface FieldRelationship {
  from: string; to: string;
  type: string;
  strength: number;
  memory?: number;
  active: boolean;
  causal?: boolean;
}

/** A single force's contribution, tagged with the accumulator channel it moved. */
interface FieldInfluence {
  source: string;                  // emitting body id
  force: string;                   // passported token
  channel: 'linear' | 'thermal' | 'angular' | 'temporal' | 'semantic' | 'constraint';
  contribution: number | { x: number; y: number; z: number };
  couplesDimensions?: string[];    // the coupling passport
}

/** A projection as data — what it reads and writes, never how. */
interface FieldProjection {
  id: string; label?: string;
  channels: string[];              // accumulator/metric lanes it reads
  surfaces: string[];              // css | typography | attribute | agent-json | sound | haptic | …
  reducedMotionEquivalent?: string;
  accessibilityEquivalent?: string;
}

/** A named measured reading. Dimension = axis of state; metric = the reading of it. */
interface FieldMetric {
  key: string;
  value: number;
  dimension?: string;              // the axis this metric measures, when it maps to one
  scope: 'global' | 'body';
  bodyId?: string;                 // present iff scope === 'body'
}

/** Governance provenance carried alongside a record — why a lint fired. */
interface FieldPolicy {
  rule: string;                    // e.g. field/reduced-motion-equivalent-required
  level: 'error' | 'warning';
  target?: string;                 // projection id / force token / word
  message: string;
}

/** A declarative scope carried with a reading — mirrors the live FieldLens. */
interface FieldLens {
  id: string; label?: string;
  metrics?: string[];
  channels?: string[];
  tokens?: string[];
}
```

## Open questions (why this stays in planning)

- **Versioning & migration.** `FIELD_VERSION` stamps every record, but there is no migration story for
  reading an old snapshot with a newer parser. A protocol needs one before it is a contract.
- **Coordinate space on the wire.** Positions serialize in **field space** (see
  [coordinate-spaces.md](../canonical/coordinate-spaces.md)); the receiver re-projects. The envelope
  does not yet declare which space it carries — it must.
- **Truth labels.** Each record should be able to declare whether its influences are deterministic,
  stochastic, heuristic, semantic, or diagnostic (see
  [causality-and-truth.md](../canonical/causality-and-truth.md)) so a consumer never over-reads a
  replayed narrative as measured cause.
- **Compaction.** `includeParticles` snapshots are large; a real protocol needs a delta/streaming form.

Until real consumers exercise these questions, the Field Protocol remains a design target. Use the
in-process [substrate API](../canonical/substrate-api.md) today; do not pin an external contract to the
shapes above.
