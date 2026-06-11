/**
 * Recipe compiler (authoring-and-recipes §5). Turns a portable `FieldRecipe` from validated catalog
 * data into a runtime plan — the bridge from "recipe as record" to "recipe as program". Pure +
 * node-testable; the DOM-applying counterpart is `applyRecipe` in `@field-ui/platform`.
 *
 * The lane split is preserved on purpose:
 *   concepts describe · tokens execute · metrics measure · diagnostics explain · conditions activate.
 * Only the `primitives` lane (the runtime tokens) becomes `data-body` behavior. Concepts are carried
 * through descriptively and NEVER compiled into force tokens; metrics become feedback-variable
 * bindings; diagnostics become inspector/render toggles; conditions become activation gates;
 * accessibility becomes a reduced-motion output plan.
 */
import type { BodyRecipe, FieldRecipe } from './schema.ts';

/** The CSS feedback variable a metric writes to (`attention` → `--field-attention`). */
export function metricVar(metric: string): string {
  return `--field-${metric}`;
}

/** The data-* attributes a single recipe body authors onto an element (token lane → behavior). */
export function recipeBodyAttributes(b: BodyRecipe): Record<string, string> {
  const a: Record<string, string> = { 'data-body': b.body };
  if (b.strength != null) a['data-strength'] = String(b.strength);
  if (b.range != null) a['data-range'] = String(b.range);
  if (b.spin != null) a['data-spin'] = String(b.spin);
  if (b.angle != null) a['data-angle'] = String(b.angle);
  if (b.feedback) a['data-feedback'] = '';
  if (b.when) a['data-when'] = b.when; // the executable per-body gate (#370) — validated against the registry
  return a;
}

/** The executable form of a recipe's render stack (#370): which Field Surface each declared
 *  layer drives. One matter mode owns the underlay; overlay readings stack additively; heatmap
 *  is its own toggle. Layers with no executable surface yet are NAMED in `unapplied` — never
 *  silently dropped (the no-silent-caps rule). */
export interface RecipeRenderPlan {
  /** the underlay matter mode (`setRender`), or null to leave the field's current mode alone. */
  underlay: string | null;
  /** the additive overlay reading stack (`setOverlay`); empty = 'off'. */
  overlay: string[];
  /** drive the density heatmap layer (`setHeatmap`). */
  heatmap: boolean;
  /** declared layers with no executable surface today — visible, not silently dropped. */
  unapplied: string[];
}

const MATTER_MODES = new Set(['particles', 'dots', 'trails', 'links', 'metaballs', 'voronoi']);
const OVERLAY_READINGS = new Set(['streamlines', 'force-vectors', 'field-lines', 'grid', 'temperature', 'energy', 'path', 'data']);

/** Derive the render plan from a recipe's declared layers (pure; `particles` is the base matter
 *  layer and maps to `dots`). `streamlines` prefers the overlay (it reads over content) unless it
 *  is the recipe's ONLY layer, where the underlay render mode of the same name serves. */
export function recipeRenderPlan(layers: readonly string[]): RecipeRenderPlan {
  let underlay: string | null = null;
  const overlay: string[] = [];
  let heatmap = false;
  const unapplied: string[] = [];
  for (const layer of layers) {
    if (layer === 'heatmap') heatmap = true;
    else if (MATTER_MODES.has(layer)) {
      const mode = layer === 'particles' ? 'dots' : layer;
      if (underlay === null) underlay = mode;
      else unapplied.push(layer); // one underlay only — the second matter mode is named, not silently dropped
    } else if (OVERLAY_READINGS.has(layer)) overlay.push(layer);
    else unapplied.push(layer);
  }
  if (underlay === null && overlay.length === 1 && overlay[0] === 'streamlines' && layers.length === 1) {
    underlay = 'streamlines';
    overlay.length = 0;
  }
  return { underlay, overlay, heatmap, unapplied };
}

/** One compiled body: the attribute set + the runtime tokens it carries. */
export interface RecipeBodyRegistration {
  attributes: Record<string, string>;
  tokens: string[];
}

/** A relationship the recipe declares (from/to are conceptual endpoints, resolved at apply time). */
export interface RecipeRelationshipRegistration {
  from: string;
  to: string;
  type: string;
  strength?: number;
}

/** A metric → feedback-variable binding (the metric lane becoming measurable state). */
export interface RecipeFeedbackBinding {
  metric: string;
  var: string;
}

