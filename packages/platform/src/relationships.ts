/**
 * RelationshipRegistry — the DOM is a tree, but interfaces are graphs. This normalizes the
 * relationships HTML/ARIA already express (`a[href#id]`, `label[for]`, `aria-controls` /
 * `-describedby` / `-labelledby` / `-flowto`, and `data-field-relation`/`-target`) into ONE typed
 * relationship graph, then lets authors add expressive ones on top. Native semantics are respected
 * first; field-ui does not invent a parallel graph for links the platform already declares.
 *
 * Output maps to core's `RelationshipAgent` so the field engine treats relationships as agents.
 */
import type { RelationshipAgent } from 'field-ui';

export type RelationshipSource = 'html' | 'aria' | 'data' | 'recipe' | 'runtime';
export type RelationshipDirection = 'from-to' | 'to-from' | 'bidirectional';

export interface FieldRelationship {
  id: string;
  from: Element;
  to: Element;
  type: string;
  strength: number;
  direction: RelationshipDirection;
  confidence?: number;
  source: RelationshipSource;
  active: boolean;
  memory: number;
}

/** Resolve an id-ref to an element. */
export type Resolver = (id: string) => Element | null;

const idOf = (el: Element): string => el.id || `el-${Math.abs(hash(el.tagName + (el.id || '')))}`;
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function ids(attr: string | null): string[] {
  return (attr ?? '').split(/\s+/).filter(Boolean);
}

function rel(from: Element, to: Element, type: string, source: RelationshipSource, strength: number): FieldRelationship {
  return { id: `${idOf(from)}~${type}~${idOf(to)}`, from, to, type, strength, direction: 'from-to', source, active: false, memory: 0 };
}

/**
 * Extract the relationships a single element declares. Pure given a `resolve` for id-refs, so it is
 * testable without a document. Native relationships first; `data-field-relation` last.
 */
export function relationshipsFromElement(el: Element, resolve: Resolver): FieldRelationship[] {
  const out: FieldRelationship[] = [];
  const tag = el.tagName?.toUpperCase();
  const get = (n: string) => el.getAttribute(n);

  const href = get('href');
  if (tag === 'A' && href && href.startsWith('#')) {
    const t = resolve(href.slice(1));
    if (t) out.push(rel(el, t, 'references', 'html', 0.5));
  }
  if (tag === 'LABEL') {
    const t = get('for') && resolve(get('for')!);
    if (t) out.push(rel(el, t, 'labels', 'html', 0.8));
  }
  for (const [attr, type] of [
    ['aria-controls', 'controls'],
    ['aria-describedby', 'describes'],
    ['aria-labelledby', 'labelledby'],
    ['aria-flowto', 'flowto'],
  ] as const) {
    for (const id of ids(get(attr))) {
      const t = resolve(id);
      if (t) out.push(rel(el, t, type, 'aria', 0.6));
    }
  }
  const declared = get('data-field-relation');
  const target = get('data-field-target');
  if (declared && target) {
    const t = resolve(target.startsWith('#') ? target.slice(1) : target);
    if (t) {
      const s = Number(get('data-field-strength'));
      out.push(rel(el, t, declared, 'data', Number.isFinite(s) && s > 0 ? s : 0.7));
    }
  }
  return out;
}

export class RelationshipRegistry {
  private readonly rels = new Map<string, FieldRelationship>();

  /** Scan a root for native + declared relationships (idempotent — keys dedupe). */
  discover(root: ParentNode, resolve?: Resolver): void {
    const r: Resolver =
      resolve ?? ((id) => (typeof document !== 'undefined' ? document.getElementById(id) : null));
    const sel = 'a[href^="#"], label[for], [aria-controls], [aria-describedby], [aria-labelledby], [aria-flowto], [data-field-relation]';
    root.querySelectorAll(sel).forEach((el) => {
      for (const rl of relationshipsFromElement(el, r)) this.rels.set(rl.id, rl);
    });
  }

  /** Add an expressive relationship by hand (source defaults to `runtime`). */
  add(r: Omit<FieldRelationship, 'id' | 'direction' | 'active' | 'memory'> & Partial<FieldRelationship>): FieldRelationship {
    const full: FieldRelationship = {
      direction: 'from-to',
      active: false,
      memory: 0,
      ...r,
      id: r.id ?? `${idOf(r.from)}~${r.type}~${idOf(r.to)}`,
    };
    this.rels.set(full.id, full);
    return full;
  }

  all(): FieldRelationship[] {
    return [...this.rels.values()];
  }

  get size(): number {
    return this.rels.size;
  }

  /** Map the graph onto core `RelationshipAgent`s (endpoints keyed by element id). */
  toAgents(): RelationshipAgent[] {
    return this.all().map((r) => ({
      id: r.id,
      from: idOf(r.from),
      to: idOf(r.to),
      type: r.type,
      strength: r.strength,
      tension: 0,
      memory: r.memory,
      active: r.active,
    }));
  }
}
