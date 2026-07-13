# Field Formation Terminology

## Status

**SUPERSEDED — implemented, but not as proposed below.** The concept landed as **Field Pattern**
("Pattern"), not "Field Formation" — and unlike this proposal's "no API rename," the API *was*
renamed end-to-end (`FieldRecipe`→`FieldPattern`, `compileRecipe`→`compilePattern`, `applyRecipe`→
`applyPattern`, `FIELD_RECIPES`→`FIELD_PATTERNS`, …), with `@deprecated` aliases of the old names kept
through `1.0`. The three-lane split this doc proposes (Pattern / Field Formation / FieldRecipe) also
collapsed into one lane: **Pattern** is both the concept and the (renamed) API. See
[`documentation-standards.md`](../../canonical/documentation-standards.md) and
[`deprecation-plan.md`](../../canonical/deprecation-plan.md) for the shipped decision. Kept below as
the historical record of the original proposal — do not treat the terminology below as current.

Proposed canonical terminology refinement. Documentation-only. No API rename.

## Purpose

Fundamental needs a precise conceptual term for the authored arrangement that combines semantic intent, dimensions, bodies, fields, forces, relationships, metrics, diagnostics, projections, and accessibility equivalents.

The existing API term is `FieldRecipe`. That should remain unchanged. The conceptual term should become **Field Formation**.

## Core definition

A **Field Formation** is an authored arrangement of semantic intent, dimensions, bodies, fields, forces, relationships, metrics, diagnostics, projections, and accessibility equivalents.

A **FieldRecipe** is the current API representation of a Field Formation.

A **Field Contract** is the compiled executable plan.

A **Pattern** is the human-facing reusable behavior name.

## Terminology lanes

| Term | Lane | Meaning |
|---|---|---|
| Pattern | Human-facing reusable behavior name | The product/design-language name people use to discuss a behavior. |
| Field Formation | Canonical conceptual authored arrangement | The field-native composition of intent, dimensions, bodies, fields, forces, relationships, metrics, diagnostics, projections, and accessibility equivalents. |
| FieldRecipe | Current API representation | The current TypeScript/schema/catalog representation of a Field Formation. |
| Field Contract | Compiled executable plan | The compiled plan produced from the authored representation. |
| Configuration | Ordinary settings/options only | Runtime, host, render, engine, or environment settings. Not the authored field arrangement. |
| Matter | Participants/substance only | Bodies, particles, records, users, data, or other field participants. Not an authored arrangement. |

## Why this change matters

“Configuration” is too generic. It already means ordinary software settings. Using it for authored field behavior creates ambiguity:

```txt
render configuration
host configuration
engine configuration
field configuration
```

These should not all mean the same kind of thing.

“Field Formation” is field-native. It implies arrangement, structure, and behavior taking form. It is specific enough to carry doctrine, broad enough to include recipes, and separate from shipped API names.

## What does not change

Do not rename any frozen or shipped API symbols.

Keep unchanged:

```txt
FieldRecipe
compileRecipe
applyRecipe
FIELD_RECIPES
RecipeTier
RecipeStatus
recipe catalog
recipe validation
recipe routes
check:recipes
```

This is a documentation and terminology refinement only.

## Canonical doctrine

Use this lane doctrine in canonical docs:

```txt
Concepts describe.
Dimensions hold state.
Fields structure.
Relationships associate.
Forces couple.
Tokens execute.
Metrics measure.
Diagnostics explain.
Conditions activate.
Projections reveal.
Formations compose.
FieldRecipe represents.
Contracts execute.
No word lives in two lanes.
```

## Conceptual stack

```txt
Pattern
  human-facing reusable behavior name

Field Formation
  canonical conceptual authored arrangement

FieldRecipe
  current API representation of a Field Formation

Field Contract
  compiled executable plan

Runtime execution
  bodies, fields, forces, metrics, diagnostics, projections, events
```

## Example

Human-facing Pattern:

```txt
Evidence Field
```

Canonical concept:

```txt
A Field Formation that maps claims, sources, support, contradiction, confidence, provenance, and accessibility equivalents into field behavior.
```

Current API representation:

```ts
const recipe: FieldRecipe = FIELD_RECIPES.evidenceField;
```

Compiled executable plan:

```ts
const contract = compileRecipe(recipe);
```

Runtime application:

```ts
applyRecipe(root, recipe, { field });
```

## Wording rules

Use **Field Formation** when explaining the conceptual model.

Use **FieldRecipe** when referring to the current schema, catalog, compiler, validator, route, or API.

Use **Pattern** when referring to a human-facing reusable behavior name.

Use **Field Contract** when referring to the compiled executable plan.

Use **configuration** only for ordinary settings/options.

Use **matter** only for participants/substance.

## Correct phrasing

```txt
A Field Formation decides which associations become couplings.
```

```txt
A FieldRecipe is the current API representation of a Field Formation.
```

```txt
The Evidence Field Pattern is implemented as a Field Formation and represented today as a FieldRecipe.
```

```txt
The Field Contract is the compiled executable plan used by the runtime.
```

## Avoid

```txt
A configuration decides which associations become couplings.
```

Use instead:

```txt
A Field Formation decides which associations become couplings.
```

Avoid:

```txt
Matter composes behavior.
```

Use instead:

```txt
Field Formations compose behavior. Matter participates in the field.
```

Avoid:

```txt
Recipes are the conceptual layer.
```

Use instead:

```txt
Field Formations are the conceptual layer. FieldRecipe is the current API representation.
```

## Documentation impact

Update the canonical docs, site docs, and generated `llms-full.txt` so they teach this terminology consistently.

Priority files:

```txt
docs/canonical/README.md
docs/canonical/dimensional-coupling.md
docs/canonical/natural-fields.md
docs/canonical/authoring-and-recipes.md
docs/canonical/designed-vs-natural-map.md
docs/planning/substrate-architecture-frontier.md
apps/site/src/pages/docs/* where conceptual recipe/configuration language appears
```

## Acceptance checklist

- No TypeScript/API symbols are renamed.
- No files, routes, catalog identifiers, validators, or checks are renamed.
- “Field Formation” appears as the canonical conceptual term.
- “FieldRecipe” is described as the current API representation of a Field Formation.
- “Field Contract” is defined as the compiled executable plan.
- “Pattern” is defined as the human-facing reusable behavior name.
- “Configuration” is reserved for ordinary settings/options.
- “Matter” is reserved for participants/substance.
- The lane doctrine is updated consistently.
- `llms-full.txt` is regenerated.
- Documentation gates pass.
