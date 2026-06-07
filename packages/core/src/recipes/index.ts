/**
 * Authoring & recipes (Phase 7 — authoring-and-recipes). The serializable SceneRecipe schema, the
 * intent compiler, the essential-recipe gallery, and the Explain-This-Field / Field-Diff helpers —
 * the engine-side substance a Composer/Inspector UI builds on. Pure + node-testable.
 */
import type { ContractMeta } from '../contracts/types.ts';

export * from './schema.ts';
export * from './intent.ts';
export * from './gallery.ts';
export * from './explain.ts';

/** The Recipe / Authoring contracts (system-contracts §13). */
export const RECIPE_CONTRACTS: readonly ContractMeta[] = [
  {
    name: 'Scene Recipe Contract',
    mustExist: 'name, intent, bodies, render, metrics (+ optional relationships, accessibility, budget, expected, notes)',
    mayMutate: 'nothing — a recipe is data; applying it builds a scene',
    sideEffectFree: 'serialize / parse / validate are pure',
    testable: 'validateRecipe rejects unknown force tokens and render layers; round-trips through JSON',
    inspectable: 'the recipe is plain serializable data; explainScene renders it in plain language',
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
