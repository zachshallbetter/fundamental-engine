/**
 * Shadow-DOM participation (docs/engine-reference/shadow-dom.md) — the host-first, event-driven body
 * registration model. A component encapsulates its rendering but exposes a public physical
 * body: it dispatches a `composed` registration event, the field registers the HOST (never
 * inspecting the shadow tree), measures it by `getBoundingClientRect` or an optional
 * `getRect`, and writes field state back as CSS variables on the host (or a write target).
 *
 * Two halves, deliberately split so the engine logic is testable without a DOM event system:
 *  - `FieldController` — the component side: dispatches register / unregister / update.
 *  - `ShadowRegistry`   — the engine side: holds registered hosts, prunes the disconnected,
 *                          and builds bodies. The DOM-event wiring lives in `field.ts`.
 */
import type { Body } from './types.ts';
import { FIELD_BOUNDARY_ATTR, FIELD_BOUNDARY_SELECTOR, type BodyAttrs } from './scanner.ts';

/** The registration event names. `composed: true` lets them cross the shadow boundary. */
export const REGISTER_BODY = 'field:register-body';
export const UNREGISTER_BODY = 'field:unregister-body';
export const UPDATE_BODY = 'field:update-body';

/**
 * Which field(s) a registered host participates in (shadow-dom.md §18). `'global'` — the default,
 * and the pre-scope behaviour — means EVERY field that hears the composed registration event adopts
 * the host. `'nearest'` applies the same nearest-enclosing-field ownership the light-DOM scanner
 * uses (#980): only the field whose scan root is the host's nearest enclosing `data-field-boundary`
 * (a contained field's bounds element) adopts it, or the page field when no boundary encloses it.
 */
export type FieldScope = 'nearest' | 'global';

/**
 * An explicit field target — a portal (shadow-dom.md §17, §19). `'root'` is the page field (the one
 * scanning the document); a selector string or an `Element` names a contained field by its SCAN ROOT
 * (the `bounds:` / `containerHost` element). When set it beats `scope`: the host joins exactly the
 * targeted field regardless of where it sits in the tree, and no field at all if none matches
 * (§17 rung 4 — inert until such a field exists).
 */
export type FieldTarget = 'root' | string | Element;

/** Payload of a `field:register-body` event (shadow-dom.md §7). */
export interface RegisterBodyDetail {
  /** the public physical element — usually the custom-element host. */
  element: HTMLElement;
  /** optional rectangle provider, when the body's box is not the host box (closed roots). */
  getRect?: () => DOMRect;
  /** explicit body attributes (suffix → value, e.g. `{ body: 'attract', strength: '0.9' }`);
   *  when omitted the engine reads the host's own `data-*`. */
  attrs?: Record<string, string>;
  /** element that receives the CSS-variable write-back; defaults to `element`. */
  writeTarget?: HTMLElement;
  /** participation scope (§18) — omitted / `'global'`: every field that hears the event adopts the
   *  host (the pre-scope behaviour); `'nearest'`: only the nearest enclosing field does. */
  scope?: FieldScope;
  /** explicit field target — a portal (§19). Beats `scope` when set. */
  field?: FieldTarget;
}

/**
 * The nearest enclosing `[data-field-boundary]` of `el` across shadow boundaries (§17): `closest()`
 * inside the current tree, then hop from a shadow root to its host and continue, so a host nested
 * inside another component's shadow tree still resolves to the light-DOM boundary around it. Every
 * DOM capability is feature-detected — an element without `closest` resolves to `null`, and a root
 * node without `host` (the document) ends the walk. Pure: no globals.
 */
export function nearestFieldBoundary(el: Element): Element | null {
  let cur: Element | null = el;
  while (cur) {
    if (typeof cur.closest !== 'function') return null;
    const boundary = cur.closest(FIELD_BOUNDARY_SELECTOR);
    if (boundary) return boundary;
    const rootNode: Node | null = typeof cur.getRootNode === 'function' ? cur.getRootNode() : null;
    const host: Element | null = rootNode ? ((rootNode as Partial<ShadowRoot>).host ?? null) : null;
    cur = host && host !== cur ? host : null;
  }
  return null;
}

/**
 * Is `root` the PAGE field's scan root — the document itself (`browserHost`) or its
 * `documentElement` (the platform runtime's scan root)? Anything else (a contained field's bounds
 * element, a fragment, a headless stub) is not. Feature-detected on `nodeType`.
 */
export function isPageRoot(root: ParentNode): boolean {
  const n = (root as Partial<Node>).nodeType;
  if (n === 9) return true; // Node.DOCUMENT_NODE
  if (n === 1) {
    const doc = (root as Element).ownerDocument;
    return !!doc && doc.documentElement === root;
  }
  return false;
}

/** Is `root` a contained field's bounds element (carries the engine-set boundary marker)? */
function isBoundaryRoot(root: ParentNode): boolean {
  const r = root as Partial<Element>;
  return typeof r.hasAttribute === 'function' && r.hasAttribute(FIELD_BOUNDARY_ATTR);
}

