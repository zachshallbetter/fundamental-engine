> **Status: canonical concept.**
> The one-page mental model of Fundamental as a substrate. It is a **map, not a manual** — each
> verb links to the authoritative document that specifies it. Read this first, then follow the link.
> The status rule and framing policy live in [documentation-standards.md](documentation-standards.md).

# The substrate, in five verbs

Fundamental is a platform-native relational field runtime; the DOM is its first host, not its
boundary. Treated as a **substrate**, the field is something you *declare* into, that *influences* its
members, that you can *read*, *reveal*, and *govern*. Those five verbs are the whole loop — everything
else is a detail of one of them.

## Declare

Host objects become **bodies** in the field. On the DOM the contract is `data-body="…"`; off the DOM a
host implements `MinimalFieldHost` and gives each body a stable `FieldBodyIdentity`, added via `addBody`
and related with `addEdge`. A body carries meaning (semantic HTML stays the source of truth) and a
position; declaring it is what lets the field act on it and read it back. Identity is stable across the
body's life, so a snapshot taken now still names the same body later.

See [host-model.md](host-model.md) (the host adapter contract — `MinimalFieldHost`, the capability
ladder, and how non-DOM / headless / native hosts stay first-class), [body-lifecycle.md](body-lifecycle.md)
(declare → measure → participate → remove; DOM vs synthetic bodies), and
[system-contracts.md](system-contracts.md) (the body/field/edge contracts).

## Influence

**Forces** act on declared bodies through declared channels — never implicitly. A `FieldRecipe` composes
forces without blurring lanes; the impulse **accumulator** captures every force centrally so influence is
attributable, not guessed. Bodies choose how much they yield: **body authority** modes (Anchored /
Kinematic / Dynamic) decide whether a body is moved, and Dynamic bodies **recoil**. A fixed timestep keeps
the influence deterministic and replayable.

See [substrate-api.md](substrate-api.md) (accumulator channels, body authority, dynamic recoil,
integrator modes) and [dimensional-coupling.md](dimensional-coupling.md) (forces are the only coupling
mechanism; dimensions are orthogonal by default).

## Read

The field is **legible**. `query` samples it at a point or over a region; `snapshot` captures a whole
frame; `diff` compares two snapshots; `replay` re-runs recorded influence deterministically. **Lenses**
read a snapshot through a named projection so a consumer sees only what it asked for. Reads never perturb
the field — reading is not a force.

See [substrate-api.md](substrate-api.md) (the shipped `query` / `snapshot` / `diff` / `replay` read API,
still experimental) and [causality-and-truth.md](causality-and-truth.md) (the Observed → Attributed →
Explained → Replayed → Predicted ladder, and the truth labels a read carries).

## Reveal

A read is **projected** into a form a consumer can use. The **Projection Registry** turns field state into
CSS variables (`--d`, `--field-*`) for styles, DOM attributes for the page, `agent-json` for machines, and
static fallbacks under reduced motion. The same field reveals itself differently to a stylesheet, a
screen reader, and an agent — one influence, many consumptions.

See [agent-consumption-model.md](agent-consumption-model.md) (how particles, DOM elements, event sinks,
and visual layers read one influence differently), [visualization-methods-taxonomy.md](visualization-methods-taxonomy.md)
(render/diagnostic methods and placement), and [coordinate-spaces.md](coordinate-spaces.md) (the five
spaces a projection converts between, one-way).

## Govern

Revelation is **bounded**. A `FieldPolicy` sets budgets, capabilities, and redactions; lane lints keep
concepts, tokens, metrics, and projections from bleeding into each other; coupling passports record which
forces may couple which dimensions. An agent gets only what policy grants it, and only in the shape the
projection allows.

The full safety story — the three load-bearing invariants and the mechanisms that uphold them — is
[agent-safety-model.md](agent-safety-model.md).

See [substrate-api.md](substrate-api.md) (governance lint, policy surface), [system-contracts.md](system-contracts.md)
(the capability and feedback contracts), and [api-stability.md](api-stability.md) (what is frozen vs
experimental across the surface).

---

Declare → Influence → Read → Reveal → Govern. If you are looking for the operating model behind the five
verbs, read [definition-document.md](definition-document.md); for the full catalog of documents, the
[canonical README](README.md).
