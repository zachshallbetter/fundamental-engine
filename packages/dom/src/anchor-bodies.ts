/**
 * anchorBodies — tether popovers / tooltips to moving field bodies via CSS Anchor Positioning (#680).
 *
 * The engine moves a kinematic body (`[data-move]`) by writing `transform: translate(…)` on it, and
 * CSS Anchor Positioning resolves `anchor()` against the anchor element's *transformed* box — verified
 * empirically before this shipped (Chromium 148.0.7778.96, Playwright): a `position-anchor` element
 * follows its anchor pixel-exactly through `transform: translate()`, `translate`, `transform: … scale()`
 * and an inline `style.setProperty('anchor-name', …)`. So the only thing an author needs from the
 * engine to tether a tooltip to a mover is a stable `anchor-name` on the body — that is what this
 * helper writes:
 *
 * ```ts
 * import { anchorBodies } from '@fundamental-engine/dom';
 * const anchored = anchorBodies();                    // names every [data-body] / [data-move]
 * anchored.nameFor(chip);                             // '--field-body-chip' (from the element's id)
 * ```
 * ```css
 * .tip { position: absolute; position-anchor: --field-body-chip; top: anchor(bottom); left: anchor(left); }
 * @supports not (anchor-name: --x) { .tip { top: 100%; left: 0; } }   (static fallback beside the slot)
 * ```
 *
 * A **dynamic** body (`data-authority="dynamic"`) is the one case anchor positioning cannot follow:
 * the engine owns its position and never writes it to the DOM (it is reported through
 * `field.query()` / `field.snapshot()` only), so its layout box stays put. The opt-in `follow`
 * channel closes that gap from the DOM side: each tick it reads the engine-owned centre from
 * `field.query({ include: ['bodies'] })`, measures the element's layout centre on a cadence, and
 * writes the delta as `--move-x` / `--move-y` (px) on the element — change-gated, so a resting body
 * costs zero DOM writes. A tooltip anchored to the body then follows with
 * `translate: var(--move-x, 0px) var(--move-y, 0px)`. Bodies are matched by element `id`
 * (anonymous bodies get engine-synthetic ids the DOM cannot resolve, so they are skipped).
 *
 * Contract: **opt-in, feature-detected, SSR-safe.** Nothing here runs unless called; without
 * `CSS.supports('anchor-name: --x')` no `anchor-name` is written and `supported` is `false`; without
 * a `document` (SSR / Node) the result is an inert no-op. Core is never touched — the engine's mover
 * transform writes and dynamic-body integration are byte-identical whether or not this runs. Under
 * `prefers-reduced-motion` the engine freezes (dt = 0), so movers and dynamic bodies stop and the
 * tether is static — no extra guard needed (reduced motion removes motion, not meaning).
 */
import type { FieldHandle } from '@fundamental-engine/core';

/** The CSS-var pair the `follow` channel writes (px). Short, unprefixed — like `--d` / `--load` /
 *  `--lit` — and deliberately outside the `--field-*` feedback namespace the platform lint audits. */
export const ANCHOR_FOLLOW_VARS = { x: '--move-x', y: '--move-y' } as const;

/** Default anchor-name prefix: a body with `id="chip"` is named `--field-body-chip`. */
export const ANCHOR_NAME_PREFIX = '--field-body';

/** Default selector: every scanned body and every engine-moved element. */
export const ANCHOR_BODY_SELECTOR = '[data-body], [data-move]';

/** The `follow` channel — dynamic-body offsets written as CSS vars (see module doc). */
export interface AnchorFollowOptions {
  /** the field whose engine-owned body positions to follow (only `query` is used). */
  field: Pick<FieldHandle, 'query'>;
  /** the field's coordinate origin in viewport px — `{ 0, 0 }` for a window host (default); a
   *  contained field passes its container's `{ left, top }` (what `containerHost` reports as
   *  `originX` / `originY`). A function is called every measure. */
  origin?: { x: number; y: number } | (() => { x: number; y: number });
  /** re-measure each element's layout box every N ticks (default 6 — the engine's own body-measure
   *  cadence). `1` measures every tick (exact under scroll, one forced layout per tick). */
  measureEvery?: number;
  /** override the var names (default {@link ANCHOR_FOLLOW_VARS}). */
  vars?: { x?: string; y?: string };
  /** the tick scheduler (default: a `requestAnimationFrame` loop; absent rAF ⇒ manual `tick()` only).
   *  Receives the tick and returns its stop function. */
  schedule?: (tick: () => void) => () => void;
}

