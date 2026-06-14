/**
 * RelationshipRegistry — the DOM is a tree, but interfaces are graphs. This normalizes the
 * relationships HTML/ARIA already express (`a[href#id]`, `label[for]`, `aria-controls` /
 * `-describedby` / `-labelledby` / `-flowto`, and `data-field-relation`/`-target`) into ONE typed
 * relationship graph, then lets authors add expressive ones on top. Native semantics are respected
 * first; Fundamental does not invent a parallel graph for links the platform already declares.
 *
 * Output maps to core's `RelationshipAgent` so the field engine treats relationships as agents.
 */
import type { RelationshipAgent } from '@fundamental-engine/core';

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

/**
 * A relationship an element DECLARES whose target id-ref does not resolve to an element. Tracked so
 * resolution is real (a declared edge that points at nothing counts toward the total but not the
 * resolved set) and so inspection can name the missing endpoint — rather than silently dropping it.
 */
export interface UnresolvedRelationship {
  from: Element;
  type: string;
  /** the id-ref as authored (e.g. `#ghost` or `ghost`). */
  target: string;
  source: RelationshipSource;
}

/** Resolve an id-ref to an element. */
export type Resolver = (id: string) => Element | null;

// Id-less elements need a STABLE, UNIQUE fallback id. A content hash (tagName) collapsed every
// id-less <a> onto one key, so edges keyed by `${idOf(from)}~type~${idOf(to)}` collided and
// silently overwrote each other. A WeakMap hands out `el-<seq>` on first sight: same element → same
// id, distinct elements → distinct ids, entries released when the element is collected.
const fallbackIds = new WeakMap<Element, string>();
let fallbackSeq = 0;
const idOf = (el: Element): string => {
  if (el.id) return el.id;
  let id = fallbackIds.get(el);
  if (id === undefined) fallbackIds.set(el, (id = `el-${++fallbackSeq}`));
  return id;
};

function ids(attr: string | null): string[] {
  return (attr ?? '').split(/\s+/).filter(Boolean);
}

function rel(from: Element, to: Element, type: string, source: RelationshipSource, strength: number): FieldRelationship {
  return { id: `${idOf(from)}~${type}~${idOf(to)}`, from, to, type, strength, direction: 'from-to', source, active: false, memory: 0 };
}

export interface ScanResult {
  resolved: FieldRelationship[];
  unresolved: UnresolvedRelationship[];
}

/**
 * Scan the relationships a single element declares, partitioning them into RESOLVED edges (both
 * endpoints known) and UNRESOLVED declarations (an id-ref that points at no element). Pure given a
 * `resolve` for id-refs, so it is testable without a document. Native relationships first;
 * `data-field-relation` last.
 */
export function scanRelationships(el: Element, resolve: Resolver): ScanResult {
  const resolved: FieldRelationship[] = [];
  const unresolved: UnresolvedRelationship[] = [];
  const tag = el.tagName?.toUpperCase();
  const get = (n: string) => el.getAttribute(n);

  // one declared id-ref edge: resolved if the target exists, unresolved otherwise — never dropped.
  const edge = (idref: string, type: string, source: RelationshipSource, strength: number): void => {
    const id = idref.startsWith('#') ? idref.slice(1) : idref;
    const t = resolve(id);
    if (t) resolved.push(rel(el, t, type, source, strength));
    else unresolved.push({ from: el, type, target: idref, source });
  };

  const href = get('href');
  if (tag === 'A' && href && href.startsWith('#')) edge(href, 'references', 'html', 0.5);
  if (tag === 'LABEL') {
    const f = get('for');
    if (f) edge(f, 'labels', 'html', 0.8);
  }
  for (const [attr, type] of [
    ['aria-controls', 'controls'],
    ['aria-describedby', 'describes'],
    ['aria-labelledby', 'labelledby'],
    ['aria-flowto', 'flowto'],
  ] as const) {
    for (const id of ids(get(attr))) edge(id, type, 'aria', 0.6);
  }
  const declared = get('data-field-relation');
  const target = get('data-field-target');
  if (declared && target) {
    const s = Number(get('data-field-strength'));
    edge(target, declared, 'data', Number.isFinite(s) && s > 0 ? s : 0.7);
  }
  return { resolved, unresolved };
}

/** The RESOLVED relationships an element declares (back-compat wrapper over {@link scanRelationships}). */
export function relationshipsFromElement(el: Element, resolve: Resolver): FieldRelationship[] {
  return scanRelationships(el, resolve).resolved;
}

/** The DECLARED-but-UNRESOLVED relationships an element points at (targets that resolve to nothing). */
export function unresolvedRelationshipsFromElement(el: Element, resolve: Resolver): UnresolvedRelationship[] {
  return scanRelationships(el, resolve).unresolved;
}

export class RelationshipRegistry {
  private readonly rels = new Map<string, FieldRelationship>();
  private readonly unresolvedRels = new Map<string, UnresolvedRelationship>();

  /**
   * Scan a root for native + declared relationships. Each call REPLACES the unresolved set (so
   * previously-missing targets that have since mounted resolve on the next pass for free) and prunes
   * resolved edges whose endpoints are no longer connected (elements removed from the DOM).
   * Resolved edges accumulate across passes — only disconnected ones are dropped.
   */
  discover(root: ParentNode, resolve?: Resolver): void {
    const r: Resolver =
      resolve ?? ((id) => (typeof document !== 'undefined' ? document.getElementById(id) : null));

    // prune resolved edges whose from or to element left the DOM before rescanning
    for (const [id, rl] of this.rels) {
      if (!rl.from.isConnected || !rl.to.isConnected) this.rels.delete(id);
    }

    // replace the unresolved set entirely — previously-missing targets that have since mounted will
    // now resolve, and targets that are still absent will be re-recorded fresh
    this.unresolvedRels.clear();

    const sel = 'a[href^="#"], label[for], [aria-controls], [aria-describedby], [aria-labelledby], [aria-flowto], [data-field-relation]';
    root.querySelectorAll(sel).forEach((el) => {
      const { resolved, unresolved } = scanRelationships(el, r);
      for (const rl of resolved) this.rels.set(rl.id, rl);
      for (const u of unresolved) this.unresolvedRels.set(`${idOf(u.from)}~${u.type}~${u.target}`, u);
    });
  }

  /**
   * Drop all resolved and unresolved edges that touch `element` (as either endpoint). Use when an
   * element is removed and you want immediate reclamation ahead of the next discover() pass.
   */
  unregister(element: Element): void {
    for (const [id, rl] of this.rels) {
      if (rl.from === element || rl.to === element) this.rels.delete(id);
    }
    for (const [key, u] of this.unresolvedRels) {
      if (u.from === element) this.unresolvedRels.delete(key);
    }
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

  /** Declared relationships whose target id-ref resolved to no element. */
  unresolvedAll(): UnresolvedRelationship[] {
    return [...this.unresolvedRels.values()];
  }

  get unresolvedSize(): number {
    return this.unresolvedRels.size;
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
