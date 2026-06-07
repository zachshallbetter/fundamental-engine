/**
 * ElementAgent (system-contracts §6) — a DOM element that receives field metrics and writes DOM
 * state. The engine already writes `--d` / `--field-density` for the density metric; this widens
 * that to the full ElementAgent metric set (attention, heat, entropy, coherence, memory, pressure,
 * pull-x/y) and emits both the `--field-*` and the `--forces-*` alias for each, plus a
 * `data-field-*` state attribute band for CSS that prefers attribute selectors.
 *
 * `elementAgentVars` / `elementAgentState` are pure (no DOM) so they are node-testable; the thin
 * `writeElementAgent` applies them to a real element. An ElementAgent never mutates particles
 * unless it is also a registered body (the §6 rule).
 */

/** The metrics an ElementAgent can receive (system-contracts §6). All optional. */
export interface ElementMetrics {
  density?: number;
  attention?: number;
  heat?: number;
  entropy?: number;
  coherence?: number;
  memory?: number;
  pressure?: number;
  pullX?: number;
  pullY?: number;
}

/** metric key → CSS-var suffix (kebab). */
const SUFFIX: Record<keyof ElementMetrics, string> = {
  density: 'density',
  attention: 'attention',
  heat: 'heat',
  entropy: 'entropy',
  coherence: 'coherence',
  memory: 'memory',
  pressure: 'pressure',
  pullX: 'pull-x',
  pullY: 'pull-y',
};

const fmt = (n: number): string => (Number.isFinite(n) ? n.toFixed(3) : '0');

/**
 * The CSS custom properties an ElementAgent writes for a metric set — each metric as both
 * `--field-<m>` and its `--forces-<m>` migration alias (identical value). Pure.
 */
export function elementAgentVars(m: ElementMetrics): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(m) as (keyof ElementMetrics)[]) {
    const v = m[key];
    if (v == null) continue;
    const s = fmt(v);
    out[`--field-${SUFFIX[key]}`] = s;
    out[`--forces-${SUFFIX[key]}`] = s;
  }
  return out;
}

/**
 * A coarse `data-field-*` state band for a metric (`low` < 0.33 ≤ `mid` < 0.66 ≤ `high`), so CSS
 * can switch on `[data-field-density="high"]` without reading the numeric var. Pure.
 */
export function elementAgentState(m: ElementMetrics): Record<string, string> {
  const band = (v: number): string => (v < 0.33 ? 'low' : v < 0.66 ? 'mid' : 'high');
  const out: Record<string, string> = {};
  for (const key of Object.keys(m) as (keyof ElementMetrics)[]) {
    const v = m[key];
    if (v == null || key === 'pullX' || key === 'pullY') continue; // bands are for scalar 0..1 metrics
    out[`data-field-${SUFFIX[key]}`] = band(v);
  }
  return out;
}

/** Apply an ElementAgent's metrics to a real element (CSS vars + data-field-* state). Thin DOM. */
export function writeElementAgent(el: HTMLElement, m: ElementMetrics): void {
  const vars = elementAgentVars(m);
  for (const name of Object.keys(vars)) el.style.setProperty(name, vars[name]!);
  const state = elementAgentState(m);
  for (const name of Object.keys(state)) el.setAttribute(name, state[name]!);
}

/** Clear everything an ElementAgent wrote (teardown / unregister). Thin DOM. */
export function clearElementAgent(el: HTMLElement): void {
  for (const key of Object.keys(SUFFIX) as (keyof ElementMetrics)[]) {
    el.style.removeProperty(`--field-${SUFFIX[key]}`);
    el.style.removeProperty(`--forces-${SUFFIX[key]}`);
    el.removeAttribute(`data-field-${SUFFIX[key]}`);
  }
}
