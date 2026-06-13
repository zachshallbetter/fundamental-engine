/**
 * Authoring & recipes (Phase 7 — authoring-and-recipes). The serializable FieldRecipe schema, the
 * intent compiler, the field-recipe gallery (the 16 named recipes mapped to the four-field model),
 * and the Explain-This-Field / Field-Diff helpers — the engine-side substance a Composer/Inspector UI
 * builds on. Pure + node-testable.
 */
import type { ContractMeta } from '../contracts/types.ts';

export * from './schema.ts';
export * from './intent.ts';
export * from './gallery.ts';
export * from './wayfinding.ts';
export * from './charge.ts';
export * from './gravity.ts';
export * from './explain.ts';
export * from './compile.ts';

/** The Recipe / Authoring contracts (system-contracts §13). */
export const RECIPE_CONTRACTS: readonly ContractMeta[] = [
  {
    name: 'Field Recipe Contract',
    mustExist: 'id, name, intent, primitives, bodies, render, metrics, diagnostics, accessibility (+ optional naturalField, relationships, budget, expected, notes)',
    mayMutate: 'nothing — a recipe is data; applying it builds a scene',
    sideEffectFree: 'serialize / parse / validate are pure',
    testable: 'validateRecipe rejects unknown tokens, render layers, diagnostics, and fields; primitives must match the body tokens; round-trips through JSON',
    inspectable: 'the recipe is plain serializable data; explainScene renders it in plain language',
  },
  {
    name: 'Recipe Runtime Contract',
    mustExist: 'compileRecipe(recipe) → a runtime plan (bodies/relationships/feedback/diagnostics/metrics/conditions/reducedMotion); applyRecipe(root, recipe) registers it and returns an inspectable, destroyable handle (@fundamental-engine/platform)',
    mayMutate: 'applyRecipe mutates the DOM it is given (registers bodies, writes --field-* vars); compileRecipe is pure',
    sideEffectFree: 'compileRecipe / recipeToMarkup are pure; applyRecipe owns its lifecycle and cleans up on destroy()',
    testable: 'compiled bodies carry only real tokens (concepts never become tokens); metrics map to --field-* feedback; every shipped recipe compiles a reduced-motion output path',
    inspectable: 'applied.inspect() returns live measurements, relationships, metric values, and lint',
  },
  {
    name: 'Intent Compiler Contract',
    mustExist: 'a mapping from author intent to concrete force tokens + render layers',
    mayMutate: 'nothing — it returns a compiled composition',
    sideEffectFree: 'compileIntent is pure; unknown intents return null (no silent defaults)',
    testable: 'each intent compiles to real, passported tokens; output is inspectable',
    inspectable: 'the compiled data-body / data-render the author can read back',
  },
];
