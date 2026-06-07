# field-ui Migration Report

**Date:** 2026-06-06
**Scope:** migration-plan Phases 1–3 (move → alias → docs). The agent / visual-language /
recipe expansion (Phases 4–8) is **deferred** per the plan's "expand the field-ui model third".
**Principle held:** *migration and cleanup, not a rewrite — preserve behavior first, rename and
alias second.*

## Outcome

| Gate | Result |
|---|---|
| Project runs from `field-ui/` | ✅ canonical root, git history preserved (HEAD `260a562`, branch `main`) |
| Typecheck | ✅ all 8 buildable projects clean |
| Test suite | ✅ **434 pass / 0 fail** (was 422 pre-migration; +12 migration tests) |
| Build | ✅ all packages + Astro site (24 pages) build |
| Dist smoke check | ✅ `field-ui`, `@field-ui/vanilla`, `@field-ui/elements`, `@field-ui/react` |
| Magnetism = Lorentz | ✅ 43 assertions incl. "does no work / speed preserved", "still charge feels no force", "neutral matter unaffected" |
| Fieldflow = field-aligned transport | ✅ "neutral matter following a charge field line" |
| Old public names still work | ✅ package / event / CSS-var / element aliases all verified |

No tests failed. No behavior changed.

## 1. What moved

- `~/Projects/forces` was copied into `~/Projects/field-ui` **with `.git`** (full history), excluding
  regenerable `node_modules/` and `dist/`. The pre-existing `field-ui/docs/` (the new doc set) was
  merged in; both doc sets now live under `docs/`.
- The original `~/Projects/forces` is **left untouched** as the verified fallback. Nothing was
  deleted.
- Toolchain: Node **v22.18.0** + pnpm **10.29.1** (via nvm — not the default shell Node 18).

## 2. What was preserved (unchanged behavior)

Force formulas, the integrator, **magnetism** (`F = q(v × B)`, perpendicular, does no work),
**fieldflow** (field-aligned transport), render math, heatmap math, force tokens
(`attract`/`repel`/`swirl`/…), Shadow-DOM event model, source/sink budgeting, density write-back,
and `data-*` authoring (`data-body`, `data-when`, `data-feedback`, `data-strength`, …) are all
byte-for-byte intact. The engine already satisfied the electromagnetic rule before the migration,
so no physics was touched.

## 3. What was renamed (canonical = field-ui)

| Old | New |
|---|---|
| `forces-ui` (core, unscoped) | `field-ui` |
| `@forces-ui/elements` / `react` / `vanilla` / `site` | `@field-ui/*` |
| `forces-ui-monorepo` | `field-ui-monorepo` |

All 29 `from 'forces-ui'` imports, 34 `@forces-ui/*` references, workspace deps, and root script
filters were updated. Product-name strings in the README, the Astro site (titles, prose, install
commands, demo copy), CONTRIBUTING, the core module header, and two thrown error messages were
rebranded to `field-ui`. The production domain was moved to **`field-ui.com`** (Astro `site:`,
canonical/OG URLs, package `homepage` fields, README/docs links). The GitHub repo URL
(`github.com/zachshallbetter/forces-ui`) is left as-is — the repository itself is not renamed.

## 4. Aliases added (old + new both resolve)

- **Packages** — 4 thin re-export shim packages keep the old import specifiers working:
  `packages/compat-core` → `forces-ui`, `compat-elements` → `@forces-ui/elements`,
  `compat-react` → `@forces-ui/react`, `compat-vanilla` → `@forces-ui/vanilla`. Each depends on
  and re-exports its `@field-ui/*` target (the elements shim also re-runs the element
  registration). Verified: importing the old names yields `createField`, `FORCES`, `ForcesField`,
  `mountField`, `REGISTER_BODY`, `useForcesField`.
- **Events** — `field:register-body` / `field:unregister-body` / `field:update-body` are now
  dispatched (`ForcesController`) and listened for (engine) **alongside** the `forces:*` names.
  Handlers are idempotent, so the paired dispatch is safe.
- **CSS variables** — `--field-density` and `--field-heatmap-density` are written alongside
  `--forces-density` / `--forces-heatmap-density` (identical values); cleanup clears both.
- **Components** — `<field-root>`, `<field-field>` (⊂ `ForcesField`) and `<field-cell>`
  (⊂ `ForcesCell`) register alongside `<forces-field>` / `<forces-cell>`. React adds
  `FieldField` / `useFieldField` / `FieldFieldProps`; vanilla adds a `FieldField` class alias.

## 5. Migration tests added (+12)

- `packages/core/src/core/shadow.test.ts` (+3): `field:*` constants; controller dispatches both
  `forces:*` and `field:*` twins; `field:*` payload identical and composed.
- `packages/core/src/core/migration.test.ts` (+5): package metadata uses field-ui; deps point at
  field-ui; compat packages keep old names and forward; CSS write-both source contract; built
  alias dist re-exports the surface.
- `packages/elements/src/migration.test.ts` (+2): `field-*` element aliases subclass their
  originals; elements re-exports the `field:*` constants.
- `packages/vanilla/src/migration.test.ts` (+2): `FieldField` is an alias of `ForcesField`;
  `mountField` exported.

## 6. Docs

- The new `field-ui/docs/` set is canonical; `docs/README.md` is the map and now also points to the
  legacy `forces-*.md` as the **as-built behavior baseline** (kept, not deleted — they document
  current behavior under the old names, which still work).
- Root `README.md` rebranded with a prominent rename/alias note and links to the migration plan +
  docs map. `CHANGELOG.md` gained an additive "Migrated to field-ui" entry (history not rewritten).
- No hardcoded `force/` **directory** paths exist outside the migration docs (the other `force/`
  hits are prose like "force/condition registry"). All checked internal doc links resolve.

## 7. What remains / deferred (not in this pass)

- **Element tags inside the site demos** still use the working `<forces-field>` alias (the README
  quick-start uses `<field-root>`). Switching the demos is optional polish; behavior is identical.
- **Legacy `forces-*.md` docs** still use old naming throughout (kept intentionally as the behavior
  reference). A future pass can fold them into the field-first docs.
- **GitHub repo URL** (`github.com/zachshallbetter/forces-ui`) is unchanged — the repository is not
  renamed. The production domain is now `field-ui.com`.
- **Alias removal**: the `forces-ui` / `@forces-ui/*` packages, `forces:*` events, `--forces-*`
  vars, and `<forces-*>` elements are kept until a future major, per the alias deprecation policy.
- **Phases 4–8** (FieldAgent model, visual-language layer, recipe/intent compiler, productization)
  are the intended next work, after this stabilized base.

## 8. Validation checklist (migration-plan §17)

✅ runs from field-ui/ · ✅ typecheck · ✅ tests · ✅ Lab/site builds · ✅ docs links resolve ·
✅ examples use new naming (imports + product name) · ✅ old names work as aliases · ✅ CSS writes
both · ✅ events support both · ✅ package metadata uses field-ui · ✅ no hardcoded `force/` path
(except migration notes) · ✅ no behavior change · ✅ magnetism proves Lorentz · ✅ fieldflow proves
field-aligned transport.
