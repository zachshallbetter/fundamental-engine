> **Status: canonical.**
> The lifecycle a body passes through — from declaration to removal — stated for **programmatic /
> non-DOM bodies** (added via `addBody`, e.g. on a headless [`MinimalFieldHost`](platform-architecture.md),
> or over data records), so non-DOM usage is *official*, not bolted on. DOM bodies have this same
> lifecycle *implicitly* (the scanner runs it); this doc makes it explicit for bodies with no element to
> rescan. Follows the [status rule](documentation-standards.md): nothing here is called shipped unless
> code confirms it (`packages/core/src/core/types.ts` — `BodySpec`/`BodyHandle`; `field.ts` — `addBody`).

# Body lifecycle

A **body** is any element or object that becomes a participant in the field — it bends the field, and
the field's local density bends it back (reciprocity). The engine imports zero DOM, so a body is never
*intrinsically* a DOM node: the DOM adapter is one way bodies enter the field, and `addBody` is another.
Both produce the same kind of participant and pass through the same lifecycle.

> **Terminology (locked, see [documentation-standards.md](documentation-standards.md)):** a *data body*
> is a body whose host object is a semantic record (a claim / task / file); `body.data` is opaque
> metadata attachable to *any* body — attaching `data: {…}` does not by itself make a body a data body.

## The general lifecycle

Every body — DOM or programmatic — moves through seven phases:

