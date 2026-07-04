/**
 * frameHarness — a DOM-free, frame-driving test harness for the element-consumer paths in
 * `field.ts` (§22.3 element capture / relocate / emit, §22.5 capture/release events).
 *
 * `headlessHost` exists for the *signals-first* consumer (an agent reading the field via `addBody`
 * + `onFeedback`): its scan root is empty by design, so the `[data-move]`/`[data-dock]`/`[data-warp]`/
 * `[data-emit]` element machinery in the frame loop is never exercised. PR #260 wired all of that —
 * movers drifting, a `[data-dock]` element collapsing into a sink, warp teleport, element emit, and
 * the `field:captured` / `field:released` / `field:relocated` dispatch — and it has stayed untested
 * because the only `createField` stub (`packages/vanilla/src/field.test.ts`) hands back a `raf` that
 * never fires and a `querySelectorAll` that returns `[]`, so the loop never runs.
 *
 * This harness closes that gap WITHOUT a DOM or a test framework (the repo forbids jsdom). It is a
 * hand-rolled element graph — each {@link HarnessElement} answers exactly the surface the engine
 * reads (`getBoundingClientRect`, `dataset`, `getAttribute`/`hasAttribute`/`setAttribute`/
 * `removeAttribute`, `style`, `dispatchEvent`, `isConnected`, `cloneNode`/`appendChild`/`remove`) —
 * plus a {@link FrameHarnessHost} whose `root.querySelectorAll` returns the live element list and
 * whose loop is **manual**: the engine re-schedules a frame each `raf`, and {@link FrameHarness.step}
 * fires them on a deterministic `dt`. Pair it with a seeded `rng` for a fully reproducible run.
 *
 * ```ts
 * const h = frameHarness({ width: 800, height: 600 });
 * const sink = h.add({ attrs: { 'data-body': 'sink', 'data-absorb': '900', 'data-max': '1' },
 *                      rect: { left: 400, top: 300, width: 40, height: 40 } });
 * const dock = h.add({ attrs: { 'data-move': '', 'data-dock': '' },
 *                      rect: { left: 410, top: 310, width: 20, height: 20 } });
 * const field = createField(h.canvas, { host: h.host, render: 'none', waves: false, rng: seededRng() });
 * field.scan();
 * h.step();                                // drive one frame — the dock element captures
 * dock.events.includes('field:captured');  // true
 * ```
 */
import { createField } from './field.ts';
import type { FieldHandle, FieldOptions } from './types.ts';
import type { FieldHost, HostViewport } from './host.ts';

/** A simple box for {@link HarnessElement.rect}; mutate `.rect` to move an element between frames. */
export interface HarnessRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Spec for an element registered in the harness scan root. */
export interface HarnessElementSpec {
  /** `data-*` (and any plain) attributes, by full name (e.g. `'data-body'`, `'data-dock'`). */
  attrs?: Record<string, string>;
  /** the element's initial layout box — mutate {@link HarnessElement.rect} to relocate it. */
  rect?: HarnessRect;
  /** tag name for guard messages (default `'DIV'`). */
  tag?: string;
  /** element id (default `''`). */
  id?: string;
}

const ZERO_RECT: HarnessRect = { left: 0, top: 0, width: 0, height: 0 };

/**
 * One element in the harness scan root — a hand-rolled stand-in answering the exact surface the
 * engine reads off a DOM element. The fields the frame loop mutates (transforms via `style`, a11y
 * via `aria-hidden`/`inert`, the `data-fx-cap` edge flag) are observable so tests can assert them,
 * and every `field:*` event the engine dispatches is recorded in {@link events}.
 */
export class HarnessElement {
  /** mutable layout box; the engine reads it through `getBoundingClientRect`. Move it to relocate. */
  rect: HarnessRect;
  readonly tagName: string;
  id: string;
  className = '';
  isConnected = true;
  /** every `dispatchEvent`'d event type, in order (e.g. `'field:captured'`). */
  readonly events: string[] = [];
  /** every dispatched event with its detail, in order — for asserting the payload. */
  readonly dispatched: Array<{ type: string; detail: unknown }> = [];
  readonly dataset: Record<string, string> = {};
  /** the writable style surface the engine writes transforms / opacity through. Index it by name
   *  (e.g. `el.style.transform`, `el.style.opacity`) or via setProperty/getPropertyValue. */
  readonly style: CSSStyleDeclaration;
  /** clones appended by element-emit (§22.3) live here (children), so a test can count them. */
  readonly children: HarnessElement[] = [];
  private readonly attrs: Record<string, string>;
  private readonly props: Record<string, string> = {};

