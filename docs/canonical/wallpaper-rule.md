# The Wallpaper Rule

> **The field is a substrate, not wallpaper.** This document is that sentence made operational —
> a test you can run a feature through, the remedies when it fails, and the guards that enforce it.
> Established 2026-07-02 by the doctrine audit and the pre-1.0 honesty wave that executed it
> (#973–#985); the structural sequel (the Carrier Seam) is
> `docs/planning/critical-path/06-carrier-seam.md`.

## The rule

A behavior or visual is **wallpaper** — and violates this rule — iff **all three** hold:

```txt
1. Its structure is hardcoded or index-derived —
   not derived from the host's content, data, or measured field state.

2. It is identical across any two projects with different content.

3. It is present by default, or implicitly claims to be the field's expression.
```

Prong 3 is what separates wallpaper from decoration. **Decoration is legal when declared**:
opt-in and truth-mode passported ([system-contracts.md](system-contracts.md),
[fundamental-field-behavior-table.md](fundamental-field-behavior-table.md)). The presets and
patterns were never the problem; the Currents were, because they were default-on and undeclared.

A feature that fails only prong 1 — a content-independent reference point or unseeded
randomness *inside* an otherwise honest feature — is a **gray debt**, not wallpaper: it gets
declared (exposed as a passported option) or derived, not demoted.

## The remedies — in preference order, never deletion

```txt
Derive    — replace the painted structure with measured state.
            (the honest fix: the `field` carrier; the homepage proof reading real --d)

Declare   — expose the constant as a documented, passported option.
            (the render reference points: anchor, observer, focal, fade)

Demote    — default off; the feature stays, as explicit opt-in.
            (the waves, #979/#985; the curl eddy; precedent: #538 render:'none')

Sugar     — when code relocates, the option surface remains as thin sugar over the
            new registration, so honesty never costs a breaking change.
            (waves/waveStyle/waveCenter survive the carrier-seam move unchanged)
```

## The corollaries

The rule extends beyond pixels — these are its enforced consequences:

- **Determinism is part of honesty.** Every source of engine randomness goes through the
  injected rng (`FieldOptions.rng`; JS #371, ports #983, remaining JS leaks #981). The clock
  (`now()`) is the second injected source — a reproducible run pins both. An unseeded run is a
  false replay claim ([substrate-api.md](substrate-api.md)).
- **One writer per reading.** A body belongs to the **nearest enclosing field** — the
  `data-field-boundary` ownership rule (#984). Two undeclared writers competing over one `--d`
  is wallpaper's dynamic cousin: a reading that reads nothing coherent.
- **Proofs must be produced.** Any surface that claims to show live field output must actually
  read it (#982; the inverse of the silent-contract gap — CSS that *pretends* to be
  field-driven is wallpaper even when the values look plausible). Data-backed examples declare
  their provenance ([invisible-fields.md](invisible-fields.md)).
- **The resting state of every plane is the same:** nothing painted, nothing imposed,
  everything readable. `render` defaults `'none'`; ambient wave behavior is controlled as
  an explicit surface policy (not as an implicit truth claim), and parity is pinned by tests.

## Lineage

```txt
#538   render: 'none'      — signals-first: drawing becomes opt-in
#979   waves demotion      — ambient structure treated as opt-in policy, not implied truth
06     Carrier Seam        — ambient structure becomes declared, readable, swappable
       (planning; the structural home for demoted wallpaper)
```

The rule generalizes #538 from *drawing* to *all ambient behavior*.

## Enforcement

Shipped guards (each plane pins its own honesty):

- **Honest defaults** — bare-field tests on every plane: no waves, no render, byte-identical
  to the explicit opt-out where the plane's contract requires it (`waves-default.test.ts`,
  Swift `WavesDefaultTests`, Kotlin `bareFieldBuildsNoWaves`).
- **Determinism suites** — seeded fingerprint tests per plane (JS `determinism.test.ts`,
  Kotlin `DeterminismTests`, Swift `DeterminismTests`/`EngineDeterminismTests`).
- **Ownership** — the scanner boundary tests (`scanner.boundary.test.ts`).

Planned (see the Carrier Seam doc): the **wallpaper lint** — a `physical`/`hybrid`-passported
carrier must derive from field state; painted structure may not claim physics.

When auditing a new feature against this rule, run the three prongs, classify
(wallpaper / gray / clean), and pick the *first* applicable remedy. The 2026-07-02 audit is
the worked example: 16 confirmed findings across five territories, every one dispositioned by
this taxonomy, six plausible findings refuted by re-reading the code — verify before acting
([documentation-standards.md](documentation-standards.md), the status rule).
