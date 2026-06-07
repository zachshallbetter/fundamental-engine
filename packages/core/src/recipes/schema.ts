/**
 * FieldRecipe schema + validation + serialization (authoring-and-recipes §5, system-contracts §13).
 * A recipe is a portable, serializable, inspectable field program: the natural field it translates,
 * the engine primitives + bodies/forces, the render stack, metrics, diagnostics, accessibility
 * behavior, budget, and expected conformance. Validation checks the shape and that every reference is
 * real — every force token is a passported force, every render layer + diagnostic is a known mode,
 * the declared primitives match the body tokens, and the natural field is one of the four — so a
 * recipe can't reference anything the engine doesn't have.
 */
import type { Token } from '../core/types.ts';
import type { PerformanceBudget } from '../contracts/types.ts';
import type { FundamentalField } from '../config/manual.ts';
import { FUNDAMENTAL_FIELDS } from '../config/manual.ts';
import { passportFor } from '../contracts/passport.ts';

/** A render layer in a scene's stack (matter / structure / scalar surfaces). */
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

/** A diagnostic mode that reveals a recipe's behavior (the debug / scalar / graph overlays). */
export type DiagnosticMode =
  | 'force-vectors'
  | 'contours'
  | 'potential'
  | 'energy'
  | 'topology'
  | 'inspector'
  | 'causality'
  | 'prediction';

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

/**
 * A portable field recipe (authoring §5) — the reusable unit that connects the natural-field model,
 * engine primitives, DOM authoring, platform feedback, diagnostics, and the accessibility fallback.
 */
export interface FieldRecipe {
  /** stable kebab-case id (e.g. `priority-well`) — the recipe's identity across the docs + gallery. */
  id: string;
  name: string;
  intent: string;
  /** the fundamental field this recipe translates (gravity / electromagnetic / strong / weak), if one dominates. */
  naturalField?: FundamentalField;
  /** the engine primitives this recipe uses — the distinct body tokens, in first-seen order. */
  primitives: string[];
  bodies: BodyRecipe[];
  relationships?: RelationshipRecipe[];
  render: RenderLayer[];
  /** the feedback metrics this recipe tracks (signal names; `--field-density` is the one written today). */
  metrics: string[];
  /** diagnostic / render modes that reveal this recipe's behavior in the inspector + Lab. */
  diagnostics: string[];
  /** the reduced-motion + meaning-without-motion equivalent — required: no recipe is motion-only. */
  accessibility: AccessibilityRecipe;
  budget?: Partial<PerformanceBudget>;
  expected?: ExpectedMetrics;
  notes?: string;
}

/** @deprecated renamed to {@link FieldRecipe}. */
export type SceneRecipe = FieldRecipe;

/** A reusable render stack (authoring §6). */
export interface VisualizationPreset {
  name: string;
  layers: RenderLayer[];
  notes?: string;
}

const RENDER_LAYERS: ReadonlySet<string> = new Set<RenderLayer>([
  'particles', 'dots', 'trails', 'links', 'streamlines', 'metaballs', 'voronoi', 'field-lines', 'heatmap',
]);

const DIAGNOSTIC_MODES: ReadonlySet<string> = new Set<DiagnosticMode>([
  'force-vectors', 'contours', 'potential', 'energy', 'topology', 'inspector', 'causality', 'prediction',
]);

/** Every render + diagnostic mode id a recipe may reference (mirrors `RENDER_MODES` + `particles`). */
export const FIELD_MODES: ReadonlySet<string> = new Set<string>([...RENDER_LAYERS, ...DIAGNOSTIC_MODES]);

const VALID_FIELDS: ReadonlySet<string> = new Set<string>(FUNDAMENTAL_FIELDS);

/** The distinct engine primitives used across a recipe's bodies, in first-seen order. */
export function primitivesOf(bodies: readonly BodyRecipe[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of bodies ?? [])
    for (const t of (b.body ?? '').split(/\s+/).filter(Boolean))
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
  return out;
}

export interface RecipeProblem {
  path: string;
  issue: string;
}

/**
 * Validate a recipe's shape and references. Returns every problem (empty = valid). Each force token
 * must be a real, passported force; each render layer + diagnostic must be a known mode; the declared
 * primitives must match the body tokens; the natural field must be one of the four.
 */
export function validateRecipe(r: FieldRecipe): RecipeProblem[] {
  const problems: RecipeProblem[] = [];
  if (!r.id) problems.push({ path: 'id', issue: 'required' });
  if (!r.name) problems.push({ path: 'name', issue: 'required' });
  if (!Array.isArray(r.bodies) || r.bodies.length === 0)
    problems.push({ path: 'bodies', issue: 'at least one body is required' });
  (r.bodies ?? []).forEach((b, i) => {
    const tokens = (b.body ?? '').split(/\s+/).filter(Boolean) as Token[];
    if (tokens.length === 0) problems.push({ path: `bodies[${i}].body`, issue: 'empty force token list' });
    for (const t of tokens)
      if (!passportFor(t)) problems.push({ path: `bodies[${i}].body`, issue: `unknown force token "${t}"` });
  });
  // declared primitives must be exactly the distinct body tokens (no drift between data and bodies).
  const derived = primitivesOf(r.bodies ?? []);
  const declared = r.primitives ?? [];
  if (declared.length !== derived.length || derived.some((t) => !declared.includes(t)) || declared.some((t) => !derived.includes(t)))
    problems.push({ path: 'primitives', issue: `must list exactly the body tokens (expected: ${derived.join(', ') || 'none'})` });
  (r.render ?? []).forEach((layer, i) => {
    if (!RENDER_LAYERS.has(layer)) problems.push({ path: `render[${i}]`, issue: `unknown render layer "${layer}"` });
  });
  (r.diagnostics ?? []).forEach((mode, i) => {
    if (!FIELD_MODES.has(mode)) problems.push({ path: `diagnostics[${i}]`, issue: `unknown diagnostic mode "${mode}"` });
  });
  if (r.naturalField !== undefined && !VALID_FIELDS.has(r.naturalField))
    problems.push({ path: 'naturalField', issue: `unknown fundamental field "${r.naturalField}"` });
  if (!r.accessibility || !r.accessibility.reducedMotion || !r.accessibility.meaningWithoutMotion)
    problems.push({ path: 'accessibility', issue: 'reducedMotion + meaningWithoutMotion are required (no recipe is motion-only)' });
  return problems;
}

/** Serialize a recipe to canonical JSON. */
export function serializeRecipe(r: FieldRecipe): string {
  return JSON.stringify(r, null, 2);
}

/** Parse + validate a recipe from JSON; throws on invalid shape. */
export function parseRecipe(json: string): FieldRecipe {
  const r = JSON.parse(json) as FieldRecipe;
  const problems = validateRecipe(r);
  if (problems.length) throw new Error(`invalid recipe: ${problems.map((p) => `${p.path} (${p.issue})`).join('; ')}`);
  return r;
}
