> **Status: canonical.**
> The substrate API: the read-only, structured surface that makes the field an *inspectable,
> queryable, time-travelable, projectable* substrate — not just a thing that draws or writes CSS
> variables. Every method below is **shipped** in `@fundamental-engine/core` (verified against
> `packages/core/src/engine/types.ts` + `field.ts`), but the whole surface is **EXPERIMENTAL**: it is
> *not* on the protected list (see [api-stability.md](api-stability.md)) and may change shape or be
> removed in any release. Use it; don't pin a contract to it yet. Follows the
> [status rule](documentation-standards.md): nothing here is called shipped unless code confirms it.

# Substrate API

The field is not only a renderer and a CSS-variable writer. It is a live model of bodies, matter,
metrics, relationships, and per-force influence — and that model is **readable as plain, serializable
data**, with no render surface and no DOM (it works headless, under `render: 'none'`). Four read
capabilities turn the running field into an inspectable substrate:

- **Query** — ask the live field a structured question (point / rect / global).
- **Snapshot + Diff** — capture *what the field is doing* at a frame; compare two captures.
- **Causal Replay** — narrate *how* the field changed between two snapshots.
- **Projection Registry** — register named mappings from field state to an output surface, with a
  governance lint that keeps them accessible.

Two construction-time capabilities round it out:

- **Body authority** — who owns a body's position (`anchored` / `kinematic` / `dynamic`); a `dynamic`
  body recoils, integrating under the net field.
- **Integrator modes + accumulator channels** — a frame-rate-independent integrator, and the
  dimension-aware impulse accumulator that backs per-force attribution.

> **Governance principle (substrate 05):** *projection reveals state; coupling changes state — do not
> confuse them.* Nothing in this API mutates the field. `query`/`snapshot`/`diff`/`replay` are pure
> reads; a projection's `apply` writes to an output surface, never to a force.

---

## Query — `query(q?): FieldQueryResult`

Ask the live field a structured question and get back plain, serializable data. Read-only and
render-agnostic.

**`query()` contract — what it is *not*:**

```txt
query() observes the field.
query() does NOT mutate the field.
query() does NOT trigger a projection.
query() does NOT imply a coupling.
query() does NOT read private host state unless the host exposes it.
```

