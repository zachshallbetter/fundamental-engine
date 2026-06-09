// Generate `data/recipes.json` — a deterministic, framework-agnostic JSON datafile of the field-ui
// recipe catalog, derived from the single source of truth (packages/core/src/recipes/catalog.ts).
//
// The catalog lives in TypeScript (so it can carry types + a conformance fixture); this emits the
// same 64 records as plain JSON for consumers that want the data without importing the package
// (the site recipes hub, external tooling, docs). Deterministic output (no timestamp) so it can be
// committed and a `check` can re-run + diff to catch drift.
//
//   node --experimental-strip-types scripts/export-recipes.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIELD_RECIPES, RECIPE_TIERS } from '../packages/core/src/recipes/catalog.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data = {
  count: FIELD_RECIPES.length,
  tiers: RECIPE_TIERS.map((t) => ({ key: t.key, label: t.label, recipeIds: t.recipes.map((r) => r.id) })),
  recipes: FIELD_RECIPES,
};

mkdirSync(resolve(root, 'data'), { recursive: true });
const out = resolve(root, 'data/recipes.json');
writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
console.log(`wrote data/recipes.json — ${data.count} recipes across ${data.tiers.length} tiers (${data.tiers.map((t) => t.key).join(', ')})`);
