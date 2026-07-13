> **Status: canonical.**
> This document defines the **frozen public API surface for Fundamental `0.x`** and the compatibility
> rules that govern it: what is stable, what is experimental, how versions move, and how the alias
> window works. It is enforced in code by `scripts/api-surface.ts` (typechecked) and
> `scripts/check-api-surface.mjs` (runtime), both run by `pnpm check:api` in CI. The shared machine
> data is [`scripts/api-surface.data.mjs`](../../scripts/api-surface.data.mjs); the live reference page
> is [`/docs/api/stability`](../../apps/site/src/pages/docs/api/stability.astro). Related contracts:
> [system-contracts.md](system-contracts.md),
> [platform-architecture.md](platform-architecture.md).

# Fundamental API stability

The architecture has stopped being fluid. Recipes execute, data binds, the inspector reads the live
runtime, the gallery runs, the starter installs, the studies are data-driven. Before adding more
capability, the public surface is **frozen for `0.x`** so consumers can build against it without the
ground shifting.

A symbol is "frozen" when it appears in the table below. Freezing means: it stays exported, from the
same package, with the same kind (value / type / element), and its shape does not break, for the life
of the `0.x` line. The freeze is mechanically enforced — `pnpm check:api` fails the build if a frozen
symbol is removed, renamed, moved between packages, or changes kind.

> Package npm names: core is published as **`@fundamental-engine/core`**; the rest are
> `@fundamental-engine/dom`, `@fundamental-engine/elements`, `@fundamental-engine/react`, `@fundamental-engine/vanilla`,
> `@fundamental-engine/three`. The `@fundamental-engine/kit` / `fundamental-engine` umbrella packages were
> **retired in 0.7.0** — install the specific package you need.
>
> **0.7.0 migration — `@fundamental-engine/platform` → `@fundamental-engine/dom`.** The DOM-binding
> package was renamed (it *is* the DOM layer); the frozen symbols `browserHost`, `createFieldPlatform`,
> `applyRecipe`, `bindData`, and the `FieldPlatform` type now live in `@fundamental-engine/dom`. This is
> the one sanctioned cross-package move of the `0.x` line, gated by the minor bump. `@fundamental-engine/platform`
> stays published as a **deprecated alias** that re-exports `dom`, so existing imports keep working;
> migrate to `dom` and the alias will be removed in a later release.

## The stable surface (`0.x`)

### Entry points and runtime

| Symbol | Package | Kind | What it is |
| --- | --- | --- | --- |
| `createField` | `@fundamental-engine/core` | value | The renderer-agnostic primitive. **Requires `opts.host`** and throws without it. |
| `createField` | `@fundamental-engine/vanilla` | value | The host-bundled convenience door (= `createBrowserField`); auto-supplies `browserHost()`. |
| `browserHost` | `@fundamental-engine/dom` | value | The canonical DOM `FieldHost` for `createField`. |
| `browserHost` | `@fundamental-engine/vanilla` | value | Re-export of the platform host for the no-framework path. |
| `createFieldPlatform` | `@fundamental-engine/dom` | value | Wires the six native-first registries on a root. |
| `applyPattern` | `@fundamental-engine/dom` | value | Applies a Field Pattern to a live platform. `applyRecipe` is the frozen `@deprecated` alias (removed at `1.0`). |
| `bindData` | `@fundamental-engine/dom` | value | Binds records → bodies; data drives the field. |
| `compilePattern` | `@fundamental-engine/core` | value | Pure `FieldPattern` → compiled plan (no DOM). `compileRecipe` is the frozen `@deprecated` alias (removed at `1.0`). |

`createField` has **two doors on purpose**: the core primitive is renderer-agnostic and host-required;
`@fundamental-engine/vanilla` re-exports the host-bundled convenience so the no-framework path stays one call.
Both are frozen; the vanilla door must keep auto-supplying `browserHost()`.

### Types

| Type | Package | What it is |
| --- | --- | --- |
| `FieldPattern` | `@fundamental-engine/core` | The Field Pattern schema. `FieldRecipe` is the frozen `@deprecated` alias (removed at `1.0`). |
| `FieldHost` | `@fundamental-engine/core` | The renderer-agnostic host contract `createField` requires; `browserHost` implements it. |
| `FieldPlatform` | `@fundamental-engine/dom` | The surface `createFieldPlatform` returns. |

