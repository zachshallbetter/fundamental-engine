# Field Query API

## Status

Proposed experimental API. Highest-leverage missing capability for AI, data, OS, research, debugging, design systems, and agent tooling.

## Purpose

Fundamental can already compute field behavior, write feedback, run renderlessly, expose relationships, and drive DOM or headless surfaces. The next step is to make the field directly queryable.

A Field Query API turns Fundamental from a runtime that emits signals into a substrate that tools, agents, tests, and humans can inspect.

## Core idea

A field should be able to answer structured questions:

```txt
What is dense here?
What is pulling attention?
What is unstable?
Which relationships are active?
Which bodies influenced this one?
Which forces caused this state?
Which dimensions are participating?
Which projections are available?
What changed since the last snapshot?
```

## Why this matters

Without a Field Query API, the field is mostly observed indirectly:

```txt
CSS variables
feedback callbacks
render surfaces
diagnostics
readEdges()
manual inspection
```

That is useful, but incomplete.

For AI, research, OS, data, and debugging use cases, the system needs a unified way to ask for field state as structured data.

## Design principle

```txt
The field should be readable without requiring a visual projection.
```

Renderless mode should still be fully inspectable.

Agents should not have to scrape DOM, parse screenshots, or infer class names. They should ask the field.

## Proposed API shape

```ts
type FieldQuery = {
  at?: BodyRef | Point | Rect;
  radius?: number;
  dimensions?: string[];
  relations?: string[];
  include?: FieldQueryInclude[];
  time?: FieldQueryTime;
  lens?: string;
};

type FieldQueryInclude =
  | "bodies"
  | "metrics"
  | "relationships"
  | "forces"
  | "influences"
  | "diagnostics"
  | "projections"
  | "events"
  | "snapshots";
```

Example:

```ts
const reading = field.query({
  at: claimElement,
  radius: 320,
  dimensions: ["attention", "confidence", "memory"],
  relations: ["supports", "contradicts", "depends-on"],
  include: ["bodies", "metrics", "relationships", "influences", "diagnostics"],
});
```

## Proposed result shape

```ts
type FieldQueryResult = {
  query: FieldQuery;
  frame: number;
  time: number;
  region?: Rect;
  bodies: FieldBodyReading[];
  metrics: Record<string, number>;
  relationships: FieldRelationshipReading[];
  influences: FieldInfluenceReading[];
  diagnostics?: FieldDiagnosticReading[];
  projections?: FieldProjectionReading[];
  events?: FieldEventReading[];
};
```

Body reading:

```ts
type FieldBodyReading = {
  id: string;
  role?: string;
  rect?: Rect;
  authority?: "anchored" | "kinematic" | "dynamic";
  tokens: string[];
  metrics: Record<string, number>;
  dimensions: Record<string, number>;
  activeFormations?: string[];
};
```

Relationship reading:

```ts
type FieldRelationshipReading = {
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

Influence reading:

```ts
type FieldInfluenceReading = {
  source: string;
  target?: string;
  force: string;
  dimension?: string;
  contribution: number | Vec2 | Vec3;
  couplesDimensions?: string[];
  reason?: string;
};
```

## Query modes

### Local query

Ask what is happening around a point, body, or region.

```ts
field.query({ at: body, radius: 240 });
```

Use for:

```txt
component inspection
AI evidence cards
form fields
research claims
OS windows
data points
```

### Global query

Ask what is most important across the whole field.

```ts
field.query({
  include: ["bodies", "metrics", "relationships"],
});
```

Use for:

```txt
field summaries
dashboard health
agent planning
document navigation
risk review
```

### Lens query

Ask through a specific interpretation.

```ts
field.query({
  lens: "evidence",
  include: ["relationships", "diagnostics"],
});
```

Use for:

```txt
evidence lens
confidence lens
accessibility lens
causality lens
security lens
performance lens
```

### Time query

Ask how state changed across a time window.

```ts
field.query({
  at: body,
  time: { from: snapshotA, to: snapshotB },
  include: ["metrics", "relationships", "events"],
});
```

Use for:

```txt
causal replay
field diff
analytics
agent memory
incident review
```

## Primary use cases

### AI Evidence Field

Query claims, support, contradiction, confidence, source age, and gaps.

```ts
field.query({
  lens: "evidence",
  include: ["bodies", "relationships", "metrics", "diagnostics"],
});
```

### Design system inspection

Ask why a component is emphasized.

```ts
field.query({
  at: button,
  include: ["metrics", "influences", "projections"],
});
```

### Research workspace

Find unstable claims or dense regions.

```ts
field.query({
  dimensions: ["confidence", "memory"],
  relations: ["supports", "contradicts"],
});
```

### OS / agent workspace

Find what is pulling user focus across windows, files, or tasks.

```ts
field.query({
  include: ["bodies", "relationships", "metrics"],
  lens: "attention",
});
```

## Relationship to snapshots

A query reads the current field or a selected time window.

A snapshot captures a complete field state.

A replay compares snapshots over time.

```txt
Field Query = ask the field
Field Snapshot = capture the field
Causal Replay = explain how the field changed
```

## Relationship to diagnostics

Diagnostics should become queryable, not only visual.

A diagnostic reading should answer:

```txt
what is the invisible structure?
what caused this state?
which force contributed?
which relationship became causal?
which projection is active?
```

## Relationship to agents

The Field Query API should be the foundation of the agent-readable protocol.

Agents should be able to ask:

```txt
what is unresolved?
what is unsupported?
what is high-pressure?
what is stale?
what is pulling attention?
what should be inspected next?
```

## Governance

A query result must preserve lane separation.

Do not collapse:

```txt
concepts
tokens
metrics
diagnostics
relationships
forces
projections
formations
```

Each reading should identify its lane.

## First implementation scope

Start small.

MVP:

```txt
field.query({ at, radius })
returns bodies, metrics, relationships, active tokens, active formations
```

Then add:

```txt
influence attribution
diagnostics
projection readings
lens support
snapshot/time support
```

## Acceptance checklist

- Query works in DOM and headless modes.
- Query can target a body, point, rect, or whole field.
- Query returns structured bodies, metrics, and relationships.
- Query preserves lane separation.
- Query can identify active Field Formations.
- Query does not require render surfaces.
- Query does not mutate field state.
- Query is experimental until stabilized.