  constructor(spec: HarnessElementSpec = {}) {
    this.attrs = { ...(spec.attrs ?? {}) };
    this.rect = spec.rect ? { ...spec.rect } : { ...ZERO_RECT };
    this.tagName = (spec.tag ?? 'DIV').toUpperCase();
    // `id` may be supplied directly OR as an `id` attribute (so emit templates `{ attrs: { id } }`
    // resolve through the same `#id` selector path the engine uses); the field is the source of truth.
    this.id = spec.id ?? this.attrs.id ?? '';
    delete this.attrs.id;
    // mirror `data-*` attributes into dataset (camelCased), the way the DOM does — the engine reads
    // dockable/warpable through hasAttribute but layout/emit/max/active through `dataset`.
    for (const [k, v] of Object.entries(this.attrs)) {
      if (k.startsWith('data-')) this.dataset[dashToCamel(k.slice(5))] = v;
    }
    const props = this.props;
    const styleApi: Record<string, unknown> = {
      setProperty(k: string, v: string) {
        props[k] = v;
      },
      removeProperty(k: string) {
        delete props[k];
      },
      getPropertyValue(k: string) {
        return props[k] ?? '';
      },
    };
    this.style = new Proxy(styleApi, {
      get(target, key: string) {
        if (key in target) return target[key];
        return props[key] ?? '';
      },
      set(_t, key: string, value: string) {
        props[key] = value;
        return true;
      },
    }) as unknown as CSSStyleDeclaration;
  }

  getBoundingClientRect(): DOMRect {
    const r = this.rect;
    return {
      left: r.left,
      top: r.top,
      right: r.left + r.width,
      bottom: r.top + r.height,
      width: r.width,
      height: r.height,
      x: r.left,
      y: r.top,
      toJSON: () => ({}),
    } as DOMRect;
  }

  getAttribute(name: string): string | null {
    if (name === 'aria-hidden' || name === 'inert') return this.props[name] ?? null;
    if (name === 'id') return this.id || null;
    return this.attrs[name] ?? null;
  }

  hasAttribute(name: string): boolean {
    if (name === 'aria-hidden' || name === 'inert') return name in this.props;
    if (name === 'id') return this.id !== '';
    return name in this.attrs;
  }

  setAttribute(name: string, value: string): void {
    if (name === 'aria-hidden' || name === 'inert') {
      this.props[name] = value;
    } else if (name === 'id') {
      this.id = value;
    } else {
      this.attrs[name] = value;
      if (name.startsWith('data-')) this.dataset[dashToCamel(name.slice(5))] = value;
    }
  }

  removeAttribute(name: string): void {
    if (name === 'aria-hidden' || name === 'inert') {
      delete this.props[name];
      return;
    }
    if (name === 'id') {
      this.id = ''; // element-emit strips the clone's id (no duplicate ids, §22.3)
      return;
    }
    delete this.attrs[name];
    if (name.startsWith('data-')) delete this.dataset[dashToCamel(name.slice(5))];
  }

  dispatchEvent(e: { type: string; detail?: unknown }): boolean {
    this.events.push(e.type);
    this.dispatched.push({ type: e.type, detail: (e as { detail?: unknown }).detail });
    return true;
  }

  appendChild(child: HarnessElement): HarnessElement {
    this.children.push(child);
    child.isConnected = true;
    return child;
  }

  remove(): void {
    this.isConnected = false;
  }

  cloneNode(_deep?: boolean): HarnessElement {
    // a deep clone carries the id too (the engine then strips it via removeAttribute('id')).
    return new HarnessElement({ attrs: { ...this.attrs }, rect: { ...this.rect }, tag: this.tagName, id: this.id });
  }
}

function dashToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
}

/** The host the harness drives — a {@link FieldHost} with a manual loop and the harness scan root. */
export interface FrameHarnessHost extends FieldHost {
  /** fire the single pending frame the engine scheduled, advancing the clock by `dt`. */
  tick(dt: number): void;
}

/** The harness handle returned by {@link frameHarness}. */
export interface FrameHarness {
  /** the host to pass as `createField(canvas, { host })`. */
  readonly host: FrameHarnessHost;
  /** a throwaway canvas — never drawn to (use `render: 'none'`), present only to satisfy the signature. */
  readonly canvas: HTMLCanvasElement;
  /** the live element list the scan root exposes. */
  readonly elements: readonly HarnessElement[];
  /** register an element in the scan root (before or after `scan()`; call `scan()`/`rescan()` to pick it up). */
  add(spec?: HarnessElementSpec): HarnessElement;
  /** detach an element (sets `isConnected = false` and drops it from the scan root). */
  remove(el: HarnessElement): void;
  /** drive `n` frames (default 1) at a fixed `dt` (default 16ms ≈ 1/60s) — deterministic stepping. */
  step(n?: number): void;
}

