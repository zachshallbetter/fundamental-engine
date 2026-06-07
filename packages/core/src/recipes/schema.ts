/**
 * SceneRecipe schema + validation + serialization (authoring-and-recipes §5, system-contracts §13).
 * A recipe is a portable, serializable, inspectable scene definition: the bodies/forces, render
 * stack, metrics, accessibility behavior, budget, and expected conformance. Validation checks the
 * shape and that every force token is a real, passported force — so a recipe can't reference a
 * force that doesn't exist.
 */
import type { Token } from '../core/types.ts';
import type { PerformanceBudget } from '../contracts/types.ts';
import { passportFor } from '../contracts/passport.ts';

/** A render layer in a scene's stack. */
export type RenderLayer =
  | 'particles'
  | 'dots'
  | 'trails'
  | 'links'
  | 'streamlines'
  | 'metaballs'
  | 'voronoi'
  | 'field-lines'
  | 'heatmap';

/** One body in a recipe: a force token (or space-separated tokens) + attributes. */
export interface BodyRecipe {
  body: string;
  strength?: number;
  range?: number;
  spin?: number;
  angle?: number;
  feedback?: boolean;
  scope?: 'local' | 'global';
}

export interface RelationshipRecipe {
  from: string;
  to: string;
  type: string;
  strength?: number;
}

export interface AccessibilityRecipe {
  /** what replaces motion under prefers-reduced-motion. */
  reducedMotion: string;
  /** how meaning survives without color/motion. */
  meaningWithoutMotion: string;
}

export interface ExpectedMetrics {
  particleCount?: number;
  entropyRange?: [number, number];
  energyDriftMax?: number;
}

/** A portable field scene (authoring §5). */
export interface SceneRecipe {
  name: string;
  intent: string;
  bodies: BodyRecipe[];
  relationships?: RelationshipRecipe[];
  render: RenderLayer[];
  metrics: string[];
  accessibility?: AccessibilityRecipe;
  budget?: Partial<PerformanceBudget>;
  expected?: ExpectedMetrics;
  notes?: string;
}

/** A reusable render stack (authoring §6). */
export interface VisualizationPreset {
  name: string;
  layers: RenderLayer[];
  notes?: string;
}

const RENDER_LAYERS: ReadonlySet<string> = new Set<RenderLayer>([
  'particles', 'dots', 'trails', 'links', 'streamlines', 'metaballs', 'voronoi', 'field-lines', 'heatmap',
]);

export interface RecipeProblem {
  path: string;
  issue: string;
}

/**
 * Validate a recipe's shape and references. Returns every problem (empty = valid). Each force token
 * must be a real, passported force; each render layer must be known.
 */
export function validateRecipe(r: SceneRecipe): RecipeProblem[] {
  const problems: RecipeProblem[] = [];
  if (!r.name) problems.push({ path: 'name', issue: 'required' });
  if (!Array.isArray(r.bodies) || r.bodies.length === 0)
    problems.push({ path: 'bodies', issue: 'at least one body is required' });
  (r.bodies ?? []).forEach((b, i) => {
    const tokens = (b.body ?? '').split(/\s+/).filter(Boolean) as Token[];
    if (tokens.length === 0) problems.push({ path: `bodies[${i}].body`, issue: 'empty force token list' });
    for (const t of tokens)
      if (!passportFor(t)) problems.push({ path: `bodies[${i}].body`, issue: `unknown force token "${t}"` });
  });
  (r.render ?? []).forEach((layer, i) => {
    if (!RENDER_LAYERS.has(layer)) problems.push({ path: `render[${i}]`, issue: `unknown render layer "${layer}"` });
  });
  return problems;
}

/** Serialize a recipe to canonical JSON. */
export function serializeRecipe(r: SceneRecipe): string {
  return JSON.stringify(r, null, 2);
}

/** Parse + validate a recipe from JSON; throws on invalid shape. */
export function parseRecipe(json: string): SceneRecipe {
  const r = JSON.parse(json) as SceneRecipe;
  const problems = validateRecipe(r);
  if (problems.length) throw new Error(`invalid recipe: ${problems.map((p) => `${p.path} (${p.issue})`).join('; ')}`);
  return r;
}
