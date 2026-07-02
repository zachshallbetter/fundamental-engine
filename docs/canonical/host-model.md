> **Status: canonical (overview).**
> The host model: how any environment — DOM, headless, native, custom renderer — becomes a
> surface the field runs on. This document is the **Declare** verb's foundation and a map: it
> states the contract and links outward to the detailed docs rather than restating them. The
> host-conformance mechanics live in [platform-architecture.md](platform-architecture.md); the
> coordinate lanes in [coordinate-spaces.md](coordinate-spaces.md); the per-body lifecycle in
> [body-lifecycle.md](body-lifecycle.md). Follows the [status rule](documentation-standards.md).

# The host model

Two claims frame this document, both true in shipped code:

1. **Non-DOM hosts have an explicit contract.** The engine reaches its environment only through an
   injected interface, `FieldHost` — a pure-types SPI in `@fundamental-engine/core`. Any environment
   that satisfies it can drive the field. A new host author has a written checklist, not a
   reverse-engineering task.
2. **Headless, native, and custom renderers are first-class.** The DOM is the *first* host and the
   best-documented one, but it is not the boundary. The same core runs against a `headlessHost` (core),
   a `threeHost` (a WebGL custom renderer), and the Swift/Kotlin native ports — each held to the same
   contract, not a lesser one.

The doctrine, stated once: **the host owns domain truth; Fundamental owns relational field state.** The
host supplies geometry, time, and — where it can — scroll, visibility, and input; the field computes
behavior on top and hands results back. The host model is neither an OS nor a database; it is the
**Declare** seam where an environment is introduced to the field.

## The Host Adapter Contract — the `FieldHost` SPI

`FieldHost` is the renderer/environment seam. Every DOM-global touchpoint the engine would otherwise
reach for — viewport size, scroll, `requestAnimationFrame`, reduced-motion, visibility, the scan root,
event wiring — is routed through this injected interface instead of `window` / `document` directly.
Because the interface is pure types with no globals, the core imports **zero DOM** (enforced by
`packages/core/src/core/dom-boundary.test.ts`, empty allowlist).

The SPI itself is the **stable injection seam** — the mechanism by which the engine is renderer-agnostic.
The interface lives in `packages/core/src/core/host.ts`.

## MinimalFieldHost — the smallest conformant host

`MinimalFieldHost` is the smallest surface a host must supply for the engine to run. It requires exactly
**four members**, in two categories:

- **geometry** — `root` (the subtree scanned for bodies) + `viewport()` (size + DPR + optional origin):
  *where* the field lives and in what coordinate space.
- **time** — `raf()` / `cancelRaf()`: how the frame loop is scheduled (a real `requestAnimationFrame`, a
  manual `tick`, a native display link).

A host that supplies only these four members runs the **full simulation + feedback pipeline headlessly**
— it just never scrolls, never pauses on visibility, and cannot draw a heatmap. This floor is pinned by
`packages/core/src/core/minimal-host.test.ts` (a field runs against a host with none of the optional
capabilities). The native ports mirror it: `swift/Sources/FundamentalCore/Engine/FieldHost.swift` and
`android/fundamental-core/src/main/kotlin/com/fundamental/core/engine/FieldHost.kt`.

## The capability ladder

Everything beyond the four required members is an **optional capability** the engine consumes when a host
offers it and degrades gracefully around when absent (scroll → 0, reduced-motion / hidden → false,
subscriptions → no-op, a heatmap draw mode that needs `createCanvas` → a clear thrown error). Each rung
unlocks a behavior:

| Capability | Member(s) | Unlocks | Absent ⇒ |
|---|---|---|---|
| scroll | `scrollY` / `scrollHeight` | scroll-driven readouts | scroll reads 0 |
| canvas | `createCanvas` | heatmap draw modes | those modes throw; `render: 'none'` unaffected |
| reduced motion | `reducedMotion` | freeze the sim on preference | motion always allowed |
| visibility | `hidden` / `onVisibility` | auto-pause on a backgrounded surface | loop never auto-pauses |
| events | `onResize` / `onScroll` / `onInput` | resize / scroll / input signals | no such signals |
| body events | `onBodyEvent` | DOM body-event registration | programmatic bodies only (`addBody`) |