export interface AnchorBodiesOptions {
  /** where to look for bodies (default `document`). Absent `document` ⇒ inert no-op. */
  root?: ParentNode;
  /** which elements to name (default {@link ANCHOR_BODY_SELECTOR}). */
  selector?: string;
  /** anchor-name prefix (default {@link ANCHOR_NAME_PREFIX}). */
  prefix?: string;
  /** opt into the dynamic-body offset channel (`--move-x` / `--move-y`). Off by default. */
  follow?: AnchorFollowOptions;
}

export interface AnchorBodiesResult {
  /** `true` when the browser supports CSS Anchor Positioning and names were written. `false` ⇒ no
   *  `anchor-name` was written anywhere (the `follow` vars are plain custom properties and still run
   *  when opted in — they need no platform support, and serve the `@supports not` fallback too). */
  supported: boolean;
  /** element → the `anchor-name` written on it (empty when unsupported). */
  names: ReadonlyMap<Element, string>;
  /** the anchor-name for an element this call named, or `undefined`. */
  nameFor(el: Element): string | undefined;
  /** re-query `selector` (after the DOM changed) — names new elements, keeps existing names stable. */
  rescan(): void;
  /** one step of the `follow` channel (a no-op without `follow`). The default scheduler calls this
   *  every animation frame; call it yourself under a custom scheduler or in tests. */
  tick(): void;
  /** number of style writes the last `tick()` performed (change-gated; `0` for a resting field). */
  writesLastTick: number;
  /** remove every name and var this call wrote and stop the scheduler. */
  dispose(): void;
}

/**
 * `true` when the browser implements CSS Anchor Positioning — `CSS.supports('anchor-name: --x')`.
 * SSR-safe: `false` without a `CSS` global or `CSS.supports`.
 */
export function supportsAnchorPositioning(): boolean {
  const css = (globalThis as { CSS?: { supports?: (q: string) => boolean } }).CSS;
  if (!css || typeof css.supports !== 'function') return false;
  try {
    return css.supports('anchor-name: --x') === true && css.supports('position-anchor: --x') === true;
  } catch {
    return false;
  }
}

/** Reduce an id to a `<dashed-ident>`-safe fragment (anything outside `[A-Za-z0-9_-]` becomes `-`). */
function identFragment(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_-]/g, '-');
}

/**
 * The anchor-name an element gets: `${prefix}-${id}` from its `id`, else `${prefix}-${index}` for
 * an anonymous element. Pure — the same input always yields the same name, so an author can write
 * `position-anchor: --field-body-chip` for `<span id="chip" data-move>` without calling anything.
 */
export function anchorBodyName(el: Element, prefix: string = ANCHOR_NAME_PREFIX, index: number = 0): string {
  const id = typeof el.id === 'string' && el.id ? identFragment(el.id) : String(index);
  return `${prefix}-${id}`;
}

type Styled = Element & { style?: { setProperty?: (n: string, v: string) => void; removeProperty?: (n: string) => void } };

function setProp(el: Element, name: string, value: string): boolean {
  const style = (el as Styled).style;
  if (!style || typeof style.setProperty !== 'function') return false;
  style.setProperty(name, value);
  return true;
}

function removeProp(el: Element, name: string): void {
  const style = (el as Styled).style;
  if (style && typeof style.removeProperty === 'function') style.removeProperty(name);
}

/** The inert result for SSR / no root — every member is a safe no-op. */
function inert(): AnchorBodiesResult {
  return {
    supported: false,
    names: new Map(),
    nameFor: () => undefined,
    rescan: () => {},
    tick: () => {},
    writesLastTick: 0,
    dispose: () => {},
  };
}

/**
 * Write a stable `anchor-name` on every body / mover under `root` so popovers and tooltips can
 * `position-anchor` to them, and (opt-in) follow engine-owned dynamic bodies through `--move-x` /
 * `--move-y`. Feature-detected, SSR-safe, opt-in; see the module doc for the full contract.
 */