/** Options for {@link frameHarness}. */
export interface FrameHarnessOptions {
  /** the field's coordinate-space width (default 800). */
  width?: number;
  /** the field's coordinate-space height (default 600). */
  height?: number;
}

/**
 * Build a frame-driving harness. The returned {@link FrameHarness.host} drives the REAL `field.ts`
 * frame loop manually — `createField` schedules a frame through `raf`, and {@link FrameHarness.step}
 * fires it on a deterministic `dt`. Register elements with {@link FrameHarness.add}, call the field's
 * `scan()` to pick them up, then `step()` to advance frames and assert on `element.events`,
 * `element.style`, and `element.dataset`.
 */
export function frameHarness(opts: FrameHarnessOptions = {}): FrameHarness {
  const W = opts.width ?? 800;
  const H = opts.height ?? 600;
  const elements: HarnessElement[] = [];
  let frame: ((t: number) => void) | null = null;
  let t = 0;
  const noop = (): void => {};
  const off = (): (() => void) => noop;

  const matchesClause = (el: HarnessElement, clause: string): boolean => {
    // the four selector shapes the engine actually issues: a bare attribute (`[data-move]`), an
    // attribute-value (the warp `data-pair` selector, e.g. `[data-body="anchor"]`), an id (an emit
    // template, `#spark`), and a class. Anything fancier is out of scope (the engine never uses it).
    const attrVal = /^\[([a-z-]+)=["']?([^"'\]]*)["']?\]$/.exec(clause);
    if (attrVal) return el.getAttribute(attrVal[1]!) === attrVal[2];
    const attr = /^\[([a-z-]+)\]$/.exec(clause);
    if (attr) return el.hasAttribute(attr[1]!);
    if (clause.startsWith('#')) return el.id === clause.slice(1);
    if (clause.startsWith('.')) return el.className.split(/\s+/).includes(clause.slice(1));
    return false;
  };
  const matches = (el: HarnessElement, selector: string): boolean =>
    selector
      .split(',')
      .map((s) => s.trim())
      .some((clause) => matchesClause(el, clause));

  const root = {
    querySelectorAll: (selector: string) =>
      elements.filter((el) => el.isConnected && matches(el, selector)) as unknown as NodeListOf<Element>,
    querySelector: (selector: string) => elements.find((el) => el.isConnected && matches(el, selector)) ?? null,
    contains: (node: unknown) => elements.includes(node as HarnessElement),
  } as unknown as ParentNode;

  const host: FrameHarnessHost = {
    root,
    viewport: (): HostViewport => ({ width: W, height: H, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => H,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (cb) => {
      frame = cb;
      return 1;
    },
    cancelRaf: () => {
      frame = null;
    },
    // the harness runs with render:'none', so the heatmap-buffer canvas is never requested; throw a
    // clear message if a test asks for a drawing mode (it'd need a real canvas anyway).
    createCanvas: () => {
      throw new Error("frameHarness does not render — create the field with render:'none'.");
    },
    onResize: off,
    onScroll: off,
    onVisibility: off,
    onInput: off,
    onBodyEvent: off,
    tick(dt) {
      t += dt;
      const cb = frame;
      frame = null;
      cb?.(t);
    },
  };

  // a throwaway canvas — never drawn to under render:'none', but createField's signature wants one.
  const canvas = {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    setAttribute: noop,
    getContext: () => null,
  } as unknown as HTMLCanvasElement;

  return {
    host,
    canvas,
    elements,
    add(spec) {
      const el = new HarnessElement(spec);
      elements.push(el);
      return el;
    },
    remove(el) {
      el.isConnected = false;
      const i = elements.indexOf(el);
      if (i >= 0) elements.splice(i, 1);
    },
    step(n = 1) {
      for (let i = 0; i < n; i++) host.tick(16);
    },
  };
}

/**
 * Convenience: build a harness AND a field on it in one call, with the signals-first defaults the
 * harness needs (`render: 'none'`, `waves: false`). Returns both so a test drives `field.scan()` /
 * `harness.step()` and asserts on `harness.elements`.
 */
export function frameHarnessField(
  opts: FrameHarnessOptions & Omit<FieldOptions, 'host'> = {},
): { harness: FrameHarness; field: FieldHandle } {
  const { width, height, ...fieldOpts } = opts;
  const harness = frameHarness({ width, height });
  const field = createField(harness.canvas, {
    host: harness.host,
    render: 'none',
    waves: false,
    ...fieldOpts,
  });
  return { harness, field };
}

/** A tiny deterministic PRNG (mulberry32) for reproducible harness runs — pass as `rng`. */
export function seededRng(seed = 1): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