`hostCapabilities(host)` returns the machine-readable read-out (`{ geometry, time, scroll, canvas,
reducedMotion, visibility, events, bodyEvents }`); `defineHost(minimal & partial)` builds a full
`FieldHost` from a minimal host plus whatever capabilities you choose, filling no-op defaults for the
rest — the sanctioned way to author a host without hand-writing the subscription boilerplate. Both live
in `host.ts`. The shipped hosts span the ladder: `browserHost` / `containerHost`
(`@fundamental-engine/dom`), `threeHost` (`@fundamental-engine/three`, a custom renderer), `headlessHost`
(core). The substrate surface these hosts serve is EXPERIMENTAL / unfrozen; the `FieldHost` SPI itself is
the stable seam.

## Host conformance checklist

A new host is first-class when it answers each question below. This is the third parity/testing category
alongside **API-surface parity** and **mathematical conformance** (the shared cross-plane golden at
`depth: 0`) — see [platform-architecture.md → Host conformance](platform-architecture.md) for the full
table and the graceful-degradation floor.

1. **Measurement / geometry** — provide `root` + `viewport()` so bodies can be resolved in field space.
2. **Coordinate mapping** — return a `viewport` origin (`originX` / `originY`) if the field is
   container-scoped rather than window-scoped, so bodies, canvas, and readouts share one space.
3. **Time** — schedule and cancel frames (`raf` / `cancelRaf`).
4. **Body identity** — respect stable `FieldBodyIdentity` across a rescan (see below); do not re-key a
   body on re-measure.
5. **Lifecycle** — support declare → measure → participate → remove for the bodies your environment
   introduces (DOM scan, or programmatic `addBody` / `handle.remove()`).
6. **Teardown** — every subscription you return (`onResize` / `onScroll` / …) hands back an unsubscribe;
   honor it so the field tears down cleanly.
7. **Accessibility equivalent** (host-specific) — wire ARIA / semantics on your plane; the field state is
   a behavior layer over the host's source of meaning, not a replacement for it.

## Coordinate spaces

A host measures in its own coordinates (CSS px for the DOM, points for a native view, world units for a
3-D renderer); the field computes in **field space**. The `viewport()` origin (`originX` / `originY`) is
what reconciles them for a container-scoped field. Keep the lanes separate — do not conflate "screen
pixels" with "field state." Full model (five spaces, one-way conversions, and the
semantic-not-spatial discipline for non-DOM hosts): → [coordinate-spaces.md](coordinate-spaces.md).

## Body identity

`FieldBodyIdentity` (`packages/core/src/core/types.ts`) is a body's first-class identity: a stable primary
`id` (unique in the field, constant for the body's life) plus optional `namespace`, `kind`, and `host`
tags (free-form, opaque to the engine). Snapshots, diffs, replay, and relationships all key on
`identity.id`; when a body carries no supplied identity the engine derives one deterministically (never
`Math.random`). Identity is assigned at **declare** and must not shift mid-life.

## Body lifecycle

A body moves through **declare → measure → participate → remove** (with `participate` → `receive`
repeating every frame for its whole life). DOM bodies are discovered by the scanner from `[data-body]`;
programmatic bodies enter via `field.addBody(spec)` and leave via `handle.remove()`. This is what lets a
non-DOM host carry synthetic or data bodies as first-class field participants. Full lifecycle, including
DOM-vs-synthetic differences and the identity-stability rule: → [body-lifecycle.md](body-lifecycle.md).

---

See also: [platform-architecture.md](platform-architecture.md) (registries, scheduler, runtime, host
conformance), [system-contracts.md](system-contracts.md) (the hard platform contract), and
[substrate-api.md](substrate-api.md) (the read APIs the host's field state feeds).
