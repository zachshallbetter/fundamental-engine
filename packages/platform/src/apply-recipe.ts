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
import { computeMetrics, METRIC_KINDS, type MetricKind } from './metrics.ts';
import {
  validateRecipe,
  compileRecipe,
  type FieldRecipe,
  type CompiledRecipe,
} from 'field-ui';

export interface ApplyRecipeOptions {
  /** existing elements (or a selector within root) to annotate as the recipe's bodies; if omitted, demo elements are created. */
  bodies?: Element[] | string;
  /** force the reduced-motion output (defaults to the OS prefers-reduced-motion setting). */
  reducedMotion?: boolean;
  /** compute + bind metrics (default true). */
  metrics?: boolean;
  /** run the rAF loop (default true). Set false to drive `tick()` yourself. */
  drive?: boolean;
  /** text for created demo bodies (default: the body's tokens). */
  label?: (recipe: FieldRecipe, index: number) => string;
}

export interface AppliedRecipeInspection {
  id: string;
  frame: number;
  measurements: number;
  relationships: number;
  /** elementKey → metric → value (the compiled recipe's lanes, live). */
  metrics: Record<string, Record<string, number>>;
  lint: number;
  reducedMotion: boolean;
}

export interface AppliedRecipe {
  id: string;
  recipe: FieldRecipe;
  compiled: CompiledRecipe;
  platform: FieldPlatform;
  root: Element;
  elements: Element[];
  reducedMotion: boolean;
  inspect(): AppliedRecipeInspection;
  tick(now?: number): void;
  destroy(): void;
}

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
export function applyRecipe(root: Element, recipe: FieldRecipe, options: ApplyRecipeOptions = {}): AppliedRecipe {
  const problems = validateRecipe(recipe);
  if (problems.length) throw new Error(`applyRecipe: invalid recipe "${recipe.id}": ${problems.map((p) => `${p.path} (${p.issue})`).join('; ')}`);

  const compiled = compileRecipe(recipe);
  const wantMetrics = options.metrics !== false;
  const reducedMotion =
    options.reducedMotion ??
    (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const platform = createFieldPlatform(root);

  // ── resolve body elements: annotate provided ones, or create demo bodies ──────────────
  const created: Element[] = [];
  const restore: Array<{ el: Element; attrs: Record<string, string | null> }> = [];
  let elements: Element[];
  if (options.bodies) {
    elements = typeof options.bodies === 'string' ? Array.from(root.querySelectorAll(options.bodies)) : options.bodies.slice();
    elements.forEach((el, i) => {
      const body = compiled.bodies[i % compiled.bodies.length]!;
      const snap: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(body.attributes)) {
        snap[k] = el.getAttribute(k);
        el.setAttribute(k, v);
      }
      restore.push({ el, attrs: snap });
    });
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
  const varMap: Record<string, string> = {};
  for (const f of compiled.feedback) varMap[f.metric] = f.var;
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
  const prev = new Map<Element, Record<string, number>>();
  if (wantMetrics) {
    const pending = new Map<Element, Record<MetricKind, number>>();
    platform.on('compute', (ctx) => {
      const vh = ctx.viewport?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 800);
      const centre = vh / 2;
      const rels = platform.relationships.all();
      for (const m of platform.measure.last()) {
        const el = m.element;
        const proximity = Math.max(0, 1 - Math.abs(m.rect.cy - centre) / (vh * 0.55));
        const engaged = el.matches(':hover, :focus, :focus-within') || el.hasAttribute('data-active');
        const touching = rels.filter((r) => r.from === el || r.to === el);
        const relTotal = touching.length;
        const relConflict = touching.filter((r) => r.type === 'contradicts' || r.type === 'opposes' || r.type === 'conflicts-with').length;
        const supplied: Partial<Record<MetricKind, number>> = {};
        for (const k of METRIC_KINDS) {
          const s = num(el.getAttribute(`data-field-${k}`));
          if (s != null) supplied[k] = s;
        }
        pending.set(
          el,
          computeMetrics({
            proximity,
            visible: m.visibilityRatio,
            engaged,
            dtFrames: 1,
            relResolved: relTotal,
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
          const value = isMetricKind(metric) ? computed[metric] : num(el.getAttribute(`data-field-${metric}`)) ?? 0;
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
    return {
      id: recipe.id,
      frame: platform.scheduler.frame,
      measurements: platform.measure.size,
      relationships: platform.relationships.all().length,
      metrics,
      lint: lintPlatform(platform).length,
      reducedMotion,
    };
  };

  const destroy = (): void => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
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
