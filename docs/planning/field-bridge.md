> **Status: frontier — not built; constraints locked before implementation.**
> A **field bridge** connects multiple field roots — several `<field-root>`s on one page, two apps
> sharing state, or a local field talking to a remote one. Nothing here is shipped. This doc exists to
> lock the *rules* before any code lands, so the first implementation is not free to invent an unsafe
> topology. It follows the [status rule](../canonical/documentation-standards.md): nothing is called
> shipped, and the terminology locks (association≠coupling, Field Pattern, projection purity, Field
> Agent vs Software Agent) are the canon this bridge must obey.

# Field bridge (multi-root / cross-app / remote)

Today a field is a closed world: one root, one field space, one authority over its bodies. A **field
bridge** would let two or more field roots participate in each other — the obvious cases are multiple
`<field-root>`s coordinating on a page, one app reading another's field, and a local field connected to
a remote one over a transport. Every one of those is a chance to smear authority, mutate a field you
don't own, or collide two roots' ids. The five constraints below each close one specific failure. They
build directly on the substrate read API ([substrate-api.md](../canonical/substrate-api.md)) and the
coordinate-space discipline ([coordinate-spaces.md](../canonical/coordinate-spaces.md)) — a bridge is
those two contracts extended across a root boundary, not a new physics.

## Constraint 1 — a bridge shares READINGS, not raw authority

**Rule.** By default a bridge carries only the substrate *read* surface across the boundary —
`query()` / `snapshot()` results, projection metadata — never the live bodies or the ability to apply a
force. What flows over a bridge is plain, serializable data, exactly what
[substrate-api.md](../canonical/substrate-api.md) already guarantees is read-only and render-agnostic.

**Failure it prevents — spaghetti authority.** If a bridge handed root B a live handle to root A's
bodies, "who owns this body's position" would depend on which root reached across last frame. Authority
([substrate-api.md](../canonical/substrate-api.md) — `anchored`/`kinematic`/`dynamic`) is a
*single-root* property: each body has exactly one owner. Sharing readings keeps that intact — B learns
what A's field is doing without ever becoming a second author of it. `query()` already promises it "does
NOT mutate the field"; the bridge is where that promise crosses the wire.

## Constraint 2 — a remote field cannot MUTATE a local field without a declared, permissioned action

**Rule.** Reading is free; writing is not. A remote (or sibling) field may never call `apply()`, move a
body, or change a metric on a local field *implicitly*. Any cross-root write must go through a **declared,
permissioned action** — an explicit capability the local root granted, named, and scoped, that the local
root executes against its own field. The remote side requests; the local side decides.

**Failure it prevents — silent remote mutation.** Without this, a bridge becomes a remote-code channel
into your field: any connected peer could perturb your bodies and you would see motion with no local
cause. This is the same guardrail as projection purity ([substrate-api.md](../canonical/substrate-api.md):
*projection reveals state; coupling changes state*) — a bridge that writes without a declared action is a
coupling wearing a bridge's clothes, and produces the "haunted field" (state changing with no visible
cause) across a root boundary instead of within one. Agent-readable is not agent-writable; **bridge-
readable is not bridge-writable.**

## Constraint 3 — cross-field relationships are ASSOCIATIONS by default; coupling requires a declared bridge Field Pattern

**Rule.** A relationship drawn *across* the bridge (body `card-3` in root A relates to body `claim-7` in
root B) is an **association** by default — it records that the two are related and can be read, but it
does not make either field push the other. Turning a cross-field association into **coupling** — where A's
state actually bends B — requires a declared **bridge Field Pattern** (a Field Pattern, in the
authoring lane; see the terminology locks in
[documentation-standards.md](../canonical/documentation-standards.md)), authored explicitly and subject
to Constraint 2's permission.

