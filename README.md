# Forces — a reciprocal DOM-physics field

> The page's **elements** bend the field; the field's **density** bends the
> elements back.

Forces is a framework-agnostic engine where every meaningful thing on a page — a
word, a card, a link — is a **body** in a particle field rendered on a canvas
behind the content. Bodies exert forces on the field; the field writes its density
back into the elements (weight, glow, motion). Forces act on **particles, DOM
elements, and events** alike, so the interface lives *inside* one medium rather
than sitting on top of an effect.

It began as the homepage of [zachshallbetter.com](https://zachshallbetter.com) and
outgrew it. This repo is the engine, its specification, and the original prototype
it is being refactored from.

## Status

**Pre-alpha — spec-first.** The full specification is written and stable; the
engine is being refactored from the prototype onto typed, modular foundations.
Landed so far: the canonical catalog and the core contracts (`src/`).

## The model

Everything in the system sits in one of a few layers (full detail: `docs/forces-system.md` §20):

- **Primitives** — the irreducible forces the engine implements. *Designed*
  (bounded, UI-legible: the canonical nine) and *natural* (real laws: `gravity`,
  `charge`, `magnetism`, `thermal`, …), plus source/relocate atoms.
- **Composites** — named presets over primitives (`blackhole`, `wormhole`,
  `supernova`, `star`). No new engine code.
- **Emergent** — behaviors that *arise* (orbits, flocking, networks, phase changes).
- **Orthogonal axes** — **conditions** (when a force acts), **formations** (a force
  applied field-wide), **render modes** (draw-pass swaps), and **agents** (particle
  / element / event).

Underneath: mass & momentum (§21), the unified target model (§22), micro-reactions —
energy made visible (§23), and the Currents that carry it all (§24).

## Layout

```
docs/
  forces-system.md         the full definition (the contract)
  forces-possibilities.md  roadmap, DOM⇄Canvas concepts, the extended vocabulary
  reference/               the original prototype — read-only source of authority
src/
  config/forces.config.ts  the canonical catalog (forces · formations · conditions)
  core/types.ts            the contracts (Particle · Body · Env · Force · Agent)
  forces/ formations/ render/ agents/   (engine modules — in progress)
```

## Getting started

```bash
pnpm install
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest
pnpm build          # tsup → dist/
```

## Naming

The colors in `docs/forces-system.md` §20.2 are **provisional**, pending one
reconciliation pass against the canonical palette.

## License

MIT.
