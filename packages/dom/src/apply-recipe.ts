/**
 * applyRecipe — the DOM counterpart to core's `compileRecipe`. Turns a `FieldRecipe` from a record
 * into a running field program: it registers the recipe's bodies (TOKEN lane only — concepts are never
 * executed), binds its metrics to feedback variables, discovers its relationships, computes metric
 * state each frame, installs a reduced-motion output when motion is reduced, and returns a handle that
 * can be inspected and destroyed.
 *
 * It runs on a scoped `createFieldPlatform(root)` — the registry/feedback layer, not a particle canvas
 * — so it works on ordinary content the way the Reading Field studies do.
 */
import { createFieldPlatform, type FieldPlatform } from './platform.ts';
import { lintPlatform } from './lint.ts';
import { prefersReducedMotion } from './env.ts';
import { computeMetrics, groundedRecency, METRIC_KINDS, type MetricKind } from './metrics.ts';
import {
  validatePattern,
  compileRecipe,
  type FieldRecipe,
  type CompiledRecipe,
} from '@fundamental-engine/core';

export interface ApplyPatternOptions {
  /** existing elements (or a selector within root) to annotate as the pattern's bodies; if omitted, demo elements are created. */
  bodies?: Element[] | string;
  /** when bodies are provided, whether to overwrite their data-body attributes with the recipe's (default true). Set false to keep caller-owned tokens (e.g. bindData) while still binding the recipe's metrics. */
  annotateBodies?: boolean;
  /** force the reduced-motion output (defaults to the OS prefers-reduced-motion setting). */
  reducedMotion?: boolean;
  /** compute + bind metrics (default true). */
  metrics?: boolean;
  /** run the rAF loop (default true). Set false to drive `tick()` yourself. */
  drive?: boolean;
  /** text for created demo bodies (default: the body's tokens). */
  label?: (recipe: FieldRecipe, index: number) => string;
  /**
   * Apply the recipe with its render stack stripped (`render: []`) — the scoped invisible-field
   * idiom the example family runs: the field exists purely as metrics/feedback signals on real
   * content, with no drawn layers. The caller's recipe object is NEVER mutated (it may be the
   * shared catalog object); `applyRecipe` derives an effective copy, which is what the returned
   * handle's `recipe`/`compiled` reflect.
   */
  renderless?: boolean;
  /**
   * A live field to DRIVE with the recipe's render plan (#370) — the missing execution half of
   * `recipe.render`. Structural: a `FieldHandle` or a `<field-root>` element both satisfy it.
   * When provided (and not `renderless`/reduced-motion), the compiled plan executes — underlay
   * matter mode via setRender, the additive overlay reading stack via setOverlay, the heatmap
   * toggle — and `destroy()` resets the surfaces it drove (dots / off / false). Omitted → the
   * recipe stays signals-only, exactly as before (fully additive).
   */
  field?: PatternFieldTarget;
  /**
   * Extra metric lanes appended to the recipe's `metrics` (deduped, original order preserved) —
   * e.g. `['attention', 'recency']`. Each appended metric gains the standard feedback binding
   * (`attention` → `--field-attention`) and flows through the per-frame metric pipeline exactly
   * like a recipe-declared one. Same no-mutation guarantee as `renderless`.
   */
  extraMetrics?: string[];
}

export interface AppliedPatternInspection {
  id: string;
  frame: number;
  measurements: number;
  /** resolved relationships (both endpoints known). */
  relationships: number;
  /** declared relationships whose target id-ref resolves to no element. */
  relationshipsUnresolved: number;
  /** resolved / (resolved + unresolved); undefined when no relationships are declared. */
  relationshipResolution?: number;
  /** the unresolved declarations, so inspection can name each missing endpoint. */
  unresolvedRelationships: Array<{ from: string; type: string; target: string }>;
  /** elementKey → metric → value (the compiled recipe's lanes, live). */
  metrics: Record<string, Record<string, number>>;
  lint: number;
  reducedMotion: boolean;
}

export interface AppliedPattern {
  id: string;
  recipe: FieldRecipe;
  compiled: CompiledRecipe;
  platform: FieldPlatform;
  root: Element;
  elements: Element[];
  reducedMotion: boolean;
  inspect(): AppliedPatternInspection;
  tick(now?: number): void;
  destroy(): void;
}

