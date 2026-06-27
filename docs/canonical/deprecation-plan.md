> **Status: canonical (policy) — removal timings are PROPOSED, pending maintainer sign-off.**
> This document enumerates the **migration-era alias surface** still shipping for back-compat, gives
> each alias a deprecation status, and proposes a removal version consistent with the
> [`SUPPORT.md`](../../SUPPORT.md) deprecation window. It exists so the "temporary" compat surface does
> not silently become a permanent, forever-maintained API. Closes #709 (parent #738).
>
> **The actual removal *timing* is the maintainer's call.** The version commitments below are a draft
> proposal — they need maintainer sign-off before any alias is announced as deprecated-with-a-date or
> removed. Nothing is removed by this document. Related: [`api-stability.md`](api-stability.md) (the
> freeze contract), [`SUPPORT.md`](../../SUPPORT.md) (the support/versioning policy).

# Migration alias surface — deprecation & removal plan

The `forces-ui → field-ui → Fundamental` rename was a **hard** rename: most of the old surface
(`<forces-field>`/`<forces-cell>` tags, the `ForcesField`/`ForcesController`/`useForcesField` exports,
the `--forces-*` CSS vars, and the `compat-core`/`compat-elements`/`compat-react`/`compat-vanilla`
packages) is **already gone** — the test suite asserts its absence. What remains is a small set of
**living aliases** kept so that consumers who migrated to `field`/`field-*` naming but still listen for
old event names, read old var names, or import the old package name do not break.

This plan covers those survivors. It does **not** reopen anything already removed.

## The deprecation window (from `SUPPORT.md`)

- A stable symbol is **deprecated** (kept working; marked in docs + a dev-only `console.warn` where it
  is a runtime call) for **at least one minor release** before it may be removed.
- Removal happens **only in the next major**. Anything deprecated in `1.x` survives until `2.0` at the
  earliest — never a surprise break within a major line.

The pre-`1.0` line was already frozen-and-additive; `1.0` formalizes the promise. Because these aliases
are *passive mirrors* (an extra event, an extra var write, a re-export) rather than primary API, the
recommended path is: **keep them through `1.0`, mark them deprecated in a `1.x` minor, remove in `2.0`.**

## The living aliases

