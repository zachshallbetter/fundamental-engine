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
it was refactored from.

## Status

**v0.1.0 — feature-complete.** The full specification is written and stable, and
the typed engine realizes it: 28 forces (canonical · natural · designed-extended),
presets, conditions, formations, render modes, two-way density feedback, conserved
attention, and cross-boundary causality — zero runtime dependencies, golden-tested.
The site (`apps/site`) is its first consumer: a live manual, lab, and design system
at [forces-ui.com](https://forces-ui.com). Published as `forces-ui`,
`@forces-ui/elements`, and `@forces-ui/react`.

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

A pnpm monorepo (see `ROADMAP.md` → Stack):

```
docs/
  forces-system.md         the full definition (the contract)
  forces-possibilities.md  roadmap, DOM⇄Canvas concepts, the extended vocabulary
  reference/               the original prototype — read-only source of authority
packages/
  core/      forces-ui            the engine — catalog, contracts, FieldStore, forces
             src/config/forces.config.ts   forces · formations · conditions
             src/core/types.ts             Particle · Body · Env · Force · Agent
  elements/  @forces-ui/elements  <forces-field> — the web-component keystone
  react/     @forces-ui/react     <ForcesField> + useForcesField — the React adapter
apps/
  site/      @forces-ui/site      forces-ui.com — the manual / landing (Astro)
```

## Getting started

```bash
pnpm install
pnpm -r typecheck    # tsc across packages
pnpm -r test         # node:test (built in — no test framework)
pnpm -r build        # core + elements (tsc) + the site (astro)
pnpm dev             # run the site (apps/site) locally
```

## Dependencies

**Zero runtime dependencies**, by policy — the engine recreates what it needs on
the platform. Tooling is deliberately minimal:

- **Build:** `tsc` (no bundler — the library ships unbundled ESM).
- **Test:** `node:test` (built into Node ≥ 22; no test framework).
- **Only dev dependency:** TypeScript.
- **Exception:** `apps/site` uses **Astro** as a build-time tool for the content
  site; it ships zero runtime JS by default.

Before any dependency is added, it must justify itself as a real exception.

## License

MIT.
