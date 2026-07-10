/**
 * bindData — make real application data participate in field behavior. Records become bodies, mapped
 * metrics become state, mapped relationships become graph edges, and a recipe supplies the behavior
 * (metric/feedback framework) via applyPattern(). Updates are deterministic (diff by id); removed
 * records decay before they leave rather than popping.
 *
 *   const binding = bindData(container, records, mapper, { pattern: 'search-relevance-field' });
 *   binding.update(nextRecords);
 *   binding.destroy();
 *
 * The recipe frames the field (which metrics → --field-* are tracked); the per-record mapper owns the
 * body tokens, metric values, and relationships — so the data drives the field, not a mock.
 */
import { patternById, type FieldPattern } from '@fundamental-engine/core';
import { applyPattern, type AppliedPattern } from './apply-recipe.ts';

export interface MappedBody {
  tokens: string[];
  strength?: number;
  range?: number;
  spin?: number;
  angle?: number;
  feedback?: boolean;
}
export interface MappedRelationship {
  to: string;
  type: string;
  strength?: number;
}
export interface MappedRecord {
  id: string;
  body: MappedBody;
  metrics?: Record<string, number>;
  relationships?: MappedRelationship[];
  label?: string;
}
export type RecordMapper<T> = (record: T, index: number) => MappedRecord;

export interface BindDataOptions<T = unknown> {
  /** the Pattern whose metric/feedback framework drives the bound bodies (id or object). */
  pattern?: string | FieldPattern;
  /** @deprecated Renamed to {@link BindDataOptions.pattern} (recipe → Pattern); read as a fallback, removed at 1.0. */
  recipe?: string | FieldPattern;
  /** decay duration (ms) before a removed record leaves the DOM (default 400). */
  decayMs?: number;
  /** element tag for each record (default 'div'). */
  tag?: string;
  /** class added to each record element. */
  className?: string;
  /** install the recipe's reduced-motion output instead of motion (passed to applyPattern). */
  reducedMotion?: boolean;
  /** custom inner HTML per record (domain markup); overrides the default label. Relationship anchors are kept. */
  content?: (record: T, mapped: MappedRecord) => string;
}

export interface DataBindingInspection {
  records: number;
  bodies: number;
  relationships: number;
}
export interface DataBinding<T> {
  container: HTMLElement;
  update(records: T[]): void;
  ids(): string[];
  applied(): AppliedPattern | null;
  inspect(): DataBindingInspection | null;
  destroy(): void;
}

/** Diff two id sets (pure). */
export function diffIds(prev: Iterable<string>, next: Iterable<string>): { added: string[]; removed: string[]; kept: string[] } {
  const p = new Set(prev);
  const n = new Set(next);
  const added: string[] = [];
  const removed: string[] = [];
  const kept: string[] = [];
  for (const id of n) (p.has(id) ? kept : added).push(id);
  for (const id of p) if (!n.has(id)) removed.push(id);
  return { added, removed, kept };
}

const setNum = (el: HTMLElement, k: string, v: number | undefined): void => {
  if (v != null && Number.isFinite(v)) el.setAttribute(k, String(v));
  else el.removeAttribute(k);
};