/** The reduced-motion output plan — what the runtime renders when motion is reduced (not just prose). */
export interface RecipeReducedMotionPlan {
  reducedMotion: string;
  meaningWithoutMotion: string;
  /** the static surfaces the runtime should render in place of motion. */
  staticOutputs: string[];
}

/** A compiled recipe — the runtime plan, lanes preserved. */
export interface CompiledRecipe {
  id: string;
  recipe: FieldRecipe;
  bodies: RecipeBodyRegistration[];
  relationships: RecipeRelationshipRegistration[];
  feedback: RecipeFeedbackBinding[];
  diagnostics: string[];
  metrics: string[];
  conditions: string[];
  /** the executable render plan (#370) — what applyRecipe drives when given a field target. */
  render: RecipeRenderPlan;
  reducedMotion: RecipeReducedMotionPlan;
}

const tokensOf = (body: string): string[] => (body ?? '').split(/\s+/).filter(Boolean);

/** Derive the static surfaces a reduced-motion render should produce from the recipe's lanes. */
function staticOutputs(r: FieldRecipe): string[] {
  const out: string[] = [];
  if (r.metrics.length) out.push('metric-badges');
  if ((r.relationships?.length ?? 0) > 0) out.push('relationship-list');
  if (r.diagnostics.length) out.push('inspector-table');
  if ((r.conditions?.length ?? 0) > 0) out.push('condition-list');
  out.push('reduced-motion-note');
  return out;
}

/**
 * Compile a recipe into a runtime plan (pure). Reads behavior ONLY from the strict token lane — a
 * concept word never becomes a token. Metrics become feedback bindings; the accessibility block
 * becomes a reduced-motion output plan.
 */
export function compileRecipe(r: FieldRecipe): CompiledRecipe {
  return {
    id: r.id,
    recipe: r,
    bodies: r.bodies.map((b) => ({ attributes: recipeBodyAttributes(b), tokens: tokensOf(b.body) })),
    relationships: (r.relationships ?? []).map((rel) => ({ from: rel.from, to: rel.to, type: rel.type, strength: rel.strength })),
    feedback: r.metrics.map((m) => ({ metric: m, var: metricVar(m) })),
    diagnostics: [...r.diagnostics],
    metrics: [...r.metrics],
    conditions: [...(r.conditions ?? [])],
    render: recipeRenderPlan(r.render ?? []),
    reducedMotion: {
      reducedMotion: r.accessibility.reducedMotion,
      meaningWithoutMotion: r.accessibility.meaningWithoutMotion,
      staticOutputs: staticOutputs(r),
    },
  };
}

const attrsToString = (a: Record<string, string>): string =>
  Object.entries(a)
    .map(([k, v]) => (v === '' ? k : `${k}="${v}"`))
    .join(' ');

/**
 * Emit the `[data-body]` markup a recipe authors — a `<field-root>` plus one element per body. This is
 * the copy-paste authoring for a recipe; drop it on a page and the field runs the recipe.
 */
export function recipeToMarkup(r: FieldRecipe): string {
  const bodies = r.bodies.map((b) => `  <div ${attrsToString(recipeBodyAttributes(b))}></div>`).join('\n');
  return `<field-root></field-root>\n${bodies}`;
}

const pascal = (id: string): string =>
  id.split(/[^a-z0-9]+/i).filter(Boolean).map((s) => s[0]!.toUpperCase() + s.slice(1)).join('') || 'Field';

/** A recipe's copy-paste authoring across the three surfaces. */
export interface RecipeAuthoring {
  html: string;
  webComponent: string;
  react: string;
}

/** Emit a recipe's authoring for native HTML, the web component, and React (pure). */
export function recipeAuthoring(r: FieldRecipe): RecipeAuthoring {
  const bodyLines = r.bodies.map((b) => `  <div ${attrsToString(recipeBodyAttributes(b))}></div>`).join('\n');
  const reactBodies = r.bodies.map((b) => `      <div ${attrsToString(recipeBodyAttributes(b))} />`).join('\n');
  return {
    html: recipeToMarkup(r),
    webComponent: `<script type="module">\n  import '@field-ui/elements';\n</script>\n\n<field-root></field-root>\n${bodyLines}`,
    react: `import { FieldField } from '@field-ui/react';\n\nexport default function ${pascal(r.id)}() {\n  return (\n    <FieldField>\n${reactBodies}\n    </FieldField>\n  );\n}`,
  };
}