| Phase | What happens |
|---|---|
| **declare** | The body is introduced to the field and given a stable [identity](substrate-api.md#query--queryq-fieldqueryresult). DOM: discovered by the scanner from `[data-body]`. Programmatic: `field.addBody(spec)` returns a `BodyHandle`. |
| **measure** | The body's box is resolved in **field space**. DOM: `getBoundingClientRect()` each rescan. Programmatic: the supplied `rect()` thunk is sampled each frame. |
| **participate** | The body's tokens emit force into the field — it bends the field (`sample(x, y)` near it reads a force toward/around it). |
| **receive** | Reciprocity: the field's local density is written back to the body as feedback channels (`--load`, `--field-*`, `--d` on a DOM body; the `onFeedback` callback / `handle.channels` on a programmatic one). |
| **project** | Body state is *revealed* through a registered [projection](substrate-api.md#projection-registry--fieldprojections-a-property) — CSS, a DOM attribute, agent-readable JSON. A projection reveals; it never writes back into the field. |
| **snapshot** | The body is captured — `query()` reads it live; `snapshot()`/`diff()`/`replay()` capture and compare it across frames. All key on the body's stable `identity.id`. |
| **remove** | The body leaves the field. DOM: the scanner drops it when the element leaves the tree on the next rescan. Programmatic: `handle.remove()` — after which it exerts no force. |

`participate` → `receive` repeat every frame for the body's whole life; `project` and `snapshot` are
read-side taps that never mutate the body. `declare` and `remove` are the endpoints.

## The data / headless-host variant

The same lifecycle, told over a **data record** on a headless host (no canvas, no DOM — the
[`MinimalFieldHost`](platform-architecture.md) floor of geometry + time is enough):

1. **record enters the field** — a semantic record (claim / task / file / mesh) is declared as a body via
   `addBody`, carrying the record on `spec.data` and a stable `identity`.
2. **rect / provider resolves** — the body has no element, so it supplies its own geometry: `spec.rect()`
   is a thunk the host projects its record/mesh/view position through, sampled each frame.
3. **relationships attach** — edges between bodies (`addEdge`) key on identity, so a data body wires to
   others by `identity.id`, not by object reference.
4. **metrics update** — the body participates and receives: its per-body feedback arrives on the
   `onFeedback` callback (or `handle.channels`), demultiplexed from the global sink.
5. **query reads** — a software agent reads the live body through `query()` (identity, rect, tokens,
   metrics, authority) — read-only; reading never changes the field.
6. **snapshot captures** — `snapshot()` freezes the body (opt into `includeData` to carry its record);
   `diff()`/`replay()` narrate how it changed, all keyed on `identity.id`.
7. **body leaves the field** — `handle.remove()` retires it; the record's field participation ends.

```ts
const claim = field.addBody({
  tokens: ['attract'],
  identity: { id: 'claim-3', namespace: 'evidence', kind: 'claim' },
  rect: () => projectRecordBox(record),   // record → field space, sampled each frame
  data: record,                            // the semantic host object → a *data body*
  onFeedback: (ch) => applyDensityToRecord(record, ch),
});
// …live for many frames: query()/snapshot() read it by identity…
claim.remove();                            // record leaves the field
```

## Identity is assigned at declare, and MUST be stable for the whole life

Identity is a **first-class, structured key** — not display text, not an object reference:

```ts
interface FieldBodyIdentity {
  id: string;          // stable primary key — unique in the field, constant for the body's life
  namespace?: string;  // optional grouping (app/module); opaque to the engine
  kind?: string;       // optional type tag ('card', 'claim', 'agent'); opaque
  host?: string;       // optional owner tag; opaque
}
```

It is fixed at **declare** and must not change through `measure`/`participate`/`receive`/`project`/
`snapshot`/`remove`, because **`snapshot`/`diff`/`replay` and relationships all key on `identity.id`**.
If the id shifted mid-life, a diff would read as *remove old + add new* and causal replay would lose the
thread. Rules:

- **Supply it at declare.** `addBody({ identity })` takes a `FieldBodyIdentity` (a bare string is
  shorthand for `{ id }`). This is the norm for data bodies — the record already has a stable key.
- **Or let the engine derive one — deterministically.** With no supplied identity the engine assigns a
  stable synthetic id (a monotonic `body-N`, **never** `Math.random`), so identity is always present.
- **Words are not identity.** A claim's text can change while its identity holds; a DOM `id` is one
  *source* of a stable id, not the concept itself.

Full contract: [substrate-api.md → identity](substrate-api.md#query--queryq-fieldqueryresult).

## DOM body vs synthetic / data body

The lifecycle is identical; the **measure** phase is where the two diverge:

| | **DOM body** | **Synthetic / data body** |
|---|---|---|
| Enters via | the scanner, from `[data-body]` | `field.addBody(spec)` → `BodyHandle` |
| Geometry source | measured from the element (`getBoundingClientRect`) each rescan | the supplied `rect()` thunk, sampled each frame — **no element to rescan** |
| Coordinate origin | host (DOM) space, mapped to field space by the adapter | the caller supplies geometry directly; a non-DOM host projects its own space → field space (see [coordinate-spaces.md](coordinate-spaces.md)) |
| Feedback delivery | CSS vars on the element (`--load`, `--field-*`, `--d`) | `onFeedback(channels)` callback / `handle.channels` |
| Survives a rescan? | re-discovered if still in the tree; dropped when it leaves | **yes** — programmatic bodies are invisible to the DOM scan; only `handle.remove()` retires one |
| Live param edits | via reactive `data-*` attributes | `handle.set({ strength, range, angle, spin, color })` — no rescan |

A DOM body is *re-measured from its element* every rescan, so the element is the position authority. A
synthetic body has **no DOM to rescan** — its `rect()` thunk is the sole position source, which is exactly
why a headless host (mesh, native view, or a bare data record) can be a full field participant. Both are
subject to [body-authority modes](substrate-api.md#body-authority--dynamic-recoil--data-authority--bodyauthority):
`anchored` (rect authoritative), `kinematic` (engine writes the transform), or `dynamic` (engine owns
position and the body recoils under the net field).

## Related documents

| Document | Role |
|---|---|
| [`platform-architecture.md`](platform-architecture.md) | `MinimalFieldHost` — the geometry+time floor a headless body runs against |
| [`substrate-api.md`](substrate-api.md) | `FieldBodyIdentity`, `query`/`snapshot`/`diff`/`replay`, body authority — the read surface the lifecycle feeds |
| [`coordinate-spaces.md`](coordinate-spaces.md) | Host space vs field space — where a synthetic body's supplied geometry is resolved |
| [`documentation-standards.md`](documentation-standards.md) | The terminology locks — *data body* vs `body.data`, *Field Agent* vs *Software Agent* |
