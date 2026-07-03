/**
 * FieldHost — the renderer/environment seam (Phase: frontier). `createField`'s engine is
 * renderer-agnostic: every DOM-global touchpoint (viewport size, scroll, rAF, reduced-motion,
 * visibility, the scan root, and event wiring) goes through this injected host instead of `window` /
 * `document` / `requestAnimationFrame` directly. `browserHost()` (in `@fundamental-engine/dom`)
 * binds it to the browser; an alternative host could drive the same engine from a headless renderer,
 * a different document, or a test harness. This interface is pure types — no globals — so `field.ts`
 * imports zero DOM (enforced by `dom-boundary.test.ts`).
 */

/** The host's current viewport, in CSS px plus device-pixel ratio. */
export interface HostViewport {
  width: number;
  height: number;
  dpr: number;
  /** field-space origin in the host's measurement coords — the top-left the field is drawn from.
   *  `0,0` for a window-scoped host (the default); a CONTAINED host (`containerHost`) returns its
   *  element's `left,top` so the field, its bodies, and its canvas all live in container-local space.
   *  `measureBodies` and the thread/move readouts subtract it. Optional → 0 keeps every window host
   *  and test byte-identical. */
  originX?: number;
  originY?: number;
}

/**
 * `MinimalFieldHost` — the SMALLEST surface a host must supply for the engine to run. It is the
 * required core of {@link FieldHost}; everything else (scroll, reduced-motion, visibility, the heatmap
 * canvas, and every event subscription) is an OPTIONAL capability the engine degrades around when
 * absent (see {@link hostCapabilities}). A host that supplies only these four members runs the full
 * simulation + feedback pipeline headlessly — it just never scrolls, never pauses on visibility, and
 * cannot draw a heatmap.
 *
 * The three things a host MUST provide:
 * - **geometry** — `root` (the scan root) + `viewport()` (size + DPR + optional origin): *where* the
 *   field lives and in what coordinate space.
 * - **time** — `raf()` / `cancelRaf()`: how the frame loop is scheduled (a real rAF, a manual `tick`,
 *   a native display link).
 */
export interface MinimalFieldHost {
  /** the subtree scanned for `[data-body]` / `[data-move]` / `[data-on]` / `[data-hot]` / `[data-formation]`. */
  root: ParentNode;
  /** the current viewport size + DPR (read each resize). */
  viewport(): HostViewport;
  /** schedule the next frame; returns a handle. */
  raf(cb: (t: number) => void): number;
  /** cancel a scheduled frame. */
  cancelRaf(id: number): void;
}

/**
 * `FieldHost` — the full renderer/environment SPI: the {@link MinimalFieldHost} required core plus the
 * OPTIONAL capabilities the engine consumes when a host offers them. Absent capabilities degrade
 * gracefully (scroll → 0, reduced-motion / hidden → false, subscriptions → no-op, and a drawing mode
 * that needs `createCanvas` throws a clear error rather than the field silently misbehaving). Existing
 * hosts that implement every member keep satisfying this contract unchanged; a new host only has to
 * supply the four required members. Use {@link hostCapabilities} to detect what a given host offers,
 * or {@link defineHost} to fill the no-op defaults from a minimal host.
 */
export interface FieldHost extends MinimalFieldHost {
  /** current vertical scroll offset in px. Absent ⇒ the field treats scroll as 0 (never scrolls). */
  scrollY?(): number;
  /** the scrollable height of the page (cached by the caller — reading it forces reflow). Absent ⇒ falls back to the viewport height. */
  scrollHeight?(): number;
  /** whether the user prefers reduced motion (freezes the sim). Absent ⇒ `false` (motion allowed). */
  reducedMotion?(): boolean;
  /** whether the surface is hidden (backgrounded tab) — pauses the loop. Absent ⇒ `false` (never auto-pauses). */
  hidden?(): boolean;
  /** an offscreen canvas for the heatmap buffer. Absent ⇒ any drawing mode that needs it throws a clear error; signals-first (`render: 'none'`) never calls it. */
  createCanvas?(): HTMLCanvasElement;
  /** subscribe to viewport-resize; returns an unsubscribe. Absent ⇒ the field never re-reads its viewport on resize. */
  onResize?(cb: () => void): () => void;
  /** subscribe to scroll; returns an unsubscribe. Absent ⇒ no scroll-driven readouts. */
  onScroll?(cb: () => void): () => void;
  /** subscribe to surface visibility changes; returns an unsubscribe. Absent ⇒ the loop never auto-pauses. */
  onVisibility?(cb: () => void): () => void;
  /** subscribe to user input activity (pointer/wheel/key/touch); returns an unsubscribe. Absent ⇒ no input-activity signal. */
  onInput?(cb: () => void): () => void;
  /** subscribe to a composed shadow-DOM body event by name; returns an unsubscribe. Absent ⇒ programmatic bodies only (no DOM body-event registration). */
  onBodyEvent?(type: string, cb: (e: Event) => void): () => void;
  /** release host-side state when the field is destroyed — called once by `FieldHandle.destroy()`
   *  after every event subscription is unsubscribed. A contained host (`containerHost`) uses it to
   *  remove its `data-field-boundary` ownership marker so the outer/page field re-adopts the bodies
   *  on its next rescan (#980). Absent ⇒ nothing to release. Idempotent by contract. */
  detach?(): void;
}

