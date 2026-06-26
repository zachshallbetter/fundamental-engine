---
title: "One Engine, Four Runtimes — The Zero-DOM Core"
description: "Fundamental's physics lives in a core that imports zero DOM. Every runtime — web, Three.js, headless, native Swift — is the same engine behind a different injected host."
summary: "How a renderer-agnostic core lets the same field run on the page, in WebGL, with no document at all, and natively on Apple platforms — and what that discipline costs."
date: 2026-06-26
category: feature
author: "Zach Shallbetter"
draft: true
---

# One Engine, Four Runtimes — The Zero-DOM Core

Most "cross-platform" engines are not one engine. They are a reference implementation and a pile of
ports that drift apart the moment someone fixes a bug in only one of them. The physics forks. The
behavior forks. The word "same" quietly becomes "similar."

Fundamental took a harder line. There is exactly one engine, and it lives in
`@fundamental-engine/core` — a package that **imports zero DOM**. No `document`, no `window`, no
`requestAnimationFrame`, no `ResizeObserver`. Not "tries not to." Not "mostly avoids." Zero, enforced
by a test that fails the build if a single DOM-global call-site appears anywhere in the package.

That one constraint is what makes the field portable. The same force math runs on the web, inside a
Three.js scene, headless with no screen at all, and natively on Apple platforms — because none of
those runtimes are a reimplementation. They are the same core, handed a different *host*.

## The seam: FieldHost

The core never reaches for the environment. Everything it would otherwise read from the browser —
the viewport size, the scroll offset, whether the tab is hidden, whether the user prefers reduced
motion, the next animation frame, the subtree to scan for bodies — comes through one injected
interface, `FieldHost`:

```ts
export interface FieldHost {
  root: ParentNode;                  // what to scan for [data-body]
  viewport(): HostViewport;          // width, height, dpr
  scrollY(): number;
  reducedMotion(): boolean;
  hidden(): boolean;
  raf(cb: (t: number) => void): number;   // schedule a frame
  cancelRaf(id: number): void;
  createCanvas(): HTMLCanvasElement;
  onResize(cb): () => void;
  onScroll(cb): () => void;
  // …visibility, input, body events
}
```

[`createField(canvas, opts)`](/docs/api/handle) builds the renderer-agnostic engine, then drives it
entirely through whatever host you give it. The interface is pure types — no globals — which is precisely why
`field.ts` can import zero DOM and still know how to ask "how big is the surface?"

A new runtime, then, is not a new engine. **A new runtime is a new `FieldHost`.** That is the whole
trick, and the rest of this essay is just the four hosts that already exist. The [host-driven runtime
paper](/writings/05-host-driven-runtime) is the formal version of this argument; the
[platform docs](/docs/platform) are the practitioner's map of the seam.

## The boundary is real, not aspirational

It is easy to *say* a core is renderer-agnostic. The honest version is mechanical. The boundary is a
test — `dom-boundary.test.ts` — and its allowlist is the empty set:

```ts
const ALLOW = new Set<string>();
```

It walks every source file in the package and matches DOM-global access patterns:
`document.querySelector`, `window.devicePixelRatio`, `new ResizeObserver`, a bare
`requestAnimationFrame(` call. The patterns are written to catch *call-sites*, not prose — so a
comment that says "scan the document" survives, but `document.querySelector(` does not. If any match
appears, the test fails. There is no exception list to quietly grow.

This is what keeps the layering from rotting. The browser adapter, `browserHost()`, lives one package
up in `@fundamental-engine/dom` — not in core. The download helpers live there too. Core stays clean
not by good intentions but because the build refuses to ship otherwise.

## Runtime one: the web

`browserHost()` is the obvious host. It binds the engine to `window`, `document`, and rAF: scan the
real DOM for `[data-body]`, measure rects, schedule frames off the browser's clock, pause when the
tab backgrounds. This is the host behind `<field-root>` and behind every page on this site. It is the
host everyone meets first — and it is just one implementation of an interface, not the engine itself.

## Runtime two: Three.js

`@fundamental-engine/three` (shipped and published in 0.8.1) runs the same core inside a WebGL scene.
It supplies `threeHost()` plus a `threeBackend()` for drawing, and projects the field into 3D —
`PlaneProjection` for a flat field in a scene, `VolumeProjection` for a true volumetric one. The
particles become an instanced `ParticlePool`; meshes become bodies via `FieldBodyRegistry`.