/** Apply a mapped record's body tokens, metric values, label/content, and relationship anchors. */
function applyMapped(el: HTMLElement, m: MappedRecord, contentHtml?: string): void {
  const doc = el.ownerDocument;
  el.setAttribute('data-body', m.body.tokens.join(' '));
  setNum(el, 'data-strength', m.body.strength);
  setNum(el, 'data-range', m.body.range);
  setNum(el, 'data-spin', m.body.spin);
  setNum(el, 'data-angle', m.body.angle);
  if (m.body.feedback) el.setAttribute('data-feedback', '');
  // metric values → data-field-<metric> (the recipe + applyPattern turn these into --field-* state)
  for (const [k, v] of Object.entries(m.metrics ?? {})) setNum(el, `data-field-${k}`, v);
  // domain content (overrides label), else the plain label
  if (contentHtml != null) {
    let box = el.querySelector<HTMLElement>(':scope > .bd-content');
    if (!box) {
      box = doc.createElement('div');
      box.className = 'bd-content';
      el.prepend(box);
    }
    box.innerHTML = contentHtml;
  } else if (m.label != null) {
    let lbl = el.querySelector<HTMLElement>(':scope > .bd-label');
    if (!lbl) {
      lbl = doc.createElement('span');
      lbl.className = 'bd-label';
      el.prepend(lbl);
    }
    lbl.textContent = m.label;
  }
  // relationships → child anchors the RelationshipRegistry discovers (one per edge)
  el.querySelectorAll(':scope > .bd-rel').forEach((a) => a.remove());
  for (const r of m.relationships ?? []) {
    const a = doc.createElement('a');
    a.className = 'bd-rel';
    a.setAttribute('aria-hidden', 'true');
    a.setAttribute('href', `#${r.to}`);
    a.setAttribute('data-field-relation', r.type);
    a.setAttribute('data-field-target', `#${r.to}`);
    if (r.strength != null) a.setAttribute('data-field-strength', String(r.strength));
    el.appendChild(a);
  }
}

/** Bind records to a field. Returns a handle with update()/destroy(). */
export function bindData<T>(container: HTMLElement, records: T[], mapper: RecordMapper<T>, options: BindDataOptions<T> = {}): DataBinding<T> {
  const decayMs = options.decayMs ?? 400;
  const tag = options.tag ?? 'div';
  const doc = container.ownerDocument;
  const els = new Map<string, HTMLElement>();
  let applied: AppliedPattern | null = null;
  const patternArg = options.pattern ?? options.recipe;

  const reapply = (): void => {
    applied?.destroy();
    applied = null;
    const items = [...els.values()].filter((e) => !('bdExiting' in e.dataset));
    const recipe = typeof patternArg === 'string' ? patternById(patternArg) : patternArg;
    if (recipe && items.length) applied = applyPattern(container, recipe, { bodies: items, annotateBodies: false, reducedMotion: options.reducedMotion });
  };

  const render = (recs: T[]): void => {
    const mapped = recs.map((rec, i) => mapper(rec, i));
    const nextIds = mapped.map((m) => m.id);
    const { added, removed } = diffIds(els.keys(), nextIds);

    mapped.forEach((m, i) => {
      let el = els.get(m.id);
      if (!el) {
        el = doc.createElement(tag);
        el.dataset.bdId = m.id;
        el.id = m.id; // addressable so relationships/anchors can target a record by id
        if (options.className) el.className = options.className;
        el.dataset.bdEntering = '';
        container.appendChild(el);
        els.set(m.id, el);
        const created = el;
        if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => created.removeAttribute('data-bd-entering'));
        else el.removeAttribute('data-bd-entering');
      }
      applyMapped(el, m, options.content?.(recs[i]!, m));
      container.appendChild(el); // keep DOM order aligned with records
    });

    for (const id of removed) {
      const el = els.get(id);
      if (!el) continue;
      el.dataset.bdExiting = ''; // CSS fades it; zero its metric vars so feedback eases down
      for (const attr of Array.from(el.attributes)) if (attr.name.startsWith('data-field-')) el.setAttribute(attr.name, '0');
      els.delete(id);
      const finish = (): void => {
        el.remove();
        reapply();
      };
      if (typeof setTimeout !== 'undefined') setTimeout(finish, decayMs);
      else finish();
    }

    if (added.length || removed.length) reapply();
  };

  render(records);

  return {
    container,
    update: render,
    ids: () => [...els.keys()],
    applied: () => applied,
    inspect: () => {
      if (!applied) return null;
      const ins = applied.inspect();
      return { records: els.size, bodies: ins.measurements, relationships: ins.relationships };
    },
    destroy: () => {
      applied?.destroy();
      applied = null;
      for (const el of els.values()) el.remove();
      els.clear();
    },
  };
}