/**
 * What optional capabilities a {@link FieldHost} actually supplies — the "host conformance" read-out.
 * A capability is present when the host provides the backing member(s); the engine degrades gracefully
 * around any that are absent. This is the third parity/testing category alongside API-surface parity
 * and mathematical conformance: *does this host tick time, provide geometry, feed back, project…?*
 */
export interface HostCapabilities {
  /** always true — the required core (`root` + `viewport` + `raf`/`cancelRaf`) is present by type. */
  geometry: boolean;
  /** the host schedules frames (`raf`/`cancelRaf`) — always true for a valid host. */
  time: boolean;
  /** the host reports scroll position/height (`scrollY` and/or `scrollHeight`). */
  scroll: boolean;
  /** the host can create the offscreen heatmap canvas (`createCanvas`) — required for heatmap draw modes. */
  canvas: boolean;
  /** the host reports the reduced-motion preference (`reducedMotion`). */
  reducedMotion: boolean;
  /** the host reports surface visibility (`hidden` and/or `onVisibility`) so the loop can auto-pause. */
  visibility: boolean;
  /** the host emits at least one subscription (`onResize`/`onScroll`/`onVisibility`/`onInput`/`onBodyEvent`). */
  events: boolean;
  /** the host relays composed shadow-DOM body events (`onBodyEvent`) — DOM body registration. */
  bodyEvents: boolean;
}

/**
 * Inspect which optional capabilities a host supplies — see {@link HostCapabilities}. Pure, allocation-
 * light, and safe on a `MinimalFieldHost` (every optional lane reads `false`). Use it to branch on host
 * shape (e.g. only enable a heatmap mode when `caps.canvas`) or as the basis of a host-conformance check.
 */
export function hostCapabilities(host: FieldHost): HostCapabilities {
  return {
    geometry: true,
    time: typeof host.raf === 'function' && typeof host.cancelRaf === 'function',
    scroll: typeof host.scrollY === 'function' || typeof host.scrollHeight === 'function',
    canvas: typeof host.createCanvas === 'function',
    reducedMotion: typeof host.reducedMotion === 'function',
    visibility: typeof host.hidden === 'function' || typeof host.onVisibility === 'function',
    events:
      typeof host.onResize === 'function' ||
      typeof host.onScroll === 'function' ||
      typeof host.onVisibility === 'function' ||
      typeof host.onInput === 'function' ||
      typeof host.onBodyEvent === 'function',
    bodyEvents: typeof host.onBodyEvent === 'function',
  };
}

const NEVER_UNSUBSCRIBE = (): void => {};

/**
 * Build a full {@link FieldHost} from a {@link MinimalFieldHost} plus any optional capabilities you
 * choose to override — the no-op / graceful defaults are filled for the rest. This is the sanctioned
 * way to author a host without hand-writing the whole subscription boilerplate: supply geometry + time
 * (and whatever else your environment offers) and the field runs. Pure; touches no globals.
 *
 * ```ts
 * const host = defineHost({
 *   root, viewport, raf, cancelRaf,        // the required core
 *   reducedMotion: () => prefersReducedMotion(),  // one optional capability
 * });
 * ```
 */
export function defineHost(host: MinimalFieldHost & Partial<FieldHost>): FieldHost {
  return {
    root: host.root,
    viewport: host.viewport,
    raf: host.raf,
    cancelRaf: host.cancelRaf,
    scrollY: host.scrollY,
    scrollHeight: host.scrollHeight,
    reducedMotion: host.reducedMotion,
    hidden: host.hidden,
    createCanvas: host.createCanvas,
    onResize: host.onResize ?? (() => NEVER_UNSUBSCRIBE),
    onScroll: host.onScroll ?? (() => NEVER_UNSUBSCRIBE),
    onVisibility: host.onVisibility ?? (() => NEVER_UNSUBSCRIBE),
    onInput: host.onInput ?? (() => NEVER_UNSUBSCRIBE),
    onBodyEvent: host.onBodyEvent ?? (() => NEVER_UNSUBSCRIBE),
  };
}
