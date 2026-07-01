> **Status: canonical (concept).**
> The coordinate-space vocabulary: the distinct spaces field state lives in, and the one-way
> conversions between them. This is *framing* — it names lanes so docs and code stop conflating
> "screen pixels" with "field state." The host-boundary mechanics are in
> [platform-architecture.md](platform-architecture.md); the substrate results that carry these
> coordinates are in [substrate-api.md](substrate-api.md). Follows the
> [status rule](documentation-standards.md).

# Coordinate spaces

A field is computed once and expressed many ways. That only stays coherent if we are precise about
*which space* a coordinate is in. Fundamental keeps five spaces separate, and the conversions between
them run **one direction each** — an adapter carries the host into the field; a projection carries the
field back out. Never assume a number is in "the" coordinate space; ask which one.

The canonical architecture statement ([documentation-standards.md](documentation-standards.md)) says the
core imports zero DOM and routes the environment through an injected `FieldHost`. Coordinate spaces are
the *why*: the host adapter is exactly the boundary where host space becomes field space, so the engine
never sees pixels, points, world units, or rows — only field space.

## The five spaces

| Space | What lives here | Owner |
|---|---|---|
| **Host space** | the raw units of whatever the field is bound to — CSS px, native points, Three.js world units, data rows, graph nodes | the host |
| **Field space** | the single internal coordinate system the engine computes in — bodies, matter, forces, metrics | `Fundamental` (the core) |
| **Projection space** | a named output surface's own units — a CSS custom property, a font-weight step, an aria string, an audio gain, a haptic level | a registered projection |
| **Screen space** | device pixels actually composited — DPR-scaled, the canvas render surface | the render surface |
| **Semantic space** | non-spatial axes of state — attention, confidence, memory, polarity | the semantic model |

**Field space is the hub.** Everything converts *to* it on the way in and *from* it on the way out. The
engine only ever reasons in field space; that is what lets one core drive a DOM canvas, a native
`Canvas`, a Three.js scene, or a headless test with the same physics.

## The conversions (each one-way)

```txt
host space ── adapter ──▶ field space ── projection ──▶ projection space
                                       └─ render ─────▶ screen space
semantic space ── (only when mapped) ─▶ field space
```

- **Adapters convert host → field.** A `FieldHost` adapter measures the host (a DOM
  `getBoundingClientRect`, a native rect, a world-space bounds, a data row's derived position) and hands
  the engine field-space bodies. This is the *only* place host units enter. The DOM adapter is
  `browserHost()`; contained fields use `containerHost(el)`; native ports mirror it
  (`UIKitFieldHost`, the Android `View`/`Canvas` host). See
  [platform-architecture.md](platform-architecture.md).
- **Projections convert field → projection.** A registered projection
  ([substrate-api.md](substrate-api.md)) reads field-space channels and writes a projection-space value:
  density → a `--field-*` CSS var, confidence → a font-weight step, attention → an aria description.
  A projection **reveals** state; it never writes back into field space (the substrate-05 governance
  principle: *projection reveals state; coupling changes state*).
- **Render converts field → screen.** The render surface takes field-space positions and composites
  device pixels, applying DPR. Screen space is where fill-rate cost lives — never do physics here.
- **Semantic → field only when explicitly mapped.** See below.

The conversions do not compose into a round trip you can trust: field → screen → field loses precision
(DPR, subpixel), and field → projection is often lossy on purpose (a continuous density becomes a
three-step weight). Treat each arrow as one-way.

## Semantic dimensions are not spatial

A dimension like **attention** or **confidence** is an *axis of state*, not a position. It has no x/y
until a mapping gives it one. **Semantic space must not pretend to be spatial** unless a projection or
adapter explicitly maps it:

- Reading a body's `attention` as if it were a y-coordinate is a category error — it will "work" and be
  quietly wrong.
- A semantic axis enters field space only through a declared mapping (an adapter that positions bodies
  by a data value, or a projection that expresses a dimension as motion/weight/color).
- The accumulator's `semantic` channel ([substrate-api.md](substrate-api.md)) carries these axes as
  *contributions*, deliberately kept out of the `linear` (x/y/z) channel so nothing assumes force is
  spatial.

This is the same discipline as the naming canon (*no word lives in two lanes*): a coordinate lives in
exactly one space, and crossing spaces is always an explicit, named conversion.

## Why five spaces (the hosts that motivate them)

| Host | Host space | Adapter's job |
|---|---|---|
| **DOM** | CSS px (layout viewport) | `getBoundingClientRect` → field bodies; write `--field-*` back |
| **Native (UIKit/AppKit)** | points | measure native rects → field bodies |
| **Three.js / RealityKit** | world units (3D) | project world bounds → field space; may keep a z channel |
| **Headless** | none — synthetic bounds | supply bounds directly; no render/screen space at all |
| **OS / desktop** | window/display px | window rects → field bodies |
| **Data** | rows/records | derive a position or feed a semantic dimension |
| **Graph** | nodes/edges | node → body, edge → relationship |

The headless case is the clarifying one: with `render: 'none'` there is **no screen space**, yet field
space, projection space, and semantic space all still exist and are fully inspectable. Coordinate spaces
are a property of the *field*, not of the *pixels*.

## Related documents

| Document | Role |
|---|---|
| [`platform-architecture.md`](platform-architecture.md) | The `FieldHost` boundary — where host space becomes field space |
| [`substrate-api.md`](substrate-api.md) | Field-space readings + projections that convert to projection space |
| [`definition-document.md`](definition-document.md) | The operating model these spaces serve |
| [`causality-and-truth.md`](causality-and-truth.md) | The dimension/metric/channel/projection lock these spaces depend on |