### Elements and the body contract

| Surface | Package | What it is |
| --- | --- | --- |
| `<field-root>` | `@fundamental-engine/elements` | One background field per page; scans the document for `[data-body]`. |
| `<field-cell>` | `@fundamental-engine/elements` | A scoped local field region. |
| `data-body` (attribute) | core `BODY_SELECTOR` | **The body contract.** "Every element is a body" via the `data-body` attribute on ordinary elements. |

**There is no `<field-body>` element.** Bodies are an attribute on ordinary elements, not a tag, and
none will be introduced as the body mechanism. The custom elements are `<field-root>` (also registered
as `<field-field>`) and `<field-cell>`; the pre-rename `<forces-field>`/`<forces-cell>` tags are **not**
registered (the rename left no element aliases).

## The experimental surface (not frozen)

These carry **no** stability guarantee and may change shape or be removed in any release. Some have
exported building blocks today — those are *shipped-but-unfrozen*: present in the package, but not part
of the contract until they are added to the table above.

| Area | Status | Notes |
| --- | --- | --- |
| `FieldHandle` (full surface) | partial | The handle shape is not frozen as a type. Entry points that return it (`createField`, `createBrowserField`) are frozen, but new methods may be added in any patch. |
| `FieldHandle` diagnostic accessors | shipped-unfrozen | `particleCount(): number` and `energy(): { kinetic, thermal, total, count }` ship in `@fundamental-engine/core` and are proxied on `<field-root>`. Safe to use; not frozen until 1.0. |
| Substrate read API | shipped-unfrozen · EXPERIMENTAL | `query` / `snapshot` / `diff` / `replay` / `projections` (+ `lint`), `data-authority` / `Body.authority`, `createField({ integrator: 'fixed' })`, and the accumulator channels — all shipped across the surfaces but **not** in the frozen 17 and may change shape or be removed. Full reference: [substrate-api.md](substrate-api.md). |
| Advanced diagnostics | partial | `DIAGNOSTICS` / `DIAGNOSTIC_LENS` / `draw*` primitives ship but are unfrozen. |
| Performance budget | shipped-unfrozen | `inspectBudget()`, `withinBudget()`, `DEFAULT_BUDGET`, `BudgetFinding` ship in `@fundamental-engine/core`; `FieldPerf` (frame-duration split, adaptive governor) ships shipped-but-unfrozen in `@fundamental-engine/dom` as `createFieldPerf` + `QualityGovernor`. |
| Visual recipe editor | absent | No editor UI; the authoring toolkit is the substrate to build one on. |
| GPU / WebGPU backend | planned | A named direction; the 16 shipped render modes are CPU/canvas. |
| Multi-root bridge | absent | No API for coordinating multiple `<field-root>` instances yet. |
| AI evidence fields | partial | `EVIDENCE_FIELD` + the agent API ship as a substrate, but no packaged feature. |
| Custom render backends | partial | Possible via `opts.host`; no stable backend-registration API. |

## Compatibility rules

1. **Pre-1.0 semver.** In `0.x` the **minor** is the breaking position. A breaking change to a frozen
   symbol bumps `0.MINOR` (`0.2 → 0.3`); additive and fix-only changes bump the patch. Consumers
   should pin to `~0.MINOR`.
2. **Additive-only within a minor.** New exports, new optional fields, and new recipes/modes may land
   in a patch. Renaming, removing, or changing the signature/shape of a frozen symbol requires a minor
   bump and a migration note.
3. **`createField` keeps both doors.** The host-required core primitive and the host-bundled vanilla
   convenience are both preserved; the vanilla door must keep auto-supplying `browserHost()`.
4. **Package ownership is part of the contract.** Frozen symbols do not move between packages within
   `0.x` (`compilePattern`/`FieldPattern`/`FieldHost` → core; `createFieldPlatform`/`applyPattern`/
   `bindData`/`FieldPlatform`/`browserHost` → dom; `field-root`/`field-cell` → elements). The old
   `compileRecipe`/`FieldRecipe`/`applyRecipe` names are frozen `@deprecated` aliases of these, same
   package, removed at `1.0`.
5. **Bodies are an attribute contract.** `[data-body]` on ordinary elements is the frozen authoring
   surface; there is no body element.