**Failure it prevents — phantom coupling.** *Association ≠ coupling* is a canon lock precisely because the
two look identical until something moves. If cross-field relationships coupled by default, merely
*observing* that two bodies in different roots are related would start transmitting force between roots —
action at a distance nobody authored. Keeping the default at association means a bridge can express rich
cross-root structure (for a Software Agent to read) while force stays contained to whichever root
declared a Pattern to carry it. (Note the lane: particles and bodies are **Field Agents**; the tool
reading across the bridge is a **Software Agent** — it reads Field Agents, it does not become one.)

## Constraint 4 — snapshots crossing a bridge MUST preserve field identity + body identity

**Rule.** Every snapshot, query result, or relationship reading that crosses a bridge must carry enough
identity to be unambiguous on the far side: the **field root's identity** *and* each body's
`FieldBodyIdentity.id`, disambiguated by `namespace` and `host` so two roots' bodies never blur together.
A bridge reading is keyed on `identity.id` scoped to its origin root — never on a bare `id` that means
different things in different roots.

**Failure it prevents — id collisions across roots.** `FieldBodyIdentity`
([substrate-api.md](../canonical/substrate-api.md)) makes ids stable *within a field* — the engine even
derives a deterministic `body-N` when none is supplied. But `body-3` in root A and `body-3` in root B are
*different bodies with the same string*. Across a bridge, keying on the bare id silently merges them: a
diff would report phantom "changes," a replay would narrate one body's history onto another. The
`namespace`/`host` fields on `FieldBodyIdentity` exist for exactly this — a bridge must qualify every id
with its origin root so `(root, namespace, id)` is globally unique. Field identity is the outer key; body
identity is the inner one.

## Constraint 5 — coordinate spaces do not transit raw; a bridge maps between them explicitly

**Rule.** Field-space coordinates from root A are **meaningless** in root B and must never be used as-is.
Each root has its own field space ([coordinate-spaces.md](../canonical/coordinate-spaces.md): *field
space is the hub* — but it is *that root's* hub). A bridge that needs to relate positions across roots
must declare an explicit mapping between the two field spaces, the same way an adapter explicitly
converts host space → field space. There is no shared world; there is A's field space, B's field space,
and a named conversion between them.

**Failure it prevents — coordinate drift.** [coordinate-spaces.md](../canonical/coordinate-spaces.md)
already warns that conversions are one-way and do not compose into a trustworthy round trip; a bridge
that assumed "a point is a point" would inherit every one of those errors *and* stack two roots' DPR,
bounds, and origin differences on top. Two roots may be different sizes, different hosts (a DOM root and
a native root), even different dimensionality (2D vs a Three.js 3D root). Treating A's `{x, y}` as valid
in B produces a field that looks aligned and is quietly, accumulatively wrong. The bridge mapping is the
explicit, named conversion that keeps each root's field space its own.

## What a bridge is, restated

```txt
A bridge SHARES readings (query/snapshot data), not raw authority.
A bridge does NOT let a remote field mutate a local field — only a declared, permissioned action does.
A bridge's cross-field relationships are ASSOCIATIONS; coupling needs a declared bridge Field Pattern.
A bridge PRESERVES field identity + body identity (id + namespace/host) across roots.
A bridge MAPS between field spaces explicitly; it never assumes shared coordinates.
```

Each line is one root-boundary version of a contract Fundamental already enforces inside a single field:
read-only reads, projection purity, association≠coupling, stable identity, and one-way coordinate
conversions. The bridge does not relax any of them — it carries them across the seam between roots.

## Related documents

| Document | Role |
|---|---|
| [`substrate-api.md`](../canonical/substrate-api.md) | The read surface a bridge carries — `query`/`snapshot`/`diff`/`replay`, `FieldBodyIdentity`, projection purity |
| [`coordinate-spaces.md`](../canonical/coordinate-spaces.md) | Why each root's field space is its own; the one-way conversions a bridge must respect |
| [`documentation-standards.md`](../canonical/documentation-standards.md) | The terminology locks — association≠coupling, Field Pattern, Field Agent vs Software Agent |
