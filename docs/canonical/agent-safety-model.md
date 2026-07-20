> **Status: canonical.**
> The authoritative statement of the safety/governance model for **Software Agents** and other
> consumers that *read* a field — the **Govern** verb of the substrate (Declare → Influence → Read
> → Reveal → **Govern**). It is an overview: the mechanisms and their code live in
> [`substrate-api.md`](substrate-api.md), which this doc links outward to. That surface is **shipped
> and code-confirmed but EXPERIMENTAL / unprotected** (0.x) — it may change; it is not part of the protected
> stable baseline.

# The agent safety model — the Govern verb

Fundamental is an inspectable relational substrate. The host owns domain truth; Fundamental owns the
relational **field state**; **policy decides what field state may be read, by whom.** Govern is the
verb that draws that line. An agent can be handed a window onto a live field and learn its shape,
metrics, relationships, and influence attribution — without ever being able to change it, and without
seeing what it was not granted.

Three invariants are load-bearing. Everything else is a mechanism that upholds one of them.

## The three invariants

**1. Agent-readable does NOT imply agent-writable.**
`field.forAgent({ capabilities, redactions })` returns a **read-only** `AgentFieldView`: it exposes
only scoped `query()` / `snapshot()` (and `replay()` only when `read:replay` is granted). There is no
`applyForce`, no `addBody`, no `setPolicy` — not blocked by a runtime check, but absent from the
facade's *shape*. Its `capabilities` and `redactions` are returned frozen, and `field.policy` hands
back a frozen clone, so a holder of a view (or of the policy) can inspect the rules but cannot mutate
the live field or the live policy. An agent view exposes **readings, never mutation.**

**2. Snapshots exclude opaque / private data by default.**
Snapshot profiles resolve to the **tightest** inclusion. The `agent` and `public` profiles withhold
per-body opaque `data` (`body.data`); you must explicitly opt in — the `debug` profile **and**
`includeData: true` — to obtain it, and even then the field's own privacy policy still applies.
Capabilities are an allow-list that only tightens: without `read:body-data`, opaque `data` is withheld
even if a profile or `includeData` asked for it. **Redactions** then strip dotted paths (e.g.
`body.data`, `metrics.bodies`) from every reading, *after* capability scoping. Opting **in** widens;
nothing an agent asks for can widen past what policy already permits.

**3. Projection mutation is forbidden.**
A **projection reveals** field state through an output surface (CSS, a DOM attribute, agent-readable
JSON, a reduced-motion equivalent, …). It **MAY NOT** mutate bodies, create couplings, alter metrics,
or change relationship strength. *Projection reveals state; coupling changes state* — a reveal that
writes back into the field is a coupling wearing a projection's clothes, and is out of contract. This
keeps the read/reveal path incapable of becoming an influence path behind the reader's back.

> Lane discipline (do not blur): **projections reveal · forces couple · relationships associate ·
> policy limits.** No word crosses lanes.

## The mechanisms (each upholds an invariant above)

Each is a one-line summary; the detailed contract, types, and examples are in `substrate-api.md`.

- **Capabilities allow-list** — an agent view is scoped to explicit `read:*` grants; ungranted
  dimensions are stripped from every reading (identity/shape is the base grant). Tightens, never
  widens. → [Agent permissions + snapshot profiles](substrate-api.md#agent-permissions--snapshot-profiles)
- **Redactions** — dotted paths (`body.data`, `metrics.bodies`, …) removed from every reading *after*
  capability scoping. → [Agent permissions + snapshot profiles](substrate-api.md#agent-permissions--snapshot-profiles)
- **Snapshot profiles** — `public` / `agent` / `debug` resolve to the tightest inclusion; opaque
  `data` is opt-in, never default. → [Snapshot + Diff](substrate-api.md#snapshot--diff--snapshotopts-fieldsnapshot--diffa-b-fielddiff)
- **FieldPolicy + budgets** — the live, replaceable policy that limits what may be read; a closed
  `budgets.agentRead` collapses the agent surface to ids + shape only. Returned as a frozen clone.
  → [Runtime Field Policy + Budgets](substrate-api.md#runtime-field-policy--budgets--createfield-policy---setpolicyp--fieldpolicy)
- **Projection purity** — the `lintProjections`-style contract that keeps reveals from mutating the
  field. → [Projection Registry](substrate-api.md#projection-registry--fieldprojections-a-property)

## Related

- [`substrate-api.md`](substrate-api.md) — the shipped substrate read API and every mechanism above, in full.
- [`agent-consumption-model.md`](agent-consumption-model.md) — how different consumers read one influence differently.
- [`api-stability.md`](api-stability.md) — the freeze contract; why this surface is EXPERIMENTAL, not frozen.
