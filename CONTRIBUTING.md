# Contributing to Fundamental

Thanks for your interest. This guide covers the setup, the conventions that keep the
codebase coherent, and the workflow for the most common change — adding a force.

## Setup

```sh
pnpm install            # Node 22+, pnpm 10+ (pinned via packageManager)
pnpm typecheck          # tsc across all packages
pnpm test               # node:test (the core test suite)
pnpm build              # tsc emit + the Astro site
pnpm dev                # the site dev server (the Manual / Lab / Docs)
```

The repo is a pnpm monorepo:

| Package | What |
|---|---|
| `packages/core` (`Fundamental`) | the engine — catalog, contracts, FieldStore, forces, conformance |
| `packages/elements` (`@fundamental-engine/elements`) | `<field-root>` + the declarative `data-body` keystone |
| `packages/react` (`@fundamental-engine/react`) | the React adapter |
| `apps/site` (`@fundamental-engine/site`) | fundamental-engine.com — Manual, Lab, Docs |

## Conventions

These are load-bearing — please keep to them:

- **The spec is the contract.** `docs/engine-reference/forces-system.md` is law; code conforms to it.
  `docs/engine-reference/forces-tests.md` defines how forces are verified.
- **Zero runtime dependencies in the core.** TypeScript is fine; a runtime dependency
  needs a strong justification. The React adapter's one peer dep (React) is the only
  approved framework dependency.
- **TypeScript, with `.ts` import extensions** (`import './x.ts'`) so `node:test` runs
  the source directly and `tsc` emits Node-valid `.js` (via `rewriteRelativeImportExtensions`).
  No test/build framework — just `tsc` + `node:test`.
- **Node strip-only mode** (used by `node --test`) rejects TS constructor parameter
  properties and enums — use explicit field assignment.
- **Pure logic gets golden coverage.** New math gets a unit test asserting the exact
  per-frame result. Contracts live in `core/types.ts`.
- **One source of truth.** Catalog data lives in `src/config/*` — never re-declare it.
- **Conventional commits.** `feat(scope): …`, `fix(scope): …`, `perf`, `docs`, `chore`,
  `refactor`, `test`. The scope is the area (`core`, `lab`, `site`, `docs`, …).

## Adding a force

A force is a small module plus its proof. The four steps:

1. **Implement** it in `packages/core/src/forces/*.ts` and register it. A force is
   `{ token, label, apply(b, p, env), modify? }` (see `core/types.ts`).
2. **Golden test** — add a case to the matching `forces/*.test.ts` asserting the exact
   per-frame Δv against the spec formula (helpers: `body()` / `part()` / `env()` / `near()`).
3. **Conformance experiment** — add a `ForceConformance` entry to
   `conformance/experiments.ts`: a scenario (a particle fired into it with known
   attributes) plus the invariants (and an `exactDelta` where the formula is clean) that
   define "appropriate reaction". A completeness test fails until every registered force
   has one.
4. **Document it** — one row in the `docs/forces-tests.md` catalog (a guard test enforces
   coverage), and it appears in the Manual, the Design palette, and the Lab automatically
   (those surfaces are catalog-driven).

## Verifying a change

Before opening a PR, run the full loop:

```sh
pnpm build && pnpm test
```

`pnpm build` runs `tsc` across the packages in topological order — it typechecks every
package _and_ emits the core's `dist` types that the adapters resolve against, so on a
clean checkout it must come before a standalone `pnpm typecheck`. For changes to the live
field (the integrator, rendering, or the site), also run the site (`pnpm dev`) and check
the page behaves and the console is clean. CI runs the same build · test on every PR.

## Pull requests

- Branch off `main`; keep PRs focused.
- Use a conventional-commit title.
- Describe the change and how you verified it. The PR template prompts for this.
- Green CI is required to merge.