/** @deprecated Renamed to {@link ApplyPatternOptions} (recipe → Pattern); removed at 1.0. */
export type ApplyRecipeOptions = ApplyPatternOptions;
/** @deprecated Renamed to {@link AppliedPatternInspection} (recipe → Pattern); removed at 1.0. */
export type AppliedRecipeInspection = AppliedPatternInspection;
/** @deprecated Renamed to {@link AppliedPattern} (recipe → Pattern); removed at 1.0. */
export type AppliedRecipe = AppliedPattern;

const isMetricKind = (m: string): m is MetricKind => (METRIC_KINDS as readonly string[]).includes(m);
const num = (v: string | null): number | undefined => {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const elementKey = (el: Element, i: number): string => el.id || `${el.tagName.toLowerCase()}#${i}`;

/**
 * Apply a recipe to a root element. Validates, compiles, registers bodies, binds metrics, discovers
 * relationships, installs the reduced-motion output, and returns a destroyable, inspectable handle.
 */
/** The slice of a live field a recipe can drive — FieldHandle and <field-root> both fit. */
export interface PatternFieldTarget {
  setRender?(mode: string): void;
  setOverlay?(mode: string | string[]): void;
  setHeatmap?(on: boolean): void;
}

/** Execute a compiled render plan on a field target. Exported for tests and custom hosts. */
export function driveRenderPlan(field: PatternFieldTarget, plan: { underlay: string | null; overlay: string[]; heatmap: boolean }): void {
  if (plan.underlay && field.setRender) field.setRender(plan.underlay);
  if (field.setOverlay) field.setOverlay(plan.overlay.length ? plan.overlay : 'off');
  if (field.setHeatmap) field.setHeatmap(plan.heatmap);
}

/** @deprecated Renamed to {@link applyPattern} (recipe → Pattern); removed at 1.0. */
export const applyRecipe = applyPattern;

export function applyPattern(root: Element, recipe: FieldRecipe, options: ApplyPatternOptions = {}): AppliedPattern {
  // Derive the effective recipe from the scoped-field options — a copy, so a shared catalog
  // recipe object is never mutated by an applied run (`renderless` strips the render stack;
  // `extraMetrics` appends + dedupes metric lanes). No options → the input recipe, untouched.
  const extra = options.extraMetrics ?? [];
  if (options.renderless || extra.length) {
    recipe = {
      ...recipe,
      ...(options.renderless ? { render: [] } : {}),
      ...(extra.length ? { metrics: [...new Set([...(recipe.metrics ?? []), ...extra])] } : {}),
    };
  }

  const problems = validatePattern(recipe);
  if (problems.length) throw new Error(`applyRecipe: invalid recipe "${recipe.id}": ${problems.map((p) => `${p.path} (${p.issue})`).join('; ')}`);

  const compiled = compileRecipe(recipe);
  const wantMetrics = options.metrics !== false;
  // the execution half of recipe.render (#370): drive the supplied field with the compiled plan.
  // Reduced motion skips the drive entirely — the recipe's static plan is the equivalent, and a
  // field left at its resting surfaces (dots / off) IS the static reading.
  let droveField: PatternFieldTarget | null = null;
  const reducedMotion = options.reducedMotion ?? prefersReducedMotion();

  const platform = createFieldPlatform(root);

  if (options.field && !options.renderless && !reducedMotion) {
    driveRenderPlan(options.field, compiled.render);
    droveField = options.field;
  }

  // ── resolve body elements: annotate provided ones, or create demo bodies ──────────────
  const created: Element[] = [];
  const restore: Array<{ el: Element; attrs: Record<string, string | null> }> = [];
  let elements: Element[];
  if (options.bodies) {
    elements = typeof options.bodies === 'string' ? Array.from(root.querySelectorAll(options.bodies)) : options.bodies.slice();
    if (options.annotateBodies !== false) {
      elements.forEach((el, i) => {
        const body = compiled.bodies[i % compiled.bodies.length]!;
        const snap: Record<string, string | null> = {};
        for (const [k, v] of Object.entries(body.attributes)) {
          snap[k] = el.getAttribute(k);
          el.setAttribute(k, v);
        }
        restore.push({ el, attrs: snap });
      });
    }
  } else {
    elements = compiled.bodies.map((body, i) => {
      const el = (root.ownerDocument ?? document).createElement('span');
      for (const [k, v] of Object.entries(body.attributes)) el.setAttribute(k, v);
      el.setAttribute('data-recipe-body', recipe.id);
      el.textContent = options.label ? options.label(recipe, i) : body.tokens.join(' ');
      root.appendChild(el);
      created.push(el);
      return el;
    });
  }

  // ── register for measurement + bind the metric lane to feedback variables ──────────────
  // `density` → `--field-density` is written each frame by the particle engine's feedback-sink.
  // Binding it through the recipe's metric pipeline would overwrite the live engine value with
  // the host-supplied `data-field-density` attribute (absent → 0). Exclude it so the engine's
  // write stays authoritative; `--d` is the canonical working channel.
  const ENGINE_OWNED_METRICS = new Set(['density']);
  const varMap: Record<string, string> = {};
  for (const f of compiled.feedback) {
    if (!ENGINE_OWNED_METRICS.has(f.metric)) varMap[f.metric] = f.var;
  }
  for (const el of elements) {
    platform.measure.register(el, { role: 'recipe-body' });
    if (wantMetrics && compiled.feedback.length) platform.feedback.bind(el, varMap);
  }

  // ── discover relationships once ──────────────────────────────────────────────────────
  let discovered = false;
  platform.on('discover', () => {
    if (!discovered) {
      platform.relationships.discover(root);
      discovered = true;
    }
  });

  // ── metric computation (compute → state); write phase flushes state → --field-* vars ───
  const prev = new Map<Element, Partial<Record<MetricKind, number>>>();
  if (wantMetrics) {
    const pending = new Map<Element, Partial<Record<MetricKind, number>>>();
    platform.on('compute', (ctx) => {
      const vh = ctx.viewport?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 800);
      const centre = vh / 2;
      // WORLD TIME, once per frame: ctx.now is the scheduler's rAF timebase, not an epoch, so
      // the declared-timestamp derivation samples the wall clock HERE — one instant shared by
      // every element in the frame, never a per-element Date.now().
      const worldNow = Date.now();
      const rels = platform.relationships.all();
      const unresolved = platform.relationships.unresolvedAll();
      for (const m of platform.measure.last()) {
        const el = m.element;
        const proximity = Math.max(0, 1 - Math.abs(m.rect.cy - centre) / (vh * 0.55));
        const engaged = el.matches(':hover, :focus, :focus-within') || el.hasAttribute('data-active');
        // a body touches a relationship if either endpoint is the body or sits inside it (child anchors)
        const touching = rels.filter((r) => el.contains(r.from) || el.contains(r.to));
        // declared-but-unresolved edges originating in this body count toward the total but not the
        // resolved set, so resolution is real: a citation pointing at nothing lowers it (raising entropy).
        const touchingUnresolved = unresolved.filter((u) => el.contains(u.from));
        const relResolved = touching.length;
        const relTotal = touching.length + touchingUnresolved.length;
        const relConflict = touching.filter((r) => r.type === 'contradicts' || r.type === 'opposes' || r.type === 'conflicts-with').length;
        const supplied: Partial<Record<MetricKind, number>> = {};
        for (const k of METRIC_KINDS) {
          const s = num(el.getAttribute(`data-field-${k}`));
          if (s != null) supplied[k] = s;
        }
        // A declared world timestamp (data-field-at) GROUNDS the recency lane: recency becomes
        // freshness(at, now, halfLife) — data time, not interaction time. An explicit
        // data-field-recency still wins; without either, computeMetrics infers recency from
        // interaction (the existing eased behavior, unchanged).
        if (supplied.recency == null) {
          const r = groundedRecency(el, worldNow);
          if (r != null) supplied.recency = r;
        }
        pending.set(
          el,
          computeMetrics({
            proximity,
            visible: m.visibilityRatio,
            engaged,
            dtFrames: 1,
            relResolved,
            relTotal,
            relConflict,
            supplied,
            prev: prev.get(el) ?? {},
          }),
        );
      }
    });
    platform.on('state', () => {
      for (const [el, computed] of pending) {
        prev.set(el, computed);
        for (const metric of compiled.metrics) {
          const value = isMetricKind(metric)
            ? computed[metric]
            : (num(el.getAttribute(`data-field-${metric}`)) ?? 0);
          if (value == null) {
            // The metric is absent this frame — e.g. the host supplied data-field-confidence on an
            // earlier frame and has since removed it. Drop any stale state AND clear the bound CSS
            // var, so the write phase neither re-emits a value nor leaves one written on a previous
            // flush lingering on the element. Absent must read as absent, not last-known. Both calls
            // are no-ops when nothing was ever set, so the common "never supplied" case stays cheap.
            platform.state.delete(el, metric);
            platform.feedback.clearVar(el, metric);
            continue;
          }
          platform.state.set(el, metric, value);
        }
      }
    });
  }

  // ── reduced-motion output: a real static surface, not just prose ──────────────────────
  let staticNode: HTMLElement | null = null;
  if (reducedMotion) {
    (root as HTMLElement).dataset.recipeReduced = 'on';
    const doc = root.ownerDocument ?? document;
    staticNode = doc.createElement('aside');
    staticNode.className = 'recipe-static';
    staticNode.setAttribute('data-recipe-static', recipe.id);
    staticNode.innerHTML =
      `<p class="rs-note">${escapeHtml(compiled.reducedMotion.meaningWithoutMotion)}</p>` +
      (compiled.metrics.length ? `<p class="rs-metrics">Metrics: ${compiled.metrics.map((m) => `<span>${escapeHtml(m)}</span>`).join(' ')}</p>` : '') +
      (compiled.relationships.length ? `<p class="rs-rels">Relationships: ${compiled.relationships.map((r) => `${escapeHtml(r.from)}→${escapeHtml(r.to)}`).join(', ')}</p>` : '');
    root.appendChild(staticNode);
  }

  // ── drive ─────────────────────────────────────────────────────────────────────────────
  let raf = 0;
  const viewport = () => (typeof window !== 'undefined' ? { width: window.innerWidth, height: window.innerHeight } : undefined);
  const tick = (now = 0): void => {
    platform.tick(now, viewport());
  };
  if (options.drive !== false && typeof requestAnimationFrame !== 'undefined') {
    const loop = (now: number): void => {
      tick(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  const inspect = (): AppliedRecipeInspection => {
    const metrics: Record<string, Record<string, number>> = {};
    elements.forEach((el, i) => {
      const row: Record<string, number> = {};
      for (const metric of compiled.metrics) row[metric] = platform.state.number(el, metric);
      metrics[elementKey(el, i)] = row;
    });
    const unresolved = platform.relationships.unresolvedAll();
    const resolvedCount = platform.relationships.all().length;
    const declaredTotal = resolvedCount + unresolved.length;
    return {
      id: recipe.id,
      frame: platform.scheduler.frame,
      measurements: platform.measure.size,
      relationships: resolvedCount,
      relationshipsUnresolved: unresolved.length,
      relationshipResolution: declaredTotal > 0 ? resolvedCount / declaredTotal : undefined,
      unresolvedRelationships: unresolved.map((u) => ({
        from: u.from.id || u.from.tagName.toLowerCase(),
        type: u.type,
        target: u.target,
      })),
      metrics,
      lint: lintPlatform(platform).length,
      reducedMotion,
    };
  };

  const destroy = (): void => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    // release the surfaces this recipe drove — the field returns to its resting reading
    if (droveField) {
      driveRenderPlan(droveField, { underlay: 'dots', overlay: [], heatmap: false });
      droveField = null;
    }
    // clear the feedback variables this recipe wrote, so a torn-down recipe leaves the DOM plain
    // (typeof-guarded like every other global here, so destroy() is safe off-DOM too)
    if (typeof HTMLElement !== 'undefined')
      for (const el of elements) if (el instanceof HTMLElement) for (const f of compiled.feedback) el.style.removeProperty(f.var);
    for (const el of created) el.remove();
    for (const { el, attrs } of restore) for (const [k, v] of Object.entries(attrs)) v == null ? el.removeAttribute(k) : el.setAttribute(k, v);
    staticNode?.remove();
    if (reducedMotion) delete (root as HTMLElement).dataset.recipeReduced;
  };

  return { id: recipe.id, recipe, compiled, platform, root, elements, reducedMotion, inspect, tick, destroy };
}

/** Tear down an applied recipe (alias of `applied.destroy()`). */
export function destroyRecipe(applied: AppliedRecipe): void {
  applied.destroy();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

/** @deprecated Renamed to {@link PatternFieldTarget} (recipe → Pattern rename); removed at 1.0. */
export type RecipeFieldTarget = PatternFieldTarget;
