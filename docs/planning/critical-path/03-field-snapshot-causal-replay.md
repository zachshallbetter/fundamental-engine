# Field Snapshot + Causal Replay

## Status

Experimental — **Snapshot + Diff MVP shipped** (`@fundamental-engine/core`: `FieldHandle.snapshot(opts?)`,
`FieldHandle.diff(a, b)`, and the pure `diffFieldSnapshots(a, b)`). The MVP-scope slice below is live:
`field.snapshot()` captures bodies/metrics/relationships/active-formations (optionally particles/data),
versioned and serializable, read-only and headless; `field.diff()` reports body/relationship/metric/
formation changes. Exposed on every surface. **Not in the frozen API surface** — the format may evolve.

**Causal Replay shipped too** — `field.replay(a, b, opts?)` (+ the pure `replayFieldSnapshots`): an
ordered, narrated sequence of causes (formation / relationship / measurement / metric) derived from the
diff, each carrying its before/after; `opts.focus` scopes to one body. Still not built: force-attribution
timelines (per-step accumulator contribution), `history.explain`, projection/diagnostic changes,
events-since-last-snapshot, export/import, and redaction.

Required for debugging, AI explainability, compliance, observability, testing, collaboration, and long-running field systems.

## Purpose

A screenshot captures what the interface looked like.

A Field Snapshot captures what the interface was doing.

Causal Replay explains how the field reached a state.

Together, they make Fundamental inspectable over time.

## Core definitions

A **Field Snapshot** is a portable capture of field state at a moment in time.

A **Field Diff** compares two snapshots.

A **Causal Replay** reconstructs the sequence of causes that changed the field between snapshots or across a time window.

## Why this matters

Fundamental is not only visual. It contains bodies, relationships, forces, metrics, diagnostics, projections, events, and feedback.

When something changes, the question is not only:

```txt
What changed in the DOM?
```

The real question is:

```txt
What changed in the field, and why?
```

## Field Snapshot

A snapshot should capture enough state to inspect, replay, compare, test, export, or hand to an AI agent.

Suggested shape:

```ts
type FieldSnapshot = {
  id: string;
  createdAt: number;
  frame: number;
  version: string;
  host?: FieldHostInfo;
  formations: FieldFormationReading[];
  bodies: FieldBodySnapshot[];
  relationships: FieldRelationshipSnapshot[];
  metrics: Record<string, number>;
  dimensions: FieldDimensionSnapshot[];
  projections?: FieldProjectionSnapshot[];
  diagnostics?: FieldDiagnosticSnapshot[];
  events?: FieldEventSnapshot[];
  particles?: FieldParticleSnapshot[];
  metadata?: Record<string, unknown>;
};
```

## Snapshot contents

### Bodies

```ts
type FieldBodySnapshot = {
  id: string;
  role?: string;
  authority?: "anchored" | "kinematic" | "dynamic";
  rect?: Rect;
  position?: Vec3;
  velocity?: Vec3;
  tokens: string[];
  metrics: Record<string, number>;
  dimensions: Record<string, number>;
  data?: unknown;
};
```

### Relationships

```ts
type FieldRelationshipSnapshot = {
  from: string;
  to: string;
  type: string;
  strength: number;
  memory?: number;
  active: boolean;
  causal: boolean;
  formation?: string;
};
```

### Formations

```ts
type FieldFormationReading = {
  id: string;
  pattern?: string;
  representedBy?: "FieldRecipe";
  status?: string;
  active: boolean;
  bodies: string[];
  metrics: string[];
  diagnostics: string[];
  projections: string[];
};
```

### Events

```ts
type FieldEventSnapshot = {
  time: number;
  frame: number;
  type: string;
  target?: string;
  source?: string;
  payload?: unknown;
};
```

## Snapshot API

```ts
const snapshot = field.snapshot({
  includeParticles: false,
  includeDiagnostics: true,
  includeRelationships: true,
  includeProjections: true,
});
```

Recommended options:

```ts
type FieldSnapshotOptions = {
  includeParticles?: boolean;
  includeDiagnostics?: boolean;
  includeRelationships?: boolean;
  includeProjections?: boolean;
  includeEvents?: boolean;
  includeData?: boolean;
  redact?: FieldSnapshotRedaction;
};
```

## Field Diff

A Field Diff compares two snapshots.