This is the bridge from UI effects to software agents, so the read-only guarantee is load-bearing: an
agent reading the field can never, through reading, change it. Permission/redaction **scoping** for agent
reads is the safety layer on top — see [Agent permissions + snapshot profiles](#agent-permissions--snapshot-profiles) below.

```ts
interface FieldQuery {
  at?: Vec2 | FieldRect;                 // point {x,y}, DOMRect-shaped rect, or omitted = whole field
  radius?: number;                        // point-query radius in field px (default 240)
  include?: ('bodies' | 'metrics' | 'relationships' | 'influences')[];
  lens?: FieldLens;                       // scope the answer through a lens (query phase 2)
}
interface FieldQueryResult {
  query: FieldQuery; frame: number; time: number; region?: FieldRect;
  bodies: FieldBodyReading[];             // id, identity, rect, tokens, metrics, dimensions, activeFormations, authority
  metrics: Record<string, number>;
  relationships: FieldRelationshipReading[];   // from/to ids, type, strength, memory, active, causal
  influences: FieldInfluenceReading[];    // source body, force token, channel, contribution (Δv | heat)
  projections: FieldProjectionInfo[];     // registered projections (metadata only)
  lens?: string;                          // the lens id this reading was scoped through, when supplied
}
```

**First-class body identity.** Every `FieldBodyReading` (and every snapshot body) carries a stable,
structured `identity` alongside the top-level `id`:

```ts
interface FieldBodyIdentity {
  id: string;          // stable primary key — unique in the field, constant for the body's life
  namespace?: string;  // optional grouping (app/module); opaque to the engine
  kind?: string;       // optional type tag ('card', 'heading', 'agent'); opaque
  host?: string;       // optional owner tag (a renderer/view that owns the rendered object); opaque
}
```

`identity.id === id` (back-compat), and `snapshot`/`diff`/`replay`/relationships all key on `identity.id`.
**Identity is a doctrine, not display text:** a heading's *words* are not its identity (they can change
while identity holds), a DOM `id` is one *source* of a stable id but not the concept, and an object
reference is not identity (references don't survive a rescan or a serialize/replay round-trip). Supply an
identity via `addBody({ identity })` (a bare string is shorthand for `{ id }`) or a `createField({ identify })`
resolver that derives one from a DOM element; when none is supplied the engine derives a **deterministic**
stable id (the element's DOM `id`, else a monotonic `body-N` — never `Math.random`), so identity is always
present and stable.

`el.getBoundingClientRect()` drops straight into `at` (it's `DOMRect`-shaped). `influences` come from
the impulse accumulator — each carries a `channel`: `'linear'` (Δv), `'thermal'` (heat), `'angular'`
(spin), `'temporal'` (mortal age), or `'semantic'` (the body's attention multiplier). Default `'linear'`.

**Lenses (query phase 2).** A `FieldLens` is a **user-defined** declarative scope — not a preset
catalog: the caller supplies it. Each clause is an allow-list (an omitted clause keeps everything in
that dimension), and the result is tagged with `lens.id`:

```ts
interface FieldLens {
  id: string; label?: string;
  metrics?: string[];                     // keep only these metric keys (global + per-body metrics/dimensions)
  channels?: ('linear'|'thermal'|'angular'|…)[]; // keep only influences in these accumulator channels
  tokens?: Token[];                       // keep only bodies carrying a listed token
}
const thermal = field.query({ lens: { id: 'thermal', metrics: ['temperature','entropy'], channels: ['thermal'] } });
```

The standalone **`applyLens(result, lens)`** is exported and pure (returns a new result; never mutates),
so a lens composes over any `FieldQueryResult` — a live `query()` answer or one rebuilt from elsewhere.
The query's *time-window* (interpreting a past moment) is served by the snapshot trio
(`snapshot()` / `diff()` / `replay()`), not a separate in-engine history buffer.

```ts
const result = field.query({ at: el.getBoundingClientRect(), include: ['bodies', 'influences'] });
for (const inf of result.influences) console.log(inf.source, inf.force, inf.contribution);
```

---

## Snapshot + Diff — `snapshot(opts?): FieldSnapshot` · `diff(a, b): FieldDiff`

A snapshot captures *what the field was doing* at a frame (vs a screenshot's *what it looked like*) —
portable, serializable, versioned by `FIELD_VERSION`. `diff` is pure: it compares two snapshots and
ignores live state.

```ts
interface FieldSnapshotOptions {
  includeParticles?: boolean;     // raw pool (heavier; default off)
  includeRelationships?: boolean; // default true
  includeData?: boolean;          // each body's opaque data record (default false — privacy)
  includeInfluences?: boolean;    // per-body force attribution, so replay() can derive cause:'force'
}
interface FieldDiff {
  from: string; to: string;
  bodyChanges: BodyChange[];                 // added | removed | changed (per-metric { from, to })
  relationshipChanges: RelationshipChange[]; metricChanges: MetricChange[]; formationChanges: FormationChange[];
}
```

```ts
const a = field.snapshot({ includeInfluences: true });
// …frames later…
const b = field.snapshot({ includeInfluences: true });
const changed = field.diff(a, b).bodyChanges;   // what moved, metric by metric
```

The standalone `diffFieldSnapshots(a, b)` is also exported.

---

## Agent permissions + snapshot profiles

`query()` / `snapshot()` are the *structured read*; **agent permissions** are the *safety layer* on top —
the scoped, read-only surface a **Software Agent** uses to read the field without being able to change it.
The doctrine is in [`agent-consumption-model.md`](agent-consumption-model.md): **agent-readable is not
agent-writable**. This surface enforces it mechanically.

### `field.forAgent({ capabilities, redactions? }): AgentFieldView`

`forAgent` derives a **read-only facade** over the same live field, scoped to a set of capabilities. The
facade exposes **only** scoped `query()` / `snapshot()` (and `replay()` **only** when `read:replay` is
granted). It has **no** mutation methods — no `applyForce`, no `addBody`, no `setPolicy` — and that is
enforced by the facade's *shape*, not a runtime check: there is nothing on it to call.

```ts
type AgentCapability =
  | 'read:metrics' | 'read:relationships' | 'read:influences' | 'read:snapshots'
  | 'read:body-data' | 'read:projections' | 'read:diagnostics' | 'read:replay';

interface AgentViewOptions { capabilities: AgentCapability[]; redactions?: string[]; }
interface AgentFieldView {
  readonly capabilities: readonly AgentCapability[];
  readonly redactions: readonly string[];
  query(q?: FieldQuery): FieldQueryResult;
  snapshot(opts?: FieldSnapshotOptions): FieldSnapshot;
  replay?(a: FieldSnapshot, b: FieldSnapshot, opts?: ReplayOptions): CausalReplay; // only when read:replay
}
```

**Capabilities are an allow-list — they tighten, never widen.** A dimension the caps don't grant is
stripped from every reading: no `read:influences` → `influences` empty; no `read:relationships` →
`relationships` empty; no `read:projections` → `projections` empty; no `read:body-data` → each body's
opaque `data` is withheld **even if** a profile or `includeData` asked for it. Base identity (ids + shape)
is always readable — an agent must at minimum be able to name what it sees.

**`redactions?: string[]`** are dotted paths stripped from every reading **after** capability scoping:
`'body.data'` (per-body), `'metrics.temperature'` (a metric key), `'host.user'`, or a bare top-level key.

```ts
const view = field.forAgent({ capabilities: ['read:metrics', 'read:relationships'], redactions: ['metrics.temperature'] });
view.query();            // metrics + relationships only, temperature stripped; no influences, no body.data
view.snapshot({ profile: 'agent' });   // scoped + profiled + policy-gated, resolved to the tightest
```

### Snapshot profiles — `FieldSnapshotOptions.profile`

A **profile** is a named inclusion preset for `snapshot()`, so a caller doesn't hand-assemble `include*`
flags for a common shape:

| Profile | Includes | Withholds |
|---|---|---|
| `'debug'` | everything (particles, relationships, influences, body `data`) | — (data still gated by policy) |
| `'agent'` | ids + metrics + relationships + influence attribution + projections | opaque body `data`, raw particles |
| `'bug-report'` | structural + versions (relationships + influences) | user data |
| `'public'` | ids + shape (bodies, metrics, projections) | relationships, influences, data |

Profiles **compose** with the explicit `include*` flags and the `FieldPolicy` privacy budget, and always
resolve to the **tightest (most private)** result: a profile can only tighten a call, an explicit `true`
can never re-enable what the profile turned off, and neither a profile nor an agent view can ever widen
past what policy already permits. `snapshot({ profile: 'agent', includeData: true })` still withholds
`data` — the profile's deny wins.

### Respecting `FieldPolicy`

The agent surface honours the runtime [`FieldPolicy`](#) privacy + budget model directly. A privacy
budget below the threshold (or `allowBodyDataInSnapshots: false`) withholds body `data` regardless of the
agent's caps. And `budgets.agentRead` gates the surface itself: **`agentRead === 0` closes it** — `forAgent`
yields the most-restricted view (ids + shape only, snapshots fall to `public`). The fractional
`0 < agentRead < 1` gradient (partial agent read) is a **declared seam** — carried on the policy, wired as
its consumer lands.

---

## Causal Replay — `replay(a, b, opts?): CausalReplay`

Explain *how* the field changed between two snapshots — an ordered, narrated sequence of causes,
derived purely from the diff (it reads the two snapshots; it does not re-run the sim).

```ts
type CausalCause = 'force' | 'relationship' | 'metric' | 'formation' | 'measurement';
interface CausalReplayStep {
  frame: number; time: number; cause: CausalCause;
  source?: string; target?: string;       // body id, or a relationship's endpoints
  description: string;                      // human-readable account (lane: diagnostic)
  contribution?: unknown;                   // structured before/after, e.g. { from, to }
}
interface CausalReplay { from: string; to: string; focus?: string; steps: CausalReplayStep[]; }
```

```ts
const story = field.replay(a, b, { focus: 'claim-3' });
story.steps.forEach((s) => console.log(s.description));
// "Formation 'wells' activated" · "Relationship A→B strengthened 0.10→0.40" · "Body claim-3 density rose 0.20→0.60"
```

`cause: 'force'` steps are only emitted when both snapshots were captured with `includeInfluences`.
The standalone `replayFieldSnapshots(a, b, opts)` is also exported.

---

## Projection Registry — `field.projections` (a property)

A projection is a named mapping from field **state** to an output surface (CSS, a DOM attribute, an
annotation, agent-readable JSON, sound, haptic, a reduced-motion equivalent, …). It declares the
channels it reads and the surfaces it writes, and — critically — it **never changes field state**.

**Projection purity — the doctrine (a `lintProjections`-style contract):**

```txt
A projection MAY read field state.
A projection MAY write to its declared output surface.
A projection MAY NOT mutate bodies.
A projection MAY NOT create couplings.
A projection MAY NOT alter metrics.
A projection MAY NOT change relationship strength.
A projection MUST declare its accessibility behavior (reduced-motion / static equivalent).
```

This is the guardrail behind *"projection reveals state; coupling changes state"* — a projection that
writes back into the field is a coupling wearing a projection's clothes, and the "haunted field"
failure mode (state appears to change through a reveal) is exactly what it prevents. A **lens** is the
read-side twin: a lens is *how the field is read*; a projection is *how the field is revealed*.

```ts
interface ProjectionRegistry {
  register(p: FieldProjection): () => void;   // returns an unregister fn (replaces same id)
  unregister(id: string): void;
  get(id: string): FieldProjection | undefined;
  list(): FieldProjectionInfo[];              // serializable metadata (no apply)
  apply(id: string, reading: Record<string, number>, target: FieldProjectionTarget): void;
  bind(id: string, target: FieldProjectionTarget,
       source: ProjectionSource): () => void; // auto-apply each write phase; returns an unbind fn
  lint(): GovernanceWarning[];                // accessibility governance over the registry
}
```

**Write-phase auto-apply.** `apply()` is a one-shot manual write; `bind()` ties a projection to a target
plus a live `ProjectionSource` (`() => Record<string, number>`) and the field re-applies it **once per
write phase** (right after feedback), read-only w.r.t. the field. Multiple bindings — even of the same
id — coexist; `bind()` returns an unbind fn; binding an unknown or `apply`-less id is inert.

**The `agent-json` surface.** For agent / tooling consumers, `agentJsonProjection(id, channels, opts?)` is
a projection whose output is a serializable reading rather than a visual write, and `agentJsonTarget()` is
the sink it writes into — `value()` returns the last reading, `json()` serializes it. Bind the two for a
live, JSON-serializable view of any channels:

```ts
import { agentJsonProjection, agentJsonTarget } from '@fundamental-engine/core';
const out = agentJsonTarget();
field.projections.register(agentJsonProjection('agent', ['density', 'attention']));
field.projections.bind('agent', out, () => field.query().metrics as Record<string, number>);
// each frame: out.value() → { density, attention }, out.json() → '{"density":…}'
```

```ts
field.projections.register({
  id: 'confidence-weight', label: 'Confidence → font weight',
  channels: ['confidence'], surfaces: ['css', 'typography'],
  reducedMotionEquivalent: 'static weight step',
  accessibilityEquivalent: 'aria-description of confidence',
  apply: (r, t) => t.style?.setProperty('--weight', String(400 + r.confidence * 500)),
});
field.projections.lint();   // → GovernanceWarning[] for any motion projection lacking a reduced-motion path
```

`lint()` flags accessibility gaps as `GovernanceWarning`s (`field/reduced-motion-equivalent-required`
= error, `field/accessibility-equivalent-required` = warning); the standalone `lintProjections()` is
also exported. `query()` and `snapshot()` report the registered projections as metadata.

### Governance lints — keeping the naming lanes and coupling honest

Two more pure lints ship alongside the projection one, enforcing the naming/coupling doctrine mechanically
(both return `GovernanceWarning[]`, both run with no live field):

- **`lintWordLanes()`** (`field/no-word-in-two-lanes`) — the naming canon's *"no word lives in two lanes"*
  rule made mechanical. `LANE_WORDS` indexes the shipped vocabulary by lane from the source-of-truth
  catalogs (`force` tokens, `formation` ids, `condition` keywords, `visualization` modes); `laneOf(word)`
  resolves a word. Returns `[]` today — the catalogs are disjoint — so it guards future drift. (Design
  notes: `render`+`diagnostic` are one `visualization` lane; a `metric` lane is deferred.)
- **`lintDimensionCoupling()`** (`field/no-dimension-coupling-without-passport`) — a force that *couples*
  dimensions must declare it in its passport's `couplesDimensions` (the coupling passport,
  [dimensional-coupling.md](dimensional-coupling.md)). Keys off `conservesSpeed` (a speed-conserving mover
  necessarily redirects velocity): `wall`/`magnetism`/`warp` declare `['linear']`, so the lint returns `[]`
  and guards drift (an undeclared coupler, or a typo'd/invalid lane, errors).

---

## Body authority + dynamic recoil — `data-authority` / `Body.authority`

Who owns a body's position. Anchored and kinematic behave exactly as before; `dynamic` lets the engine
own position and integrate the body under the net field — the body recoils.

```ts
type BodyAuthority = 'anchored' | 'kinematic' | 'dynamic';
```

| Mode | Who owns position | Behavior |
|---|---|---|
| `anchored` (default) | the DOM/host rect | re-measured each frame — today's behavior for all bodies |
| `kinematic` | the engine writes the visual transform | the shipped `data-move` / transform pattern |
| `dynamic` | the engine owns position + velocity | the body integrates under the net field each frame and **moves** (recoil / field-to-body coupling) |

```html
<section data-body="charge" data-authority="dynamic">recoils under the field</section>
```

A `dynamic` body's engine-owned state lives on `Body.bx/by/bvx/bvy`, lazily seeded from its first
measured centre. Authority is reported on every `query()`/`snapshot()` body reading. (Literal
momentum-recoil from a body's own emission, torque, and conservation are later refinements.)

---

## Integrator modes — `createField({ integrator: 'fixed' })`

The integration scheme. `'legacy'` (default) is the shipped semi-implicit Euler with per-frame decay.
`'fixed'` opts into a **partially** frame-rate-corrected integrator: the per-step decays
(`FRICTION`/`HEAT_DECAY`) scale with `dt`, so damping is consistent across frame rates. By design it
does **not** yet dt-scale force impulses — the single-particle rescale trick is unsound for forces that
also mutate a neighbour in the same pass (`collide`/`link` apply an equal-and-opposite impulse the path
can't see), so frame-rate-correct impulses wait for the force-contract change where every contribution
flows through the accumulator (see `packages/core/src/engine/integrator.ts` `applyForce`, doc-04 §Step 3).

```ts
type IntegratorMode = 'legacy' | 'fixed';
const field = createField(canvas, { host, integrator: 'fixed' });
```

At the reference frame rate (`dt === 1` — every golden/conformance run) the two are **byte-identical**,
so opting in never moves the golden.

---

## Accumulator channels — `Env.accum: FieldImpulseAccumulator`

The dimension-aware impulse accumulator is the unit `query`/`replay` and the diagnostics consume:
*"this matter moved 0.42 in linear x because of `attract`."* It is **opt-in** — absent on the default
hot path (zero overhead, byte-identical behavior); a diagnostic/Query probe sets it to read structured
per-force attribution. Setting `accum` never alters how matter moves (read-only contract).

```ts
interface FieldImpulseAccumulator {
  linear: { x: number; y: number; z: number };   // running net Δv
  angular?: { x: number; y: number; z: number };  // per-force spin (about z) — populated when a force writes Particle.spin
  thermal?: number;                                // per-force heat change (populated)
  temporal?: { delay?: number; decay?: number; phase?: number };  // reserved
  semantic?: Record<string, number>;               // reserved
  attribution: ForceAttribution[];                 // per-force breakdown — preserves explainability
}
interface ForceAttribution {
  force: Token;
  channel: 'linear' | 'angular' | 'thermal' | 'temporal' | 'semantic' | 'constraint';
  contribution: { x: number; y: number; z: number } | number;
  couplesDimensions?: string[];   // the coupling passport
}
```

Today the `linear`, `thermal`, `angular`, `temporal`, and `semantic` channels (and the per-force `attribution`) are populated (`angular` only when a force gives a particle `spin` — opt-in `Particle.orient`/`spin`); the
remaining optional channels are declared now so the contract does not assume all force is `vx/vy` —
they are filled when those dimensions (orientation, time, semantic) are restored (see
[phase-2-frontier](../planning/critical-path/phase-2-frontier.md)). This is why a
`FieldInfluenceReading` carries a `channel`: a reader written before the thermal channel defaults to
`'linear'`.

---

## Runtime Field Policy + Budgets — `createField({ policy })` · `setPolicy(p)` · `field.policy`

**Policy is a different lane from governance.** *Governance* is what **doctrine allows** — static, lint,
authored (see the projection `lint()` above). *Policy* is what **THIS host / session / user / app
permits** at runtime. They must not be conflated: a governance lint never reads a policy, and a policy
never relaxes a governance rule.

*Budgets* bound **consumable field resources** — an upper limit on what the field is *permitted to
spend* this run.

```ts
interface FieldBudgets {
  motion?: number;        // 0..1 — WIRED. cap on expressed motion; 0 behaves as reduced-motion
  force?: number;         // 0..1 — declared. cap on applied force magnitude
  attention?: number;     // 0..1 — declared. cap on conserved-attention spend (§2.4)
  thermal?: number;       // 0..1 — declared. cap on heat accumulation
  render?: number;        // 0..1 — declared. cap on render cost (draw layers / fill)
  privacy?: number;       // 0..1 — WIRED. below 0.5 → snapshots withhold body data
  accessibility?: number; // 0..1 — declared. minimum non-motion legibility floor
  agentRead?: number;     // 0..1 — declared. cap on field state agent readers may consume
}

interface FieldPolicy {
  allowBodyDataInSnapshots?: boolean; // permit body `data` in snapshot() (default: fall through to includeData)
  allowMotionProjection?: boolean;    // false → effective motion pinned to 0
  maxMotionBudget?: number;           // 0..1 host/session motion cap
  budgets?: Partial<FieldBudgets>;
}
```

```ts
const field = createField(canvas, { host, policy: { maxMotionBudget: 0.5 } });
field.setPolicy({ allowMotionProjection: false }); // REPLACE, not merge — pass the whole policy you want
field.policy;                                       // a frozen copy ({} when none was ever set)
```

**Wired budgets (enforced today):**

- **`motion` / `maxMotionBudget` / `allowMotionProjection`** — folded (via `min`) with host/user
  reduced-motion **and** performance pressure into **one effective motion allowance** the
  integrator/easing path reads. `maxMotionBudget: 0` (or `allowMotionProjection: false`) freezes matter
  exactly as reduced-motion does; a partial budget slows displacement-per-second proportionally.
  **Reduced-motion always wins** — accessibility can only *lower* motion, never raise it, so a permissive
  policy cannot override a reduced-motion host.
- **`privacy` / `allowBodyDataInSnapshots`** — gates body `data` in `snapshot()`. An explicit
  `allowBodyDataInSnapshots: false`, or a `privacy` budget below `0.5`, withholds body `data` **even when
  the caller passes `includeData: true`**. Policy *tightens* the call-site privacy default; it never
  widens it.

**Declared-not-yet-enforced:** `force`, `attention`, `thermal`, `render`, `accessibility`, `agentRead`
are accepted and carried on the policy (readable via `field.policy`) for host/tooling introspection, and
will be wired as their consumers land. `setPolicy` is a **replace** (not a merge): pass the full policy
you want in effect; `{}` clears to the unbounded default. Purely additive — a field with no policy
behaves exactly as before.

---

## Status & relation to the protected surface

| Capability | Surface | Status |
|---|---|---|
| `query(q?)` | `FieldHandle` | shipped-unfrozen · EXPERIMENTAL |
| `snapshot(opts?)` / `diff(a,b)` | `FieldHandle` (+ `diffFieldSnapshots`) | shipped-unfrozen · EXPERIMENTAL |
| `replay(a,b,opts?)` | `FieldHandle` (+ `replayFieldSnapshots`) | shipped-unfrozen · EXPERIMENTAL |
| `forAgent(opts)` + snapshot `profile` | `FieldHandle` / `AgentFieldView` / `FieldSnapshotOptions` | shipped-unfrozen · EXPERIMENTAL |
| `projections` registry + `lint` | `FieldHandle.projections` (+ `lintProjections`) | shipped-unfrozen · EXPERIMENTAL |
| Body authority + dynamic recoil | `data-authority` / `Body.authority` | shipped-unfrozen · EXPERIMENTAL |
| Integrator `'fixed'` | `createField({ integrator })` | shipped-unfrozen · EXPERIMENTAL |
| Accumulator channels | `Env.accum` / `FieldImpulseAccumulator` | shipped-unfrozen · EXPERIMENTAL |
| Runtime policy + budgets | `createField({ policy })` · `setPolicy` · `field.policy` | shipped-unfrozen · EXPERIMENTAL (motion + privacy budgets wired; others declared) |

None of these are on the protected list ([api-stability.md](api-stability.md)). They are present in the
package and safe to use, but carry **no** stability guarantee until explicitly added to the stable
table. The substrate API is JS-first; native-plane (`swift/`, `android/`) parity is tracked separately.

## Related documents

| Document | Role |
|---|---|
| [`agent-consumption-model.md`](agent-consumption-model.md) | How an agent reads the field — `query()`/`snapshot()` are its structured surface |
| [`dimensional-coupling.md`](dimensional-coupling.md) | The doctrine behind projections, body-authority modes, and the accumulator's dimension channels |
| [`visualization-methods-taxonomy.md`](visualization-methods-taxonomy.md) | The drawn/diagnostic lane — `query`/`replay` are its render-free sibling |
| [`api-stability.md`](api-stability.md) | The freeze contract — why this whole surface is experimental |
| [`forces-system.md`](../engine-reference/forces-system.md) | The engine spec — §13 the `FieldHandle`, §22 agent consumers |