export function anchorBodies(opts: AnchorBodiesOptions = {}): AnchorBodiesResult {
  const root = opts.root ?? (typeof document !== 'undefined' ? document : undefined);
  if (!root || typeof root.querySelectorAll !== 'function') return inert();

  const selector = opts.selector ?? ANCHOR_BODY_SELECTOR;
  const prefix = opts.prefix ?? ANCHOR_NAME_PREFIX;
  const supported = supportsAnchorPositioning();
  const names = new Map<Element, string>();
  const dyn: Element[] = []; // the dynamic bodies the follow channel tracks, in scan order (cached at scan time — no per-frame filter)
  const seen = new Set<Element>();
  let anon = 0; // running index for anonymous (id-less) elements — stable across rescans

  // a dynamic body the engine can report by id (an anonymous body gets an engine-synthetic id the DOM
  // cannot resolve, so it is skipped — see the module doc).
  const isDynamic = (el: Element): boolean =>
    typeof el.getAttribute === 'function' && el.getAttribute('data-authority') === 'dynamic' && !!el.id;

  const scan = (): void => {
    for (const el of root.querySelectorAll(selector)) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (isDynamic(el)) dyn.push(el);
      if (!supported) continue;
      const name = anchorBodyName(el, prefix, el.id ? 0 : anon++);
      if (setProp(el, 'anchor-name', name)) names.set(el, name);
    }
  };
  scan();

  // ── follow channel (dynamic bodies) ────────────────────────────────────────────────────────────
  const follow = opts.follow;
  const varX = follow?.vars?.x ?? ANCHOR_FOLLOW_VARS.x;
  const varY = follow?.vars?.y ?? ANCHOR_FOLLOW_VARS.y;
  const measureEvery = Math.max(1, Math.floor(follow?.measureEvery ?? 6));
  const layout = new Map<Element, { x: number; y: number }>(); // measured layout centre (viewport px)
  const last = new Map<Element, string>(); // last written "x|y" per element (change gate)
  let ticks = 0;
  let writesLastTick = 0;

  const originOf = (): { x: number; y: number } => {
    const o = follow?.origin;
    if (!o) return { x: 0, y: 0 };
    return typeof o === 'function' ? o() : o;
  };

  const measure = (el: Element): void => {
    const g = (el as Element & { getBoundingClientRect?: () => { left: number; top: number; width: number; height: number } })
      .getBoundingClientRect;
    if (typeof g !== 'function') return;
    const r = g.call(el);
    const o = originOf();
    layout.set(el, { x: r.left + r.width / 2 - o.x, y: r.top + r.height / 2 - o.y });
  };

  const tick = (): void => {
    writesLastTick = 0;
    if (!follow || dyn.length === 0) return;
    const remeasure = ticks % measureEvery === 0;
    ticks++;
    const readings = follow.field.query({ include: ['bodies'] }).bodies;
    for (const el of dyn) {
      if (remeasure || !layout.has(el)) measure(el);
      const home = layout.get(el);
      if (!home) continue;
      let reading: (typeof readings)[number] | undefined;
      for (const b of readings) if (b.id === el.id) { reading = b; break; }
      if (!reading?.rect) continue;
      const dx = reading.rect.x + reading.rect.width / 2 - home.x;
      const dy = reading.rect.y + reading.rect.height / 2 - home.y;
      const sx = `${dx.toFixed(2)}px`;
      const sy = `${dy.toFixed(2)}px`;
      const key = `${sx}|${sy}`;
      if (last.get(el) === key) continue;
      last.set(el, key);
      if (setProp(el, varX, sx)) writesLastTick++;
      if (setProp(el, varY, sy)) writesLastTick++;
    }
  };

  let stop: (() => void) | undefined;
  if (follow) {
    if (follow.schedule) stop = follow.schedule(tick);
    else if (typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function') {
      let raf = 0;
      const loop = (): void => {
        tick();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      stop = () => cancelAnimationFrame(raf);
    }
  }

  const result: AnchorBodiesResult = {
    supported,
    names,
    nameFor: (el) => names.get(el),
    rescan: scan,
    tick,
    get writesLastTick() {
      return writesLastTick;
    },
    dispose: () => {
      stop?.();
      stop = undefined;
      for (const [el] of names) removeProp(el, 'anchor-name');
      for (const [el] of last) {
        removeProp(el, varX);
        removeProp(el, varY);
      }
      names.clear();
      last.clear();
      layout.clear();
      dyn.length = 0;
      seen.clear();
    },
  };
  return result;
}
