/**
 * Shadow-DOM participation (docs/shadow-dom.md) — the host-first, event-driven body
 * registration model. A component encapsulates its rendering but exposes a public physical
 * body: it dispatches a `composed` registration event, the field registers the HOST (never
 * inspecting the shadow tree), measures it by `getBoundingClientRect` or an optional
 * `getRect`, and writes field state back as CSS variables on the host (or a write target).
 *
 * Two halves, deliberately split so the engine logic is testable without a DOM event system:
 *  - `ForcesController` — the component side: dispatches register / unregister / update.
 *  - `ShadowRegistry`   — the engine side: holds registered hosts, prunes the disconnected,
 *                          and builds bodies. The DOM-event wiring lives in `field.ts`.
 */
import type { Body } from './types.ts';
import type { BodyAttrs } from './scanner.ts';

/** The registration event names. `composed: true` lets them cross the shadow boundary. */
export const REGISTER_BODY = 'forces:register-body';
export const UNREGISTER_BODY = 'forces:unregister-body';
export const UPDATE_BODY = 'forces:update-body';

/**
 * `field:*` aliases (field-ui migration). Dispatched alongside the `forces:*` names and listened
 * for in parallel, so register / unregister / update work under either namespace during the
 * transition (docs/field-ui-migration-plan.md §15, Alias Implementation Contract). The `forces:*`
 * names remain canonical until the migration removal version.
 */
export const FIELD_REGISTER_BODY = 'field:register-body';
export const FIELD_UNREGISTER_BODY = 'field:unregister-body';
export const FIELD_UPDATE_BODY = 'field:update-body';

/** Each `forces:*` registration event mapped to its `field:*` twin, for paired dispatch. */
const FIELD_EVENT_ALIAS: Record<string, string> = {
  [REGISTER_BODY]: FIELD_REGISTER_BODY,
  [UNREGISTER_BODY]: FIELD_UNREGISTER_BODY,
  [UPDATE_BODY]: FIELD_UPDATE_BODY,
};

/** Payload of a `forces:register-body` event (shadow-dom.md §7). */
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
    const fire = (t: string): void =>
      void this.host.dispatchEvent(new CustomEvent(t, { bubbles: true, composed: true, detail }));
    fire(type); // canonical forces:* event
    const twin = FIELD_EVENT_ALIAS[type];
    if (twin) fire(twin); // field:* alias, so listeners on either namespace are reached
  }
}

/** @deprecated field-ui-migration alias of {@link FieldController}; use `FieldController`. */
export { FieldController as ForcesController };

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
   */
  bodies(build: (el: HTMLElement, attrs?: BodyAttrs) => Body): Body[] {
    const out: Body[] = [];
    for (const [el, detail] of this.hosts) {
      if (!(el as RegistrableElement).isConnected) {
        this.hosts.delete(el);
        continue;
      }
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
