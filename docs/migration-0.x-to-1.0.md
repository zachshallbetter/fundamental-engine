# Migrating 0.x → 1.0

> The 1.0 surface and its stability promise are in
> [`planning/1.0-surface.md`](planning/1.0-surface.md); the support/semver policy is in
> [`../SUPPORT.md`](../SUPPORT.md). This note is the upgrade checklist (RC-9 — closes #326).

**The good news:** 0.x was already frozen-and-additive, so 1.0 introduces **almost no breakage**. There
is exactly **one behavior change** to act on, plus a packaging change. Everything else is additive.

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

## 3. Everything else is additive — nothing to change

These all arrived in 0.8.x as **new** options/methods/exports; nothing existing changed:

- **Contained fields** — `new FieldField({ bounds: el })` / `containerHost(el)`.
- **Theming** — `theme` / `gradientCool` / `gradientWarm` / `waveBaseline` (`'warm'` default = the old look).
- **Events** — `field.on('enter' | 'exit' | 'met', …)`.
- **Adaptive quality** — `setQualityTier`, applied automatically by `<field-root>`.
- **`field.version`** / `FIELD_VERSION`, the `grid` overlay's `gridIntensity`, the unified `createField`
  (host/bounds resolution).

See the [CHANGELOG](../CHANGELOG.md) for the full list.

## 4. Versioning from 1.0

`1.x` is **additive only** — new options/methods/exports, never a break to the
[Stable surface](planning/1.0-surface.md). Breaking changes wait for `2.0`, after the deprecation window.
Full policy: [`SUPPORT.md`](../SUPPORT.md).