6. **The `forces-*` compatibility layer was removed — there is no `forces:*` event compatibility contract.** The
   `forces-ui → field-ui → Fundamental` rename was a **hard** rename: the `<forces-field>`/`<forces-cell>`
   tags, the `ForcesField`/`ForcesController`/`useForcesField` exports, the `--forces-*` CSS vars, and the
   `compat-*` packages are **gone** (the test suite asserts their absence). Event naming is canonicalized
   as `field:*`. The one *current* deprecated alias is the **package** rename
   `@fundamental-engine/platform → @fundamental-engine/dom` (above) — a thin re-export of `dom`,
   excluded from the additive-only guarantee and **scheduled for removal at `1.0`** (it emits a
   one-time dev-only import warning). Note `--d` / `--field-density` and `--load`
   are **canonical dual names, kept permanently — not deprecated.**
7. **The experimental surface carries no guarantee.** Diagnostics/agent/render-mode exports that happen
   to ship today are *shipped-but-unfrozen* until explicitly added to the stable table.

## Deprecation & removal policy

A few names are migration-era aliases from the `forces-ui → field-ui → Fundamental` rename. They keep
working through RC1 and are **removed at `1.0`**. Two var pairs that look like migration cruft are not —
they are canonical dual naming and are kept permanently. The full per-alias inventory (file:line, warn
vs. doc-only, replacement) lives in [`deprecation-plan.md`](deprecation-plan.md); this is the contract
summary.

### Kept permanently — NOT deprecated

- **`--d` and `--field-density`** — the canonical dual density-var naming. Both are permanent; author CSS
  may read either. This is intentional dual naming, not a deprecated alias.
- **`--load`** — the canonical sink-load channel. Permanent. (It is `--mass` that is the deprecated alias
  of `--load`, not the reverse — see below.)

### Deprecated — shipped through RC1, removed at `1.0`

| Alias | Replacement | Where it lives | Dev warn? |
|---|---|---|---|
| `--mass` CSS var | `--load` | `packages/core/src/engine/feedback-sink.ts`; mirrored in `packages/elements/src/platform-runtime.ts` | No — a CSS-var write is not runtime-observable to JS; doc-only |
| `--forces-*` CSS vars | `--field-*` | *already removed* (`0.7.0`) — listed for the record | n/a |
| `compat-*` packages (`compat-core`/`-elements`/`-react`/`-vanilla`) | the real `@fundamental-engine/*` packages | *already removed* (`0.7.0`); the only living compat package is `@fundamental-engine/platform` → `@fundamental-engine/dom`, which warns on import | Platform alias: **Yes** — one-time dev-only warn on import |

**Sunset:** the above aliases ship through RC1. The runtime-observable one
(`@fundamental-engine/platform` package) emits a **dev-only** (`NODE_ENV !== 'production'`) `console.warn`,
deduped so it warns at most once. CSS-var aliases cannot be intercepted (CSS reads are invisible to
JS), so they are doc-only. Everything here is **removed at `1.0`**.

## How the freeze is enforced

- [`scripts/api-surface.ts`](../../scripts/api-surface.ts) imports every frozen value and type from its
  owning package. Removing, renaming, or changing the kind of a frozen symbol is a **compile error**
  there (a value-import of a type, or vice versa, also fails — so the *kind* is locked, not just the
  name).
- [`scripts/check-api-surface.mjs`](../../scripts/check-api-surface.mjs) verifies the parts tsc can't
  see: each frozen value resolves at runtime in the built dist, each frozen type is exported in source,
  each element tag is registered (`customElements.define`), `data-body` is still in core's
  `BODY_SELECTOR`, and the data file and the type gate name the same symbols.
- Both run via `pnpm check:api`, in CI right after `pnpm check:dist`.

Changing the frozen surface on purpose means editing
[`scripts/api-surface.data.mjs`](../../scripts/api-surface.data.mjs) **and**
[`scripts/api-surface.ts`](../../scripts/api-surface.ts) **and** this document together, with a
migration note and a `0.MINOR` bump.

## Status

The packages are **published to npm** under the `@fundamental-engine` scope (`@fundamental-engine/core`
and the five adapters: dom, elements, react, vanilla, three). This freeze defines the `0.x` contract
consumers build against; the publish steps and order are in [`PUBLISHING.md`](../../PUBLISHING.md).
