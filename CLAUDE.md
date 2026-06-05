# CLAUDE.md

Guidance for AI agents (and humans) working in this repository.

## What this is

**forces-ui is an engine, shipped as a library — not a framework.** A zero-dependency
TypeScript particle-field engine where a page's elements are physical bodies in one
shared field: they exert force, and the field's local density bends them back (weight,
glow, lift via the `--d` custom property). You stay in control of your app — you drop
`data-body` attributes on your own markup; the engine never owns your structure.

Lead with **engine**; say **library** when talking distribution; never call it a framework.

## Layout (pnpm monorepo)

| Path | Package | What |
|---|---|---|
| `packages/core` | `forces-ui` | the engine — `FieldStore`, integrator, forces, the catalog, conformance framework |
| `packages/elements` | `@forces-ui/elements` | `<forces-field>` web component + declarative `data-body` |
| `packages/react` | `@forces-ui/react` | `<ForcesField>` + `useForcesField` |
| `apps/site` | `@forces-ui/site` | forces-ui.com — the Field Manual (home), the Lab, the docs portal (Astro) |

## Commands

```sh
pnpm install
pnpm --filter forces-ui typecheck     # tsc --noEmit
pnpm --filter forces-ui test          # node:test (257 tests)
pnpm -r build                         # build all packages (tsc; site = astro build)
pnpm --filter forces-ui bench         # integrator benchmark
pnpm -C apps/site dev --port 4399     # run the site locally
```

CI runs `typecheck · test · build` on every PR. Per-change workflow: branch `auto/<name>`
→ PR → green CI → `gh pr merge --squash --delete-branch`.

## Authority & conventions

- **Spec is the contract.** `docs/forces-system.md` (the definition) > `docs/forces-possibilities.md`
  (roadmap + extended vocabulary) > the design system. `docs/reference/` is the read-only
  original prototype. Build to the spec; the docs were reconciled to the as-built engine.
- **Zero runtime dependencies** in the engine. TypeScript only; relative `.ts` imports;
  build is `tsc`, tests are `node:test`. Pure logic gets golden-test coverage.
- **Contracts live in `packages/core/src/core/types.ts`** (`Particle · Body · Env · Force · Agent`).
- A new force must appear in: `forces/*.ts` (impl + registration), `config/manual.ts`
  (catalog entry + colour), `apps/site/.../force-glyphs.css` (a glyph), a
  `conformance/experiments.ts` experiment, a golden unit test, and a `docs/forces-tests.md`
  row. Completeness tests fail until the catalog, the conformance suite, and the doc all
  agree with the live registry — so nothing drifts.

## Design laws (do not violate)

- **§11 — words never assemble from particles.** Particles never spell words or
  letterforms. Real text is rendered as text and made to *react* (glow/grow via `--d`).
  `morph` targets are marks, charts, logos, punctuation — never words.
- **FIELD REACTS.** There is one shared background field; it reacts to real
  `[data-body]` / `[data-feedback]` elements. Don't reach for foreground particle pools;
  the in-frame `<forces-cell>` is the only (demo) exception.

## What's built (current)

33 forces across every input class (A/B/C/D/E/S + modifier), 6 render modes
(`dots·trails·links·metaballs·voronoi·streamlines`), 8 presets, the conformance
framework + the Lab (a physics detector at `/lab`), and the closed-loop concepts
(material typography, conserved attention, self-laying-out layout, cross-boundary
causality). 257 core tests, zero runtime deps.

## Verifying changes (important caveat)

The **live particle field cannot be observed in a backgrounded preview tab** —
`requestAnimationFrame` is paused there, so the loop doesn't tick and scrolled
screenshots come back blank/black. Verify field *dynamics* with deterministic
`node:test` / conformance tests. The Lab is synchronous and steppable, so its verdict
*is* verifiable from a screenshot. Use the preview for static layout, console-error
checks, and synchronous CSS readbacks (e.g. drive `--d` manually to confirm reactivity).

## Release status

**Not published; the GitHub repo is private.** `npm publish` and making the repo public
are deliberate, human-run actions (see `PUBLISHING.md` / `RELEASING.md`). Versions stay
at `0.1.0` under the CHANGELOG `[Unreleased]` heading until the first publish — don't burn
versions early. Never enter npm OTP/2FA on the user's behalf.