```ts
const diff = field.diff(snapshotA, snapshotB);
```

It should answer:

```txt
Which bodies changed?
Which relationships strengthened or weakened?
Which metrics rose or fell?
Which forces contributed to change?
Which projections changed?
Which Field Formations became active or inactive?
Which accessibility equivalents were lost or gained?
```

Suggested shape:

```ts
type FieldDiff = {
  from: string;
  to: string;
  bodyChanges: BodyChange[];
  relationshipChanges: RelationshipChange[];
  metricChanges: MetricChange[];
  formationChanges: FormationChange[];
  projectionChanges: ProjectionChange[];
  eventSummary: EventSummary[];
};
```

## Causal Replay

Causal Replay explains how state changed over time.

It is not just event logging. It should preserve attribution:

```txt
force contribution
relationship change
metric threshold
body measurement
projection change
event dispatch
feedback write
formation activation
```

Potential API:

```ts
const replay = field.replay({
  from: snapshotA,
  to: snapshotB,
  focus: bodyId,
});
```

or:

```ts
const explanation = field.history.explain(bodyId, {
  from: t0,
  to: t1,
});
```

## Replay output

Example:

```txt
At t0, Claim A gained attention.
At t1, Source B strengthened a support relationship.
At t2, Contradiction C introduced charge separation.
At t3, confidence dropped below threshold.
At t4, the Evidence Field Formation became unstable.
At t5, reduced-motion projection rendered a static conflict summary.
```

Structured form:

```ts
type CausalReplay = {
  from: string;
  to: string;
  focus?: string;
  steps: CausalReplayStep[];
};

type CausalReplayStep = {
  time: number;
  frame: number;
  cause: "force" | "relationship" | "metric" | "event" | "projection" | "formation" | "measurement";
  source?: string;
  target?: string;
  description: string;
  contribution?: unknown;
  diagnostics?: FieldDiagnosticReading[];
};
```

## Use cases

### Developer debugging

Instead of asking “why did this class change?” the developer asks:

```txt
why did this component become dense?
which force caused the transform?
which relationship became causal?
which Field Formation activated?
```

### AI evidence review

Replay can explain how an answer became unstable:

```txt
unsupported claim introduced
contradiction added
source age decayed confidence
support bond weakened
confidence projection changed
```

### Observability

A service incident can be replayed as field pressure propagation:

```txt
latency heat rose
service dependency bond transferred pressure
alert threshold crossed
owner attention arrived
incident cooled
```

### Compliance and legal review

A reviewer can inspect why a clause became high-risk:

```txt
obligation gravity increased
exception created instability
missing evidence produced pressure
review note added cohesion
```

### Design systems

Snapshot validates that a component’s reduced-motion projection preserves meaning.

```txt
motion projection removed
static projection retained density and warning state
accessibility equivalent present
```

## Persistence

Snapshots can be ephemeral or persistent.

Ephemeral:

```txt
devtools
current session replay
visual debugging
```

Persistent:

```txt
bug reports
AI memory
longitudinal research
analytics
collaboration
compliance audit
```

## Privacy and redaction

Snapshots may include sensitive data.

Required redaction features:

```txt
strip body data
strip text content
hash body ids
remove user identifiers
remove raw event payloads
preserve topology without content
```

Example:

```ts
field.snapshot({
  includeData: false,
  redact: {
    text: true,
    userIds: true,
    payloads: true,
  },
});
```

## Relationship to Field Query

Field Query asks the current field or a selected snapshot.

Snapshot captures the state.

Replay explains changes.

```txt
Field Query = ask
Field Snapshot = capture
Field Diff = compare
Causal Replay = explain
```

## MVP scope

Start with snapshots before full replay.

MVP:

```txt
field.snapshot()
field.diff(snapshotA, snapshotB)
body metrics
relationships
active Field Formations
events since last snapshot
```

Next:

```txt
force attribution
projection changes
diagnostic replay
timeline viewer
export/import
redaction
```

## Acceptance checklist

- Snapshot works in DOM and headless modes.
- Snapshot can exclude particles for lightweight exports.
- Snapshot captures bodies, metrics, relationships, and active Field Formations.
- Snapshot supports redaction.
- Diff compares two snapshots.
- Replay can explain at least metric, relationship, event, and formation changes.
- Replay does not require visual rendering.
- Snapshot format is versioned.