The point worth holding onto: the forces are not reimplemented in GLSL or re-derived for 3D. The same
`core` resolves them; Three.js is a *projection and a backend*, a host and a renderer pair bolted onto
the unchanged engine. A gravity well behaves identically whether it is bending DOM text or bending an
instanced mesh, because it is literally the same code resolving it.

## Runtime three: headless, no document at all

This is the one that proves the architecture. `headlessHost()` binds the engine to *nothing*:

```ts
const host = headlessHost({ width: 1920, height: 1080 });
const field = createField(undefined, { host, render: 'none' });
field.addBody({ tokens: ['attract'], rect: () => box, onFeedback: (ch) => read(ch.density) });
host.tick(); // advance one frame — on a schedule, or per agent turn
```

There is no canvas. There is no scan root — bodies arrive through `addBody`, not `[data-body]`. There
is no animation loop the environment owns; the caller drives the clock with `tick()`. The viewport is
an abstract volume you declare. `createCanvas()` deliberately throws, because a headless field has
nothing to draw and shouldn't pretend.

What you get back is the field's state — density, attention, coherence, pressure — through
`onFeedback`, `sampleScalar`, and `readParticles`. The full simulation runs. It just runs for a
reader that isn't a screen: an agent treating the field as a salience substrate, a Node service, a
deterministic test, a native sidecar.

And here is where it connects to the rest of the system. The engine default is
[`render: 'none'`](/writings/render-none-the-invisible-field) — signals-first. A field created without
a render mode runs the entire simulation and draws nothing, writing its signals out for whatever wants
to sample them. `headlessHost()` is simply that idea taken to its limit. **If the field can run drawing
nothing, it can run with no screen at all.** Invisible-first on the web and document-free in a Node
process are the same fact viewed from two distances.

## Runtime four: native Swift

The Swift port is not a wrapper around the JS. It is the same model, expressed natively — and it
honors the same seam. `FundamentalCore` defines its own `FieldHost`, and the platform hosts plug into
it the way `browserHost` plugs into the web: `UIKitFieldHost`, `AppKitFieldHost`, and a
`RealityFieldHost` for spatial scenes, plus a `ManualFieldHost` that is the Swift analogue of
headless. Same architecture, same host contract, a different language and platform underneath.

This is why engine fixes are a discipline, not a scramble: a physics or render bug is fixed in the JS
core *and* the Swift port in a focused change, because both planes implement the same model. They are
allowed to be the same because the seam is the same.

## The cost, stated plainly

The zero-DOM core is not free, and a system that hid the bill would be the kind of dishonest
architecture this project exists to avoid.

**The dependency direction is a tax you pay forever.** Core ← dom ← {elements, react, vanilla, three};
core never depends up. Every time the engine wants something the environment knows — a new piece of
viewport state, a new event source, a new way to measure — you cannot just reach for it. You have to
widen the `FieldHost` interface, then implement that method in *every* host: browser, headless,
Three.js, and the Swift equivalent. The indirection is real work, and it is felt most exactly when
you are in a hurry. The payoff is that nothing can quietly couple core to a browser; the price is that
adding capability is never a one-line reach.

**The non-DOM renderers are still maturing.** `browserHost` is the battle-tested path — it runs this
whole site. The Three.js backend shipped in 0.8.1 and is real, but it is younger; the projection and
particle paths have less production mileage than the DOM renderer. The Swift port runs the same model
and has its own hosts, but it is earlier on the curve than the web runtime it mirrors. "One engine,
many runtimes" is true at the level of the model. At the level of polish, the runtimes are not all the
same age, and pretending otherwise would set you up for surprise.

What the architecture guarantees is the thing that actually matters: a force resolves the same way
everywhere, because there is one place it is resolved. The hosts are how it reaches each surface. The
core is why it is the same field every time — and why the
[interface is a field, not a screen](/writings/the-interface-is-a-field-not-a-screen) no matter what
surface it lands on.

## Related reading

- [The Interface is a Field, Not a Screen](/writings/the-interface-is-a-field-not-a-screen) — the manifesto; the portable core is what lets the field outlive any one surface.
- [render: 'none' — The Invisible Field Is the Baseline](/writings/render-none-the-invisible-field) — signals-first is the bridge from the web to a screen-free runtime.
- [Host-driven runtime](/writings/05-host-driven-runtime) — the formal architecture paper this essay narrates.
- [Portable field recipes](/writings/06-portable-field-recipes) — what stays the same when the same engine moves between runtimes.
- [Platform docs](/docs/platform) — the `FieldHost` seam and dependency direction, practitioner's version.
- [Getting started](/docs/getting-started) — `createField` and the web host you meet first.
