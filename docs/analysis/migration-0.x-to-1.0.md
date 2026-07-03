# Migrating 0.x → 1.0

> The 1.0 surface and its stability promise are in
> [`../planning/1.0-surface.md`](../planning/1.0-surface.md); the support/semver policy is in
> [`../../SUPPORT.md`](../../SUPPORT.md). This note is the upgrade checklist (RC-9 — closes #326).

**The good news:** 0.x was already frozen-and-additive, so 1.0 introduces **almost no breakage**. There
is exactly **one behavior change** to act on, a packaging change, and a small set of migration-era
**aliases that get removed**. If you already use canonical naming (`field:*` events, `--load`,
`@fundamental-engine/dom`), the alias removals are a no-op for you. Everything else is additive.

## 1. `render` now defaults to `'none'` (signals-first) — the one thing to check

Since **0.8.0 (#538)**, a field created without an explicit `render` mode runs the full simulation and
writes its `--field-*` signals but **draws nothing**. If you relied on the old implicit particle field,
add `render: 'dots'` (or another mode):

```diff
- new FieldField({ accent: '#4da3ff' })            // 0.7.x: drew particles
+ new FieldField({ accent: '#4da3ff', render: 'dots' })   // 1.0: opt into the particle surface

- <field-root accent="#4da3ff"></field-root>
+ <field-root render="dots" accent="#4da3ff"></field-root>
```

If "nothing is showing" after upgrading, this is why — the field is live (read its `--field-*`
variables), it just isn't *drawing*. Unaffected: `<field-cell>` (its own pool), recipes (set their own
render), and any call already passing `render`.

## 2. The umbrella packages are gone

`@fundamental-engine/kit` and the `fundamental-engine` umbrella were retired in 0.7.0 — they no
longer publish (hollow stub dirs may remain as pnpm artifacts). Install the specific package(s) you
use:

```diff
- npm i fundamental-engine            # or @fundamental-engine/kit
+ npm i @fundamental-engine/vanilla   # the framework-free door (or /react, /elements, /core)
```

## 3. Migration-era aliases removed at 1.0

The `forces-ui → field-ui → Fundamental` rename left a handful of **living aliases** — passive mirrors
(an extra event, an extra CSS-var write, a re-export) kept so consumers on the new naming who still
listen for an old event, read an old var, or import the old package name did not break. They shipped
through the whole `0.x` line; **1.0 removes them.** Each removal is a mechanical find-and-replace on the
consumer side. The full policy is [`../canonical/deprecation-plan.md`](../canonical/deprecation-plan.md); the
per-alias table:

| Old form | New form (do this) | Why it's going away |
|---|---|---|
| `el.addEventListener('forces:captured', …)` (also `forces:released`, `forces:relocated`) | `el.addEventListener('field:captured', …)` | The `forces:*` events are a rename-era mirror of the canonical `field:*` events; the engine dispatched both. Listen for `field:*` only. |
| CSS reads `var(--mass)` on a `data-feedback` body | CSS reads `var(--load)` | `--load` is the canonical sink-load channel; `--mass` was a back-compat alias written alongside it. Point your CSS/selectors at `--load`. |
| `import { … } from '@fundamental-engine/platform'` | `import { … } from '@fundamental-engine/dom'` | The DOM-binding package was renamed in 0.7.0; `@fundamental-engine/platform` shipped as a thin re-export alias. Switch the import; the exports are identical. |
| `<field-field>` used as the page-field tag | `<field-root>` | `<field-field>` was registered as a secondary alias for the singleton field. Use `<field-root>`. (The maintainer may bless `<field-field>` as permanent at the cut — confirm against the removal checklist before relying on either.) |

**Kept permanently — do NOT migrate away from these (they are canonical dual naming, not deprecated):**

- `--d` and `--field-density` — the terse and spelled-out density vars. Both stay forever; author CSS
  may read either.
- `--load` — the canonical sink-load channel (it is `--mass` that is the alias *of* `--load`, above,
  not the reverse).

### Early-warning path (already shipping in `0.x`)

You do not have to wait for `1.0` to find these — the runtime-observable aliases already warn in
development. In a non-production build (`NODE_ENV !== 'production'`):

- **`forces:*` events** log a one-time (per event name, deduped) `console.warn` at the dispatch site,
  so a body firing every frame warns at most once.
- **`@fundamental-engine/platform`** logs a one-time `console.warn` when the package is first imported.

The CSS-var alias (`--mass`) and the `<field-field>` tag are **doc-only** — a `var(--mass)` read happens
in the style engine and is invisible to JS, so there is no runtime warning; watch this note and the
release notes instead. Run your app once in dev before upgrading and clear any `[Fundamental:DEPRECATED_ALIAS]`
warnings and you are done.

Already gone (removed at `0.7.0`, listed so you do not go looking): the `<forces-field>`/`<forces-cell>`
tags, the `ForcesField`/`ForcesController`/`useForcesField` exports, the `--forces-*` CSS vars, and the
`@fundamental-engine/compat-*` packages. If you are on a `0.7.0+` release you have already migrated off
these.

## 3a. Event-bus keys `absorb` / `release` renamed to `captured` / `released`

The discrete event bus (`field.on(type, cb)`) renamed two of its keys in the pre-1.0 breaking window.
`absorb` was a **naming-lane violation** — `absorb` is concept language (the runtime token is `sink`),
not an execution-lane name; the occurrence a consumer subscribes to is that a body *captured* / *released*
matter. The new keys are the past-tense occurrence verbs `captured` / `released`, which also match the
native ports (Swift `CaptureEvent.captured/released`, Kotlin `CaptureEvent.CAPTURED/RELEASED`).

```diff
- field.on('absorb', (e) => { … })   // e = { body, count }
+ field.on('captured', (e) => { … })

- field.on('release', (e) => { … })
+ field.on('released', (e) => { … })
```

Only the **bus keys** change. Untouched: the `data-absorb` sink body attribute, the `--load` channel,
and the DOM `field:captured` / `field:released` `CustomEvent`s (already canonical).

## 4. Everything else is additive — nothing to change

These all arrived in 0.8.x as **new** options/methods/exports; nothing existing changed:

- **Contained fields** — `new FieldField({ bounds: el })` / `containerHost(el)`.
- **Theming** — `theme` / `gradientCool` / `gradientWarm` / `waveBaseline` (`'warm'` default = the old look).
- **Events** — `field.on('enter' | 'exit' | 'met', …)`.
- **Adaptive quality** — `setQualityTier`, applied automatically by `<field-root>`.
- **`field.version`** / `FIELD_VERSION`, the `grid` overlay's `gridIntensity`, the unified `createField`
  (host/bounds resolution).

See the [CHANGELOG](../../CHANGELOG.md) for the full list.

## 5. Versioning from 1.0

`1.x` is **additive only** — new options/methods/exports, never a break to the
[Stable surface](../planning/1.0-surface.md). Breaking changes wait for `2.0`, after the deprecation window.
Full policy: [`../../SUPPORT.md`](../../SUPPORT.md).

---

*Maintainers:* the file-level inventory of exactly what gets deleted at the cut (source sites, tests,
cross-plane notes) is in [`../planning/1.0-removal-checklist.md`](../planning/1.0-removal-checklist.md). That
list is the mechanical removal spec; this note is the consumer-facing upgrade guide.