/**
 * Does the field scanning `root` adopt this registration (§17 resolution order)?
 *  1. an explicit `field` target wins: `'root'` → the page field only; a selector → the field whose
 *     scan root matches it; an `Element` → the field whose scan root IS it.
 *  2. `scope: 'nearest'` → nearest-enclosing-field ownership, mirroring the scanner's
 *     `ownedByScanRoot` (#980) but across shadow boundaries: owned when the host's nearest
 *     boundary is this root, or when no boundary encloses it and this root is not itself a
 *     contained field's (marked) bounds element — a host outside every contained field is the
 *     page's. An element without `closest` is always owned (the scanner's rule — ownership only
 *     applies where an ancestor chain exists).
 *  3. otherwise (no `field`, no `scope`, or `'global'`) → adopted, the default.
 * Pure of the DOM event system; every DOM method is feature-detected.
 */
export function fieldAdopts(detail: RegisterBodyDetail, root: ParentNode): boolean {
  const { field, scope, element } = detail;
  if (field !== undefined && field !== null && field !== '') {
    if (field === 'root') return isPageRoot(root);
    if (typeof field === 'string') {
      const r = root as Partial<Element>;
      return typeof r.matches === 'function' && r.matches(field);
    }
    return field === root;
  }
  if (scope === 'nearest') {
    if (typeof element.closest !== 'function') return true;
    const boundary = nearestFieldBoundary(element);
    if (boundary === null) return !isBoundaryRoot(root);
    return boundary === (root as unknown);
  }
  return true;
}

/**
 * Component-side helper (shadow-dom.md §31.1) so a custom element joins the field without
 * repeating event boilerplate. Construct with the host (and optional extra detail), then
 * call `connect()` / `disconnect()` / `update()` from the element's lifecycle callbacks.
 */
export class FieldController {
  private readonly host: HTMLElement;
  private readonly detail: Omit<Partial<RegisterBodyDetail>, 'element'>;

  constructor(host: HTMLElement, detail: Omit<Partial<RegisterBodyDetail>, 'element'> = {}) {
    this.host = host;
    this.detail = detail;
  }

  /** register the host as a body — call from `connectedCallback`. */
  connect(): void {
    this.emit(REGISTER_BODY);
  }
  /** remove the body — call from `disconnectedCallback`. */
  disconnect(): void {
    this.emit(UNREGISTER_BODY);
  }
  /** refresh attrs/geometry — call from `attributeChangedCallback`. */
  update(): void {
    this.emit(UPDATE_BODY);
  }

  private emit(type: string): void {
    const detail = { element: this.host, ...this.detail };
    this.host.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
  }
}

/** A minimal element shape the registry needs — kept structural so tests need no real DOM. */
interface RegistrableElement extends HTMLElement {
  isConnected: boolean;
}

/**
 * Engine-side registry of event-registered hosts. Pure of the DOM event system: the field
 * feeds it details and asks for bodies each scan. It prunes hosts that have left the document
 * (do not rely on `disconnectedCallback` alone, §15) and never touches a shadow root.
 */
export class ShadowRegistry {
  private readonly hosts = new Map<HTMLElement, RegisterBodyDetail>();

  /** Register (or, idempotently, refresh) a host. */
  register(detail: RegisterBodyDetail): void {
    this.hosts.set(detail.element, detail);
  }

  /** Drop a host. */
  unregister(element: HTMLElement): void {
    this.hosts.delete(element);
  }

  /** how many hosts are currently registered (post-prune count is via `bodies`). */
  get size(): number {
    return this.hosts.size;
  }

  /**
   * Build a `Body` per live registered host, pruning any that have disconnected. `build` is
   * the scanner's `bodyFromElement`; `attrs` (if supplied at registration) override the
   * host's own `data-*`, else the host is read directly. A custom `getRect` and `writeTarget`
   * are attached to the resulting body.
   *
   * `root` — the asking field's scan root — enables scoped participation (§17–§19): a host
   * registered with `scope: 'nearest'` or an explicit `field` target is built only when
   * {@link fieldAdopts} says this root owns it. Omitting `root` (headless / harness hosts), or a
   * detail with neither key, builds every live host exactly as before — the root is never touched
   * on that path. A host this field does not adopt stays registered (it may be adopted later, e.g.
   * once its target field exists) and is still pruned when it disconnects.
   */
  bodies(build: (el: HTMLElement, attrs?: BodyAttrs) => Body, root?: ParentNode): Body[] {
    const out: Body[] = [];
    for (const [el, detail] of this.hosts) {
      if (!(el as RegistrableElement).isConnected) {
        this.hosts.delete(el);
        continue;
      }
      if (root !== undefined && !fieldAdopts(detail, root)) continue;
      const attrs = detail.attrs ? attrsView(detail.attrs, el) : undefined;
      const body = build(el, attrs);
      if (detail.getRect) body.rect = detail.getRect;
      if (detail.writeTarget) body.writeTarget = detail.writeTarget;
      out.push(body);
    }
    return out;
  }
}

/** A `BodyAttrs` view that prefers the explicit `attrs` record, falling back to the host. */
function attrsView(attrs: Record<string, string>, el: HTMLElement): BodyAttrs {
  return {
    get: (name) => attrs[name] ?? el.getAttribute('data-' + name),
    has: (name) => name in attrs || el.hasAttribute('data-' + name),
  };
}
