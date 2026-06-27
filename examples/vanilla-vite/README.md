# Fundamental example — vanilla + Vite

A minimal, **standalone** Vite + TypeScript app that drives a Fundamental field from plain
TypeScript with [`@fundamental-engine/vanilla`](https://www.npmjs.com/package/@fundamental-engine/vanilla).
It depends on the **published** npm packages (not `workspace:*`), so it proves the real released
build works the way an outside project would consume it.

## What it shows

- `createField(canvas, { render: 'dots' })` starting the engine on a `<canvas>` **you own**
  (`src/main.ts` is the entire integration).
- A couple of `[data-body]` elements — one `attract` (pulls particles into a well) and one
  `repel` (pushes them away) — so the field visibly reacts to ordinary DOM, with no per-element wiring.
- A live readout of `field.particleCount()` and `field.version`.

## Run it

```bash
npm install
npm run dev      # http://localhost:5190
```

Build the static output and preview it:

```bash
npm run build
npm run preview  # serves dist/ on http://localhost:5190
```

## How it works

`@fundamental-engine/vanilla` is the framework-free door — importing it has **no** side effects
(it registers no custom element). You hand `createField()` a canvas and it:

1. resolves a host (`browserHost()` by default),
2. runs the simulation and, with `render: 'dots'`, draws particles onto your canvas, and
3. scans the page for `[data-body]` elements and turns each into a body in the field.

The engine's default render mode is `'none'` (signals-only); this example opts into a visible field
by passing `render: 'dots'`.
