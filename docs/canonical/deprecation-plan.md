> **Status: canonical (policy) — the kept-vs-deprecated split and the `1.0` removal target are the
> maintainer's recorded decision (#709).**
> This document enumerates the **migration-era alias surface** still shipping for back-compat, gives
> each alias a deprecation status, and pins its removal to `1.0`, consistent with the
> [`SUPPORT.md`](../../SUPPORT.md) deprecation window. It exists so the "temporary" compat surface does
> not silently become a permanent, forever-maintained API. Closes #709 (parent #738).
>
> Nothing is removed by this document — RC1 / `1.0` **ships every living alias**. This is the record of
> what is intentionally temporary and where it goes. Related: [`api-stability.md`](api-stability.md)
> (the freeze contract + the "Deprecation & removal policy" section), [`SUPPORT.md`](../../SUPPORT.md)
> (the support/versioning policy).

# Migration alias surface — deprecation & removal plan

The `forces-ui → field-ui → Fundamental` rename was a **hard** rename: most of the old surface
(`<forces-field>`/`<forces-cell>` tags, the `ForcesField`/`ForcesController`/`useForcesField` exports,
the `--forces-*` CSS vars, and the `compat-core`/`compat-elements`/`compat-react`/`compat-vanilla`
packages) is **already gone** — the test suite asserts its absence. What remains is a small set of
**living aliases** kept so that consumers who migrated to `field`/`field-*` naming but still listen for
old event names, read old var names, or import the old package name do not break.

This plan covers those survivors. It does **not** reopen anything already removed.

## Kept permanently — NOT migration surface, NOT deprecated

Two var pairs read like duplicates but are **canonical dual naming**, decided (#709) to be kept
forever. They are not migration cruft and get **no** deprecation warning:

- **`--d` and `--field-density`** — the canonical dual density naming. `--d` is the terse authoring
  name; `--field-density` is the spelled-out mirror. Both are permanent; author CSS may use either.
- **`--load`** — the canonical sink-load channel. (It is `--mass` that is the deprecated alias *of*
  `--load` — see the table below — not the other way around.)

## The deprecation window (from `SUPPORT.md`)

- A stable symbol is **deprecated** (kept working; marked in docs + a dev-only `console.warn` where it
  is a runtime call) for at least one release before it may be removed.
- These aliases have shipped across the whole pre-`1.0` line (frozen-and-additive), which satisfies the
  notice window. The decision (#709): **keep them through RC1, remove at `1.0`.** Because they are
  *passive mirrors* (an extra event, an extra var write, a re-export) rather than primary API, a
  consumer on canonical naming (`field:*`, `--d`/`--field-density`, `--load`, `@fundamental-engine/dom`)
  is unaffected by their removal.

## The living aliases (removed at `1.0`)

| # | Alias | Canonical form | Where it lives | Dev warn? | Removal |
|---|---|---|---|---|---|
| 1 | `forces:*` events (`forces:captured` / `forces:released` / `forces:relocated`) — *dispatched* alongside `field:*` | `field:*` events | `packages/core/src/core/field.ts` (`fireCaptureEvent`, ~L1039) | **Yes** — dev-only `console.warn`, deduped once per event name, at the dispatch site (`devWarnDeprecated`) | **`1.0`** — stop dispatching `forces:*` |
| 2 | `--mass` CSS var — *written* alongside `--load` (back-compat alias) | `--load` | `packages/core/src/core/feedback-sink.ts` (~L47); also mirrored by `packages/elements/src/platform-runtime.ts` | No — a CSS var write is not runtime-observable to JS (CSS reads can't be intercepted); docs + release notes are the signal | **`1.0`** — stop writing `--mass` |
| 3 | `<field-field>` custom element — *registered* alongside `<field-root>` | `<field-root>` | `packages/elements/src/index.ts` (~L702) | Feasible (a `connectedCallback` warn) but not wired — low-cost registration mirror | **`1.0`** — stop registering (maintainer may bless it as permanent instead; call it at `1.0`) |
| 4 | `@fundamental-engine/platform` package — re-exports `@fundamental-engine/dom` | `@fundamental-engine/dom` | `packages/platform/` (thin alias; `package.json` `description` says DEPRECATED) | **Yes** — one-time dev-only `console.warn` from the entry module on import | **`1.0`** — stop publishing |

**On row #2 (`--mass`) and CSS vars generally:** the engine *writes* the var; a CSS `var(--mass)` read
happens entirely in the style engine and is invisible to JS, so there is no interception point for a
runtime warning. This is doc-only by necessity (same for any CSS-var alias). The `--forces-*` vars are
**already gone** (below), so `--mass` is the only CSS-var alias still shipping.

### Already removed (for the record — do not re-add)

- `<forces-field>` / `<forces-cell>` tags — not registered.
- `ForcesField` / `ForcesController` / `useForcesField` exports — gone.
- `--forces-*` CSS vars — gone.
- `@fundamental-engine/compat-core` / `-elements` / `-react` / `-vanilla` packages — gone (removed at
  `0.7.0`). The `compat-*` "packages" the RC1 brief referenced no longer exist; the only living compat
  *package* is `@fundamental-engine/platform` (row #4).

The absence of the above is asserted by the test suite; this plan does not change that.

### Not aliases — body-registration events are `field:*` only

For the record: the Shadow-DOM body-registration events (`REGISTER_BODY` = `field:register-body`,
`UNREGISTER_BODY`, `UPDATE_BODY` in `packages/core/src/core/shadow.ts`) have **no** `forces:*` mirror —
they were introduced under the `field:*` namespace and never carried an alias. Only the discrete
capture/release/relocate events (row #1) are mirrored. Do not add a `forces:*` registration alias.

## Console-deprecation path (what warns at runtime vs. doc-only)

`SUPPORT.md` says deprecation is "marked in docs + a dev-only `console.warn` **where it is a runtime
call**." Some of these aliases are *passive mirrors* with no interception point, so only the observable
ones warn:

- **`forces:*` events (row #1) — WARNS.** The engine *dispatches* the alias, so the dispatch site is a
  natural warn point. `fireCaptureEvent` calls `devWarnDeprecated`, gated dev-only (contract-checks flag,
  i.e. `NODE_ENV !== 'production'`) and **deduped once per event name** so a body firing every frame
  warns at most once. It cannot detect a *listener* being added, but warning on the dispatch is enough to
  surface the alias in dev.
- **`--mass` CSS var (row #2) — doc-only.** The engine *writes* the var; a `var(--mass)` read happens in
  the style engine and is invisible to JS, so there is no interception point. Docs + release notes are
  the signal. (True for any CSS-var alias.)
- **`<field-field>` (row #3) — doc-only for now.** A `console.warn` on `connectedCallback` is feasible and
  is the one place a dev log would reach a consumer, but it is not wired (the tag may be blessed as a
  permanent secondary registration; decide at `1.0`).
- **`@fundamental-engine/platform` (row #4) — WARNS.** The entry module emits a one-time dev-only
  `console.warn` on import, gated to `process.env.NODE_ENV !== 'production'`.

## RC1 / `1.0` shipping decision

RC1 **ships all living aliases** — none are removed for the freeze. The observable ones (`forces:*`
events, the `@fundamental-engine/platform` package) carry a dev-only deprecation warning; the CSS-var
alias (`--mass`) and the `<field-field>` tag are doc-only. All are **removed at `1.0`**. This document,
alongside the "Deprecation & removal policy" section of [`api-stability.md`](api-stability.md), is the
record that they are *intentionally temporary*, not permanent API.