| # | Alias | Canonical form | Where it lives | Current status | Proposed removal (needs sign-off) |
|---|---|---|---|---|---|
| 1 | `forces:*` events (`forces:captured` / `forces:released` / `forces:relocated`) — *dispatched* alongside `field:*` | `field:*` events | `packages/core/src/core/field.ts` (`fireCaptureEvent`, ~L654) | Shipping, undocumented sunset | Deprecate in a `1.x` minor (docs note + dev `console.warn` on first add of a `forces:*` listener is **not** feasible — see "Console-deprecation path"); remove dispatch in **`2.0`** |
| 2 | `forces:*` body-registration events (`REGISTER_BODY`/`UNREGISTER_BODY`/`UPDATE_BODY` *listened to* under both namespaces) | `field:*` body events | `packages/core/src/core/field.ts` (~L2141) and `host.onBodyEvent` wiring | Shipping, undocumented sunset | Same window as #1 — listen under both through `1.x`, drop the `forces:*` listeners in **`2.0`** |
| 3 | `--field-density` CSS var — *written* alongside `--d` | `--d` | `packages/core/src/core/feedback-sink.ts` (`defaultFeedbackSink`) | Shipping; **note:** `--d` is the established var and `--field-density` is itself the *newer* mirror, so this pair is ambiguous about which is "canonical" — resolve before deprecating | **Defer** — do not deprecate until the canonical-var question (#below) is settled |
| 4 | `--mass` CSS var — *written* alongside `--load` (back-compat alias, §21.2) | `--load` | `packages/core/src/core/feedback-sink.ts` | Shipping, documented as back-compat alias | Deprecate in a `1.x` minor (docs); stop writing `--mass` in **`2.0`** |
| 5 | `<field-field>` custom element — *registered* alongside `<field-root>` | `<field-root>` | `packages/elements/src/index.ts` (~L644) | Shipping; both registered. Note: `<field-field>` is a *current* alias of `<field-root>`, **not** a legacy `forces-*` tag | Deprecate in a `1.x` minor (docs); keep registered through `1.x`; consider removal in **`2.0`** — **but** this is a low-cost registration mirror and may be worth keeping. Maintainer call. |
| 6 | `@fundamental-engine/platform` package — re-exports `@fundamental-engine/dom` | `@fundamental-engine/dom` | `packages/platform/` (thin alias; `package.json` `description` already says DEPRECATED) | **Already deprecated** (excluded from the additive-only guarantee; `api-stability.md` rule 6 says "scheduled for removal on a later minor") | Pin a concrete removal: **stop publishing in `2.0`** (a package unpublish/removal is a breaking change, so a major is the honest home), or — if the maintainer prefers — drop in a `1.x` minor since it was already declared excluded from the freeze. Maintainer call. |

### Already removed (for the record — do not re-add)

- `<forces-field>` / `<forces-cell>` tags — not registered.
- `ForcesField` / `ForcesController` / `useForcesField` exports — gone.
- `--forces-*` CSS vars — gone.
- `@fundamental-engine/compat-core` / `-elements` / `-react` / `-vanilla` packages — gone.

The absence of the above is asserted by the test suite; this plan does not change that.

## Open questions for the maintainer (sign-off required)

1. **Removal versions.** The table proposes `2.0` for the event/var aliases (the conservative,
   SUPPORT-window-honest choice). Confirm, or pick earlier `1.x` minors for any alias you are willing to
   announce-then-drop within the major line. Nothing here is binding until you confirm.
2. **`--d` vs `--field-density` (alias #3).** Decide which is canonical. If `--d` is canonical,
   `--field-density` becomes a normal deprecatable alias. If `--field-density` is canonical, then `--d`
   is the alias — but `--d` is the older, more widely-used name in author CSS, so deprecating it is more
   disruptive. This must be settled **before** either is deprecated.
3. **`<field-field>` (alias #5).** Keeping a second registration is nearly free and aids discoverability.
   Decide whether to deprecate it at all, or bless it as a permanent secondary tag.
4. **`@fundamental-engine/platform` (alias #6).** It is already declared deprecated. Confirm whether it
   stops publishing at `2.0` (major-honest) or you are comfortable dropping it in a `1.x` minor given it
   was carved out of the freeze from the start.

## Console-deprecation path

`SUPPORT.md` says deprecation is "marked in docs + a dev-only `console.warn` **where it is a runtime
call**." The aliases here are **passive mirrors**, not call sites the consumer invokes, so a clean
`console.warn` hook is not always available:

- **Events (#1, #2)** — the engine *dispatches* `forces:*`; it cannot cheaply detect that a consumer
  *added a listener* for the old name, so there is no natural warn point. The honest deprecation signal
  is docs + release notes, with removal landing in the major.
- **CSS vars (#3, #4)** — the engine *writes* the var; CSS reads are invisible to JS, so again no warn
  point. Docs + release notes are the signal.
- **`<field-field>` (#5)** — a `console.warn` on `connectedCallback` of the alias tag **is** feasible and
  is the one place a dev-only deprecation log would actually reach a consumer. Recommended if/when it is
  deprecated.
- **`@fundamental-engine/platform` (#6)** — the package can emit a one-time dev-only `console.warn` from
  its entry module when imported. Recommended to add now (it is already declared deprecated), gated to
  `process.env.NODE_ENV !== 'production'`.

## RC1 / `1.0` shipping decision

RC1 / `1.0` **ships all six living aliases** (none are removed for the freeze). This document is the
record that they are *intentionally temporary*, not permanent API, and the place where their removal
versions get committed once the maintainer signs off on the table above.
